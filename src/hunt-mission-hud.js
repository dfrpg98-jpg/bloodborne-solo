(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntMissionHUD = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // A presentation filter over already revealed mission information. It must
  // never read future cards, invent counters or change canonical mission state.
  function view(mission) {
    const empty = { counters: [], tokens: [], targets: [] };
    if (!mission || mission.won) return empty;
    const revealed = new Set(mission.revealed || []), discarded = new Set(mission.discarded || []);
    const completed = new Set(mission.completed || []);
    const earned = new Set([...completed, ...(mission.history || []).flatMap(chapter => chapter.completed || [])]);
    const active = (starts, rewards) => starts.some(number => revealed.has(number) && !discarded.has(number)) &&
      !rewards.some(number => completed.has(number));
    const clinic = active([27, 52], [28]) && !earned.has(34);
    const chapel = active([33], [34]) && !earned.has(28);
    const corpses = mission.chapter === 2 && active([18], [23]) && !revealed.has(19);
    const escort = mission.chapter === 1 ? active([8], [11]) : active([37], [38, 39]);
    const rescue = mission.chapter === 1 ? active([12, 13, 14], [15, 16]) : active([49], [48, 50]);
    const salvation = active([57], [58]);
    const counterActive = {
      "corpses-held": corpses, corpses,
      "survivors-held": clinic || chapel, clinic, chapel,
      "card-54": active([54], [55]), "card-57": salvation, "card-59": active([59], [60]),
    };
    const tokenActive = { escort, rescue, "salvation-npc": salvation };
    return {
      counters: (mission.counters || []).filter(counter => counterActive[counter.id] === true),
      tokens: (mission.tokens || []).filter(token => tokenActive[token.id] === true),
      targets: (mission.targets || []).filter(target => !target.complete && target.tokens !== undefined &&
        (target.initialTokens > 0 || target.tokens > 0) && revealed.has(target.card) && !discarded.has(target.card)),
    };
  }
  return { view };
});
