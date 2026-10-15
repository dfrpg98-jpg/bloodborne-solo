"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const E = require("../hunt-engine"), Entry = require("../hunt-entry"), Help = require("../game-help");
const { boot, Document } = require("./helpers/ui-harness.cjs");
const root = path.join(__dirname, ".."), normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1",
  activeKey = "bloodborne-hunt-active-mode", previousKey = "bloodborne-hunt-v06", oldKey = "bloodborne-hunt-v05";
const currentPolicy = state => E.applyTileSpeedRuling(E.applyCombatReactionRuling(E.applyChapelRuling(state)));
const normal = seed => currentPolicy(E.create(seed ?? 90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }));
const qa = seed => currentPolicy(E.create(seed ?? 91, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, qa: { preset: "fast" } }));
function savedSlots() {
  return { [normalKey]: E.exportSave(normal()), [qaKey]: E.exportSave(qa()),
    [previousKey]: E.exportSave(normal(89)), [oldKey]: "untouched older slot", [activeKey]: "qa", "unrelated-setting": "keep" };
}
function navigation(search = "") {
  const navigations = [], replacements = [], location = {
    href: "http://offline.test/hunt.html" + search,
    get search() { return new URL(this.href).search; },
    assign(value) { navigations.push(new URL(value, this.href).href); },
  };
  const history = { state: { retained: true }, replaceState(state, title, value) {
    replacements.push(value); this.state = state; location.href = value;
  } };
  return { location, history, navigations, replacements };
}
function launch(search, storage = savedSlots(), overrides = {}) {
  const initial = normal(), calls = { imports: [], exports: [], creates: [], commands: [] }, nav = navigation(search);
  const engine = { ...E,
    create(...args) { calls.creates.push(args); return E.create(...args); },
    importSave(text) { calls.imports.push(text); return E.importSave(text); },
    exportSave(state) { calls.exports.push(state); return E.exportSave(state); },
    dispatch(state, command) { calls.commands.push(command); return E.dispatch(state, command); },
    ...overrides,
  };
  const ui = boot(initial, E.missionView(initial), E.rewardsView(initial), { storage, engine, realInventory: true,
    window: { BBHuntEntry: Entry, BBGameHelp: Help, location: nav.location, history: nav.history } });
  return { ui, calls, ...nav };
}
function unchanged(ui, storage) { assert.deepEqual(Object.fromEntries(ui.storage), storage, "all save slots and the active marker retain their exact bytes"); }
function change(ui, id, value) { const element = ui.el(id); assert(element, id); element.value = String(value); element.fire("change"); }
function prepareNew(ui, mode) {
  for (const [id, value] of [["playMode", mode === "qa" ? "qa-campaign" : "campaign"],
    ["weapon", mode === "qa" ? "qa-test-weapon" : "burial"], ["face", 0], ["gun", "hunter-pistol"],
    ["qaPreset", "fast"], ["seed", 92], ["start", "center"]]) change(ui, id, value);
  assert.equal(ui.el("confirmSetup").disabled, false);
}
async function importText(ui, text) {
  const input = { files: [{ text: async () => text }], value: "saved-hunt.json" };
  await ui.el("file").onchange({ target: input }); return input;
}
function bootTitle(storage, unavailable = false) {
  const document = new Document(fs.readFileSync(path.join(root, "index.html"), "utf8")), values = new Map(Object.entries(storage)), writes = [];
  const localStorage = { getItem(key) { if (unavailable) throw Error("storage unavailable"); return values.get(key) || null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, value); } };
  const window = { BBHuntEntry: Entry, BBGameHelp: Help, localStorage };
  Object.defineProperty(window, "BBHunt", { get() { throw Error("the title must not create, import or replay a hunt"); } });
  document.defaultView = window;
  vm.runInContext(fs.readFileSync(path.join(root, "title-screen.js"), "utf8"), vm.createContext({ window, document, localStorage, URL, URLSearchParams }));
  return { document, values, writes, el: id => document.getElementById(id) };
}

test("entry routing requires an explicit supported continue mode and leaves unrelated navigation alone", () => {
  for (const [search, expected] of [["?entry=new&mode=qa", { action: "new" }], ["?entry=load", { action: "load" }],
    ["?entry=continue&mode=normal", { action: "continue", mode: "normal" }], ["?entry=continue&mode=qa", { action: "continue", mode: "qa" }],
    ["?entry=continue", { action: "load" }], ["?entry=continue&mode=other", { action: "load" }],
    ["?view=map", null], ["?entry=unsupported", null]]) assert.deepEqual(Entry.parse(search), expected, search);
});

test("consuming an entry keeps unrelated URL parameters, fragment and history state", () => {
  const nav = navigation("?entry=continue&mode=qa&view=map#current"), before = nav.history.state;
  Entry.consume(nav);
  const url = new URL(nav.location.href);
  assert.equal(url.searchParams.has("entry"), false); assert.equal(url.searchParams.has("mode"), false);
  assert.equal(url.searchParams.get("view"), "map"); assert.equal(url.hash, "#current"); assert.equal(nav.history.state, before);
  assert.equal(nav.replacements.length, 1);
});

test("the title offers explicit new/load and mode-specific continue routes without validating or writing saves", () => {
  const storage = { ...savedSlots(), [normalKey]: "invalid but present normal save", [qaKey]: "invalid but present QA save" }, title = bootTitle(storage);
  for (const [id, action] of [["titleStart", "new"], ["titleLoad", "load"]]) {
    const url = new URL(title.el(id).getAttribute("href"), "http://offline.test/");
    assert.equal(url.pathname, "/hunt.html"); assert.deepEqual(Entry.parse(url.search), { action });
  }
  const links = title.el("titleContinueLinks").querySelectorAll("a"), routes = links.map(link => Entry.parse(new URL(link.href, "http://offline.test/").search));
  assert.deepEqual(routes, [{ action: "continue", mode: "qa" }, { action: "continue", mode: "normal" }]);
  assert.equal(title.el("titleSavedHunts").hidden, false); assert.deepEqual(Object.fromEntries(title.values), storage); assert.deepEqual(title.writes, []);
});

test("title help opens and closes by button or Escape with focus restored and no save writes", () => {
  const storage = savedSlots(), title = bootTitle(storage), opener = title.el("titleHelp"), dialog = title.el("titleHelpDialog");
  assert(title.el("titleHelpContent").querySelectorAll("details").length > 0);
  assert(title.el("titleHelpContent").querySelectorAll("ol").length > 0, "the first-hunt sequence is present");
  for (const escape of [false, true]) {
    opener.focus(); opener.click(); assert.equal(dialog.open, true); assert.equal(title.document.activeElement, title.el("closeTitleHelp"));
    if (escape) assert.equal(dialog.fire("cancel").defaultPrevented, true); else title.el("closeTitleHelp").click();
    assert.equal(dialog.open, false); assert.equal(title.document.activeElement, opener);
  }
  assert.deepEqual(title.writes, []); assert.deepEqual(Object.fromEntries(title.values), storage);
});

test("title and game help begin with the same normal-play movement, attack and committed dodge guide; QA setup stays collapsed at the end", () => {
  const title = bootTitle({}), { ui } = launch("?entry=new", {}), titleContent = title.el("titleHelpContent"),
    gameContent = ui.el("gameHelpContent");
  assert.equal(titleContent.innerHTML, gameContent.innerHTML, "both entry points teach the same controls");
  for (const content of [titleContent, gameContent]) {
    const first = content.querySelector("section"), steps = Help.firstHunt,
      details = content.querySelectorAll("details"), qaSetup = details.at(-1);
    assert(first.classList.contains("game-help-first"), "the first visible lesson is normal play rather than a test-mode setup");
    assert(steps[0][1].includes("기나긴 사냥 · 챕터 1"));
    assert.equal(steps[0][1].includes("검증"), false, "normal setup does not require a QA-mode choice");
    const movement = steps.findIndex(([title]) => title === "옆 칸으로 이동"),
      attack = steps.findIndex(([title]) => title === "내 차례에 첫 공격"),
      response = steps.findIndex(([title]) => title === "적과 처음 조우하면");
    assert(movement >= 0 && attack > movement && response > attack, "normal move and attack precede the encounter response");
    assert(steps[response][1].includes("‘회피’를 누르세요"), "choosing a card and slot still requires committing the dodge");
    assert(steps[response][1].includes("‘속도 순서대로 전투 처리’"));
    assert(qaSetup.classList.contains("game-help-qa-start"));
    assert.equal(qaSetup.hasAttribute("open"), false, "QA setup does not expand over the beginner guide by default");
    assert(content.innerHTML.includes("검증용 장치무기"), "the separate testing workflow remains available");
  }
});

test("unavailable title storage still leaves new/load navigation and help usable", () => {
  const title = bootTitle({}, true); assert.equal(title.el("titleSavedHunts").hidden, true);
  assert(title.el("titleStart").getAttribute("href")); assert(title.el("titleLoad").getAttribute("href"));
  title.el("titleHelp").click(); assert.equal(title.el("titleHelpDialog").open, true); assert.deepEqual(title.writes, []);
});

test("new entry opens setup without restoring or overwriting any saved mode before confirmation", () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=new", storage);
  assert.equal(ui.el("setupDialog").open, true); assert.equal(ui.el("loadDialog").open, false);
  assert.equal(ui.el("confirmSetup").disabled, true); ui.el("confirmSetup").click();
  assert.deepEqual(calls.imports, []); assert.deepEqual(calls.exports, []); assert.deepEqual(calls.commands, []); unchanged(ui, storage);
});

for (const mode of ["normal", "qa"]) test(`confirming a new ${mode} hunt replaces only that mode's slot`, () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=new", storage); prepareNew(ui, mode); unchanged(ui, storage);
  ui.el("confirmSetup").click(); assert.equal(ui.el("setupDialog").open, false); assert.equal(ui.el("setupError").textContent, "");
  const chosen = mode === "qa" ? qaKey : normalKey, other = mode === "qa" ? normalKey : qaKey,
    expected = mode === "qa" ? qa(92) : normal(92);
  assert.deepEqual(E.importSave(ui.storage.get(chosen)), expected); assert.equal(ui.storage.get(other), storage[other]);
  assert.equal(ui.storage.get(previousKey), storage[previousKey]); assert.equal(ui.storage.get(oldKey), storage[oldKey]);
  assert.equal(ui.storage.get(activeKey), mode); assert.deepEqual(calls.imports, []); assert.deepEqual(calls.commands, []);
});

test("a failed new-hunt creation keeps setup open and preserves every previous save", () => {
  const storage = savedSlots(), { ui } = launch("?entry=new", storage, { create(...args) {
    if (args[0] === 92) throw Error("new hunt creation rejected"); return E.create(...args);
  } });
  prepareNew(ui, "normal"); ui.el("confirmSetup").click();
  assert.equal(ui.el("setupDialog").open, true); assert(ui.el("setupError").textContent); unchanged(ui, storage);
});

test("load entry waits for selection and invokes the native file input within the same click", async () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=load", storage);
  assert.equal(ui.el("loadDialog").open, true); assert.equal(ui.el("setupDialog").open, false);
  assert.equal(ui.document.activeElement, ui.el("loadEntryFile"));
  assert.equal(ui.el("loadEntryNormal").hidden, false); assert.equal(ui.el("loadEntryQa").hidden, false);
  let insideClick = true, clickedSynchronously = false;
  ui.el("file").addEventListener("click", () => { clickedSynchronously = insideClick; });
  ui.el("loadEntryFile").click(); insideClick = false; assert.equal(clickedSynchronously, true);
  await ui.el("file").onchange({ target: { files: [], value: "" } });
  assert.equal(ui.el("loadDialog").open, true); assert.deepEqual(calls.imports, []); assert.deepEqual(calls.exports, []); unchanged(ui, storage);
});

for (const mode of ["normal", "qa"]) test(`explicit continue restores the requested ${mode} slot even when another mode was active`, () => {
  const storage = { ...savedSlots(), [activeKey]: mode === "qa" ? "normal" : "qa" }, chosen = mode === "qa" ? qaKey : normalKey,
    { ui, calls } = launch(`?entry=continue&mode=${mode}`, storage);
  assert.deepEqual(calls.imports, [storage[chosen]]); assert.equal(ui.el("loadDialog").open, false); assert.equal(ui.el("setupDialog").open, false);
  assert.equal(ui.el("qaModeBadge").hidden, mode !== "qa");
  unchanged(ui, { ...storage, [activeKey]: mode }); assert.deepEqual(calls.commands, []);
});

for (const mode of ["normal", "qa"]) for (const condition of ["missing", "corrupt"])
  test(`a ${condition} requested ${mode} save opens load choices without adopting the other mode`, () => {
    const storage = savedSlots(), chosen = mode === "qa" ? qaKey : normalKey;
    if (condition === "missing") { delete storage[chosen]; if (mode === "normal") delete storage[previousKey]; }
    else storage[chosen] = "not a saved hunt";
    const { ui, calls } = launch(`?entry=continue&mode=${mode}`, storage);
    assert.equal(ui.el("loadDialog").open, true); assert(ui.el("loadEntryError").textContent);
    assert.deepEqual(calls.imports, condition === "corrupt" ? [storage[chosen]] : []);
    assert.deepEqual(calls.exports, []); assert.deepEqual(calls.commands, []); unchanged(ui, storage);
  });

test("an unsupported continue mode opens load choices without restoring or saving", () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=continue&mode=other", storage);
  assert.equal(ui.el("loadDialog").open, true); assert.deepEqual(calls.imports, []); assert.deepEqual(calls.exports, []); unchanged(ui, storage);
});

for (const mode of ["normal", "qa"]) test(`load entry's ${mode} button uses the existing exact save and keeps the other slot`, () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=load", storage), chosen = mode === "qa" ? qaKey : normalKey;
  ui.el(mode === "qa" ? "loadEntryQa" : "loadEntryNormal").click();
  assert.deepEqual(calls.imports, [storage[chosen]]); assert.equal(ui.el("loadDialog").open, false);
  unchanged(ui, { ...storage, [activeKey]: mode }); assert.deepEqual(calls.commands, []);
});

test("leaving or escaping an unconfirmed load entry returns to the title without touching saves", () => {
  for (const escape of [false, true]) {
    const storage = savedSlots(), { ui, navigations, calls } = launch("?entry=load", storage);
    if (escape) assert.equal(ui.el("loadDialog").fire("cancel").defaultPrevented, true); else ui.el("loadEntryCancel").click();
    assert.equal(new URL(navigations.at(-1)).pathname, "/index.html"); unchanged(ui, storage);
    assert.deepEqual(calls.imports, []); assert.deepEqual(calls.exports, []);
  }
});

for (const mode of ["normal", "qa"]) test(`a valid ${mode} file import closes load choices and writes only its own mode`, async () => {
  const storage = savedSlots(), { ui } = launch("?entry=load", storage), imported = E.dispatch(mode === "qa" ? qa(93) : normal(93), { type: "END_TURN" }),
    saved = E.exportSave(imported), input = await importText(ui, saved), chosen = mode === "qa" ? qaKey : normalKey;
  assert.equal(input.value, ""); assert.equal(ui.el("loadDialog").open, false); assert.equal(ui.el("setupDialog").open, false);
  assert.equal(ui.el("error").textContent, ""); assert.deepEqual(E.importSave(ui.storage.get(chosen)), imported);
  unchanged(ui, { ...storage, [chosen]: saved, [activeKey]: mode });
});

test("a malformed import preserves every save, exposes the load error and allows a valid retry", async () => {
  const storage = savedSlots(), { ui } = launch("?entry=load", storage), rejected = await importText(ui, "not a saved hunt");
  assert.equal(rejected.value, ""); assert.equal(ui.el("loadDialog").open, true); assert(ui.el("loadEntryError").textContent); unchanged(ui, storage);
  const accepted = await importText(ui, storage[normalKey]); assert.equal(accepted.value, "");
  assert.equal(ui.el("loadDialog").open, false); assert.equal(ui.el("error").textContent, ""); unchanged(ui, { ...storage, [activeKey]: "normal" });
});

test("a file read failure stays in load choices and clears the input for another selection", async () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=load", storage),
    input = { files: [{ text: async () => { throw Error("file read failed"); } }], value: "unreadable.json" };
  await ui.el("file").onchange({ target: input });
  assert.equal(input.value, ""); assert.equal(ui.el("loadDialog").open, true); assert(ui.el("loadEntryError").textContent);
  assert.deepEqual(calls.imports, []); assert.deepEqual(calls.exports, []); unchanged(ui, storage);
});

test("a valid import rejected during policy adoption keeps the current hunt available for its next real action", async () => {
  const storage = { ...savedSlots(), [activeKey]: "normal" }, { ui } = launch("", storage, { applyTileSpeedRuling(state) {
    if (state.initialSeed === 93) throw Error("loaded policy rejected"); return E.applyTileSpeedRuling(state);
  } });
  const before = Object.fromEntries(ui.storage), input = await importText(ui, E.exportSave(qa(93)));
  assert.equal(input.value, ""); assert(ui.el("error").textContent); unchanged(ui, before);
  const next = ui.buttons("decisions").find(button => button.dataset.command === "END_TURN" && !button.disabled); assert(next); next.click();
  assert.deepEqual(E.importSave(ui.storage.get(normalKey)), E.dispatch(normal(), { type: "END_TURN" }));
  assert.equal(ui.storage.get(qaKey), storage[qaKey]); assert.equal(ui.el("qaModeBadge").hidden, true);
});

test("in-game help preserves either hunt, card selection and focus without dispatching actions", () => {
  for (const mode of ["normal", "qa"]) {
    const storage = { ...savedSlots(), [activeKey]: mode }, { ui, calls } = launch(`?entry=continue&mode=${mode}`, storage),
      before = Object.fromEntries(ui.storage), opener = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "guide");
    const card = ui.el("hand").querySelectorAll("[data-card]")[0]; assert(card); card.click();
    const selected = card.dataset.card;
    assert(ui.el("gameHelpContent").querySelectorAll("details").length > 0); assert.equal(ui.el("gameHelpContent").querySelectorAll("[data-command]").length, 0);
    for (const escape of [false, true]) {
      opener.focus(); opener.click(); assert.equal(ui.el("infoDialog").open, true);
      assert.equal(ui.document.activeElement, ui.el("closeInfo"));
      const visible = ui.document.querySelectorAll("[data-info-panel]").filter(panel => !panel.hidden);
      assert.deepEqual(visible.map(panel => panel.dataset.infoPanel), ["guide"]);
      if (escape) assert.equal(ui.el("infoDialog").fire("cancel").defaultPrevented, true); else ui.el("closeInfo").click();
      assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.document.activeElement, opener);
      assert.equal(ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === selected).getAttribute("aria-pressed"), "true");
      unchanged(ui, before); assert.deepEqual(calls.commands, []);
    }
  }
});

function deferredFile(ui, name) {
  let resolve, reject;
  const text = new Promise((accept, fail) => { resolve = accept; reject = fail; }),
    input = { files: [{ text: () => text }], value: name }, reading = ui.el("file").onchange({ target: input });
  assert.equal(input.value, "", "the file control clears before awaiting its read so the same file can be selected again");
  return { input, reading, resolve, reject };
}

test("a pending file cannot overwrite a hunt explicitly restored before the read completes", async () => {
  const storage = { ...savedSlots(), [activeKey]: "normal" }, { ui, calls } = launch("", storage), pending = deferredFile(ui, "pending.json");
  ui.el("resumeQa").click(); assert.equal(ui.el("qaModeBadge").hidden, false);
  const restored = Object.fromEntries(ui.storage), imported = [...calls.imports];
  pending.resolve(E.exportSave(qa(94))); await pending.reading;
  unchanged(ui, restored); assert.deepEqual(calls.imports, imported, "the superseded file is not even adopted or replayed");
  assert.equal(ui.el("error").textContent, ""); assert.equal(pending.input.value, "");
});

test("the most recently selected file wins when two asynchronous reads finish in reverse order", async () => {
  const storage = savedSlots(), { ui, calls } = launch("?entry=load", storage), first = deferredFile(ui, "first.json"),
    second = deferredFile(ui, "second.json"), latest = E.exportSave(normal(95));
  second.resolve(latest); await second.reading;
  assert.equal(second.input.value, ""); unchanged(ui, { ...storage, [normalKey]: latest, [activeKey]: "normal" });
  const accepted = Object.fromEntries(ui.storage);
  first.resolve(E.exportSave(qa(94))); await first.reading;
  unchanged(ui, accepted); assert.deepEqual(calls.imports, [latest]); assert.equal(ui.el("error").textContent, "");
});

test("a stale file read error cannot disturb a newly confirmed hunt or its mission prompt", async () => {
  const storage = { ...savedSlots(), [activeKey]: "normal" }, { ui } = launch("", storage), pending = deferredFile(ui, "old-file.json");
  ui.el("new").click(); prepareNew(ui, "normal"); ui.el("confirmSetup").click();
  const confirmed = Object.fromEntries(ui.storage);
  assert.deepEqual(E.importSave(ui.storage.get(normalKey)), normal(92)); assert.equal(ui.el("missionUpdateDialog").open, true);
  pending.reject(Error("an old file read failed")); await pending.reading;
  unchanged(ui, confirmed); assert.equal(ui.el("missionUpdateDialog").open, true);
  for (const id of ["error", "setupError", "loadEntryError"]) assert.equal(ui.el(id).textContent, "", `${id} belongs to the current hunt`);
  assert.equal(pending.input.value, "");
});

test("a real game action performed during a file read keeps its resulting hunt when that file completes", async () => {
  const storage = { ...savedSlots(), [activeKey]: "normal" }, { ui, calls } = launch("", storage), pending = deferredFile(ui, "outdated.json"),
    next = ui.buttons("decisions").find(button => button.dataset.command === "END_TURN" && !button.disabled);
  assert(next); next.click();
  const progressed = Object.fromEntries(ui.storage), imports = [...calls.imports], commands = structuredClone(calls.commands);
  assert.deepEqual(E.importSave(ui.storage.get(normalKey)), E.dispatch(normal(), { type: "END_TURN" }));
  assert(commands.some(command => command.type === "END_TURN"));
  pending.resolve(E.exportSave(qa(94))); await pending.reading;
  unchanged(ui, progressed); assert.deepEqual(calls.imports, imports);
  assert.deepEqual(structuredClone(calls.commands), commands, "the stale completion dispatches no additional action"); assert.equal(ui.el("qaModeBadge").hidden, true);
});

test("native setup cancellation invalidates a file read started while editing the existing hunt", async () => {
  const storage = { ...savedSlots(), [activeKey]: "normal" }, { ui, calls } = launch("", storage);
  ui.el("new").click(); assert.equal(ui.el("setupDialog").open, true);
  const pending = deferredFile(ui, "cancelled-setup.json"), cancelled = ui.el("setupDialog").fire("cancel");
  assert.equal(cancelled.defaultPrevented, false, "an existing hunt permits native setup cancellation");
  // The minimal harness dispatches events only; native dialog cancel closes by default.
  ui.el("setupDialog").close();
  const before = Object.fromEntries(ui.storage), imports = [...calls.imports];
  pending.resolve(E.exportSave(qa(94))); await pending.reading;
  assert.equal(ui.el("setupDialog").open, false); unchanged(ui, before); assert.deepEqual(calls.imports, imports);
  assert.equal(ui.el("qaModeBadge").hidden, true); assert.equal(ui.el("error").textContent, "");
});
