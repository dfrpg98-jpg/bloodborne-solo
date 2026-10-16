"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const W = require("../src/hunt-window-manager");

// Small DOM contract double: no engine, saved state or browser dependency.
class Element {
  constructor(document, tagName = "div") {
    this.document = document; this.tagName = tagName; this.children = []; this.attributes = {};
    this.dataset = {}; this.style = {}; this.listeners = {}; this.open = false; this.hidden = false; this.isConnected = true;
    this.classList = {
      add: name => { this.className = [...new Set((this.className || "").split(/\s+/).filter(Boolean).concat(name))].join(" "); },
      remove: name => { this.className = (this.className || "").split(/\s+/).filter(value => value !== name).join(" "); },
      contains: name => (this.className || "").split(/\s+/).includes(name),
    };
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name.startsWith("data-")) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())];
  }
  append(...elements) { for (const element of elements) { element.parentElement = this; this.children.push(element); } }
  prepend(element) { element.parentElement = this; this.children.unshift(element); }
  remove() { this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.isConnected = false; }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith("[")) {
      const [key, value] = selector.slice(1, -1).split("=");
      return key in this.attributes && (value === undefined || this.attributes[key] === value.replaceAll('"', ""));
    }
    return this.tagName === selector;
  }
  closest(selector) { return selector.split(",").some(value => this.matches(value)) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) { if (selector.split(",").some(value => child.matches(value))) found.push(child); found.push(...child.querySelectorAll(selector)); }
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  removeEventListener(type, handler) { this.listeners[type] = (this.listeners[type] || []).filter(value => value !== handler); }
  fire(type, values = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; }, ...values };
    for (const handler of this.listeners[type] || []) handler(event);
    return event;
  }
  show() { this.showCalls = (this.showCalls || 0) + 1; this.open = true; }
  showModal() { this.modalCalls = (this.modalCalls || 0) + 1; this.open = true; }
  close() { this.open = false; this.fire("close"); }
  focus() { this.document.activeElement = this; }
  getBoundingClientRect() { return { left: parseFloat(this.style.left) || 0, top: parseFloat(this.style.top) || 0, width: this.width || 400, height: this.height || 300 }; }
}
function setup(ids = ["attachmentDialog", "infoDialog", "missionUpdateDialog"]) {
  const document = new Element(null, "document"); document.document = document;
  document.createElement = tag => new Element(document, tag);
  document.body = document.createElement("body"); document.append(document.body);
  document.documentElement = document.body;
  document.defaultView = new Element(document, "window");
  Object.assign(document.defaultView, { innerWidth: 1000, innerHeight: 700 });
  document.getElementById = id => document.querySelector("#" + id);
  document.activeElement = document.body;
  const dialogs = {};
  for (const id of ids) {
    const dialog = document.createElement("dialog"); dialog.setAttribute("id", id); dialog.setAttribute("aria-labelledby", id + "Title");
    const heading = document.createElement("div"); heading.className = "compact-dialog-heading";
    const title = document.createElement("h2"); title.setAttribute("id", id + "Title"); title.textContent = id;
    heading.append(title); dialog.append(heading); document.body.append(dialog); dialogs[id] = dialog;
  }
  return { document, dialogs };
}
test("positions remain inside the visible viewport, including oversized windows", () => {
  assert.deepEqual(W.clampPosition({ x: -50, y: 900 }, { width: 400, height: 300 }, { width: 1000, height: 700 }), { x: 8, y: 392 });
  assert.deepEqual(W.clampPosition({ x: 800, y: 800 }, { width: 1200, height: 900 }, { width: 1000, height: 700 }), { x: 8, y: 8 });
});
test("managed opening uses nonmodal presentation while pending selections retain logical blocking", () => {
  const { document, dialogs } = setup(), manager = W.install(document), dialog = dialogs.attachmentDialog;
  assert.equal(W.install(document), manager);
  dialog.showModal();
  assert.equal(dialog.showCalls, 1); assert.equal(dialog.modalCalls, undefined);
  assert.equal(dialog.getAttribute("aria-modal"), "false");
  assert.equal(manager.canExecute([{ type: "MOVE" }]), false);
  assert.equal(manager.canExecute([{ type: "REASSIGN_REWARD" }]), true);
  assert.equal(manager.canExecute([{ type: "REASSIGN_REWARD" }, { type: "USE_CONSUMABLE" }]), false);
  dialogs.missionUpdateDialog.showModal();
  assert.equal(manager.canExecute([{ type: "REASSIGN_REWARD" }]), false);
  dialogs.missionUpdateDialog.close(); dialog.close();
  dialogs.infoDialog.showModal(); assert.equal(manager.isBlocked(), true);
  assert.equal(manager.canExecute([{ type: "MOVE" }]), false);
});
test("minimize and restore preserve pending input, block actions and restore keyboard focus without closing", () => {
  const { document, dialogs } = setup(), manager = W.install(document), dialog = dialogs.attachmentDialog;
  const input = document.createElement("select"); input.value = "2"; dialog.append(input);
  let closes = 0; dialog.addEventListener("close", () => closes++);
  dialog.showModal(); input.focus();
  assert.equal(manager.minimize(dialog), true);
  assert.equal(dialog.open, true); assert.equal(input.value, "2"); assert.equal(closes, 0);
  assert.equal(dialog.getAttribute("data-window-minimized"), "true");
  assert.equal(document.activeElement.className, "hunt-window-restore");
  assert.equal(manager.canExecute([{ type: "ATTACK" }]), false);
  assert.equal(manager.restore("attachmentDialog"), true);
  assert.equal(document.activeElement, input); assert.equal(input.value, "2"); assert.equal(closes, 0);
  assert.equal(dialog.getAttribute("data-window-minimized"), null);
  manager.minimize(dialog); dialog.close();
  assert.equal(closes, 1); assert.equal(manager.isBlocked(), false);
  assert.equal(document.querySelector(".hunt-window-dock").hidden, true);
  dialog.showModal(); assert.equal(dialog.getAttribute("data-window-minimized"), null);
});
test("outside action clicks are blocked while map inspection, card selection and equipment reading remain available", () => {
  const { document, dialogs } = setup(); let blocked = 0;
  W.install(document, { onBlocked: () => blocked++ }); dialogs.attachmentDialog.showModal();
  const action = document.createElement("button"); action.setAttribute("data-command", "MOVE"); document.body.append(action);
  const result = document.fire("click", { target: action }); assert.equal(result.stopped, true); assert.equal(result.defaultPrevented, true);
  for (const attribute of ["data-panel", "data-card", "data-slot", "data-item", "data-inspect-target", "data-tile-info"]) {
    const info = document.createElement("button"); info.setAttribute(attribute, "test"); document.body.append(info);
    assert.equal(document.fire("click", { target: info }).stopped, undefined, attribute);
  }
  const reassign = document.createElement("button"); reassign.setAttribute("data-command", "REASSIGN_REWARD"); dialogs.attachmentDialog.append(reassign);
  assert.equal(document.fire("click", { target: reassign }).stopped, undefined);
  const attackSelection = document.createElement("button"); attackSelection.setAttribute("id", "toggleAttackItem"); document.body.append(attackSelection);
  assert.equal(document.fire("click", { target: attackSelection }).stopped, undefined, "attack item selection does not spend an item");
  assert.equal(blocked, 1);
});
test("only explicit responses bypass click blocking; resource use is forbidden even inside a pending window", () => {
  const { document, dialogs } = setup(["attachmentDialog", "actionLossDialog", "loadDialog"]), manager = W.install(document);
  const append = (owner, id) => { const button = document.createElement("button"); button.setAttribute("id", id); owner.append(button); return button; };
  dialogs.attachmentDialog.showModal();
  const use = append(dialogs.attachmentDialog, "useItem");
  assert.equal(document.fire("click", { target: use }).stopped, true);
  const finish = append(dialogs.attachmentDialog, "closeAttachments");
  assert.equal(document.fire("click", { target: finish }).stopped, undefined);
  const forgedFinish = append(document.body, "closeAttachments");
  assert.equal(document.fire("click", { target: forgedFinish }).stopped, true);
  dialogs.actionLossDialog.showModal();
  const accept = append(dialogs.actionLossDialog, "actionLossAccept"), cancel = append(dialogs.actionLossDialog, "actionLossCancel");
  assert.equal(document.fire("click", { target: accept }).stopped, true, "a second pending choice cannot be bypassed by a direct confirmation handler");
  assert.equal(document.fire("click", { target: cancel }).stopped, undefined);
  dialogs.attachmentDialog.close();
  assert.equal(document.fire("click", { target: accept }).stopped, undefined);
  dialogs.actionLossDialog.close(); dialogs.loadDialog.showModal();
  assert.equal(manager.isBlocked(), true);
  const load = append(dialogs.loadDialog, "loadEntryNormal");
  assert.equal(document.fire("click", { target: load }).stopped, undefined);
});
test("all registered windows block game commands while open or minimized, including read-only dialogs", () => {
  const ids = ["missionUpdateDialog", "deathDialog", "attachmentDialog", "escortDialog", "actionLossDialog", "setupDialog", "loadDialog", "storyDialog", "enemyDetailDialog", "infoDialog", "upgradeDialog", "enemyHistoryDialog", "missionGuideDialog"];
  const { document, dialogs } = setup(ids), manager = W.install(document);
  for (const id of ids) {
    const dialog = dialogs[id]; dialog.showModal(); manager.minimize(id);
    assert.equal(manager.isBlocked(), true, id);
    assert.equal(manager.canExecute([{ type: "MOVE" }]), false, id);
    assert.equal(manager.canExecute([{ type: "USE_CONSUMABLE" }]), false, id);
    dialog.close();
  }
});
test("menu load, resume and new-hunt responses remain available from the information dialog alone", () => {
  const { document, dialogs } = setup(["infoDialog", "attachmentDialog"]), manager = W.install(document);
  const controls = ["load", "resumeNormal", "resumeQa", "restoreV05", "restoreV06", "new"].map(id => {
    const button = document.createElement("button"); button.setAttribute("id", id);
    (id === "new" ? document.body : dialogs.infoDialog).append(button); return button;
  });
  dialogs.infoDialog.showModal();
  for (const button of controls) assert.equal(document.fire("click", { target: button }).stopped, undefined, button.id);
  assert.equal(manager.canExecute([{ type: "USE_REWARD" }]), false);
  dialogs.attachmentDialog.showModal();
  for (const button of controls) assert.equal(document.fire("click", { target: button }).stopped, true, button.id);
  const save = document.createElement("button"); save.setAttribute("id", "save"); dialogs.infoDialog.append(save);
  assert.equal(document.fire("click", { target: save }).stopped, undefined, "exporting existing state remains read-only");
});
test("a host can explicitly override which windows block without changing the safe default", () => {
  const { document, dialogs } = setup();
  const manager = W.install(document, { isBlocking: dialog => dialog.id === "attachmentDialog" });
  dialogs.infoDialog.showModal(); assert.equal(manager.isBlocked(), false);
  dialogs.attachmentDialog.showModal(); manager.minimize("attachmentDialog");
  assert.equal(manager.canExecute([{ type: "MOVE" }]), false);
});
test("Escape minimizes only the focused or topmost window and never confirms a pending decision", () => {
  const { document, dialogs } = setup(), manager = W.install(document); let confirmations = 0;
  dialogs.attachmentDialog.addEventListener("cancel", () => confirmations++);
  dialogs.attachmentDialog.showModal(); dialogs.infoDialog.showModal();
  assert.equal(document.fire("keydown", { key: "Escape" }).defaultPrevented, true);
  assert.equal(dialogs.infoDialog.getAttribute("data-window-minimized"), "true");
  assert.equal(dialogs.attachmentDialog.getAttribute("data-window-minimized"), null);
  document.fire("keydown", { key: "Escape", repeat: true });
  assert.equal(dialogs.attachmentDialog.getAttribute("data-window-minimized"), null);
  document.fire("keydown", { key: "Escape" });
  assert.equal(dialogs.attachmentDialog.getAttribute("data-window-minimized"), "true");
  assert.equal(dialogs.attachmentDialog.open, true); assert.equal(confirmations, 0);
  assert.equal(manager.canExecute([{ type: "MOVE" }]), false);
  manager.restore("infoDialog"); manager.restore("attachmentDialog");
  document.fire("keydown", { key: "Escape", target: dialogs.infoDialog.querySelector("h2") });
  assert.equal(dialogs.infoDialog.getAttribute("data-window-minimized"), "true");
  assert.equal(dialogs.attachmentDialog.getAttribute("data-window-minimized"), null);
});
test("drag and keyboard movement are bounded and never start from an action control", () => {
  const { document, dialogs } = setup(), manager = W.install(document), dialog = dialogs.infoDialog;
  dialog.showModal(); const heading = dialog.querySelector(".hunt-window-handle"), button = dialog.querySelector(".hunt-window-minimize");
  heading.fire("pointerdown", { target: button, button: 0, pointerId: 1, clientX: 300, clientY: 200 });
  document.fire("pointermove", { pointerId: 1, clientX: -100, clientY: -100 });
  assert.equal(dialog.style.left, "300px");
  heading.fire("pointerdown", { button: 0, pointerId: 2, clientX: 300, clientY: 200 });
  document.fire("pointermove", { pointerId: 99, clientX: -1000, clientY: -1000 }); assert.equal(dialog.style.left, "300px");
  document.fire("pointermove", { pointerId: 2, clientX: -1000, clientY: 2000 });
  assert.equal(dialog.style.left, "8px"); assert.equal(dialog.style.top, "392px");
  document.fire("pointerup", { pointerId: 2 });
  assert.equal(heading.fire("keydown", { altKey: true, key: "ArrowRight" }).defaultPrevented, true);
  assert.equal(dialog.style.left, "24px");
  document.defaultView.innerWidth = 420; document.defaultView.innerHeight = 330;
  document.defaultView.fire("resize"); assert.equal(dialog.style.left, "12px"); assert.equal(dialog.style.top, "22px");
  assert.equal(manager.isBlocked(), true);
});
test("multiple minimized windows have independent restoration controls and registration is reversible", () => {
  const { document, dialogs } = setup(), original = dialogs.infoDialog.showModal, manager = W.install(document);
  for (const dialog of Object.values(dialogs)) { dialog.showModal(); manager.minimize(dialog); }
  const dock = document.querySelector(".hunt-window-dock");
  assert.equal(dock.querySelectorAll("button").filter(button => !button.hidden).length, 3);
  manager.restore("infoDialog"); assert.equal(dialogs.attachmentDialog.getAttribute("data-window-minimized"), "true");
  assert.equal(dock.hidden, false);
  const dynamic = document.createElement("dialog"); dynamic.setAttribute("id", "lateDialog"); document.body.append(dynamic);
  manager.refresh(); dynamic.showModal(); assert.equal(dynamic.showCalls, 1);
  manager.destroy(); assert.equal(dialogs.infoDialog.showModal, original);
  assert.equal(document.querySelector(".hunt-window-dock"), null);
  assert.equal(dialogs.infoDialog.getAttribute("aria-modal"), null);
});
test("the real hunt controller keeps actions and automatic saves blocked after initial setup is minimized", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
  const state = E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { storage: {}, window: {
    BBHuntWindowManager: W, BBHuntMapControls: require("../src/hunt-map-controls") } });
  const manager = W.install(ui.document);
  assert.equal(ui.el("setupDialog").open, true); assert.equal(ui.storage.size, 0);
  manager.minimize("setupDialog");
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "inventory").click();
  assert.equal(ui.el("workspaceInventory").hidden, false);
  ui.buttons("movementControls").find(button => button.dataset.command === "MOVE").click();
  assert.equal(ui.commands.length, 0); assert.equal(ui.storage.size, 0);
  assert.equal(ui.el("setupDialog").open, true); assert.equal(manager.isBlocked(), true);
});
test("inline consumable selection immediately previews its enemy while a minimized pending choice prevents use", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
  const state = E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true,
    qa: { preset: "custom", startRewards: [], startConsumables: ["throwing-knife"] } });
  state.enemies = [1, 2].map(figure => ({ id: "huntsmans-minion-" + figure, kind: "huntsmans-minion", figure, hp: 5, node: E.hunter(state).position }));
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, window: { BBHuntWindowManager: W } });
  const manager = W.install(ui.document); ui.el("attachmentDialog").showModal(); manager.minimize("attachmentDialog");
  const before = new Map(ui.storage);
  ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "inventory").click();
  const select = ui.el("itemEnemy"); assert(select);
  select.value = "huntsmans-minion-2"; select.fire("change");
  const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "huntsmans-minion-2");
  assert(marker?.classList.contains("selected"), "the selection immediately highlights the map actor");
  assert.equal(ui.el("workspaceInventory").hidden, false); assert.equal(ui.el("infoDialog").open, false);
  ui.el("useItem").click();
  assert.equal(ui.commands.length, 0); assert.deepEqual(ui.storage, before);
  assert.equal(manager.isBlocked(), true); assert.equal(ui.el("attachmentDialog").open, true);
});
test("inline equipment target selection previews the actor without closing or acknowledging a pending choice", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
  const state = E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true,
    qa: { preset: "custom", startRewards: ["augur"], startConsumables: [] } });
  state.enemies = [1, 2].map(figure => ({ id: "huntsmans-minion-" + figure, kind: "huntsmans-minion", figure, hp: 5, node: E.hunter(state).position }));
  const view = E.rewardsView(state), reward = view.rewards.find(item => item.kind === "augur");
  assert(reward.controls.targets.some(target => target.enemyId === "huntsmans-minion-2"));
  const ui = boot(state, E.missionView(state), view, { window: { BBHuntWindowManager: W } });
  const manager = W.install(ui.document); ui.el("missionUpdateDialog").showModal(); manager.minimize("missionUpdateDialog");
  const before = new Map(ui.storage);
  ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "rewards").click();
  const select = ui.el("rewardEnemy-" + reward.id); assert(select);
  select.value = "huntsmans-minion-2"; select.fire("change");
  const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "huntsmans-minion-2");
  assert(marker?.classList.contains("selected"));
  assert.equal(ui.el("rewardsPanel").hidden, false); assert.equal(ui.el("infoDialog").open, false);
  ui.el("rewards").querySelectorAll("[data-reward-use]").find(button => button.dataset.rewardUse === reward.id).click();
  assert.equal(ui.commands.length, 0); assert.deepEqual(ui.storage, before);
  assert.equal(ui.el("missionUpdateDialog").open, true); assert.equal(manager.isBlocked(), true);
});
test("reopening minimized information, attachment and upgrade windows restores them without clearing pending choices", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
  const state = E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { window: { BBHuntWindowManager: W } });
  const manager = W.install(ui.document), before = new Map(ui.storage);
  const openInfo = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "objectives");
  for (let index = 0; index < 3; index++) {
    openInfo.click(); assert.equal(ui.el("infoDialog").open, true);
    assert.equal(ui.el("infoDialog").getAttribute("data-window-minimized"), null);
    manager.minimize("infoDialog");
  }
  ui.el("closeInfo").click();
  for (let index = 0; index < 3; index++) {
    ui.el("openAttachments").click(); assert.equal(ui.el("attachmentDialog").open, true);
    assert.equal(ui.el("attachmentDialog").getAttribute("data-window-minimized"), null);
    manager.minimize("attachmentDialog"); assert.equal(manager.isBlocked(), true);
  }
  const upgrade = ui.document.querySelectorAll("[data-upgrade-overview]")[0];
  for (let index = 0; index < 3; index++) {
    upgrade.click(); assert.equal(ui.el("upgradeDialog").open, true);
    assert.equal(ui.el("upgradeDialog").getAttribute("data-window-minimized"), null);
    const html = ui.el("upgradeOverview").innerHTML;
    for (const id of state.market) assert(html.includes(E.data.cards[id].name));
    assert.match(html, /내 덱 구성 · 12장/); assert.doesNotMatch(html, /data-command/);
    manager.minimize("upgradeDialog");
  }
  assert.equal(ui.el("attachmentDialog").open, true); assert.equal(manager.isBlocked(), true);
  assert.equal(ui.commands.length, 0); assert.deepEqual(ui.storage, before);
  ui.el("closeAttachments").click();
  assert.equal(manager.isBlocked(), true, "the minimized read-only upgrade window still blocks actual commands");
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.buttons("decisions").find(button => button.dataset.command === "MOVE").click();
  assert.equal(ui.commands.length, 0); assert.deepEqual(ui.storage, before);
  ui.el("closeUpgrade").click(); assert.equal(manager.isBlocked(), false);
});
test("a successful consumable action from the inline tab consumes only the chosen item and returns to progress", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"), qaKey = "bloodborne-hunt-qa-v1";
  const state = E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true,
    qa: { preset: "custom", startRewards: [], startConsumables: ["antidote"] } });
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, engine: { ...E },
    storage: { [qaKey]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" }, window: { BBHuntWindowManager: W } });
  ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "inventory").click();
  assert.equal(ui.el("workspaceInventory").hidden, false);
  ui.el("useItem").click();
  const after = E.importSave(ui.storage.get(qaKey));
  assert.equal(after.commands.at(-1).type, "USE_CONSUMABLE"); assert.equal(E.hunter(after).consumables.length, 0);
  assert.equal(after.consumableDiscard.at(-1).kind, "antidote");
  assert.equal(ui.el("workspaceInventory").hidden, true); assert.equal(ui.el("workspaceProgress").hidden, false);
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.el("infoDialog").open, false);
});
test("chapter-start mission acknowledgement opens queued bloodstone reassignment before the next movement", () => {
  const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"), key = "bloodborne-hunt-v07";
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true });
  for (const command of require("./fixtures/chapter-one-v8-commands.json")) state = E.dispatch(state, command);
  state = E.dispatch(state, { type: "ENTER_BETWEEN_CHAPTERS" });
  assert.equal(state.phase, "between_chapters"); assert(E.hunter(state).rewards.some(reward => reward.kind === "bloodstone-shard" && reward.equipped));
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { engine: { ...E },
    storage: { [key]: E.exportSave(state) }, window: { BBHuntWindowManager: W, BBHuntMapControls: require("../src/hunt-map-controls") } });
  const manager = W.install(ui.document), face = 1 - E.hunter(E.importSave(ui.storage.get(key))).face;
  ui.el("nextChapterStart").value = "center"; ui.el("nextChapterStart").fire("change");
  ui.el("nextChapterFace").value = String(face); ui.el("nextChapterFace").fire("change");
  ui.el("startNextChapter").click();
  assert.equal(ui.el("error").textContent, "");
  let after = E.importSave(ui.storage.get(key));
  assert.equal(after.mission.chapter, 2); assert.equal(after.commands.at(-1).reassignAttachments, true);
  assert.equal(ui.el("missionUpdateDialog").open, true); assert.equal(ui.el("attachmentDialog").open, false);
  manager.minimize("missionUpdateDialog");
  const beforeConfirm = ui.storage.get(key);
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.buttons("movementControls").find(button => button.dataset.command === "MOVE").click();
  assert.equal(ui.storage.get(key), beforeConfirm);
  ui.el("openMissionUpdates").click(); assert.equal(ui.el("missionUpdateDialog").getAttribute("data-window-minimized"), null);
  ui.el("missionUpdateContinue").click();
  assert.equal(ui.el("missionUpdateDialog").open, false); assert.equal(ui.el("attachmentDialog").open, true);
  const shard = E.hunter(after).rewards.find(reward => reward.kind === "bloodstone-shard"), slot = (shard.slot + 1) % E.slots(after).length;
  const reassign = ui.buttons("attachmentChoices").find(button => {
    const args = JSON.parse(button.dataset.args || "{}"); return args.rewardId === shard.id && args.slot === slot;
  });
  assert(reassign && !reassign.disabled); reassign.click();
  after = E.importSave(ui.storage.get(key)); assert.equal(E.hunter(after).rewards.find(reward => reward.id === shard.id).slot, slot);
  ui.el("closeAttachments").click(); assert.equal(manager.isBlocked(), false);
  const hand = ui.el("hand").querySelectorAll("[data-card]");
  if (!hand.some(card => card.getAttribute("aria-pressed") === "true")) hand[0].click();
  ui.buttons("movementControls").find(button => button.dataset.command === "MOVE").click();
  assert.equal(E.importSave(ui.storage.get(key)).phase, "move"); assert.equal(ui.el("error").textContent, "");
});
