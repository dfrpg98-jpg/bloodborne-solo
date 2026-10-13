const test = require("node:test"),
  assert = require("node:assert/strict"),
  E = require("../hunt-engine"),
  { choose } = require("./hunt-playthrough-helper.cjs");
test("six complete command-driven hunts preserve quantities and replay including map resets", () => {
  const seen = new Set();
  let maxTiles = 0,
    totalKills = 0;
  for (const seed of [1, 2, 3, 42, 123, 20261011]) {
    let s = E.create(seed, "burial", 1);
    while (s.phase !== "over" && s.revision < 1500) {
      seen.add(s.phase);
      const command = choose(structuredClone(s));
      s = E.dispatch(s, command);
      maxTiles = Math.max(maxTiles, s.world.tiles.length);
    }
    assert.equal(s.phase, "over", `seed ${seed} stuck in ${s.phase}`);
    assert.deepEqual(E.importSave(E.exportSave(s)), s);
    totalKills += s.kills;
  }
  for (const phase of [
    "move",
    "tile_place",
    "combat_choose",
    "combat_react",
    "upgrade_pick",
    "upgrade_replace",
    "return",
    "refill",
    "activation",
  ])
    assert(seen.has(phase), phase);
  assert.equal(maxTiles, 7);
  assert(totalKills > 6);
});
