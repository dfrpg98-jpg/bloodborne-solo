const test = require('node:test'), assert = require('node:assert/strict');
const events = require('../hunt-animation-events'), visuals = require('../weapon-visuals');
const hunter = (weaponId = 'threaded-cane', face = 0, charged = false) => ({ id: 'hunter', kind: 'hunter', node: 'a', hp: 6,
  weaponId, weaponFace: face, skin: visuals.skin(weaponId, face, charged) });
const enemy = (hp = 5) => ({ id: 'e1', kind: 'enemy', node: 'a', hp, name: '야수 사냥 무리' });
const snapshot = (revision, overrides = {}) => ({ sceneId: 'normal-campaign', revision, actors: [hunter(), enemy()], events: [], ...overrides });
const line = text => ({ round: 1, text });
const publicCombat = (id, face, slot, charged = false) => { const v = visuals.attack(id, face, slot, charged);
  return { enemyId: 'e1', attackName: visuals.definition(id).faces[face].attacks[slot].name,
    attackSkin: v.skin, attackSlot: v.attackSlot, attackStyle: v.attackStyle, motion: v.motion }; };

for (const slot of [1, 2]) test(`duplicate printed attack name keeps exact selected slot ${slot}`, () => {
  const combat = publicCombat('threaded-cane', 0, slot), a = snapshot(1, { combat }),
    b = snapshot(2, { events: [line('후려치기 · 적에게 2 피해.')] });
  assert.deepEqual(events.describe(a, b, [{ type: 'RESOLVE' }]), [{ type: 'attack', fromId: 'hunter', toId: 'e1', damage: 2,
    skin: 'w-threaded-cane-a', attackSlot: slot, attackStyle: 'weapon', motion: 'whip' }]);
});

test('declaring a weapon attack supplies no resolved swing', () => {
  const a = snapshot(1), b = snapshot(2, { combat: publicCombat('threaded-cane', 0, 2), events: [line('집중 → 후려치기 (속도 2, 피해 2).')] });
  assert.deepEqual(events.describe(a, b, [{ type: 'ATTACK', slot: 2, enemyId: 'e1' }]), []);
});

test('only the exact declared weapon label receives weapon animation metadata', () => {
  const a = snapshot(1, { combat: publicCombat('threaded-cane', 0, 2) }), b = snapshot(2, { events: [line('소모품 · 적에게 2 피해.')] });
  assert.deepEqual(events.describe(a, b, [{ type: 'USE_CONSUMABLE', enemyId: 'e1' }]),
    [{ type: 'attack', fromId: 'hunter', toId: 'e1', damage: 2, attackStyle: 'other' }]);
});

test('reward and named splash impacts do not invent another melee swing', () => {
  const a = snapshot(1, { combat: publicCombat('threaded-cane', 0, 2) }),
    b = snapshot(2, { actors: [hunter(), enemy(4)], events: [line('성스러운 종 · 야수 사냥 무리에게 피해 1.')] });
  assert.equal(events.describe(a, b, [{ type: 'USE_REWARD', enemyId: 'e1' }])[0].attackStyle, 'other');
});

test('resolved ordinary firearm shots never use a pending weapon slot', () => {
  const a = snapshot(1, { firearmReady: true, combat: publicCombat('threaded-cane', 0, 2) }),
    b = snapshot(2, { firearmReady: false, events: [line('사냥꾼의 권총 · 기본 공격 자동 방해, 화기 소진.')] });
  assert.deepEqual(events.describe(a, b, [{ type: 'FIREARM' }]), [{ type: 'shot', fromId: 'hunter', toId: 'e1', attackStyle: 'other' }]);
});

for (const damage of [0, 2]) test(`accepted Reiterpallasch shot animates even when actual damage is ${damage}`, () => {
  const actors = [hunter('reiterpallasch', 1), enemy()], a = snapshot(1, { actors }),
    b = snapshot(2, { actors: [actors[0], enemy(5 - damage)], weaponShot: visuals.attack('reiterpallasch', 1, 1),
      events: [line('레이테르팔라슈 · 카드를 뒷면으로 놓고 피해 2.')] });
  assert.deepEqual(events.describe(a, b, [{ type: 'WEAPON_SHOT', slot: 1, enemyId: 'e1' }]),
    [{ type: 'shot', fromId: 'hunter', toId: 'e1', damage, skin: 'w-reiterpallasch-b', attackSlot: 1, attackStyle: 'weapon', motion: 'shot' }]);
});

test('a declined free transform and a load/change without accepted transform emit no transform', () => {
  const a = snapshot(1), b = snapshot(2, { actors: [hunter('threaded-cane', 1), enemy()] });
  assert.deepEqual(events.describe(a, b, [{ type: 'FREE_TRANSFORM', accept: false }]), []);
  assert.deepEqual(events.describe(a, b, []), []);
  assert.deepEqual(events.describe(a, { ...b, sceneId: 'loaded-save' }, [{ type: 'TRANSFORM' }]), []);
});

for (const id of visuals.ids) test(`${id} accepted transformation uses the actual target face`, () => {
  for (const face of [0, 1]) {
    const a = snapshot(1, { actors: [hunter(id, face, id === 'tonitrus'), enemy()] }),
      b = snapshot(2, { actors: [hunter(id, 1 - face, id === 'tonitrus'), enemy()] });
    assert.deepEqual(events.describe(a, b, [{ type: 'TRANSFORM', cardId: 'card-3' }]),
      [{ type: 'transform', fromId: 'hunter', skin: b.actors[0].skin }]);
  }
});

test('Tonitrus accepted recharging transforms while its already charged skin stays identical', () => {
  const a = snapshot(1, { actors: [hunter('tonitrus', 0, true), enemy()] }),
    b = snapshot(2, { actors: [hunter('tonitrus', 1, true), enemy()] });
  assert.equal(a.actors[0].skin, b.actors[0].skin);
  assert.equal(events.describe(a, b, [{ type: 'FREE_TRANSFORM', accept: true }])[0].type, 'transform');
});

test('attack source charge remains public while the live hunter has already lost its glow', () => {
  const a = snapshot(1, { actors: [hunter('tonitrus', 1), enemy()], combat: publicCombat('tonitrus', 1, 0, true) }),
    b = snapshot(2, { actors: [hunter('tonitrus', 1), enemy(2)], events: [line('후리기 · 적에게 3 피해.')] });
  assert.equal(events.describe(a, b, [{ type: 'RESOLVE' }])[0].skin, 'w-tonitrus-b');
  assert.equal(events.describe(a, b, [{ type: 'RESOLVE' }])[0].motion, 'electric');
});

test('frozen public equipment fields never require hidden getters or mutate input', () => {
  const a = snapshot(1, { combat: publicCombat('threaded-cane', 0, 2) }),
    b = snapshot(2, { events: [line('후려치기 · 적에게 2 피해.')] });
  for (const object of [a, b, a.combat, ...a.actors, ...b.actors]) {
    for (const key of ['state', 'deck', 'bossDecks', 'futureRewards', 'nextAction']) Object.defineProperty(object, key, { get() { throw Error('hidden getter'); } });
    Object.freeze(object);
  }
  assert.doesNotThrow(() => events.describe(a, b, [{ type: 'RESOLVE' }]));
  assert.equal(events.describe(a, b, [{ type: 'RESOLVE' }])[0].attackSlot, 2);
});
