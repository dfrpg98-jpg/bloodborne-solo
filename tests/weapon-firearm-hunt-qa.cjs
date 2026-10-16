"use strict";
// Bounded natural campaign breadth QA. The simple policy is deliberately not
// a solver and a loss is a valid terminal result, not a campaign-win claim.
const assert = require("node:assert/strict"), E = require("../src/hunt-engine.js");
const { choose: basicChoose } = require("./hunt-playthrough-helper.cjs");
function choose(s) {
  const h = E.hunter(s), choices = s.rewardChoices || [];
  if (choices.length) {
    const q = choices[0];
    if (q.firearmId) return { type: "KEEP_FIREARM", firearmId: q.firearmId };
    if (q.reason === "slot") return { type: "EQUIP_REWARD", rewardId: q.rewardId, slot: 0 };
    return { type: "KEEP_REWARD", rewardId: q.rewardId };
  }
  if (s.phase.startsWith("mission_")) {
    const actions = E.missionActions(s), action = actions.find(a => a.command.choice === "release") || actions[0];
    assert(action, `a real ${s.phase} action exists`); return action.command;
  }
  if (s.phase === "weapon_choice") {
    const choices = E.weaponChoices(s);
    return (choices.find(c => c.command.stop) || choices.find(c => !c.disabled)).command;
  }
  if (s.phase === "weapon_entry") return { type: "ENTRY_WEAPON", accept: false };
  if (s.phase === "firearm_react") return { type: "FIREARM_ENTRY", accept: true };
  if (s.phase === "boss_move") return { type: "BOSS_STEP", node: E.bossMoveOptions(s)[0] };
  if (s.phase === "boss_react") return { type: "RESOLVE" };
  if (s.phase === "between_chapters") return { type: "START_NEXT_CHAPTER", startSpace: "center" };
  if (s.phase === "hunter") {
    const e = s.enemies.find(e => e.node === h.position);
    const gun = E.firearm(s);
    if (e && E.canFirearm(s) && ["hunter-turn", "hunter-effect"].includes(gun.trigger))
      return { type: "FIREARM", enemyId: e.id };
  }
  return basicChoose(structuredClone(s));
}
function run(id, face, seed = 90, rulesVersion = 11) {
  const gun = E.data.weapons[id].defaultFirearm || "hunter-pistol";
  let s = E.create(seed, id, face, null, gun, "center", { campaign: true, rulesVersion });
  const phases = new Set([s.phase]), replayed = new Set();
  for (let n = 0; s.phase !== "over" && n < 900; n++) {
    const command = choose(s);
    try { s = E.dispatch(s, command); }
    catch (error) {
      error.message = `${id}/${face}/${gun} at ${s.revision}/${s.phase}: ${JSON.stringify(command)}: ${error.message}`;
      throw error;
    }
    E.assertState(s);
    assert.equal(E.hunter(s).slots.length, E.slots(s).length);
    phases.add(s.phase);
    const checkpoint = `${s.round >= 3 ? "later" : "early"}:${s.phase}`;
    if (s.revision > 0 && !replayed.has(checkpoint) && ["combat_react", "return", "upgrade_replace", "mission_choice"].includes(s.phase)) {
      const restored = E.importSave(E.exportSave(s)); assert.deepEqual(restored, s); s = restored; replayed.add(checkpoint);
    }
  }
  assert.equal(s.phase, "over", `${id}/${face} must terminate without a reducer deadlock`);
  assert(s.round >= 3, `${id}/${face} exercises multiple actual rounds`);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  return { weaponId: id, face, firearmId: gun, seed, rulesVersion, result: s.result,
    chapter: s.mission.chapter, commands: s.commands.length, rounds: s.round, kills: s.kills,
    phases: [...phases].sort(), replayCheckpoints: replayed.size, state: s };
}
module.exports = { run };
if (require.main === module) {
  const fs = require("node:fs"), rows = [];
  for (const id of Object.keys(E.data.weapons).filter(id => id !== "training")) for (const face of [0, 1]) {
    const row = run(id, face); delete row.state; rows.push(row);
  }
  const report = { kind: "natural bounded campaign breadth; losses are not wins", runs: rows };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n", "utf8");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
