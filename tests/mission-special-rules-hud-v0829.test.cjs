"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), HUD = require("../src/hunt-mission-hud");
const source = require("../campaigns/long-hunt/data.json");
const commands = require("./fixtures/full-campaign-actual-v10-commands.json");

const ids = rules => rules.map(rule => rule.card);
function publicMission(chapter, revealed, extra = {}) {
  return { chapter, revealed, discarded: [], completed: [], won: false,
    history: [], targets: [], ...extra };
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test("initial chapter one and practice have no invented special rules", () => {
  const campaign = E.create(90, "burial", 1, null, "hunter-pistol", "center",
    { campaign: true, rulesVersion: 14 });
  const practice = E.create(90, "rifle-spear", 1, null, "hunter-pistol", "center",
    { campaign: false, rulesVersion: 14, practiceTarget: "church-servant" });
  assert.deepEqual(HUD.specialRules(E.missionView(campaign)), []);
  assert.deepEqual(HUD.specialRules(E.missionView(practice)), []);
  assert.deepEqual(HUD.specialRules(null), []);
  assert.deepEqual(HUD.specialRules(publicMission(4, [17, 18, 41, 42, 43])), []);
});

test("revealed chapter-two preparation is labelled applied, with its public layout only", () => {
  for (const chapter of [2, 3]) {
    const rule = HUD.specialRules(publicMission(chapter, [17]))[0];
    assert.equal(rule.card, 17);
    assert.equal(rule.scope, "setup");
    assert.match(rule.title, /특수 준비.*적용됨/);
    assert.match(rule.text, /공동묘지 ↔ 중앙 등불 ↔ 연결 타일 ↔ 지하묘지/);
    assert.match(rule.text, /출입구 2개 이상/);
    assert(source.chapters.find(item => item.number === chapter).specialSetupCards.includes(17));
  }
  assert.deepEqual(HUD.specialRules(publicMission(1, [17])), []);
  assert.deepEqual(HUD.specialRules(publicMission(2, [])), []);
});

test("chapter-two corpse rule and later invulnerability never reveal an unopened future rule", () => {
  const early = publicMission(2, [17, 18]);
  const rules = HUD.specialRules(early);
  assert.deepEqual(ids(rules), [17, 18]);
  assert.match(rules[1].text, /자신의 차례.*소모품 1개.*현재 칸/);
  assert.match(rules[1].text, /시체.*공동묘지 타일/);
  assert.doesNotMatch(JSON.stringify(rules), /성직자 야수|난동|2페이즈|가두다|소환|번 카드/);
  // Card18 remains live and its consumable lure remains available after19.
  assert.deepEqual(ids(HUD.specialRules({ ...early, revealed: [17, 18, 19, 20] })), [17, 18]);
  const later = HUD.specialRules({ ...early, revealed: [17, 18, 19, 20, 21, 22] });
  const rampage = later.find(rule => rule.card === 22);
  assert.match(rampage.text, /피해를 받지 않습니다/);
  assert.match(rampage.text, /라운드 끝.*추가 활성화.*체력이 가장 낮은/);
  assert.match(rampage.text, /초기화.*공동묘지.*재출현/);
});

test("chapter-three captivity reveals its own condition without the unrevealed release or summon effects", () => {
  const view = publicMission(3, [17, 40, 41], {
    history: [{ chapter: 2, completed: [26, 28, 23], revealed: [17, 18, 22] }],
  });
  const rules = HUD.specialRules(view), captivity = rules.find(rule => rule.card === 41);
  assert.deepEqual(ids(rules), [17, 41]);
  assert.match(captivity.text, /지하묘지 타일에 들어갈 수 없습니다/);
  assert.match(captivity.text, /이번 챕터 계몽 2개 또는 두 번째 초기화/);
  assert.doesNotMatch(JSON.stringify(rules), /풀려나다|무리 소환|4칸|회복할 때|42번|43번|난동|시체/);
  assert.deepEqual(ids(HUD.specialRules({ ...view, revealed: [17, 40] })), [17]);
});

test("release replaces discarded captivity, and summon removal clears only its own reminder", () => {
  const released = publicMission(3, [17, 40, 41, 42, 43], { discarded: [41] });
  assert.deepEqual(ids(HUD.specialRules(released)), [17, 42, 43]);
  const release = HUD.specialRules(released).find(rule => rule.card === 42);
  assert.match(release.text, /라운드 끝.*같은 칸의 최저 체력 사냥꾼을 공격/);
  assert.match(release.text, /같은 칸에 사냥꾼이 없으면 가장 가까운 사냥꾼 중 최저 체력.*4칸 이동·공격/);
  assert.match(release.text, /초기화.*제거 대신.*회복.*계몽 토큰.*제거/);
  const summon = HUD.specialRules(released).find(rule => rule.card === 43);
  assert.match(summon.text, /성직자 야수.*회복 행동을 공개하면.*같은 칸.*재앙의 야수 1마리/);
  assert.doesNotMatch(summon.text, /회복할 때/, "ordinary healing and reset recovery must not imply a summon");
  assert.match(summon.text, /초기화 때 재출현하지 않습니다/);
  assert.doesNotMatch(summon.text, /무리를 정리하다|55번|보상/);
  assert.deepEqual(ids(HUD.specialRules({ ...released, discarded: [41, 43], completed: [55] })), [17, 42]);
  assert.deepEqual(HUD.specialRules({ ...released, won: true }), []);
});

test("encounter reminders require the revealed current-chapter target and stop at its final defeat", () => {
  for (const [chapter, cards] of [[1, [3, 6, 10]], [2, [31, 36]], [3, [36]]]) {
    const targets = cards.map(card => ({ id: "target-" + card, card, complete: false }));
    const view = publicMission(chapter, cards, { targets });
    assert.deepEqual(ids(HUD.specialRules(view)), cards);
    assert(HUD.specialRules(view).every(rule => rule.scope === "enemy"));
    assert.deepEqual(HUD.specialRules({ ...view, revealed: [] }), []);
    assert.deepEqual(HUD.specialRules({ ...view, targets: targets.map(target => ({ ...target, complete: true })) }), []);
    assert.deepEqual(HUD.specialRules({ ...view, discarded: cards }), []);
    assert.deepEqual(HUD.specialRules({ ...view, targets: [] }), []);
  }
  const wrongChapter = publicMission(3, [3, 6, 10, 31], {
    targets: [3, 6, 10, 31].map(card => ({ card, complete: false })),
  });
  assert.deepEqual(HUD.specialRules(wrongChapter), []);
});

test("the helper does not mutate public state or expose history, and returns fresh presentation records", () => {
  const view = freeze(publicMission(3, [17, 40, 41], {
    history: [{ chapter: 2, revealed: [18, 22, 31, 36], completed: [26, 28, 23] }],
    futureCards: [{ number: 42, title: "SECRET", rules: ["SECRET EFFECT"] }],
  }));
  const before = JSON.stringify(view), first = HUD.specialRules(view);
  first[0].title = "changed by presentation";
  assert.equal(JSON.stringify(view), before);
  assert.doesNotMatch(JSON.stringify(HUD.specialRules(view)), /changed by presentation|SECRET|격노한|불굴/);
  assert.deepEqual(HUD.specialRules(null), [], "campaign to practice cannot retain previous reminder records");
  assert.deepEqual(ids(HUD.specialRules(view)), [17, 41], "resuming the campaign recomputes its public rules");
});

let natural;
function naturalStates() {
  if (natural) return natural;
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  natural = [state];
  for (const command of commands) {
    const usesOfferedReaction = () => command.type === "USE_REWARD" && E.killReactionActions(state).some(action =>
      !action.disabled && action.command.type === "USE_REWARD" && action.command.rewardId === command.rewardId
      && action.command.enemyId === command.enemyId);
    while (state.phase === "kill_react" && !state.rewardChoices.length && !usesOfferedReaction()) {
      state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
      natural.push(state);
    }
    state = E.dispatch(state, command);
    natural.push(state);
  }
  return natural;
}

test("real public campaign transitions refresh rules across all three chapters without changing saves", () => {
  const seen = new Set(), chapterStarts = new Map();
  for (const state of naturalStates()) {
    const view = E.missionView(state), before = E.exportSave(state), rules = HUD.specialRules(view);
    if (!chapterStarts.has(view.chapter)) chapterStarts.set(view.chapter, rules);
    for (const rule of rules) {
      assert(view.revealed.includes(rule.card), "only revealed current-chapter source cards may appear");
      assert(!view.discarded.includes(rule.card), "discarded source cards must disappear");
      seen.add(rule.card);
    }
    if (view.won) assert.deepEqual(rules, []);
    assert.equal(E.exportSave(state), before, "presentation cannot alter replayable campaign state");
  }
  assert.deepEqual([...chapterStarts.keys()], [1, 2, 3]);
  assert.deepEqual(ids(chapterStarts.get(1)), []);
  assert.deepEqual(ids(chapterStarts.get(2)), [17, 18]);
  assert.deepEqual(ids(chapterStarts.get(3)), [17, 41]);
  for (const card of [3, 6, 17, 18, 22, 41, 42, 43]) assert(seen.has(card), "natural trace must exercise rule " + card);
  const completed = naturalStates().at(-1);
  assert.equal(completed.result, "campaign-win");
  assert.deepEqual(E.importSave(E.exportSave(completed)), completed);
  const practice = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  assert.deepEqual(HUD.specialRules(E.missionView(practice)), []);
});
