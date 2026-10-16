"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/hunt-engine.js');
const commands = require('./fixtures/chapter-one-commands.json');
const {choose} = require('./hunt-playthrough-helper.cjs');
const H = E.hunter;
const go = (s, type, args = {}) => E.dispatch(s, {type, ...args});
const replay = s => assert.deepEqual(E.importSave(E.exportSave(s)), s);

function checkpoint(count) {
  let s = E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', {campaign: true});
  for(const a of commands.slice(0, count)) s = E.dispatch(s, a);
  return s;
}
// These two tools are explicitly issued through the existing QA setup. The
// map, fog and dream states still arise solely from normal public commands.
function toolEncounter() {
  let s = E.create(90, 'burial', 1, null, 'hunter-pistol', 'center', {campaign: true,
    qa: {preset: 'custom', startRewards: ['lantern'], startConsumables: ['bold-mark']}});
  for(const a of commands.slice(0, 4)) s = E.dispatch(s, a);
  return s;
}
function returnFromDream(s, destination) {
  s = go(s, 'DREAM', {cardId: H(s).hand[0].id});
  for(let i = 0; s.phase !== 'return'; i++) {
    assert(i < 12, 'dream preparation must reach the public return choice');
    s = E.dispatch(s, choose(s));
  }
  return go(s, 'RETURN', {node: destination, face: 1});
}

test('public dream return rejects the fog-broken yard lamp without changing the save', () => {
  const s = checkpoint(16), before = structuredClone(s);
  assert.equal(s.phase, 'return');
  assert(s.mission.fog.includes('tile-04'));
  assert(E.node(s, 'tile-04:center').icons.some(i => i.kind === 'lamp'));
  assert.equal(E.node(s, 'tile-04:center').lamp, false);
  assert(!E.nodes(s).filter(n => n.lamp).some(n => n.id === 'tile-04:center'));
  assert.throws(() => go(s, 'RETURN', {node: 'tile-04:center', face: 1}), /귀환 등불/);
  assert.deepEqual(s, before);
  replay(s);
  const returned = go(s, 'RETURN', {node: 'tile-14:center', face: 1});
  assert.equal(H(returned).position, 'tile-14:center');
  replay(returned);
});

test('central lamp printed exception enters any fog space even when its lamp is broken', () => {
  const s = checkpoint(17), before = structuredClone(s);
  assert(E.interactionOptions(s).teleport);
  for(const space of ['left', 'center', 'right']) {
    const destination = 'tile-04:' + space;
    assert(E.centralLampDestinations(s).some(n => n.id === destination));
    const next = go(s, 'INTERACT', {cardId: H(s).hand[0].id, lamp: destination});
    assert.equal(H(next).position, destination);
    assert.equal(H(next).hand.length, H(s).hand.length - 1);
    assert.equal(E.node(next, 'tile-04:center').lamp, false);
    assert.equal(E.interactionOptions(next).teleport, false);
    replay(next);
  }
  assert.throws(() => go(s, 'INTERACT', {cardId: H(s).hand[0].id, lamp: 'tile-14:left'}), /등불.*안개/);
  assert.deepEqual(s, before);
});

test('issued lantern and mark cannot target a broken lamp from outside the fog', () => {
  const s = returnFromDream(toolEncounter(), 'tile-14:center'), before = structuredClone(s);
  const lantern = H(s).rewards.find(r => r.kind === 'lantern');
  const mark = H(s).consumables.find(i => i.kind === 'bold-mark');
  const view = E.rewardsView(s).rewards.find(r => r.id === lantern.id);
  assert(view.usable);
  assert(!view.controls.targets.some(n => n.node === 'tile-04:center'));
  assert.equal(E.canTeleport(s, 'tile-04:center'), false);
  assert.throws(() => go(s, 'USE_REWARD', {rewardId: lantern.id, node: 'tile-04:center'}), /등불/);
  assert.throws(() => go(s, 'USE_CONSUMABLE', {itemId: mark.id, node: 'tile-04:center'}), /등불/);
  assert.deepEqual(s, before);
  assert(H(s).rewards.find(r => r.id === lantern.id).ready);
  assert(H(s).consumables.some(i => i.id === mark.id));
  replay(s);
  for(const command of [
    {type: 'USE_REWARD', rewardId: lantern.id, node: 'tile-14:center'},
    {type: 'USE_CONSUMABLE', itemId: mark.id, node: 'tile-14:center'}
  ]) {
    const next = E.dispatch(s, command);
    assert.equal(H(next).position, 'tile-14:center');
    replay(next);
  }
});

test('lantern and mark cannot escape a fog encounter while dream entry remains legal', () => {
  const s = toolEncounter(), before = structuredClone(s);
  const lantern = H(s).rewards.find(r => r.kind === 'lantern');
  const mark = H(s).consumables.find(i => i.kind === 'bold-mark');
  const view = E.rewardsView(s).rewards.find(r => r.id === lantern.id);
  assert.equal(view.usable, false);
  assert.deepEqual(view.controls.targets, []);
  assert.match(view.disabledReason, /안개/);
  assert.equal(E.canTeleport(s, 'tile-14:center'), false);
  assert.throws(() => go(s, 'USE_REWARD', {rewardId: lantern.id, node: 'tile-14:center'}), /등불/);
  assert.throws(() => go(s, 'USE_CONSUMABLE', {itemId: mark.id, node: 'tile-14:center'}), /안개/);
  assert.deepEqual(s, before);
  const next = returnFromDream(s, 'tile-14:center');
  assert(next.mission.fog.includes('tile-04'));
  assert.equal(H(next).position, 'tile-14:center');
  replay(next);
});

test('normally completing the encounter restores its lamp and permits dream return there', () => {
  const s = checkpoint(29);
  assert(s.mission.completed.includes(7));
  assert(!s.mission.fog.includes('tile-04'));
  assert.equal(E.node(s, 'tile-04:center').lamp, true);
  assert.equal(E.canTeleport(s, 'tile-04:center'), true);
  assert(E.rewardsView(s).rewards.find(r => r.kind === 'lantern').controls.targets
    .some(n => n.node === 'tile-04:center'));
  const next = returnFromDream(s, 'tile-04:center');
  assert.equal(H(next).position, 'tile-04:center');
  assert.equal(E.node(next, H(next).position).lamp, true);
  replay(next);
});
