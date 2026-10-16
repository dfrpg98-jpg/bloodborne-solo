"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), E = require("../src/hunt-engine"),
  { clickCommand, replayPublicTrace } = require("./helpers/public-command-ui.cjs");
function waitingReturn() {
  let s = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14,
    practiceRewards: ["bloodstone-shard"] });
  s = E.dispatch(s, { type: "EQUIP_REWARD", rewardId: s.rewardChoices[0].rewardId, slot: 0 });
  s = E.dispatch(s, { type: "DREAM", cardId: E.hunter(s).hand[0].id });
  s = E.dispatch(s, { type: "REFILL" }); assert.equal(s.phase, "return");
  assert.equal(E.exportSave(E.importSave(E.exportSave(s))), E.exportSave(s)); return s;
}
test("the replay adapter projects only a newly selected opposite return face and explicitly keeps attached slots", () => {
  const before = waitingReturn(), original = { type: "RETURN", node: "tile-14:center", face: 1 },
    frozen = JSON.stringify(original), slots = E.hunter(before).rewards.map(r => [r.id, r.slot]);
  let popup = 0;
  const actual = clickCommand(before, original, { onAttachmentRequest(ui) {
    popup++; assert.equal(ui.el("attachmentDialog").open, true);
    assert(ui.el("attachmentChoices").querySelectorAll("[data-command]").some(b => b.dataset.command === "REASSIGN_REWARD"));
  } });
  assert.equal(popup, 1); assert.equal(JSON.stringify(original), frozen);
  assert.deepEqual(actual, E.dispatch(before, { ...original, reassignAttachments: true }));
  assert.deepEqual(E.hunter(actual).rewards.map(r => [r.id, r.slot]), slots);
  assert.equal(actual.commands.length, before.commands.length + 1);
  assert.equal(actual.commands.at(-1).type, "RETURN"); assert.equal(actual.commands.at(-1).reassignAttachments, true);
});
test("same-face return stays a legacy command with no optional attachment window", () => {
  const before = waitingReturn(), command = { type: "RETURN", node: "tile-14:center", face: 0 };
  const actual = clickCommand(before, command, { onAttachmentRequest() { assert.fail("unchanged face cannot open the return window"); } });
  assert.deepEqual(actual, E.dispatch(before, command)); assert.equal(actual.commands.at(-1).reassignAttachments, undefined);
  assert.equal(E.hunter(actual).rewardTransformWindow, false);
});
test("the reference follows the exact opt-in window until the next ordinary action closes it", () => {
  const before = waitingReturn(), commands = [{ type: "RETURN", node: "tile-14:center", face: 1 },
    { type: "MOVE", cardId: E.hunter(before).hand[0].id }, { type: "STOP_MOVE" }], frozen = JSON.stringify(commands), seen = [];
  const replay = replayPublicTrace(before, commands, { label: "return-window projection", onCheckpoint({ state, reference, index }) {
    seen.push(E.hunter(state).rewardTransformWindow); assert.deepEqual(E.hunter(state).rewards, E.hunter(reference).rewards);
    if (index === 0) assert.equal(state.commands.at(-1).reassignAttachments, true);
  } });
  assert.deepEqual(seen, [true, false, false]); assert.equal(JSON.stringify(commands), frozen);
  assert.equal(replay.uiCommandCount, commands.length); assert.equal(replay.state.rng, replay.reference.rng);
  assert.deepEqual(replay.state, replay.reference);
});
