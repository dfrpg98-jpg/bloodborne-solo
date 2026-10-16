"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const create = require("../src/hunt-presentation.js");

function fixture(reduced = false, onActorPositions) {
  const sprites = [], tweens = [], definitions = [], graphics = [];
  let config, motionListener;
  function body(x = 0, y = 0) {
    return { x, y, alpha: 1, tint: null, destroyed: false, plays: [], listeners: new Map(),
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setDepth(value) { this.depth = value; return this; },
      setScale(value) { this.scale = value; return this; },
      setDisplaySize(w, h) { this.width = w; this.height = h; return this; },
      setOrigin(x, y) { this.origin = [x, y]; return this; },
      setFlipX(value) { this.flipX = value; return this; },
      setTexture(value, frame) { this.texture = value; this.frame = frame; return this; },
      setFrame(value) { this.frame = value; return this; },
      setTint(value) { this.tint = value; return this; }, clearTint() { this.tint = null; return this; },
      play(key) { this.plays.push(key); return this; },
      once(event, listener) { this.listeners.set(event, listener); return this; },
      removeAllListeners(event) { this.listeners.delete(event); return this; },
      complete(event) { const callback = this.listeners.get(event); this.listeners.delete(event); callback?.(); },
      destroy() { this.destroyed = true; }
    };
  }
  const scene = {
    load: { spritesheet() {} }, textures: { exists() { return true; } },
    anims: { exists(key) { return definitions.some(value => value.key === key); },
      generateFrameNumbers(key, value) { return value.frames.map(frame => ({ key, frame })); },
      create(value) { definitions.push(value); } },
    add: { sprite(x, y, texture, frame) {
      const sprite = body(x, y); Object.assign(sprite, { texture, frame, anims: { stop() {} } }); sprites.push(sprite); return sprite;
    }, graphics() {
      const value = body();
      for (const key of ["lineStyle", "fillStyle", "fillEllipse", "strokeCircle", "lineBetween"])
        value[key] = function () { return this; };
      graphics.push(value); return value;
    } },
    tweens: { add(value) { value.killed = false; tweens.push(value); return value; },
      killTweensOf(target) { for (const tween of tweens) if (tween.targets === target) tween.killed = true; },
      killAll() { for (const tween of tweens) tween.killed = true; } }
  };
  const media = { matches: reduced, addEventListener(_, callback) { motionListener = callback; },
    removeEventListener() { motionListener = null; } };
  const Phaser = { CANVAS: 1, VERSION: "test", Game: class {
    constructor(value) { config = value; this.canvas = { style: {}, setAttribute() {} }; this.scale = { resize() {} }; }
    destroy() {}
  } };
  const characters = Object.fromEntries(["hunter", "mob"].map(skin => [skin,
    { path: `assets/characters/${skin}.png`, frameWidth: 256, frameHeight: 256 }]));
  const presentation = create({ document: { createElement() {}, defaultView: { matchMedia() { return media; } } },
    Phaser, host: { dataset: {} }, viewport: { clientWidth: 600, clientHeight: 400 }, characters, onActorPositions });
  config.scene.preload.call(scene); config.scene.create.call(scene);
  return { presentation, sprites, tweens, graphics,
    advance(duration) {
      while (duration > 0) { const delta = Math.min(100, duration); config.scene.update.call(scene, 0, delta); duration -= delta; }
    },
    reduced(value) { motionListener?.({ matches: value }); },
    complete(tween) { if (!tween.killed) { if (tween.x !== undefined) tween.targets.x = tween.x;
      if (tween.y !== undefined) tween.targets.y = tween.y; tween.onComplete?.(); } }
  };
}
const hunter = { id: "hunter", kind: "hunter", skin: "hunter", x: 80, y: 80, hp: 6, selected: true };
const first = { id: "minion-1", kind: "enemy", skin: "mob", node: "tile-01:top", x: 140, y: 80, hp: 5 };
const second = { ...first, id: "minion-2", x: 180, selected: true };
function sync(f, revision = 1, extra = {}) {
  f.presentation.sync({ revision, sceneId: "selection-test", actors: [hunter, first, second], ...extra });
}

test("only the selected enemy pulses, stays visible, and never changes its position or pose", () => {
  const f = fixture(); sync(f); const target = f.sprites[2], before = [target.x, target.y, target.frame];
  f.advance(800);
  assert.equal(f.sprites[0].alpha, 1, "a selected flag must not pulse the hunter");
  assert.equal(f.sprites[1].alpha, 1, "the identical unselected enemy remains unchanged");
  assert.ok(target.alpha >= .71 && target.alpha <= .73, "the pulse remains around 72% opaque at its dimmest");
  assert.deepEqual([target.x, target.y, target.frame], before);
  assert.equal(target.plays.at(-1), "bb-mob-idle");
  f.advance(800); assert.equal(target.alpha, 1);
  assert.equal(f.tweens.length, 0, "selection creates no competing tweens or recurring effect objects");
  assert.equal(f.presentation.status().effects, 0);
});

test("changing or clearing a target restores the old sprite immediately without restarting animations", () => {
  const f = fixture(); sync(f); f.advance(800); const before = f.sprites.map(sprite => sprite.plays.length);
  sync(f, 1, { actors: [hunter, { ...first, selected: true }, { ...second, selected: false }] });
  assert.equal(f.sprites[2].alpha, 1); f.advance(800); assert.ok(f.sprites[1].alpha < .73);
  sync(f, 1, { actors: [hunter, first, { ...second, selected: false }] });
  assert.equal(f.sprites[1].alpha, 1); assert.equal(f.sprites[2].alpha, 1);
  assert.deepEqual(f.sprites.map(sprite => sprite.plays.length), before);
  assert.equal(f.sprites.length, 3); assert.equal(f.tweens.length, 0);
});

test("selected enemy walking and damage reaction keep their own tweens and animation completions", () => {
  const f = fixture(); sync(f); f.advance(800);
  const target = f.sprites[2], moved = { ...second, x: 260, node: "tile-01:right" };
  sync(f, 2, { actors: [hunter, first, moved], actions: [{ type: "move", fromId: second.id }] });
  const walk = f.tweens.find(tween => tween.targets === target && tween.x === 260);
  assert(walk); assert.equal(target.plays.at(-1), "bb-mob-walk");
  f.advance(400); assert.equal(walk.killed, false); f.complete(walk);
  assert.equal(target.x, 260); assert.equal(target.plays.at(-1), "bb-mob-idle");
  sync(f, 3, { actors: [hunter, first, { ...moved, hp: 3 }], actions: [{ type: "attack", fromId: "hunter", toId: second.id, damage: 2 }] });
  assert.equal(target.plays.at(-1), "bb-mob-hit"); f.advance(400);
  target.complete("animationcomplete-bb-mob-hit"); assert.equal(target.plays.at(-1), "bb-mob-idle");
  assert.ok(target.alpha >= .71 && target.alpha <= 1); assert.equal(target.x, 260);
  assert.equal(f.presentation.status().moves, 1); assert.equal(f.presentation.status().attacks, 1);
});

test("selection never overwrites a defeated enemy fade and removal leaves no pulse work", () => {
  const f = fixture(); sync(f); f.advance(800); const target = f.sprites[2];
  sync(f, 2, { actors: [hunter, first], actions: [{ type: "attack", fromId: "hunter", toId: second.id, damage: 5 }] });
  const death = f.tweens.find(tween => tween.targets === target && tween.alpha === 0);
  assert(death); assert.equal(target.plays.at(-1), "bb-mob-death");
  target.alpha = .2; f.advance(800); assert.equal(target.alpha, .2, "the independent death fade owns opacity");
  f.complete(death); assert.equal(target.destroyed, true); f.advance(1600);
  assert.equal(f.presentation.status().characters, 2); assert.equal(f.sprites.length, 3);
});

test("reduced motion uses a fixed tint, and preference or target changes clean it up", () => {
  const f = fixture(); sync(f); f.advance(800); const target = f.sprites[2];
  f.reduced(true); assert.equal(target.alpha, 1); assert.equal(target.tint, 0xffe5a0);
  const tint = target.tint; f.advance(3200); assert.equal(target.alpha, 1); assert.equal(target.tint, tint);
  assert.equal(f.tweens.filter(tween => !tween.killed).length, 0);
  sync(f, 1, { actors: [hunter, first, { ...second, selected: false }] });
  assert.equal(target.tint, null); assert.equal(target.alpha, 1);
  sync(f); assert.equal(target.tint, tint);
  f.reduced(false); assert.equal(target.tint, null); f.advance(800); assert.ok(target.alpha < .73);
  f.presentation.destroy(); const alpha = target.alpha; f.advance(3200);
  assert.equal(target.alpha, alpha); assert.equal(target.destroyed, true);
});

test("an initially reduced-motion selection is static from the first visible frame", () => {
  const f = fixture(true); sync(f); const target = f.sprites[2];
  assert.equal(target.alpha, 1); assert.equal(target.tint, 0xffe5a0); f.advance(800);
  assert.equal(target.alpha, 1); assert.equal(f.tweens.length, 0);
  assert.equal(f.presentation.status().reducedMotion, true);
});


test("status overlays receive only living enemy identifiers and actual tween coordinates", () => {
  const positions = [], f = fixture(false, value => positions.push(value)); sync(f);
  assert.deepEqual(positions.at(-1), [{ id: first.id, x: 140, y: 80 }, { id: second.id, x: 180, y: 80 }]);
  sync(f, 2, { actors: [hunter, first, { ...second, x: 280, node: "tile-01:right" }], actions: [{ type: "move", fromId: second.id }] });
  assert.equal(positions.at(-1)[1].x, 180, "starting a walk publishes departure, not the future destination");
  f.sprites[2].x = 215; f.sprites[2].y = 90; f.advance(100);
  assert.deepEqual(positions.at(-1)[1], { id: second.id, x: 215, y: 90 });
  assert(positions.every(batch => batch.every(actor => Object.keys(actor).sort().join() === "id,x,y")));
  sync(f, 3, { actors: [hunter, first], actions: [{ type: "attack", fromId: "hunter", toId: second.id, damage: 5 }] });
  f.advance(100); assert(!positions.at(-1).some(actor => actor.id === second.id), "a pending or active death has no live status overlay");
  f.presentation.destroy(); const count = positions.length; f.advance(1000); assert.equal(positions.length, count);
});

test("overlay callbacks remain safe under reduced motion and their failure cannot disable the renderer", () => {
  let calls = 0;
  const f = fixture(true, value => { calls++; assert(value.every(actor => actor.id !== "hunter")); throw Error("independent overlay failure"); });
  sync(f); f.advance(800); assert(calls > 1); assert.equal(f.presentation.status().renderer, "phaser");
  assert.equal(f.presentation.status().characters, 3); assert.equal(f.presentation.status().reducedMotion, true);
});
