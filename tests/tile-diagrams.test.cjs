const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const geometry = require("../src/tile-geometry.js");
const campaign = require("../campaigns/long-hunt/data.json");

// Independently checked against all 20 supplied photographs, not derived from
// geometry. Icons specify the exact space and initial token count on the photo.
const photoReference = [
  [2, "N:top S:bottom", "top:spawn:gold:1 bottom:spawn:red:1"],
  [3, "E:right S:lower-left", "lower-left:spawn:red:1 right:consumable::1"],
  [2, "S:entry", "room:spawn:gold:1 room:spawn:purple:1 room:consumable::2"],
  [3, "W:left E:right S:center", "center:lamp::1"],
  [3, "W:upper-left E:upper-right S:bottom", "upper-left:spawn:gold:1 upper-right:spawn:purple:1"],
  [2, "W:top E:top S:bottom", "top:consumable::1 bottom:spawn:purple:1"],
  [3, "S:bottom", "top:consumable::2 middle:lamp::1"],
  [2, "N:top S:bottom", "bottom:consumable::1 bottom:spawn:purple:1"],
  [3, "E:upper-right S:bottom", "upper-left:consumable::1 bottom:spawn:gold:1"],
  [2, "N:left W:left E:right S:right", "left:spawn:red:1 right:consumable::1"],
  [2, "N:street W:street E:street", "street:spawn:gold:1"],
  [4, "S:bottom", "middle-left:lamp::1 middle-right:consumable::1"],
  [3, "N:top W:middle E:middle S:bottom", "middle:consumable::1 middle:spawn:red:1"],
  [3, "N:center W:left E:right S:center", "center:lamp::1"],
  [3, "W:left E:right", "center:spawn:purple:1"],
  [3, "W:middle E:middle S:bottom", "top:consumable::1 middle:spawn:red:1 bottom:spawn:gold:1"],
  [3, "N:top W:lower-left E:lower-right", "top:lamp::1"],
  [2, "N:top S:bottom", "top:consumable::1 top:spawn:purple:1"],
  [2, "S:bottom", "top:consumable::1 bottom:lamp::1"],
  [2, "S:entry", "room:lamp::1"],
];

const eps = 1e-7;
const sorted = (items) => [...items].sort();
const edgeKey = ({ edge, spaceId }) => `${edge}:${spaceId}`;
function aggregateIcons(icons) {
  const totals = new Map();
  for (const { spaceId, kind, markerId = "", count } of icons) {
    const key = `${spaceId}:${kind}:${markerId}`;
    totals.set(key, (totals.get(key) || 0) + count);
  }
  return sorted([...totals].map(([key, count]) => `${key}:${count}`));
}
function atlasIcons(tile) {
  return tile.spaces.flatMap((space) => space.icons.map((icon) => ({ spaceId: space.id, ...icon })));
}
function assertPoint(p, context) {
  assert.equal(p.length, 2, context);
  assert.ok(p.every((n) => Number.isFinite(n) && n >= 0 && n <= 100), `${context}: invalid coordinates ${p}`);
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(p, a, b) {
  return Math.abs(cross(a, b, p)) <= eps &&
    p[0] >= Math.min(a[0], b[0]) - eps && p[0] <= Math.max(a[0], b[0]) + eps &&
    p[1] >= Math.min(a[1], b[1]) - eps && p[1] <= Math.max(a[1], b[1]) + eps;
}
function pointInPolygon(p, poly, allowBoundary = false) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if (onSegment(p, a, b)) return allowBoundary;
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function shareBoundary(a, b) {
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = a[(i + 1) % a.length];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= eps) continue;
    for (let j = 0; j < b.length; j++) {
      const r = b[j], s = b[(j + 1) % b.length];
      if (Math.abs(cross(p, q, r)) > eps || Math.abs(cross(p, q, s)) > eps) continue;
      const axis = Math.abs(q[0] - p[0]) >= Math.abs(q[1] - p[1]) ? 0 : 1;
      const overlap = Math.min(Math.max(p[axis], q[axis]), Math.max(r[axis], s[axis])) -
        Math.max(Math.min(p[axis], q[axis]), Math.min(r[axis], s[axis]));
      if (overlap > eps) return true;
    }
  }
  return false;
}
function attrs(text) {
  return Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}
function elements(svg) {
  return [...svg.matchAll(/<([\w:-]+)\b([^>]*)>/g)].map((m) => ({ tag: m[1], ...attrs(m[2]) }));
}

test("all 20 photo layouts preserve 52 spaces, 47 exits and every printed marker", () => {
  assert.equal(campaign.tiles.length, 20);
  assert.deepEqual(sorted(Object.keys(geometry.tiles)), sorted(campaign.tiles.map((t) => t.id)));
  let spaces = 0, exits = 0;
  const totals = { lamp: 0, consumable: 0, gold: 0, red: 0, purple: 0 };
  for (const [index, tile] of campaign.tiles.entries()) {
    const g = geometry.tiles[tile.id];
    const [count, expectedExits, expectedIcons] = photoReference[index];
    assert.equal(tile.id, `tile-${String(index + 1).padStart(2, "0")}`);
    assert.equal(tile.spaces.length, count, tile.id);
    assert.deepEqual(sorted(Object.keys(g.spaces)), sorted(tile.spaces.map((s) => s.id)), tile.id);
    assert.deepEqual(sorted(tile.exits.map(edgeKey)), sorted(expectedExits.split(" ")), `${tile.id}: atlas exits differ from photo`);
    assert.deepEqual(sorted(g.exits.map(edgeKey)), sorted(expectedExits.split(" ")), `${tile.id}: diagram exits differ from photo`);
    assert.deepEqual(aggregateIcons(atlasIcons(tile)), sorted(expectedIcons.split(" ")), `${tile.id}: atlas markers differ from photo`);
    assert.deepEqual(aggregateIcons(g.markers), sorted(expectedIcons.split(" ")), `${tile.id}: diagram markers differ from photo`);
    spaces += count;
    exits += g.exits.length;
    for (const icon of g.markers) totals[icon.markerId || icon.kind] += icon.count;
  }
  assert.equal(spaces, 52);
  assert.equal(exits, 47);
  assert.deepEqual(totals, { lamp: 7, consumable: 14, gold: 6, red: 5, purple: 6 });
  assert.ok(!geometry.tiles["tile-04"].exits.some((e) => e.edge === "N"), "the physical yard lamp photo has no north exit");
});

test("space centers and markers remain inside their own valid non-overlapping polygons", () => {
  for (const [tileId, tile] of Object.entries(geometry.tiles)) {
    for (const [spaceId, space] of Object.entries(tile.spaces)) {
      assert.ok(space.polygon.length >= 3, `${tileId}:${spaceId}`);
      space.polygon.forEach((p) => assertPoint(p, `${tileId}:${spaceId} polygon`));
      assertPoint(space.point, `${tileId}:${spaceId} center`);
      assert.ok(pointInPolygon(space.point, space.polygon), `${tileId}:${spaceId} center outside own polygon`);
      for (const [otherId, other] of Object.entries(tile.spaces)) {
        if (otherId !== spaceId) assert.ok(!pointInPolygon(space.point, other.polygon), `${tileId}:${spaceId} center inside ${otherId}`);
      }
      if (space.labelPoint) {
        assertPoint(space.labelPoint, `${tileId}:${spaceId} label`);
        assert.ok(pointInPolygon(space.labelPoint, space.polygon), `${tileId}:${spaceId} label outside own polygon`);
      }
    }
    for (const marker of tile.markers) {
      assertPoint(marker.point, `${tileId} marker`);
      assert.ok(pointInPolygon(marker.point, tile.spaces[marker.spaceId].polygon), `${tileId}: marker outside ${marker.spaceId}`);
      assert.ok(Number.isInteger(marker.count) && marker.count > 0, `${tileId}: marker count`);
    }
    // An off-boundary mesh also detects holes or overlapping click regions,
    // including the deliberately unwalkable building on tile 10.
    for (let x = 1.37; x < 100; x += 4) {
      for (let y = 1.37; y < 100; y += 4) {
        const p = [x, y];
        const walkable = Object.values(tile.spaces).filter((s) => pointInPolygon(p, s.polygon)).length;
        const blocked = (tile.blocked || []).filter((poly) => pointInPolygon(p, poly)).length;
        assert.equal(walkable + blocked, 1, `${tileId}: uncovered/overlapping region at ${p}`);
      }
    }
  }
  const building = geometry.tiles["tile-10"];
  assert.ok(building.blocked?.length, "the central building must be excluded from walkable space");
  assert.ok(!Object.values(building.spaces).some((s) => pointInPolygon([53, 52], s.polygon)), "the photo's central building is blocked");
});

test("shared space boundaries match movement adjacency; a shared corner cannot add a move", () => {
  for (const tile of campaign.tiles) {
    const g = geometry.tiles[tile.id];
    const actual = [];
    const ids = tile.spaces.map((s) => s.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (shareBoundary(g.spaces[ids[i]].polygon, g.spaces[ids[j]].polygon)) actual.push(sorted([ids[i], ids[j]]).join(":"));
      }
    }
    const expected = tile.adjacency.map((pair) => sorted(pair).join(":"));
    assert.deepEqual(sorted(actual), sorted(expected), tile.id);
  }
  assert.equal(shareBoundary([[0, 0], [1, 0], [1, 1], [0, 1]], [[1, 1], [2, 1], [2, 2], [1, 2]]), false);
});

test("quarter turns keep token centers inside cells and exits on the correct outer boundary", () => {
  assert.deepEqual(geometry.rotatePoint([23, 61], 1), [39, 23]);
  assert.deepEqual(geometry.rotatePoint([23, 61], 2), [77, 39]);
  assert.deepEqual(geometry.rotatePoint([23, 61], 3), [61, 77]);
  assert.deepEqual(geometry.rotatePoint([23, 61], 4), [23, 61]);
  const edges = ["N", "E", "S", "W"];
  for (const [tileId, tile] of Object.entries(geometry.tiles)) {
    for (let rotation = 0; rotation < 4; rotation++) {
      for (const spaceId of Object.keys(tile.spaces)) {
        const p = geometry.point(tileId, spaceId, rotation);
        const poly = geometry.polygon(tileId, spaceId, rotation);
        assertPoint(p, `${tileId}:${spaceId}: rotation ${rotation}`);
        assert.ok(pointInPolygon(p, poly), `${tileId}:${spaceId}: rotated center outside cell`);
      }
      for (const exit of tile.exits) {
        const point = geometry.rotatePoint(exit.point, rotation);
        const edge = edges[(edges.indexOf(exit.edge) + rotation) % 4];
        const axis = edge === "N" || edge === "S" ? 1 : 0;
        const coordinate = edge === "S" || edge === "E" ? 100 : 0;
        assert.equal(point[axis], coordinate, `${tileId}:${exit.edge}: rotation ${rotation}`);
        assert.ok(pointInPolygon(point, geometry.polygon(tileId, exit.spaceId, rotation), true), `${tileId}:${exit.edge}: exit outside designated cell`);
      }
    }
  }
});

test("20 static vector assets agree with the rules atlas and contain no photographed pixels", () => {
  for (const tile of campaign.tiles) {
    const file = geometry.image(tile.id);
    assert.match(file, /^assets\/tiles\/tile-\d{2}\.svg$/);
    const svg = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<image\b|data:image|\.jpe?g\b|\.png\b|(?:href|src)=["']https?:\/\/|url\(["']?https?:\/\//i, `${tile.id}: raster/external reference`);
    const es = elements(svg);
    const polygons = es.filter((e) => e.tag === "polygon" && e["data-space-id"]);
    assert.deepEqual(sorted(polygons.map((e) => e["data-space-id"])), sorted(tile.spaces.map((s) => s.id)), `${tile.id}: cell assets`);
    const svgRoot = es.find((e) => e.tag === "svg");
    const [vx, vy, width, height] = svgRoot.viewBox.split(/\s+/).map(Number);
    assert.equal(vx, 0);
    assert.equal(vy, 0);
    assert.equal(width, height, `${tile.id}: tile should stay square`);
    for (const polygon of polygons) {
      const points = polygon.points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      const normalized = points.map(([x, y]) => [100 * x / width, 100 * y / height]);
      assert.deepEqual(normalized, geometry.tiles[tile.id].spaces[polygon["data-space-id"]].polygon, `${tile.id}: drawn cell and click region disagree`);
    }
    const exits = es.filter((e) => e["data-exit-edge"]).map((e) => ({ edge: e["data-exit-edge"], spaceId: e["data-space-id"] }));
    assert.deepEqual(sorted(exits.map(edgeKey)), sorted(tile.exits.map(edgeKey)), `${tile.id}: exit assets`);
    const icons = es.filter((e) => e["data-icon-kind"]).map((e) => ({
      spaceId: e["data-space-id"], kind: e["data-icon-kind"], markerId: e["data-icon-marker"] || "", count: Number(e["data-icon-count"]),
    }));
    assert.deepEqual(aggregateIcons(icons), aggregateIcons(atlasIcons(tile)), `${tile.id}: marker assets`);
  }
});
