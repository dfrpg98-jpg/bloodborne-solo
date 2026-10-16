"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), R = require("../src/rewards-engine"), D = require("../src/hunt-data");
const Controls = require("../src/hunt-map-controls"), { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, go = (state, type, args = {}) => E.dispatch(state, { type, ...args });
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07";
function launch(state) {
  const normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true }));
  return { normalSave, ui: boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [qaKey]: E.exportSave(state), [normalKey]: normalSave, "bloodborne-hunt-active-mode": "qa" },
    window: { BBHuntMapControls: Controls }, engine: { ...E,
      applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } }) };
}
function current(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(qaKey)); }
function clickCard(ui, id) {
  const button = ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === id);
  assert(button, `hand contains ${id}`); button.click();
}
function clickCommand(ui, type, container = "decisionActions", predicate = () => true) {
  const button = ui.el(container).querySelectorAll("[data-command]").find(button =>
    button.dataset.command === type && !button.disabled && predicate(JSON.parse(button.dataset.args || "{}")));
  assert(button, `${container} has enabled ${type}`); button.click(); return current(ui);
}
function badgeOnSlot(ui, slot) {
  return ui.el("slots").innerHTML.match(new RegExp(`<button[^>]*data-slot="${slot}"[^>]*>([\\s\\S]*?)</button>`))?.[1] || "";
}
function create(weaponId = "qa-test-weapon", rewards = ["bloodstone-shard"]) {
  return E.create(90, weaponId, 0, null, D.weapons[weaponId]?.defaultFirearm || "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: rewards, startConsumables: [] } });
}
const shard = (state, index = 0) => H(state).rewards.filter(reward => reward.kind === "bloodstone-shard")[index];
function equip(state, slot = 0, index = 0) { return go(state, "EQUIP_REWARD", { rewardId: shard(state, index).id, slot }); }
function encounter(state) {
  for (const [type, args] of [["MOVE", { cardId: H(state).hand.find(card => card.kind === "endurance").id }],
    ["EXPLORE", { edge: "N" }], ["PLACE_TILE", { rotation: 0 }], ["STOP_MOVE", {}]]) state = go(state, type, args);
  assert.equal(H(state).position, "tile-04:center");
  return state;
}
function attack(state, slot = 0, extra = {}) {
  return go(state, "ATTACK", { enemyId: state.enemies.find(enemy => enemy.missionId === "mob").id,
    cardId: H(state).hand.find(card => card.kind === "strength").id, slot, ...extra });
}
function exactReplay(state) { assert.deepEqual(E.importSave(E.exportSave(state)), state); }

test("the shard's supplied, photo-verified text explicitly permits moving it on transformation and adds one damage", () => {
  const supplied = D.components.cards.find(card => card.id === "bloodstone-shard"), implemented = R.definitions["bloodstone-shard"];
  assert.equal(supplied.photoVerified, true); assert.equal(implemented.rules, supplied.rules);
  assert.match(supplied.rules, /무기를 변형할 때 다른 슬롯으로 옮길 수 있습니다/);
  assert.match(supplied.rules, /놓인 슬롯으로 하는 공격.*\+1피해/);
  assert.equal(implemented.persistent, true);
});

test("actual attacks add shard damage exactly once on its attached slot and preserve its persistent readiness", () => {
  const on = attack(encounter(equip(create(), 0))), off = attack(encounter(equip(create(), 1)));
  assert.equal(E.slots(on)[0].damage, 12, "the printed slot remains unchanged; damage is added at declaration");
  assert.equal(on.combat.attack.damage, 14); assert.equal(off.combat.attack.damage, 13);
  assert.equal(on.combat.attack.speed, off.combat.attack.speed);
  assert.equal(shard(on).ready, true); assert.equal(shard(on).slot, 0);
  const resolved = go(on, "RESOLVE");
  assert(resolved.events.some(event => /검증 공격 1 · 적에게 14 피해/.test(event.text)));
  assert.equal(shard(resolved).ready, true); assert.equal(shard(resolved).equipped, true);
  exactReplay(on); exactReplay(resolved);
});

test("initial slot selection is mandatory and invalid declarations are atomic", () => {
  const state = create(), saved = E.exportSave(state);
  assert.equal(state.rewardChoices[0].reason, "slot");
  for (const slot of [undefined, -1, 3]) assert.throws(() => go(state, "EQUIP_REWARD", {
    rewardId: shard(state).id, ...(slot !== undefined ? { slot } : {}) }), /공격 슬롯/);
  assert.equal(E.exportSave(state), saved);
  assert.throws(() => go(state, "MOVE", { cardId: H(state).hand[0].id }), /선택을 먼저/);
  const equipped = equip(state, 2), view = E.rewardsView(equipped).rewards.find(reward => reward.id === shard(equipped).id);
  assert.equal(view.slot, 2); assert.equal(view.persistent, true); assert.equal(view.reassignable, false);
  exactReplay(equipped);
});

test("every paid transformation opens a new optional slot reassignment and the next gameplay action closes it", () => {
  let state = equip(create(), 0), rewardId = shard(state).id;
  assert.throws(() => go(state, "REASSIGN_REWARD", { rewardId, slot: 1 }), /변형한 직후/);
  for (const slot of [1, 2]) {
    state = go(state, "TRANSFORM", { cardId: H(state).hand[0].id });
    assert.equal(E.rewardsView(state).transformWindow, true);
    assert.equal(E.rewardsView(state).rewards.find(reward => reward.id === rewardId).reassignable, true);
    const before = H(state).hand.length;
    state = go(state, "REASSIGN_REWARD", { rewardId, slot });
    assert.equal(shard(state).slot, slot); assert.equal(H(state).hand.length, before, "reassignment costs no extra hand card");
    assert.equal(E.rewardsView(state).transformWindow, true);
    exactReplay(state);
  }
  state = go(state, "MOVE", { cardId: H(state).hand[0].id });
  assert.equal(E.rewardsView(state).transformWindow, false);
  const saved = E.exportSave(state);
  assert.throws(() => go(state, "REASSIGN_REWARD", { rewardId, slot: 0 }), /변형한 직후/);
  assert.equal(E.exportSave(state), saved); exactReplay(state);
});

test("a real free transformation after combat also opens the shard's reassignment window", () => {
  let state = encounter(equip(create("qa-test-weapon", ["bloodstone-shard", "rune-hunter"]), 0));
  const rune = H(state).rewards.find(reward => reward.kind === "rune-hunter"), rewardId = shard(state).id;
  state = attack(state, 0, { rewardIds: [rune.id] }); state = go(state, "RESOLVE");
  assert.equal(state.phase, "free_transform"); const hand = H(state).hand.length;
  state = go(state, "FREE_TRANSFORM", { accept: true });
  assert.equal(H(state).face, 1); assert.equal(H(state).hand.length, hand);
  assert.equal(E.rewardsView(state).rewards.find(reward => reward.id === rewardId).reassignable, true);
  state = go(state, "REASSIGN_REWARD", { rewardId, slot: 2 });
  assert.equal(shard(state).slot, 2); assert.equal(shard(state).ready, true); exactReplay(state);
});

test("after transformation the actual next attack receives the bonus on the new slot and not the old slot", () => {
  let state = encounter(equip(create(), 0));
  state = go(state, "TRANSFORM", { cardId: H(state).hand.find(card => card.kind === "endurance").id });
  state = go(state, "REASSIGN_REWARD", { rewardId: shard(state).id, slot: 2 });
  const newSlot = attack(state, 2), oldSlot = attack(state, 0);
  assert.equal(H(newSlot).face, 1); assert.equal(E.slots(newSlot)[2].damage, 6);
  assert.equal(newSlot.combat.attack.damage, 8, "new base six, strength one, attached shard one");
  assert.equal(oldSlot.combat.attack.damage, 7, "the original slot no longer receives the shard bonus");
  assert.equal(shard(newSlot).slot, 2); assert.equal(shard(newSlot).ready, true);
  exactReplay(newSlot); exactReplay(oldSlot);
});

test("transforming a three-slot stake driver into one slot requires an explicit legal shard destination", () => {
  let state = equip(create("stake-driver"), 2), rewardId = shard(state).id;
  assert.equal(E.slots(state).length, 3);
  state = go(state, "TRANSFORM", { cardId: H(state).hand[0].id });
  assert.equal(E.slots(state).length, 1); assert.equal(shard(state).equipped, false); assert.equal(shard(state).slot, null);
  assert.deepEqual(state.rewardChoices, [{ rewardId, reason: "slot" }]);
  assert.throws(() => go(state, "MOVE", { cardId: H(state).hand[0].id }), /선택을 먼저/);
  assert.throws(() => go(state, "EQUIP_REWARD", { rewardId, slot: 1 }), /공격 슬롯/);
  state = go(state, "EQUIP_REWARD", { rewardId, slot: 0 });
  assert.equal(shard(state).equipped, true); assert.equal(shard(state).slot, 0); assert.equal(state.rewardChoices.length, 0);
  exactReplay(state);
});

test("two equipped shards stack once each on the same slot and remain distinct through replay", () => {
  let state = create("qa-test-weapon", ["bloodstone-shard", "bloodstone-shard"]);
  state = equip(state, 0, 0); state = equip(state, 0, 1); state = attack(encounter(state));
  assert.equal(state.combat.attack.damage, 15);
  assert(H(state).rewards.every(reward => reward.ready && reward.equipped && reward.slot === 0));
  exactReplay(state);
});

test("the dream retains the shard's actual slot and readiness while closing the transform window", () => {
  let state = equip(create(), 0), rewardId = shard(state).id;
  state = go(state, "TRANSFORM", { cardId: H(state).hand[0].id });
  state = go(state, "REASSIGN_REWARD", { rewardId, slot: 1 });
  state = go(state, "DREAM", { cardId: H(state).hand[0].id });
  assert.equal(H(state).inDream, true); assert.equal(shard(state).slot, 1); assert.equal(shard(state).ready, true);
  assert.equal(E.rewardsView(state).transformWindow, false); exactReplay(state);
});

test("initial UI equipment selection shows the shard on exactly its equipped main-screen slot", () => {
  const state = create(), { ui, normalSave } = launch(state);
  assert.doesNotMatch(ui.el("slots").innerHTML, /slot-attachment/);
  const after = clickCommand(ui, "EQUIP_REWARD", "decisions", args => args.slot === 1);
  assert.deepEqual(after, equip(state, 1));
  assert.match(badgeOnSlot(ui, 1), /slot-attachment.*혈석의 파편/);
  assert.match(badgeOnSlot(ui, 1), /공격 피해 \+1/);
  assert.doesNotMatch(badgeOnSlot(ui, 0) + badgeOnSlot(ui, 2), /slot-attachment/);
  assert.equal(ui.el("openAttachments").hidden, true); assert.equal(ui.el("attachmentDialog").open, false);
  assert.equal(ui.storage.get(normalKey), normalSave); exactReplay(after);
});

test("actual paid-transform UI opens reassignment, preserves costs and applies the moved shard on the next attack", () => {
  const state = encounter(equip(create(), 0)), { ui, normalSave } = launch(state), rewardId = shard(state).id;
  const cardId = H(state).hand.find(card => card.kind === "endurance").id;
  clickCard(ui, cardId); const transformed = clickCommand(ui, "TRANSFORM", "decisions");
  assert.deepEqual(transformed, go(state, "TRANSFORM", { cardId }));
  assert.equal(ui.el("attachmentDialog").open, true); assert.equal(ui.el("openAttachments").hidden, false);
  const transformSave = ui.storage.get(qaKey), hand = H(transformed).hand.length;
  clickCommand(ui, "END_TURN");
  assert.equal(ui.storage.get(qaKey), transformSave, "background gameplay cannot bypass the open reassignment dialog");
  const moved = clickCommand(ui, "REASSIGN_REWARD", "attachmentChoices", args => args.slot === 2);
  assert.deepEqual(moved, go(transformed, "REASSIGN_REWARD", { rewardId, slot: 2 }));
  assert.equal(H(moved).hand.length, hand); assert.equal(ui.el("attachmentDialog").open, true);
  assert.match(badgeOnSlot(ui, 2), /slot-attachment.*혈석의 파편/);
  assert.doesNotMatch(badgeOnSlot(ui, 0), /slot-attachment/);
  const movedSave = ui.storage.get(qaKey); ui.el("closeAttachments").click();
  assert.equal(ui.el("attachmentDialog").open, false); assert.equal(ui.storage.get(qaKey), movedSave);
  ui.el("openAttachments").click(); assert.equal(ui.el("attachmentDialog").open, true);
  ui.el("closeAttachments").click(); assert.equal(ui.storage.get(qaKey), movedSave, "closing or reopening costs no command");
  const enemyId = moved.enemies.find(enemy => enemy.missionId === "mob").id;
  ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === enemyId).click();
  clickCard(ui, H(moved).hand.find(card => card.kind === "strength").id);
  ui.el("slots").querySelectorAll("[data-slot]").find(button => button.dataset.slot === "2").click();
  const attacked = clickCommand(ui, "ATTACK");
  assert.deepEqual(attacked, E.dispatch(moved, attacked.commands.at(-1)));
  assert.equal(attacked.combat.attack.damage, 8); assert.equal(H(attacked).hand.length, hand - 1);
  assert.equal(ui.el("openAttachments").hidden, true); assert.equal(shard(attacked).slot, 2);
  assert.equal(ui.storage.get(normalKey), normalSave); exactReplay(attacked);
});

test("each repeated UI transformation offers reassignment again and retaining the current slot is free", () => {
  let reference = equip(create(), 0); const { ui, normalSave } = launch(reference), rewardId = shard(reference).id;
  for (const slot of [1, 2]) {
    const cardId = H(reference).hand[0].id; clickCard(ui, cardId);
    reference = go(reference, "TRANSFORM", { cardId }); assert.deepEqual(clickCommand(ui, "TRANSFORM", "decisions"), reference);
    assert.equal(ui.el("attachmentDialog").open, true);
    reference = go(reference, "REASSIGN_REWARD", { rewardId, slot });
    assert.deepEqual(clickCommand(ui, "REASSIGN_REWARD", "attachmentChoices", args => args.slot === slot), reference);
    ui.el("closeAttachments").click(); assert.equal(ui.el("attachmentDialog").open, false);
    assert.equal(shard(current(ui)).slot, slot); assert.match(badgeOnSlot(ui, slot), /혈석의 파편/);
  }
  assert.equal(H(reference).face, 0); assert.equal(H(reference).hand.length, 1);
  const before = ui.storage.get(qaKey); ui.el("openAttachments").click(); ui.el("closeAttachments").click();
  assert.equal(ui.storage.get(qaKey), before);
  const cardId = H(reference).hand[0].id; clickCard(ui, cardId); const moving = clickCommand(ui, "MOVE", "movementControls");
  assert.deepEqual(moving, go(reference, "MOVE", { cardId })); assert.equal(ui.el("openAttachments").hidden, true);
  assert.equal(ui.storage.get(normalKey), normalSave); exactReplay(moving);
});

test("accepting a real free-transform UI choice opens reassignment while declining keeps the slot without a popup", () => {
  let state = encounter(equip(create("qa-test-weapon", ["bloodstone-shard", "rune-hunter"]), 0));
  const rune = H(state).rewards.find(reward => reward.kind === "rune-hunter");
  state = go(attack(state, 0, { rewardIds: [rune.id] }), "RESOLVE"); assert.equal(state.phase, "free_transform");
  for (const accept of [true, false]) {
    const { ui, normalSave } = launch(state), after = clickCommand(ui, "FREE_TRANSFORM", "decisions", args => args.accept === accept);
    assert.deepEqual(after, go(state, "FREE_TRANSFORM", { accept }));
    assert.equal(ui.el("attachmentDialog").open, accept);
    if (accept) {
      const moved = clickCommand(ui, "REASSIGN_REWARD", "attachmentChoices", args => args.slot === 1);
      assert.equal(shard(moved).slot, 1); assert.match(badgeOnSlot(ui, 1), /혈석의 파편/);
      ui.el("closeAttachments").click(); exactReplay(moved);
    } else assert.equal(shard(after).slot, 0);
    assert.equal(ui.storage.get(normalKey), normalSave);
  }
});

test("a shrinking weapon resolves a displaced attachment before offering optional reassignment of the attachment that still fits", () => {
  let state = create("kirkhammer", ["bloodstone-shard", "bloodstone-chunk"]);
  state = equip(state, 0);
  const chunkId = H(state).rewards.find(reward => reward.kind === "bloodstone-chunk").id,
    shardId = shard(state).id;
  state = go(state, "EQUIP_REWARD", { rewardId: chunkId, slot: 2 });
  assert.equal(E.slots(state).length, 3);
  const { ui, normalSave } = launch(state), cardId = H(state).hand[0].id;
  clickCard(ui, cardId);
  const transformed = clickCommand(ui, "TRANSFORM", "decisions");
  assert.deepEqual(transformed, go(state, "TRANSFORM", { cardId }));
  assert.equal(E.slots(transformed).length, 2);
  assert.deepEqual(transformed.rewardChoices, [{ rewardId: chunkId, reason: "slot" }]);
  assert.equal(shard(transformed).slot, 0);
  assert.equal(E.rewardsView(transformed).rewards.find(reward => reward.id === shardId).reassignable, true);
  assert.equal(ui.el("attachmentDialog").open, false,
    "the valid shard's optional window cannot cover the chunk's mandatory destination choice");
  assert.equal(ui.el("openAttachments").hidden, true);
  assert.equal(ui.el("attachmentChoices").innerHTML, "");
  const hand = H(transformed).hand.length;
  const equipped = clickCommand(ui, "EQUIP_REWARD", "decisions", args => args.rewardId === chunkId && args.slot === 1);
  assert.deepEqual(equipped, go(transformed, "EQUIP_REWARD", { rewardId: chunkId, slot: 1 }));
  assert.equal(equipped.rewardChoices.length, 0);
  assert.equal(H(equipped).hand.length, hand);
  assert.equal(ui.el("openAttachments").hidden, false);
  ui.el("openAttachments").click(); assert.equal(ui.el("attachmentDialog").open, true);
  const reassigned = clickCommand(ui, "REASSIGN_REWARD", "attachmentChoices", args => args.rewardId === shardId && args.slot === 1);
  assert.deepEqual(reassigned, go(equipped, "REASSIGN_REWARD", { rewardId: shardId, slot: 1 }));
  assert.equal(shard(reassigned).slot, 1);
  assert.equal(H(reassigned).rewards.find(reward => reward.id === chunkId).slot, 1);
  assert.match(badgeOnSlot(ui, 1), /혈석의 파편/); assert.match(badgeOnSlot(ui, 1), /혈석의 덩어리/);
  assert.match(badgeOnSlot(ui, 1), /속도 \+1 · 공격 피해 \+1/);
  assert.doesNotMatch(badgeOnSlot(ui, 0), /slot-attachment/);
  assert.equal(H(reassigned).hand.length, hand);
  const save = ui.storage.get(qaKey); ui.el("closeAttachments").click();
  assert.equal(ui.el("attachmentDialog").open, false); assert.equal(ui.storage.get(qaKey), save);
  assert.equal(ui.storage.get(normalKey), normalSave); exactReplay(reassigned);
});
