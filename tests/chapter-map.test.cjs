const { test } = require("node:test"),
  assert = require("node:assert/strict");
const E = require("../chapter-engine.js"),
  ED = require("../enemy-deck.js");
const send = (s, type, a = {}) => E.dispatch(s, { type, ...a });
function path(s, target) {
  const q = [[s.position]],
    seen = new Set([s.position]);
  for (let i = 0; i < q.length; i++) {
    const p = q[i],
      end = p.at(-1);
    if (end === target) return p;
    for (const n of E.neighbors(s, end))
      if (!seen.has(n)) {
        seen.add(n);
        q.push([...p, n]);
      }
  }
  throw Error("unreachable");
}
function walk(s, target) {
  for (const node of path(s, target).slice(1)) s = send(s, "MOVE", { node });
  return s;
}
function settle(s) {
  while (s.phase === "relocate")
    s = send(s, "RELOCATE", { figureId: s.relocationChoices[0] });
  return s;
}
function exploreAll(seed) {
  let s = E.create(seed);
  while (s.tileDeck.length) {
    const e = E.openExits(s)[0];
    s = walk(s, e.node);
    s = send(s, "EXPLORE", { edge: e.edge });
    const rotation = E.placementOptions(
      s,
      s.pending.tileId,
      s.pending.anchor,
    )[0];
    s = send(s, "PLACE_TILE", { rotation });
    s = settle(s);
  }
  return s;
}
test("chapter 1 setup selects required four plus two random tiles, central separate, all three kinds and four figures each", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = E.create(seed);
    assert.equal(s.tiles[0].tileId, "tile-14");
    assert.equal(s.tileDeck.length, 6);
    for (const id of ["tile-04", "tile-11", "tile-17", "tile-03"])
      assert(s.tileDeck.includes(id));
    assert.equal(new Set(s.tilePool).size, 7);
    assert.deepEqual(
      s.assignments.map((a) => a.marker),
      ["gold", "red", "purple"],
    );
    assert.equal(new Set(s.assignments.map((a) => a.enemyId)).size, 3);
    for (const a of s.assignments) {
      assert(["a", "b"].includes(a.sideId));
      assert.equal(E.definition(s, a.enemyId).miniatureCount, 4);
    }
    assert(ED.valid(s));
    assert.equal(s.figures.length, 0);
    assert.equal(s.loot.length, 0);
  }
});
test("randomization varies faces, slot permutation and includes named optional tiles", () => {
  const states = Array.from({ length: 150 }, (_, i) => E.create(i + 1));
  assert(new Set(states.map((s) => JSON.stringify(s.assignments))).size > 20);
  assert(
    states.some((s) =>
      s.tilePool.some(
        (id) =>
          E.tile(id).named &&
          !["tile-14", "tile-04", "tile-11", "tile-17", "tile-03"].includes(id),
      ),
    ),
  );
  assert.deepEqual(E.create(2468), E.create(2468));
});
test("starting space is a choice, not necessarily the lamp-marked space", () => {
  for (const id of ["left", "center", "right"])
    assert.equal(E.create(1, id).position, `tile-14:${id}`);
  assert.throws(() => E.create(1, "invented"));
  assert.throws(() => E.create(-1));
  assert.throws(() => E.create(NaN));
});
test("exploration is atomic; revealed tile cannot be cancelled or skipped, must connect and enter", () => {
  let s = E.create(17),
    before = JSON.stringify(s);
  assert.throws(() => send(s, "MOVE", { node: "tile-03:entry" }));
  assert.equal(JSON.stringify(s), before);
  s = send(s, "EXPLORE", { edge: "N" });
  const p = s.pending;
  assert.equal(s.tileDeck.length, 5);
  assert.throws(() => send(s, "EXPLORE", { edge: "S" }));
  assert.throws(() => send(s, "MOVE", { node: "tile-14:left" }));
  assert.throws(() => send(s, "RESET_MAP"));
  const opts = E.placementOptions(s, p.tileId, p.anchor);
  const bad = [0, 1, 2, 3].find((r) => !opts.includes(r));
  if (bad !== undefined)
    assert.throws(() => send(s, "PLACE_TILE", { rotation: bad }));
  s = settle(send(s, "PLACE_TILE", { rotation: opts[0] }));
  assert(s.position.startsWith(p.tileId + ":"));
  assert.equal(E.distance(s, p.anchor.node, s.position), 1);
  assert.equal(s.phase, "ready");
});
test("complete real map exploration conserves tiles and figures over many layouts and restores exact save", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = exploreAll(seed);
    assert.equal(s.tiles.length, 7);
    assert.equal(s.tileDeck.length, 0);
    assert.equal(new Set(s.tiles.map((p) => `${p.x},${p.y}`)).size, 7);
    const g = E.graph(s);
    for (const n of g.nodes)
      assert(Number.isFinite(E.distance(s, s.position, n.id)));
    for (const a of s.assignments)
      assert(s.figures.filter((f) => f.kind === a.enemyId).length <= 4);
    const count = s.tiles.reduce(
      (sum, p) =>
        sum +
        E.tile(p.tileId).spaces.reduce(
          (sum, n) =>
            sum +
            n.icons
              .filter((i) => i.kind === "consumable")
              .reduce((sum, i) => sum + i.count, 0),
          0,
        ),
      0,
    );
    assert.equal(
      s.loot.reduce((sum, x) => sum + x.count, 0),
      count,
    );
    if (seed <= 3) assert.deepEqual(E.importSave(E.exportSave(s)), s);
  }
});
test("map reset retains enemy faces, assignments, tile positions and both deck orders", () => {
  let s = exploreAll(18);
  s = send(s, "DRAW_BEHAVIOR", { enemyId: s.assignments[0].enemyId });
  const before = JSON.parse(JSON.stringify(s));
  s = settle(send(s, "RESET_MAP"));
  for (const key of [
    "assignments",
    "tiles",
    "tileDeck",
    "enemyDeck",
    "enemyDiscard",
    "position",
  ])
    assert.deepEqual(s[key], before[key]);
  assert.equal(s.resets, 1);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
test("matching exits are bidirectional; a blank tile edge blocks crossing", () => {
  const s = E.create();
  s.tiles = [
    { tileId: "tile-14", x: 0, y: 0, rotation: 0 },
    { tileId: "tile-03", x: 0, y: -1, rotation: 0 },
  ];
  assert(E.neighbors(s, "tile-14:center").includes("tile-03:entry"));
  assert(E.neighbors(s, "tile-03:entry").includes("tile-14:center"));
  s.tiles[1].rotation = 1;
  assert(!E.neighbors(s, "tile-14:center").includes("tile-03:entry"));
});
test("same behavior deck is shared across species; seven draws reshuffle only on exhaustion", () => {
  let s = E.create(33);
  const kinds = [];
  for (let i = 0; i < 6; i++) {
    s = send(s, "DRAW_BEHAVIOR", { enemyId: s.assignments[i % 3].enemyId });
    kinds.push(s.lastBehavior.kind);
  }
  assert.deepEqual(ED.counts(kinds), ED.composition);
  assert.equal(s.enemyDeck.length, 0);
  assert.equal(s.enemyDiscard.length, 6);
  s = send(s, "RESET_MAP");
  assert.equal(s.enemyDiscard.length, 6);
  s = send(s, "DRAW_BEHAVIOR", { enemyId: s.assignments[1].enemyId });
  assert.equal(s.enemyDeck.length, 5);
  assert.equal(s.enemyDiscard.length, 1);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
test("tampered saves and training saves are rejected without silently accepting arbitrary state", () => {
  const s = E.create(1),
    copy = JSON.parse(E.exportSave(s));
  copy.assignments[0].sideId = copy.assignments[0].sideId === "a" ? "b" : "a";
  assert.throws(() => E.importSave(JSON.stringify(copy)), /명령 기록/);
  assert.throws(
    () =>
      E.importSave(
        require("../engine.js").exportSave(require("../engine.js").create()),
      ),
    /형식/,
  );
});
test("four-figure supply relocates the farthest; equal distance asks for one figure and never creates a fifth", () => {
  let s;
  for (let seed = 1; seed < 100; seed++) {
    const candidate = E.create(seed, "left");
    if (
      E.tile(candidate.tileDeck[0]).spaces.some((n) =>
        n.icons.some((i) => i.kind === "spawn"),
      )
    ) {
      s = candidate;
      break;
    }
  }
  const marker = E.tile(s.tileDeck[0])
    .spaces.flatMap((n) => n.icons)
    .find((i) => i.kind === "spawn").markerId;
  const kind = s.assignments.find((a) => a.marker === marker).enemyId;
  const fixture = JSON.parse(JSON.stringify(s));
  fixture.figures = Array.from({ length: 4 }, (_, i) => ({
    id: `${kind}-${i + 1}`,
    kind,
    number: i + 1,
    node: i === 3 ? "tile-14:right" : "tile-14:center",
  }));
  let pending = send(fixture, "EXPLORE", { edge: "W" });
  let next = settle(
    send(pending, "PLACE_TILE", {
      rotation: E.placementOptions(
        pending,
        pending.pending.tileId,
        pending.pending.anchor,
      )[0],
    }),
  );
  assert.notEqual(
    next.figures.find((f) => f.id === `${kind}-4`).node,
    "tile-14:right",
  );
  assert.equal(next.figures.filter((f) => f.kind === kind).length, 4);
  fixture.figures.forEach((f) => (f.node = "tile-14:center"));
  pending = send(fixture, "EXPLORE", { edge: "W" });
  next = send(pending, "PLACE_TILE", {
    rotation: E.placementOptions(
      pending,
      pending.pending.tileId,
      pending.pending.anchor,
    )[0],
  });
  assert.equal(next.phase, "relocate");
  assert.equal(next.relocationChoices.length, 4);
  assert.equal(next.position, "tile-14:left");
  assert.throws(() => send(next, "RELOCATE", { figureId: "invented" }));
  next = settle(send(next, "RELOCATE", { figureId: `${kind}-2` }));
  assert.equal(next.figures.filter((f) => f.kind === kind).length, 4);
  assert.notEqual(next.position, "tile-14:left");
});
test("a tile that seals every exit is returned and shuffled after a suitable replacement is drawn", () => {
  const s = E.create(99, "left");
  s.tiles = [
    { tileId: "tile-14", x: 0, y: 0, rotation: 0 },
    { tileId: "tile-03", x: 0, y: -1, rotation: 0 },
    { tileId: "tile-07", x: 1, y: 0, rotation: 1 },
    { tileId: "tile-12", x: 0, y: 1, rotation: 2 },
  ];
  s.tileDeck = ["tile-20", "tile-01", "tile-17"];
  s.tilePool = [...s.tiles.map((p) => p.tileId), ...s.tileDeck];
  assert.equal(E.openExits(s).length, 1);
  const next = send(s, "EXPLORE", { edge: "W" });
  assert.equal(next.pending.tileId, "tile-01");
  assert(next.tileDeck.includes("tile-20"));
  assert.equal(next.tileDeck.length, 2);
  assert(next.events.some((e) => e.includes("출입구를 막는")));
});
