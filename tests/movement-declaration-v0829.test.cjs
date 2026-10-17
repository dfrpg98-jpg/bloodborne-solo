"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"), Departure = require("../src/hunt-departure");
const H = E.hunter, go = (s, type, args = {}) => E.dispatch(s, {type, ...args});
const hash = s => crypto.createHash("sha256").update(E.exportSave(s)).digest("hex");
// New-requirement synthetic checks, separate from any user's normal-play save.
// Public-command fixtures retain strict replay; explicitly assembled component
// checks below only assert their own local state and JSON invariants.
function base(options = {}) {
  return E.create(90, options.weapon || "burial", options.face ?? 1, null, "hunter-pistol", "center",
    {campaign:true, rulesVersion:14, qa:{preset:"custom", startRewards:options.rewards || [], startConsumables:options.items || []}});
}
const adopt = s => E.applyMovementDeclarationRuling(s);
function exact(s) {
  const saved = E.exportSave(s);
  assert.equal(E.exportSave(E.importSave(saved)), saved, "the accepted public commands replay byte-exactly");
  return s;
}
function unchangedAfterFailure(s, command, pattern) {
  const before = E.exportSave(s);
  assert.throws(() => E.dispatch(s, command), pattern);
  assert.equal(E.exportSave(s), before);
}
function gameplay(s) {
  const result = structuredClone(s);
  for (const key of ["commands", "events", "revision"]) delete result[key];
  return result;
}

test("SYNTHETIC public commands: adoption is explicit and does not change resources or historical setup", () => {
  const before = base(), saved = E.exportSave(before), after = exact(adopt(before));
  assert.equal(E.exportSave(before), saved); assert.equal(after.movementDeclarationRuling, "first-step");
  assert.deepEqual(after.commands.at(-1), {type:"APPLY_MOVEMENT_DECLARATION_RULING"});
  assert.equal(after.revision, before.revision + 1);
  for (const key of Object.keys(before).filter(key => !["revision", "commands"].includes(key)))
    assert.deepEqual(after[key], before[key], key);
  assert.equal(adopt(after), after);
  unchangedAfterFailure(after, {type:"APPLY_MOVEMENT_DECLARATION_RULING"}, /이동 비용 판정/);
});

test("SYNTHETIC public commands: declaration and cancellation spend no card and do not invent a movement action", () => {
  const before = exact(adopt(base())), cardId = H(before).hand[0].id;
  const declared = exact(go(before, "MOVE", {cardId}));
  assert.equal(declared.phase, "move"); assert.equal(declared.move.costPending, true);
  assert.equal(declared.move.cardId, cardId); assert(E.canCancelMove(declared)); assert(!E.canStopMove(declared));
  assert.deepEqual(H(declared), H(before)); assert.equal(declared.rng, before.rng);
  unchangedAfterFailure(declared, {type:"STOP_MOVE"}, /한 칸 이상/);
  unchangedAfterFailure(declared, {type:"STEP", node:"tile-11:house"}, /인접/);
  unchangedAfterFailure(declared, {type:"EXPLORE", edge:"W"}, /열린 출입구/);
  const cancelled = exact(go(declared, "CANCEL_MOVE"));
  assert.equal(cancelled.phase, "hunter"); assert.equal(cancelled.move, null);
  assert.deepEqual(gameplay(cancelled), gameplay(before));
  unchangedAfterFailure(before, {type:"MOVE", cardId:"missing"}, /손에 있는/);
  unchangedAfterFailure(cancelled, {type:"CANCEL_MOVE"}, /이동 선언만 취소/);
});

test("SYNTHETIC public commands: the first successful step pays once and the second step cannot pay again", () => {
  const before = exact(adopt(base())), cardId = H(before).hand[0].id;
  const declared = go(before, "MOVE", {cardId}), first = exact(go(declared, "STEP", {node:"tile-14:left"}));
  assert.equal(first.move.costPending, false); assert.equal(first.move.remaining, 1);
  assert.equal(H(first).hand.length, H(before).hand.length - 1);
  assert.equal(H(first).discard.filter(card => card.id === cardId).length, 1);
  assert.equal(H(first).moveActionsRound, 1); assert(!E.canCancelMove(first)); assert(E.canStopMove(first));
  unchangedAfterFailure(first, {type:"CANCEL_MOVE"}, /이동 선언만 취소/);
  const second = exact(go(first, "STEP", {node:"tile-14:center"}));
  assert.equal(second.phase, "hunter"); assert.equal(second.move, null);
  assert.equal(H(second).hand.length, H(first).hand.length);
  assert.equal(H(second).discard.filter(card => card.id === cardId).length, 1);
  assert.equal(H(second).moveActionsRound, 1);
  const stopped = exact(go(first, "STOP_MOVE"));
  assert.equal(stopped.phase, "hunter"); assert.equal(H(stopped).moveActionsRound, 1);
});

test("SYNTHETIC public commands: exploration commits the revealed tile while payment waits for valid placement and entry", () => {
  const before = exact(adopt(base())), cardId = H(before).hand[0].id;
  const declared = go(before, "MOVE", {cardId}), revealed = exact(go(declared, "EXPLORE", {edge:"N"}));
  assert.equal(revealed.phase, "tile_place"); assert(revealed.world.pending);
  assert.equal(revealed.move.costPending, true); assert.deepEqual(H(revealed).hand, H(before).hand);
  assert.deepEqual(H(revealed).discard, H(before).discard); assert.equal(H(revealed).hp, H(before).hp);
  assert.equal(H(revealed).moveActionsRound, H(before).moveActionsRound);
  assert(!E.canCancelMove(revealed)); assert(!E.canStopMove(revealed));
  unchangedAfterFailure(revealed, {type:"CANCEL_MOVE"}, /이동 선언만 취소/);
  unchangedAfterFailure(revealed, {type:"PLACE_TILE", rotation:99}, /연결 가능한 방향/);
  const restored = E.importSave(E.exportSave(revealed));
  const placed = exact(go(restored, "PLACE_TILE", {rotation:E.placementOptions(restored)[0]}));
  assert.equal(placed.phase, "move"); assert.equal(placed.move.path.length, 2);
  assert.equal(placed.move.costPending, false); assert.equal(H(placed).hand.length, H(before).hand.length - 1);
  assert.equal(H(placed).discard.filter(card => card.id === cardId).length, 1);
  assert.equal(H(placed).moveActionsRound, 1); assert.equal(placed.world.pending, null);
  exact(go(placed, "STOP_MOVE"));
});

test("SYNTHETIC component: a spawn-selection pause retains the unpaid reservation until actual tile entry", () => {
  let before = adopt(base());
  const tile = before.world.tileDeck.find(id => M.tile(id).spaces.some(space => space.icons.some(icon => icon.kind === "spawn")));
  before.world.tileDeck = [tile, ...before.world.tileDeck.filter(id => id !== tile)];
  for (const kind of Object.keys(E.data.enemies)) for (let figure = 1; figure <= 4; figure++)
    before.enemies.push({id:kind + "-" + figure, kind, figure, node:"tile-14:left", hp:E.data.enemies[kind].health});
  E.assertState(before);
  const cardId = H(before).hand[0].id;
  let state = go(go(before, "MOVE", {cardId}), "EXPLORE", {edge:"N"});
  state = go(state, "PLACE_TILE", {rotation:E.placementOptions(state)[0]});
  assert.equal(state.phase, "spawn_choice"); assert.equal(state.move.path.length, 1);
  assert.equal(state.move.costPending, true); assert.deepEqual(H(state).hand, H(before).hand);
  assert(!E.canCancelMove(state)); unchangedAfterFailure(state, {type:"CANCEL_MOVE"}, /이동 선언만 취소/);
  state = JSON.parse(JSON.stringify(state)); E.assertState(state);
  for (let i = 0; i < 12 && state.phase === "spawn_choice"; i++)
    state = go(state, "SPAWN_CHOICE", {enemyId:state.spawnChoices[0]});
  assert.equal(state.phase, "move"); assert.equal(state.move.costPending, false);
  assert.equal(state.move.path.length, 2); assert.equal(H(state).hand.length, H(before).hand.length - 1);
  assert.equal(H(state).discard.filter(card => card.id === cardId).length, 1);
  E.assertState(JSON.parse(JSON.stringify(state)));
});

test("SYNTHETIC component: Rest heals on the first actual step and Sprint still permits three spaces", () => {
  const {hand} = require("./actual-combat-helper.cjs");
  let before = adopt(base()); hand(before, ["rest", "sprint", "endurance"]); H(before).hp = 2; E.assertState(before);
  const restId = H(before).hand.find(card => card.kind === "rest").id;
  const declared = go(before, "MOVE", {cardId:restId}); assert.equal(H(declared).hp, 2);
  const cancelled = go(declared, "CANCEL_MOVE"); assert.equal(H(cancelled).hp, 2);
  const first = go(declared, "STEP", {node:"tile-14:left"}); assert.equal(H(first).hp, 4);
  const second = go(first, "STEP", {node:"tile-14:center"}); assert.equal(H(second).hp, 4);
  let sprint = go(second, "MOVE", {cardId:H(second).hand.find(card => card.kind === "sprint").id});
  assert.equal(sprint.move.remaining, 3); assert.equal(H(sprint).moveActionsRound, 1);
  for (const node of ["tile-14:left", "tile-14:center", "tile-14:right"]) sprint = go(sprint, "STEP", {node});
  assert.equal(sprint.phase, "hunter"); assert.equal(H(sprint).moveActionsRound, 2); assert.equal(H(sprint).hp, 4);
  E.assertState(JSON.parse(JSON.stringify(sprint)));
});

test("SYNTHETIC public commands: Blue Elixir, QA travel and Guidance retain their optional zero-space completion", () => {
  for (const kind of ["blue-elixir", "qa-travel", "rune-guidance"]) {
    const before = exact(adopt(base({items:kind === "rune-guidance" ? [] : [kind], rewards:kind === "rune-guidance" ? [kind] : []})));
    const moving = kind === "rune-guidance"
      ? go(before, "USE_REWARD", {rewardId:H(before).rewards.find(reward => reward.kind === kind).id, slot:0})
      : go(before, "USE_CONSUMABLE", {itemId:H(before).consumables.find(item => item.kind === kind).id});
    exact(moving); assert.equal(moving.phase, "move"); assert.notEqual(moving.move.source, "action");
    assert(E.canStopMove(moving)); assert(!E.canCancelMove(moving));
    assert.deepEqual(H(moving).hand, H(before).hand);
    const ended = exact(go(moving, "STOP_MOVE")); assert.equal(ended.phase, "hunter");
    assert.deepEqual(H(ended).hand, H(before).hand); assert.equal(H(ended).moveActionsRound || 0, 0);
    if (kind === "rune-guidance") assert.equal(H(ended).rewards.find(reward => reward.kind === kind).ready, false);
    else assert.equal(H(ended).consumables.length, H(before).consumables.length - 1);
  }
});

test("SYNTHETIC public commands: mandatory equipment choices cannot be bypassed by a free declaration", () => {
  const before = exact(adopt(base({rewards:["bloodstone-shard"]})));
  assert(before.rewardChoices.length);
  unchangedAfterFailure(before, {type:"MOVE", cardId:H(before).hand[0].id}, /보상의 장착/);
});

test("SYNTHETIC public commands: legacy declaration and zero-step STOP remain byte-exact before adoption", () => {
  const before = E.create(90, "burial", 1, null, "hunter-pistol", "center", {campaign:true});
  assert.equal(hash(exact(before)), "9952cfba7ae5c6d144227a25f67a4cb668391cc8a78a46921f151f75d6967b85");
  const moving = exact(go(before, "MOVE", {cardId:H(before).hand[0].id}));
  assert.equal(hash(moving), "6037013e0b86702c0b730c594495014c579c13bcccce72db6341763cac2642c4");
  assert.equal(adopt(moving), moving); assert(!E.canCancelMove(moving)); assert(E.canStopMove(moving));
  unchangedAfterFailure(moving, {type:"APPLY_MOVEMENT_DECLARATION_RULING"}, /진행 중인 이동/);
  const stopped = exact(go(moving, "STOP_MOVE"));
  assert.equal(hash(stopped), "c42757164ee0fac8dde4ae3b915f13ae260931a6288fd5bb109d4f10753f0099");
  const current = exact(adopt(stopped)), next = exact(go(current, "MOVE", {cardId:H(current).hand[0].id}));
  assert.deepEqual(H(next).hand, H(current).hand); assert(E.canCancelMove(next));
  const oldFirst = exact(go(moving, "STEP", {node:"tile-14:left"}));
  assert.equal(H(oldFirst).hand.length, H(moving).hand.length, "a resumed old paid movement is never charged twice");
});

test("SYNTHETIC component: cancelling preserves equipment and mission windows instead of consuming a turn event", () => {
  let before = E.create(90, "burial", 1, null, "hunter-pistol", "center", {campaign:true, rulesVersion:14});
  for (const command of require("./fixtures/v074-patient-natural-commands.json").slice(0, 129)) before = E.dispatch(before, command);
  assert.equal(before.mission.chapter, 2); before = adopt(before);
  before.mission.npc.follow = true; before.mission.donationWindow = true;
  H(before).rewardTransformWindow = true; H(before).rewardTurnStartWindow = true; E.assertState(before);
  const declared = go(before, "MOVE", {cardId:H(before).hand[0].id});
  assert.equal(declared.mission.npc.follow, false, "a new move still asks separately whether the NPC follows");
  const cancelled = go(declared, "CANCEL_MOVE");
  assert.deepEqual(gameplay(cancelled), gameplay(before));
  const first = go(declared, "STEP", {node:E.neighbors(declared, H(declared).position)[0]});
  assert.equal(first.mission.donationWindow, false); assert.equal(H(first).rewardTransformWindow, false);
});

test("SYNTHETIC public commands: escort confirmation previews cannot pay and both walking answers pay exactly once", () => {
  let before = E.create(14, "beast-claw", 0, null, "hunter-pistol", "center", {campaign:true});
  for (const command of [{type:"MOVE", cardId:H(before).hand[0].id}, {type:"EXPLORE", edge:"N"},
    {type:"PLACE_TILE", rotation:1}, {type:"STEP", node:"tile-11:house"}]) before = E.dispatch(before, command);
  before = exact(adopt(before)); assert(before.mission.revealed.includes(8));
  const commands = [{type:"MOVE", cardId:H(before).hand[0].id}, {type:"STEP", node:"tile-11:street"}], saved = E.exportSave(before);
  const plan = Departure.plan(E, before, commands); assert(plan);
  assert.equal(E.exportSave(before), saved);
  for (const [accepted, batch] of [[true, plan.acceptCommands], [false, plan.declineCommands]]) {
    const after = exact(batch.reduce((state, command) => E.dispatch(state, command), before));
    assert.equal(H(after).hand.length, H(before).hand.length - 1);
    assert.equal(after.mission.escort.carrierId === after.activeHunterId, accepted);
    assert.equal(after.move.costPending, false); assert.equal(after.move.path.length, 2);
  }
});

test("SYNTHETIC public commands: Rifle Spear Leap retains its separate attack cost and one-movement count", () => {
  const Q = require("./helpers/rifle-leap-checkpoints.cjs");
  const before = exact(adopt(E.applyLeapMoveRuling(Q.beforeLeap()))), command = Q.selection(before);
  const after = exact(E.dispatch(before, command));
  assert.equal(H(after).hand.length, H(before).hand.length - 1);
  assert.equal(H(after).moveActionsRound, 1); assert.equal(after.combat.attack.damage, 5);
  assert.equal(H(after).position, before.enemies.find(enemy => enemy.id === command.enemyId).node);
});

test("SYNTHETIC public commands: corrupt pending-card metadata is rejected by assertions and strict import", () => {
  const before = exact(go(adopt(base()), "MOVE", {cardId:"card-3"}));
  for (const edit of [s => { s.move.cardId = "missing"; }, s => { s.move.costPending = false; },
    s => { s.move.remaining = 1; }, s => { s.movementDeclarationRuling = "untrusted"; }]) {
    const broken = structuredClone(before); edit(broken);
    assert.throws(() => E.assertState(broken), /이동/);
    assert.throws(() => E.importSave(JSON.stringify({format:"bloodborne-hunt-save", version:1, state:broken})), /이동/);
  }
});
