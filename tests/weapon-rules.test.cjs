"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../src/extended-weapons.js");
const R = require("../src/weapon-rules.js");
const face = (id, n = 0) => W.definition(id).faces[n];
function state(extra = {}) {
  return { setup: { rulesVersion: 10 }, round: 3, activeHunterId: "h1",
    hunters: { h1: { hp: 4, slots: [null, null, null], ...extra } } };
}
const bonus = (s, id, n, slot, card = {}, reward = {}, boost) => R.attackBonus(s, face(id, n), slot, card, reward, boost);

test("extended weapon rules are isolated from old saves and provisional practice", () => {
  const s = state({ hp: 1 });
  s.setup.rulesVersion = 9;
  assert.equal(R.enabled(s), false);
  assert.equal(bonus(s, "beast-claw", 0, 0).damage, 0);
  s.setup.rulesVersion = 10; s.provisional = { component: true };
  assert.equal(R.enabled(s), false);
  assert.deepEqual(R.afterDodge(s, face("threaded-cane"), 3, 3), {});
});

test("cane and mercy equal-speed stagger does not itself grant the stagger keyword", () => {
  assert.equal(bonus(state(), "threaded-cane", 1, 0).interruptEqual, true);
  assert.equal(bonus(state(), "blade-of-mercy", 0, 0).interruptEqual, true);
  assert.equal(bonus(state(), "threaded-cane", 0, 0).interruptEqual, false);
  assert.equal(bonus(state(), "blade-of-mercy", 1, 0).interruptEqual, false);
});

test("saw spear gains damage only when this attack carries stagger from stat or reward", () => {
  const s = state();
  assert.equal(bonus(s, "saw-spear", 1, 0).damage, 0);
  assert.equal(bonus(s, "saw-spear", 1, 0, { interrupt: true }).damage, 1);
  assert.equal(bonus(s, "saw-spear", 1, 0, {}, { interrupt: true }).damage, 1);
  assert.equal(bonus(s, "saw-spear", 0, 0, { interrupt: true }).damage, 0);
});

test("rifle spear counts move actions within this round rather than movement distance", () => {
  const s = state({ moveActionsRound: 2 });
  assert.equal(bonus(s, "rifle-spear", 1, 0).damage, 2);
  s.hunters.h1.moveActionsRound = { round: 3, count: 1 };
  assert.equal(bonus(s, "rifle-spear", 1, 0).damage, 1);
  s.round = 4;
  assert.equal(bonus(s, "rifle-spear", 1, 0).damage, 0);
  assert.equal(bonus(s, "rifle-spear", 0, 0).damage, 0);
});

test("mercy finishing combo counts its just-placed card and other occupied slots", () => {
  const s = state({ slots: [{ id: "a" }, null, { id: "combo" }] });
  assert.equal(bonus(s, "blade-of-mercy", 1, 2).damage, 2);
  assert.equal(bonus(s, "blade-of-mercy", 1, 0).damage, 0);
  s.hunters.h1.slots[1] = { id: "b" };
  assert.equal(bonus(s, "blade-of-mercy", 1, 2).damage, 3);
});

test("regain, free transforms and destructive hammer restrictions stay on the named slot", () => {
  const s = state();
  assert.equal(bonus(s, "hunter-axe", 0, 2).healDealt, true);
  assert.equal(bonus(s, "hunter-axe", 0, 1).healDealt, false);
  assert.equal(bonus(s, "uncanny-ludwigs-holy-blade", 1, 0).freeTransform, true);
  assert.equal(bonus(s, "uncanny-ludwigs-holy-blade", 1, 1).freeTransform, false);
  assert.equal(bonus(s, "ludwigs-holy-blade", 0, 0).freeTransform, true);
  assert.equal(bonus(s, "stake-driver", 0, 1).freeTransform, true);
  const strike = bonus(s, "kirkhammer", 1, 1);
  assert.equal(strike.immuneInterrupt, true); assert.equal(strike.noDodge, true);
  assert.equal(bonus(s, "kirkhammer", 1, 0).noDodge, false);
  assert.equal(bonus(s, "kirkhammer", 1, -1).immuneInterrupt, false);
});

test("wheel self-damage choices are bounded integers and calculate equal extra damage", () => {
  const s = state();
  for (const n of [0, 1, 2]) {
    const b = bonus(s, "logarius-wheel", 1, 0, {}, {}, n);
    assert.equal(b.selfDamage, n); assert.equal(b.damage, n);
  }
  for (const invalid of [-1, 3, 1.5, "2", "speed", {}, true])
    assert.throws(() => bonus(s, "logarius-wheel", 1, 0, {}, {}, invalid));
  assert.equal(bonus(s, "logarius-wheel", 0, 0).heal, 1);
  assert.throws(() => bonus(s, "logarius-wheel", 0, 0, {}, {}, 1));
});

test("chikage permits one self-damage for exactly one speed or damage bonus", () => {
  const s = state();
  const speed = bonus(s, "chikage", 0, 0, {}, {}, "speed");
  assert.equal(speed.selfDamage, 1); assert.equal(speed.speed, 1); assert.equal(speed.damage, 0);
  const damage = bonus(s, "chikage", 0, 0, {}, {}, "damage");
  assert.equal(damage.selfDamage, 1); assert.equal(damage.speed, 0); assert.equal(damage.damage, 1);
  assert.equal(bonus(s, "chikage", 0, 0, {}, {}, "none").selfDamage, 0);
  for (const invalid of [1, 2, "both", "speed-and-damage", true])
    assert.throws(() => bonus(s, "chikage", 0, 0, {}, {}, invalid));
});

test("beast claw low-health threshold includes three health and excludes four", () => {
  for (const hp of [1, 2, 3]) {
    const b = bonus(state({ hp }), "beast-claw", 0, 0);
    assert.equal(b.speed, 1); assert.equal(b.damage, 1);
  }
  assert.equal(bonus(state({ hp: 4 }), "beast-claw", 0, 0).damage, 0);
  assert.equal(bonus(state({ hp: 2 }), "beast-claw", 1, 0).damage, 0);
});

test("tonitrus charge is gained on either transform and expires with its round", () => {
  const s = state();
  const charge = R.afterTransform(s, face("tonitrus", 1));
  assert.deepEqual(charge, { round: 3, speed: 1, damage: 1 });
  assert.deepEqual(R.afterTransform(s, face("tonitrus", 0)), charge);
  assert.equal(R.afterTransform(s, face("saw-spear")), null);
  s.hunters.h1.weaponCharge = charge;
  let b = bonus(s, "tonitrus", 1, 0);
  assert.equal(b.speed, 1); assert.equal(b.damage, 1); assert.equal(b.consumeCharge, true);
  s.round = 4; b = bonus(s, "tonitrus", 1, 0);
  assert.equal(b.consumeCharge, false); assert.equal(b.damage, 0);
});

test("stake explosion returns only its printed other-enemy splash", () => {
  assert.deepEqual(bonus(state(), "stake-driver", 1, 0).splash, { range: 1, damage: 2 });
  assert.equal(bonus(state(), "stake-driver", 0, 0).splash, null);
});

test("dodge abilities distinguish all nearby enemies, chosen same-space enemy and matched combat enemy", () => {
  const s = state();
  assert.deepEqual(R.afterDodge(s, face("threaded-cane"), 3, 2),
    { heal: 0, damage: 1, range: 1, all: true, target: "same-space" });
  assert.deepEqual(R.afterDodge(s, face("chikage", 1), 3, 2),
    { heal: 1, damage: 1, range: 0, all: false, target: "same-space" });
  assert.deepEqual(R.afterDodge(s, face("reiterpallasch"), 2, 2),
    { heal: 0, damage: 2, range: 0, all: false, target: "combat" });
  assert.deepEqual(R.afterDodge(s, face("reiterpallasch"), 3, 2), {});
});

test("clear and kill callbacks preserve target selection, drawing, healing and movement", () => {
  assert.deepEqual(R.afterClear(face("uncanny-ludwigs-holy-blade")),
    { damage: 1, range: 0, target: "same-space" });
  assert.equal(R.afterClear(face("uncanny-ludwigs-holy-blade", 1)), null);
  assert.deepEqual(R.afterKill(face("hunter-axe", 1)), { damage: 2, range: 1 });
  assert.deepEqual(R.afterKill(face("saw-spear")), { draw: 1, heal: 1 });
  assert.deepEqual(R.afterKill(face("beast-claw", 1)), { heal: 2, move: 2 });
  assert.deepEqual(R.afterKill(face("tonitrus")), {});
});

test("pure weapon rule queries never spend health, cards, movement counts or charges", () => {
  const s = state({ hp: 2, moveActionsRound: 2, slots: [{ id: "a" }, { id: "b" }, null], weaponCharge: { round: 3, speed: 1, damage: 1 } });
  const before = structuredClone(s);
  bonus(s, "logarius-wheel", 1, 0, {}, {}, 2);
  bonus(s, "chikage", 0, 0, {}, {}, "damage");
  bonus(s, "tonitrus", 0, 0);
  bonus(s, "rifle-spear", 1, 0);
  R.afterDodge(s, face("chikage", 1), 3, 2);
  R.afterTransform(s, face("tonitrus"));
  assert.deepEqual(s, before);
});
