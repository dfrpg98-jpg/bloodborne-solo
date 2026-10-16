(function (root) {
  "use strict";
  const G = typeof module !== "undefined" && module.exports
    ? require("./tile-geometry.js") : root.BBTileGeometry;
  // This module receives visible positions only. It never reads rules, saves,
  // command history, random state or unrevealed mission information.
  const radii = { marker: 6, enemy: 6, hunter: 6, token: 5 };
  const separation = 2;
  const visualSizes = { enemy: [18, 28], hunter: [18, 28], token: [10, 16],
    lamp: [11, 20], chest: [14, 12], spawn: [12, 12] };
  function dimensions(type, value = {}) {
    const defaults = visualSizes[type] || visualSizes.spawn;
    return { visualWidth: Number.isFinite(value.visualWidth) && value.visualWidth > 0
        ? Math.min(100, value.visualWidth) : defaults[0],
      visualHeight: Number.isFinite(value.visualHeight) && value.visualHeight > 0
        ? Math.min(100, value.visualHeight) : defaults[1] };
  }
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ordered = (list) => [...(Array.isArray(list) ? list : [])].filter(Boolean)
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "en"));
  function inside(point, polygon) {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  }
  function boundaryDistance(point, polygon) {
    let value = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1,
        ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
      value = Math.min(value, distance(point, [a[0] + t * dx, a[1] + t * dy]));
    }
    return value;
  }
  function clearance(point, radius, occupied) {
    return occupied.reduce((value, other) => Math.min(value,
      distance(point, other.point) - radius - other.radius), Infinity);
  }
  function candidates(preferred, polygon) {
    const list = [preferred];
    // Actor feet are packed in tile coordinates; upright token bodies are tested after rotation.
    for (const step of [14, 28, 42]) for (const [dx, dy] of
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]])
      list.push([preferred[0] + dx * step, preferred[1] + dy * step]);
    const minX = Math.min(...polygon.map(p => p[0])), maxX = Math.max(...polygon.map(p => p[0]));
    const minY = Math.min(...polygon.map(p => p[1])), maxY = Math.max(...polygon.map(p => p[1]));
    for (let y = minY + 6; y < maxY; y += 5)
      for (let x = minX + 6; x < maxX; x += 5) list.push([x, y]);
    const unique = new Map(list.map(point => [point.join(","), point]));
    return [...unique.values()].filter(point => inside(point, polygon));
  }
  function place(preferred, polygon, occupied, radius) {
    const options = candidates(preferred, polygon).filter(point => boundaryDistance(point, polygon) >= radius);
    if (!options.length) {
      // Tiny or densely occupied cells retain their logical node. The renderer
      // may collapse crowded entries to a count badge rather than hide actors.
      const point = candidates(preferred, polygon).sort((a, b) =>
        boundaryDistance(b, polygon) - boundaryDistance(a, polygon) || distance(a, preferred) - distance(b, preferred))[0];
      return { point: point || preferred, crowded: true, reason: "cell-too-narrow" };
    }
    options.sort((a, b) => distance(a, preferred) - distance(b, preferred) || a[1] - b[1] || a[0] - b[0]);
    const free = options.find(point => clearance(point, radius, occupied) >= separation);
    if (free) return { point: free, crowded: false };
    const touching = options.find(point => clearance(point, radius, occupied) >= 0);
    if (touching) return { point: touching, crowded: true, reason: "spacing-reduced" };
    options.sort((a, b) => clearance(b, radius, occupied) - clearance(a, radius, occupied) ||
      distance(a, preferred) - distance(b, preferred) || a[1] - b[1] || a[0] - b[0]);
    return { point: options[0], crowded: true, reason: "cell-crowded" };
  }
  function bodyRect(point, visual, rotation) {
    const [x, y] = G.rotatePoint(point, rotation);
    // Sprites remain upright when the tile turns. These are screen-space bounds,
    // expressed in tile percentages and anchored at the bottom/feet.
    return { left: x - visual.visualWidth / 2, right: x + visual.visualWidth / 2,
      top: y - visual.visualHeight, bottom: y + 3 };
  }
  function intersection(a, b) {
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }
  function outsideArea(rect) {
    return (rect.right - rect.left) * (rect.bottom - rect.top) - intersection(rect,
      { left: 0, top: 0, right: 100, bottom: 100 });
  }
  function placeToken(preferred, polygon, occupied, radius, rotation, visual) {
    const bodies = occupied.map(other => bodyRect(other.point, other.visual, rotation));
    const [preferredX, preferredY] = G.rotatePoint(preferred, rotation);
    const xEdges = new Set([preferredX, visual.visualWidth / 2 + 1, 99 - visual.visualWidth / 2]);
    const yEdges = new Set([preferredY, visual.visualHeight + 1, 96]);
    for (const body of bodies) {
      xEdges.add(body.left - visual.visualWidth / 2 - 1);
      xEdges.add(body.right + visual.visualWidth / 2 + 1);
      yEdges.add(body.top - 4);
      yEdges.add(body.bottom + visual.visualHeight + 1);
    }
    const edgeCandidates = [];
    for (const x of xEdges) for (const y of yEdges)
      edgeCandidates.push(G.rotatePoint([x, y], -rotation));
    const points = [...candidates(preferred, polygon), ...edgeCandidates]
      .filter(point => inside(point, polygon) && boundaryDistance(point, polygon) >= radius);
    if (!points.length) return place(preferred, polygon, occupied, radius);
    const options = points.map(point => {
      const rect = bodyRect(point, visual, rotation);
      return { point, overlap: bodies.reduce((total, body) => total + intersection(rect, body), 0),
        overflow: outsideArea(rect), clearance: clearance(point, radius, occupied),
        preferredDistance: distance(point, preferred) };
    });
    const nearest = (a, b) => a.preferredDistance - b.preferredDistance ||
      a.point[1] - b.point[1] || a.point[0] - b.point[0];
    const full = options.filter(option => option.overlap <= 0.000001 && option.overflow <= 0.000001 &&
      option.clearance >= separation).sort(nearest)[0];
    if (full) return { point: full.point, crowded: false };
    const visible = options.filter(option => option.overlap <= 0.000001 && option.overflow <= 0.000001 &&
      option.clearance >= 0).sort(nearest)[0];
    if (visible) return { point: visible.point, crowded: true, reason: "spacing-reduced" };
    options.sort((a, b) => a.overlap - b.overlap || a.overflow - b.overflow ||
      Math.max(0, -a.clearance) - Math.max(0, -b.clearance) || nearest(a, b));
    const best = options[0];
    return { point: best.point, crowded: true,
      reason: best.overlap > 0.000001 ? "body-overlap" :
        best.overflow > 0.000001 ? "body-outside-tile" : "cell-crowded" };
  }
  function layout({ tileId, rotation = 0, enemies = [], hunter = null, loot = [], tokens = [] } = {}) {
    const definition = G.definition(tileId);
    G.rotatePoint([0, 0], rotation); // Validate rotation before producing objects.
    const entries = [], occupied = [], claimed = new Set();
    const spaces = definition.spaces;
    const markers = definition.markers.map((marker, index) => ({ ...marker, index,
      node: `${tileId}:${marker.spaceId}` }));
    const ownNode = node => typeof node === "string" && node.startsWith(tileId + ":") &&
      Object.hasOwn(spaces, node.slice(tileId.length + 1));
    const countByNode = new Map();
    for (const value of Array.isArray(loot) ? loot : []) {
      const node = typeof value === "string" ? value : value?.node;
      const count = typeof value === "string" ? 1 : value?.count;
      if (ownNode(node) && Number.isInteger(count) && count > 0)
        countByNode.set(node, (countByNode.get(node) || 0) + count);
    }
    const output = (type, id, node, point, extra = {}) => {
      const [x, y] = G.rotatePoint(point, rotation);
      const value = { type, id, node, x, y, ...dimensions(type), ...extra }; entries.push(value); return value;
    };
    // Empty printed spawn markers are still reserved against survivor placement.
    for (const marker of markers) {
      occupied.push({ point: marker.point, radius: radii.marker, markerIndex: marker.index, node: marker.node,
        visual: dimensions(marker.kind === "consumable" ? "chest" : marker.kind) });
      if (marker.kind === "lamp") output("lamp", `lamp-${marker.index}`, marker.node, marker.point,
        { markerIndex: marker.index, count: 1 });
    }
    for (const [node, count] of countByNode) {
      const matching = markers.filter(marker => marker.node === node && marker.kind === "consumable");
      if (matching.length) {
        const totals = matching.map((_, index) => Math.floor(count / matching.length) +
          (index < count % matching.length ? 1 : 0));
        matching.forEach((marker, index) => {
          if (totals[index]) output("chest", `chest-${marker.index}`, node, marker.point,
            { markerIndex: marker.index, count: totals[index] });
        });
      } else {
        const space = spaces[node.slice(tileId.length + 1)];
        const selected = place(space.point, space.polygon, occupied.filter(item => item.node === node), radii.marker);
        output("chest", `chest-fallback-${node}`, node, selected.point,
          { count, fallback: true, ...(selected.crowded ? { crowded: true, reason: selected.reason } : {}) });
        occupied.push({ point: selected.point, radius: radii.marker, node, visual: dimensions("chest") });
      }
    }
    function actor(type, value) {
      if (!value || !ownNode(value.node) || typeof value.id !== "string") return;
      const space = spaces[value.node.slice(tileId.length + 1)];
      const preferredMarkers = type === "enemy" ? markers.filter(marker => marker.node === value.node &&
        (value.anchorKind === "lamp" ? marker.kind === "lamp" :
          marker.kind === "spawn" && marker.markerId === value.markerId)) : [];
      const preferredMarker = preferredMarkers.find(marker => !claimed.has(marker.index)) || preferredMarkers[0];
      const preferred = preferredMarker?.point || space.point;
      const collisionSet = occupied.filter(item => item.node === value.node &&
        !(preferredMarker && item.markerIndex === preferredMarker.index));
      const visual = dimensions(type, value);
      const selected = type === "token"
        ? placeToken(preferred, space.polygon, occupied, radii[type], rotation, visual)
        : place(preferred, space.polygon, collisionSet, radii[type]);
      const markerExact = preferredMarker && distance(selected.point, preferredMarker.point) < 0.000001;
      const extra = { radius: radii[type], ...visual, anchorKind: preferredMarker?.kind || "space",
        ...(preferredMarker ? { markerIndex: preferredMarker.index, ...(preferredMarker.markerId ? { markerId: preferredMarker.markerId } : {}) } : {}),
        ...(selected.crowded ? { crowded: true, reason: selected.reason } : {}) };
      if (markerExact) claimed.add(preferredMarker.index);
      output(type, value.id, value.node, selected.point, extra);
      occupied.push({ point: selected.point, radius: radii[type], node: value.node, visual });
    }
    for (const enemy of ordered(enemies)) actor("enemy", enemy);
    if (hunter) actor("hunter", hunter);
    for (const token of ordered(tokens)) actor("token", token);
    return entries;
  }
  const api = { layout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BBMapRenderLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this);




