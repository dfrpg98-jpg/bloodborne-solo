"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls");
const { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07";
function initial() {
  return E.applyLeapMoveRuling(E.applyTileSpeedRuling(E.applyCombatReactionRuling(E.applyChapelRuling(
    E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 })))));
}
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, movementDeclaration: true,
    storage: { [key]: E.exportSave(state) }, engine: E, window: { BBHuntMapControls: U } });
}
const read = ui => { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); };
const controls = ui => ui.el("movementControls").querySelectorAll("[data-command]");
const control = (ui, type) => controls(ui).find(button => button.dataset.command === type);
const hand = ui => ui.el("hand").querySelectorAll("[data-card]");
function select(ui, id) { const card = hand(ui).find(card => card.dataset.card === id); assert(card); card.click(); }
function declare(ui, id) { select(ui, id); control(ui, "MOVE").click(); return read(ui); }
function east(ui) { ui.el("movementControls").querySelectorAll("[data-move-direction]").find(button => button.dataset.moveDirection === "E").click(); }

test("opening a saved hunt does not adopt the new movement policy until its first declaration", () => {
  const start = initial(), original = E.exportSave(start), ui = launch(start);
  assert.equal(ui.storage.get(key), original);
  select(ui, E.hunter(start).hand[0].id); assert.equal(ui.storage.get(key), original);
  control(ui, "MOVE").click();
  const next = read(ui);
  assert.equal(next.movementDeclarationRuling, "first-step");
  assert.deepEqual(next.commands.slice(start.commands.length).map(command => command.type), ["APPLY_MOVEMENT_DECLARATION_RULING", "MOVE"]);
  assert.equal(E.hunter(next).hand.length, E.hunter(start).hand.length);
  assert.equal(control(ui, "STOP_MOVE").disabled, true);
  assert.equal(control(ui, "CANCEL_MOVE").disabled, false);
  assert.match(ui.el("phaseHelp").textContent, /예약/);
});

test("cancelling a declaration restores hunter turn without paying or triggering a mission end", () => {
  const start = initial(), ui = launch(start), beforeHunter = E.hunter(start);
  declare(ui, beforeHunter.hand[0].id); control(ui, "CANCEL_MOVE").click();
  const next = read(ui);
  assert.equal(next.phase, "hunter"); assert.equal(next.move, null);
  assert.deepEqual(E.hunter(next), beforeHunter);
  assert.deepEqual(next.mission, start.mission);
  assert(!control(ui, "CANCEL_MOVE"));
});

test("the first actual STEP pays the reserved card once even after inspecting another card", () => {
  const start = initial(), ui = launch(start), [reserved, inspected] = E.hunter(start).hand;
  declare(ui, reserved.id); select(ui, inspected.id); east(ui);
  const stepped = read(ui), h = E.hunter(stepped);
  assert.equal(h.position, "tile-14:right");
  assert(!h.hand.some(card => card.id === reserved.id));
  assert(h.hand.some(card => card.id === inspected.id));
  assert.equal(h.discard.filter(card => card.id === reserved.id).length, 1);
  assert.equal(control(ui, "STOP_MOVE").disabled, false);
  assert(!control(ui, "CANCEL_MOVE"));
  control(ui, "STOP_MOVE").click();
  assert.equal(E.hunter(read(ui)).hand.length, E.hunter(start).hand.length - 1);
});

test("unpaid movement survives public save restoration and can still be cancelled", () => {
  const start = initial(), ui = launch(start), reserved = E.hunter(start).hand[0].id;
  const pending = declare(ui, reserved), saved = E.exportSave(pending), restored = launch(E.importSave(saved));
  assert.equal(restored.storage.get(key), saved);
  assert.equal(control(restored, "STOP_MOVE").disabled, true);
  assert.equal(control(restored, "CANCEL_MOVE").disabled, false);
  control(restored, "CANCEL_MOVE").click();
  assert(E.hunter(read(restored)).hand.some(card => card.id === reserved));
});

test("both progress and movement controllers block zero-step finish and expose cancellation", () => {
  const ui = launch(initial()), id = hand(ui)[0].dataset.card;
  declare(ui, id);
  const progress = ui.el("decisionActions").querySelectorAll("[data-command]");
  assert.equal(progress.find(button => button.dataset.command === "STOP_MOVE").disabled, true);
  assert.equal(progress.find(button => button.dataset.command === "CANCEL_MOVE").disabled, false);
  const pending = read(ui);
  assert.equal(U.movement(pending).stop.enabled, false);
  assert.equal(U.movement(pending).cancel.enabled, true);
  const currentCell = ui.el("chapterMap").querySelectorAll("[data-node]").find(button =>
    button.dataset.node === E.hunter(pending).position && !button.dataset.entrance);
  assert(currentCell); currentCell.click();
  const currentStops = ui.el("decisionActions").querySelectorAll("[data-command]").filter(button => button.dataset.command === "STOP_MOVE");
  assert(currentStops.length > 0);
  assert(currentStops.every(button => button.disabled), "inspecting the current cell cannot re-enable a zero-step finish");
});
