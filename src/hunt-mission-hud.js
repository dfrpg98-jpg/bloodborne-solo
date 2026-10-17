(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntMissionHUD = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // A presentation filter over already revealed mission information. It must
  // never read future cards, invent counters or change canonical mission state.
  function view(mission) {
    const empty = { counters: [], tokens: [], targets: [] };
    if (!mission || mission.won) return empty;
    const revealed = new Set(mission.revealed || []), discarded = new Set(mission.discarded || []);
    const completed = new Set(mission.completed || []);
    const earned = new Set([...completed, ...(mission.history || []).flatMap(chapter => chapter.completed || [])]);
    const active = (starts, rewards) => starts.some(number => revealed.has(number) && !discarded.has(number)) &&
      !rewards.some(number => completed.has(number));
    const clinic = active([27, 52], [28]) && !earned.has(34);
    const chapel = active([33], [34]) && !earned.has(28);
    const corpses = mission.chapter === 2 && active([18], [23]) && !revealed.has(19);
    const escort = mission.chapter === 1 ? active([8], [11]) : active([37], [38, 39]);
    const rescue = mission.chapter === 1 ? active([12, 13, 14], [15, 16]) : active([49], [48, 50]);
    const salvation = active([57], [58]);
    const counterActive = {
      "corpses-held": corpses, corpses,
      "survivors-held": clinic || chapel, clinic, chapel,
      "card-54": active([54], [55]), "card-57": salvation, "card-59": active([59], [60]),
    };
    const tokenActive = { escort, rescue, "salvation-npc": salvation };
    return {
      counters: (mission.counters || []).filter(counter => counterActive[counter.id] === true),
      tokens: (mission.tokens || []).filter(token => tokenActive[token.id] === true),
      targets: (mission.targets || []).filter(target => !target.complete && target.tokens !== undefined &&
        (target.initialTokens > 0 || target.tokens > 0) && revealed.has(target.card) && !discarded.has(target.card)),
    };
  }

  // Brief reminders for rules whose source is already public in this chapter.
  // Setup is labelled as already applied; completed encounters leave the HUD.
  // No campaign data lookup is allowed here: future card titles/effects must
  // never be pulled into a reminder through a reference on a revealed card.
  const ruleSummaries = [
    { card: 3, chapters: [1], scope: "enemy", title: "무리의 우두머리",
      text: "우두머리는 계몽 토큰이 있으면 처치 대신 회복하고 초기화 때 토큰을 보충합니다. 전용 능력은 피해 +1·방해·기절이며 방해할 수 없습니다." },
    { card: 6, chapters: [1], scope: "enemy", title: "군중",
      text: "임무의 야수 사냥 무리는 계몽 토큰이 있으면 처치 대신 회복하고, 초기화 때 토큰을 보충합니다." },
    { card: 10, chapters: [1], scope: "enemy", title: "포악한",
      text: "임무의 재앙의 야수는 계몽 토큰이 있으면 처치 대신 회복합니다. 부상 시 특수 공격 피해 +2. 최종 처치 후 속도 1 회피 또는 피해 3." },
    { card: 17, chapters: [2, 3], scope: "setup", title: "특수 준비 · 적용됨",
      text: "공동묘지 ↔ 중앙 등불 ↔ 연결 타일 ↔ 지하묘지로 배치되었습니다. 연결 타일은 출입구 2개 이상입니다." },
    { card: 18, chapters: [2], scope: "chapter", title: "야수 유인·시체 수집",
      text: "자신의 차례에 소모품 1개를 버려 현재 칸에 재앙의 야수를 출현시킬 수 있습니다. 재앙의 야수 처치로 얻은 시체는 공동묘지 타일에서 바칩니다." },
    { card: 22, chapters: [2], scope: "chapter", title: "멈출 줄 모르는 난동",
      text: "성직자 야수는 피해를 받지 않습니다. 라운드 끝에 추가 활성화하여 체력이 가장 낮은 사냥꾼을 추적·공격합니다. 초기화 때 공동묘지에 재출현합니다." },
    { card: 31, chapters: [2], scope: "enemy", title: "격노한",
      text: "환자는 계몽 토큰이 있으면 처치 대신 회복합니다. 특수 공격은 기절을 줍니다. 최종 처치 후 속도 1 회피 또는 피해 3." },
    { card: 36, chapters: [2, 3], scope: "enemy", title: "불굴",
      text: "임무의 야수 사냥 하인은 계몽 토큰이 있으면 처치 대신 회복하고 초기화 때 토큰을 보충합니다. 특수 공격은 피해 2를 방어하며 방해할 수 없습니다." },
    { card: 41, chapters: [3], scope: "chapter", title: "가두다",
      text: "오에돈의 지하묘지 타일에 들어갈 수 없습니다. 이번 챕터 계몽 2개 또는 두 번째 초기화에 도달하면 새로운 이야기가 이어집니다." },
    { card: 42, chapters: [3], scope: "chapter", title: "풀려나다",
      text: "성직자 야수는 라운드 끝에 같은 칸의 최저 체력 사냥꾼을 공격합니다. 같은 칸에 사냥꾼이 없으면 가장 가까운 사냥꾼 중 최저 체력 대상을 향해 4칸 이동·공격합니다. 초기화 때 제거 대신 완전히 회복하고 계몽 토큰을 모두 제거합니다." },
    { card: 43, chapters: [3], scope: "chapter", title: "무리 소환",
      text: "성직자 야수가 회복 행동을 공개하면 같은 칸에 재앙의 야수 1마리가 출현합니다. 소환된 야수는 초기화 때 재출현하지 않습니다." },
  ];

  function specialRules(mission) {
    if (!mission || mission.won || ![1, 2, 3].includes(mission.chapter)) return [];
    const revealed = new Set(mission.revealed || []), discarded = new Set(mission.discarded || []);
    return ruleSummaries.filter(rule => rule.chapters.includes(mission.chapter) &&
      revealed.has(rule.card) && !discarded.has(rule.card) &&
      (rule.scope !== "enemy" || (mission.targets || []).some(target => target.card === rule.card && !target.complete)))
      .map(({ card, scope, title, text }) => ({ id: "rule-" + card, card, scope, title, text }));
  }

  return { view, specialRules };
});
