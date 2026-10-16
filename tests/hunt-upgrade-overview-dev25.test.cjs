"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), U = require("../src/hunt-upgrade-overview");
const create = () => E.create(903, "burial", 0, null, "hunter-pistol", "center", { campaign: true });

test("the public upgrade overview is available outside the dream and contains exactly the four public market entries", () => {
  const state = create(), before = E.exportSave(state), model = U.view(state, E);
  assert.equal(E.hunter(state).inDream, false); assert.equal(model.market.length, 4);
  assert.deepEqual(model.market.map(card => card.id), state.market);
  for (const card of model.market) {
    assert.equal(card.name, E.data.cards[card.id].name); assert.equal(card.text, E.data.cards[card.id].text);
    assert.equal(card.kind, E.data.cards[card.id].type);
  }
  assert.equal(model.total, 12); assert.equal(model.deck.length, 4);
  assert(model.deck.every(card => card.count === 3));
  assert.equal(E.exportSave(state), before);
});
test("deck composition counts hand, draw, discard and occupied slots once per instance and hides draw order", () => {
  const state = create(), hunter = E.hunter(state);
  const discarded = hunter.hand.pop(), occupied = hunter.deck.pop();
  hunter.discard.push(discarded); hunter.slots[0] = { ...occupied, faceDown: true };
  const correct = U.view(state, E);
  assert.equal(correct.total, 12);
  // A repeated reference in a transient presentation fixture must not become
  // a thirteenth card in the player's deck.
  hunter.hand.push({ ...discarded }); hunter.deck.push({ ...occupied });
  assert.deepEqual(U.view(state, E), correct);
  hunter.hand.reverse(); hunter.deck.reverse(); hunter.discard.reverse();
  assert.deepEqual(U.view(state, E), correct);
  assert(correct.deck.every(card => !Object.hasOwn(card, "id") && !Object.hasOwn(card, "zone")));
});
test("the overview never reads hidden upgrade cards or exposes entries beyond the four public slots", () => {
  const state = create(); state.market.push("secret-should-not-appear");
  Object.defineProperty(state, "upgradeDeck", { get() { throw new Error("hidden upgrade deck accessed"); } });
  const model = U.view(state, E);
  assert.equal(model.market.length, 4); assert.doesNotMatch(JSON.stringify(model), /secret-should-not-appear|upgradeDeck/);
});
test("empty market slots remain visible and obtaining an upgrade changes only the public composition", () => {
  let state = create(); const hunter = E.hunter(state), marketId = state.market[0];
  hunter.hand.push({ id: "owned-upgrade", kind: marketId }); state.market[0] = null;
  const model = U.view(state, E);
  assert.deepEqual(model.market[0], { id: null, name: "빈 칸", kind: "empty", text: "" });
  assert.equal(model.total, 13); assert.equal(model.deck.find(card => card.cardId === marketId).count, 1);
  assert.match(U.renderHTML(model), /is-empty/);
});
test("rendering is read-only, safely escapes content and keeps deck composition collapsed by default", () => {
  const html = U.renderHTML({ market: [{ id: "x", name: '<b>공개 기술</b>', kind: '" onclick="bad()', text: "설명 & 효과" }],
    deck: [{ cardId: "x", name: "보유 기술", kind: "skill", text: "공격 피해 +1", count: 2 }], total: 2 }, { clean: value => value.replace("공격 피해", "피해") });
  assert.match(html, /&lt;b&gt;공개 기술&lt;\/b&gt;/); assert.match(html, /설명 &amp; 효과/); assert.match(html, /피해 \+1/);
  assert.match(html, /내 덱 구성 · 2장/); assert.match(html, /data-skill-kind="other"/);
  assert.doesNotMatch(html, /<button|data-command|<select|<input|onclick=|<details[^>]+\bopen\b/);
  assert.deepEqual(U.view(null, E), { market: [], deck: [], total: 0 });
});
test("upgrade selection can render the same owned deck overview without duplicating market choice cards", () => {
  const html = U.renderHTML(U.view(create(), E), { market: false });
  assert.match(html, /내 덱 구성 · 12장/); assert.match(html, /upgrade-deck-list/);
  assert.doesNotMatch(html, /upgrade-market-grid|공개된 업그레이드|upgrade-overview-card/);
});
