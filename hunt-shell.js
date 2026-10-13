(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntShell = factory;
})(typeof window !== "undefined" ? window : globalThis, function (options) {
  "use strict";
  const { document, onCenterMap } = options;
  const labels = { inventory: "보유 소모품", rewards: "보상과 장비", journal: "현재 목표와 사냥 기록", enemies: "적과 능력", actions: "공개된 적 행동 기록", help: "도움말과 저장" },
    get = (id) => document.getElementById(id),
    all = (selector) => document.querySelectorAll ? [...document.querySelectorAll(selector)] : [],
    dialog = get("infoDialog");
  let current = null, opener = null;
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
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    const content = dialog.querySelector?.(".info-content");
    if (content) content.scrollTop = 0;
    markButtons();
    get("closeInfo").focus?.({ preventScroll: true });
  }
  function close() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener("close", () => {
    current = null;
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
    bind();
  }
  bind();
  return { open, close, bind, sync, activePanel: () => dialog.open ? current : null };
});
