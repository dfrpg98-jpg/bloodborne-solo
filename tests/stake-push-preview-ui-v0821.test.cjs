"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), R = require("../rewards-engine"), P = require("../hunt-attack-preview");
const { hand } = require("./actual-combat-helper.cjs"), { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, go = (state, type, args = {}) => E.dispatch(state, { type, ...args });

// Supply-valid component arrangements control the visible enemy position and
// first basic action. They are not canonical imports or fresh campaign runs.
// Every tested attack, dodge and follow-up uses the production reducer.
function fixture(weapon = "stake-driver", face = 1, enemies = 1) {
  const state = E.create(811, weapon, face, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  H(state).position = "tile-14:left";
  state.world.assignments.find(assignment => assignment.enemyId === "huntsmans-minion").sideId = "a";
  state.enemies = Array.from({ length: enemies }, (_, index) => ({ id: `huntsmans-minion-${index + 1}`,
    kind: "huntsmans-minion", figure: index + 1, node: H(state).position, hp: 5 }));
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
  return { ui, commands, current: () => current };
}
function select(ui, id, value) {
  const control = ui.el(id); assert(control, id); control.value = String(value); control.fire("change");
}
function click(ui, type, matches = () => true) {
  const buttons = [...ui.buttons("decisionActions"), ...ui.buttons("decisions")],
    button = buttons.find(button => button.dataset.command === type && !button.disabled &&
      matches(JSON.parse(button.dataset.args || "{}")));
  assert(button, `enabled ${type} button`); button.click(); assert.equal(ui.el("error").textContent, "");
}
function prepare(ui, state, kind, slot = 0) {
  const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]")
    .find(button => button.dataset.enemy === state.enemies[0].id);
  assert(marker); marker.click();
  select(ui, "combatSelectCard", H(state).hand.find(card => card.kind === kind).id);
  select(ui, "combatSelectSlot", slot);
}

test("the real Stake Driver attack shows movement choices, then decrements remaining push distance through its handlers", () => {
  const state = fixture(), { ui, current } = launch(state);
  prepare(ui, state, "endurance"); click(ui, "ATTACK");
  assert.equal(current().phase, "combat_react");
  click(ui, "RESOLVE");
  assert.equal(current().phase, "weapon_choice");
  assert.equal(current().enemies[0].hp, 1, "the four-damage attack leaves the five-HP enemy alive to push");
  assert.equal(current().weaponEffects[0].kind, "push");
  assert.equal(current().weaponEffects[0].remaining, 2);
  assert.match(ui.el("phaseHelp").textContent, /이동 선택지 2개 · 남은 이동 최대 2칸/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /선택할 대상/);
  const originalHunter = H(current()).position, originalHand = H(current()).hand.map(card => card.id);
  click(ui, "WEAPON_CHOICE", args => args.node === "tile-14:center");
  assert.equal(current().phase, "weapon_choice");
  assert.equal(current().enemies[0].node, "tile-14:center");
  assert.equal(current().weaponEffects[0].remaining, 1);
  assert.match(ui.el("phaseHelp").textContent, /이동 선택지 2개 · 남은 이동 최대 1칸/);
  click(ui, "WEAPON_CHOICE", args => args.node === "tile-14:right");
  assert.equal(current().enemies[0].node, "tile-14:right");
  assert.notEqual(current().phase, "weapon_choice");
  assert.equal(H(current()).position, originalHunter);
  assert.deepEqual(H(current()).hand.map(card => card.id), originalHand, "pushing spends no additional card");
  E.assertState(current());
});

test("a genuine Chikage dodge damage choice keeps target wording and damages only the chosen enemy", () => {
  let state = fixture("chikage", 1, 2);
  state = go(state, "END_TURN");
  assert.equal(state.phase, "activation");
  state = go(state, "ACTIVATE", { enemyId: "huntsmans-minion-1" });
  state = go(state, "NO_ATTACK");
  state = go(state, "DODGE", { cardId: H(state).hand.find(card => card.kind === "endurance").id, slot: 0 });
  assert.equal(state.phase, "weapon_choice"); assert.equal(state.weaponEffects[0].kind, "damage");
  const { ui, current } = launch(state);
  assert.match(ui.el("phaseHelp").textContent, /선택할 대상 2개/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /이동 선택지|남은 이동 최대|피해 배분/);
  click(ui, "WEAPON_CHOICE", args => args.enemyId === "huntsmans-minion-2");
  assert.equal(current().enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 5);
  assert.equal(current().enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 4);
  assert.equal(current().phase, "combat_react"); E.assertState(current());
});

function previewAndDeclare(state, kind, extras = {}) {
  const selection = { kind: "ATTACK", enemyId: state.enemies[0].id,
    cardId: H(state).hand.find(card => card.kind === kind).id, slot: 0, ...extras },
    original = JSON.stringify(state), preview = P.view(state, E, selection);
  assert(preview.ready); assert.equal(JSON.stringify(state), original, "preview cannot spend or place the card");
  const after = go(state, "ATTACK", selection); E.assertState(after);
  return { preview, after, html: P.renderHTML(preview) };
}
test("filling the Stake Driver's sole slot warns about normal dodge capacity without claiming all dodge effects are forbidden", () => {
  const { preview, after, html } = previewAndDeclare(fixture(), "strength");
  assert(preview.warnings.some(warning => /빈 회피 슬롯 없음/.test(warning)));
  assert.match(html, /카드 배치 후 빈 회피 슬롯 없음/);
  assert.match(html, /자동 회피 등 별도 효과는 사용 가능 조건을 확인하세요/);
  assert.equal(H(after).slots.length, 1); assert.equal(H(after).slots[0].kind, "strength");
});
test("a clear-slot card leaves the single slot empty and produces no empty-dodge-slot warning", () => {
  const { preview, after, html } = previewAndDeclare(fixture(), "endurance");
  assert(!preview.warnings.some(warning => /빈 회피 슬롯 없음/.test(warning)));
  assert.doesNotMatch(html, /빈 회피 슬롯 없음/); assert.equal(H(after).slots[0], null);
});
test("Clawmark replacing a clear-slot card restores the sole-slot warning and matches the occupied real slot", () => {
  let state = fixture(); const rewardId = R.grant(state, "rune-clawmark");
  if (state.rewardChoices.some(choice => choice.rewardId === rewardId))
    state = go(state, "EQUIP_REWARD", { rewardId, slot: 0 });
  const { preview, after, html } = previewAndDeclare(state, "endurance", { rewardIds: [rewardId] });
  assert.equal(preview.suppressedCardEffects, true); assert.match(html, /빈 회피 슬롯 없음/);
  assert.equal(H(after).slots[0].kind, "endurance");
  assert.equal(H(after).rewards.find(reward => reward.id === rewardId).ready, false);
});
test("an attack leaving other weapon slots empty does not produce the capacity warning", () => {
  const { preview, after, html } = previewAndDeclare(fixture("stake-driver", 0), "strength");
  assert(!preview.warnings.some(warning => /빈 회피 슬롯 없음/.test(warning)));
  assert.doesNotMatch(html, /빈 회피 슬롯 없음/);
  assert.equal(H(after).slots[0].kind, "strength"); assert(H(after).slots.slice(1).every(slot => slot === null));
});
