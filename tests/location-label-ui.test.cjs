'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../hunt-engine'), M = require('../chapter-engine'), { boot } = require('./helpers/ui-harness.cjs');
const commands = require('./fixtures/weapon-campaign-completion/beast-claw-0.json'), key = 'bloodborne-hunt-v07';
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView,
  applyChapelRuling: state => state, applyCombatReactionRuling: state => state };
let unnamed = E.create(90, 'beast-claw', 0, null, 'hunter-pistol', 'center', { campaign: true, rulesVersion: 13 });
for (const command of commands.slice(0, 132)) unnamed = E.dispatch(unnamed, command);
assert.match(E.node(unnamed, E.hunter(unnamed).position).name, /명칭 없는 타일 05/);
function launch(state, extra = {}) {
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state),
    { engine: { ...engine, ...extra.engine }, realInventory: true, storage: { [key]: saved }, window: extra.window });
  return { ui, state, saved };
}

test('a named hunter location remains unchanged after public location cleanup', () => {
  const state = E.create(90, 'burial', 0, null, 'hunter-pistol', 'center', { campaign: true }), f = launch(state);
  assert(f.ui.el('status').textContent.includes(E.node(state, E.hunter(state).position).name));
  assert.equal(f.ui.storage.get(key), f.saved); assert.equal(f.ui.el('error').textContent, '');
});

test('an actual unnamed-tile move displays its cell name and public log while preserving the original replay', () => {
  const f = launch(unnamed), sourceName = E.node(unnamed, E.hunter(unnamed).position).name;
  assert.match(f.ui.el('status').textContent, /왼쪽 위 칸/);
  assert.doesNotMatch(f.ui.el('status').textContent, /명칭 없는|타일 05/);
  assert.doesNotMatch(f.ui.el('huntLog').textContent, /명칭 없는 타일/);
  assert(f.ui.el('huntLog').textContent.includes('왼쪽 위 칸'));
  assert.equal(f.ui.storage.get(key), f.saved); assert.equal(E.node(unnamed, E.hunter(unnamed).position).name, sourceName);
  assert.deepEqual(E.importSave(f.ui.storage.get(key)), unnamed); assert.equal(f.ui.el('error').textContent, '');
});

for (const [fog, expected] of [[['tile-01', 'tile-05'], '안개 진입로'], [['tile-01', 'tile-19'], '안개 진입로 · 오에돈의 지하묘지']])
  test(`fog labels retain meaningful names and omit unnamed placeholders: ${fog.join(',')}`, () => {
    const state = E.create(90, 'burial', 0, null, 'hunter-pistol', 'center', { campaign: true }),
      view = { ...E.missionView(state), fog }, f = launch(state, { engine: { missionView: () => view } });
    assert.equal(f.ui.el('missionFog').textContent, expected);
    assert.equal(f.ui.storage.get(key), f.saved); assert.equal(f.ui.el('error').textContent, '');
  });

test('label cleanup renders the current unnamed cell without inspecting hidden tile order or looking up future tiles', () => {
  const lookedUp = [], visible = new Set(unnamed.world.tiles.map(tile => tile.tileId));
  const guardedImport = text => {
    const state = E.importSave(text), size = state.world.tileDeck.length;
    Object.defineProperty(state.world, 'tileDeck', { get() { return new Proxy([], { get(_, property) {
      if (property === 'length') return size;
      throw Error('the UI read hidden tile order');
    } }); } });
    return state;
  };
  const f = launch(unnamed, { engine: { importSave: guardedImport }, window: { BBChapter: { ...M,
    tile(id) { assert(visible.has(id), `only publicly placed tile ${id} may be looked up`); lookedUp.push(id); return M.tile(id); } } } });
  assert.match(f.ui.el('status').textContent, /왼쪽 위 칸/); assert.doesNotMatch(f.ui.el('status').textContent, /명칭 없는/);
  assert(lookedUp.length > 0); assert.equal(f.ui.el('error').textContent, ''); assert.equal(f.ui.storage.get(key), f.saved);
});
