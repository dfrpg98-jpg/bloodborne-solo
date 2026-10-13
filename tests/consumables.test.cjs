const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const E = require("../engine.js"),
  C = require("../components/cards.js");
const h = E.hunter,
  cmd = (s, type, a = {}) => E.dispatch(s, { type, ...a });
const start = (kind) => E.create(91, "training", 0, kind);
const item = (s, kind) =>
  h(s).consumables.find((x) => !kind || x.kind === kind);
const use = (s, a = {}) =>
  cmd(s, "USE_CONSUMABLE", { itemId: item(s).id, ...a });
function give(s, kind) {
  const i = s.consumableDeck.findIndex((x) => x.kind === kind);
  assert(i >= 0);
  h(s).consumables.push(...s.consumableDeck.splice(i, 1));
}
function setAction(s, kind) {
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
  const i = s.enemyDeck.indexOf(kind);
  s.enemyDeck.splice(i, 1);
  s.enemyDeck.unshift(kind);
}
function duel(kind, action = "basic", enemy = "scout-1") {
  const s = start(kind);
  h(s).position = s.enemies.find((e) => e.id === enemy).node;
  setAction(s, action);
  return s;
}
function attack(
  s,
  enemy = "scout-1",
  slot = 0,
  items = h(s).consumables.map((x) => x.id),
) {
  return cmd(s, "ATTACK", {
    enemyId: enemy,
    cardId: h(s).hand[0].id,
    slot,
    itemIds: items,
  });
}
test("catalogue preserves all 75 definitions, quantities, original text and offline export", () => {
  assert.deepEqual(
    C,
    JSON.parse(
      fs.readFileSync(require.resolve("../components/cards.json"), "utf8"),
    ),
  );
  assert.equal(C.cards.length, 75);
  assert.equal(new Set(C.cards.map((x) => x.id)).size, 75);
  for (const [g, n] of [
    ["basic", 12],
    ["consumable", 37],
    ["upgrade", 60],
    ["reward", 68],
  ])
    assert.equal(
      C.cards.filter((c) => c.group === g).reduce((a, c) => a + c.count, 0),
      n,
    );
  for (const t of ["strength", "skill", "endurance", "vitality"])
    assert.equal(
      C.cards.filter((c) => c.group === "upgrade" && c.stat === t).length,
      5,
    );
  assert.equal(
    C.cards.filter((c) => c.group === "consumable" && c.runtime === "playable")
      .length,
    16,
  );
  assert.equal(
    C.cards.find((c) => c.id === "quick").rawRules,
    "(회피)카드 1장을 뽑습니다. 이 슬롯을 비웁니다.",
  );
  assert.equal(C.cards.find((c) => c.id === "ritual-material").count, 10);
  assert.equal(
    C.cards.find((c) => c.id === "rune-corruption").limit,
    "once_per_chapter",
  );
});
test("play pool retains 2 of each of 18 types, excludes invitation, grants no extra copy", () => {
  const s = start("blood-vial"),
    all = [...s.consumableDeck, ...h(s).consumables];
  assert.equal(all.length, 36);
  assert.equal(s.consumableDeck.length, 35);
  assert.equal(all.filter((x) => x.kind === "blood-vial").length, 2);
  assert(!all.some((x) => x.kind === "cainhurst-invitation"));
  assert.equal(h(E.create(91, "burial", 0, null)).consumables.length, 0);
  assert.throws(() => E.create(91, "burial", 0, "cainhurst-invitation"));
});
test("antidote and sedative draw one and remove only the corresponding condition without stat cost", () => {
  for (const [kind, removed, kept] of [
    ["antidote", "poison", "frenzy"],
    ["sedative", "frenzy", "poison"],
  ]) {
    let s = start(kind);
    h(s).status = { poison: true, frenzy: true };
    s = use(s);
    assert.equal(h(s).hand.length, 4);
    assert.equal(h(s).status[removed], false);
    assert.equal(h(s).status[kept], true);
    assert.equal(h(s).consumables.length, 0);
    assert.equal(s.consumableDiscard.length, 1);
    assert.equal(h(s).discard.length, 0);
  }
});
test("vial heals capped at 6 and coldblood obeys echo cap", () => {
  let s = start("blood-vial");
  h(s).hp = 5;
  s = use(s);
  assert.equal(h(s).hp, 6);
  for (const before of [1, 3]) {
    s = start("coldblood");
    h(s).echoes = before;
    s = use(s);
    assert.equal(h(s).echoes, Math.min(3, before + 1));
  }
});
test("bullets ready the gun without discarding a stat card", () => {
  let s = start("quicksilver-bullets");
  h(s).firearmReady = false;
  s = use(s);
  assert.equal(h(s).firearmReady, true);
  assert.equal(h(s).hand.length, 3);
});
test("beast pellet lets player clear an occupied slot and rejects empty/outside slots atomically", () => {
  let s = start("beast-pellet");
  h(s).slots[1] = h(s).hand.pop();
  const before = structuredClone(s);
  for (const slot of [0, 3, -1]) assert.throws(() => use(s, { slot }));
  assert.deepEqual(s, before);
  s = use(s, { slot: 1 });
  assert.equal(h(s).slots[1], null);
  assert.equal(h(s).discard.length, 1);
});
test("ranged damage uses correct graph range and grants kill echoes without weapon splash", () => {
  let s = start("throwing-knife");
  assert.throws(() => use(s, { enemyId: "scout-1" }));
  h(s).position = "c1";
  s.enemies[0].hp = 1;
  s = use(s, { enemyId: "scout-1" });
  assert(!s.enemies.some((e) => e.id === "scout-1"));
  assert.equal(h(s).echoes, 1);
  assert.equal(s.enemies[0].hp, 4);
  s = start("molotov");
  h(s).position = "c1";
  assert.throws(() => use(s, { enemyId: "scout-1" }));
  h(s).position = "e0";
  s.enemies[1].hp = 2;
  s = use(s, { enemyId: "sentinel-1" });
  assert.equal(s.mission.guardDown, true);
});
test("pebble validates target range and destination independently, without activation or pursuit", () => {
  let s = start("pebble");
  assert.throws(() => use(s, { enemyId: "scout-1", node: "e1" }));
  s = use(s, { enemyId: "scout-1", node: "e0" });
  assert.equal(s.enemies[0].node, "e0");
  assert.equal(s.phase, "hunter");
  assert.equal(h(s).position, "c0");
  assert.equal(s.combat, null);
});
test("bold mark teleports to lamp without triggering pursuit, rejects ordinary spaces", () => {
  let s = start("bold-mark");
  h(s).position = "w0";
  assert.throws(() => use(s, { node: "c1" }));
  s = use(s, { node: "c0" });
  assert.equal(h(s).position, "c0");
  assert.equal(s.enemies[0].node, "w0");
  assert.equal(s.phase, "hunter");
});
test("blue elixir starts a two-space movement action without stat cost and pursuers follow", () => {
  let s = start("blue-elixir");
  h(s).position = "w0";
  s = use(s);
  assert.equal(s.phase, "move");
  assert.equal(h(s).hand.length, 3);
  s = cmd(s, "STEP", { node: "c1" });
  s = cmd(s, "STEP", { node: "c0" });
  assert.equal(s.phase, "hunter");
  assert.equal(s.enemies[0].node, "c1");
});
test("pungent blood skips only next activation, then clears at next round", () => {
  let s = start("pungent-blood");
  s = use(s, { enemyId: "scout-1" });
  assert.deepEqual(s.skipActivation, ["scout-1"]);
  s = cmd(s, "END_TURN");
  assert.equal(s.phase, "refill");
  assert.equal(s.enemies[0].node, "w0");
  assert.deepEqual(s.skipActivation, []);
  s = cmd(s, "REFILL");
  s = cmd(s, "END_TURN");
  assert.equal(s.enemies[0].node, "c1");
});
test("pungent blood does not prevent pursuit or an interaction reaction", () => {
  let s = start("pungent-blood");
  h(s).position = "w0";
  s = use(s, { enemyId: "scout-1" });
  s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
  s = cmd(s, "STEP", { node: "w1" });
  s = cmd(s, "STOP_MOVE");
  assert.equal(s.enemies[0].node, "w1");
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert.equal(s.phase, "combat_react");
  assert.equal(s.combat.origin, "interaction");
});
test("bolt paper and fire paper commit before reveal and change direct attack only", () => {
  let s = duel("bolt-paper");
  give(s, "fire-paper");
  const stat = E.card(h(s).hand[0]);
  s = attack(s);
  assert.equal(s.combat.attack.speed, 4);
  assert.equal(s.combat.attack.damage, 2 + (stat.damage || 0));
  assert.equal(s.consumableDiscard.length, 2);
  assert.equal(h(s).consumables.length, 0);
  assert.throws(() =>
    cmd(s, "USE_CONSUMABLE", { itemId: "item-bolt-paper-1" }),
  );
});
test("invalid or duplicate attack items roll back every card, item, RNG and pull", () => {
  const s = duel("bolt-paper"),
    before = structuredClone(s),
    id = item(s).id;
  assert.throws(() => attack(s, "scout-1", 0, [id, id]));
  assert.throws(() => attack(s, "scout-1", 5, [id]));
  assert.throws(() => attack(s, "scout-1", 0, ["fake"]));
  assert.deepEqual(s, before);
  const turnItem = duel("antidote");
  assert.throws(() => attack(turnItem));
});
test("lead elixir defense reduces incoming damage including frenzy and never heals", () => {
  let s = duel("lead-elixir");
  h(s).status.frenzy = true;
  s = attack(s, "scout-1", 2);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 5);
  s = duel("lead-elixir");
  give(s, "lead-elixir");
  s = attack(s, "scout-1", 2);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 6);
});
test("numbing mist removes attack keywords, preserves damage and dedicated abilities", () => {
  let s = duel("numbing-mist", "special");
  s = attack(s, "scout-1", 2);
  assert.equal(s.combat.action.damage, 2);
  assert.equal(s.combat.action.stun, undefined);
  s = cmd(s, "RESOLVE");
  assert.equal(s.phase, "hunter");
  assert.equal(h(s).hp, 4);
  s = duel("numbing-mist", "ability", "sentinel-1");
  s = attack(s, "sentinel-1");
  assert.equal(h(s).status.frenzy, true);
  assert.equal(s.combat.action.kind, "ability");
});
test("pending and multiplayer items cannot silently be consumed", () => {
  for (const kind of ["bone-ash", "hunters-bell"]) {
    const s = start(null);
    give(s, kind);
    const before = structuredClone(s);
    assert.throws(() => use(s));
    assert.deepEqual(s, before);
  }
});
test("loot draws a real consumable and recycles the discard only when the draw deck empties", () => {
  let s = start(null);
  h(s).position = "w1";
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert.equal(h(s).consumables.length, 1);
  assert.equal(s.consumableDeck.length, 35);
  s = start("blood-vial");
  s = use(s);
  h(s).consumables.push(...s.consumableDeck);
  s.consumableDeck = [];
  h(s).position = "w1";
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert.equal(h(s).consumables.length, 36);
  assert.equal(s.consumableDiscard.length, 0);
  assert.equal(s.consumableDeck.length, 0);
});
test("turn items cannot be used during movement or combat, and save replay retains use and inventory", () => {
  let s = start("blue-elixir");
  s = use(s);
  give(s, "antidote");
  assert.throws(() => cmd(s, "USE_CONSUMABLE", { itemId: item(s).id }));
  s = start("coldblood");
  s = use(s);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  let combat = start("bolt-paper");
  combat = cmd(combat, "MOVE", { cardId: h(combat).hand[0].id });
  combat = cmd(combat, "STEP", { node: "c1" });
  combat = cmd(combat, "STEP", { node: "w0" });
  combat = attack(combat);
  assert.deepEqual(E.importSave(E.exportSave(combat)), combat);
});
test("dream and map reset preserve consumable inventory and total supply", () => {
  let s = start("fire-paper");
  s.track = 4;
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(h(s).consumables.length, 1);
  assert.equal(s.consumableDeck.length, 35);
  E.assertState(s);
});
