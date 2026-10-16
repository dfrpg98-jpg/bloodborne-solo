(function (root) {
  "use strict";
  const attack = (id, name, speed, damage, effects = {}) => ({
    id, name, kind: id, type: "attack", speed, damage, rules: [],
    stun: false, interrupt: false, undodgeable: false,
    uninterruptible: false, followup: false, ...effects,
  });
  const slam = attack("slam", "내려찍기", 2, 4,
    { bossInsight: true, bossInsightReduction: true, allHunters: true });
  const recovery = { id: "recovery", name: "회복", kind: "recovery", type: "ability",
    speed: null, damage: 0, code: "cleric-recovery", rules: [
      "계몽 토큰을 모두 제거합니다.", "사냥꾼의 공격에서 피해2를 방어합니다.",
      "현재 페이즈의 성직자 야수 행동 덱을 섞습니다.",
    ] };
  const phases = [
    { health: [10, 14, 20, 24], deck: ["slam", "slam", "recovery", "grab", "dash-sweep"],
      actions: { slam, recovery,
        grab: attack("grab", "붙잡기", 3, 3, { interrupt: true,
          bossInsight: true, bossInsightReduction: true }),
        "dash-sweep": attack("dash-sweep", "돌진 휩쓸기", 2, 4,
          { undodgeable: true, bossInsight: true, bossInsightReduction: true,
            afterAttackMove: 1 }),
      } },
    { health: [8, 12, 16, 20], deck: ["slam", "recovery", "grab-throw", "leap-slam", "destructive-slam"],
      actions: { slam, recovery,
        "grab-throw": attack("grab-throw", "붙잡아 던지기", 3, 3,
          { interrupt: true, stun: true, forceHunterMove: 1,
            bossInsight: true, bossInsightReduction: true }),
        "leap-slam": { id: "leap-slam", name: "뛰어 내려찍기", kind: "leap-slam",
          type: "ability", speed: null, damage: 2, dodgeSpeed: 1,
          code: "cleric-leap", stun: true, allHunters: true,
          rules: ["회피(속도1)하거나 피해2를 받고 기절합니다.", "다른 보스 행동 카드1장을 공개합니다."] },
        "destructive-slam": attack("destructive-slam", "파괴적인 내려찍기", 1, 6,
          { uninterruptible: true, bossInsightReduction: true, afterDodgeDamageBonus: 1,
            otherHunters: { dodgeSpeed: 1, damage: 2 } }),
      } },
  ];
  const specimen = { id: "cleric-beast", name: "성직자 야수", baseKind: "scourge-beast",
    boss: true, phases,
    source: "사용자 직접 전사 · components/cleric-beast-source.txt · 붙잡아 던지기 속도3/피해3 추가 확인",
  };
  function definition(id, phase = 1, order = 4, playerCount = 1) {
    if (id !== specimen.id) return null;
    if (![1, 2].includes(phase) || ![1, 2, 3, 4].includes(playerCount))
      throw new Error("성직자 야수의 페이즈·사냥꾼 수를 확인하세요.");
    const p = phases[phase - 1], actions = JSON.parse(JSON.stringify(p.actions));
    return { ...actions, id, name: specimen.name, boss: true, actual: true,
      temporary: false, phase, sideId: "actual", maxHp: p.health[playerCount - 1],
      health: p.health[playerCount - 1], healthByHunters: [...p.health],
      move: 1, pursuit: 1, order, source: specimen.source,
      face: { id: "actual", image: null },
    };
  }
  function createDecks(id, s, shuffle) {
    if (id !== specimen.id) throw new Error("실제 보스 구성품을 확인하세요.");
    return phases.map((p) => ({ draw: shuffle(s, [...p.deck]), discard: [] }));
  }
  function draw(e, s, shuffle) {
    const deck = e.bossDecks[e.componentPhase - 1];
    if (!deck.draw.length) { deck.draw = shuffle(s, deck.discard); deck.discard = []; }
    const action = deck.draw.shift(); deck.discard.push(action); return action;
  }
  function reshuffle(e, s, shuffle) {
    const deck = e.bossDecks[e.componentPhase - 1];
    deck.draw = shuffle(s, [...deck.draw, ...deck.discard]); deck.discard = [];
  }
  function valid(e) {
    return [1, 2].includes(e.componentPhase) && Array.isArray(e.bossDecks) &&
      e.bossDecks.length === 2 && e.bossDecks.every((deck, i) => {
        if (!Array.isArray(deck.draw) || !Array.isArray(deck.discard)) return false;
        const cards = [...deck.draw, ...deck.discard];
        return cards.length === 5 && [...new Set(phases[i].deck)].every((id) =>
          cards.filter((x) => x === id).length === phases[i].deck.filter((x) => x === id).length);
      }) && Number.isInteger(e.insightTokens) && e.insightTokens >= 0;
  }
  const api = { specimen, definition, createDecks, draw, reshuffle, valid };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBBossComponents = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
