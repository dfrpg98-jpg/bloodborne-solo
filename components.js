(function () {
  "use strict";
  const source = window.BBComponents,
    quests = new Set(["music-box", "ritual-material"]),
    data = { ...source, cards: source.cards.map((card) => card.group === "reward" ? {
      ...card, runtime: quests.has(card.id) ? "reference" : "playable",
      runtimeNote: quests.has(card.id)
        ? "원문 사용불가 임무 물품입니다. 보관하며 도구·문자 장착 제한에 포함하지 않습니다."
        : "실제 지도 전투의 새 규칙 사냥에서 효과를 실행합니다. 전투 연습의 시작 보상으로 선택할 수 있습니다. 정규 획득은 해당 캠페인 임무를 따릅니다.",
    } : card) },
    $ = (id) => document.getElementById(id);
  const groups = {
    basic: "기본 스탯",
    consumable: "소모품",
    upgrade: "업그레이드",
    reward: "보상",
  };
  const stats = {
    strength: "근력",
    skill: "기술",
    endurance: "지구력",
    vitality: "활력",
  };
  const statuses = {
    playable: "플레이 가능",
    reference: "자료 등록",
    pending: "연결 대기",
    multiplayer: "다인용 필요",
    excluded: "덱 제외",
  };
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  for (const [key, s] of Object.entries(data.summary)) {
    const box = node("div", "", "total");
    box.append(
      node("div", groups[key]),
      node("strong", `${s.copies}장`),
      node("span", `${s.kinds}종 · 종류별 수량 기록`),
    );
    $("totals").append(box);
  }
  for (const q of data.questions) $("questions").append(node("p", q.text));
  if (!data.questions.length) $("questions").append(node("p", "확인된 카드 원문과 사진 출처를 각 카드에서 열 수 있습니다. 사용 가능한 보상30종의 효과와 사용불가 임무 물품2종의 보관을 연결했습니다."));
  for (const r of data.rules) $("rules").append(node("li", r));
  function render() {
    const q = $("query").value.trim().toLowerCase(),
      group = $("group").value,
      runtime = $("runtime").value;
    const found = data.cards.filter(
      (c) =>
        (group === "all" || c.group === group) &&
        (runtime === "all" ||
          (runtime === "questions"
            ? c.questions.length
            : c.runtime === runtime)) &&
        [c.name, c.rules, c.timing, c.flavor || ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
    $("resultCount").textContent =
      `${found.length}종 · 수량 합계 ${found.reduce((a, c) => a + c.count, 0)}장`;
    $("cards").replaceChildren();
    if (!found.length)
      $("cards").append(node("p", "조건에 맞는 카드가 없습니다.", "empty"));
    for (const c of found) {
      const card = node("article", "", "component-card");
      card.dataset.id = c.id;
      const meta = node("div", "", "meta");
      meta.append(
        node(
          "span",
          `${groups[c.group]}${c.stat ? " · " + stats[c.stat] : ""} / ${c.count}장`,
        ),
        node("span", statuses[c.runtime], `badge ${c.runtime}`),
      );
      card.append(
        meta,
        node("h2", c.name),
        node("p", c.timing, "timing"),
        node("p", c.rules, "effect"),
      );
      if (c.flavor) card.append(node("p", c.flavor, "flavor"));
      if (c.questions.length)
        card.append(
          node(
            "p",
            "확인 필요 · 아래 문구 확인 항목을 참고하세요.",
            "question-note",
          ),
        );
      card.append(
        node(
          "p",
          c.runtimeNote ||
            (c.runtime === "playable"
              ? "현재 훈련 게임에서 자동 처리합니다."
              : ""),
          "note",
        ),
      );
      const detail = node("details", "");
      detail.append(
        node("summary", "입력 원문·출처"),
        node("p", c.rawRules),
        node("p", c.source),
      );
      if (c.verificationNote) detail.append(node("p",c.verificationNote));
      for (const [i, photo] of (c.photos || []).entries()) {
        const link=node("a", `사진 ${i+1} 열기`); link.href=photo.path; link.target="_blank"; link.rel="noopener"; link.style.marginRight="12px"; detail.append(link);
      }
      card.append(detail);
      $("cards").append(card);
    }
  }
  $("query").oninput = render;
  $("group").onchange = render;
  $("runtime").onchange = render;
  render();
})();
