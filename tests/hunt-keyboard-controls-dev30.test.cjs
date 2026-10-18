"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const create = require("../src/hunt-keyboard-controls");
const { boot, Document, Element } = require("./helpers/ui-harness.cjs");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls");

function fixture(phase = "hunter", options = {}) {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const controls = document.getElementById("movementControls"), clicks = [];
  const add = (attributes, name) => {
    const button = new Element(document, "button", attributes);
    button.parentElement = controls; button.addEventListener("click", () => clicks.push(name)); controls.append(button); return button;
  };
  const move = add({ "data-command": "MOVE", title: "카드 1장으로 이동" }, "MOVE");
  const stop = add({ "data-command": "STOP_MOVE" }, "STOP_MOVE");
  const direction = Object.fromEntries(["N", "E", "S", "W"].map(edge => [edge, add({ "data-move-direction": edge }, edge)]));
  const hand = document.getElementById("hand"), addCard = (id, rect) => {
    const button = new Element(document, "button", { "data-card": id, title: id + " 설명" });
    button.parentElement = hand; if (rect) button._rect = rect;
    button.addEventListener("click", () => clicks.push(id)); hand.append(button); return button;
  };
  for (let i = 1; i <= (options.handCount ?? 3); i++) addCard("card-" + i);
  const window = options.window || {};
  const api = create({ document, window });
  const key = (key, properties = {}) => { const event = document.fire("keydown", { key, target: document.body, ...properties }); document.fire("keyup", { key, target: document.body, ...properties }); return event; };
  return { document, window, controls, hand, addCard, clicks, move, stop, direction, api, key, add };
}

test("Q는 현재 단계의 이동 선언과 이동 마치기 버튼을 각각 한 번 누릅니다", () => {
  const f = fixture();
  assert.equal(f.key("q").defaultPrevented, true); assert.deepEqual(f.clicks, ["MOVE"]);
  f.document.documentElement.dataset.phase = "move";
  f.key("Q"); assert.deepEqual(f.clicks, ["MOVE", "STOP_MOVE"]);
  f.document.documentElement.dataset.phase = "combat_react";
  assert.equal(f.key("q").defaultPrevented, false); assert.equal(f.clicks.length, 2);
});

test("방향키는 이동 단계의 기존 방향 버튼만 누르며 WASD는 작동하지 않습니다", () => {
  const f = fixture("move");
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
    assert.equal(f.key(key).defaultPrevented, true);
  }
  for (const key of ["w", "D", "s", "A"]) assert.equal(f.key(key, { code: "Key" + key.toUpperCase() }).defaultPrevented, false);
  assert.deepEqual(f.clicks, ["N", "E", "S", "W"]);
  f.document.documentElement.dataset.phase = "hunter";
  assert.equal(f.key("ArrowRight").defaultPrevented, false); assert.equal(f.clicks.length, 4);
});

test("물리 Q키는 한글 입력 상태에서도 작동하지만 예전 WASD 물리 키는 작동하지 않습니다", () => {
  const f = fixture("move");
  f.key("ㅇ", { code: "KeyD" }); f.key("ㅂ", { code: "KeyQ" });
  assert.deepEqual(f.clicks, ["STOP_MOVE"]);
  f.key("ㅇ", { code: "KeyD", isComposing: true }); f.key("q", { keyCode: 229 });
  assert.equal(f.clicks.length, 1);
});

test("반복 입력과 브라우저 단축키 및 이미 처리된 입력은 게임 명령을 만들지 않습니다", () => {
  const f = fixture("move");
  for (const properties of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }]) {
    f.key("q", properties); f.key("ArrowRight", properties);
  }
  assert.deepEqual(f.clicks, []);
  assert.equal(f.key("m").defaultPrevented, false);
});

test("입력 요소와 편집 영역 및 그 자손의 키 입력을 보호합니다", () => {
  const f = fixture("move");
  for (const tag of ["input", "select", "textarea"]) {
    const input = new Element(f.document, tag); f.key("q", { target: input }); f.key("ArrowDown", { target: input });
    f.document.activeElement = input; f.key("q"); f.document.activeElement = f.document.body;
  }
  for (const value of ["", "true", "plaintext-only"]) {
    const editor = new Element(f.document, "div", { contenteditable: value }), child = new Element(f.document, "span");
    child.parentElement = editor; f.key("w", { target: child }); f.key("q", { target: { nodeType: 3, parentElement: editor } });
  }
  const nativeEditor = new Element(f.document); nativeEditor.isContentEditable = true;
  f.key("a", { target: nativeEditor }); assert.deepEqual(f.clicks, []);
});

test("열린 창과 최소화된 창에서는 이동 키를 처리하지 않습니다", () => {
  const f = fixture("move"), dialog = new Element(f.document, "dialog");
  f.document.elements.push(dialog); dialog.open = true;
  assert.equal(f.key("q").defaultPrevented, false); f.key("ArrowRight");
  dialog.open = false; dialog.setAttribute("open", ""); f.key("w"); dialog.removeAttribute("open");
  const minimized = new Element(f.document, "div", { "data-window-minimized": "true" });
  f.document.elements.push(minimized); f.key("q"); f.key("d"); assert.deepEqual(f.clicks, []);
  minimized.setAttribute("data-window-minimized", "false"); minimized.dataset.windowMinimized = "false";
  f.key("q"); assert.deepEqual(f.clicks, ["STOP_MOVE"]);
});

test("비활성·숨김·분리된 버튼과 숨겨진 상위 영역의 버튼은 누르지 않습니다", () => {
  const f = fixture("move"), stop = f.stop;
  for (const modify of [
    () => { stop.disabled = true; return () => { stop.disabled = false; }; },
    () => { stop.hidden = true; return () => { stop.hidden = false; }; },
    () => { stop.setAttribute("aria-disabled", "true"); return () => stop.removeAttribute("aria-disabled"); },
    () => { stop.isConnected = false; return () => { delete stop.isConnected; }; },
    () => { stop.getClientRects = () => []; return () => { delete stop.getClientRects; }; },
    () => { f.controls.hidden = true; return () => { f.controls.hidden = false; }; },
    () => { f.controls.setAttribute("inert", ""); return () => f.controls.removeAttribute("inert"); },
  ]) {
    const restore = modify(); assert.equal(f.key("q").defaultPrevented, false); restore();
  }
  f.direction.N.disabled = true; assert.equal(f.key("ArrowUp").defaultPrevented, false);
  assert.deepEqual(f.clicks, []);
});

test("이동 마치기가 비활성일 때 취소나 다른 명령을 대신 누르지 않습니다", () => {
  const f = fixture("move"); f.stop.disabled = true; f.add({ "data-command": "CANCEL_MOVE" }, "CANCEL_MOVE");
  f.key("q"); assert.deepEqual(f.clicks, []);
});

test("단축키 표시는 기존 비용 설명을 유지하고 갱신되어도 중복하지 않습니다", () => {
  const f = fixture(); f.api.refresh(); f.api.refresh();
  assert.equal(f.move.getAttribute("title"), "카드 1장으로 이동 · 단축키 Q Numpad5");
  assert.equal(f.move.getAttribute("aria-keyshortcuts"), "Q Numpad5");
  assert.equal(f.direction.E.getAttribute("aria-keyshortcuts"), "ArrowRight Numpad6");
  assert.equal(f.stop.getAttribute("title"), "단축키 Q");
});

test("동적 버튼에는 자식 변경 감시로 단축키를 표시하고 초기화와 해제를 중복하지 않습니다", () => {
  let callback, disconnected = 0; const observed = [];
  class Observer { constructor(handler) { callback = handler; } observe(element, options) { observed.push({ element, options }); } disconnect() { disconnected++; } }
  const f = fixture("move", { window: { MutationObserver: Observer } });
  assert.deepEqual(observed.map(entry => entry.element), [f.controls, f.hand]);
  for (const entry of observed) assert.deepEqual(entry.options, { childList: true, subtree: true });
  assert.equal(create({ document: f.document, window: f.window }), f.api);
  const next = f.add({ "data-command": "STOP_MOVE", title: "남은 이동 종료" }, "NEXT"); callback();
  assert.equal(next.getAttribute("title"), "남은 이동 종료 · 단축키 Q");
  f.key("q"); assert.equal(f.clicks.length, 1);
  f.api.destroy(); f.api.destroy(); f.key("q"); assert.equal(f.clicks.length, 1); assert.equal(disconnected, 1);
});

test("손패 1~9는 윗줄 숫자로만 왼쪽부터 선택하고 넘패드 숫자는 손패를 선택하지 않습니다", () => {
  const f = fixture("combat_react", { handCount: 11 }), cards = f.hand.querySelectorAll("[data-card]");
  // A visual grid can differ from DOM order; row first, then left position defines numbering.
  cards.forEach((card, index) => { card._rect = { top: Math.floor(index / 3) * 104, left: index % 3 * 100 }; });
  [cards[0]._rect, cards[2]._rect] = [cards[2]._rect, cards[0]._rect];
  f.api.refresh();
  for (let i = 1; i <= 9; i++) assert.equal(f.key(String(i), { code: "Digit" + i }).defaultPrevented, true);
  const expected = ["card-3", "card-2", "card-1", "card-4", "card-5", "card-6", "card-7", "card-8", "card-9"];
  assert.deepEqual(f.clicks, expected);
  for (let i = 1; i <= 9; i++) {
    f.key(String(i), { code: "Numpad" + i, getModifierState: () => true });
    f.key(String(i), { code: "Numpad" + i, getModifierState: () => false });
  }
  assert.deepEqual(f.clicks, expected);
  for (const [key, code] of [["0", "Digit0"], ["0", "Numpad0"], ["10", ""], ["End", "Numpad1"]])
    assert.equal(f.key(key, { code }).defaultPrevented, false);
  assert.equal(f.clicks.length, 9); assert(!f.clicks.includes("card-10")); assert(!f.clicks.includes("card-11"));
  assert.equal(cards[2].getAttribute("aria-keyshortcuts"), "1");
  assert.equal(cards[9].getAttribute("aria-keyshortcuts"), null);
});

test("숫자 선택도 조합키·Shift·IME·자동반복·입력 요소·열린 창에서 차단합니다", () => {
  const f = fixture();
  for (const properties of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }]) f.key("1", { code: "Digit1", ...properties });
  f.key("!", { code: "Digit1", shiftKey: true });
  for (const tag of ["input", "select", "textarea"]) {
    const input = new Element(f.document, tag); f.key("1", { target: input });
    f.document.activeElement = input; f.key("1"); f.document.activeElement = f.document.body;
  }
  const editor = new Element(f.document, "div", { contenteditable: "true" }), child = new Element(f.document, "span");
  child.parentElement = editor; f.key("1", { target: child });
  f.key("1", { target: { nodeType: 3, parentElement: editor } });
  const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog); dialog.open = true; f.key("1");
  dialog.open = false; dialog.setAttribute("data-window-minimized", "true"); f.key("1"); dialog.removeAttribute("data-window-minimized");
  assert.deepEqual(f.clicks, []); f.key("1"); assert.deepEqual(f.clicks, ["card-1"]);
});

test("비활성 손패 숫자는 다음 카드를 대신 고르지 않고 숨겨진 카드는 화면 순서에서 제외합니다", () => {
  const f = fixture(), cards = f.hand.querySelectorAll("[data-card]");
  cards[0].disabled = true; assert.equal(f.key("1").defaultPrevented, false);
  f.key("2"); assert.deepEqual(f.clicks, ["card-2"]);
  cards[0].disabled = false; cards[0].hidden = true; f.key("1"); assert.equal(f.clicks.at(-1), "card-2");
  f.hand.setAttribute("inert", ""); assert.equal(f.key("1").defaultPrevented, false); f.hand.removeAttribute("inert");
  cards[1].getClientRects = () => []; f.key("1"); assert.equal(f.clicks.at(-1), "card-3");
});

test("손패 재정렬·소모·재렌더 후 최신 번호와 안내를 적용하며 열 번째로 밀린 카드의 안내는 제거합니다", () => {
  let refresh;
  class Observer { constructor(callback) { refresh = callback; } observe() {} disconnect() {} }
  const f = fixture("hunter", { handCount: 10, window: { MutationObserver: Observer } }), first = f.hand.children[0];
  assert.equal(first.getAttribute("title"), "card-1 설명 · 단축키 1");
  f.hand.children.push(f.hand.children.shift()); refresh(); f.api.refresh();
  assert.equal(first.getAttribute("title"), "card-1 설명"); assert.equal(first.getAttribute("aria-keyshortcuts"), null);
  f.key("1"); assert.equal(f.clicks.at(-1), "card-2");
  f.hand.children.shift(); refresh(); f.key("1"); assert.equal(f.clicks.at(-1), "card-3");
  assert.equal(first.getAttribute("aria-keyshortcuts"), "9");
  f.hand.innerHTML = '<button data-card="new-card" title="새 손패 효과"></button>'; refresh();
  const fresh = f.hand.querySelectorAll("[data-card]")[0]; let clicked = 0; fresh.onclick = () => clicked++;
  assert.equal(fresh.getAttribute("title"), "새 손패 효과 · 단축키 1"); assert.equal(fresh.getAttribute("aria-keyshortcuts"), "1");
  f.key("1", { code: "Digit1" }); assert.equal(clicked, 1);
  assert.equal(f.key("2").defaultPrevented, false);
});

test("단축키 모듈은 엔진이나 게임 저장소를 읽지 않고 DOM 버튼만 사용합니다", () => {
  const window = {};
  for (const name of ["BBHunt", "state", "localStorage"]) Object.defineProperty(window, name, { get() { throw new Error("게임 데이터 접근"); } });
  const f = fixture("move", { window }); f.key("ArrowLeft"); f.key("q"); f.key("1");
  assert.deepEqual(f.clicks, ["W", "STOP_MOVE", "card-1"]);
});

test("지도에 포커스한 0은 실제 카메라의 100% 복원을 유지하며 손패를 선택하지 않습니다", () => {
  const Camera = require("../src/hunt-camera"), f = fixture(), viewport = new Element(f.document),
    content = new Element(f.document), surface = new Element(f.document);
  Object.assign(viewport, { clientWidth: 400, clientHeight: 300 });
  Object.assign(content, { offsetWidth: 800, offsetHeight: 600 });
  const camera = Camera({ document: f.document, viewport, content, surface });
  viewport.focus(); camera.setZoom(1.44);
  const event = viewport.fire("keydown", { key: "0", code: "Digit0" });
  assert.equal(event.defaultPrevented, true); assert.equal(camera.zoom(), 1);
  f.document.fire("keydown", event); assert.deepEqual(f.clicks, []);
  camera.destroy();
});

test("브라우저 스크립트는 DOM 준비 후 시작하고 다른 실행 모듈을 로드하지 않습니다", () => {
  const f = fixture(); f.api.destroy(); f.document.readyState = "loading";
  const window = { document: f.document }, source = fs.readFileSync(path.join(__dirname, "../src/hunt-keyboard-controls.js"), "utf8");
  vm.runInNewContext(source, { window }); assert.equal(typeof window.BBHuntKeyboardControls, "function");
  f.key("q"); assert.deepEqual(f.clicks, []); f.document.fire("DOMContentLoaded"); f.key("q");
  assert.deepEqual(f.clicks, ["MOVE"]); assert.equal(f.document.querySelectorAll("script").length, 0);
});

const key = "bloodborne-hunt-v07";
function initial() { return E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 }); }
function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: U },
    engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } });
  create({ document: ui.document, window: ui.window });
  ui.key = (key, properties = {}) => { const event = ui.document.fire("keydown", { key, target: ui.document.body, ...properties }); ui.document.fire("keyup", { key, target: ui.document.body, ...properties }); return event; };
  return ui;
}
function saved(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); }

test("실제 손패의 숫자 선택·해제는 저장을 보존하고 소모 뒤 최신 순서의 카드를 이동에 사용합니다", () => {
  const state = initial(), ui = launch(state), before = ui.storage.get(key), cards = E.hunter(state).hand.map(card => card.id),
    pressed = () => ui.el("hand").querySelectorAll("[data-card]").filter(card => card.getAttribute("aria-pressed") === "true").map(card => card.dataset.card);
  ui.key("1", { code: "Digit1" }); assert.deepEqual(pressed(), [cards[0]]);
  ui.key("1", { code: "Digit1" }); assert.deepEqual(pressed(), []);
  ui.key("2", { code: "Digit2" }); assert.deepEqual(pressed(), [cards[1]]);
  assert.equal(ui.storage.get(key), before); assert.equal(saved(ui).commands.length, state.commands.length);
  ui.key("q"); ui.key("2", { code: "Digit2" }); ui.key(" ", { code: "Space" });
  let reference = E.dispatch(state, { type: "MOVE", cardId: cards[1] });
  ui.key("ArrowRight"); reference = E.dispatch(reference, { type: "STEP", node: "tile-14:right" });
  ui.key("q"); reference = E.dispatch(reference, { type: "STOP_MOVE" }); assert.deepEqual(saved(ui), reference);
  const afterMove = ui.storage.get(key), commandCount = saved(ui).commands.length;
  ui.key("1", { code: "Digit1" }); assert.deepEqual(pressed(), [cards[0]]);
  assert.equal(ui.storage.get(key), afterMove); assert.equal(saved(ui).commands.length, commandCount);
  ui.key("q"); ui.key("1", { code: "Digit1" }); ui.key(" ", { code: "Space" });
  reference = E.dispatch(reference, { type: "MOVE", cardId: cards[0] }); assert.deepEqual(saved(ui), reference);
  assert.equal(saved(ui).commands.at(-1).cardId, cards[0]);
});

test("실제 화면의 Q·방향키·Q는 클릭과 동일한 카드 비용과 저장 결과를 만듭니다", () => {
  const state = initial(), ui = launch(state), before = ui.storage.get(key), cardId = E.hunter(state).hand[0].id;
  ui.key("q"); assert.equal(ui.storage.get(key), before);
  assert.equal(ui.el("confirmHunterAction").disabled, true);
  ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId).click();
  ui.key(" ", { code: "Space" }); let reference = E.dispatch(state, { type: "MOVE", cardId }); assert.deepEqual(saved(ui), reference);
  ui.key("ArrowRight"); reference = E.dispatch(reference, { type: "STEP", node: "tile-14:right" }); assert.deepEqual(saved(ui), reference);
  ui.key("q"); reference = E.dispatch(reference, { type: "STOP_MOVE" }); assert.deepEqual(saved(ui), reference);
  assert.equal(E.hunter(reference).discard.length, E.hunter(state).discard.length + 1);
});

test("실제 지도에서 대각선 갈림길은 방향키로 임의 선택하지 않고 대각선 버튼을 사용합니다", () => {
  let state = initial();
  for (const command of require("./fixtures/weapon-campaign-completion/beast-claw-0.json").slice(0, 32)) state = E.dispatch(state, command);
  assert.equal(state.phase, "move"); assert.equal(E.hunter(state).position, "tile-17:top");
  const ui = launch(state), before = ui.storage.get(key);
  ui.key("ArrowDown"); assert.equal(ui.storage.get(key), before);
  const choices = ui.el("movementControls").querySelectorAll("[data-move-option]"); assert.equal(choices.length, 0);
  const option = U.movement(state).directions.find(direction => direction.edge === "SE").options[0];
  ui.el("movementControls").querySelectorAll("[data-move-direction]").find(button => button.dataset.moveDirection === "SE").click();
  assert.deepEqual(saved(ui), E.dispatch(state, option.command));
});

test("실제 확인 창이 열려 있으면 단축키는 저장이나 이동을 진행시키지 않습니다", () => {
  const state = initial(), ui = launch(state), cardId = E.hunter(state).hand[0].id;
  ui.key("q"); ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId).click(); ui.key(" ", { code: "Space" });
  const before = ui.storage.get(key); ui.el("infoDialog").showModal();
  ui.key("ArrowRight"); ui.key("q"); assert.equal(ui.storage.get(key), before);
  ui.el("infoDialog").close(); ui.key("ArrowRight");
  assert.deepEqual(saved(ui), E.dispatch(E.dispatch(state, { type: "MOVE", cardId }), { type: "STEP", node: "tile-14:right" }));
});
