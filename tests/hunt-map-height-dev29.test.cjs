"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const create = require("../src/hunt-map-height");
// 개별 선택 동작은 명시적으로 저장된 원래 높이에서 시작하고, 새 기본 검사는 saved: null을 사용합니다.
function fixture({ rows = "132px 24px 480px 228px", inline = "", saved = "standard", blocked = false } = {}) {
  const writes = [], resizeObservers = [], events = [], classes = new Set(), attributes = new Map(), changed = [];
  const main = { style: { gridTemplateRows: inline }, classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  const panel = { getAttribute: key => attributes.get(key) ?? null, setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
  const buttons = [], document = { querySelector: selector => selector === ".hunt-main" ? main : null,
    querySelectorAll: selector => selector === ".hud-summary > .panel" ? [panel] : [],
    getElementById: id => id === "mapStage" ? { append(button) { buttons.push(button); } } : null,
    createElement() { const listeners = new Map(), attrs = new Map(); return { listeners,
      setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key),
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
      click() { listeners.get("click")?.(); }, remove() { this.removed = true; } }; } };
  const stored = new Map([["bloodborne-hunt-v07", "일반 저장"], ["bloodborne-hunt-qa-v1", "검증 저장"], ["bloodborne-ui-map-height-v1", "tall"], ["bloodborne-ui-map-height-v2", "standard"]]);
  if (saved !== null) stored.set(create.storageKey, saved);
  const storage = { getItem: key => { if (blocked) throw Error("저장 차단"); return stored.get(key) || null; },
    setItem: (key, value) => { if (blocked) throw Error("저장 차단"); stored.set(key, value); writes.push({ key, value }); } };
  let nativeRows = rows;
  const window = { Event: class { constructor(type) { this.type = type; } }, localStorage: storage,
    getComputedStyle(element) { changed.push(element.style.gridTemplateRows); return { gridTemplateRows: element.style.gridTemplateRows || nativeRows }; },
    addEventListener(name, fn, options) { resizeObservers.push({ name, fn, options }); },
    removeEventListener(name, fn) { const item = resizeObservers.findIndex(item => item.name === name && item.fn === fn); if (item >= 0) resizeObservers.splice(item, 1); },
    dispatchEvent(event) { events.push(event.type); for (const item of resizeObservers) if (item.name === event.type) item.fn(event); } };
  const controller = create({ document, window });
  return { controller, document, window, main, panel, attributes, stored, writes, events, changed, classes, button: buttons[0], buttons,
    nativeRows(value) { nativeRows = value; } };
}

test("저장된 원래 높이는 기존 행 크기·배율·저장·크기 이벤트를 바꾸지 않는다", () => {
  const f = fixture();
  assert.equal(f.controller.expanded(), false); assert.equal(f.main.style.gridTemplateRows, "");
  assert.equal(f.changed.length, 0); assert.equal(f.events.length, 0); assert.equal(f.writes.length, 0);
  assert.equal(f.classes.size, 0); assert.equal(f.attributes.size, 0); assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.main.style.transform, undefined); assert.equal(f.main.style.zoom, undefined);
});
test("새 기본 화면은 상단 요약에서만 36픽셀을 빌리고 하단·글자·전체 배율을 유지한다", () => {
  const f = fixture({ saved: null });
  assert.equal(f.controller.expanded(), true);
  assert.equal(f.main.style.gridTemplateRows, "96px 24px minmax(0, 1fr) 228px");
  assert.deepEqual(Object.keys(f.main.style), ["gridTemplateRows"]);
  assert.equal(f.main.style.fontSize, undefined); assert.equal(f.main.style.transform, undefined); assert.equal(f.main.style.zoom, undefined);
  assert.equal(f.main.style.width, undefined); assert.equal(f.main.style.height, undefined);
  assert.equal(f.writes.length, 0); assert.deepEqual(f.events, ["resize"]); assert.equal(f.button.getAttribute("aria-pressed"), "true");
  f.button.click(); assert.equal(f.main.style.gridTemplateRows, ""); assert.equal(f.stored.get(create.storageKey), "standard");
  f.button.click(); assert.equal(f.main.style.gridTemplateRows, "96px 24px minmax(0, 1fr) 228px");
});
test("짧은 화면의 새 기본도 상단만 36픽셀 줄이고 손패·무기 행은 그대로 둔다", () => {
  const f = fixture({ saved: null, rows: "126px 22px 240px 238px" });
  assert.equal(f.main.style.gridTemplateRows, "90px 22px minmax(0, 1fr) 238px");
  assert.equal(f.writes.length, 0); assert.equal(f.main.style.fontSize, undefined);
});
test("사용자가 확장하면 상단에서 36픽셀만 빌리고 손패와 무기 행은 유지한다", () => {
  const f = fixture(); f.button.click();
  assert.equal(f.controller.expanded(), true);
  assert.equal(f.main.style.gridTemplateRows, "96px 24px minmax(0, 1fr) 228px");
  assert.equal(f.button.getAttribute("aria-pressed"), "true"); assert.deepEqual(f.events, ["resize"]);
  assert.equal(f.panel.getAttribute("tabindex"), "0");
  assert.deepEqual(f.writes, [{ key: create.storageKey, value: "expanded" }]);
});
test("다시 누르면 원래 CSS 배치와 접근성 속성으로 돌아간다", () => {
  const f = fixture(); f.button.click(); f.button.click();
  assert.equal(f.main.style.gridTemplateRows, ""); assert.equal(f.controller.expanded(), false);
  assert.equal(f.attributes.size, 0); assert.equal(f.classes.size, 0);
  assert.equal(f.button.getAttribute("aria-pressed"), "false");
  assert.equal(f.stored.get(create.storageKey), "standard");
});
test("현재 화면의 실제 행 크기를 사용하고 특정 해상도를 강제하지 않는다", () => {
  const f = fixture({ rows: "164px 22px 620px 260px" }); f.button.click();
  assert.equal(f.main.style.gridTemplateRows, "128px 22px minmax(0, 1fr) 260px");
  f.nativeRows("126px 22px 240px 238px"); f.window.dispatchEvent({ type: "resize" });
  assert.equal(f.main.style.gridTemplateRows, "90px 22px minmax(0, 1fr) 238px");
  assert.equal(f.writes.length, 1);
});
test("크기 변경의 기존 지도 관찰자보다 먼저 원래 CSS 행을 다시 측정한다", () => {
  const f = fixture(); f.button.click();
  assert.equal(f.changed[0], "");
  f.nativeRows("112px 24px 300px 244px"); f.window.dispatchEvent({ type: "resize" });
  assert.equal(f.changed.at(-1), "");
  assert.equal(f.main.style.gridTemplateRows, "76px 24px minmax(0, 1fr) 244px");
});
test("사용자가 저장한 새 설정만 복원하고 이전 해상도 시험 설정은 읽지 않는다", () => {
  const first = fixture({ saved: null }); assert.equal(first.controller.expanded(), true);
  assert.equal(create.storageKey, "bloodborne-ui-map-height-v3");
  assert.equal(first.stored.get("bloodborne-ui-map-height-v2"), "standard"); assert.equal(first.writes.length, 0);
  const restored = fixture({ saved: "expanded" }); assert.equal(restored.controller.expanded(), true);
  assert.equal(restored.writes.length, 0); assert.deepEqual(restored.events, ["resize"]);
  const standard = fixture({ saved: "standard" }); assert.equal(standard.controller.expanded(), false); assert.equal(standard.changed.length, 0);
});
test("진행 중인 사냥·검증 저장은 그대로 보존한다", () => {
  const f = fixture(); const before = [...f.stored].filter(([key]) => key !== create.storageKey);
  f.button.click(); f.button.click();
  assert.deepEqual([...f.stored].filter(([key]) => key !== create.storageKey), before);
  assert(f.writes.every(item => item.key === create.storageKey));
});
test("설정 저장이 차단되어도 기본 화면과 선택 버튼은 동작한다", () => {
  const f = fixture({ blocked: true }); assert.equal(f.controller.expanded(), true);
  assert.doesNotThrow(() => f.button.click()); assert.equal(f.controller.expanded(), false); assert.equal(f.main.style.gridTemplateRows, "");
  assert.doesNotThrow(() => f.button.click()); assert.equal(f.controller.expanded(), true);
});
test("너무 낮거나 알 수 없는 배치는 임의로 변경하지 않는다", () => {
  for (const rows of ["60px 24px 200px 228px", "auto auto", "repeat(4, 1fr)", ""]) {
    const f = fixture({ rows, saved: null });
    assert.equal(f.controller.expanded(), false); assert.equal(f.main.style.gridTemplateRows, "");
    assert.equal(f.writes.length, 0);
  }
  const resized = fixture(); resized.button.click(); resized.nativeRows("auto auto"); resized.window.dispatchEvent({ type: "resize" });
  assert.equal(resized.controller.expanded(), false); assert.equal(resized.main.style.gridTemplateRows, "");
  assert.equal(resized.attributes.size, 0); assert.equal(resized.classes.size, 0);
});
test("기존 인라인 배치가 있다면 해제할 때 정확히 복원한다", () => {
  const f = fixture({ inline: "132px 24px 480px 240px" }); f.button.click();
  assert.equal(f.main.style.gridTemplateRows, "96px 24px minmax(0, 1fr) 240px");
  f.button.click(); assert.equal(f.main.style.gridTemplateRows, "132px 24px 480px 240px");
});
test("중복 부팅과 제거 후 클릭은 이벤트나 저장을 중복 실행하지 않는다", () => {
  const f = fixture(); assert.equal(create({ document: f.document, window: f.window }), f.controller); assert.equal(f.buttons.length, 1);
  f.button.click(); f.controller.destroy(); assert.equal(f.main.style.gridTemplateRows, "");
  const writes = f.writes.length; f.button.click(); f.window.dispatchEvent({ type: "resize" });
  assert.equal(f.writes.length, writes); assert.equal(f.button.removed, true);
});
test("추가 스타일은 기존 글자·배율·화면 크기·런타임 로딩에 관여하지 않는다", () => {
  const css = fs.readFileSync(path.join(__dirname, "../styles/hunt-map-height.css"), "utf8"),
    source = fs.readFileSync(path.join(__dirname, "../src/hunt-map-height.js"), "utf8");
  assert.doesNotMatch(css, /\b(?:transform|zoom|grid-template-rows|height:\s*\d+vh|width:\s*\d+vw)\s*:/);
  assert.doesNotMatch(source, /iframe|createElement\(["']script|hunt-runtime|innerWidth|innerHeight|location\.href/);
  assert.match(css, /\.hunt-main \.map-height-toggle\s*\{[^}]*position:\s*absolute/s);
});
