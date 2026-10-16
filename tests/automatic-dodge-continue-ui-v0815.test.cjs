"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), R = require("../src/rewards-engine");
const { fixture, bossAction, attack } = require("./actual-combat-helper.cjs");
const { boot } = require("./helpers/ui-harness.cjs");
const go = (state, type, args = {}) => E.dispatch(state, { type, ...args });
const key = "bloodborne-hunt-v07";

function bossReaction(action = "leap-slam") {
  // Focused component fixture: real boss decks, attack definitions and reducer,
  // not a claimed complete campaign replay. No public action is mocked.
  let state = fixture("cleric-beast", action === "dash-sweep" ? 1 : 2,
    ["strength", "endurance", "endurance"], { rulesVersion: 14 });
  const rewardId = R.grant(state, "old-hunter-bone");
  E.assertState(state);
  state = attack(bossAction(state, action), 1);
  assert.equal(state.phase, action === "leap-slam" ? "boss_react" : "combat_react");
  return { state, rewardId };
}

function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: JSON.stringify(state) },
    engine: { ...E, applyTileSpeedRuling: state => state,
      importSave: text => { const parsed = JSON.parse(text); E.assertState(parsed); return parsed; },
      exportSave: state => JSON.stringify(state) },
  });
  assert.equal(ui.el("error").textContent, ""); return ui;
}
function current(ui) { const state = JSON.parse(ui.storage.get(key)); E.assertState(state); return state; }
function commandButton(ui, type, predicate = () => true) {
  return ui.document.querySelectorAll("[data-command]").find(button =>
    button.dataset.command === type && !button.disabled && predicate(JSON.parse(button.dataset.args || "{}")));
}
function click(ui, type, predicate) {
  const button = commandButton(ui, type, predicate); assert(button, `UI offers ${type}`); button.click();
  assert.equal(ui.el("error").textContent, "");
}
function actionLabel(ui, type) {
  // The lightweight harness binds real button nodes but leaves initial HTML
  // text in the source container. Inspect that generated label, not an empty
  // Element.textContent placeholder.
  const match = ui.el("decisions").innerHTML.match(new RegExp(`<button\\b[^>]*data-command="${type}"[^>]*>([\\s\\S]*?)<\\/button>`));
  assert(match, `decision HTML includes ${type}`); return match[1].replace(/<[^>]+>/g, "");
}

test("automatic leap-slam dodge labels continuing as an avoided effect and preserves HP before its separate next card", () => {
  const { state, rewardId } = bossReaction(), ui = launch(state);
  assert.match(actionLabel(ui, "RESOLVE"), /피해 2와 효과를 받고 계속/);
  const hand = structuredClone(E.hunter(state).hand), slots = structuredClone(E.hunter(state).slots);
  click(ui, "USE_REWARD", args => args.rewardId === rewardId);
  const avoided = current(ui), expectedAvoided = go(state, "USE_REWARD", { rewardId });
  assert.deepEqual(avoided, expectedAvoided); assert.equal(avoided.phase, "boss_react");
  assert.equal(avoided.combat.dodged, true); assert.equal(E.hunter(avoided).hp, 6);
  assert.deepEqual(E.hunter(avoided).hand, hand); assert.deepEqual(E.hunter(avoided).slots, slots);
  assert.equal(E.hunter(avoided).rewards.find(reward => reward.id === rewardId).ready, false);
  assert(commandButton(ui, "RESOLVE"));
  assert.match(actionLabel(ui, "RESOLVE"), /회피.*계속/); assert.doesNotMatch(actionLabel(ui, "RESOLVE"), /피해.*받|효과.*받/);
  assert.equal(ui.el("phaseHelp").textContent, "", "the selected dodge is shown on its button rather than a repeated instruction");
  assert.equal(actionLabel(ui, "DODGE"), "회피 선택됨");
  assert.equal(commandButton(ui, "USE_REWARD", args => args.rewardId === rewardId), undefined);
  click(ui, "RESOLVE");
  const following = current(ui);
  assert.deepEqual(following, go(expectedAvoided, "RESOLVE"));
  assert.equal(E.hunter(following).hp, 6); assert.equal(following.phase, "combat_react");
  assert.equal(following.combat.action.id, "slam"); assert.equal(following.combat.dodged, false);
  assert.deepEqual(E.hunter(following).hand, hand, "avoided stun does not discard another card");
  assert.equal(E.hunter(following).status.poison, false);
  assert.equal(following.commands.length, state.commands.length + 2);
  assert.equal(actionLabel(ui, "RESOLVE"), "전투 처리");
});

test("accepting an unavoided leap-slam still shows and applies its real two damage and stun", () => {
  const { state } = bossReaction(), ui = launch(state);
  assert(commandButton(ui, "RESOLVE"));
  assert.match(actionLabel(ui, "RESOLVE"), /피해 2와 효과를 받고 계속/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /회피가 적용되었습니다/);
  click(ui, "RESOLVE");
  const next = current(ui); assert.deepEqual(next, go(state, "RESOLVE"));
  assert.equal(E.hunter(next).hp, 4); assert.equal(next.phase, "stun");
  assert.equal(next.enemies[0].bossDecks[1].discard.length, 1, "next card waits for stun handling");
});

test("undodgeable boss attacks keep automatic-dodge equipment unavailable and cannot spend it", () => {
  const { state, rewardId } = bossReaction("dash-sweep"), before = JSON.stringify(state), ui = launch(state);
  const reward = E.rewardsView(state).rewards.find(reward => reward.id === rewardId);
  assert.equal(state.combat.action.undodgeable, true); assert.equal(reward.ready, true); assert.equal(reward.usable, false);
  assert.equal(commandButton(ui, "USE_REWARD", args => args.rewardId === rewardId), undefined);
  const displayed = ui.buttons("rewards").filter(button => button.dataset.command === "USE_REWARD" &&
    JSON.parse(button.dataset.args || "{}").rewardId === rewardId);
  assert(displayed.length); assert(displayed.every(button => button.disabled));
  for (const button of displayed) button.click();
  assert.equal(ui.storage.get(key), before); assert.throws(() => go(state, "USE_REWARD", { rewardId }), /회피/);
  assert.equal(JSON.stringify(state), before);
});

test("speed-based partial defense is not mislabeled as a complete dodge and keeps automatic dodge unavailable", () => {
  let state;
  for (let seed = 1; seed <= 200; seed++) {
    const candidate = E.create(seed, "burial", 0, null, "hunter-pistol", "center", {
      campaign: false, rulesVersion: 14, practiceTarget: "church-servant", practiceSide: "b",
      practiceRewards: ["old-hunter-bone"] });
    if (candidate.enemyDeck[0] === "ability" && E.hunter(candidate).hand.some(card => card.kind === "endurance")) {
      state = candidate; break;
    }
  }
  assert(state, "natural practice seed exposes arcane barrage with an endurance card");
  state = go(state, "END_TURN");
  if (state.phase === "activation") state = go(state, "ACTIVATE", { enemyId: state.enemies[0].id });
  state = go(state, "NO_ATTACK");
  assert.equal(state.phase, "boss_react"); assert.equal(state.combat.immediate.dodgeBlockPerSpeed, 2);
  const endurance = E.hunter(state).hand.find(card => card.kind === "endurance");
  state = go(state, "DODGE", { cardId: endurance.id, slot: 1 });
  assert.equal(state.combat.dodged, true); assert.equal(state.combat.immediate.dodgeBlock, 4);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
  const reward = E.rewardsView(state).rewards.find(reward => reward.kind === "old-hunter-bone");
  assert(reward && reward.ready); assert.equal(reward.usable, false);
  const ui = launch(state); assert(commandButton(ui, "RESOLVE"));
  assert.match(ui.el("phaseHelp").textContent, /회피 속도마다 2피해를 방어/);
  assert.doesNotMatch(actionLabel(ui, "RESOLVE"), /회피 적용 후 계속/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /피해와 부가효과를 받지 않습니다/);
  assert.equal(commandButton(ui, "USE_REWARD", args => args.rewardId === reward.id), undefined);
  click(ui, "RESOLVE");
  const next = current(ui); assert.deepEqual(next, go(state, "RESOLVE"));
  assert.equal(E.hunter(next).hp, 5, "five printed damage minus four defense leaves one damage");
  assert.equal(E.hunter(next).rewards.find(item => item.id === reward.id).ready, true);
});
