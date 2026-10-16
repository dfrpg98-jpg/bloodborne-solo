"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), R = require("../src/rewards-engine"), P = require("../src/hunt-public-text"),
  { boot } = require("./helpers/ui-harness.cjs");

for (const kind of ["rune-rapture", "arianna-blood", "rune-radiance"]) {
  test(`${kind}: its actual hand-draw rule remains a skill draw when displayed outside the skill panel`, () => {
    const original = R.definitions[kind].rules;
    for (const context of ["skill", "reward", "equipment", "item", "mission"]) {
      const text = P.clean(original, context);
      assert.match(text, kind === "rune-radiance" ? /기술을 뽑습니다/ : /기술 1개를 뽑습니다/);
      assert.doesNotMatch(text, /(?:장비|임무|소모품)(?:을|를)?\s*(?:1개를)?\s*뽑/);
      assert.equal(P.clean(text, context), text, "rendering a normalized description again must not change its meaning");
    }
    assert.equal(R.definitions[kind].rules, original, "the supplied source text stays intact");
  });
}

test("explicit consumable, equipment and enemy-action card draws do not become a hand skill draw", () => {
  for (const context of ["reward", "equipment", "item", "mission"]) for (const text of [
    "소모품 카드 1장을 뽑습니다.", "보상 카드 1장을 뽑습니다.", "장비 카드 1장을 뽑습니다.",
    "화기 카드 1장을 뽑습니다.", "장치무기 카드 1장을 뽑습니다.", "계몽 카드 1장을 뽑습니다.",
    "적 행동 카드 1장을 뽑습니다.", "소모품 덱에서 카드 1장을 뽑습니다."
  ]) {
    const cleaned = P.clean(text, context);
    assert.doesNotMatch(cleaned, /기술/, `${context}: ${text}`);
    assert.equal(P.clean(cleaned, context), cleaned);
  }
});

test("only direct otherwise unqualified draw phrases change, preserving quantities and unrelated card uses", () => {
  for (const [text, expected] of [
    ["카드 2장을 뽑습니다.", "기술 2개를 뽑습니다."],
    ["카드를 2장 뽑습니다.", "기술 2개를 뽑습니다."],
    ["카드를 뽑습니다.", "기술을 뽑습니다."],
    ["자기 차례에 카드 1장을 뽑을 수 있습니다.", "자기 차례에 기술 1개를 뽑을 수 있습니다."]
  ]) assert.equal(P.clean(text, "reward"), expected);
  assert.equal(P.clean("카드 2장을 버립니다.", "reward"), "장비 2개를 버립니다.");
  assert.equal(P.clean("해당 카드를 사용합니다.", "reward"), "해당 장비를 사용합니다.");
  assert.equal(P.clean("카드가 준비되었습니다.", "reward"), "장비가 준비되었습니다.");
});

function raptureCheckpoint() {
  let state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: ["rune-rapture"], startConsumables: [] } });
  for (const command of require("./fixtures/v074-patient-natural-commands.json").slice(0, 4)) state = E.dispatch(state, command);
  const enemyId = state.enemies.find(enemy => enemy.missionId === "mob").id;
  for (let hit = 0; hit < 2; hit++) {
    const card = E.hunter(state).hand.find(card => E.card(card).dodge) || E.hunter(state).hand[0],
      slot = E.hunter(state).slots.findIndex(card => !card);
    state = E.dispatch(state, { type: "ATTACK", enemyId, cardId: card.id, slot });
    state = E.dispatch(state, { type: "RESOLVE" });
  }
  assert.equal(state.phase, "kill_react");
  while (state.rewardChoices.length) state = E.dispatch(state, { type: "KEEP_FIREARM", firearmId: state.rewardChoices[0].firearmId });
  assert.equal(E.hunter(state).rewardKillWindow, true);
  assert.equal(E.exportSave(E.importSave(E.exportSave(state))), E.exportSave(state));
  return state;
}

test("the actual rewards panel describes a skill draw and its real use draws a hand skill without granting equipment", () => {
  const state = raptureCheckpoint(), before = E.hunter(state), rune = before.rewards.find(reward => reward.kind === "rune-rapture"),
    normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1",
    normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true })),
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
      storage: { [normalKey]: normalSave, [qaKey]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
      engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } });
  assert.equal(ui.el("error").textContent, "");
  const panel = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "rewards"); assert(panel); panel.click();
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("rewardsPanel").hidden, false);
  assert.match(ui.el("rewards").innerHTML, /기술 1개를 뽑습니다/);
  assert.doesNotMatch(ui.el("rewards").innerHTML, /장비 1개를 뽑습니다/);
  const use = ui.buttons("rewards").find(button => button.dataset.command === "USE_REWARD" && JSON.parse(button.dataset.args || "{}").rewardId === rune.id);
  assert(use && !use.disabled); use.click(); assert.equal(ui.el("error").textContent, "");
  const result = E.importSave(ui.storage.get(qaKey)), after = E.hunter(result);
  assert.deepEqual(result, E.dispatch(state, { type: "USE_REWARD", rewardId: rune.id }));
  assert.equal(after.hand.length, before.hand.length + 1); assert.equal(after.deck.length, before.deck.length - 1);
  assert.equal(after.hand.at(-1).id, before.deck[0].id); assert(E.card(after.hand.at(-1)));
  assert.deepEqual(after.rewards.map(reward => reward.id), before.rewards.map(reward => reward.id));
  assert.deepEqual(after.ownedFirearms, before.ownedFirearms); assert.equal(after.rewards.find(reward => reward.id === rune.id).ready, false);
  assert.equal(after.hp, before.hp + 1); assert.equal(result.commands.length, state.commands.length + 1);
  assert.equal(ui.storage.get(normalKey), normalSave);
});
