(function () {
  "use strict";
  const E = window.BBChapter,
    ED = window.BBEnemyDeck,
    $ = (id) => document.getElementById(id),
    key = "bloodborne-chapter-map-v1";
  const esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const photo = (path) => "campaigns/long-hunt/" + path;
  const colors = { gold: "#dec079", red: "#dc9784", purple: "#bca0d4" },
    markers = { gold: "① 금색", red: "② 적갈색", purple: "③ 보라색" };
  const directionNames = { N: "북쪽 ↑", E: "동쪽 →", S: "남쪽 ↓", W: "서쪽 ←" };
  let state = E.create(),
    rotation = null,
    previewTile = null,
    selectedKind = null,
    startupError = "";
  try {
    const save = localStorage.getItem(key);
    if (save) state = E.importSave(save);
  } catch {
    startupError =
      "이전 탐험 저장을 읽지 못해 새 준비로 열었습니다. 내보낸 탐험 저장 파일을 불러올 수 있습니다.";
  }
  function save() {
    try {
      localStorage.setItem(key, E.exportSave(state));
      $("chapterSaveStatus").textContent = "탐험 진행 자동 저장됨";
    } catch {
      $("chapterSaveStatus").textContent =
        "자동 저장 불가 · 저장 내보내기를 이용하세요";
    }
  }
  function send(type, extra = {}) {
    try {
      state = E.dispatch(state, { type, ...extra });
      save();
      render();
      $("chapterError").textContent = "";
    } catch (e) {
      $("chapterError").textContent = e.message;
    }
  }
  function bind(container) {
    container
      .querySelectorAll("[data-command]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            send(b.dataset.command, JSON.parse(b.dataset.args || "{}"))),
      );
  }
  const button = (label, command, args = {}, disabled = false, cls = "") =>
    `<button class="${cls}" data-command="${command}" data-args="${esc(JSON.stringify(args))}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const attackText = (a) =>
    `${esc(a.name)} · 속도 ${a.speed} / 피해 ${a.damage}${a.keywords.length ? " · " + a.keywords.map(esc).join(" · ") : ""}${a.rules.length ? "<br>" + a.rules.map(esc).join("<br>") : ""}`;
  function renderEnemies() {
    $("chapterEnemies").innerHTML = state.assignments
      .map((a) => {
        const d = E.definition(state, a.enemyId),
          side = d.side,
          n = state.figures.filter((f) => f.kind === a.enemyId).length;
        return `<article class="assignment" style="--marker:${colors[a.marker]}"><span class="marker">${markers[a.marker]} 마커 · 활성화 ${a.slot}순위</span><h3>${esc(d.name)} <small>${side.label}</small></h3><p>체력 ${d.health} · 지도 위 ${n} / 피규어 ${d.miniatureCount}개</p>${d.movementOverride ? '<p class="muted">활성화·추격 이동 2칸</p>' : ""}<dl><dt>기본 공격</dt><dd>${attackText(side.basicAttack)}</dd><dt>특수 공격</dt><dd>${attackText(side.specialAttack)}</dd><dt>전용 능력 · ${esc(side.ability.name)}</dt><dd>${side.ability.rules.map(esc).join("<br>")}</dd></dl><details><summary>선택된 면의 원본 사진</summary><a href="${photo(side.image)}" target="_blank"><img src="${photo(side.image)}" alt="${esc(d.name)} ${side.label}" loading="lazy"></a></details></article>`;
      })
      .join("");
    $("setupSeed").textContent = `시드 ${state.seed}`;
  }
  const coords = {
    left: [20, 50],
    center: [50, 50],
    right: [80, 50],
    top: [50, 20],
    middle: [50, 50],
    bottom: [50, 80],
    "upper-left": [28, 25],
    "upper-right": [73, 25],
    "lower-left": [28, 75],
    "lower-right": [73, 75],
    "middle-left": [26, 50],
    "middle-right": [74, 50],
    room: [50, 23],
    entry: [50, 78],
    street: [50, 23],
    house: [50, 78],
  };
  function point(id, r) {
    let [x, y] = coords[id] || [50, 50];
    for (let i = 0; i < r; i++) [x, y] = [100 - y, x];
    return [x, y];
  }
  function tileHTML(p, ghost = false) {
    const def = E.tile(p.tileId),
      reachable = E.neighbors(state, state.position);
    const lines = def.adjacency
      .map(([a, b]) => {
        const [x, y] = point(a, p.rotation),
          [xx, yy] = point(b, p.rotation);
        return `<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}"/>`;
      })
      .join("");
    return `<div class="tile-cell ${ghost ? "ghost" : ""}" data-tile="${p.tileId}"><img class="tile-photo" src="${photo(def.image)}" alt="" style="transform:rotate(${p.rotation * 90}deg)"><div class="tile-name"><a href="${photo(def.image)}" target="_blank">${esc(def.displayName)} ↗</a><span>${ghost ? "미리보기" : p.rotation * 90 + "°"}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${def.spaces
      .map((n) => {
        const id = `${p.tileId}:${n.id}`,
          [x, y] = point(n.id, p.rotation),
          here = id === state.position,
          reach = !ghost && state.phase === "ready" && reachable.includes(id),
          loot = state.loot.find((l) => l.node === id)?.count || 0,
          figures = state.figures.filter((f) => f.node === id);
        const icons = n.icons.filter((i) => i.kind === "lamp").length
          ? "✦ "
          : "";
        return `<button class="space ${here ? "here" : ""} ${reach ? "reachable" : ""} ${ghost ? "ghost-space" : ""}" style="left:${x}%;top:${26 + y * 2.38}px" data-command="MOVE" data-args="${esc(JSON.stringify({ node: id }))}" ${reach ? "" : "disabled"} title="${esc(n.placeName || n.label)}${ghost ? " · 배치 예정" : ""}">${here ? "● 사냥꾼<br>" : ""}${icons}${esc(n.placeName || n.label)}${loot ? "<small>◇ × " + loot + "</small>" : ""}${figures
          .map((f) => {
            const a = state.assignments.find((a) => a.enemyId === f.kind);
            return `<span class="token" style="--marker:${colors[a.marker]}" title="${esc(E.definition(state, f.kind).name)} #${f.number}">${["①", "②", "③"][a.slot - 1]} #${f.number}</span>`;
          })
          .join("")}</button>`;
      })
      .join("")}${E.exits(p)
      .map(
        (e) =>
          `<span class="exit-tick exit-${e.edge}" title="${directionNames[e.edge]} 출입구">${{ N: "↑", S: "↓", W: "←", E: "→" }[e.edge]}</span>`,
      )
      .join("")}</div>`;
  }
  function preview() {
    if (!state.pending) {
      rotation = null;
      previewTile = null;
      return null;
    }
    const p = state.pending,
      options = E.placementOptions(state, p.tileId, p.anchor);
    if (previewTile !== p.tileId || !options.includes(rotation)) {
      rotation = options[0];
      previewTile = p.tileId;
    }
    const [dx, dy] = E.vectors[p.anchor.edge];
    return {
      tileId: p.tileId,
      rotation,
      x: p.anchor.x + dx,
      y: p.anchor.y + dy,
    };
  }
  function renderMap() {
    const ghost = preview(),
      placed = [...state.tiles, ...(ghost ? [ghost] : [])],
      open = E.openExits(state);
    const border = open.map((e) => {
      const [dx, dy] = E.vectors[e.edge];
      return { x: e.x + dx, y: e.y + dy };
    });
    const points = [...placed, ...border],
      minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x)),
      minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    const available = E.availableExits(state);
    let html = "";
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = placed.find((p) => p.x === x && p.y === y);
        if (p) html += tileHTML(p, !!ghost && p === ghost);
        else {
          const exit = available.find((e) => {
            const [dx, dy] = E.vectors[e.edge];
            return e.x + dx === x && e.y + dy === y;
          });
          html += `<div class="tile-empty">${exit && state.tileDeck.length ? button(`${directionNames[exit.edge]} 탐험`, "EXPLORE", { edge: exit.edge }, state.phase !== "ready", "explore-empty") : "미탐험 구역"}</div>`;
        }
      }
    $("chapterMap").style.gridTemplateColumns =
      `repeat(${maxX - minX + 1},290px)`;
    $("chapterMap").innerHTML = html;
    bind($("chapterMap"));
    $("tileCount").textContent =
      `공개 ${state.tiles.length + (state.pending ? 1 : 0)} / 7 · 더미 ${state.tileDeck.length}`;
    const n = E.graph(state).nodes.find((n) => n.id === state.position),
      def = E.tile(n.tileId);
    $("locationText").innerHTML =
      `<b>현재 위치 · ${esc(def.displayName)} / ${esc(n.placeName || n.label)}</b>${def.rules.length ? '<p class="muted">타일 원문 효과 (아직 미처리): ' + def.rules.map(esc).join(" ") + "</p>" : ""}`;
    $("explorationActions").innerHTML = state.tileDeck.length
      ? available
          .map((e) =>
            button(
              `${directionNames[e.edge]} 출입구로 탐험`,
              "EXPLORE",
              { edge: e.edge },
              state.phase !== "ready",
            ),
          )
          .join("")
      : '<p class="muted">챕터의 모든 타일을 공개했습니다. 실제 캠페인 전투와 임무 연결은 다음 단계입니다.</p>';
    if (!available.length && state.tileDeck.length)
      $("explorationActions").innerHTML =
        '<p class="muted">열린 출입구가 있는 칸으로 이동하면 탐험할 수 있습니다.</p>';
    bind($("explorationActions"));
    const focus = $("chapterMap").querySelector(
        ghost ? ".ghost" : ".space.here",
      ),
      viewport = $("mapViewport");
    if (focus) {
      const r = focus.getBoundingClientRect(),
        v = viewport.getBoundingClientRect();
      if (r.left < v.left + 12 || r.right > v.right - 12)
        viewport.scrollLeft += (r.left + r.right - v.left - v.right) / 2;
      if (r.top < v.top + 12 || r.bottom > v.bottom - 12)
        viewport.scrollTop += (r.top + r.bottom - v.top - v.bottom) / 2;
    }
  }
  function renderPlacement() {
    const box = $("placementPanel");
    if (state.phase === "placing") {
      const p = state.pending,
        d = E.tile(p.tileId),
        opts = E.placementOptions(state, p.tileId, p.anchor);
      box.innerHTML = `<p class="eyebrow">타일 공개 · 배치 선택</p><h2>${esc(d.displayName)}</h2><p>연결되는 출입구가 있도록 회전하세요. 점선 타일은 현재 방향의 미리보기입니다. 배치하면 적·소모품이 놓이고 사냥꾼이 연결된 칸으로 진입합니다.</p><div class="rotation-preview"><img src="${photo(d.image)}" style="transform:rotate(${rotation * 90}deg)" alt="공개한 타일"></div><div class="rotation-choices">${[0, 1, 2, 3].map((r) => `<button data-rotation="${r}" ${opts.includes(r) ? "" : "disabled"} class="${r === rotation ? "selected" : ""}" aria-pressed="${r === rotation}">${r * 90}°</button>`).join("")}</div>${button("이 방향으로 배치하고 진입", "PLACE_TILE", { rotation }, false, "primary")}<p class="muted">카드를 공개한 뒤에는 취소하고 다른 타일을 뽑을 수 없습니다.</p>`;
      box.querySelectorAll("[data-rotation]").forEach(
        (b) =>
          (b.onclick = () => {
            rotation = Number(b.dataset.rotation);
            render();
          }),
      );
      bind(box);
    } else if (state.phase === "relocate") {
      const job = state.spawnQueue[0];
      box.innerHTML = `<p class="eyebrow">피규어 공급 소진</p><h2>가장 먼 적을 재배치</h2><p>${esc(E.definition(state, job.kind).name)}의 피규어 4개가 모두 지도 위에 있습니다. 사냥꾼에게서 가장 먼 거리인 아래 피규어 중 하나를 선택하세요.</p><div class="actions">${state.relocationChoices
        .map((id) => {
          const f = state.figures.find((f) => f.id === id),
            d = E.distance(state, state.position, f.node),
            n = E.graph(state).nodes.find((n) => n.id === f.node);
          return button(
            `#${f.number} · ${esc(E.tile(n.tileId).displayName)} / ${esc(n.label)} · ${d}칸`,
            "RELOCATE",
            { figureId: id },
          );
        })
        .join("")}</div>`;
      bind(box);
    } else
      box.innerHTML =
        '<p class="eyebrow">탐험 순서</p><h2>출입구 너머로</h2><ol><li>사냥꾼을 열린 출입구 칸으로 이동</li><li>탐험을 눌러 더미 맨 위 타일 공개</li><li>회전 방향을 선택하고 배치</li><li>기호별 출현과 새 타일 진입 자동 처리</li></ol><p class="muted">이동 비용과 적 반응을 처리하지 않는 지도 검증 단계입니다. 같은 칸에 적이 있어도 현재는 전투가 시작되지 않습니다.</p>';
    $("resetMap").disabled = state.phase !== "ready";
    $("drawBehavior").disabled = state.phase !== "ready";
    $("resetCount").textContent = `이번 준비에서 초기화 ${state.resets}회`;
  }
  function renderDeck() {
    const used = ED.counts(state.enemyDiscard);
    $("behaviorCount").textContent = `남은 ${state.enemyDeck.length}장 / 6장`;
    $("behaviorSummary").innerHTML = Object.entries(ED.composition)
      .map(
        ([kind, n]) =>
          `<span>${ED.labels[kind]}<b>사용 ${used[kind]} / ${n}</b></span>`,
      )
      .join("");
    selectedKind = state.assignments.some((a) => a.enemyId === selectedKind)
      ? selectedKind
      : state.assignments[0].enemyId;
    $("behaviorEnemy").innerHTML = state.assignments
      .map(
        (a) =>
          `<option value="${a.enemyId}" ${a.enemyId === selectedKind ? "selected" : ""}>${esc(E.definition(state, a.enemyId).name)} · ${a.sideId.toUpperCase()}면</option>`,
      )
      .join("");
    const last = state.lastBehavior;
    if (last) {
      const d = E.definition(state, last.enemyId),
        a =
          d.side[
            last.kind === "basic"
              ? "basicAttack"
              : last.kind === "special"
                ? "specialAttack"
                : "ability"
          ];
      $("behaviorResult").innerHTML =
        `<span class="badge">${ED.labels[last.kind]}</span><h3>${esc(d.name)} · ${esc(a.name)}</h3>${last.kind !== "ability" ? `<p>속도 ${a.speed} · 피해 ${a.damage}${a.keywords.length ? " · " + a.keywords.map(esc).join(" · ") : ""}</p>` : `<p>공격이 아닌 전용 능력 · ${a.speed === null ? "공개 즉시" : `속도 ${a.speed}에 처리`}</p>`}${a.rules.map((r) => "<p>" + esc(r) + "</p>").join("")}<p class="muted">${last.kind === "basic" ? "단총으로 방해할 수 있는 기본 공격입니다." : "단총의 기본 공격 방해 대상이 아닙니다."} 이 영역은 카드 확인용이며 전투 효과는 적용하지 않습니다.</p>`;
    } else
      $("behaviorResult").innerHTML =
        '<p class="muted">아직 공개한 적 행동 카드가 없습니다.</p>';
    $("behaviorHistory").textContent =
      "공개 순서: " +
      (state.enemyDiscard.map((k) => ED.labels[k]).join(" → ") || "없음");
  }
  function render() {
    renderEnemies();
    renderMap();
    renderPlacement();
    renderDeck();
    $("chapterLog").innerHTML = [...state.events]
      .reverse()
      .map((t) => "<p>" + esc(t) + "</p>")
      .join("");
  }
  $("resetMap").onclick = () => send("RESET_MAP");
  $("behaviorEnemy").onchange = () => {
    selectedKind = $("behaviorEnemy").value;
  };
  $("drawBehavior").onclick = () =>
    send("DRAW_BEHAVIOR", { enemyId: selectedKind });
  $("newMap").onclick = () => {
    $("chapterSeed").value = crypto.getRandomValues(new Uint32Array(1))[0];
    $("setupError").textContent = "";
    $("setupDialog").showModal();
  };
  $("cancelSetup").onclick = () => $("setupDialog").close();
  $("confirmSetup").onclick = () => {
    try {
      state = E.create(Number($("chapterSeed").value), $("startSpace").value);
      rotation = null;
      previewTile = null;
      save();
      render();
      $("setupDialog").close();
      $("chapterError").textContent = "";
    } catch (e) {
      $("setupError").textContent = e.message;
    }
  };
  $("exportMap").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([E.exportSave(state)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `bloodborne-chapter1-map-${state.seed}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("importMap").onclick = () => $("mapFile").click();
  $("mapFile").onchange = async () => {
    const f = $("mapFile").files[0];
    if (!f) return;
    try {
      state = E.importSave(await f.text());
      rotation = null;
      previewTile = null;
      save();
      render();
      $("chapterError").textContent = "";
    } catch (e) {
      $("chapterError").textContent = e.message;
    }
    $("mapFile").value = "";
  };
  render();
  save();
  if (startupError) $("chapterError").textContent = startupError;
})();
