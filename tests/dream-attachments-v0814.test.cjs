"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../hunt-engine"), R = require("../rewards-engine"), D = require("../hunt-data");
const { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, go = (state, type, args = {}) => E.dispatch(state, { type, ...args }),
  reward = (state, kind) => H(state).rewards.find(item => item.kind === kind),
  hash = state => crypto.createHash("sha256").update(E.exportSave(state)).digest("hex");
function create(weaponId = "kirkhammer", slots = { "bloodstone-shard": 0, "bloodstone-chunk": 0 }, face = 0) {
  let state = E.create(90, weaponId, face, null, D.weapons[weaponId].defaultFirearm, "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "custom", startRewards: Object.keys(slots), startConsumables: [] } });
  while (state.rewardChoices.length) {
    const next = H(state).rewards.find(item => item.id === state.rewardChoices[0].rewardId);
    state = go(state, "EQUIP_REWARD", { rewardId: next.id, slot: slots[next.kind] });
  }
  return state;
}
function waitingReturn(state = create()) {
  state = go(state, "DREAM", { cardId: H(state).hand[0].id }); assert.equal(state.phase, "refill");
  state = go(state, "REFILL", { discardIds: [] }); assert.equal(state.phase, "return");
  return state;
}
function returned(state, face = 1, flag = true) {
  return go(state, "RETURN", { node: "tile-14:center", face, ...(flag === undefined ? {} : { reassignAttachments: flag }) });
}
function replay(state) { assert.deepEqual(E.importSave(E.exportSave(state)), state); }
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07";
function launch(state) {
  const normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true })),
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
      storage: { [qaKey]: E.exportSave(state), [normalKey]: normalSave, "bloodborne-hunt-active-mode": "qa" },
      engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state,
        applyCombatReactionRuling: state => state } });
  return { ui, normalSave };
}
function chooseReturn(ui, face) {
  const select = ui.el("returnFace"); assert(select); select.value = String(face); select.fire("change");
  const button = ui.el("decisions").querySelectorAll("[data-return]").find(button => button.dataset.return === "tile-14:center");
  assert(button && !button.disabled); button.click(); assert.equal(ui.el("error").textContent, "");
  return E.importSave(ui.storage.get(qaKey));
}
function click(ui, area, type, predicate = () => true) {
  const button = ui.buttons(area).find(button => button.dataset.command === type && predicate(JSON.parse(button.dataset.args || "{}")));
  assert(button && !button.disabled, `${area} has enabled ${type}`); button.click(); assert.equal(ui.el("error").textContent, "");
  return E.importSave(ui.storage.get(qaKey));
}

test("the supplied slot attachments permit moving on weapon transformation, rather than on any ordinary action", () => {
  for (const kind of ["bloodstone-shard", "bloodstone-chunk", "tear-gem"]) {
    assert.equal(R.definitions[kind].photoVerified, true);
    assert.match(R.definitions[kind].rules, /무기를 변형할 때 다른 슬롯으로 옮길 수 있습니다/);
    assert.equal(R.definitions[kind].persistent, true);
  }
});

test("legacy rules-14 saves before and after a face-changing RETURN retain their exact pre-fix bytes", () => {
  const before = waitingReturn(), after = go(before, "RETURN", { node: "tile-14:center", face: 1 });
  // Captured against the old RETURN implementation before this change. These
  // are public-command QA traces, not personal save fixtures or edited states.
  assert.equal(hash(before), "ec916e73f5c1c8630fbf3c4a5b8e73f6743de91ea3a5b7b3422b560a2f5348ee");
  assert.equal(hash(after), "3d62d9602a0139ba52dab889317dc0b04f8b65716495239bc09eba7ee2f0dbe6");
  assert.equal(H(after).rewardTransformWindow, false);
  assert.equal(after.commands.at(-1).reassignAttachments, undefined);
  replay(before); replay(after);
});

test("an explicitly recorded opposite-face return opens free optional reassignment without changing RNG, hand, track or attachment defaults", () => {
  const before = waitingReturn(), after = returned(before), prior = E.exportSave(before);
  assert.equal(H(after).face, 1); assert.equal(after.phase, "hunter"); assert.equal(H(after).inDream, false);
  assert.equal(H(after).rewardTransformWindow, true);
  assert.deepEqual(H(after).hand, H(before).hand); assert.equal(after.rng, before.rng);
  assert.equal(after.round, before.round); assert.equal(after.track, before.track);
  assert.equal(after.revision, before.revision + 1); assert.equal(after.commands.length, before.commands.length + 1);
  assert(E.rewardsView(after).rewards.every(item => item.reassignable && item.slot === 0 && item.ready));
  assert.equal(after.commands.at(-1).reassignAttachments, true);
  const moved = go(after, "REASSIGN_REWARD", { rewardId: reward(after, "bloodstone-shard").id, slot: 1 });
  assert.equal(reward(moved, "bloodstone-shard").slot, 1); assert.equal(reward(moved, "bloodstone-chunk").slot, 0);
  assert.deepEqual(H(moved).hand, H(after).hand); assert.equal(moved.rng, after.rng);
  assert.equal(E.exportSave(before), prior); replay(after); replay(moved);
});

test("returning on the unchanged face offers no new timing window and invalid flags fail atomically", () => {
  const before = waitingReturn(), saved = E.exportSave(before), same = go(before, "RETURN", { node: "tile-14:center", face: 0 });
  assert.equal(H(same).rewardTransformWindow, false);
  assert(E.rewardsView(same).rewards.every(item => !item.reassignable));
  for (const flag of [true, null, "true", 1]) assert.throws(() => returned(before, 0, flag), /재배치 여부|반대 면/);
  assert.equal(E.exportSave(before), saved);
  const optedOut = returned(before, 1, false); assert.equal(H(optedOut).rewardTransformWindow, false);
  replay(same); replay(optedOut);
});

test("a face with fewer slots resolves a displaced gem before the remaining valid gem's optional move", () => {
  const before = waitingReturn(create("kirkhammer", { "bloodstone-shard": 0, "bloodstone-chunk": 2 })),
    after = returned(before), shard = reward(after, "bloodstone-shard"), chunk = reward(after, "bloodstone-chunk");
  assert.equal(E.slots(after).length, 2); assert.equal(H(after).rewardTransformWindow, true);
  assert.equal(shard.slot, 0); assert.equal(shard.equipped, true);
  assert.equal(chunk.slot, null); assert.equal(chunk.equipped, false);
  assert.deepEqual(after.rewardChoices, [{ rewardId: chunk.id, reason: "slot" }]);
  assert.throws(() => go(after, "REASSIGN_REWARD", { rewardId: shard.id, slot: 1 }), /선택/);
  const equipped = go(after, "EQUIP_REWARD", { rewardId: chunk.id, slot: 1 });
  assert.equal(equipped.rewardChoices.length, 0); assert.equal(H(equipped).rewardTransformWindow, true);
  const moved = go(equipped, "REASSIGN_REWARD", { rewardId: shard.id, slot: 1 });
  assert.equal(reward(moved, "bloodstone-shard").slot, 1); assert.equal(reward(moved, "bloodstone-chunk").slot, 1);
  assert.deepEqual(H(moved).hand, H(before).hand); assert.equal(moved.rng, before.rng);
  replay(after); replay(equipped); replay(moved);
});

test("the return window ends at the next normal action and ordinary paid transforms keep their existing window", () => {
  const after = returned(waitingReturn()), moved = go(after, "MOVE", { cardId: H(after).hand[0].id });
  assert.equal(H(moved).rewardTransformWindow, false);
  assert.throws(() => go(moved, "REASSIGN_REWARD", { rewardId: reward(moved, "bloodstone-shard").id, slot: 1 }), /변형한 직후/);
  const initial = create(), transformed = go(initial, "TRANSFORM", { cardId: H(initial).hand[0].id });
  assert.equal(H(transformed).rewardTransformWindow, true);
  const reassigned = go(transformed, "REASSIGN_REWARD", { rewardId: reward(transformed, "bloodstone-shard").id, slot: 1 });
  assert.equal(reward(reassigned, "bloodstone-shard").slot, 1); replay(reassigned); replay(moved);
});

test("choosing the other face on return does not activate Tonitrus's separate weapon-transform charge", () => {
  const before = waitingReturn(create("tonitrus", { "bloodstone-shard": 0 })), after = returned(before);
  assert.equal(H(after).rewardTransformWindow, true); assert.equal(H(after).weaponCharge, undefined);
  const initial = create("tonitrus", { "bloodstone-shard": 0 }),
    transformed = go(initial, "TRANSFORM", { cardId: H(initial).hand[0].id });
  assert.deepEqual(H(transformed).weaponCharge, { round: initial.round, speed: 1, damage: 1 });
  assert.equal(after.rng, before.rng); replay(after);
});

test("the next real attack after dream reassignment gains the shard on the new slot exactly once", () => {
  const before = waitingReturn(create("kirkhammer", { "bloodstone-shard": 0 }));
  let state = returned(before);
  state = go(state, "REASSIGN_REWARD", { rewardId: reward(state, "bloodstone-shard").id, slot: 1 });
  for (const [type, args] of [["MOVE", { cardId: H(state).hand.find(card => card.kind === "skill").id }],
    ["EXPLORE", { edge: "N" }], ["PLACE_TILE", { rotation: 0 }], ["STOP_MOVE", {}]]) state = go(state, type, args);
  const cardId = H(state).hand.find(card => card.kind === "strength").id, printed = E.slots(state)[1].damage,
    after = go(state, "ATTACK", { enemyId: state.enemies.find(enemy => enemy.missionId === "mob").id, cardId, slot: 1 });
  assert.equal(after.combat.attack.damage, printed + 1 + 1, "printed slot + strength card + one moved shard");
  assert.equal(reward(after, "bloodstone-shard").slot, 1);
  assert.equal(reward(after, "bloodstone-shard").ready, true);
  assert.equal(H(after).rewardTransformWindow, false); replay(after);
});

test("choosing the opposite return face in the actual UI records the new timing and opens a named destination popup", () => {
  const before = waitingReturn(), { ui, normalSave } = launch(before), actual = chooseReturn(ui, 1);
  assert.deepEqual(actual, returned(before));
  assert.equal(actual.commands.at(-1).reassignAttachments, true);
  assert.equal(ui.el("attachmentDialog").open, true);
  for (const slot of E.slots(actual)) assert(ui.el("attachmentChoices").innerHTML.includes(slot.name));
  assert.match(ui.el("attachmentChoices").innerHTML, /기본 피해 3 \+ 다른 부착 강화 1 \+ 이 보상 1 = 부착 후 슬롯 피해 5/);
  const shard = reward(actual, "bloodstone-shard"), moved = click(ui, "attachmentChoices", "REASSIGN_REWARD",
    args => args.rewardId === shard.id && args.slot === 1);
  assert.deepEqual(moved, go(actual, "REASSIGN_REWARD", { rewardId: shard.id, slot: 1 }));
  assert.match(ui.el("slots").innerHTML, /기본 피해 4 \+ 강화 1 = <b>피해 5<\/b>/);
  assert.deepEqual(H(moved).hand, H(before).hand); assert.equal(moved.rng, before.rng);
  assert.equal(ui.storage.get(normalKey), normalSave); replay(moved);
});

test("the actual return UI resolves mandatory slot repair before automatically opening optional reassignment", () => {
  const before = waitingReturn(create("kirkhammer", { "bloodstone-shard": 0, "bloodstone-chunk": 2 })),
    { ui, normalSave } = launch(before), actual = chooseReturn(ui, 1), chunk = reward(actual, "bloodstone-chunk");
  assert.deepEqual(actual, returned(before)); assert.equal(actual.rewardChoices.length, 1);
  assert.equal(ui.el("attachmentDialog").open, false); assert.equal(ui.el("openAttachments").hidden, true);
  for (const slot of E.slots(actual)) assert(ui.el("decisions").innerHTML.includes(slot.name));
  assert.match(ui.el("decisions").innerHTML, /1번 슬롯에 장착/);
  assert.match(ui.el("decisions").innerHTML, /2번 슬롯에 장착/);
  assert.match(ui.el("decisions").innerHTML, /부착 후 슬롯 피해/);
  const equipped = click(ui, "decisions", "EQUIP_REWARD", args => args.rewardId === chunk.id && args.slot === 1);
  assert.deepEqual(equipped, go(actual, "EQUIP_REWARD", { rewardId: chunk.id, slot: 1 }));
  assert.equal(equipped.rewardChoices.length, 0); assert.equal(ui.el("attachmentDialog").open, true);
  const shard = reward(equipped, "bloodstone-shard"), moved = click(ui, "attachmentChoices", "REASSIGN_REWARD",
    args => args.rewardId === shard.id && args.slot === 1);
  assert.deepEqual(moved, go(equipped, "REASSIGN_REWARD", { rewardId: shard.id, slot: 1 }));
  assert.match(ui.el("slots").innerHTML, /기본 피해 4 \+ 강화 2 = <b>피해 6<\/b>/);
  assert.equal(moved.rng, before.rng); assert.deepEqual(H(moved).hand, H(before).hand);
  assert.equal(ui.storage.get(normalKey), normalSave); replay(moved);
});

test("the actual return UI keeps the unchanged face's legacy command and offers no optional popup", () => {
  const before = waitingReturn(), { ui, normalSave } = launch(before), after = chooseReturn(ui, 0);
  assert.deepEqual(after, go(before, "RETURN", { node: "tile-14:center", face: 0 }));
  assert.equal(after.commands.at(-1).reassignAttachments, undefined);
  assert.equal(ui.el("attachmentDialog").open, false); assert.equal(ui.el("openAttachments").hidden, true);
  assert.equal(ui.storage.get(normalKey), normalSave); replay(after);
});
