"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-qa-v1";
// Separate legal QA-mode reproduction, not Second's normal-play save.
function encounter(away = false, weapon = "qa-test-weapon", face = 0) {
  let state = E.create(90, weapon, face, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "fast" } });
  const commands = [{ type: "MOVE", cardId: "card-3" }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" }];
  if (away) commands.push({ type: "DREAM", cardId: "card-1" }, { type: "REFILL", discardIds: [] },
    { type: "RETURN", node: "tile-14:center", face });
  for (const command of commands) state = E.dispatch(state, command);
  assert.equal(state.phase, "hunter"); assert.equal(state.mission.targets.mob.tokens, 1);
  return state;
}
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
    engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s },
    window: { BBHuntMapControls: require("../src/hunt-map-controls") },
  });
}
function inspect(ui, enemyId) {
  const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(b => b.dataset.enemy === enemyId);
  assert(marker); marker.click();
}
function selectAttack(ui) {
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.el("slots").querySelectorAll("[data-slot]").find(b => b.dataset.slot === "0").click();
}
function hidden(ui) {
  assert.equal(ui.el("attackConsequences").hidden, true);
  assert.equal(ui.el("attackConsequences").innerHTML, "");
  assert.doesNotMatch(ui.el("combatInfo").innerHTML, /combat-outcome-details|토큰 소모 후 완전 회복/);
}

test("empty-space return and reload do not promote a remote default enemy into a combat forecast", () => {
  const state = encounter(true), enemy = state.enemies[0];
  assert.notEqual(enemy.node, E.hunter(state).position);
  for (let i = 0; i < 2; i++) {
    const ui = launch(E.importSave(E.exportSave(state))), before = ui.storage.get(key);
    hidden(ui);
    assert.equal(ui.el("hand").querySelectorAll("[data-card]").some(b => b.getAttribute("aria-pressed") === "true"), false);
    assert.equal(ui.el("slots").querySelectorAll("[data-slot]").some(b => b.getAttribute("aria-pressed") === "true"), false);
    assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
  }
});

test("explicit remote enemy inspection retains its public warning, while closing or inspecting an empty space hides it", () => {
  const state = encounter(true), ui = launch(state), before = ui.storage.get(key), enemy = state.enemies[0];
  inspect(ui, enemy.id); assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("combatInfo").textContent, /토큰 1개/);
  ui.el("clearMapTarget").click(); hidden(ui);
  inspect(ui, enemy.id);
  const cell = ui.el("chapterMap").querySelectorAll("[data-node]").find(b => b.dataset.node === E.hunter(state).position && !b.dataset.entrance);
  assert(cell); cell.click(); hidden(ui);
  assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
});

test("an automatic same-space target warns once an attack is prepared, and deselection removes that forecast", () => {
  const state = encounter(), ui = launch(state), before = ui.storage.get(key);
  hidden(ui); selectAttack(ui);
  assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("combatInfo").textContent, /토큰 1개/);
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find(b => b.dataset.slot === "0");
  slot.click(); hidden(ui);
  assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
});

test("selecting a card and slot cannot forecast a remote default target whose attack is unavailable", () => {
  const state = encounter(true), ui = launch(state), before = ui.storage.get(key);
  selectAttack(ui); hidden(ui);
  assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
});

test("an active combat keeps its warnings even without a separate map inspection", () => {
  const start = encounter(), enemyId = start.enemies[0].id;
  const state = E.dispatch(start, { type: "ATTACK", enemyId, cardId: E.hunter(start).hand[0].id, slot: 0 });
  assert.equal(state.phase, "combat_react");
  const ui = launch(state), before = ui.storage.get(key);
  assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("combatInfo").textContent, /토큰 소모 후 완전 회복/);
  assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
});

test("a legally prepared pull attack keeps the warning for its otherwise remote target", () => {
  let state = encounter(true, "burial", 1);
  state = E.dispatch(state, { type: "INTERACT", cardId: E.hunter(state).hand[0].id, lamp: "tile-04:left" });
  const enemy = state.enemies[0], ui = launch(state), before = ui.storage.get(key);
  assert.notEqual(enemy.node, E.hunter(state).position);
  assert(E.pullCandidates(state).some(e => e.id === enemy.id));
  selectAttack(ui); hidden(ui);
  const pull = ui.el("decisions").querySelectorAll("[data-pull]").find(b => b.dataset.pull === enemy.id);
  assert(pull); pull.checked = true; pull.fire("change");
  assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("combatInfo").textContent, /토큰 1개/);
  assert.equal(ui.storage.get(key), before); assert.equal(ui.el("error").textContent, "");
});
