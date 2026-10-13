const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../hunt-presentation.js');

const faceA = 'w-threaded-cane-a', faceB = 'w-threaded-cane-b';
const poseFrames = { idle: [0, 1], walk: [2, 3, 4, 5], 'attack-0': [6, 7, 8, 9],
  'attack-1': [10, 11, 12, 13], 'attack-2': [14, 15, 16, 17], hit: [18, 19], death: [20, 21], transform: [22, 23] };
const { fixture, atlas } = require('./helpers/presentation-harness-v084.cjs');

const hunter = (skin = faceA, hp = 6, x = 80) => ({ id: 'hunter', kind: 'hunter', skin, weaponId: 'threaded-cane', weaponFace: skin === faceB ? 'b' : 'a', x, y: 100, hp });
const enemy = hp => ({ id: 'enemy', kind: 'enemy', skin: 'mob', x: 150, y: 100, hp: hp ?? 10 });
const hit = (slot, overrides = {}) => ({ type: 'attack', fromId: 'hunter', toId: 'enemy', attackSlot: slot, attackStyle: 'weapon', damage: 1, ...overrides });
function equipped(options) { const f = fixture(options); f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), enemy()] }); f.boot(); return f; }
const liveSprites = f => f.sprites.filter(sprite => !sprite.destroyed);

test('only the selected weapon pair preloads alongside the original actor assets', () => {
  const f = fixture({ custom(characters) { characters['w-saw-cleaver-a'] = { ...characters[faceA], relatedSkins: [], path: 'assets/characters/saw.png' }; } });
  f.adapter.sync({ revision: 1, actors: [hunter()] }); f.boot();
  assert.equal(f.loads.length, 7);
  assert.ok(!f.loads.some(load => load.key === 'bb-character-w-saw-cleaver-a'));
  assert.equal(f.host.dataset.presentationWeapon, faceA);
  assert.equal(f.host.dataset.presentationWeaponReady, 'true');
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
  assert.equal(f.sprites[0].height, 128);
  assert.deepEqual(f.sprites[0].origin, [.5, 460 / 512]);
});

test('a weapon selected after boot keeps its DOM token until its original form loads', () => {
  const f = fixture(); f.boot();
  assert.equal(f.loads.length, 5);
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.starts(), 1);
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.equal(f.adapter.actorReady('hunter'),false);
  assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.starts(), 1);
  f.finishLoad();
  assert.equal(f.sprites.length, 2);
  assert.equal(liveSprites(f).find(s=>s.texture==='bb-character-'+faceA).texture, 'bb-character-' + faceA);
  assert.equal(f.host.dataset.presentationWeaponReady, 'true');
  assert.equal(f.notifications.at(-1), true);
});

for (const slot of [0, 1, 2]) test(`resolved weapon attack slot ${slot} selects its exact four frames`, () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(slot)] });
  const key = `bb-${faceA}-attack-${slot}`;
  assert.equal(f.sprites[0].plays.at(-1), key);
  assert.deepEqual(f.definitions.find(definition => definition.key === key).frames.map(frame => frame.frame), poseFrames['attack-' + slot].map(String));
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-hit');
  f.sprites[0].complete('animationcomplete-' + key);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-idle`);
});

test('both weapon forms register independent attack sequences and configured attack pace', () => {
  const f = equipped();
  assert.equal(f.definitions.find(definition => definition.key === `bb-${faceB}-attack-2`).frameRate, 9);
  assert.equal(f.definitions.find(definition => definition.key === `bb-${faceB}-walk`).repeat, -1);
  assert.equal(f.definitions.find(definition => definition.key === `bb-${faceB}-transform`).repeat, 0);
  assert.deepEqual(Object.keys(f.loads.find(load => load.key === 'bb-character-' + faceB).data.frames), Array.from({ length: 24 }, (_, index) => String(index)));
});

test('confirmed transformation immediately equips the target form and returns to its idle', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-transform`);
  assert.equal(f.host.dataset.presentationWeapon, faceB);
  f.sprites[0].complete(`animationcomplete-bb-${faceB}-transform`);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-idle`);
  assert.equal(f.adapter.status().attacks, 0);
});

test('loading, save changes and unconfirmed form changes equip the right form without inventing transformation', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.ok(!f.sprites[0].plays.some(key => key.endsWith('-transform')));
  f.adapter.sync({ revision: 3, sceneId: 'loaded-save', actors: [hunter(faceA)], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.ok(f.sprites.every(sprite => !sprite.plays.some(key => key.endsWith('-transform'))));
});

test('a redundant transformation action cannot animate an unchanged form', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-idle`);
});

test('a confirmed numeric face change replays recharge while the actual weapon texture stays identical', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(), weaponFace: 0 }, enemy()] });
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [{ ...hunter(), weaponFace: 1 }, enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-transform`);
});

test('movement, hit and defeat retain the actual equipped weapon texture', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB, 6, 110), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-walk`);
  f.tween(f.tweens.find(tween => tween.targets === f.sprites[0] && tween.x === 110));
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [hunter(faceB, 4, 110), enemy()], actions: [{ type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 2 }] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-hit`);
  f.adapter.sync({ revision: 4, sceneId: 'hunt', actors: [enemy()], actions: [{ type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 4 }] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-death`);
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
});

test('an explicit source form on a resolved attack restores the current equipment afterward', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(1, { skin: faceA })] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-attack-1`);
  f.sprites[0].complete(`animationcomplete-bb-${faceA}-attack-1`);
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-idle`);
});

test('camera refreshes preserve a consumed-charge source attack until completion without replaying it', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(2, { skin: faceA })] });
  const key = `bb-${faceA}-attack-2`, plays = f.sprites[0].plays.length;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceB), x: 30, y: 70, scale: 1.8 }, enemy(9)], view: { x: 50, y: 30, zoom: 1.8 } });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
  assert.equal(f.sprites[0].plays.at(-1), key);
  assert.equal(f.sprites[0].plays.length, plays);
  assert.equal(f.sprites[0].x, 30); assert.equal(f.sprites[0].y, 70);
  assert.equal(f.sprites[0].height, 128 * 1.8);
  f.sprites[0].complete('animationcomplete-' + key);
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-idle`);
  assert.equal(f.adapter.status().attacks, 1);
});

test('a new resolved hit cancels a former source pose and reacts with the current equipment', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(2, { skin: faceA })] });
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [hunter(faceB, 4), enemy(9)], actions: [
    { type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 2 }
  ] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-hit`);
});

test('firearms and external damage never trigger a selected weapon swing', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(2, { attackStyle: 'other' })] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-idle`);
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [hunter(), enemy(8)], actions: [{ type: 'shot', fromId: 'hunter', toId: 'enemy', damage: 1, attackSlot: 1 }] });
  assert.ok(!f.sprites[0].plays.some(key => key.includes('-attack')));
  assert.equal(f.adapter.status().shots, 1);
});

test('Reiterpallasch-style weapon shot plays its own aiming slot and a muzzle flash', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [
    { type: 'shot', fromId: 'hunter', toId: 'enemy', attackSlot: 1, attackStyle: 'weapon', motion: 'shot', damage: 1 }
  ] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-attack-1`);
  assert.ok(f.graphics.at(-1).commands.some(command => command[0] === 'fillCircle'));
  assert.equal(f.adapter.status().shots, 1);
  assert.equal(f.adapter.status().attacks, 0);
});

test('stake-driver blast plays the equipped punch slot and radial impact instead of a gun shot', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(0, { motion: 'blast' })] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-attack-0`);
  assert.equal(f.graphics.at(-1).commands.filter(command => command[0] === 'strokeCircle').length, 2);
  assert.equal(f.adapter.status().shots, 0);
  assert.equal(f.adapter.status().attacks, 1);
});

for (const [motion, color] of [['electric', 0xafcfff], ['spirit', 0x93c8c5], ['blood', 0xca6574]])
  test(`public ${motion} impact uses its visual color without generating extra rules damage`, () => {
    const f = equipped(), target = enemy(9), snapshot = { revision: 2, sceneId: 'hunt', actors: [hunter(), target], actions: [hit(0, { motion })] };
    const unchanged = JSON.stringify(snapshot);
    f.adapter.sync(snapshot);
    assert.equal(f.graphics.at(-1).commands.find(command => command[0] === 'lineStyle')[2], color);
    assert.equal(JSON.stringify(snapshot), unchanged);
    assert.equal(f.adapter.status().attacks, 1);
  });

test('whip, thrust and overhead public motions have different impact paths', () => {
  const f = equipped(), paths = [];
  for (const [index, motion] of ['whip', 'thrust', 'overhead'].entries()) {
    f.adapter.sync({ revision: 2 + index, sceneId: 'hunt', actors: [hunter(), enemy(9 - index)], actions: [hit(0, { motion })] });
    paths.push(f.graphics.at(-1).commands.filter(command => command[0] === 'lineBetween'));
  }
  assert.notDeepEqual(paths[0], paths[1]); assert.notDeepEqual(paths[1], paths[2]);
});

test('missing original weapon sheets hide the hunter sprite while other enemies remain visible', () => {
  const f = equipped({ missing: ['bb-character-' + faceA] });
  assert.equal(f.adapter.status().charactersReady, true);
  assert.equal(liveSprites(f).length, 1);
  assert.equal(f.sprites[0].texture, 'bb-character-mob');assert.equal(f.adapter.actorReady('hunter'),false);
  assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.ok(liveSprites(f).some(s=>s.texture==='bb-character-'+faceB));assert.equal(f.adapter.actorReady('hunter'),true);
  assert.equal(f.host.dataset.presentationWeaponReady, 'true');
});

test('an incomplete optional atlas does not register a partially invisible form', () => {
  const f = equipped({ incomplete: 'bb-character-' + faceB });
  assert.equal(f.adapter.status().charactersReady, true);
  assert.ok(!f.definitions.some(definition => definition.key.startsWith('bb-' + faceB)));
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()] });
  assert.ok(f.sprites[0].destroyed);assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.equal(f.adapter.actorReady('hunter'),false);
});

test('reduced motion still equips each form instantly without looping or attack effects', () => {
  const f = equipped({ reduced: true });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [{ type: 'transform', fromId: 'hunter' }, hit(0)] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].frame, '0');
  assert.equal(f.sprites[0].plays.length, 0);
  assert.equal(f.adapter.status().attacks, 0);
  f.motion(false);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-idle`);
});

test('a sprite sheet may use all 64 frames with a custom nonzero static idle frame', () => {
  const f = equipped({ reduced: true, custom(characters) {
    const data = characters[faceA]; data.frameCount = 64; data.atlasData = atlas(64);
    data.animations = { idle: [60, 61], walk: [56, 57, 58, 59], 'attack-0': [0, 1, 2, 3], hit: [62], death: [63] };
  } });
  assert.equal(f.sprites[0].frame, '60');
  const loaded = f.loads.find(load => load.key === 'bb-character-' + faceA);
  assert.equal(Object.keys(loaded.data.frames).length, 64);
  assert.equal(f.host.dataset.presentationWeaponReady, 'true');
});

test('invalid attack frame ranges do not switch a ready weapon back to generic attack art', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations['attack-2'] = { frames: [23, 24] }; } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(2)] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-idle`);
  assert.ok(!f.definitions.some(definition => definition.key === `bb-${faceA}-attack-2`));
  assert.equal(f.adapter.status().attacks, 1);
});

test('invalid frame counts above the supported 64-frame limit reject only that optional sheet', () => {
  const f = equipped({ custom(characters) { characters[faceA].frameCount = 65; } });
  assert.ok(!f.loads.some(load => load.key === 'bb-character-' + faceA));
  assert.equal(f.adapter.status().charactersReady, true);
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.equal(f.adapter.actorReady('hunter'),false);
});

test('public projection ignores hidden equipment and future-action getters', () => {
  const f = equipped(); const actor = hunter(faceB), action = hit(1), snapshot = { revision: 2, sceneId: 'hunt', actors: [actor, enemy(9)], actions: [action] };
  for (const object of [actor, action, snapshot]) for (const name of ['inventory', 'deck', 'futureRewards', 'ruleState', 'nextAction']) {
    Object.defineProperty(object, name, { get() { throw Error('secret getter'); } });
  }
  assert.doesNotThrow(() => f.adapter.sync(snapshot));
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-attack-1`);
});

test('late optional loading updates the latest form without replaying completed attacks', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(0)] });
  const attacksBefore = f.adapter.status().attacks;
  f.finishLoad();
  const current=liveSprites(f).find(s=>s.texture==='bb-character-'+faceB);assert(current);
  assert.equal(current.plays.at(-1), `bb-${faceB}-idle`);
  assert.equal(f.adapter.status().attacks, attacksBefore);
});

test('destroying during lazy loading cannot recreate actors or fire readiness callbacks', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter()] });
  f.adapter.destroy(); const count = f.notifications.length;
  f.finishLoad();
  assert.equal(f.adapter.status().renderer, 'stopped');
  assert.equal(f.adapter.status().characters, 0);
  assert.equal(f.notifications.length, count);
});

test('a newer rule revision cancels a deferred equipped-weapon attack', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 100), enemy(9)], actions: [{ type: 'move', fromId: 'hunter' }, hit(2)] });
  const timer = f.timers[0];
  assert.equal(timer.delay, 350);
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [hunter(faceB, 6, 100), enemy(9)], actions: [{ type: 'transform', fromId: 'hunter' }] });
  f.timer(timer);
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-transform`);
  assert.equal(f.adapter.status().attacks, 0);
});

test('a heavy attack completes its full four-frame 9 fps follow-through before the next combatant acts', () => {
  const f = equipped();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 4), enemy(9)], actions: [
    hit(2), { type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 2 }
  ] });
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-attack-2`);
  assert.equal(f.timers[0].delay, 445);
  f.sprites[0].complete(`animationcomplete-bb-${faceA}-attack-2`);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-idle`);
  f.timer(f.timers[0]);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-hit`);
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-attack');
});

test('a quick four-frame weapon attack preserves the old 300 ms minimum combat spacing', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations['attack-0'].frameRate = 16; } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 4), enemy(9)], actions: [
    hit(0), { type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 2 }
  ] });
  assert.equal(f.timers[0].delay, 300);
});

const ownRects = [{ x: 200, y: 420, w: 20, h: 30 }, { x: 260, y: 430, w: 30, h: 20 }];
function clippedCharacters(characters) {
  for (const frame of [0, 2, 3, 6, 10, 14, 18, 20]) characters[faceA].atlasData.frames[String(frame)].clipRects = structuredClone(ownRects);
  characters[faceB].atlasData.frames['22'].clipRects = [{ x: 120, y: 390, w: 15, h: 24 }];
}
const localRects = graphic => graphic.commands.filter(command => command[0] === 'fillRect').map(command => command.slice(1));

test('logical foreground rectangles are safely copied and rendered as a nondisplayed native mask union', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0], mask = sprite.mask;
  assert(mask && !mask.destroyed);
  assert.deepEqual(localRects(mask.graphics), [[-56, -40, 20, 30], [4, -30, 30, 20]]);
  assert.equal(mask.graphics.x, 80); assert.equal(mask.graphics.y, 100);
  assert.equal(mask.graphics.scaleX, .25); assert.equal(mask.graphics.scaleY, .25);
  const clean = f.loads.find(load => load.key === 'bb-character-' + faceA).data.frames['0'].clipRects;
  assert.deepEqual(clean, ownRects);
  assert.notEqual(clean, f.characters[faceA].atlasData.frames['0'].clipRects);
  assert.notEqual(clean[0], f.characters[faceA].atlasData.frames['0'].clipRects[0]);
  assert.equal(f.sprites[1].mask, undefined, 'unmodified generic enemies do not acquire a mask');
});

test('the mask union preserves all included own rectangles and excludes a neighboring foreground point', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), rectangles = localRects(f.sprites[0].mask.graphics);
  const includes = (x, y) => rectangles.some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h);
  assert(includes(210 - 256, 430 - 460)); assert(includes(275 - 256, 440 - 460));
  assert.equal(includes(350 - 256, 425 - 460), false);
});

test('moving masked actors carry their clip along every tween update and honor horizontal facing', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 20), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
  const sprite = f.sprites[0], mask = sprite.mask, movement = f.tweens.find(tween => tween.targets === sprite && tween.x === 20);
  assert.equal(mask.graphics.x, 80, 'the mask starts at the visible departure position');
  assert.equal(mask.graphics.scaleX, -.25, 'leftward movement mirrors its own inclusion geometry');
  sprite.x = 55; sprite.y = 108; movement.onUpdate();
  assert.equal(mask.graphics.x, 55); assert.equal(mask.graphics.y, 108);
  f.tween(movement); assert.equal(mask.graphics.x, 20); assert.equal(mask.graphics.y, 100);
});

test('camera zoom and viewport synchronization update mask placement and scale without another animation', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0], mask = sprite.mask, plays = sprite.plays.length;
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [{ ...hunter(), x: 30, y: 40, scale: 1.8 }, enemy()] });
  assert.equal(mask.graphics.x, 30); assert.equal(mask.graphics.y, 40);
  assert.equal(mask.graphics.scaleX, .45); assert.equal(mask.graphics.scaleY, .45);
  assert.equal(sprite.plays.length, plays);
});

test('animation frame updates attach or clear only the affected pose mask', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0], mask = sprite.mask;
  sprite.advanceFrame('1'); assert.equal(sprite.mask, null, 'the clean idle frame draws its original unmasked sprite');
  sprite.advanceFrame('0'); assert.equal(sprite.mask, mask);
  sprite.frame = { name: '1' }; f.frame(); assert.equal(sprite.mask, null, 'the scene update also guards direct frame changes before render');
  sprite.frame = { name: '0' }; f.frame(); assert.equal(sprite.mask, mask);
});

test('transforming changes inclusion geometry to the new own form and clears it at the clean idle frame', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0];
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(sprite.texture, 'bb-character-' + faceB);
  assert.deepEqual(localRects(sprite.mask.graphics), [[-136, -70, 15, 24]]);
  sprite.complete(`animationcomplete-bb-${faceB}-transform`);
  assert.equal(sprite.mask, null); assert.equal(sprite.texture, 'bb-character-' + faceB);
});

test('a pinned source-form attack keeps its own mask through camera refresh and restores the current form cleanly', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0];
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy(9)], actions: [hit(0, { skin: faceA })] });
  const mask = sprite.mask;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceB), x: 15, y: 50, scale: 2 }, enemy(9)] });
  assert.equal(sprite.texture, 'bb-character-' + faceA); assert.equal(sprite.mask, mask);
  assert.equal(mask.graphics.x, 15); assert.equal(mask.graphics.y, 50); assert.equal(mask.graphics.scaleX, .5);
  sprite.complete(`animationcomplete-bb-${faceA}-attack-0`);
  assert.equal(sprite.texture, 'bb-character-' + faceB); assert.equal(sprite.mask, null);
});

test('resize and reduced motion retain safe static inclusion geometry at the exact current position', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0];
  f.adapter.resize({ width: 400, height: 300 }); f.motion(true);
  assert(sprite.mask); assert.equal(sprite.frame, '0');
  assert.equal(sprite.mask.graphics.x, 80); assert.equal(sprite.mask.graphics.y, 100);
  const attacks = f.adapter.status().attacks;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(0)] });
  assert.equal(f.adapter.status().attacks, attacks); assert(sprite.mask);
});

test('destroy and ordinary removal clear masks before releasing their native graphics and references', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0], mask = sprite.mask, graphic = mask.graphics;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [enemy()] });
  assert.equal(sprite.mask, null); assert(mask.destroyed && graphic.destroyed && sprite.destroyed);
  f.adapter.destroy(); assert(f.maskGraphics.every(value => value.destroyed)); assert(f.masks.every(value => value.destroyed));
});

test('deferred public death keeps its own clip until fading finishes, then releases it', () => {
  const f = equipped({ geometry: true, custom: clippedCharacters }), sprite = f.sprites[0];
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [enemy()], actions: [{ type: 'attack', fromId: 'enemy', toId: 'hunter', damage: 6 }] });
  const mask = sprite.mask, death = f.tweens.find(tween => tween.targets === sprite && tween.alpha === 0);
  assert.equal(sprite.frame, '20'); assert(mask);
  f.tween(death); assert(sprite.destroyed && mask.destroyed && mask.graphics.destroyed);
});

test('unsupported native geometry masking hides only the original weapon actor, without generating a fallback body', () => {
  const f = equipped({ geometry: false, custom: clippedCharacters });
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.equal(f.adapter.actorReady('hunter'),false);
  assert.equal(f.host.dataset.presentationWeaponReady, 'false'); assert.equal(f.adapter.status().charactersReady, true);
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(0)] });
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.ok(!f.sprites.some(s=>!s.destroyed&&s.plays.includes('bb-hunter-attack')));
});

test('a sprite implementation without setMask rejects clipped forms before drawing their pixels', () => {
  const f = equipped({ geometry: true, noSpriteMask: true, custom: clippedCharacters });
  assert.ok(f.sprites[0].destroyed); assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']); assert.equal(f.adapter.status().renderer, 'phaser');
});

for (const invalid of ['bounds', 'empty', 'too-many']) test(`invalid ${invalid} clip rectangles reject the optional sheet instead of drawing its unmasked sidecar`, () => {
  const f = equipped({ geometry: true, custom(characters) {
    characters[faceA].atlasData.frames['0'].clipRects = invalid === 'bounds' ? [{ x: 500, y: 420, w: 20, h: 20 }]
      : invalid === 'empty' ? [] : Array.from({ length: 2049 }, () => ({ x: 0, y: 0, w: 1, h: 1 }));
  } });
  assert.deepEqual(liveSprites(f).map(s=>s.texture),['bb-character-mob']);assert.equal(f.adapter.actorReady('hunter'),false);
  assert.ok(!f.loads.some(load => load.key === 'bb-character-' + faceA));
});

test('mask geometry ignores unrelated metadata and remains independent of loader-side objects', () => {
  const f = equipped({ geometry: true, custom(characters) {
    clippedCharacters(characters);
    Object.defineProperty(characters[faceA].atlasData.frames['0'].clipRects[0], 'hidden', { get() { throw Error('unknown field'); } });
  } });
  const sprite = f.sprites[0], loaderClips = f.loads.find(load => load.key === 'bb-character-' + faceA).data.frames['0'].clipRects;
  loaderClips[0].x = 0;
  sprite.advanceFrame('1'); sprite.advanceFrame('0');
  assert.deepEqual(localRects(sprite.mask.graphics), [[-56, -40, 20, 30], [4, -30, 30, 20]]);
});

test('normalized display heights up to 1024 preserve public actor scale while larger values clamp safely', () => {
  const f = equipped({ custom(characters) { characters[faceA].displayHeight = 200; characters[faceB].displayHeight = 2000; } });
  assert.equal(f.sprites[0].height, 200);
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceB), scale: 1.5 }, enemy()] });
  assert.equal(f.sprites[0].height, 1024 * 1.5);
});

test('all shipped weapon atlases validate their declared real frames and source origins without fabricated motion banks', () => {
  const shipped = require('../assets/characters/weapon-manifest.json');
  const expected = require('../weapon-visuals').ids.flatMap(id => ['w-'+id+'-a','w-'+id+'-b']);
  assert.ok(Object.keys(shipped).length >= 28 && Object.keys(shipped).length <= 30);
  assert.ok(Object.keys(shipped).every(skin => expected.includes(skin)));
  assert.ok(expected.filter(skin => !shipped[skin]).every(skin => skin.startsWith('w-burial-')), 'only documented pending Burial source forms may be absent');
  const f = fixture({ geometry: true, custom(characters) { Object.assign(characters, shipped); } }); f.boot();
  let frameCount = 0, clipCount = 0, revision = 0;
  for (const [skin, data] of Object.entries(shipped)) {
    f.adapter.sync({ revision: ++revision, sceneId: 'shipped-weapon-preview', actors: [hunter(skin)] }); f.finishLoad();
    const sprite = f.sprites.find(value => !value.destroyed);
    assert.equal(sprite.texture, 'bb-character-' + skin, `${skin} renders its validated own atlas`);
    assert.equal(f.host.dataset.presentationWeaponReady, 'true');
    if (data.frameCount === 1) {
      assert.deepEqual(Object.keys(data.animations), ['idle'], `${skin} static original source has no invented motion`);
      assert.deepEqual(data.animations.idle.frames, [0]);
    }
    for (let index = 0; index < data.frameCount; index++) {
      sprite.advanceFrame(String(index)); frameCount++;
      const clips = data.atlasData.frames[String(index)].clipRects;
      if (clips) {
        assert(sprite.mask && !sprite.mask.destroyed, `${skin} frame ${index} uses native clipping`); clipCount++;
        assert.deepEqual(localRects(sprite.mask.graphics), clips.map(rect => [rect.x - data.frameWidth * (data.originX ?? .5), rect.y - data.frameHeight * (data.originY ?? .86), rect.w, rect.h]));
      } else assert.equal(sprite.mask || null, null, `${skin} frame ${index} retains its clean original rendering`);
    }
  }
  assert.equal(frameCount, Object.values(shipped).reduce((sum, data) => sum + data.frameCount, 0));
  assert.equal(clipCount, Object.values(shipped).reduce((sum, data) => sum + Object.values(data.atlasData.frames).filter(frame => frame.clipRects).length, 0));
  f.adapter.destroy(); assert(f.maskGraphics.every(value => value.destroyed));
});
