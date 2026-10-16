"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { hand, enemyAction } = require("./actual-combat-helper.cjs"),
  { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, key = "bloodborne-hunt-v07", plain = value => JSON.parse(JSON.stringify(value)),
  run = (state, ...commands) => commands.reduce((current, command) => E.dispatch(current, command), state);

// The first three contracts construct supply-valid initial encounters, using
// the same card/deck setup as hunt.test.cjs, then enter the phase through real
// ATTACK/RESOLVE reducers. Their plain JSON is not a canonical imported save or
// a claim of natural campaign progress. The chapel contract below is reached
// entirely through public commands and uses the strict canonical importer.
function encounter(kind, side, cards, face = 0) {
  const state = E.create(123, "burial", face, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === kind).sideId = side;
  state.enemies = [{ id: kind + "-1", kind, figure: 1, node: H(state).position, hp: E.data.enemies[kind].health }];
  state.loot = []; hand(state, cards); enemyAction(state, "ability", "basic"); E.assertState(state); return state;
}
function attack(state, slot = 0) {
  return E.dispatch(state, { type: "ATTACK", enemyId: state.enemies[0].id, cardId: H(state).hand[0].id, slot });
}
function launch(state, strict = false) {
  const save = strict ? E.exportSave : JSON.stringify, load = strict ? E.importSave : JSON.parse,
    saved = save(state), calls = [], ui = boot(state, E.missionView(state), E.rewardsView(state), {
      realInventory: true, storage: { [key]: saved }, engine: { ...E, importSave: load, exportSave: save,
        applyChapelRuling: value => value, applyCombatReactionRuling: value => value,
        applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
        dispatch(value, command) { calls.push(plain(command)); return E.dispatch(value, command); } },
    });
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.storage.get(key), saved);
  assert.equal(save(state), saved, "rendering does not mutate the supplied rules state");
  // A bounded public log can require a read-only historical replay on boot.
  // Only dispatches caused by the interaction under test are observed below.
  calls.length = 0; return { ui, calls, saved, load };
}
function commandButtons(ui, type) {
  return ui.document.querySelectorAll("[data-command]").filter(button => button.dataset.command === type);
}
function commit(f, before, command) {
  const { type, ...args } = command,
    button = commandButtons(f.ui, type).find(button => JSON.stringify(JSON.parse(button.dataset.args || "{}")) === JSON.stringify(args));
  assert(button && !button.disabled, "enabled actual UI command " + JSON.stringify(command));
  const expected = E.dispatch(before, command); button.click();
  assert.equal(f.ui.el("error").textContent, ""); const actual = f.load(f.ui.storage.get(key)); E.assertState(actual);
  assert.deepEqual(actual, expected); assert.equal(actual.commands.length, before.commands.length + 1);
  assert.deepEqual(actual.commands.at(-1), command); assert(f.calls.some(call => JSON.stringify(call) === JSON.stringify(command)));
  return actual;
}
function cardCost(before, after, paidId = null) {
  const previous = H(before), actual = H(after);
  assert.deepEqual(actual.slots, previous.slots, "the phase choice does not consume another weapon slot");
  assert.deepEqual(actual.hand, paidId ? previous.hand.filter(card => card.id !== paidId) : previous.hand);
  assert.deepEqual(actual.discard, paidId ? [...previous.discard, previous.hand.find(card => card.id === paidId)] : previous.discard);
}

test("spawn_choice: the chosen fourth figure is reused at full HP without paying another card or moving the other candidates", () => {
  let state = encounter("scourge-beast", "a", ["endurance", "strength", "vitality"], 1);
  state.enemies = [1, 2, 3, 4].map(figure => ({ ...state.enemies[0], id: "scourge-beast-" + figure, figure, hp: figure === 4 ? 1 : 4 }));
  E.assertState(state); state = run(attack(state, 1), { type: "RESOLVE" });
  assert.equal(state.phase, "spawn_choice"); assert.equal(state.spawnChoices.length, 4);
  const f = launch(state), choices = commandButtons(f.ui, "SPAWN_CHOICE");
  assert.deepEqual(choices.map(button => JSON.parse(button.dataset.args).enemyId), state.spawnChoices);
  for (const number of [1, 2, 3, 4]) assert(f.ui.el("decisions").textContent.includes("재앙의 야수#" + number));
  assert.equal(f.calls.length, 0); assert.equal(f.ui.storage.get(key), f.saved);
  const after = commit(f, state, { type: "SPAWN_CHOICE", enemyId: "scourge-beast-4" });
  assert.equal(after.enemies.length, 4); assert.equal(after.enemies.find(enemy => enemy.id === "scourge-beast-4").hp, 4);
  for (const id of ["scourge-beast-2", "scourge-beast-3"])
    assert.deepEqual(after.enemies.find(enemy => enemy.id === id), state.enemies.find(enemy => enemy.id === id));
  cardCost(state, after); assert.equal(H(after).echoes, H(state).echoes); assert.equal(after.phase, "hunter");
});

for (const discard of [true, false])
  test(`ability_choice: ${discard ? "the explicitly selected hand card pays once" : "declining pays no card and applies the speed/dodge penalty"}`, () => {
    const state = attack(encounter("huntsmans-minion", "b", ["strength", "endurance", "vitality"]));
    assert.equal(state.phase, "ability_choice"); const f = launch(state), selected = H(state).hand[1],
      choices = commandButtons(f.ui, "ABILITY_CHOICE");
    assert.deepEqual(choices.map(button => JSON.parse(button.dataset.args).cardId).filter(Boolean), H(state).hand.map(card => card.id));
    const command = { type: "ABILITY_CHOICE", ...(discard ? { cardId: selected.id } : {}) }, after = commit(f, state, command);
    cardCost(state, after, discard ? selected.id : null);
    assert.equal(after.combat.attack.speed, state.combat.attack.speed - (discard ? 0 : 2));
    assert.equal(after.combat.noDodge, !discard); assert.equal(after.combat.action.kind, "basic");
    assert.deepEqual(after.enemyDiscard, [...state.enemyDiscard, "basic"], "the ability reveals its next action exactly once");
    assert.equal(H(after).hp, H(state).hp); assert.deepEqual(H(after).consumables, H(state).consumables);
  });

for (const use of [true, false])
  test(`cheap_shot: ${use ? "the chosen Cheap Shot affects the fixed encounter target even when another map enemy is selected" : "skipping retains the skill and resumes the timed ability"}`, () => {
    let state = encounter("scourge-beast", "a", ["strength", "cheap-shot", "endurance"]);
    state.enemies.push({ ...state.enemies[0], id: "scourge-beast-2", figure: 2, node: "tile-14:left" });
    E.assertState(state); state = run(attack(state), { type: "RESOLVE" }); assert.equal(state.phase, "cheap_shot");
    const f = launch(state), skill = H(state).hand.find(card => card.kind === "cheap-shot"); assert(skill);
    const options = commandButtons(f.ui, "CHEAP_SHOT");
    assert.deepEqual(options.map(button => JSON.parse(button.dataset.args).cardId).filter(Boolean), [skill.id]);
    f.ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "scourge-beast-2").click();
    assert.equal(f.ui.storage.get(key), f.saved); assert.equal(f.calls.length, 0, "inspecting another target cannot redirect or execute Cheap Shot");
    const after = commit(f, state, { type: "CHEAP_SHOT", ...(use ? { cardId: skill.id } : {}) });
    cardCost(state, after, use ? skill.id : null);
    assert.deepEqual(after.enemies.find(enemy => enemy.id === "scourge-beast-2"), state.enemies.find(enemy => enemy.id === "scourge-beast-2"));
    if (use) {
      assert(!after.enemies.some(enemy => enemy.id === "scourge-beast-1")); assert.equal(after.kills, state.kills + 1);
      assert.equal(H(after).echoes, Math.min(3, H(state).echoes + 1));
    } else {
      assert.equal(after.enemies.find(enemy => enemy.id === "scourge-beast-1").hp, 2);
      assert(after.enemies.some(enemy => enemy.id === "scourge-beast-3"), "declining lets the pending summoning ability finish");
    }
    assert.equal(after.phase, "hunter");
  });

function chapelExchange() {
  let state = E.create(33, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  state = run(state, { type: "MOVE", cardId: H(state).hand[0].id }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STEP", node: "tile-07:middle" });
  state = run(state, { type: "MOVE", cardId: H(state).hand[0].id }, { type: "STEP", node: "tile-07:top" }, { type: "STOP_MOVE" });
  const beforeInteraction = state, paid = H(state).hand[0].id;
  state = E.dispatch(state, { type: "INTERACT", cardId: paid, exchange: true, lootCount: 2, exchangeAfterLoot: true });
  assert.equal(state.phase, "exchange_choice"); assert.equal(H(state).hand.length, H(beforeInteraction).hand.length - 1);
  const saved = E.exportSave(state); assert.equal(E.exportSave(E.importSave(saved)), saved); return state;
}
for (const exchange of [true, false])
  test(`exchange_choice: the public-command chapel ${exchange ? "exchanges only the explicitly selected newly collected item" : "decline keeps both collected items without a second action cost"}`, () => {
    const state = chapelExchange(), f = launch(state, true), item = H(state).consumables[1],
      choices = commandButtons(f.ui, "EXCHANGE_CHOICE");
    assert.equal(H(state).consumables.length, 2);
    assert.deepEqual(choices.map(button => JSON.parse(button.dataset.args).itemId).filter(Boolean), H(state).consumables.map(value => value.id));
    const command = { type: "EXCHANGE_CHOICE", ...(exchange ? { itemId: item.id } : { skip: true }) }, after = commit(f, state, command);
    cardCost(state, after); assert.equal(after.interaction, null); assert.equal(after.phase, "hunter");
    assert.deepEqual(H(after).consumables, exchange ? H(state).consumables.filter(value => value.id !== item.id) : H(state).consumables);
    assert.deepEqual(after.consumableDiscard, exchange ? [...state.consumableDiscard, item] : state.consumableDiscard);
    assert.equal(H(after).echoes, H(state).echoes + (exchange ? 1 : 0));
    assert.equal(after.loot.filter(node => node === "tile-07:top").length, 0);
    assert.equal(E.exportSave(E.importSave(E.exportSave(after))), E.exportSave(after));
  });
