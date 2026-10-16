const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js");
const commands = require("./fixtures/chapter-one-commands.json");
const create = () => E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 7 });
function replay(visitor = () => {}) {
  let s = create();
  for (const command of commands) {
    s = E.dispatch(s, command);
    visitor(s);
  }
  return s;
}
test("122 real player commands complete chapter one from a fresh seed and preserve final dream progress", () => {
  assert.equal(commands.length, 122);
  const phases = new Set(), s = replay((s) => phases.add(s.phase)), h = E.hunter(s);
  assert.equal(s.setup.campaign, true);
  assert.equal(s.revision, commands.length);
  assert.deepEqual(s.commands, commands);
  assert.equal(s.phase, "over");
  assert.equal(s.result, "chapter-win");
  assert.equal(s.mission.won, true);
  assert.deepEqual(s.mission.completed, [7, 15, 4]);
  assert.equal(E.missionView(s).insight, 2);
  assert.equal(s.mission.targets.mob.complete, true);
  assert.equal(s.mission.targets.main.complete, true);
  assert.equal(s.mission.targets.main.tokens, 0);
  assert.deepEqual(s.mission.fog, []);
  assert.equal(s.mission.chapterDream, true);
  assert(phases.has("upgrade_pick") && phases.has("upgrade_replace"));
  assert.equal(h.inDream, true);
  assert.equal(h.hp, 6);
  assert.equal(h.echoes, 0);
  assert.equal(h.firearmReady, true);
  assert.deepEqual(h.status, { poison: false, frenzy: false });
  assert.equal(h.deck.length, 12);
  assert.equal(h.deck.some((c) => E.data.upgrades.includes(c.kind)), true);
  assert.deepEqual(h.ownedFirearms, ["hunter-pistol", "ludwig-rifle"]);
  assert.equal(h.rewards.length, 4);
  assert.equal(h.rewards.every((r) => r.ready), true);
  assert.deepEqual(s.rewardChoices, []);
  assert(s.track <= E.data.track.length);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  assert.deepEqual(replay(), s);
});
test("natural reward, rescue, combat and final dream checkpoints round-trip by exact replay", () => {
  const recorded = new Set();
  replay((s) => {
    const names = [];
    if (s.rewardChoices.some((q) => q.firearmId)) names.push("firearm-choice");
    if (s.phase === "mission_survivor") names.push("survivor-move");
    if (s.phase === "mission_choice") names.push("rescue-choice");
    if (s.phase === "combat_react" && s.enemies.find((e) => e.id === s.combat.enemyId)?.missionId === "main")
      names.push("main-combat");
    if (s.phase === "upgrade_pick" && s.mission.won && s.rewardChoices.some((q) => q.reason === "slot"))
      names.push("final-dream-shard-choice");
    for (const name of names) if (!recorded.has(name)) {
      recorded.add(name);
      const restored = E.importSave(E.exportSave(s));
      assert.deepEqual(restored, s, name);
      assert.deepEqual(restored.commands, commands.slice(0, s.revision), name);
    }
  });
  assert.deepEqual([...recorded].sort(), ["firearm-choice", "survivor-move", "rescue-choice",
    "main-combat", "final-dream-shard-choice"].sort());
});
