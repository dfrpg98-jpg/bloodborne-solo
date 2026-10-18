"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Auto = require("../src/hunt-automatic-combat");
const { clickCommand, replayPublicTrace } = require("./helpers/public-command-ui.cjs");
const { records } = require("./fixtures/v075-clinic-completion-manifest.json");
function gameplay(state) { const copy = structuredClone(state); delete copy.commands; return copy; }

function clinicCheckpoint(card, count) {
  const { setup, commandsFile } = records.find(record => record.card === card),
    commands = require("./fixtures/" + commandsFile);
  let state = E.create(setup.seed, setup.weaponId, setup.face, setup.startingConsumable,
    setup.firearmId, setup.startSpace, { campaign: true, rulesVersion: 13 });
  for (const command of commands.slice(0, count)) state = E.dispatch(state, command);
  assert.equal(state.setup.qa, undefined);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
  return { state, commands: commands.slice(count), original: commands };
}
const clinic51 = clinicCheckpoint(51, 340), clinic52 = clinicCheckpoint(52, 361);

for (const [card, fixture, trigger] of [[51, clinic51, "EQUIP_REWARD"], [52, clinic52, "STOP_MOVE"]]) {
  test(`public click predicts the exact automatic EXTRA_TAKE after clinic ${card} ${trigger}`, () => {
    const { state, commands } = fixture, save = E.exportSave(state), frozen = JSON.stringify(fixture.original),
      afterExplicit = E.dispatch(state, commands[0]);
    assert.equal(commands[0].type, trigger);
    assert.deepEqual(Auto.nextCommand(afterExplicit, E), { type: "EXTRA_TAKE" });
    assert.deepEqual(commands[1], { type: "EXTRA_TAKE" });
    const expected = E.dispatch(afterExplicit, commands[1]), actual = clickCommand(state, commands[0]);
    assert.deepEqual(actual, expected);
    assert.equal(actual.revision, state.revision + 2);
    assert.deepEqual(actual.commands.slice(state.commands.length), [commands[0], { type: "EXTRA_TAKE" }]);
    assert.equal(E.exportSave(state), save);
    assert.equal(JSON.stringify(fixture.original), frozen);
    assert.deepEqual(E.importSave(E.exportSave(actual)), actual);
  });

  test(`clinic ${card} trace consumes only its immediately matching automatic response and clicks the following decision`, () => {
    const { state } = fixture, commands = fixture.commands.slice(0, 3), frozen = JSON.stringify(commands),
      checkpoints = [], clicked = [], replay = replayPublicTrace(state, commands, {
        label: `clinic ${card} automatic-prefix checkpoint`,
        shouldClick(before, command, after, index) { clicked.push([index, command.type]); return true; },
        onCheckpoint(checkpoint) {
          checkpoints.push(checkpoint);
          assert.deepEqual(gameplay(checkpoint.state), gameplay(checkpoint.reference));
          assert.deepEqual(E.importSave(E.exportSave(checkpoint.state)), checkpoint.state);
        },
      });
    assert.deepEqual(gameplay(replay.state), gameplay(commands.reduce((next, command) => E.dispatch(next, command), state)));
    assert.deepEqual(replay.state.commands.slice(state.commands.length).map(command => command.type), commands.map(command => command.type));
    assert.equal(replay.originalCommandCount, 3); assert.equal(replay.uiCommandCount, 3);
    assert.equal(replay.uiActions, 2); assert.equal(replay.automaticCommandCount, 1);
    assert.deepEqual(clicked, [[0, trigger], [2, commands[2].type]], "the canonical EXTRA_TAKE is never clicked twice");
    assert.deepEqual(checkpoints.map(checkpoint => [checkpoint.commandIndex, checkpoint.index]), [[0, 1], [2, 2]]);
    assert.deepEqual(checkpoints[0].expectedCommands, [commands[0]]);
    assert.deepEqual(checkpoints[0].automaticCommands, [{ type: "EXTRA_TAKE" }]);
    assert.deepEqual(checkpoints[1].automaticCommands, []);
    assert.equal(JSON.stringify(commands), frozen);
  });
}

test("automatic trace consumption rejects missing responses, extra arguments and intervening decisions", () => {
  const { state, commands } = clinic51, original = E.exportSave(state);
  for (const trace of [
    [commands[0]],
    [commands[0], { type: "EXTRA_TAKE", unexpected: true }],
    [commands[0], commands[2], commands[1]],
  ]) {
    const frozen = JSON.stringify(trace);
    assert.throws(() => replayPublicTrace(state, trace), /automatic suffix must exactly match the next original command 2/);
    assert.equal(JSON.stringify(trace), frozen);
    assert.equal(E.exportSave(state), original);
  }
});

test("engine-only replay retains standalone canonical commands without projecting controller convenience", () => {
  const { state } = clinic51, commands = clinic51.commands.slice(0, 2), checkpoints = [],
    replay = replayPublicTrace(state, commands, { shouldClick: () => false,
      onCheckpoint({ index }) { checkpoints.push(index); } });
  assert.deepEqual(replay.state, commands.reduce((next, command) => E.dispatch(next, command), state));
  assert.equal(replay.uiActions, 0); assert.equal(replay.uiCommandCount, 0); assert.equal(replay.automaticCommandCount, 0);
  assert.deepEqual(checkpoints, [0, 1]);
});
