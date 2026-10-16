"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), baseline = "8d379508aff059d6c4ca05382be44437867db54d";
const tests = ["damage-allocation-progress-ui-v0822", "stake-push-preview-ui-v0821", "weapon-continuations",
  "ui-selection-v086", "target-selection-presentation-v0818", "playtest-target-selection-ui-v0818"].map(name => `tests/${name}.test.cjs`);
const immutable = ["hunt-engine.js", "weapon-flow.js", "weapon-rules.js", "chapter-engine.js", "rewards-engine.js", "enemy-deck.js", "actual-components.js"];
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
const files = [...immutable, "hunt-app.js", "hunt.html", "package.json", ...tests, "tests/helpers/damage-allocation-qa.cjs"];
const hashes = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const before = hashes();
for (const file of immutable) assert.equal(before[file], sha(cp.execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root })), file);
const run = cp.spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...tests], { cwd: root, encoding: "utf8", maxBuffer: 8e6 });
const output = run.stdout + run.stderr; fs.writeFileSync(path.join(__dirname, "focused-tests.tap"), output);
assert.deepEqual(hashes(), before, "verification must not edit its product or tests");
const get = label => Number(output.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1]);
const report = { generatedAt: new Date().toISOString(), baseline, files: tests, tests: get("tests"), pass: get("pass"), fail: get("fail"),
  cancelled: get("cancelled"), skipped: get("skipped"), exitCode: run.status, hashes: before, immutableMatchBaseline: immutable };
fs.writeFileSync(path.join(__dirname, "focused-tests.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2)); assert.equal(run.status, 0); assert.equal(report.fail, 0);
