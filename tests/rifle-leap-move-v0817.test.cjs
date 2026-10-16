"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../hunt-engine"), P = require("../hunt-attack-preview");
const Q = require("./helpers/rifle-leap-checkpoints.cjs"), H = E.hunter;
const hash = state => crypto.createHash("sha256").update(E.exportSave(state)).digest("hex");
const adopt = state => Q.checked(E.applyLeapMoveRuling(state));
function compare(state, command) {
  const saved = E.exportSave(state), request = structuredClone(command), preview = P.view(state, E,
    { ...command, kind: command.type });
  assert(preview.ready); assert.equal(E.exportSave(state), saved); assert.deepEqual(command, request);
  const after = Q.checked(E.dispatch(state, command));
  assert(after.combat?.attack); assert.equal(preview.damage, after.combat.attack.damage);
  assert.equal(preview.speed, after.combat.attack.speed); assert.equal(E.exportSave(state), saved);
  return { preview, after };
}
function finishCombat(state) {
  for (let i = 0; i < 10 && state.phase !== "hunter"; i++) {
    if (state.phase === "combat_react") state = E.dispatch(state, { type: "RESOLVE" });
    else if (state.phase === "stun") state = E.dispatch(state, { type: "STUN_DISCARD", cardId: H(state).hand[0].id });
    else if (state.phase === "combat_extra") state = E.dispatch(state, { type: "EXTRA_TAKE" });
    else throw Error("Unexpected public continuation: " + state.phase);
  }
  assert.equal(state.phase, "hunter"); return Q.checked(state);
}

test("raw legacy Leap saves remain byte-exact and preserve their originally declared four damage", () => {
  const before = Q.beforeLeap(), command = Q.selection(before), after = Q.checked(E.dispatch(before, command));
  // Captured before the correction. Historical raw creation and import never
  // adopt a new policy silently, even though new UI sessions do adopt it.
  assert.equal(hash(before), "6d34165b5f31f59978bb384fbc06d745f6d68950c7cc3d8e1b58d2daf7fe0267");
  assert.equal(hash(after), "7775f6dbe72e702a11360be2bc5b5990cea83fe1e5615e7e4bbe48f6eb526993");
  assert.equal(before.commands.length, 22); assert.equal(before.leapMoveRuling, undefined);
  assert.equal(after.leapMoveRuling, undefined); assert.equal(H(after).moveActionsRound, 0);
  assert.equal(after.combat.attack.damage, 4); assert.equal(P.view(before, E, command).damage, 4);
});

test("adoption records one explicit ruling without spending resources, changing the round or retroactively counting movement", () => {
  const before = Q.beforeLeap(), saved = E.exportSave(before), after = adopt(before);
  assert.equal(E.exportSave(before), saved); assert.notEqual(after, before);
  assert.equal(after.leapMoveRuling, "move-action"); assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(after.commands.slice(0, -1), before.commands);
  assert.deepEqual(after.commands.at(-1), { type: "APPLY_LEAP_MOVE_RULING" });
  for (const key of Object.keys(before).filter(key => !["revision", "commands", "events"].includes(key)))
    assert.deepEqual(after[key], before[key], key + " is unchanged by policy adoption");
  assert.equal(H(after).moveActionsRound, 0); assert.equal(E.applyLeapMoveRuling(after), after);
  assert.throws(() => E.dispatch(after, { type: "APPLY_LEAP_MOVE_RULING" }));
});

for (const distance of [1, 2]) test(`${distance}-cell Leap is one movement action and its final preview agrees with the attack`, () => {
  let before = adopt(Q.beforeLeap());
  if (distance === 1) before = Q.walk(before, ["tile-03:entry"]);
  const command = Q.selection(before), { preview, after } = compare(before, command);
  assert.equal(command.leapPath.length - 1, distance); assert.equal(H(before).moveActionsRound, 0);
  assert.equal(preview.leapMoveActions, 1); assert.equal(preview.moveActions, 1);
  assert.equal(preview.formula.damage.weapon, 1); assert.equal(preview.damage, 5);
  assert.match(P.renderHTML(preview), /도약 선행 이동 1회 포함/);
  assert.equal(H(after).moveActionsRound, 1); assert.equal(H(after).position, before.enemies[0].node);
  assert.equal(H(after).hand.length, H(before).hand.length - 1);
});

test("the reported first-slot shard pattern predicts base two plus card one plus shard one plus Leap movement one", () => {
  const before = adopt(Q.beforeLeap(["bloodstone-shard"])), shard = H(before).rewards.find(reward => reward.kind === "bloodstone-shard");
  assert.equal(shard.slot, 0); assert.equal(shard.equipped, true); assert.equal(H(before).moveActionsRound, 0);
  const { preview, after } = compare(before, Q.selection(before, { slot: 0 }));
  assert.deepEqual(preview.formula.damage, { base: 2, card: 1, attachment: 1, reward: 0, item: 0, weapon: 1, total: 5 });
  assert.equal(preview.leapMoveActions, 1); assert.equal(after.combat.attack.damage, 5);
  assert.equal(H(after).moveActionsRound, 1); assert.equal(H(after).rewards.find(reward => reward.id === shard.id).slot, 0);
});

test("one earlier MOVE and a two-cell Leap are two actions rather than three traversed cells", () => {
  let before = adopt(Q.beforeLeap());
  before = Q.run(before, { type: "MOVE", cardId: H(before).hand.find(card => card.kind === "strength").id },
    { type: "STEP", node: "tile-14:left" }, { type: "STEP", node: "tile-14:center" });
  assert.equal(before.phase, "hunter"); assert.equal(H(before).moveActionsRound, 1);
  const { preview, after } = compare(before, Q.selection(before));
  assert.equal(preview.moveActions, 2); assert.equal(preview.leapMoveActions, 1);
  assert.equal(preview.formula.damage.weapon, 2); assert.equal(preview.damage, 6);
  assert.equal(H(after).moveActionsRound, 2);
});

test("a same-cell Leap attack is optional movement declined and cannot invent a movement bonus", () => {
  const before = Q.walk(adopt(Q.beforeLeap()), ["tile-03:entry", "tile-03:room"]), command = Q.selection(before),
    { preview, after } = compare(before, command);
  assert.equal(command.leapPath, undefined); assert.equal(preview.leapMoveActions, 0);
  assert.equal(preview.moveActions, 0); assert.equal(preview.formula.damage.weapon, 0);
  assert.equal(preview.damage, 4); assert.equal(H(after).moveActionsRound, 0);
});

test("a normal strength attack in the same cell does not count its card as a MOVE action", () => {
  const before = Q.walk(adopt(Q.beforeLeap()), ["tile-03:entry", "tile-03:room"]), command = Q.selection(before,
    { cardId: H(before).hand.find(card => card.kind === "strength").id }), { preview, after } = compare(before, command);
  assert.equal(preview.leapMoveActions, 0); assert.equal(preview.formula.damage.weapon, 0);
  assert.equal(after.combat.attack.damage, 4); assert.equal(H(after).moveActionsRound, 0);
});

test("counterattacking with Leap never performs or predicts its hunter-turn pre-attack movement", () => {
  let before = adopt(Q.beforeLeap());
  for (let i = 0; i < 3 && before.phase !== "combat_choose"; i++) {
    before = E.dispatch(before, { type: "END_TURN" });
    if (before.phase === "refill") before = E.dispatch(before, { type: "REFILL" });
  }
  assert.equal(before.phase, "combat_choose"); assert.equal(H(before).position, before.enemies[0].node);
  const command = Q.selection(before, { type: "COUNTER" }), { preview, after } = compare(before, command);
  assert.equal(preview.leapMoveActions, 0); assert.equal(preview.moveActions, 0);
  assert.equal(preview.damage, 4); assert.equal(H(after).moveActionsRound, 0);
});

test("Clawmark replacement suppresses Leap movement and still permits an ordinary replaced-card attack in the same cell", () => {
  const before = adopt(Q.beforeLeap(["rune-clawmark"])), rune = H(before).rewards.find(reward => reward.kind === "rune-clawmark"),
    command = Q.selection(before, { rewardIds: [rune.id] }), saved = E.exportSave(before), preview = P.view(before, E, command);
  assert.equal(preview.suppressedCardEffects, true); assert.equal(preview.leapMoveActions, 0);
  assert.equal(preview.formula.damage.card, 0); assert.equal(preview.formula.damage.weapon, 0);
  assert.throws(() => E.dispatch(before, command), /같은 칸/); assert.equal(E.exportSave(before), saved);
  const colocated = Q.walk(before, ["tile-03:entry", "tile-03:room"]), actual = compare(colocated,
    Q.selection(colocated, { rewardIds: [rune.id] }));
  assert.equal(actual.preview.leapMoveActions, 0); assert.equal(actual.preview.damage, 4);
  assert.equal(H(actual.after).moveActionsRound, 0);
});

test("an invalid Leap route or missing enemy cannot increment or spend any movement, card, reward or RNG", () => {
  const before = adopt(Q.beforeLeap()), saved = E.exportSave(before), command = Q.selection(before);
  for (const invalid of [{ ...command, leapPath: ["tile-14:center", "tile-14:left", "tile-03:room"] },
    { ...command, enemyId: "missing" }]) {
    assert.throws(() => E.dispatch(before, invalid)); assert.equal(E.exportSave(before), saved);
  }
  assert.equal(P.view(before, E, { ...command, enemyId: "missing" }).leapMoveActions, 0);
});

test("the counter is recorded once, survives combat completion and resets on the real next round", () => {
  const before = adopt(Q.beforeLeap()), declaration = E.dispatch(before, Q.selection(before));
  assert.equal(H(declaration).moveActionsRound, 1);
  const finished = finishCombat(declaration); assert.equal(H(finished).moveActionsRound, 1);
  assert.equal(finished.leap, null); assert.equal(finished.enemies.length, 0);
  const ended = Q.checked(E.dispatch(finished, { type: "END_TURN" }));
  assert.equal(ended.round, finished.round + 1); assert.equal(H(ended).moveActionsRound, 0);
  assert.equal(ended.leapMoveRuling, "move-action");
});

test("the straight rifle face records Leap movement even though only the unfolded face grants damage per action", () => {
  let before = adopt(Q.beforeLeap());
  before = E.dispatch(before, { type: "TRANSFORM", cardId: H(before).hand.find(card => card.kind === "strength").id });
  assert.equal(H(before).face, 0); const { preview, after } = compare(before, Q.selection(before));
  assert.equal(preview.leapMoveActions, 1); assert.equal(preview.formula.damage.weapon, 0);
  assert.equal(preview.damage, 3); assert.equal(H(after).moveActionsRound, 1);
});

test("a previously declared legacy combat defers adoption until completion and is never increased retroactively", () => {
  const raw = Q.beforeLeap(), pending = Q.checked(E.dispatch(raw, Q.selection(raw))), saved = E.exportSave(pending);
  assert.equal(pending.combat.attack.damage, 4); assert.equal(E.applyLeapMoveRuling(pending), pending);
  assert.throws(() => E.dispatch(pending, { type: "APPLY_LEAP_MOVE_RULING" }));
  assert.equal(E.exportSave(pending), saved);
  const finished = finishCombat(pending), adopted = adopt(finished);
  assert.equal(H(adopted).moveActionsRound, 0, "adopting later cannot count an old leap");
  assert.equal(adopted.leapMoveRuling, "move-action"); assert.equal(adopted.kills, finished.kills);
});

test("hunter, ordinary movement, tile placement, refill and Dream return are safe explicit adoption boundaries", () => {
  const fresh = () => E.create(1, "rifle-spear", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: [], startConsumables: [] } }), start = fresh(),
    moving = E.dispatch(start, { type: "MOVE", cardId: H(start).hand[0].id }),
    placing = E.dispatch(moving, { type: "EXPLORE", edge: "N" }),
    refill = E.dispatch(start, { type: "DREAM", cardId: H(start).hand[0].id }),
    returning = E.dispatch(refill, { type: "REFILL" });
  for (const state of [start, moving, placing, refill, returning]) {
    const prior = E.exportSave(state), after = adopt(state);
    assert.equal(after.leapMoveRuling, "move-action", state.phase); assert.equal(after.phase, state.phase);
    assert.deepEqual(after.commands.at(-1), { type: "APPLY_LEAP_MOVE_RULING" });
    assert.equal(E.exportSave(state), prior); assert.equal(after.track, state.track);
    assert.deepEqual(H(after), H(state)); assert.deepEqual(after.world, state.world);
  }
});

test("all supported historical rifle rules opt in explicitly while other weapons are untouched", () => {
  for (const rulesVersion of [10, 11, 12, 13, 14]) for (const face of [0, 1]) {
    const before = E.create(1, "rifle-spear", face, null, "hunter-pistol", "center", { campaign: true, rulesVersion });
    assert.equal(before.leapMoveRuling, undefined); assert.equal(adopt(before).leapMoveRuling, "move-action");
  }
  for (const weaponId of ["burial", "hunter-axe", "beast-claw"]) {
    const before = E.create(1, weaponId, 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }), saved = E.exportSave(before);
    assert.equal(E.applyLeapMoveRuling(before), before); assert.equal(E.exportSave(before), saved);
    assert.throws(() => E.dispatch(before, { type: "APPLY_LEAP_MOVE_RULING" }));
  }
});

test("Leap preview reads visible targets and routes without dispatching or accessing hidden draw piles", () => {
  const before = adopt(Q.beforeLeap()), command = Q.selection(before), expected = P.view(before, E, command);
  for (const key of ["enemyDeck", "enemyDiscard", "consumableDeck", "upgradeDeck", "rng", "events", "commands"])
    Object.defineProperty(before, key, { get() { throw Error("hidden " + key); }, configurable: true });
  for (const key of ["deck", "discard"])
    Object.defineProperty(H(before), key, { get() { throw Error("hidden " + key); }, configurable: true });
  const engine = { ...E, get dispatch() { throw Error("dispatch forbidden"); }, get importSave() { throw Error("import forbidden"); } };
  Object.freeze(H(before).hand); Object.freeze(H(before).slots); Object.freeze(H(before)); Object.freeze(before);
  const preview = P.view(before, engine, command);
  assert.equal(preview.damage, expected.damage); assert.equal(preview.moveActions, expected.moveActions);
  assert.doesNotMatch(JSON.stringify(preview), /enemyDeck|enemyDiscard|rng|hidden/);
});
