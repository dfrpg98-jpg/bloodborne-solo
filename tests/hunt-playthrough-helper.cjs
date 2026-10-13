const E = require("../hunt-engine"),
  M = require("../chapter-engine");
function choose(s) {
  const h = E.hunter(s),
    card = h.hand[0]?.id,
    free = h.slots.map((x, i) => (x ? null : i)).filter((i) => i !== null),
    slot = free.sort((a, b) => E.slots(s)[b].damage - E.slots(s)[a].damage)[0];
  const a = (type, args = {}) => ({ type, ...args });
  const dodge = (extra) => {
    for (const x of h.hand)
      for (const i of free)
        if (E.canDodge(s, x.id, i, extra))
          return a(extra ? "EXTRA_DODGE" : "DODGE", { cardId: x.id, slot: i });
  };
  switch (s.phase) {
    case "hunter": {
      if (card && (h.echoes === 3 || h.hp <= 2))
        return a("DREAM", { cardId: card });
      const e = s.enemies.find((e) => e.node === h.position);
      if (card && e && slot !== undefined)
        return a("ATTACK", { cardId: card, slot, enemyId: e.id });
      if (card && slot === undefined) return a("TRANSFORM", { cardId: card });
      if (card && E.interactionOptions(s).loot && !e)
        return a("INTERACT", {
          cardId: card,
          lootCount: E.interactionOptions(s).loot,
        });
      if (card && s.world.tileDeck.length && E.canLeave(s, h.position))
        return a("MOVE", { cardId: card });
      if (card && s.enemies.length && !e) {
        return a("MOVE", { cardId: card });
      }
      return a("END_TURN");
    }
    case "move": {
      if (!E.canLeave(s, h.position)) return a("STOP_MOVE");
      if (s.world.tileDeck.length) {
        const exits = M.openExits(s.world),
          here = exits.find((x) => x.node === h.position);
        if (here) return a("EXPLORE", { edge: here.edge });
        const target = exits.sort(
          (a, b) =>
            E.distance(s, h.position, a.node) -
            E.distance(s, h.position, b.node),
        )[0];
        const next = target && E.path(s, h.position, target.node)[1];
        if (next) return a("STEP", { node: next });
      }
      const foe = s.enemies.sort(
        (a, b) =>
          E.distance(s, h.position, a.node) - E.distance(s, h.position, b.node),
      )[0];
      const next = foe && E.path(s, h.position, foe.node)[1];
      return next ? a("STEP", { node: next }) : a("STOP_MOVE");
    }
    case "tile_place":
      return a("PLACE_TILE", {
        rotation: M.placementOptions(
          s.world,
          s.world.pending.tileId,
          s.world.pending.anchor,
        )[0],
      });
    case "spawn_choice":
      return a("SPAWN_CHOICE", { enemyId: s.spawnChoices[0] });
    case "enemy_path":
      return a("ENEMY_STEP", { node: E.moveOptions(s)[0] });
    case "combat_choose":
      return card && slot !== undefined
        ? a("COUNTER", { cardId: card, slot })
        : a("NO_ATTACK");
    case "combat_react":
      return E.canFirearm(s) ? a("FIREARM") : dodge(false) || a("RESOLVE");
    case "combat_extra":
      return dodge(true) || a("EXTRA_TAKE");
    case "ability_choice":
      return a("ABILITY_CHOICE", card ? { cardId: card } : {});
    case "cheap_shot":
      return a("CHEAP_SHOT", {
        cardId: h.hand.find((x) => E.card(x).cheapShot).id,
      });
    case "card_choice": {
      const q = s.cardChoices[0];
      return a("CARD_CHOICE", {
        value:
          q.type === "discard"
            ? card
            : q.type === "status"
              ? Object.keys(h.status).find((k) => h.status[k])
              : h.slots.findIndex(Boolean),
      });
    }
    case "free_transform":
      return a("FREE_TRANSFORM", { accept: true });
    case "stun":
      return a("STUN_DISCARD", { cardId: card });
    case "activation":
      return a("ACTIVATE", { enemyId: E.eligible(s)[0].id });
    case "refill":
      return a("REFILL");
    case "return":
      return a("RETURN", {
        node: E.nodes(s)
          .filter((n) => n.lamp)
          .at(-1).id,
        face: 1,
      });
    case "upgrade_pick":
      return a("PICK_UPGRADE", { index: s.market.findIndex(Boolean) });
    case "upgrade_replace":
      return a("REPLACE_UPGRADE", {
        replaceId:
          h.deck.find((x) => !E.data.upgrades.includes(x.kind))?.id ||
          h.deck[0].id,
      });
    case "loot_choice":
      return a("LOOT_CHOICE", { itemId: s.lootChoice[0].id });
    default:
      throw Error("unhandled phase " + s.phase);
  }
}
module.exports = { choose };
