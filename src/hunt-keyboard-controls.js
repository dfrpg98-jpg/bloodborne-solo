(function (root, factory) {
  "use strict";
  const create = factory();
  if (typeof module === "object" && module.exports) module.exports = create;
  else {
    root.BBHuntKeyboardControls = create;
    const start = () => create({ document: root.document, window: root });
    if (root.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const instances = new WeakMap();
  const shortcuts = { NW: "Numpad7", N: "ArrowUp Numpad8", NE: "Numpad9", W: "ArrowLeft Numpad4", E: "ArrowRight Numpad6", SW: "Numpad1", S: "ArrowDown Numpad2", SE: "Numpad3" };
  const directions = { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W" };
  const numpad = { Numpad7: "NW", Numpad8: "N", Numpad9: "NE", Numpad4: "W", Numpad6: "E", Numpad1: "SW", Numpad2: "S", Numpad3: "SE" };
  const hunterShortcuts = { Q: "MOVE", E: "DREAM", Z: "TRANSFORM", C: "ATTACK" };
  function actionKey(event) {
    if (event.location === 3 || /^Numpad/.test(event.code || "")) return null;
    const letter = /^Key[A-Z]$/.test(event.code || "") ? event.code.slice(3) : String(event.key || "").toUpperCase();
    return hunterShortcuts[letter] ? letter : null;
  }
  function editable(element) {
    for (let current = element?.nodeType === 3 ? element.parentElement : element; current; current = current.parentElement) {
      if (/^(input|select|textarea)$/i.test(current.tagName || "") || current.isContentEditable) return true;
      const value = current.getAttribute?.("contenteditable");
      if (value !== null && value !== undefined && value !== "false") return true;
    }
    return false;
  }
  function visible(button) {
    if (!button || button.hidden || button.isConnected === false) return false;
    for (let current = button; current; current = current.parentElement)
      if (current.hidden || current.hasAttribute?.("inert")) return false;
    return !button.getClientRects || button.getClientRects().length > 0;
  }
  function available(button) {
    return visible(button) && !button.disabled && button.getAttribute?.("aria-disabled") !== "true";
  }
  function create({ document, window }) {
    if (!document || !window) return null;
    if (instances.has(document)) return instances.get(document);
    const controls = document.getElementById("movementControls"), hand = document.getElementById("hand");
    if (!controls) return null;
    let destroyed = false;
    const hints = new WeakMap(), held = new Set(), actionHints = new Set();
    function annotate(button, keys) {
      if (!hints.has(button)) hints.set(button, { title: button.getAttribute("title"), keys: button.getAttribute("aria-keyshortcuts") });
      const title = hints.get(button).title || "";
      button.setAttribute("title", `${title}${title ? " · " : ""}단축키 ${keys}`);
      button.setAttribute("aria-keyshortcuts", keys);
    }
    function clearHint(button) {
      const original = hints.get(button);
      if (!original) return;
      for (const [attribute, value] of [["title", original.title], ["aria-keyshortcuts", original.keys]])
        value === null ? button.removeAttribute(attribute) : button.setAttribute(attribute, value);
    }
    function keyBadge(button, marker, className, key) {
      let badge = button.querySelector(`[${marker}]`);
      if (!badge && key) {
        badge = document.createElement("kbd");
        badge.setAttribute(marker, ""); badge.setAttribute("class", className); badge.setAttribute("aria-hidden", "true");
        button.append(badge);
      }
      if (!badge) return;
      // Only change text when numbering changes, so the child observer settles.
      if (badge.textContent !== (key || "")) badge.textContent = key || "";
      badge.hidden = !key;
    }
    function orderedHand() {
      return [...hand?.querySelectorAll("[data-card]") || []].filter(visible)
        .map((button, index) => ({ button, index, rect: button.getBoundingClientRect?.() || {} }))
        .sort((a, b) => ((a.rect.top || 0) - (b.rect.top || 0)) || ((a.rect.left || 0) - (b.rect.left || 0)) || a.index - b.index)
        .map(entry => entry.button);
    }
    function dockActions() {
      const dock = document.getElementById("decisionActions");
      return [...dock?.querySelectorAll("button") || []].filter(button =>
        visible(button) && (button.hasAttribute("data-command") ||
          ["confirmHunterAction", "refill", "startNextChapter"].includes(button.id || button.getAttribute("id"))));
    }
    function cancelAction() {
      const cancel = document.getElementById("cancelHunterAction");
      if (available(cancel)) return cancel;
      if (document.documentElement?.dataset.phase !== "move") return null;
      return [...dockActions(), ...controls.querySelectorAll("[data-command]")]
        .find(button => button.dataset.command === "CANCEL_MOVE" && available(button)) || null;
    }
    function hunterAction(type) {
      const phase = document.documentElement?.dataset.phase;
      if (type === "MOVE" && phase === "move")
        return [...dockActions(), ...controls.querySelectorAll("[data-command]")]
          .find(button => button.dataset.command === "STOP_MOVE" && available(button)) || null;
      if (phase !== "hunter") return null;
      const bar = document.getElementById("hunterActionBar");
      if (bar) return [...bar.querySelectorAll("[data-hunter-intent]")]
        .find(button => button.dataset.hunterIntent === type && available(button)) || null;
      // Keep the standalone movement controller usable without an action bar.
      return type === "MOVE" ? [...controls.querySelectorAll("[data-command]")]
        .find(button => button.dataset.command === "MOVE" && available(button)) || null : null;
    }
    function primaryAction() {
      const phase = document.documentElement?.dataset.phase,
        confirm = document.getElementById("confirmHunterAction");
      // A pending action must never fall through to ending the turn when its
      // chosen card or slot is still missing.
      if (visible(confirm)) return available(confirm) ? confirm : null;
      if (phase === "refill") {
        const refill = document.getElementById("refill");
        return available(refill) ? refill : null;
      }
      const actions = phase === "tile_place" ?
        [...document.getElementById("decisions")?.querySelectorAll("[data-command]") || []]
          .filter(button => button.dataset.command === "PLACE_TILE" && visible(button)) :
        dockActions().filter(button => button.dataset.command !== "CANCEL_MOVE" &&
          (button.id || button.getAttribute("id")) !== "refill"),
        enabled = actions.filter(available), focused = enabled.find(button => button.contains?.(document.activeElement));
      if (focused) return focused;
      if (phase === "tile_place") return enabled.length === 1 ? enabled[0] : null;
      const fixed = phase === "hunter" ? "END_TURN" : phase === "move" ? "STOP_MOVE" : null;
      if (fixed) return enabled.find(button => button.dataset.command === fixed) || null;
      // Execute a selected, enabled response rather than the adjacent button
      // that declines it. Other choices need an explicit focused control.
      const responses = enabled.filter(button => ["ATTACK", "COUNTER", "DODGE", "EXTRA_DODGE", "WEAPON_SHOT"].includes(button.dataset.command));
      if (responses.length === 1) return responses[0];
      // A lone continuation with no response controls is unambiguous. A
      // disabled dodge/counter still represents a choice the player may be
      // preparing, so do not bypass it based on the current selection alone.
      return actions.length === 1 && enabled.length === 1 && ["RESOLVE", "EXTRA_TAKE"].includes(enabled[0].dataset.command) ? enabled[0] : null;
    }
    function showActionHint(button, keys, label) {
      if (!button) return;
      actionHints.add(button); annotate(button, keys);
      const refill = (button.id || button.getAttribute("id")) === "refill";
      keyBadge(button, refill ? "data-refill-shortcut" : "data-action-shortcut",
        refill ? "refill-shortcut-key" : "action-shortcut-key", label);
    }
    function refresh() {
      if (destroyed) return;
      // Keep the pending action's discoverable shortcut while it waits for a
      // card. Execution still uses primaryAction's enabled-state guard.
      const confirm = document.getElementById("confirmHunterAction"),
        primary = visible(confirm) ? confirm : primaryAction(), cancel = cancelAction();
      for (const button of actionHints) {
        if (button === primary || button === cancel) continue;
        clearHint(button);
        keyBadge(button, "data-action-shortcut", "action-shortcut-key", "");
        keyBadge(button, "data-refill-shortcut", "refill-shortcut-key", "");
      }
      actionHints.clear();
      for (const button of controls.querySelectorAll("[data-command]"))
        if (["MOVE", "STOP_MOVE"].includes(button.dataset.command)) annotate(button, button.dataset.command === "MOVE" ? "Q Numpad5" : "Q");
      for (const button of document.getElementById("hunterActionBar")?.querySelectorAll("[data-hunter-intent]") || []) {
        const key = Object.keys(hunterShortcuts).find(key => hunterShortcuts[key] === button.dataset.hunterIntent);
        if (key) annotate(button, key);
      }
      for (const button of controls.querySelectorAll("[data-move-direction]")) {
        const keys = shortcuts[button.dataset.moveDirection];
        if (keys) annotate(button, keys);
      }
      const cards = orderedHand().slice(0, 9);
      for (const button of hand?.querySelectorAll("[data-card]") || []) {
        const index = cards.indexOf(button);
        index < 0 ? clearHint(button) : annotate(button, String(index + 1));
        keyBadge(button, "data-hand-shortcut", "hand-shortcut-key", index < 0 ? "" : String(index + 1));
      }
      showActionHint(primary, "Space", "Space");
      showActionHint(cancel, "Escape Backspace", "Esc / Backspace");
    }
    function windowOpen() {
      return [...document.querySelectorAll("dialog")].some(dialog => dialog.open || dialog.hasAttribute("open")) ||
        [...document.querySelectorAll("[data-window-minimized]")].some(element => element.dataset.windowMinimized === "true" || element.getAttribute("data-window-minimized") === "true");
    }
    function gameplayArea(element) {
      if (!element) return false;
      if (element === document.body || element === document.documentElement) return true;
      return [hand, controls, ...["decisions", "decisionActions", "hunterActionBar", "mapViewport", "combatSelection"]
        .map(id => document.getElementById(id))].some(host => host?.contains?.(element));
    }
    function gameplayButton(element) {
      for (let current = element?.nodeType === 3 ? element.parentElement : element; current; current = current.parentElement)
        if ((current.tagName || "").toLowerCase() === "button") return gameplayArea(current);
      return false;
    }
    function consumeSpace(event) { held.add("Space"); event.preventDefault(); }
    function keydown(event) {
      const space = event.key === " " || event.key === "Spacebar" || event.code === "Space";
      const shortcut = actionKey(event), heldKey = space ? "Space" : shortcut ? `Key${shortcut}` : ["Escape", "Backspace"].includes(event.key) ? event.key : null;
      if (!destroyed && held.has(heldKey)) { event.preventDefault(); return; }
      if (destroyed || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
          event.isComposing || event.keyCode === 229 || editable(event.target) || editable(document.activeElement) || windowOpen()) return;
      const key = String(event.key || ""), phase = document.documentElement?.dataset.phase;
      let button;
      if (space) {
        if (event.shiftKey) {
          // Shift+Space is not an action shortcut. Also suppress the native
          // keyup click when a gameplay button owns the keyboard focus.
          if (gameplayButton(event.target) || gameplayButton(document.activeElement)) consumeSpace(event);
          return;
        }
        button = primaryAction();
      } else if (["Escape", "Backspace"].includes(key)) {
        if (event.shiftKey) return;
        button = cancelAction();
      } else if (/^Numpad/.test(event.code || "") || event.location === 3) {
        // Keypad navigation with NumLock off must never fall through to arrows or hand selection.
        const code = String(event.code || "");
        if (event.shiftKey || event.getModifierState?.("NumLock") !== true || !/^Numpad[1-9]$/.test(code) || key !== code.slice(6)) return;
        if (code === "Numpad5" && phase === "hunter")
          button = [...controls.querySelectorAll("[data-command]")].find(element => element.dataset.command === "MOVE" && available(element));
        else if (phase === "move" && numpad[code])
          button = [...controls.querySelectorAll("[data-move-direction]")].find(element => element.dataset.moveDirection === numpad[code] && available(element));
      } else if (/^[1-9]$/.test(key)) {
        if (event.shiftKey) return;
        const card = orderedHand()[Number(key) - 1];
        if (available(card)) button = card;
      } else if (shortcut) {
        if (event.shiftKey) return;
        button = hunterAction(hunterShortcuts[shortcut]);
      } else if (phase === "move") {
        const direction = directions[key];
        if (direction) button = [...controls.querySelectorAll("[data-move-direction]")].find(element => element.dataset.moveDirection === direction && available(element));
      }
      if (!button) {
        // An unselected combat response or disabled confirmation is a no-op,
        // not permission for a focused hand button's native keyup click.
        if (space && (gameplayArea(event.target) || gameplayArea(document.activeElement))) consumeSpace(event);
        return;
      }
      // 기존 버튼을 거치므로 비용, 확인 창, 목적지 선택과 입력 차단을 그대로 따릅니다.
      event.preventDefault();
      if (heldKey) held.add(heldKey);
      button.click();
      refresh();
    }
    function keyup(event) {
      const shortcut = actionKey(event),
        key = event.key === " " || event.key === "Spacebar" || event.code === "Space" ? "Space" : shortcut ? `Key${shortcut}` : event.key;
      if (held.delete(key)) event.preventDefault();
    }
    function blur() { held.clear(); }
    const observer = typeof window.MutationObserver === "function" ? new window.MutationObserver(refresh) : null;
    observer?.observe(controls, { childList: true, subtree: true });
    if (hand) observer?.observe(hand, { childList: true, subtree: true });
    for (const id of ["decisions", "decisionActions", "hunterActionBar"]) {
      const host = document.getElementById(id); if (host) observer?.observe(host, { childList: true, subtree: true });
    }
    const api = { refresh, destroy() {
      if (destroyed) return;
      destroyed = true; observer?.disconnect(); document.removeEventListener?.("keydown", keydown); document.removeEventListener?.("keyup", keyup);
      document.removeEventListener?.("focusin", refresh);
      window.removeEventListener?.("resize", refresh); window.removeEventListener?.("blur", blur); instances.delete(document);
    } };
    instances.set(document, api); document.addEventListener("keydown", keydown); document.addEventListener("keyup", keyup);
    document.addEventListener("focusin", refresh);
    window.addEventListener?.("resize", refresh); window.addEventListener?.("blur", blur); refresh();
    return api;
  }
  return create;
});
