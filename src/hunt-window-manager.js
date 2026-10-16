(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntWindowManager = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const installations = new WeakMap();
  const managementControls = new Set(["load", "resumeNormal", "resumeQa", "restoreV05", "restoreV06", "new"]);
  const responseOwners = {
    missionUpdateContinue: "missionUpdateDialog", deathContinue: "deathDialog", closeAttachments: "attachmentDialog",
    escortAccept: "escortDialog", escortDecline: "escortDialog", escortCancel: "escortDialog",
    actionLossAccept: "actionLossDialog", actionLossCancel: "actionLossDialog",
    confirmSetup: "setupDialog", cancelSetup: "setupDialog", loadSetup: "setupDialog",
    resumeNormalSetup: "setupDialog", resumeQaSetup: "setupDialog", loadV06Setup: "setupDialog",
    loadEntryNormal: "loadDialog", loadEntryQa: "loadDialog", loadEntryFile: "loadDialog", loadEntryCancel: "loadDialog",
  };
  const passiveResponses = new Set(["missionUpdateContinue", "deathContinue", "closeAttachments", "escortCancel", "actionLossCancel", "cancelSetup", "loadEntryCancel"]);
  const guideResponses = new Set(["MISSION_LURE", "MISSION_CORPSES"]);
  const actionSelector = "[data-command],[data-reward-use],[data-context-action],[data-return],[data-move-option],#useItem,#new,#load,#resumeNormal,#resumeQa,#restoreV05,#restoreV06,#startNextChapter," +
    Object.keys(responseOwners).map(id => "#" + id).join(",");
  const headerSelectors = [".compact-dialog-heading", ".mission-update-heading", ".info-dialog-heading", ".story-dialog-heading"];
  const interactiveSelector = "button,a,input,select,textarea,label,summary,[role=button]";

  function clampPosition(position, size, viewport, margin = 8) {
    const width = Math.max(0, Number(size.width) || 0), height = Math.max(0, Number(size.height) || 0);
    const maxX = Math.max(margin, (Number(viewport.width) || 0) - width - margin);
    const maxY = Math.max(margin, (Number(viewport.height) || 0) - height - margin);
    return { x: Math.round(Math.min(maxX, Math.max(margin, Number(position.x) || 0))),
      y: Math.round(Math.min(maxY, Math.max(margin, Number(position.y) || 0))) };
  }
  function isResponse(dialogId, command) {
    return dialogId === "attachmentDialog" && command?.type === "REASSIGN_REWARD";
  }
  function install(document, options = {}) {
    if (!document || typeof document.createElement !== "function") return null;
    if (installations.has(document)) return installations.get(document);
    const view = document.defaultView || (typeof window !== "undefined" ? window : null);
    const records = new Map(), listeners = [];
    const dock = document.createElement("nav");
    dock.className = "hunt-window-dock";
    dock.setAttribute("aria-label", "최소화한 창");
    dock.hidden = true;
    document.body?.append?.(dock);
    let highest = 100, drag = null;
    function listen(target, type, handler, settings) {
      target?.addEventListener?.(type, handler, settings);
      listeners.push([target, type, handler, settings]);
    }
    const title = dialog => {
      const label = dialog.getAttribute?.("aria-labelledby");
      return (label && document.getElementById(label)?.textContent?.trim()) || dialog.getAttribute?.("aria-label") || "사냥 정보";
    };
    const viewport = () => ({ width: view?.innerWidth || document.documentElement?.clientWidth || 1024,
      height: view?.innerHeight || document.documentElement?.clientHeight || 768 });
    const recordFor = value => typeof value === "string" ? records.get(document.getElementById(value)) : records.get(value);
    function isBlocking(record) {
      return record.dialog.open && (typeof options.isBlocking === "function"
        ? options.isBlocking(record.dialog) : true);
    }
    const blockers = () => [...records.values()].filter(isBlocking).map(record => record.dialog);
    function allowed(commands) {
      return blockers().every(dialog => commands.every(command => isResponse(dialog.id || dialog.getAttribute?.("id"), command) || options.allowCommand?.(command, dialog) === true));
    }
    function notifyBlocked() {
      dock.classList?.remove("has-blocked-action");
      // The live dock remains the same control; no new confirmation is created.
      dock.classList?.add("has-blocked-action");
      options.onBlocked?.(blockers());
    }
    function canExecute(commands, settings = {}) {
      const result = allowed(Array.isArray(commands) ? commands : [commands]);
      if (!result && settings.notify !== false) notifyBlocked();
      return result;
    }
    function raise(record) {
      record.dialog.style.zIndex = String(++highest);
    }
    function updateDock() {
      dock.hidden = ![...records.values()].some(record => record.dialog.open && record.minimized);
    }
    function position(record, desired) {
      const rect = record.dialog.getBoundingClientRect?.() || {};
      const next = clampPosition(desired, rect, viewport());
      Object.assign(record.dialog.style, { left: next.x + "px", top: next.y + "px", right: "auto", bottom: "auto", margin: "0", transform: "none" });
      record.positioned = true;
      return next;
    }
    function center(record) {
      const rect = record.dialog.getBoundingClientRect?.() || {}, bounds = viewport();
      return position(record, { x: (bounds.width - (rect.width || 0)) / 2, y: (bounds.height - (rect.height || 0)) / 2 });
    }
    function reset(record) {
      record.minimized = false;
      record.dialog.removeAttribute("data-window-minimized");
      record.dockButton.hidden = true;
      record.minimizeButton.setAttribute("aria-expanded", "true");
      updateDock();
    }
    function minimize(value) {
      const record = recordFor(value);
      if (!record?.dialog.open || record.minimized) return false;
      record.focusBeforeMinimize = document.activeElement;
      record.minimized = true;
      record.dialog.setAttribute("data-window-minimized", "true");
      record.minimizeButton.setAttribute("aria-expanded", "false");
      record.dockButton.textContent = title(record.dialog) + " · 복원";
      record.dockButton.hidden = false;
      updateDock();
      record.dockButton.focus?.({ preventScroll: true });
      return true;
    }
    function restore(value) {
      const record = recordFor(value);
      if (!record?.dialog.open) return false;
      reset(record); raise(record);
      if (record.positioned) {
        const rect = record.dialog.getBoundingClientRect?.() || {};
        position(record, { x: rect.left || parseFloat(record.dialog.style.left), y: rect.top || parseFloat(record.dialog.style.top) });
      }
      const previous = record.focusBeforeMinimize;
      (previous && previous.isConnected !== false && record.dialog.contains?.(previous) ? previous : record.minimizeButton)?.focus?.({ preventScroll: true });
      return true;
    }
    function register(dialog) {
      if (!dialog || records.has(dialog)) return records.get(dialog) || null;
      const nativeShowModal = dialog.showModal, nativeShow = dialog.show, nativeClose = dialog.close;
      if (typeof nativeShowModal !== "function" && typeof nativeShow !== "function") return null;
      const originalRole = dialog.getAttribute?.("role"), originalModal = dialog.getAttribute?.("aria-modal");
      const record = { dialog, minimized: false, positioned: false, nativeShowModal, nativeShow, nativeClose, originalRole, originalModal };
      records.set(dialog, record);
      dialog.classList?.add("hunt-floating-window");
      dialog.setAttribute("role", "dialog");
      // Physical modality is removed; engine commands retain logical blocking.
      dialog.setAttribute("aria-modal", "false");
      let heading = headerSelectors.map(selector => dialog.querySelector?.(selector)).find(Boolean);
      if (!heading) {
        heading = document.createElement("div"); heading.className = "hunt-window-bar";
        const caption = document.createElement("span"); caption.textContent = title(dialog); heading.append?.(caption);
        if (dialog.prepend) dialog.prepend(heading); else dialog.append?.(heading);
        record.generatedHeading = true;
      }
      heading.classList?.add("hunt-window-handle");
      const tools = document.createElement("span"); tools.className = "hunt-window-tools";
      const minimizeButton = document.createElement("button"); minimizeButton.type = "button";
      minimizeButton.className = "hunt-window-minimize"; minimizeButton.textContent = "최소화";
      minimizeButton.setAttribute("aria-label", "창 최소화"); minimizeButton.setAttribute("aria-expanded", "true");
      minimizeButton.setAttribute("title", "최소화 · 내용은 유지됩니다");
      tools.append?.(minimizeButton); heading.append?.(tools);
      const dockButton = document.createElement("button"); dockButton.type = "button"; dockButton.hidden = true;
      dockButton.className = "hunt-window-restore";
      const id = dialog.id || dialog.getAttribute?.("id");
      if (id) { minimizeButton.setAttribute("aria-controls", id); dockButton.setAttribute("aria-controls", id); }
      dock.append?.(dockButton);
      Object.assign(record, { heading, tools, minimizeButton, dockButton });
      listen(minimizeButton, "click", event => { event.preventDefault(); minimize(dialog); });
      listen(dockButton, "click", event => { event.preventDefault(); restore(dialog); });
      listen(dialog, "pointerdown", () => raise(record));
      listen(heading, "pointerdown", event => {
        if (event.button !== undefined && event.button !== 0 || event.target?.closest?.(interactiveSelector)) return;
        const rect = dialog.getBoundingClientRect?.() || {};
        drag = { record, pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left || 0, top: rect.top || 0 };
        heading.setPointerCapture?.(event.pointerId); dialog.classList?.add("is-window-dragging");
        raise(record); event.preventDefault();
      });
      listen(heading, "keydown", event => {
        if (!event.altKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || event.target?.closest?.(interactiveSelector)) return;
        const rect = dialog.getBoundingClientRect?.() || {}, step = event.shiftKey ? 40 : 16;
        position(record, { x: (rect.left || 0) + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
          y: (rect.top || 0) + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
        event.preventDefault();
      });
      heading.setAttribute("tabindex", "0"); heading.setAttribute("title", "드래그하여 이동 · Alt+방향키로 이동");
      dialog.showModal = function () {
        if (dialog.open) { restore(dialog); return; }
        reset(record);
        // The fallback is only for small DOM test doubles without .show().
        (nativeShow || nativeShowModal).call(dialog);
        center(record); raise(record);
      };
      if (typeof nativeClose === "function") dialog.close = function (...args) {
        const result = nativeClose.apply(dialog, args); reset(record); return result;
      };
      listen(dialog, "close", () => { reset(record); if (drag?.record === record) endDrag(); });
      if (dialog.open) { center(record); raise(record); }
      return record;
    }
    function endDrag(event) {
      if (!drag || event && event.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
      drag.record.dialog.classList?.remove("is-window-dragging");
      try { drag.record.heading.releasePointerCapture?.(drag.pointerId); } catch (_) { /* The browser may already have released it. */ }
      drag = null;
    }
    listen(document, "pointermove", event => {
      if (!drag || event.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
      position(drag.record, { x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y });
      event.preventDefault();
    });
    listen(document, "pointerup", endDrag); listen(document, "pointercancel", endDrag);
    listen(document, "keydown", event => {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat) return;
      const focused = records.get(event.target?.closest?.("dialog"));
      const record = focused?.dialog.open && !focused.minimized ? focused : [...records.values()]
        .filter(entry => entry.dialog.open && !entry.minimized)
        .sort((a, b) => Number(b.dialog.style.zIndex) - Number(a.dialog.style.zIndex))[0];
      if (!record) return;
      // Escape reveals the board without acknowledging a pending decision.
      endDrag(); minimize(record.dialog); event.preventDefault(); event.stopPropagation?.();
    });
    listen(document, "click", event => {
      if (!blockers().length) return;
      const action = event.target?.closest?.(actionSelector);
      if (!action) return;
      const owner = action.closest?.("dialog");
      // Only named responses belong to a pending window. Merely placing a
      // resource-use button inside a dialog must not bypass its command guard.
      const actionId = action.id || action.getAttribute?.("id"), ownerId = owner?.id || owner?.getAttribute?.("id");
      // Menu navigation replaces or loads the hunt, rather than taking a turn.
      // It is valid from the information menu alone, never over another choice.
      if (managementControls.has(actionId) && blockers().every(dialog => (dialog.id || dialog.getAttribute?.("id")) === "infoDialog")) return;
      if (!action.dataset?.command && responseOwners[actionId] === ownerId && owner && records.has(owner) && isBlocking(records.get(owner)) &&
          (passiveResponses.has(actionId) || blockers().every(dialog => dialog === owner))) return;
      // These handlers close the guide before dispatching. Let only its own
      // visible responses reach the handler; other open windows still block.
      if (ownerId === "missionGuideDialog" && guideResponses.has(action.dataset?.command) &&
          records.has(owner) && !records.get(owner).minimized && blockers().every(dialog => dialog === owner)) return;
      const command = action.dataset?.command ? { type: action.dataset.command } : { type: "__UI_ACTION__" };
      if (canExecute([command])) return;
      event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation?.();
    }, true);
    listen(view, "resize", () => {
      for (const record of records.values()) if (record.dialog.open && !record.minimized) {
        const rect = record.dialog.getBoundingClientRect?.() || {};
        position(record, { x: rect.left || 0, y: rect.top || 0 });
      }
    });
    const api = { register, minimize, restore, canExecute, blockers, isBlocked: () => blockers().length > 0,
      refresh() { for (const dialog of document.querySelectorAll?.("dialog") || []) register(dialog); updateDock(); },
      destroy() {
        endDrag();
        for (const [target, type, handler, settings] of listeners) target?.removeEventListener?.(type, handler, settings);
        for (const record of records.values()) {
          record.dialog.showModal = record.nativeShowModal; if (record.nativeClose) record.dialog.close = record.nativeClose;
          record.dialog.classList?.remove("hunt-floating-window"); record.dialog.removeAttribute("data-window-minimized");
          record.originalRole === null ? record.dialog.removeAttribute("role") : record.dialog.setAttribute("role", record.originalRole);
          record.originalModal === null ? record.dialog.removeAttribute("aria-modal") : record.dialog.setAttribute("aria-modal", record.originalModal);
          record.tools.remove?.(); record.dockButton.remove?.();
          if (record.generatedHeading) record.heading.remove?.();
        }
        dock.remove?.(); records.clear(); installations.delete(document);
      } };
    installations.set(document, api); api.refresh();
    return api;
  }
  return { install, clampPosition, isResponse };
});
