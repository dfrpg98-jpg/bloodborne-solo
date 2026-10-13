"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine.js"), R = require("../rewards-engine.js");
const { hand } = require("./actual-combat-helper.cjs");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });

// Each fixture retains the production card, tile and enemy-deck inventories.
function fixture(weapon, face = 0, campaign = false) {
  const gun = E.data.weapons[weapon].defaultFirearm || "hunter-pistol";
  const s = E.create(811, weapon, face, null, gun, "center", { campaign, rulesVersion: 10 });
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1,
    node: E.hunter(s).position, hp: 4 }];
  s.loot = [];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
  hand(s, ["strength", "endurance", "vitality"]);
  E.assertState(s);
  return s;
}
const cardId = (s, kind) => E.hunter(s).hand.find((c) => c.kind === kind).id;
const attack = (s, slot) => go(s, "ATTACK", { cardId: cardId(s, "strength"), slot,
  enemyId: s.enemies[0].id });

test("automatic dodge applies the whip area effect without spending a stat card", () => {
  let s = fixture("threaded-cane", 0, true);
  E.hunter(s).position = s.enemies[0].node = "tile-14:left";
  s.enemies.push({ id: "huntsman-mob-2", kind: "huntsman-mob", figure: 2, node: "tile-14:center", hp: 4 },
    { id: "huntsman-mob-3", kind: "huntsman-mob", figure: 3, node: "tile-14:right", hp: 4 });
  const rewardId = R.grant(s, "old-hunter-bone");
  E.assertState(s);
  s = attack(s, 2);
  const handBefore = structuredClone(E.hunter(s).hand), slotsBefore = structuredClone(E.hunter(s).slots);
  s = go(s, "USE_REWARD", { rewardId });
  assert.equal(s.combat.dodged, true);
  assert.deepEqual(s.enemies.map((e) => e.hp), [3, 3, 4]);
  assert.deepEqual(E.hunter(s).hand, handBefore);
  assert.deepEqual(E.hunter(s).slots, slotsBefore);
  assert.equal(s.phase, "combat_react");
  E.assertState(JSON.parse(JSON.stringify(s)));
});

test("automatic dodge applies Chikage healing and its same-space damage", () => {
  let s = fixture("chikage", 1, true);
  E.hunter(s).hp = 4;
  const rewardId = R.grant(s, "old-hunter-bone");
  s = attack(s, 1);
  s = go(s, "USE_REWARD", { rewardId });
  assert.equal(E.hunter(s).hp, 5);
  assert.equal(s.enemies[0].hp, 3);
  assert.equal(s.combat.dodged, true);
  assert.equal(s.phase, "combat_react");
});

test("the mission death dodge applies the current weapon effect before resuming the mission", () => {
  for (const automatic of [false, true]) {
    let s = fixture("chikage", 1, true);
    E.hunter(s).hp = 4;
    s.phase = "mission_death";
    s.mission.deathPending = false;
    s.mission.deathAfter = { type: "mission_hunter" };
    const rewardId = automatic ? R.grant(s, "old-hunter-bone") : null;
    E.assertState(s);
    s = automatic ? go(s, "USE_REWARD", { rewardId })
      : go(s, "MISSION_DEATH_DODGE", { cardId: cardId(s, "endurance"), slot: 0 });
    assert.equal(E.hunter(s).hp, 5, automatic ? "automatic" : "manual");
    assert.equal(s.enemies[0].hp, 3);
    assert.equal(s.phase, "hunter");
    assert.equal(s.mission.deathAfter, null);
    assert.equal(s.weaponAfter, undefined);
    assert.equal(s.weaponEffects, undefined);
  }
});

test("a mission death dodge uses card speed bonuses for matching-speed weapon effects", () => {
  let s=fixture("reiterpallasch",0,true);
  hand(s,["strength","tactical","vitality"]);
  s=attack(s,0);
  s.phase="mission_death";s.mission.deathPending=false;s.mission.deathAfter={type:"react"};
  E.assertState(s);
  s=go(s,"MISSION_DEATH_DODGE",{cardId:cardId(s,"tactical"),slot:2});
  assert.equal(E.slots(s)[2].speed,1);
  assert.equal(s.enemies[0].hp,4,"speed one plus tactical is two and cannot match the speed-one reaction");
  assert.equal(s.phase,"combat_react");
});

test("a beast-claw kill movement resumes enemy activation after the survivor mission choice", () => {
  let s = fixture("beast-claw", 1, true);
  E.hunter(s).hp = 2;
  s.enemies[0].hp = 2;
  s.mission.revealed.push(12, 13);
  s.mission.survivor.node = "tile-14:left";
  E.assertState(s);
  s = go(s, "END_TURN");
  assert.equal(s.phase, "combat_choose");
  s = go(s, "COUNTER", { cardId: cardId(s, "strength"), slot: 0, enemyId: s.enemies[0].id });
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "move");
  assert.equal(s.move.source, "weapon");
  assert.equal(s.move.remaining, 2);
  s = go(s, "STEP", { node: "tile-14:left" });
  s = go(s, "STOP_MOVE");
  assert.equal(s.phase, "mission_choice");
  assert(s.weaponMoveReturn, "movement continuation is retained while the mission asks for a choice");
  s = JSON.parse(JSON.stringify(s));
  s = go(s, "MISSION_CHOICE", { choice: "release" });
  assert(s.mission.completed.includes(16));
  assert.equal(s.phase, "refill");
  assert.equal(s.round, 2);
  assert.equal(s.combat, null);
  assert.equal(s.move, null);
  for (const key of ["weaponMoveReturn", "weaponAfter", "weaponEffects"])
    assert.equal(s[key], undefined, key);
});

test("clearing a face-down weapon card removes its temporary tag before it enters discard", () => {
  let s = fixture("reiterpallasch", 1);
  const id = cardId(s, "vitality");
  s = go(s, "WEAPON_SHOT", { cardId: id, slot: 1, enemyId: s.enemies[0].id });
  assert.equal(E.hunter(s).slots[1].faceDown, true);
  s = go(s, "TRANSFORM", { cardId: cardId(s, "strength") });
  const discarded = E.hunter(s).discard.find((c) => c.id === id);
  assert(discarded);
  assert.equal(Object.hasOwn(discarded, "faceDown"), false);
  E.assertState(s);
});

test("dream collection removes face-down weapon tags before recycling the hunter deck", () => {
  let s = fixture("reiterpallasch", 1);
  const id = cardId(s, "vitality");
  s = go(s, "WEAPON_SHOT", { cardId: id, slot: 1, enemyId: s.enemies[0].id });
  s.enemies = [];
  s = go(s, "DREAM", { cardId: cardId(s, "strength") });
  const h = E.hunter(s), cards = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  assert.equal(cards.length, 12);
  assert(cards.some((c) => c.id === id));
  assert(cards.every((c) => !Object.hasOwn(c, "faceDown")));
  E.assertState(JSON.parse(JSON.stringify(s)));
});

test("map reset restores the selected real practice opponent and its side at the chosen start space", () => {
  for (const [target, side, start] of [["church-servant", "b", "left"], ["henryk", "a", "right"]]) {
    let s = E.create(811, "burial", 0, null, "hunter-pistol", start,
      { campaign: false, rulesVersion: 10, practiceTarget: target, practiceSide: side });
    const initial = structuredClone(s.enemies[0]), selectedSide = s.setup.practiceSide;
    E.hunter(s).position = "tile-14:center";
    s.enemies[0].node = "tile-14:center";
    s.enemies[0].hp = 1;
    s.track = 4;
    E.assertState(s);
    s = go(s, "DREAM", { cardId: E.hunter(s).hand[0].id });
    // Entering the dream crosses reset space 5, then ends the round at 6.
    assert.equal(s.track, 6);
    assert.equal(s.enemies.length, 1);
    assert.deepEqual(s.enemies[0], initial);
    assert.equal(s.setup.practiceTarget, target);
    assert.equal(s.setup.practiceSide, selectedSide);
    assert.equal(selectedSide, target === "henryk" ? "1-2" : "b");
    E.assertState(JSON.parse(JSON.stringify(s)));
  }
});
