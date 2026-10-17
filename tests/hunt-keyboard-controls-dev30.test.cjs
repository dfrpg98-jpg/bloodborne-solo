"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const create = require("../src/hunt-keyboard-controls");
const { boot, Document, Element } = require("./helpers/ui-harness.cjs");
const E = require("../src/hunt-engine"), U = require("../src/hunt-map-controls");

function fixture(phase = "hunter", options = {}) {
  const document = new Document('<html><body><div id="movementControls"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const controls = document.getElementById("movementControls"), clicks = [];
  const add = (attributes, name) => {
    const button = new Element(document, "button", attributes);
    button.parentElement = controls; button.addEventListener("click", () => clicks.push(name)); controls.append(button); return button;
  };
  const move = add({ "data-command": "MOVE", title: "카드 1장으로 이동" }, "MOVE");
  const stop = add({ "data-command": "STOP_MOVE" }, "STOP_MOVE");
  const direction = Object.fromEntries(["N", "E", "S", "W"].map(edge => [edge, add({ "data-move-direction": edge }, edge)]));
  const window = options.window || {};
  const api = create({ document, window });
  const key = (key, properties = {}) => document.fire("keydown", { key, target: document.body, ...properties });
  return { document, window, controls, clicks, move, stop, direction, api, key, add };
}

test("M은 현재 단계의 이동 선언과 이동 마치기 버튼을 각각 한 번 누릅니다", () => {
  const f = fixture();
  assert.equal(f.key("m").defaultPrevented, true); assert.deepEqual(f.clicks, ["MOVE"]);
  f.document.documentElement.dataset.phase = "move";
  f.key("M"); assert.deepEqual(f.clicks, ["MOVE", "STOP_MOVE"]);
  f.document.documentElement.dataset.phase = "combat_react";
  assert.equal(f.key("m").defaultPrevented, false); assert.equal(f.clicks.length, 2);
});

test("방향키와 WASD는 이동 단계의 기존 방향 버튼만 누릅니다", () => {
  const f = fixture("move");
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "w", "D", "s", "A"]) {
    assert.equal(f.key(key).defaultPrevented, true);
  }
  assert.deepEqual(f.clicks, ["N", "E", "S", "W", "N", "E", "S", "W"]);
  f.document.documentElement.dataset.phase = "hunter";
  assert.equal(f.key("ArrowRight").defaultPrevented, false); assert.equal(f.clicks.length, 8);
});

test("영문 배열의 물리 키는 한글 입력 상태에서도 작동하고 조합 중에는 멈춥니다", () => {
  const f = fixture("move");
  f.key("ㅇ", { code: "KeyD" }); f.key("ㅡ", { code: "KeyM" });
  assert.deepEqual(f.clicks, ["E", "STOP_MOVE"]);
  f.key("ㅇ", { code: "KeyD", isComposing: true }); f.key("m", { keyCode: 229 });
  assert.equal(f.clicks.length, 2);
});

test("반복 입력과 브라우저 단축키 및 이미 처리된 입력은 게임 명령을 만들지 않습니다", () => {
  const f = fixture("move");
  for (const properties of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { defaultPrevented: true }]) {
    f.key("m", properties); f.key("ArrowRight", properties);
  }
  assert.deepEqual(f.clicks, []);
  assert.equal(f.key("q").defaultPrevented, false);
});

test("입력 요소와 편집 영역 및 그 자손의 키 입력을 보호합니다", () => {
  const f = fixture("move");
  for (const tag of ["input", "select", "textarea"]) {
    const input = new Element(f.document, tag); f.key("m", { target: input }); f.key("ArrowDown", { target: input });
    f.document.activeElement = input; f.key("m"); f.document.activeElement = f.document.body;
  }
  for (const value of ["", "true", "plaintext-only"]) {
    const editor = new Element(f.document, "div", { contenteditable: value }), child = new Element(f.document, "span");
    child.parentElement = editor; f.key("w", { target: child }); f.key("m", { target: { nodeType: 3, parentElement: editor } });
  }
  const nativeEditor = new Element(f.document); nativeEditor.isContentEditable = true;
  f.key("a", { target: nativeEditor }); assert.deepEqual(f.clicks, []);
});

test("열린 창과 최소화된 창에서는 이동 키를 처리하지 않습니다", () => {
  const f = fixture("move"), dialog = new Element(f.document, "dialog");
  f.document.elements.push(dialog); dialog.open = true;
  assert.equal(f.key("m").defaultPrevented, false); f.key("ArrowRight");
  dialog.open = false; dialog.setAttribute("open", ""); f.key("w"); dialog.removeAttribute("open");
  const minimized = new Element(f.document, "div", { "data-window-minimized": "true" });
  f.document.elements.push(minimized); f.key("m"); f.key("d"); assert.deepEqual(f.clicks, []);
  minimized.setAttribute("data-window-minimized", "false"); minimized.dataset.windowMinimized = "false";
  f.key("m"); assert.deepEqual(f.clicks, ["STOP_MOVE"]);
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
    const restore = modify(); assert.equal(f.key("m").defaultPrevented, false); restore();
  }
  f.direction.N.disabled = true; assert.equal(f.key("ArrowUp").defaultPrevented, false);
  assert.deepEqual(f.clicks, []);
});

test("이동 마치기가 비활성일 때 취소나 다른 명령을 대신 누르지 않습니다", () => {
  const f = fixture("move"); f.stop.disabled = true; f.add({ "data-command": "CANCEL_MOVE" }, "CANCEL_MOVE");
  f.key("m"); assert.deepEqual(f.clicks, []);
});

test("단축키 표시는 기존 비용 설명을 유지하고 갱신되어도 중복하지 않습니다", () => {
  const f = fixture(); f.api.refresh(); f.api.refresh();
  assert.equal(f.move.getAttribute("title"), "카드 1장으로 이동 · 단축키 M");
  assert.equal(f.move.getAttribute("aria-keyshortcuts"), "M");
  assert.equal(f.direction.E.getAttribute("aria-keyshortcuts"), "ArrowRight D");
  assert.equal(f.stop.getAttribute("title"), "단축키 M");
});

test("동적 버튼에는 자식 변경 감시로 단축키를 표시하고 초기화와 해제를 중복하지 않습니다", () => {
  let callback, observed, disconnected = 0;
  class Observer { constructor(handler) { callback = handler; } observe(element, options) { observed = { element, options }; } disconnect() { disconnected++; } }
  const f = fixture("move", { window: { MutationObserver: Observer } });
  assert.deepEqual(observed.options, { childList: true, subtree: true }); assert.equal(observed.element, f.controls);
  assert.equal(create({ document: f.document, window: f.window }), f.api);
  const next = f.add({ "data-command": "STOP_MOVE", title: "남은 이동 종료" }, "NEXT"); callback();
  assert.equal(next.getAttribute("title"), "남은 이동 종료 · 단축키 M");
  f.key("m"); assert.equal(f.clicks.length, 1);
  f.api.destroy(); f.api.destroy(); f.key("m"); assert.equal(f.clicks.length, 1); assert.equal(disconnected, 1);
});

test("단축키 모듈은 엔진이나 게임 저장소를 읽지 않고 DOM 버튼만 사용합니다", () => {
  const window = {};
  for (const name of ["BBHunt", "state", "localStorage"]) Object.defineProperty(window, name, { get() { throw new Error("게임 데이터 접근"); } });
  const f = fixture("move", { window }); f.key("ArrowLeft"); f.key("m");
  assert.deepEqual(f.clicks, ["W", "STOP_MOVE"]);
});

test("브라우저 스크립트는 DOM 준비 후 시작하고 다른 실행 모듈을 로드하지 않습니다", () => {
  const f = fixture(); f.api.destroy(); f.document.readyState = "loading";
  const window = { document: f.document }, source = fs.readFileSync(path.join(__dirname, "../src/hunt-keyboard-controls.js"), "utf8");
  vm.runInNewContext(source, { window }); assert.equal(typeof window.BBHuntKeyboardControls, "function");
  f.key("m"); assert.deepEqual(f.clicks, []); f.document.fire("DOMContentLoaded"); f.key("m");
  assert.deepEqual(f.clicks, ["MOVE"]); assert.equal(f.document.querySelectorAll("script").length, 0);
});

const key = "bloodborne-hunt-v07";
function initial() { return E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 }); }
function launch(state) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: U },
    engine: { ...E, applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } });
  create({ document: ui.document, window: ui.window });
  ui.key = (key, properties = {}) => ui.document.fire("keydown", { key, target: ui.document.body, ...properties });
  return ui;
}
function saved(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); }

test("실제 화면의 M·방향키·M은 클릭과 동일한 카드 비용과 저장 결과를 만듭니다", () => {
  const state = initial(), ui = launch(state), before = ui.storage.get(key), cardId = E.hunter(state).hand[0].id;
  ui.key("m"); assert.equal(ui.storage.get(key), before);
  ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId).click();
  ui.key("m"); let reference = E.dispatch(state, { type: "MOVE", cardId }); assert.deepEqual(saved(ui), reference);
  ui.key("ArrowRight"); reference = E.dispatch(reference, { type: "STEP", node: "tile-14:right" }); assert.deepEqual(saved(ui), reference);
  ui.key("m"); reference = E.dispatch(reference, { type: "STOP_MOVE" }); assert.deepEqual(saved(ui), reference);
  assert.equal(E.hunter(reference).discard.length, E.hunter(state).discard.length + 1);
});

test("실제 지도에서 같은 방향에 목적지가 둘이면 키 입력으로 임의 선택하지 않습니다", () => {
  let state = initial();
  for (const command of require("./fixtures/weapon-campaign-completion/beast-claw-0.json").slice(0, 32)) state = E.dispatch(state, command);
  assert.equal(state.phase, "move"); assert.equal(E.hunter(state).position, "tile-17:top");
  const ui = launch(state), before = ui.storage.get(key);
  ui.key("ArrowDown"); assert.equal(ui.storage.get(key), before);
  const choices = ui.el("movementControls").querySelectorAll("[data-move-option]"); assert.equal(choices.length, 2);
  const options = U.movement(state).directions.find(direction => direction.edge === "S").options;
  choices[1].click(); assert.deepEqual(saved(ui), E.dispatch(state, options[1].command));
});

test("실제 확인 창이 열려 있으면 단축키는 저장이나 이동을 진행시키지 않습니다", () => {
  const state = initial(), ui = launch(state), cardId = E.hunter(state).hand[0].id;
  ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId).click(); ui.key("m");
  const before = ui.storage.get(key); ui.el("infoDialog").showModal();
  ui.key("ArrowRight"); ui.key("m"); assert.equal(ui.storage.get(key), before);
  ui.el("infoDialog").close(); ui.key("ArrowRight");
  assert.deepEqual(saved(ui), E.dispatch(E.dispatch(state, { type: "MOVE", cardId }), { type: "STEP", node: "tile-14:right" }));
});
