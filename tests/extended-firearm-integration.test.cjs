"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js");
const { hand } = require("./actual-combat-helper.cjs");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function fixture(gun, weapon = "burial", face = 0) {
  const s = E.create(123, weapon, face, null, gun, "center", { campaign: false, rulesVersion: 10 });
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: E.hunter(s).position, hp: 4 }];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = [];
  s.loot = []; hand(s, ["strength", "endurance", "vitality"]); E.assertState(s); return s;
}

test("cannon deals its slower three damage without stagger or splash and preserves the stat hand", () => {
  let s = fixture("cannon"); s.enemies.push({ ...s.enemies[0], id: "huntsman-mob-2", figure: 2 });
  const cards = structuredClone(E.hunter(s).hand);
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.combat.attack, null); assert.equal(s.combat.flame.speed, 1);
  assert.equal(s.combat.flame.damage, 3); assert.equal(s.combat.flame.interrupt, false); assert.equal(s.combat.flame.splash, 0);
  s = go(s, "RESOLVE"); assert.equal(s.enemies[0].hp, 1); assert.equal(s.enemies[1].hp, 4);
  assert.equal(E.hunter(s).hp, 4); assert.deepEqual(E.hunter(s).hand, cards);
});

test("rosmarinus slows the current attack and removes statuses, interruption, dodge restrictions and movement", () => {
  let s = fixture("rosmarinus");
  s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: E.hunter(s).hand[0].id, slot: 1 });
  Object.assign(s.combat.action, { poison: true, frenzy: true, interrupt: true, stun: true, undodgeable: true,
    uninterruptible: true, followup: true, forceHunterMove: 1, afterAttackMove: 1 });
  const damage = s.combat.action.damage, speed = s.combat.action.speed;
  s = go(s, "FIREARM");
  assert.equal(s.combat.action.speed, Math.max(0, speed - 1)); assert.equal(s.combat.action.damage, damage);
  for (const key of ["poison", "frenzy", "interrupt", "stun", "undodgeable", "uninterruptible", "followup", "forceHunterMove", "afterAttackMove"])
    assert(!s.combat.action[key], key);
  assert.equal(E.canDodge(s, E.hunter(s).hand.find((c) => c.kind === "endurance").id, 0), true);
  s = go(s, "RESOLVE"); assert.equal(E.hunter(s).status.poison, false); assert.equal(E.hunter(s).status.frenzy, false);
  assert.equal(E.hunter(s).position, "tile-14:center"); assert.equal(s.phase, "hunter");
});

test("evelyn spends exactly one echo to prepare and can automatically stagger a basic attack", () => {
  let s = fixture("evelyn"); E.hunter(s).firearmReady = false; E.hunter(s).echoes = 1;
  const cards = structuredClone(E.hunter(s).hand);
  s = go(s, "RELOAD", { payEcho: true, cardIds: [] });
  assert.equal(E.hunter(s).echoes, 0); assert.deepEqual(E.hunter(s).hand, cards);
  s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: E.hunter(s).hand[0].id, slot: 0 });
  s = go(s, "FIREARM"); assert.equal(s.combat.cancelEnemy, true);
  s = go(s, "RESOLVE"); assert.equal(E.hunter(s).hp, 6); assert.equal(E.hunter(s).firearmReady, false);
  const before = structuredClone(s);
  assert.throws(() => go(s, "RELOAD", { payEcho: true })); assert.deepEqual(s, before);
});

test("shotgun deals a non-attack effect and requires one step away when a route exists", () => {
  let s = fixture("hunter-blunderbuss"), cards = structuredClone(E.hunter(s).hand);
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.enemies[0].hp, 3); assert.equal(s.phase, "weapon_choice");
  assert.equal(s.enemyDiscard.length, 0); assert.equal(s.combat, null);
  const choices = E.weaponChoices(s);
  assert(!choices.some((choice) => choice.command.stop), "the printed one-space move is mandatory");
  const before = structuredClone(s);
  assert.throws(() => go(s, "WEAPON_CHOICE", { stop: true })); assert.deepEqual(s, before);
  const step = choices.find((choice) => choice.command.node); assert(step);
  s = E.dispatch(s, step.command); assert.equal(s.phase, "hunter");
  assert.equal(E.distance(s, E.hunter(s).position, s.enemies[0].node), 1);
  assert.deepEqual(E.hunter(s).hand, cards); assert.equal(E.hunter(s).hp, 6);
});

test("a lethal shotgun effect awards the kill and ends without revealing an enemy card", () => {
  let s = fixture("hunter-blunderbuss"); s.enemies[0].hp = 1;
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.phase, "hunter"); assert.equal(s.enemies.length, 0); assert.equal(s.kills, 1);
  assert.equal(E.hunter(s).echoes, 1); assert.equal(s.enemyDiscard.length, 0);
});

test("cane equal-speed stagger also applies to a flame attack without a stat card", () => {
  let s = fixture("flamesprayer", "threaded-cane", 1);
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.equal(s.combat.flame.interruptEqual, true);
  s = go(s, "RESOLVE"); assert.equal(E.hunter(s).hp, 6); assert.equal(s.enemies[0].hp, 2);
});

test("general wheel and chikage attack boosts can be chosen for standalone firearms", () => {
  let wheel = fixture("cannon", "logarius-wheel", 1), before = structuredClone(wheel);
  assert.throws(() => go(wheel, "FIREARM", { enemyId: wheel.enemies[0].id, weaponBoost: 3 })); assert.deepEqual(wheel, before);
  wheel = go(wheel, "FIREARM", { enemyId: wheel.enemies[0].id, weaponBoost: 2 });
  assert.equal(E.hunter(wheel).hp, 4); assert.equal(wheel.combat.flame.damage, 5);
  let chikage = fixture("flamesprayer", "chikage", 0);
  chikage = go(chikage, "FIREARM", { enemyId: chikage.enemies[0].id, weaponBoost: "speed" });
  assert.equal(E.hunter(chikage).hp, 5); assert.equal(chikage.combat.flame.speed, 3);
  chikage = go(chikage, "RESOLVE"); assert.equal(E.hunter(chikage).hp, 5);
});

test("a natural cannon practice attack is reproduced exactly from its saved command history", () => {
  let s = E.create(19, "burial", 0, null, "cannon", "center",
    { campaign: false, rulesVersion: 10, practiceTarget: "church-giant", practiceSide: "a" });
  s = go(s, "FIREARM", { enemyId: s.enemies[0].id });
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
