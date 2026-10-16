(function () {
  "use strict";
  const get = id => document.getElementById(id),
    helpButton = get("titleHelp"), dialog = get("titleHelpDialog"),
    closeButton = get("closeTitleHelp"), helpContent = get("titleHelpContent");
  let helpOpener = null;

  window.BBGameHelp?.mount?.(helpContent);

  function closeHelp() {
    if (dialog.open) dialog.close();
  }
  helpButton.addEventListener("click", () => {
    helpOpener = helpButton;
    if (!dialog.open) dialog.showModal();
    helpContent.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  });
  closeButton.addEventListener("click", closeHelp);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeHelp();
  });
  dialog.addEventListener("close", () => {
    if (helpOpener?.isConnected !== false) helpOpener?.focus({ preventScroll: true });
  });

  // Presence is enough for a shortcut. Only the hunt controller validates and
  // adopts a save after the player explicitly chooses to continue it.
  let available = [];
  try {
    available = window.BBHuntEntry?.readAvailableSaves?.(window.localStorage) || [];
  } catch { /* Starting, loading a file, and reading help remain available. */ }
  const links = get("titleContinueLinks"), seen = new Set();
  for (const save of Array.isArray(available) ? available : []) {
    if (!save || !["normal", "qa"].includes(save.mode) || seen.has(save.mode)) continue;
    seen.add(save.mode);
    const link = document.createElement("a");
    link.href = `hunt.html?entry=continue&mode=${save.mode}`;
    link.className = "title-continue-link";
    const label = save.label || (save.mode === "qa" ? "검증 사냥" : "일반 사냥");
    link.textContent = label.endsWith("이어하기") ? label : `${label} 이어하기`;
    links.append(link);
  }
  get("titleSavedHunts").hidden = !seen.size;
})();
