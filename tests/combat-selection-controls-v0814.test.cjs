"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Controls = require("../src/hunt-combat-controls"), { Document, boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, go = (state, type, args = {}) => E.dispatch(state, { type, ...args });
function create(rewards = ["bloodstone-shard", "bloodstone-chunk", "rune-clawmark"]) {
  let state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: rewards, startConsumables: ["qa-cards"] } });
  while (state.rewardChoices.length) state = go(state, "EQUIP_REWARD", { rewardId: state.rewardChoices[0].rewardId, slot: 0 });
  return state;
}
function encounter(state, cost = "endurance") {
  for (const [type, args] of [["MOVE", { cardId: H(state).hand.find(card => card.kind === cost).id }],
    ["EXPLORE", { edge: "N" }], ["PLACE_TILE", { rotation: 0 }], ["STOP_MOVE", {}]]) state = go(state, type, args);
  return state;
}
function attack(state, cardId, slot = 0, rewardIds = []) {
  return go(state, "ATTACK", { cardId, slot, rewardIds, itemIds: [], pullIds: [], enemyId: state.enemies.find(enemy => enemy.missionId === "mob").id });
}
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07";
function launch(state) {
  const normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true })), calls = [],
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
      storage: { [qaKey]: E.exportSave(state), [normalKey]: normalSave, "bloodborne-hunt-active-mode": "qa" },
      engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state,
        applyCombatReactionRuling: state => state, dispatch(state, command) { calls.push(command); return E.dispatch(state, command); } } });
  return { ui, calls, normalSave };
}
function select(ui, id, value) { const element = ui.el(id); assert(element, id); element.value = value; element.fire("change"); }
function selected(ui, area, attribute, value) { return ui.el(area).querySelectorAll(`[data-${attribute}]`).find(element => element.dataset[attribute] === String(value)); }
function click(ui, area, type, predicate = () => true) {
  const button = ui.buttons(area).find(button => button.dataset.command === type && predicate(JSON.parse(button.dataset.args || "{}")));
  assert(button && !button.disabled, `${area} has enabled ${type}`); button.click(); assert.equal(ui.el("error").textContent, "");
  return E.importSave(ui.storage.get(qaKey));
}

test("slot strengthening shows printed damage plus only equipped permanent bonuses and matches a real declaration", () => {
  const state = encounter(create()), before = E.exportSave(state), slots = Controls.slotFacts(state, E),
    cardId = H(state).hand.find(card => card.kind === "strength").id;
  assert.deepEqual(slots.map(slot => [slot.upgradeDamage, slot.upgradeSpeed]), [[2, 1], [0, 0], [0, 0]]);
  assert.equal(slots[0].damage, 12); assert.equal(slots[0].totalDamage, 14);
  assert.equal(slots[0].speed, 3); assert.equal(slots[0].totalSpeed, 4);
  assert.match(Controls.slotFormulaHTML(slots[0]), /기본 피해 12 \+ 강화 2 = <b>피해 14<\/b>/);
  assert.match(Controls.slotFormulaHTML(slots[0]), /속도 3 \+ 강화 1 = <b>4<\/b>/);
  assert.match(Controls.slotFormulaHTML(slots[1]), /기본 피해 12 \+ 강화 0 = <b>피해 12<\/b>/);
  const model = Controls.view(state, E, { cardId, slot: 0 }), after = attack(state, cardId);
  assert.equal(after.combat.attack.damage, model.selectedSlot.totalDamage + E.card(H(state).hand.find(card => card.id === cardId)).damage);
  assert.equal(after.combat.attack.speed, model.selectedSlot.totalSpeed);
  assert.equal(E.exportSave(state), before, "displaying the equipment and choices cannot spend or move a reward");
  assert.equal(E.slots(state)[0].damage, 12, "the printed weapon definition is never rewritten");
});

test("the same attachment is counted once after public transformation and reassignment", () => {
  let state = create(["bloodstone-shard"]);
  state = go(state, "TRANSFORM", { cardId: H(state).hand[0].id });
  const rewardId = H(state).rewards[0].id;
  state = go(state, "REASSIGN_REWARD", { rewardId, slot: 2 });
  const facts = Controls.slotFacts(state, E);
  assert.deepEqual(facts.map(slot => slot.upgradeDamage), [0, 0, 1]);
  assert.deepEqual(facts.map(slot => slot.totalDamage), [6, 6, 7]);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
});

test("rune replacement keeps the selected card's suppressed effects visible and matches the actual loss of slot clearing", () => {
  const state = encounter(create(["rune-clawmark"]), "strength"), before = E.exportSave(state),
    cardId = H(state).hand.find(card => card.kind === "endurance").id,
    rewardId = H(state).rewards[0].id, input = { cardId, slot: 0, rewardIds: [rewardId] },
    model = Controls.view(state, E, input), html = Controls.renderHTML(model),
    after = attack(state, cardId, 0, [rewardId]);
  assert.equal(model.selectedCard.text, E.card(H(state).hand.find(card => card.id === cardId)).text);
  assert.match(html, /원래 카드 효과 대체/); assert.match(html, /미적용<\/span> 회피 · 이 슬롯을 비웁니다/);
  assert.match(html, /대신 적용 · 공격 피해 \+1 · 방해/);
  assert.match(html, /모든 스탯 효과가 적용되지 않습니다/);
  assert.equal(H(after).slots[0].id, cardId, "endurance's normal clear effect is replaced");
  assert.equal(after.combat.attack.damage, 13); assert.equal(after.combat.attack.interrupt, true);
  assert.equal(H(after).rewards[0].ready, false);
  assert.equal(E.exportSave(state), before); assert.deepEqual(input.rewardIds, [rewardId]);
  const ordinary = Controls.renderHTML(Controls.view(state, E, { cardId, slot: 0 }));
  assert.doesNotMatch(ordinary, /원래 카드 효과 대체|combat-suppressed-effect/);
  assert.match(ordinary, /회피 · 이 슬롯을 비웁니다/);
});

test("dodge selection uses printed slot speed rather than bloodstone's attack-only bonus and ignores attack runes/items", () => {
  const state = encounter(create()), cardId = H(state).hand.find(card => card.kind === "strength").id,
    committed = attack(state, cardId, 1), dodgeId = H(committed).hand.find(card => card.kind === "endurance").id,
    model = Controls.view(committed, E, { mode: "dodge", cardId: dodgeId, slot: 0,
      rewardIds: [H(committed).rewards.find(reward => reward.kind === "rune-clawmark").id],
      items: [{ name: "공격용 소모품", rules: "공격 강화" }] }), html = Controls.renderHTML(model);
  assert.equal(model.replacement, null); assert.equal(model.extraEffects.length, 0);
  assert.match(html, /슬롯 속도 3 \+ 카드 0 = 회피 속도 <b>3<\/b>/);
  assert.match(html, /공격 강화는 회피에 미적용/);
  assert.doesNotMatch(html, /속도 4|공격용 소모품|원래 카드 효과 대체/);
  const dodged = go(committed, "DODGE", { cardId: dodgeId, slot: 0 });
  assert.equal(dodged.combat.dodged, true); assert.equal(H(dodged).slots[0], null);
});

test("compact selectors preserve current choices, offer explicit clearing, and cannot pick an occupied slot", () => {
  const state = encounter(create([])), cardId = H(state).hand.find(card => card.kind === "strength").id,
    committed = attack(state, cardId, 0), dodgeId = H(committed).hand.find(card => card.kind === "endurance").id,
    model = Controls.view(committed, E, { mode: "dodge", cardId: dodgeId, slot: 0 }),
    html = Controls.renderHTML(model), document = new Document(html),
    card = document.getElementById("combatSelectCard"), slot = document.getElementById("combatSelectSlot");
  assert.equal(card.value, dodgeId); assert.equal(slot.value, "");
  assert.match(html, /value="0"[^>]*disabled[^>]*>1번.*사용됨/);
  assert.equal(model.selectedSlot, null);
  assert.equal(card.getAttribute("data-combat-select"), "card");
  assert.equal(slot.getAttribute("data-combat-select"), "slot");
  assert.match(html, /value="" selected>선택 안 함/);
  assert.doesNotMatch(html, /data-command=/, "the selector renderer cannot duplicate or execute an attack command");
  const cleared = Controls.view(committed, E, { mode: "dodge", cardId: null, slot: null });
  assert.equal(cleared.selectedCard, null); assert.equal(cleared.selectedSlot, null);
  assert.equal(new Document(Controls.renderHTML(cleared)).getElementById("combatSelectCard").value, "");
});

test("selection details escape public text and offer added item/reward rules without mutating the supplied data", () => {
  const state = create([]), before = E.exportSave(state), items = [{ name: '<script>item</script>', rules: 'x & "y"' }],
    model = Controls.view(state, E, { cardId: H(state).hand[0].id, slot: 0, items,
      appliedEffects: [{ name: "현재 무기", text: "변형 후 강화" }] }), html = Controls.renderHTML(model);
  assert.match(html, /추가 적용 2개/); assert.match(html, /&lt;script&gt;item&lt;\/script&gt;/);
  assert.match(html, /x &amp; &quot;y&quot;/); assert.doesNotMatch(html, /<script>/);
  assert.equal(E.exportSave(state), before); assert.deepEqual(items, [{ name: '<script>item</script>', rules: 'x & "y"' }]);
});

test("attachment destinations name the actual attack and preview a move without double-counting the moving gem", () => {
  let state = create(), reward = E.rewardsView(state).rewards.find(item => item.kind === "bloodstone-chunk"),
    facts = Controls.slotFacts(state, E), before = E.exportSave(state),
    current = Controls.attachmentDestination(facts[0], reward), target = Controls.attachmentDestination(facts[2], reward),
    html = Controls.attachmentOptionHTML(facts[2], reward);
  assert.equal(current.current, true); assert.equal(current.beforeDamage, 14); assert.equal(current.damage, 14);
  assert.equal(current.otherDamage, 1); assert.equal(current.addedDamage, 1);
  assert.equal(current.speed, 4, "moving to the same slot cannot add a second chunk speed bonus");
  assert.equal(target.name, E.slots(state)[2].name); assert.equal(target.beforeDamage, 12); assert.equal(target.damage, 13);
  assert.equal(target.beforeSpeed, 3); assert.equal(target.speed, 4);
  assert(html.includes(E.slots(state)[2].name)); assert.match(html, /속도 3 → <b>4<\/b>/);
  assert.match(html, /기본 피해 12 \+ 다른 부착 강화 0 \+ 이 보상 1 = 부착 후 슬롯 피해 13/);
  assert.match(html, /슬롯 설명 · 검증 전용 공격/); assert.doesNotMatch(html, /<button/);
  assert.equal(E.exportSave(state), before, "inspecting a destination neither opens the timing window nor moves equipment");
  state = go(state, "TRANSFORM", { cardId: H(state).hand[0].id });
  facts = Controls.slotFacts(state, E); reward = E.rewardsView(state).rewards.find(item => item.kind === "bloodstone-chunk");
  target = Controls.attachmentDestination(facts[2], reward);
  state = go(state, "REASSIGN_REWARD", { rewardId: reward.id, slot: 2 });
  state = encounter(state);
  const cardId = H(state).hand.find(card => card.kind === "strength").id,
    committed = attack(state, cardId, 2);
  assert.equal(committed.combat.attack.damage, target.damage + 1, "the actual stat card adds one on top of the displayed permanent slot damage");
  assert.equal(committed.combat.attack.speed, target.speed);
  assert.deepEqual(E.importSave(E.exportSave(committed)), committed);
});

test("a destination retains another attached gem's effect and presents tear-gem healing without inventing damage", () => {
  const state = create(["bloodstone-chunk", "tear-gem"]), before = E.exportSave(state),
    reward = E.rewardsView(state).rewards.find(item => item.kind === "tear-gem"), facts = Controls.slotFacts(state, E),
    same = Controls.attachmentDestination(facts[0], reward), moved = Controls.attachmentDestination(facts[1], reward);
  assert.equal(same.damage, 13); assert.equal(same.speed, 4); assert.equal(same.heal, 1);
  assert.equal(same.otherDamage, 1); assert.equal(same.addedDamage, 0);
  assert.equal(moved.damage, 12); assert.equal(moved.speed, 3); assert.equal(moved.heal, 1);
  assert.match(Controls.attachmentOptionHTML(facts[1], reward), /공격 확정 시 치유 1/);
  assert.equal(E.exportSave(state), before);
});

test("replacement attachment previews exclude the stored gem and match the actual public equipment command", () => {
  let state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "custom",
      startRewards: ["bloodstone-shard", "tear-gem", "bloodstone-chunk"], startConsumables: [] } });
  const items = H(state).rewards, shard = items.find(r => r.kind === "bloodstone-shard"),
    tear = items.find(r => r.kind === "tear-gem"), chunk = items.find(r => r.kind === "bloodstone-chunk");
  state = go(state, "EQUIP_REWARD", { rewardId: shard.id, slot: 0 });
  state = go(state, "EQUIP_REWARD", { rewardId: tear.id, slot: 1 });
  const before = E.exportSave(state), incoming = E.rewardsView(state).rewards.find(r => r.id === chunk.id),
    facts = Controls.slotFacts(state, E);
  for (const old of [shard, tear]) for (const slot of [0, 1, 2]) {
    const preview = Controls.attachmentDestination(facts[slot], incoming, { replaceId: old.id }),
      equipped = go(state, "EQUIP_REWARD", { rewardId: chunk.id, replaceId: old.id, slot }),
      actual = Controls.slotFacts(equipped, E)[slot];
    assert.equal(preview.damage, actual.totalDamage);
    assert.equal(preview.speed, actual.totalSpeed);
    assert.equal(preview.heal, actual.upgradeHeal);
    assert.equal(H(equipped).rewards.filter(r => r.equipped).length, 2);
    assert.deepEqual(E.importSave(E.exportSave(equipped)), equipped);
  }
  const { ui } = launch(state), buttons = ui.buttons("decisions").filter(b => b.dataset.command === "EQUIP_REWARD"),
    replacingShard = buttons.find(b => { const a = JSON.parse(b.dataset.args); return a.replaceId === shard.id && a.slot === 0; });
  assert(replacingShard);
  const options = ui.el("decisions").innerHTML.match(/<button\b[^>]*data-command="EQUIP_REWARD"[^>]*>[\s\S]*?<\/button>/g);
  assert.match(options[buttons.indexOf(replacingShard)], /기본 피해 12 \+ 다른 부착 강화 0 \+ 이 보상 1 = 부착 후 슬롯 피해 13/);
  replacingShard.click();
  assert.equal(ui.el("error").textContent, "");
  assert.deepEqual(E.importSave(ui.storage.get(qaKey)), go(state, "EQUIP_REWARD", { rewardId: chunk.id, replaceId: shard.id, slot: 0 }));
  assert.equal(E.exportSave(state), before);
});

test("fixed selectors and original cards/slots share one reversible selection and commit exactly one actual attack", () => {
  const state = encounter(create()), saved = E.exportSave(state), { ui, calls, normalSave } = launch(state),
    target = state.enemies.find(enemy => enemy.missionId === "mob"),
    cardId = H(state).hand.find(card => card.kind === "strength").id;
  selected(ui, "chapterMap", "enemy", target.id).click();
  assert.equal(ui.el("combatSelection").hidden, false);
  select(ui, "combatSelectCard", cardId); select(ui, "combatSelectSlot", "0");
  assert.equal(selected(ui, "hand", "card", cardId).getAttribute("aria-pressed"), "true");
  assert.equal(selected(ui, "slots", "slot", 0).getAttribute("aria-pressed"), "true");
  assert.equal(ui.document.activeElement, ui.el("combatSelectSlot"));
  assert.match(ui.el("combatSelection").innerHTML, /기본 피해 12 \+ 강화 2 = <b>피해 14<\/b>/);
  assert.match(ui.el("combatSelection").innerHTML, /혈석의 파편/); assert.match(ui.el("combatSelection").innerHTML, /혈석의 덩어리/);
  select(ui, "combatSelectCard", "");
  assert.equal(selected(ui, "hand", "card", cardId).getAttribute("aria-pressed"), "false");
  assert(ui.buttons("decisionActions").find(button => button.dataset.command === "ATTACK").disabled);
  selected(ui, "hand", "card", cardId).click();
  assert.equal(ui.el("combatSelectCard").value, cardId);
  selected(ui, "slots", "slot", 0).click();
  assert.equal(ui.el("combatSelectSlot").value, "");
  select(ui, "combatSelectSlot", "0");
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(calls.length, 0);
  const actual = click(ui, "decisionActions", "ATTACK"), expected = attack(state, cardId);
  assert.deepEqual(actual, expected); assert.equal(actual.revision, state.revision + 1);
  assert.equal(actual.commands.length, state.commands.length + 1, "departure validation may replay a clone but commits the attack only once");
  assert(calls.every(command => command.type === "ATTACK"));
  assert.equal(ui.storage.get(normalKey), normalSave);
  assert.match(ui.el("combatSelection").innerHTML, /회피 준비/);
  assert.match(ui.el("combatSelection").innerHTML, /value="0"[^>]*disabled[^>]*>1번.*사용됨/);
  assert.equal(ui.el("combatSelectCard").value, ""); assert.equal(ui.el("combatSelectSlot").value, "");
  const dodgeId = H(actual).hand.find(card => card.kind === "endurance").id;
  select(ui, "combatSelectCard", dodgeId); select(ui, "combatSelectSlot", "1");
  assert.equal(ui.document.activeElement, ui.el("combatSelectSlot"));
  const dodged = click(ui, "decisionActions", "DODGE");
  assert.deepEqual(dodged, go(actual, "DODGE", { cardId: dodgeId, slot: 1 }));
  const resolved = click(ui, "decisionActions", "RESOLVE");
  assert.deepEqual(resolved, go(dodged, "RESOLVE")); assert.equal(ui.storage.get(normalKey), normalSave);
});

test("the real rune checkbox updates the fixed replacement explanation and the committed attack retains the chosen card", () => {
  const state = encounter(create(["rune-clawmark"]), "strength"), { ui, calls } = launch(state),
    target = state.enemies.find(enemy => enemy.missionId === "mob"),
    cardId = H(state).hand.find(card => card.kind === "endurance").id, rewardId = H(state).rewards[0].id;
  selected(ui, "chapterMap", "enemy", target.id).click();
  select(ui, "combatSelectCard", cardId); select(ui, "combatSelectSlot", "0");
  const checkbox = ui.document.querySelectorAll("[data-reward-attack]").find(element => element.dataset.rewardAttack === rewardId);
  assert(checkbox); checkbox.checked = true; checkbox.fire("change");
  assert.match(ui.el("combatSelection").innerHTML, /미적용<\/span> 회피 · 이 슬롯을 비웁니다/);
  assert.match(ui.el("combatSelection").innerHTML, /대신 적용 · 공격 피해 \+1 · 방해/);
  assert.equal(calls.length, 0);
  const actual = click(ui, "decisionActions", "ATTACK");
  assert.deepEqual(actual, attack(state, cardId, 0, [rewardId]));
  assert.equal(H(actual).slots[0].id, cardId); assert.equal(H(actual).rewards[0].ready, false);
});

test("the real transformation popup names each destination attack and its retained/added gem effects before reassignment", () => {
  const state = create(), { ui, normalSave } = launch(state), cardId = H(state).hand[0].id;
  selected(ui, "hand", "card", cardId).click();
  const transformed = click(ui, "decisions", "TRANSFORM"), chunk = E.rewardsView(transformed).rewards.find(reward => reward.kind === "bloodstone-chunk");
  assert.equal(ui.el("attachmentDialog").open, true);
  const html = ui.el("attachmentChoices").innerHTML;
  for (const slot of E.slots(transformed)) assert(html.includes(slot.name));
  assert.match(html, /기본 피해 6 \+ 다른 부착 강화 1 \+ 이 보상 1 = 부착 후 슬롯 피해 8/);
  assert.match(html, /기본 피해 6 \+ 다른 부착 강화 0 \+ 이 보상 1 = 부착 후 슬롯 피해 7/);
  assert.match(html, /슬롯 설명 · 검증 전용 공격/);
  const moved = click(ui, "attachmentChoices", "REASSIGN_REWARD", args => args.rewardId === chunk.id && args.slot === 2);
  assert.deepEqual(moved, go(transformed, "REASSIGN_REWARD", { rewardId: chunk.id, slot: 2 }));
  assert.equal(ui.el("attachmentDialog").open, true, "other gems can still be moved within the same optional window");
  assert.match(ui.el("slots").innerHTML, /기본 피해 6 \+ 강화 1 = <b>피해 7<\/b>/);
  assert.equal(ui.storage.get(normalKey), normalSave);
  ui.el("closeAttachments").click(); assert.equal(ui.el("attachmentDialog").open, false);
});

test("a successful menu import returns to the restored hunt while cancellation and invalid files preserve the open menu and saves", async () => {
  const state = create([]), { ui, calls, normalSave } = launch(state), saved = ui.storage.get(qaKey),
    menu = ui.document.querySelectorAll("[data-panel]").find(element => element.dataset.panel === "help");
  menu.click(); assert.equal(ui.el("infoDialog").open, true);
  let synchronous = false;
  ui.el("file").addEventListener("click", () => { synchronous = true; });
  ui.el("load").click(); assert.equal(synchronous, true);
  await ui.el("file").onchange({ target: { files: [], value: "" } });
  assert.equal(ui.el("infoDialog").open, true); assert.equal(ui.storage.get(qaKey), saved);
  await ui.el("file").onchange({ target: { files: [{ text: async () => "not a save" }], value: "bad.json" } });
  assert.equal(ui.el("infoDialog").open, true); assert(ui.el("infoError").textContent);
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(ui.storage.get(normalKey), normalSave); assert.equal(calls.length, 0);
  const restored = go(state, "END_TURN"), text = E.exportSave(restored);
  await ui.el("file").onchange({ target: { files: [{ text: async () => text }], value: "valid.json" } });
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("error").textContent, "");
  assert.deepEqual(E.importSave(ui.storage.get(qaKey)), restored); assert.equal(ui.storage.get(normalKey), normalSave);
  assert.equal(calls.length, 0, "importing a complete replay does not dispatch a new action");
});
