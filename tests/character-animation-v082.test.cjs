const test = require('node:test');
const assert = require('node:assert/strict');
const create = require('../hunt-presentation.js');

function fixture({ reduced = false, missingSkin = null, clock = false, atlas = false, missingLastFrame = false, inlineAtlas = false, invalidInlineAtlas = false } = {}) {
  const sprites = [], graphics = [], tweens = [], definitions = [], loads = [], readiness = [], timers = [], sizes = [];
  let game, motionListener;
  const atlasSource = { frames: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [String(index), {
    frame: { x: index % 4 * 64, y: Math.floor(index / 4) * 64, w: 64, h: 64 }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 192, y: 336, w: 64, h: 64 }, sourceSize: { w: 448, h: 448 }
  }])), meta: { size: { w: 256, h: 256 }, scale: '1' } };
  Object.defineProperty(atlasSource.meta, 'unknown', { get() { throw Error('unknown atlas metadata'); } });
  Object.defineProperty(atlasSource.frames, 'secretFrame', { get() { throw Error('unknown frame'); } });
  if (invalidInlineAtlas) atlasSource.frames['3'].frame.x = 10000;
  const characters = Object.fromEntries(['hunter', 'mob', 'beast', 'boss'].map(skin => [skin,
    { path: `assets/characters/${skin}.png`, frameWidth: atlas ? 448 : 256, frameHeight: atlas ? 448 : 256,
      ...(atlas ? { atlasPath: `assets/characters/${skin}.atlas.json`, originY: 400 / 448, displayHeight: skin === 'boss' ? 160 : 108,
        ...(inlineAtlas ? { atlasData: atlasSource } : {}) } : {}) }]));
  function base(x = 0, y = 0) {
    return { x, y, destroyed: false, alpha: 1, depth: 0, plays: [], listeners: new Map(), stopped: 0,
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setDepth(value) { this.depth = value; return this; },
      setScale(value) { this.scale = value; return this; },
      setDisplaySize(w, h) { this.width = w; this.height = h; return this; },
      setOrigin(x, y) { this.origin = [x, y]; return this; },
      setFlipX(value) { this.flipX = value; return this; },
      setTexture(value, frame) { this.texture = value; this.frame = frame; return this; },
      setFrame(value) { this.frame = value; return this; },
      play(key, ignore) { if (!ignore || this.plays.at(-1) !== key) this.plays.push(key); return this; },
      once(event, fn) { this.listeners.set(event, fn); return this; },
      removeAllListeners(event) { this.listeners.delete(event); return this; },
      complete(event) { const fn = this.listeners.get(event); this.listeners.delete(event); fn?.(); },
      destroy() { this.destroyed = true; } };
  }
  const scene = {
    load: { spritesheet(key, path, config) { loads.push({ key, path, config, type: 'sheet' }); },
      atlas(key, path, atlasPath) { loads.push({ key, path, atlasPath, type: 'atlas' }); } },
    textures: { exists(key) { return key !== `bb-character-${missingSkin}`; },
      get() { return { has(frame) { return !missingLastFrame || String(frame) !== '15'; } }; } },
    anims: { exists(key) { return definitions.some(a => a.key === key); },
      generateFrameNumbers(key, config) { return config.frames.map(frame => ({ key, frame })); },
      create(config) { definitions.push(config); } },
    add: { sprite(x, y, key, frame) {
      const sprite = base(x, y); sprite.texture = key; sprite.frame = frame;
      sprite.anims = { stop() { sprite.stopped++; } }; sprites.push(sprite); return sprite;
    }, graphics() {
      const g = base(); g.commands = [];
      for (const key of ['lineStyle', 'fillStyle', 'fillPoints', 'strokePoints', 'fillCircle', 'fillEllipse', 'lineBetween', 'strokeCircle'])
        g[key] = function (...args) { this.commands.push([key, ...args]); return this; };
      graphics.push(g); return g;
    } },
    tweens: { add(config) { config.killed = false; tweens.push(config); return config; },
      killTweensOf(target) { for (const t of tweens) if (t.targets === target) t.killed = true; },
      killAll() { for (const t of tweens) t.killed = true; } }
  };
  if (clock) scene.time = { delayedCall(delay, callback) {
    const timer = { delay, callback, removed: false, remove() { this.removed = true; } };
    timers.push(timer); return timer;
  } };
  const Phaser = { VERSION: '4.2.1', CANVAS: 1, Game: class {
    constructor(config) {
      this.config = config; this.canvas = { width: config.width, height: config.height, style: {}, setAttribute() {} };
      this.scale = { resize: (width, height) => { sizes.push([width, height]); this.canvas.width = width; this.canvas.height = height; } }; game = this;
    }
    destroy() { this.destroyed = true; }
  } };
  const media = { matches: reduced, addEventListener(type, fn) { motionListener = fn; }, removeEventListener() { motionListener = null; } };
  const host = { dataset: {} };
  const adapter = create({ document: { createElement() {}, defaultView: { matchMedia() { return media; } } },
    Phaser, host, viewport: { clientWidth: 600, clientHeight: 400 }, characters, onReady(value) { readiness.push(value); } });
  return { adapter, host, sprites, graphics, tweens, definitions, loads, readiness, timers, atlasSource, sizes,
    gameConfig() { return game.config; },
    canvas() { return game.canvas; },
    boot() { game.config.scene.preload.call(scene); game.config.scene.create.call(scene); },
    motion(matches) { motionListener?.({ matches }); },
    fireTimer(timer) { if (!timer.removed) timer.callback(); },
    completeTween(config) { if (!config.killed) { Object.assign(config.targets, { x: config.x ?? config.targets.x, y: config.y ?? config.targets.y }); config.onComplete?.(); } }
  };
}
const hunter = (x = 80, y = 80, hp = 6) => ({ id: 'hunter', kind: 'hunter', skin: 'hunter', x, y, hp });
const enemy = (x = 140, y = 80, hp = 5, skin = 'mob') => ({ id: 'e1', kind: 'enemy', skin, x, y, hp });
const shot = (damage = null) => ({ type: 'shot', fromId: 'hunter', toId: 'e1', damage });

test('character sheets load before readiness and define all five finite/looped poses', () => {
  const f = fixture();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.host.dataset.presentationCharacters, 'loading');
  f.boot();
  assert.equal(f.loads.length, 4);
  assert.ok(f.loads.every(a => a.config.frameWidth === 256 && a.config.endFrame === 15));
  assert.equal(f.definitions.length, 20);
  assert.deepEqual(f.definitions.find(a => a.key === 'bb-hunter-attack').frames.map(a => a.frame), [8, 9, 10, 11]);
  assert.equal(f.definitions.find(a => a.key === 'bb-hunter-idle').repeat, -1);
  assert.equal(f.definitions.find(a => a.key === 'bb-boss-death').repeat, 0);
  assert.equal(f.host.dataset.presentationCharacters, 'ready');
  assert.deepEqual(f.readiness, [true]);
  assert.equal(f.adapter.status().characters, 2);
  assert.equal(f.adapter.status().moves, 0);
  assert.equal(f.adapter.status().attacks, 0);
});

test('actors persist across UI refresh and camera zoom without playing movement', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 10, sceneId: 'normal1', actors: [hunter(), enemy()] });
  const before = f.sprites.slice();
  f.adapter.sync({ revision: 10, sceneId: 'normal1', actors: [{ ...hunter(30, 50), scale: 1.5 }, { ...enemy(90, 50), selected: true, scale: 1.5 }] });
  assert.equal(f.sprites.length, 2);
  assert.ok(before.every(s => !s.destroyed));
  assert.equal(before[0].x, 30);
  assert.equal(before[0].height, 108);
  assert.equal(f.adapter.status().moves, 0);
  assert.ok(before.every(s => s.plays.every(key => key.endsWith('-idle'))));
});

test('actual movement animates the existing sprite and returns to idle on completion', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(180), enemy()], actions: [{ type: 'move', fromId: 'hunter', from: { x: 80, y: 80 } }] });
  const h = f.sprites[0], movement = f.tweens.find(t => t.targets === h && t.x === 180);
  assert.equal(f.sprites.length, 2);
  assert.equal(h.x, 80);
  assert.equal(h.plays.at(-1), 'bb-hunter-walk');
  assert.equal(f.adapter.status().moves, 1);
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-idle');
  f.completeTween(movement);
  assert.equal(h.x, 180);
  assert.equal(h.plays.at(-1), 'bb-hunter-idle');
});

test('camera movement during walking cancels the old tween and snaps the public position', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter()] });
  f.adapter.sync({ revision: 2, actors: [hunter(180)], action: { type: 'move', fromId: 'hunter' } });
  const movement = f.tweens.find(t => t.targets === f.sprites[0]);
  f.adapter.sync({ revision: 2, actors: [hunter(100, 120)], action: { type: 'move', fromId: 'hunter' } });
  assert.equal(movement.killed, true);
  assert.equal(f.sprites[0].x, 100);
  assert.equal(f.sprites[0].y, 120);
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-idle');
  f.completeTween(movement);
  assert.equal(f.sprites[0].x, 100);
  assert.equal(f.adapter.status().moves, 1);
});

test('resolved damage plays attack and hit while blocked attacks never invent hit poses', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(), enemy(140, 80, 3)], actions: [{ type: 'attack', fromId: 'hunter', toId: 'e1', damage: 2 }] });
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-attack');
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-hit');
  f.sprites[0].complete('animationcomplete-bb-hunter-attack');
  f.sprites[1].complete('animationcomplete-bb-mob-hit');
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-idle');
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-idle');
  f.adapter.sync({ revision: 3, actors: [hunter(), enemy(140, 80, 3)], actions: [{ type: 'attack', fromId: 'hunter', toId: 'e1', damage: 0 }] });
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-idle');
});

test('defeated public target plays death once then is removed; vanished targets do not respawn', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter()], actions: [{ type: 'attack', fromId: 'hunter', toId: 'e1', damage: 5 }] });
  const target = f.sprites[1], death = f.tweens.find(t => t.targets === target && t.alpha === 0);
  assert.equal(target.plays.at(-1), 'bb-mob-death');
  assert.equal(target.destroyed, false);
  f.completeTween(death);
  assert.equal(target.destroyed, true);
  assert.equal(f.adapter.status().characters, 1);
  const count = f.sprites.length;
  f.adapter.sync({ revision: 3, actors: [hunter()], actions: [{ type: 'attack', fromId: 'hunter', toId: 'e1' }] });
  assert.equal(f.sprites.length, count);
  assert.equal(f.adapter.status().attacks, 1);
});

test('firearm-only flashes do not pose a melee swing or invent damage reactions', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(), enemy()], actions: [shot()] });
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-idle');
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-idle');
  assert.equal(f.adapter.status().shots, 1);
  assert.equal(f.adapter.status().attacks, 0);
  f.adapter.sync({ revision: 3, actors: [hunter(), enemy(140, 80, 4)], actions: [shot(1)] });
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-hit');
});

test('new save/chapter and decreasing revision reset sprites without animated game actions', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 50, sceneId: 'chapter1', actors: [hunter(), enemy()] });
  const old = f.sprites.slice();
  f.adapter.sync({ revision: 51, sceneId: 'chapter2', actors: [hunter(200)], actions: [{ type: 'move', fromId: 'hunter' }] });
  assert.ok(old.every(a => a.destroyed));
  assert.equal(f.adapter.status().moves, 0);
  f.adapter.sync({ revision: 1, sceneId: 'chapter2', actors: [hunter(20)], actions: [{ type: 'move', fromId: 'hunter' }] });
  assert.equal(f.adapter.status().moves, 0);
  assert.equal(f.adapter.status().characters, 1);
});

test('reduced motion draws persistent static actors but disables all pose/effect loops', () => {
  const f = fixture({ reduced: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.adapter.status().characters, 2);
  assert.ok(f.sprites.every(s => s.plays.length === 0 && s.frame === 0));
  f.adapter.sync({ revision: 2, actors: [hunter(200), enemy(140, 80, 4)], actions: [{ type: 'move', fromId: 'hunter' }, { type: 'attack', fromId: 'hunter', toId: 'e1', damage: 1 }] });
  assert.equal(f.sprites[0].x, 200);
  assert.equal(f.adapter.status().moves, 0);
  assert.equal(f.adapter.status().attacks, 0);
  f.motion(false);
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-idle');
  f.motion(true);
  assert.equal(f.sprites[0].frame, 0);
});

test('partial asset loads retain DOM fallback and never create missing/invisible actors', () => {
  const f = fixture({ missingSkin: 'boss' }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.adapter.status().renderer, 'phaser');
  assert.equal(f.adapter.status().charactersReady, false);
  assert.equal(f.host.dataset.presentationCharacters, 'fallback');
  assert.equal(f.sprites.length, 0);
  assert.deepEqual(f.readiness, []);
});

test('public actor and effect projections do not read hidden getters', () => {
  const f = fixture(); f.boot();
  const actor = hunter(), snapshot = { revision: 1, actors: [actor] };
  for (const key of ['deck', 'nextAction', 'mission', 'rewards']) Object.defineProperty(actor, key, { get() { throw Error('hidden actor getter'); } });
  for (const key of ['state', 'save', 'futureStories', 'commands']) Object.defineProperty(snapshot, key, { get() { throw Error('hidden snapshot getter'); } });
  assert.doesNotThrow(() => f.adapter.sync(snapshot));
  assert.equal(f.adapter.status().characters, 1);
  assert.equal(f.adapter.status().charactersReady, true);
});

test('destroy cancels actor tweens and removes persistent sprites without resurrecting them', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(100), enemy()], actions: [{ type: 'move', fromId: 'hunter' }] });
  f.adapter.destroy();
  assert.ok(f.sprites.every(s => s.destroyed));
  assert.equal(f.adapter.status().charactersReady, false);
  assert.equal(f.adapter.status().characters, 0);
  assert.deepEqual(f.readiness, [true, false]);
  f.adapter.sync({ revision: 3, actors: [hunter()] });
  assert.equal(f.sprites.length, 2);
});

test('both combatants get visible attack poses in sequence without blocking game revisions', () => {
  const f = fixture({ clock: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(80, 80, 4), enemy(140, 80, 3)], actions: [
    { type: 'attack', fromId: 'hunter', toId: 'e1', damage: 2 },
    { type: 'attack', fromId: 'e1', toId: 'hunter', damage: 2 }
  ] });
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-attack');
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-hit');
  assert.equal(f.timers[0].delay, 300);
  f.fireTimer(f.timers[0]);
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-attack');
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-hit');
  assert.equal(f.adapter.status().attacks, 2);
});

test('a newer revision cancels deferred visuals rather than replaying stale combat later', () => {
  const f = fixture({ clock: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(200), enemy()], actions: [
    { type: 'move', fromId: 'hunter' }, { type: 'attack', fromId: 'e1', toId: 'hunter' }
  ] });
  const timer = f.timers[0];
  assert.equal(timer.delay, 410);
  f.adapter.sync({ revision: 3, actors: [hunter(200), enemy()] });
  assert.equal(timer.removed, true);
  f.fireTimer(timer);
  assert.equal(f.adapter.status().attacks, 0);
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-idle');
});

test('deferred defeat keeps its already-visible actor until the public death visual begins', () => {
  const f = fixture({ clock: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()], view: { x: 0, y: 0, zoom: 1 } });
  f.adapter.sync({ revision: 2, actors: [hunter(150)], view: { x: 0, y: 0, zoom: 1 }, actions: [
    { type: 'move', fromId: 'hunter' }, { type: 'attack', fromId: 'hunter', toId: 'e1', damage: 5 }
  ] });
  const target = f.sprites[1];
  f.adapter.sync({ revision: 2, actors: [hunter(120)], view: { x: 30, y: 0, zoom: 1 } });
  assert.equal(target.destroyed, false);
  assert.equal(target.x, 110);
  f.fireTimer(f.timers[0]);
  assert.equal(target.plays.at(-1), 'bb-mob-death');
  assert.equal(f.adapter.status().attacks, 1);
});

test('a sprite animation failure restores DOM fallback even when animation cleanup also fails', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.sprites[0].play = () => { throw Error('lost renderer'); };
  assert.doesNotThrow(() => f.adapter.sync({ revision: 2, actors: [hunter(), enemy()], actions: [{ type: 'attack', fromId: 'hunter', toId: 'e1' }] }));
  assert.equal(f.adapter.status().renderer, 'fallback');
  assert.equal(f.adapter.status().charactersReady, false);
  assert.equal(f.adapter.status().characters, 0);
  assert.equal(f.host.dataset.presentationCharacters, 'fallback');
  assert.deepEqual(f.readiness, [true, false]);
});

test('a deferred second attack failure restores DOM fallback without escaping its timer callback', () => {
  const f = fixture({ clock: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(80, 80, 4), enemy(140, 80, 3)], actions: [
    { type: 'attack', fromId: 'hunter', toId: 'e1', damage: 2 },
    { type: 'attack', fromId: 'e1', toId: 'hunter', damage: 2 }
  ] });
  assert.equal(f.adapter.status().attacks, 1);
  assert.equal(f.timers.length, 1);
  const deferred = f.timers[0];
  f.sprites[1].play = () => { throw Error('renderer failed during delayed enemy attack'); };
  assert.doesNotThrow(() => f.fireTimer(deferred));
  assert.equal(f.adapter.status().renderer, 'fallback');
  assert.equal(f.adapter.status().charactersReady, false);
  assert.equal(f.adapter.status().characters, 0);
  assert.equal(f.host.dataset.presentationCharacters, 'fallback');
  assert.deepEqual(f.readiness, [true, false]);
  assert.doesNotThrow(() => f.fireTimer(deferred));
  assert.equal(f.adapter.status().characters, 0);
});
test('a pending public defeat stays at its map location when padded camera zoom and scroll change', () => {
  const f = fixture({ clock: true }); f.boot();
  // A 600 by 400 viewport pads the map by 300/200 CSS pixels. These offsets
  // stay unscaled while the world zooms, including for an already removed actor.
  f.adapter.sync({ revision: 1, actors: [hunter(380, 280), enemy(440, 280)],
    view: { x: -300, y: -200, zoom: 1 } });
  f.adapter.sync({ revision: 2, actors: [hunter(450, 280)],
    view: { x: -300, y: -200, zoom: 1 }, actions: [
      { type: 'move', fromId: 'hunter' }, { type: 'attack', fromId: 'hunter', toId: 'e1', damage: 5 }
    ] });
  const target = f.sprites[1];
  // Zoom 180%, scrollLeft 400 and scrollTop 300: the former enemy remains
  // at world (140,80), which is now screen (152,44), rather than scaling padding.
  f.adapter.sync({ revision: 2, actors: [hunter(170, 44)],
    view: { x: 100, y: 100, zoom: 1.8 } });
  assert.equal(target.destroyed, false);
  assert.equal(target.x, 152);
  assert.equal(target.y, 44);
  f.fireTimer(f.timers[0]);
  assert.equal(target.plays.at(-1), 'bb-mob-death');
  assert.equal(target.x, 152);
  assert.equal(target.y, 44);
  assert.equal(f.adapter.status().moves, 1, 'camera zoom does not create another walk');
});

test('trimmed atlas poses load as named frames with shared sole origin and correct public scale', () => {
  const f = fixture({ atlas: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy(140, 80, 10, 'boss')] });
  assert.ok(f.loads.every(load => load.type === 'atlas' && load.atlasPath.endsWith('.atlas.json')));
  assert.deepEqual(f.definitions.find(a => a.key === 'bb-hunter-attack').frames.map(a => a.frame), ['8', '9', '10', '11']);
  assert.equal(f.sprites[0].frame, '0');
  assert.equal(f.sprites[0].height, 108);
  assert.equal(f.sprites[1].height, 160);
  assert.deepEqual(f.sprites[0].origin, [.5, 400 / 448]);
  f.motion(true);
  assert.equal(f.sprites[0].frame, '0');
  assert.equal(f.adapter.status().charactersReady, true);
});

test('an atlas with missing animation frames keeps the legible DOM fallback', () => {
  const f = fixture({ atlas: true, missingLastFrame: true }); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.adapter.status().charactersReady, false);
  assert.equal(f.host.dataset.presentationCharacters, 'fallback');
  assert.equal(f.sprites.length, 0);
});

test('public HP loss outside combat plays hit without inventing an attacker or future action', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  f.adapter.sync({ revision: 2, actors: [hunter(80, 80, 4), enemy()], actions: [] });
  assert.equal(f.sprites[0].plays.at(-1), 'bb-hunter-hit');
  assert.equal(f.sprites[1].plays.at(-1), 'bb-mob-idle');
  assert.equal(f.adapter.status().attacks, 0);
  assert.equal(f.adapter.status().shots, 0);
  assert.equal(f.adapter.status().effects, 0);
});

test('offline atlas loading uses validated inline rectangles and native Image elements', () => {
  const f = fixture({ atlas: true, inlineAtlas: true }); f.boot();
  assert.deepEqual(f.gameConfig().loader, { imageLoadType: 'HTMLImageElement' });
  const inline = f.loads[0].atlasPath;
  assert.equal(typeof inline, 'object');
  assert.notEqual(inline, f.atlasSource);
  assert.notEqual(inline.frames['0'], f.atlasSource.frames['0']);
  assert.deepEqual(Object.keys(inline.frames), Array.from({ length: 16 }, (_, index) => String(index)));
  assert.deepEqual(Object.keys(inline.meta), ['size', 'scale']);
  assert.deepEqual(inline.frames['0'], f.atlasSource.frames['0']);
  f.adapter.sync({ revision: 1, actors: [hunter(), enemy()] });
  assert.equal(f.adapter.status().charactersReady, true);
});

test('invalid inline atlas bounds fall back to the sidecar path rather than unsanitized data', () => {
  const f = fixture({ atlas: true, inlineAtlas: true, invalidInlineAtlas: true }); f.boot();
  assert.equal(f.loads[0].atlasPath, 'assets/characters/hunter.atlas.json');
  assert.ok(f.loads.every(load => typeof load.atlasPath === 'string'));
});

test('a viewport resize during async asset loading commits the latest canvas dimensions at create', () => {
  const f = fixture({ atlas: true, inlineAtlas: true });
  assert.equal(f.canvas().width, 600);
  assert.equal(f.canvas().height, 400);
  f.adapter.resize({ width: 575, height: 350 });
  f.adapter.resize({ width: 560, height: 330 });
  f.adapter.sync({ revision: 1, actors: [hunter(200, 200)] });
  assert.deepEqual(f.sizes, []);
  f.boot();
  assert.deepEqual(f.sizes, [[560, 330]]);
  assert.equal(f.canvas().width, 560);
  assert.equal(f.canvas().height, 330);
  assert.equal(f.sprites[0].x, 200);
  assert.equal(f.sprites[0].y, 200);
  f.adapter.resize({ width: 560, height: 330 });
  assert.deepEqual(f.sizes, [[560, 330]]);
});
