const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"), R = require("../src/rewards-engine");
const Missions = require("../src/mission-engine");
const H = E.hunter, go = (s, type, a = {}) => E.dispatch(s, { type, ...a });
const create = (seed = 123) => E.create(seed, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
function put(s, id, anchor = M.openExits(s.world)[0]) {
  if (s.world.tiles.some((p) => p.tileId === id)) return;
  const i = s.world.tileDeck.indexOf(id); assert(i >= 0);
  const rotation = M.placementOptions(s.world, id, anchor, false)[0]; assert(rotation !== undefined);
  const [dx, dy] = M.vectors[anchor.edge];
  s.world.tiles.push({ tileId: id, x: anchor.x + dx, y: anchor.y + dy, rotation });
  s.world.tileDeck.splice(i, 1);
}
function hand(s, kinds) {
  const h = H(s); h.deck = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  h.hand = []; h.discard = []; h.slots = [null, null, null];
  for (const kind of kinds) {
    const i = h.deck.findIndex((c) => c.kind === kind); assert(i >= 0);
    h.hand.push(...h.deck.splice(i, 1));
  }
  return s;
}
function moved(s, from, to) {
  H(s).position = from; s.phase = "hunter"; hand(s, ["strength", "endurance", "skill"]);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: to });
  if (s.phase === "move") s = go(s, "STOP_MOVE");
  return s;
}
function deck(s, first) {
  const xs = ["basic", "basic", "basic", "special", "special", "ability"];
  xs.splice(xs.indexOf(first), 1); s.enemyDeck = [first, ...xs]; s.enemyDiscard = [];
}
function encounter(s, id = "mob") {
  const info = { mob: ["tile-04", "tile-04:left", "tile-04:center"],
    shelter: ["tile-17", "tile-17:lower-left", "tile-17:top"],
    main: ["tile-14", "tile-14:left", "tile-14:center"] }[id];
  if (id === "shelter") {
    s.mission.revealed.push(8); s.mission.escort.carrierId = s.activeHunterId;
  }
  if (id === "main") s.mission.completed = [7, 11];
  put(s, info[0]); return moved(s, info[1], info[2]);
}
function attack(s, e, kind = "strength", slot = 0) {
  hand(s, [kind, "endurance", "skill"]);
  return go(s, "ATTACK", { enemyId: e.id, cardId: H(s).hand[0].id, slot });
}
function settleChoices(s) {
  while (s.rewardChoices.length) {
    const q = s.rewardChoices[0];
    s = q.firearmId ? go(s, "KEEP_FIREARM", { firearmId: q.firearmId }) :
      go(s, "KEEP_REWARD", { rewardId: q.rewardId });
  }
  return s;
}
test("campaign is opt-in and both independent and campaign initial saves replay", () => {
  const independent = E.create(321), campaign = create(321);
  assert.equal(independent.mission, undefined);
  assert.deepEqual(campaign.mission.revealed, [1]);
  assert.deepEqual(E.importSave(E.exportSave(independent)), independent);
  assert.deepEqual(E.importSave(E.exportSave(campaign)), campaign);
  const copy = JSON.parse(E.exportSave(campaign)); copy.state.mission.completed = [7];
  assert.throws(() => E.importSave(JSON.stringify(copy)), /명령 기록/);
});
test("real exploration command replay restores a revealed encounter and its spawn token", () => {
  let s;
  for (let seed = 1; seed < 100; seed++) {
    const candidate = create(seed);
    if (candidate.world.tileDeck[0] === "tile-04") { s = candidate; break; }
  }
  assert(s);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "EXPLORE", { edge: "N" });
  s = go(s, "PLACE_TILE", { rotation: M.placementOptions(s.world,
    s.world.pending.tileId, s.world.pending.anchor)[0] });
  if (s.phase === "move") s = go(s, "STOP_MOVE");
  assert(s.mission.revealed.includes(5)); assert(s.mission.revealed.includes(6));
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
test("movement ending anywhere on the mission tile triggers only immediate cards", () => {
  let s = create(); put(s, "tile-04");
  s = moved(s, "tile-04:center", "tile-04:left");
  assert.deepEqual(s.mission.revealed, [1, 5, 6]);
  assert(!s.mission.revealed.includes(7));
  assert.equal(s.enemies[0].node, "tile-04:center");
  assert.equal(s.enemies[0].missionId, "mob");
  assert.equal(E.node(s, "tile-04:center").lamp, false);
  assert.deepEqual(E.missionView(s).fog, ["tile-04"]);
});
test("fog removes ordinary occupants, blocks departure and preserves inner movement", () => {
  let s = create(); put(s, "tile-04");
  s.enemies.push({ id: "scourge-beast-1", kind: "scourge-beast", figure: 1, hp: 4, node: "tile-04:right" });
  s = moved(s, "tile-04:left", "tile-04:center");
  assert(!s.enemies.some((e) => e.kind === "scourge-beast"));
  H(s).position = M.exits(s.world.tiles.find((p) => p.tileId === "tile-04"))
    .find((x) => E.neighbors(s, x.node).some((n) => E.node(s, n).tile !== "tile-04")).node;
  hand(s, ["strength", "endurance", "skill"]);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  const outside = E.neighbors(s, H(s).position).find((n) => E.node(s, n).tile !== "tile-04");
  assert.throws(() => go(s, "STEP", { node: outside }), /안개/);
  assert.throws(() => go(s, "EXPLORE", { edge: M.openExits(s.world).find((x) => x.node === H(s).position)?.edge }), /출입구|안개/);
});
test("first lethal strike spends revival token without echoes, kill effects or cancelling slower attack", () => {
  let s = encounter(create()); const e = s.enemies[0]; e.hp = 2;
  s.world.assignments.find((a) => a.enemyId === e.kind).sideId = "a";
  deck(s, "basic"); s = attack(s, e);
  const hp = H(s).hp; s = go(s, "RESOLVE");
  assert.equal(s.enemies[0].hp, 4); assert.equal(s.mission.targets.mob.tokens, 0);
  assert.equal(s.kills, 0); assert.equal(H(s).echoes, 0); assert(H(s).hp < hp);
  assert(!s.mission.revealed.includes(7));
});
test("final mission kill yields insight and rewards once, restores lamp and fog", () => {
  let s = encounter(create()); const e = s.enemies[0]; e.hp = 2; s.mission.targets.mob.tokens = 0;
  deck(s, "basic"); s = go(attack(s, e), "RESOLVE");
  assert.equal(s.kills, 1); assert.equal(E.missionView(s).insight, 1);
  assert.deepEqual(s.mission.completed, [7]); assert.equal(s.mission.fog.length, 0);
  assert.equal(E.node(s, "tile-04:center").lamp, true);
  assert(H(s).rewards.some((r) => r.kind === "lantern")); assert(H(s).ownedFirearms.includes("ludwig-rifle"));
  s = settleChoices(s); s = moved(s, "tile-04:center", "tile-04:left");
  assert.equal(s.mission.revealed.filter((n) => n === 7).length, 1);
});
test("reset restores mission target and revival tokens before ordinary spawns", () => {
  let s = encounter(create()); s.mission.targets.mob.tokens = 0;
  s.track = 3; // advance to first printed reset at 4
  s = go(s, "DREAM", { cardId: H(s).hand[0].id });
  while (s.phase === "spawn_choice") s = go(s, "SPAWN_CHOICE", { enemyId: s.spawnChoices[0] });
  assert.equal(s.mission.targets.mob.tokens, 1);
  assert.equal(s.enemies.filter((e) => E.node(s, e.node).tile === "tile-04").length, 1);
  assert.equal(s.enemies.find((e) => e.missionId === "mob").node, "tile-04:center");
});
test("escort pickup is optional, only while leaving its named space, and teleport returns it", () => {
  let s = create(); put(s, "tile-11"); put(s, "tile-17");
  s = moved(s, "tile-11:house", "tile-11:street");
  assert.equal(s.mission.escort.node, "tile-11:house");
  H(s).position = "tile-11:house"; hand(s, ["strength", "endurance", "skill"]);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id }); s = go(s, "MISSION_PICKUP");
  s = go(s, "STEP", { node: "tile-11:street" }); s = go(s, "STOP_MOVE");
  assert.equal(s.mission.escort.carrierId, s.activeHunterId);
  const item = s.consumableDeck.find((i) => i.kind === "bold-mark");
  H(s).consumables.push(...s.consumableDeck.splice(s.consumableDeck.indexOf(item), 1));
  s = go(s, "USE_CONSUMABLE", { itemId: item.id, node: "tile-17:top" });
  assert.equal(s.mission.escort.node, "tile-11:house"); assert.equal(s.mission.escort.carrierId, null);
  assert(!s.mission.revealed.includes(9));
});
test("shelter enemy ignores chapel speed effect and wounded special adds two damage", () => {
  let s = encounter(create(), "shelter"), e = s.enemies[0];
  assert.deepEqual(s.mission.revealed, [1, 8, 9, 10]);
  assert.equal(E.enemyDef(s, e).special.damage, 2); e.hp = 3;
  assert.equal(E.enemyDef(s, e).special.damage, 4);
  deck(s, "special"); s = attack(s, e);
  assert.equal(s.combat.action.speed, 3); assert.equal(s.combat.action.damage, 4);
});
test("shelter final kill offers a separate speed-one death dodge", () => {
  let s = encounter(create(), "shelter"), e = s.enemies[0]; e.hp = 1; s.mission.targets.shelter.tokens = 0;
  deck(s, "basic"); s = go(attack(s, e), "RESOLVE");
  assert.equal(s.phase, "mission_death"); assert(s.mission.completed.includes(11));
  const choice = E.missionActions(s).find((x) => x.command.type === "MISSION_DEATH_DODGE");
  assert(choice); const hp = H(s).hp; s = E.dispatch(s, choice.command);
  assert.equal(H(s).hp, hp); assert.equal(s.phase, "hunter");
});
test("main trigger counts completed white insight cards, main ability replaces either enemy face", () => {
  let s = create(); s.mission.completed = [7];
  s = moved(s, "tile-14:left", "tile-14:center"); assert(!s.mission.revealed.includes(2));
  s.mission.completed.push(11); s = moved(s, "tile-14:left", "tile-14:center");
  assert.deepEqual(s.mission.revealed, [1, 2, 3]);
  const e = s.enemies[0]; deck(s, "ability"); s = attack(s, e);
  assert.equal(s.combat.action.type, "attack"); assert.equal(s.combat.action.speed, 3);
  assert.equal(s.combat.action.damage, 3); assert(s.combat.action.uninterruptible);
  assert(s.combat.action.interrupt); assert(s.combat.action.stun);
  assert.equal(E.canFirearm(s), false);
});
test("main final kill enters last dream without moving hunt track and preserves campaign progression", () => {
  let s = encounter(create(), "main"), e = s.enemies[0]; e.hp = 1; s.mission.targets.main.tokens = 0;
  s.track = 16; s.lastRound = true; deck(s, "basic");
  s = go(attack(s, e), "RESOLVE"); s = settleChoices(s);
  assert(s.mission.won); assert.equal(s.phase, "upgrade_pick"); assert.equal(s.track, 16);
  s = go(s, "PICK_UPGRADE", { index: s.market.findIndex(Boolean) });
  s = go(s, "REPLACE_UPGRADE", { replaceId: H(s).deck[0].id });
  assert.equal(s.phase, "over"); assert.equal(s.result, "chapter-win"); assert.equal(H(s).hp, 6);
  assert(H(s).rewards.some((r) => r.kind === "bloodstone-shard"));
  assert(s.mission.completed.includes(4)); E.assertState(s);
});
test("rescue interaction starts four-space escape with exploration then turn-end one-space escape", () => {
  let s = create(); put(s, "tile-03");
  s = moved(s, "tile-03:entry", "tile-03:room");
  assert(E.interactionOptions(s).missionRescue);
  hand(s, ["strength", "endurance", "skill"]);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, mission: "rescue" });
  assert.equal(s.phase, "mission_survivor"); assert.equal(s.mission.survivor.remaining, 4);
  let explored = false;
  while (["mission_survivor", "tile_place", "spawn_choice"].includes(s.phase)) {
    if (s.phase === "tile_place") {
      assert(s.world.pending.survivor); explored = true;
      s = go(s, "PLACE_TILE", { rotation: M.placementOptions(s.world, s.world.pending.tileId, s.world.pending.anchor)[0] });
    } else if (s.phase === "spawn_choice") s = go(s, "SPAWN_CHOICE", { enemyId: s.spawnChoices[0] });
    else {
      const xs = E.missionActions(s), a = xs.find((x) => x.command.type === "MISSION_SURVIVOR_EXPLORE") || xs[0];
      s = E.dispatch(s, a.command);
    }
  }
  assert.equal(s.mission.survivor.remaining, 0); assert.equal(s.phase, "hunter"); assert(explored);
  s.enemies = []; s = go(s, "END_TURN");
  if (s.phase === "mission_survivor") {
    assert.equal(s.mission.survivor.remaining, 1);
    assert(!E.missionActions(s).some((a) => a.command.type === "MISSION_SURVIVOR_EXPLORE"));
    s = E.dispatch(s, E.missionActions(s)[0].command);
  }
  assert.equal(s.phase, "refill");
});
test("rescue catch rejects actual pursuit into end space and exposes only selected reward branch", () => {
  let s = create(); put(s, "tile-03"); s.mission.revealed.push(12, 13);
  s.mission.survivor.node = "tile-14:center"; H(s).position = "tile-14:left";
  s.enemies = [{ id: "scourge-beast-1", kind: "scourge-beast", figure: 1, hp: 4, node: "tile-14:left" }];
  s = moved(s, "tile-14:left", "tile-14:center"); assert(!s.mission.revealed.includes(14));
  s.enemies = []; s = moved(s, "tile-14:left", "tile-14:center");
  assert.equal(s.phase, "mission_choice");
  s = go(s, "MISSION_CHOICE", { choice: "release" });
  assert(s.mission.revealed.includes(16)); assert(!s.mission.revealed.includes(15));
  assert.equal(E.missionView(s).insight, 1); assert(H(s).rewards.some((r) => r.kind === "rune-eye"));
});
test("simultaneous chapter victory and hunter death still permits the mandatory shard slot choice", () => {
  let s = encounter(create(), "main"), e = s.enemies[0];
  e.hp = 1; s.mission.targets.main.tokens = 0; H(s).hp = 1;
  deck(s, "basic"); s = go(attack(s, e), "RESOLVE");
  assert(s.mission.won); assert.equal(H(s).hp, 6);
  const shard = H(s).rewards.find((r) => r.kind === "bloodstone-shard");
  assert(s.rewardChoices.some((q) => q.rewardId === shard.id));
  s = go(s, "EQUIP_REWARD", { rewardId: shard.id, slot: 1 });
  assert.equal(s.rewardChoices.length, 0);
  assert.equal(H(s).rewards.find((r) => r.id === shard.id).slot, 1);
  assert.equal(s.phase, "over"); assert.equal(s.result, "chapter-win"); E.assertState(s);
});
test("fog blocks the shelter beast roar from spawning a normal beast inside the encounter", () => {
  let s = encounter(create(), "shelter"), e = s.enemies[0];
  s.world.assignments.find((a) => a.enemyId === "scourge-beast").sideId = "a";
  deck(s, "ability"); s = go(attack(s, e), "RESOLVE");
  assert.equal(s.phase, "hunter"); assert.equal(s.enemies.length, 1);
  assert.equal(s.enemies[0].missionId, "shelter");
  assert.equal(s.mission.targets.shelter.tokens, 1);
});
test("faster hunter damage makes the shelter beast wounded before its slower special hits", () => {
  let s = encounter(create(), "shelter"), e = s.enemies[0];
  hand(s, ["strength", "endurance", "skill"]);
  const x = H(s).hand[0]; s.removedCards.push(x.kind); x.kind = "nimble";
  let i = s.upgradeDeck.indexOf("nimble");
  if (i >= 0) s.upgradeDeck.splice(i, 1);
  else { i = s.market.indexOf("nimble"); assert(i >= 0); s.market[i] = s.upgradeDeck.shift(); }
  deck(s, "special");
  s = go(s, "ATTACK", { enemyId: e.id, cardId: x.id, slot: 0 });
  assert.equal(s.combat.attack.speed, 4); assert.equal(s.combat.action.speed, 3);
  assert.equal(s.combat.action.damage, 2); // beast is healthy when the card is exposed
  s = go(s, "RESOLVE");
  assert.equal(s.enemies[0].hp, 2); assert.equal(H(s).hp, 2); // strike becomes four damage
});
test("NPC circular exploration filters shortcut rotations while preserving ordinary exploration", () => {
  let s = create(4);
  s.world.tiles = [{ tileId: "tile-14", x: 0, y: 0, rotation: 0 },
    { tileId: "tile-04", x: 0, y: 1, rotation: 3 },
    { tileId: "tile-11", x: 1, y: 1, rotation: 0 }];
  s.world.tileDeck = s.world.tilePool.filter((id) => !s.world.tiles.some((p) => p.tileId === id));
  s.mission.revealed.push(12, 13);
  Object.assign(s.mission.survivor, { node: "tile-11:street", remaining: 2, exploring: true });
  s.phase = "mission_survivor";
  assert.equal(E.distance(s, "tile-11:street", H(s).position), 3);
  const anchor = M.openExits(s.world).find((x) => x.node === "tile-11:street" && x.edge === "N");
  const pending = { tileId: "tile-17", anchor, survivor: true };
  const normal = M.placementOptions(s.world, pending.tileId, anchor, false);
  assert(normal.includes(2));
  const helpers = { distance: E.distance };
  const allowed = Missions.placementOptions(s, helpers, pending, false);
  assert(!allowed.includes(2));
  assert(allowed.length > 0);
  for (const rotation of allowed) {
    const projected = structuredClone(s);
    const placed = { tileId: "tile-17", x: 1, y: 0, rotation };
    projected.world.tiles.push(placed);
    const entry = M.exits(placed).find((x) => x.edge === "S").node;
    assert(E.distance(projected, entry, H(s).position) > 3);
  }
  assert.deepEqual(Missions.placementOptions(s, helpers, { ...pending, survivor: false }, false), normal);
  const placing = structuredClone(s);
  placing.world.pending = pending;
  placing.world.tileDeck = placing.world.tileDeck.filter((id) => id !== "tile-17");
  placing.mission.survivor.minimumDistance = 4;
  placing.phase = "tile_place";
  const before = JSON.stringify(placing);
  assert.throws(() => go(placing, "PLACE_TILE", { rotation: 2 }), /생존자|방향/);
  assert.equal(JSON.stringify(placing), before); // rejected placement rolls back tile and spawns
  const placed = go(placing, "PLACE_TILE", { rotation: allowed[0] });
  assert(E.distance(placed, placed.mission.survivor.node, H(placed).position) >= 4);
});
