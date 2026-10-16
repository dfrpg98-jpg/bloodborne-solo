(function (root) {
  "use strict";
  const source = typeof module !== "undefined" && module.exports
    ? require("../components/extended-firearms.json") : root.BBExtendedFirearmSource;
  if (!source) throw new Error("추가 화기 원본 데이터가 로드되지 않았습니다.");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const firearms = Object.fromEntries(source.firearms.map((gun) => [gun.id, {
    ...clone(gun), actual: true, temporary: false, sourceLabel: gun.source.title,
    text: gun.rules[0], ability: gun.rules[0], prepareText: gun.rules[1], readyRule: gun.rules[1],
  }]));
  function firearm(id) { return firearms[id] ? clone(firearms[id]) : null; }
  const api = { source, firearms, firearm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBExtendedFirearms = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
