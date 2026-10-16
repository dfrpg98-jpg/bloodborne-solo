"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), P = require("../hunt-attack-preview"),
  { hand, enemyAction, chapter, A } = require("./actual-combat-helper.cjs");
const H = E.hunter, checked = state => { E.assertState(state); return state; };

// Supply-valid constructed geometry/encounters, not canonical campaign saves.
// Real supplied definitions and the real reducer are used without changing any
// component data. All placement/card substitutions occur before the assertion;
// gameplay after that point is performed only through public engine commands.
function map(state, includeHouse = true) {
  state.world.tiles = [{ tileId: "tile-14", x: 0, y: 0, rotation: 0 },
    { tileId: "tile-17", x: 0, y: 1, rotation: 0 },
    ...(includeHouse ? [{ tileId: "tile-03", x: 0, y: -1, rotation: 0 }] : [])];
  state.world.tileDeck = state.world.tilePool.filter(id => !state.world.tiles.some(tile => tile.tileId === id));
  state.loot = []; return state;
}
function enemy(kind, figure, node) {
  return { id: kind + "-" + figure, kind, figure, node, hp: E.data.enemies[kind].health };
}
function setup(weapon = "burial", face = 0, cards = ["strength", "endurance", "vitality"]) {
  const state = map(E.create(123, weapon, face, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 }));
  state.world.assignments = state.world.assignments.sort((a, b) =>
    a.enemyId === "huntsman-mob" ? -1 : b.enemyId === "huntsman-mob" ? 1 : 0)
    .map((assignment, index) => ({ ...assignment, sideId: "a", slot: index + 1, marker: ["gold", "red", "purple"][index] }));
  state.enemies = [enemy("huntsman-mob", 1, "tile-14:center")];
  hand(state, cards); enemyAction(state, "basic"); return checked(state);
}
function crowded(weapon = "burial", face = 0) {
  const state = setup(weapon, face);
  state.enemies.push(enemy("huntsman-mob", 2, "tile-14:center"), enemy("huntsmans-minion", 1, "tile-14:left"),
    enemy("scourge-beast", 1, "tile-17:top"), enemy("huntsman-mob", 3, "tile-03:entry"),
    enemy("huntsman-mob", 4, "tile-03:room"));
  return checked(state);
}
function selection(state, overrides = {}) {
  return { kind: "ATTACK", enemyId: state.enemies[0].id,
    cardId: H(state).hand[0].id, slot: 0, pullIds: [], itemIds: [], rewardIds: [], ...overrides };
}
function command(selection) { const { kind, ...args } = selection; return { type: kind, ...args }; }
function preview(state, input) {
  const saved = JSON.stringify(state), chosen = structuredClone(input), model = P.view(state, E, input);
  assert.equal(JSON.stringify(state), saved, "a position preview cannot write gameplay or enemy identity");
  assert.deepEqual(input, chosen); return model;
}
function attack(state, input) { return checked(E.dispatch(state, command(input))); }
function hpAfter(state, id) { return state.enemies.find(enemy => enemy.id === id)?.hp || 0; }
function resolveSplash(before, input, model) {
  const declared = attack(before, input);
  assert.equal(declared.phase, "combat_react");
  assert.deepEqual(declared.combat.attack.splash, { range: model.area.range, damage: model.area.damage });
  const after = checked(E.dispatch(declared, { type: "RESOLVE" })), targets = new Set(model.area.ids);
  for (const other of before.enemies.filter(enemy => enemy.id !== declared.combat.enemyId))
    assert.equal(hpAfter(after, other.id), other.hp - (targets.has(other.id) ? model.area.damage : 0), other.id);
  return { declared, after };
}

test("pull destination projects the chapel penalty and agrees with the real pulled enemy's revealed attack", () => {
  const state = setup("burial", 1); H(state).position = "tile-17:top"; checked(state);
  const before = JSON.stringify(state), id = state.enemies[0].id,
    records = P.pullView(state, E, [id]), record = records[0];
  assert.deepEqual(records, [{ enemyId: id, destination: "tile-17:top", tileId: "tile-17", beforePenalty: 0, penalty: 1 }]);
  assert.equal(JSON.stringify(state), before);
  const actual = attack(state, selection(state, { pullIds: [id] }));
  assert.equal(actual.enemies[0].node, record.destination);
  assert.equal(E.enemyTileSpeedPenalty(actual, actual.enemies[0]), record.penalty);
  assert.equal(actual.combat.action.speed, E.enemyDef(state, state.enemies[0]).basic.speed - record.penalty);
  assert.equal(actual.combat.action.speed, 1);
  assert.match(P.pullHTML(record, "오에돈 예배당"), /끌어온 뒤: 오에돈 예배당 · 적 공격 속도 -1/);
});

function missionPull(card) {
  let state;
  if (card === 31) {
    // The existing component helper establishes a valid chapter-two container;
    // this independently constructed target is not a natural mission-31 replay.
    state = map(chapter(2), false); H(state).face = 1;
    const definition = A.definition("female-patient-a");
    state.enemies = [{ id: "mission-patient", missionId: "patient", componentId: "female-patient",
      componentSpec: "female-patient-a", componentPhase: 1, kind: definition.baseKind, figure: 1,
      node: "tile-17:lower-left", hp: definition.maxHp }];
    state.mission.revealed.push(30, 31);
  } else {
    state = map(E.create(123, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }));
    state.enemies = [{ ...enemy("scourge-beast", 1, "tile-17:lower-left"), missionId: "shelter" }];
    state.mission.revealed.push(8, 10);
  }
  const target = state.enemies[0], id = target.missionId;
  state.mission.targets[id] = { id, card, tile: "tile-17", node: "tile-17:top", currentNode: target.node,
    kind: target.kind, initialTokens: 0, tokens: 0, complete: false, enemyId: target.id };
  state.mission.fog = ["tile-17"]; H(state).position = "tile-17:top";
  hand(state, ["strength", "endurance", "vitality"]); enemyAction(state, "special"); return checked(state);
}
for (const card of [10, 31]) test(`mission ${card}: pull preview preserves legacy chapel exemptions and uses the adopted all-attacks policy`, () => {
  const legacy = missionPull(card), corrected = checked(E.applyTileSpeedRuling(legacy));
  assert.equal(legacy.tileSpeedRuling, undefined); assert.equal(corrected.tileSpeedRuling, "all-attacks");
  if (card === 31) {
    assert.equal(E.enemyDef(legacy, legacy.enemies[0]).ignoreTileSpeed, true);
    assert.notEqual(E.enemyDef(corrected, corrected.enemies[0]).ignoreTileSpeed, true);
  }
  for (const [state, expected] of [[legacy, 0], [corrected, 1]]) {
    const before = JSON.stringify(state), id = state.enemies[0].id, records = P.pullView(state, E, [id]);
    assert.equal(records.length, 1); assert.equal(records[0].beforePenalty, expected); assert.equal(records[0].penalty, expected);
    assert.equal(JSON.stringify(state), before);
    const after = attack(state, selection(state, { pullIds: [id] }));
    assert.equal(after.combat.action.kind, "special"); assert.equal(after.combat.action.speed, 3 - expected);
    assert.equal(E.enemyTileSpeedPenalty(after, after.enemies[0]), records[0].penalty);
    assert.match(P.pullHTML(records[0], "예배당"), expected ? /적 공격 속도 -1/ : /적 공격 속도 보정 없음/);
  }
});

test("pull records contain only unique eligible choices, keep unchanged chapel penalties, and reject unavailable phases or weapon faces", () => {
  const state = setup("burial", 1); H(state).position = "tile-17:top";
  state.enemies[0].node = "tile-17:lower-left";
  state.enemies.push(enemy("huntsman-mob", 2, H(state).position), enemy("huntsman-mob", 3, "tile-03:room")); checked(state);
  const original = JSON.stringify(state), id = state.enemies[0].id,
    ids = [id, id, state.enemies[1].id, state.enemies[2].id, "missing"];
  assert.deepEqual(P.pullView(state, E, ids), [{ enemyId: id, destination: H(state).position,
    tileId: "tile-17", beforePenalty: 1, penalty: 1 }]);
  assert.deepEqual(P.pullView(state, E, []), []);
  assert.deepEqual(P.pullView({ ...state, phase: "combat_react" }, E, [id]), []);
  const front = structuredClone(state); H(front).face = 0; checked(front);
  assert.deepEqual(P.pullView(front, E, [id]), []);
  const dream = structuredClone(state); H(dream).inDream = true; H(dream).position = null;
  assert.deepEqual(P.pullView(dream, E, [id]), []);
  assert.equal(JSON.stringify(state), original); assert.equal(ids.length, 5);
});

test("pull text escapes the cleaned disclosed name, has a current-space fallback, and never prints enemy identities or hidden values", () => {
  const record = { enemyId: "scourge-beast-3", destination: "tile-17:top", tileId: "tile-17", beforePenalty: 0, penalty: 1 };
  assert.equal(P.pullHTML(null, "예배당"), "");
  assert.match(P.pullHTML(record, "<예배당> & 등불", { clean: value => value.replace("등불", "성소") }), /&lt;예배당&gt; &amp; 성소/);
  assert.doesNotMatch(P.pullHTML(record, "<예배당> & 등불"), /scourge-beast|tile-17|<예배당>|#3/);
  assert.match(P.pullHTML({ ...record, penalty: 0 }), /끌어온 뒤: 현재 칸 · 적 공격 속도 보정 없음/);
});

test("the burial range count excludes the main target, counts every legal extra once, and matches actual splash damage", () => {
  const state = crowded(), input = selection(state), identities = state.enemies.map(({ id, figure, hp }) => ({ id, figure, hp })),
    model = preview(state, input);
  assert.equal(model.ready, true);
  assert.deepEqual(model.area, { ids: ["huntsman-mob-2", "huntsmans-minion-1", "scourge-beast-1", "huntsman-mob-3"],
    count: 4, damage: 1, range: 1, origin: H(state).position });
  assert(!model.area.ids.includes(input.enemyId)); assert(!model.area.ids.includes("huntsman-mob-4"));
  const html = P.renderHTML(model);
  assert.match(html, /공격 실행 시 · 추가 <b>4명 × 피해 1<\/b>/);
  assert.doesNotMatch(html, /data-status-enemy|enemy-health|enemy-insight|huntsman-mob|#1|#2|체력/,
    "the extra-count chip does not replace target names, numbering or selection-only HUDs");
  assert.deepEqual(state.enemies.map(({ id, figure, hp }) => ({ id, figure, hp })), identities);
  const { after } = resolveSplash(state, input, model);
  assert.equal(hpAfter(after, input.enemyId), state.enemies[0].hp - model.damage, "the main target takes direct damage once, not splash too");
});

test("zero-extra, invalid-target and incomplete choices never invent an extra victim or expose a stale area count", () => {
  const state = setup(), input = selection(state), model = preview(state, input);
  assert.deepEqual(model.area, { ids: [], count: 0, damage: 1, range: 1, origin: H(state).position });
  assert.match(P.renderHTML(model), /범위 내 추가 대상 없음/);
  const noTarget = preview(state, { ...input, enemyId: "missing" }); assert.equal(noTarget.area, null);
  assert.doesNotMatch(P.renderHTML(noTarget), /attack-area-preview/);
  for (const incomplete of [{ ...input, cardId: null }, { ...input, slot: null }]) {
    const value = preview(state, incomplete); assert.equal(value.ready, false); assert.equal(value.area, undefined);
    assert.doesNotMatch(P.renderHTML(value), /attack-area-preview/);
  }
  const remote = structuredClone(state); remote.enemies[0].node = "tile-03:room"; checked(remote);
  assert.equal(preview(remote, input).area, null, "a non-Leap attack cannot target a different cell");
  assert.throws(() => attack(remote, input), /같은 칸/);
  const back = setup("burial", 1); assert.equal(preview(back, selection(back)).area, null, "pulling face has no splash");
});

test("Leap counts extras around its legal landing cell, rather than the hunter's old position, and matches the real moved attack", () => {
  const state = setup("burial", 0, ["leap", "endurance", "vitality"]);
  state.enemies[0].node = "tile-03:room";
  state.enemies.push(enemy("huntsman-mob", 2, "tile-14:left"), enemy("huntsmans-minion", 1, "tile-03:entry"),
    enemy("scourge-beast", 1, "tile-03:room"), enemy("huntsman-mob", 3, "tile-17:top")); checked(state);
  const target = state.enemies[0], route = E.leapPaths(state, target.node).find(path => path.length > 1);
  assert.deepEqual(route, ["tile-14:center", "tile-03:entry", "tile-03:room"]);
  const input = selection(state, { leapPath: route }), model = preview(state, input);
  assert.deepEqual(model.area, { ids: ["huntsmans-minion-1", "scourge-beast-1"], count: 2,
    damage: 1, range: 1, origin: target.node });
  const { declared, after } = resolveSplash(state, input, model);
  assert.equal(H(declared).position, model.area.origin); assert.equal(H(after).position, model.area.origin);
  assert.equal(hpAfter(after, "huntsman-mob-2"), state.enemies[1].hp);
  const unreachable = structuredClone(state); H(unreachable).position = "tile-14:left"; checked(unreachable);
  assert.deepEqual(E.leapPaths(unreachable, target.node), []);
  assert.equal(preview(unreachable, selection(unreachable)).area, null, "no currently legal Leap route means no landing-area prediction");
});

test("COUNTER uses its combat enemy despite a stale selected enemy and preserves the main-target splash exclusion", () => {
  const before = crowded(); let state = checked(E.dispatch(before, { type: "END_TURN" }));
  if (state.phase === "activation") state = checked(E.dispatch(state, { type: "ACTIVATE", enemyId: "huntsman-mob-1" }));
  assert.equal(state.phase, "combat_choose"); assert.equal(state.combat.enemyId, "huntsman-mob-1");
  const input = selection(state, { kind: "COUNTER", enemyId: "huntsmans-minion-1" }), model = preview(state, input);
  assert.deepEqual(model.area.ids, ["huntsman-mob-2", "huntsmans-minion-1", "scourge-beast-1", "huntsman-mob-3"]);
  assert(!model.area.ids.includes(state.combat.enemyId)); assert(model.area.ids.includes(input.enemyId));
  const actual = attack(state, input);
  assert.equal(actual.combat.enemyId, state.combat.enemyId); assert.equal(actual.combat.attack.damage, model.damage);
  assert.deepEqual(actual.combat.attack.splash, model.attack.splash);
});

test("COUNTER can preview and actually perform a selected pull before the revealed chapel attack", () => {
  const before = setup("burial", 1); H(before).position = "tile-17:top";
  before.enemies[0].node = H(before).position;
  before.enemies.push(enemy("huntsmans-minion", 1, "tile-14:center")); checked(before);
  const state = checked(E.dispatch(before, { type: "END_TURN" })), id = before.enemies[1].id;
  assert.equal(state.phase, "combat_choose"); assert.equal(state.combat.enemyId, before.enemies[0].id);
  const saved = JSON.stringify(state), records = P.pullView(state, E, [id]);
  assert.deepEqual(records, [{ enemyId: id, destination: "tile-17:top", tileId: "tile-17", beforePenalty: 0, penalty: 1 }]);
  assert.equal(JSON.stringify(state), saved);
  const actual = attack(state, selection(state, { kind: "COUNTER", pullIds: [id] }));
  assert.equal(actual.enemies.find(enemy => enemy.id === id).node, records[0].destination);
  assert.equal(actual.combat.action.speed, 1); assert.equal(actual.combat.enemyId, state.combat.enemyId);
});

test("the Stake Driver's printed explosive slot previews two splash damage and other actual slots do not inherit it", () => {
  const state = crowded("stake-driver", 1), input = selection(state), model = preview(state, input);
  assert.equal(model.area.count, 4); assert.equal(model.area.damage, 2); assert.equal(model.area.range, 1);
  assert.match(P.renderHTML(model), /공격 실행 시 · 추가 <b>4명 × 피해 2<\/b>/);
  const { after } = resolveSplash(state, input, model);
  assert.equal(hpAfter(after, input.enemyId), 0);
  const loaded = crowded("stake-driver", 0);
  for (const slot of [0, 1, 2]) assert.equal(preview(loaded, selection(loaded, { slot })).area, null);
});

test("pull and Leap-area projections never read hidden decks, dispatch, import or mutate visible enemy figures and HP", () => {
  const state = setup("burial", 0, ["leap", "endurance", "vitality"]);
  state.enemies[0].node = "tile-03:room";
  state.enemies.push(enemy("huntsmans-minion", 1, "tile-03:entry")); checked(state);
  const input = selection(state), expected = preview(state, input), saved = JSON.stringify(state),
    guarded = { ...state, world: { ...state.world }, hunters: { ...state.hunters, [state.activeHunterId]: { ...H(state) } } };
  const forbidden = (object, keys) => keys.forEach(key => Object.defineProperty(object, key,
    { get() { throw Error("hidden " + key); }, configurable: true }));
  forbidden(guarded, ["enemyDeck", "enemyDiscard", "consumableDeck", "upgradeDeck", "rng", "events", "commands"]);
  forbidden(guarded.world, ["tileDeck"]); forbidden(H(guarded), ["deck", "discard"]);
  const engine = { ...E, get dispatch() { throw Error("dispatch forbidden"); },
    get importSave() { throw Error("import forbidden"); }, get exportSave() { throw Error("export forbidden"); } };
  for (const item of guarded.enemies) Object.freeze(item);
  Object.freeze(guarded.enemies); Object.freeze(H(guarded).hand); Object.freeze(H(guarded).slots);
  Object.freeze(H(guarded)); Object.freeze(guarded.world); Object.freeze(guarded);
  const model = P.view(guarded, engine, input);
  assert.deepEqual(model, expected); assert.match(P.renderHTML(model), /1명 × 피해 1/);
  assert.equal(JSON.stringify(state), saved);
  const pulling = setup("burial", 1); H(pulling).position = "tile-17:top"; checked(pulling);
  const pullExpected = P.pullView(pulling, E, [pulling.enemies[0].id]), pullSaved = JSON.stringify(pulling);
  forbidden(pulling, ["enemyDeck", "enemyDiscard", "rng"]);
  assert.deepEqual(P.pullView(pulling, engine, [pulling.enemies[0].id]), pullExpected);
  for (const key of ["enemyDeck", "enemyDiscard", "rng"]) {
    const value = JSON.parse(pullSaved)[key]; Object.defineProperty(pulling, key, { value, writable: true, configurable: true, enumerable: true });
  }
  assert.equal(JSON.stringify(pulling), pullSaved);
});
