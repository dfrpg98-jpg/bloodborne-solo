const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), M = require("../chapter-engine");
const Missions = require("../mission-engine"), D = require("../hunt-data");
const H = E.hunter, go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function next(s, completed) {
  s.mission.won = true; s.mission.completed = [...completed]; s.phase = "between_chapters";
  return go(s, "START_NEXT_CHAPTER", { startSpace: "center" });
}
function chapter(n, prior = [], ch1 = []) {
  let s = E.create(17, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 8 });
  s = next(s, ch1);
  return n === 2 ? s : next(s, prior);
}
function put(s, id) {
  if (s.world.tiles.some((p) => p.tileId === id)) return;
  const i = s.world.tileDeck.indexOf(id); assert(i >= 0, id);
  for (const anchor of M.openExits(s.world)) {
    const rotation = M.placementOptions(s.world, id, anchor, false)[0];
    if (rotation === undefined) continue;
    const [dx, dy] = M.vectors[anchor.edge];
    s.world.tiles.push({ tileId: id, x: anchor.x + dx, y: anchor.y + dy, rotation });
    s.world.tileDeck.splice(i, 1); return;
  }
  assert.fail(`cannot place ${id}`);
}
function hand(s) {
  const h = H(s); h.deck = [...h.hand, ...h.deck, ...h.discard, ...h.slots.filter(Boolean)];
  h.hand = []; h.discard = []; h.slots = [null, null, null];
  for (const kind of ["strength", "endurance", "skill"])
    h.hand.push(...h.deck.splice(h.deck.findIndex((c) => c.kind === kind), 1));
}
function moveEnd(s, tile) {
  put(s, tile); const [a, b] = M.tile(tile).adjacency[0];
  H(s).position = `${tile}:${a}`; s.phase = "hunter"; hand(s);
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: `${tile}:${b}` });
  return s.phase === "move" ? go(s, "STOP_MOVE") : s;
}
function item(s, kind = "blood-vial") {
  const i = s.consumableDeck.findIndex((x) => x.kind === kind); assert(i >= 0, kind);
  const [x] = s.consumableDeck.splice(i, 1); H(s).consumables.push(x); return x;
}
function attack(s, e, first = "basic") {
  H(s).position = e.node; H(s).hp = 6; s.phase = "hunter"; hand(s);
  const xs = ["basic", "basic", "basic", "special", "special", "ability"];
  xs.splice(xs.indexOf(first), 1); s.enemyDeck = [first, ...xs]; s.enemyDiscard = [];
  if (e.bossDecks) {
    const boss = ["basic", "basic", "special", "special", "ability", "recover"];
    boss.splice(boss.indexOf(first), 1);
    e.bossDecks[e.componentPhase - 1] = { draw: [first, ...boss], discard: [] };
  }
  s = go(s, "ATTACK", { enemyId: e.id, cardId: H(s).hand[0].id, slot: 0 });
  return go(s, "RESOLVE");
}
function ordinary(s, kind, at) {
  const figure = [1, 2, 3, 4].find((n) => !s.enemies.some((e) => e.id === `${kind}-${n}`));
  assert(figure); const e = { id: `${kind}-${figure}`, kind, figure, node: at, hp: 1 };
  s.enemies.push(e); return e;
}
function keep(s) {
  while (s.rewardChoices.length) {
    const q = s.rewardChoices[0];
    s = q.firearmId ? go(s, "KEEP_FIREARM", { firearmId: q.firearmId }) :
      go(s, "KEEP_REWARD", { rewardId: q.rewardId });
  }
  return s;
}
function helpers() {
  return { hunter: H, node: E.node, nodes: E.nodes, neighbors: E.neighbors, distance: E.distance,
    need: (ok, msg) => assert(ok, msg), log: () => {}, enemyDef: E.enemyDef,
    spawnMission: (s, t) => s.spawnQueue.push({ ...t }),
    spawnNormal: (s, kind, node, options) => s.spawnQueue.push({ kind, node, ...options }),
    grant: () => {}, drawConsumable: () => {}, resume: (s) => { s.phase = "hunter"; },
    openExits: (s) => M.openExits(s.world), missionActions: E.missionActions };
}

test("later chapter preparation separates current insight from retained completed outcomes", () => {
  let s = chapter(2, [], [4, 7, 11, 16]);
  assert.deepEqual(s.mission.completed, []); assert.equal(E.missionView(s).insight, 0);
  assert.deepEqual(s.mission.history[0].completed, [4, 7, 11, 16]);
  assert.deepEqual(s.mission.revealed, [17, 18]);
  s = moveEnd(s, "tile-17");
  assert(s.mission.revealed.includes(30)); assert(s.mission.revealed.includes(31));
  assert(!s.mission.revealed.includes(33));
  const e = s.enemies.find((e) => e.missionId === "patient");
  assert.equal(e.componentId, "female-patient"); assert.equal(s.mission.targets.patient.tokens, 2);
  assert.equal(E.enemyDef(s, e).special.speed, 3); assert.equal(E.enemyDef(s, e).special.damage, 3);
  assert(E.missionView(s).notices.some((x) => x.includes("임시")));
});

test("luring spends the selected real consumable, final beast kills yield corpses, cemetery offering opens 19", () => {
  let s = chapter(2); s.enemies = [];
  const offered = item(s);
  assert(E.missionActions(s).some((x) => x.command.itemId === offered.id));
  s = go(s, "MISSION_LURE", { itemId: offered.id });
  assert(!H(s).consumables.some((x) => x.id === offered.id));
  assert(s.consumableDiscard.some((x) => x.id === offered.id));
  let e = s.enemies.find((x) => x.kind === "scourge-beast"); assert(e); e.hp = 1;
  s = attack(s, e); assert.equal(s.mission.heldCorpses[s.activeHunterId], 1);
  e = ordinary(s, "scourge-beast", H(s).position); s = attack(s, e);
  assert.equal(s.mission.heldCorpses[s.activeHunterId], 2);
  H(s).position = "tile-13:middle"; s = go(s, "MISSION_CORPSES");
  assert.equal(s.mission.deposits.corpses, 2); assert(s.mission.revealed.includes(19));
  assert(!s.mission.revealed.includes(20));
});

test("research requires the clinic kills in order and its consumable pickup supplies survivors once per token", () => {
  let s = moveEnd(chapter(2), "tile-20");
  assert(s.mission.revealed.includes(24));
  let e = ordinary(s, "scourge-beast", "tile-20:room"); s = attack(s, e);
  assert(!s.mission.completed.includes(26));
  e = ordinary(s, "huntsmans-minion", "tile-20:room"); s = attack(s, e);
  assert(s.mission.revealed.includes(25)); assert(s.mission.revealed.includes(27));
  e = ordinary(s, "scourge-beast", "tile-20:room"); s = attack(s, e); s = keep(s);
  assert(s.mission.completed.includes(26)); assert(H(s).rewards.some((r) => r.kind === "iosefka-vial"));
  s.enemies = []; H(s).position = "tile-13:middle"; s.loot.push(H(s).position, H(s).position); hand(s);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, lootCount: 2 });
  assert.equal(s.mission.heldSurvivors[s.activeHunterId], 2);
  s = moveEnd(s, "tile-20"); assert(s.mission.completed.includes(28));
  assert.equal(s.mission.deposits.clinic, 2); assert.equal(E.missionView(s).insight, 2);
  s = keep(s); s = moveEnd(s, "tile-17");
  assert(s.mission.revealed.includes(33));
  Missions.onLoot(s, "tile-13:middle", 2, helpers());
  assert.equal(s.mission.heldSurvivors[s.activeHunterId], 0);
  assert(!s.mission.completed.includes(34));
});

test("survivor collection is cleared by dream/teleport while corpse tokens are retained", () => {
  let s = moveEnd(chapter(2), "tile-17"); s.enemies = [];
  Missions.onLoot(s, "tile-13:middle", 1, helpers());
  s.mission.heldCorpses[s.activeHunterId] = 2;
  const mark = item(s, "bold-mark");
  s = go(s, "USE_CONSUMABLE", { itemId: mark.id, node: "tile-14:center" });
  assert.equal(s.mission.heldSurvivors[s.activeHunterId], 0);
  assert.equal(s.mission.heldCorpses[s.activeHunterId], 2);
});

test("bridge revival is not a kill, special defends hunter damage, final kill starts optional escort", () => {
  let s = moveEnd(chapter(2), "tile-18"), e = s.enemies.find((x) => x.missionId === "bridge");
  assert(e); assert.equal(E.enemyDef(s, e).special.speed, 1);
  assert(E.enemyDef(s, e).special.uninterruptible);
  e.hp = 1; s = attack(s, e, "special");
  assert.equal(s.mission.targets.bridge.tokens, 1); // hunter strike is fully blocked by this slot's damage minus two
  assert(!s.mission.revealed.includes(37));
  e = s.enemies.find((x) => x.missionId === "bridge"); e.hp = 1; s = attack(s, e);
  assert.equal(s.mission.targets.bridge.tokens, 0); assert(!s.mission.revealed.includes(37));
  assert.equal(s.enemies.find((x) => x.missionId === "bridge").hp, D.enemies["huntsmans-minion"].maxHp);
  assert.equal(s.kills, 0);
  e = s.enemies.find((x) => x.missionId === "bridge"); e.hp = 1;
  s = attack(s, e); assert(s.mission.revealed.includes(37)); assert(!s.mission.completed.includes(38));
  assert.equal(s.mission.escort.node, "tile-18:top"); assert(!s.mission.fog.includes("tile-18"));
  H(s).position = "tile-18:top"; hand(s); s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "MISSION_PICKUP"); s = go(s, "STEP", { node: "tile-18:bottom" }); s = go(s, "STOP_MOVE");
  assert.equal(s.mission.escort.carrierId, s.activeHunterId);
  s = moveEnd(s, "tile-20");
  assert(s.mission.completed.includes(38)); assert(!s.mission.completed.includes(39));
  assert(H(s).ownedFirearms.includes("repeating-pistol"));
});

test("chapter two boss phase change removes fog, prevents all damage and its crypt entry wins", () => {
  let s = chapter(2); s.mission.completed = [26, 28]; s.mission.revealed.push(19);
  s = moveEnd(s, "tile-13"); const e = s.enemies.find((x) => x.missionId === "main"); assert(e);
  e.hp = 1; s = attack(s, e);
  assert(s.mission.revealed.includes(21)); assert(s.mission.revealed.includes(22));
  assert.equal(s.enemies.find((x) => x.id === e.id).componentPhase, 2);
  assert(!s.mission.fog.includes("tile-13"));
  const hp = s.enemies.find((x) => x.id === e.id).hp;
  s = attack(s, s.enemies.find((x) => x.id === e.id));
  assert.equal(s.enemies.find((x) => x.id === e.id).hp, hp);
  assert.equal(Missions.beforeEnemyDamage(s, s.enemies[0], 10, { kind: "reward" }, helpers()), s.enemies[0].missionId === "main" ? 0 : 10);
  const boss = s.enemies.find((x) => x.missionId === "main");
  const jobs = Missions.roundEnd(s, helpers()); assert.equal(jobs[0].enemyId, boss.id);
  boss.node = "tile-19:bottom"; Missions.onEnemyStep(s, boss, "tile-13:middle", boss.node, helpers());
  assert(s.mission.won); assert(s.mission.completed.includes(23));
});

test("chapter three clinic branching reads retained outcomes without awarding prior chapter insight", () => {
  for (const [prior, expected] of [[[28, 26], 46], [[28], 51], [[26], 52], [[], 24]]) {
    const s = moveEnd(chapter(3, prior), "tile-20");
    assert(s.mission.revealed.includes(expected), String(expected));
    assert.equal(E.missionView(s).insight, 0);
    for (const n of [46, 51, 52, 24].filter((n) => n !== expected)) assert(!s.mission.revealed.includes(n));
  }
});

test("attacking Iosefka creates a hostile temporary target and help starts a four-step nonexploring escape", () => {
  let s = moveEnd(chapter(3, [26, 28]), "tile-20");
  s = go(s, "MISSION_CHOICE", { choice: "attack-iosefka" });
  const e = s.enemies.find((x) => x.missionId === "iosefka"); assert.equal(e.componentId, "iosefka");
  assert(s.mission.fog.includes("tile-20")); e.hp = 1; s = attack(s, e); s = keep(s);
  assert(s.mission.completed.includes(48)); assert(!s.mission.completed.includes(50));
  s = moveEnd(chapter(3, [26, 28]), "tile-20"); s.enemies = s.enemies.filter((e) => e.missionId);
  s = go(s, "MISSION_CHOICE", { choice: "help-iosefka" });
  assert.equal(s.mission.survivor.card, 49); assert.equal(s.mission.survivor.exploring, false);
  let steps = 0;
  while (s.phase === "mission_survivor") {
    const xs = E.missionActions(s); assert(xs.every((x) => x.command.type === "MISSION_SURVIVOR_STEP"));
    s = E.dispatch(s, xs[0].command); steps++;
  }
  assert(steps > 0 && steps <= 4); assert.equal(s.mission.survivor.remaining, 0);
  H(s).position = s.mission.survivor.node; hand(s);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, mission: "rescue" });
  assert.equal(s.mission.survivor.carrierId, s.activeHunterId);
  const from = H(s).position, mark = item(s, "bold-mark");
  s = go(s, "USE_CONSUMABLE", { itemId: mark.id, node: "tile-14:center" });
  assert.equal(s.mission.survivor.node, from); assert.equal(s.mission.survivor.carrierId, null);
});

test("culling three real beasts completes 55 and immediately suppresses future boss recovery summons", () => {
  let s = moveEnd(chapter(3, [38]), "tile-18");
  assert(s.mission.revealed.includes(54)); assert.equal(s.mission.counters[54], 3);
  s.track = D.track.resets[1]; Missions.onTrackChange(s, helpers());
  const boss = s.enemies.find((x) => x.missionId === "main");
  Missions.onBossRecover(s, boss, helpers()); assert(s.spawnQueue.some((q) => q.ephemeral)); s.spawnQueue = [];
  for (let i = 0; i < 3; i++) { const e = ordinary(s, "scourge-beast", "tile-14:center"); s = attack(s, e); }
  assert(s.mission.completed.includes(55)); assert(s.mission.discarded.includes(43));
  s.spawnQueue = []; Missions.onBossRecover(s, s.enemies.find((x) => x.missionId === "main"), helpers());
  assert.equal(s.spawnQueue.length, 0);
});

test("chapel NPC follows optional movement and only kills in its exact current space count", () => {
  let s = moveEnd(chapter(3, [39]), "tile-17");
  assert.equal(s.mission.counters[57], 2); assert.equal(s.mission.npc.node, "tile-17:top");
  s.enemies = s.enemies.filter((e) => e.missionId);
  H(s).position = "tile-17:top"; hand(s); s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "MISSION_NPC_FOLLOW"); s = go(s, "STEP", { node: "tile-17:lower-left" }); s = go(s, "STOP_MOVE");
  assert.equal(s.mission.npc.node, "tile-17:lower-left");
  let e = ordinary(s, "huntsman-mob", "tile-17:top"); s = attack(s, e);
  assert.equal(s.mission.counters[57], 2);
  e = ordinary(s, "huntsman-mob", "tile-17:lower-left"); s = attack(s, e);
  assert.equal(s.mission.counters[57], 1);
  e = ordinary(s, "huntsmans-minion", "tile-17:lower-left"); s = attack(s, e);
  assert(s.mission.completed.includes(58)); assert.equal(s.mission.npc.node, null);
});

test("chapel supplies accept actual consumable choices only just after movement, reaching two grants 60", () => {
  let s = moveEnd(chapter(3, [34]), "tile-17");
  const a = item(s), b = item(s);
  assert.equal(s.mission.counters[59], 2);
  assert(E.missionActions(s).some((x) => x.command.itemId === a.id));
  s = go(s, "MISSION_DONATE", { itemId: a.id });
  assert.equal(s.mission.counters[59], 1); assert(s.consumableDiscard.some((x) => x.id === a.id));
  hand(s); s = go(s, "TRANSFORM", { cardId: H(s).hand[0].id });
  assert.throws(() => go(s, "MISSION_DONATE", { itemId: b.id }), /직후/);
  s = moveEnd(s, "tile-17"); s = go(s, "MISSION_DONATE", { itemId: b.id });
  assert(s.mission.completed.includes(60)); assert(H(s).ownedFirearms.includes("flamesprayer"));
});

test("crypt captivity blocks movement until the second printed reset, then boss reset preserves location and phase", () => {
  const s = chapter(3);
  assert.equal(Missions.canEnter(s, "tile-14:center", "tile-19:bottom"), false);
  s.track = D.track.resets[1] - 1; Missions.onTrackChange(s, helpers()); assert(!s.mission.revealed.includes(42));
  s.track++; Missions.onTrackChange(s, helpers());
  assert(s.mission.revealed.includes(42)); assert(s.mission.revealed.includes(43));
  assert(s.mission.discarded.includes(41)); assert(!s.mission.fog.includes("tile-19"));
  assert(Missions.canEnter(s, "tile-14:center", "tile-19:bottom"));
  const e = s.enemies.find((x) => x.missionId === "main"); e.node = "tile-14:left"; e.componentPhase = 2;
  Missions.onEnemyStep(s, e, "tile-19:bottom", e.node, helpers()); Missions.onBossPhase(s, e, 2, helpers());
  const [job] = Missions.reset(s, helpers()); assert.equal(job.node, "tile-14:left"); assert.equal(job.componentPhase, 2);
  const [activation] = Missions.roundEnd(s, helpers()); assert.equal(activation.move, 4);
  H(s).position = e.node; assert.equal(Missions.roundEnd(s, helpers())[0].move, 0);
});

test("chapter three final boss kill completes 44 and records campaign victory without track advance", () => {
  let s = chapter(3); s.track = D.track.resets[1]; Missions.onTrackChange(s, helpers());
  let e = s.enemies.find((x) => x.missionId === "main"); e.hp = 1; s = attack(s, e);
  e = s.enemies.find((x) => x.missionId === "main"); assert.equal(e.componentPhase, 2); e.hp = 1;
  const track = s.track; s = attack(s, e);
  assert(s.mission.won); assert(s.mission.completed.includes(44)); assert.equal(s.track, track);
  assert(["upgrade_pick", "over"].includes(s.phase));
  while (s.phase === "upgrade_pick") {
    s = go(s, "PICK_UPGRADE", { index: s.market.findIndex(Boolean) });
    s = go(s, "REPLACE_UPGRADE", { replaceId: H(s).deck[0].id });
  }
  assert.equal(s.phase, "over"); assert.equal(s.result, "campaign-win");
  assert.equal(s.track, track); assert.equal(H(s).hp, 6);
});

test("mission assertions reject duplicated prior outcomes, negative tokens and nonexistent NPC locations", () => {
  const s = chapter(3, [26, 28]); Missions.assert(s, helpers());
  let bad = structuredClone(s); bad.mission.history[1].completed.push(26);
  assert.throws(() => Missions.assert(bad, helpers()), /지난 챕터/);
  bad = structuredClone(s); bad.mission.targets.main.tokens = -1;
  assert.throws(() => Missions.assert(bad, helpers()), /임무 적/);
  bad = structuredClone(s); bad.mission.npc.node = "tile-99:missing";
  assert.throws(() => Missions.assert(bad, helpers()), /NPC/);
  bad = structuredClone(s); bad.mission.heldSurvivors[bad.activeHunterId] = -1;
  assert.throws(() => Missions.assert(bad, helpers()), /보유/);
});

test("patient requires two real revival strikes and the final kill exposes its separate speed-one death reaction", () => {
  let s = moveEnd(chapter(2, [], [16]), "tile-17");
  for (const remaining of [1, 0]) {
    const e = s.enemies.find((x) => x.missionId === "patient"); e.hp = 1;
    s = attack(s, e); assert.equal(s.mission.targets.patient.tokens, remaining);
    assert.equal(s.kills, 0); assert(!s.mission.completed.includes(32));
  }
  const e = s.enemies.find((x) => x.missionId === "patient"); e.hp = 1; s = attack(s, e);
  assert(s.mission.completed.includes(32)); assert.equal(s.phase, "mission_death");
  assert(E.missionActions(s).some((x) => x.command.type === "MISSION_DEATH_DODGE"));
  const hp = H(s).hp; s = go(s, "MISSION_DEATH_TAKE");
  assert.equal(H(s).hp, hp - 3); assert.equal(s.phase, "hunter");
  assert(!s.mission.fog.includes("tile-17"));
});

test("the other bridge escort ending grants warning 39 and changes both subsequent branches", () => {
  let s = moveEnd(chapter(2), "tile-18"), e = s.enemies.find((x) => x.missionId === "bridge");
  s.mission.targets.bridge.tokens = 0; e.hp = 1; s = attack(s, e);
  H(s).position = "tile-18:top"; hand(s); s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "MISSION_PICKUP"); s = go(s, "STEP", { node: "tile-18:bottom" }); s = go(s, "STOP_MOVE");
  s = moveEnd(s, "tile-17"); assert(s.mission.completed.includes(39)); assert(!s.mission.completed.includes(38));
  s = keep(s); s = next(s, s.mission.completed);
  s = moveEnd(s, "tile-18"); assert(s.mission.revealed.includes(54));
  s = moveEnd(s, "tile-17"); assert(s.mission.revealed.includes(57)); assert(!s.mission.revealed.includes(59));
});

test("helping Iosefka allows an interaction catch and delivery ending 50 instead of hostile ending 48", () => {
  let s = moveEnd(chapter(3, [26, 28]), "tile-20");
  s = go(s, "MISSION_CHOICE", { choice: "help-iosefka" });
  while (s.phase === "mission_survivor") s = E.dispatch(s, E.missionActions(s)[0].command);
  H(s).position = s.mission.survivor.node; hand(s);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, mission: "rescue" });
  s = moveEnd(s, "tile-20");
  assert(s.mission.completed.includes(50)); assert(!s.mission.completed.includes(48));
  assert(H(s).rewards.some((r) => r.kind === "augur"));
  assert.equal(s.mission.survivor.carrierId, null);
});

test("fleeing NPC cannot cross a fog boundary even when that step increases its shortest distance", () => {
  const s = chapter(3), entry = "tile-19:bottom";
  const outside = E.neighbors(s, entry).find((n) => !n.startsWith("tile-19:")); assert(outside);
  const away = E.neighbors(s, outside).find((n) => n !== entry); assert(away);
  H(s).position = away; s.phase = "mission_survivor"; s.mission.revealed.push(49);
  Object.assign(s.mission.survivor, { card: 49, node: outside, remaining: 1, exploring: false, carrierId: null });
  assert(E.distance(s, entry, H(s).position) > E.distance(s, outside, H(s).position));
  assert(!E.missionActions(s).some((x) => x.command.node === entry));
  assert.throws(() => go(s, "MISSION_SURVIVOR_STEP", { node: entry }), /멀어지는/);
});

test("a card-18 mission summon remains legal within a fog encounter unlike ordinary tile spawning", () => {
  let s = moveEnd(chapter(2), "tile-18");
  const x = item(s); const before = s.enemies.length;
  s = go(s, "MISSION_LURE", { itemId: x.id });
  assert.equal(s.enemies.length, before + 1);
  const beast = s.enemies.find((e) => e.kind === "scourge-beast" && e.node === H(s).position);
  assert(beast); assert.equal(beast.missionSummon, true);
  assert(s.mission.fog.includes("tile-18"));
});

test("chapter-two boss reset respawns at the cemetery marker in both phase one and phase two", () => {
  let s = chapter(2); s.mission.completed = [26, 28]; s.mission.revealed.push(19);
  s = moveEnd(s, "tile-13");
  let e = s.enemies.find((x) => x.missionId === "main"); e.node = "tile-13:top";
  Missions.onEnemyStep(s, e, "tile-13:middle", e.node, helpers());
  let job = Missions.reset(s, helpers()).find((x) => x.missionId === "main");
  assert.equal(job.node, "tile-13:middle"); assert.equal(job.componentPhase, 1);
  e.componentPhase = 2; Missions.onBossPhase(s, e, 2, helpers()); e.node = "tile-14:left";
  Missions.onEnemyStep(s, e, "tile-13:top", e.node, helpers());
  job = Missions.reset(s, helpers()).find((x) => x.missionId === "main");
  assert.equal(job.node, "tile-13:middle"); assert.equal(job.componentPhase, 2);
  assert(!s.mission.won);
});

test("retained sanctuary outcomes block both survivor collection and delivery to the competing sanctuary", () => {
  for (const [prior, tile, reward] of [[[28], "tile-17", 34], [[34, 26], "tile-20", 28]]) {
    let s = moveEnd(chapter(3, prior), tile);
    s.enemies = s.enemies.filter((e) => e.missionId);
    H(s).position = "tile-13:middle"; hand(s);
    assert(E.interactionOptions(s).loot > 0);
    s = go(s, "INTERACT", { cardId: H(s).hand[0].id, lootCount: 1 });
    assert.equal(s.mission.heldSurvivors[s.activeHunterId] || 0, 0);
    // A held token fixture independently verifies that the delivery guard also applies.
    s.mission.heldSurvivors[s.activeHunterId] = 2;
    s = moveEnd(s, tile);
    assert(!s.mission.completed.includes(reward));
    assert.equal(s.mission.heldSurvivors[s.activeHunterId], 2);
    assert.equal(s.mission.deposits[tile === "tile-20" ? "clinic" : "chapel"], 0);
  }
});

test("crypt captivity rejects real steps and central-lamp teleport attempts until two current-chapter insight rewards", () => {
  let s = chapter(3, [34, 38]); // both prior rewards are insight cards, but current insight is zero
  const entry = "tile-19:bottom", outside = E.neighbors(s, entry).find((n) => !n.startsWith("tile-19:"));
  H(s).position = outside; hand(s); s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  const unchanged = structuredClone(s);
  assert.throws(() => go(s, "STEP", { node: entry }), /진입할 수 없는/);
  assert.deepEqual(s, unchanged);
  s = go(s, "STOP_MOVE"); H(s).position = "tile-14:center"; hand(s);
  assert(E.interactionOptions(s).teleport);
  assert(!E.centralLampDestinations(s).some(n=>n.id===entry), "locked crypt is absent from legal destinations");
  assert.throws(() => go(s, "INTERACT", { cardId: H(s).hand[0].id, lamp: entry }), /중앙 등불에서 목적지/);
  assert(!s.mission.revealed.includes(42)); assert.equal(E.missionView(s).insight, 0);
  s = moveEnd(s, "tile-18");
  for (let i = 0; i < 3; i++) s = attack(s, ordinary(s, "scourge-beast", "tile-14:center"));
  s = keep(s); assert.equal(E.missionView(s).insight, 1); assert(!s.mission.revealed.includes(42));
  s = moveEnd(s, "tile-17"); const a = item(s), b = item(s);
  s = go(s, "MISSION_DONATE", { itemId: a.id }); s = go(s, "MISSION_DONATE", { itemId: b.id });
  s = keep(s);
  assert.equal(E.missionView(s).insight, 2);
  assert(s.mission.revealed.includes(42)); assert(s.mission.revealed.includes(43));
  assert(s.mission.discarded.includes(41));
  H(s).position = outside; hand(s); s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: entry });
  assert.equal(H(s).position, entry);
});
