(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntUpgradeOverview = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const kinds = ["strength", "skill", "endurance", "vitality"];
  const labels = { strength: "근력", skill: "기술", endurance: "지구력", vitality: "활력" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, letter => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[letter]);
  function definition(E, id) {
    return E?.data?.cards?.[id] || E?.card?.({ kind: id }) || null;
  }
  function view(state, E) {
    if (!state || !E) return { market: [], deck: [], total: 0 };
    const hunter = E.hunter?.(state) || state.hunters?.[state.activeHunterId] || {};
    const market = (state.market || []).slice(0, 4).map(id => {
      const card = id && definition(E, id);
      return card ? { id, name: card.name, kind: card.type, text: card.text || "" } : { id: null, name: "빈 칸", kind: "empty", text: "" };
    });
    const seen = new Set(), grouped = new Map();
    // Aggregate all owned zones, then sort by public card identity. Neither the
    // draw order nor the hidden upgrade deck appears in the returned model.
    for (const card of [...(hunter.hand || []), ...(hunter.deck || []), ...(hunter.discard || []), ...(hunter.slots || [])]) {
      if (!card || card.id != null && seen.has(card.id)) continue;
      if (card.id != null) seen.add(card.id);
      const printed = definition(E, card.kind);
      if (!printed) continue;
      if (!grouped.has(card.kind)) grouped.set(card.kind, { cardId: card.kind, name: printed.name,
        kind: printed.type, text: printed.text || "", count: 0 });
      grouped.get(card.kind).count++;
    }
    const rank = kind => kinds.includes(kind) ? kinds.indexOf(kind) : kinds.length;
    const deck = [...grouped.values()].sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name, "ko") || a.cardId.localeCompare(b.cardId));
    return { market, deck, total: deck.reduce((sum, card) => sum + card.count, 0) };
  }
  function renderHTML(model, options = {}) {
    const clean = options.clean || (value => value);
    const text = value => esc(clean(value || ""));
    const market = (model?.market || []).map(card => card.id
      ? `<article class="upgrade-overview-card" data-skill-kind="${esc(kinds.includes(card.kind) ? card.kind : "other")}"><small>${esc(labels[card.kind] || "기술")}</small><b>${text(card.name)}</b><p>${text(card.text)}</p></article>`
      : '<article class="upgrade-overview-card is-empty"><span>빈 칸</span></article>').join("");
    const deck = (model?.deck || []).map(card => `<li data-skill-kind="${esc(kinds.includes(card.kind) ? card.kind : "other")}"><div><b>${text(card.name)}</b><span class="upgrade-card-count">${esc(card.count)}장</span></div><p>${text(card.text)}</p></li>`).join("");
    const marketHTML = options.market === false ? "" : `<h3>공개된 업그레이드</h3><div class="upgrade-market-grid">${market || '<p class="muted">비어있음</p>'}</div>`;
    return `<section class="upgrade-overview">${marketHTML}<details class="upgrade-deck-composition"><summary>내 덱 구성 · ${esc(model?.total || 0)}장</summary><ul class="upgrade-deck-list">${deck || '<li class="muted">비어있음</li>'}</ul></details></section>`;
  }
  return { view, renderHTML };
});
