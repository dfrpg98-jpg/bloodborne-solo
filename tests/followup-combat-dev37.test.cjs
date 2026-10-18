"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Auto = require("../src/hunt-automatic-combat");
const { hand } = require("./actual-combat-helper.cjs");
const manifest = require("./fixtures/weapon-campaign-completion/manifest.json");
const go = (state, type, args = {}) => E.dispatch(state, { type, ...args });
const roundTrip = state => assert.deepEqual(E.importSave(E.exportSave(state)), state);

function campaign(weaponId, startFace, count, { full = false, changes = {} } = {}) {
  const spec = (full ? manifest.cases : manifest.chapterOne).find(value =>
    value.weaponId === weaponId && value.startFace === startFace);
  assert(spec);
  let state = E.create(spec.seed, spec.weaponId, spec.startFace, null,
    spec.initialFirearmId, spec.startSpace, { campaign: true, rulesVersion: 14 });
  const commands = require(`./fixtures/weapon-campaign-completion/${spec.commandsFile}`);
  for (const [index, command] of commands.slice(0, count).entries()) {
    while (state.phase === "kill_react" && !state.rewardChoices.length && command.type !== "USE_REWARD")
      state = go(state, "PASS_KILL_REACTION");
    state = E.dispatch(state, { ...command, ...(changes[index + 1] || {}) });
  }
  assert.equal(state.setup.qa, undefined);
  roundTrip(state);
  return state;
}

function exactMissionBoundary(hp = 3) {
  // The exact requested HP values are component boundaries, not a claimed
  // naturally reached campaign save. The following attacks use real commands.
  let state = E.create(123, "hunter-axe", 0, null, "hunter-pistol", "center",
    { campaign: true, rulesVersion: 14 });
  state.world.assignments.find(value => value.enemyId === "scourge-beast").sideId = "b";
  const hunter = E.hunter(state); hunter.hp = hp;
  hand(state, ["strength", "endurance", "skill"]);
  state.enemies = [{ id: "scourge-beast-1", kind: "scourge-beast", figure: 1,
    node: hunter.position, hp: 1, missionId: "main" }];
  state.loot = [];
  state.mission.revealed = [1, 2, 3]; state.mission.fog = ["tile-14"];
  state.mission.targets.main = { id: "main", card: 3, tile: "tile-14", node: hunter.position,
    kind: "scourge-beast", initialTokens: 1, tokens: 0, complete: false,
    enemyId: "scourge-beast-1" };
  state.enemyDeck = ["special", "basic", "basic", "basic", "special", "ability"];
  state.enemyDiscard = [];
  E.assertState(state);
  state = go(state, "ATTACK", { enemyId: state.enemies[0].id,
    cardId: hunter.hand.find(card => card.kind === "strength").id, slot: 0 });
  assert.equal(state.combat.attack.speed, 2); assert.equal(state.combat.attack.damage, 3);
  assert.equal(state.combat.action.name, "다단 가르기");
  assert.equal(state.combat.action.speed, 2); assert.equal(state.combat.action.damage, 2);
  return state;
}

function equipShard(state) {
  const choice = state.rewardChoices.find(choice => choice.reason === "slot");
  assert(choice);
  return go(state, "EQUIP_REWARD", { rewardId: choice.rewardId, slot: 1 });
}

test("exact HP3 versus HP1 at speed2 keeps Double Slash's second hit behind mission reward equipment", () => {
  const declared = exactMissionBoundary(), first = go(declared, "RESOLVE");
  assert.equal(E.hunter(first).hp, 1); assert.equal(first.enemies.length, 0);
  assert.equal(first.phase, "combat_extra"); assert.equal(first.mission.won, true);
  assert(first.mission.completed.includes(4)); assert(first.mission.revealed.includes(4));
  assert.deepEqual(first.combat.extra, { damage: 2, dodgeSpeed: 2 });
  assert.equal(first.rewardChoices.length, 1); assert.equal(Auto.nextCommand(first, E), null);
  const equipped = equipShard(first), dodgeCard = E.hunter(equipped).hand.find(card => card.kind === "endurance");
  assert.equal(E.canDodge(equipped, dodgeCard.id, 1, true), true);
  assert.equal(Auto.nextCommand(equipped, E), null, "a real dodge must not be automatically forfeited");
  const avoided = go(equipped, "EXTRA_DODGE", { cardId: dodgeCard.id, slot: 1 });
  assert.equal(avoided.combat, null); assert.equal(E.hunter(avoided).inDream, true);
  assert.equal(avoided.events.filter(event => /처치당했습니다\./.test(event.text)).length, 0);
  assert.equal(avoided.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, 0);
  assert.equal(avoided.commands.at(-1).type, "EXTRA_DODGE");
  const taken = go(equipped, "EXTRA_TAKE");
  assert.equal(E.hunter(taken).inDream, true); assert.equal(taken.combat, null);
  assert.equal(taken.events.filter(event => /처치당했습니다\./.test(event.text)).length, 1);
  assert.equal(taken.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, 1);
  assert.equal(Auto.nextCommand(taken, E), null);
});

test("exact HP1 simultaneous mission kill goes directly to death and never offers a second-hit confirmation", () => {
  const after = go(exactMissionBoundary(1), "RESOLVE");
  assert.equal(after.enemies.length, 0); assert.equal(after.mission.won, true);
  assert(after.mission.completed.includes(4)); assert.equal(after.combat, null);
  assert.equal(E.hunter(after).inDream, true); assert.equal(Auto.nextCommand(after, E), null);
  assert.notEqual(after.phase, "combat_extra"); assert.notEqual(after.phase, "mission_death");
  assert.equal(after.commands.filter(command => command.type === "EXTRA_TAKE").length, 0);
  assert.equal(after.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, 0);
  assert.equal(after.events.filter(event => /처치당했습니다\./.test(event.text)).length, 1);
  assert(after.rewardChoices.length, "a simultaneous mission reward remains a real mandatory equipment choice");
});

test("normal campaign public commands reproduce the mission-complete reward before a dead beast's Double Slash", () => {
  const declared = campaign("rifle-spear", 1, 109), enemyId = declared.combat.enemyId;
  const extras = declared.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length,
    deaths = declared.events.filter(event => /처치당했습니다\./.test(event.text)).length;
  assert.equal(E.hunter(declared).hp, 4, "this natural proof is HP4, distinct from the exact HP3 boundary");
  assert.equal(declared.enemies.find(enemy => enemy.id === enemyId).hp, 1);
  assert.equal(declared.mission.targets.main.tokens, 0);
  assert.equal(declared.combat.attack.speed, 2); assert.equal(declared.combat.attack.damage, 3);
  assert.equal(declared.combat.action.name, "다단 가르기");
  let state = go(declared, "RESOLVE"); roundTrip(state);
  assert.equal(state.phase, "combat_extra"); assert.equal(E.hunter(state).hp, 2);
  assert.equal(state.enemies.some(enemy => enemy.id === enemyId), false);
  assert.equal(state.mission.won, true); assert.equal(Auto.nextCommand(state, E), null);
  state = equipShard(state); roundTrip(state);
  const rapture = E.rewardsView(state).rewards.find(reward => reward.kind === "rune-rapture");
  assert(rapture.usable); assert.equal(Auto.nextCommand(state, E), null);
  state = go(state, "USE_REWARD", { rewardId: rapture.id }); roundTrip(state);
  assert.equal(E.hunter(state).hp, 3);
  assert.deepEqual(Auto.nextCommand(state, E), { type: "EXTRA_TAKE" });
  state = E.dispatch(state, Auto.nextCommand(state, E)); roundTrip(state);
  assert.equal(state.combat, null); assert.equal(E.hunter(state).inDream, true);
  assert.equal(state.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, extras + 1);
  assert.equal(state.events.filter(event => /처치당했습니다\./.test(event.text)).length, deaths);
});

test("normal public upgrade and movement choices retain a legal dodge after the mission beast is dead", () => {
  let state = campaign("logarius-wheel", 1, 94, {
    changes: { 71: { index: 2 }, 80: { choice: "release" }, 91: { cardId: "card-9" } },
  });
  const extras = state.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length;
  state = go(state, "RESOLVE"); roundTrip(state);
  assert.equal(state.phase, "combat_extra"); assert.equal(E.hunter(state).hp, 4);
  assert.equal(state.enemies.some(enemy => enemy.id === state.combat.enemyId), false);
  assert.equal(state.mission.won, true); state = equipShard(state); roundTrip(state);
  const dodgeCard = E.hunter(state).hand.find(card => card.kind === "tactical");
  assert(dodgeCard); assert.equal(E.slots(state)[1].speed, 1);
  assert.equal(E.canDodge(state, dodgeCard.id, 1, true), true);
  assert.equal(E.rewardsView(state).rewards.some(reward => reward.usable), false,
    "the legal dodge itself blocks automation, independently of optional kill rewards");
  assert.equal(Auto.nextCommand(state, E), null);
  state = go(state, "EXTRA_DODGE", { cardId: dodgeCard.id, slot: 1 }); roundTrip(state);
  assert.equal(state.combat, null); assert.equal(E.hunter(state).inDream, true);
  assert.equal(state.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, extras);
  assert.equal(state.commands.at(-1).type, "EXTRA_DODGE");
});

test("a normal chapter2 public prefix reaches both HP1 and same-speed Double Slash with no ghost followup", () => {
  let state = campaign("stake-driver", 1, 175, { full: true });
  state = go(state, "ATTACK", { enemyId: "scourge-beast-1", cardId: "card-2", slot: 1 });
  roundTrip(state);
  const sourceId = state.combat.enemyId;
  assert.equal(E.hunter(state).hp, 1); assert.equal(state.enemies.find(enemy => enemy.id === sourceId).hp, 1);
  assert.equal(state.combat.action.name, "다단 가르기");
  assert.equal(state.combat.attack.speed, state.combat.action.speed);
  const count = state.commands.length;
  state = go(state, "RESOLVE"); roundTrip(state);
  assert.equal(state.commands.length, count + 1); assert.equal(state.combat, null);
  assert.equal(E.hunter(state).inDream, true); assert.equal(state.phase, "refill");
  assert.equal(E.hunter(state).hp, 6, "automatic empty-credit dream recovery already healed the dead hunter");
  assert.equal(state.events.slice(-10).filter(event => /다단 가르기 추가 피해/.test(event.text)).length, 0);
  assert.equal(state.events.slice(-10).filter(event => /처치당했습니다\./.test(event.text)).length, 1);
  assert.equal(Auto.nextCommand(state, E), null);
});

test("normal campaign release branch automatically continues a forced dead-beast extra only after reward choice", () => {
  const declared = campaign("rifle-spear", 1, 109, { changes: { 90: { choice: "release" } } });
  assert.equal(E.hunter(declared).hp, 4);
  let state = go(declared, "RESOLVE"); roundTrip(state);
  assert.equal(state.phase, "combat_extra"); assert.equal(E.hunter(state).hp, 2);
  assert.equal(state.mission.won, true); assert.equal(Auto.nextCommand(state, E), null);
  state = equipShard(state); roundTrip(state);
  assert.equal(E.rewardsView(state).rewards.some(reward => reward.usable), false);
  assert.deepEqual(Auto.nextCommand(state, E), { type: "EXTRA_TAKE" });
  state = E.dispatch(state, Auto.nextCommand(state, E)); roundTrip(state);
  assert.equal(state.combat, null); assert.equal(E.hunter(state).inDream, true);
  assert.equal(state.commands.at(-1).type, "EXTRA_TAKE");
  assert.equal(state.events.slice(-12).filter(event => /처치당했습니다\./.test(event.text)).length, 1);
  assert.equal(Auto.nextCommand(state, E), null);
});
