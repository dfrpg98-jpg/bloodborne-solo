(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBEnemyMissionEffects = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Describe only a living, disclosed mission target. No unopened card, deck,
  // random input or reducer command crosses this presentation boundary.
  const objectiveIds = { 3: "main", 10: "shelter", 31: "card-30", 36: "bridge" };
  function describe(state, E) {
    if (!state?.mission || !E?.enemyDef) return [];
    const revealed = new Set(state.mission.revealed || []), result = [];
    for (const enemy of state.enemies || []) {
      const target = state.mission.targets?.[enemy.missionId], number = target?.card;
      if (!objectiveIds[number] || target.complete || target.enemyId !== enemy.id || !revealed.has(number)) continue;
      const definition = E.enemyDef(state, enemy), action = number === 3 ? definition.ability : definition.special;
      if (!action) continue;
      const type = number === 3 ? "전용 능력" : "특수 공격";
      const stats = [Number.isFinite(action.speed) && `속도 ${action.speed}`,
        Number.isFinite(action.damage) && `피해 ${action.damage}`,
        action.interrupt && "방해", action.stun && "기절", action.poison && "독", action.frenzy && "발광",
        action.uninterruptible && "방해 불가", action.undodgeable && "회피 불가",
        Number.isFinite(action.defense) && action.defense > 0 && `방어 ${action.defense}`].filter(Boolean);
      const finalCode = action.name.charCodeAt(action.name.length - 1), finalConsonant = (finalCode - 0xac00) % 28;
      const particle = finalCode >= 0xac00 && finalCode <= 0xd7a3 && (finalConsonant === 0 || finalConsonant === 8) ? "로" : "으로";
      const description = `${definition.name}의 ${type}이 ‘${action.name}’${particle} 변경되었습니다.`;
      const effects = [`${action.name} · ${stats.join(" · ")}`];
      if (number === 10) effects.push("체력이 가득 차 있으면 피해 2, 피해를 입은 상태라면 피해 4입니다.");
      if (number === 31 && definition.ignoreTileSpeed) effects.push("기존 저장 판정 · 이 적은 타일의 속도 감소를 받지 않습니다.");
      result.push({ enemyId: enemy.id, objectiveId: objectiveIds[number], card: number,
        title: `${definition.name} · 임무에 따른 능력 변경`, description, effects,
        signature: JSON.stringify([number, action.name, stats, definition.ignoreTileSpeed === true]) });
    }
    return result;
  }
  return Object.freeze({ describe });
});
