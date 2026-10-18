"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls"), create = require("../src/hunt-keyboard-controls"),
  { Document, Element, boot } = require("./helpers/ui-harness.cjs");
const keys = ["Q", "E", "Z", "C"], storageKey = "bloodborne-hunt-v07";
function fixture(phase) {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div><div id="hunterActionBar"></div><div id="decisions"></div><div id="decisionActions"></div><div id="mapContext"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const clicks = [], add = (host, attrs, label) => {
    const button = new Element(document, "button", attrs); button.parentElement = document.getElementById(host);
    button.onclick = () => clicks.push(label); button.parentElement.append(button); return button;
  }, api = create({ document, window: {} }),
    down = (key, props = {}) => document.fire("keydown", { key, target: document.body, ...props }),
    up = (key, props = {}) => document.fire("keyup", { key, target: document.body, ...props }),
    press = (key, props = {}) => { const event = down(key, props); up(key, props); return event; };
  return { document, clicks, add, api, down, up, press };
}
test("combat_choose Q/E use only enabled counter/reveal controls and preserve their original intent phase boundary", () => {
  const f = fixture("combat_choose"), counter = f.add("decisionActions", { "data-command": "COUNTER", disabled: "" }, "COUNTER");
  f.add("decisionActions", { "data-command": "NO_ATTACK" }, "NO_ATTACK");
  f.add("hunterActionBar", { "data-hunter-intent": "MOVE" }, "MOVE");
  f.add("hunterActionBar", { "data-hunter-intent": "DREAM" }, "DREAM");
  f.press("q", { code: "KeyQ" }); assert.deepEqual(f.clicks, []);
  counter.disabled = false; f.press("q", { code: "KeyQ" }); f.press("e", { code: "KeyE" });
  assert.deepEqual(f.clicks, ["COUNTER", "NO_ATTACK"]);
  f.document.documentElement.dataset.phase = "combat_react";
  f.press("q"); f.press("e"); assert.deepEqual(f.clicks, ["COUNTER", "NO_ATTACK"]);
});
test("multiple counter paths require a focused available choice instead of choosing the first route", () => {
  const f = fixture("combat_choose"), first = f.add("decisionActions", { "data-command": "COUNTER" }, "FIRST"),
    second = f.add("mapContext", { "data-command": "COUNTER" }, "SECOND");
  f.press("q"); assert.deepEqual(f.clicks, []);
  second.focus(); f.press("q"); assert.deepEqual(f.clicks, ["SECOND"]);
  second.disabled = true; f.press("q"); assert.deepEqual(f.clicks, ["SECOND", "FIRST"]);
  first.hidden = true; f.press("q"); assert.deepEqual(f.clicks, ["SECOND", "FIRST"]);
});
test("contextual Q/E and Space keep both keyboard metadata entries as the focused action changes", () => {
  const f = fixture("combat_choose"), counter = f.add("decisionActions", { "data-command": "COUNTER", title: "선택한 슬롯 공격" }, "COUNTER"),
    reveal = f.add("decisionActions", { "data-command": "NO_ATTACK" }, "NO_ATTACK");
  f.api.refresh(); assert.equal(counter.getAttribute("aria-keyshortcuts"), "Q Space");
  assert.equal(counter.getAttribute("title"), "선택한 슬롯 공격 · 단축키 Q Space");
  assert.equal(reveal.getAttribute("aria-keyshortcuts"), "E");
  reveal.focus(); f.document.fire("focusin", { target: reveal });
  assert.equal(counter.getAttribute("aria-keyshortcuts"), "Q");
  assert.equal(reveal.getAttribute("aria-keyshortcuts"), "E Space");
  assert.equal(reveal.getAttribute("title"), "단축키 E Space");
  f.api.refresh(); assert.equal(reveal.getAttribute("title"), "단축키 E Space", "refresh never accumulates shortcut words");
});
test("rotation keys retain fixed 0/1/2/3 meanings when only 90 and 270 degrees are enabled", () => {
  const f = fixture("tile_place"), buttons = keys.map((key, rotation) => f.add("decisions",
    { "data-rotation": String(rotation), ...([1, 3].includes(rotation) ? {} : { disabled: "" }) }, rotation));
  f.add("decisions", { "data-command": "PLACE_TILE" }, "PLACE"); f.api.refresh();
  keys.forEach((key, rotation) => assert.equal(buttons[rotation].getAttribute("aria-keyshortcuts"), key));
  f.press("q"); f.press("z"); assert.deepEqual(f.clicks, []);
  f.press("e"); f.press("c"); assert.deepEqual(f.clicks, [1, 3]);
  f.press(" ", { code: "Space" }); assert.deepEqual(f.clicks, [1, 3, "PLACE"]);
});
test("contextual keys cannot chain from a combat command or rotation into the next rendered phase", () => {
  for (const [phase, attrs] of [["combat_choose", { "data-command": "COUNTER" }], ["tile_place", { "data-rotation": "0" }]]) {
    const f = fixture(phase), choice = f.add("decisions", attrs, "CHOICE");
    choice.onclick = () => { f.clicks.push("CHOICE"); f.document.documentElement.dataset.phase = "hunter"; };
    f.add("hunterActionBar", { "data-hunter-intent": "MOVE" }, "MOVE");
    f.down("q", { code: "KeyQ" }); f.down("q", { code: "KeyQ", repeat: true }); f.down("q", { code: "KeyQ" });
    assert.deepEqual(f.clicks, ["CHOICE"]); assert.equal(f.up("q", { code: "KeyQ" }).defaultPrevented, true);
    f.press("q", { code: "KeyQ" }); assert.deepEqual(f.clicks, ["CHOICE", "MOVE"]);
  }
});
test("contextual keys preserve editable, modal, modifier, IME, repeat and Numpad isolation guards", () => {
  for (const phase of ["combat_choose", "tile_place"]) {
    const f = fixture(phase);
    f.add("decisions", { "data-command": "COUNTER" }, "COUNTER"); f.add("decisions", { "data-command": "NO_ATTACK" }, "NO_ATTACK");
    keys.forEach((key, rotation) => f.add("decisions", { "data-rotation": String(rotation) }, rotation));
    for (const key of keys) {
      for (const props of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { repeat: true },
        { defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }, { location: 3 }, { code: "Numpad5" }]) f.press(key, props);
      for (const tag of ["input", "select", "textarea"]) {
        const input = new Element(f.document, tag); f.press(key, { target: input });
        f.document.activeElement = input; f.press(key); f.document.activeElement = f.document.body;
      }
      const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog);
      dialog.open = true; f.press(key); dialog.open = false;
      dialog.setAttribute("data-window-minimized", "true"); f.press(key); dialog.removeAttribute("data-window-minimized");
    }
    assert.deepEqual(f.clicks, []);
  }
});
const original = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const fresh = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
const checkpoint = count => original.slice(0, count).reduce((state, command) => E.dispatch(state, command), fresh());
function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [storageKey]: E.exportSave(state) }, engine: { ...E, applyChapelRuling: value => value,
      applyCombatReactionRuling: value => value, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value },
    window: { BBHuntMapControls: U } });
  ui.keyboard = create({ document: ui.document, window: ui.window });
  ui.press = (key, props = {}) => { const event = ui.document.fire("keydown", { key, target: ui.document.body, ...props });
    ui.document.fire("keyup", { key, target: ui.document.body, ...props }); return event; };
  return ui;
}
const saved = ui => { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(storageKey)); };
const commandOf = button => ({ type: button.dataset.command, ...JSON.parse(button.dataset.args || "{}") });
const dockButton = (ui, type) => ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === type);
// The lightweight harness records markup on its host rather than parsing
// button text nodes; inspect that rendered label while clicking the real node.
const renderedLabel = (ui, attribute, value) => ["decisions", "mapContext"].map(id => ui.el(id).innerHTML).join("")
  .match(new RegExp(`<button\\b[^>]*${attribute}="${value}"[^>]*>([\\s\\S]*?)<\\/button>`))?.[1];
test("actual encounter Q waits for a card and slot then commits exactly the displayed counter command", () => {
  for (const mapTarget of [false, true]) {
    const state = checkpoint(5), ui = launch(state), before = ui.storage.get(storageKey);
    assert.equal(state.phase, "combat_choose"); assert.equal(ui.el("hunterActionBar").hidden, true);
    if (mapTarget) ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === state.combat.enemyId).click();
    ui.press("q", { code: "KeyQ" }); assert.equal(ui.storage.get(storageKey), before);
    ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === "card-7").click();
    ui.el("slots").querySelectorAll("[data-slot]").find(button => +button.dataset.slot === 2).click(); ui.keyboard.refresh();
    const counter = dockButton(ui, "COUNTER"); assert(counter && !counter.disabled);
    assert.match(renderedLabel(ui, "data-command", "COUNTER"), /맞서 공격 \(Q\)/); assert.equal(counter.getAttribute("aria-keyshortcuts"), "Q Space");
    const expected = E.dispatch(state, commandOf(counter));
    ui.press("q", { code: "KeyQ" }); assert.deepEqual(saved(ui), expected);
  }
});
test("actual encounter E reveals without spending a card and never starts the hunter's dream action", () => {
  const state = checkpoint(5), ui = launch(state), hand = E.hunter(state).hand.map(card => card.id),
    reveal = dockButton(ui, "NO_ATTACK");
  assert.match(renderedLabel(ui, "data-command", "NO_ATTACK"), /공격하지 않고 행동 공개 \(E\)/);
  ui.press("e", { code: "KeyE" }); assert.deepEqual(saved(ui), E.dispatch(state, { type: "NO_ATTACK" }));
  assert.deepEqual(E.hunter(saved(ui)).hand.map(card => card.id), hand); assert.equal(saved(ui).commands.at(-1).type, "NO_ATTACK");
});
test("natural tile previews use exact rotation keys, preserve the save and only Space commits placement", () => {
  for (const recipe of require("./fixtures/map-preview-dev38-recipes.json").cases) {
    const cfg = recipe.setup;
    const state = recipe.commands.reduce((state, command) => E.dispatch(state, command),
      E.create(cfg.seed, cfg.weaponId, cfg.face, cfg.startingConsumable, cfg.firearmId, cfg.startSpace, cfg.options));
    assert.equal(state.phase, "tile_place"); const ui = launch(state), before = ui.storage.get(storageKey);
    let selected = +ui.el("decisions").querySelectorAll("[data-rotation]").find(button => button.classList.contains("primary")).dataset.rotation;
    for (const [rotation, key] of keys.entries()) {
      const button = ui.el("decisions").querySelectorAll("[data-rotation]").find(button => +button.dataset.rotation === rotation);
      assert.equal(renderedLabel(ui, "data-rotation", rotation), `${rotation * 90}° (${key})`);
      const allowed = !button.disabled; ui.press(key.toLowerCase(), { code: "Key" + key });
      if (allowed) selected = rotation;
      assert.equal(+ui.el("decisions").querySelectorAll("[data-rotation]").find(button => button.classList.contains("primary")).dataset.rotation, selected);
      assert.equal(ui.storage.get(storageKey), before, "rotation changes only the printed preview");
    }
    ui.press(" ", { code: "Space" }); assert.deepEqual(saved(ui), E.dispatch(state, { type: "PLACE_TILE", rotation: selected }));
  }
});
test("the action bar consumes no space when every intent is disabled and returns after cancellation", () => {
  const ui = launch(fresh()), original = ui.storage.get(storageKey);
  assert.equal(ui.el("hunterActionBar").hidden, false);
  ui.press("q", { code: "KeyQ" }); assert.equal(ui.el("hunterActionBar").hidden, true);
  assert.equal(ui.el("confirmHunterAction").disabled, true); assert.equal(ui.el("decisionActions").hidden, false);
  ui.press("1", { code: "Digit1" }); assert.equal(ui.el("hunterActionBar").hidden, true);
  assert.equal(ui.el("confirmHunterAction").disabled, false);
  ui.press("Backspace"); assert.equal(ui.el("hunterActionBar").hidden, false); assert.equal(ui.storage.get(storageKey), original);
  ui.el("infoDialog").showModal(); assert.equal(ui.el("hunterActionBar").hidden, false, "temporary windows do not change the action model's visibility");
  for (const count of [1, 2, 5, 6, 7]) assert.equal(launch(checkpoint(count)).el("hunterActionBar").hidden, true);
  const pendingReward = E.create(90, "burial", 0, null, "hunter-pistol", "center", {
    campaign: false, rulesVersion: 14, practiceRewards: ["bloodstone-shard"] });
  assert(pendingReward.rewardChoices.length); assert.equal(launch(pendingReward).el("hunterActionBar").hidden, true);
});
