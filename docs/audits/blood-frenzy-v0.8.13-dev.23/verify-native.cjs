"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require(path.resolve(__dirname, "../../../hunt-engine"));
const read = file => fs.readFileSync(path.join(__dirname, file));
function load(file) {
  const bytes = read(file), state = E.importSave(bytes.toString("utf8"));
  assert.equal(E.exportSave(state), bytes.toString("utf8"));
  return { file, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), commands: state.commands.length, state };
}
const original = load("inputs/dev22-normal-frenzy-preview-death-save.json"),
  before = load("inputs/QA-HISTORICAL-dev22-frenzy-before-attack-prefix132-save.json"),
  declared = load("inputs/QA-HISTORICAL-dev22-frenzy-declared-before-resolve-prefix133-save.json");
for (const [record, expected] of [[original, "1326f5ce7134602ab94539202ec3e98ca26373344042db2f142bdd8e296365e1"],
  [before, "002c2e0f7a1753242e1feeacebd4067028cadd696cac31838212ab93d4d41cf7"],
  [declared, "24f754c6c2b4725ed2f19220588a0f89e7a78bb878591879ea3a0492d1d312a2"]]) {
  assert.equal(record.sha256, expected); assert(!record.state.setup.qa);
}
assert.equal(E.exportSave(E.dispatch(before.state, original.state.commands[132])), read(declared.file).toString("utf8"));
assert.equal(E.exportSave(E.dispatch(declared.state, original.state.commands[133])), read(original.file).toString("utf8"));
const mapDeclared = load("native/QA-HISTORICAL-map-target-declared.json"), mapDeath = load("native/QA-HISTORICAL-map-target-death-result.json");
assert.deepEqual(mapDeclared.state, declared.state); assert.deepEqual(mapDeath.state, original.state);
assert.notEqual(mapDeclared.sha256, declared.sha256); assert.notEqual(mapDeath.sha256, original.sha256);
assert.deepEqual(Object.keys(mapDeclared.state.commands.at(-1)), ["type", "enemyId", "cardId", "slot", "itemIds", "pullIds", "rewardIds"]);
assert.deepEqual(Object.keys(declared.state.commands.at(-1)), ["type", "cardId", "slot", "itemIds", "pullIds", "rewardIds", "enemyId"]);
const directDeclared = load("native/QA-HISTORICAL-direct-declared.json"), directDeath = load("native/QA-HISTORICAL-direct-death-result.json");
assert(read(directDeclared.file).equals(read(declared.file))); assert(read(directDeath.file).equals(read(original.file)));
const synthetic = [];
for (const variant of ["tie", "mist"]) {
  const input = load(`inputs/SYNTHETIC-QA-${variant}-before.json`), result = load(`native/SYNTHETIC-QA-${variant}-result.json`);
  assert(input.state.setup.qa); assert(result.state.setup.qa);
  const attack = { type: "ATTACK", cardId: "card-12", slot: variant === "tie" ? 1 : 0,
    itemIds: variant === "mist" ? ["item-numbing-mist-1"] : [], pullIds: [], rewardIds: [], enemyId: "scourge-beast-1" };
  const expected = E.dispatch(E.dispatch(input.state, attack), { type: "RESOLVE" });
  assert.equal(E.exportSave(expected), read(result.file).toString("utf8"));
  assert.equal(E.hunter(result.state).hp, variant === "tie" ? 2 : 6);
  assert.equal(E.hunter(result.state).inDream, variant === "mist");
  synthetic.push(input, result);
}
const row = ({ state, ...metadata }) => metadata;
const report = { generatedAt: new Date().toISOString(), sourceZip: { bytes: 19092,
  sha256: "500b6f5fe71f14118c8cee2c074583fcce79414059535f3358154c1f1e3d830e" },
  normalOriginal: row(original), historicalPrefixes: [before, declared].map(row), originalCommandReplayByteExact: true,
  nativeMapTarget: { files: [mapDeclared, mapDeath].map(row), semanticStateAndCommandsEqual: true, rawBytesEqual: false,
    reason: "Existing map-target ATTACK button serializes enemyId before cardId; original general ATTACK serializes enemyId last. No value or game-state difference." },
  nativeDirectPrefix133: { files: [directDeclared, directDeath].map(row), rawBytesEqualOriginals: true },
  synthetic: synthetic.map(row), scope: "Normal UI death original, QA-HISTORICAL exact earned-history prefixes, and separate SYNTHETIC-QA. Not a new campaign run. No previous test counts added." };
fs.writeFileSync(path.join(__dirname, "native-verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
