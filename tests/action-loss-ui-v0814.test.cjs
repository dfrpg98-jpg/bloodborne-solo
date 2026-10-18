"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07", cache = new Map();
function natural(file, count) {
  const key = `${file}/${count}`;
  if (!cache.has(key)) {
    let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13,
      qa: { preset: "custom", startRewards: [], startConsumables: [] } });
    for (const command of require("./fixtures/" + file).slice(0, count)) s = E.dispatch(s, command);
    assert.equal(E.exportSave(E.importSave(E.exportSave(s))), E.exportSave(s)); cache.set(key, s);
  }
  return structuredClone(cache.get(key));
}
const twoHeld = () => natural("v074-clinic-escort-chapter-two-natural-commands.json", 157),
  captured = () => natural("v074-help-iosefka-natural-commands.json", 318);
function launch(state, isolated = false) {
  const normal = E.exportSave(E.create(721, "burial", 0, null, "hunter-pistol", "center", { campaign: true })),
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
      storage: { [normalKey]: normal, [qaKey]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
      engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s,
        ...(isolated ? { importSave: text => JSON.parse(text).state } : {}) } });
  return { ui, normal };
}
function current(ui, isolated = false) {
  assert.equal(ui.el("error").textContent, "");
  const saved = ui.storage.get(qaKey), result = isolated ? JSON.parse(saved).state : E.importSave(saved);
  E.assertState(result); return result;
}
function command(ui, type) {
  const result = ui.document.querySelectorAll("[data-command]").find(b => b.dataset.command === type);
  assert(result, `${type} is visible`); return result;
}
function selectCard(ui, id) {
  const result = ui.el("hand").querySelectorAll("[data-card]").find(b => b.dataset.card === id);
  assert(result); result.click();
}
function beginDream(ui) {
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .find(button => button.dataset.hunterIntent === "DREAM");
  assert(intent && !intent.disabled, "Dream intent is available before choosing its card"); intent.click();
  assert.equal(ui.el("confirmHunterAction").disabled, true);
}
function openPanel(ui, panel) {
  const button = ui.document.querySelectorAll("[data-panel]").find(b => b.dataset.panel === panel);
  assert(button); button.focus(); button.click(); assert.equal(ui.el("infoDialog").open, false);
  assert.equal(ui.el(panel === "inventory" ? "workspaceInventory" : "rewardsPanel").hidden, false);
}
test("two held survivors are labelled before cost selection, and Cancel and Escape preserve every saved byte", () => {
  const state = twoHeld(), { ui, normal } = launch(state), saved = ui.storage.get(qaKey);
  assert.match(ui.el("hunterActionBar").innerHTML, /생존자 2명 상실/);
  assert.equal(ui.el("actionLossDialog").open, false);
  beginDream(ui);
  selectCard(ui, E.hunter(state).hand[0].id);
  for (const cancel of [() => ui.el("actionLossCancel").click(), () => ui.el("actionLossDialog").fire("cancel")]) {
    const opener = command(ui, "DREAM"); assert.equal(opener.disabled, false); opener.focus(); opener.click();
    assert.equal(ui.el("actionLossDialog").open, true); assert.equal(ui.storage.get(qaKey), saved);
    assert.equal(ui.document.activeElement, ui.el("actionLossCancel"));
    assert.match(ui.el("actionLossSummary").textContent, /생존자 2명 상실/);
    assert.match(ui.el("actionLossList").textContent, /토큰 2개를 모두 잃습니다.*인도되지/);
    cancel(); assert.equal(ui.el("actionLossDialog").open, false);
    assert.equal(ui.storage.get(qaKey), saved); assert.equal(ui.storage.get(normalKey), normal);
    assert.equal(ui.document.activeElement, opener);
    assert.equal(current(ui).mission.heldSurvivors[state.activeHunterId], 2);
  }
});
test("accepting the loss commits the original Dream command once, preserves the normal save and clears the two tokens", () => {
  const state = twoHeld(), { ui, normal } = launch(state), selected = E.hunter(state).hand[0].id;
  beginDream(ui); selectCard(ui, selected); command(ui, "DREAM").click();
  ui.el("actionLossAccept").click(); const actual = current(ui), expected = E.dispatch(state, { type: "DREAM", cardId: selected });
  assert.deepEqual(actual, expected); assert.equal(actual.commands.length, state.commands.length + 1);
  assert.equal(actual.mission.heldSurvivors[actual.activeHunterId], 0); assert.equal(E.hunter(actual).inDream, true);
  const saved = ui.storage.get(qaKey); ui.el("actionLossAccept").click();
  assert.equal(ui.storage.get(qaKey), saved, "a second click cannot repeat Dream entry or its costs");
  assert.equal(ui.storage.get(normalKey), normal); assert.equal(ui.el("actionLossDialog").open, false);
});
test("central-lamp selection shows a drop warning and confirmation precedes a queued enemy response", () => {
  // The enemy is deliberately moved to an existing public checkpoint for this
  // isolated controller branch. Natural state/commands cover all other tests.
  const state = captured(), ordinary = state.enemies.find(e => !e.missionId); assert(ordinary);
  ordinary.node = E.hunter(state).position; E.assertState(state);
  const { ui, normal } = launch(state, true), saved = ui.storage.get(qaKey), selected = E.hunter(state).hand[0].id;
  selectCard(ui, selected); assert(ui.el("tileLamp"));
  ui.el("tileLamp").value = "tile-20:room"; ui.el("tileLamp").fire("change");
  assert.match(ui.el("interactionLossHint").textContent, /실험 생존자 현재 칸에 남김/);
  ui.el("interact").click(); assert.equal(ui.el("actionLossDialog").open, true);
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(current(ui, true).mission.survivor.carrierId, state.activeHunterId);
  ui.el("actionLossAccept").click(); const actual = current(ui, true), expected = E.dispatch(state,
    { type: "INTERACT", cardId: selected, lootCount: 0, heal: false, lamp: "tile-20:room" });
  assert.deepEqual(actual, expected); assert(actual.combat || actual.phase === "interaction_order");
  assert.equal(actual.mission.survivor.carrierId, actual.activeHunterId, "the drop waits for the declared interaction to resolve");
  assert.equal(actual.interaction.lamp, "tile-20:room"); assert.equal(ui.storage.get(normalKey), normal);
});
test("canceling a portable-lantern action returns to the rewards panel and keeps the tool ready", () => {
  const state = captured(), { ui, normal } = launch(state), lamp = E.hunter(state).rewards.find(r => r.kind === "lantern"),
    saved = ui.storage.get(qaKey);
  openPanel(ui, "rewards"); ui.el(`rewardLamp-${lamp.id}`).value = "tile-20:room";
  assert.match(ui.el("rewards").innerHTML, /실험 생존자 현재 칸에 남김/);
  const use = ui.el("rewards").querySelectorAll("[data-reward-use]").find(b => b.dataset.rewardUse === lamp.id);
  assert(use && !use.disabled); use.focus(); use.click();
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("actionLossDialog").open, true);
  assert.equal(ui.storage.get(qaKey), saved); ui.el("actionLossCancel").click();
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("rewardsPanel").hidden, false);
  assert.equal(ui.document.activeElement, use); assert.equal(ui.storage.get(qaKey), saved);
  assert.equal(E.hunter(current(ui)).rewards.find(r => r.id === lamp.id).ready, true);
  assert.equal(ui.storage.get(normalKey), normal);
});
test("a teleport consumable warns inside inventory and cancellation restores the panel without consuming it", () => {
  const state = captured(), index = state.consumableDeck.findIndex(item => item.kind === "bold-mark"); assert(index >= 0);
  const [item] = state.consumableDeck.splice(index, 1); E.hunter(state).consumables.push(item); E.assertState(state);
  const { ui, normal } = launch(state, true), saved = ui.storage.get(qaKey);
  openPanel(ui, "inventory");
  ui.el("inventory").querySelectorAll("[data-item]").find(b => b.dataset.item === item.id).click();
  ui.el("itemNode").value = "tile-20:room"; ui.el("itemNode").fire("change");
  assert.match(ui.el("itemActionLoss").textContent, /실험 생존자 현재 칸에 남김/);
  const use = ui.el("useItem"); assert.equal(use.disabled, false); use.focus(); use.click();
  assert.equal(ui.el("actionLossDialog").open, true); assert.equal(ui.el("infoDialog").open, false);
  assert.equal(ui.storage.get(qaKey), saved); ui.el("actionLossCancel").click();
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("workspaceInventory").hidden, false);
  assert.equal(ui.document.activeElement, use); assert.equal(ui.storage.get(qaKey), saved);
  assert(E.hunter(current(ui, true)).consumables.some(x => x.id === item.id)); assert.equal(ui.storage.get(normalKey), normal);
});
test("the historical command replay helper accepts only a matched explicit transport loss request", () => {
  const { clickCommand } = require("./helpers/public-command-ui.cjs"), qa = twoHeld(),
    // The existing helper preserves historical normal-mode trace storage.
    // Re-create the same public trace in its original mode for that adapter.
    state = E.create(qa.initialSeed, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  let before = state; for (const command of qa.commands) before = E.dispatch(before, command);
  let observed = 0;
  const command = { type: "DREAM", cardId: E.hunter(before).hand[0].id }, result = clickCommand(before, command,
    { onActionLossRequest(ui, notice) { observed++; assert.equal(notice.losses[0].count, 2); assert.equal(ui.el("actionLossDialog").open, true); } });
  assert.equal(observed, 1); assert.deepEqual(result, E.dispatch(before, command));
});
