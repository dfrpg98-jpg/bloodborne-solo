(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntActionAvailability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Presentation policy only. Historical reducers and replayed saves retain
  // their accepted commands; this helper prevents a redundant new UI choice.
  function blockedReason(state, E, command) {
    const combat = state?.combat;
    if (command?.type !== "FIREARM" || state?.phase !== "combat_react" ||
        !combat?.dodged || combat.action?.type !== "attack" || combat.action.kind !== "basic" ||
        typeof E?.firearm !== "function") return null;
    const gun = E.firearm(state);
    // Before the actual-component rules, every firearm follows the original
    // pure basic-interrupt path, irrespective of its later printed trigger.
    const actual = state.setup?.rulesVersion >= 9 && !state.provisional && gun?.actual &&
      state.setup.rulesVersion >= (gun.minimumRulesVersion || 9);
    if (actual && gun.trigger !== "enemy-basic") return null;
    return "이미 회피한 기본 공격입니다. 화기를 소진하지 않고 전투 처리를 계속하세요.";
  }
  return Object.freeze({ blockedReason });
});
