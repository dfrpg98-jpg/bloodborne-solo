"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot, Document } = require("./helpers/ui-harness.cjs");
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json"), key = "bloodborne-hunt-v07";
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: s => s,
  applyCombatReactionRuling: s => s };
const checkpoints = new Map();
let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
checkpoints.set(0, state);
for (let i = 0; i < 10; i++) { state = E.dispatch(state, commands[i]); checkpoints.set(i + 1, state); }
function launch(state) {
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine, realInventory: true, storage: { [key]: saved } });
  return { state, ui, saved };
}
const slots = f => f.ui.el("slots").querySelectorAll("[data-slot]");
const selected = f => slots(f).filter(slot => slot.getAttribute("aria-pressed") === "true").map(slot => +slot.dataset.slot);
function clickSlot(f, index) { const slot = slots(f).find(slot => +slot.dataset.slot === index); assert(slot); slot.click(); }
function clickCard(f, cardId) {
  const card = f.ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId);
  assert(card); card.click();
}
function enemyTarget(f, enemyId) {
  const target = f.ui.el("chapterMap").querySelectorAll("[data-enemy]").find(target => target.dataset.enemy === enemyId);
  assert(target); target.click();
}
function actions(f, type) {
  return ["decisions", "decisionActions", "mapContext", "firearm"].flatMap(id => f.ui.el(id).querySelectorAll("[data-command]"))
    .filter(button => button.dataset.command === type);
}
function begin(f, type) {
  const button = f.ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]").find(button => button.dataset.hunterIntent === type);
  assert(button && !button.disabled); button.click();
  assert(f.ui.el("confirmHunterAction").disabled); unchanged(f);
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(key), f.saved, "presentation selections preserve exact existing save bytes");
  assert.equal(f.ui.el("error").textContent, "");
}
function execute(f, type, reference) {
  const button = actions(f, type).find(button => !button.disabled); assert(button, `${type} is explicitly enabled`); button.click();
  const actual = E.importSave(f.ui.storage.get(key)), expected = E.dispatch(f.state, reference);
  const behavior = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
  assert.deepEqual(behavior(actual), behavior(expected), "controller preserves exact original rule result and costs");
  for (const [key, value] of Object.entries(reference)) if (key !== "boost")
    assert.deepEqual(actual.commands.at(-1)[key], value, `the original command preserves ${key}`);
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual);
  assert.equal(f.ui.el("error").textContent, "");
  return actual;
}

test("a restored hunter turn starts without a selected weapon slot and uses the requested player labels", () => {
  const f = launch(checkpoints.get(0));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("phaseTitle").textContent, "플레이어의 차례");
  assert.match(f.ui.el("decisions").innerHTML, />플레이어의 차례 마치기<\/button>/);
  clickCard(f, E.hunter(f.state).hand[0].id);
  assert.deepEqual(selected(f), [], "selecting a card does not select the first empty slot");
  unchanged(f);
});

test("slot clicks select, cancel the same slot, and replace another selection without saving", () => {
  const f = launch(checkpoints.get(4));
  clickSlot(f, 0); assert.deepEqual(selected(f), [0]);
  clickSlot(f, 0); assert.deepEqual(selected(f), []);
  clickSlot(f, 0); clickSlot(f, 1); assert.deepEqual(selected(f), [1]);
  clickCard(f, E.hunter(f.state).hand[0].id); assert.deepEqual(selected(f), [1]);
  enemyTarget(f, f.state.enemies[0].id); assert.deepEqual(selected(f), [1]);
  clickSlot(f, 1); assert.deepEqual(selected(f), []);
  unchanged(f);
});

test("reclicking a selected hand card deselects it after target and slot redraws and disables the pending attack", () => {
  const f = launch(checkpoints.get(9)), command = commands[9];
  enemyTarget(f, command.enemyId); begin(f, "ATTACK"); clickCard(f, command.cardId); clickSlot(f, command.slot);
  assert(actions(f, "ATTACK").some(button => !button.disabled));
  clickCard(f, command.cardId);
  assert(f.ui.el("hand").querySelectorAll("[data-card]").every(card => card.getAttribute("aria-pressed") === "false"));
  assert.deepEqual(selected(f), [command.slot], "card deselection preserves an explicitly chosen free slot");
  assert.equal(f.ui.el("mapContext").hidden, false, "the inspected target remains available");
  assert(f.ui.el("confirmHunterAction").disabled); unchanged(f);
  clickCard(f, command.cardId); assert(actions(f, "ATTACK").some(button => !button.disabled));
  execute(f, "ATTACK", command);
});

test("switching hand cards leaves only the latest card selected and clicking it again disables movement", () => {
  const f = launch(checkpoints.get(0)), cards = E.hunter(f.state).hand;
  begin(f, "MOVE");
  clickCard(f, cards[0].id); clickCard(f, cards[1].id);
  const highlighted = f.ui.el("hand").querySelectorAll("[data-card]").filter(card => card.getAttribute("aria-pressed") === "true");
  assert.deepEqual(highlighted.map(card => card.dataset.card), [cards[1].id]);
  assert.equal(JSON.parse(actions(f, "MOVE").find(button => !button.disabled).dataset.args).cardId, cards[1].id);
  clickCard(f, cards[1].id); assert(f.ui.el("confirmHunterAction").disabled);
  for (const button of actions(f, "MOVE")) button.click(); unchanged(f);
});

test("occupied slots are readable disabled controls and cannot replace a valid empty slot selection", () => {
  const f = launch(checkpoints.get(6)), h = E.hunter(f.state), occupiedIndex = h.slots.findIndex(Boolean),
    emptyIndex = E.slots(f.state).findIndex((_, index) => !h.slots[index]);
  assert(occupiedIndex >= 0 && emptyIndex >= 0);
  clickSlot(f, emptyIndex);
  const occupied = slots(f).find(slot => +slot.dataset.slot === occupiedIndex);
  assert.equal(occupied.disabled, true); assert.equal(occupied.getAttribute("aria-disabled"), "true");
  assert.equal(occupied.getAttribute("aria-pressed"), "false");
  assert.match(f.ui.el("slots").innerHTML, new RegExp(`data-slot="${occupiedIndex}"[^>]*>[\\s\\S]*?${occupiedIndex + 1}번 슬롯 · 사용됨`));
  occupied.click(); assert.deepEqual(selected(f), [emptyIndex]); unchanged(f);
});

test("an attack spends its card and disables the filled slot, including clicks on a stale preattack control", () => {
  const f = launch(checkpoints.get(9)), command = commands[9];
  enemyTarget(f, command.enemyId); begin(f, "ATTACK"); clickCard(f, command.cardId); clickSlot(f, command.slot);
  const previousSlot = slots(f).find(slot => +slot.dataset.slot === command.slot), actual = execute(f, "ATTACK", command),
    saved = f.ui.storage.get(key), occupied = slots(f).find(slot => +slot.dataset.slot === command.slot);
  assert(E.hunter(actual).slots[command.slot]); assert.equal(occupied.disabled, true);
  assert.equal(occupied.getAttribute("aria-pressed"), "false");
  assert(!f.ui.el("hand").querySelectorAll("[data-card]").some(card => card.dataset.card === command.cardId));
  assert(f.ui.el("hand").querySelectorAll("[data-card]").every(card => card.getAttribute("aria-pressed") === "false"));
  previousSlot.click(); assert.deepEqual(selected(f), []); assert.equal(f.ui.storage.get(key), saved);
  assert.equal(f.ui.el("error").textContent, "");
});

test("a card beyond the first hand row remains selectable and toggles off without spending a QA command", () => {
  const qaKey = "bloodborne-hunt-qa-v1";
  let s = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center",
    { campaign: true, qa: { preset: "custom", startRewards: [], startConsumables: ["qa-cards"] } });
  s = E.dispatch(s, { type: "USE_CONSUMABLE", itemId: E.hunter(s).consumables[0].id });
  const saved = E.exportSave(s), ui = boot(s, E.missionView(s), E.rewardsView(s), { engine, realInventory: true,
    storage: { [qaKey]: saved, "bloodborne-hunt-active-mode": "qa" } });
  const cards = E.hunter(s).hand; assert(cards.length > 3);
  const laterId = cards.at(-1).id;
  const find = () => ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === laterId);
  assert.equal(ui.el("hand").querySelectorAll("[data-card]").length, cards.length);
  find().click(); assert.equal(find().getAttribute("aria-pressed"), "true");
  assert(find().getAttribute("title").includes(ui.window.BBHuntPublicText.clean(E.card(cards.at(-1)).text)));
  find().click(); assert.equal(find().getAttribute("aria-pressed"), "false");
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(ui.el("error").textContent, "");
});

test("attack intent selects a visible first empty slot, keeps it on repeat click, and allows another slot before commitment", () => {
  const f = launch(checkpoints.get(9)), command = commands[9];
  enemyTarget(f, command.enemyId); begin(f, "ATTACK");
  const first = E.slots(f.state).findIndex((_, index) => !E.hunter(f.state).slots[index]);
  assert.deepEqual(selected(f), [first]); clickSlot(f, first); assert.deepEqual(selected(f), [first]); unchanged(f);
  clickCard(f, command.cardId); assert(actions(f, "ATTACK").some(button => !button.disabled));
  const other = E.slots(f.state).findIndex((_, index) => index !== first && !E.hunter(f.state).slots[index]);
  clickSlot(f, other); assert.deepEqual(selected(f), [other]); unchanged(f);
  clickSlot(f, command.slot);
  const actual = execute(f, "ATTACK", command);
  assert(E.hunter(actual).slots[command.slot]);
  assert.deepEqual(selected(f), [], "using the selected slot does not select a different empty slot");
});

test("counterattacks require an explicit slot and preserve the exact selected command", () => {
  const f = launch(checkpoints.get(5)), command = commands[5];
  clickCard(f, command.cardId);
  assert(actions(f, "COUNTER").length); assert(actions(f, "COUNTER").every(button => button.disabled)); unchanged(f);
  clickSlot(f, command.slot);
  execute(f, "COUNTER", command);
  assert.deepEqual(selected(f), []);
});

test("loaded occupied slots do not cause another empty slot to be selected, and dodging still needs an explicit legal slot", () => {
  const f = launch(checkpoints.get(6)), h = E.hunter(f.state);
  assert(h.slots.some(Boolean)); assert.deepEqual(selected(f), []);
  const card = h.hand.find(card => E.card(card).dodge), index = E.slots(f.state).findIndex((_, index) => E.canDodge(f.state, card.id, index));
  assert(card); assert(index >= 0); clickCard(f, card.id);
  assert(actions(f, "DODGE")[0].disabled); unchanged(f);
  clickSlot(f, index); assert.equal(actions(f, "DODGE")[0].disabled, false);
  clickSlot(f, index); assert.equal(actions(f, "DODGE")[0].disabled, true); unchanged(f);
  clickSlot(f, index); const actual = execute(f, "DODGE", { type: "DODGE", cardId: card.id, slot: index });
  assert.deepEqual(selected(f), E.hunter(actual).slots[index] ? [] : [index], "only the explicit still-empty slot may remain selected");
});

test("a two-slot transformation clears a now-invalid selected slot without choosing slot zero", () => {
  const state = E.create(90, "kirkhammer", 0, null, "hunter-pistol", "center", { campaign: true }), f = launch(state);
  clickSlot(f, 2); begin(f, "TRANSFORM"); clickCard(f, E.hunter(state).hand[0].id);
  const actual = execute(f, "TRANSFORM", { type: "TRANSFORM", cardId: E.hunter(state).hand[0].id });
  assert.equal(E.slots(actual).length, 2); assert.equal(slots(f).length, 2);
  assert.deepEqual(selected(f), []);
});

test("resuming the stored hunt and starting a new hunt both clear a previous explicit slot selection", () => {
  const f = launch(checkpoints.get(4));
  clickSlot(f, 0); f.ui.el("new").click(); f.ui.el("resumeNormalSetup").click();
  assert.deepEqual(selected(f), []); unchanged(f);
  clickSlot(f, 1); f.ui.el("new").click();
  f.ui.el("seed").value = "123";
  f.ui.el("weapon").value = "beast-claw"; f.ui.el("weapon").fire("change");
  f.ui.el("face").value = "0"; f.ui.el("face").fire("change");
  f.ui.el("start").value = "center"; f.ui.el("start").fire("change");
  assert.equal(f.ui.el("confirmSetup").disabled, false); f.ui.el("confirmSetup").click();
  const actual = E.importSave(f.ui.storage.get(key));
  assert.deepEqual(actual, E.create(123, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true }));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("phaseTitle").textContent, "플레이어의 차례");
  assert.equal(f.ui.el("setupError").textContent, "");
});

test("importing a different actual replay clears an existing slot selection and preserves the imported save exactly", async () => {
  const f = launch(checkpoints.get(4)), imported = E.exportSave(checkpoints.get(0));
  clickSlot(f, 1); clickCard(f, E.hunter(f.state).hand[0].id); unchanged(f);
  const file = f.ui.el("file"); file.files = [{ text: async () => imported }];
  await file.onchange({ target: file });
  assert.equal(f.ui.storage.get(key), imported);
  assert.deepEqual(E.importSave(f.ui.storage.get(key)), checkpoints.get(0));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("error").textContent, "");
});

test("the Reiterpallasch weapon choice preserves null and requires its exact explicitly selected aiming slot", () => {
  const fixture = require("./fixtures/weapon-campaign-completion/manifest.json").cases.find(item => item.weaponId === "reiterpallasch");
  const trace = require("./fixtures/weapon-campaign-completion/" + fixture.commandsFile);
  let state = E.create(fixture.seed, fixture.weaponId, fixture.startFace, fixture.startingConsumable,
    fixture.initialFirearmId, fixture.startSpace, { campaign: true, rulesVersion: fixture.rulesVersion });
  for (const command of trace.slice(0, 136)) state = E.dispatch(state, command);
  const reference = { type: "WEAPON_SHOT", cardId: trace[136].cardId, slot: 1, enemyId: trace[136].enemyId }, f = launch(state);
  assert.equal(E.hunter(state).face, 1); enemyTarget(f, reference.enemyId); clickCard(f, reference.cardId);
  assert(actions(f, "WEAPON_SHOT").length); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled)); unchanged(f);
  clickSlot(f, 0); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled));
  clickSlot(f, 1); assert(actions(f, "WEAPON_SHOT").some(button => !button.disabled));
  clickSlot(f, 1); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled)); unchanged(f);
  clickSlot(f, 1); const actual = execute(f, "WEAPON_SHOT", reference);
  assert.equal(E.hunter(actual).slots[1].faceDown, true);
  assert.deepEqual(selected(f), []);
});

function firearmState(id, spent) {
  let s = E.create(90, "beast-claw", 0, null, id, "center", { campaign: true, firearmOverride: true });
  if (!spent) return s;
  for (const command of commands.slice(0, 4)) s = E.dispatch(s, command);
  if (id === "flamesprayer") {
    s = E.dispatch(s, { type: "FIREARM", enemyId: s.enemies[0].id }); s = E.dispatch(s, { type: "RESOLVE" });
  } else {
    for (const type of ["END_TURN", "NO_ATTACK", "FIREARM", "RESOLVE"]) s = E.dispatch(s, { type });
    if (s.phase === "refill") s = E.dispatch(s, { type: "REFILL", discardIds: [] });
  }
  assert.equal(s.phase, "hunter"); assert.equal(E.hunter(s).firearmReady, false);
  assert.deepEqual(E.importSave(E.exportSave(s)), s); return s;
}
function printedFirearmText(f) {
  const section = f.ui.el("firearm").innerHTML.match(/<section class="firearm-rules"[^>]*>([\s\S]*?)<\/section>/);
  assert(section, "the ready/spent effect paragraph is separate from the hover rules");
  const body = new Document('<div id="printed-firearm"></div>').getElementById("printed-firearm");
  body.innerHTML = section[1]; return body.textContent;
}
for (const [id, cost] of [["hunter-pistol", 1], ["flamesprayer", 2]]) {
  test(`${id} hides preparation guidance while ready and preserves its printed effect`, () => {
    const f = launch(firearmState(id, false));
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0);
    assert.match(f.ui.el("firearm").textContent, /준비됨/);
    assert(f.ui.el("firearm").textContent.includes(E.firearm(f.state).name));
    assert.match(f.ui.el("firearm").innerHTML, /firearm-rules/);
    const printed = printedFirearmText(f), hover = f.ui.el("firearm").querySelectorAll("[data-firearm-info]")[0];
    assert.match(printed, id === "hunter-pistol" ? /기본 공격.*방해/ : /속도 2.*피해 2.*방해/);
    assert.doesNotMatch(printed, /차례.{0,30}(?:버리|버려).*준비/, "ready-only effects omit preparation guidance");
    assert(hover, "full firearm rules remain available on hover and keyboard focus");
    assert.equal(hover.getAttribute("tabindex"), "0"); assert.match(hover.getAttribute("title"), /준비/);
    assert(f.ui.document.getElementById(hover.getAttribute("aria-describedby")), "the full-rule tooltip has an accessible target");
    assert.deepEqual(selected(f), []); unchanged(f);
  });
  test(`${id} shows the exact ${cost}-card player-turn preparation cost only while spent and prepares through the original command`, () => {
    const f = launch(firearmState(id, true)), cards = E.hunter(f.state).hand.slice(0, cost).map(card => card.id);
    assert.equal(cards.length, cost);
    const guidance = f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]");
    assert.equal(guidance.length, 1);
    assert.match(f.ui.el("firearm").innerHTML, new RegExp(`플레이어의 차례에 손패 ${cost}장을 버려 준비`));
    assert.match(f.ui.el("firearm").textContent, /소진됨/);
    clickCard(f, cards[0]);
    if (cost === 2) {
      assert(actions(f, "RELOAD").filter(button => !button.disabled).length === 0);
      const second = f.ui.el("firearmReloadSecond"); assert(second); second.value = cards[1]; second.fire("change");
    }
    assert.deepEqual(selected(f), [], "preparing a firearm never needs or chooses a weapon slot"); unchanged(f);
    const actual = execute(f, "RELOAD", { type: "RELOAD", ...(id === "hunter-pistol" ? { cardId: cards[0] } : { cardIds: cards }) });
    assert.equal(E.hunter(actual).firearmReady, true);
    assert.equal(E.hunter(actual).hand.length, E.hunter(f.state).hand.length - cost);
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0);
    assert.deepEqual(selected(f), []);
  });
}

test("every provided ready firearm retains its exact public effect rules while withholding preparation instructions", () => {
  for (const id of Object.keys(E.data.firearms)) {
    const f = launch(firearmState(id, false)), gun = E.firearm(f.state), text = printedFirearmText(f);
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0, `${id}: no preparation paragraph`);
    assert.doesNotMatch(text, /차례.{0,30}(?:버리|버려).*준비/, `${id}: no preparation instruction in effect paragraph`);
    const preparations = new Set([gun.prepareText, gun.readyRule]);
    for (const rule of (gun.rules || []).filter(rule => !preparations.has(rule)))
      assert(text.includes(f.ui.window.BBHuntPublicText.clean(rule)), `${id}: its original public effect rule remains visible`);
    unchanged(f);
  }
});

function earnedLongHand(count = 2) {
  // Normal QA commands: actual kill/echo, Dream purchase, refill/return, then
  // paid transforms. No hand, deck, RNG, enemy or mission state is fabricated.
  let s = E.create(5, "burial", 0, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "custom", startRewards: [],
      startConsumables: [...Array(10).fill("qa-cards"), ...Array(5).fill("qa-heal"), ...Array(2).fill("qa-travel")] },
  });
  const preparation = [
    { type: "USE_CONSUMABLE", itemId: "item-qa-1-16" }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" },
    { type: "USE_CONSUMABLE", itemId: "item-qa-1-1" },
    { type: "ATTACK", cardId: "card-9", slot: 1, enemyId: "huntsman-mob-1" }, { type: "FIREARM" }, { type: "RESOLVE" },
    { type: "USE_CONSUMABLE", itemId: "item-qa-1-2" },
    { type: "ATTACK", cardId: "card-7", slot: 1, enemyId: "huntsman-mob-1" }, { type: "RESOLVE" },
    { type: "STUN_DISCARD", cardId: "card-4" }, { type: "USE_CONSUMABLE", itemId: "item-qa-1-3" },
    { type: "USE_CONSUMABLE", itemId: "item-qa-1-11" },
    { type: "ATTACK", cardId: "card-8", slot: 1, enemyId: "huntsman-mob-1" }, { type: "FIREARM" }, { type: "RESOLVE" },
    { type: "USE_CONSUMABLE", itemId: "item-qa-1-4" },
    { type: "ATTACK", cardId: "card-9", slot: 1, enemyId: "huntsman-mob-1" }, { type: "RESOLVE" },
    { type: "KEEP_FIREARM", firearmId: "ludwig-rifle" }, { type: "DREAM", cardId: "card-2" },
    { type: "PICK_UPGRADE", index: 2 }, { type: "REPLACE_UPGRADE", replaceId: "card-4" },
    { type: "REFILL", discardIds: [] }, { type: "RETURN", node: "tile-14:center", face: 0 },
    ...[5, 6, 7].map(index => ({ type: "USE_CONSUMABLE", itemId: `item-qa-1-${index}` })),
    ...["card-10", "card-1", "card-12", "card-7", "card-8", "card-9", "card-3", "card-2", "card-5", "card-6"]
      .slice(0, 12 - count).map(cardId => ({ type: "TRANSFORM", cardId })),
  ];
  for (const command of preparation) s = E.dispatch(s, command);
  assert.equal(s.phase, "hunter"); assert.equal(E.hunter(s).hand.length, count);
  assert(E.hunter(s).hand.some(card => card.kind === "cheap-shot"));
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  return s;
}

test("BB030 earned long-card toggles preserve its reading position and focused control without altering save bytes", () => {
  const f = launch(earnedLongHand(7)), id = E.hunter(f.state).hand.find(card => card.kind === "cheap-shot").id;
  const find = () => f.ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === id);
  const old = find(); old.scrollTop = 50; old.focus();
  f.ui.el("hand").scrollTop = 18; f.ui.el("slots").scrollTop = 40;
  old.click();
  assert.notEqual(find(), old, "the actual controller still replaces the button");
  assert.equal(find().getAttribute("aria-pressed"), "true");
  assert.equal(find().scrollTop, 50, "read effect text is not returned to the top");
  assert.equal(f.ui.document.activeElement, find(), "native activation can reach the newly rendered card");
  assert.equal(find().lastFocusOptions.preventScroll, true);
  assert.equal(f.ui.el("hand").scrollTop, 18); assert.equal(f.ui.el("slots").scrollTop, 40);
  f.ui.document.activeElement.click();
  assert.equal(find().getAttribute("aria-pressed"), "false");
  assert.equal(find().scrollTop, 50); assert.equal(f.ui.document.activeElement, find());
  unchanged(f);
});

test("BB030 a free-slot toggle preserves focused slot and the reading offsets of both loadout lists", () => {
  const f = launch(earnedLongHand(7)), cards = f.ui.el("hand").querySelectorAll("[data-card]");
  const longId = E.hunter(f.state).hand.find(card => card.kind === "cheap-shot").id;
  cards.find(card => card.dataset.card === longId).scrollTop = 50;
  const old = slots(f)[1]; old.scrollTop = 12; old.focus();
  f.ui.el("hand").scrollTop = 18; f.ui.el("slots").scrollTop = 40;
  old.click();
  const current = () => slots(f)[1];
  assert.equal(f.ui.document.activeElement, current()); assert.equal(current().scrollTop, 12);
  assert.equal(current().lastFocusOptions.preventScroll, true); assert.deepEqual(selected(f), [1]);
  assert.equal(f.ui.el("hand").scrollTop, 18); assert.equal(f.ui.el("slots").scrollTop, 40);
  assert.equal(f.ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === longId).scrollTop, 50);
  f.ui.document.activeElement.click(); assert.deepEqual(selected(f), []);
  assert.equal(f.ui.document.activeElement, current()); assert.equal(current().scrollTop, 12);
  unchanged(f);
});

test("BB030 a consumed hand card is not refocused or replaced with an unrelated card", () => {
  const f = launch(checkpoints.get(0)), id = E.hunter(f.state).hand[0].id;
  begin(f, "MOVE"); clickCard(f, id);
  f.ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === id).focus();
  execute(f, "MOVE", { type: "MOVE", cardId: id });
  assert(!f.ui.el("hand").querySelectorAll("[data-card]").some(card => card.dataset.card === id));
  assert.equal(f.ui.document.activeElement, f.ui.document.body);
});

test("BB030 an attack never restores focus to its newly occupied disabled slot", () => {
  const f = launch(checkpoints.get(9)), command = commands[9];
  enemyTarget(f, command.enemyId); begin(f, "ATTACK"); clickCard(f, command.cardId); clickSlot(f, command.slot);
  slots(f).find(slot => +slot.dataset.slot === command.slot).focus();
  execute(f, "ATTACK", command);
  const occupied = slots(f).find(slot => +slot.dataset.slot === command.slot);
  assert(occupied.disabled); assert.notEqual(f.ui.document.activeElement, occupied);
  assert.equal(f.ui.document.activeElement, f.ui.document.body);
});

test("BB030 changing to a two-slot weapon does not redirect focus from a removed third slot", () => {
  const s = E.create(90, "kirkhammer", 0, null, "hunter-pistol", "center", { campaign: true }), f = launch(s);
  const cardId = E.hunter(s).hand[0].id;
  begin(f, "TRANSFORM"); clickCard(f, cardId); clickSlot(f, 2); slots(f)[2].focus();
  execute(f, "TRANSFORM", { type: "TRANSFORM", cardId });
  assert.equal(slots(f).length, 2); assert.equal(f.ui.document.activeElement, f.ui.document.body);
});

test("BB030 hand redraws leave an unrelated focused control untouched", () => {
  const f = launch(checkpoints.get(0)), control = f.ui.el("new");
  control.focus(); clickCard(f, E.hunter(f.state).hand[0].id);
  assert.equal(f.ui.document.activeElement, control); unchanged(f);
});
