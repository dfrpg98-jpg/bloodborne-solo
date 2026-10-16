(function (root) {
  "use strict";
  const cards = {
    endurance: {
      name: "기본 지구력",
      type: "endurance",
      text: "회피 · 이 슬롯을 비웁니다.",
      dodge: true,
      clear: true,
    },
    skill: {
      name: "기본 기술",
      type: "skill",
      text: "방해 · 더 느린 적의 공격을 취소합니다.",
      interrupt: true,
    },
    strength: {
      name: "기본 근력",
      type: "strength",
      text: "공격 피해 +1",
      damage: 1,
    },
    vitality: {
      name: "기본 활력",
      type: "vitality",
      text: "즉시 카드 1장을 뽑습니다.",
      draw: 1,
    },
    training_power: {
      name: "훈련 · 강격",
      type: "strength",
      text: "[테스트 카드] 공격 피해 +2",
      damage: 2,
    },
    training_step: {
      name: "훈련 · 발놀림",
      type: "endurance",
      text: "[테스트 카드] 회피 · 이 슬롯 비우기 · 치유 1",
      dodge: true,
      clear: true,
      heal: 1,
    },
    training_focus: {
      name: "훈련 · 집중",
      type: "vitality",
      text: "[테스트 카드] 카드 2장 뽑기",
      draw: 2,
    },
    training_break: {
      name: "훈련 · 끊기",
      type: "skill",
      text: "[테스트 카드] 방해 · 공격 피해 +1",
      interrupt: true,
      damage: 1,
    },
  };
  const data = {
    id: "bloodborne-consumables-0.3",
    name: "등불로 돌아오는 길",
    notice:
      "장송의 칼날·단총·기본 스탯·소모품 16종은 제공된 자료에 근거합니다. 적·지도·임무·업그레이드 시장은 테스트용입니다.",
    track: { length: 16, resets: [5, 9, 13, 16] },
    cards,
    firearm: {
      id: "hunter-pistol",
      name: "야수 사냥의 단총",
      ability: "적 하나가 기본 공격을 할 때 해당 적을 자동으로 방해합니다.",
      useNote:
        "발사는 직접 선택합니다. 사용하면 소진되며, 특수 공격·전용 능력에는 사용할 수 없습니다.",
      readyRule: "자신의 사냥꾼 차례에 손의 카드 1장을 버리면 다시 준비합니다.",
      dreamRule: "사냥꾼의 꿈에서 회복할 때도 다시 준비됩니다.",
    },
    weapon: {
      name: "훈련용 장치 무기",
      faces: [
        {
          name: "접은 형태",
          slots: [
            { name: "빠른 베기", speed: 3, damage: 1 },
            { name: "가로 베기", speed: 2, damage: 2 },
            { name: "내려찍기", speed: 1, damage: 3 },
          ],
        },
        {
          name: "펼친 형태",
          slots: [
            { name: "긴 베기", speed: 2, damage: 2 },
            { name: "강한 베기", speed: 1, damage: 3 },
            { name: "돌려 베기", speed: 1, damage: 3 },
          ],
        },
      ],
    },
    nodes: [
      {
        id: "c0",
        name: "시작 등불",
        tile: "central",
        x: 15,
        y: 48,
        lamp: true,
      },
      { id: "c1", name: "갈림길", tile: "central", x: 39, y: 48 },
      { id: "w0", name: "훈련 마당", tile: "west", x: 39, y: 19 },
      { id: "w1", name: "보급 장소", tile: "west", x: 73, y: 19, loot: true },
      { id: "e0", name: "봉인의 문", tile: "east", x: 63, y: 72 },
      { id: "e1", name: "봉인 제단", tile: "east", x: 87, y: 72, loot: true },
    ],
    edges: [
      ["c0", "c1"],
      ["c1", "w0"],
      ["w0", "w1"],
      ["c1", "e0"],
      ["e0", "e1"],
    ],
    enemies: {
      scout: {
        name: "훈련 감시자",
        maxHp: 3,
        order: 1,
        basic: { name: "찌르기", speed: 3, damage: 1 },
        special: { name: "둔기 치기", speed: 2, damage: 2, stun: true },
        ability: {
          name: "재정비",
          text: "즉시 자신의 체력을 1 회복합니다.",
          heal: 1,
        },
      },
      sentinel: {
        name: "훈련 파수꾼",
        maxHp: 4,
        order: 2,
        basic: { name: "무거운 일격", speed: 1, damage: 3, interrupt: true },
        special: { name: "오염된 발톱", speed: 3, damage: 1, poison: true },
        ability: {
          name: "공포의 시선",
          text: "즉시 사냥꾼에게 발광을 부여합니다. 공격이 아니므로 회피·방해할 수 없습니다.",
          frenzy: true,
        },
      },
    },
    spawns: [
      { id: "scout-1", kind: "scout", node: "w0" },
      { id: "sentinel-1", kind: "sentinel", node: "e0" },
    ],
    upgrades: [
      "training_power",
      "training_step",
      "training_focus",
      "training_break",
    ],
    ruleRefs: {
      setup: 8,
      move: 14,
      interact: 16,
      activation: 16,
      round: 18,
      combat: 19,
      dodge: 20,
      status: 21,
      dream: 23,
      reset: 24,
    },
  };
  const components =
    typeof module !== "undefined" && module.exports
      ? require("../components/cards.js")
      : root.BBComponents;
  data.consumables = Object.fromEntries(
    components.cards
      .filter((c) => c.group === "consumable")
      .map((c) => [c.id, c]),
  );
  data.components = components;
  // Explicit user-authorized test substitutes; retain the weapon names.
  data.firearms = { "hunter-pistol": data.firearm };
  for (const [id, name] of [["ludwig-rifle", "루드비히의 장총"], ["repeating-pistol", "교단의 연발총"], ["flamesprayer", "화염방사기"]]) {
    data.firearms[id] = { ...data.firearm, id, name, temporary: true,
      useNote: "테스트용 임시 규칙 · 야수 사냥의 단총과 같은 능력·소진·준비 조건을 사용합니다. 실제 화기 능력이 아닙니다.",
      source: "사용자 지시 · 2026-10-11 16:36 KST" };
  }
  // Keep the original fixture available for regression tests and comparison.
  data.weapons = {
    training: data.weapon,
    burial: {
      name: "장송의 칼날",
      source: "사용자 제공 사진 4장 및 전사문 (2026-10-11)",
      faces: [
        {
          name: "앞면 · 칼날 형태",
          text: "공격 속도로, 1칸 이내에 있는 다른 모든 적에게 1피해를 줍니다.",
          splash: { range: 1, damage: 1 },
          slots: [
            { name: "재빠른 저미기", speed: 3, damage: 1 },
            { name: "긋기", speed: 2, damage: 2 },
            { name: "긋기", speed: 2, damage: 2 },
          ],
        },
        {
          name: "뒷면 · 낫 형태",
          text: "공격하기 전에, 2칸 이내의 적 중 원하는 만큼을 당신이 위치한 칸으로 이동시킬 수 있습니다.",
          pullRange: 2,
          slots: [
            { name: "긋기", speed: 2, damage: 2 },
            { name: "원호 가르기", speed: 1, damage: 3 },
            { name: "원호 가르기", speed: 1, damage: 3 },
          ],
        },
      ],
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.BBData = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
