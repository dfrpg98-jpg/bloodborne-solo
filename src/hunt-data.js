(function (root) {
  "use strict";
  const base =
    typeof module !== "undefined" && module.exports
      ? require("./data.js")
      : root.BBData;
  const campaign =
    typeof module !== "undefined" && module.exports
      ? require("../campaigns/long-hunt/data.json")
      : root.BBLongHunt;
  const data = {
    ...base,
    id: "bloodborne-hunt-0.5",
    name: "기나긴 사냥 · 실제 지도 전투",
    cards: Object.fromEntries(
      Object.entries(base.cards).filter(([id]) => !id.startsWith("training_")),
    ),
    enemies: Object.fromEntries(
      campaign.enemies.map((e) => [e.id, { ...e, maxHp: e.health }]),
    ),
    upgrades: [],
    campaign,
  };
  const extended = typeof module !== "undefined" && module.exports
    ? require("./extended-weapons.js") : root.BBExtendedWeapons;
  // Keep base data intact for the older training engine and recorded saves.
  data.weapons = { ...base.weapons };
  Object.assign(data, extended.applyTo(data));
  const guns = typeof module !== "undefined" && module.exports
    ? require("./extended-firearms.js") : root.BBExtendedFirearms;
  data.firearms={...base.firearms};
  for(const [id,gun] of Object.entries(guns.firearms))
    if(!data.firearms[id]) data.firearms[id]={...base.firearm,id,name:gun.name,temporary:true};
  const effects = {
    leap: { damage: 1, leap: true },
    bloodlust: { damage: 1, onKill: { draw: 1, heal: 1 } },
    regain: { damage: 1, afterAttackHeal: 2 },
    nimble: { damage: 1, speed: 1 },
    poised: { damage: 1, immune: ["interrupt", "stun"] },
    agile: { interrupt: true, speed: 1 },
    steadfast: { interrupt: true, draw: 1 },
    "cheap-shot": { interrupt: true, cheapShot: true },
    visceral: { interrupt: true, damage: 1 },
    adaptive: { interrupt: true, dodge: true, clear: true },
    "swift-transform": { dodge: true, freeTransform: true },
    sprint: { dodge: true, clear: true, move: 3 },
    tactical: { dodge: true, speed: 1, clear: true },
    counterstrike: { dodge: true, afterDodgeDamage: 2 },
    energized: { dodge: true, heal: 1, clearChoice: true },
    defensive: { defense: 2 },
    rest: { nonAttackHeal: 2 },
    quick: { dodge: true, draw: 1, clear: true },
    indomitable: { draw: 1, immune: ["poison", "frenzy", "interrupt", "stun"] },
    tenacious: { draw: 2, discardAfterDraw: 1, removeStatus: true },
  };
  for (const c of base.components.cards.filter((c) => c.group === "upgrade")) {
    data.cards[c.id] = {
      name: c.name,
      type: c.stat || c.category,
      text: c.rules,
      ...effects[c.id],
    };
    data.upgrades.push(c.id);
  }
  const types = ["strength", "skill", "endurance", "vitality"];
  data.upgrades.forEach(
    (id, i) => (data.cards[id].type = types[Math.floor(i / 5)]),
  );
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.BBHuntData = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
