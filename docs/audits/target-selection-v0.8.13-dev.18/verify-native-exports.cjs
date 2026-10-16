"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const E = require("../../../hunt-engine"), root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const input = file => E.importSave(read(file));
const cases = [
  { name: "reward-target-two", input: "SYNTHETIC-QA-same-cell-target-reset.json", output: "evidence/reward-target-two.json",
    command: { type: "USE_REWARD", rewardId: "reward-13", enemyId: "huntsmans-minion-2" } },
  { name: "inventory-inspection-only", input: "SYNTHETIC-QA-same-cell-augur-roar.json", output: "evidence/inventory-inspection-only.json" },
  { name: "pebble-target-two", input: "SYNTHETIC-QA-same-cell-augur-roar.json", output: "evidence/pebble-target-two.json",
    command: { type: "USE_CONSUMABLE", itemId: "item-pebble-1", enemyId: "huntsmans-minion-2", node: "tile-01:bottom" } },
  { name: "axe-target-two", input: "../../qa/dev15-synthetic-ui/SYNTHETIC-QA-axe-target-choice.json", output: "evidence/axe-target-two.json",
    command: { type: "WEAPON_CHOICE", enemyId: "huntsmans-minion-2" } },
];
const results = cases.map(row => {
  const before = input(row.input), actual = input(row.output), expected = row.command ? E.dispatch(before, row.command) : before;
  assert.deepEqual(actual, expected, row.name + " full-state equality");
  if (!row.command) assert.equal(read(row.input), read(row.output), "inspection changes no save bytes");
  const first = actual.enemies.find(e => e.id === "huntsmans-minion-1"), previous = before.enemies.find(e => e.id === first.id);
  assert.deepEqual(first, previous, row.name + " preserves figure one");
  return { ...row, fullStateEqual: true, figureOneUnchanged: true,
    byteEqual: row.command ? null : true, sha256: crypto.createHash("sha256").update(read(row.output)).digest("hex"),
    enemies: actual.enemies.filter(e => e.kind === "huntsmans-minion").map(({id, figure, node, hp}) => ({id, figure, node, hp})) };
});
console.log(JSON.stringify({ syntheticQA: true, normalCampaignCompletionClaimed: false, cases: results }, null, 2));
