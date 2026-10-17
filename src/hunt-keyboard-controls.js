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
  const shortcuts = { N: "ArrowUp W", E: "ArrowRight D", S: "ArrowDown S", W: "ArrowLeft A" };
  const directions = { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W", w: "N", d: "E", s: "S", a: "W" };
  const physical = { KeyW: "N", KeyD: "E", KeyS: "S", KeyA: "W" };
  function editable(element) {
    for (let current = element?.nodeType === 3 ? element.parentElement : element; current; current = current.parentElement) {
      if (/^(input|select|textarea)$/i.test(current.tagName || "") || current.isContentEditable) return true;
      const value = current.getAttribute?.("contenteditable");
      if (value !== null && value !== undefined && value !== "false") return true;
    }
    return false;
  }
  function available(button) {
    if (!button || button.disabled || button.hidden || button.isConnected === false || button.getAttribute?.("aria-disabled") === "true") return false;
    for (let current = button; current; current = current.parentElement)
      if (current.hidden || current.hasAttribute?.("inert")) return false;
    return !button.getClientRects || button.getClientRects().length > 0;
  }
  function create({ document, window }) {
    if (!document || !window) return null;
    if (instances.has(document)) return instances.get(document);
    const controls = document.getElementById("movementControls");
    if (!controls) return null;
    let destroyed = false;
    const titles = new WeakMap();
    function annotate(button, keys) {
      if (!titles.has(button)) titles.set(button, button.getAttribute("title") || "");
      const title = titles.get(button);
      button.setAttribute("title", `${title}${title ? " · " : ""}단축키 ${keys}`);
      button.setAttribute("aria-keyshortcuts", keys);
    }
    function refresh() {
      if (destroyed) return;
      for (const button of controls.querySelectorAll("[data-command]"))
        if (["MOVE", "STOP_MOVE"].includes(button.dataset.command)) annotate(button, "M");
      for (const button of controls.querySelectorAll("[data-move-direction]")) {
        const keys = shortcuts[button.dataset.moveDirection];
        if (keys) annotate(button, keys);
      }
    }
    function windowOpen() {
      return [...document.querySelectorAll("dialog")].some(dialog => dialog.open || dialog.hasAttribute("open")) ||
        [...document.querySelectorAll("[data-window-minimized]")].some(element => element.dataset.windowMinimized === "true" || element.getAttribute("data-window-minimized") === "true");
    }
    function keydown(event) {
      if (destroyed || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
          event.isComposing || event.keyCode === 229 || editable(event.target) || editable(document.activeElement) || windowOpen()) return;
      const key = String(event.key || ""), phase = document.documentElement?.dataset.phase;
      let button;
      if (key.toLowerCase() === "m" || event.code === "KeyM") {
        const command = phase === "move" ? "STOP_MOVE" : phase === "hunter" ? "MOVE" : null;
        if (command) button = [...controls.querySelectorAll("[data-command]")].find(element => element.dataset.command === command && available(element));
      } else if (phase === "move") {
        const direction = directions[key] || directions[key.toLowerCase()] || physical[event.code];
        if (direction) button = [...controls.querySelectorAll("[data-move-direction]")].find(element => element.dataset.moveDirection === direction && available(element));
      }
      if (!button) return;
      // 기존 버튼을 거치므로 비용, 확인 창, 목적지 선택과 입력 차단을 그대로 따릅니다.
      event.preventDefault();
      button.click();
    }
    const observer = typeof window.MutationObserver === "function" ? new window.MutationObserver(refresh) : null;
    observer?.observe(controls, { childList: true, subtree: true });
    const api = { refresh, destroy() {
      if (destroyed) return;
      destroyed = true; observer?.disconnect(); document.removeEventListener?.("keydown", keydown); instances.delete(document);
    } };
    instances.set(document, api); document.addEventListener("keydown", keydown); refresh();
    return api;
  }
  return create;
});
