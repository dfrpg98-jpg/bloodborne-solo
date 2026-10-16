"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"),
  { fixture, bossAction, hand, enemyAction } = require("./actual-combat-helper.cjs");
const H = E.hunter, key = "bloodborne-hunt-v07";

// These independently constructed, supply-valid checkpoints exercise the
// adopted project ruling. They are not strict-importable campaign replays or
// evidence that a new normal campaign was played. Card/component definitions
// are unchanged; every transition after construction uses the real reducer.
function launch(state) {
  E.assertState(state);
  const saved = JSON.stringify(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    realInventory: true, storage: { [key]: saved }, engine: {
      ...E, importSave: JSON.parse, exportSave: JSON.stringify,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value,
      applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
    },
  });
  assert.equal(ui.el("error").textContent, "");
  assert.equal(ui.storage.get(key), saved, "rendering cannot write the constructed save");
  assert.equal(JSON.stringify(state), saved, "rendering cannot mutate its input");
  return ui;
}
function select(ui, id, value) {
  const element = ui.el(id); assert(element, id); element.value = String(value); element.fire("change");
  assert.equal(ui.el("error").textContent, "");
}
function commit(ui, type) {
  const before = JSON.parse(ui.storage.get(key)), button = ui.document.querySelectorAll("[data-command]")
    .find(element => element.dataset.command === type && !element.disabled);
  assert(button, "actual UI offers enabled " + type);
  const command = { type, ...JSON.parse(button.dataset.args || "{}") };
  button.click(); assert.equal(ui.el("error").textContent, "");
  const actual = JSON.parse(ui.storage.get(key));
  assert.deepEqual(actual, E.dispatch(before, command), "actual UI commits the displayed command through the real reducer");
  assert.equal(actual.commands.length, before.commands.length + 1); E.assertState(actual);
  return { state: actual, command };
}
function declare(state, useMist = true) {
  return E.dispatch(state, { type: "ATTACK", enemyId: state.enemies[0].id,
    cardId: H(state).hand.find(card => card.kind === "strength").id, slot: 0,
    itemIds: useMist ? [H(state).consumables.find(item => item.kind === "numbing-mist").id] : [] });
}
function assertPaidOnce(state, itemId) {
  assert(!H(state).consumables.some(item => item.id === itemId));
  assert.equal(state.consumableDiscard.filter(item => item.id === itemId).length, 1);
}
function assertRemovedUI(ui) {
  const html = ui.el("combatInfo").innerHTML;
  assert.match(html, /적 공격의 모든 부가 효과 제거됨/);
  assert.doesNotMatch(html, /마비 안개 · 전용 능력에는 미적용/);
}
function ordinary(kind, side, sequence) {
  const state = E.create(123, "burial", 0, "numbing-mist", "hunter-pistol", "center",
    { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === kind).sideId = side;
  state.enemies = [{ id: kind + "-1", kind, figure: 1, node: H(state).position,
    hp: E.data.enemies[kind].health }];
  state.loot = []; hand(state, ["strength", "endurance", "vitality"]); enemyAction(state, ...sequence);
  E.assertState(state); return state;
}

test("mist leaves the Cleric Beast leap ability intact, then strips its next attack after the real immediate-dodge controls", () => {
  let before = fixture("cleric-beast", 2, ["strength", "endurance", "vitality"],
    { item: "numbing-mist", rulesVersion: 14 });
  before = bossAction(bossAction(before, "grab-throw"), "leap-slam"); E.assertState(before);
  const original = JSON.stringify(before), itemId = H(before).consumables[0].id,
    state = declare(before), dodgeId = H(state).hand.find(card => card.kind === "endurance").id;
  E.assertState(state); assert.equal(JSON.stringify(before), original);
  assert.equal(state.phase, "boss_react"); assert.equal(state.combat.action.type, "ability");
  assert.equal(state.combat.action.code, "cleric-leap");
  assert.equal(state.combat.action.damage, 2); assert.equal(state.combat.action.stun, true);
  assert.deepEqual(state.combat.immediate, { name: "뛰어 내려찍기", damage: 2, dodgeSpeed: 1, stun: true, revealNext: true });
  assert.equal(state.combat.removeEnemyAttackEffects, true); assertPaidOnce(state, itemId);
  const ui = launch(state), html = ui.el("combatInfo").innerHTML;
  assert.match(html, /마비 안개 · 전용 능력에는 미적용/); assert.match(html, /기절/);
  assert.match(html, /피해 <b>2<\/b>/); assert.doesNotMatch(html, /적 공격의 모든 부가 효과 제거됨/);
  const saved = ui.storage.get(key);
  select(ui, "combatSelectCard", dodgeId); select(ui, "combatSelectSlot", 1);
  assert.equal(ui.storage.get(key), saved, "selecting a dodge is not a game command");
  const dodged = commit(ui, "DODGE");
  assert.deepEqual(dodged.command, { type: "DODGE", cardId: dodgeId, slot: 1 });
  assert.equal(dodged.state.phase, "boss_react"); assert.equal(dodged.state.combat.dodged, true);
  assert.equal(dodged.state.combat.immediate.damage, 2); assert.equal(dodged.state.combat.immediate.stun, true);
  assertPaidOnce(dodged.state, itemId);
  const revealed = commit(ui, "RESOLVE").state;
  assert.equal(revealed.phase, "combat_react"); assert.equal(revealed.combat.action.id, "grab-throw");
  assert.equal(revealed.combat.action.type, "attack");
  assert.equal(revealed.combat.action.speed, 3); assert.equal(revealed.combat.action.damage, 3);
  for (const effect of ["interrupt", "stun", "forceHunterMove", "bossInsight", "bossInsightReduction"])
    assert.equal(revealed.combat.action[effect], false, effect);
  assert.equal(H(revealed).hp, 6); assert.equal(revealed.combat.dodged, false, "the ability dodge is not a free dodge of the new attack");
  assertRemovedUI(ui); assertPaidOnce(revealed, itemId);
  const resolved = commit(ui, "RESOLVE").state;
  assert.equal(resolved.phase, "hunter"); assert.equal(H(resolved).hp, 3);
  assert.equal(resolved.enemies[0].hp, 6); assert.equal(H(resolved).position, H(before).position);
  assert.equal(resolved.cardChoices.length, 0, "the removed stun cannot request a discard");
  assertPaidOnce(resolved, itemId);
});

test("the mob ability's speed and damage bonuses survive mist while its next attack loses interrupt and stun; a separate combat keeps its effects", () => {
  const before = ordinary("huntsman-mob", "a", ["ability", "special", "special"]),
    original = JSON.stringify(before), itemId = H(before).consumables[0].id,
    untreated = declare(before, false), state = declare(before);
  E.assertState(state); assert.equal(JSON.stringify(before), original);
  assert.equal(untreated.combat.action.interrupt, true); assert.equal(untreated.combat.action.stun, true);
  assert.equal(state.phase, "combat_react");
  assert.deepEqual(state.combat.history.map(entry => entry.kind), ["ability", "special"]);
  assert.deepEqual(state.combat.buff, { speed: 1, damage: 1, interrupt: false });
  assert.equal(state.combat.action.speed, 3); assert.equal(state.combat.action.damage, 3);
  assert.equal(state.combat.action.speed, untreated.combat.action.speed);
  assert.equal(state.combat.action.damage, untreated.combat.action.damage);
  assert.equal(state.combat.action.interrupt, false); assert.equal(state.combat.action.stun, false);
  assertPaidOnce(state, itemId);
  const ui = launch(state); assertRemovedUI(ui);
  assert.match(ui.el("combatInfo").innerHTML, /속도 <b>3<\/b>/);
  assert.match(ui.el("combatInfo").innerHTML, /피해 <b>3<\/b>/);
  const resolved = commit(ui, "RESOLVE").state;
  assert.equal(resolved.phase, "hunter"); assert.equal(H(resolved).hp, 3); assert.equal(resolved.enemies[0].hp, 2);
  assertPaidOnce(resolved, itemId);
  const saved = ui.storage.get(key), target = ui.el("chapterMap").querySelectorAll("[data-enemy]")
    .find(element => element.dataset.enemy === resolved.enemies[0].id);
  assert(target); target.click();
  const cardId = H(resolved).hand.find(card => card.kind === "vitality").id;
  select(ui, "combatSelectCard", cardId); select(ui, "combatSelectSlot", 1);
  assert.equal(ui.storage.get(key), saved, "target/card/slot selection cannot consume another mist");
  const next = commit(ui, "ATTACK");
  assert.equal(next.command.enemyId, resolved.enemies[0].id); assert.equal(next.command.cardId, cardId);
  assert.deepEqual(next.command.itemIds, []); assert.equal(next.state.phase, "combat_react");
  assert.equal(next.state.combat.removeEnemyAttackEffects, false);
  assert.deepEqual(next.state.combat.buff, { speed: 0, damage: 0, interrupt: false });
  assert.equal(next.state.combat.action.speed, 2); assert.equal(next.state.combat.action.damage, 2);
  assert.equal(next.state.combat.action.interrupt, true); assert.equal(next.state.combat.action.stun, true);
  assert.doesNotMatch(ui.el("combatInfo").innerHTML, /적 공격의 모든 부가 효과 제거됨|마비 안개 · 전용 능력에는 미적용/);
  assert.match(ui.el("combatInfo").innerHTML, /기절/); assertPaidOnce(next.state, itemId);
});

test("the scourge ability's damage bonus remains but its granted interrupt is stripped from the revealed attack", () => {
  const before = ordinary("scourge-beast", "b", ["ability", "basic", "special"]),
    original = JSON.stringify(before), itemId = H(before).consumables[0].id,
    untreated = declare(before, false), state = declare(before);
  E.assertState(state); assert.equal(JSON.stringify(before), original);
  assert.equal(untreated.combat.action.interrupt, true);
  assert.deepEqual(state.combat.history.map(entry => entry.kind), ["ability", "basic"]);
  assert.deepEqual(state.combat.buff, { speed: 0, damage: 1, interrupt: true });
  assert.equal(state.combat.action.type, "attack"); assert.equal(state.combat.action.kind, "basic");
  assert.equal(state.combat.action.speed, 3); assert.equal(state.combat.action.damage, 3);
  assert.equal(state.combat.action.speed, untreated.combat.action.speed);
  assert.equal(state.combat.action.damage, untreated.combat.action.damage);
  assert.equal(state.combat.action.interrupt, false, "mist strips even a keyword granted by the preceding ability");
  assertPaidOnce(state, itemId);
  const ui = launch(state); assertRemovedUI(ui);
  const resolved = commit(ui, "RESOLVE").state;
  assert.equal(resolved.phase, "hunter"); assert.equal(H(resolved).hp, 3); assert.equal(resolved.enemies[0].hp, 2);
  assertPaidOnce(resolved, itemId);
});
