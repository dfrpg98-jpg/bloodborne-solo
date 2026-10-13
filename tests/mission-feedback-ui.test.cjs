const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../hunt-engine'), { boot } = require('./helpers/ui-harness.cjs');
const commands = require('./fixtures/full-campaign-actual-v10-commands.json');
const checkpoints = new Map();
let state = E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', { campaign: true, rulesVersion: 14 });
for (let i = 0; i <= 123; i++) {
  if ([3, 25, 80, 123].includes(i)) checkpoints.set(i, state);
  state = E.dispatch(state, commands[i]);
}
function at(index) {
  const state = checkpoints.get(index), saved = E.exportSave(state);
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    realInventory: true, engine: E, storage: { 'bloodborne-hunt-v07': saved }
  });
  assert.equal(ui.el('missionUpdateDialog').open, false, 'loading an existing hunt does not replay old notifications');
  assert.equal(ui.el('error').textContent, '');
  return ui;
}
function clickCommand(ui, command) {
  const button = ui.document.querySelectorAll('[data-command]').find(button => {
    if (button.dataset.command !== command.type || button.disabled) return false;
    const args = JSON.parse(button.dataset.args || '{}');
    return Object.entries(command).every(([key, value]) => key === 'type' || JSON.stringify(args[key]) === JSON.stringify(value));
  });
  assert(button, `actual UI offers ${JSON.stringify(command)}`); button.click();
  assert.equal(ui.el('error').textContent, '');
}
const savedState = ui => E.importSave(ui.storage.get('bloodborne-hunt-v07'));

test('a naturally activated mission requires acknowledgement before another gameplay command, without extra costs', () => {
  const ui = at(3); clickCommand(ui, commands[3]);
  const afterTrigger = ui.storage.get('bloodborne-hunt-v07');
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.equal(ui.el('missionUpdateTitle').textContent, '새로운 임무');
  assert.match(ui.el('missionUpdateList').textContent, /사냥을 시작하다/);
  assert.match(ui.el('missionUpdateList').textContent, /마당 등불/);
  assert.match(ui.el('missionObjectives').innerHTML, /changed/);
  assert.match(ui.el('missionRecent').textContent, /새로운 임무/);
  const end = ui.buttons('decisions').find(button => button.dataset.command === 'END_TURN');
  assert(end); end.click();
  assert.equal(ui.storage.get('bloodborne-hunt-v07'), afterTrigger, 'even a programmatic click behind the modal cannot advance the turn');
  ui.el('missionUpdateContinue').click();
  assert.equal(ui.el('missionUpdateDialog').open, false);
  assert.equal(ui.el('missionUpdateCount').hidden, true);
  assert.equal(ui.storage.get('bloodborne-hunt-v07'), afterTrigger, 'acknowledgement is not an engine action');
  assert.equal(savedState(ui).commands.length, checkpoints.get(3).commands.length + 1);
  const card = ui.el('hand').querySelectorAll('[data-card]')[0]; card.click();
  const move = ui.buttons('decisions').find(button => button.dataset.command === 'MOVE');
  assert(move && !move.disabled); move.click();
  assert.equal(ui.el('missionUpdateDialog').open, false, 'an unrelated subsequent action cannot reopen the acknowledged notice');
  assert.equal(savedState(ui).phase, 'move');
});

test('mission completion shows the actual outcome, insight gain and fog removal, then preserves the next required choice', () => {
  const ui = at(25); clickCommand(ui, commands[25]);
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.equal(ui.el('missionUpdateTitle').textContent, '임무 완수');
  assert.match(ui.el('missionUpdateList').textContent, /처치했습니다/);
  assert.match(ui.el('missionUpdateList').textContent, /계몽 \+1/);
  assert.match(ui.el('missionUpdateList').textContent, /안개가 걷혔습니다/);
  assert.doesNotMatch(ui.el('missionUpdateList').textContent, /처치하세요|\d+번 카드|[AB]면/);
  const before = ui.storage.get('bloodborne-hunt-v07');
  const expected = E.dispatch(checkpoints.get(25), commands[25]);
  assert.deepEqual(savedState(ui), expected);
  ui.el('missionUpdateContinue').click();
  assert.equal(ui.storage.get('bloodborne-hunt-v07'), before);
  assert.match(ui.el('missionUpdateHistory').textContent, /임무 완수/);
  assert.equal(savedState(ui).phase, expected.phase);
  assert.deepEqual(savedState(ui).rewardChoices, expected.rewardChoices);
});

test('a naturally changed rescue stage shows the current objective without unrevealed endings', () => {
  const ui = at(80); clickCommand(ui, commands[80]);
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.equal(ui.el('missionUpdateTitle').textContent, '목표 변경');
  assert.match(ui.el('missionUpdateList').textContent, /적의 추격 없이/);
  assert.doesNotMatch(ui.el('missionUpdateList').textContent, /피의 기쁨|도망치라고|공격하는 선택|카드|[AB]면/);
  const before = ui.storage.get('bloodborne-hunt-v07');
  ui.el('missionUpdateDialog').fire('cancel');
  assert.equal(ui.el('missionUpdateDialog').open, false);
  assert.equal(ui.storage.get('bloodborne-hunt-v07'), before, 'keyboard acknowledgement has no game effect');
  ui.el('openMissionUpdates').click();
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.match(ui.el('missionUpdateList').textContent, /적의 추격 없이/);
});

test('chapter completion displays all simultaneous mission results once and retains the saved engine outcome', () => {
  const ui = at(123); clickCommand(ui, commands[123]);
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.match(ui.el('missionUpdateList').textContent, /임무 완수/);
  assert.match(ui.el('missionUpdateList').textContent, /챕터 1 완수/);
  assert.doesNotMatch(ui.el('missionUpdateList').textContent, /성직자|챕터 2/);
  assert.deepEqual(savedState(ui), E.dispatch(checkpoints.get(123), commands[123]));
  ui.el('missionUpdateContinue').click();
  assert.equal(ui.el('missionUpdateDialog').open, false);
});

test('starting a new hunt clears session notices and introduces its own current mission', () => {
  const ui = at(3); clickCommand(ui, commands[3]); ui.el('missionUpdateContinue').click();
  ui.el('new').click(); ui.el('start').value = 'center'; ui.el('start').fire('change');
  ui.el('seed').value = '90'; ui.el('confirmSetup').click();
  assert.equal(ui.el('setupError').textContent, '');
  assert.equal(ui.el('missionUpdateDialog').open, true);
  assert.match(ui.el('missionUpdateList').textContent, /재앙의 근원/);
  assert.doesNotMatch(ui.el('missionUpdateHistory').textContent, /사냥을 시작하다/);
  assert.equal(savedState(ui).commands.length, 0, 'the initial briefing does not add a replay command');
});
