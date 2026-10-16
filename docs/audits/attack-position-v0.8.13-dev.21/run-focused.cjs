"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), files = [
  "tests/attack-position-preview-v0821.test.cjs", "tests/burial-position-ui-v0821.test.cjs",
  "tests/stake-push-preview-ui-v0821.test.cjs", "tests/kirkhammer-restriction-ui-v0821.test.cjs",
  "tests/attack-selection-preview-v0815.test.cjs", "tests/playtest-attack-preview-integration-v0815.test.cjs",
  "tests/combat-selection-controls-v0814.test.cjs", "tests/playtest-target-selection-ui-v0818.test.cjs",
  "tests/target-selection-presentation-v0818.test.cjs", "tests/combat-feedback-ui.test.cjs",
  "tests/ui-selection-v086.test.cjs", "tests/mist-recovery-ui-v0820.test.cjs",
  "tests/numbing-mist-followup-v0820.test.cjs", "tests/map-hud-v080.test.cjs",
];
const observed = ["hunt-app.js", "hunt-attack-preview.js", "hunt-combat-controls.css", "hunt.html", "package.json",
  "hunt-engine.js", "weapon-rules.js", "weapon-flow.js", "hunt-presentation.js", "tests/helpers/attack-position-qa.cjs", ...files];
const hashes = () => Object.fromEntries(observed.map(file => [file, crypto.createHash("sha256")
  .update(fs.readFileSync(path.join(root, file))).digest("hex")]));
for (const file of files) if (!fs.existsSync(path.join(root, file))) throw Error("Missing test " + file);
const hashesBefore = hashes(), startedAt = new Date().toISOString(), command = ["--test", "--test-reporter=tap", ...files],
  result = cp.spawnSync(process.execPath, command, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }),
  output = result.stdout + result.stderr, endedAt = new Date().toISOString(), hashesAfter = hashes(),
  counts = Object.fromEntries([...output.matchAll(/^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/gm)]
    .map(match => [match[1], +match[2]]));
fs.writeFileSync(path.join(__dirname, "focused-tests.tap"), output);
const report = { startedAt, endedAt, command: ["node", ...command], nodeVersion: process.version,
  exitCode: result.status, counts, failedSubtests: output.match(/^not ok .*$/gm) || [],
  hashesBefore, hashesAfter, stable: JSON.stringify(hashesBefore) === JSON.stringify(hashesAfter),
  scope: "One focused run of these 14 files after the final product edits; not the full CI and not added to earlier run counts." };
fs.writeFileSync(path.join(__dirname, "focused-tests.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ exitCode: report.exitCode, counts, stable: report.stable, failed: report.failedSubtests }));
if (result.error || result.status || !counts.tests || counts.fail || counts.cancelled || !report.stable) process.exit(1);
