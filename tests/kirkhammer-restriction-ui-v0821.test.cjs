"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { hand } = require("./actual-combat-helper.cjs"),
  { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter;

// Supply-valid component setup with a disclosed basic enemy action. This is
// controller/reducer coverage, not a canonical save or a campaign playthrough.
function fixture() {
  const state = E.create(811, "kirkhammer", 1, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === "huntsmans-minion").sideId = "a";
  state.enemies = [{ id: "huntsmans-minion-1", kind: "huntsmans-minion", figure: 1, node: H(state).position, hp: 5 }];
  state.loot = []; hand(state, ["strength", "endurance", "vitality"]);
  state.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; state.enemyDiscard = [];
  E.assertState(state); return state;
}
function launch(state) {
  let current = structuredClone(state); const commands = [];
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { engine: {
    ...E, importSave: () => structuredClone(state),
    applyChapelRuling: state => state, applyTileSpeedRuling: state => state,
    applyCombatReactionRuling: state => state,
    dispatch(state, command) { commands.push(command); current = E.dispatch(state, command); return current; },
  } });
  const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]")
    .find(button => button.dataset.enemy === state.enemies[0].id);
  assert(marker); marker.click(); return { ui, commands, current: () => current };
}
function select(ui, id, value) {
  const control = ui.el(id); assert(control, id); control.value = String(value); control.fire("change");
}
function button(ui, type) {
  const value = [...ui.buttons("decisionActions"), ...ui.buttons("decisions")]
    .find(button => button.dataset.command === type);
  assert(value, type); return value;
}
function click(ui, type) {
  const value = button(ui, type); assert.equal(value.disabled, false, type + " enabled");
  value.click(); assert.equal(ui.el("error").textContent, "");
}
function prepare(ui, state, slot) {
  select(ui, "combatSelectCard", H(state).hand.find(card => card.kind === "strength").id);
  select(ui, "combatSelectSlot", slot);
}

test("Kirkhammer's special slot warns before commitment and blocks a real dodge despite another empty slot", () => {
  const state = fixture(), { ui, commands, current } = launch(state), original = JSON.stringify(state);
  prepare(ui, state, 1);
  assert.match(ui.el("combatSelection").innerHTML, /이번 전투 · 회피 불가 · 방해 면역/);
  assert.doesNotMatch(ui.el("combatSelection").innerHTML, /빈 회피 슬롯 없음/);
  assert.equal(commands.length, 0); assert.equal(JSON.stringify(state), original);
  click(ui, "ATTACK");
  assert.equal(current().phase, "combat_react"); assert.equal(current().combat.noDodge, true);
  assert.equal(H(current()).slots[0], null, "an actually empty slot cannot override the weapon restriction");
  // This checks the disclosed immunity flag only. The enemy's basic attack has
  // no Stagger, so it does not claim to test immunity's combat resolution.
  assert(current().combat.immune.includes("interrupt"));
  assert.match(ui.el("phaseHelp").textContent, /현재 전투는 회피할 수 없습니다/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /회피 카드와.*빈 슬롯을 고른 뒤/);
  const dodgeCard = H(current()).hand.find(card => card.kind === "endurance");
  select(ui, "combatSelectCard", dodgeCard.id); select(ui, "combatSelectSlot", 0);
  assert.equal(E.canDodge(current(), dodgeCard.id, 0), false);
  const blocked = button(ui, "DODGE"), beforeClick = JSON.stringify(current()), count = commands.length;
  assert.equal(blocked.disabled, true); blocked.click();
  assert.equal(commands.length, count); assert.equal(JSON.stringify(current()), beforeClick);
  click(ui, "RESOLVE"); E.assertState(current());
});

test("the ordinary Kirkhammer slot preserves normal dodge selection and switches help after the real dodge", () => {
  const state = fixture(), { ui, current } = launch(state);
  prepare(ui, state, 0);
  assert.doesNotMatch(ui.el("combatSelection").innerHTML, /이번 전투 · 회피 불가|방해 면역|빈 회피 슬롯 없음/);
  click(ui, "ATTACK");
  assert.equal(current().phase, "combat_react"); assert.equal(current().combat.noDodge, false);
  assert(!current().combat.immune.includes("interrupt"));
  assert.match(ui.el("phaseHelp").textContent, /회피 카드와.*빈 슬롯을 고른 뒤/);
  const dodgeCard = H(current()).hand.find(card => card.kind === "endurance");
  select(ui, "combatSelectCard", dodgeCard.id); select(ui, "combatSelectSlot", 1);
  assert.equal(E.canDodge(current(), dodgeCard.id, 1), true); click(ui, "DODGE");
  assert.equal(current().combat.dodged, true);
  assert.match(ui.el("phaseHelp").textContent, /회피가 적용되었습니다.*전투 처리.*계속하세요/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /회피 카드와.*빈 슬롯을 고른 뒤/);
  click(ui, "RESOLVE");
  assert.equal(H(current()).hp, 6, "the successfully dodged basic attack deals no damage");
  assert.equal(current().enemies[0].hp, 1); E.assertState(current());
});

test("the weapon restriction takes priority over a last-empty-slot capacity warning", () => {
  const state = fixture(), h = H(state), index = h.hand.findIndex(card => card.kind === "vitality");
  // Move an existing physical card into the other slot, retaining card supply.
  h.slots[0] = h.hand.splice(index, 1)[0]; E.assertState(state);
  const { ui, current } = launch(state); prepare(ui, state, 1);
  const preview = ui.el("combatSelection").innerHTML;
  assert.match(preview, /이번 전투 · 회피 불가 · 방해 면역/);
  assert.doesNotMatch(preview, /빈 회피 슬롯 없음|자동 회피 등 별도 효과/);
  click(ui, "ATTACK");
  assert(H(current()).slots.every(Boolean)); assert.equal(current().combat.noDodge, true); E.assertState(current());
});
