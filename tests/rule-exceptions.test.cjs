const test = require("node:test"), assert = require("node:assert/strict");
const M = require("../chapter-engine.js"), E = require("../hunt-engine.js");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
const layout = [
  { tileId: "tile-14", x: 0, y: 0, rotation: 0 },
  { tileId: "tile-01", x: 0, y: -1, rotation: 0 },
  { tileId: "tile-03", x: 0, y: -2, rotation: 0 },
  { tileId: "tile-07", x: 1, y: 0, rotation: 1 },
  { tileId: "tile-18", x: 0, y: 1, rotation: 0 },
  { tileId: "tile-12", x: 0, y: 2, rotation: 2 },
];
function lastMap(tile = "tile-20", rulesVersion = 8) {
  const s = M.create(99, "left", 1, { rulesVersion });
  s.tiles = structuredClone(layout); s.tileDeck = [tile];
  s.tilePool = [...s.tiles.map((p) => p.tileId), tile];
  assert.equal(M.openExits(s).length, 1); M.assertState(s);
  return s;
}
function lastHunt(tile = "tile-20", rulesVersion = 8) {
  let s = E.create(99, "burial", 0, null, "hunter-pistol", "left",
    { campaign: false, rulesVersion });
  s.world.tiles = structuredClone(layout); s.world.tileDeck = [tile];
  s.world.tilePool = [...s.world.tiles.map((p) => p.tileId), tile];
  s.enemies = []; s.loot = [];
  E.assertState(s);
  return go(s, "MOVE", { cardId: E.hunter(s).hand[0].id });
}
test("the final tile may not seal every exit and failed exploration leaves both map inputs unchanged", () => {
  const map = lastMap(), mapBefore = structuredClone(map);
  assert.throws(() => M.dispatch(map, { type: "EXPLORE", edge: "W" }), /출입구/);
  assert.deepEqual(map, mapBefore);
  const hunt = lastHunt(), huntBefore = structuredClone(hunt);
  assert.throws(() => go(hunt, "EXPLORE", { edge: "W" }), /출입구/);
  assert.deepEqual(hunt, huntBefore);
});
test("a final tile with a remaining exit still places and forced sealing placement is rejected", () => {
  let map = M.dispatch(lastMap("tile-09"), { type: "EXPLORE", edge: "W" });
  map = M.dispatch(map, { type: "PLACE_TILE", rotation: M.placementOptions(map,
    map.pending.tileId, map.pending.anchor)[0] });
  assert.equal(map.tileDeck.length, 0); assert(M.openExits(map).length);
  let s = go(lastHunt("tile-09"), "EXPLORE", { edge: "W" });
  s = go(s, "PLACE_TILE", { rotation: E.placementOptions(s)[0] });
  assert.equal(s.world.tileDeck.length, 0); assert(M.openExits(s.world).length);
  s = lastHunt();
  const anchor = M.openExits(s.world)[0];
  s.world.pending = { tileId: s.world.tileDeck.shift(), anchor }; s.phase = "tile_place";
  assert.deepEqual(E.placementOptions(s), []);
  const before = structuredClone(s);
  assert.throws(() => go(s, "PLACE_TILE", { rotation: 1 }), /연결 가능한/);
  assert.deepEqual(s, before);
});
test("version seven and unversioned saves retain the previous final-tile interpretation", () => {
  for (const rulesVersion of [7, null]) {
    let map = M.dispatch(lastMap("tile-20", rulesVersion), { type: "EXPLORE", edge: "W" });
    map = M.dispatch(map, { type: "PLACE_TILE", rotation: M.placementOptions(map,
      map.pending.tileId, map.pending.anchor)[0] });
    assert.equal(M.openExits(map).length, 0);
    let hunt = go(lastHunt("tile-20", rulesVersion), "EXPLORE", { edge: "W" });
    hunt = go(hunt, "PLACE_TILE", { rotation: E.placementOptions(hunt)[0] });
    assert.equal(M.openExits(hunt.world).length, 0);
  }
});
test("explicit rules versions round-trip and unsupported save or creation versions are rejected", () => {
  for (const rulesVersion of [9, 8, 7, null]) {
    let map = M.create(99, "center", 1, { rulesVersion });
    map = M.dispatch(map, { type: "MOVE", node: "tile-14:left" });
    assert.deepEqual(M.importSave(M.exportSave(map)), map);
    let hunt = E.create(99, "burial", 0, null, "hunter-pistol", "center",
      { campaign: false, rulesVersion });
    hunt = go(hunt, "MOVE", { cardId: E.hunter(hunt).hand[0].id });
    hunt = go(hunt, "STOP_MOVE");
    assert.deepEqual(E.importSave(E.exportSave(hunt)), hunt);
    assert.equal(Object.hasOwn(hunt.setup, "rulesVersion"), rulesVersion !== null);
  }
  for (const rulesVersion of [0, 6, 99, "8"]) {
    assert.throws(() => M.create(99, "center", 1, { rulesVersion }), /규칙 버전/);
    assert.throws(() => E.create(99, "burial", 0, null, "hunter-pistol", "center",
      { campaign: false, rulesVersion }), /규칙 버전/);
  }
  const map = M.create(99); map.rulesVersion = 99;
  assert.throws(() => M.importSave(JSON.stringify(map)), /규칙 버전/);
  const hunt = E.create(99); hunt.setup.rulesVersion = 99;
  assert.throws(() => E.importSave(JSON.stringify({ format: "bloodborne-hunt-save",
    version: 1, state: hunt })), /규칙 버전/);
});

function setHand(s, kinds) {
  const h = E.hunter(s);
  h.deck = [...h.hand, ...h.deck]; h.hand = [];
  for (const kind of kinds) {
    const i = h.deck.findIndex((c) => c.kind === kind);
    if (i >= 0) h.hand.push(...h.deck.splice(i, 1));
    else {
      const replaced = h.deck.shift(); s.removedCards.push(replaced.kind);
      const j = s.upgradeDeck.indexOf(kind);
      if (j >= 0) s.upgradeDeck.splice(j, 1);
      else { const k = s.market.indexOf(kind); assert(k >= 0);
        s.market[k] = s.upgradeDeck.shift() || null; }
      h.hand.push({ id: `card-${++s.uid}`, kind });
    }
  }
  return s;
}
function statusFixture(cards = ["strength", "endurance", "vitality"], item = null,
  rulesVersion = 8) {
  const s = E.create(123, "burial", 0, item, "hunter-pistol", "center",
    { campaign: false, rulesVersion });
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1,
    node: E.hunter(s).position, hp: 4 }];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
  return setHand(s, cards);
}
function attack(s, slot = 0, args = {}) {
  return go(s, "ATTACK", { enemyId: s.enemies[0].id,
    cardId: E.hunter(s).hand[0].id, slot, ...args });
}
// Current supplied six faces contain neither status keyword. This fixture adds
// them temporarily to exercise the general adapter without altering card data.
function withStatusKeywords(run) {
  const attack = E.data.enemies["huntsman-mob"].sides[0].basicAttack;
  const original = attack.keywords;
  attack.keywords = ["독", "발광"];
  try { run(); } finally { attack.keywords = original; }
}
test("supplied six faces do not claim poison frenzy or white-background ability coverage", () => {
  for (const e of Object.values(E.data.enemies))
    for (const side of e.sides)
      for (const action of [side.basicAttack, side.specialAttack])
        assert(!action.keywords.some((x) => ["독", "발광"].includes(x)));
});
test("status attack keywords apply once after damage and existing frenzy adds one to later attacks", () => {
  withStatusKeywords(() => {
    let s = go(attack(statusFixture()), "RESOLVE");
    assert.equal(E.hunter(s).hp, 4);
    assert.deepEqual(E.hunter(s).status, { poison: true, frenzy: true });
    s = go(attack(s, 1), "RESOLVE");
    assert.equal(E.hunter(s).hp, 1);
    assert.deepEqual(E.hunter(s).status, { poison: true, frenzy: true });
  });
});
test("dodged interrupted and immune status attacks cause no poison or frenzy", () => {
  withStatusKeywords(() => {
    let s = attack(statusFixture());
    s = go(s, "DODGE", { cardId: E.hunter(s).hand[0].id, slot: 1 });
    s = go(s, "RESOLVE");
    assert.equal(E.hunter(s).hp, 6);
    assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
    s = go(attack(statusFixture(["skill", "endurance", "strength"])), "RESOLVE");
    assert.equal(E.hunter(s).hp, 6);
    assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
    s = go(attack(statusFixture(["indomitable", "endurance", "strength"])), "RESOLVE");
    assert.equal(E.hunter(s).hp, 4);
    assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
  });
});
test("numbing mist removes status keywords while defense alone does not prevent their application", () => {
  withStatusKeywords(() => {
    let s = statusFixture(undefined, "numbing-mist");
    s = go(attack(s, 0, { itemIds: [E.hunter(s).consumables[0].id] }), "RESOLVE");
    assert.equal(E.hunter(s).hp, 4);
    assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
    s = go(attack(statusFixture(["defensive", "endurance", "strength"])), "RESOLVE");
    assert.equal(E.hunter(s).hp, 6);
    assert.deepEqual(E.hunter(s).status, { poison: true, frenzy: true });
  });
});
test("attack-applied poison deals one at turn end and dreaming clears both statuses", () => {
  withStatusKeywords(() => {
    let s = go(attack(statusFixture()), "RESOLVE");
    s.enemies = [];
    s = go(s, "END_TURN"); assert.equal(E.hunter(s).hp, 3);
    s = go(s, "REFILL");
    s = go(s, "DREAM", { cardId: E.hunter(s).hand[0].id });
    assert.equal(E.hunter(s).hp, 6);
    assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
  });
});
test("legacy versions preserve their former attack shape and do not gain status behavior on replay", () => {
  withStatusKeywords(() => {
    for (const rulesVersion of [7, null]) {
      let s = attack(statusFixture(undefined, null, rulesVersion));
      assert(!Object.hasOwn(s.combat.action, "poison"));
      assert(!Object.hasOwn(s.combat.action, "frenzy"));
      s = go(s, "RESOLVE");
      assert.equal(E.hunter(s).hp, 4);
      assert.deepEqual(E.hunter(s).status, { poison: false, frenzy: false });
    }
  });
});

function interactionFixture(rulesVersion = 8, third = false) {
  const s = statusFixture(undefined, null, rulesVersion), h = E.hunter(s);
  const kinds = ["huntsman-mob", "huntsmans-minion", "scourge-beast"];
  s.world.assignments = kinds.map((kind, i) => ({
    ...s.world.assignments.find((a) => a.enemyId === kind),
    sideId: kind === "huntsmans-minion" ? "b" : "a", slot: i + 1,
    marker: ["gold", "red", "purple"][i],
  }));
  h.firearmReady = false;
  s.enemies = kinds.slice(0, third ? 3 : 2).map((kind) => ({
    id: `${kind}-1`, kind, figure: 1, node: h.position,
    hp: E.data.enemies[kind].health,
  }));
  s.enemyDeck = ["basic", "special", "basic", "basic", "special", "ability"];
  s.enemyDiscard = [];
  return s;
}
function startInteraction(s) {
  return go(s, "INTERACT", { cardId: E.hunter(s).hand[0].id, lamp: "tile-14:center" });
}
function finishRetaliations(s) {
  while (s.combat) {
    if (s.phase === "combat_react") s = go(s, "RESOLVE");
    else if (s.phase === "stun") s = go(s, "STUN_DISCARD", { cardId: E.hunter(s).hand[0]?.id });
    else throw new Error(`Unexpected retaliation phase ${s.phase}`);
  }
  return s;
}
test("multiple interaction enemies wait for an explicit order before revealing the action deck", () => {
  const original = interactionFixture(), before = structuredClone(original);
  let s = startInteraction(original);
  assert.deepEqual(original, before);
  assert.equal(s.phase, "interaction_order"); assert.equal(s.combat, null);
  assert.deepEqual(s.enemyDeck, original.enemyDeck);
  assert.deepEqual(s.enemyDiscard, []);
  assert.deepEqual(E.interactionEnemies(s).map((e) => e.id), ["huntsman-mob-1", "huntsmans-minion-1"]);
  const waiting = structuredClone(s);
  assert.throws(() => go(s, "INTERACTION_ENEMY", { enemyId: "scourge-beast-1" }), /아직 반격/);
  assert.deepEqual(s, waiting);
  s = go(s, "INTERACTION_ENEMY", { enemyId: "huntsmans-minion-1" });
  assert.equal(s.combat.enemyId, "huntsmans-minion-1");
  assert.equal(s.combat.origin, "interaction"); assert.equal(s.combat.action.kind, "basic");
  assert.throws(() => go(s, "COUNTER", { cardId: E.hunter(s).hand[0].id, slot: 0 }));
  assert.throws(() => go(s, "DODGE", { cardId: E.hunter(s).hand[0].id, slot: 0 }));
});
test("printed interaction attacks can make one order fatal and another complete at one health", () => {
  let fatal = go(startInteraction(interactionFixture()), "INTERACTION_ENEMY", { enemyId: "huntsman-mob-1" });
  fatal = finishRetaliations(fatal);
  assert.equal(E.hunter(fatal).inDream, true); assert.equal(fatal.interaction, null);
  assert(fatal.events.some((e) => e.text.includes("처치당했습니다")));
  assert(!fatal.events.some((e) => e.text.includes("중앙 등불") && e.text.includes("순간이동")));
  let surviving = go(startInteraction(interactionFixture()), "INTERACTION_ENEMY", { enemyId: "huntsmans-minion-1" });
  surviving = finishRetaliations(surviving);
  assert.equal(E.hunter(surviving).hp, 1); assert.equal(E.hunter(surviving).inDream, false);
  assert.equal(surviving.phase, "hunter"); assert.equal(surviving.interaction, null);
  assert(surviving.events.some((e) => e.text.includes("중앙 등불") && e.text.includes("순간이동")));
});
test("remaining interaction enemies offer another order choice and cannot retaliate twice", () => {
  let s = startInteraction(interactionFixture(8, true));
  s = go(s, "INTERACTION_ENEMY", { enemyId: "huntsmans-minion-1" });
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "interaction_order");
  assert.deepEqual(E.interactionEnemies(s).map((e) => e.id), ["huntsman-mob-1", "scourge-beast-1"]);
  const before = structuredClone(s);
  assert.throws(() => go(s, "INTERACTION_ENEMY", { enemyId: "huntsmans-minion-1" }), /아직 반격/);
  assert.deepEqual(s, before);
  const broken = structuredClone(s); broken.interaction.enemies.push(broken.interaction.enemies[0]);
  assert.throws(() => E.assertState(broken), /반격 순서/);
});
test("legacy interaction order remains the first enemy in its assigned slot", () => {
  for (const rulesVersion of [7, null]) {
    let s = startInteraction(interactionFixture(rulesVersion));
    assert.equal(s.phase, "combat_react");
    assert.equal(s.combat.enemyId, "huntsman-mob-1");
    s = finishRetaliations(s);
    assert.equal(E.hunter(s).inDream, true); assert.equal(s.interaction, null);
  }
});
test("legacy complete campaigns retain all 327 original commands and exact save replay", () => {
  const commands = require("./fixtures/full-campaign-commands.json");
  for (const rulesVersion of [7, null]) {
    let s = E.create(90, "burial", 1, null, "hunter-pistol", "center",
      { campaign: true, rulesVersion });
    for (const command of commands) s = E.dispatch(s, command);
    assert.equal(s.result, "campaign-win"); assert.equal(s.revision, 327);
    assert.deepEqual(E.importSave(E.exportSave(s)), s);
  }
});
