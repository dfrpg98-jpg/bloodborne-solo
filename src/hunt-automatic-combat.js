(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntAutomaticCombat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // UI convenience only: the caller still dispatches and records the original
  // RESOLVE command, so damage, poison, prevention and death use the reducer.
  function nextCommand(state, E) {
    const combat = state?.combat, reaction = combat?.immediate;
    if (state?.phase !== "boss_react" || !combat?.extendedDeathEchoQueued ||
        combat.action?.code !== "male-patient-death-echo" ||
        reaction?.name !== "죽음의 메아리" || reaction.unavoidable !== true ||
        reaction.dodgeSpeed !== null || reaction.dodgeBlockPerSpeed ||
        combat.dodged || state.killReaction ||
        (state.enemies || []).some(enemy => enemy.id === combat.enemyId) ||
        typeof E?.hunter !== "function" || typeof E?.rewardsView !== "function") return null;
    const hunter = E.hunter(state);
    if (!hunter || hunter.inDream || hunter.hp <= 0) return null;
    // A historical rule version can leave a kill-reward window open without
    // entering kill_react. Never consume that optional response implicitly.
    const rewards = E.rewardsView(state);
    if (!Array.isArray(rewards?.choices) || !Array.isArray(rewards?.rewards) ||
        rewards.choices.length || rewards.rewards.some(reward => reward.usable)) return null;
    return { type: "RESOLVE" };
  }

  return Object.freeze({ nextCommand });
});
