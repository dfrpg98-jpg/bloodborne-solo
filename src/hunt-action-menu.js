(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntActionMenu = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const labels = { MOVE: "이동", DREAM: "꿈으로 이동", TRANSFORM: "장치무기 변형", ATTACK: "적 공격하기" };
  function view(state, E, C, selection = {}) {
    const h = E.hunter(state), slots = E.slots(state),
      firstSlot = slots.findIndex((slot, index) => !h.slots[index]),
      slot = Number.isInteger(selection.slot) && slots[selection.slot] && !h.slots[selection.slot] ? selection.slot : firstSlot,
      enemy = state.enemies.find(enemy => enemy.id === selection.enemyId),
      locked = state.phase !== "hunter" || h.inDream || h.hp <= 0 || !!state.rewardChoices?.length;
    const attackActions = (cardId) => enemy && C?.view ? C.view(state, { kind: "enemy", enemyId: enemy.id },
      { ...selection, cardId, slot, replaceCardEffects: selection.replaceCardEffects }).actions
      .filter(action => action.command?.type === "ATTACK") || [] : [];
    const attackAvailable = !locked && firstSlot >= 0 && h.hand.some(card => attackActions(card.id).some(action => action.enabled));
    const actions = Object.entries(labels).map(([type, label]) => ({ type, label,
      enabled: !locked && (type !== "ATTACK" || attackAvailable), enemyId: type === "ATTACK" ? enemy?.id || null : null }));
    const chosen = h.hand.find(card => card.id === selection.cardId), type = selection.type;
    let command = null, reason = "", routes = [];
    if (!labels[type] || locked) reason = "현재 단계의 선택을 먼저 마치세요.";
    else if (!chosen) reason = "행동하기 위해 소모할 패를 선택해주세요";
    else if (type === "ATTACK") {
      const options = attackActions(chosen.id), enabled = options.filter(action => action.enabled);
      routes = enabled.filter(action => action.command?.leapPath);
      const option = enabled.length === 1 ? enabled[0] : enabled.find((_, index) => index === selection.routeIndex);
      if (option) command = { ...option.command, ...selection.commandArgs, cardId: chosen.id, slot, enemyId: enemy.id };
      else reason = options.find(action => action.reason)?.reason || (enabled.length > 1 ? "도약할 경로를 선택하세요." : "공격할 수 있는 적을 선택하세요.");
    } else command = { type, cardId: chosen.id };
    if (command) try {
      const blocked = selection.blockedReason?.(state, E, command);
      if (blocked) throw new Error(blocked);
      const source = type === "MOVE" && E.applyMovementDeclarationRuling ? E.applyMovementDeclarationRuling(state) : state;
      E.dispatch(source, command);
    } catch (error) { reason = error.message; command = null; }
    return { actions, selectedEnemy: enemy || null, slot, command, enabled: !!command, reason, routes };
  }
  return { view, labels };
});
