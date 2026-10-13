const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../hunt-engine.js');
const commands = require('./fixtures/full-campaign-commands.json');
const firstChapter = require('./fixtures/chapter-one-commands.json');
const create = () => E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', { campaign: true });
function replay(visit = () => {}) {
  let s = create();
  for (const command of commands) {
    s = E.dispatch(s, command);
    visit(s);
  }
  return s;
}

test('real commands complete all three chapters with temporary component combat and an exact final save replay', () => {
  assert.equal(commands.length, 327);
  assert.deepEqual(commands.slice(0, firstChapter.length), firstChapter);
  const chapters = new Map(), bossPhases = new Map();
  let chapterThreeRelease;
  const s = replay((s) => {
    const m = s.mission, boss = s.enemies.find((e) => e.missionId === 'main');
    if (boss?.componentId) {
      assert.equal(boss.componentId, 'cleric-beast');
      assert.equal(E.enemyDef(s, boss).temporary, true);
      assert.match(E.enemyDef(s, boss).source, /임시/);
      if (!bossPhases.has(m.chapter)) bossPhases.set(m.chapter, new Set());
      bossPhases.get(m.chapter).add(boss.componentPhase);
    }
    if (m.chapter === 2 && m.revealed.includes(20)) {
      assert(m.deposits.corpses >= 2);
      assert(E.missionView(s).insight >= 2);
    }
    if (m.chapter === 3 && m.discarded.includes(41) && !chapterThreeRelease)
      chapterThreeRelease = { track: s.track, insight: E.missionView(s).insight };
    if (s.phase === 'over') chapters.set(m.chapter, { result: s.result,
      track: s.track, completed: [...m.completed], dream: m.chapterDream });
  });
  assert.deepEqual([...chapters.keys()], [1, 2, 3]);
  assert.deepEqual(chapters.get(1).completed, [7, 15, 4]);
  assert.deepEqual(chapters.get(2).completed, [26, 28, 23]);
  assert.equal(chapters.get(2).result, 'chapter-win');
  assert.equal(chapters.get(2).dream, true);
  assert.deepEqual([...bossPhases.get(2)], [1, 2]);
  assert.deepEqual([...bossPhases.get(3)], [1, 2]);
  assert.deepEqual(chapterThreeRelease, { track: 9, insight: 0 });
  assert.equal(s.phase, 'over');
  assert.equal(s.result, 'campaign-win');
  assert.equal(s.revision, commands.length);
  assert.deepEqual(s.commands, commands);
  assert.equal(s.world.chapter, 3);
  assert.equal(s.mission.won, true);
  assert.equal(s.mission.chapterDream, true);
  assert.equal(s.mission.targets.main.complete, true);
  assert.deepEqual(s.mission.completed, [44]);
  assert.deepEqual(s.mission.history.map((m) => ({ chapter: m.chapter, completed: m.completed })), [
    { chapter: 1, completed: [7, 15, 4] }, { chapter: 2, completed: [26, 28, 23] },
  ]);
  assert(s.track < E.data.track.length);
  assert.equal(s.enemies.some((e) => e.componentId === 'cleric-beast'), false);
  const h = E.hunter(s);
  assert.equal(h.inDream, true);
  assert.equal(h.hp, 6);
  assert.equal(h.echoes, 0);
  assert.equal(h.firearmReady, true);
  assert.deepEqual(h.status, { poison: false, frenzy: false });
  assert.equal(h.deck.length, 12);
  assert(h.deck.some((c) => E.data.upgrades.includes(c.kind)));
  assert.deepEqual(h.ownedFirearms, ['hunter-pistol', 'ludwig-rifle']);
  assert.deepEqual(h.rewards.map((r) => r.kind), ['lantern', 'rune-rapture',
    'bloodstone-shard', 'rune-moon', 'iosefka-vial', 'messengers-gift', 'beast-roar']);
  assert(h.rewards.every((r) => r.ready));
  assert.deepEqual(s.rewardChoices, []);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  assert.deepEqual(replay(), s);
});

test('natural chapter transition, boss and reward checkpoints round-trip by command replay', () => {
  const checkpoints = new Set();
  replay((s) => {
    const m = s.mission, boss = s.enemies.find((e) => e.missionId === 'main');
    const candidates = [];
    if (s.phase === 'between_chapters') candidates.push(`between-${m.chapter}-${m.chapter + 1}`);
    if (m.chapter === 2 && s.rewardChoices.some((q) => q.rewardId &&
      E.hunter(s).rewards.find((r) => r.id === q.rewardId)?.kind === 'iosefka-vial'))
      candidates.push('chapter-two-vial-choice');
    if (m.chapter === 2 && boss?.componentPhase === 2) candidates.push('chapter-two-invincible-boss');
    if (m.chapter === 2 && m.won && s.phase === 'upgrade_pick') candidates.push('chapter-two-final-dream');
    if (m.chapter === 3 && !m.discarded.includes(41)) candidates.push('chapter-three-sealed-boss');
    if (m.chapter === 3 && m.discarded.includes(41) && !m.won) candidates.push('chapter-three-released-boss');
    if (m.chapter === 3 && boss?.componentPhase === 2) candidates.push('chapter-three-second-phase');
    if (s.result === 'campaign-win') candidates.push('campaign-final');
    for (const name of candidates) if (!checkpoints.has(name)) {
      checkpoints.add(name);
      const restored = E.importSave(E.exportSave(s));
      assert.deepEqual(restored, s, name);
      assert.deepEqual(restored.commands, commands.slice(0, s.revision), name);
    }
  });
  assert.deepEqual([...checkpoints].sort(), ['between-1-2', 'between-2-3',
    'chapter-two-vial-choice', 'chapter-two-invincible-boss', 'chapter-two-final-dream',
    'chapter-three-sealed-boss', 'chapter-three-released-boss',
    'chapter-three-second-phase', 'campaign-final'].sort());
});
