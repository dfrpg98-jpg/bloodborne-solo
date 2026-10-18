"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), E = require("../src/hunt-engine"),
  { clickCommand, replayPublicTrace } = require("./helpers/public-command-ui.cjs"),
  historical = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const chapterIndex = historical.findIndex(command => command.type === "START_NEXT_CHAPTER");
let prepared = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
for (const command of historical.slice(0, chapterIndex)) prepared = E.dispatch(prepared, command);
assert.equal(prepared.phase, "between_chapters");
const original = historical[chapterIndex];
assert.notEqual(original.face, E.hunter(prepared).face);

test("historical chapter clicks adopt only the current opposite-face attachment timing and keep existing slots", () => {
  const save = E.exportSave(prepared), frozen = JSON.stringify(original), slots = E.hunter(prepared).rewards.map(reward => [reward.id, reward.slot]);
  let ui;
  const actual = clickCommand(prepared, original, { onBoot(value) { ui = value; } }),
    expected = E.dispatch(prepared, { ...original, reassignAttachments: true });
  assert.deepEqual(actual, expected);
  // A new chapter's mission notice may take modal priority. It must leave the
  // explicit reassignment entry available without changing the selected slots.
  const after = ui.storage.get("bloodborne-hunt-v07");
  if (ui.el("missionUpdateDialog").open) ui.el("missionUpdateContinue").click();
  assert.equal(ui.el("openAttachments").hidden, false);
  if (!ui.el("attachmentDialog").open) ui.el("openAttachments").click();
  assert.equal(ui.el("attachmentDialog").open, true);
  assert(ui.el("attachmentChoices").querySelectorAll("[data-command]").some(button => button.dataset.command === "REASSIGN_REWARD"));
  ui.el("closeAttachments").click(); assert.equal(ui.storage.get("bloodborne-hunt-v07"), after);
  assert.deepEqual(E.hunter(actual).rewards.map(reward => [reward.id, reward.slot]), slots);
  assert.equal(JSON.stringify(original), frozen); assert.equal(E.exportSave(prepared), save);
  assert.equal(actual.commands.at(-1).reassignAttachments, true);
  assert.equal(E.exportSave(E.importSave(E.exportSave(actual))), E.exportSave(actual));
});

test("same-face chapter clicks remain legacy commands with no free attachment timing", () => {
  const command = { ...original, face: E.hunter(prepared).face }, actual = clickCommand(prepared, command, {
    onAttachmentRequest() { assert.fail("same-face chapter start cannot open optional reassignment"); },
  });
  assert.deepEqual(actual, E.dispatch(prepared, command));
  assert.equal(actual.commands.at(-1).reassignAttachments, undefined);
  assert.equal(E.hunter(actual).rewardTransformWindow, false);
});

test("acknowledging the new chapter notice opens reassignment before the next real movement", () => {
  let ui;
  const started = clickCommand(prepared, original, { onBoot(value) { ui = value; } }),
    beforeAnswer = ui.storage.get("bloodborne-hunt-v07");
  assert.equal(ui.el("missionUpdateDialog").open, true);
  assert.equal(ui.el("attachmentDialog").open, false, "the new chapter notice is not covered by another pending window");
  ui.el("missionUpdateContinue").click();
  assert.equal(ui.el("attachmentDialog").open, true, "the queued bloodstone choice is restored automatically after the notice");
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), beforeAnswer, "acknowledging the notice is not a game action");
  const reward = E.hunter(started).rewards.find(value => value.kind === "bloodstone-shard"),
    target = ui.el("attachmentChoices").querySelectorAll("[data-command]").find(button => {
      const args = JSON.parse(button.dataset.args);
      return button.dataset.command === "REASSIGN_REWARD" && args.rewardId === reward.id && args.slot !== reward.slot && !button.disabled;
    });
  assert(target); const args = JSON.parse(target.dataset.args); target.click();
  const reassigned = E.dispatch(started, { type: "REASSIGN_REWARD", ...args });
  assert.deepEqual(E.importSave(ui.storage.get("bloodborne-hunt-v07")), reassigned);
  ui.el("closeAttachments").click();
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .find(button => button.dataset.hunterIntent === "MOVE" && !button.disabled);
  assert(intent, "acknowledgement and reassignment restore the movement toolbar action");
  const beforeIntent = ui.storage.get("bloodborne-hunt-v07"); intent.click();
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), beforeIntent, "selecting movement keeps the free attachment window open without a game command");
  assert.equal(ui.el("confirmHunterAction").disabled, true, "the movement confirmation waits for its hand card");
  const cardId = E.hunter(reassigned).hand[0].id;
  ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === cardId).click();
  const move = ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === "MOVE" && !button.disabled);
  assert(move); move.click();
  const moving = E.importSave(ui.storage.get("bloodborne-hunt-v07"));
  assert.deepEqual(moving, E.dispatch(reassigned, { type: "MOVE", cardId }));
  assert.equal(E.hunter(moving).rewardTransformWindow, false);
});

test("chapter replay retains the projected window as gameplay state and checks its actual closure on the next move", () => {
  const commands = [original, historical[chapterIndex + 1], { type: "STOP_MOVE" }], frozen = JSON.stringify(commands), seen = [];
  const replay = replayPublicTrace(prepared, commands, { label: "chapter-window projection", onCheckpoint({ state, reference, index }) {
    seen.push(E.hunter(state).rewardTransformWindow);
    assert.equal(E.hunter(state).rewardTransformWindow, E.hunter(reference).rewardTransformWindow);
    if (index === 0) assert.deepEqual(state.commands.at(-1), { ...original, reassignAttachments: true });
  } });
  assert.deepEqual(seen, [true, false, false]); assert.deepEqual(replay.state, replay.reference);
  assert.equal(replay.uiCommandCount, 3); assert.equal(JSON.stringify(commands), frozen);
});

test("engine-only historical steps are not upgraded and contradictory explicit flags cannot be silently projected", () => {
  const commands = [original, historical[chapterIndex + 1]], frozen = JSON.stringify(commands), replay = replayPublicTrace(prepared, commands, {
    label: "legacy engine-only chapter", shouldClick: () => false,
    onCheckpoint({ state }) { assert.equal(E.hunter(state).rewardTransformWindow, false); },
  });
  assert.equal(replay.uiActions, 0); assert.equal(replay.uiCommandCount, 0);
  assert.deepEqual(replay.state, commands.reduce((state, command) => E.dispatch(state, command), prepared));
  assert.equal(JSON.stringify(commands), frozen);
  assert.throws(() => clickCommand(prepared, { ...original, reassignAttachments: false }), /exact selected destination, face and explicit current attachment timing/);
});
