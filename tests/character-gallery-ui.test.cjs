'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const V = require('../weapon-visuals'), { Document } = require('./helpers/ui-harness.cjs');
const root = path.resolve(__dirname, '..');

function fixture({ ready = true } = {}) {
  const document = new Document(fs.readFileSync(path.join(root, 'weapon-gallery.html'), 'utf8'));
  const el = id => document.getElementById(id), snapshots = [], resizeListeners = [];
  el('galleryViewport').clientWidth = 800; el('galleryViewport').clientHeight = 380;
  const window = { BBWeaponVisuals: V, BBCharacterAssets: {}, BBWeaponCharacterAssets: {},
    addEventListener(type, listener) { if (type === 'resize') resizeListeners.push(listener); },
    BBHuntPresentation(options) { return {
      resize() {}, status() { return { charactersReady: ready }; },
      sync(value) { snapshots.push(JSON.parse(JSON.stringify(value)));
        options.host.dataset.presentationWeaponReady = String(ready && value.actors.some(actor => actor.skin.startsWith('w-'))); }
    }; }
  };
  Object.defineProperty(window, 'localStorage', { get() { throw Error('a preview must not access gameplay saves'); } });
  Object.defineProperty(window, 'BBHuntEngine', { get() { throw Error('a preview must not invoke gameplay rules'); } });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'weapon-gallery.js'), 'utf8'), { window, document });
  return { el, snapshots, latest: () => snapshots.at(-1),
    choose(id, value) { el(id).value = value; el(id).fire('change'); },
    resize() { for (const listener of resizeListeners) listener(); } };
}
const subject = f => f.latest().actors.find(actor => actor.id === 'hunter');

for (const skin of ['hunter', 'mob', 'beast', 'boss', 'female'])
  test(`public preview controls exercise ${skin} idle, walk, attack, hit and death without weapon actions`, () => {
    const f = fixture(); f.choose('gallerySubject', skin);
    assert.equal(subject(f).skin, skin);
    assert.equal(subject(f).kind, skin === 'hunter' ? 'hunter' : 'enemy');
    assert.equal(subject(f).weaponId, undefined); assert.deepEqual(f.latest().actions, []);
    assert.equal(f.el('galleryWeapon').hidden, true); assert.equal(f.el('galleryForm0').hidden, true);
    assert.equal(f.el('galleryTransform').disabled, true);
    assert.equal(f.el('galleryAttack0').textContent, '공통 공격');
    assert.equal(f.el('galleryAttack1').hidden, true); assert.equal(f.el('galleryAttack2').hidden, true);
    const revision = f.latest().revision;
    for (const id of ['galleryTransform', 'galleryForm0', 'galleryForm1', 'galleryAttack1', 'galleryAttack2']) f.el(id).click();
    assert.equal(f.latest().revision, revision, 'disabled weapon-specific controls emit no actions');
    f.el('galleryWalk').click();
    assert.ok(Math.abs(subject(f).x - 224) < 1e-9); assert.deepEqual(f.latest().actions, [{ type: 'move', fromId: 'hunter', from: { x: 320, y: 320 } }]);
    f.el('galleryAttack0').click();
    assert.deepEqual(f.latest().actions, [{ type: 'attack', fromId: 'hunter', toId: 'dummy', damage: 0, skin }]);
    f.el('galleryHit').click(); assert.equal(subject(f).hp, 5);
    assert.deepEqual(f.latest().actions, [{ type: 'attack', fromId: 'dummy', toId: 'hunter', damage: 1 }]);
    f.el('galleryDeath').click(); assert.equal(subject(f), undefined);
    assert.deepEqual(f.latest().actions, [{ type: 'attack', fromId: 'dummy', toId: 'hunter', damage: 6 }]);
    f.el('galleryIdle').click(); assert.equal(subject(f).skin, skin); assert.equal(subject(f).hp, 6);
    assert.deepEqual(f.latest().actions, []);
    f.resize(); assert.equal(subject(f).skin, skin); assert.deepEqual(f.latest().actions, []);
  });

test('returning from a generic preview restores the selected weapon forms and three exact attack slots', () => {
  const f = fixture(); f.choose('galleryWeapon', 'burial'); f.el('galleryTransform').click();
  assert.equal(subject(f).skin, 'w-burial-b');
  f.choose('gallerySubject', 'boss'); f.choose('gallerySubject', 'weapon');
  assert.equal(subject(f).skin, 'w-burial-b'); assert.equal(f.el('galleryTransform').disabled, false);
  assert.equal(f.el('galleryWeapon').hidden, false); assert.equal(f.el('galleryForm1').hidden, false);
  for (const slot of [0, 1, 2]) {
    assert.equal(f.el('galleryAttack' + slot).hidden, false); f.el('galleryAttack' + slot).click();
    assert.equal(f.latest().actions[0].attackSlot, slot); assert.equal(f.latest().actions[0].skin, 'w-burial-b');
  }
  f.el('galleryTransform').click(); assert.equal(subject(f).skin, 'w-burial-a');
  assert.deepEqual(f.latest().actions, [{ type: 'transform', fromId: 'hunter', skin: 'w-burial-a' }]);
});

test('unloaded generic characters show loading status instead of claiming a ready actor', () => {
  const f = fixture({ ready: false }); f.choose('gallerySubject', 'female');
  assert.match(f.el('galleryStatus').textContent, /불러오는 중/);
});
