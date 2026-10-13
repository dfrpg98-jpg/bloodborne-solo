(function (root) {
  "use strict";
  const source = typeof module !== "undefined" && module.exports
    ? require("./components/supplied-components.json") : root.BBSuppliedComponents;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const attack = (printed, kind, extra = {}) => ({
    ...clone(printed), kind, type: "attack", poison: printed.keywords.includes("독"),
    stun: printed.keywords.includes("기절"), interrupt: printed.keywords.includes("방해"),
    undodgeable: false, uninterruptible: false, followup: false, ...extra,
  });
  const ability = (printed, code) => ({ ...clone(printed), kind: "ability",
    type: "ability", speed: null, damage: 0, code });
  const specimens = Object.fromEntries(source.enemyCards.map((card) => [card.id, clone(card)]));
  function definition(id, phase = 1, order = 1) {
    const card = specimens[id];
    if (!card) return null;
    if (phase !== 1) throw new Error("이 실물 적은 페이즈 전환을 하지 않습니다.");
    const isIosefka = id === "iosefka-hostile", health = isIosefka ? card.healthByHunterCount[1] : card.health;
    const face = isIosefka ? card.source.faces[0] : card.source;
    return {
      id, name: card.name, boss: false, npcEnemy: isIosefka,
      baseKind: isIosefka ? "huntsmans-minion" : "huntsman-mob",
      health, maxHp: health, move: 1, pursuit: 1, order,
      sideId: isIosefka ? "1-2" : card.sideId,
      face: { id: isIosefka ? "1-2" : card.sideId, image: face.image,
        imageBase: "project", position: face.position },
      actual: true, temporary: false, source: clone(card.source), sourceLabel: card.source.title,
      basic: attack(card.basic, "basic"),
      special: attack(card.special, "special", isIosefka
        ? { code: "iosefka-augur", allHunters: true, forceHunterMove: 1 }
        : id === "female-patient-a" ? { code: "female-fury" }
          : { code: "female-vomit", undodgeable: true }),
      ability: ability(card.ability, isIosefka ? "iosefka-pistol" : "female-blood-disease"),
    };
  }
  const firearms = Object.fromEntries(source.firearms.map((gun) => [gun.id, {
    ...clone(gun), actual: true, temporary: false, sourceLabel: gun.source.title,
    text: gun.rules[0], prepareText: gun.rules[1],
  }]));
  function firearm(id) { return firearms[id] ? clone(firearms[id]) : null; }
  const api = { source, specimens, definition, firearms, firearm,
    composition: clone(source.sharedEnemyDeck.composition) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBActualComponents = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
