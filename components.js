(function () {
  "use strict";
  const cards = window.BBComponents.cards.filter((card) =>
    ["basic", "consumable", "upgrade"].includes(card.group) && card.runtime === "playable"),
    $ = (id) => document.getElementById(id),
    groups = { basic: "기본 스탯", consumable: "소모품", upgrade: "업그레이드" },
    stats = { strength: "근력", skill: "기술", endurance: "지구력", vitality: "활력" };
  function node(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function render() {
    const query = $("query").value.trim().toLocaleLowerCase(), group = $("group").value,
      found = cards.filter((card) => (group === "all" || card.group === group) &&
        [card.name, card.rules, card.timing, card.flavor || ""].join(" ").toLocaleLowerCase().includes(query));
    $("resultCount").textContent = `${found.length}종`;
    $("cards").replaceChildren();
    if (!found.length) $("cards").append(node("p", "조건에 맞는 카드가 없습니다.", "empty"));
    for (const card of found) {
      const article = node("article", "", "component-card");
      article.dataset.id = card.id;
      article.append(
        node("p", `${groups[card.group]}${card.stat ? " · " + stats[card.stat] : ""}`, "meta"),
        node("h2", card.name), node("p", card.timing, "timing"), node("p", card.rules, "effect"));
      if (card.flavor) article.append(node("p", card.flavor, "flavor"));
      $("cards").append(article);
    }
  }
  $("query").oninput = render;
  $("group").onchange = render;
  render();
})();
