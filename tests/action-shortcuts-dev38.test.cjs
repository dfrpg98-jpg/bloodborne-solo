"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const create = require("../src/hunt-keyboard-controls"), E = require("../src/hunt-engine");
const { Document, Element, boot } = require("./helpers/ui-harness.cjs");
const U = require("../src/hunt-map-controls"), W = require("../src/hunt-window-manager");
const storageKey = "bloodborne-hunt-v07";

function fixture(phase = "hunter") {
  const document = new Document('<html><body><div id="movementControls"></div><div id="hand"></div><div id="decisions"></div><div id="decisionActions"></div></body></html>');
  document.documentElement.dataset.phase = phase;
  const clicks = [], listeners = {}, add = (parent, attributes, label) => {
    const button = new Element(document, "button", attributes); button.parentElement = parent;
    if (attributes.id) document.ids.set(attributes.id, button);
    button.addEventListener("click", () => clicks.push(label)); parent.append(button); return button;
  }, window = { addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    removeEventListener(type, handler) { listeners[type] = (listeners[type] || []).filter(value => value !== handler); } };
  const api = create({ document, window }), dock = document.getElementById("decisionActions"),
    decisions = document.getElementById("decisions"), movement = document.getElementById("movementControls");
  const down = (key, properties = {}) => document.fire("keydown", { key, target: document.body, ...properties }),
    up = (key, properties = {}) => document.fire("keyup", { key, target: document.body, ...properties }),
    press = (key, properties = {}) => { const event = down(key, properties); up(key, properties); return event; },
    focus = button => { button.focus(); document.fire("focusin", { target: button }); };
  return { document, api, dock, decisions, movement, add, down, up, press, focus, clicks, listeners };
}
const badge = button => button.querySelectorAll("[data-action-shortcut]").filter(value => !value.hidden).map(value => value.textContent);

test("Space executes only the current official end-turn, stop-move or tile-placement control", () => {
  for (const [phase, type] of [["hunter", "END_TURN"], ["move", "STOP_MOVE"], ["tile_place", "PLACE_TILE"]]) {
    const f = fixture(phase), control = f.add(phase === "tile_place" ? f.decisions : f.dock,
      { "data-command": type, title: "공식 행동" }, type);
    f.add(f.dock, { "data-command": "CANCEL_MOVE" }, "CANCEL");
    f.api.refresh(); assert.deepEqual(badge(control), ["Space"]);
    assert.equal(control.getAttribute("aria-keyshortcuts"), "Space");
    assert.equal(f.press(" ", { code: "Space" }).defaultPrevented, true);
    assert.deepEqual(f.clicks, [type]);
    control.disabled = true; f.api.refresh(); f.press(" ", { code: "Space" });
    assert.deepEqual(f.clicks, [type]); assert.deepEqual(badge(control), []);
  }
});

test("a pending confirmation cannot fall through to end turn and waits for an enabled card selection", () => {
  const f = fixture(), confirm = f.add(f.dock, { id: "confirmHunterAction", disabled: "" }, "CONFIRM"),
    end = f.add(f.dock, { "data-command": "END_TURN" }, "END");
  f.focus(end); f.api.refresh();
  assert.equal(f.press(" ", { code: "Space", target: end }).defaultPrevented, true);
  assert.deepEqual(f.clicks, []); assert.deepEqual(badge(end), []); assert.deepEqual(badge(confirm), ["Space"]);
  assert.equal(confirm.getAttribute("aria-keyshortcuts"), "Space");
  const pendingBadge = confirm.querySelector("[data-action-shortcut]");
  confirm.disabled = false; f.api.refresh();
  assert.equal(confirm.querySelector("[data-action-shortcut]"), pendingBadge, "enabling confirmation preserves its existing shortcut hint");
  assert.deepEqual(badge(confirm), ["Space"]); f.press(" ", { code: "Space", target: end });
  assert.deepEqual(f.clicks, ["CONFIRM"]);
});

test("Escape and Backspace invoke actual cancellation controls and prevent browser navigation only for valid cancellation", () => {
  const f = fixture(), cancel = f.add(f.dock, { id: "cancelHunterAction", title: "선택 복원" }, "CANCEL");
  f.api.refresh(); assert.deepEqual(badge(cancel), ["Esc / Backspace"]);
  assert.equal(cancel.getAttribute("aria-keyshortcuts"), "Escape Backspace");
  for (const key of ["Escape", "Backspace"]) assert.equal(f.press(key).defaultPrevented, true);
  assert.deepEqual(f.clicks, ["CANCEL", "CANCEL"]);
  cancel.disabled = true; f.api.refresh();
  for (const key of ["Escape", "Backspace"]) assert.equal(f.press(key).defaultPrevented, false);
  assert.deepEqual(badge(cancel), []);
  f.document.documentElement.dataset.phase = "move";
  const movementCancel = f.add(f.dock, { "data-command": "CANCEL_MOVE" }, "CANCEL_MOVE");
  f.api.refresh(); f.press("Backspace"); assert.equal(f.clicks.at(-1), "CANCEL_MOVE");
  movementCancel.disabled = true; assert.equal(f.press("Backspace").defaultPrevented, false);
});

test("held execution and cancellation keys never chain through a synchronous rerender or a native keyup click", () => {
  const f = fixture(), confirm = f.add(f.dock, { id: "confirmHunterAction" }, "CONFIRM");
  confirm.addEventListener("click", () => {
    confirm.hidden = true; f.add(f.dock, { "data-command": "END_TURN" }, "END");
  });
  f.down(" ", { code: "Space", target: confirm });
  for (const properties of [{ repeat: true }, {}]) assert.equal(f.down(" ", { code: "Space", ...properties }).defaultPrevented, true);
  assert.equal(f.up(" ", { code: "Space" }).defaultPrevented, true);
  assert.deepEqual(f.clicks, ["CONFIRM"]);
  f.press(" ", { code: "Space" }); assert.deepEqual(f.clicks, ["CONFIRM", "END"]);
  const cancel = f.add(f.dock, { id: "cancelHunterAction" }, "CANCEL");
  cancel.addEventListener("click", () => { cancel.hidden = true; f.document.documentElement.dataset.phase = "move";
    f.add(f.dock, { "data-command": "CANCEL_MOVE" }, "CANCEL_MOVE"); });
  f.down("Escape"); f.down("Escape"); f.down("Escape", { repeat: true }); f.up("Escape");
  assert.deepEqual(f.clicks.slice(-1), ["CANCEL"]);
  f.press("Escape"); assert.equal(f.clicks.at(-1), "CANCEL_MOVE");
});

test("Space preserves unselected combat responses and tracks the explicitly focused official button", () => {
  const f = fixture("combat_react"), dodge = f.add(f.dock, { "data-command": "DODGE", disabled: "" }, "DODGE"),
    resolve = f.add(f.dock, { "data-command": "RESOLVE", class: "primary" }, "RESOLVE");
  f.api.refresh(); f.press(" ", { code: "Space" }); assert.deepEqual(f.clicks, []);
  assert.deepEqual(badge(dodge), []); assert.deepEqual(badge(resolve), []);
  f.focus(resolve); assert.deepEqual(badge(resolve), ["Space"]);
  f.press(" ", { code: "Space", target: resolve }); assert.deepEqual(f.clicks, ["RESOLVE"]);
  f.focus(f.document.body); dodge.disabled = false; f.api.refresh();
  assert.deepEqual(badge(dodge), ["Space"]); assert.deepEqual(badge(resolve), []);
  assert.equal(resolve.getAttribute("aria-keyshortcuts"), null);
  f.press(" ", { code: "Space" }); assert.equal(f.clicks.at(-1), "DODGE");
  const shot = f.add(f.dock, { "data-command": "WEAPON_SHOT" }, "SHOT");
  f.api.refresh(); f.press(" ", { code: "Space" }); assert.equal(f.clicks.length, 2, "two valid responses need an explicit focused choice");
  f.focus(shot); assert.deepEqual(badge(shot), ["Space"]); assert.deepEqual(badge(dodge), []);
  f.press(" ", { code: "Space" }); assert.equal(f.clicks.at(-1), "SHOT");
  const originalBadge = shot.querySelector("[data-action-shortcut]"); f.api.refresh(); f.api.refresh();
  assert.equal(shot.querySelector("[data-action-shortcut]"), originalBadge, "stable hints do not create observer mutation loops");
});

test("an unresolved combat Space consumes native keydown and keyup without changing a focused hand selection", () => {
  const f = fixture("combat_react"), hand = f.document.getElementById("hand"),
    card = f.add(hand, { "data-card": "card-1", "aria-pressed": "false" }, "CARD");
  card.addEventListener("click", () => card.setAttribute("aria-pressed", "true"));
  f.add(f.dock, { "data-command": "DODGE", disabled: "" }, "DODGE");
  f.add(f.dock, { "data-command": "RESOLVE" }, "RESOLVE");
  for (const target of [f.document.body, card]) {
    f.focus(target);
    assert.equal(f.down(" ", { code: "Space", target }).defaultPrevented, true);
    assert.equal(f.up(" ", { code: "Space", target }).defaultPrevented, true);
    assert.equal(card.getAttribute("aria-pressed"), "false"); assert.deepEqual(f.clicks, []);
  }
});

test("Shift+Space suppresses native gameplay-button activation without executing the focused end-turn action", () => {
  const f = fixture(), end = f.add(f.dock, { "data-command": "END_TURN" }, "END");
  f.focus(end);
  assert.equal(f.down(" ", { code: "Space", shiftKey: true, target: end }).defaultPrevented, true);
  assert.equal(f.up(" ", { code: "Space", shiftKey: true, target: end }).defaultPrevented, true);
  assert.deepEqual(f.clicks, []);
  for (const properties of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
    assert.equal(f.press(" ", { code: "Space", target: end, ...properties }).defaultPrevented, false);
  }
});

test("all official dock weapon responses require a focused choice when no unique selected attack exists", () => {
  for (const type of ["ENTRY_WEAPON", "WEAPON_CHOICE", "NO_ATTACK", "EXTRA_TAKE"]) {
    const f = fixture("weapon_entry"), a = f.add(f.dock, { "data-command": type }, "A"),
      b = f.add(f.dock, { "data-command": type }, "B");
    f.api.refresh(); f.press(" ", { code: "Space" }); assert.deepEqual(f.clicks, []);
    f.focus(b); assert.deepEqual(badge(a), []); assert.deepEqual(badge(b), ["Space"]);
    f.press(" ", { code: "Space", target: b }); assert.deepEqual(f.clicks, ["B"]);
    b.setAttribute("aria-disabled", "true"); f.api.refresh();
    f.press(" ", { code: "Space" }); assert.deepEqual(f.clicks, ["B"]);
  }
});

test("new action keys preserve modifier, repeat, editing, open-window and minimized-window guards", () => {
  const f = fixture(), confirm = f.add(f.dock, { id: "confirmHunterAction" }, "CONFIRM");
  f.add(f.dock, { id: "cancelHunterAction" }, "CANCEL");
  for (const key of [" ", "Escape", "Backspace"]) {
    for (const properties of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true },
      { repeat: true }, { defaultPrevented: true }, { isComposing: true }, { keyCode: 229 }]) f.press(key, properties);
    for (const tag of ["input", "select", "textarea"]) {
      const input = new Element(f.document, tag); f.press(key, { target: input });
      f.document.activeElement = input; f.press(key); f.document.activeElement = f.document.body;
    }
    const editor = new Element(f.document, "div", { contenteditable: "plaintext-only" }), child = new Element(f.document, "span");
    child.parentElement = editor; f.press(key, { target: child });
    const dialog = new Element(f.document, "dialog"); f.document.elements.push(dialog);
    dialog.open = true; f.press(key); dialog.open = false;
    dialog.setAttribute("data-window-minimized", "true"); f.press(key); dialog.removeAttribute("data-window-minimized");
  }
  assert.deepEqual(f.clicks, []);
  for (const modify of [() => { confirm.hidden = true; }, () => { confirm.isConnected = false; },
    () => { confirm.getClientRects = () => []; }, () => { f.dock.setAttribute("inert", ""); }]) {
    modify(); f.press(" ", { code: "Space" });
  }
  assert.deepEqual(f.clicks, []);
});

function initial(target = false) {
  return E.create(90, target ? "burial" : "beast-claw", 0, null, "hunter-pistol", "center",
    target ? { campaign: false, rulesVersion: 14, practiceTarget: "male-beast-patient", practiceSide: "b" } :
      { campaign: true, rulesVersion: 13 });
}
function launch(state, options = {}) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [storageKey]: E.exportSave(state) }, engine: { ...E, applyChapelRuling: value => value,
      applyCombatReactionRuling: value => value, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value },
    window: { BBHuntMapControls: U, ...(options.windows ? { BBHuntWindowManager: W } : {}) } });
  ui.keyboard = create({ document: ui.document, window: ui.window });
  ui.down = (key, properties = {}) => ui.document.fire("keydown", { key, target: ui.document.body, ...properties });
  ui.up = (key, properties = {}) => ui.document.fire("keyup", { key, target: ui.document.body, ...properties });
  ui.press = (key, properties = {}) => { const event = ui.down(key, properties); ui.up(key, properties); return event; };
  return ui;
}
const saved = ui => { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(storageKey)); };
const intent = (ui, type) => ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]").find(button => button.dataset.hunterIntent === type);
const publicCommand = button => ({ type: button.dataset.command, ...JSON.parse(button.dataset.args || "{}") });
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const checkpoint = count => commands.slice(0, count).reduce((state, command) => E.dispatch(state, command), initial());

test("actual staged MOVE, TRANSFORM, DREAM and ATTACK use Space once with the selected public command", () => {
  for (const type of ["MOVE", "TRANSFORM", "DREAM", "ATTACK"]) {
    const state = initial(type === "ATTACK"), ui = launch(state), before = ui.storage.get(storageKey);
    if (type === "ATTACK") ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === state.enemies[0].id).click();
    intent(ui, type).click(); assert.equal(ui.el("confirmHunterAction").disabled, true);
    ui.keyboard.refresh(); assert.deepEqual(badge(ui.el("confirmHunterAction")), ["Space"]);
    ui.press(" ", { code: "Space" }); assert.equal(ui.storage.get(storageKey), before);
    ui.press("1", { code: "Digit1" }); ui.keyboard.refresh();
    const confirm = ui.el("confirmHunterAction"), command = publicCommand(confirm), expected = E.dispatch(state, command);
    assert.equal(confirm.disabled, false); assert.deepEqual(badge(confirm), ["Space"]);
    ui.down(" ", { code: "Space", target: confirm });
    ui.down(" ", { code: "Space", repeat: true }); ui.down(" ", { code: "Space" });
    assert.equal(ui.up(" ", { code: "Space" }).defaultPrevented, true);
    assert.deepEqual(saved(ui), expected); assert.equal(saved(ui).revision, state.revision + 1);
  }
});

test("actual Esc/Backspace restore an intent without saving or spending the chosen card", () => {
  for (const key of ["Escape", "Backspace"]) {
    const state = initial(), ui = launch(state), before = ui.storage.get(storageKey);
    ui.press("2", { code: "Digit2" }); intent(ui, "TRANSFORM").click();
    ui.press("1", { code: "Digit1" }); assert.equal(ui.el("confirmHunterAction").disabled, false);
    ui.keyboard.refresh(); assert.deepEqual(badge(ui.el("cancelHunterAction")), ["Esc / Backspace"]);
    assert.equal(ui.press(key).defaultPrevented, true); assert.equal(ui.storage.get(storageKey), before);
    assert.equal(ui.el("phaseTitle").textContent, "플레이어의 차례");
    assert.equal(ui.el("hand").querySelectorAll("[data-card]")[1].getAttribute("aria-pressed"), "true");
  }
});

test("actual END_TURN, STOP_MOVE and PLACE_TILE keyboard execution matches the same clicked reducer commands", () => {
  for (const [state, type] of [[initial(), "END_TURN"], [checkpoint(3), "STOP_MOVE"], [checkpoint(2), "PLACE_TILE"]]) {
    const ui = launch(state), host = type === "PLACE_TILE" ? "decisions" : "decisionActions",
      button = ui.el(host).querySelectorAll("[data-command]").find(value => value.dataset.command === type && !value.disabled);
    assert(button); const command = publicCommand(button), expected = E.dispatch(state, command);
    ui.press(" ", { code: "Space" }); assert.deepEqual(saved(ui), expected);
  }
});

test("a current unspent movement declaration cancels through Backspace and never pays a card", () => {
  const state = E.applyMovementDeclarationRuling(initial()), cardId = E.hunter(state).hand[0].id,
    declared = E.dispatch(state, { type: "MOVE", cardId }), ui = launch(declared);
  assert.equal(declared.move.costPending, true); assert.equal(E.canStopMove(declared), false);
  const before = ui.storage.get(storageKey); ui.press(" ", { code: "Space" }); assert.equal(ui.storage.get(storageKey), before);
  ui.press("Backspace"); assert.deepEqual(saved(ui), E.dispatch(declared, { type: "CANCEL_MOVE" }));
  assert.deepEqual(E.hunter(saved(ui)), E.hunter(state));
});

test("actual combat Space leaves a legal dodge choice open, executes a selected dodge and then a focused resolution", () => {
  const state = checkpoint(6), ui = launch(state), before = ui.storage.get(storageKey);
  assert.equal(state.phase, "combat_react"); ui.press(" ", { code: "Space" });
  assert.equal(ui.storage.get(storageKey), before, "Space cannot silently decline an unselected legal response");
  const card = E.hunter(state).hand.find(card => E.canDodge(state, card.id, 0)); assert(card);
  ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === card.id).click();
  ui.el("slots").querySelectorAll("[data-slot]").find(button => +button.dataset.slot === 0).click(); ui.keyboard.refresh();
  const dodge = ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === "DODGE");
  assert.deepEqual(badge(dodge), ["Space"]); const dodged = E.dispatch(state, publicCommand(dodge));
  ui.down(" ", { code: "Space" }); ui.down(" ", { code: "Space", repeat: true }); ui.up(" ", { code: "Space" });
  assert.deepEqual(saved(ui), dodged);
  const resolve = ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === "RESOLVE");
  resolve.focus(); ui.document.fire("focusin", { target: resolve }); assert.deepEqual(badge(resolve), ["Space"]);
  ui.press(" ", { code: "Space", target: resolve }); assert.deepEqual(saved(ui), E.dispatch(dodged, { type: "RESOLVE" }));
});

test("actual unresolved combat hand focus and Shift+Space end-turn focus preserve both selection and the exact save", () => {
  const combat = launch(checkpoint(6)), card = combat.el("hand").querySelectorAll("[data-card]")[0],
    combatSave = combat.storage.get(storageKey), selected = card.getAttribute("aria-pressed");
  card.focus();
  assert.equal(combat.down(" ", { code: "Space", target: card }).defaultPrevented, true);
  assert.equal(combat.up(" ", { code: "Space", target: card }).defaultPrevented, true);
  assert.equal(card.getAttribute("aria-pressed"), selected); assert.equal(combat.storage.get(storageKey), combatSave);
  const hunter = launch(initial()), end = hunter.el("decisionActions").querySelectorAll("[data-command]")
    .find(button => button.dataset.command === "END_TURN"), hunterSave = hunter.storage.get(storageKey);
  end.focus();
  assert.equal(hunter.down(" ", { code: "Space", shiftKey: true, target: end }).defaultPrevented, true);
  assert.equal(hunter.up(" ", { code: "Space", shiftKey: true, target: end }).defaultPrevented, true);
  assert.equal(hunter.storage.get(storageKey), hunterSave); assert.equal(saved(hunter).phase, "hunter");
});

test("Escape retains the existing window minimization behavior and cannot cancel the action beneath a minimized window", () => {
  const state = initial(), ui = launch(state, { windows: true }), before = ui.storage.get(storageKey);
  intent(ui, "MOVE").click(); ui.el("infoDialog").showModal();
  ui.press("Escape"); assert.equal(ui.el("infoDialog").getAttribute("data-window-minimized"), "true");
  assert.equal(ui.el("phaseTitle").textContent, "행동하기"); ui.press("Escape"); ui.press("Backspace"); ui.press(" ", { code: "Space" });
  assert.equal(ui.el("phaseTitle").textContent, "행동하기"); assert.equal(ui.storage.get(storageKey), before);
});
