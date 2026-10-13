const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js"),
  D = E.data;
const training = (seed = 20261011) => E.create(seed, "training");
const h = (s) => E.hunter(s),
  cmd = (s, type, a = {}) => E.dispatch(s, { type, ...a });
function hand(s, types) {
  const p = h(s),
    all = [...p.hand, ...p.deck, ...p.discard, ...p.slots.filter(Boolean)];
  p.hand = [];
  p.discard = [];
  p.slots = [null, null, null];
  for (const type of types) {
    const i = all.findIndex((c) => c.kind === type);
    assert(i >= 0);
    p.hand.push(all.splice(i, 1)[0]);
  }
  p.deck = all;
  return s;
}
function action(s, type) {
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
  const i = s.enemyDeck.indexOf(type);
  s.enemyDeck.splice(i, 1);
  s.enemyDeck.unshift(type);
  return s;
}
function duel(
  types = ["strength", "endurance", "skill"],
  kind = "scout",
  act = "basic",
) {
  const s = hand(action(training(41), act), types),
    e = s.enemies.find((e) => e.kind === kind);
  h(s).position = e.node;
  return { s, id: e.id };
}
function attack(s, id, slot = 0) {
  return cmd(s, "ATTACK", { enemyId: id, cardId: h(s).hand[0].id, slot });
}
test("initial deck, health, track and six enemy behavior cards", () => {
  const s = training();
  assert.equal(h(s).hp, 6);
  assert.equal(h(s).hand.length, 3);
  assert.equal(h(s).deck.length, 9);
  assert.equal(s.track, 1);
  assert.equal(s.enemyDeck.length, 6);
  E.assertState(s);
});
test("rejected action leaves original state unchanged", () => {
  const s = training(),
    before = JSON.stringify(s);
  assert.throws(() =>
    cmd(s, "ATTACK", { enemyId: "scout-1", cardId: h(s).hand[0].id, slot: 0 }),
  );
  assert.equal(JSON.stringify(s), before);
});
test("same command sequence and seed reproduce the same state", () => {
  const run = () => {
    let s = training(88);
    s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
    s = cmd(s, "STEP", { node: "c1" });
    s = cmd(s, "STOP_MOVE");
    return s;
  };
  assert.deepEqual(run(), run());
});
test("one movement costs one card and allows two steps", () => {
  let s = training();
  s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
  assert.equal(h(s).hand.length, 2);
  s = cmd(s, "STEP", { node: "c1" });
  assert.throws(() => cmd(s, "TRANSFORM", { cardId: h(s).hand[0].id }));
  s = cmd(s, "STEP", { node: "e0" });
  assert.equal(s.phase, "hunter");
  assert.equal(h(s).position, "e0");
  assert.equal(h(s).hand.length, 2);
});
test("leaving a tile attracts an enemy in another space of that tile", () => {
  let s = training();
  h(s).position = "w0";
  s.enemies[0].node = "w1";
  s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
  s = cmd(s, "STEP", { node: "c1" });
  s = cmd(s, "STEP", { node: "c0" });
  assert.equal(s.enemies[0].node, "w0");
});
test("discarding a vitality card for movement does not draw", () => {
  let s = hand(training(), ["vitality", "skill", "endurance"]);
  s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
  assert.equal(h(s).hand.length, 2);
});
test("attack card is placed before enemy behavior is revealed", () => {
  let { s, id } = duel();
  s = attack(s, id, 0);
  assert.equal(s.phase, "combat_react");
  assert.equal(h(s).slots[0].kind, "strength");
  assert.equal(s.enemyDiscard.length, 1);
  assert.equal(s.combat.attack.damage, 2);
});
test("vitality draws immediately when placed", () => {
  let { s, id } = duel(["vitality", "skill", "strength"]);
  s = attack(s, id, 0);
  assert.equal(h(s).hand.length, 3);
});
test("endurance clears its own slot even when used to attack", () => {
  let { s, id } = duel(["endurance", "endurance", "strength"]);
  s = attack(s, id, 0);
  assert.equal(h(s).slots[0], null);
  s = cmd(s, "DODGE", { cardId: h(s).hand[0].id, slot: 0 });
  assert.equal(s.combat.dodged, true);
  assert.equal(h(s).slots[0], null);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 6);
  assert.equal(s.enemies.find((e) => e.id === id).hp, 2);
});
test("dodge requires equal or faster free slot", () => {
  let { s, id } = duel();
  s = attack(s, id, 1);
  assert.throws(() => cmd(s, "DODGE", { cardId: h(s).hand[0].id, slot: 2 }));
  s = cmd(s, "DODGE", { cardId: h(s).hand[0].id, slot: 0 });
  assert.equal(s.combat.dodged, true);
});
test("faster interrupt cancels slower attack", () => {
  let { s, id } = duel(["skill", "endurance", "strength"], "sentinel");
  s = attack(s, id, 0);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 6);
  assert.equal(s.enemies.find((e) => e.id === id).hp, 3);
});
test("equal-speed ordinary interrupt does not cancel", () => {
  let { s, id } = duel(["skill", "endurance", "strength"]);
  s = attack(s, id, 0);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 5);
});
test("equal speeds inflict simultaneous lethal damage and lose all echoes", () => {
  let { s, id } = duel();
  h(s).hp = 1;
  h(s).echoes = 2;
  s.enemies[0].hp = 2;
  s = attack(s, id, 0);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).echoes, 0);
  assert.equal(h(s).inDream, true);
  assert.equal(h(s).hp, 6);
  assert(!s.enemies.some((e) => e.id === id));
  assert.equal(s.track, 3);
});
test("faster lethal enemy attack prevents slower hunter attack", () => {
  let { s, id } = duel();
  h(s).hp = 1;
  s = attack(s, id, 2);
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies.find((e) => e.id === id).hp, 3);
  assert(h(s).inDream);
});
test("stun pauses before slower hunter strike for player discard", () => {
  let { s, id } = duel(["strength", "endurance", "skill"], "scout", "special");
  s = attack(s, id, 2);
  s = cmd(s, "RESOLVE");
  assert.equal(s.phase, "stun");
  assert.equal(s.enemies.find((e) => e.id === id).hp, 3);
  s = cmd(s, "STUN_DISCARD", { cardId: h(s).hand[0].id });
  assert(!s.enemies.some((e) => e.id === id));
  assert.equal(h(s).hand.length, 1);
});
test("stun with empty hand deals extra damage", () => {
  let { s, id } = duel(["strength"], "scout", "special");
  s = attack(s, id, 2);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 3);
});
test("basic firearm works once and does not require a faster slot", () => {
  let { s, id } = duel();
  s = attack(s, id, 2);
  s = cmd(s, "FIREARM");
  assert.throws(() => cmd(s, "FIREARM"));
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 6);
  assert.equal(h(s).firearmReady, false);
});
test("firearm cannot interrupt a special attack or dedicated ability", () => {
  for (const type of ["special", "ability"]) {
    let { s, id } = duel(undefined, "scout", type);
    s = attack(s, id, 0);
    assert.throws(() => cmd(s, "FIREARM"));
  }
});
test("ability is immediate and not dodgeable", () => {
  let { s, id } = duel(undefined, "sentinel", "ability");
  s = attack(s, id, 1);
  assert.equal(h(s).status.frenzy, true);
  assert.throws(() => cmd(s, "DODGE", { cardId: h(s).hand[0].id, slot: 0 }));
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 6);
});
test("frenzy raises incoming attack damage", () => {
  let { s, id } = duel();
  h(s).status.frenzy = true;
  s = attack(s, id, 0);
  s = cmd(s, "RESOLVE");
  assert.equal(h(s).hp, 4);
});
test("poison applies at hunter turn end before enemy activation", () => {
  let s = training();
  h(s).status.poison = true;
  s = cmd(s, "END_TURN");
  assert.equal(h(s).hp, 5);
  assert.equal(s.phase, "refill");
});
test("lethal poison aborts enemy activation and moves to dream", () => {
  let s = training();
  h(s).status.poison = true;
  h(s).hp = 1;
  s = cmd(s, "END_TURN");
  assert(h(s).inDream);
  assert.equal(s.phase, "refill");
});
test("enemy activation uses neighboring tiles and rank, not 1-space distance", () => {
  let s = training();
  s = cmd(s, "END_TURN");
  assert.equal(s.enemies[0].node, "c1");
  assert.equal(s.enemies[1].node, "c1");
  assert.equal(s.phase, "refill");
  const moves = s.events.filter((e) => e.text.includes("사냥꾼을 향해"));
  assert(moves[0].text.startsWith("훈련 감시자"));
  assert(moves[1].text.startsWith("훈련 파수꾼"));
});
test("enemy behavior is hidden until counterattack decision", () => {
  let s = training();
  h(s).position = "w0";
  s = cmd(s, "END_TURN");
  assert.equal(s.phase, "combat_choose");
  assert.equal(s.combat.action, null);
  assert.equal(s.enemyDiscard.length, 0);
  s = cmd(s, "NO_ATTACK");
  assert.equal(s.phase, "combat_react");
  assert.equal(s.enemyDiscard.length, 1);
});
test("interacting with enemies disallows attack and dodge; death denies loot", () => {
  let s = hand(action(training(), "basic"), ["skill", "endurance", "strength"]);
  h(s).position = "w1";
  h(s).hp = 1;
  s.enemies[0].node = "w1";
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert.equal(s.combat.origin, "interaction");
  assert.throws(() => cmd(s, "DODGE", { cardId: h(s).hand[0].id, slot: 0 }));
  assert.throws(() => cmd(s, "COUNTER", { cardId: h(s).hand[0].id, slot: 0 }));
  s = cmd(s, "RESOLVE");
  assert(h(s).inDream);
  assert(s.loot.includes("w1"));
  assert.equal(h(s).consumables.length, 1);
});
test("transform switches faces and clears occupied slots", () => {
  let { s, id } = duel();
  s = attack(s, id, 0);
  s = cmd(s, "RESOLVE");
  const before = h(s).discard.length;
  s = cmd(s, "TRANSFORM", { cardId: h(s).hand[0].id });
  assert.equal(h(s).face, 1);
  assert(h(s).slots.every((x) => x === null));
  assert.equal(h(s).discard.length, before + 2);
});
test("dream resets status, firearm, health, all zones and advances track twice", () => {
  let s = training();
  h(s).hp = 2;
  h(s).firearmReady = false;
  h(s).status = { poison: true, frenzy: true };
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(s.track, 3);
  assert.equal(h(s).hp, 6);
  assert.equal(h(s).deck.length, 12);
  assert.equal(h(s).hand.length, 0);
  assert.equal(h(s).firearmReady, true);
  assert.deepEqual(h(s).status, { poison: false, frenzy: false });
  s = cmd(s, "REFILL");
  assert.equal(s.phase, "return");
  s = cmd(s, "RETURN", { node: "c0", face: 1 });
  assert.equal(h(s).face, 1);
  assert.equal(h(s).inDream, false);
});
test("dream spends all echoes, replenishes market and maintains 12 cards", () => {
  let s = training();
  h(s).echoes = 2;
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(s.phase, "upgrade_pick");
  assert.equal(h(s).echoes, 0);
  const deckSize = s.upgradeDeck.length;
  s = cmd(s, "PICK_UPGRADE", { index: 0 });
  assert.equal(s.upgradeDeck.length, deckSize - 1);
  assert.equal(s.market.length, 4);
  s = cmd(s, "PICK_UPGRADE", { index: 1 });
  assert.equal(s.phase, "upgrade_replace");
  s = cmd(s, "REPLACE_UPGRADE", { replaceId: h(s).deck[0].id });
  assert.equal(h(s).deck.length, 12);
  s = cmd(s, "REPLACE_UPGRADE");
  assert.equal(s.phase, "refill");
  assert.equal(h(s).deck.length, 12);
});
test("map reset restores enemies and loot but retains training mission progress", () => {
  let s = training();
  s.track = 4;
  s.enemies = [];
  s.loot = [];
  s.mission.guardDown = true;
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(s.enemies.length, 2);
  assert.equal(s.loot.length, 2);
  assert.equal(s.track, 6);
  assert(s.mission.guardDown);
});
test("reaching final track through a dream starts a final round instead of losing", () => {
  let s = training();
  s.track = 15;
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(s.track, 16);
  assert.equal(s.phase, "refill");
  assert.equal(s.lastRound, true);
  assert.equal(s.result, null);
  s = cmd(s, "REFILL");
  s = cmd(s, "RETURN", { node: "c0", face: 0 });
  s = cmd(s, "DREAM", { cardId: h(s).hand[0].id });
  assert.equal(s.result, "loss");
});
test("refill allows player to keep cards and does not clear slots", () => {
  let s = training();
  s.phase = "refill";
  const kept = h(s).hand[0].id,
    discard = h(s).hand[1].id;
  h(s).slots[0] = h(s).hand.pop();
  s = cmd(s, "REFILL", { discardIds: [discard] });
  assert(h(s).hand.some((x) => x.id === kept));
  assert.equal(h(s).hand.length, 3);
  assert(h(s).slots[0]);
});
test("training mission cannot be collected before the sentinel defeat", () => {
  let s = training();
  h(s).position = "e1";
  s.loot = [];
  assert.throws(() => cmd(s, "INTERACT", { cardId: h(s).hand[0].id }));
  s.mission.guardDown = true;
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert(s.mission.seal);
  h(s).position = "c0";
  s = cmd(s, "INTERACT", { cardId: h(s).hand[0].id });
  assert.equal(s.result, "win");
});
test("saved game round-trips, replays and rejects corrupted state", () => {
  let s = training();
  s = cmd(s, "MOVE", { cardId: h(s).hand[0].id });
  s = cmd(s, "STEP", { node: "c1" });
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  const payload = JSON.parse(E.exportSave(s));
  payload.state.hunters["hunter-1"].hp = 5;
  assert.throws(() => E.importSave(JSON.stringify(payload)));
  assert.throws(() => E.importSave("{broken"));
  assert.throws(() => E.importSave(JSON.stringify({ version: 2 })));
});
test("only the active hunter may issue a command", () => {
  let s = training();
  assert.throws(() => cmd(s, "END_TURN", { hunterId: "hunter-2" }));
});
test("same-speed stun remains payable even if the enemy is killed", () => {
  let { s, id } = duel(["strength", "endurance", "skill"], "scout", "special");
  s.enemies[0].hp = 3;
  s = attack(s, id, 1);
  s = cmd(s, "RESOLVE");
  assert.equal(s.phase, "stun");
  assert(!s.enemies.some((e) => e.id === id));
  s = cmd(s, "STUN_DISCARD", { cardId: h(s).hand[0].id });
  assert.equal(s.phase, "hunter");
});

function burial(face = 0, types = ["strength", "endurance", "vitality"]) {
  return hand(action(E.create(41, "burial", face), "basic"), types);
}
test("Burial Blade has the six printed attack profiles", () => {
  const s = E.create();
  assert.equal(E.weapon(s).name, "장송의 칼날");
  assert.deepEqual(
    E.slots(s).map((x) => [x.speed, x.damage]),
    [
      [3, 1],
      [2, 2],
      [2, 2],
    ],
  );
  assert.deepEqual(
    E.slots(E.create(41, "burial", 1)).map((x) => [x.speed, x.damage]),
    [
      [2, 2],
      [1, 3],
      [1, 3],
    ],
  );
});
test("front splash hits another enemy in the same space but excludes the direct target", () => {
  let s = burial();
  h(s).position = "c1";
  s.enemies.forEach((e) => (e.node = "c1"));
  s = attack(s, "scout-1", 0);
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies.find((e) => e.id === "scout-1").hp, 1);
  assert.equal(s.enemies.find((e) => e.id === "sentinel-1").hp, 3);
});
test("front splash includes distance one and excludes distance two", () => {
  for (const [where, expected] of [
    ["e0", 3],
    ["e1", 4],
  ]) {
    let s = burial();
    h(s).position = "c1";
    s.enemies[0].node = "c1";
    s.enemies[1].node = where;
    s = attack(s, "scout-1", 0);
    s = cmd(s, "RESOLVE");
    assert.equal(s.enemies[1].hp, expected);
  }
});
test("front splash is fixed at 1 rather than increased by the strength card", () => {
  let s = burial();
  h(s).position = "c1";
  s.enemies.forEach((e) => (e.node = "c1"));
  s = attack(s, "scout-1", 1);
  s = cmd(s, "RESOLVE");
  assert(!s.enemies.some((e) => e.id === "scout-1"));
  assert.equal(s.enemies[0].hp, 3);
});
test("splash is not applied on declaration or dodge without an attack", () => {
  let s = burial();
  h(s).position = "c1";
  s.enemies[0].node = "c1";
  s.enemies[1].node = "e0";
  s = cmd(s, "END_TURN");
  s = cmd(s, "NO_ATTACK");
  const ec = h(s).hand.find((c) => c.kind === "endurance");
  s = cmd(s, "DODGE", { cardId: ec.id, slot: 0 });
  assert.equal(s.enemies[1].hp, 4);
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies[1].hp, 4);
});
test("front splash shares its attack speed and is cancelled by faster interrupt", () => {
  let s = burial();
  h(s).position = "c1";
  s.enemies[0].node = "c1";
  s.enemies[1].node = "e0";
  s = attack(s, "scout-1", 1);
  assert.equal(s.enemies[1].hp, 4);
  s.combat.action.interrupt = true;
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies[0].hp, 3);
  assert.equal(s.enemies[1].hp, 4);
});
test("multiple kills grant one echo per enemy capped at three", () => {
  let s = burial();
  h(s).position = "c1";
  h(s).echoes = 2;
  s.enemies.forEach((e) => {
    e.node = "c1";
    e.hp = 1;
  });
  s = attack(s, "scout-1", 0);
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies.length, 0);
  assert.equal(h(s).echoes, 3);
  assert(s.mission.guardDown);
});
test("simultaneous hunter death still resolves splash then loses all echoes", () => {
  let s = burial();
  h(s).position = "c1";
  h(s).hp = 1;
  s.enemies.forEach((e) => {
    e.node = "c1";
    e.hp = 1;
  });
  s = attack(s, "scout-1", 0);
  s = cmd(s, "RESOLVE");
  assert.equal(s.enemies.length, 0);
  assert.equal(h(s).echoes, 0);
  assert(h(s).inDream);
});
test("back pulls several selected enemies before declaring a direct target", () => {
  let s = burial(1);
  const originalHP = s.enemies.map((e) => e.hp);
  s = cmd(s, "ATTACK", {
    cardId: h(s).hand[0].id,
    slot: 0,
    enemyId: "scout-1",
    pullIds: ["scout-1", "sentinel-1"],
  });
  assert(s.enemies.every((e) => e.node === "c0"));
  assert.deepEqual(
    s.enemies.map((e) => e.hp),
    originalHP,
  );
  assert.equal(s.combat.enemyId, "scout-1");
  assert.equal(s.combat.attack.splash, null);
});
test("back leaves unselected enemies in place and accepts zero pulls", () => {
  let s = burial(1);
  h(s).position = "w0";
  const other = s.enemies[1].node;
  s = cmd(s, "ATTACK", {
    cardId: h(s).hand[0].id,
    slot: 0,
    enemyId: "scout-1",
    pullIds: [],
  });
  assert.equal(s.enemies[1].node, other);
});
test("pull selection never grants movement if an attack is invalid", () => {
  const s = burial(1),
    before = JSON.stringify(s);
  assert.throws(() =>
    cmd(s, "ATTACK", {
      cardId: "missing",
      slot: 0,
      enemyId: "scout-1",
      pullIds: ["scout-1"],
    }),
  );
  assert.equal(JSON.stringify(s), before);
  assert.throws(() =>
    cmd(s, "ATTACK", {
      cardId: h(s).hand[0].id,
      slot: 0,
      enemyId: "scout-1",
      pullIds: ["scout-1", "scout-1"],
    }),
  );
  assert.equal(JSON.stringify(s), before);
});
test("pull rejects enemies beyond two graph spaces and is unavailable on the front", () => {
  let s = burial(1);
  s.enemies[0].node = "w1";
  assert.throws(() =>
    cmd(s, "ATTACK", {
      cardId: h(s).hand[0].id,
      slot: 0,
      enemyId: "scout-1",
      pullIds: ["scout-1"],
    }),
  );
  s = burial(0);
  assert.throws(() =>
    cmd(s, "ATTACK", {
      cardId: h(s).hand[0].id,
      slot: 0,
      enemyId: "scout-1",
      pullIds: ["scout-1"],
    }),
  );
});
test("back pull also works when counterattacking during enemy activation", () => {
  let s = burial(1);
  h(s).position = "c1";
  s = cmd(s, "END_TURN");
  assert.equal(s.combat.enemyId, "scout-1");
  s = cmd(s, "COUNTER", {
    cardId: h(s).hand[0].id,
    slot: 0,
    pullIds: ["sentinel-1"],
  });
  assert.equal(s.combat.enemyId, "scout-1");
  assert.equal(s.enemies[1].node, "c1");
});
test("not counterattacking never activates the pull ability", () => {
  let s = burial(1);
  h(s).position = "c1";
  s = cmd(s, "END_TURN");
  s = cmd(s, "NO_ATTACK", { pullIds: ["sentinel-1"] });
  assert.equal(s.enemies[1].node, "e0");
});
test("save replay retains starting weapon, face, chosen pulls and unresolved combat", () => {
  let s = E.create(20261011, "burial", 1);
  s = cmd(s, "ATTACK", {
    cardId: h(s).hand[0].id,
    slot: 0,
    enemyId: "scout-1",
    pullIds: ["scout-1", "sentinel-1"],
  });
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
