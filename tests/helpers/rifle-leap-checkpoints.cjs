"use strict";
const assert = require("node:assert/strict"), E = require("../../src/hunt-engine"), M = require("../../src/chapter-engine");
const H = E.hunter, cache = new Map();
const run = (state, ...commands) => commands.reduce((s, command) => E.dispatch(s, command), state);
function checked(state) {
  const saved = E.exportSave(state);
  assert.equal(E.exportSave(E.importSave(saved)), saved, "synthetic checkpoint replays through the strict public save importer");
  return state;
}
// Public-command synthetic QA setup, not a completed normal campaign. The first
// actual enemy is killed by owned tools; its echo purchases Leap from the real
// Dream market. QA card draws then retrieve that legitimately acquired card.
// No card, enemy, movement counter or save snapshot is directly edited.
function beforeLeap(extraRewards = []) {
  const key = JSON.stringify(extraRewards);
  if (!cache.has(key)) {
    const attachedTool = extraRewards.some(kind => ["bloodstone-shard", "bloodstone-chunk", "tear-gem"].includes(kind));
    let state = E.create(1, "rifle-spear", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
      qa: { preset: "custom", startRewards: [...(attachedTool ? ["tiny-tonitrus"] : ["call-beyond", "tiny-tonitrus"]), ...extraRewards],
        startConsumables: [...Array(6).fill("qa-travel"), ...Array(4).fill("qa-cards"), "qa-heal"] } });
    const go = command => { state = E.dispatch(state, command); };
    while (state.rewardChoices.length) go({ type: "EQUIP_REWARD", rewardId: state.rewardChoices[0].rewardId, slot: 0 });
    go({ type: "MOVE", cardId: H(state).hand.find(card => card.kind === "endurance").id });
    go({ type: "EXPLORE", edge: "N" }); go({ type: "PLACE_TILE", rotation: E.placementOptions(state)[0] });
    if (state.phase === "move") go({ type: "STOP_MOVE" });
    while (!state.enemies.length && state.world.tileDeck.length) {
      const exit = M.openExits(state.world).sort((a, b) =>
        E.distance(state, H(state).position, a.node) - E.distance(state, H(state).position, b.node))[0];
      go({ type: "USE_CONSUMABLE", itemId: H(state).consumables.find(item => item.kind === "qa-travel").id });
      for (const to of E.path(state, H(state).position, exit.node).slice(1)) go({ type: "STEP", node: to });
      go({ type: "EXPLORE", edge: exit.edge }); go({ type: "PLACE_TILE", rotation: E.placementOptions(state)[0] });
      if (state.phase === "move") go({ type: "STOP_MOVE" });
    }
    const first = state.enemies[0]; assert(first);
    go({ type: "USE_REWARD", rewardId: H(state).rewards.find(reward => reward.kind === "tiny-tonitrus").id, enemyId: first.id });
    go({ type: "USE_CONSUMABLE", itemId: H(state).consumables.find(item => item.kind === "qa-travel").id });
    for (const to of E.path(state, H(state).position, first.node).slice(1)) go({ type: "STEP", node: to });
    if (state.phase === "move") go({ type: "STOP_MOVE" });
    if (attachedTool) {
      // A permanent attachment is itself a tool. Keep the two-tool cap by
      // replacing Call Beyond in this branch and earning the echo in a real
      // same-cell stat attack instead of silently granting a third tool.
      const target = state.enemies.find(enemy => enemy.id !== first.id);
      assert(target); go({ type: "ATTACK", enemyId: target.id,
        cardId: H(state).hand.find(card => card.kind === "strength").id, slot: 2 });
      go({ type: "RESOLVE" });
      while (state.phase === "stun") go({ type: "STUN_DISCARD", cardId: H(state).hand[0].id });
      while (state.phase === "combat_extra") go({ type: "EXTRA_TAKE" });
      assert.equal(state.phase, "hunter");
    } else go({ type: "USE_REWARD", rewardId: H(state).rewards.find(reward => reward.kind === "call-beyond").id });
    if (!H(state).hand.length)
      go({ type: "USE_CONSUMABLE", itemId: H(state).consumables.find(item => item.kind === "qa-cards").id });
    assert(H(state).echoes > 0); go({ type: "DREAM", cardId: H(state).hand[0].id });
    assert.equal(state.phase, "upgrade_pick"); assert(state.market.includes("leap"));
    go({ type: "PICK_UPGRADE", index: state.market.indexOf("leap") });
    go({ type: "REPLACE_UPGRADE", replaceId: H(state).deck.find(card => card.kind === "strength").id });
    go({ type: "REFILL" });
    const lamp = E.nodes(state).filter(node => node.lamp).sort((a, b) =>
      E.distance(state, a.id, state.enemies[0].node) - E.distance(state, b.id, state.enemies[0].node))[0];
    go({ type: "RETURN", node: lamp.id, face: 1 });
    while (!H(state).hand.some(card => E.card(card).leap))
      go({ type: "USE_CONSUMABLE", itemId: H(state).consumables.find(item => item.kind === "qa-cards").id });
    assert.equal(state.phase, "hunter"); assert.equal(H(state).moveActionsRound || 0, 0);
    assert.equal(state.leapMoveRuling, undefined); cache.set(key, checked(state));
  }
  return structuredClone(cache.get(key));
}
function selection(state, overrides = {}) {
  const target = state.enemies.find(enemy => enemy.id === overrides.enemyId) || state.enemies[0],
    path = target && E.leapPaths(state, target.node).find(path => path.length > 1);
  return { type: "ATTACK", enemyId: target.id, cardId: H(state).hand.find(card => E.card(card).leap).id,
    slot: 2, ...(path ? { leapPath: path } : {}), pullIds: [], itemIds: [], rewardIds: [], weaponBoost: "none", ...overrides };
}
function walk(state, nodes) {
  state = E.dispatch(state, { type: "USE_CONSUMABLE", itemId: H(state).consumables.find(item => item.kind === "qa-travel").id });
  state = run(state, ...nodes.map(node => ({ type: "STEP", node })));
  if (state.phase === "move") state = E.dispatch(state, { type: "STOP_MOVE" });
  return checked(state);
}
module.exports = { beforeLeap, checked, run, selection, walk };
