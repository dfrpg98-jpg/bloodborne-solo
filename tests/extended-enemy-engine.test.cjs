const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js");
const catalog = require("../src/extended-enemies.js");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function roundtrip(s) { assert.deepEqual(E.importSave(E.exportSave(s)), s); }
function createCase(id, side, kind, stat = "vitality", opts = {}) {
  for (let seed = 1; seed <= 200; seed++) {
    const s = E.create(seed, opts.weapon || "burial", opts.face || 0, null, "hunter-pistol", "center",
      { campaign: false, rulesVersion: 10, practiceTarget: id, practiceSide: side });
    if (s.enemyDeck[0] === kind && E.hunter(s).hand.some((card) => card.kind === stat) &&
      (!opts.needsDodge || E.hunter(s).hand.some((card) => card.kind === "endurance"))) return s;
  }
  throw new Error(`No natural seed for ${id}/${side}/${kind}/${stat}`);
}
function continueCombat(s) {
  for (let steps = 0; steps < 40; steps++) {
    roundtrip(s);
    if (["hunter", "refill", "upgrade_pick", "return", "over"].includes(s.phase)) return s;
    if (s.phase === "combat_react" || s.phase === "boss_react") s = go(s, "RESOLVE");
    else if (s.phase === "combat_choose") s = go(s, "NO_ATTACK");
    else if (s.phase === "boss_move") s = go(s, "BOSS_STEP", { node: E.bossMoveOptions(s)[0] });
    else if (s.phase === "stun") s = go(s, "STUN_DISCARD", { cardId: E.hunter(s).hand[0].id });
    else if (s.phase === "enemy_path") s = go(s, "ENEMY_STEP", { node: E.moveOptions(s)[0] });
    else throw new Error(`Uncovered phase ${s.phase}`);
  }
  throw new Error("Extended combat did not finish after 40 public commands");
}

test("every supplied new enemy face reveals all three shared card kinds and replays each decision exactly", async (t) => {
  for (const id of [...catalog.generalIds, ...catalog.npcIds]) {
    const sides = catalog.generalIds.includes(id) ? ["a", "b"] : ["1-2"];
    for (const side of sides) for (const kind of ["basic", "special", "ability"]) {
      await t.test(`${id} ${side} ${kind}`, () => {
        let s = createCase(id, side, kind);
        roundtrip(s);
        const e = s.enemies[0], hunter = E.hunter(s), stat = hunter.hand.find((card) => card.kind === "vitality");
        assert.equal(E.enemyDef(s, e).sideId, side);
        s = go(s, "ATTACK", { enemyId: e.id, cardId: stat.id, slot: 0 });
        assert.equal(s.enemyDiscard[0], kind);
        roundtrip(s);
        s = continueCombat(s);
        E.assertState(s); roundtrip(s);
      });
    }
  }
});

test("public NO_ATTACK still resolves church servant barrage after combat and allows armor dodge", () => {
  let s = createCase("church-servant", "b", "ability", "endurance");
  s = go(s, "END_TURN");
  if (s.phase === "activation") s = go(s, "ACTIVATE", { enemyId: s.enemies[0].id });
  assert.equal(s.phase, "combat_choose");
  s = go(s, "NO_ATTACK"); assert.equal(s.phase, "boss_react");
  assert.equal(s.combat.immediate.dodgeBlockPerSpeed, 2);
  roundtrip(s);
  const dodge = E.hunter(s).hand.find((card) => card.kind === "endurance");
  s = go(s, "DODGE", { cardId: dodge.id, slot: 1 });
  s = go(s, "RESOLVE");
  assert.equal(E.hunter(s).hp, 5);
  roundtrip(s);
});

test("a slain male patient keeps its unavoidable death echo and poison in save replay", () => {
  let s = createCase("male-beast-patient", "b", "special", "strength");
  const card = E.hunter(s).hand.find((x) => x.kind === "strength");
  s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: card.id, slot: 1 });
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.length, 0); assert.equal(s.phase, "boss_react");
  assert.equal(s.combat.immediate.name, "죽음의 메아리");
  assert.equal(s.combat.immediate.unavoidable, true);
  roundtrip(s);
  const dodge = E.hunter(s).hand.find((x) => E.card(x).dodge);
  if (dodge) assert.equal(E.canDodge(s, dodge.id, 0), false);
  s = go(s, "RESOLVE");
  assert.equal(E.hunter(s).hp, 2); assert.equal(E.hunter(s).status.poison, true);
  roundtrip(s);
});

test("bloodlicker activation leap repeats movement and offers a fresh counterattack after returning", () => {
  let s = createCase("bloodlicker-starved", "a", "ability");
  s = go(s, "END_TURN");
  if (s.phase === "activation") s = go(s, "ACTIVATE", { enemyId: s.enemies[0].id });
  s = go(s, "NO_ATTACK");
  if (s.phase === "combat_react") s = go(s, "RESOLVE");
  assert.equal(s.phase, "boss_move"); roundtrip(s);
  s = go(s, "BOSS_STEP", { node: E.bossMoveOptions(s)[0] });
  assert.equal(s.enemies[0].node, E.hunter(s).position);
  assert.equal(s.phase, "combat_choose");
  assert.equal(s.combat.extendedReactivation, true);
  roundtrip(s);
  s = go(s, "NO_ATTACK");
  s = continueCombat(s);
  assert.equal(s.enemyDiscard.length, 2);
  roundtrip(s);
});

test("a slain church servant's barrage still deals its remaining damage after a speed-one armor dodge", () => {
  let s = createCase("church-servant", "b", "ability", "strength",
    { weapon: "kirkhammer", face: 1, needsDodge: true });
  const card = E.hunter(s).hand.find((x) => x.kind === "strength");
  s = go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: card.id, slot: 0 });
  assert.equal(s.enemies.length, 0); assert.equal(s.phase, "boss_react");
  roundtrip(s);
  const dodge = E.hunter(s).hand.find((x) => x.kind === "endurance");
  s = go(s, "DODGE", { cardId: dodge.id, slot: 1 });
  assert.equal(s.phase, "boss_react");
  s = go(s, "RESOLVE");
  assert.equal(E.hunter(s).hp, 3);
  roundtrip(s);
});
