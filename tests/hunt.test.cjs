const test = require("node:test"),
  assert = require("node:assert/strict");
const E = require("../hunt-engine"),
  M = require("../chapter-engine");
const go = (s, type, a = {}) => E.dispatch(s, { type, ...a }),
  H = E.hunter;
test("cheap shot waits until a timed ability actually resolves", () => {
  let s = fixture("scourge-beast", "a", "ability", [
    "strength",
    "cheap-shot",
    "endurance",
  ]);
  s = attack(s);
  assert.equal(s.phase, "combat_react");
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "cheap_shot");
  assert.equal(s.enemies[0].hp, 2);
  s = go(s, "CHEAP_SHOT", { cardId: H(s).hand[0].id });
  assert.equal(s.enemies.length, 0);
  assert.equal(s.phase, "hunter");
  s = fixture("scourge-beast", "a", "ability", [
    "strength",
    "cheap-shot",
    "endurance",
  ]);
  s.enemies[0].hp = 2;
  s = go(attack(s), "RESOLVE");
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).hand[0].kind, "cheap-shot");
});
function hand(s, kinds) {
  const h = H(s);
  h.deck = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  h.hand = [];
  h.discard = [];
  h.slots = [null, null, null];
  for (const kind of kinds) {
    let i = h.deck.findIndex((c) => c.kind === kind);
    if (i < 0) {
      const old = h.deck.shift();
      s.removedCards.push(old.kind);
      let j = s.upgradeDeck.indexOf(kind);
      if (j >= 0) s.upgradeDeck.splice(j, 1);
      else {
        j = s.market.indexOf(kind);
        assert(j >= 0);
        s.market[j] = s.upgradeDeck.shift() || null;
      }
      h.hand.push({ id: `card-${++s.uid}`, kind });
    } else h.hand.push(...h.deck.splice(i, 1));
  }
  return s;
}
function fixture(
  kind = "huntsman-mob",
  face = "a",
  action = "basic",
  cards = ["strength", "endurance", "skill"],
  weaponFace = 0,
) {
  let s = E.create(123, "burial", weaponFace);
  s.world.assignments.find((a) => a.enemyId === kind).sideId = face;
  s.enemies = [
    {
      id: kind + "-1",
      kind,
      figure: 1,
      node: H(s).position,
      hp: E.data.enemies[kind].health,
    },
  ];
  const deck = ["basic", "basic", "basic", "special", "special", "ability"];
  deck.splice(deck.indexOf(action), 1);
  s.enemyDeck = [action, ...deck];
  s.enemyDiscard = [];
  return hand(s, cards);
}
function attack(s, slot = 0) {
  return go(s, "ATTACK", {
    enemyId: s.enemies[0].id,
    cardId: H(s).hand[0].id,
    slot,
  });
}
function autoPaths(s) {
  while (s.phase === "enemy_path")
    s = go(s, "ENEMY_STEP", { node: E.moveOptions(s)[0] });
  return s;
}
test("actual 12/60/36 supply and independent replay save", () => {
  let s = E.create(42);
  assert.equal(H(s).hand.length, 3);
  assert.equal(s.upgradeDeck.length, 56);
  assert.equal(s.consumableDeck.length, 36);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "EXPLORE", { edge: "N" });
  s = go(s, "PLACE_TILE", {
    rotation: M.placementOptions(
      s.world,
      s.world.pending.tileId,
      s.world.pending.anchor,
    )[0],
  });
  s = go(s, "STOP_MOVE");
  assert.equal(s.world.tiles.length, 2);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  const p = JSON.parse(E.exportSave(s));
  p.state.hunters["hunter-1"].hp = 5;
  assert.throws(() => E.importSave(JSON.stringify(p)), /명령 기록/);
});
test("map movement costs one card, unknown commands and invalid attacks roll back", () => {
  const s = E.create(),
    copy = JSON.stringify(s);
  assert.throws(() =>
    go(s, "ATTACK", { enemyId: "none", cardId: H(s).hand[0].id, slot: 0 }),
  );
  assert.equal(JSON.stringify(s), copy);
  let t = go(s, "MOVE", { cardId: H(s).hand[0].id });
  assert.equal(H(t).discard.length, 1);
  t = go(t, "STEP", { node: "tile-14:left" });
  t = go(t, "STEP", { node: "tile-14:center" });
  assert.equal(t.phase, "hunter");
  assert.equal(H(t).hand.length, 2);
});
test("ability followed by basic: mob applies speed/damage buff and permits pistol", () => {
  let s = attack(fixture("huntsman-mob", "a", "ability"));
  assert.equal(s.enemyDiscard.length, 2);
  assert.equal(s.combat.action.kind, "basic");
  assert.equal(s.combat.action.speed, 3);
  assert.equal(s.combat.action.damage, 3);
  assert(E.canFirearm(s));
  s = go(s, "FIREARM");
  s = go(s, "RESOLVE");
  assert.equal(H(s).hp, 6);
  assert.equal(H(s).firearmReady, false);
});
test("four firearms permit only basic attacks", () => {
  for (const gun of Object.keys(E.data.firearms))
    for (const kind of ["basic", "special", "ability"]) {
      let s = fixture("huntsman-mob", "b", kind);
      H(s).firearmId = gun;
      s.setup.firearmId = gun;
      s = attack(s);
      assert.equal(E.canFirearm(s), kind === "basic");
      if (kind !== "basic") assert.throws(() => go(s, "FIREARM"));
    }
});
test("scourge fury adds damage and stagger to subsequent special", () => {
  let s = fixture("scourge-beast", "b", "ability");
  [s.enemyDeck[1], s.enemyDeck[4]] = [s.enemyDeck[4], s.enemyDeck[1]];
  s = attack(s, 1);
  assert.equal(s.combat.action.kind, "special");
  assert.equal(s.combat.action.damage, 3);
  assert.equal(s.combat.action.interrupt, true);
  assert.equal(E.canFirearm(s), false);
});
test("brick ability supports discard or slower attack/no dodge", () => {
  for (const discard of [true, false]) {
    let s = attack(fixture("huntsmans-minion", "b", "ability"));
    assert.equal(s.phase, "ability_choice");
    s = go(s, "ABILITY_CHOICE", discard ? { cardId: H(s).hand[0].id } : {});
    assert.equal(s.combat.attack.speed, discard ? 3 : 1);
    assert.equal(s.combat.noDodge, !discard);
    assert.equal(s.combat.action.kind, "basic");
  }
});
test("faster kill cancels slower timed spawn ability", () => {
  let s = fixture("scourge-beast", "a", "ability");
  s.enemies[0].hp = 2;
  s = attack(s);
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.length, 0);
  assert.equal(H(s).echoes, 1);
});
test("timed ability precedes equal speed hunter attack", () => {
  let s = fixture(
    "scourge-beast",
    "a",
    "ability",
    ["strength", "endurance", "skill"],
    1,
  );
  s = attack(s, 1);
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.length, 1);
  assert.equal(s.enemies[0].figure, 2);
  assert.equal(H(s).echoes, 1);
});
test("firebomb moves before tied attack, causes no frenzy bonus, and attack misses displaced target", () => {
  let s = fixture(
    "huntsman-mob",
    "b",
    "ability",
    ["strength", "endurance", "skill"],
    1,
  );
  H(s).status.frenzy = true;
  s = attack(s, 1);
  s = autoPaths(go(s, "RESOLVE"));
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).hp, 3);
  assert.equal(s.enemies[0].hp, 4);
  assert.notEqual(s.enemies[0].node, H(s).position);
});
test("firebomb dodge prevents damage but does not cancel enemy movement", () => {
  let s = attack(fixture("huntsman-mob", "b", "ability"));
  s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  s = autoPaths(go(s, "RESOLVE"));
  assert.equal(H(s).hp, 6);
  assert.notEqual(s.enemies[0].node, H(s).position);
});
test("dash transports hunter and stuns after damage; dodge prevents transport", () => {
  for (const dodged of [true, false]) {
    let s = attack(
      fixture(
        "huntsmans-minion",
        "a",
        "ability",
        ["strength", "endurance", "skill"],
        1,
      ),
      1,
    );
    if (dodged) s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 0 });
    s = autoPaths(go(s, "RESOLVE"));
    if (dodged) {
      assert.equal(H(s).position, "tile-14:center");
      assert.equal(H(s).hp, 6);
      assert.equal(s.enemies[0].hp, 5);
    } else {
      assert.equal(H(s).position, s.enemies[0].node);
      assert.equal(H(s).hp, 3);
      assert.equal(s.phase, "stun");
      s = go(s, "STUN_DISCARD", { cardId: H(s).hand[0].id });
      assert.equal(s.enemies[0].hp, 1);
    }
  }
});
test("undodgeable special rejects dodge; uninterruptible special ignores faster stagger", () => {
  let s = attack(fixture("scourge-beast", "a", "special"));
  assert(!E.canDodge(s, H(s).hand[0].id, 1));
  assert.throws(() => go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 }));
  s = attack(
    fixture("huntsmans-minion", "b", "special", [
      "skill",
      "endurance",
      "strength",
    ]),
  );
  s = go(s, "RESOLVE");
  assert.equal(H(s).hp, 2);
  assert.equal(s.enemies[0].hp, 4);
});
test("same speed attacks are simultaneous; equal stagger does not prevent enemy", () => {
  let s = attack(
    fixture("huntsman-mob", "a", "basic", ["skill", "endurance", "strength"]),
    1,
  );
  s = go(s, "RESOLVE");
  assert.equal(H(s).hp, 4);
  assert.equal(s.enemies[0].hp, 2);
});
test("double strike needs two dodges and survives first stagger", () => {
  let s = attack(
    fixture("scourge-beast", "b", "special", [
      "endurance",
      "endurance",
      "endurance",
    ]),
  );
  s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "combat_extra");
  s = go(s, "EXTRA_DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  assert.equal(H(s).hp, 6);
  assert.equal(s.phase, "hunter");
  let t = attack(
    fixture("scourge-beast", "b", "special", [
      "skill",
      "endurance",
      "strength",
    ]),
  );
  t = go(t, "RESOLVE");
  assert.equal(t.phase, "combat_extra");
  assert.equal(H(t).hp, 6);
  t = go(t, "EXTRA_TAKE");
  assert.equal(H(t).hp, 4);
});
test("block is immediate against faster attacks and abilities", () => {
  let s = attack(
    fixture("scourge-beast", "b", "basic", [
      "defensive",
      "endurance",
      "strength",
    ]),
    1,
  );
  s = go(s, "RESOLVE");
  assert.equal(H(s).hp, 6);
  s = attack(
    fixture(
      "huntsman-mob",
      "b",
      "ability",
      ["defensive", "endurance", "strength"],
      1,
    ),
    1,
  );
  s = autoPaths(go(s, "RESOLVE"));
  assert.equal(H(s).hp, 5);
});
test("stun discards a card or damages empty hand, immunity prevents stagger/stun", () => {
  let s = attack(fixture("huntsman-mob", "a", "special", ["strength"]), 1);
  s = go(s, "RESOLVE");
  assert.equal(H(s).hp, 3);
  assert.equal(s.phase, "hunter");
  s = attack(
    fixture(
      "huntsman-mob",
      "a",
      "special",
      ["poised", "endurance", "strength"],
      1,
    ),
    1,
  );
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).hp, 4);
  assert.equal(s.enemies.length, 0);
});
test("clear-slot dodge effects, quick draw and tactical speed", () => {
  let s = attack(
    fixture("huntsman-mob", "a", "basic", ["strength", "quick", "tactical"]),
  );
  s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  assert.equal(H(s).hand.length, 2);
  assert.equal(H(s).slots[1], null);
  assert.equal(s.combat.dodged, true);
});
test("quick still needs sufficient speed and tactical can dodge speed3 in speed2 slot", () => {
  let s = attack(
    fixture("scourge-beast", "b", "basic", ["endurance", "quick", "tactical"]),
  );
  assert.equal(E.canDodge(s, H(s).hand[0].id, 1), false);
  assert.equal(E.canDodge(s, H(s).hand[1].id, 1), true);
  s = go(s, "DODGE", { cardId: H(s).hand[1].id, slot: 1 });
  assert.equal(H(s).slots[1], null);
});
test("tenacious draw/discard/status choices and energized clear choice", () => {
  let s = fixture("huntsman-mob", "a", "basic", [
    "tenacious",
    "strength",
    "endurance",
  ]);
  H(s).status = { poison: true, frenzy: true };
  s = attack(s);
  assert.equal(s.phase, "card_choice");
  s = go(s, "CARD_CHOICE", { value: H(s).hand[0].id });
  assert.equal(s.phase, "card_choice");
  s = go(s, "CARD_CHOICE", { value: "frenzy" });
  assert.equal(H(s).status.poison, true);
  assert.equal(H(s).status.frenzy, false);
  assert.equal(s.phase, "combat_react");
  s = attack(
    fixture("huntsman-mob", "a", "basic", [
      "strength",
      "energized",
      "endurance",
    ]),
  );
  s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  assert.equal(s.phase, "card_choice");
  s = go(s, "CARD_CHOICE", { value: 0 });
  assert.equal(H(s).slots[0], null);
  assert.equal(s.phase, "combat_react");
});
test("swift transform offers choice after attacking and after dodging", () => {
  let s = attack(
    fixture("huntsman-mob", "a", "basic", [
      "swift-transform",
      "endurance",
      "strength",
    ]),
  );
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "free_transform");
  s = go(s, "FREE_TRANSFORM", { accept: true });
  assert.equal(H(s).face, 1);
  assert.equal(H(s).slots.filter(Boolean).length, 0);
  assert.equal(s.phase, "hunter");
});
test("counterstrike and cheap shot kill through card effects", () => {
  let s = fixture("huntsman-mob", "b", "basic", [
    "endurance",
    "counterstrike",
    "strength",
  ]);
  s.enemies[0].hp = 2;
  s = attack(s);
  s = go(s, "DODGE", { cardId: H(s).hand[0].id, slot: 1 });
  assert.equal(s.phase, "hunter");
  assert.equal(s.enemies.length, 0);
  s = fixture("huntsman-mob", "a", "ability", [
    "endurance",
    "cheap-shot",
    "strength",
  ]);
  s.enemies[0].hp = 2;
  s = attack(s);
  assert.equal(s.phase, "cheap_shot");
  s = go(s, "CHEAP_SHOT", { cardId: H(s).hand[0].id });
  assert.equal(s.enemies.length, 0);
  assert.equal(s.enemyDiscard.length, 1);
});
test("regain heals after a missed attack but not after lethal simultaneous hit", () => {
  let s = fixture(
    "huntsman-mob",
    "b",
    "ability",
    ["regain", "endurance", "skill"],
    1,
  );
  H(s).hp = 4;
  s = attack(s, 1);
  s = autoPaths(go(s, "RESOLVE"));
  assert.equal(H(s).hp, 3);
  s = fixture("huntsman-mob", "a", "basic", ["regain", "endurance", "skill"]);
  H(s).hp = 2;
  s = attack(s, 1);
  s = go(s, "RESOLVE");
  assert.equal(H(s).inDream, true);
  assert.equal(H(s).echoes, 0);
});
test("sprint move3; rest heals non-attack action but not firearm reload", () => {
  let s = hand(E.create(), ["sprint", "rest", "rest"]);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  assert.equal(s.move.remaining, 3);
  s = go(s, "STOP_MOVE");
  H(s).hp = 2;
  s = go(s, "TRANSFORM", { cardId: H(s).hand[0].id });
  assert.equal(H(s).hp, 4);
  H(s).firearmReady = false;
  s = go(s, "RELOAD", { cardId: H(s).hand[0].id });
  assert.equal(H(s).hp, 4);
});
test("leap moves into enemy with one stat card and rejects out-of-range routes atomically", () => {
  let s = fixture("huntsman-mob", "a", "basic", [
    "leap",
    "endurance",
    "strength",
  ]);
  s.enemies[0].node = "tile-14:left";
  const before = JSON.stringify(s);
  assert.throws(() =>
    go(s, "ATTACK", {
      enemyId: s.enemies[0].id,
      cardId: H(s).hand[0].id,
      slot: 0,
      leapPath: ["tile-14:center", "tile-14:right", "tile-14:left"],
    }),
  );
  assert.equal(JSON.stringify(s), before);
  s = go(s, "ATTACK", {
    enemyId: s.enemies[0].id,
    cardId: H(s).hand[0].id,
    slot: 0,
    leapPath: E.leapPaths(s, "tile-14:left")[0],
  });
  assert.equal(H(s).position, "tile-14:left");
  assert.equal(H(s).hand.length, 2);
  assert.equal(s.combat.attack.damage, 2);
});
test("beast pursuit follows movement trail two spaces and does not attack", () => {
  let s = fixture("scourge-beast", "a");
  H(s).position = "tile-14:left";
  s.enemies[0].node = "tile-14:left";
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: "tile-14:center" });
  s = go(s, "STEP", { node: "tile-14:right" });
  assert.equal(s.enemies[0].node, "tile-14:right");
  assert.equal(s.phase, "hunter");
  assert.equal(s.enemyDiscard.length, 0);
});
test("beast activation moves two spaces then requests counter", () => {
  let s = fixture("scourge-beast", "a");
  H(s).position = "tile-14:right";
  s.enemies[0].node = "tile-14:left";
  s = go(s, "END_TURN");
  assert.equal(s.phase, "combat_choose");
  assert.equal(s.enemies[0].node, H(s).position);
});
test("actual dream upgrade replaces one card, spends echoes, refills and returns", () => {
  let s = E.create();
  H(s).echoes = 2;
  s = go(s, "DREAM", { cardId: H(s).hand[0].id });
  assert.equal(s.track, 2);
  assert.equal(s.phase, "upgrade_pick");
  s = go(s, "PICK_UPGRADE", { index: 0 });
  s = go(s, "PICK_UPGRADE", { index: 1 });
  const kind = s.dream.purchased[0].kind;
  s = go(s, "REPLACE_UPGRADE", { replaceId: H(s).deck[0].id });
  s = go(s, "REPLACE_UPGRADE");
  assert.equal(s.phase, "refill");
  assert.equal(s.track, 3);
  assert(H(s).deck.some((x) => x.kind === kind));
  assert.equal(H(s).deck.length, 12);
  s = go(s, "REFILL");
  s = go(s, "RETURN", { node: "tile-14:center", face: 1 });
  assert.equal(H(s).face, 1);
  assert.equal(H(s).hand.length, 3);
});
test("newly spawned beast remains eligible during activation", () => {
  let s = fixture("scourge-beast", "a", "ability", [
    "endurance",
    "strength",
    "skill",
  ]);
  s = go(s, "END_TURN");
  s = go(s, "NO_ATTACK");
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.length, 2);
  assert.equal(s.phase, "combat_choose");
  assert.equal(s.combat.enemyId, "scourge-beast-2");
});
test("same-speed slain beast still resolves double-strike followup", () => {
  let s = fixture(
    "scourge-beast",
    "b",
    "special",
    ["strength", "endurance", "skill"],
    1,
  );
  s.enemies[0].hp = 3;
  s = attack(s, 0);
  s = go(s, "RESOLVE");
  assert.equal(s.enemies.length, 0);
  assert.equal(s.phase, "combat_extra");
  assert.equal(H(s).hp, 4);
  s = go(s, "EXTRA_TAKE");
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).hp, 2);
});
test("four-figure supply pauses on farthest tie and reuses a full-health figure", () => {
  let s = fixture(
    "scourge-beast",
    "a",
    "ability",
    ["endurance", "strength", "skill"],
    1,
  );
  s.enemies = Array.from({ length: 4 }, (_, i) => ({
    ...s.enemies[0],
    id: "scourge-beast-" + (i + 1),
    figure: i + 1,
    hp: i === 3 ? 1 : 4,
  }));
  s = attack(s, 1);
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "spawn_choice");
  assert.equal(s.spawnChoices.length, 4);
  s = go(s, "SPAWN_CHOICE", { enemyId: "scourge-beast-4" });
  assert.equal(s.enemies.length, 4);
  assert.equal(s.enemies.find((e) => e.figure === 4).hp, 4);
  assert.equal(s.phase, "hunter");
});
test("interaction forbids counter and dodge, permits firearm reaction, then completes", () => {
  let s = fixture("huntsman-mob", "a", "basic", [
    "strength",
    "endurance",
    "skill",
  ]);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, lamp: "tile-14:center" });
  assert.equal(s.phase, "combat_react");
  assert.equal(s.combat.origin, "interaction");
  assert(!E.canDodge(s, H(s).hand[0].id, 0));
  assert.throws(() => go(s, "COUNTER", { cardId: H(s).hand[0].id, slot: 0 }));
  s = go(s, "FIREARM");
  s = go(s, "RESOLVE");
  assert.equal(s.phase, "hunter");
  assert.equal(H(s).hp, 6);
});
function tileFixture(s, id) {
  if (!s.world.tilePool.includes(id)) {
    const old = s.world.tileDeck.pop();
    s.world.tilePool.splice(s.world.tilePool.indexOf(old), 1, id);
    s.world.tileDeck.push(id);
  }
  s.world.tileDeck.splice(s.world.tileDeck.indexOf(id), 1);
  s.world.tiles.push({ tileId: id, x: 0, y: -1, rotation: 0 });
  H(s).position = id + ":" + M.tile(id).spaces[0].id;
  for (const e of s.enemies) e.node = H(s).position;
  return s;
}
test("Oedon attack speed reduction does not reduce timed ability speed", () => {
  for (const action of ["basic", "ability"]) {
    let s = tileFixture(fixture("huntsman-mob", "b", action), "tile-17");
    s = attack(s);
    assert.equal(s.combat.action.speed, 1);
  }
});
test("Great Bridge blocks voluntary departure from occupied space", () => {
  let s = tileFixture(fixture(), "tile-18");
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  const next = E.neighbors(s, H(s).position)[0];
  assert(next);
  assert.throws(() => go(s, "STEP", { node: next }), /대교/);
  s = go(s, "STOP_MOVE");
  assert.equal(s.phase, "hunter");
});
test("Cathedral heal interaction and clinic once per turn", () => {
  let s = tileFixture(E.create(), "tile-12");
  H(s).hp = 2;
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, heal: true });
  assert.equal(H(s).hp, 4);
  s = tileFixture(E.create(), "tile-20");
  s = go(s, "CLINIC");
  assert.equal(H(s).hp, 5);
  assert.equal(H(s).hand.length, 4);
  assert.throws(() => go(s, "CLINIC"), /차례마다 한 번/);
});
test("Crypt chooses one of three consumables, returns others, and removes one token", () => {
  let s = tileFixture(E.create(), "tile-19");
  const n = E.nodes(s).find(
    (n) => n.tile === "tile-19" && n.icons.some((i) => i.kind === "consumable"),
  );
  H(s).position = n.id;
  s.loot = [n.id];
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, lootCount: 1 });
  assert.equal(s.phase, "loot_choice");
  assert.equal(s.lootChoice.length, 3);
  const item = s.lootChoice[1];
  s = go(s, "LOOT_CHOICE", { itemId: item.id });
  assert.equal(s.loot.length, 0);
  assert.equal(H(s).consumables[0].id, item.id);
  assert.equal(s.consumableDeck.length, 35);
  assert.equal(s.phase, "hunter");
});
