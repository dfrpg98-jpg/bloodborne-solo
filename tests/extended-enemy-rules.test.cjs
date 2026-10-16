const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const catalog = require("../src/extended-enemies.js");
const rules = require("../src/extended-enemy-rules.js");
const copy = (x) => JSON.parse(JSON.stringify(x));

function fixture(id, side = "a", kind = "special", opts = {}) {
  const definition = catalog.definition(id, { side });
  const enemy = { id: "subject", kind: "huntsman-mob", extendedId: id,
    extendedSide: definition.sideId, node: "here", hp: definition.maxHp, ...opts.enemy };
  const combat = { enemyId: enemy.id, origin: "hunter", action: copy(definition[kind]),
    attack: { speed: 2, damage: 4, interrupt: false }, pending: [], buff: { speed: 0, damage: 0, interrupt: false },
    immune: [], cancelHunter: false, cancelEnemy: false, dodged: false, ...opts.combat };
  const hunter = { position: "here", hp: 6, status: { poison: false, frenzy: false }, echoes: 0, ...opts.hunter };
  const s = { setup: { rulesVersion: 10 }, phase: "combat_react", combat,
    activeHunterId: "h", hunters: { h: hunter }, enemies: [enemy], events: [], spawnQueue: [] };
  const calls = [];
  const h = { hunter: (state) => state.hunters.h, enemy: (state, id) => state.enemies.find((x) => x.id === id),
    enemyDef: (state, e) => catalog.definition(e.extendedId, { side: e.extendedSide }),
    log: (state, text) => state.events.push(text),
    resolve: () => calls.push("resolve"), reveal: () => calls.push("reveal"),
    startImmediate: (state, reaction) => { state.combat.immediate = reaction; state.phase = "boss_react"; },
    startBossMove: (state, actor, amount) => calls.push({ move: actor, amount }),
    spawnNormal: (state, kind, node, extra) => state.spawnQueue.push({ kind, node, ...extra }),
    finishSpawns: () => calls.push("finishSpawns") };
  return { s, c: combat, e: enemy, hunter, h, calls, definition };
}

test("extended source browser mirror and independent Node import agree", () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../components/extended-enemies.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/extended-enemies.js"), "utf8"), sandbox);
  assert.deepEqual(copy(sandbox.BBExtendedEnemies.source), catalog.source);
  assert.equal(catalog.generalIds.length, 3);
  assert.equal(catalog.npcIds.length, 9);
  assert.equal(catalog.definition("missing"), null);
});

test("enemy count sides use supplied health and do not become boss phases", () => {
  assert.equal(catalog.definition("cainhurst-knight-servant").maxHp, 7);
  assert.equal(catalog.definition("cainhurst-knight-servant", { hunterCount: 3 }).maxHp, 13);
  assert.equal(catalog.definition("bloodlicker-starved").maxHp, 8);
  assert.equal(catalog.definition("bloodlicker-starved", { hunterCount: 4 }).maxHp, 15);
  assert.equal(catalog.definition("eileen", { side: "b" }).sideId, "1-2");
  assert.equal(catalog.definition("church-servant", { side: "b" }).special.frenzy, true);
  assert.throws(() => catalog.definition("church-servant", { side: "3+" }), /A면/);
  assert.throws(() => catalog.definition("henryk", { hunterCount: 0 }), /1~4/);
});

test("catalog consumers cannot modify another definition or original transcript", () => {
  const d = catalog.definition("church-servant"); d.special.damage = 99; d.source.sha256 = "bad";
  assert.equal(catalog.definition("church-servant").special.damage, 3);
  assert.match(catalog.definition("church-servant").source.sha256, /^[a-f0-9]{64}$/);
});

test("rules version 9 cannot activate new enemy hooks", () => {
  const f = fixture("blood-knight", "a", "ability"); f.s.setup.rulesVersion = 9;
  const before = copy(f.s);
  assert.equal(rules.onReveal(f.s, f.c, f.e, f.h), false);
  assert.deepEqual(f.s, before);
});

test("horrifying illusion grants Frenzy then queues another shared card", () => {
  const f = fixture("church-servant", "a", "ability");
  assert.equal(rules.onReveal(f.s, f.c, f.e, f.h), true);
  assert.equal(f.hunter.status.frenzy, true);
  assert.deepEqual(f.c.pending, [{ type: "next_enemy_card" }]);
  assert.deepEqual(f.calls, ["resolve"]);
});

test("horrifying illusion replaces existing Frenzy with Stun before reveal and respects immunity", () => {
  const f = fixture("church-servant", "a", "ability"); f.hunter.status.frenzy = true;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.deepEqual(f.c.pending, [{ type: "stun" }, { type: "next_enemy_card" }]);
  const g = fixture("church-servant", "a", "ability"); g.c.immune = ["frenzy"];
  rules.onReveal(g.s, g.c, g.e, g.h); assert.equal(g.hunter.status.frenzy, false);
});

test("arcane barrage waits for hunter attack and reduces damage per dodge speed", () => {
  const f = fixture("church-servant", "b", "ability");
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.pending.length, 0);
  rules.afterHunterAttack(f.s, f.c, f.e, 0, f.h);
  assert.deepEqual(f.c.pending[0], { type: "immediate", reaction: { name: "비전 탄막", damage: 5,
    dodgeSpeed: 0, dodgeBlockPerSpeed: 2 } });
  f.c.immediate = f.c.pending.shift().reaction;
  rules.onDodge(f.s, { speed: 1 }, f.h);
  assert.equal(f.c.immediate.dodgeBlock, 2);
  assert.equal(Math.max(0, f.c.immediate.damage - f.c.immediate.dodgeBlock), 3);
  rules.onDodge(f.s, { speed: 3 }, f.h);
  assert.equal(Math.max(0, f.c.immediate.damage - f.c.immediate.dodgeBlock), 0);
  rules.afterHunterAttack(f.s, f.c, f.e, 4, f.h); assert.equal(f.c.pending.length, 0);
});

test("arcane barrage occurs when hunter passes and remains dodgeable after its source dies", () => {
  const f = fixture("church-servant", "b", "ability"); f.c.attack = null;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(rules.afterAllAttacks(f.s, f.c, f.e, f.h), true);
  f.c.immediate = f.c.pending.shift().reaction; f.s.enemies = [];
  rules.onDodge(f.s, { speed: 2 }, f.h);
  assert.equal(f.c.immediate.dodgeBlock, 4);
});

test("unholy mark conditional damage stacks separately with general Frenzy damage", () => {
  const f = fixture("church-servant", "b"); f.hunter.status.frenzy = true;
  rules.beforeAttackGroup(f.s, f.c, f.e, { enemyTiming: true, ea: true, shared: true }, f.h);
  assert.equal(f.c.action.damage, 4);
  rules.beforeAttackGroup(f.s, f.c, f.e, { enemyTiming: true, ea: true, shared: true }, f.h);
  assert.equal(f.c.action.damage, 4);
});

test("blood toxin reduction happens before equal-speed damage and replaces poison with stun", () => {
  const f = fixture("male-beast-patient"); f.hunter.status.poison = true;
  rules.beforeAttackGroup(f.s, f.c, f.e, { enemyTiming: true, ea: true, shared: true, ha: true }, f.h);
  assert.equal(f.c.attack.damage, 2); assert.equal(f.c.action.poison, false); assert.equal(f.c.action.stun, true);
});

test("blood toxin cannot penalize a dodged, interrupted or already resolved hunter attack", () => {
  for (const state of [{ ea: false, shared: true }, { ea: true, shared: false }]) {
    const f = fixture("male-beast-patient"); f.hunter.status.poison = true;
    rules.beforeAttackGroup(f.s, f.c, f.e, { enemyTiming: true, ...state }, f.h);
    assert.equal(f.c.attack.damage, 4); assert.equal(f.c.action.stun, false);
  }
  const f = fixture("male-beast-patient"); f.hunter.status.poison = true; f.c.attackResolved = true;
  rules.beforeAttackGroup(f.s, f.c, f.e, { enemyTiming: true, ea: true, shared: true }, f.h);
  assert.equal(f.c.attack.damage, 4); assert.equal(f.c.action.stun, true);
});

test("male pack preserves actual enemy and chosen chapter face when spawning", () => {
  const f = fixture("male-beast-patient", "b", "ability");
  assert.equal(rules.resolveTimed(f.s, f.c, f.e, f.h), true);
  assert.deepEqual(f.s.spawnQueue, [{ kind: "huntsman-mob", node: "here",
    extendedId: "male-beast-patient", extendedSide: "b" }]);
  assert.deepEqual(f.s.spawnAfter, { type: "combat" });
});

test("death echo triggers at killing even if enemy attack never happened, and cancels on interrupt", () => {
  const f = fixture("male-beast-patient", "b"); f.e.hp = 0;
  rules.beforeKill(f.s, f.e, f.h); rules.beforeKill(f.s, f.e, f.h);
  assert.equal(f.c.pending.length, 1);
  assert.equal(f.c.pending[0].reaction.unavoidable, true);
  assert.equal(f.c.pending[0].reaction.poison, true);
  const g = fixture("male-beast-patient", "b"); g.e.hp = 0; g.c.cancelEnemy = true;
  rules.beforeKill(g.s, g.e, g.h); assert.deepEqual(g.c.pending, []);
});

test("giant's white ability resolves hunter attack without making a new attack", () => {
  const f = fixture("church-giant", "a", "ability");
  assert.equal(rules.onReveal(f.s, f.c, f.e, f.h), true);
  assert.deepEqual(f.calls, ["resolve"]); assert.equal(f.c.action.type, "ability");
});

test("crow's count-specific wounded threshold and supplies use the correct side", () => {
  const f = fixture("bloody-crow-cainhurst", "a", "basic"); f.e.hp = 6;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.action.speed, 3); assert.equal(f.c.action.damage, 3);
  const g = fixture("bloody-crow-cainhurst", "a", "ability"); g.e.hp = 6;
  rules.onReveal(g.s, g.c, g.e, g.h); assert.equal(g.e.hp, 9);
  const printed = catalog.definition("bloody-crow-cainhurst", { hunterCount: 3 });
  assert.equal(printed.basic.woundThreshold, 10); assert.equal(printed.ability.heal, 4);
});

test("crow supply bone branch dodges hunter attack and chooses movement", () => {
  const f = fixture("bloody-crow-cainhurst", "a", "ability");
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.cancelHunter, true); assert.deepEqual(f.calls, [{ move: "enemy", amount: 1 }]);
});

test("Henryk poison knife, Eileen pistol, Alfred rifle and Djura shotgun offer exact immediate reactions", () => {
  const expected = {
    henryk: { damage: 1, dodgeSpeed: 3, poison: true },
    eileen: { damage: 0, dodgeSpeed: 3, interruptHunter: true },
    alfred: { damage: 0, dodgeSpeed: 2, interruptHunter: true, stun: true },
    djura: { damage: 1, dodgeSpeed: 2, stun: true },
  };
  for (const [id, reaction] of Object.entries(expected)) {
    const f = fixture(id, "a", "ability"); rules.onReveal(f.s, f.c, f.e, f.h);
    assert.deepEqual(f.c.immediate, { name: f.c.action.name, ...reaction, revealNext: true });
    assert.equal(f.s.phase, "boss_react");
  }
});

test("Eileen compares attack speeds and also handles firearm attacks", () => {
  const f = fixture("eileen", "a", "basic"); rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.action.damage, 3);
  const g = fixture("eileen", "a", "basic"); g.c.attack = null; g.c.flame = { speed: 1, damage: 2 };
  rules.onReveal(g.s, g.c, g.e, g.h); assert.equal(g.c.action.damage, 4);
  const k = fixture("eileen", "a", "basic"); k.c.attack = null;
  rules.onReveal(k.s, k.c, k.e, k.h); assert.equal(k.c.action.damage, 2);
});

test("Djura's ally buffs the next revealed action before revealing it", () => {
  const f = fixture("djuras-ally", "a", "ability");
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.buff.speed, 1); assert.equal(f.c.buff.interrupt, true); assert.deepEqual(f.calls, ["reveal"]);
});

test("regain requires positive actual damage and cannot save a dead enemy", () => {
  const f = fixture("djuras-ally"); f.e.hp = 5;
  rules.afterEnemyAttack(f.s, f.c, f.e, f.h, 0); assert.equal(f.e.hp, 5);
  rules.afterEnemyAttack(f.s, f.c, f.e, f.h, 1); assert.equal(f.e.hp, 7);
  f.e.hp = 0; rules.afterEnemyAttack(f.s, f.c, f.e, f.h, 2); assert.equal(f.e.hp, 0);
});

test("combo followups queue after all attacks, and never after interruption or killing", () => {
  for (const id of ["bloody-crow-cainhurst", "alfred"]) {
    const f = fixture(id); rules.onReveal(f.s, f.c, f.e, f.h);
    assert.equal(f.c.pending.length, 0);
    assert.equal(rules.afterAllAttacks(f.s, f.c, f.e, f.h), true);
    assert.equal(f.c.pending[0].type, "extended_followup");
    assert.equal(f.c.pending[0].action.name, f.definition.basic.name);
    assert.equal(rules.afterAllAttacks(f.s, f.c, f.e, f.h), false);
    const g = fixture(id); g.c.cancelEnemy = true;
    assert.equal(rules.afterAllAttacks(g.s, g.c, g.e, g.h), false);
    g.c.cancelEnemy = false; g.e.hp = 0;
    assert.equal(rules.afterAllAttacks(g.s, g.c, g.e, g.h), false);
  }
});

test("Djura activation replaces basic with special stake shot while a hunter attack keeps basic", () => {
  const f = fixture("djura", "a", "basic"); f.c.origin = "activation";
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.action.kind, "special"); assert.equal(f.c.action.speed, 1); assert.equal(f.c.action.stun, true);
  const g = fixture("djura", "a", "basic"); rules.onReveal(g.s, g.c, g.e, g.h);
  assert.equal(g.c.action.kind, "basic"); assert.equal(g.c.action.speed, 2);
});

test("blood knight stores corruption separately, spends one on basic, and gains it only on hit", () => {
  const f = fixture("blood-knight", "a", "ability"); f.e.corruptionTokens = 2;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.e.corruptionTokens, 3); assert.equal(f.c.enemyDefense, 3);
  f.c.action = copy(f.definition.basic); rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.e.corruptionTokens, 2); assert.equal(f.c.action.speed, 3); assert.equal(f.c.action.damage, 3);
  f.c.action = copy(f.definition.special); rules.afterEnemyAttack(f.s, f.c, f.e, f.h, 0);
  assert.equal(f.e.corruptionTokens, 2); rules.afterEnemyAttack(f.s, f.c, f.e, f.h, 1);
  assert.equal(f.e.corruptionTokens, 3);
});

test("rapier is undodgeable and blocks only hunter attacks with effective speed 1 or 2", () => {
  const f = fixture("cainhurst-knight-servant", "a", "basic");
  assert.equal(f.c.action.undodgeable, true);
  assert.equal(rules.beforeEnemyDamage(f.s, f.e, 4, { kind: "hunter-attack" }, f.h), 3);
  f.c.attack.speed = 3;
  assert.equal(rules.beforeEnemyDamage(f.s, f.e, 4, { kind: "hunter-attack" }, f.h), 4);
  f.c.flame = { speed: 2, damage: 2 };
  assert.equal(rules.beforeEnemyDamage(f.s, f.e, 2, { kind: "firearm-attack" }, f.h), 1);
  assert.equal(rules.beforeEnemyDamage(f.s, f.e, 1, { kind: "splash" }, f.h), 1);
});

test("white parry explicit exception allows a declared interrupting attack; otherwise reflects its damage", () => {
  const f = fixture("cainhurst-knight-servant", "a", "ability"); f.c.attack.interrupt = true;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.cancelEnemy, true); assert.equal(f.c.cancelHunter, false); assert.equal(f.c.immediate, undefined);
  const g = fixture("cainhurst-knight-servant", "a", "ability");
  rules.onReveal(g.s, g.c, g.e, g.h);
  assert.equal(g.c.immediate.damage, 4); assert.equal(g.c.immediate.interruptHunter, true);
  assert.equal(g.c.immediate.unavoidable, true);
});

test("bloodlicker gets speed and damage from echoes and reactivates only once after activation leap", () => {
  const f = fixture("bloodlicker-starved", "a", "basic"); f.hunter.echoes = 3;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.c.action.speed, 4); assert.equal(f.c.action.damage, 5);
  const g = fixture("bloodlicker-starved", "a", "ability"); g.c.origin = "activation";
  rules.resolveTimed(g.s, g.c, g.e, g.h);
  assert.deepEqual(g.calls, [{ move: "enemy", amount: 1 }]);
  assert.equal(rules.afterAllAttacks(g.s, g.c, g.e, g.h), true);
  assert.deepEqual(g.c.pending, [{ type: "extended_reactivate", enemyId: "subject", once: true }]);
  const k = fixture("bloodlicker-starved", "a", "ability"); k.c.origin = "activation"; k.c.extendedReactivation = true;
  rules.resolveTimed(k.s, k.c, k.e, k.h);
  assert.equal(rules.afterAllAttacks(k.s, k.c, k.e, k.h), false);
});

test("Numbing Mist suppresses extended attack effects but does not remove white abilities", () => {
  const f = fixture("blood-knight", "a", "basic"); f.e.corruptionTokens = 1; f.c.removeEnemyAttackEffects = true;
  rules.onReveal(f.s, f.c, f.e, f.h);
  assert.equal(f.e.corruptionTokens, 1); assert.equal(f.c.action.speed, 2); assert.equal(f.c.action.code, undefined);
  const g = fixture("blood-knight", "a", "ability"); g.c.removeEnemyAttackEffects = true;
  rules.onReveal(g.s, g.c, g.e, g.h);
  assert.equal(g.e.corruptionTokens, 1); assert.equal(g.c.enemyDefense, 1);
});
