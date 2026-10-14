(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.BBHuntCardHelp = api;
    const start = () => api.install(root.document);
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const installed = new WeakSet();
  function install(document) {
    if (!document?.body || !document.createElement || installed.has(document)) return;
    installed.add(document);
    const tip = document.createElement("div"), view = document.defaultView;
    tip.id = "handCardHelp";
    tip.className = "hand-card-help";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
    let current = null, suppressed = null;
    const cardAt = target => target?.closest?.("#hand [data-card]");
    const hide = () => {
      if (current?.getAttribute("aria-describedby") === tip.id) current.removeAttribute("aria-describedby");
      current = null;
      tip.hidden = true;
    };
    const position = () => {
      if (!current?.isConnected || !view) { hide(); return; }
      const a = current.getBoundingClientRect(), t = tip.getBoundingClientRect(), margin = 12;
      tip.style.left = Math.max(margin, Math.min(a.left, view.innerWidth - t.width - margin)) + "px";
      tip.style.top = (a.top - t.height - 10 >= margin ? a.top - t.height - 10 :
        Math.max(margin, Math.min(a.bottom + 10, view.innerHeight - t.height - margin))) + "px";
    };
    const show = card => {
      if (!card?.title || card === suppressed) return;
      if (current !== card) hide();
      current = card;
      tip.textContent = card.title;
      card.setAttribute("aria-describedby", tip.id);
      tip.hidden = false;
      position();
    };
    document.addEventListener("mouseover", event => {
      const card = cardAt(event.target);
      if (card) show(card);
    });
    document.addEventListener("mouseout", event => {
      if (suppressed?.contains(event.target) && !suppressed.contains(event.relatedTarget)) suppressed = null;
      if (current?.contains(event.target) && !current.contains(event.relatedTarget) && document.activeElement !== current) hide();
    });
    document.addEventListener("focusin", event => {
      const card = cardAt(event.target);
      if (card) show(card);
      else hide();
    });
    document.addEventListener("focusout", event => {
      if (event.target === suppressed) suppressed = null;
      if (event.target === current && !current.matches(":hover")) hide();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !tip.hidden) { suppressed = current; hide(); }
    });
    view?.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", () => { if (document.hidden) hide(); });
    document.addEventListener("scroll", position, true);
    view?.addEventListener("resize", position);
    if (view?.MutationObserver) new view.MutationObserver(() => {
      if (current && !current.isConnected) hide();
      if (suppressed && !suppressed.isConnected) suppressed = null;
    }).observe(document.getElementById("hand"), { childList: true });
  }
  return { install };
});
