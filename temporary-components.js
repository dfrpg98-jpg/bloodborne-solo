(function (root) {
  "use strict";
  // These values are deliberately authored test fixtures, not transcriptions.
  // Replace this adapter after the user supplies the actual component sheets.
  const notice = "사용자 요청으로 만든 임시 수치·효과입니다. 실제 카드 자료를 옮긴 내용이 아니며 챕터 2~3의 정식 규칙 검증에 사용하지 않습니다.";
  const action = (name, kind, speed, damage, extra = {}) => ({
    name, kind, type: "attack", speed, damage, rules: [], stun: false,
    interrupt: false, undodgeable: false, uninterruptible: false,
    followup: false, ...extra,
  });
  const specimens = {
    "cleric-beast": {
      name: "성직자 야수 · 임시", baseKind: "scourge-beast", boss: true,
      phases: [
        { maxHp: 6, basic: action("임시 · 팔 휘두르기", "basic", 2, 2),
          special: action("임시 · 내려치기", "special", 1, 3, { stun: true }),
          ability: action("임시 · 포효 공격", "ability", 3, 1, { interrupt: true }) },
        { maxHp: 8, basic: action("임시 · 광폭 휘두르기", "basic", 2, 3),
          special: action("임시 · 연속 내려치기", "special", 1, 4, { stun: true }),
          ability: action("임시 · 광폭 돌진", "ability", 3, 2, { interrupt: true }) },
      ],
    },
    "female-patient-a": {
      name: "여성 야수 환자 A · 임시", baseKind: "huntsman-mob", boss: false,
      phases: [{ maxHp: 4, basic: action("임시 · 할퀴기", "basic", 2, 1),
        special: action("임시 · 깊은 할퀴기", "special", 3, 2),
        ability: action("임시 · 날카로운 울음", "ability", 1, 2, { stun: true }) }],
    },
    "female-patient-b": {
      name: "여성 야수 환자 B · 임시", baseKind: "huntsman-mob", boss: false,
      phases: [{ maxHp: 5, basic: action("임시 · 할퀴기", "basic", 2, 2),
        special: action("임시 · 덮치기", "special", 1, 3),
        ability: action("임시 · 울부짖기", "ability", 3, 1, { interrupt: true }) }],
    },
    iosefka: { name: "이오세프카 · 임시", npc: true,
      interaction: { heal: 2, statCost: 1, text: "중앙 등불 칸에서 카드 1장을 버려 치유 2를 합니다." } },
  };
  function definition(id, phase = 1, order = 1) {
    const d = specimens[id];
    if (!d || d.npc) return null;
    const p = d.phases[phase - 1];
    if (!p) throw new Error("임시 적 페이즈를 확인하세요.");
    return { ...JSON.parse(JSON.stringify(p)), name: d.name,
      id: id, boss: d.boss, move: 1, pursuit: 1, order,
      sideId: "temporary", temporary: true, source: notice,
      health: p.maxHp, face: { id: "temporary", image: null } };
  }
  const api = { specimens, notice, definition };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBTemporaryComponents = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
