(function (root, factory) {
  "use strict";
  const local = typeof module !== "undefined" && module.exports;
  const api = factory(local ? require("./chapter-engine") : root.BBChapter);
  if (local) module.exports = api; else root.BBHuntLocationLabels = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (M) {
  "use strict";
  // A map address identifies an unnamed tile without inventing a printed name.
  // Never inspect an undrawn tile or use its development ID as a player name.
  function tile(state, tileId, preview) {
    const placed = state.world?.tiles?.find(item => item.tileId === tileId);
    if (!placed && state.world?.pending?.tileId !== tileId) return null;
    const p = placed || preview, definition = M.tile(tileId);
    if (!definition) return null;
    const origin = state.world.tiles.find(item => item.tileId === "tile-14") || { x: 0, y: 0 };
    const x = Number.isFinite(p?.x) ? p.x - origin.x : null,
      y = Number.isFinite(p?.y) ? p.y - origin.y : null;
    const address = x === null || y === null ? "새 지도 구역" :
      [y && `${y < 0 ? "북쪽" : "남쪽"} ${Math.abs(y)}`, x && `${x < 0 ? "서쪽" : "동쪽"} ${Math.abs(x)}`]
        .filter(Boolean).join(" · ") + (x || y ? " 구역" : "시작 구역");
    return { name: definition.named ? definition.displayName : null,
      reference: definition.named ? definition.displayName : address, address,
      cellCount: definition.spaces.length };
  }
  function node(state, nodeId, engine) {
    const n = engine.node(state, nodeId);
    if (!n) return "지도 밖";
    const identity = tile(state, n.tile || n.tileId);
    if (!identity || identity.name) return n.name;
    return `${identity.reference} / ${n.placeName || n.label || n.spaceId}`;
  }
  return Object.freeze({ tile, node });
});
