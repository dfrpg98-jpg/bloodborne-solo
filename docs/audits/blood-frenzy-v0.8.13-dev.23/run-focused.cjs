"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), baseline = "9c690be61bd51f64f4e0d3f11ca3c5ccb12bf7b7";
const tests = ["blood-frenzy-preview-v0823", "outcome-preview-v0813", "combat-feedback-ui", "enemy-mission-effects",
  "death-feedback-ui", "mission-guidance-v0813-dev14"].map(name => `tests/${name}.test.cjs`);
const immutable = ["hunt-engine.js", "mission-engine.js", "weapon-flow.js", "weapon-rules.js", "hunt-app.js",
  "hunt-enemy-mission-effects.js", "hunt-mission-feedback.js", "rewards-engine.js", "chapter-engine.js", "actual-components.js"];
const sha = data => crypto.createHash("sha256").update(data).digest("hex"),
  files = [...immutable, "hunt-outcome-preview.js", "hunt.html", "package.json", ...tests, "tests/helpers/blood-frenzy-qa.cjs"],
  hashes = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const before = hashes();
for (const file of immutable) assert.equal(before[file], sha(cp.execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root })), file);
const run = cp.spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...tests], { cwd: root, encoding: "utf8", maxBuffer: 8e6 }),
  output = run.stdout + run.stderr;
fs.writeFileSync(path.join(__dirname, "focused-tests.tap"), output);
assert.deepEqual(hashes(), before, "verification must not edit its product or tests");
const get = label => Number(output.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1]);
const report = { generatedAt: new Date().toISOString(), baseline, files: tests, tests: get("tests"), pass: get("pass"),
  fail: get("fail"), cancelled: get("cancelled"), skipped: get("skipped"), exitCode: run.status,
  hashes: before, immutableMatchBaseline: immutable };
fs.writeFileSync(path.join(__dirname, "focused-tests.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2)); assert.equal(run.status, 0); assert.equal(report.fail, 0);
