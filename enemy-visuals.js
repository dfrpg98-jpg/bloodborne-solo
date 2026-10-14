(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BBEnemyVisuals = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const names = Object.freeze({
    "huntsman-mob": "야수 사냥 무리", "huntsmans-minion": "야수 사냥 하인",
    "scourge-beast": "재앙의 야수", "female-patient": "여성 야수환자",
    iosefka: "이오세프카", "cleric-beast": "성직자 야수",
  });
  const aliases = Object.freeze({
    "female-patient-a": "female-patient", "female-patient-b": "female-patient",
    "iosefka-hostile": "iosefka",
  });
  function named(value) {
    if (typeof value !== "string") return null;
    return Object.hasOwn(names, value) ? value : Object.hasOwn(aliases, value) ? aliases[value] : null;
  }
  function generic(enemy, definition) {
    if (definition.boss) return "boss";
    if (definition.npcEnemy) return "female";
    if (/beast|dog|hound|crow|spider|rat/i.test(enemy.kind || "") ||
      /야수|사냥개|늑대|까마귀|거미|쥐/.test(definition.name || "") &&
      !/야수.?사냥/.test(definition.name || "")) return "beast";
    return "mob";
  }
  function skin(enemy, definition = {}) {
    if (!enemy || typeof enemy !== "object") return "mob";
    if (!definition || typeof definition !== "object") definition = {};
    // Mission and practice actors reuse the three ordinary rule kinds. Resolve
    // their public component identity before that kind, without reading rules.
    for (const value of [enemy.componentId, enemy.componentSpec, enemy.provisionalKind, enemy.extendedId]) {
      const selected = named(value);
      if (selected) return selected;
    }
    // Other supplied enemies keep their own generic fallback. Their base rule
    // kind must not dress a church servant or hunter as a named Yharnam enemy.
    if (enemy.componentId || enemy.componentSpec || enemy.provisionalKind || enemy.extendedId)
      return generic(enemy, definition);
    return named(enemy.kind) || generic(enemy, definition);
  }
  return Object.freeze({ skin, ids: Object.freeze(Object.keys(names)), names });
});
