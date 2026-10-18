"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), Help = require("../src/game-help"),
  { fixture, bossAction, attack } = require("./actual-combat-helper.cjs"),
  { boot } = require("./helpers/ui-harness.cjs"), { choose } = require("./helpers/combat-selection-ui.cjs");
const key = "bloodborne-hunt-v07", root = path.join(__dirname, "..");
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: JSON.stringify(state) }, engine: { ...E,
      importSave: text => JSON.parse(text), exportSave: state => JSON.stringify(state),
      applyTileSpeedRuling: state => state, applyChapelRuling: state => state,
      applyCombatReactionRuling: state => state },
  });
}
function reaction() {
  return attack(bossAction(fixture("cleric-beast", 1, ["strength", "endurance", "vitality"], { rulesVersion: 14 }), "slam"), 0);
}
function command(ui, type) {
  const button = ui.buttons("decisions").find(button => button.dataset.command === type);
  assert(button, type); return button;
}

test("the reading-region focus rule suppresses native boxes without suppressing action-control or window-handle focus", () => {
  const css = fs.readFileSync(path.join(root, "styles/hunt.css"), "utf8"),
    rule = css.match(/\.hunt-screen\s+:is\(([^)]+)\):focus([^{}]*)\{([^}]+)\}/);
  assert(rule, "scrollable reading regions have an explicit focus policy");
  assert.deepEqual(rule[1].split(",").map(value => value.trim()).sort(), ["div", "h2", "p", "section"]);
  assert.match(rule[3], /outline:\s*none/);
  for (const role of ["button", "tab", "option"]) assert(rule[2].includes(`:not([role="${role}"])`));
  assert(rule[2].includes(":not(.hunt-window-handle)"));
  assert.doesNotMatch(css, /(?:\*|\.hunt-screen)\s*:focus(?:-visible)?\s*\{[^}]*outline:\s*none/);
  assert.match(css, /\.hunt-screen button:focus-visible[^{}]*input:focus-visible[^{}]*summary:focus-visible\s*\{[^}]*outline:\s*2px solid #f0d695/);
  assert.match(css, /\.hunt-screen \.hunt-window-handle:focus-visible\s*\{[^}]*outline:\s*2px solid #f0d695/);
  assert.match(css, /#phaseHelp:empty\s*\{\s*display:\s*none\s*;/, "an omitted instruction also releases its blank margins");
});

test("ordinary combat omits the repeated dodge tutorial while preserving its live calculation and real resolution", () => {
  const state = reaction(), ui = launch(state), before = ui.storage.get(key),
    card = E.hunter(state).hand.find(card => card.kind === "endurance");
  assert.equal(state.phase, "combat_react"); assert.equal(ui.el("phaseHelp").textContent, "");
  assert.match(ui.el("combatInfo").innerHTML, /내려찍기|피해/);
  choose(ui, "card", card.id); choose(ui, "slot", 1);
  assert.match(ui.el("combatSelection").innerHTML, /슬롯 속도 2 \+ 카드 0 = 회피 속도 <b>2<\/b>/);
  assert.equal(ui.el("phaseHelp").textContent, ""); assert.equal(ui.storage.get(key), before);
  assert.equal(command(ui, "DODGE").disabled, false); command(ui, "DODGE").click();
  const avoided = E.dispatch(state, { type: "DODGE", cardId: card.id, slot: 1 });
  assert.deepEqual(JSON.parse(ui.storage.get(key)), avoided);
  assert.equal(ui.el("phaseHelp").textContent, "");
  assert.match(ui.el("decisions").innerHTML, />회피 선택됨<\/button>/);
  assert.match(ui.el("decisions").innerHTML, /data-command="RESOLVE"[^>]*>전투 처리<\/button>/);
  command(ui, "RESOLVE").click();
  assert.deepEqual(JSON.parse(ui.storage.get(key)), E.dispatch(avoided, { type: "RESOLVE" }));
  assert.equal(E.hunter(JSON.parse(ui.storage.get(key))).hp, 6);
  assert.equal(ui.el("error").textContent, "");
});

test("the full dodge sequence remains available in help rather than the ongoing combat pane", () => {
  const ui = launch(reaction()), html = Help.renderHTML();
  assert.equal(ui.el("phaseHelp").textContent, "");
  assert.match(html, /회피 카드 → 현재 빈 슬롯 → ‘회피’/);
  assert.match(html, /카드·슬롯 선택만으로 회피가 적용되지 않습니다/);
  assert.match(html, /‘전투 처리’/);
});
