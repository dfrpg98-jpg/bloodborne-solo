(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBHuntShell = factory;
})(typeof window !== "undefined" ? window : globalThis, function (options) {
  "use strict";
  const { document, onCenterMap, onPanelChange } = options;
  const labels = { inventory: "보유 소모품", rewards: "보상과 장비", objectives: "목표와 임무", journal: "사냥일지", enemies: "적과 능력", help: "메뉴 · 저장과 지도 안내", guide: "게임 도움말" },
    get = (id) => document.getElementById(id),
    all = (selector) => document.querySelectorAll ? [...document.querySelectorAll(selector)] : [],
    dialog = get("infoDialog"),
    view = document.defaultView || (typeof window !== "undefined" ? window : null),
    narrow = view?.matchMedia?.("(max-width: 700px)");
  let current = null, workspace = "progress", opener = null, notifiedState = "|false||false";
  const workspacePanels = () => all("[data-workspace-panel]"),
    supportsWorkspace = panel => workspacePanels().some(section => section.dataset.workspacePanel === "progress") &&
      workspacePanels().some(section => section.dataset.workspacePanel === panel),
    activePanel = () => dialog.open ? current : workspace !== "progress" && supportsWorkspace(workspace) ? workspace : null;
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
    const inline = !dialog.open && supportsWorkspace(panel),
      targetPicker = !inline && pickerFor(panel),
      isNarrow = narrow?.matches ?? (view?.innerWidth <= 700),
      placement = targetPicker ? isNarrow ? "bottom" : "right" : null;
    dialog.classList.toggle("target-picker", targetPicker);
    if (document.documentElement?.dataset) {
      if (placement) document.documentElement.dataset.targetPicker = placement;
      else delete document.documentElement.dataset.targetPicker;
    }
    const signature = `${panel || ""}|${targetPicker}|${placement || ""}|${inline}`;
    if (notify && (force || signature !== notifiedState)) {
      notifiedState = signature;
      onPanelChange?.(panel, { targetPicker, placement, inline });
    }
  }
  function markButtons() {
    for (const section of workspacePanels()) if (!section.id) {
      section.setAttribute("id", `workspace-${section.dataset.workspacePanel}`);
      section.id = `workspace-${section.dataset.workspacePanel}`;
    }
    for (const button of all("[data-panel]")) {
      const panel = button.dataset.panel, inline = supportsWorkspace(panel);
      button.setAttribute("aria-pressed", String(panel === activePanel()));
      button.setAttribute("aria-controls", inline ? workspacePanels().find(section => section.dataset.workspacePanel === panel).id : "infoDialog");
    }
    for (const button of all("[data-workspace-tab]")) {
      const panel = button.dataset.workspaceTab,
        section = workspacePanels().find(section => section.dataset.workspacePanel === panel);
      if (!section) continue;
      if (!button.id) { button.setAttribute("id", `workspace-tab-${panel}`); button.id = `workspace-tab-${panel}`; }
      if (!section.id) { section.setAttribute("id", `workspace-${panel}`); section.id = `workspace-${panel}`; }
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(panel === workspace));
      button.setAttribute("aria-controls", section.id);
      button.tabIndex = panel === workspace ? 0 : -1;
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-labelledby", button.id);
    }
  }
  function selectWorkspace(panel, source, { focus = false, notify = true, preserveDialog = false } = {}) {
    if (!supportsWorkspace(panel)) return false;
    const keepDialog = dialog.open && (preserveDialog || dialog.dataset?.windowMinimized === "true");
    if (dialog.open && !keepDialog) dialog.close();
    workspace = panel;
    for (const section of workspacePanels()) section.hidden = section.dataset.workspacePanel !== panel;
    markButtons();
    if (notify) presentPanel(keepDialog ? current : panel === "progress" ? null : panel, { force: true });
    if (focus) (source?.dataset?.workspaceTab ? source : all("[data-workspace-tab]").find(button => button.dataset.workspaceTab === panel))?.focus?.({ preventScroll: true });
    return true;
  }
  function open(panel, source) {
    if (!Object.hasOwn(labels, panel)) return;
    if (selectWorkspace(panel, source, { focus: true })) return;
    const sections = all("[data-info-panel]").filter(section => !section.dataset.workspacePanel);
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
    dialog.showModal();
    dialog.scrollTop = 0;
    const content = dialog.querySelector?.(".info-content");
    if (content) content.scrollTop = 0;
    markButtons();
    get("closeInfo").focus?.({ preventScroll: true });
    presentPanel(panel, { force: true });
  }
  function close() {
    if (dialog.open) dialog.close();
    presentPanel(activePanel());
  }
  dialog.addEventListener("close", () => {
    current = null;
    presentPanel(activePanel());
    markButtons();
    if (opener?.isConnected !== false) opener?.focus?.({ preventScroll: true });
  });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  get("closeInfo").onclick = close;
  if (get("centerMap")) get("centerMap").onclick = () => onCenterMap?.();
  function bind() {
    for (const button of all("[data-panel]")) button.onclick = () => open(button.dataset.panel, button);
    const tabs = all("[data-workspace-tab]");
    for (const button of tabs) {
      button.onclick = () => selectWorkspace(button.dataset.workspaceTab, button);
      button.onkeydown = event => {
        const index = tabs.indexOf(button);
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length :
          event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length :
          event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        selectWorkspace(tabs[next].dataset.workspaceTab, tabs[next], { focus: true });
      };
    }
    get("workspaceTabs")?.setAttribute("role", "tablist");
    markButtons();
  }
  function sync({ phase, mandatoryReward = false, setupOpen = false }) {
    if (document.documentElement?.dataset) document.documentElement.dataset.phase = phase;
    if (get("rewardPendingBadge")) {
      get("rewardPendingBadge").textContent = mandatoryReward ? "선택 필요" : "";
      get("rewardPendingBadge").hidden = !mandatoryReward;
    }
    if (setupOpen) close();
    if (dialog.open) for (const section of all("[data-info-panel]").filter(section => !section.dataset.workspacePanel)) section.hidden = section.dataset.infoPanel !== current;
    for (const section of workspacePanels()) section.hidden = section.dataset.workspacePanel !== workspace;
    presentPanel(activePanel());
    bind();
  }
  function refresh() {
    presentPanel(activePanel());
  }
  narrow?.addEventListener?.("change", () => presentPanel(activePanel()));
  selectWorkspace("progress", null, { notify: false });
  bind();
  return { open, close, bind, sync, refresh, activePanel,
    showProgress: settings => selectWorkspace("progress", null, settings), activeWorkspace: () => workspace };
});
