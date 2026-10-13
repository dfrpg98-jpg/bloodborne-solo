(function () {
  "use strict";
  const data = window.BBLongHunt;
  function attackText(label, attack) {
    return `${label}: ${attack.name} · 속도 ${attack.speed}, 피해 ${attack.damage}` +
      (attack.keywords.length ? ` · ${attack.keywords.join(" / ")}` : "");
  }
  const enemyEntries = (data.enemies || []).flatMap((enemy) =>
    enemy.sides.map((side) => ({
      id: `enemy-${enemy.id}-${side.id}`,
      enemyId: enemy.id,
      type: `적 카드 · ${side.label}`,
      title: `${enemy.name} · ${side.label}`,
      source: side.source,
      image: side.image,
      openQuestions: side.openQuestions,
      reveal: [],
      rules: [
        `체력: ${enemy.health}`,
        `피규어 수량: ${enemy.miniatureCount}개`,
        attackText("기본 공격", side.basicAttack),
        ...side.basicAttack.rules,
        attackText("특수 공격", side.specialAttack),
        ...side.specialAttack.rules,
        `전용 능력: ${side.ability.name}`,
        ...side.ability.rules,
        ...side.passiveRules,
      ],
    })),
  );
  const markerNames = Object.fromEntries((data.spawnMarkers || []).map((m) => [m.id, m.label]));
  const directions = { N: "위", E: "오른쪽", S: "아래", W: "왼쪽" };
  const tileEntries = (data.tiles || []).map((tile) => {
    const label = (id) => tile.spaces.find((s) => s.id === id).label;
    const icons = (space) => space.icons.map((i) =>
      `${i.kind === "spawn" ? markerNames[i.markerId] : i.kind === "lamp" ? "등불" : "소모품"} ${i.count}개`).join(" · ") || "기호 없음";
    return {
      id: tile.id, tileId: tile.id, type: "지도 타일", title: tile.displayName,
      source: tile.source, image: tile.image, openQuestions: tile.openQuestions, reveal: [],
      rules: [
        ...tile.rules,
        ...(tile.rules.length ? [] : ["별도로 인쇄된 효과 문구 없음"]),
        `칸 수: ${tile.spaces.length}칸 · 출입구: ${tile.exits.length}곳`,
        ...tile.spaces.map((s) => `${s.label}${s.placeName ? ` (‘${s.placeName}’ 칸)` : ""}: ${icons(s)}`),
        `서로 인접한 칸: ${tile.adjacency.map(([a,b]) => `${label(a)} ↔ ${label(b)}`).join(" / ")}`,
        `출입구 위치: ${tile.exits.map((e) => `${directions[e.edge]} → ${label(e.spaceId)}`).join(" / ")}`,
      ],
    };
  });
  const entries = [...data.preface, ...data.cards, ...enemyEntries, ...tileEntries];
  const base = "campaigns/long-hunt/";
  let selected = entries[0].id;
  const $ = (id) => document.getElementById(id);
  function element(tag, text, className) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  }
  function select(id, focus = false) {
    selected = id;
    renderList();
    renderCard();
    if (focus) $("cardDetail").focus({ preventScroll: true });
  }
  function renderList() {
    const query = $("search").value.trim().toLocaleLowerCase();
    const filter = $("filter").value;
    const found = entries.filter((e) => {
      if (filter === "preface" && (e.number || e.enemyId || e.tileId)) return false;
      if (filter === "numbered" && !e.number) return false;
      if (filter === "enemies" && !e.enemyId) return false;
      if (filter === "tiles" && !e.tileId) return false;
      if (filter === "questions" && !e.openQuestions?.length) return false;
      if (!query) return true;
      if (/^\d+$/.test(query)) return e.number === Number(query);
      return [e.title, e.type, e.source.filename, ...e.rules]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
    $("cardList").replaceChildren();
    $("count").textContent = found.length + "장";
    if (!found.length)
      $("cardList").append(element("p", "해당하는 카드가 없습니다.", "empty"));
    for (const e of found) {
      const b = element(
        "button",
        undefined,
        "card-button" + (e.id === selected ? " active" : ""),
      );
      b.append(
        element(
          "small",
          e.number
            ? `${String(e.number).padStart(2, "0")} · ${e.type}`
            : e.type,
        ),
        element("span", e.title),
      );
      if (e.id === selected) b.setAttribute("aria-current", "true");
      b.addEventListener("click", () => select(e.id, true));
      $("cardList").append(b);
    }
  }
  function renderCard() {
    const e = entries.find((x) => x.id === selected);
    const article = $("cardDetail");
    article.replaceChildren();
    article.append(
      element(
        "div",
        `${e.number ? `카드 ${e.number} · ` : ""}${e.type} / 해당 압축파일 내 순서 ${e.source.sortPosition}`,
        "card-meta",
      ),
    );
    article.append(element("h2", e.title));
    article.append(element("p", `${e.source.archive} / ${e.source.filename}`, "card-meta"));
    for (const id of e.resolvedQuestions || []) {
      const q = data.questions.find((q) => q.id === id);
      if (q?.resolution) article.append(element("p",
        `명칭 확인 완료: 원문의 ‘${q.printed}’은 ‘${q.resolution.canonicalName}’을 뜻합니다. (${q.resolution.confirmedOn} 사용자 확인)`,
        "resolved"));
    }
    if (e.openQuestions?.length) {
      const q = data.questions.find((q) => q.id === e.openQuestions[0]);
      const box = element("div", "명칭 확인 필요: " + q.question, "question");
      const img = element("img");
      img.src = base + q.image;
      img.alt = "57번의 야수 사냥 하수인 원문 확대";
      box.append(img);
      article.append(box);
    }
    const columns = element("div", undefined, "card-columns");
    const a = element("a", undefined, "photo-link");
    a.href = base + e.image;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "사진 크게 열기";
    const img = element("img", undefined, "photo");
    img.src = base + e.image;
    img.alt = e.title + (e.tileId ? " 지도 타일 사진" : " 카드 사진");
    a.append(img);
    columns.append(a);
    const rules = element("section", undefined, "rules");
    rules.append(element("h3", "읽은 규칙"));
    if (!e.rules.length)
      rules.append(
        element(
          "p",
          "이 카드에는 별도의 게임 처리 지시가 없습니다. 이야기 문구는 사진에서 확인할 수 있습니다.",
        ),
      );
    e.rules.forEach((r) => rules.append(element("p", r)));
    if (e.enemyId) {
      const other = enemyEntries.find((x) => x.enemyId === e.enemyId && x.id !== e.id);
      const refs = element("div", undefined, "followups");
      const b = element("button", "반대 면 보기");
      b.addEventListener("click", () => select(other.id, true));
      refs.append(b);
      rules.append(refs);
      rules.append(element("p", "A/B는 촬영 파일 순서로 붙인 구분입니다. 피규어 수량은 2026-10-11 사용자 확인을 반영했습니다.", "card-meta"));
    }
    if (e.reveal.length) {
      rules.append(element("h3", "후속 카드 참조"));
      rules.append(
        element("p", "각 카드를 공개하는 조건은 위 규칙 문구를 따릅니다."),
      );
      const refs = element("div", undefined, "followups");
      for (const n of e.reveal) {
        const b = element("button", n + "번 보기");
        b.addEventListener("click", () =>
          select(`card-${String(n).padStart(2, "0")}`, true),
        );
        refs.append(b);
      }
      rules.append(refs);
    }
    const incoming = e.number ? entries.filter((x) => x.reveal.includes(e.number)) : [];
    if (incoming.length) {
      rules.append(element("h3", "이 카드를 공개하는 앞선 카드"));
      const refs = element("div", undefined, "followups");
      incoming.forEach((x) => {
        const b = element("button", x.number ? x.number + "번" : x.title);
        b.addEventListener("click", () => select(x.id, true));
        refs.append(b);
      });
      rules.append(refs);
    }
    rules.append(
      element(
        "p",
        e.tileId
          ? "방향은 사진을 기준으로 위·오른쪽·아래·왼쪽입니다. 실제 지도에 회전 배치하면 출입구 방향도 바뀝니다. 실제 지도 전투 화면에서 칸 연결·출현·카드 비용·전투를 처리합니다. 성배 교단 예배당의 교환과 안개 진입로는 연결 전입니다."
          : e.enemyId
          ? "괄호 속 회피 속도는 인쇄된 기호를 옮긴 값입니다. 실제 처리에는 공통 회피 규칙을 함께 적용합니다. 적 3종의 양면 능력은 실제 지도 전투 화면에 연결했습니다. 현재는 1인 플레이만 지원합니다."
          : "아이콘 이름은 텍스트 표시용입니다. 원래 기호와 전체 서사는 사진을 참고하세요.",
        "card-meta",
      ),
    );
    columns.append(rules);
    article.append(columns);
    const idx = entries.indexOf(e),
      pager = element("div", undefined, "pager");
    for (const [offset, label] of [
      [-1, "← 이전 파일"],
      [1, "다음 파일 →"],
    ]) {
      const b = element("button", label);
      b.disabled = !entries[idx + offset];
      b.addEventListener("click", () => select(entries[idx + offset].id, true));
      pager.append(b);
    }
    article.append(pager);
  }
  $("openArchive").addEventListener("click", () => {
    $("gate").hidden = true;
    $("archive").hidden = false;
    renderList();
    renderCard();
  });
  $("search").addEventListener("input", renderList);
  $("filter").addEventListener("change", renderList);
})();
