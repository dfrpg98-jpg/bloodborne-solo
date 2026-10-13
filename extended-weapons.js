(function (root) {
  "use strict";
  const source = typeof module !== "undefined" && module.exports
    ? require("./components/extended-weapons.json") : root.BBExtendedWeaponSource;
  if (!source) throw new Error("장치무기 원본 데이터가 로드되지 않았습니다.");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const weapons = Object.fromEntries(source.weapons.map((weapon) => [weapon.id, {
    ...clone(weapon), actual: true, temporary: false,
    sourceLabel: "사용자 제공 한국어 장치무기 양면 시트",
  }]));
  function definition(id) { return weapons[id] ? clone(weapons[id]) : null; }
  function applyTo(data) {
    return { ...data, weapons: { ...(data.weapons || {}), ...clone(weapons) } };
  }
  const api = { source, weapons, definition, applyTo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBExtendedWeapons = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
