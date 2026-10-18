"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const create = require("../src/hunt-keyboard-controls");
const { Document, Element, boot } = require("./helpers/ui-harness.cjs");
const E = require("../src/hunt-engine");

function fixture(phase = "refill", count = 3) {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div><div id="decisions"></div><div id="decisionActions"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const clicks = [], listeners = {}, observed = [];
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe(element) { observed.push(element); }
    disconnect() {}
  }
  const window = { MutationObserver: Observer,
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    removeEventListener(type, callback) { listeners[type] = (listeners[type] || []).filter(handler => handler !== callback); },
  };
  const hand = document.getElementById("hand"), dock = document.getElementById("decisionActions");
  const add = (parent, attributes, label) => {
    const button = new Element(document, "button", attributes); button.parentElement = parent;
    if (attributes.id) document.ids.set(attributes.id, button);
    button.addEventListener("click", () => clicks.push(label)); parent.append(button); return button;
  };
  const cards = Array.from({ length: count }, (_, index) => add(hand, { "data-card": `c${index + 1}`, title: `카드${index + 1} 효과`, "aria-label": `카드${index + 1} 효과` }, `c${index + 1}`));
  const refill = add(dock, { id: "refill", title: "남은 손패를 보충" }, "REFILL");
  const api = create({ document, window });
  const key = (key, properties = {}) => document.fire("keydown", { key, target: document.body, ...properties });
  const up = (properties = {}) => document.fire("keyup", { key: " ", code: "Space", target: document.body, ...properties });
  const windowEvent = type => { for (const handler of listeners[type] || []) handler(); };
  return { document, window, hand, dock, cards, refill, api, key, up, clicks, add, windowEvent, observed, listeners };
}
const visibleBadges = button => button.querySelectorAll("[data-hand-shortcut]").filter(badge => !badge.hidden);

test("Space는 보충 단계의 실제 손패 보충 버튼을 한 번만 누르고 키를 떼는 기본 동작도 막습니다", () => {
  const f = fixture(), other = f.add(f.dock, { "data-command": "END_TURN" }, "OTHER");
  other.focus();
  assert.equal(f.key(" ", { code: "Space", target: other }).defaultPrevented, true);
  f.document.documentElement.dataset.phase = "hunter";
  assert.equal(f.key(" ", { code: "Space", repeat: true, target: other }).defaultPrevented, true);
  assert.equal(f.key(" ", { code: "Space", target: other }).defaultPrevented, true);
  assert.equal(f.up({ target: other }).defaultPrevented, true);
  assert.deepEqual(f.clicks, ["REFILL"]);
  // Once released, Space belongs to normal focused controls outside refill.
  assert.equal(f.key(" ", { code: "Space", target: other }).defaultPrevented, false);
  assert.equal(f.up({ target: other }).defaultPrevented, false);
  assert.deepEqual(f.clicks, ["REFILL"]);
});

test("보충 Space는 수정키·IME·반복·입력란·열린 창과 최소화된 창을 보호합니다", () => {
  const f = fixture();
  for (const properties of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }]) {
    f.key(" ", { code: "Space", ...properties });
  }
  for (const tag of ["input", "select", "textarea"]) {
    const input = new Element(f.document, tag);
    f.key(" ", { target: input }); f.document.activeElement = input; f.key(" "); f.document.activeElement = f.document.body;
  }
  const editor = new Element(f.document, "div", { contenteditable: "true" }), child = new Element(f.document, "span");
  child.parentElement = editor; f.key(" ", { target: child });
  const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog);
  dialog.open = true; f.key(" "); dialog.open = false;
  dialog.setAttribute("data-window-minimized", "true"); f.key(" "); dialog.removeAttribute("data-window-minimized");
  assert.deepEqual(f.clicks, []);
  f.key(" "); assert.deepEqual(f.clicks, ["REFILL"]); f.up();
});

test("Space는 다른 단계와 비활성·숨김·분리된 보충 버튼에서 명령을 만들지 않습니다", () => {
  const f = fixture();
  for (const phase of ["hunter", "move", "activation", "combat_react", "won"]) {
    f.document.documentElement.dataset.phase = phase; assert.equal(f.key(" ", { code: "Space" }).defaultPrevented, false);
  }
  f.document.documentElement.dataset.phase = "refill";
  for (const modify of [
    () => { f.refill.disabled = true; return () => { f.refill.disabled = false; }; },
    () => { f.refill.hidden = true; return () => { f.refill.hidden = false; }; },
    () => { f.refill.setAttribute("aria-disabled", "true"); return () => f.refill.removeAttribute("aria-disabled"); },
    () => { f.refill.isConnected = false; return () => { delete f.refill.isConnected; }; },
    () => { f.refill.getClientRects = () => []; return () => { delete f.refill.getClientRects; }; },
    () => { f.dock.hidden = true; return () => { f.dock.hidden = false; }; },
    () => { f.dock.setAttribute("inert", ""); return () => f.dock.removeAttribute("inert"); },
  ]) {
    const restore = modify(); assert.equal(f.key(" ", { code: "Space" }).defaultPrevented, false); restore();
  }
  f.document.ids.delete("refill"); f.key(" "); assert.deepEqual(f.clicks, []);
});

test("각 카드에 화면 순서대로 1~9 배지만 보이며 기존 효과와 접근 가능한 이름을 유지합니다", () => {
  const f = fixture("hunter", 12);
  f.cards.forEach((card, index) => { card._rect = { top: Math.floor(index / 4) * 100, left: index % 4 * 100 }; });
  [f.cards[0]._rect, f.cards[3]._rect] = [f.cards[3]._rect, f.cards[0]._rect]; f.api.refresh();
  const ordered = [f.cards[3], f.cards[1], f.cards[2], f.cards[0], ...f.cards.slice(4)];
  for (const [index, card] of ordered.entries()) {
    assert.equal(card.getAttribute("aria-label"), `카드${f.cards.indexOf(card) + 1} 효과`);
    if (index < 9) {
      const badges = visibleBadges(card); assert.equal(badges.length, 1); assert.equal(badges[0].textContent, String(index + 1));
      assert.equal(badges[0].getAttribute("aria-hidden"), "true");
      assert.equal(card.getAttribute("aria-keyshortcuts"), String(index + 1));
      f.key(String(index + 1)); assert.equal(f.clicks.at(-1), card.dataset.card);
    } else { assert.equal(visibleBadges(card).length, 0); assert.equal(card.getAttribute("aria-keyshortcuts"), null); }
  }
});

test("소모·재렌더·크기 변경 후 배지 번호와 선택 대상이 함께 바뀌고 갱신 시 자식을 다시 만들지 않습니다", () => {
  const f = fixture("hunter", 10), first = f.cards[0], firstBadge = visibleBadges(first)[0];
  f.api.refresh(); f.api.refresh(); assert.equal(visibleBadges(first)[0], firstBadge); assert.equal(first.children.length, 1);
  f.hand.children.push(f.hand.children.shift()); f.api.refresh();
  assert.equal(visibleBadges(first).length, 0); assert.equal(first.getAttribute("title"), "카드1 효과");
  f.hand.children.shift(); f.api.refresh(); assert.equal(visibleBadges(first)[0].textContent, "9");
  f.cards[2]._rect = { top: 100, left: 0 }; f.cards[3]._rect = { top: 0, left: 0 }; f.windowEvent("resize");
  assert.equal(visibleBadges(f.cards[3])[0].textContent, "1"); f.key("1"); assert.equal(f.clicks.at(-1), "c4");
  f.hand.innerHTML = '<button data-card="new" title="새 효과" aria-label="새 효과"></button>'; f.api.refresh();
  const next = f.hand.querySelectorAll("[data-card]")[0]; assert.equal(visibleBadges(next)[0].textContent, "1");
  assert.equal(next.getAttribute("aria-label"), "새 효과"); assert.equal(next.getAttribute("title"), "새 효과 · 단축키 1");
});

test("보충 단축키 안내는 동적 영역을 감시하고 배지·기존 설명을 중복하지 않으며 해제 후 입력을 멈춥니다", () => {
  const f = fixture(); f.api.refresh(); f.api.refresh();
  assert.deepEqual(f.observed.map(element => element.getAttribute("id")), ["movementControls", "hand", "decisions", "decisionActions"]);
  assert.equal(f.refill.getAttribute("aria-keyshortcuts"), "Space");
  assert.equal(f.refill.getAttribute("title"), "남은 손패를 보충 · 단축키 Space");
  assert.equal(f.refill.querySelectorAll("[data-refill-shortcut]").length, 1);
  assert.equal(f.refill.querySelector("[data-refill-shortcut]").textContent, "Space");
  f.key(" "); f.windowEvent("blur"); assert.equal(f.up().defaultPrevented, false);
  f.api.destroy(); f.api.destroy(); f.key(" "); f.key("1"); assert.deepEqual(f.clicks, ["REFILL"]);
  assert.equal(f.listeners.resize.length, 0); assert.equal(f.listeners.blur.length, 0);
});

test("실제 REFILL은 Space와 클릭이 동일한 버리기 선택과 저장 결과를 만들며 한 번만 처리합니다", () => {
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  for (const command of require("./fixtures/weapon-campaign-completion/beast-claw-0.json").slice(0, 7)) state = E.dispatch(state, command);
  assert.equal(state.phase, "refill");
  const storageKey = "bloodborne-hunt-v07";
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { storage: { [storageKey]: E.exportSave(state) }, engine: {
    ...E, applyTileSpeedRuling: value => value, applyChapelRuling: value => value, applyCombatReactionRuling: value => value,
  } });
  const selected = ui.el("decisions").querySelectorAll("[data-refill]").slice(0, 1);
  for (const input of selected) input.checked = true;
  const expected = E.dispatch(state, { type: "REFILL", discardIds: selected.map(input => input.dataset.refill) });
  const before = ui.storage.get(storageKey);
  create({ document: ui.document, window: ui.window }); assert.equal(ui.storage.get(storageKey), before);
  ui.document.fire("keydown", { key: " ", code: "Space", target: ui.document.body });
  ui.document.fire("keydown", { key: " ", code: "Space", repeat: true, target: ui.document.body });
  ui.document.fire("keyup", { key: " ", code: "Space", target: ui.document.body });
  assert.equal(ui.el("error").textContent, "");
  const actual = E.importSave(ui.storage.get(storageKey)); assert.deepEqual(actual, expected);
  assert.equal(actual.commands.length, state.commands.length + 1); assert.equal(actual.commands.at(-1).type, "REFILL");
});
