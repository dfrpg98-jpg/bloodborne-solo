"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const createShell = require("../src/hunt-shell");
const { Document } = require("./helpers/ui-harness.cjs");

function setup({ inline = true } = {}) {
  const document = new Document(`<html><body><button id="openItems" data-panel="inventory"></button><button id="openRewards" data-panel="rewards"></button><button id="openObjectives" data-panel="objectives"></button><button id="openJournal" data-panel="journal"></button><button id="inspectCurrentTile"></button><span id="rewardPendingBadge"></span>
    ${inline ? '<nav id="workspaceTabs"><button data-workspace-tab="progress"></button><button data-workspace-tab="inventory"></button><button data-workspace-tab="rewards"></button></nav><section id="workspaceProgress" data-workspace-panel="progress"></section><section data-info-panel="inventory" data-workspace-panel="inventory" hidden></section><section id="rewardsPanel" data-info-panel="rewards" data-workspace-panel="rewards" hidden></section>' : ''}
    <select id="itemEnemy"><option value="enemy-2">적 2</option></select><div id="rewards"></div>
    <dialog id="infoDialog"><h2 id="infoTitle"></h2><button id="closeInfo"></button><p id="infoError"></p><div class="info-content"></div>
    ${!inline ? '<section data-info-panel="inventory" hidden></section><section data-info-panel="rewards" hidden></section>' : ''}
    <section data-info-panel="objectives" hidden></section><section data-info-panel="journal" hidden></section><section data-info-panel="help" hidden></section></dialog></body></html>`);
  document.defaultView = { innerWidth: 1200, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const notifications = [], centered = [];
  document.getElementById("inspectCurrentTile").onclick = () => centered.push(true);
  const shell = createShell({ document, onPanelChange: (...args) => notifications.push(args) });
  const el = id => document.getElementById(id);
  const tab = name => document.querySelectorAll("[data-workspace-tab]").find(button => button.dataset.workspaceTab === name);
  const section = name => document.querySelectorAll("[data-workspace-panel]").find(section => section.dataset.workspacePanel === name);
  return { document, shell, notifications, centered, el, tab, section };
}

test("items and equipment open inline with selected tabs and immediate preview callbacks, preserving the map", () => {
  const f = setup();
  assert.equal(f.shell.activeWorkspace(), "progress");
  assert.equal(f.section("progress").hidden, false);
  f.el("openItems").click();
  assert.equal(f.el("infoDialog").open, false);
  assert.equal(f.shell.activeWorkspace(), "inventory");
  assert.equal(f.shell.activePanel(), "inventory");
  assert.equal(f.section("inventory").hidden, false);
  assert.equal(f.section("progress").hidden, true);
  assert.equal(f.el("openItems").getAttribute("aria-controls"), f.section("inventory").id);
  assert.equal(f.tab("inventory").getAttribute("aria-selected"), "true");
  assert.equal(f.document.activeElement, f.tab("inventory"));
  assert.deepEqual(f.notifications.at(-1), ["inventory", { targetPicker: false, placement: null, inline: true }]);
  f.tab("rewards").click();
  assert.equal(f.shell.activeWorkspace(), "rewards");
  assert.equal(f.section("inventory").hidden, true);
  assert.equal(f.section("rewards").hidden, false);
  assert.equal(f.el("infoDialog").classList.contains("target-picker"), false);
});

test("ordinary refresh and close preserve the equipment tab until a successful action explicitly shows progress", () => {
  const f = setup(); f.shell.open("rewards");
  f.shell.sync({ phase: "hunter", mandatoryReward: true }); f.shell.refresh(); f.shell.bind(); f.shell.close();
  assert.equal(f.shell.activeWorkspace(), "rewards");
  assert.equal(f.section("rewards").hidden, false);
  assert.equal(f.el("rewardPendingBadge").hidden, false);
  assert.equal(f.el("rewardPendingBadge").textContent, "선택 필요");
  f.shell.showProgress();
  assert.equal(f.shell.activeWorkspace(), "progress");
  assert.equal(f.shell.activePanel(), null);
  assert.equal(f.section("progress").hidden, false);
  assert.equal(f.section("rewards").hidden, true);
  assert.equal(f.tab("progress").getAttribute("aria-selected"), "true");
});

test("goals and journal remain distinct modal information screens and closing returns to the selected inline tab", () => {
  const f = setup(); f.shell.open("inventory"); f.el("openObjectives").click();
  assert.equal(f.el("infoDialog").open, true);
  assert.equal(f.el("infoTitle").textContent, "목표와 임무");
  assert.equal(f.shell.activePanel(), "objectives");
  assert.equal(f.section("inventory").hidden, false, "a modal cannot hide the workspace behind it");
  f.el("openJournal").click();
  assert.equal(f.el("infoTitle").textContent, "사냥일지");
  assert.equal(f.shell.activePanel(), "journal");
  f.el("closeInfo").click();
  assert.equal(f.el("infoDialog").open, false);
  assert.equal(f.shell.activePanel(), "inventory");
  assert.equal(f.shell.activeWorkspace(), "inventory");
});

test("opening an inline inventory from the information dialog closes only the information dialog", () => {
  const f = setup(); f.shell.open("help");
  assert.equal(f.el("infoDialog").open, true);
  f.shell.open("inventory");
  assert.equal(f.el("infoDialog").open, false);
  assert.equal(f.section("inventory").hidden, false);
  assert.equal(f.shell.activePanel(), "inventory");
  assert.equal(f.document.documentElement.dataset.targetPicker, undefined);
});

test("minimized information bars remain open while inspecting inventory, equipment and inline enemies", () => {
  const f = setup(); f.shell.open("objectives");
  f.el("infoDialog").dataset.windowMinimized = "true";
  for (const panel of ["inventory", "rewards", "progress"]) {
    f.tab(panel).click();
    assert.equal(f.el("infoDialog").open, true);
    assert.equal(f.el("infoDialog").dataset.windowMinimized, "true");
    assert.equal(f.shell.activePanel(), "objectives");
    assert.equal(f.section(panel).hidden, false);
  }
  delete f.el("infoDialog").dataset.windowMinimized;
  f.shell.showProgress({ preserveDialog: true });
  assert.equal(f.el("infoDialog").open, true, "read-only enemy inspection also preserves an expanded window");
  assert.equal(f.shell.activePanel(), "objectives");
  f.el("closeInfo").click();
  assert.equal(f.el("infoDialog").open, false);
  assert.equal(f.shell.activeWorkspace(), "progress");
});

test("workspace tabs support arrow, Home and End keys and keep a single tab stop", () => {
  const f = setup();
  assert.equal(f.el("workspaceTabs").getAttribute("role"), "tablist");
  assert.equal(f.tab("progress").fire("keydown", { key: "ArrowRight" }).defaultPrevented, true);
  assert.equal(f.shell.activeWorkspace(), "inventory");
  assert.equal(f.document.activeElement, f.tab("inventory"));
  f.tab("inventory").fire("keydown", { key: "End" }); assert.equal(f.shell.activeWorkspace(), "rewards");
  f.tab("rewards").fire("keydown", { key: "Home" }); assert.equal(f.shell.activeWorkspace(), "progress");
  f.tab("progress").fire("keydown", { key: "ArrowLeft" }); assert.equal(f.shell.activeWorkspace(), "rewards");
  assert.equal(f.document.querySelectorAll("[data-workspace-tab]").filter(button => button.tabIndex === 0).length, 1);
});

test("legacy pages without inline panels retain the original modal target picker", () => {
  const f = setup({ inline: false }); f.shell.open("inventory");
  assert.equal(f.el("infoDialog").open, true);
  assert.equal(f.shell.activePanel(), "inventory");
  assert.equal(f.el("infoDialog").classList.contains("target-picker"), true);
  assert.equal(f.document.documentElement.dataset.targetPicker, "right");
  f.shell.close(); assert.equal(f.el("infoDialog").open, false); assert.equal(f.shell.activePanel(), null);
  assert.equal(f.document.documentElement.dataset.targetPicker, undefined);
});

test("작업 영역을 전환하고 갱신해도 현재 위치 버튼의 기존 카메라 핸들러를 유지합니다", () => {
  const f = setup(), handler = f.el("inspectCurrentTile").onclick;
  f.shell.open("inventory"); f.shell.sync({ phase: "hunter" }); f.shell.refresh(); f.shell.bind();
  assert.equal(f.el("inspectCurrentTile").onclick, handler);
  f.el("inspectCurrentTile").click(); assert.deepEqual(f.centered, [true]);
  assert.equal(f.shell.activeWorkspace(), "inventory"); assert.equal(f.el("infoDialog").open, false);
});
