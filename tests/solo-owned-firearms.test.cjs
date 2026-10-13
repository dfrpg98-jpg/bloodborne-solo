const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../hunt-engine.js');

test('owned firearm descriptions use the same supplied definitions as actual play in each saved rules version', () => {
  for (const rulesVersion of [8, 9, 10, 11]) {
    for (const id of Object.keys(E.data.firearms)) {
      const s = E.create(90, 'burial', 1, null, id, 'center', {campaign: false, rulesVersion});
      const before = structuredClone(s), actual = E.firearm(s);
      const view = E.rewardsView(s).firearms.find(g => g.id === id);
      for (const [key, value] of Object.entries(actual)) assert.deepEqual(view[key], value, `${id} / rules ${rulesVersion} / ${key}`);
      assert.equal(view.equipped, true);
      assert.equal(view.ready, true);
      assert.deepEqual(s, before, 'description lookup cannot mutate the saved state');
      assert.deepEqual(E.importSave(E.exportSave(s)), s);
    }
  }
});

test('naturally earned Ludwig rifle displays the real card while stored and after legal equipment', () => {
  let s = E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', {campaign: true, rulesVersion: 11});
  for (const c of require('./fixtures/weapon-campaign-completion/burial-1-chapter-one.json')) {
    s = E.dispatch(s,c);
    if (s.rewardChoices.some(q => q.firearmId === 'ludwig-rifle')) break;
  }
  assert(s.mission.completed.includes(7));
  const stored = E.rewardsView(s).firearms.find(g => g.id === 'ludwig-rifle');
  assert.equal(stored.equipped, false);
  assert.equal(stored.actual, true);
  assert.equal(stored.temporary, false);
  assert.doesNotMatch(stored.text, /테스트용|임시 규칙/);
  s = E.dispatch(s, {type:'EQUIP_FIREARM', firearmId:'ludwig-rifle'});
  const equipped = E.rewardsView(s).firearms.find(g => g.id === 'ludwig-rifle');
  assert.equal(equipped.equipped, true);
  assert.equal(equipped.text, E.firearm(s).text);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
