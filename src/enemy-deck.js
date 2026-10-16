(function (root) {
  "use strict";
  // One shared six-card deck for every enemy; printed rulebook p.20.
  const composition = Object.freeze({ basic: 3, special: 2, ability: 1 });
  const labels = Object.freeze({
    basic: "기본 공격",
    special: "특수 공격",
    ability: "전용 능력",
  });
  function create(s, shuffle) {
    return shuffle(
      s,
      Object.entries(composition).flatMap(([kind, count]) =>
        Array(count).fill(kind),
      ),
    );
  }
  function draw(s, shuffle) {
    // Recycle only when another draw is needed and the draw pile is empty.
    // The last revealed card remains public in the discard until that moment.
    if (!s.enemyDeck.length) {
      s.enemyDeck = shuffle(s, s.enemyDiscard);
      s.enemyDiscard = [];
    }
    if (!s.enemyDeck.length) throw new Error("적 행동 덱이 비어 있습니다.");
    const kind = s.enemyDeck.shift();
    s.enemyDiscard.push(kind);
    return kind;
  }
  function counts(cards) {
    return Object.fromEntries(
      Object.keys(composition).map((kind) => [
        kind,
        cards.filter((x) => x === kind).length,
      ]),
    );
  }
  function valid(s) {
    if (!Array.isArray(s.enemyDeck) || !Array.isArray(s.enemyDiscard))
      return false;
    const cards = [...s.enemyDeck, ...s.enemyDiscard],
      totals = counts(cards);
    return (
      cards.length === 6 &&
      Object.entries(composition).every(([kind, n]) => totals[kind] === n)
    );
  }
  const api = { composition, labels, create, draw, counts, valid };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBEnemyDeck = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
