const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../hunt-engine.js'), R = require('../rewards-engine.js');
const { hand } = require('./actual-combat-helper.cjs');
const commands = require('./fixtures/v074-lantern-fog-commands.json');
const H = E.hunter;
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function publicLanternState(count = commands.length) {
  let s = E.create(90, 'rifle-spear', 1, null, 'hunter-pistol', 'center',
    { campaign: true, rulesVersion: 11 });
  for (const command of commands.slice(0, count)) s = E.dispatch(s, command);
  return s;
}

test('public chapter-one fog encounter disables the lantern and offers no forbidden destinations', () => {
  const s = publicLanternState(), before = structuredClone(s);
  assert.equal(s.revision, 83);
  assert.equal(H(s).position, 'tile-17:lower-right');
  assert.deepEqual(s.mission.completed, [7, 15]);
  assert(s.mission.fog.includes('tile-17'));
  assert(E.nodes(s).some(n => n.lamp));
  const r = E.rewardsView(s).rewards.find(r => r.kind === 'lantern');
  assert.equal(r.usable, false);
  assert.equal(r.controls.type, 'lamp');
  assert.deepEqual(r.controls.targets, []);
  assert.match(r.disabledReason, /안개/);
  assert.throws(() => go(s, 'USE_REWARD', { rewardId: r.id, node: 'tile-14:center' }), /등불/);
  assert.deepEqual(s, before);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});

test('every lantern destination offered by a public checkpoint is accepted and replays exactly', () => {
  const s = publicLanternState(10), before = structuredClone(s);
  const r = E.rewardsView(s).rewards.find(r => r.kind === 'lantern');
  assert(r.usable);
  assert(r.controls.targets.length);
  for (const target of r.controls.targets) {
    const moved = go(s, 'USE_REWARD', { rewardId: r.id, node: target.node });
    assert.equal(H(moved).position, target.node);
    assert.equal(H(moved).rewards.find(x => x.id === r.id).ready, false);
    assert.deepEqual(E.importSave(E.exportSave(moved)), moved);
  }
  assert.deepEqual(s, before);
});

test('lantern unavailability explains dream and finished hunt before fog restrictions', () => {
  const s = publicLanternState();
  H(s).inDream = true;
  s.phase = 'dream';
  let r = E.rewardsView(s).rewards.find(r => r.kind === 'lantern');
  assert.equal(r.usable, false);
  assert.equal(r.disabledReason, '사냥꾼의 꿈에서는 사용할 수 없습니다.');
  s.phase = 'over';
  s.result = 'campaign-win';
  r = E.rewardsView(s).rewards.find(r => r.kind === 'lantern');
  assert.equal(r.usable, false);
  assert.equal(r.disabledReason, '사냥이 종료되었습니다.');
  assert.doesNotMatch(r.disabledReason, /안개/);
});

test('lantern targets respect resolved lamp flags and the same destination validator as teleportation', () => {
  const s = E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', { campaign: true, rulesVersion: 11 });
  const id = R.grant(s, 'lantern');
  const nodes = [
    { id: 'broken', name: 'broken', lamp: false, icons: [{ kind: 'lamp' }] },
    { id: 'sealed', name: 'sealed', lamp: true },
    { id: 'allowed', name: 'allowed', lamp: true },
  ];
  const helper = { nodes: () => nodes, canTeleport: (_s, at) => at === 'allowed' };
  const before = structuredClone(s), view = R.view(s, helper).rewards.find(r => r.id === id);
  assert.deepEqual(view.controls.targets, [{ node: 'allowed', name: 'allowed' }]);
  assert.equal(view.usable, true);
  for (const node of ['broken', 'sealed'])
    assert.throws(() => R.dispatch(structuredClone(s), { type: 'USE_REWARD', rewardId: id, node }, helper), /등불/);
  assert.deepEqual(s, before);
});

function displacedAttackFixture(hp) {
  const s = E.create(123, 'burial', 1, null, 'hunter-pistol', 'center',
    { campaign: false, rulesVersion: 11 });
  s.world.assignments.find(a => a.enemyId === 'huntsman-mob').sideId = 'b';
  s.enemies = [{ id: 'huntsman-mob-1', kind: 'huntsman-mob', figure: 1,
    node: H(s).position, hp: 4 }];
  s.enemyDeck = ['ability', 'basic', 'basic', 'basic', 'special', 'special'];
  s.enemyDiscard = [];
  hand(s, ['regain', 'endurance', 'strength']);
  H(s).hp = hp;
  E.assertState(s);
  return s;
}

test('FAQ: a displaced target still permits after-attack healing, while a slain hunter cannot heal', () => {
  for (const hp of [5, 3]) {
    let s = displacedAttackFixture(hp);
    s = go(s, 'ATTACK', { enemyId: s.enemies[0].id, cardId: H(s).hand[0].id, slot: 1 });
    s = go(s, 'RESOLVE');
    while (s.phase === 'enemy_path') s = go(s, 'ENEMY_STEP', { node: E.moveOptions(s)[0] });
    if (hp === 5) {
      assert.equal(s.phase, 'hunter');
      assert.equal(H(s).hp, 4);
      assert.equal(s.enemies[0].hp, 4);
      assert.notEqual(H(s).position, s.enemies[0].node);
      assert(s.events.some(e => e.text.includes('직접 피해가 닿지 않습니다')));
      assert(s.events.some(e => e.text.includes('공격 후 치유 2')));
    } else {
      assert(H(s).inDream);
      assert(!s.events.some(e => e.text.includes('공격 후 치유 2')));
    }
    E.assertState(s);
  }
});
