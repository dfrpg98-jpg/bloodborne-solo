"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), P = require("../src/hunt-public-text"), F = require("../src/hunt-mission-feedback");
const data = require("../campaigns/long-hunt/data.json"), options = { E, publicText: P, data };
const cache = new Map();
function trace(file = "full-campaign-actual-v10-commands.json") {
  if (cache.has(file)) return cache.get(file);
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  const records = [];
  const dispatch = command => {
    const before = state; state = E.dispatch(state, command);
    records.push({ before, after: state, command, events: F.describe(before, state, options) });
  };
  for (const command of require("./fixtures/" + file)) {
    while (state.phase === "kill_react" && !state.rewardChoices.length && !(command.type === "USE_REWARD" &&
      E.killReactionActions(state).some(action => !action.disabled && action.command.type === command.type &&
        action.command.rewardId === command.rewardId && action.command.enemyId === command.enemyId))) dispatch({ type: "PASS_KILL_REACTION" });
    dispatch(command);
  }
  cache.set(file, records); return records;
}
const chapter = state => P.chapter(state, E.missionView(state), data);

test("required objective and individually optional insight tasks remain distinct without disclosing another task", () => {
  const start = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  const first = chapter(start);
  assert.equal(first.main.kind, "required"); assert.equal(first.main.categoryLabel, "필수 목표");
  assert.equal(first.main.reward, null); assert.deepEqual(first.insightObjectives, []);
  assert.deepEqual(first.main.sourceCards, [1]);
  assert.doesNotMatch(JSON.stringify(first), /야수 우두머리|피신처|구조|성직자 야수|루드비히/);
  const found = trace().find(record => !record.before.mission.revealed.includes(5) && record.after.mission.revealed.includes(5));
  const current = chapter(found.after), task = current.objectives.find(item => item.id === "mob");
  assert.equal(task.kind, "insight"); assert.equal(task.categoryLabel, "계몽 선택 임무");
  assert.deepEqual(task.reward, { kind: "insight", amount: 1, text: "완수 시 계몽 1개" });
  assert.deepEqual(current.insightObjectives.map(item => item.id), ["mob"]);
  assert.match(current.insightChoiceDescription, /개별.*선택.*필수 목표.*필요한 개수/);
  assert.doesNotMatch(JSON.stringify(task), /루드비히|랜턴|피신처|구조/);
});

test("the public chapter two corpse objective states actual acquisition and lure cost before a needless huntsman fight", () => {
  const found = trace().find(record => record.before.mission.chapter === 1 && record.after.mission.chapter === 2);
  assert(found); const state = found.after, saved = E.exportSave(state), current = chapter(state), main = current.main;
  assert.match(main.description, /공동묘지.*시체 2개.*재앙의 야수.*시체.*소모품 1개.*현재 칸.*유인/);
  assert.match(main.guidance.join(" "), /하인·무리를 처치해도 시체를 얻지 못합니다/);
  assert.match(main.guidance.join(" "), /자기 차례.*소모품 1개.*자신이 있는 칸/);
  assert.deepEqual(main.actionTypes, ["MISSION_LURE", "MISSION_CORPSES"]);
  assert.deepEqual(main.sourceCards, [18]);
  assert.doesNotMatch(JSON.stringify(current), /성직자 야수|무적|지하묘지로 유인|수혈액|야수의 포효/);
  // The guidance points at public action types; actual commands and current
  // availability still come only from the engine's missionActions view.
  for (const action of E.missionActions(state).filter(action => main.actionTypes.includes(action.command.type))) {
    assert(["MISSION_LURE", "MISSION_CORPSES"].includes(action.command.type));
    assert.doesNotThrow(() => E.dispatch(state, action.command));
  }
  assert.equal(E.exportSave(state), saved); assert.deepEqual(E.importSave(saved), state);
});

test("corpse acquisition guidance ends when the disclosed main objective advances past its deposit requirement", () => {
  const found = trace().find(record => record.after.mission.chapter === 2 && !record.before.mission.revealed.includes(19) && record.after.mission.revealed.includes(19));
  assert(found); const main = chapter(found.after).main;
  assert(main.sourceCards.includes(19));
  // This accepted route already has two insight when it deposits the corpses,
  // so the same command also discloses the next fight rather than pausing at 19.
  assert.match(main.description, /성직자 야수를 2페이즈/); assert.deepEqual(main.actionTypes, []); assert.deepEqual(main.guidance, []);
  assert.doesNotMatch(main.description, /시체|소모품|유인/);
});

test("first chapter completion outranks its simultaneous completed mission and later mixed updates", () => {
  const found = trace().find(record => !record.before.mission.won && record.after.mission.won && record.after.mission.chapter === 1);
  assert(found); const before = E.exportSave(found.after), actual = F.notice(found.events, found.after, options);
  assert.equal(actual.kind, "chapter"); assert.equal(actual.title, "챕터 1 완수"); assert.equal(actual.eyebrow, "사냥 완수");
  assert.equal(actual.events[0].kind, "chapter"); assert.equal(actual.events.length, found.events.length);
  assert.match(actual.summary, /보상 선택 → 마지막 꿈에서 성장 → 챕터 2 준비/);
  assert.equal(actual.continueLabel, "보상 선택으로");
  const mixed = F.notice([...found.events, { kind: "updated", title: "같은 배치의 공개된 변경" }], found.after, options);
  assert.equal(mixed.kind, "chapter"); assert.equal(mixed.title, "챕터 1 완수"); assert.equal(mixed.events.length, found.events.length + 1);
  assert.equal(E.exportSave(found.after), before);
});

test("accepted rewards, dream growth, completed dream and next chapter preparation expose their actual distinct stages", () => {
  const records = trace(), won = records.filter(record => record.after.mission.chapter === 1 && record.after.mission.won);
  const stateFor = predicate => { const record = won.find(record => predicate(record.after)); assert(record); return record.after; };
  const rewardState = stateFor(state => state.rewardChoices.length > 0), rewards = F.chapterProgress(rewardState, options);
  assert.equal(rewards.current, "rewards"); assert.equal(rewards.pendingRewards, rewardState.rewardChoices.length);
  assert.deepEqual(rewards.steps.map(step => step.status), ["current", "pending", "pending"]);
  const growing = stateFor(state => !state.rewardChoices.length && state.phase === "upgrade_pick"), growth = F.chapterProgress(growing, options);
  assert.equal(growth.current, "growth"); assert.equal(growth.growthDone, false);
  assert.deepEqual(growth.steps.map(step => step.status), ["done", "current", "pending"]);
  for (const phase of ["over", "between_chapters"]) {
    const state = stateFor(state => state.phase === phase), next = F.chapterProgress(state, options);
    assert.equal(next.current, "next"); assert.equal(next.growthDone, true);
    assert.deepEqual(next.steps.map(step => step.status), ["done", "done", "current"]);
    assert.match(next.summary, /마지막 꿈까지 마쳤습니다.*챕터 2/);
    assert.deepEqual(F.chapterProgress(E.importSave(E.exportSave(state)), options), next, "reload derives the same pending process, not a session-only flag");
  }
  const startingNext = records.find(record => record.before.mission.chapter === 1 && record.after.mission.chapter === 2).after;
  assert.equal(F.chapterProgress(startingNext, options), null, "next chapter must not inherit the old completion panel");
  assert.equal(F.notice([], startingNext, options), null);
});

test("final campaign completion preserves its completed dream and offers record keeping without a nonexistent chapter four", () => {
  const state = trace().at(-1).after, progress = F.chapterProgress(state, options);
  assert.equal(state.result, "campaign-win"); assert.equal(progress.final, true); assert.equal(progress.current, "archive");
  assert.equal(progress.steps.at(-1).label, "캠페인 기록 보관");
  assert.doesNotMatch(JSON.stringify(progress), /챕터 4/);
});

test("an enemy-only conditional attack change has its own compact notification category instead of pretending the goal changed", () => {
  const record = trace("v074-shelter-natural-commands.json").find(record => record.events.some(event => event.enemyChanges?.length));
  assert(record); const original = record.after, changed = structuredClone(original);
  const target = Object.values(changed.mission.targets).find(target => target.card === 10), enemy = changed.enemies.find(enemy => enemy.id === target.enemyId);
  enemy.hp--; // Isolated public-description branch contract, not a browser save.
  const events = F.describe(original, changed, options);
  assert.equal(events.length, 1); assert.equal(events[0].kind, "enemy-effect");
  assert.match(events[0].effects.join(" "), /피의 광란.*피해 4/);
  assert.equal(events[0].enemyChanges.length, 1);
  const notice = F.notice(events, changed, options);
  assert.equal(notice.kind, "enemy-effect"); assert.equal(notice.title, "적 능력 변화");
  assert.doesNotMatch(notice.title, /목표 변경|임무가 변경/);
  assert.deepEqual(F.describe(changed, changed, options), []);
});
