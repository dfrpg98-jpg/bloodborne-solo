"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const G = require("../extended-firearms.js"), F = require("../firearms-engine.js");
function setup(id, phase = "hunter") {
  const s = { setup: { rulesVersion: 10 }, phase, round: 1, activeHunterId: "h",
    hunters: { h: { hp: 6, inDream: false, firearmReady: true, firearmId: id, position: "n", echoes: 2,
      hand: [{ id: "a" }, { id: "b" }], discard: [] } },
    enemies: [{ id: "e", hp: 4, node: "n", name: "검사용 적" }],
    events: [], calls: [] };
  const h = {
    hunter: (s) => s.hunters.h,
    firearm: (s) => G.firearm(s.hunters.h.firearmId),
    enemy: (s, id) => s.enemies.find((e) => e.id === id),
    enemyDef: (s, e) => ({ name: e.name, boss: !!e.bossDefinition }),
    pay: (s, id) => { const who = s.hunters.h, i = who.hand.findIndex((c) => c.id === id); who.discard.push(who.hand.splice(i, 1)[0]); },
    log: (s, text) => s.events.push(text),
    interruptCombat: (s) => { s.combat.cancelEnemy = true; },
    addFirearmAttack: (s, id, gun, boost) => s.calls.push({ type: "attack", id, gun, boost }),
    stripEnemyAttackEffects: (s, gun) => s.calls.push({ type: "strip", gun }),
    addBlunderbussEffect: (s, enemy, gun) => s.calls.push({ type: "push", id: enemy.id, gun }),
  };
  if (phase.startsWith("combat")) s.combat = { enemyId: "e", origin: "hunter", action: phase === "combat_react" ? { type: "attack", kind: "basic", speed: 2, damage: 2 } : null };
  return { s, h };
}

test("new firearm photos contain four new firearms and corroborate the three earlier effects", () => {
  assert.equal(G.source.photos.length, 4);
  assert.equal(Object.keys(G.firearms).length, 7);
  const expected = ["cannon", "evelyn", "rosmarinus", "hunter-blunderbuss", "flamesprayer", "ludwig-rifle", "repeating-pistol"];
  assert.deepEqual(Object.keys(G.firearms).sort(), expected.sort());
  for (const photo of G.source.photos) {
    assert.match(photo.sha256, /^[a-f0-9]{64}$/);
    assert(photo.bytes > 1000000);
    assert(Number.isFinite(Date.parse(photo.lastModified)));
  }
  assert.equal(G.source.photos.find((p) => p.filename === "20261011_230950.jpg").bytes, 5406072);
  const flame = G.firearm("flamesprayer");
  assert.equal(flame.speed, 2); assert.equal(flame.damage, 2);
  assert.equal(flame.interrupt, true); assert.equal(flame.splash, 1); assert.equal(flame.prepareCost, 2);
  const old = require("../components/supplied-components.json");
  assert.equal(old.photos.find((p) => p.filename === "20261011_230950.jpg").bytes, 5558976);
  assert.equal(old.firearms.find((g) => g.id === "flamesprayer").source.kind, "user-text");
});

test("cannon and the non-attack firearms preserve their actual triggers and preparation costs", () => {
  const cannon = G.firearm("cannon");
  assert.equal(cannon.speed, 1); assert.equal(cannon.damage, 3); assert.equal(cannon.interrupt, false);
  const ros = G.firearm("rosmarinus");
  assert.equal(ros.trigger, "enemy-attack"); assert.equal(ros.nonBossOnly, true); assert.equal(ros.speedPenalty, 1); assert.equal(ros.removeAttackEffects, true);
  const shotgun = G.firearm("hunter-blunderbuss");
  assert.equal(shotgun.trigger, "hunter-effect"); assert.equal(shotgun.damage, 1); assert.equal(shotgun.push, 1);
  for (const id of ["cannon", "rosmarinus", "hunter-blunderbuss"]) assert.equal(G.firearm(id).prepareCost, 2);
  assert.equal(G.firearm("evelyn").prepareCost, 1); assert.equal(G.firearm("evelyn").prepareEchoCost, 1);
  assert.equal(G.firearm("evelyn").source.faces[0].filename, "20261012_005542.jpg");
  assert.equal(G.firearm("evelyn").source.faces[0].side, "effect");
  assert.equal(G.firearm("evelyn").source.faces[1].filename, "20261012_005525.jpg");
});

test("firearm stock is recorded separately from starting firearms with exact user supplied counts", () => {
  assert.deepEqual(G.source.stockWithoutStartingFirearms, { evelyn: 3, cannon: 3, "repeating-pistol": 3, rosmarinus: 1, flamesprayer: 2, "ludwig-rifle": 1, "hunter-blunderbuss": 1 });
  assert.equal(G.source.stockSource.filename, "화기 관련 정보.txt");
  assert.match(G.source.stockSource.sha256, /^[a-f0-9]{64}$/);
});

test("extended firearms work offline and clone definitions independently", () => {
  const context = vm.createContext({});
  for (const file of ["../components/extended-firearms.js", "../extended-firearms.js"])
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, file), "utf8"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.BBExtendedFirearms.source)), G.source);
  assert.deepEqual(require("../components/extended-firearms.js"), G.source);
  const gun = G.firearm("cannon"); gun.damage = 99;
  assert.equal(G.firearm("cannon").damage, 3); assert.equal(G.firearm("missing"), null);
});

test("new firearms cannot change version-nine or provisional save behavior", () => {
  for (const id of ["cannon", "evelyn", "rosmarinus", "hunter-blunderbuss"]) {
    const { s, h } = setup(id); s.setup.rulesVersion = 9;
    assert.equal(F.enabled(s, h), false, id);
    s.setup.rulesVersion = 10; s.provisional = { target: true };
    assert.equal(F.enabled(s, h), false, id);
  }
});

test("cannon declares one independent attack and cannot join an attack already declared", () => {
  const { s, h } = setup("cannon");
  assert.equal(F.canUse(s, h), true);
  F.dispatch(s, { type: "FIREARM", enemyId: "e", weaponBoost: "speed" }, h);
  assert.equal(s.hunters.h.firearmReady, false);
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].type, "attack");
  assert.equal(s.calls[0].gun.interrupt, false);
  assert.equal(s.calls[0].boost, "speed");
  for (const phase of ["combat_react", "interaction"]) {
    const q = setup("cannon", phase);
    assert.equal(F.canUse(q.s, q.h), false);
  }
  const counter = setup("cannon", "combat_choose");
  assert.equal(F.canUse(counter.s, counter.h), true);
  counter.s.combat.origin = "interaction";
  assert.equal(F.canUse(counter.s, counter.h), false);
  counter.s.combat.origin = "hunter"; counter.s.combat.attack = {};
  assert.equal(F.canUse(counter.s, counter.h), false);
});

test("rosmarinus can remove uninterruptible special attack effects but excludes bosses and abilities", () => {
  const { s, h } = setup("rosmarinus", "combat_react");
  s.combat.action.kind = "special"; s.combat.action.uninterruptible = true;
  assert.equal(F.canUse(s, h), true);
  F.dispatch(s, { type: "FIREARM" }, h);
  assert.equal(s.hunters.h.firearmReady, false);
  assert.equal(s.calls[0].type, "strip");
  for (const marker of ["boss", "bossDecks", "bossDefinition"]) {
    const q = setup("rosmarinus", "combat_react"); q.s.enemies[0][marker] = true;
    assert.equal(F.canUse(q.s, q.h), false, marker);
  }
  const ability = setup("rosmarinus", "combat_react"); ability.s.combat.action.type = "ability";
  assert.equal(F.canUse(ability.s, ability.h), false);
});

test("shotgun is a hunter-turn effect against a non-boss in the same space", () => {
  const { s, h } = setup("hunter-blunderbuss");
  F.dispatch(s, { type: "FIREARM", enemyId: "e" }, h);
  assert.equal(s.calls[0].type, "push"); assert.equal(s.calls[0].id, "e");
  assert.equal(s.calls[0].gun.damage, 1); assert.equal(s.calls[0].gun.push, 1);
  assert.equal(s.combat, undefined);
  for (const change of [(s) => { s.enemies[0].node = "far"; }, (s) => { s.enemies[0].bossDefinition = true; }, (s) => { s.phase = "combat_choose"; }]) {
    const q = setup("hunter-blunderbuss"); change(q.s);
    assert.equal(F.canUse(q.s, q.h), false);
    const before = structuredClone(q.s);
    assert.throws(() => F.dispatch(q.s, { type: "FIREARM", enemyId: "e" }, q.h));
    assert.deepEqual(q.s, before);
  }
});

test("evelyn can prepare by one echo without discarding a card or prepare by exactly one card", () => {
  const { s, h } = setup("evelyn"); s.hunters.h.firearmReady = false;
  F.dispatch(s, { type: "RELOAD", payEcho: true, cardIds: [] }, h);
  assert.equal(s.hunters.h.echoes, 1); assert.equal(s.hunters.h.hand.length, 2);
  assert.equal(s.hunters.h.discard.length, 0); assert.equal(s.hunters.h.firearmReady, true);
  s.hunters.h.firearmReady = false;
  F.dispatch(s, { type: "RELOAD", cardIds: ["a"] }, h);
  assert.equal(s.hunters.h.echoes, 1); assert.equal(s.hunters.h.hand.length, 1);
  assert.equal(s.hunters.h.discard[0].id, "a");
});

test("invalid reload costs are rejected before paying echoes or any card", () => {
  for (const command of [{ type: "RELOAD", payEcho: true, cardIds: ["a"] }, { type: "RELOAD", cardIds: ["a", "b"] }, { type: "RELOAD", cardIds: ["missing"] }]) {
    const { s, h } = setup("evelyn"); s.hunters.h.firearmReady = false;
    const before = structuredClone(s);
    assert.throws(() => F.dispatch(s, command, h)); assert.deepEqual(s, before);
  }
  const q = setup("evelyn"); q.s.hunters.h.firearmReady = false; q.s.hunters.h.echoes = 0;
  const before = structuredClone(q.s);
  assert.throws(() => F.dispatch(q.s, { type: "RELOAD", payEcho: true }, q.h));
  assert.deepEqual(q.s, before);
  const cannon = setup("cannon"); cannon.s.hunters.h.firearmReady = false;
  assert.throws(() => F.dispatch(cannon.s, { type: "RELOAD", cardIds: ["a", "a"] }, cannon.h));
  assert.equal(cannon.s.hunters.h.hand.length, 2);
});

test("missing new integration callbacks are rejected before firearm exhaustion", () => {
  for (const [id, phase, helper] of [["cannon", "hunter", "addFirearmAttack"], ["rosmarinus", "combat_react", "stripEnemyAttackEffects"], ["hunter-blunderbuss", "hunter", "addBlunderbussEffect"]]) {
    const { s, h } = setup(id, phase); delete h[helper];
    const before = structuredClone(s);
    assert.throws(() => F.dispatch(s, { type: "FIREARM", enemyId: "e" }, h));
    assert.deepEqual(s, before, id);
  }
});
