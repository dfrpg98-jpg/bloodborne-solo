(function (root) {
  "use strict";
  // Executable setup/map layer. Combat, turns and mission effects are deliberately
  // not simulated here. Every exposed command is labelled as a layout test in UI.
  const C =
    typeof module !== "undefined" && module.exports
      ? require("./campaigns/long-hunt/data.json")
      : root.BBLongHunt;
  const ED =
    typeof module !== "undefined" && module.exports
      ? require("./enemy-deck.js")
      : root.BBEnemyDeck;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const need = (ok, text) => {
    if (!ok) throw new Error(text);
  };
  const directions = ["N", "E", "S", "W"];
  const vectors = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const opposite = (edge) => directions[(directions.indexOf(edge) + 2) % 4];
  const rotate = (edge, rotation) =>
    directions[(directions.indexOf(edge) + rotation) % 4];
  const tile = (id) => C.tiles.find((t) => t.id === id);
  const enemy = (id) => C.enemies.find((e) => e.id === id);
  const at = (s, x, y) => s.tiles.find((t) => t.x === x && t.y === y);
  const nodeId = (tileId, spaceId) => `${tileId}:${spaceId}`;
  const note = (s, text) => {
    s.events.push(text);
    if (s.events.length > 100) s.events.shift();
  };
  function random(s) {
    let x = s.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
  }
  function shuffle(s, xs) {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  }
  function mixSeed(seed) {
    // Avalanche nearby user-entered seeds before the first small permutation.
    let x = seed >>> 0 || 1;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0 || 1;
  }
  function exits(placed) {
    return tile(placed.tileId).exits.map((e) => ({
      edge: rotate(e.edge, placed.rotation),
      node: nodeId(placed.tileId, e.spaceId),
      x: placed.x,
      y: placed.y,
      tileId: placed.tileId,
    }));
  }
  function graph(s) {
    const nodes = [],
      edges = [];
    for (const p of s.tiles) {
      const def = tile(p.tileId);
      nodes.push(
        ...def.spaces.map((n) => ({
          ...n,
          id: nodeId(p.tileId, n.id),
          spaceId: n.id,
          tileId: p.tileId,
        })),
      );
      edges.push(
        ...def.adjacency.map(([a, b]) => [
          nodeId(p.tileId, a),
          nodeId(p.tileId, b),
        ]),
      );
      for (const e of exits(p)) {
        const [dx, dy] = vectors[e.edge],
          other = at(s, p.x + dx, p.y + dy);
        const match =
          other && exits(other).find((x) => x.edge === opposite(e.edge));
        if (match && e.node < match.node) edges.push([e.node, match.node]);
      }
    }
    return { nodes, edges };
  }
  function neighbors(s, id) {
    return graph(s)
      .edges.filter((e) => e.includes(id))
      .map((e) => e.find((x) => x !== id));
  }
  function distance(s, from, to) {
    const q = [[from, 0]],
      seen = new Set([from]),
      g = graph(s);
    for (let i = 0; i < q.length; i++) {
      const [id, n] = q[i];
      if (id === to) return n;
      for (const e of g.edges.filter((e) => e.includes(id))) {
        const next = e.find((x) => x !== id);
        if (!seen.has(next)) {
          seen.add(next);
          q.push([next, n + 1]);
        }
      }
    }
    return Infinity;
  }
  function openExits(s) {
    return s.tiles.flatMap(exits).filter((e) => {
      const [dx, dy] = vectors[e.edge];
      return !at(s, e.x + dx, e.y + dy);
    });
  }
  function availableExits(s) {
    return openExits(s).filter((e) => e.node === s.position);
  }
  function placementOptions(
    s,
    tileId,
    anchor,
    requireOpen = s.rulesVersion >= 8 || s.tileDeck.length > 0,
  ) {
    const [dx, dy] = vectors[anchor.edge],
      x = anchor.x + dx,
      y = anchor.y + dy;
    if (at(s, x, y)) return [];
    return [0, 1, 2, 3].filter((rotation) => {
      const p = { tileId, x, y, rotation };
      if (!exits(p).some((e) => e.edge === opposite(anchor.edge))) return false;
      return (
        !requireOpen || openExits({ ...s, tiles: [...s.tiles, p] }).length > 0
      );
    });
  }
  function definition(s, kind) {
    const a = s.assignments.find((a) => a.enemyId === kind),
      d = enemy(kind);
    return {
      ...d,
      side: d.sides.find((x) => x.id === a.sideId),
      slot: a.slot,
      marker: a.marker,
    };
  }
  function populate(s, placed) {
    for (const space of tile(placed.tileId).spaces)
      for (const icon of space.icons) {
        const node = nodeId(placed.tileId, space.id);
        if (icon.kind === "consumable")
          s.loot.push({ node, count: icon.count });
        if (icon.kind === "spawn")
          for (let i = 0; i < icon.count; i++) {
            const a = s.assignments.find((x) => x.marker === icon.markerId);
            need(a, "출현 기호에 해당하는 적이 없습니다.");
            s.spawnQueue.push({ kind: a.enemyId, node });
          }
      }
  }
  function farthest(s, kind) {
    const figures = s.figures.filter((f) => f.kind === kind);
    const max = Math.max(
      ...figures.map((f) => distance(s, s.position, f.node)),
    );
    return figures
      .filter((f) => distance(s, s.position, f.node) === max)
      .map((f) => f.id);
  }
  function relocate(s, id) {
    const job = s.spawnQueue.shift(),
      f = s.figures.find((f) => f.id === id);
    f.node = job.node;
    note(
      s,
      `${enemy(job.kind).name} #${f.number}: 공급 4개 소진 → 가장 먼 피규어를 재배치했습니다.`,
    );
  }
  function finishSpawns(s) {
    while (s.spawnQueue.length) {
      const job = s.spawnQueue[0],
        count = enemy(job.kind).miniatureCount;
      const free = Array.from({ length: count }, (_, i) => i + 1).find(
        (n) => !s.figures.some((f) => f.id === `${job.kind}-${n}`),
      );
      if (free) {
        s.figures.push({
          id: `${job.kind}-${free}`,
          kind: job.kind,
          number: free,
          node: job.node,
        });
        s.spawnQueue.shift();
        note(s, `${enemy(job.kind).name} #${free} 출현.`);
      } else {
        const candidates = farthest(s, job.kind);
        if (candidates.length > 1) {
          s.phase = "relocate";
          s.relocationChoices = candidates;
          return;
        }
        relocate(s, candidates[0]);
      }
    }
    s.relocationChoices = [];
    if (s.pendingEntry) {
      s.position = s.pendingEntry;
      s.pendingEntry = null;
      note(s, "구성물 배치 후 공개한 타일의 연결된 칸으로 진입했습니다.");
    }
    s.phase = "ready";
  }
  function create(seed = 20261011, startSpace = "center", chapterNumber = 1,
    options = {}) {
    need(
      Number.isInteger(seed) && seed >= 0 && seed <= 4294967295,
      "시드는 0~4294967295 사이의 정수여야 합니다.",
    );
    const central = C.tiles.find((t) => t.name === "중앙 등불");
    need(
      central.spaces.some((n) => n.id === startSpace),
      "중앙 등불 타일의 시작 칸을 선택하세요.",
    );
    const chapter = C.chapters.find((c) => c.number === chapterNumber);
    need(chapter, "지원하는 챕터를 선택하세요.");
    const rulesVersion = Object.hasOwn(options, "rulesVersion")
      ? options.rulesVersion : options.legacyReplay ? null : 9;
    need(rulesVersion === null || [7, 8, 9, 10].includes(rulesVersion),
      "지원하는 규칙 버전을 선택하세요.");
    const required = chapter.requiredTiles.map(
      (name) => C.tiles.find((t) => t.name === name).id,
    );
    const s = {
      format: "bloodborne-chapter-map",
      version: 1,
      chapter: chapterNumber,
      playerCount: 1,
      seed: seed >>> 0 || 1,
      rng: mixSeed(seed),
      startSpace,
      ...(rulesVersion !== null ? { rulesVersion } : {}),
      revision: 0,
      phase: "ready",
      assignments: [],
      tilePool: [],
      tileDeck: [],
      tiles: [{ tileId: central.id, x: 0, y: 0, rotation: 0 }],
      position: nodeId(central.id, startSpace),
      figures: [],
      loot: [],
      pending: null,
      pendingEntry: null,
      spawnQueue: [],
      relocationChoices: [],
      enemyDeck: [],
      enemyDiscard: [],
      lastBehavior: null,
      resets: 0,
      events: [],
      commands: [],
    };
    const kinds = shuffle(
      s,
      chapter.enemies.map((name) => C.enemies.find((e) => e.name === name).id),
    );
    s.assignments = kinds.map((enemyId, i) => ({
      enemyId,
      sideId: random(s) < 0.5 ? "a" : "b",
      slot: i + 1,
      marker: ["gold", "red", "purple"][i],
    }));
    const unused = shuffle(
      s,
      C.tiles
        .filter((t) => t.id !== central.id && !required.includes(t.id))
        .map((t) => t.id),
    );
    let special = null;
    if (chapter.specialSetupCards.includes(17)) {
      const index = unused.findIndex((id) => new Set(tile(id).exits.map((e) => e.edge)).size >= 2);
      need(index >= 0, "특수 준비의 연결 타일을 찾을 수 없습니다.");
      special = unused.splice(index, 1)[0];
    }
    const extras = unused.slice(
      0,
      Math.min(chapter.randomTiles.perHunter, chapter.randomTiles.maximum),
    );
    s.tilePool = [central.id, ...required, ...extras, ...(special ? [special] : [])];
    let remaining = [...required, ...extras];
    if (special) {
      const grave = C.tiles.find((t) => t.name === "공동묘지").id,
        crypt = C.tiles.find((t) => t.name === "오에돈의 지하묘지").id;
      function connect(id, anchor) {
        const rotation = placementOptions(s, id, anchor, false)[0];
        need(rotation !== undefined, "특수 준비 타일의 출입구를 연결할 수 없습니다.");
        const [dx, dy] = vectors[anchor.edge];
        const p = {tileId:id,x:anchor.x+dx,y:anchor.y+dy,rotation};
        s.tiles.push(p);
        return p;
      }
      const north = openExits(s).find((e) => e.tileId === central.id && e.edge === "N");
      connect(grave, north);
      const south = openExits(s).find((e) => e.tileId === central.id && e.edge === "S");
      const bridge = connect(special, south);
      const exit = openExits(s).find((e) => e.tileId === bridge.tileId);
      need(exit, "특수 준비 연결 타일에는 두 번째 출입구가 필요합니다.");
      connect(crypt, exit);
      remaining = remaining.filter((id) => id !== grave && id !== crypt);
      s.specialSetup = {card:17,connector:special};
    }
    s.tileDeck = shuffle(s, remaining);
    s.enemyDeck = ED.create(s, shuffle);
    note(
      s,
      chapterNumber === 1 ? "챕터 1 준비: 적 3종의 면과 슬롯 배정 · 지정 타일 4개 + 무작위 타일 2개 · 공용 적 행동 덱 6장." :
        `챕터 ${chapterNumber} 준비: 특수 준비 17번 · 선공개 타일4개, 더미5개 · 공용 적 행동 덱6장.`,
    );
    assertState(s);
    return s;
  }
  function dispatch(previous, command) {
    need(command && typeof command === "object", "명령 형식 오류.");
    const s = clone(previous),
      a = command;
    need(
      s.commands.length < 2000,
      "저장 기록 한도에 도달했습니다. 새 준비로 시작하세요.",
    );
    if (a.type === "PLACE_TILE") {
      need(s.phase === "placing" && s.pending, "배치할 공개 타일이 없습니다.");
      const p = s.pending;
      need(
        placementOptions(s, p.tileId, p.anchor).includes(a.rotation),
        "연결 가능한 회전 방향을 선택하세요.",
      );
      const [dx, dy] = vectors[p.anchor.edge];
      const placed = {
        tileId: p.tileId,
        x: p.anchor.x + dx,
        y: p.anchor.y + dy,
        rotation: a.rotation,
      };
      s.tiles.push(placed);
      s.pending = null;
      s.pendingEntry = exits(placed).find(
        (e) => e.edge === opposite(p.anchor.edge),
      ).node;
      populate(s, placed);
      finishSpawns(s);
      note(
        s,
        `${tile(p.tileId).displayName} 배치 · 시계 방향 ${a.rotation * 90}°.`,
      );
    } else if (a.type === "RELOCATE") {
      need(
        s.phase === "relocate" && s.relocationChoices.includes(a.figureId),
        "가장 먼 적 중 하나를 선택하세요.",
      );
      relocate(s, a.figureId);
      finishSpawns(s);
    } else {
      need(s.phase === "ready", "타일 배치와 출현 처리를 먼저 완료하세요.");
      if (a.type === "MOVE") {
        need(
          neighbors(s, s.position).includes(a.node),
          "연결된 인접 칸으로만 이동할 수 있습니다.",
        );
        s.position = a.node;
        note(
          s,
          `탐험 검증 이동 → ${tile(a.node.split(":")[0]).displayName} / ${graph(s).nodes.find((n) => n.id === a.node).label}.`,
        );
      } else if (a.type === "EXPLORE") {
        const anchor = availableExits(s).find((e) => e.edge === a.edge);
        need(anchor, "현재 칸의 열린 출입구를 선택하세요.");
        need(s.tileDeck.length, "타일 더미를 모두 공개했습니다.");
        // Rulebook p.15 has no exception for the final tile. Keep the previous
        // interpretation only while replaying saves made under older rules.
        const rejected = [];
        let next = null;
        const needsExit = s.rulesVersion >= 8 || s.tileDeck.length > 1;
        while (s.tileDeck.length) {
          const id = s.tileDeck.shift();
          if (placementOptions(s, id, anchor, needsExit).length) {
            next = id;
            break;
          }
          rejected.push(id);
        }
        need(next, "어느 남은 타일도 열린 출입구를 유지할 수 없습니다.");
        if (rejected.length) {
          s.tileDeck = shuffle(s, [...s.tileDeck, ...rejected]);
          note(
            s,
            `모든 출입구를 막는 타일 ${rejected.length}개를 되돌려 섞고 다음 타일을 공개했습니다.`,
          );
        }
        s.pending = { tileId: next, anchor };
        s.phase = "placing";
        note(
          s,
          `${tile(next).displayName} 공개. 연결 방향을 정하면 반드시 새 타일로 진입합니다.`,
        );
      } else if (a.type === "RESET_MAP") {
        s.figures = [];
        s.loot = [];
        s.spawnQueue = [];
        s.resets++;
        for (const placed of s.tiles) populate(s, placed);
        finishSpawns(s);
        note(
          s,
          "지도 초기화 검증: 공개된 타일의 적과 소모품을 재배치했습니다. 적 배정·사용 면·타일 더미·적 행동 덱은 유지합니다.",
        );
      } else if (a.type === "DRAW_BEHAVIOR") {
        need(
          s.assignments.some((x) => x.enemyId === a.enemyId),
          "행동을 확인할 적 종류를 선택하세요.",
        );
        const kind = ED.draw(s, shuffle),
          def = definition(s, a.enemyId);
        s.lastBehavior = { enemyId: a.enemyId, kind, sideId: def.side.id };
        note(
          s,
          `행동 덱 확인: ${def.name} ${def.side.label} · ${ED.labels[kind]}. 전투 효과는 이 탐험 화면에서 실행하지 않습니다.`,
        );
      } else need(false, "지원하지 않는 명령입니다.");
    }
    s.commands.push(clone(a));
    s.revision++;
    assertState(s);
    return s;
  }
  function assertState(s) {
    need(
      s &&
        s.format === "bloodborne-chapter-map" &&
        s.version === 1 &&
        [1,2,3].includes(s.chapter) &&
        s.playerCount === 1,
      "챕터 준비 저장 형식 오류.",
    );
    need(["ready", "placing", "relocate"].includes(s.phase), "진행 상태 오류.");
    need(s.rulesVersion === undefined || [7, 8, 9, 10].includes(s.rulesVersion),
      "지원하지 않는 규칙 버전입니다.");
    need(
      s.assignments.length === 3 &&
        new Set(s.assignments.map((a) => a.enemyId)).size === 3,
      "적 배정 오류.",
    );
    s.assignments.forEach((a, i) =>
      need(
        a.slot === i + 1 &&
          a.marker === ["gold", "red", "purple"][i] &&
          enemy(a.enemyId)?.sides.some((x) => x.id === a.sideId),
        "적 면/기호 배정 오류.",
      ),
    );
    need(
      s.tiles.length >= 1 &&
        s.tiles.every(
          (p) =>
            tile(p.tileId) &&
            Number.isInteger(p.x) &&
            Number.isInteger(p.y) &&
            [0, 1, 2, 3].includes(p.rotation),
        ),
      "타일 배치 오류.",
    );
    need(
      new Set(s.tiles.map((p) => `${p.x},${p.y}`)).size === s.tiles.length,
      "타일이 겹쳤습니다.",
    );
    const all = [
      ...s.tiles.map((p) => p.tileId),
      ...s.tileDeck,
      ...(s.pending ? [s.pending.tileId] : []),
    ];
    need(
      all.length === (s.chapter === 1 ? 7 : 9) &&
        new Set(all).size === all.length &&
        all.every((id) => s.tilePool.includes(id)) &&
        s.tilePool.length === all.length,
      "타일 수량 오류.",
    );
    const nodes = new Set(graph(s).nodes.map((n) => n.id));
    need(nodes.has(s.position), "사냥꾼 위치 오류.");
    need(
      s.figures.length <= 12 &&
        new Set(s.figures.map((f) => f.id)).size === s.figures.length,
      "피규어 수량 오류.",
    );
    for (const f of s.figures)
      need(
        enemy(f.kind) &&
          nodes.has(f.node) &&
          f.number >= 1 &&
          f.number <= 4 &&
          f.id === `${f.kind}-${f.number}`,
        "피규어 상태 오류.",
      );
    for (const d of C.enemies)
      need(
        s.figures.filter((f) => f.kind === d.id).length <= d.miniatureCount,
        "종류별 피규어 공급 초과.",
      );
    need(ED.valid(s), "적 행동 덱 수량 오류.");
    need(
      s.loot.every((x) => nodes.has(x.node) && [1, 2].includes(x.count)),
      "소모품 토큰 오류.",
    );
    need(
      Array.isArray(s.commands) &&
        s.commands.length <= 2000 &&
        s.commands.length === s.revision,
      "명령 기록 오류.",
    );
    need(Array.isArray(s.events) && s.events.length <= 100, "기록 오류.");
    need((s.phase === "placing") === !!s.pending, "미배치 타일 상태 오류.");
    if (s.phase === "relocate")
      need(
        s.spawnQueue.length && s.relocationChoices.length > 1,
        "재배치 선택 오류.",
      );
    return true;
  }
  const canonical = (x) =>
    Array.isArray(x)
      ? "[" + x.map(canonical).join(",") + "]"
      : x && typeof x === "object"
        ? "{" +
          Object.keys(x)
            .sort()
            .map((k) => JSON.stringify(k) + ":" + canonical(x[k]))
            .join(",") +
          "}"
        : JSON.stringify(x);
  function exportSave(s) {
    assertState(s);
    return JSON.stringify(s, null, 2);
  }
  function importSave(text) {
    need(
      typeof text === "string" && text.length < 2000000,
      "저장 파일은 2MB 이하여야 합니다.",
    );
    const input = JSON.parse(text);
    assertState(input);
    let s = create(input.seed, input.startSpace, input.chapter,
      { rulesVersion: input.rulesVersion ?? null });
    for (const a of input.commands) s = dispatch(s, a);
    need(
      canonical(s) === canonical(input),
      "저장 상태와 명령 기록이 일치하지 않습니다.",
    );
    return s;
  }
  const api = {
    create,
    dispatch,
    assertState,
    exportSave,
    importSave,
    graph,
    neighbors,
    distance,
    openExits,
    availableExits,
    placementOptions,
    definition,
    tile,
    exits,
    directions,
    vectors,
    data: C,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBChapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
