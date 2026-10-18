"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), C = require("../src/hunt-context"), Menu = require("../src/hunt-action-menu");
const Auto = require("../src/hunt-automatic-combat"), { boot } = require("./helpers/ui-harness.cjs");
const { clickCommand } = require("./helpers/public-command-ui.cjs");
const key = "bloodborne-hunt-v07", plain = value => JSON.parse(JSON.stringify(value));
const fresh = (target = false) => E.create(90, "burial", 0, null, "hunter-pistol", "center", target
  ? { campaign: false, practiceTarget: "male-beast-patient", practiceSide: "b" }
  : { campaign: true });
function launch(state, options = {}) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    realInventory: !!options.realInventory,
    storage: { [key]: E.exportSave(state) },
    engine: { ...E, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
    window: { BBHuntActionMenu: Menu, BBHuntAutomaticCombat: Auto },
  });
}
const saved = ui => E.importSave(ui.storage.get(key));
const intent = (ui, type) => ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
  .find(button => button.dataset.hunterIntent === type);
const cardButton = (ui, id) => ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === id);
const slotButton = (ui, slot) => ui.el("slots").querySelectorAll("[data-slot]").find(button => +button.dataset.slot === slot);
function selectEnemy(ui, id) {
  const button = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === id);
  assert(button, "a public map enemy is selectable"); button.click();
}

test("four persistent actions allow intent before paying a card and require an explicit eligible enemy for attack", () => {
  const state = fresh(true), original = E.exportSave(state), enemyId = state.enemies[0].id;
  const initial = Menu.view(state, E, C);
  assert.deepEqual(initial.actions.map(action => action.type), ["MOVE", "DREAM", "TRANSFORM", "ATTACK"]);
  assert(initial.actions.filter(action => action.type !== "ATTACK").every(action => action.enabled));
  assert.equal(initial.actions.find(action => action.type === "ATTACK").enabled, false);
  assert.equal(Menu.view(state, E, C, { enemyId }).actions.find(action => action.type === "ATTACK").enabled, true);
  assert.equal(Menu.view(state, E, C, { enemyId: "not-an-enemy" }).actions.find(action => action.type === "ATTACK").enabled, false);
  const distant = structuredClone(state); distant.enemies[0].node = "tile-14:left";
  assert.equal(Menu.view(distant, E, C, { enemyId }).actions.find(action => action.type === "ATTACK").enabled, false);
  const locked = { ...state, phase: "combat_choose" };
  assert(Menu.view(locked, E, C, { enemyId }).actions.every(action => !action.enabled));
  assert.equal(E.exportSave(state), original, "view preflight never mutates the real hunt or command history");
});

test("no card leaves commit disabled, while attack defaults to the first empty slot and respects a chosen usable slot", () => {
  const state = fresh(true), cardId = E.hunter(state).hand[0].id, enemyId = state.enemies[0].id;
  for (const type of ["MOVE", "DREAM", "TRANSFORM", "ATTACK"]) {
    const model = Menu.view(state, E, C, { type, enemyId });
    assert.equal(model.enabled, false); assert.equal(model.command, null);
    assert.match(model.reason, /소모할 패/);
  }
  assert.equal(Menu.view(state, E, C, { type: "ATTACK", enemyId, cardId }).command.slot, 0);
  assert.equal(Menu.view(state, E, C, { type: "ATTACK", enemyId, cardId, slot: 2 }).command.slot, 2);
  const occupied = structuredClone(state), placed = E.hunter(occupied).hand.shift(); E.hunter(occupied).slots[0] = placed;
  assert.equal(Menu.view(occupied, E, C, { type: "ATTACK", enemyId, cardId: E.hunter(occupied).hand[0].id, slot: 0 }).command.slot, 1);
});

test("actual controller begins and cancels each intent without saving, spending, or changing the prior hand and slot selection", () => {
  for (const type of ["MOVE", "DREAM", "TRANSFORM", "ATTACK"]) {
    const state = fresh(true), ui = launch(state), cardId = E.hunter(state).hand[1].id;
    selectEnemy(ui, state.enemies[0].id); cardButton(ui, cardId).click(); slotButton(ui, 2).click();
    const before = ui.storage.get(key);
    assert(intent(ui, type) && !intent(ui, type).disabled); intent(ui, type).click();
    assert.equal(ui.el("phaseTitle").textContent, "행동하기");
    assert.equal(ui.el("phaseHelp").textContent, "행동하기 위해 소모할 패를 선택해주세요");
    assert.equal(ui.el("confirmHunterAction").disabled, true);
    assert.equal(ui.storage.get(key), before);
    assert(ui.el("hand").querySelectorAll("[data-card]").every(button => button.getAttribute("aria-pressed") === "false"));
    cardButton(ui, E.hunter(state).hand[0].id).click();
    assert.equal(ui.el("confirmHunterAction").disabled, false);
    assert.equal(ui.storage.get(key), before);
    ui.el("cancelHunterAction").click();
    assert.equal(ui.el("phaseTitle").textContent, "플레이어의 차례");
    assert.equal(cardButton(ui, cardId).getAttribute("aria-pressed"), "true");
    assert.equal(slotButton(ui, 2).getAttribute("aria-pressed"), "true");
    assert.equal(intent(ui, "ATTACK").disabled, false);
    assert.equal(ui.storage.get(key), before);
  }
});

test("actual controller commits MOVE, TRANSFORM, DREAM and ATTACK once with the canonical engine result", () => {
  for (const type of ["MOVE", "TRANSFORM", "DREAM", "ATTACK"]) {
    const state = fresh(type === "ATTACK"), ui = launch(state), cardId = E.hunter(state).hand[0].id;
    if (type === "ATTACK") selectEnemy(ui, state.enemies[0].id);
    assert.equal(ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]").length, 4);
    intent(ui, type).click(); cardButton(ui, cardId).click();
    if (type === "ATTACK") {
      assert.equal(slotButton(ui, 0).getAttribute("aria-pressed"), "true", "attack starts with the first empty slot");
      slotButton(ui, 0).click();
      assert.equal(slotButton(ui, 0).getAttribute("aria-pressed"), "true", "repeated click retains the slot used by the visible preview and command");
      slotButton(ui, 2).click();
    }
    const confirm = ui.el("confirmHunterAction"); assert.equal(confirm.disabled, false);
    assert.equal(confirm.dataset.command, type);
    const command = { type: confirm.dataset.command, ...JSON.parse(confirm.dataset.args) };
    confirm.click();
    assert.equal(ui.el("error").textContent, "");
    assert.deepEqual(saved(ui), E.dispatch(state, plain(command)));
    assert.equal(saved(ui).commands.length, state.commands.length + 1);
    assert.equal(saved(ui).commands.at(-1).cardId, cardId);
    if (type === "ATTACK") assert.equal(saved(ui).commands.at(-1).slot, 2);
  }
});

test("public command replay helper uses the staged action instead of bypassing its confirmation", () => {
  for (const type of ["MOVE", "TRANSFORM", "DREAM", "ATTACK"]) {
    const state = fresh(type === "ATTACK"), command = { type, cardId: E.hunter(state).hand[0].id,
      ...(type === "ATTACK" ? { enemyId: state.enemies[0].id, slot: 1 } : {}) };
    const after = clickCommand(state, command);
    const functional = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
    assert.deepEqual(functional(after), functional(E.dispatch(state, command)));
    assert.equal(after.commands.length, 1); assert.equal(after.commands[0].type, type);
  }
});

test("eligible selected enemies offer this-enemy attack without repeating a hand-and-slot cost line", () => {
  const state = fresh(true), ui = launch(state);
  selectEnemy(ui, state.enemies[0].id);
  assert.equal(intent(ui, "ATTACK").disabled, false);
  assert.match(ui.el("hunterActionBar").textContent, /선택한 적:/);
  assert.match(ui.el("mapContext").textContent, /이 적 공격하기/);
  const attackHTML = ui.el("mapContext").innerHTML.match(/<button\b[^>]*(?:data-context-id="attack"|data-hunter-intent="ATTACK")[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert(attackHTML, "the selected enemy has an attack entry");
  assert.doesNotMatch(attackHTML, /스탯 카드|손패|빈 공격 슬롯/);
});

test("canceling an action restores the previous attack-consumable selection without spending it", () => {
  const state = E.create(90, "burial", 0, "fire-paper", "hunter-pistol", "center", {
    campaign: false, practiceTarget: "male-beast-patient", practiceSide: "b",
  }), ui = launch(state, { realInventory: true }), item = E.hunter(state).consumables[0];
  selectEnemy(ui, state.enemies[0].id);
  ui.el("inventory").querySelectorAll("[data-item]").find(button => button.dataset.item === item.id).click();
  ui.el("toggleAttackItem").click(); assert.match(ui.el("inventory").innerHTML, /✓ 이번 공격에 사용/);
  const before = ui.storage.get(key);
  intent(ui, "ATTACK").click();
  ui.el("toggleAttackItem").click(); assert.doesNotMatch(ui.el("inventory").innerHTML, /✓ 이번 공격에 사용/);
  ui.el("cancelHunterAction").click();
  assert.match(ui.el("inventory").innerHTML, /✓ 이번 공격에 사용/);
  assert.equal(ui.storage.get(key), before); assert.equal(saved(ui).hunters[state.activeHunterId].consumables[0].id, item.id);
});
