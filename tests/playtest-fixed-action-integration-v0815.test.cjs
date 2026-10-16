"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"),
  { hand } = require("./actual-combat-helper.cjs");
const H = E.hunter, key = "bloodborne-hunt-v07", jsonCopy = value => JSON.parse(JSON.stringify(value));

// Constructed, state-validated combat fixtures isolate the real app handlers.
// importSave/exportSave below deliberately use plain JSON, not canonical replay.
// These tests do not claim that these checkpoints were reached in a campaign or
// that a constructed fixture passes the production save import validator.
function fixture(id) {
  const state = E.create(123, id, id === "reiterpallasch" ? 1 : 0, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === "huntsman-mob").sideId = "a";
  state.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(state).position, hp: 4 }];
  state.loot = []; hand(state, ["strength", "skill", "vitality"]);
  state.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; state.enemyDiscard = [];
  E.assertState(state); return state;
}
function launch(state) {
  const calls = [], saved = JSON.stringify(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: saved }, realInventory: true,
    engine: { ...E, importSave: JSON.parse, exportSave: JSON.stringify,
      applyTileSpeedRuling: value => value, applyChapelRuling: value => value, applyCombatReactionRuling: value => value,
      dispatch(value, command) { calls.push(jsonCopy(command)); return E.dispatch(value, command); } },
  });
  return { ui, calls, saved };
}
function choose(ui, area, attribute, value) {
  const element = ui.el(area).querySelectorAll(`[data-${attribute}]`).find(element => element.dataset[attribute] === String(value));
  assert(element, `${area} exposes ${attribute}=${value}`); element.click();
}
function action(ui, type, accept = null) {
  return ui.buttons("decisionActions").find(button => button.dataset.command === type &&
    (accept === null || JSON.parse(button.dataset.args).accept === accept));
}
function labels(ui, type) {
  // The lightweight harness parses clickable nodes without populating their
  // child text. Check the real controller's rendered HTML for their labels.
  return [...ui.el("decisions").innerHTML.matchAll(new RegExp(`<button\\b[^>]*data-command="${type}"[^>]*>([\\s\\S]*?)<\\/button>`, "g"))]
    .map(match => match[1].replace(/<[^>]+>/g, "")).join("\n");
}

test("real rifle-entry UI identifies the face-down skill cost and inactive card effect before the exact fixed-damage dispatch", () => {
  let state = fixture("rifle-spear"); state.enemies[0].node = "tile-14:left";
  state = E.dispatch(state, { type: "END_TURN" }); assert.equal(state.phase, "weapon_entry");
  const { ui, calls, saved } = launch(state), cardId = H(state).hand.find(card => card.kind === "strength").id;
  assert.equal(action(ui, "ENTRY_WEAPON", true).disabled, true);
  choose(ui, "hand", "card", cardId);
  assert.equal(action(ui, "ENTRY_WEAPON", true).disabled, true, "the hand skill alone cannot pay an empty-slot cost");
  choose(ui, "slots", "slot", 0);
  const button = action(ui, "ENTRY_WEAPON", true), html = ui.el("combatSelection").innerHTML;
  assert(button && !button.disabled); assert.match(labels(ui, "ENTRY_WEAPON"), /선택한 기술을 뒷면으로 놓고 피해 2/);
  assert.doesNotMatch(labels(ui, "ENTRY_WEAPON"), /임무|기술을 으로/);
  assert.match(ui.el("phaseHelp").textContent, /고정 피해 2/);
  assert.match(html, /고유 행동 준비/); assert.match(html, /고정 피해 2/);
  assert.match(html, /class="combat-suppressed-effect"><span>미적용<\/span> 공격 피해 \+1/);
  assert.doesNotMatch(html, /class="combat-selected-card-effect"|적용 후 공격/);
  assert.equal(ui.storage.get(key), saved); assert.equal(calls.length, 0, "preparation never dispatches an action");
  const command = { type: "ENTRY_WEAPON", accept: true, cardId, slot: 0 }, expected = E.dispatch(state, command);
  button.click(); assert.equal(ui.el("error").textContent, "");
  const actual = JSON.parse(ui.storage.get(key));
  assert.deepEqual(actual, jsonCopy(expected)); assert(calls.every(call => JSON.stringify(call) === JSON.stringify(command)));
  assert.equal(H(actual).slots[0].faceDown, true); assert.equal(H(actual).slots[0].id, cardId);
  assert.equal(actual.enemies[0].hp, state.enemies[0].hp - 2); assert.deepEqual(actual.enemyDiscard, state.enemyDiscard);
});

test("real Reiter UI keeps ordinary attack effects separate from quicksilver fixed damage and preserves its exact costs and hidden enemy deck", () => {
  const state = fixture("reiterpallasch"), { ui, calls, saved } = launch(state),
    enemyId = state.enemies[0].id, cardId = H(state).hand.find(card => card.kind === "skill").id;
  choose(ui, "chapterMap", "enemy", enemyId);
  choose(ui, "hand", "card", cardId);
  assert.equal(action(ui, "WEAPON_SHOT").disabled, true);
  choose(ui, "slots", "slot", 0);
  assert.equal(action(ui, "WEAPON_SHOT").disabled, true, "only the quicksilver slot is eligible");
  choose(ui, "slots", "slot", 1);
  const shot = action(ui, "WEAPON_SHOT"), html = ui.el("combatSelection").innerHTML;
  assert(shot && !shot.disabled); assert.match(labels(ui, "WEAPON_SHOT"), /수은탄 사격 · 뒷면으로 놓고 피해 2/);
  assert.doesNotMatch(labels(ui, "WEAPON_SHOT"), /임무|· 으로/);
  assert.match(html, /공격 준비/); assert.match(html, /카드 효과<\/strong> 방해/);
  assert.match(html, /수은탄 사격.*일반 공격과 별도/); assert.match(html, /고정 피해 2/);
  assert.match(html, /필요: 손패 기술 1개 · 2번 빈 슬롯/);
  assert.match(html, /카드·슬롯의 공격 수치와 부착 강화, 룬·소모품의 공격 보정은 이 고정 피해에 더하지 않습니다/);
  assert(action(ui, "ATTACK") && !action(ui, "ATTACK").disabled, "the ordinary stat attack remains a separate available command");
  assert.equal(ui.storage.get(key), saved); assert.equal(calls.length, 0);
  const command = { type: "WEAPON_SHOT", cardId, slot: 1, enemyId }, expected = E.dispatch(state, command);
  shot.click(); assert.equal(ui.el("error").textContent, "");
  const actual = JSON.parse(ui.storage.get(key));
  assert.deepEqual(actual, jsonCopy(expected)); assert(calls.every(call => JSON.stringify(call) === JSON.stringify(command)));
  assert.equal(H(actual).hand.length, H(state).hand.length - 1); assert.equal(H(actual).slots[1].faceDown, true);
  assert.equal(actual.enemies[0].hp, 2); assert.equal(actual.combat, null);
  assert.deepEqual(actual.enemyDeck, state.enemyDeck); assert.deepEqual(actual.enemyDiscard, state.enemyDiscard);
});
