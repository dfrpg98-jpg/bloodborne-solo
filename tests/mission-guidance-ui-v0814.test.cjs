"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const commands = require("./fixtures/v074-patient-natural-commands.json");
const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1", activeKey = "bloodborne-hunt-active-mode";
const normal = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
const normalSave = E.exportSave(normal), states = [];
let initial = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
  qa: { preset: "custom", startRewards: [], startConsumables: [] } });
states.push(initial);
for (const command of commands) { initial = E.dispatch(initial, command); states.push(initial); }
function at(index, storage, options = {}) {
  const state = states[index]; assert(state);
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    // Keep this historical accepted trace's speed ruling. Dedicated adoption
    // tests exercise safe policy migration; these tests concern mission UI.
    engine: { ...E, applyTileSpeedRuling: s => s },
    storage: storage || { [normalKey]: normalSave, [qaKey]: E.exportSave(state), [activeKey]: "qa" }, ...options });
  assert.equal(ui.el("error").textContent, "");
  assert.equal(ui.el("missionUpdateDialog").open, false, "restoring a save does not replay its old mission popup");
  assert.equal(ui.storage.get(normalKey), normalSave, "QA must preserve the separate normal autosave");
  return ui;
}
const savedState = ui => E.importSave(ui.storage.get(qaKey));
function clickCommand(ui, command, scope) {
  const candidates = scope ? ui.el(scope).querySelectorAll("[data-command]") : ui.document.querySelectorAll("[data-command]");
  const button = candidates.find(button => !button.disabled && button.dataset.command === command.type &&
    Object.entries(command).every(([key, value]) => key === "type" || JSON.stringify(JSON.parse(button.dataset.args || "{}")[key]) === JSON.stringify(value)));
  assert(button, "actual UI must offer " + JSON.stringify(command)); button.click();
  assert.equal(ui.el("error").textContent, ""); return button;
}
const statuses = (ui, id = "chapterProgress") => ui.el(id).querySelectorAll("[data-status]").map(step => step.dataset.status);
function guideButton(ui) {
  const button = ui.el("missionObjectives").querySelectorAll("[data-mission-guide]").find(button => button.dataset.missionGuide === "main");
  assert(button, "public goal includes a reachable acquisition/lure guide"); return button;
}

test("first boss completion prominently announces its chapter and keeps reward, growth and next chapter controls intact", () => {
  const ui = at(123); assert.equal(states[123].phase, "combat_react");
  clickCommand(ui, commands[123], "decisions");
  assert.equal(ui.el("missionUpdateDialog").open, true);
  assert.equal(ui.el("missionUpdateDialog").dataset.kind, "chapter");
  assert.equal(ui.el("missionUpdateTitle").textContent, "챕터 1 완수");
  assert.doesNotMatch(ui.el("missionUpdateTitle").textContent, /임무가 변경/);
  assert.match(ui.el("missionUpdateSummary").textContent, /보상 선택 → 마지막 꿈에서 성장 → 챕터 2 준비/);
  assert.equal(ui.el("missionUpdateContinue").textContent, "보상 선택으로");
  assert.deepEqual(statuses(ui, "missionUpdateProgress"), ["current", "pending", "pending"]);
  assert.equal(ui.el("chapterProgress").hidden, false);
  assert.deepEqual(savedState(ui), states[124]);
  const completed = ui.storage.get(qaKey);
  ui.el("missionUpdateContinue").click();
  assert.equal(ui.el("missionUpdateDialog").open, false);
  assert.equal(ui.storage.get(qaKey), completed, "acknowledgement cannot claim rewards or advance the dream");
  assert.match(ui.el("phaseTitle").textContent, /보상 선택/);
  clickCommand(ui, commands[124], "decisions");
  assert.equal(savedState(ui).rewardChoices.length, 0);
  assert.deepEqual(statuses(ui), ["done", "current", "pending"]);
  assert.equal(savedState(ui).phase, "upgrade_pick");
  clickCommand(ui, commands[125], "decisions");
  assert.equal(savedState(ui).phase, "upgrade_replace");
  assert.deepEqual(statuses(ui), ["done", "current", "pending"]);
  clickCommand(ui, commands[126], "decisions");
  assert.equal(savedState(ui).phase, "over");
  assert.deepEqual(statuses(ui), ["done", "done", "current"]);
  assert.match(ui.el("phaseTitle").textContent, /챕터 1 완수/);
  assert(ui.el("exportChapterSave"), "the existing completed-chapter export button remains present");
  clickCommand(ui, commands[127], "decisions");
  assert.equal(savedState(ui).phase, "between_chapters");
  assert.deepEqual(statuses(ui), ["done", "done", "current"]);
  ui.el("nextChapterStart").value = "center"; ui.el("nextChapterStart").fire("change");
  ui.el("nextChapterFace").value = "1"; ui.el("nextChapterFace").fire("change");
  assert.equal(ui.el("startNextChapter").disabled, false); ui.el("startNextChapter").click();
  assert.equal(ui.el("error").textContent, ""); assert.equal(savedState(ui).mission.chapter, 2);
  assert.equal(ui.el("chapterProgress").hidden, true, "old chapter progress is absent after starting the next hunt");
  assert.equal(ui.storage.get(normalKey), normalSave);
});

test("a pending completion reward survives a page reload with the correct derived stage and no duplicated completion popup", () => {
  const state = states[124]; assert(state.mission.won); assert(state.rewardChoices.length);
  const ui = at(124), saved = ui.storage.get(qaKey);
  assert.equal(ui.el("chapterProgress").hidden, false); assert.deepEqual(statuses(ui), ["current", "pending", "pending"]);
  assert.match(ui.el("phaseTitle").textContent, /보상 선택/);
  const reloaded = at(124, Object.fromEntries(ui.storage));
  assert.equal(reloaded.storage.get(qaKey), saved); assert.deepEqual(savedState(reloaded), state);
  assert.equal(reloaded.el("missionUpdateDialog").open, false);
  assert.deepEqual(statuses(reloaded), ["current", "pending", "pending"]);
  clickCommand(reloaded, commands[124], "decisions");
  assert.equal(savedState(reloaded).rewardChoices.length, 0); assert.deepEqual(statuses(reloaded), ["done", "current", "pending"]);
});

test("a disclosed optional mission shows its actual insight reward separately from the required goal without revealing future missions", () => {
  const ui = at(4), before = ui.storage.get(qaKey);
  assert(states[4].mission.revealed.includes(5));
  const cards = ui.el("objectiveDetail").querySelectorAll("[data-objective-kind]");
  assert.deepEqual(cards.map(card => card.dataset.objectiveKind), ["required", "insight"]);
  assert.match(ui.el("objectiveDetail").textContent, /필수 목표.*계몽 선택 임무.*사냥을 시작하다.*완수 시 계몽 1개/);
  assert.doesNotMatch(ui.el("objectiveDetail").textContent, /피신처|구조 임무|루드비히|혈석의 파편|재앙의 야수 우두머리/);
  assert.equal(ui.el("chapterProgress").hidden, true);
  assert.equal(ui.storage.get(qaKey), before);
});

test("chapter two goal leads directly to an eligible public lure action and only the accepted command spends its consumable", () => {
  const ui = at(129), prior = savedState(ui), before = ui.storage.get(qaKey);
  assert.equal(prior.mission.chapter, 2); assert.equal(prior.phase, "hunter");
  assert.match(ui.el("missionObjectives").textContent, /필수 목표.*공동묘지/);
  assert.match(ui.el("missionObjectives").textContent, /재앙의 야수를 처치해 시체.*소모품 1개.*유인/);
  guideButton(ui).click();
  assert.equal(ui.el("missionGuideDialog").open, true);
  assert.match(ui.el("missionGuideContent").textContent, /하인·무리를 처치해도 시체를 얻지 못합니다/);
  assert.match(ui.el("missionGuideContent").textContent, /자기 차례.*소모품 1개.*자신이 있는 칸/);
  assert.doesNotMatch(ui.el("missionGuideContent").textContent, /성직자 야수|멈출 줄 모르는 난동|야수의 포효/);
  assert.equal(ui.storage.get(qaKey), before, "opening the instructions has no gameplay cost");
  const action = E.missionActions(prior).find(action => action.command.type === "MISSION_LURE"); assert(action);
  assert.equal(ui.buttons("missionGuideContent").length, 1);
  clickCommand(ui, action.command, "missionGuideContent");
  assert.equal(ui.el("missionGuideDialog").open, false);
  const after = savedState(ui); assert.deepEqual(after, E.dispatch(prior, action.command));
  assert.equal(E.hunter(after).consumables.length, E.hunter(prior).consumables.length - 1);
  const spawned = after.enemies.find(enemy => !prior.enemies.some(old => old.id === enemy.id));
  assert(spawned); assert.equal(spawned.kind, "scourge-beast"); assert.equal(spawned.node, E.hunter(prior).position);
  assert.equal(ui.storage.get(normalKey), normalSave);
});

test("the floating-window capture guard permits the real mission guide response and preserves the normal save", () => {
  const W = require("../src/hunt-window-manager"), ui = at(129, null, { window: { BBHuntWindowManager: W } });
  guideButton(ui).click();
  const prior = savedState(ui), command = E.missionActions(prior).find(action => action.command.type === "MISSION_LURE").command;
  const button = ui.buttons("missionGuideContent").find(button => button.dataset.command === command.type);
  // This flat DOM harness has no ancestry or capture dispatch. Supply the
  // rendered button's real ownership and run the document listener first.
  button.closest = selector => selector === "dialog" ? ui.el("missionGuideDialog") : selector.includes("[data-command]") ? button : null;
  const event = ui.document.fire("click", { target: button, stopImmediatePropagation() { this.stopped = true; } });
  assert.equal(event.defaultPrevented, false, "the capture phase must reach the actual close-then-send handler");
  button.click();
  assert.equal(ui.el("missionGuideDialog").open, false);
  assert.deepEqual(savedState(ui), E.dispatch(prior, command));
  assert.equal(E.hunter(savedState(ui)).consumables.length, E.hunter(prior).consumables.length - 1);
  assert.equal(ui.storage.get(normalKey), normalSave); assert.equal(ui.el("error").textContent, "");
});

test("the method guide explains unavailable actions without inventing a free lure when the hunter has no consumables", () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: [], startConsumables: [] } });
  const full = require("./fixtures/full-campaign-actual-v10-commands.json");
  for (const command of full.slice(0, 129)) state = E.dispatch(state, command);
  assert.equal(state.mission.chapter, 2); assert.equal(E.hunter(state).consumables.length, 0);
  const ui = at(129, { [normalKey]: normalSave, [qaKey]: E.exportSave(state), [activeKey]: "qa" }), before = ui.storage.get(qaKey);
  guideButton(ui).click(); assert.equal(ui.el("missionGuideDialog").open, true);
  assert.equal(ui.buttons("missionGuideContent").length, 0);
  assert.match(ui.el("missionGuideContent").textContent, /필요한 소모품과 위치/);
  ui.el("closeMissionGuide").click(); assert.equal(ui.el("missionGuideDialog").open, false);
  assert.equal(ui.storage.get(qaKey), before);
});

test("goals group required and optional objectives separately from the story and hunt journal", () => {
  const ui = at(129), before = ui.storage.get(qaKey);
  const objectives = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "objectives"); assert(objectives);
  objectives.click(); assert.equal(ui.el("infoTitle").textContent, "목표와 임무");
  assert.match(ui.el("objectiveDetail").textContent, /필수 목표.*계몽 선택 임무/);
  assert.match(ui.el("objectiveDetail").textContent, /개별 계몽 임무는 선택/);
  const journal = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "journal"); assert(journal);
  journal.click(); assert.equal(ui.el("infoDialog").open, true);
  const story = ui.el("storyList").querySelectorAll("[data-story-key]").find(button => button.dataset.storyKey === "2:18"); assert(story);
  story.click(); assert.equal(ui.el("storyDialog").open, true); assert.equal(ui.el("infoDialog").open, false);
  assert.equal(ui.el("closeStory").textContent, "일지로 돌아가기");
  assert.match(ui.el("storyRules").textContent, /소모품 1개.*재앙의 야수/);
  assert.doesNotMatch(ui.el("storyRules").textContent, /성직자 야수|야수의 포효/);
  ui.el("closeStory").click();
  assert.equal(ui.el("storyDialog").open, false); assert.equal(ui.el("infoDialog").open, true);
  assert.equal(ui.el("infoTitle").textContent, "사냥일지");
  const panel = ui.document.querySelectorAll("[data-info-panel]").find(panel => panel.dataset.infoPanel === "journal");
  assert.equal(panel.hidden, false); assert.equal(ui.el("storyRules").innerHTML, "");
  assert.equal(ui.storage.get(qaKey), before, "reading and returning cannot add commands or mutate progression");
});
