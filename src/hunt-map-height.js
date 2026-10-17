(function (root, factory) {
  "use strict";
  const create = factory();
  if (typeof module === "object" && module.exports) module.exports = create;
  else {
    root.BBHuntMapHeight = create;
    const start = () => create({ document: root.document, window: root });
    if (root.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const key = "bloodborne-ui-map-height-v3", instances = new WeakMap();
  function expandedRows(value) {
    const rows = String(value || "").trim().split(/\s+/);
    if (rows.length !== 4 || !rows.every(row => /^\d+(?:\.\d+)?px$/.test(row))) return null;
    const summary = Number.parseFloat(rows[0]);
    if (summary < 72) return null;
    return `${summary - 36}px ${rows[1]} minmax(0, 1fr) ${rows[3]}`;
  }
  function create({ document, window, storage }) {
    if (!document || !window) return null;
    if (instances.has(document)) return instances.get(document);
    const main = document.querySelector(".hunt-main"), stage = document.getElementById("mapStage");
    if (!main || !stage) return null;
    const originalRows = main.style.gridTemplateRows || "", priority = main.style.getPropertyPriority?.("grid-template-rows") || "";
    const summaries = [...document.querySelectorAll(".hud-summary > .panel")].map(element => ({
      element, tabIndex: element.getAttribute("tabindex")
    }));
    let expanded = false, destroyed = false, notifying = false;
    try { storage ??= window.localStorage; } catch (_) { storage = null; }
    const button = document.createElement("button"); button.id = "mapHeightToggle"; button.type = "button";
    button.className = "map-height-toggle"; stage.append(button);
    function writeRows(value) {
      if (main.style.setProperty) {
        if (value) main.style.setProperty("grid-template-rows", value, priority);
        else main.style.removeProperty("grid-template-rows");
      } else main.style.gridTemplateRows = value;
    }
    function updateButton() {
      button.textContent = expanded ? "높이 −" : "높이 +";
      button.setAttribute("aria-pressed", String(expanded));
      button.setAttribute("aria-label", expanded ? "기본 지도 높이로 복원" : "지도 세로 공간 늘리기");
      button.title = expanded ? "기본 지도 높이" : "상단 정보 공간을 줄여 지도를 높입니다";
    }
    function apply() {
      if (!expanded) return true;
      // 현재 창의 원래 CSS 배치를 먼저 읽습니다. 글자·손패·무기 행은 바꾸지 않습니다.
      writeRows(originalRows);
      const rows = expandedRows(window.getComputedStyle?.(main).gridTemplateRows);
      if (!rows) { expanded = false; restore(); updateButton(); return false; }
      writeRows(rows); main.classList.add("map-height-expanded");
      for (const item of summaries) if (item.tabIndex === null) item.element.setAttribute("tabindex", "0");
      return true;
    }
    function restore() {
      writeRows(originalRows); main.classList.remove("map-height-expanded");
      for (const item of summaries) {
        if (item.tabIndex === null) item.element.removeAttribute("tabindex");
        else item.element.setAttribute("tabindex", item.tabIndex);
      }
    }
    function setExpanded(value, { persist = true, notify = true } = {}) {
      if (destroyed || typeof value !== "boolean") return expanded;
      expanded = value;
      if (expanded) apply(); else restore();
      updateButton();
      if (persist) { try { storage?.setItem(key, expanded ? "expanded" : "standard"); } catch (_) { /* 저장이 막혀도 버튼은 동작합니다. */ } }
      // 기존 지도의 크기 관찰자에게만 알립니다. 게임 명령이나 진행 저장은 건드리지 않습니다.
      if (notify && window.Event) {
        notifying = true;
        try { window.dispatchEvent?.(new window.Event("resize")); } finally { notifying = false; }
      }
      return expanded;
    }
    const click = () => setExpanded(!expanded), resize = () => { if (!notifying && expanded && !destroyed) apply(); };
    button.addEventListener("click", click); window.addEventListener?.("resize", resize, { capture: true });
    updateButton();
    const controller = { setExpanded, expanded: () => expanded, destroy() {
      if (destroyed) return;
      destroyed = true; button.removeEventListener?.("click", click); window.removeEventListener?.("resize", resize, { capture: true });
      if (expanded) restore(); button.remove?.();
    } };
    instances.set(document, controller);
    let saved;
    try { saved = storage?.getItem(key); } catch (_) { /* 저장 없이도 지도 높이만 확장합니다. */ }
    if (saved !== "standard") setExpanded(true, { persist: false });
    return controller;
  }
  create.expandedRows = expandedRows; create.storageKey = key;
  return create;
});
