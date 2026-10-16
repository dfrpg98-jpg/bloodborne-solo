const assert = require("node:assert/strict");
const E = require("../src/hunt-engine.js"), B = require("../src/boss-components.js"), A = require("../src/actual-components.js");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function hand(s, kinds) {
  const h = E.hunter(s); h.deck = [...h.hand, ...h.deck]; h.hand = [];
  for (const kind of kinds) {
    const i = h.deck.findIndex((c) => c.kind === kind);
    if (i >= 0) h.hand.push(...h.deck.splice(i, 1));
    else {
      const replaced = h.deck.shift(); s.removedCards.push(replaced.kind);
      const j = s.upgradeDeck.indexOf(kind);
      if (j >= 0) s.upgradeDeck.splice(j, 1);
      else { const k = s.market.indexOf(kind); assert(k >= 0);
        s.market[k] = s.upgradeDeck.shift() || null; }
      h.hand.push({ id: `card-${++s.uid}`, kind });
    }
  }
  return s;
}
function fixture(spec = "cleric-beast", phase = 1, cards = ["strength", "endurance", "vitality"], opts = {}) {
  const s = E.create(123, "burial", opts.face || 0, opts.item || null,
    opts.firearm || "hunter-pistol", "center", { campaign: false, rulesVersion: opts.rulesVersion || 9 });
  const boss = spec === "cleric-beast", d = boss ? B.definition(spec, phase) : A.definition(spec),
    e = { id: "mission-unit", missionId: "unit", componentId: boss ? spec : spec.startsWith("female") ? "female-patient" : "iosefka",
      componentSpec: spec, componentPhase: phase, kind: boss ? "scourge-beast" : d.baseKind,
      figure: 1, node: E.hunter(s).position, hp: d.maxHp };
  if (boss) { e.actualComponent = true; e.insightTokens = 0;
    e.bossDecks = B.createDecks(spec, s, (_, xs) => xs); }
  s.enemies = [e]; s.loot = []; hand(s, cards); E.assertState(s); return s;
}
function bossAction(s, id) {
  const e = s.enemies[0], deck = e.bossDecks[e.componentPhase - 1],
    cards = [...deck.draw, ...deck.discard], i = cards.indexOf(id);
  assert(i >= 0); cards.splice(i, 1); deck.draw = [id, ...cards]; deck.discard = [];
  return s;
}
function enemyAction(s, ...ids) {
  const all = ["basic", "basic", "basic", "special", "special", "ability"];
  for (const id of ids) all.splice(all.indexOf(id), 1);
  s.enemyDeck = [...ids, ...all]; s.enemyDiscard = []; return s;
}
function attack(s, slot = 0, args = {}) {
  return go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: E.hunter(s).hand[0].id, slot, ...args });
}
function dodge(s, slot = 0) {
  return go(s, "DODGE", { cardId: E.hunter(s).hand.find((c) => E.card(c).dodge).id, slot });
}
function chapter(n, previous = [], seed = 17) {
  let s = E.create(seed, "burial", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 9 });
  for (let c = 2; c <= n; c++) {
    s.mission.won = true; s.phase = "between_chapters"; s.mission.completed = c === 2 ? previous : [];
    s = go(s, "START_NEXT_CHAPTER", { startSpace: "center" });
  }
  return s;
}
module.exports = { E, B, A, go, hand, fixture, bossAction, enemyAction, attack, dodge, chapter };
