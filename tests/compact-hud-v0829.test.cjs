"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07";
function launch(state) {
  state = E.applyTileSpeedRuling(state);
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine: E, realInventory: true, storage: { [key]: saved },
  });
  assert.equal(ui.el("error").textContent, "");
  return { ui, saved };
}
test("the restored marker roster is always in the top summary and still opens public enemy details without spending an action", () => {
  const html = fs.readFileSync(path.join(__dirname, "../hunt.html"), "utf8"),
    summary = html.slice(html.indexOf('<div class="hud-summary">'), html.indexOf('<section class="track-panel"'));
  assert.equal((html.match(/id="enemyRoster"/g) || []).length, 1);
  assert.match(summary, /id="enemyRoster"/);
  assert.doesNotMatch(html, /mission-enemy-summary/);
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }),
    { ui, saved } = launch(state), opener = ui.el("enemyRoster").querySelectorAll("[data-enemy-info]")[0];
  assert(opener); opener.click();
  assert.equal(ui.el("enemyDetailDialog").open, true);
  assert(ui.el("enemyDetailTitle").textContent.length > 0);
  assert.equal(ui.storage.get(key), saved);
});
test("the first goal shows actual current insight and separate visit places without exposing the future boss", () => {
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }),
    { ui, saved } = launch(state);
  assert.equal(ui.el("chapterSpecialRules").hidden, true);
  assert.match(ui.el("missionObjectives").innerHTML, /role="progressbar"[^>]*aria-valuenow="0"/);
  assert.match(ui.el("missionObjectives").textContent, /0 \/ 2/);
  assert.doesNotMatch(ui.el("missionObjectives").textContent, /우두머리|성직자 야수/);
  assert.equal((ui.el("chapterConditions").innerHTML.match(/class="mission-place"/g) || []).length, 3);
  assert.match(ui.el("chapterConditions").textContent, /이 타일에서 이동을 마치면 단서가 공개/);
  assert.equal(ui.storage.get(key), saved);
});
test("compact basic cards retain full effects for hover and assistive reading", () => {
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }),
    { ui, saved } = launch(state);
  for (const card of E.hunter(state).hand) {
    const definition = E.card(card), button = ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === card.id);
    assert(button);
    assert.match(button.getAttribute("aria-label"), new RegExp(definition.name));
    assert.equal(button.getAttribute("aria-label"), button.getAttribute("title"));
    assert(button.getAttribute("title").length > definition.name.length);
  }
  assert.equal(ui.storage.get(key), saved);
});
test("natural chapter transitions put only current public special rules above the goal and preserve the imported save", () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  const starts = new Map();
  for (const command of require("./fixtures/full-campaign-actual-v10-commands.json")) {
    while (state.phase === "kill_react" && !state.rewardChoices.length && !(command.type === "USE_REWARD" && E.killReactionActions(state).some(action =>
      !action.disabled && action.command.type === command.type && action.command.rewardId === command.rewardId && action.command.enemyId === command.enemyId)))
      state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
    state = E.dispatch(state, command);
    if (state.mission.chapter > 1 && !starts.has(state.mission.chapter)) starts.set(state.mission.chapter, state);
    if (starts.size === 2) break;
  }
  for (const [chapter, state] of starts) {
    const { ui, saved } = launch(state), text = ui.el("chapterSpecialRules").textContent;
    assert.equal(ui.el("chapterSpecialRules").hidden, false);
    assert.match(text, /특수 준비/);
    assert.match(text, chapter === 2 ? /야수 유인·시체 수집/ : /가두다/);
    if (chapter === 3) assert.doesNotMatch(text, /풀려나다|무리 소환/);
    assert.equal(ui.storage.get(key), saved);
  }
  assert.equal(starts.size, 2);
});
