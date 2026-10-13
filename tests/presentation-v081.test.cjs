const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const create = require('../hunt-presentation.js');

function fixture({ reduced = false, failure = false } = {}) {
  const graphics = [], tweens = [], sizeChanges = [];
  let game, listener, killed = 0;
  const media = { matches: reduced,
    addEventListener(type, callback) { listener = callback; },
    removeEventListener(type, callback) { if (listener === callback) listener = null; } };
  const scene = { add: { graphics() {
    const g = { alpha: 1, x: 0, y: 0, destroyed: false, commands: [],
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      destroy() { this.destroyed = true; } };
    for (const key of ['lineStyle', 'fillStyle', 'fillPoints', 'strokePoints', 'fillCircle', 'lineBetween', 'strokeCircle']) {
      g[key] = function (...args) { this.commands.push([key, ...args]); return this; };
    }
    graphics.push(g); return g;
  } }, tweens: { add(config) { tweens.push(config); }, killAll() { killed++; } } };
  const Phaser = { VERSION: '4.2.1', CANVAS: 1, Game: class {
    constructor(config) {
      if (failure) throw Error('renderer unavailable');
      this.config = config; this.canvas = { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
      this.scale = { resize(w, h) { sizeChanges.push([w, h]); } }; game = this;
    }
    destroy() { this.destroyed = true; }
  } };
  const host = { dataset: {} }, viewport = { clientWidth: 600, clientHeight: 350 };
  const document = { defaultView: { matchMedia() { return media; } }, createElement() {} };
  const adapter = create({ document, Phaser, host, viewport });
  return { adapter, Phaser, host, viewport, graphics, tweens, sizeChanges,
    boot() { game.config.scene.create.call(scene); },
    game() { return game; }, killed() { return killed; },
    motion(matches) { listener?.({ matches }); }, listener() { return listener; } };
}
const actor = (id, x, y, kind = 'hunter') => ({ id, x, y, kind });

test('the bundled Phaser runtime is pinned and matches its provenance digest', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/phaser-provenance.json')));
  const bytes = fs.readFileSync(path.join(root, 'assets/vendor', manifest.bundledFile));
  assert.equal(manifest.version, '4.2.1');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.tarballUrl, 'https://registry.npmjs.org/phaser/-/phaser-4.2.1.tgz');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.bundledSha256);
  assert.match(fs.readFileSync(path.join(root, 'assets/vendor/phaser-LICENSE.md'), 'utf8'), /MIT License/);
});
test('presentation uses one noninteractive transparent scene and latest preboot public snapshot', () => {
  const f = fixture();
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30)] });
  f.adapter.sync({ revision: 2, actors: [actor('hunter', 75, 30)] });
  assert.equal(f.adapter.status().renderer, 'loading');
  f.boot();
  assert.equal(f.adapter.status().renderer, 'phaser');
  assert.equal(f.game().config.transparent, true);
  assert.deepEqual(f.game().config.input, { mouse: false, touch: false, keyboard: false, gamepad: false });
  assert.equal(f.game().canvas.attrs['aria-hidden'], 'true');
  assert.equal(f.game().canvas.style.pointerEvents, 'none');
  assert.equal(f.graphics.length, 0);
  f.adapter.sync({ revision: 3, actors: [actor('hunter', 100, 30)], action: { type: 'move', fromId: 'hunter' } });
  assert.equal(f.adapter.status().moves, 1);
  assert.equal(f.tweens[1].targets.x, 75);
});
test('scrolls, refreshes and target selections do not animate or count as game movement', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30)] });
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 150, 130)], action: { type: 'move', fromId: 'hunter' } });
  f.adapter.sync({ revision: 2, actors: [actor('hunter', 150, 130)] });
  assert.equal(f.graphics.length, 0);
  assert.deepEqual(f.adapter.status(), { renderer: 'phaser', version: '4.2.1', reducedMotion: false, moves: 0, attacks: 0, effects: 0 });
});
test('only the declared moving actor is animated when map camera changes every public coordinate', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30), actor('e1', 100, 100, 'enemy')] });
  f.adapter.sync({ revision: 2, actors: [actor('hunter', 200, 80), actor('e1', 120, 120, 'enemy')], action: { type: 'move', fromId: 'hunter' } });
  assert.equal(f.adapter.status().moves, 1);
  assert.equal(f.graphics.length, 2);
  for (const tween of f.tweens) tween.onComplete();
  assert.equal(f.adapter.status().effects, 0);
  assert.ok(f.graphics.every(g => g.destroyed));
});
test('an actual resolved attack can mark a defeated public target at its last visible location', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30), actor('e1', 70, 50, 'enemy')] });
  f.adapter.sync({ revision: 2, actors: [actor('hunter', 50, 30)], action: { type: 'attack', fromId: 'hunter', toId: 'e1' } });
  assert.equal(f.adapter.status().attacks, 1);
  assert.ok(f.graphics[0].commands.some(command => command[0] === 'strokeCircle' && command[1] === 70 && command[2] === 50));
  f.adapter.sync({ revision: 3, actors: [actor('hunter', 50, 30)], action: { type: 'attack', fromId: 'hunter', toId: 'unrevealed' } });
  assert.equal(f.adapter.status().attacks, 1);
});
test('presentation reads only allowlisted public coordinates and ignores all hidden or rule data', () => {
  const f = fixture(); f.boot();
  const a = actor('hunter', 50, 30);
  Object.defineProperty(a, 'cards', { get() { throw Error('hidden data read'); } });
  const snapshot = { revision: 1, actors: [a], action: { type: 'REVEAL', toId: 'unknown' } };
  Object.defineProperty(snapshot, 'state', { get() { throw Error('engine state read'); } });
  Object.defineProperty(snapshot, 'nextReward', { get() { throw Error('hidden reward read'); } });
  assert.doesNotThrow(() => f.adapter.sync(snapshot));
  assert.equal(f.graphics.length, 0);
});
test('reduced motion cancels effects and disables subsequent moves, attacks and focus effects', () => {
  const f = fixture(); f.boot();
  f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30), actor('e1', 70, 50, 'enemy')] });
  f.adapter.sync({ revision: 2, actors: [actor('hunter', 80, 30), actor('e1', 70, 50, 'enemy')], action: { type: 'move', fromId: 'hunter' } });
  f.motion(true);
  assert.equal(f.adapter.status().effects, 0);
  assert.ok(f.killed() > 0);
  const before = f.graphics.length;
  f.adapter.sync({ revision: 3, actors: [actor('hunter', 80, 30), actor('e1', 70, 50, 'enemy')], action: { type: 'attack', fromId: 'hunter', toId: 'e1' } });
  f.adapter.focus({ x: 70, y: 50 });
  assert.equal(f.graphics.length, before);
  assert.equal(f.host.dataset.presentationMotion, 'reduced');
});
test('resize cleans old effects, updates the existing canvas and destroy removes listeners', () => {
  const f = fixture(); f.boot(); f.adapter.focus({ x: 50, y: 30 });
  f.adapter.resize({ width: 800, height: 400 });
  assert.deepEqual(f.sizeChanges, [[800, 400]]);
  assert.equal(f.adapter.status().effects, 0);
  f.adapter.destroy(); f.adapter.destroy();
  assert.equal(f.game().destroyed, true);
  assert.equal(f.listener(), null);
  assert.equal(f.adapter.status().renderer, 'stopped');
});
test('renderer failure and missing Phaser leave an inert fallback without touching game rules', () => {
  const f = fixture({ failure: true });
  assert.equal(f.adapter.status().renderer, 'fallback');
  assert.doesNotThrow(() => f.adapter.sync({ revision: 1, actors: [actor('hunter', 50, 30)] }));
  assert.doesNotThrow(() => f.adapter.destroy());
  const fallback = create({ document: {}, host: { dataset: {} }, viewport: {} });
  assert.equal(fallback.status().renderer, 'fallback');
  assert.doesNotThrow(() => fallback.sync({ actors: [null, actor('hidden', NaN, 0)] }));
});
