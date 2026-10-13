const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { referenceSource } = require("./helpers/reference-source.cjs");
const root = path.join(__dirname, "../campaigns/long-hunt");
const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
const entries = [...data.preface, ...data.cards];

test("campaign covers all 67 ordered sources and 60 numbered cards with images", () => {
  assert.equal(data.preface.length, 7);
  assert.deepEqual(
    data.cards.map((c) => c.number),
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
  assert.equal(new Set(entries.map((e) => e.id)).size, 67);
  const names = entries.map((e) => e.source.filename);
  assert.equal(new Set(names).size, 67);
  assert.deepEqual(names, [...names].sort());
  for (const [i, e] of entries.entries()) {
    assert.equal(e.source.sortPosition, i + 1);
    assert.match(e.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(fs.statSync(referenceSource(path.posix.join("campaigns/long-hunt",e.image))).size > 0);
    for (const n of [
      ...e.reveal,
      ...(e.checksCards || []),
      ...(e.removesCards || []),
      ...(e.locksMissions || []),
    ]) {
      assert.ok(
        data.cards.some((c) => c.number === n),
        `${e.id} refers to missing card ${n}`,
      );
    }
  }
});
test("every card can be reached from chapter setup and mission entry points", () => {
  const seen = new Set();
  const queue = data.chapters.flatMap((c) => [
    ...c.specialSetupCards,
    ...c.onStartReveal,
    ...c.onMovementEnd.flatMap((t) => t.reveal),
  ]);
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    queue.push(...data.cards[n - 1].reveal);
  }
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
});
test("reference data preserves printed terminology with the confirmed enemy alias and six enemy sides", () => {
  assert.equal(data.automated, false);
  const card = data.cards.find((c) => c.number === 57);
  assert.ok(card.rules.join(" ").includes("야수 사냥 하수인"));
  assert.deepEqual(card.openQuestions, []);
  assert.deepEqual(card.resolvedQuestions, ["Q57"]);
  assert.equal(data.questions[0].resolution.canonicalName, "야수 사냥 하인");
  assert.equal(data.questions[0].resolution.confirmedBy, "user");
  assert.equal(data.questions[0].sourceFilename, card.source.filename);
  const alias = data.enemyNameAliases.find((x) => x.printedName === "야수 사냥 하수인");
  assert.equal(data.enemies.find((x) => x.id === alias.enemyId).name, alias.canonicalName);
  assert.deepEqual(data.enemies.map((e) => e.name).sort(), [...data.chapters[0].enemies].sort());
  const photos = [];
  for (const enemy of data.enemies) {
    assert.equal(enemy.sides.length, 2);
    assert.equal(enemy.miniatureCount, 4);
    assert.equal(enemy.miniatureCountSource.kind, "user_confirmation");
    for (const side of enemy.sides) {
      photos.push(side.source.filename);
      assert.match(side.source.sha256, /^[a-f0-9]{64}$/);
      assert.ok(fs.statSync(referenceSource(path.posix.join("campaigns/long-hunt",side.image))).size > 0);
      for (const attack of [side.basicAttack, side.specialAttack]) {
        assert.ok(attack.speed >= 1 && attack.speed <= 3);
        assert.ok(attack.damage > 0);
      }
    }
  }
  assert.equal(new Set(photos).size, 6);
});
test("offline browser data matches the authoritative JSON", () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "data.js"), "utf8"),
    context,
  );
  assert.equal(JSON.stringify(context.window.BBLongHunt), JSON.stringify(data));
});
test("tile atlas has twenty unique sources, connected spaces and valid exits and markers", () => {
  assert.equal(data.tiles.length, 20);
  assert.equal(new Set(data.tiles.map((t) => t.source.filename)).size, 20);
  assert.equal(new Set(data.tiles.map((t) => t.id)).size, 20);
  const required = new Set(['중앙 등불', ...data.chapters.flatMap((c) => c.requiredTiles)]);
  for (const name of required) assert.ok(data.tiles.some((t) => t.name === name), name);
  for (const t of data.tiles) {
    const diagram = require("../tile-geometry.js").image(t.id);
    assert.ok(fs.statSync(path.join(__dirname, "..", diagram)).size > 0);
    assert.match(t.source.sha256, /^[a-f0-9]{64}$/);
    const ids = new Set(t.spaces.map((s) => s.id));
    assert.equal(ids.size, t.spaces.length);
    const graph = new Map(t.spaces.map((s) => [s.id, []]));
    for (const [a,b] of t.adjacency) {
      assert.ok(ids.has(a) && ids.has(b) && a !== b, t.id);
      graph.get(a).push(b); graph.get(b).push(a);
    }
    const visited = new Set(), queue = [t.spaces[0].id];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id); queue.push(...graph.get(id));
    }
    assert.equal(visited.size, ids.size, t.id);
    assert.ok(t.exits.length > 0);
    assert.equal(new Set(t.exits.map((e) => e.edge)).size, t.exits.length);
    for (const e of t.exits) assert.ok(ids.has(e.spaceId) && ['N','E','S','W'].includes(e.edge));
    for (const s of t.spaces) for (const icon of s.icons) {
      assert.ok(Number.isInteger(icon.count) && icon.count > 0);
      if (icon.kind === 'spawn') assert.ok(data.spawnMarkers.some((m) => m.id === icon.markerId));
      else assert.ok(['lamp','consumable'].includes(icon.kind));
    }
    if (t.named) assert.equal(t.spaces.filter((s) => s.placeName === t.name).length, 1);
  }
  assert.equal(data.chapterSetupRules.automated, false);
});
