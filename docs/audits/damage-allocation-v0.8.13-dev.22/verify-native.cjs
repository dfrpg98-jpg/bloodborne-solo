"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "hunt-engine"));
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const read = file => fs.readFileSync(path.join(__dirname, file));
const load = file => {
  const bytes = read(file), state = E.importSave(bytes.toString("utf8"));
  assert.equal(E.exportSave(state), bytes.toString("utf8"));
  return { state, file, bytes: bytes.length, sha256: sha(bytes), commands: state.commands.length };
};
const before = load("inputs/normal-parent-before-transform.json"), pending = load("native/normal-two-remaining.json"),
  one = load("native/normal-one-remaining.json"), done = load("native/normal-complete.json");
// Parent's normal-play originals, not generated QA arrangements. The native
// exports are independently compared to the transferred original digests.
for (const [save, expected] of [[before, "c1ff939c356ba49e668d0ef0945f53c00ade03d9235c92d69677027dd1410508"],
  [pending, "937808852d929cf9cf575645ef46fab9523e586c1a2a2e478f163f49f5be2110"],
  [done, "03f80d4f5dde02c2fbfbb506529f5047632e6825f6793eb446e4068b260610ab"]]) assert.equal(save.sha256, expected);
for (const save of [before, pending, one, done]) assert(!save.state.setup.qa && !save.state.setup.practiceTarget);
assert.equal(E.exportSave(E.dispatch(before.state, { type: "TRANSFORM", cardId: "card-11" })), read(pending.file).toString("utf8"));
assert.equal(E.exportSave(E.dispatch(pending.state, { type: "WEAPON_CHOICE", enemyId: "huntsman-mob-2" })), read(one.file).toString("utf8"));
assert.equal(E.exportSave(E.dispatch(one.state, { type: "WEAPON_CHOICE", enemyId: "huntsman-mob-3" })), read(done.file).toString("utf8"));
assert.equal(E.hunter(done.state).hp, 6);
assert.equal(done.state.enemies.find(e => e.id === "huntsman-mob-2").hp, 2);
assert.equal(done.state.enemies.find(e => e.id === "huntsman-mob-3").hp, 1);
const automatic = load("native/SYNTHETIC-QA-auto-complete.json"), autoInput = load("inputs/SYNTHETIC-QA-auto-final.json");
let expectedAuto = E.dispatch(autoInput.state, { type: "WEAPON_CHOICE", enemyId: "huntsmans-minion-1" });
// Existing load/commit migration is deferred while the damage choice is open.
expectedAuto = E.applyLeapMoveRuling(E.applyTileSpeedRuling(E.applyCombatReactionRuling(E.applyChapelRuling(expectedAuto))));
assert.equal(E.exportSave(expectedAuto), read(automatic.file).toString("utf8"));
assert.equal(automatic.state.phase, "hunter"); assert(!automatic.state.weaponEffects);
assert.equal(automatic.state.enemies.find(e => e.id === "huntsman-mob-1").hp, 3);
assert.equal(E.hunter(automatic.state).hp, 2);
const row = ({ state, ...metadata }) => metadata;
const report = { generatedAt: new Date().toISOString(), normalSource: "Parent cloud 8773 normal UI exports; original ZIP SHA256 f8a2fcef2c7ac87e33bcd0e81e106ffdd380415216a40908c23c7720fa815134",
  normal: [before, pending, one, done].map(row), normalBytesMatchOriginals: true,
  synthetic: [autoInput, automatic].map(row), syntheticDeferredMigration: "APPLY_TILE_SPEED_RULING after the final choice",
  scope: "Local UI replay of the transferred normal checkpoint and one SYNTHETIC-QA automatic-resolution boundary; not a new campaign run" };
fs.writeFileSync(path.join(__dirname, "native-verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
