(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBHuntEntry = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const keys = { normal: "bloodborne-hunt-v07", previous: "bloodborne-hunt-v06",
    qa: "bloodborne-hunt-qa-v1", active: "bloodborne-hunt-active-mode" };
  function parse(search) {
    const params = new URLSearchParams(search || ""), action = params.get("entry");
    if (action === "new" || action === "load") return { action };
    if (action === "continue") {
      const mode = params.get("mode");
      return mode === "normal" || mode === "qa" ? { action, mode } : { action: "load" };
    }
    return null;
  }
  // Presence only: the game validates and replays a save when the user loads it.
  // Visiting the title must never migrate, create or overwrite a hunt.
  function readAvailableSaves(storage) {
    try {
      const rows = [];
      if (storage.getItem(keys.normal) || storage.getItem(keys.previous)) rows.push({ mode: "normal", label: "일반 사냥" });
      if (storage.getItem(keys.qa)) rows.push({ mode: "qa", label: "검증 사냥" });
      const active = storage.getItem(keys.active);
      return rows.sort((a, b) => Number(b.mode === active) - Number(a.mode === active));
    } catch { return []; }
  }
  function consume(window) {
    try {
      const url = new URL(window.location.href);
      if (!parse(url.search)) return;
      url.searchParams.delete("entry");
      url.searchParams.delete("mode");
      window.history.replaceState(window.history.state, "", url.href);
    } catch { /* Navigation is still usable when history is unavailable. */ }
  }
  return { parse, readAvailableSaves, consume };
});
