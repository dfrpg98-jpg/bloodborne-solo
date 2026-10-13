const test = require("node:test"), assert = require("node:assert/strict");
const R = require("../rewards-engine.js"), D = require("../hunt-data.js");
const H = (s) => s.hunters[s.activeHunterId];
function fixture() {
  const s = { activeHunterId: "hunter-1", phase: "hunter", uid: 12, rng: 42,
    events: [], hunters: { "hunter-1": { hp: 3, echoes: 2, inDream: false,
      position: "lamp-a", firearmId: "hunter-pistol", firearmReady: false,
      hand: [{ id: "hand-a", kind: "strength" }],
      discard: [{ id: "discard-a", kind: "skill" }],
      deck: [{ id: "deck-a", kind: "endurance" }], slots: [null, null, null] } } };
  R.init(s);
  return s;
}
const helpers = {
  log: (s, text) => s.events.push(text),
  draw: (s, n) => { for (let i = 0; i < n && H(s).deck.length; i++) H(s).hand.push(H(s).deck.shift()); },
  nodes: () => [{ id: "lamp-a", lamp: true }, { id: "lamp-b", lamp: true }, { id: "street", lamp: false }],
  teleport: (s, node) => { H(s).position = node; s.teleportCalled = true; },
};
const dispatch = (s, type, args = {}) => R.dispatch(s, { type, ...args }, helpers);
const grant = (s, kind) => R.grant(s, kind, helpers);
const item = (s, id) => H(s).rewards.find((r) => r.id === id);
function acquireShard(s, slot = 0) {
  const id = grant(s, "bloodstone-shard");
  dispatch(s, "EQUIP_REWARD", { rewardId: id, slot });
  return id;
}
test("campaign reward catalogue uses the supplied effects and confirmed shard exception", () => {
  assert.equal(Object.keys(R.definitions).length, 16);
  assert.equal(R.definitions["rune-clawmark"].rules,
    D.components.cards.find((r) => r.id === "rune-clawmark").rules);
  assert.equal(R.definitions["bloodstone-shard"].subtype, "tool");
  assert.equal(R.definitions["bloodstone-shard"].persistent, true);
});
test("reward grants are deterministic, independent from stat cards, and retained at limits", () => {
  const a = fixture(), b = fixture();
  for (const s of [a, b]) {
    acquireShard(s, 1);
    grant(s, "lantern");
    grant(s, "rune-moon");
    grant(s, "rune-clawmark");
    const third = grant(s, "rune-rapture");
    assert.equal(s.rewardChoices.length, 1);
    assert.equal(item(s, third).equipped, false);
    assert.throws(() => dispatch(s, "MOVE"), /먼저/);
    dispatch(s, "KEEP_REWARD", { rewardId: third });
    const eye = grant(s, "rune-eye");
    dispatch(s, "EQUIP_REWARD", { rewardId: eye,
      replaceId: H(s).rewards.find((r) => r.kind === "rune-moon").id });
    assert.equal(H(s).rewards.length, 6);
    assert.equal(H(s).rewards.filter((r) => r.equipped).length, 4);
    assert.equal(H(s).hand.length, 1);
    assert.equal(s.rng, 42);
    R.assert(s);
  }
  assert.deepEqual(a, b);
});
test("limits apply separately to tools and runes; invalid replacement leaves equipment intact", () => {
  const s = fixture();
  const shard = acquireShard(s), lantern = grant(s, "lantern");
  const extra = grant(s, "bloodstone-shard");
  const moon = grant(s, "rune-moon");
  assert.throws(() => dispatch(s, "EQUIP_REWARD", { rewardId: extra, replaceId: moon, slot: 2 }), /같은 종류/);
  assert.equal(item(s, shard).equipped, true);
  assert.equal(item(s, extra).equipped, false);
  dispatch(s, "EQUIP_REWARD", { rewardId: extra, replaceId: lantern, slot: 2 });
  assert.equal(item(s, lantern).equipped, false);
  assert.equal(item(s, extra).slot, 2);
  R.assert(s);
});
test("shard requires initial slot choice, stays active, and moves only after transformation", () => {
  const s = fixture(), id = grant(s, "bloodstone-shard");
  assert.equal(s.rewardChoices[0].reason, "slot");
  assert.throws(() => dispatch(s, "EQUIP_REWARD", { rewardId: id }), /슬롯/);
  dispatch(s, "EQUIP_REWARD", { rewardId: id, slot: 1 });
  assert.equal(R.attackBonus(s, 1).damage, 1);
  assert.equal(R.attackBonus(s, 0).damage, 0);
  assert.equal(item(s, id).ready, true);
  assert.throws(() => dispatch(s, "REASSIGN_REWARD", { rewardId: id, slot: 0 }), /변형한 직후/);
  R.onTransform(s);
  dispatch(s, "REASSIGN_REWARD", { rewardId: id, slot: 0 });
  assert.equal(R.attackBonus(s, 0).damage, 1);
  dispatch(s, "MOVE");
  assert.throws(() => dispatch(s, "REASSIGN_REWARD", { rewardId: id, slot: 2 }), /변형한 직후/);
  R.onDream(s, false, helpers);
  assert.equal(item(s, id).slot, 0);
  assert.equal(item(s, id).ready, true);
});
test("clawmark explicitly replaces all stat effects and adds shard damage without exhausting it", () => {
  const s = fixture(), shard = acquireShard(s, 2), rune = grant(s, "rune-clawmark");
  assert.equal(item(s, rune).ready, true);
  assert.deepEqual(R.attackBonus(s, 2, [rune], helpers),
    { speed: 0, damage: 2, interrupt: true, replaceCardEffects: true });
  assert.equal(item(s, rune).ready, false);
  assert.equal(item(s, shard).ready, true);
  assert.equal(H(s).hand.length, 1);
  assert.equal(H(s).hp, 3);
  assert.throws(() => R.attackBonus(s, 2, [rune], helpers), /준비된/);
  R.onDream(s, false, helpers);
  assert.equal(item(s, rune).ready, true);
});
test("attack reward validation rejects unavailable, duplicated, and wrong-timing rewards", () => {
  const s = fixture(), rune = grant(s, "rune-clawmark"), lantern = grant(s, "lantern");
  assert.throws(() => R.attackBonus(s, 0, [rune, rune]), /중복/);
  assert.throws(() => R.attackBonus(s, 0, [lantern]), /준비된/);
  assert.throws(() => R.attackBonus(s, 0, ["foreign"]), /준비된/);
  assert.equal(item(s, rune).ready, true);
  assert.throws(() => dispatch(s, "USE_REWARD", { rewardId: rune }), /발동 시점/);
});
test("lantern teleports through the engine helper and exhausts rather than discards", () => {
  const s = fixture(), id = grant(s, "lantern");
  assert.throws(() => dispatch(s, "USE_REWARD", { rewardId: id, node: "street" }), /등불/);
  assert.equal(item(s, id).ready, true);
  dispatch(s, "USE_REWARD", { rewardId: id, node: "lamp-b" });
  assert.equal(H(s).position, "lamp-b");
  assert.equal(s.teleportCalled, true);
  assert.equal(item(s, id).ready, false);
  assert.equal(H(s).rewards.length, 1);
  R.onDream(s, false);
  assert.equal(item(s, id).ready, true);
});
test("eye exchanges chosen card instances and rejects invalid costs before mutation", () => {
  const s = fixture(), id = grant(s, "rune-eye"), before = JSON.stringify(H(s));
  assert.throws(() => dispatch(s, "USE_REWARD", { rewardId: id, discardId: "hand-a", takeId: "missing" }), /손패/);
  assert.equal(JSON.stringify(H(s)), before);
  dispatch(s, "USE_REWARD", { rewardId: id, discardId: "hand-a", takeId: "discard-a" });
  assert.deepEqual(H(s).hand, [{ id: "discard-a", kind: "skill" }]);
  assert.deepEqual(H(s).discard, [{ id: "hand-a", kind: "strength" }]);
  assert.equal(item(s, id).ready, false);
});
test("rapture remains optional, is usable only directly after a living kill, and expires", () => {
  const s = fixture(), id = grant(s, "rune-rapture");
  assert.throws(() => dispatch(s, "USE_REWARD", { rewardId: id }), /처치한 직후/);
  R.onKill(s, helpers);
  assert.equal(item(s, id).ready, true);
  assert.equal(R.view(s).rewards[0].usable, true);
  dispatch(s, "USE_REWARD", { rewardId: id });
  assert.equal(H(s).hp, 4);
  assert.equal(H(s).hand.length, 2);
  assert.equal(item(s, id).ready, false);
  R.onDream(s, false);
  R.onKill(s);
  dispatch(s, "MOVE");
  assert.throws(() => dispatch(s, "USE_REWARD", { rewardId: id }), /처치한 직후/);
  H(s).hp = 0;
  R.onKill(s);
  assert.equal(H(s).rewardKillWindow, false);
});
test("moon preserves exactly one death echo only after the user's explicit selection", () => {
  const s = fixture(), id = grant(s, "rune-moon");
  assert.equal(R.onDream(s, true, helpers), 0);
  dispatch(s, "SET_REWARD_TRIGGER", { rewardId: id, enabled: true });
  assert.equal(R.onDream(s, true, helpers), 1);
  assert.equal(item(s, id).ready, true);
  assert.equal(item(s, id).triggerArmed, false);
  assert.equal(R.onDream(s, true, helpers), 0);
  dispatch(s, "SET_REWARD_TRIGGER", { rewardId: id, enabled: true });
  H(s).echoes = 0;
  assert.equal(R.onDream(s, true, helpers), 0);
  assert.equal(item(s, id).ready, true);
  assert.equal(item(s, id).triggerArmed, false);
});
test("mandatory equipment choices caused by the same kill preserve the optional rapture window", () => {
  const s = fixture(), rapture = grant(s, "rune-rapture");
  R.onKill(s);
  grant(s, "ludwig-rifle");
  dispatch(s, "KEEP_FIREARM", { firearmId: "ludwig-rifle" });
  assert.equal(H(s).rewardKillWindow, true);
  dispatch(s, "USE_REWARD", { rewardId: rapture });
  assert.equal(item(s, rapture).ready, false);
});
test("Ludwig rifle is retained alongside the original firearm with an explicit equipment choice", () => {
  const s = fixture();
  grant(s, "ludwig-rifle");
  assert.deepEqual(H(s).ownedFirearms, ["hunter-pistol", "ludwig-rifle"]);
  assert.equal(H(s).firearmId, "hunter-pistol");
  assert.throws(() => dispatch(s, "ATTACK"), /먼저/);
  dispatch(s, "KEEP_FIREARM", { firearmId: "ludwig-rifle" });
  assert.throws(() => dispatch(s, "EQUIP_FIREARM", { firearmId: "ludwig-rifle" }), /챕터 사이/);
  s.phase = "chapter_complete";
  dispatch(s, "EQUIP_FIREARM", { firearmId: "ludwig-rifle" });
  assert.equal(H(s).firearmId, "ludwig-rifle");
  assert.equal(H(s).firearmReady, true);
  assert.equal(R.view(s).firearms.find((f) => f.id === "ludwig-rifle").temporary, true);
  dispatch(s, "EQUIP_FIREARM", { firearmId: "hunter-pistol" });
  assert.equal(H(s).ownedFirearms.length, 2);
  R.assert(s);
});
test("bone ash readiness restores only an exhausted equipped reward; supply and state remain serializable", () => {
  const s = fixture(), id = grant(s, "lantern");
  assert.throws(() => R.ready(s, id), /소진된/);
  dispatch(s, "USE_REWARD", { rewardId: id, node: "lamp-b" });
  R.ready(s, id, helpers);
  assert.equal(item(s, id).ready, true);
  const shard = acquireShard(s);
  assert.throws(() => R.ready(s, shard), /소진된/);
  R.assert(JSON.parse(JSON.stringify(s)));
  grant(s, "rune-moon");
  assert.throws(() => grant(s, "rune-moon"), /공급/);
});
test("browser global exports the same module without a Node require", () => {
  const fs = require("node:fs"), vm = require("node:vm");
  const context = { BBHuntData: D };
  vm.runInNewContext(fs.readFileSync(require.resolve("../rewards-engine.js"), "utf8"), context);
  assert.equal(typeof context.BBRewards.dispatch, "function");
  assert.equal(context.BBRewards.definitions["bloodstone-shard"].persistent, true);
});
function engineCombatFixture(kind = "strength", enemyHp = 4) {
  const E = require("../hunt-engine.js");
  const s = E.create(444, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
  const h = H(s), pool = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  let selected;
  const existing = pool.findIndex((c) => c.kind === kind);
  if (existing >= 0) selected = pool.splice(existing, 1)[0];
  else {
    s.removedCards.push(pool.shift().kind);
    const deckIndex = s.upgradeDeck.indexOf(kind);
    if (deckIndex >= 0) s.upgradeDeck.splice(deckIndex, 1);
    else {
      const marketIndex = s.market.indexOf(kind);
      assert(marketIndex >= 0);
      s.market[marketIndex] = s.upgradeDeck.shift() || null;
    }
    selected = { id: `card-${++s.uid}`, kind };
  }
  h.hand = [selected, ...pool.splice(0, 2)]; h.deck = pool; h.discard = []; h.slots = [null, null, null];
  h.hp = 3; h.status = { poison: true, frenzy: false };
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: h.position, hp: enemyHp }];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = [];
  return { E, s };
}
test("integrated clawmark replaces immediate draw, discard, status, heal, block, slot and attack effects before placement", () => {
  for (const kind of ["tenacious", "steadfast", "defensive", "energized", "nimble", "regain", "swift-transform"]) {
    let { E, s } = engineCombatFixture(kind);
    const rune = R.grant(s, "rune-clawmark"), cardId = H(s).hand[0].id;
    s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId, slot: 0, rewardIds: [rune] });
    assert.equal(s.phase, "combat_react", kind);
    assert.equal(H(s).hand.length, 2, kind);
    assert.equal(H(s).hp, 3, kind);
    assert.equal(H(s).status.poison, true, kind);
    assert.equal(H(s).slots[0].id, cardId, kind);
    assert.equal(s.combat.defense, 0, kind);
    assert.equal(s.combat.attack.speed, 3, kind);
    assert.equal(s.combat.attack.damage, 2, kind);
    assert.equal(s.combat.attack.interrupt, true, kind);
    assert.equal(s.combat.attack.afterAttackHeal, 0, kind);
    assert.equal(s.combat.attack.freeTransform, false, kind);
    assert.equal(item(s, rune).ready, false, kind);
  }
});
test("integrated kill opens optional rapture choice and simultaneous hunter death cannot heal", () => {
  let { E, s } = engineCombatFixture("strength", 2);
  const id = R.grant(s, "rune-rapture");
  s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId: H(s).hand[0].id, slot: 0 });
  s = E.dispatch(s, { type: "RESOLVE" });
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).rewardKillWindow, true);
  assert.equal(item(s, id).ready, true);
  const count = H(s).hand.length;
  s = E.dispatch(s, { type: "USE_REWARD", rewardId: id });
  assert.equal(H(s).hand.length, count + 1);
  assert.equal(H(s).hp, 4);
  assert.equal(item(s, id).ready, false);

  ({ E, s } = engineCombatFixture("strength", 3));
  const deadId = R.grant(s, "rune-rapture");
  H(s).hp = 1;
  s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId: H(s).hand[0].id, slot: 1 });
  assert.equal(s.combat.action.speed, s.combat.attack.speed);
  s = E.dispatch(s, { type: "RESOLVE" });
  assert.equal(H(s).inDream, true);
  assert.equal(H(s).rewardKillWindow, false);
  assert.equal(item(s, deadId).ready, true);
  assert.throws(() => E.dispatch(s, { type: "USE_REWARD", rewardId: deadId }), /처치한 직후/);
});
test("integrated moon transfers one selected echo into the death dream shop before loss", () => {
  for (const selected of [false, true]) {
    let { E, s } = engineCombatFixture("strength", 4);
    const id = R.grant(s, "rune-moon");
    H(s).hp = 1; H(s).echoes = 2;
    if (selected) s = E.dispatch(s, { type: "SET_REWARD_TRIGGER", rewardId: id, enabled: true });
    s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId: H(s).hand[0].id, slot: 1 });
    s = E.dispatch(s, { type: "RESOLVE" });
    assert.equal(H(s).inDream, true);
    assert.equal(H(s).echoes, 0);
    assert.equal(item(s, id).ready, true);
    assert.equal(item(s, id).triggerArmed, false);
    if (selected) {
      assert.equal(s.phase, "upgrade_pick");
      assert.equal(s.dream.credit, 1);
    } else assert.equal(s.phase, "refill");
  }
});
