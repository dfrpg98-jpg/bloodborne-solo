const { test } = require("node:test"),
  assert = require("node:assert/strict");
const E = require("../engine.js"),
  ED = require("../enemy-deck.js");
const send = (s, type, a = {}) => E.dispatch(s, { type, ...a });
function combat(kind, gun = "hunter-pistol") {
  let s = E.create(91, "burial", 0, null, gun);
  E.hunter(s).position = "w0";
  const cards = ["basic", "basic", "basic", "special", "special", "ability"];
  cards.splice(cards.indexOf(kind), 1);
  s.enemyDeck = [kind, ...cards];
  return send(s, "ATTACK", {
    enemyId: "scout-1",
    cardId: E.hunter(s).hand[0].id,
    slot: 0,
  });
}
test("all four firearms allow only basic attacks and reject special/ability atomically", () => {
  for (const gun of Object.keys(E.data.firearms))
    for (const kind of Object.keys(ED.composition)) {
      const s = combat(kind, gun),
        before = JSON.stringify(s);
      assert.equal(E.canFirearm(s), kind === "basic");
      if (kind === "basic") {
        const next = send(s, "FIREARM");
        assert.equal(next.combat.cancelEnemy, true);
        assert.equal(E.hunter(next).firearmReady, false);
        assert.equal(E.canFirearm(next), false);
        assert.throws(() => send(next, "FIREARM"));
      } else assert.throws(() => send(s, "FIREARM"), /기본 공격/);
      assert.equal(JSON.stringify(s), before);
    }
});
test("firearm cannot fire before reveal, while exhausted, or after combat ends", () => {
  const s = E.create();
  assert.equal(E.canFirearm(s), false);
  assert.throws(() => send(s, "FIREARM"));
  const c = combat("basic");
  E.hunter(c).firearmReady = false;
  assert.equal(E.canFirearm(c), false);
  assert.throws(() => send(c, "FIREARM"), /소진/);
});
test("six behavior cards stay in discard until the seventh draw needs a shuffle", () => {
  let shuffled = 0;
  const shuffle = (s, a) => {
    shuffled++;
    return a.reverse();
  };
  const s = {
    enemyDeck: ["basic", "special", "basic", "ability", "special", "basic"],
    enemyDiscard: [],
  };
  const first = Array.from({ length: 6 }, () => ED.draw(s, shuffle));
  assert.equal(shuffled, 0);
  assert.deepEqual(ED.counts(first), ED.composition);
  assert.equal(s.enemyDeck.length, 0);
  assert.equal(s.enemyDiscard.length, 6);
  assert(ED.valid(s));
  assert.equal(ED.draw(s, shuffle), "basic");
  assert.equal(shuffled, 1);
  assert.equal(s.enemyDeck.length, 5);
  assert.equal(s.enemyDiscard.length, 1);
  assert(ED.valid(s));
});
test("training command replay preserves exact saved state after deck extraction", () => {
  let s = E.create(99);
  s = send(s, "MOVE", { cardId: E.hunter(s).hand[0].id });
  s = send(s, "STEP", { node: "c1" });
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
