'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const V = require('../src/enemy-visuals'), E = require('../src/hunt-engine');
const { boot } = require('./helpers/ui-harness.cjs');
const { fixture } = require('./actual-combat-helper.cjs');
const fs = require('node:fs'), path = require('node:path');
const L = require('../src/map-render-layout'), assets = require('../assets/characters/manifest.json');
const { readPngAlpha, atlasFrameBounds } = require('./helpers/png-alpha.cjs');

test('ordinary mob, minion and scourge beast use three distinct public appearances', () => {
  assert.deepEqual(V.ids, ['huntsman-mob', 'huntsmans-minion', 'scourge-beast', 'female-patient', 'iosefka', 'cleric-beast']);
  assert.equal(new Set(['huntsman-mob', 'huntsmans-minion', 'scourge-beast'].map(kind => V.skin({ kind }))).size, 3);
  for (const kind of ['huntsman-mob', 'huntsmans-minion', 'scourge-beast'])
    assert.equal(V.skin({ kind }, { name: '이름을 번역하거나 바꾸어도 같은 적' }), kind);
});

test('mission and practice identity wins over reused ordinary rule kinds', () => {
  for (const spec of ['female-patient-a', 'female-patient-b']) {
    assert.equal(V.skin({ componentId: 'female-patient', componentSpec: spec, kind: 'huntsman-mob' }), 'female-patient');
    assert.equal(V.skin({ provisionalKind: spec, kind: 'huntsman-mob' }), 'female-patient');
  }
  assert.equal(V.skin({ componentId: 'iosefka', componentSpec: 'iosefka-hostile', kind: 'huntsmans-minion' }), 'iosefka');
  assert.equal(V.skin({ provisionalKind: 'iosefka-hostile', kind: 'huntsmans-minion' }), 'iosefka');
  assert.equal(V.skin({ componentId: 'cleric-beast', kind: 'scourge-beast' }, { boss: true }), 'cleric-beast');
  assert.equal(V.skin({ provisionalKind: 'cleric-beast', kind: 'scourge-beast' }, { boss: true }), 'cleric-beast');
  assert.equal(V.skin({ componentId: 'iosefka', provisionalKind: 'cleric-beast', extendedId: 'huntsman-mob' }), 'iosefka');
  assert.equal(V.skin({ provisionalKind: 'female-patient-a', extendedId: 'huntsmans-minion' }), 'female-patient');
});

test('other supplied enemies keep generic fallbacks instead of inheriting a reused ordinary kind', () => {
  assert.equal(V.skin({ extendedId: 'church-servant', kind: 'huntsman-mob' }, { name: '교단의 종복' }), 'mob');
  assert.equal(V.skin({ extendedId: 'henryk', kind: 'huntsman-mob' }, { name: '고대 사냥꾼 헨릭', npcEnemy: true }), 'female');
  assert.equal(V.skin({ extendedId: 'male-beast-patient', kind: 'huntsman-mob' }, { name: '남성 야수환자' }), 'beast');
  assert.equal(V.skin({ componentId: 'future-boss', kind: 'scourge-beast' }, { boss: true }), 'boss');
  assert.equal(V.skin(null), 'mob'); assert.equal(V.skin({ kind: 'future-enemy' }), 'mob');
});

test('appearance inspection reads no hidden deck, rules or save state and does not mutate public identity', () => {
  const actor = { componentId: 'iosefka', componentSpec: 'iosefka-hostile', kind: 'huntsmans-minion' };
  const definition = { name: '이오세프카', npcEnemy: true };
  for (const object of [actor, definition]) {
    for (const key of ['bossDecks', 'actionDeck', 'missionBranch', 'rules', 'source', 'commands'])
      Object.defineProperty(object, key, { get() { throw Error('appearance must not inspect ' + key); } });
    Object.freeze(object);
  }
  assert.equal(V.skin(actor, definition), 'iosefka');
  assert.deepEqual(Object.keys(actor), ['componentId', 'componentSpec', 'kind']);
});

test('the playable page and preview load the appearance adapter before their controllers', () => {
  for (const [page, controller] of [['hunt.html', 'src/hunt-app.js'], ['pages/weapon-gallery.html', 'src/weapon-gallery.js']]) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]);
    assert(scripts.indexOf('src/enemy-visuals.js') >= 0, `${page}: the real page loads the appearance adapter`);
    assert(scripts.indexOf('src/enemy-visuals.js') < scripts.indexOf(controller), `${page}: adapter initializes before rendering`);
  }
});

test('pixel measurements apply alpha threshold, atlas trim and clip inclusion before taking source bounds', () => {
  const png = { width: 4, height: 3, alpha: Uint8Array.from([0, 31, 32, 255, 0, 0, 200, 255, 0, 255, 0, 0]) },
    frame = { frame: { x: 1, y: 0, w: 3, h: 2 }, spriteSourceSize: { x: 10, y: 20, w: 3, h: 2 },
      clipRects: [{ x: 11, y: 20, w: 1, h: 2 }] };
  assert.deepEqual(atlasFrameBounds(png, frame, 32), { minX: 11, minY: 20, maxX: 12, maxY: 22, pixels: 2 });
  assert.deepEqual(atlasFrameBounds(png, { ...frame, clipRects: undefined }, 32),
    { minX: 11, minY: 20, maxX: 13, maxY: 22, pixels: 4 });
});

function inspect(state) {
  const snapshots = [], layouts = [], before = structuredClone(state), serialized = E.exportSave(state);
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { 'bloodborne-hunt-v07': serialized },
    engine: { exportSave: E.exportSave, applyCombatReactionRuling: s => s },
    window: {
      BBEnemyVisuals: V,
      BBMapRenderLayout: { layout(input) { const entries = L.layout(input); layouts.push(entries); return entries; } },
      BBHuntPresentation() { return { sync(snapshot) { snapshots.push(structuredClone(snapshot)); },
        resize() {}, focus() {}, status() { return { charactersReady: true }; } }; },
    },
  });
  assert.deepEqual(state, before, 'rendering never changes the source rule fixture');
  assert.equal(ui.storage.get('bloodborne-hunt-v07'), serialized, 'appearance wiring does not change saved bytes');
  assert.deepEqual(ui.commands, []);
  return { ui, actors: snapshots.at(-1).actors, layouts };
}

const realCommands = require('./fixtures/weapon-campaign-completion/beast-claw-0.json');
let campaign = E.create(90, 'beast-claw', 0, null, 'hunter-pistol', 'center', { campaign: true, rulesVersion: 13 });
const ordinaryCheckpoints = new Map();
for (const command of realCommands) {
  campaign = E.dispatch(campaign, command);
  for (const enemy of campaign.enemies) if (!enemy.componentId && !enemy.extendedId && !ordinaryCheckpoints.has(enemy.kind))
    ordinaryCheckpoints.set(enemy.kind, campaign);
  if (ordinaryCheckpoints.size === 3) break;
}
for (const kind of ['huntsman-mob', 'huntsmans-minion', 'scourge-beast'])
  test(`actual public map snapshots connect ${kind} to its own appearance without commands`, () => {
    const state = ordinaryCheckpoints.get(kind); assert(state, 'the accepted campaign trace spawns the target');
    const enemy = state.enemies.find(enemy => enemy.kind === kind && !enemy.componentId), { ui, actors } = inspect(state);
    const actor = actors.find(actor => actor.id === enemy.id); assert.equal(actor.skin, kind);
    assert.equal(actor.node, enemy.node); assert.equal(actor.hp, enemy.hp);
    assert.equal(ui.el('chapterMap').querySelectorAll('[data-enemy]').find(button => button.dataset.enemy === enemy.id).dataset.presentationSkin, kind);
  });

for (const [spec, skin] of [['female-patient-a', 'female-patient'], ['female-patient-b', 'female-patient'],
  ['iosefka-hostile', 'iosefka'], ['cleric-beast', 'cleric-beast']])
  test(`supplied component map fixture ${spec} preserves marker, HP and save when applying ${skin}`, () => {
    const state = fixture(spec), enemy = state.enemies[0], { actors } = inspect(state), actor = actors.find(actor => actor.id === enemy.id);
    assert.equal(actor.skin, skin); assert.equal(actor.node, enemy.node); assert.equal(actor.hp, enemy.hp);
  });

for (const skin of V.ids)
  test(`${skin} actual idle alpha fits the public map reservation in both horizontal directions`, t => {
    const asset = assets[skin]; assert(asset, `${skin}: shipped named atlas exists`);
    const state = ordinaryCheckpoints.get(skin) || fixture(skin === 'female-patient' ? 'female-patient-a' :
      skin === 'iosefka' ? 'iosefka-hostile' : skin);
    const enemy = state.enemies.find(enemy => V.skin(enemy, E.enemyDef(state, enemy)) === skin); assert(enemy);
    const { layouts } = inspect(state), entry = layouts.flat().find(entry => entry.type === 'enemy' && entry.id === enemy.id);
    assert(entry, 'the real map controller supplies a public reservation');
    const expected = skin === 'cleric-beast' ? [60, 56] : skin === 'scourge-beast' ? [24, 28] : [18, 28];
    assert.deepEqual([entry.visualWidth, entry.visualHeight], expected);
    const png = readPngAlpha(fs.readFileSync(path.join(__dirname, '..', asset.path))), frames = asset.animations?.idle?.frames || [0, 1, 2, 3];
    const originX = asset.frameWidth * .5, originY = asset.frameHeight * asset.originY,
      scale = asset.displayHeight / asset.frameHeight;
    const left = [], right = [], above = [], below = [];
    for (const index of frames) {
      const bounds = atlasFrameBounds(png, asset.atlasData.frames[index], 32);
      // Preserve every qualifying pixel edge. Mirroring changes the two sides
      // around source X=.5; a narrow but off-center weapon still needs room.
      for (const flip of [false, true]) {
        const x0 = (flip ? originX - bounds.maxX : bounds.minX - originX) * scale,
          x1 = (flip ? originX - bounds.minX : bounds.maxX - originX) * scale;
        left.push(Math.max(0, -x0)); right.push(Math.max(0, x1));
        above.push(Math.max(0, originY - bounds.minY) * scale);
        below.push(Math.max(0, bounds.maxY - originY) * scale);
      }
    }
    const measured = { width: Math.max(...left, ...right) * 2, above: Math.max(...above), below: Math.max(...below) },
      reserved = { width: entry.visualWidth * 290 / 100, above: entry.visualHeight * 290 / 100, below: 3 * 290 / 100 };
    t.diagnostic(JSON.stringify({ skin, alphaThreshold: 32, idleFrames: frames, mapPixelsAt290: measured, reservationPixelsAt290: reserved }));
    assert(measured.width <= reserved.width + 1e-6, `${skin}: mirrored idle width ${measured.width.toFixed(6)} exceeds ${reserved.width}`);
    assert(measured.above <= reserved.above + 1e-6, `${skin}: idle height ${measured.above.toFixed(6)} exceeds ${reserved.above}`);
    assert(measured.below <= reserved.below + 1e-6, `${skin}: foreground below the foot exceeds the map's bottom padding`);
  });
