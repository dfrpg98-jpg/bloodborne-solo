"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), C = require("../src/hunt-context"), Menu = require("../src/hunt-action-menu"),
  create = require("../src/hunt-keyboard-controls"), U = require("../src/hunt-map-controls");
const { Document, Element, boot } = require("./helpers/ui-harness.cjs");
const bindings = [["Q", "MOVE", "이동"], ["E", "DREAM", "꿈으로 이동"], ["Z", "TRANSFORM", "장치무기 변형"], ["C", "ATTACK", "적 공격하기"]];
const key = "bloodborne-hunt-v07";
function fixture() {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div><div id="hunterActionBar"></div><div id="decisionActions"></div></body></html>');
  document.documentElement.dataset.phase = "hunter";
  const clicks = [], add = (host, attrs, label) => {
    const button = new Element(document, "button", attrs); button.parentElement = host;
    button.onclick = () => clicks.push(label); host.append(button); return button;
  }, bar = document.getElementById("hunterActionBar"), controls = document.getElementById("movementControls"),
    buttons = Object.fromEntries(bindings.map(([shortcut, type]) => [type, add(bar, { "data-hunter-intent": type }, type)])),
    lowerMove = add(controls, { "data-command": "MOVE" }, "LOWER_MOVE"),
    stop = add(document.getElementById("decisionActions"), { "data-command": "STOP_MOVE" }, "STOP_MOVE"),
    api = create({ document, window: {} });
  const down = (key, props = {}) => document.fire("keydown", { key, target: document.body, ...props }),
    up = (key, props = {}) => document.fire("keyup", { key, target: document.body, ...props }),
    press = (key, props = {}) => { const result = down(key, props); up(key, props); return result; };
  return { document, clicks, bar, buttons, lowerMove, stop, api, down, up, press };
}
test("Q/E/Z/C click their actual toolbar intents while Q takes precedence over the old lower movement declaration", () => {
  const f = fixture();
  for (const [shortcut, type] of bindings) {
    assert.equal(f.press(shortcut.toLowerCase(), { code: "Key" + shortcut }).defaultPrevented, true);
    assert.equal(f.clicks.at(-1), type);
    assert.equal(f.buttons[type].getAttribute("aria-keyshortcuts"), shortcut);
  }
  assert.deepEqual(f.clicks, bindings.map(([, type]) => type));
  assert.equal(f.lowerMove.getAttribute("aria-keyshortcuts"), "Q Numpad5");
});
test("disabled, hidden or locked toolbar actions never fall back to a lower movement control", () => {
  const f = fixture();
  for (const [shortcut, type] of bindings) {
    const button = f.buttons[type]; button.disabled = true;
    assert.equal(f.press(shortcut).defaultPrevented, false); button.disabled = false;
    button.hidden = true; f.press(shortcut); button.hidden = false;
    button.setAttribute("aria-disabled", "true"); f.press(shortcut); button.removeAttribute("aria-disabled");
  }
  f.bar.setAttribute("inert", ""); f.press("q"); f.bar.removeAttribute("inert");
  for (const phase of ["combat_react", "combat_choose", "refill", "tile_place", "return"]) {
    f.document.documentElement.dataset.phase = phase;
    for (const [shortcut] of bindings) f.press(shortcut);
  }
  assert.deepEqual(f.clicks, []);
});
test("Q stops actual movement, respects the disabled stop button, and does not chain across a held-key phase change", () => {
  const f = fixture();
  f.document.documentElement.dataset.phase = "move"; f.stop.disabled = true;
  f.press("q"); assert.deepEqual(f.clicks, []);
  f.stop.disabled = false;
  f.stop.onclick = () => { f.clicks.push("STOP_MOVE"); f.document.documentElement.dataset.phase = "hunter"; };
  f.down("q", { code: "KeyQ" }); f.down("q", { code: "KeyQ", repeat: true }); f.down("q", { code: "KeyQ" });
  assert.deepEqual(f.clicks, ["STOP_MOVE"]); assert.equal(f.up("q", { code: "KeyQ" }).defaultPrevented, true);
  f.press("q", { code: "KeyQ" }); assert.deepEqual(f.clicks, ["STOP_MOVE", "MOVE"]);
});
test("physical Q/E/Z/C work in a Korean layout, M is removed, and keypad input cannot select an intent", () => {
  const f = fixture();
  for (const [key, shortcut, type] of [["ㅂ", "Q", "MOVE"], ["ㄷ", "E", "DREAM"], ["ㅋ", "Z", "TRANSFORM"], ["ㅊ", "C", "ATTACK"]]) {
    f.press(key, { code: "Key" + shortcut }); assert.equal(f.clicks.at(-1), type);
  }
  const before = f.clicks.slice();
  for (const phase of ["hunter", "move"]) {
    f.document.documentElement.dataset.phase = phase;
    for (const [key, code] of [["m", "KeyM"], ["M", "KeyM"], ["ㅡ", "KeyM"], ["q", "KeyM"]])
      assert.equal(f.press(key, { code }).defaultPrevented, false);
    for (const [shortcut] of bindings) assert.equal(f.press(shortcut, { location: 3 }).defaultPrevented, false);
  }
  assert.deepEqual(f.clicks, before);
  f.document.documentElement.dataset.phase = "hunter";
  f.press("5", { code: "Numpad5", location: 3, getModifierState: name => name === "NumLock" });
  assert.equal(f.clicks.at(-1), "LOWER_MOVE", "Numpad5 keeps its original declaration path");
  f.document.documentElement.dataset.phase = "move";
  const count = f.clicks.length; f.press("5", { code: "Numpad5", location: 3, getModifierState: () => true });
  assert.equal(f.clicks.length, count, "Numpad5 still cannot finish movement");
});
test("new action keys keep modifier, repeat, input, IME, open-window and minimized-window guards", () => {
  const f = fixture();
  for (const [shortcut] of bindings) {
    for (const props of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true },
      { defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }]) f.press(shortcut, { code: "Key" + shortcut, ...props });
    for (const tag of ["input", "select", "textarea"]) {
      const input = new Element(f.document, tag); f.press(shortcut, { target: input });
      f.document.activeElement = input; f.press(shortcut); f.document.activeElement = f.document.body;
    }
    const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog);
    dialog.open = true; f.press(shortcut); dialog.open = false;
    dialog.setAttribute("data-window-minimized", "true"); f.press(shortcut); dialog.removeAttribute("data-window-minimized");
  }
  assert.deepEqual(f.clicks, []);
});
function initial(attack = false) {
  return E.create(90, "burial", 0, null, "hunter-pistol", "center", attack ?
    { campaign: false, practiceTarget: "male-beast-patient", practiceSide: "b", rulesVersion: 14 } : { campaign: true, rulesVersion: 13 });
}
function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { storage: { [key]: E.exportSave(state) }, engine: {
    ...E, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
    applyChapelRuling: value => value, applyCombatReactionRuling: value => value }, window: { BBHuntMapControls: U } });
  ui.keyboard = create({ document: ui.document, window: ui.window });
  ui.press = (key, props = {}) => { const event = ui.document.fire("keydown", { key, target: ui.document.body, ...props });
    ui.document.fire("keyup", { key, target: ui.document.body, ...props }); return event; };
  return ui;
}
const saved = ui => { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); };
test("four labels carry their inline keys while semantic action labels remain unchanged", () => {
  const state = initial(), model = Menu.view(state, E, C), ui = launch(state), html = ui.el("hunterActionBar").innerHTML;
  assert.deepEqual(model.actions.map(action => [action.shortcut, action.type, action.label]), bindings);
  for (const [shortcut, type, label] of bindings) {
    const content = html.match(new RegExp(`data-hunter-intent="${type}"[^>]*>([\\s\\S]*?)<\\/button>`))?.[1];
    const line = content?.match(/^<span class="hunter-action-label">([^<]*)<\/span>/)?.[1];
    assert.equal(line, `${label} (${shortcut})`, "the label and shortcut share one unbroken line instead of a kbd/small second line");
  }
});
test("actual Q/E/Z/C choose intents at zero cost, stay locked until confirmation, and Space commits the displayed command once", () => {
  for (const [shortcut, type] of bindings) {
    const state = initial(type === "ATTACK"), ui = launch(state), original = ui.storage.get(key);
    if (type === "ATTACK") {
      ui.press("c", { code: "KeyC" }); assert.equal(ui.storage.get(key), original);
      assert.equal(ui.el("confirmHunterAction"), null, "C requires an explicitly selected eligible enemy");
      ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === state.enemies[0].id).click();
    }
    ui.press("1", { code: "Digit1" }); ui.press(shortcut.toLowerCase(), { code: "Key" + shortcut });
    assert.equal(ui.el("confirmHunterAction").disabled, true, "a previous hand selection is not charged by the intent shortcut");
    assert.equal(ui.storage.get(key), original); ui.press(" ", { code: "Space" }); assert.equal(ui.storage.get(key), original);
    ui.press("2", { code: "Digit2" });
    const confirm = ui.el("confirmHunterAction"), command = { type: confirm.dataset.command, ...JSON.parse(confirm.dataset.args) };
    for (const [other] of bindings) ui.press(other.toLowerCase(), { code: "Key" + other });
    assert.equal(ui.storage.get(key), original, "disabled toolbar keys cannot bypass confirmation or replace the intent");
    assert.equal(ui.el("confirmHunterAction"), confirm);
    ui.press(" ", { code: "Space" }); assert.deepEqual(saved(ui), E.dispatch(state, command));
  }
});
test("actual action-key cancellation restores the prior selection and M never declares or finishes movement", () => {
  const state = initial(), ui = launch(state), original = ui.storage.get(key);
  ui.press("2", { code: "Digit2" }); ui.press("e", { code: "KeyE" }); ui.press("1", { code: "Digit1" }); ui.press("Escape");
  assert.equal(ui.storage.get(key), original); assert.equal(ui.el("hand").querySelectorAll("[data-card]")[1].getAttribute("aria-pressed"), "true");
  ui.press("z", { code: "KeyZ" }); ui.press("1", { code: "Digit1" }); ui.press("Backspace"); assert.equal(ui.storage.get(key), original);
  ui.press("m", { code: "KeyM" }); assert.equal(ui.storage.get(key), original);
  ui.press("q", { code: "KeyQ" }); ui.press("1", { code: "Digit1" }); ui.press(" ", { code: "Space" });
  let expected = E.dispatch(state, { type: "MOVE", cardId: E.hunter(state).hand[0].id });
  ui.press("ArrowRight"); expected = E.dispatch(expected, { type: "STEP", node: "tile-14:right" });
  const movingSave = ui.storage.get(key); ui.press("m", { code: "KeyM" }); assert.equal(ui.storage.get(key), movingSave);
  ui.press("q", { code: "KeyQ" }); assert.deepEqual(saved(ui), E.dispatch(expected, { type: "STOP_MOVE" }));
});
