const assert = require('node:assert/strict');
const create = require('../../hunt-presentation.js');
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
  if (geometry) scene.make = { graphics(options) {
    assert.equal(options.add, false, 'mask paths are never added to the display list');
    const graphic = object(); graphic.commands = []; graphic.clearCount = 0;
    graphic.clear = () => { graphic.commands = []; graphic.clearCount++; return graphic; };
    graphic.fillStyle = (...args) => { graphic.commands.push(['fillStyle', ...args]); return graphic; };
    graphic.fillRect = (...args) => { graphic.commands.push(['fillRect', ...args]); return graphic; };
    graphic.createGeometryMask = () => { const mask = { graphics: graphic, destroyed: false, destroy() { this.destroyed = true; } };
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
    timer(timer) { if (!timer.removed) timer.callback(); },
    tween(tween) { if (!tween.killed) { Object.assign(tween.targets, { x: tween.x ?? tween.targets.x, y: tween.y ?? tween.targets.y }); tween.onComplete?.(); } } };
}
module.exports = { fixture, atlas, faceA, faceB, poseFrames };
