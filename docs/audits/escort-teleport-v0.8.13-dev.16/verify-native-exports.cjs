"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "hunt-engine")), Loss = require(path.join(root, "hunt-action-loss"));
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8"), sha = text => crypto.createHash("sha256").update(text).digest("hex");
function imported(file) {
  const raw = read(file), s = E.importSave(raw); assert.equal(E.exportSave(s), raw, "strict native save replay: " + file); return s;
}
const input = name => `SYNTHETIC-QA-bridge-${name}-before-lantern.json`, results = [];
for (const name of ["ground", "armed", "carried"]) {
  const before = imported(input(name)), exported = `evidence/native-${name}-after-lantern.json`, actual = imported(exported),
    command = { type: "USE_REWARD", rewardId: "reward-13", node: "tile-17:top" }, notice = Loss.plan(E, before, [command]);
  assert.equal(E.node(before, command.node).tile, "tile-17");
  assert.equal(E.node(before, command.node).name, "오에돈 예배당 / 오에돈 예배당");
  assert(notice); assert.equal(notice.losses[0].effect, name === "carried" ? "return" : "stay");
  assert.deepEqual(actual, E.dispatch(before, command));
  assert.equal(actual.mission.escort.node, "tile-18:top"); assert.equal(actual.mission.escort.carrierId, null);
  assert.equal(actual.mission.escort.pickup, false); assert.equal(E.hunter(actual).rewards.find(r => r.id === "reward-13").ready, false);
  assert.equal(actual.mission.deposits.chapel, before.mission.deposits.chapel);
  results.push({ case: name, input: input(name), exported, command, effect: notice.losses[0].effect,
    inputCommands: before.commands.length, finalCommands: actual.commands.length,
    exportedSha256: sha(read(exported)), fullStateMatchesReducer: true, strictReimport: true });
}
const before = imported(input("ground")), cancel = "evidence/native-ground-after-cancel.json";
assert.equal(read(cancel), read(input("ground")));
const dreamFile = "evidence/native-ground-after-dream.json", dream = imported(dreamFile),
  dreamCommand = { type: "DREAM", cardId: E.hunter(before).hand[0].id };
assert.deepEqual(dream, E.dispatch(before, dreamCommand)); assert(E.hunter(dream).inDream);
assert.equal(dream.mission.escort.node, "tile-18:top"); assert.equal(dream.mission.escort.carrierId, null);
const report = { version: require(path.join(root, "package.json")).version, verifiedAt: new Date().toISOString(),
  environment: "Local native Codex In-app Browser, isolated read-only 127.0.0.1:8816 preview; normal file chooser and actual UI controls",
  synthetic: true, normalCampaignMilestoneClaimed: false, cases: results,
  cancel: { exported: cancel, exactInputBytesPreserved: true, sha256: sha(read(cancel)) },
  dream: { input: input("ground"), exported: dreamFile, command: dreamCommand,
    fullStateMatchesReducer: true, strictReimport: true, sha256: sha(read(dreamFile)) },
  nativeAcceptedActions: 4, nativeCancelChecks: 1,
  nativeReturnOrBoldMarkClaimed: false, parentCloudScreenshotInspectedLocally: false,
  notes: ["The parent cloud report's carrierId was not established. Either carried or uncarried escort does not accompany teleportation.",
    "Same-space ground, pickup-armed and carried outcomes were independently reproduced with strict replay-importable QA saves.",
    "No browser app-state injection or storage writes were used. Source DOM showed all three changed JS resources with dev.16 hashes.",
    "Dream return and bold-mark were covered by automated regressions, not counted as new native-browser cases."] };
fs.writeFileSync(path.join(__dirname, "native-verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
