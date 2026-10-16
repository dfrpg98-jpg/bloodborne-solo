"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07", H = E.hunter;
function house(kind = "ground") {
  let s = E.create(14, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13,
    qa: { preset: "custom", startRewards: ["lantern"], startConsumables: ["bold-mark"] } });
  const send = c => { s = E.dispatch(s, c); };
  send({ type: "MOVE", cardId: H(s).hand[0].id }); send({ type: "EXPLORE", edge: "N" });
  send({ type: "PLACE_TILE", rotation: 1 }); send({ type: "STEP", node: "tile-11:house" });
  if (kind !== "ground") {
    send({ type: "MOVE", cardId: H(s).hand[0].id }); send({ type: "MISSION_PICKUP" });
    if (kind === "carried") send({ type: "STEP", node: "tile-11:street" });
    send({ type: "STOP_MOVE" });
  }
  assert.equal(E.exportSave(E.importSave(E.exportSave(s))), E.exportSave(s)); return s;
}
function launch(s) {
  const normal = E.exportSave(E.create(721, "burial", 0, null, "hunter-pistol", "center", { campaign: true }));
  const ui = boot(s, E.missionView(s), E.rewardsView(s), { realInventory: true,
    storage: { [normalKey]: normal, [qaKey]: E.exportSave(s), "bloodborne-hunt-active-mode": "qa" },
    engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s } });
  return { ui, normal };
}
function panel(ui, name) { ui.document.querySelectorAll("[data-panel]").find(b => b.dataset.panel === name).click(); }
function current(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(qaKey)); }
function command(ui, type) { return ui.document.querySelectorAll("[data-command]").find(b => b.dataset.command === type); }

for (const kind of ["ground", "armed", "carried"]) test(`${kind}: the lantern previews the right escort outcome, Cancel preserves it and Accept commits exactly once`, () => {
  const s = house(kind), { ui, normal } = launch(s), saved = ui.storage.get(qaKey),
    lamp = H(s).rewards.find(r => r.kind === "lantern"), carried = kind === "carried";
  panel(ui, "rewards"); ui.el(`rewardLamp-${lamp.id}`).value = "tile-14:center";
  assert.match(ui.el("rewards").textContent, carried ? /생존자 원위치 복귀/ : /생존자 함께 이동 불가.*현재 칸에 남음/);
  const use = ui.el("rewards").querySelectorAll("[data-reward-use]").find(b => b.dataset.rewardUse === lamp.id);
  use.focus(); use.click(); assert.equal(ui.el("actionLossDialog").open, true);
  assert.match(ui.el("actionLossList").textContent, carried ? /민가 칸으로 돌아갑니다/ : /함께 순간이동하지 않고 현재 칸에 남습니다/);
  assert.equal(ui.el("escortDialog").open, false, "teleport does not offer walking pickup");
  assert.equal(ui.storage.get(qaKey), saved);
  ui.el("actionLossCancel").click(); assert.equal(ui.el("infoDialog").open, true);
  assert.equal(ui.document.activeElement, use); assert.equal(ui.storage.get(qaKey), saved);
  use.click(); ui.el("actionLossAccept").click();
  const actual = current(ui), expected = E.dispatch(s, { type: "USE_REWARD", rewardId: lamp.id, node: "tile-14:center" });
  assert.deepEqual(actual, expected); assert.equal(actual.commands.length, s.commands.length + 1);
  assert.equal(actual.mission.escort.node, "tile-11:house"); assert.equal(actual.mission.escort.carrierId, null);
  assert.equal(actual.mission.escort.pickup, false); assert.equal(H(actual).rewards.find(r => r.id === lamp.id).ready, false);
  const once = ui.storage.get(qaKey); ui.el("actionLossAccept").click(); assert.equal(ui.storage.get(qaKey), once);
  assert.equal(ui.storage.get(normalKey), normal);
});

test("nearby uncarried escort: Dream has a hint before card selection, Escape preserves the save and acceptance leaves the token outside Dream", () => {
  const s = house(), { ui } = launch(s), saved = ui.storage.get(qaKey), selected = H(s).hand[0].id;
  assert.match(ui.el("decisions").textContent, /생존자 함께 이동 불가/); assert(command(ui, "DREAM").disabled);
  ui.el("hand").querySelectorAll("[data-card]").find(b => b.dataset.card === selected).click();
  command(ui, "DREAM").click(); assert.equal(ui.el("actionLossDialog").open, true);
  assert.match(ui.el("actionLossList").textContent, /꿈에 함께 들어가지 않고 현재 칸에 남습니다/);
  ui.el("actionLossDialog").fire("cancel"); assert.equal(ui.storage.get(qaKey), saved);
  command(ui, "DREAM").click(); ui.el("actionLossAccept").click(); const actual = current(ui);
  assert.deepEqual(actual, E.dispatch(s, { type: "DREAM", cardId: selected }));
  assert(H(actual).inDream); assert.equal(actual.mission.escort.node, "tile-11:house");
});

test("nearby uncarried escort: bold-mark preview and confirmation preserve the inventory on Cancel", () => {
  const s = house(), { ui } = launch(s), saved = ui.storage.get(qaKey), item = H(s).consumables.find(i => i.kind === "bold-mark");
  panel(ui, "inventory"); ui.el("inventory").querySelectorAll("[data-item]").find(b => b.dataset.item === item.id).click();
  ui.el("itemNode").value = "tile-14:center"; ui.el("itemNode").fire("change");
  assert.match(ui.el("itemActionLoss").textContent, /생존자 함께 이동 불가/);
  ui.el("useItem").click(); assert.equal(ui.el("actionLossDialog").open, true);
  ui.el("actionLossCancel").click(); assert.equal(ui.el("infoDialog").open, true);
  assert.equal(ui.storage.get(qaKey), saved); assert(H(current(ui)).consumables.some(i => i.id === item.id));
  ui.el("useItem").click(); ui.el("actionLossAccept").click();
  assert.deepEqual(current(ui), E.dispatch(s, { type: "USE_CONSUMABLE", itemId: item.id, node: "tile-14:center" }));
});
