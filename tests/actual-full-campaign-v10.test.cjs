const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js"), B = require("../src/boss-components.js");
const commands = require("./fixtures/full-campaign-actual-v10-commands.json");

test("325 public version-ten commands win all three Long Hunt chapters with actual Cleric Beast and exact save replay", () => {
  // All states are produced by normal commands. HP, position, hands, boss
  // health, consumables and deck order are never edited by this test.
  let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 10 });
  const actualPhases = new Set(), replayed = new Set();
  let finishingTrack = null;
  assert.equal(commands.length, 325);
  for (const command of commands) {
    const before = s;
    s = E.dispatch(s, command);
    assert.equal(s.setup.rulesVersion, 10);
    assert.equal(E.hunter(s).weaponId, "burial");
    const boss = s.enemies.find(e => e.missionId === "main" && e.componentId === "cleric-beast");
    if (boss) {
      assert.equal(E.enemyDef(s, boss).actual, true);
      assert.equal(E.enemyDef(s, boss).maxHp, boss.componentPhase === 1 ? 10 : 8);
      assert(B.valid(boss));
      const checkpoint = `${s.mission.chapter}:${boss.componentPhase}`;
      actualPhases.add(checkpoint);
      if (!replayed.has(checkpoint)) {
        const restored = E.importSave(E.exportSave(s));
        assert.deepEqual(restored, s);
        // Continue the remaining public command trace from each restored
        // phase checkpoint, not merely from its in-memory counterpart.
        s = restored;
        replayed.add(checkpoint);
      }
    }
    if (s.mission.chapter === 3 && !before.mission.won && s.mission.won) finishingTrack = before.track;
  }
  assert.deepEqual([...actualPhases], ["2:1", "2:2", "3:1", "3:2"]);
  assert.deepEqual(s.mission.history.map(h => [h.chapter, h.completed]), [[1, [7, 15, 4]], [2, [26, 28, 23]]]);
  assert.equal(s.mission.chapter, 3);
  assert.deepEqual(s.mission.completed, [44]);
  assert(s.mission.discarded.includes(41));
  assert(s.mission.revealed.includes(42)); assert(s.mission.revealed.includes(43)); assert(s.mission.revealed.includes(44));
  assert.equal(s.mission.won, true); assert.equal(s.mission.chapterDream, true);
  assert.equal(s.phase, "over"); assert.equal(s.result, "campaign-win");
  assert.equal(s.track, 11); assert.equal(s.track, finishingTrack);
  assert.equal(E.hunter(s).inDream, true); assert.equal(E.hunter(s).hp, 6);
  assert.equal(E.hunter(s).deck.length, 12); assert.equal(E.hunter(s).firearmReady, true);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
