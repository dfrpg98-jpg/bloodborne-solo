"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"),
  { hand } = require("./actual-combat-helper.cjs");
const H = E.hunter;

// These component fixtures control the disclosed HP/equipment and initial basic
// enemy action. They exercise the real controller handlers and real dispatch,
// but are not canonical saved checkpoints or an end-to-end campaign run.
function fixture(weapon, face = 0) {
  const state = E.create(123, weapon, face, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === "huntsman-mob").sideId = "a";
  state.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(state).position, hp: 4 }];
  state.loot = []; hand(state, ["strength", "endurance", "vitality"]);
  state.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; state.enemyDiscard = [];
  E.assertState(state); return state;
}
function launch(state) {
  let current = structuredClone(state); const commands = [], ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine: { ...E, importSave: () => structuredClone(state),
      applyChapelRuling: state => state, applyTileSpeedRuling: state => state, applyCombatReactionRuling: state => state,
      dispatch(state, command) { commands.push(command); current = E.dispatch(state, command); return current; } },
  });
  const enemy = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === state.enemies[0].id);
  assert(enemy); enemy.click();
  return { ui, commands, current: () => current };
}
function select(ui, id, value) {
  const element = ui.el(id); assert(element, id); element.value = String(value); element.fire("change");
}
function attack(ui) {
  const button = ui.buttons("decisionActions").find(button => button.dataset.command === "ATTACK");
  assert(button && !button.disabled, "the dock has the real enabled attack confirmation");
  button.click(); assert.equal(ui.el("error").textContent, "");
}

test("real selectors show the claw's disclosed low-HP totals and refresh when the card changes, before the actual attack", () => {
  const state = fixture("beast-claw"); H(state).hp = 2;
  const { ui, commands, current } = launch(state), before = JSON.stringify(state),
    vigor = H(state).hand.find(card => card.kind === "vitality"), strength = H(state).hand.find(card => card.kind === "strength");
  select(ui, "combatSelectCard", vigor.id); select(ui, "combatSelectSlot", 1);
  assert.match(ui.el("combatSelection").innerHTML, /확정 전 공격 · 속도 3 · 피해 3/);
  assert.match(ui.el("combatSelection").innerHTML, /피해 2 \+ 무기 1 = <b>3<\/b>/);
  assert.equal(commands.length, 0); assert.equal(JSON.stringify(state), before);
  select(ui, "combatSelectCard", strength.id);
  assert.match(ui.el("combatSelection").innerHTML, /확정 전 공격 · 속도 3 · 피해 4/);
  attack(ui);
  // The existing departure guard validates on a disposable copy before the
  // actual commit. Only the committed state's command log spends the card.
  assert.equal(current().commands.length, state.commands.length + 1);
  assert.equal(commands.at(-1).cardId, strength.id); assert.equal(commands.at(-1).slot, 1);
  assert.equal(current().combat.attack.speed, 3); assert.equal(current().combat.attack.damage, 4);
});

test("changing Chikage's existing weapon-boost control immediately refreshes final stats and self-payment HP", () => {
  const state = fixture("chikage"), { ui, commands, current } = launch(state);
  select(ui, "combatSelectCard", H(state).hand.find(card => card.kind === "strength").id);
  select(ui, "combatSelectSlot", 1);
  assert.match(ui.el("combatSelection").innerHTML, /확정 전 공격 · 속도 2 · 피해 3/);
  select(ui, "weaponBoost", "damage");
  assert.match(ui.el("combatSelection").innerHTML, /확정 전 공격 · 속도 2 · 피해 4/);
  assert.match(ui.el("combatSelection").innerHTML, /자해 1.*체력 6 → <b>5<\/b>/);
  select(ui, "weaponBoost", "speed");
  assert.match(ui.el("combatSelection").innerHTML, /확정 전 공격 · 속도 3 · 피해 3/);
  select(ui, "weaponBoost", "damage"); attack(ui);
  assert.equal(current().commands.length, state.commands.length + 1); assert.equal(commands.at(-1).weaponBoost, "damage");
  assert.equal(current().combat.attack.speed, 2); assert.equal(current().combat.attack.damage, 4); assert.equal(H(current()).hp, 5);
});

test("a legally transformed Tonitrus displays one charged attack beside confirmation, matching the actual declaration", () => {
  let state = fixture("tonitrus"); state.enemies = [];
  state = E.dispatch(state, { type: "TRANSFORM", cardId: H(state).hand.find(card => card.kind === "strength").id });
  state.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(state).position, hp: 4 }];
  const { ui, current } = launch(state);
  select(ui, "combatSelectCard", H(state).hand.find(card => card.kind === "endurance").id); select(ui, "combatSelectSlot", 2);
  const preview = ui.el("combatSelection").innerHTML;
  assert.match(preview, /확정 전 공격 · 속도 2 · 피해 4/);
  assert.match(preview, /충전 1회 남음.*이번 공격에 적용 후 소모.*라운드가 끝나면 만료/);
  attack(ui); assert.equal(current().combat.attack.speed, 2); assert.equal(current().combat.attack.damage, 4);
  assert.equal(H(current()).weaponCharge, undefined);
});
