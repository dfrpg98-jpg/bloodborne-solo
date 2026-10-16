"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"),
  assert = require("node:assert/strict"), E = require("../../../hunt-engine");
const manifest = require("./manifest.json"), result = [];
function strictRoundtrip(state) {
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
}
for (const item of manifest.files) {
  const bytes = fs.readFileSync(path.join(__dirname, item.file));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), item.sha256);
  assert.equal(bytes.length, item.bytes);
  const state = E.importSave(bytes.toString("utf8"));
  assert.equal(E.exportSave(state), bytes.toString("utf8"));
  assert(state.setup.qa, "These are synthetic QA inputs, not player campaign achievements");
  assert.equal(state.commands.length, item.commandCount);
  assert.equal(state.tileSpeedRuling, "all-attacks");
  const beforeHunter = E.hunter(state);
  if (item.id === "axe-target-choice") {
    assert.equal(state.phase, "weapon_choice");
    assert.equal(beforeHunter.weaponId, "hunter-axe"); assert.equal(beforeHunter.face, 1);
    const options = E.weaponChoices(state, {});
    assert.equal(options.length, 2);
    for (const option of options) {
      const target = state.enemies.find(enemy => enemy.id === option.command.enemyId);
      assert.equal(target.hp, 5); assert.equal(target.kind, "huntsmans-minion");
      const next = E.dispatch(state, option.command);
      for (const enemy of next.enemies.filter(enemy => enemy.kind === "huntsmans-minion"))
        assert.equal(enemy.hp, enemy.id === target.id ? 3 : 5);
      assert.equal(E.hunter(next).hp, 6); assert.equal(next.phase, "hunter");
      strictRoundtrip(next);
    }
    result.push({ id: item.id, strictImport: true, independentTargetChoices: 2, selectedHp: 3, otherHp: 5 });
  } else if (item.id === "bone-leap-slam") {
    assert.equal(state.phase, "boss_react");
    const enemy = state.enemies.find(enemy => enemy.id === state.combat.enemyId);
    assert.equal(enemy.componentId, "cleric-beast"); assert.equal(enemy.componentPhase, 2);
    assert.match(state.combat.immediate.name, /뛰어 내려찍기/);
    assert.equal(state.combat.immediate.damage, 2); assert(state.combat.immediate.stun);
    assert.equal(state.combat.dodged, false);
    const bone = E.rewardsView(state).rewards.find(reward => reward.kind === "old-hunter-bone");
    assert(bone.equipped && bone.ready && bone.usable);
    const avoided = E.dispatch(state, { type: "USE_REWARD", rewardId: bone.id });
    assert.equal(avoided.combat.dodged, true); assert.equal(E.hunter(avoided).hp, 6);
    assert.deepEqual(E.hunter(avoided).hand, beforeHunter.hand);
    assert.deepEqual(E.hunter(avoided).slots, beforeHunter.slots);
    assert.equal(E.hunter(avoided).rewards.find(reward => reward.id === bone.id).ready, false);
    strictRoundtrip(avoided);
    const next = E.dispatch(avoided, { type: "RESOLVE" });
    assert.equal(E.hunter(next).hp, 6); assert.equal(next.phase, "combat_choose");
    assert.deepEqual(E.hunter(next).hand, beforeHunter.hand);
    strictRoundtrip(next);
    result.push({ id: item.id, strictImport: true, automaticDodge: true, afterContinueHp: 6, nextPhase: next.phase });
  } else throw Error("Unknown synthetic input");
}
console.log(JSON.stringify({ format: manifest.format, productLogicChanged: false, result }, null, 2));
