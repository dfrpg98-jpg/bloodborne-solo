(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntShell = factory;
})(typeof window !== "undefined" ? window : globalThis, function (options) {
  "use strict";
  const { document, onCenterMap, onPanelChange } = options;
  const labels = { inventory: "보유 소모품", rewards: "보상과 장비", journal: "현재 목표와 사냥 기록", enemies: "적과 능력", help: "메뉴 · 저장과 지도 안내", guide: "게임 도움말" },
    get = (id) => document.getElementById(id),
    all = (selector) => document.querySelectorAll ? [...document.querySelectorAll(selector)] : [],
    dialog = get("infoDialog"),
    view = document.defaultView || (typeof window !== "undefined" ? window : null),
    narrow = view?.matchMedia?.("(max-width: 700px)");
  let current = null, opener = null, notifiedState = "|false|";
  function hasTargetChoices(select) {
    if (!select) return false;
    if (select.options) return [...select.options].some(option => option.value && !option.disabled);
    return /<option\b[^>]*value="[^"]+"/.test(select.innerHTML || "");
  }
  function pickerFor(panel) {
    if (panel === "inventory") return hasTargetChoices(get("itemEnemy"));
    if (panel !== "rewards") return false;
    return [...(get("rewards")?.querySelectorAll("select") || [])].some(select => {
      const id = select.id || select.getAttribute("id") || "";
      return (id.startsWith("rewardEnemy-") || id.startsWith("rewardMove-")) && hasTargetChoices(select);
    });
  }
  function presentPanel(panel, { notify = true, force = false } = {}) {
    const targetPicker = pickerFor(panel),
      isNarrow = narrow?.matches ?? (view?.innerWidth <= 700),
      placement = targetPicker ? isNarrow ? "bottom" : "right" : null;
    dialog.classList.toggle("target-picker", targetPicker);
    if (document.documentElement?.dataset) {
      if (placement) document.documentElement.dataset.targetPicker = placement;
      else delete document.documentElement.dataset.targetPicker;
    }
    const signature = `${panel || ""}|${targetPicker}|${placement || ""}`;
    if (notify && (force || signature !== notifiedState)) {
      notifiedState = signature;
      onPanelChange?.(panel, { targetPicker, placement });
    }
  }
  function markButtons() {
    for (const button of all("[data-panel]")) {
      button.setAttribute("aria-pressed", String(dialog.open && button.dataset.panel === current));
      button.setAttribute("aria-controls", "infoDialog");
    }
  }
  function open(panel, source) {
    if (!Object.hasOwn(labels, panel)) return;
    const sections = all("[data-info-panel]");
    if (!sections.some((section) => section.dataset.infoPanel === panel)) return;
    if (!dialog.open) {
      if (source) opener = source;
      else if (!opener) opener = document.activeElement;
    }
    current = panel;
    for (const section of sections) section.hidden = section.dataset.infoPanel !== panel;
    get("infoTitle").textContent = labels[panel];
    if (get("infoError")) get("infoError").textContent = "";
    presentPanel(panel, { notify: false });
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    const content = dialog.querySelector?.(".info-content");
    if (content) content.scrollTop = 0;
    markButtons();
    get("closeInfo").focus?.({ preventScroll: true });
    presentPanel(panel, { force: true });
  }
  function close() {
    if (dialog.open) dialog.close();
    presentPanel(null);
  }
  dialog.addEventListener("close", () => {
    current = null;
    presentPanel(null);
    markButtons();
    if (opener?.isConnected !== false) opener?.focus?.({ preventScroll: true });
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  get("closeInfo").onclick = close;
  if (get("centerMap")) get("centerMap").onclick = () => onCenterMap?.();
  function bind() {
    for (const button of all("[data-panel]")) button.onclick = () => open(button.dataset.panel, button);
    markButtons();
  }
  function sync({ phase, mandatoryReward = false, setupOpen = false }) {
    if (document.documentElement?.dataset) document.documentElement.dataset.phase = phase;
    if (get("rewardPendingBadge")) {
      get("rewardPendingBadge").textContent = mandatoryReward ? "선택 필요" : "";
      get("rewardPendingBadge").hidden = !mandatoryReward;
    }
    if (setupOpen) close();
    if (dialog.open) for (const section of all("[data-info-panel]")) section.hidden = section.dataset.infoPanel !== current;
    presentPanel(dialog.open ? current : null);
    bind();
  }
  function refresh() {
    presentPanel(dialog.open ? current : null);
  }
  narrow?.addEventListener?.("change", () => presentPanel(dialog.open ? current : null));
  bind();
  return { open, close, bind, sync, refresh, activePanel: () => dialog.open ? current : null };
});
