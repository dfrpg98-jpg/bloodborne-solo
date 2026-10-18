"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const create = require("../src/hunt-keyboard-controls");
const { Document, Element, boot } = require("./helpers/ui-harness.cjs");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls");
const mapping = { 7: "NW", 8: "N", 9: "NE", 4: "W", 6: "E", 1: "SW", 2: "S", 3: "SE" };
const numLock = name => name === "NumLock";

function fixture(phase = "move") {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const controls = document.getElementById("movementControls"), hand = document.getElementById("hand"), clicks = [];
  const add = (parent, attributes, label) => {
    const button = new Element(document, "button", attributes); button.parentElement = parent;
    button.addEventListener("click", () => clicks.push(label)); parent.append(button); return button;
  };
  const move = add(controls, { "data-command": "MOVE" }, "MOVE"), stop = add(controls, { "data-command": "STOP_MOVE" }, "STOP_MOVE");
  const buttons = Object.fromEntries(Object.values(mapping).map(direction => [direction, add(controls, { "data-move-direction": direction }, direction)]));
  const cards = Array.from({ length: 9 }, (_, index) => add(hand, { "data-card": String(index + 1) }, "CARD" + (index + 1)));
  const api = create({ document, window: {} });
  const key = (key, properties = {}) => { const event = document.fire("keydown", { key, target: document.body, ...properties }); document.fire("keyup", { key, target: document.body, ...properties }); return event; };
  const keypad = (digit, properties = {}) => key(String(digit), { code: "Numpad" + digit, location: 3, getModifierState: numLock, ...properties });
  return { document, controls, hand, clicks, move, stop, buttons, cards, api, key, keypad };
}

test("NumLock이 켜진 넘패드 8방향은 해당 실제 이동 버튼만 누르고 손패는 선택하지 않습니다", () => {
  const f = fixture();
  for (const [digit, direction] of Object.entries(mapping)) {
    assert.equal(f.keypad(digit).defaultPrevented, true); assert.equal(f.clicks.at(-1), direction);
  }
  assert.equal(f.clicks.length, 8); assert(!f.clicks.some(value => value.startsWith("CARD")));
  f.key("1", { code: "Digit1" }); f.key("9", { code: "Digit9" }); assert.deepEqual(f.clicks.slice(-2), ["CARD1", "CARD9"]);
});

test("NumLock 꺼짐·확인 불가·Shift·탐색 키·숫자 불일치는 화살표나 손패로 이어지지 않습니다", () => {
  const f = fixture(), navigation = { 1: "End", 2: "ArrowDown", 3: "PageDown", 4: "ArrowLeft", 5: "Clear", 6: "ArrowRight", 7: "Home", 8: "ArrowUp", 9: "PageUp" };
  for (const digit of Object.keys(navigation)) {
    assert.equal(f.keypad(digit, { getModifierState: () => false }).defaultPrevented, false);
    assert.equal(f.keypad(digit, { getModifierState: undefined }).defaultPrevented, false);
    assert.equal(f.keypad(digit, { shiftKey: true }).defaultPrevented, false);
    assert.equal(f.keypad(digit, { key: navigation[digit], getModifierState: () => false }).defaultPrevented, false);
    assert.equal(f.keypad(digit, { key: navigation[digit] }).defaultPrevented, false);
    assert.equal(f.keypad(digit, { key: "0" }).defaultPrevented, false);
    assert.equal(f.key(String(digit), { location: 3, getModifierState: numLock }).defaultPrevented, false);
  }
  assert.equal(f.keypad(0).defaultPrevented, false); assert.deepEqual(f.clicks, []);
});

test("넘패드5는 사냥꾼 차례의 이동 선언만 실행하며 이동 중에는 마치지 않습니다", () => {
  const f = fixture("hunter");
  assert.equal(f.keypad(5).defaultPrevented, true); assert.deepEqual(f.clicks, ["MOVE"]);
  f.document.documentElement.dataset.phase = "move";
  assert.equal(f.keypad(5).defaultPrevented, false); assert.deepEqual(f.clicks, ["MOVE"]);
  f.key("q"); assert.deepEqual(f.clicks, ["MOVE", "STOP_MOVE"]);
  f.document.documentElement.dataset.phase = "hunter"; f.move.disabled = true;
  assert.equal(f.keypad(5).defaultPrevented, false); f.move.disabled = false;
  for (const phase of ["refill", "activation", "combat_react", "return", "won"]) {
    f.document.documentElement.dataset.phase = phase;
    for (let digit = 1; digit <= 9; digit++) assert.equal(f.keypad(digit).defaultPrevented, false);
  }
  assert.deepEqual(f.clicks, ["MOVE", "STOP_MOVE"]);
});

test("화면에서 비활성인 십자 방향은 넘패드와 화살표 모두 차단하고 대각선만 누릅니다", () => {
  const f = fixture();
  for (const direction of ["N", "E", "S", "W"]) f.buttons[direction].disabled = true;
  for (const digit of [8, 6, 2, 4]) assert.equal(f.keypad(digit).defaultPrevented, false);
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) assert.equal(f.key(key).defaultPrevented, false);
  for (const digit of [7, 9, 1, 3]) assert.equal(f.keypad(digit).defaultPrevented, true);
  assert.deepEqual(f.clicks, ["NW", "NE", "SW", "SE"]);
  f.buttons.SE.disabled = true; assert.equal(f.keypad(3).defaultPrevented, false);
  f.buttons.NW.hidden = true; assert.equal(f.keypad(7).defaultPrevented, false);
  f.buttons.NE.setAttribute("aria-disabled", "true"); assert.equal(f.keypad(9).defaultPrevented, false);
  f.controls.setAttribute("inert", ""); assert.equal(f.keypad(1).defaultPrevented, false);
  assert.deepEqual(f.clicks, ["NW", "NE", "SW", "SE"]);
});

test("넘패드도 조합·반복·IME·입력란·열린 창과 최소화된 창에서 게임을 진행하지 않습니다", () => {
  const f = fixture();
  for (const properties of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true },
    { isComposing: true }, { keyCode: 229 }]) f.keypad(9, properties);
  for (const tag of ["input", "select", "textarea"]) {
    const input = new Element(f.document, tag); f.keypad(9, { target: input });
    f.document.activeElement = input; f.keypad(9); f.document.activeElement = f.document.body;
  }
  const editor = new Element(f.document, "div", { contenteditable: "plaintext-only" }), child = new Element(f.document, "span");
  child.parentElement = editor; f.keypad(9, { target: child });
  const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog);
  dialog.open = true; f.keypad(9); dialog.open = false;
  dialog.setAttribute("data-window-minimized", "true"); f.keypad(9); dialog.removeAttribute("data-window-minimized");
  assert.deepEqual(f.clicks, []); f.keypad(9); assert.deepEqual(f.clicks, ["NE"]);
});

test("WASD는 논리 키와 한글 상태의 물리 키 모두 삭제하고 이동 안내는 넘패드와 화살표만 표시합니다", () => {
  const f = fixture();
  for (const [key, code] of [["w", "KeyW"], ["A", "KeyA"], ["s", "KeyS"], ["D", "KeyD"], ["ㅈ", "KeyW"], ["ㅁ", "KeyA"], ["ㄴ", "KeyS"], ["ㅇ", "KeyD"]])
    assert.equal(f.key(key, { code }).defaultPrevented, false);
  assert.deepEqual(f.clicks, []);
  for (const [digit, direction] of Object.entries(mapping)) {
    const metadata = f.buttons[direction].getAttribute("aria-keyshortcuts");
    assert(metadata.includes("Numpad" + digit)); assert(!metadata.split(" ").some(key => ["W", "A", "S", "D"].includes(key)));
    if (direction.length === 2) assert.equal(metadata, "Numpad" + digit);
  }
  assert.equal(f.buttons.N.getAttribute("aria-keyshortcuts"), "ArrowUp Numpad8");
  assert.equal(f.move.getAttribute("aria-keyshortcuts"), "Q Numpad5");
  assert.equal(f.stop.getAttribute("aria-keyshortcuts"), "Q");
});

const storageKey = "bloodborne-hunt-v07";
function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [storageKey]: E.exportSave(state) }, window: { BBHuntMapControls: U },
    engine: { ...E, applyTileSpeedRuling: value => value, applyChapelRuling: value => value, applyCombatReactionRuling: value => value } });
  create({ document: ui.document, window: ui.window });
  ui.key = (key, properties = {}) => { const event = ui.document.fire("keydown", { key, target: ui.document.body, ...properties }); ui.document.fire("keyup", { key, target: ui.document.body, ...properties }); return event; };
  ui.keypad = digit => ui.key(String(digit), { code: "Numpad" + digit, location: 3, getModifierState: numLock });
  return ui;
}

test("실제 컨트롤러에서 윗줄 손패 선택·넘패드5 선언·넘패드6 이동·Q 마치기는 동일한 엔진 저장을 만듭니다", () => {
  const state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 }), ui = launch(state);
  const cardId = E.hunter(state).hand[0].id, before = ui.storage.get(storageKey);
  ui.keypad(1); ui.keypad(5); assert.equal(ui.storage.get(storageKey), before);
  ui.key("1", { code: "Digit1" }); ui.keypad(5);
  let expected = E.dispatch(state, { type: "MOVE", cardId }); assert.deepEqual(E.importSave(ui.storage.get(storageKey)), expected);
  const declared = ui.storage.get(storageKey); ui.keypad(5); assert.equal(ui.storage.get(storageKey), declared);
  ui.keypad(6); expected = E.dispatch(expected, { type: "STEP", node: "tile-14:right" });
  ui.key("q"); expected = E.dispatch(expected, { type: "STOP_MOVE" });
  assert.equal(ui.el("error").textContent, ""); assert.deepEqual(E.importSave(ui.storage.get(storageKey)), expected);
});

test("실제 갈림길에서 비활성 넘패드2는 저장을 보존하고 넘패드3만 해당 대각선 이동을 기록합니다", () => {
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  for (const command of require("./fixtures/weapon-campaign-completion/beast-claw-0.json").slice(0, 32)) state = E.dispatch(state, command);
  const ui = launch(state), before = ui.storage.get(storageKey);
  ui.keypad(2); ui.key("ArrowDown"); assert.equal(ui.storage.get(storageKey), before);
  const option = U.movement(state).directions.find(direction => direction.edge === "SE").options[0]; assert(option);
  ui.keypad(3); assert.equal(ui.el("error").textContent, ""); assert.deepEqual(E.importSave(ui.storage.get(storageKey)), E.dispatch(state, option.command));
});
