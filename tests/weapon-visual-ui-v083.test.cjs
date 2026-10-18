const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/hunt-engine'), V = require('../src/weapon-visuals'), { boot } = require('./helpers/ui-harness.cjs');
const manifest = require('./fixtures/weapon-campaign-completion/manifest.json'), saveKey = 'bloodborne-hunt-v07';
const checkpoints = new Map();
function checkpoint(id, count) {
  const key = id + ':' + count;
  if (checkpoints.has(key)) return checkpoints.get(key);
  const fixture = manifest.cases.find(value => value.weaponId === id);
  const commands = require('./fixtures/weapon-campaign-completion/' + fixture.commandsFile);
  let state = E.create(fixture.seed, id, fixture.startFace, fixture.startingConsumable, fixture.initialFirearmId,
    fixture.startSpace, { campaign: true, rulesVersion: fixture.rulesVersion });
  for (const command of commands.slice(0, count)) state = E.dispatch(state, command);
  const result = { state, command: commands[count] }; checkpoints.set(key, result); return result;
}
function launch(state, extra = {}) {
  const snapshots = [], mounts = [], calls = { creates: 0, dispatches: 0 }, saved = E.exportSave(state);
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, storage: { [saveKey]: saved },
    engine: { create(...args) { calls.creates++; return E.create(...args); }, importSave: E.importSave, exportSave: E.exportSave,
      dispatch(...args) { calls.dispatches++; return E.dispatch(...args); }, missionView: E.missionView,
      rewardsView: E.rewardsView, applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
    window: { BBWeaponVisuals: V, BBCharacterAssets: { hunter: { path: 'assets/characters/hunter.png' } },
      BBWeaponCharacterAssets: { 'w-threaded-cane-a': { path: 'assets/characters/w-threaded-cane-a.png' } },
      BBHuntPresentation(options) { mounts.push(options);
        return { sync(value) { snapshots.push(JSON.parse(JSON.stringify(value))); }, resize() {}, focus() {}, destroy() {} }; }, ...extra } });
  return { ui, state, snapshots, mounts, calls, saved };
}
const latest = f => f.snapshots.at(-1), actor = f => latest(f).actors.find(value => value.kind === 'hunter');
function button(f, type) {
  const container = ['TRANSFORM', 'ATTACK'].includes(type) ? f.ui.el('decisionActions') : f.ui.document;
  const result = container.querySelectorAll('[data-command]').find(element => element.dataset.command === type && !element.disabled);
  assert(result, `${type} is available through the actual UI`); return result;
}
function chooseAction(f, type) {
  const intent = f.ui.el('hunterActionBar').querySelectorAll('[data-hunter-intent]')
    .find(element => element.dataset.hunterIntent === type && !element.disabled);
  assert(intent, `${type} is available before selecting its hand card`);
  const saved = f.ui.storage.get(saveKey); intent.click();
  assert.equal(f.ui.storage.get(saveKey), saved, 'choosing the action neither changes the public save nor pays its cost');
  assert.equal(f.ui.el('confirmHunterAction').disabled, true, 'the selected action still requires a hand card');
}
function selectCard(f, id) {
  const card = f.ui.el('hand').querySelectorAll('[data-card]').find(element => element.dataset.card === id);
  assert(card, `card ${id} is in the actual hand`); card.click();
}
function selectAttack(f, command) {
  const targetId = command.enemyId || f.state.combat?.enemyId;
  const figure = f.ui.el('chapterMap').querySelectorAll('[data-enemy]').find(element => element.dataset.enemy === targetId);
  assert(figure); figure.click();
  if (f.state.phase === 'hunter' && command.type === 'ATTACK') chooseAction(f, 'ATTACK');
  selectCard(f, command.cardId);
  const slot = f.ui.el('slots').querySelectorAll('[data-slot]').find(element => Number(element.dataset.slot) === command.slot);
  assert(slot); slot.click();
}
function expectedResult(f, command) {
  const expected = E.dispatch(f.state, command), actual = E.importSave(f.ui.storage.get(saveKey));
  // Convenience UI adds canonical empty selections; compare exact behavior and
  // verify that the emitted original player command itself replays unchanged.
  const behavior = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
  assert.deepEqual(behavior(actual), behavior(expected));
  for (const [key, value] of Object.entries(command)) {
    if ((key === 'boost' || key === 'weaponBoost') && value === 'none' && actual.commands.at(-1)[key] === undefined) continue;
    assert.deepEqual(actual.commands.at(-1)[key], value);
  }
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual);
  assert.equal(f.ui.el('error').textContent, ''); return actual;
}

for (const id of V.ids) test(`${id} public character follows both accepted transformation directions with exact rule costs`, () => {
  const initial = E.create(90, id, 0, null, E.data.weapons[id].defaultFirearm, 'center', { campaign: true }), f = launch(initial);
  assert.equal(actor(f).weaponId, id); assert.equal(actor(f).weaponFace, 0);
  assert.equal(actor(f).skin, V.skin(id, 0, false)); assert.deepEqual(latest(f).actions, []);
  assert.equal(f.ui.storage.get(saveKey), f.saved, 'showing a loaded character does not save or transform');
  for (const face of [1, 0]) {
    const cardId = E.hunter(f.state).hand[0].id; chooseAction(f, 'TRANSFORM'); selectCard(f, cardId); button(f, 'TRANSFORM').click();
    const after = expectedResult(f, { type: 'TRANSFORM', cardId });
    assert.equal(actor(f).weaponFace, face);
    assert.equal(actor(f).skin, V.skin(id, face, E.hunter(after).weaponCharge?.round === after.round));
    assert.deepEqual(latest(f).actions.filter(value => value.type === 'transform'), [{ type: 'transform', fromId: 'hunter', skin: actor(f).skin }]);
    f.state = after;
  }
});

test('legacy actor assets and weapon atlases are both passed to the same presentation adapter', () => {
  const f = launch(checkpoint('threaded-cane', 0).state);
  assert.equal(f.mounts[0].characters.hunter.path, 'assets/characters/hunter.png');
  assert.equal(f.mounts[0].characters['w-threaded-cane-a'].path, 'assets/characters/w-threaded-cane-a.png');
});

test('loading an existing transformed face uses its own appearance without playing a transform', () => {
  const initial = E.create(90, 'kirkhammer', 1, null, E.data.weapons.kirkhammer.defaultFirearm, 'center', { campaign: true }), f = launch(initial);
  assert.equal(actor(f).skin, 'w-kirkhammer-b'); assert.equal(actor(f).weaponFace, 1);
  assert.deepEqual(latest(f).actions, []); assert.equal(f.ui.storage.get(saveKey), f.saved);
});

for (const slot of [1, 2]) test(`actual counter with duplicate attack name preserves selected slot ${slot} through resolution`, () => {
  const { state, command: original } = checkpoint('threaded-cane', 8), command = { ...original, slot }, f = launch(state);
  assert.equal(command.type, 'COUNTER'); selectAttack(f, command); button(f, 'COUNTER').click();
  const declared = expectedResult(f, command); assert.equal(latest(f).actions.length, 0);
  f.state = declared; button(f, 'RESOLVE').click(); expectedResult(f, { type: 'RESOLVE' });
  const attack = latest(f).actions.find(value => value.type === 'attack' && value.fromId === 'hunter');
  assert(attack); assert.equal(attack.attackSlot, slot); assert.equal(attack.skin, 'w-threaded-cane-a');
  assert.equal(attack.motion, 'whip'); assert.equal(attack.attackStyle, 'weapon');
});

test('live Tonitrus glow is consumed at declaration while the resolved attack keeps its charged appearance', () => {
  const { state, command } = checkpoint('tonitrus', 5), f = launch(state);
  assert.equal(actor(f).skin, 'w-tonitrus-b'); selectAttack(f, command); button(f, 'ATTACK').click();
  f.state = expectedResult(f, command); assert.equal(E.hunter(f.state).weaponCharge, undefined);
  assert.equal(actor(f).skin, 'w-tonitrus-a'); assert.equal(latest(f).actions.length, 0);
  const creates = f.calls.creates; button(f, 'RESOLVE').click(); expectedResult(f, { type: 'RESOLVE' });
  const attack = latest(f).actions.find(value => value.type === 'attack' && value.fromId === 'hunter');
  assert.equal(attack.skin, 'w-tonitrus-b'); assert.equal(attack.motion, 'electric');
  assert.equal(f.calls.creates, creates, 'normal accepted declaration uses its public view cache without replay');
});

test('restored mid-combat Tonitrus recovers the consumed charge once from public accepted input history', () => {
  const { state } = checkpoint('tonitrus', 6), f = launch(state), before = f.calls.creates;
  assert.equal(E.hunter(state).weaponCharge, undefined); assert.equal(actor(f).skin, 'w-tonitrus-a');
  assert.equal(f.ui.storage.get(saveKey), f.saved); const started = performance.now();
  button(f, 'FIREARM').click(); f.state = expectedResult(f, { type: 'FIREARM' });
  assert.equal(f.calls.creates, before + 1, 'a disposable replay reconstructs the public pre-declaration glow once');
  assert(performance.now() - started < 3000, 'a short restored public input trace does not stall the interface');
  button(f, 'RESOLVE').click(); expectedResult(f, { type: 'RESOLVE' });
  const attack = latest(f).actions.find(value => value.type === 'attack' && value.fromId === 'hunter');
  assert.equal(attack.skin, 'w-tonitrus-b'); assert.equal(attack.motion, 'electric');
  assert.equal(f.calls.creates, before + 1, 'rendering and subsequent resolution do not repeat recovery');
});

test('actual Reiterpallasch weapon-shot UI uses its aiming slot without changing the firearm', () => {
  const { state, command: original } = checkpoint('reiterpallasch', 136), command = { type: 'WEAPON_SHOT', cardId: original.cardId, slot: 1, enemyId: original.enemyId }, f = launch(state);
  assert.equal(E.hunter(state).face, 1); assert.equal(state.phase, 'hunter');
  selectAttack(f, command); button(f, 'WEAPON_SHOT').click(); const after = expectedResult(f, command);
  const shot = latest(f).actions.find(value => value.type === 'shot'); assert(shot);
  assert.equal(shot.skin, 'w-reiterpallasch-b'); assert.equal(shot.attackSlot, 1);
  assert.equal(shot.attackStyle, 'weapon'); assert.equal(shot.motion, 'shot');
  assert.equal(E.hunter(after).firearmReady, E.hunter(state).firearmReady);
});

test('the existing QA weapon retains generic character attack animation and its separate exact save', () => {
  const fixture = require('./fixtures/v078-first-fight.json');
  let state = E.create(fixture.seed, 'qa-test-weapon', 0, null, 'hunter-pistol', 'center',
    { campaign: true, qa: { preset: 'custom', startRewards: [], startConsumables: ['qa-cards'] } });
  for (const command of fixture.qa.slice(0, -1)) state = E.dispatch(state, command);
  const f = launch(state); assert.equal(actor(f).skin, 'hunter');
  button(f, 'RESOLVE').click();
  const actual = E.importSave(f.ui.storage.get('bloodborne-hunt-qa-v1'));
  assert.deepEqual(actual, E.dispatch(state, { type: 'RESOLVE' }));
  assert.equal(f.ui.storage.get(saveKey), f.saved, 'QA resolution does not overwrite normal save storage');
  const attack = latest(f).actions.find(value => value.type === 'attack' && value.fromId === 'hunter');
  assert.equal(attack.skin, 'hunter'); assert.equal(attack.attackStyle, 'weapon'); assert.equal(attack.attackSlot, 0);
});

test('an actual accepted free transformation follows its new form without adding commands or changing costs', () => {
  const fixture = manifest.cases.find(value => value.weaponId === 'stake-driver');
  const commands = require('./fixtures/weapon-campaign-completion/' + fixture.commandsFile);
  const index = commands.findIndex(command => command.type === 'FREE_TRANSFORM' && command.accept === true);
  assert(index >= 0, 'the natural campaign trace really reaches an accepted free transform');
  const { state, command } = checkpoint('stake-driver', index), f = launch(state), oldFace = E.hunter(state).face;
  button(f, 'FREE_TRANSFORM').click();
  const after = expectedResult(f, command); assert.equal(E.hunter(after).face, 1 - oldFace);
  assert.equal(actor(f).skin, V.skin('stake-driver', E.hunter(after).face));
  assert.equal(latest(f).actions.filter(value => value.type === 'transform').length, 1);
});

test('inspecting targets and selecting cards never transforms equipment or reveals future content', () => {
  const { state, command } = checkpoint('threaded-cane', 8), f = launch(state), before = actor(f).skin;
  selectAttack(f, { ...command, slot: 2 });
  assert.equal(actor(f).skin, before); assert.equal(latest(f).actions.length, 0);
  assert.equal(f.ui.storage.get(saveKey), f.saved);
  const projected = JSON.stringify(latest(f));
  assert.doesNotMatch(projected, /bossDecks|actionDeck|pendingReward|nextReward|futureStories|참고자료|\.jpg/);
  for (const value of latest(f).actors) for (const key of Object.keys(value))
    assert(['id', 'kind', 'node', 'skin', 'scale', 'hp', 'selected', 'x', 'y', 'weaponId', 'weaponFace'].includes(key));
});
