"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js"), M = require("../src/chapter-engine.js"), C = require("../src/hunt-context.js");
const commands = require("./fixtures/v077-chapel-escort-first-natural-commands.json");
const normal = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
const run = (state, action) => (action.sequence || [action.command]).reduce((s, command) => E.dispatch(s, command), state);
const timeline = [normal()];
for (const command of commands) timeline.push(E.dispatch(timeline.at(-1), command));
const select = state => ({ cardId: E.hunter(state).hand[0]?.id,
  slot: E.hunter(state).slots.findIndex(x => !x), pullIds: [] });
const currentExit = state => M.openExits(state.world).find(x => x.node === E.hunter(state).position);
const action = (view, id) => view.actions.find(x => x.id === id);

test("a selected adjacent cell reports the existing discard cost and preserves the exact state until confirmed", () => {
  const s = normal(), before = E.exportSave(s), node = E.neighbors(s, E.hunter(s).position)[0];
  const unselected = action(C.view(s, { kind: "cell", node }), "move");
  assert.equal(unselected.enabled, false); assert.match(unselected.reason, /스탯 카드 1장/);
  assert.match(unselected.cost, /1장 버림/);
  const a = action(C.view(s, { kind: "cell", node }, select(s)), "move");
  assert.equal(a.enabled, true); assert.deepEqual(a.sequence.map(x => x.type), ["MOVE", "STEP"]);
  assert.equal(E.exportSave(s), before);
  const next = run(s, a);
  assert.equal(E.hunter(next).position, node); assert.equal(E.hunter(next).discard.length, E.hunter(s).discard.length + 1);
  assert.equal(next.commands.length, 2); assert.deepEqual(E.importSave(E.exportSave(next)), next);
});

test("movement already paid for uses STEP and no second stat card", () => {
  const s = timeline[1], node = E.neighbors(s, E.hunter(s).position)[0];
  const a = action(C.view(s, { kind: "cell", node }), "move");
  assert.equal(a.enabled, true); assert.match(a.cost, /추가 카드 없음/); assert.equal(a.command.type, "STEP");
  const next = run(s, a);
  assert.equal(E.hunter(next).hand.length, E.hunter(s).hand.length);
  assert.equal(E.hunter(next).discard.length, E.hunter(s).discard.length);
});

test("an open entrance reveals no next tile before the canonical MOVE then EXPLORE command", () => {
  const s = normal(), exit = currentExit(s), before = E.exportSave(s);
  const a = action(C.view(s, { kind: "entrance", node: exit.node, edge: exit.edge }, select(s)), "explore");
  assert.equal(a.enabled, true); assert.equal(s.world.pending, null); assert.equal(E.exportSave(s), before);
  assert.deepEqual(a.sequence.map(x => x.type), ["MOVE", "EXPLORE"]);
  assert.equal(JSON.stringify(a).includes(s.world.tileDeck[0]), false, "the hidden tile id is absent from action labels and commands");
  const next = run(s, a);
  assert.equal(next.phase, "tile_place"); assert(next.world.pending); assert.equal(next.world.tiles.length, s.world.tiles.length);
  assert.equal(next.move.remaining, 2, "the entry step is consumed after the player selects tile rotation");
});

test("connected entrances offer the real public connecting STEP instead of drawing another tile", () => {
  const s = timeline.find(x => x.phase === "move" && E.neighbors(x, E.hunter(x).position).some(id => E.node(x, id).tile !== E.node(x, E.hunter(x).position).tile));
  assert(s, "the natural campaign contains a connected gate during movement");
  const node = E.hunter(s).position, placed = s.world.tiles.find(x => x.tileId === E.node(s, node).tile);
  const exit = M.exits(placed).find(x => x.node === node && !M.openExits(s.world).some(o => o.node === node && o.edge === x.edge));
  assert(exit, "a placed tile has a connected gate at the hunter's node");
  const a = action(C.view(s, { kind: "entrance", node, edge: exit.edge }), "move");
  assert(a?.enabled); assert.equal(a.command.type, "STEP");
  assert.notEqual(E.node(s, a.command.node).tile, placed.tileId);
  const next = run(s, a); assert.equal(next.world.tileDeck.length, s.world.tileDeck.length);
});

test("a distant cell never chooses a route or spends a card automatically", () => {
  const s = timeline.find(x => x.phase === "hunter" && E.nodes(x).some(n => Number.isFinite(E.distance(x, E.hunter(x).position, n.id)) && E.distance(x, E.hunter(x).position, n.id) > 1));
  const node = E.nodes(s).find(n => Number.isFinite(E.distance(s, E.hunter(s).position, n.id)) && E.distance(s, E.hunter(s).position, n.id) > 1).id;
  const before = E.exportSave(s), a = action(C.view(s, { kind: "cell", node }, select(s)), "move");
  assert.equal(a.enabled, false); assert.match(a.reason, /인접/); assert.equal(E.exportSave(s), before);
});

test("an attack requires the visible target, one hand card and an empty slot; a counter remains tied to its actual encounter", () => {
  const s = timeline[5], target = { kind: "enemy", enemyId: s.combat.enemyId }, before = E.exportSave(s);
  const unselected = action(C.view(s, target), "attack");
  assert.equal(unselected.enabled, false); assert.match(unselected.reason, /스탯 카드/);
  const noSlot = action(C.view(s, target, { cardId: E.hunter(s).hand[0].id }), "attack");
  assert.equal(noSlot.enabled, false); assert.match(noSlot.reason, /빈 공격 슬롯/);
  const a = action(C.view(s, target, select(s)), "attack");
  assert.equal(a.enabled, true); assert.equal(a.command.type, "COUNTER"); assert.match(a.cost, /1장 배치/);
  assert.equal(E.exportSave(s), before, "selecting the enemy never draws its action");
  const next = run(s, a); assert.equal(next.commands.at(-1).type, "COUNTER");
  assert.equal(E.hunter(next).hand.some(c => c.id === a.command.cardId), false);
  assert([...E.hunter(next).slots.filter(Boolean), ...E.hunter(next).discard].some(c => c.id === a.command.cardId));
  const another = timeline.find(x => x.phase === "combat_choose" && x.enemies.some(e => e.id !== x.combat.enemyId));
  const other = another.enemies.find(e => e.id !== another.combat.enemyId);
  assert.equal(action(C.view(another, { kind: "enemy", enemyId: other.id }, select(another)), "attack").enabled, false);
  assert.match(action(C.view(another, { kind: "enemy", enemyId: other.id }, select(another)), "attack").reason, /현재 조우한 적/);
});

test("the current cell exposes combined interaction and its discard cost without selecting optional targets", () => {
  const s = normal(), before = E.exportSave(s), node = E.hunter(s).position;
  const a = action(C.view(s, { kind: "cell", node }, select(s)), "interact");
  assert.equal(a.enabled, true); assert.equal(a.command, null); assert.match(a.cost, /1장 버림/);
  assert.equal(E.exportSave(s), before);
});

test("mandatory reward equipment disables map actions and retains the reason", () => {
  const s = timeline.find(x => x.rewardChoices.length && x.phase === "hunter");
  assert(s, "a normal campaign kill grants mandatory equipment choices");
  const node = E.neighbors(s, E.hunter(s).position)[0], v = C.view(s, { kind: "cell", node }, select(s));
  assert(v.actions.length); assert(v.actions.every(x => !x.enabled && /보상/.test(x.reason)));
});

test("boss forced movement uses the reducer's actual public choices and no paid hunter move", () => {
  const s = timeline.find(x => x.phase === "boss_move"), node = E.bossMoveOptions(s)[0];
  assert(node); const a = action(C.view(s, { kind: "cell", node }), "boss-step");
  assert.equal(a.enabled, true); assert.deepEqual(a.command, { type: "BOSS_STEP", node });
  assert.match(a.cost, /카드 없음/); const next = run(s, a); assert.equal(next.commands.at(-1).type, "BOSS_STEP");
  const other = E.nodes(s).find(n => !E.bossMoveOptions(s).includes(n.id));
  assert.equal(action(C.view(s, { kind: "cell", node: other.id }), "boss-step").enabled, false);
});

test("all eight firearms keep their existing public use timing and target restrictions in the context panel", () => {
  for (const firearmId of ["hunter-pistol", "evelyn", "cannon", "repeating-pistol", "rosmarinus", "flamesprayer", "ludwig-rifle", "hunter-blunderbuss"]) {
    let s = E.create(4, "burial", 0, null, firearmId, "center", { campaign: false, rulesVersion: 13,
      firearmOverride: true, practiceTarget: "church-giant", practiceSide: "a" });
    const target = { kind: "enemy", enemyId: s.enemies[0].id }, gun = E.firearm(s);
    let a = action(C.view(s, target, select(s)), "firearm");
    if (gun.trigger === "hunter-turn" || gun.trigger === "hunter-effect") {
      assert(a, `${firearmId} offers its own hunter-turn use`); assert.equal(a.enabled, E.canFirearm(s), firearmId);
      if (a.enabled) assert.equal(run(s, a).commands.at(-1).type, "FIREARM", firearmId);
    } else assert.equal(a, undefined, `${firearmId} cannot be used before its printed trigger`);
    const card = E.hunter(s).hand.find(c => c.kind === "strength") || E.hunter(s).hand[0];
    s = E.dispatch(s, { type: "ATTACK", enemyId: target.enemyId, cardId: card.id, slot: 0 });
    a = action(C.view(s, target, select(s)), "firearm");
    if (gun.trigger !== "hunter-turn" && gun.trigger !== "hunter-effect" && gun.trigger !== "enemy-enters" && s.phase === "combat_react") {
      assert(a, `${firearmId} can describe its revealed combat reaction`); assert.equal(a.enabled, E.canFirearm(s), firearmId);
      if (a.enabled) assert.equal(run(s, a).commands.at(-1).type, "FIREARM", firearmId);
    } else assert.equal(a, undefined, `${firearmId} retains its declared timing`);
  }
});

test("unresolved combat, tile placement and dreams cannot be bypassed by clicking map cells or gates", () => {
  for (const phase of ["tile_place", "combat_react", "combat_extra", "stun", "return", "upgrade_pick", "between_chapters", "over"]) {
    const s = timeline.find(x => x.phase === phase), node = E.nodes(s)[0].id;
    assert(C.view(s, { kind: "cell", node }, select(s)).actions.every(x => !x.enabled), phase);
    assert(C.view(s, { kind: "entrance", node, edge: "N" }, select(s)).actions.every(x => !x.enabled), phase);
  }
});

test("public context never inspects hidden card or tile order and ignores unknown targets", () => {
  const s = structuredClone(timeline[5]), h = E.hunter(s);
  for (const key of ["deck"]) Object.defineProperty(h, key, { get() { throw new Error("hidden hunter deck read"); } });
  for (const key of ["enemyDeck", "consumableDeck", "upgradeDeck"]) Object.defineProperty(s, key, { get() { throw new Error("hidden deck read"); } });
  const deckSize = s.world.tileDeck.length;
  Object.defineProperty(s.world, "tileDeck", { get() { return new Proxy([], { get(_, key) {
    if (key === "length") return deckSize;
    throw new Error("hidden tile order read");
  } }); } });
  const v = C.view(s, { kind: "enemy", enemyId: s.combat.enemyId }, select(s));
  assert(v.actions.length); assert.equal(s.combat.action, null);
  const unknown = C.view(s, { kind: "cell", node: "tile-20:unknown-secret-space" });
  assert.equal(unknown.nodeId, null); assert.deepEqual(unknown.actions, []);
  assert.equal(JSON.stringify(v).includes("bossDeck"), false);
});
