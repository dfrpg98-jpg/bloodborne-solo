(function (root) {
  "use strict";
  const local = typeof module !== "undefined" && module.exports;
  const E = local ? require("./hunt-engine") : root.BBHunt;
  const M = local ? require("./chapter-engine") : root.BBChapter;
  const G = local ? require("./tile-geometry") : root.BBTileGeometry;
  const C = local ? require("./hunt-context") : root.BBHuntContext;
  const edges = ["N", "E", "S", "W"], names = { N: "위", E: "오른쪽", S: "아래", W: "왼쪽" };

  function directionsFor(dx, dy) {
    const horizontal = dx > 0 ? "E" : "W", vertical = dy > 0 ? "S" : "N";
    if (Math.abs(dx) > Math.abs(dy)) return [horizontal];
    if (Math.abs(dy) > Math.abs(dx)) return [vertical];
    // Two equally plausible directions expose the same explicit destination.
    // Never choose a half-tile branch from a rounded visual coordinate.
    return dx || dy ? [vertical, horizontal] : [];
  }
  function stepDirections(state, from, to) {
    const a = E.node(state, from), b = E.node(state, to);
    const placedA = state.world.tiles.find(tile => tile.tileId === a?.tile);
    const placedB = state.world.tiles.find(tile => tile.tileId === b?.tile);
    if (!placedA || !placedB) return [];
    if (a.tile !== b.tile) return directionsFor(placedB.x - placedA.x, placedB.y - placedA.y);
    const pa = G.point(a.tile, a.spaceId, placedA.rotation), pb = G.point(b.tile, b.spaceId, placedB.rotation);
    return directionsFor(pb[0] - pa[0], pb[1] - pa[1]);
  }
  function movement(state, selection = {}) {
    const h = E.hunter(state), card = h.hand.find(card => card.id === selection.cardId);
    const locked = E.rewardsView?.(state)?.choices?.length ? "획득한 보상 선택을 먼저 마치세요." :
      h.inDream || h.hp <= 0 ? "지도에서 이동할 수 없습니다." : "";
    const moving = state.phase === "move" && !!state.move;
    const phaseReason = moving ? "" : state.phase === "hunter" ? "손패를 고른 뒤 이동 선언을 누르세요." :
      state.phase === "tile_place" ? "새 타일의 방향을 선택하고 배치하세요." : "행동 패널의 현재 선택을 먼저 마치세요.";
    const result = { moving, remaining: moving ? state.move.remaining : null,
      start: { enabled: !locked && state.phase === "hunter" && !!card,
        reason: locked || (state.phase !== "hunter" ? phaseReason : !card ? "이동에 쓸 손패 1장을 선택하세요." : ""),
        command: { type: "MOVE", cardId: card?.id || null } },
      stop: { enabled: !locked && moving && (!E.canStopMove || E.canStopMove(state)),
        reason: locked || phaseReason || (E.canStopMove && !E.canStopMove(state) ? "한 칸 이상 이동하세요." : ""), command: { type: "STOP_MOVE" } },
      cancel: { enabled: !locked && !!E.canCancelMove?.(state), command: { type: "CANCEL_MOVE" } },
      hint: locked || phaseReason || (state.move.costPending ? "첫 칸 진입 시 손패 1장 소모" : `남은 이동력 ${state.move.remaining} · 방향을 선택하세요.`),
      directions: edges.map(edge => ({ edge, name: names[edge], options: [] })) };
    if (!h.position || h.inDream) return result;
    const add = (edge, action, label) => {
      const direction = result.directions.find(direction => direction.edge === edge);
      if (!direction || !action) return;
      direction.options.push({ label, command: action.command,
        enabled: moving && action.enabled && !locked,
        reason: locked || (!moving ? phaseReason : action.reason), cost: action.cost });
    };
    for (const to of E.neighbors(state, h.position)) {
      const action = C.view(state, { kind: "cell", node: to }, selection).actions.find(action => action.id === "move");
      for (const edge of stepDirections(state, h.position, to)) add(edge, action, E.node(state, to).name);
    }
    // Only the count of the remaining deck is public. Drawing and placement
    // remain EXPLORE and PLACE_TILE commands in the existing controller.
    if (state.world.tileDeck.length) for (const exit of M.openExits(state.world).filter(exit => exit.node === h.position)) {
      const action = C.view(state, { kind: "entrance", node: exit.node, edge: exit.edge }, selection)
        .actions.find(action => action.id === "explore");
      add(exit.edge, action, `${names[exit.edge]} 출입구로 탐험`);
    }
    return result;
  }

  function tileInfo(state, tileId, options = {}) {
    const placed = state.world.tiles.find(tile => tile.tileId === tileId);
    if (!placed) return null;
    const tile = M.tile(tileId), h = E.hunter(state), mission = E.missionView?.(state);
    const fog = !!mission?.fog?.includes(tileId), prefix = tileId + ":";
    const tokens = (mission?.tokens || []).map(token => ({ ...token,
      node: token.carrierId === state.activeHunterId && !h.inDream ? h.position : token.node }))
      .filter(token => token.node?.startsWith(prefix));
    const carried = mission?.counters?.find(counter => counter.id === "survivors-held");
    if (carried?.value > 0 && h.position?.startsWith(prefix) && !h.inDream)
      tokens.push({ id: "survivors-held", name: "구조한 생존자", node: h.position,
        carrierId: state.activeHunterId, count: carried.value });
    const requested = options.node && tile.spaces.some(space => prefix + space.id === options.node) ? options.node : null;
    const selectedNode = requested || (!h.inDream && h.position?.startsWith(prefix) ? h.position : prefix + tile.spaces[0]?.id);
    const selectedSpaces = options.selectedOnly ? tile.spaces.filter(space => prefix + space.id === selectedNode) : tile.spaces;
    const spaces = selectedSpaces.map(space => {
      const node = prefix + space.id, atHunter = !h.inDream && node === h.position;
      const enemies = state.enemies.filter(enemy => enemy.node === node).map(enemy => {
        const def = E.enemyDef(state, enemy);
        return { id: enemy.id, name: def.name, figure: enemy.figure, hp: enemy.hp,
          maxHp: def.maxHp ?? def.health, insight: C.enemyInsightTokens(state, enemy) };
      });
      const interactions = [];
      if (space.icons.some(icon => icon.kind === "lamp")) interactions.push(fog ?
        "망가진 등불 · 사용 및 꿈 복귀 불가" : tileId === "tile-14" && space.id === "center" ?
          "중앙 등불 · 상호작용으로 순간이동" : "등불 · 꿈에서 돌아올 수 있는 칸");
      const loot = state.loot.filter(id => id === node).length;
      if (loot) interactions.push(`보물상자 · 남은 소모품 ${loot}개`);
      if (tileId === "tile-12") interactions.push("상호작용 · 치유 2");
      if (node === "tile-07:top") interactions.push("상호작용 · 소모품 1개를 피의 유지 1개로 교환");
      if (node === "tile-20:room") interactions.push("차례마다 한 번 · 피해 1을 받고 손패 1장 뽑기");
      if (atHunter && E.interactionOptions(state).missionRescue) interactions.push("임무 대상과 상호작용 가능");
      return { node, name: space.placeName || space.label, atHunter, enemies, loot,
        interactions, tokens: tokens.filter(token => token.node === node) };
    });
    return { id: tileId, name: tile.named ? tile.displayName : null, fog, rules: [...(tile.rules || [])], selectedNode, spaces };
  }

  function uprightSVG(source, rotation) {
    const angle = (((rotation % 4) + 4) % 4) * -90;
    if (!angle) return source;
    return source.replace(/<text\b([^>]*)>/g, (tag, attributes) => {
      if (!/\bdata-space-label=/.test(attributes)) return tag;
      const x = attributes.match(/\bx="([\d.\-]+)"/)?.[1], y = attributes.match(/\by="([\d.\-]+)"/)?.[1];
      if (x === undefined || y === undefined) return tag;
      const transform = `rotate(${angle} ${x} ${y})`;
      return /\btransform="/.test(attributes) ? tag.replace(/transform="([^"]*)"/, (_, prior) => `transform="${transform} ${prior}"`) :
        `<text${attributes} transform="${transform}">`;
    });
  }
  const sources = new Map(), images = new Map();
  function uprightTileImages(container, environment = root) {
    if (!environment.fetch || !environment.URL?.createObjectURL || !environment.Blob) return;
    for (const image of container.querySelectorAll("[data-tile-art]")) {
      const tileId = image.dataset.tileArt, rotation = Number(image.dataset.tileRotation);
      if (!rotation) continue;
      const path = G.image(tileId), key = `${tileId}:${rotation}`;
      if (!sources.has(tileId)) sources.set(tileId, environment.fetch(path).then(response => {
        if (!response.ok) throw new Error("Tile artwork unavailable");
        return response.text();
      }));
      if (!images.has(key)) images.set(key, sources.get(tileId).then(source => environment.URL.createObjectURL(
        new environment.Blob([uprightSVG(source, rotation)], { type: "image/svg+xml" }))));
      images.get(key).then(url => { if (image.isConnected !== false) image.src = url; }).catch(() => {
        // The original illustration remains a readable fallback if unavailable.
      });
    }
  }
  const api = { movement, tileInfo, stepDirections, uprightSVG, uprightTileImages };
  if (local) module.exports = api;
  else root.BBHuntMapControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
