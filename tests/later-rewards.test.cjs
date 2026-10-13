const test = require("node:test"), assert = require("node:assert/strict");
const R = require("../rewards-engine.js"), D = require("../hunt-data.js");
const kinds = ["beast-roar", "iosefka-vial", "messengers-gift", "rune-formless",
  "rune-writhe", "old-hunter-bone", "augur", "executioner-gloves", "rune-hunter", "empty-shell"];
const H = (s) => s.hunters[s.activeHunterId];
const clone = (s) => JSON.parse(JSON.stringify(s));
function fixture() {
  const s = { activeHunterId: "hunter-1", phase: "hunter", uid: 12, rng: 123,
    enemies: [], rewardChoices: [], events: [], hunters: { "hunter-1": {
      hp: 4, echoes: 0, inDream: false, position: "a", firearmId: "hunter-pistol",
      firearmReady: false, hand: [], deck: [], discard: [], slots: [null, null, null],
    } } };
  R.init(s); return s;
}
const positions = { a: 0, b: 1, c: 2, d: 3, fog: 2 };
const helpers = {
  log: (s, text) => s.events.push(text),
  nodes: () => Object.keys(positions).map((id) => ({ id, name: id, lamp: id === "a" })),
  enemyDef: (_s, e) => ({ name: e.id, boss: !!e.boss }),
  distance: (_s, a, b) => Math.abs(positions[a] - positions[b]),
  canDisplace: (s, e, node, range) => node in positions && node !== "fog" &&
    Math.abs(positions[e.node] - positions[node]) <= range,
  displacementDestinations: (s, e, range) => Object.keys(positions)
    .filter((node) => helpers.canDisplace(s, e, node, range)),
  displaceEnemy: (s, e, node) => { e.node = node; },
  skipNextActivation: (s) => { H(s).rewardSkipActivation = true; },
  autoDodge: (s) => { s.combat.dodged = true; },
  kill: (s, e) => {
    if (e.hp > 0) return;
    if (e.tokens) { e.tokens--; e.hp = 4; return; }
    s.enemies = s.enemies.filter((x) => x.id !== e.id);
    H(s).echoes = Math.min(3, H(s).echoes + 1);
    R.onKill(s);
  },
};
const grant = (s, kind) => R.grant(s, kind, helpers);
const item = (s, id) => H(s).rewards.find((r) => r.id === id);
// Match the production reducer's clone boundary so invalid choices roll back every zone.
function go(s, type, args = {}, h = helpers) {
  const next = clone(s);
  assert.equal(R.dispatch(next, { type, ...args }, h), true);
  R.assert(next); return next;
}
const enemy = (id, node = "a", hp = 4, extra = {}) => ({ id, kind: "huntsman-mob", node, hp, ...extra });
test("the ten campaign rewards preserve printed source data and existing chapter-one state shape", () => {
  for (const kind of kinds) {
    const d = R.definitions[kind], source = D.components.cards.find((c) => c.id === kind);
    assert(d, kind); assert.equal(d.rules, source.rules, kind); assert.equal(d.rawRules, source.rawRules, kind);
    assert.equal(d.subtype, kind.startsWith("rune-") ? "rune" : "tool");
  }
  assert.equal(Object.keys(R.definitions).length, 16);
  const s = fixture(), before = clone(s);
  R.init(s);
  assert.deepEqual(s, before);
  assert.equal(Object.hasOwn(H(s), "rewardSkipActivation"), false);
  assert.deepEqual(R.attackBonus(s, 0), { speed: 0, damage: 0, interrupt: false, replaceCardEffects: false });
});
test("beast roar moves all colocated enemies, including bosses, without altering health", () => {
  let s = fixture(), id = grant(s, "beast-roar");
  s.enemies = [enemy("one"), enemy("boss", "a", 6, { boss: true }), enemy("far", "d")];
  s = go(s, "USE_REWARD", { rewardId: id, moves: [{ enemyId: "one", node: "c" }, { enemyId: "boss", node: "a" }] });
  assert.deepEqual(s.enemies.map((e) => [e.id, e.node, e.hp]), [["one", "c", 4], ["boss", "a", 6], ["far", "d", 4]]);
  assert.equal(item(s, id).ready, false);
  assert.equal(H(s).hand.length, 0);
});
test("roar rejects omitted, duplicate, foreign, out-of-range and fog destinations without spending", () => {
  const s = fixture(), id = grant(s, "beast-roar");
  s.enemies = [enemy("one"), enemy("two")];
  for (const moves of [[], [{ enemyId: "one", node: "b" }],
    [{ enemyId: "one", node: "b" }, { enemyId: "one", node: "c" }],
    [{ enemyId: "one", node: "b" }, { enemyId: "foreign", node: "c" }],
    [{ enemyId: "one", node: "b" }, { enemyId: "two", node: "d" }],
    [{ enemyId: "one", node: "b" }, { enemyId: "two", node: "fog" }]]) {
    const before = clone(s);
    assert.throws(() => go(s, "USE_REWARD", { rewardId: id, moves }));
    assert.deepEqual(s, before);
    assert.equal(item(s, id).ready, true);
  }
});
test("Iosefka vial heals two up to six; formless readies only the equipped firearm", () => {
  let s = fixture();
  const vial = grant(s, "iosefka-vial"), rune = grant(s, "rune-formless");
  H(s).hp = 5;
  s = go(s, "USE_REWARD", { rewardId: vial });
  assert.equal(H(s).hp, 6); assert.equal(item(s, vial).ready, false);
  s = go(s, "USE_REWARD", { rewardId: rune });
  assert.equal(H(s).firearmReady, true); assert.equal(item(s, rune).ready, false);
  R.onDream(s, false, helpers);
  const before = clone(s);
  assert.throws(() => go(s, "USE_REWARD", { rewardId: rune }), /이미 준비/);
  assert.deepEqual(s, before);
  s.phase = "combat_react";
  assert.throws(() => go(s, "USE_REWARD", { rewardId: vial }), /사냥꾼의 차례/);
});
test("messenger gift affects the following activation window only and dream removes it", () => {
  let s = fixture(), id = grant(s, "messengers-gift");
  s = go(s, "USE_REWARD", { rewardId: id });
  assert.equal(H(s).rewardSkipActivation, true);
  assert.equal(item(s, id).ready, false);
  assert.equal(Object.hasOwn(s, "skipPursuit"), false);
  R.onDream(s, false, helpers);
  assert.equal(Object.hasOwn(H(s), "rewardSkipActivation"), false);
  assert.equal(item(s, id).ready, true);
});
test("augur deals damage before displacement and dead targets are not moved", () => {
  let s = fixture(), id = grant(s, "augur");
  s.enemies = [enemy("target")];
  s = go(s, "USE_REWARD", { rewardId: id, enemyId: "target", node: "c" });
  assert.equal(s.enemies[0].hp, 2); assert.equal(s.enemies[0].node, "c");
  assert.equal(item(s, id).ready, false);
  R.onDream(s, false);
  H(s).inDream = false; H(s).position = "c";
  const calls = [];
  s = go(s, "USE_REWARD", { rewardId: id, enemyId: "target", node: "b" },
    { ...helpers, displaceEnemy: () => calls.push("move") });
  assert.equal(s.enemies.length, 0); assert.deepEqual(calls, []);
  assert.equal(H(s).echoes, 1);
});
test("augur applies mission survival exceptions through kill hook and validates movement before damage", () => {
  let s = fixture(), id = grant(s, "augur");
  s.enemies = [enemy("mission", "a", 2, { tokens: 1 })];
  const before = clone(s);
  assert.throws(() => go(s, "USE_REWARD", { rewardId: id, enemyId: "mission", node: "fog" }), /안개/);
  assert.deepEqual(s, before);
  s = go(s, "USE_REWARD", { rewardId: id, enemyId: "mission", node: "b" });
  assert.equal(s.enemies[0].hp, 4); assert.equal(s.enemies[0].tokens, 0);
  assert.equal(s.enemies[0].node, "b"); assert.equal(H(s).echoes, 0);
});
test("augur routes damage through campaign mitigation before checking death and moving", () => {
  let s = fixture(), id = grant(s, "augur"), context;
  s.enemies = [enemy("protected")];
  s = go(s, "USE_REWARD", { rewardId: id, enemyId: "protected", node: "b" }, {
    ...helpers, damageEnemy: (_s, e, n, c) => { context = c; e.hp -= n / 2; },
  });
  assert.equal(s.enemies[0].hp, 3);
  assert.equal(s.enemies[0].node, "b");
  assert.deepEqual(context, { source: "reward", rewardKind: "augur" });
});
test("executioner gloves slay an enemy including bosses within two spaces at health two or below", () => {
  let s = fixture(), id = grant(s, "executioner-gloves");
  s.enemies = [enemy("boss", "c", 2, { boss: true }), enemy("healthy", "b", 3), enemy("far", "d", 1)];
  for (const enemyId of ["healthy", "far", "foreign"]) {
    const before = clone(s);
    assert.throws(() => go(s, "USE_REWARD", { rewardId: id, enemyId }), /체력 2/);
    assert.deepEqual(s, before);
  }
  s = go(s, "USE_REWARD", { rewardId: id, enemyId: "boss" });
  assert.equal(s.enemies.some((e) => e.id === "boss"), false);
  assert.equal(H(s).echoes, 1); assert.equal(item(s, id).ready, false);
});
test("attack rewards combine modifiers, equal-speed interrupt and optional transform without replacing stats", () => {
  const s = fixture(), shell = grant(s, "empty-shell"), hunter = grant(s, "rune-hunter"), writhe = grant(s, "rune-writhe");
  const bonus = R.attackBonus(s, 1, [shell, hunter, writhe], helpers);
  assert.deepEqual(bonus, { speed: 2, damage: 1, interrupt: true, replaceCardEffects: false,
    freeTransform: true, interruptEqual: true });
  for (const id of [shell, hunter, writhe]) assert.equal(item(s, id).ready, false);
  R.onDream(s, false);
  for (const id of [shell, hunter, writhe]) assert.equal(item(s, id).ready, true);
});
test("replacement rune and hunter rune can be selected together; rejection consumes no other reward", () => {
  const s = fixture(), claw = grant(s, "rune-clawmark"), hunter = grant(s, "rune-hunter"), shell = grant(s, "empty-shell");
  const before = clone(s);
  assert.throws(() => R.attackBonus(s, 0, [shell, hunter, "foreign"], helpers), /준비된/);
  assert.deepEqual(s, before);
  const bonus = R.attackBonus(s, 0, [claw, hunter], helpers);
  assert.deepEqual(bonus, { speed: 1, damage: 1, interrupt: true, replaceCardEffects: true, freeTransform: true });
  assert.equal(item(s, shell).ready, true);
});
test("old hunter bone has no stat/slot cost and cannot dodge dedicated, forbidden or cancelled attacks", () => {
  let s = fixture(), id = grant(s, "old-hunter-bone");
  s.phase = "combat_react"; s.enemies = [enemy("attacker")];
  s.combat = { enemyId: "attacker", action: { type: "attack" }, dodged: false, cancelEnemy: false, noDodge: false };
  s = go(s, "USE_REWARD", { rewardId: id });
  assert.equal(s.combat.dodged, true); assert.equal(item(s, id).ready, false);
  assert.deepEqual(H(s).slots, [null, null, null]); assert.equal(H(s).hand.length, 0);
  for (const patch of [{ action: { type: "ability" } }, { action: { type: "attack", undodgeable: true } },
    { cancelEnemy: true }, { noDodge: true }, { dodged: true }]) {
    R.onDream(s, false); Object.assign(s.combat, { action: { type: "attack" }, cancelEnemy: false, noDodge: false, dodged: false }, patch);
    const before = clone(s);
    assert.throws(() => go(s, "USE_REWARD", { rewardId: id }), /회피할 수/);
    assert.deepEqual(s, before);
  }
});
test("automatic dodge can enter a dream and the bone is refreshed after its use", () => {
  let s = fixture(), id = grant(s, "old-hunter-bone");
  s.phase = "combat_extra"; s.combat = { extra: { damage: 2 }, noDodge: false };
  s = go(s, "USE_REWARD", { rewardId: id }, { ...helpers,
    autoDodge: (s) => { R.onDream(s, false); H(s).inDream = true; s.phase = "upgrade_pick"; } });
  assert.equal(item(s, id).ready, true);
  assert.equal(H(s).inDream, true);
});
test("between chapters, stored rewards and firearms can be swapped while retaining all collected cards", () => {
  let s = fixture(), roar = grant(s, "beast-roar"), bone = grant(s, "old-hunter-bone"), augur = grant(s, "augur");
  s = go(s, "KEEP_REWARD", { rewardId: augur });
  assert.throws(() => go(s, "EQUIP_REWARD", { rewardId: augur, replaceId: roar }), /챕터 사이/);
  grant(s, "repeating-pistol"); s = go(s, "KEEP_FIREARM", { firearmId: "repeating-pistol" });
  grant(s, "flamesprayer"); s = go(s, "KEEP_FIREARM", { firearmId: "flamesprayer" });
  s.phase = "between_chapters";
  s = go(s, "EQUIP_REWARD", { rewardId: augur, replaceId: roar });
  assert.equal(item(s, roar).equipped, false); assert.equal(item(s, bone).equipped, true);
  s = go(s, "EQUIP_FIREARM", { firearmId: "flamesprayer" });
  assert.deepEqual(H(s).ownedFirearms, ["hunter-pistol", "repeating-pistol", "flamesprayer"]);
  assert.equal(D.firearms["flamesprayer"].temporary, true);
  assert.equal(H(s).rewards.length, 3); R.assert(s);
  assert.deepEqual(clone(s), s);
});
test("reward view exposes legal targets and displacement destinations without changing saved state", () => {
  const s = fixture();
  const roar = grant(s, "beast-roar"), augur = grant(s, "augur"), gloves = grant(s, "executioner-gloves");
  R.dispatch(s, { type: "KEEP_REWARD", rewardId: gloves }, helpers);
  s.enemies = [enemy("near", "a", 2), enemy("far", "d", 1)];
  const before = clone(s), view = R.view(s, helpers);
  assert.equal(view.rewards.find((r) => r.id === roar).controls.type, "enemies-destinations");
  assert.deepEqual(view.rewards.find((r) => r.id === augur).controls.targets[0].destinations.map((n) => n.node), ["a", "b", "c"]);
  assert.deepEqual(view.rewards.find((r) => r.id === gloves).controls.targets.map((e) => e.enemyId), ["near"]);
  assert.equal(view.rewards.find((r) => r.id === gloves).usable, false);
  assert.deepEqual(s, before);
});
function combatFixture(face = 0) {
  const E = require("../hunt-engine.js");
  const s = E.create(90, "burial", face, null, "hunter-pistol", "center", { campaign: true }), h = E.hunter(s);
  const pool = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  const take = (kind) => pool.splice(pool.findIndex((c) => c.kind === kind), 1)[0];
  h.hand = [take("strength"), take("endurance"), take("skill")];
  h.deck = pool; h.discard = []; h.slots = [null, null, null];
  h.hp = 6;
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: h.position, hp: 4 }];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = [];
  return { E, s };
}
test("integrated writhe interrupts an equal-speed enemy before its damage; ordinary stagger does not", () => {
  for (const withRune of [false, true]) {
    let { E, s } = combatFixture();
    const id = withRune ? R.grant(s, "rune-writhe") : null;
    const cardId = H(s).hand[withRune ? 0 : 2].id;
    s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId, slot: 1,
      ...(withRune ? { rewardIds: [id] } : {}) });
    assert.equal(s.combat.attack.speed, s.combat.action.speed);
    s = E.dispatch(s, { type: "RESOLVE" });
    assert.equal(H(s).hp, withRune ? 6 : 4);
    if (withRune) assert.equal(item(s, id).ready, false);
  }
});
test("integrated hunter rune offers a free optional transform only after the selected attack", () => {
  let { E, s } = combatFixture();
  const id = R.grant(s, "rune-hunter"), hand = H(s).hand.length;
  s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId: H(s).hand[0].id,
    slot: 0, rewardIds: [id] });
  assert.equal(s.combat.attack.speed, 4);
  assert.equal(s.phase, "combat_react");
  s = E.dispatch(s, { type: "RESOLVE" });
  assert.equal(s.phase, "free_transform");
  assert.equal(H(s).face, 0);
  s = E.dispatch(s, { type: "FREE_TRANSFORM", accept: true });
  assert.equal(H(s).face, 1);
  assert.equal(H(s).hand.length, hand - 1);
  assert.equal(item(s, id).ready, false);
});
test("integrated bone dodges a real attack without another stat card or slot", () => {
  let { E, s } = combatFixture();
  const id = R.grant(s, "old-hunter-bone");
  s = E.dispatch(s, { type: "ATTACK", enemyId: s.enemies[0].id, cardId: H(s).hand[0].id, slot: 1 });
  const hand = clone(H(s).hand), slots = clone(H(s).slots);
  s = E.dispatch(s, { type: "USE_REWARD", rewardId: id });
  assert.equal(s.combat.dodged, true);
  assert.deepEqual(H(s).hand, hand); assert.deepEqual(H(s).slots, slots);
  s = E.dispatch(s, { type: "RESOLVE" });
  assert.equal(H(s).hp, 6); assert.equal(item(s, id).ready, false);
});
test("integrated gift skips non-boss activation once, then the next round re-enables it", () => {
  let { E, s } = combatFixture();
  const id = R.grant(s, "messengers-gift");
  s = E.dispatch(s, { type: "USE_REWARD", rewardId: id });
  assert.equal(E.eligible(s).length, 0);
  s = E.dispatch(s, { type: "END_TURN" });
  assert.equal(s.phase, "refill"); assert.equal(H(s).hp, 6);
  assert.equal(Object.hasOwn(H(s), "rewardSkipActivation"), false);
  s = E.dispatch(s, { type: "REFILL" });
  assert.equal(E.eligible(s).length, 1);
});
