const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../hunt-presentation.js');

const faceA = 'w-threaded-cane-a', faceB = 'w-threaded-cane-b';
const poseFrames = { idle: [0, 1], walk: [2, 3, 4, 5], 'attack-0': [6, 7, 8, 9],
  'attack-1': [10, 11, 12, 13], 'attack-2': [14, 15, 16, 17], hit: [18, 19], death: [20, 21], transform: [22, 23] };
function atlas(count) {
  return { frames: Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index), {
    frame: { x: index % 8 * 32, y: Math.floor(index / 8) * 32, w: 32, h: 32 }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 200, y: 424, w: 32, h: 32 }, sourceSize: { w: 512, h: 512 }
  }])), meta: { size: { w: 256, h: Math.ceil(count / 8) * 32 } } };
}
function fixture({ reduced = false, missing = [], incomplete = null, custom = null, geometry = false, noSpriteMask = false } = {}) {
  const sprites = [], graphics = [], maskGraphics = [], masks = [], definitions = [], loads = [], tweens = [], timers = [], notifications = [], loaded = new Set();
  let config, completeLoad, mediaChange, starts = 0;
  const characters = Object.fromEntries(['hunter', 'mob', 'beast', 'boss', 'female'].map(skin => [skin,
    { path: `assets/characters/${skin}.png`, frameWidth: 256, frameHeight: 256 }]));
  for (const skin of [faceA, faceB]) characters[skin] = {
    path: `assets/characters/${skin}.png`, atlasPath: `assets/characters/${skin}.atlas.json`, atlasData: atlas(24),
    frameCount: 24, frameWidth: 512, frameHeight: 512, displayHeight: 128, originY: 460 / 512,
    relatedSkins: [skin === faceA ? faceB : faceA],
    animations: Object.fromEntries(Object.entries(poseFrames).map(([name, frames]) => [name, { frames, frameRate: name === 'attack-2' ? 9 : 12 }]))
  };
  custom?.(characters);
  function object(x = 0, y = 0) {
    return { x, y, plays: [], listeners: new Map(), destroyed: false,
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setDepth(value) { this.depth = value; return this; }, setScale(x, y = x) { this.scale = x; this.scaleX = x; this.scaleY = y; return this; },
      setDisplaySize(width, height) { this.width = width; this.height = height; this.scaleX = width / (this.logicalWidth || width); this.scaleY = height / (this.logicalHeight || height); return this; },
      setOrigin(x, y) { this.origin = [x, y]; return this; }, setFlipX(value) { this.flipX = value; return this; },
      setTexture(texture, frame) { this.texture = texture; this.frame = frame;
        const data = characters[texture.replace('bb-character-', '')]; this.logicalWidth = data?.frameWidth; this.logicalHeight = data?.frameHeight; return this; },
      setFrame(frame) { this.frame = frame; return this; },
      play(key, ignore) { if (!ignore || this.plays.at(-1) !== key) { this.plays.push(key);
        this.frame = definitions.find(value => value.key === key)?.frames[0]?.frame ?? this.frame; } return this; },
      on(event, callback) { this.continuous ||= new Map(); this.continuous.set(event, callback); return this; },
      advanceFrame(frame) { this.frame = frame; this.continuous?.get('animationupdate')?.(); },
      setMask(mask) { this.mask = mask; return this; }, clearMask() { this.mask = null; return this; },
      once(event, callback) { this.listeners.set(event, callback); return this; },
      removeAllListeners(event) { this.listeners.delete(event); return this; },
      complete(event) { const callback = this.listeners.get(event); this.listeners.delete(event); callback?.(); },
      destroy() { this.destroyed = true; } };
  }
  const scene = {
    load: { spritesheet(key, path, data) { loads.push({ key, path, data, type: 'sheet' }); },
      atlas(key, path, data) { loads.push({ key, path, data, type: 'atlas' }); },
      once(event, callback) { assert.equal(event, 'complete'); completeLoad = callback; }, start() { starts++; } },
    textures: { exists(key) { return loaded.has(key); }, get(key) { return { has(frame) { return !(key === incomplete && String(frame) === '23'); } }; } },
    anims: { exists(key) { return definitions.some(definition => definition.key === key); },
      generateFrameNumbers(key, data) { return data.frames.map(frame => ({ key, frame })); }, create(definition) { definitions.push(definition); } },
    add: { sprite(x, y, texture, frame) {
      const sprite = object(x, y); sprite.setTexture(texture, frame);
      if (noSpriteMask) { sprite.setMask = undefined; sprite.clearMask = undefined; }
      sprite.anims = { stop() { sprite.stopped = true; } }; sprites.push(sprite); return sprite;
    }, graphics() { const graphic = object(); graphic.commands = []; graphics.push(graphic);
      for (const name of ['lineStyle', 'fillStyle', 'fillEllipse', 'fillCircle', 'fillPoints', 'strokePoints', 'strokeCircle', 'lineBetween'])
        graphic[name] = (...args) => { graphic.commands.push([name, ...args]); return graphic; };
      return graphic;
    } },
    tweens: { add(data) { tweens.push(data); }, killTweensOf(target) { for (const tween of tweens) if (tween.targets === target) tween.killed = true; },
      killAll() { for (const tween of tweens) tween.killed = true; } },
    time: { delayedCall(delay, callback) { const timer = { delay, callback, remove() { this.removed = true; } }; timers.push(timer); return timer; } }
  };
  scene.time.now = 0;
  if (geometry) scene.make = { graphics(options) {
    assert.equal(options.add, false, 'mask paths are never added to the display list');
    const graphic = object(); graphic.commands = []; graphic.clearCount = 0;
    graphic.clear = () => { graphic.commands = []; graphic.clearCount++; return graphic; };
    graphic.fillStyle = (...args) => { graphic.commands.push(['fillStyle', ...args]); return graphic; };
    graphic.fillRect = (...args) => { graphic.commands.push(['fillRect', ...args]); return graphic; };
    graphic.createGeometryMask = () => { if (geometry === 'throw') throw Error('native clipping unavailable');
      const mask = { graphics: graphic, destroyed: false, destroy() { this.destroyed = true; } };
      masks.push(mask); return mask; };
    maskGraphics.push(graphic); return graphic;
  } };
  function finishAssets() { for (const load of loads) if (!missing.includes(load.key)) loaded.add(load.key); }
  const host = { dataset: {} }, media = { matches: reduced, addEventListener(type, callback) { mediaChange = callback; }, removeEventListener() {} };
  const adapter = create({ document: { createElement() {}, defaultView: { matchMedia() { return media; } } }, host,
    viewport: { clientWidth: 600, clientHeight: 400 }, characters, onReady(value) { notifications.push(value); },
    Phaser: { VERSION: '4.2.1', CANVAS: 1, Game: class { constructor(value) { config = value; this.canvas = { width: 600, height: 400, style: {}, setAttribute() {} }; this.scale = { resize() {} }; } destroy() {} } } });
  return { adapter, sprites, graphics, maskGraphics, masks, definitions, loads, tweens, timers, host, notifications, characters,
    boot() { config.scene.preload.call(scene); finishAssets(); config.scene.create.call(scene); },
    finishLoad() { finishAssets(); const callback = completeLoad; completeLoad = null; callback?.(); },
    frame() { config.scene.update?.call(scene); },
    starts() { return starts; }, motion(value) { mediaChange({ matches: value }); },
    time(value) { scene.time.now = value; },
    timer(timer) { if (!timer.removed) timer.callback(); },
    tween(tween) { if (!tween.killed) { Object.assign(tween.targets, { x: tween.x ?? tween.targets.x, y: tween.y ?? tween.targets.y }); tween.onComplete?.(); } } };
}
const hunter = (skin = faceA, hp = 6, x = 80) => ({ id: 'hunter', kind: 'hunter', skin, weaponId: 'threaded-cane', weaponFace: skin === faceB ? 'b' : 'a', x, y: 100, hp });
const enemy = hp => ({ id: 'enemy', kind: 'enemy', skin: 'mob', x: 150, y: 100, hp: hp ?? 10 });
const hit = (slot, overrides = {}) => ({ type: 'attack', fromId: 'hunter', toId: 'enemy', attackSlot: slot, attackStyle: 'weapon', damage: 1, ...overrides });
function equipped(options) { const f = fixture(options); f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), enemy()] }); f.boot(); return f; }

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

test('a weapon selected after boot loads its two forms once and replaces the generic fallback', () => {
  const f = fixture(); f.boot();
  assert.equal(f.loads.length, 5);
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.starts(), 1);
  assert.equal(f.sprites[0].texture, 'bb-character-hunter');
  assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.starts(), 1);
  f.finishLoad();
  assert.equal(f.sprites.length, 2);
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceA);
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

test('missing weapon sheets fall back per hunter while all enemies remain visible', () => {
  const f = equipped({ missing: ['bb-character-' + faceA] });
  assert.equal(f.adapter.status().charactersReady, true);
  assert.equal(f.sprites.length, 2);
  assert.equal(f.sprites[0].texture, 'bb-character-hunter');
  assert.equal(f.sprites[1].texture, 'bb-character-mob');
  assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.host.dataset.presentationWeaponReady, 'true');
});

test('an incomplete optional atlas does not register a partially invisible form', () => {
  const f = equipped({ incomplete: 'bb-character-' + faceB });
  assert.equal(f.adapter.status().charactersReady, true);
  assert.ok(!f.definitions.some(definition => definition.key.startsWith('bb-' + faceB)));
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()] });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter');
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
  assert.equal(f.sprites[0].texture, 'bb-character-hunter');
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
  assert.equal(f.sprites[0].texture, 'bb-character-' + faceB);
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-idle`);
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
  assert.equal(f.sprites[0].plays.at(-1), `bb-${faceB}-walk`);
  f.tween(f.tweens.findLast(tween => tween.targets === f.sprites[0] && tween.x === 100));
  f.timer(f.timers.at(-1));
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

test('a full four-frame walking cycle completes before the next attack and returns to stable idle', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations.walk.frameRate = 10; } });
  const snapshot = { revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 20), enemy(9)], actions: [
    { type: 'move', fromId: 'hunter' }, hit(0)
  ] }, unchanged = JSON.stringify(snapshot);
  f.adapter.sync(snapshot);
  const sprite = f.sprites[0], movement = f.tweens.find(tween => tween.targets === sprite && tween.x === 20);
  const walk = f.definitions.find(definition => definition.key === `bb-${faceA}-walk`);
  assert.equal(movement.duration, 400);
  assert.equal(movement.duration, walk.frames.length * 1000 / walk.frameRate);
  assert.equal(f.timers[0].delay, 410, 'the attack starts after the complete walk cycle');
  for (const frame of poseFrames.walk) {
    sprite.advanceFrame(String(frame));
    assert.equal(sprite.plays.at(-1), `bb-${faceA}-walk`);
    assert.equal(sprite.flipX, true);
  }
  sprite.x = 20; movement.onUpdate(); f.tween(movement);
  assert.equal(sprite.x, 20); assert.equal(sprite.y, 100);
  assert.equal(sprite.frame, '0'); assert.equal(sprite.plays.at(-1), `bb-${faceA}-idle`);
  assert.equal(f.graphics[0].x, 20); assert.equal(f.graphics[0].y, 102);
  f.timer(f.timers[0]);
  assert.equal(sprite.plays.at(-1), `bb-${faceA}-attack-0`);
  assert.equal(JSON.stringify(snapshot), unchanged, 'visual timing never changes the public input');
});

for (const [frameRate, duration] of [[20, 340], [2, 600]])
  test(`walk pacing remains bounded for optional ${frameRate} fps clips`, () => {
    const f = equipped({ custom(characters) { characters[faceA].animations.walk.frameRate = frameRate; } });
    f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 5, 20), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
    const movement = f.tweens.find(tween => tween.targets === f.sprites[0] && tween.x === 20);
    assert.equal(movement.duration, duration);
    assert.equal(f.timers[0].delay, duration + 10, 'a nonattack HP reaction uses the same movement boundary');
    f.tween(movement); f.timer(f.timers[0]);
    assert.equal(f.sprites[0].plays.at(-1), `bb-${faceA}-hit`);
  });

test('idle frame changes and same-state refreshes preserve position, facing, origin, scale and shadow', () => {
  const f = equipped(), sprite = f.sprites[0], shadow = f.graphics[0];
  sprite.setFlipX(true);
  const properties = () => [sprite.x, sprite.y, sprite.flipX, ...sprite.origin,
    sprite.scaleX, sprite.scaleY, shadow.x, shadow.y];
  const before = properties(), plays = sprite.plays.length;
  for (let index = 0; index < 8; index++) {
    sprite.advanceFrame(String(index % 2)); f.frame();
    f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), { ...enemy(), selected: !!(index % 2) }] });
    assert.deepEqual(properties(), before);
    assert.equal(sprite.frame, String(index % 2), 'refresh does not restart idle');
    assert.equal(sprite.plays.length, plays);
  }
  assert.equal(f.adapter.status().moves, 0); assert.equal(f.adapter.status().attacks, 0);
});

test('zoom and pan preserve a walking actors half-cycle progress, remaining time and shadow', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations.walk.frameRate = 10; } });
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), enemy()], view: { x: 0, y: 0, zoom: 1 } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 180), enemy()], actions: [{ type: 'move', fromId: 'hunter' }], view: { x: 0, y: 0, zoom: 1 } });
  const sprite = f.sprites[0], movement = f.tweens.find(tween => tween.targets === sprite && tween.x === 180);
  sprite.x = 130; movement.onUpdate(); f.time(200);
  const plays = sprite.plays.length;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceA, 6, 340), y: 170, scale: 2 }, enemy()], view: { x: 20, y: 30, zoom: 2 } });
  const resumed = f.tweens.at(-1);
  assert.equal(movement.killed, true); assert.equal(sprite.x, 240); assert.equal(sprite.y, 170);
  assert.equal(resumed.x, 340); assert.equal(resumed.duration, 200);
  assert.equal(resumed.ease(0), 0); assert.equal(resumed.ease(1), 1);
  assert.equal(sprite.plays.length, plays); assert.equal(sprite.plays.at(-1), `bb-${faceA}-walk`);
  assert.equal(f.graphics[0].x, 240); assert.equal(f.graphics[0].y, 172);
  f.tween(movement); assert.equal(sprite.x, 240);
  f.tween(resumed); assert.equal(sprite.x, 340); assert.equal(sprite.plays.at(-1), `bb-${faceA}-idle`);
  assert.equal(f.adapter.status().moves, 1);
});

test('a rapid return step starts at the visible midwalk position instead of the previous logical destination', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations.walk.frameRate = 10; } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 180), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
  const sprite = f.sprites[0], outward = f.tweens.find(tween => tween.targets === sprite && tween.x === 180);
  sprite.x = 130; outward.onUpdate(); f.time(200);
  const snapshot = { revision: 3, sceneId: 'hunt', actors: [hunter(), enemy()], actions: [{ type: 'move', fromId: 'hunter', from: { x: 180, y: 100 } }] }, unchanged = JSON.stringify(snapshot);
  f.adapter.sync(snapshot);
  const returning = f.tweens.findLast(tween => tween.targets === sprite && tween.x === 80);
  assert.equal(outward.killed, true); assert.equal(sprite.x, 130); assert.equal(sprite.flipX, true);
  assert.equal(returning.duration, 400); f.tween(outward); assert.equal(sprite.x, 130);
  f.tween(returning); assert.equal(sprite.x, 80); assert.equal(sprite.plays.at(-1), `bb-${faceA}-idle`);
  assert.equal(f.adapter.status().moves, 2); assert.equal(JSON.stringify(snapshot), unchanged);
});

test('a combat resolution immediately after movement completes the visible arrival before swinging', () => {
  const f = equipped({ custom(characters) { characters[faceA].animations.walk.frameRate = 10; } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceA, 6, 180), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
  const sprite = f.sprites[0], outward = f.tweens.find(tween => tween.targets === sprite && tween.x === 180);
  sprite.x = 130; outward.onUpdate(); f.time(200);
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [hunter(faceA, 6, 180), enemy(9)], actions: [hit(0)] });
  const arrival = f.tweens.findLast(tween => tween.targets === sprite && tween.x === 180), attack = f.timers.at(-1);
  assert.equal(sprite.x, 130); assert.equal(arrival.duration, 200); assert.equal(attack.delay, 210);
  assert.equal(sprite.plays.at(-1), `bb-${faceA}-walk`); assert.equal(f.adapter.status().attacks, 0);
  f.tween(arrival); f.timer(attack);
  assert.equal(sprite.x, 180); assert.equal(sprite.plays.at(-1), `bb-${faceA}-attack-0`);
  assert.equal(f.adapter.status().moves, 1); assert.equal(f.adapter.status().attacks, 1);
});

test('a removed enemy death body and shadow scale with the same camera zoom as living bodies', () => {
  const f = equipped();
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [hunter(), enemy()], view: { x: 0, y: 0, zoom: 1 } });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter()], actions: [hit(0, { damage: 99 })], view: { x: 0, y: 0, zoom: 1 } });
  const corpse = f.sprites[1], initialHeight = corpse.height;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceA, 6, 160), y: 200, scale: 2 }], view: { x: 0, y: 0, zoom: 2 } });
  assert.equal(corpse.height, initialHeight * 2); assert.equal(corpse.x, 300); assert.equal(corpse.y, 200);
  assert.equal(f.graphics[1].scaleX, 2); assert.equal(f.graphics[1].x, 300); assert.equal(f.graphics[1].y, 202);
  const death = f.tweens.find(tween => tween.targets === corpse && tween.alpha === 0); f.tween(death);
  assert.equal(corpse.destroyed, true); assert.equal(f.adapter.status().characters, 1);
});

test('same-node packing changes settle smoothly without becoming extra rule movement', () => {
  const f = equipped(), sprite = f.sprites[0];
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [{ ...hunter(), node: 'tile-03:room' }, enemy()] });
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceA, 6, 120), node: 'tile-03:room' }, enemy(9)], actions: [hit(0)] });
  const packing = f.tweens.find(tween => tween.targets === sprite && tween.x === 120);
  assert.equal(sprite.x, 80, 'the new packing does not teleport the body'); assert.equal(packing.duration, 240);
  assert.equal(f.timers[0].delay, 250, 'attack waits until the living packing settles');
  f.tween(packing); assert.equal(sprite.x, 120); f.timer(f.timers[0]);
  assert.equal(sprite.plays.at(-1), `bb-${faceA}-attack-0`);
  assert.equal(f.adapter.status().moves, 0); assert.equal(f.adapter.status().attacks, 1);
});

test('killing one of two same-cell enemies retains the strike and death positions before survivor packing', () => {
  const f = fixture(), node = 'tile-14:left';
  const h = { ...hunter(), node, x: 49, y: 186 }, a = { ...enemy(), id: 'a', node, x: 49, y: 145 },
    b = { ...enemy(), id: 'b', node, x: 49, y: 104 };
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [h, a, b], view: { x: 0, y: 0, zoom: 1 } }); f.boot();
  const [hs, as, bs] = f.sprites;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...h, y: 104 }, { ...b, y: 145 }],
    actions: [{ ...hit(0), toId: 'a', damage: 5 }], view: { x: 0, y: 0, zoom: 1 } });
  assert.equal(hs.y, 186); assert.equal(bs.y, 104); assert.equal(as.y, 145);
  const death = f.tweens.find(tween => tween.targets === as && tween.alpha === 0);
  const settlements = f.timers.filter(timer => timer.delay === 750);
  assert.equal(settlements.length, 2, 'both survivors wait until the defeated body fades');
  assert(f.graphics.some(graphic => graphic.commands.some(command => command[0] === 'lineBetween' &&
    command[1] === 49 && command[2] === 186 && command[3] === 49 && command[4] === 145)));
  // While death plays, camera movement also keeps the waiting bodies at their old map points.
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...h, y: 74 }, { ...b, y: 115 }], view: { x: 0, y: 30, zoom: 1 } });
  assert.equal(hs.y, 156); assert.equal(bs.y, 74); assert.equal(as.y, 115);
  f.tween(death); assert.equal(as.destroyed, true);
  for (const timer of settlements) f.timer(timer);
  for (const sprite of [hs, bs]) f.tween(f.tweens.findLast(tween => tween.targets === sprite && tween.y !== undefined));
  assert.equal(hs.y, 74); assert.equal(bs.y, 115);
  assert.equal(f.adapter.status().moves, 0); assert.equal(f.adapter.status().attacks, 1);
});

test('a newer rule revision cancels stale death waiting but settles continuously without resurrecting the enemy', () => {
  const f = fixture(), node = 'tile-14:left', h = { ...hunter(), node }, a = { ...enemy(), id: 'a', node };
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [h, a] }); f.boot();
  const [hs, as] = f.sprites;
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...h, x: 120 }], actions: [{ ...hit(0), toId: 'a', damage: 5 }] });
  const waiting = f.timers.find(timer => timer.delay === 750);
  assert.equal(hs.x, 80); assert.equal(as.destroyed, false);
  f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [{ ...h, x: 120 }] });
  assert.equal(waiting.removed, true); assert.equal(as.destroyed, true);
  const tweenCount = f.tweens.length; f.timer(waiting);
  assert.equal(f.tweens.length, tweenCount); assert.equal(hs.x, 80, 'new input keeps the actual visible old point');
  const settling = f.tweens.findLast(tween => tween.targets === hs && tween.x === 120);
  assert.equal(settling.duration, 240); f.tween(settling); assert.equal(hs.x, 120);
  assert.equal(f.adapter.status().characters, 1); assert.equal(f.adapter.status().moves, 0);
});

for (const nextAction of ['transform', 'heal'])
  test(`early ${nextAction} input after a kill preserves the visible foot point until packing settles`, () => {
    const f = fixture(), node = 'tile-14:left', h = { ...hunter(), node, hp: 4 }, a = { ...enemy(), id: 'a', node };
    f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [h, a] }); f.boot();
    const [hs, as] = f.sprites;
    f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...h, x: 120 }], actions: [{ ...hit(0), toId: 'a', damage: 5 }] });
    const changed = nextAction === 'transform' ? { ...hunter(faceB, 4, 120), node } : { ...h, x: 120, hp: 6 };
    f.adapter.sync({ revision: 3, sceneId: 'hunt', actors: [changed], actions: nextAction === 'transform' ? [{ type: 'transform', fromId: 'hunter' }] : [] });
    assert.equal(hs.x, 80); assert.equal(as.destroyed, true);
    const settling = f.tweens.findLast(tween => tween.targets === hs && tween.x === 120);
    assert.equal(settling.duration, 240); f.tween(settling); assert.equal(hs.x, 120);
    if (nextAction === 'transform') {
      const transform = f.timers.findLast(timer => !timer.removed);
      assert.equal(transform.delay, 250); f.timer(transform);
      assert.equal(hs.plays.at(-1), `bb-${faceB}-transform`);
      hs.complete(`animationcomplete-bb-${faceB}-transform`);
    }
    assert.equal(hs.plays.at(-1), `bb-${nextAction === 'transform' ? faceB : faceA}-idle`);
    assert.equal(f.adapter.status().moves, 0); assert.equal(f.adapter.status().attacks, 1);
  });

test('camera-only projection on a newer revision does not invent a same-node packing adjustment', () => {
  const f = fixture(), node = 'tile-14:left', h = { ...hunter(), node };
  f.adapter.sync({ revision: 1, sceneId: 'hunt', actors: [h], view: { x: 0, y: 0, zoom: 1 } }); f.boot();
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...h, x: 140, y: 170, scale: 2 }], view: { x: 20, y: 30, zoom: 2 } });
  assert.equal(f.sprites[0].x, 140); assert.equal(f.sprites[0].y, 170);
  assert.equal(f.tweens.length, 0); assert.equal(f.timers.length, 0);
  assert.equal(f.adapter.status().moves, 0);
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

test('unsupported native geometry masking falls back per weapon and never loads an unsafe visible pose', () => {
  const f = equipped({ geometry: false, custom: clippedCharacters });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter'); assert.equal(f.sprites[1].texture, 'bb-character-mob');
  assert.equal(f.host.dataset.presentationWeaponReady, 'false'); assert.equal(f.adapter.status().charactersReady, true);
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(), enemy(9)], actions: [hit(0)] });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter'); assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-attack');
});

for (const geometry of [false, 'throw'])
  test(`required shipped bodies retain DOM fallback when native clipping is ${geometry === false ? 'missing' : 'throwing'}`, () => {
    const shipped = require('../assets/characters/manifest.json');
    assert.equal(Object.keys(shipped).length, 5);
    const f = fixture({ geometry, custom(characters) { Object.assign(characters, shipped); } });
    const actors = [{ id: 'hunter', kind: 'hunter', skin: 'hunter', x: 80, y: 100, hp: 6 }, enemy()];
    f.adapter.sync({ revision: 1, sceneId: 'required-body-fallback', actors }); f.boot();
    assert.equal(f.adapter.status().charactersReady, false);
    assert.equal(f.host.dataset.presentationCharacters, 'fallback', 'the game keeps DOM markers visible');
    assert.equal(f.sprites.length, 0, 'unmasked contaminated required PNGs never draw');
    assert.ok(!f.notifications.includes(true), 'the UI never receives a false ready notification');
    f.adapter.sync({ revision: 2, sceneId: 'required-body-fallback', actors: [hunter(), enemy(9)], actions: [hit(0)] });
    f.finishLoad(); f.adapter.resize({ width: 500, height: 300 });
    assert.equal(f.adapter.status().charactersReady, false);
    assert.equal(f.host.dataset.presentationCharacters, 'fallback');
    assert.equal(f.sprites.length, 0, 'optional weapon loading cannot hide unavailable required bodies');
    f.adapter.destroy(); assert.equal(f.adapter.status().characters, 0);
  });

test('a sprite implementation without setMask rejects clipped forms before drawing their pixels', () => {
  const f = equipped({ geometry: true, noSpriteMask: true, custom: clippedCharacters });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter'); assert.equal(f.host.dataset.presentationWeaponReady, 'false');
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [hunter(faceB), enemy()], actions: [{ type: 'transform', fromId: 'hunter' }] });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter'); assert.equal(f.adapter.status().renderer, 'phaser');
});

for (const invalid of ['bounds', 'empty', 'too-many']) test(`invalid ${invalid} clip rectangles reject the optional sheet instead of drawing its unmasked sidecar`, () => {
  const f = equipped({ geometry: true, custom(characters) {
    characters[faceA].atlasData.frames['0'].clipRects = invalid === 'bounds' ? [{ x: 500, y: 420, w: 20, h: 20 }]
      : invalid === 'empty' ? [] : Array.from({ length: 2049 }, () => ({ x: 0, y: 0, w: 1, h: 1 }));
  } });
  assert.equal(f.sprites[0].texture, 'bb-character-hunter');
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

test('normalized display heights up to 256 preserve public actor scale while larger values clamp safely', () => {
  const f = equipped({ custom(characters) { characters[faceA].displayHeight = 200; characters[faceB].displayHeight = 400; } });
  assert.equal(f.sprites[0].height, 200);
  f.adapter.sync({ revision: 2, sceneId: 'hunt', actors: [{ ...hunter(faceB), scale: 1.5 }, enemy()] });
  assert.equal(f.sprites[0].height, 256 * 1.5);
});

test('all 30 shipped weapon atlases and every one of their 720 poses survive runtime validation with exact required mask coverage', () => {
  const shipped = require('../assets/characters/weapon-manifest.json');
  assert.equal(Object.keys(shipped).length, 30);
  const f = fixture({ geometry: true, custom(characters) { Object.assign(characters, shipped); } }); f.boot();
  let frameCount = 0, clipCount = 0, revision = 0;
  for (const [skin, data] of Object.entries(shipped)) {
    f.adapter.sync({ revision: ++revision, sceneId: 'shipped-weapon-preview', actors: [hunter(skin)] }); f.finishLoad();
    const sprite = f.sprites.find(value => !value.destroyed);
    assert.equal(sprite.texture, 'bb-character-' + skin, `${skin} renders its validated own atlas`);
    assert.equal(f.host.dataset.presentationWeaponReady, 'true');
    for (let index = 0; index < data.frameCount; index++) {
      sprite.advanceFrame(String(index)); frameCount++;
      const clips = data.atlasData.frames[String(index)].clipRects;
      if (clips) {
        assert(sprite.mask && !sprite.mask.destroyed, `${skin} frame ${index} uses native clipping`); clipCount++;
        assert.deepEqual(localRects(sprite.mask.graphics), clips.map(rect => [rect.x - 256, rect.y - 460, rect.w, rect.h]));
      } else assert.equal(sprite.mask || null, null, `${skin} frame ${index} retains its clean original rendering`);
    }
  }
  assert.equal(frameCount, 720); assert(clipCount > 0, 'the real shipped assets exercise the vector mask path');
  assert.equal(clipCount, Object.values(shipped).reduce((sum, data) => sum + Object.values(data.atlasData.frames).filter(frame => frame.clipRects).length, 0));
  f.adapter.destroy(); assert(f.maskGraphics.every(value => value.destroyed));
});
