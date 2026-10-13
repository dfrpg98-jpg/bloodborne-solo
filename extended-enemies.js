(function (root) {
  "use strict";
  const source = typeof module !== "undefined" && module.exports
    ? require("./components/extended-enemies.json") : root.BBExtendedEnemySource;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const specimens = Object.fromEntries(source.enemyCards.map((printed) => [printed.id, clone(printed)]));
  const generalIds = source.enemyCards.filter((card) => card.sideRole === "random-chapter-face").map((card) => card.id);
  const npcIds = source.enemyCards.filter((card) => card.sideRole === "hunter-count").map((card) => card.id);
  function normalizeSide(id, side = "a", hunterCount = 1) {
    const card = specimens[id];
    if (!card) return null;
    if (!Number.isInteger(hunterCount) || hunterCount < 1 || hunterCount > 4)
      throw new Error("사냥꾼 수는 1~4명 사이의 정수여야 합니다.");
    if (card.sideRole === "hunter-count") return hunterCount <= 2 ? "1-2" : "3+";
    if (!["a", "b"].includes(side)) throw new Error("일반 적의 A면 또는 B면을 선택하세요.");
    return side;
  }
  function action(printed, kind) {
    const value = clone(printed);
    return {
      ...value, kind, type: kind === "ability" || value.whiteBackground ? "ability" : "attack",
      poison: value.keywords.includes("독"), frenzy: value.keywords.includes("발광"),
      stun: value.keywords.includes("기절"), interrupt: value.keywords.includes("방해"),
      undodgeable: !!value.undodgeable, uninterruptible: !!value.uninterruptible,
      followup: false, extended: true,
    };
  }
  function definition(id, options = {}) {
    const card = specimens[id];
    if (!card) return null;
    if (typeof options === "string") options = { side: options };
    const { side = "a", hunterCount = 1, order = 1 } = options;
    const sideId = normalizeSide(id, side, hunterCount);
    const face = card.faces.find((candidate) => candidate.sideId === sideId);
    return {
      id, name: card.name, boss: false, npcEnemy: card.sideRole === "hunter-count",
      baseKind: "huntsman-mob", health: face.health, maxHp: face.health,
      move: 1, pursuit: 1, order, sideId, sideRole: card.sideRole,
      extended: true, actual: true, temporary: false,
      // Reference photographs remain in the user's local source folder. Runtime
      // cards use this transcription and do not depend on a photograph URL.
      face: { id: sideId, image: null, imageBase: "project", position: face.source.position },
      source: clone(face.source), sourceLabel: `${face.source.filename} · ${face.source.position}`,
      basic: action(face.basic, "basic"), special: action(face.special, "special"),
      ability: action(face.ability, "ability"),
    };
  }
  function printedFaces(id) { return specimens[id] ? clone(specimens[id].faces) : []; }
  const api = { source, specimens, generalIds, npcIds, normalizeSide, definition, printedFaces };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBExtendedEnemies = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
