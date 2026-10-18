(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntAutomaticCombat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // UI convenience only: the caller still dispatches and records the original
  // RESOLVE/EXTRA_TAKE commands, so damage, prevention and death use the reducer.
  function nextCommand(state, E) {
    const combat = state?.combat, reaction = combat?.immediate;
    const deathEcho = state?.phase === "boss_react" && combat?.extendedDeathEchoQueued &&
      combat.action?.code === "male-patient-death-echo" &&
      reaction?.name === "죽음의 메아리" && reaction.unavoidable === true &&
      reaction.dodgeSpeed === null && !reaction.dodgeBlockPerSpeed && !combat.dodged,
      posthumousExtra = state?.phase === "combat_extra" && !!combat?.extra;
    if ((!deathEcho && !posthumousExtra) || state.killReaction || state.rewardChoices?.length ||
        (state.enemies || []).some(enemy => enemy.id === combat.enemyId) ||
        typeof E?.hunter !== "function" || typeof E?.rewardsView !== "function") return null;
    const hunter = E.hunter(state);
    if (!hunter || hunter.inDream || hunter.hp <= 0) return null;
    // A historical rule version can leave a kill-reward window open without
    // entering kill_react. Never consume that optional response implicitly.
    const rewards = E.rewardsView(state);
    if (!Array.isArray(rewards?.choices) || !Array.isArray(rewards?.rewards) ||
        rewards.choices.length || rewards.rewards.some(reward => reward.usable)) return null;
    if (posthumousExtra) {
      if (typeof E.canDodge !== "function" || typeof E.slots !== "function" ||
          !Array.isArray(hunter.hand) || !Array.isArray(hunter.slots)) return null;
      const slots = E.slots(state);
      if (!Array.isArray(slots)) return null;
      for (const card of hunter.hand) for (let slot = 0; slot < slots.length; slot++)
        if (!hunter.slots[slot] && E.canDodge(state, card.id, slot, true)) return null;
      return { type: "EXTRA_TAKE" };
    }
    return { type: "RESOLVE" };
  }

  return Object.freeze({ nextCommand });
});
