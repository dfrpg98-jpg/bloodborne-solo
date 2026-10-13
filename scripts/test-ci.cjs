"use strict";

// CI checks game behavior without uploading the developer's source photographs.
// npm test still performs the complete local suite, including source-photo audits.
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const sourcePhotoTests = [
  "campaign covers all 67 ordered sources and 60 numbered cards with images",
  "reference data preserves printed terminology with the confirmed enemy alias and six enemy sides",
  "default v0.3 state remains without optional firearm fields and photo confirmation retains raw text",
  "supplied component photos retain their exact bytes, hashes and card provenance",
];
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const skipPattern = "^(?:" + sourcePhotoTests.map(escapePattern).join("|") + ")$";
const files = fs.readdirSync(path.join(root, "tests")).filter(name => name.endsWith(".test.cjs")).sort().map(name => "tests/" + name);
if (!files.length) throw new Error("No test files found; CI must not pass an empty suite.");
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
const log = path.join(output, "ci.tap"), fd = fs.openSync(log, "w");
const args = ["--test", "--test-reporter=tap", "--test-concurrency=2", "--test-skip-pattern=" + skipPattern, ...files];
const started = Date.now(), env = { ...process.env };
delete env.BB_REFERENCE_ROOT;
let result;
try { result = cp.spawnSync(process.execPath, args, { cwd: root, env, stdio: ["inherit", fd, fd] }); }
finally { fs.closeSync(fd); }
const text = fs.readFileSync(log, "utf8");
const counts = Object.fromEntries([...text.matchAll(/^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(match => [match[1], Number(match[2])]));
const report = { nodeVersion: process.version, runtimeVersion: require("../package.json").version,
  testFiles: files, command: ["node", ...args], sourcePhotoTestsExcluded: sourcePhotoTests,
  durationSeconds: (Date.now() - started) / 1000, exitCode: result.status, signal: result.signal,
  spawnError: result.error ? result.error.message : null, counts, failedSubtests: text.match(/^not ok .*$/gm) || [] };
fs.writeFileSync(path.join(output, "ci.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (result.error || result.signal || result.status !== 0 || !counts.tests || counts.fail || counts.cancelled) process.exit(1);
