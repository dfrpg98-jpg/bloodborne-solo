"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "hunt-engine")),
  trace = require(path.join(root, "tests/fixtures/v074-clinic-escort-chapter-two-natural-commands.json"));
for (const [name, count, stop] of [["ground", 131, true], ["armed", 132, true], ["carried", 133, false]]) {
  let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13,
    qa: { preset: "custom", startRewards: [], startConsumables: [] } });
  for (const command of trace.slice(0, count)) s = E.dispatch(s, command);
  if (stop) s = E.dispatch(s, { type: "STOP_MOVE" });
  s = E.applyTileSpeedRuling(E.applyCombatReactionRuling(E.applyChapelRuling(s)));
  const raw = E.exportSave(s), file = path.join(__dirname, `SYNTHETIC-QA-bridge-${name}-before-lantern.json`);
  assert.equal(E.exportSave(E.importSave(raw)), raw);
  if (process.argv.includes("--write")) fs.writeFileSync(file, raw);
  else assert.equal(fs.readFileSync(file, "utf8"), raw, "rebuild input exactly: " + name);
  console.log(JSON.stringify({ name, commands: s.commands.length, synthetic: true, strictReimport: true }));
}
