"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"), { clickCommand, replayPublicTrace } = require("./helpers/public-command-ui.cjs");
const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1", activeKey = "bloodborne-hunt-active-mode";
const realEngine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: state => state };
function normal() { return E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true }); }
function qa() { return E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, qa: { preset: "fast" } }); }
function realBoot(state, options = {}) {
  const key = state.setup.qa ? qaKey : normalKey;
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state), [activeKey]: state.setup.qa ? "qa" : "normal" }, engine: realEngine, ...options });
}
function panelButton(ui, name) {
  const button = ui.document.querySelectorAll("[data-panel]").find(element => element.dataset.panel === name);
  assert(button, `visible entry point for ${name}`); return button;
}
function openPanel(ui, name) {
  const button = panelButton(ui, name); button.focus(); button.click();
  assert.equal(ui.el("infoDialog").open, true, `${name} dialog is open`);
  const panels = ui.document.querySelectorAll("[data-info-panel]");
  assert.equal(panels.filter(element => !element.hidden).length, 1, "one information panel is active");
  assert.equal(panels.find(element => element.dataset.infoPanel === name)?.hidden, false, `${name} is selected`);
  assert(ui.el("infoTitle").textContent.trim(), "the dialog has an accessible title");
  return button;
}
function commandButton(ui, type) { return ui.buttons("decisions").find(button => button.dataset.command === type && !button.disabled); }

test("the screen keeps one map, status, current objective, action area, hand and weapon dock with separate information panels", () => {
  const html = fs.readFileSync(path.join(__dirname, "../hunt.html"), "utf8"), ui = realBoot(normal());
  assert(ui.document.body.classList.contains("hunt-screen"));
  for (const id of ["mapViewport", "chapterMap", "status", "missionObjectives", "decisions", "hand", "slots", "firearm", "infoDialog", "infoTitle", "closeInfo"]) {
    assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`, "g"))].length, 1, `${id} occurs once`);
    assert(ui.el(id), `${id} controller target exists`);
  }
  assert(ui.el("chapterMap").innerHTML.includes("assets/tiles/tile-14.svg"), "the independent map is rendered");
  assert(ui.el("hand").querySelectorAll("[data-card]").length, "actual hand cards remain selectable");
  assert(ui.el("slots").querySelectorAll("[data-slot]").length, "weapon slots remain selectable");
  assert(ui.el("status").innerHTML.trim()); assert(ui.el("missionObjectives").innerHTML.trim());
  for (const name of ["inventory", "rewards", "journal", "enemies", "help"]) panelButton(ui, name);
  assert.equal(ui.el("error").textContent, "");
});

test("opening and closing every information panel preserves the exact game save and returns focus", () => {
  const state = qa(), ui = realBoot(state), before = ui.storage.get(qaKey);
  for (const name of ["inventory", "rewards", "journal", "enemies", "help"]) {
    const opener = openPanel(ui, name);
    assert.equal(ui.commands.length, 0, "browsing never dispatches a game command");
    assert.equal(ui.storage.get(qaKey), before, "browsing leaves exact replay bytes unchanged");
    ui.el("closeInfo").click(); assert.equal(ui.el("infoDialog").open, false);
    assert.equal(ui.document.activeElement, opener, "focus returns to the opening button");
  }
  assert.equal(ui.storage.get(qaKey), before);
});

test("Escape closes the active information panel without dispatching or changing the selected hunt", () => {
  const state = normal(), ui = realBoot(state), before = ui.storage.get(normalKey), opener = openPanel(ui, "journal");
  const event = ui.el("infoDialog").fire("cancel");
  assert.equal(event.defaultPrevented, true, "the controlled close path handles native dialog cancellation");
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.document.activeElement, opener);
  assert.equal(ui.commands.length, 0); assert.equal(ui.storage.get(normalKey), before);
});

test("switching tabs inside the dialog restores focus to the external opening button when it closes", () => {
  const ui = realBoot(normal()), before = ui.storage.get(normalKey), opener = openPanel(ui, "inventory"),
    tab = ui.document.querySelectorAll("[data-panel]").filter(element => element.dataset.panel === "rewards").at(-1);
  assert(tab && tab !== panelButton(ui, "rewards"), "the internal rewards tab exists");
  tab.focus(); tab.click(); assert.equal(ui.el("infoDialog").open, true);
  assert.equal(ui.document.querySelectorAll("[data-info-panel]").filter(element => !element.hidden).length, 1);
  assert.equal(ui.document.querySelectorAll("[data-info-panel]").find(element => element.dataset.infoPanel === "rewards").hidden, false);
  ui.el("closeInfo").click(); assert.equal(ui.el("infoDialog").open, false);
  assert.equal(ui.document.activeElement, opener, "closing cannot leave keyboard focus inside the closed dialog");
  assert.equal(ui.storage.get(normalKey), before); assert.equal(ui.commands.length, 0);
});

test("new-hunt setup closes the information panel while keeping the existing saved hunt intact", () => {
  const state = normal(), ui = realBoot(state), before = ui.storage.get(normalKey);
  openPanel(ui, "help"); ui.el("new").click();
  assert.equal(ui.el("setupDialog").open, true); assert.equal(ui.el("infoDialog").open, false);
  assert.equal(ui.storage.get(normalKey), before); assert.equal(ui.commands.length, 0);
});

test("journal reading is limited to revealed text and does not expose later cards or source photos", () => {
  const state = normal(), ui = realBoot(state), before = ui.storage.get(normalKey);
  openPanel(ui, "journal");
  const entries = ui.el("storyList").querySelectorAll("[data-story-key]");
  assert(entries.length, "revealed story is readable from the journal");
  for (const entry of entries) assert(E.missionView(state).revealed.includes(Number(entry.dataset.storyKey.split(":")[1])));
  assert.equal(entries.some(entry => entry.dataset.storyKey === "1:60"), false);
  entries[0].focus(); entries[0].click();
  assert.equal(ui.el("storyDialog").open, true); assert.equal(ui.el("infoDialog").open, false);
  assert(ui.el("storyText").textContent.trim());
  for (const element of [ui.el("storyPanel"), ui.el("storyList"), ui.el("storyText"), ui.el("rewards"), ui.el("componentCards")])
    assert.doesNotMatch(element.innerHTML, /campaigns\/long-hunt\/images|components\/images|\.jpe?g(?:["?#]|$)/i);
  ui.el("closeStory").click(); assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.storage.get(normalKey), before); assert.equal(ui.commands.length, 0);
});

test("QA consumables remain usable through the inventory overlay and their game action returns to the map", () => {
  const state = qa(), savedNormal = E.exportSave(normal()), ui = realBoot(state, {
    storage: { [normalKey]: savedNormal, [qaKey]: E.exportSave(state), [activeKey]: "qa" } });
  openPanel(ui, "inventory");
  const item = E.hunter(state).consumables.find(value => value.kind === "qa-cards"),
    card = ui.el("inventory").querySelectorAll("[data-item]").find(element => element.dataset.item === item.id);
  assert(card); card.click(); assert(ui.el("useItem") && !ui.el("useItem").disabled); ui.el("useItem").click();
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.el("infoDialog").open, false);
  const next = E.importSave(ui.storage.get(qaKey));
  assert.equal(next.commands.at(-1).type, "USE_CONSUMABLE"); assert.equal(E.hunter(next).hand.length, 6);
  assert.equal(ui.storage.get(normalKey), savedNormal);
  assert.deepEqual(E.importSave(E.exportSave(next)), next);
});

test("a reaction reward can be used during real combat from its overlay without losing the combat decision", () => {
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true,
    qa: { preset: "custom", startRewards: ["old-hunter-bone"], startConsumables: [] } });
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
  for (const command of commands.slice(0, 6)) state = E.dispatch(state, command);
  assert.equal(state.phase, "combat_react");
  const reward = E.rewardsView(state).rewards.find(value => value.kind === "old-hunter-bone");
  assert.equal(reward.usable, true); const ui = realBoot(state); openPanel(ui, "rewards");
  const action = ui.buttons("rewards").find(button => button.dataset.command === "USE_REWARD" && !button.disabled);
  assert(action, "the combat reaction reward is actionable from its panel"); action.click();
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.el("infoDialog").open, false);
  const next = E.importSave(ui.storage.get(qaKey)), reference = E.dispatch(state, { type: "USE_REWARD", rewardId: reward.id });
  assert.deepEqual(next, reference); assert.equal(next.combat.dodged, true);
  assert.equal(next.phase, "combat_react"); assert(commandButton(ui, "RESOLVE"), "the remaining combat action is still accessible on the map HUD");
});

test("mandatory reward decisions remain in the action area while movement and other actions are blocked", () => {
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json"); let state = normal();
  for (const command of commands) { state = E.dispatch(state, command); if (state.rewardChoices.length) break; }
  assert.equal(state.phase, "move"); const ui = realBoot(state), choice = state.rewardChoices[0];
  assert.equal(ui.el("rewardPendingBadge").hidden, false);
  assert(commandButton(ui, choice.firearmId ? "KEEP_FIREARM" : "KEEP_REWARD"), "mandatory equipment choice is directly actionable");
  assert(!commandButton(ui, "MOVE")); assert(!commandButton(ui, "STOP_MOVE"));
  const next = clickCommand(state, choice.firearmId ? { type: "KEEP_FIREARM", firearmId: choice.firearmId } : { type: "KEEP_REWARD", rewardId: choice.rewardId });
  assert.equal(next.rewardChoices.length, 0); assert.deepEqual(E.importSave(E.exportSave(next)), next);
});

test("the map HUD replays 351 original commands through public controls with exact projected saves", t => {
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
  assert.equal(commands.length, 351); const phases = new Set(), chapters = new Set();
  const replay = replayPublicTrace(normal(), commands, { label: "HUD", clickOptions: { onBoot(ui) {
    assert.equal(ui.el("error").textContent, "");
    assert(ui.el("status").innerHTML.trim()); assert(ui.el("chapterMap").innerHTML.trim());
    assert(ui.el("hand") && ui.el("slots") && ui.el("missionObjectives"));
  }, beforeInventory: ui => openPanel(ui, "inventory"), afterInventory: ui => { if (ui.el("infoDialog").open) ui.el("closeInfo").click(); },
    beforeReward: ui => openPanel(ui, "rewards"), beforeTarget: ui => openPanel(ui, "enemies"),
    afterTarget: ui => { if (ui.el("infoDialog").open) ui.el("closeInfo").click(); } },
    onCheckpoint({ beforeReference }) { phases.add(beforeReference.phase); chapters.add(beforeReference.mission.chapter); } });
  const state = replay.state;
  assert.equal(replay.originalCommandCount, 351);
  // The source's only pickup reservation ends in teleport without departure.
  assert.equal(replay.deferredReservations, 1); assert.equal(replay.uiCommandCount, 350);
  t.diagnostic(JSON.stringify({ originalCommandCount: replay.originalCommandCount,
    uiCommandCount: replay.uiCommandCount, deferredReservations: replay.deferredReservations }));
  assert.equal(state.result, "campaign-win"); assert.deepEqual([...chapters], [1, 2, 3]);
  for (const phase of ["move", "tile_place", "combat_choose", "combat_react", "upgrade_pick", "upgrade_replace", "between_chapters", "firearm_react", "boss_move"])
    assert(phases.has(phase), `${phase} is reached by normal play`);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
});
