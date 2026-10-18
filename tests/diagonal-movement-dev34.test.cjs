"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls"), C = require("../src/hunt-context"),
  keyboard = require("../src/hunt-keyboard-controls"), { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07", cardinal = ["N", "E", "S", "W"], diagonal = ["NE", "SE", "SW", "NW"],
  commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json"),
  initial = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 }),
  timeline = [initial()];
for (const command of commands) timeline.push(E.dispatch(timeline.at(-1), command));
function launch(state, controls = U) {
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: controls },
    engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } });
}
const direction = (ui, edge) => ui.el("movementControls").querySelectorAll("[data-move-direction]").find(button => button.dataset.moveDirection === edge);
const saved = ui => { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); };

test("rotated T-junctions use the four map diagonals while small artwork offsets and doorways remain cardinal", () => {
  const expected = [["SW", "SE"], ["NW", "SW"], ["NE", "NW"], ["SE", "NE"]];
  for (let rotation = 0; rotation < 4; rotation++) {
    const state = initial();
    state.world.tiles.push({ tileId: "tile-17", x: 0, y: 1, rotation }, { tileId: "tile-10", x: 1, y: 0, rotation });
    assert.deepEqual(U.stepDirections(state, "tile-17:top", "tile-17:lower-left"), [expected[rotation][0]]);
    assert.deepEqual(U.stepDirections(state, "tile-17:top", "tile-17:lower-right"), [expected[rotation][1]]);
    assert.deepEqual(U.stepDirections(state, "tile-10:left", "tile-10:right"), [["E", "S", "W", "N"][rotation]]);
    assert.deepEqual(U.stepDirections(state, "tile-14:center", "tile-10:left"), ["E"], "tile boundary direction follows the doorway grid, not a decorative space center");
  }
});

test("every normal campaign movement option comes from a canonical legal action and diagonal priority never edits the save", () => {
  let diagonalStates = 0, blockedLegalCardinals = 0;
  for (const state of timeline) {
    const before = E.exportSave(state), view = U.movement(state), position = E.hunter(state).position;
    assert.equal(view.directions.length, 8);
    assert.equal(view.diagonalMode, view.directions.some(direction => diagonal.includes(direction.edge) && direction.options.some(option => option.enabled)));
    if (view.diagonalMode) diagonalStates++;
    for (const direction of view.directions) for (const option of direction.options) {
      if (option.command?.type === "STEP") {
        assert(E.neighbors(state, position).includes(option.command.node));
        const canonical = C.view(state, { kind: "cell", node: option.command.node }).actions.find(action => action.id === "move");
        assert.deepEqual(option.command, canonical.command);
        if (option.enabled) assert(canonical.enabled, "a diagonal button cannot bypass movement costs, combat or mission restrictions");
        if (view.diagonalMode && cardinal.includes(direction.edge) && canonical.enabled) blockedLegalCardinals++;
      }
      if (view.diagonalMode && cardinal.includes(direction.edge)) assert.equal(option.enabled, false);
      if (option.enabled) assert.doesNotThrow(() => E.dispatch(state, option.command));
    }
    assert.equal(E.exportSave(state), before);
  }
  assert(diagonalStates > 0); assert(blockedLegalCardinals > 0);
});

test("the eight pad buttons place each diagonal in a corner and one click uses the existing paid STEP", () => {
  const state = timeline[32], ui = launch(state), view = U.movement(state);
  assert.equal(ui.el("movementControls").querySelectorAll("[data-move-direction]").length, 8);
  assert(cardinal.every(edge => direction(ui, edge).disabled));
  assert.equal(direction(ui, "SE").disabled, false); assert.equal(direction(ui, "SW").disabled, false);
  assert.equal(direction(ui, "NE").disabled, true); assert.equal(direction(ui, "NW").disabled, true);
  direction(ui, "SE").click();
  const option = view.directions.find(direction => direction.edge === "SE").options[0], reference = E.dispatch(state, option.command);
  assert.deepEqual(saved(ui), reference);
  assert.equal(E.hunter(reference).position, "tile-17:lower-right");
  assert.equal(reference.move.remaining, state.move.remaining - 1);
  assert.equal(E.hunter(reference).hand.length, E.hunter(state).hand.length, "an ongoing move does not pay a second hand card");
  const css = fs.readFileSync(path.join(__dirname, "../styles/hunt-map-controls.css"), "utf8");
  for (const [edge, row, column] of [["NW", 1, 1], ["NE", 1, 3], ["SW", 3, 1], ["SE", 3, 3]])
    assert.match(css, new RegExp(`\\[data-move-direction="${edge}"\\] \\{ grid-area: ${row} / ${column};`));
});

test("an available diagonal blocks cardinal buttons and their keyboard paths, and diagonals receive no shortcuts", () => {
  const state = timeline[55], ui = launch(state), before = ui.storage.get(key);
  keyboard({ document: ui.document, window: ui.window });
  const view = U.movement(state), east = view.directions.find(direction => direction.edge === "E").options[0];
  assert(east); assert.equal(C.view(state, { kind: "cell", node: east.command.node }).actions.find(action => action.id === "move").enabled, true);
  assert.equal(east.enabled, false); assert.match(east.reason, /대각선/);
  for (const [pressedKey, code] of [["ArrowUp", "ArrowUp"], ["ArrowRight", "ArrowRight"], ["ArrowDown", "ArrowDown"], ["ArrowLeft", "ArrowLeft"], ["w", "KeyW"], ["d", "KeyD"], ["s", "KeyS"], ["a", "KeyA"]]) {
    ui.document.fire("keydown", { key: pressedKey, code, target: ui.document.body });
    assert.equal(ui.storage.get(key), before);
  }
  for (const edge of cardinal) {
    assert.equal(direction(ui, edge).disabled, true);
    direction(ui, edge).fire("click");
  }
  for (const edge of diagonal) assert.equal(direction(ui, edge).getAttribute("aria-keyshortcuts"), null);
  assert.equal(ui.storage.get(key), before);
  direction(ui, "NE").click();
  assert.deepEqual(saved(ui), E.dispatch(state, { type: "STEP", node: "tile-17:top" }));
});

test("without a legal diagonal the normal cardinal controls remain available, and other phases keep all directions disabled", () => {
  const start = initial(), moving = E.dispatch(start, { type: "MOVE", cardId: E.hunter(start).hand[0].id });
  const ui = launch(moving), view = U.movement(moving);
  assert.equal(view.diagonalMode, false); assert.equal(direction(ui, "E").disabled, false);
  assert(diagonal.every(edge => direction(ui, edge).disabled));
  for (const state of [start, timeline.find(state => state.phase === "tile_place"), timeline.find(state => state.phase === "combat_react")]) {
    const inactive = launch(state);
    assert(inactive.el("movementControls").querySelectorAll("[data-move-direction]").every(button => button.disabled));
    assert.equal(U.movement(state).diagonalMode, false);
  }
});

test("multiple explicit destinations still wait for a choice, and a newly disabled chooser is cleared", () => {
  const state = timeline[32]; let grouped = true;
  const controls = { ...U, movement(...args) {
    const view = U.movement(...args);
    if (grouped) {
      const branches = view.directions.filter(direction => ["SE", "SW"].includes(direction.edge)).flatMap(direction => direction.options);
      for (const direction of view.directions) direction.options = direction.edge === "S" ? branches : [];
      view.diagonalMode = false;
    }
    return view;
  } };
  const ui = launch(state, controls), before = ui.storage.get(key);
  direction(ui, "S").click(); assert.equal(ui.storage.get(key), before);
  let choices = ui.el("movementControls").querySelectorAll("[data-move-option]"); assert.equal(choices.length, 2);
  choices[1].click();
  assert.deepEqual(saved(ui), E.dispatch(state, { type: "STEP", node: "tile-17:lower-left" }));
  const stale = launch(state, controls), staleBefore = stale.storage.get(key);
  direction(stale, "S").click(); grouped = false;
  stale.el("hand").querySelectorAll("[data-card]")[0].click();
  assert.equal(stale.el("movementControls").querySelectorAll("[data-move-option]").length, 0);
  assert(cardinal.every(edge => direction(stale, edge).disabled));
  assert.equal(stale.storage.get(key), staleBefore);
});
