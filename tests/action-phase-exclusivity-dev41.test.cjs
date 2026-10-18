"use strict";
const test = require("node:test"), assert = require("node:assert/strict"),
  fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const E = require("../src/hunt-engine"), Menu = require("../src/hunt-action-menu"),
  Context = require("../src/hunt-context"), { boot } = require("./helpers/ui-harness.cjs");
const root = path.resolve(__dirname, ".."), key = "bloodborne-hunt-v07",
  sourceFiles = ["src/hunt-engine.js", "src/hunt-action-menu.js", "src/hunt-context.js", "src/hunt-app.js",
    "src/hunt-keyboard-controls.js", "src/game-help.js", "hunt.html"],
  hashes = () => Object.fromEntries(sourceFiles.map(file => [file,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")])),
  sourceBefore = hashes(), verified = new Set();
const sources = [
  { id: "beast-claw-normal", weaponId: "beast-claw", face: 0,
    file: "tests/fixtures/weapon-campaign-completion/beast-claw-0.json", expectedCommands: 351 },
  { id: "burial-normal", weaponId: "burial", face: 1,
    file: "tests/fixtures/full-campaign-actual-v10-commands.json", expectedCommands: 325 },
];
function begin(spec) {
  return E.create(90, spec.weaponId, spec.face, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
}
const traces = sources.map(spec => {
  const commands = require(path.join(root, spec.file)), states = [begin(spec)];
  assert.equal(commands.length, spec.expectedCommands);
  for (const command of commands) states.push(E.dispatch(states.at(-1), command));
  return { spec, commands, states };
});
const reached = traces.flatMap(trace => trace.states), evidence = { schema: 1,
  scope: "Normal public command replay, engine phase guards, action model and actual controller rendering; synthetic DOM is not native keyboard evidence.",
  setup: { seed: 90, startingConsumable: null, firearmId: "hunter-pistol", startSpace: "center", campaign: true, rulesVersion: 13 },
  mapping: { Q: { hunter: "MOVE", move: "STOP_MOVE", combat_choose: "COUNTER", tile_place: "rotation 0" },
    E: { hunter: "DREAM", combat_choose: "NO_ATTACK", tile_place: "rotation 1" },
    Z: { hunter: "TRANSFORM", tile_place: "rotation 2" }, C: { hunter: "ATTACK", tile_place: "rotation 3" } },
  traces: [], aggregate: {}, engineWitnesses: [], controllerWitnesses: [], tilePlacementWitnesses: [] };
function model(state) {
  const hunter = E.hunter(state), target = state.enemies.find(enemy => enemy.node === hunter.position) || state.enemies[0];
  return Menu.view(state, E, Context, { enemyId: target?.id });
}
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: E.exportSave(state) }, engine: { ...E,
      applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
  });
}
const controls = ui => [...ui.el("decisions").querySelectorAll("[data-command]"),
  ...ui.el("decisionActions").querySelectorAll("[data-command]")],
  command = (ui, type) => controls(ui).find(button => button.dataset.command === type),
  basicEnabled = ui => ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .filter(button => !button.disabled).map(button => button.dataset.hunterIntent),
  publicArgs = state => ({ cardId: E.hunter(state).hand[0]?.id, slot: 0, enemyId: state.enemies[0]?.id });

test("two unchanged normal campaign command traces reach 678 lawful states with disjoint action phases", () => {
  let choices = 0, overlaps = 0, remainingMove = 0, hunterRewardLocks = 0;
  for (const trace of traces) {
    const counts = {}, origins = {}, summary = { id: trace.spec.id, file: trace.spec.file,
      weaponId: trace.spec.weaponId, face: trace.spec.face, commandCount: trace.commands.length,
      stateCount: trace.states.length, phaseCounts: counts, combatChooseCount: 0,
      combatChooseOrigins: origins, moveOrDreamOverlapCount: 0, combatChooseWithMoveCount: 0, hunterRewardLocks: 0 };
    for (const state of trace.states) {
      assert.equal(state.setup.qa, undefined); assert.equal(state.setup.campaign, true);
      counts[state.phase] = (counts[state.phase] || 0) + 1;
      const view = model(state), enabled = view.actions.filter(action => action.enabled).map(action => action.type);
      if (state.phase !== "hunter") assert.deepEqual(enabled, [], "basic intents require the hunter phase");
      if (state.phase === "combat_choose") {
        choices++; summary.combatChooseCount++;
        origins[state.combat.origin] = (origins[state.combat.origin] || 0) + 1;
        if (enabled.some(type => ["MOVE", "DREAM"].includes(type))) { overlaps++; summary.moveOrDreamOverlapCount++; }
        if (state.move) { remainingMove++; summary.combatChooseWithMoveCount++; }
      }
      if (state.phase === "hunter" && state.rewardChoices.length) {
        hunterRewardLocks++; summary.hunterRewardLocks++; assert.deepEqual(enabled, []);
      }
    }
    assert.deepEqual(E.importSave(E.exportSave(trace.states.at(-1))), trace.states.at(-1));
    evidence.traces.push(summary);
  }
  assert.equal(reached.length, 678); assert.equal(choices, 34);
  assert.equal(overlaps, 0); assert.equal(remainingMove, 0); assert.equal(hunterRewardLocks, 3);
  evidence.aggregate = { stateCount: reached.length, combatChooseCount: choices,
    moveOrDreamOverlapCount: overlaps, combatChooseWithMoveCount: remainingMove, hunterRewardLocks };
  verified.add("traces");
});

test("actual engine guards reject each cross-phase shortcut counterpart on reached states", () => {
  const hunter = traces[0].states[0], move = traces[0].states[3], choose = traces[0].states[5];
  for (const [state, denied] of [[hunter, ["COUNTER", "NO_ATTACK", "STOP_MOVE"]],
    [move, ["COUNTER", "NO_ATTACK", "DREAM"]],
    [choose, ["MOVE", "STOP_MOVE", "DREAM", "TRANSFORM", "ATTACK"]]]) {
    for (const type of denied) assert.throws(() => E.dispatch(state, { type, ...publicArgs(state) }));
    evidence.engineWitnesses.push({ phase: state.phase, source: sources[0].file,
      prefixLength: state.commands.length, deniedCommands: denied });
  }
  const free = E.hunter(choose).slots.findIndex(slot => !slot), cardId = E.hunter(choose).hand[0].id,
    counter = E.dispatch(choose, { type: "COUNTER", cardId, slot: free }),
    noAttack = E.dispatch(choose, { type: "NO_ATTACK" });
  assert.equal(counter.commands.at(-1).type, "COUNTER"); assert.equal(noAttack.commands.at(-1).type, "NO_ATTACK");
  assert.deepEqual(E.importSave(E.exportSave(counter)), counter);
  assert.deepEqual(E.importSave(E.exportSave(noAttack)), noAttack);
  assert.equal(E.exportSave(traces[0].states[5]), E.exportSave(choose));
  verified.add("engine");
});

test("reached combat response needs a selected hand and free slot while movement and dream stay disabled", () => {
  for (const [prefixLength, phase] of [[0, "hunter"], [3, "move"]]) {
    const reachedState = traces[0].states[prefixLength], witness = launch(reachedState),
      enabled = basicEnabled(witness);
    assert.equal(reachedState.phase, phase);
    assert.equal(command(witness, "COUNTER"), undefined); assert.equal(command(witness, "NO_ATTACK"), undefined);
    if (phase === "hunter") assert(["MOVE", "DREAM"].every(type => enabled.includes(type)));
    else { assert.deepEqual(enabled, []); assert(command(witness, "STOP_MOVE") && !command(witness, "STOP_MOVE").disabled); }
    assert.equal(witness.storage.get(key), E.exportSave(reachedState));
    evidence.controllerWitnesses.push({ source: sources[0].file, prefixLength, phase,
      basicActionsEnabled: enabled, counterAndNoAttackAbsent: true,
      stopMoveEnabled: !!command(witness, "STOP_MOVE") && !command(witness, "STOP_MOVE").disabled });
  }
  const state = traces[0].states[5], ui = launch(state), before = ui.storage.get(key);
  assert.equal(state.phase, "combat_choose"); assert.deepEqual(basicEnabled(ui), []);
  assert(command(ui, "COUNTER")?.disabled); assert(command(ui, "NO_ATTACK") && !command(ui, "NO_ATTACK").disabled);
  const card = ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === "card-7");
  assert(card); card.click(); assert(command(ui, "COUNTER")?.disabled);
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find(button => button.dataset.slot === "2");
  assert(slot && !slot.disabled); slot.click();
  assert(command(ui, "COUNTER") && !command(ui, "COUNTER").disabled);
  assert(command(ui, "NO_ATTACK") && !command(ui, "NO_ATTACK").disabled);
  assert.deepEqual(basicEnabled(ui), []); assert.equal(ui.storage.get(key), before);
  evidence.controllerWitnesses.push({ source: sources[0].file, prefixLength: 5, phase: "combat_choose",
    counterBeforeSelection: false, counterWithCardOnly: false, counterWithCardAndSlot: true,
    noAttackEnabled: true, moveOrDreamEnabled: false, selectionChangedSave: false });
  verified.add("selection");
});

test("real hunter reward choices lock basic actions without inventing an invalid phase", () => {
  const locked = reached.filter(state => state.phase === "hunter" && state.rewardChoices.length);
  assert.equal(locked.length, 3);
  for (const state of locked) {
    assert.deepEqual(E.importSave(E.exportSave(state)), state);
    const ui = launch(state);
    assert.deepEqual(basicEnabled(ui), []); assert.equal(command(ui, "COUNTER"), undefined);
    assert.equal(command(ui, "NO_ATTACK"), undefined);
    assert.throws(() => E.dispatch(state, { type: "MOVE", ...publicArgs(state) }));
    assert.throws(() => E.dispatch(state, { type: "DREAM", ...publicArgs(state) }));
  }
  evidence.controllerWitnesses.push({ phase: "hunter", mandatoryRewardChoiceStates: locked.length,
    allBasicActionsDisabled: true, counterAndNoAttackAbsent: true });
  verified.add("rewards");
});

test("three normal tile placement checkpoints retain fixed rotation slots including disabled angles", () => {
  const recipes = require("./fixtures/map-preview-dev38-recipes.json");
  for (const recipe of recipes.cases) {
    const p = recipe.setup;
    let state = E.create(p.seed, p.weaponId, p.face, p.startingConsumable, p.firearmId, p.startSpace, p.options);
    for (const action of recipe.commands) state = E.dispatch(state, action);
    assert.equal(state.setup.qa, undefined); assert.equal(state.phase, "tile_place");
    assert.deepEqual(E.importSave(E.exportSave(state)), state);
    const ui = launch(state), rotations = ui.el("decisions").querySelectorAll("[data-rotation]"),
      options = E.placementOptions(state);
    assert.deepEqual(rotations.map(button => Number(button.dataset.rotation)), [0, 1, 2, 3]);
    assert.deepEqual(rotations.map(button => !button.disabled), [0, 1, 2, 3].map(rotation => options.includes(rotation)));
    assert.deepEqual(basicEnabled(ui), []);
    for (const type of ["MOVE", "DREAM", "TRANSFORM", "ATTACK"])
      assert.throws(() => E.dispatch(state, { type, ...publicArgs(state) }));
    evidence.tilePlacementWitnesses.push({ tileId: recipe.id, source: "tests/fixtures/map-preview-dev38-recipes.json",
      commandCount: recipe.commands.length, legalRotations: options, displayedDegrees: [0, 90, 180, 270],
      fixedShortcutRecommendation: ["Q", "E", "Z", "C"], basicActionEnabledCount: 0,
      strictSaveReplay: true, phaseGuardDeniesBasicCommands: true });
  }
  verified.add("rotations");
});

test("the reproducible phase audit contains all independent checks", () => {
  assert.equal(verified.size, 5);
  if (process.env.BB_WRITE_ACTION_PHASE_AUDIT === "1") {
    const after = hashes(); assert.deepEqual(after, sourceBefore, "product sources stay unchanged during the audit");
    evidence.status = "passed"; evidence.timestamp = new Date().toISOString();
    evidence.sourceSha256Before = sourceBefore; evidence.sourceSha256After = after;
    const target = path.join(root, "docs/audits/contextual-action-keys-v0.8.13-dev.41/verification.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(evidence, null, 2) + "\n");
  }
});
