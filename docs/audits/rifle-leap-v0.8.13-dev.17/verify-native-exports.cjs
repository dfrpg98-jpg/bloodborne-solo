"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../../../hunt-engine"), P = require("../../../hunt-attack-preview"), Q = require("../../../tests/helpers/rifle-leap-checkpoints.cjs");
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8"), sha = text => crypto.createHash("sha256").update(text).digest("hex");
function imported(file) { const text = read(file), state = E.importSave(text); assert.equal(E.exportSave(state), text); return state; }
const input = "SYNTHETIC-QA-before-rifle-leap.json", before = imported(input), rebuilt = E.applyTileSpeedRuling(Q.beforeLeap(["bloodstone-shard"]));
assert.equal(E.exportSave(rebuilt), read(input), "public-command synthetic setup rebuilds byte-for-byte");
const adopted = E.applyLeapMoveRuling(before), configured = Q.selection(adopted, { slot: 0 }),
  { weaponBoost, ...command } = configured, preview = P.view(adopted, E, command),
  leapFile = "evidence/native-after-leap.json", leap = imported(leapFile),
  followupFile = "evidence/native-after-followup-move.json", followup = imported(followupFile),
  legacyFile = "evidence/native-loaded-legacy-attack.json", legacy = imported(legacyFile);
assert.equal(weaponBoost, "none"); assert.equal(preview.damage, 5); assert.equal(preview.leapMoveActions, 1);
assert.deepEqual(leap, E.dispatch(adopted, command)); assert.equal(leap.combat.attack.damage, 5); assert.equal(E.hunter(leap).moveActionsRound, 1);
const after = [{ type: "RESOLVE" }, { type: "MOVE", cardId: "card-8" },
  { type: "STEP", node: "tile-03:entry" }, { type: "STOP_MOVE" }];
assert.deepEqual(followup.commands.slice(leap.commands.length), after);
assert.deepEqual(followup, after.reduce((s, c) => E.dispatch(s, c), leap));
assert.equal(E.hunter(followup).position, "tile-03:entry"); assert.equal(E.hunter(followup).moveActionsRound, 2);
assert.equal(E.hunter(followup).hp, 4); assert.equal(followup.phase, "hunter");
assert.equal(read(legacyFile), read("SYNTHETIC-QA-legacy-attack-in-progress.json"));
assert.equal(legacy.combat.attack.damage, 4); assert.equal(E.hunter(legacy).moveActionsRound || 0, 0); assert.equal(legacy.leapMoveRuling, undefined);
const report = { version: require("../../../package.json").version, verifiedAt: new Date().toISOString(),
  environment: "Local Codex In-app Browser, isolated read-only 127.0.0.1:8817 preview",
  mode: "synthetic-QA", normalCampaignCompletionClaimed: false,
  sourceCloudFilesInspectedLocally: false, originalInput: { file: input, commands: before.commands.length, sha256: sha(read(input)) },
  correctedPreview: { damage: preview.damage, formula: preview.formula.damage, leapMoveActions: preview.leapMoveActions, moveActions: preview.moveActions },
  leap: { file: leapFile, command, damage: leap.combat.attack.damage, moveActions: E.hunter(leap).moveActionsRound,
    fullStateEqualsReducer: true, strictReimport: true, sha256: sha(read(leapFile)) },
  followup: { file: followupFile, commands: after, phase: followup.phase, position: E.hunter(followup).position,
    hp: E.hunter(followup).hp, moveActions: E.hunter(followup).moveActionsRound,
    fullStateEqualsReducer: true, strictReimport: true, sha256: sha(read(followupFile)) },
  pendingHistoricalDeclaration: { file: legacyFile, exactInputBytesPreserved: true,
    damage: 4, moveActions: 0, policyDeferred: true, strictReimport: true, sha256: sha(read(legacyFile)) },
  observedRuntimeResources: ["hunt-engine.js?v=0.8.13-dev.17&h=9da62acf9369", "hunt-attack-preview.js?v=0.8.13-dev.17&h=04d4d2b19082", "hunt-app.js?v=0.8.13-dev.17&h=3ef642f608af"],
  browserErrorLogsObserved: 0, internalStateInjectionUsed: false };
fs.writeFileSync(path.join(__dirname, "native-verification.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2));
