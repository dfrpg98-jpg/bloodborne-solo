"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), Loss = require("../hunt-action-loss");
const H = E.hunter, cache = new Map();
function natural(file, count, qa) {
  const key = `${file}/${count}/${JSON.stringify(qa)}`;
  if (!cache.has(key)) {
    let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13, ...(qa ? { qa } : {}) });
    for (const command of require("./fixtures/" + file).slice(0, count)) s = E.dispatch(s, command);
    assert.equal(E.exportSave(E.importSave(E.exportSave(s))), E.exportSave(s)); cache.set(key, s);
  }
  return structuredClone(cache.get(key));
}
const clinic = count => natural("v074-clinic-escort-chapter-two-natural-commands.json", count);
const captured = () => natural("v074-help-iosefka-natural-commands.json", 318);
const dream = s => ({ type: "DREAM", cardId: H(s).hand[0]?.id });
function plan(s, commands) {
  const before = E.exportSave(s), requested = structuredClone(commands), result = Loss.plan(E, s, commands);
  assert.equal(E.exportSave(s), before, "a warning cannot change cards, companions, history, events or RNG");
  assert.deepEqual(commands, requested); return result;
}
test("two naturally collected survivors warn before Dream entry and actually disappear instead of reaching the clinic", () => {
  const s = clinic(157), commands = [dream(s)], result = plan(s, commands);
  assert.equal(s.mission.heldSurvivors[s.activeHunterId], 2); assert(result);
  assert.equal(result.losses.length, 1); assert.equal(result.losses[0].id, "survivors-held");
  assert.equal(result.losses[0].count, 2); assert.equal(result.losses[0].effect, "discard");
  assert.match(result.summary, /생존자 2명 상실/); assert.match(result.losses[0].description, /피신처에 인도되지/);
  assert.deepEqual(result.commands, commands); assert.equal(result.sourceRevision, s.revision);
  const next = E.dispatch(s, commands[0]); assert.equal(next.mission.heldSurvivors[next.activeHunterId], 0);
  assert.equal(next.mission.deposits.clinic, s.mission.deposits.clinic);
  assert.equal(E.exportSave(E.importSave(E.exportSave(next))), E.exportSave(next));
});
test("invalid targets, missing cost cards and an invalid later command cannot create a partial loss warning", () => {
  const s = clinic(157);
  assert.equal(plan(s, [{ type: "DREAM", cardId: "missing" }]), null);
  assert.equal(plan(s, [dream(s), { type: "STEP", node: "missing" }]), null);
  assert.equal(plan(s, [{ type: "USE_REWARD", rewardId: H(s).rewards.find(r => r.kind === "lantern").id, node: "missing" }]), null);
  assert.equal(Loss.plan(E, s, []), null); assert.equal(Loss.plan(null, s, [dream(s)]), null);
});
test("walking and normal movement-end delivery preserve their own rules without a teleport-loss confirmation", () => {
  const s = clinic(157), commands = [{ type: "MOVE", cardId: H(s).hand[0].id }, { type: "STEP", node: "tile-18:bottom" }];
  assert.equal(plan(s, commands), null);
  let next = s; for (const command of commands) next = E.dispatch(next, command);
  assert.equal(next.mission.heldSurvivors[next.activeHunterId], 2);
  assert.equal(plan(next, [{ type: "STOP_MOVE" }]), null);
});
test("the carried house escort returns to its specific home, while an unpicked survivor does not cause a warning", () => {
  let s = natural("v074-shelter-natural-commands.json", 75);
  assert.equal(plan(s, [dream(s)]), null);
  for (const command of [{ type: "MOVE", cardId: H(s).hand[0].id }, { type: "MISSION_PICKUP" },
    { type: "STEP", node: "tile-11:street" }, { type: "STOP_MOVE" }]) s = E.dispatch(s, command);
  const result = plan(s, [dream(s)]); assert(result);
  assert.equal(result.losses[0].effect, "return"); assert.equal(result.losses[0].destinationNode, "tile-11:house");
  assert.equal(result.losses[0].ruleCard, 8); assert.match(result.losses[0].description, /민가 칸/);
  const next = E.dispatch(s, dream(s)); assert.equal(next.mission.escort.node, "tile-11:house");
  assert.equal(next.mission.escort.carrierId, null);
});
test("the carried bridge escort returns to its own spawn rather than being discarded like collected survivors", () => {
  const s = clinic(133), result = plan(s, [dream(s)]); assert(result);
  const loss = result.losses.find(loss => loss.id === "escort"); assert(loss);
  assert.equal(loss.ruleCard, 37); assert.equal(loss.effect, "return"); assert.equal(loss.destinationNode, "tile-18:top");
  const next = E.dispatch(s, dream(s)); assert.equal(next.mission.escort.node, "tile-18:top");
  assert.equal(next.mission.escort.carrierId, null);
});
for (const kind of ["dream", "central-lamp", "lantern"]) test(`${kind}: captured experiment survivor is dropped at the departure cell, and the warning matches the legal action`, () => {
  const s = captured(), command = kind === "dream" ? dream(s) : kind === "central-lamp" ?
    { type: "INTERACT", cardId: H(s).hand[0].id, lamp: "tile-20:room" } :
    { type: "USE_REWARD", rewardId: H(s).rewards.find(r => r.kind === "lantern").id, node: "tile-20:room" },
    result = plan(s, [command]); assert(result);
  const loss = result.losses.find(loss => loss.id === "rescue");
  assert.equal(loss.effect, "drop"); assert.equal(loss.destinationNode, "tile-14:center"); assert.equal(loss.ruleCard, 49);
  assert.match(loss.description, /다시.*상호작용/);
  const next = E.dispatch(s, command); assert.equal(next.mission.survivor.node, "tile-14:center");
  assert.equal(next.mission.survivor.carrierId, null); assert(!next.mission.completed.includes(50));
  assert.equal(E.exportSave(E.importSave(E.exportSave(next))), E.exportSave(next));
});
test("an uncaptured experiment survivor and corpses are not reported as lost companions", () => {
  const s = natural("v074-help-iosefka-natural-commands.json", 317);
  assert.equal(plan(s, [dream(s)]), null);
  // An isolated inventory branch checks the different token types; the natural
  // collection/departure flow is verified separately above.
  s.mission.heldCorpses[s.activeHunterId] = 2;
  assert.equal(plan(s, [dream(s)]), null);
  const next = E.dispatch(s, dream(s)); assert.equal(next.mission.heldCorpses[next.activeHunterId], 2);
  assert.equal(next.mission.survivor.node, s.mission.survivor.node);
});
test("a teleport consumable uses the same departure loss rules without changing or consuming the inspected item", () => {
  const s = captured(), index = s.consumableDeck.findIndex(item => item.kind === "bold-mark"); assert(index >= 0);
  const [item] = s.consumableDeck.splice(index, 1); H(s).consumables.push(item); E.assertState(s);
  const command = { type: "USE_CONSUMABLE", itemId: item.id, node: "tile-20:room" }, result = plan(s, [command]);
  assert(result); assert.equal(result.losses[0].effect, "drop"); assert(H(s).consumables.some(x => x.id === item.id));
  const next = E.dispatch(s, command); assert(!H(next).consumables.some(x => x.id === item.id));
  assert.equal(next.mission.survivor.node, "tile-14:center");
});
test("an accepted lamp interaction warns before its enemy response, without claiming that the delayed teleport has already happened", () => {
  const s = captured(), ordinary = s.enemies.find(e => !e.missionId); assert(ordinary);
  ordinary.node = H(s).position; E.assertState(s);
  const command = { type: "INTERACT", cardId: H(s).hand[0].id, lamp: "tile-20:room" }, result = plan(s, [command]);
  assert(result); assert.match(result.description, /실행되면/);
  const next = E.dispatch(s, command); assert(next.combat || next.phase === "interaction_order");
  assert.equal(next.mission.survivor.carrierId, next.activeHunterId, "the enemy response precedes the actual drop");
  assert.equal(next.interaction.lamp, "tile-20:room");
});
test("the following salvation NPC is left in place, rather than removed or sent to another survivor's home", () => {
  let s = natural("v074-optional-58-natural-commands.json", 227,
    { preset: "custom", startRewards: [], startConsumables: ["qa-cards"] });
  const item = H(s).consumables.find(item => item.kind === "qa-cards"); assert(item);
  s = E.dispatch(s, { type: "USE_CONSUMABLE", itemId: item.id });
  const result = plan(s, [dream(s)]); assert(result);
  const loss = result.losses.find(loss => loss.id === "salvation-npc"); assert(loss);
  assert.equal(loss.effect, "stay"); assert.equal(loss.destinationNode, H(s).position);
  const next = E.dispatch(s, dream(s)); assert.equal(next.mission.npc.node, s.mission.npc.node);
  assert.equal(next.mission.npc.follow, false);
});
test("a batch that first picks up an escort and then enters Dream warns about that newly carried companion", () => {
  const s = natural("v074-shelter-natural-commands.json", 75), cards = H(s).hand,
    commands = [{ type: "MOVE", cardId: cards[0].id }, { type: "MISSION_PICKUP" },
      { type: "STEP", node: "tile-11:street" }, { type: "STOP_MOVE" }, { type: "DREAM", cardId: cards[1].id }],
    result = plan(s, commands); assert(result);
  assert.equal(result.losses[0].commandIndex, 4); assert.equal(result.losses[0].id, "escort");
  assert.deepEqual(result.commands, commands);
});
test("a public button hint shows the loss before a cost card is selected and never dispatches a preview command", () => {
  const s = clinic(157), before = E.exportSave(s), engine = { ...E, dispatch() { throw Error("button hints cannot dispatch"); } },
    hint = Loss.preview(engine, s, { type: "DREAM" });
  assert(hint); assert.equal(hint.losses[0].count, 2); assert.equal(hint.losses[0].effect, "discard");
  assert.match(hint.summary, /생존자 2명 상실/); assert.equal(hint.commands, undefined);
  assert.equal(E.exportSave(s), before);
  assert.equal(Loss.plan(E, s, [{ type: "DREAM" }]), null, "an unselected cost never produces an actionable confirmation");
});
test("a public button hint distinguishes a captured survivor drop and an escort return from token destruction", () => {
  const capturedState = captured(), lamp = H(capturedState).rewards.find(r => r.kind === "lantern"),
    hint = Loss.preview(E, capturedState, { type: "USE_REWARD", rewardId: lamp.id });
  assert.match(hint.summary, /실험 생존자 현재 칸에 남김/); assert.doesNotMatch(hint.summary, /잃음/);
  assert.equal(hint.losses[0].effect, "drop");
  const bridge = clinic(133), returned = Loss.preview(E, bridge, { type: "DREAM" });
  assert.match(returned.summary, /대교 생존자 원위치 복귀/); assert.doesNotMatch(returned.summary, /잃음/);
  assert.equal(Loss.preview(E, bridge, { type: "MOVE" }), null);
});
