"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine.js"), W = require("../extended-weapons.js");
const { hand } = require("./actual-combat-helper.cjs");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function fixture(id, face = 0, kinds = ["strength", "endurance", "vitality"], gun = "hunter-pistol") {
  const s = E.create(123, id, face, null, gun, "center", { campaign: false, rulesVersion: 10 });
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: E.hunter(s).position, hp: 4 }];
  s.loot = []; hand(s, kinds); basic(s); E.assertState(s); return s;
}
function basic(s) { s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = []; return s; }
const attack = (s, slot, kind = "strength", args = {}) => go(s, "ATTACK", { enemyId: s.enemies[0].id,
  cardId: E.hunter(s).hand.find((c) => c.kind === kind).id, slot, ...args });
const extra = (s, figure, node = E.hunter(s).position, hp = 4) => s.enemies.push({ id: `huntsman-mob-${figure}`, kind: "huntsman-mob", figure, node, hp });
function settlePushes(s) {
  for (let i = 0; s.phase === "weapon_choice" && i < 8; i++) {
    const skip = E.weaponChoices(s).find((choice) => choice.command.stop);
    assert(skip, "only push choices remain"); s = E.dispatch(s, skip.command);
  }
  return s;
}

test("all supplied weapon faces create their actual slot counts and preserve them in save imports", () => {
  for (const w of Object.values(W.weapons)) for (const face of [0, 1]) {
    const s = E.create(123, w.id, face, null, w.defaultFirearm, "center", { campaign: false, rulesVersion: 10 });
    assert.equal(E.slots(s).length, w.faces[face].slots.length, `${w.id}/${face}`);
    assert.equal(E.hunter(s).slots.length, w.faces[face].slots.length);
    assert.deepEqual(E.importSave(E.exportSave(s)), s);
  }
});

test("dream return can select either face of weapons with unequal slot counts", () => {
  for (const id of ["stake-driver", "kirkhammer", "ludwigs-holy-blade", "uncanny-ludwigs-holy-blade"]) {
    let s = fixture(id); s.enemies = []; E.hunter(s).echoes = 0;
    s = go(s, "DREAM", { cardId: E.hunter(s).hand[0].id });
    assert.equal(s.phase, "refill"); s = go(s, "REFILL"); assert.equal(s.phase, "return");
    s = go(s, "RETURN", { node: "tile-14:center", face: 1 });
    assert.equal(E.hunter(s).slots.length, E.slots(s).length, id);
    assert(E.hunter(s).slots.every((c) => c === null)); E.assertState(s);
  }
});

test("cane equal-speed stagger cancels the incoming same-speed attack", () => {
  let s = fixture("threaded-cane", 1, ["skill", "endurance", "vitality"]);
  s = attack(s, 1, "skill"); assert.equal(s.combat.attack.speed, s.combat.action.speed);
  assert.equal(s.combat.attack.interruptEqual, true);
  s = go(s, "RESOLVE"); assert.equal(E.hunter(s).hp, 6); assert.equal(s.enemies[0].hp, 2);
});

test("whip dodge damages every enemy within one space and leaves distant enemies untouched", () => {
  let s = fixture("threaded-cane"); E.hunter(s).position = "tile-14:left"; s.enemies[0].node = "tile-14:left";
  extra(s, 2, "tile-14:center"); extra(s, 3, "tile-14:right");
  s = attack(s, 2);
  s = go(s, "DODGE", { cardId: E.hunter(s).hand.find((c) => c.kind === "endurance").id, slot: 0 });
  assert.equal(s.enemies.find((e) => e.figure === 1).hp, 3);
  assert.equal(s.enemies.find((e) => e.figure === 2).hp, 3);
  assert.equal(s.enemies.find((e) => e.figure === 3).hp, 4);
  s = go(s, "RESOLVE"); assert.equal(E.hunter(s).hp, 6);
});

test("axe regain heals the damage dealt and its long face can chain kill damage", () => {
  let regain = fixture("hunter-axe"); E.hunter(regain).hp = 5;
  regain = attack(regain, 2); regain = go(regain, "RESOLVE");
  assert.equal(regain.enemies[0].hp, 1); assert.equal(E.hunter(regain).hp, 6);
  let chain = fixture("hunter-axe", 1); extra(chain, 2, "tile-14:left", 2); extra(chain, 3, "tile-14:right", 2);
  chain = attack(chain, 1); chain = go(chain, "RESOLVE");
  assert.equal(chain.phase, "weapon_choice");
  chain = go(chain, "WEAPON_CHOICE", { enemyId: "huntsman-mob-2" });
  assert.equal(chain.enemies.length, 0); assert.equal(chain.kills, 3); assert.equal(E.hunter(chain).echoes, 3);
  assert.equal(chain.phase, "hunter");
});

test("rifle spear entry spends a face-down card without applying its draw or clear effects", () => {
  for (const kind of ["vitality", "endurance"]) {
    let s = fixture("rifle-spear", 0, [kind, "strength", "skill"]); s.enemies[0].node = "tile-14:left";
    s = go(s, "END_TURN"); assert.equal(s.phase, "weapon_entry"); assert.equal(s.enemyDiscard.length, 0);
    const before = E.hunter(s).hand.length;
    s = go(s, "ENTRY_WEAPON", { accept: true, cardId: E.hunter(s).hand.find((c) => c.kind === kind).id, slot: 0 });
    assert.equal(E.hunter(s).hand.length, before - 1);
    assert.equal(E.hunter(s).slots[0].kind, kind); assert.equal(E.hunter(s).slots[0].faceDown, true);
    assert.equal(s.enemies[0].hp, 2); assert.equal(s.enemyDiscard.length, 0);
    E.assertState(JSON.parse(JSON.stringify(s)));
  }
});

test("rifle spear bonus counts two move actions and resets at the next round", () => {
  let s = fixture("rifle-spear", 1); s.enemies = [];
  s = go(s, "MOVE", { cardId: E.hunter(s).hand[0].id }); s = go(s, "STEP", { node: "tile-14:left" }); s = go(s, "STOP_MOVE");
  s = go(s, "MOVE", { cardId: E.hunter(s).hand[0].id }); s = go(s, "STEP", { node: "tile-14:center" }); s = go(s, "STOP_MOVE");
  assert.equal(E.hunter(s).moveActionsRound, 2);
  extra(s, 1); s = attack(s, 0, "vitality"); assert.equal(s.combat.attack.damage, 4);
  s = go(s, "RESOLVE"); assert.equal(s.enemies.length, 0);
  s = go(s, "END_TURN"); assert.equal(E.hunter(s).moveActionsRound, 0);
});

test("tonitrus transform charges only the next attack of this round", () => {
  let s = fixture("tonitrus", 0, ["vitality", "endurance", "strength"]); s.enemies = [];
  s = go(s, "TRANSFORM", { cardId: E.hunter(s).hand.find((c) => c.kind === "vitality").id });
  assert.deepEqual(E.hunter(s).weaponCharge, { round: 1, speed: 1, damage: 1 }); extra(s, 1);
  s = attack(s, 0, "endurance"); assert.equal(s.combat.attack.speed, 3); assert.equal(s.combat.attack.damage, 3);
  assert.equal(E.hunter(s).weaponCharge, undefined);
  s = go(s, "RESOLVE"); basic(s); s = attack(s, 0, "strength");
  assert.equal(s.combat.attack.speed, 2); assert.equal(s.combat.attack.damage, 3);
});

test("holy-blade slot clearing pauses for target choice before the enemy card is revealed", () => {
  let s = fixture("ludwigs-holy-blade", 1); extra(s, 2);
  s = attack(s, 0, "endurance"); assert.equal(s.phase, "weapon_choice");
  assert.equal(s.enemyDiscard.length, 0); assert.equal(s.combat.action, null);
  assert.equal(E.hunter(s).slots[0], null);
  E.assertState(JSON.parse(JSON.stringify(s)));
  s = go(s, "WEAPON_CHOICE", { enemyId: "huntsman-mob-2" });
  assert.equal(s.enemies[1].hp, 3); assert.equal(s.phase, "combat_react"); assert.equal(s.enemyDiscard.length, 1);
});

test("holy-blade named combo can transform freely to its three-slot opposite face", () => {
  let s = fixture("ludwigs-holy-blade", 0, ["skill", "endurance", "vitality"]);
  s = attack(s, 0, "skill"); s = go(s, "RESOLVE"); assert.equal(s.phase, "free_transform");
  const cards = E.hunter(s).hand.length;
  s = go(s, "FREE_TRANSFORM", { accept: true });
  assert.equal(E.hunter(s).face, 1); assert.equal(E.hunter(s).slots.length, 3);
  assert.equal(E.hunter(s).hand.length, cards); assert.equal(s.phase, "hunter");
});

test("wheel self-damage pays once and invalid choices roll back the whole declaration", () => {
  let s = fixture("logarius-wheel", 1), before = structuredClone(s);
  assert.throws(() => attack(s, 0, "strength", { weaponBoost: 3 })); assert.deepEqual(s, before);
  s = attack(s, 0, "strength", { weaponBoost: 2 });
  assert.equal(E.hunter(s).hp, 4); assert.equal(s.combat.attack.damage, 5);
  assert.equal(s.enemyDiscard.length, 1);
});

test("stake explosion splashes two damage and preserves its optional pushes in serialized state", () => {
  let s = fixture("stake-driver", 1, ["skill", "endurance", "vitality"]); extra(s, 2); extra(s, 3, "tile-14:left");
  s = attack(s, 0, "skill"); assert.deepEqual(s.combat.attack.splash, { range: 1, damage: 2 });
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.find((e) => e.figure === 2).hp, 2); assert.equal(s.enemies.find((e) => e.figure === 3).hp, 2);
  assert.equal(s.phase, "weapon_choice"); E.assertState(JSON.parse(JSON.stringify(s)));
  const step = E.weaponChoices(s).find((c) => c.command.node);
  assert(step); const movingId = s.weaponEffects[0].enemyId;
  s = E.dispatch(s, step.command);
  assert(E.distance(s, E.hunter(s).position, s.enemies.find((e) => e.id === movingId).node) >= 1);
  s = settlePushes(s); assert.equal(s.phase, "hunter");
});

test("chikage dodge heals and deals chosen same-space damage", () => {
  let s = fixture("chikage", 1); E.hunter(s).hp = 4; extra(s, 2);
  s = attack(s, 1); s = go(s, "DODGE", { cardId: E.hunter(s).hand.find((c) => c.kind === "endurance").id, slot: 0 });
  assert.equal(E.hunter(s).hp, 5); assert.equal(s.phase, "weapon_choice");
  s = go(s, "WEAPON_CHOICE", { enemyId: "huntsman-mob-2" });
  assert.equal(s.enemies[1].hp, 3); s = go(s, "RESOLVE"); assert.equal(E.hunter(s).hp, 5);
});

test("beast claw kill heals and grants movement without counting it as a move action", () => {
  let s = fixture("beast-claw", 1); E.hunter(s).hp = 2; s.enemies[0].hp = 2;
  s = attack(s, 0); s = go(s, "RESOLVE");
  assert.equal(s.phase, "move"); assert.equal(s.move.remaining, 2); assert.equal(s.move.source, "weapon");
  assert.equal(E.hunter(s).hp, 4); assert.equal(E.hunter(s).moveActionsRound || 0, 0);
  s = go(s, "STEP", { node: "tile-14:left" }); s = go(s, "STOP_MOVE");
  assert.equal(s.phase, "hunter"); assert.equal(E.hunter(s).moveActionsRound || 0, 0);
});

test("reiterpallasch face-down quicksilver shot leaves stat effects dormant and reveals no enemy action", () => {
  let s = fixture("reiterpallasch", 1), before = E.hunter(s).hand.length;
  const cardId = E.hunter(s).hand.find((c) => c.kind === "vitality").id;
  s = go(s, "WEAPON_SHOT", { cardId, slot: 1, enemyId: s.enemies[0].id });
  assert.equal(E.hunter(s).hand.length, before - 1); assert.equal(s.enemies[0].hp, 2);
  assert.equal(E.hunter(s).slots[1].faceDown, true); assert.equal(s.enemyDiscard.length, 0);
  assert.equal(s.combat, null); assert.equal(s.phase, "hunter");
});

test("a natural holy-blade practice attack replays its slot-clear effect exactly from saved commands", () => {
  let s;
  for (let seed = 1; seed < 100; seed++) {
    const candidate = E.create(seed, "ludwigs-holy-blade", 1, null, "hunter-pistol", "center",
      { campaign: false, rulesVersion: 10, practiceTarget: "church-giant", practiceSide: "a" });
    if (E.hunter(candidate).hand.some((c) => c.kind === "endurance")) { s = candidate; break; }
  }
  assert(s); const cardId = E.hunter(s).hand.find((c) => c.kind === "endurance").id;
  s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId, slot: 0 });
  assert.equal(s.commands.length, 1); assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
