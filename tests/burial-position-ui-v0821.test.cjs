"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), E = require("../src/hunt-engine"),
  { boot } = require("./helpers/ui-harness.cjs"), { checkpoint } = require("./helpers/attack-position-qa.cjs");
const key = "bloodborne-hunt-qa-v1", H = E.hunter;
function launch(s) {
  const ui = boot(s, E.missionView(s), E.rewardsView(s), { engine: { ...E },
    storage: { [key]: E.exportSave(s), "bloodborne-hunt-active-mode": "qa" } });
  return ui;
}
function change(ui, id, value) { const el = ui.el(id); assert(el, id); el.value = String(value); el.fire("change"); }
function target(ui, id) {
  const button = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === id);
  assert(button, id); button.click();
}
function hud(ui) { return ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]").map(el => el.dataset.statusEnemy); }
function command(ui, type) {
  const button = ui.buttons("decisionActions").find(button => button.dataset.command === type);
  assert(button && !button.disabled, type); button.click(); assert.equal(ui.el("error").textContent, "");
}

test("canonical QA: pull checkbox shows chapel modifier before commitment; target HUD/save stay unchanged until actual pull", () => {
  const s = checkpoint(1), ui = launch(s), before = ui.storage.get(key), id = "huntsmans-minion-1";
  assert.deepEqual(hud(ui), []); target(ui, id); assert.deepEqual(hud(ui), [id]);
  const pull = ui.el("decisions").querySelectorAll("[data-pull]").find(el => el.dataset.pull === id);
  assert(pull); pull.checked = true; pull.fire("change");
  assert.match(ui.el("mapContext").innerHTML, /끌어온 뒤: 오에돈 예배당 · 적 공격 속도 -1/);
  assert.doesNotMatch(ui.el("decisions").innerHTML, /끌어온 뒤:/, "selected target has one hint in the visible context header");
  change(ui, "combatSelectCard", H(s).hand.find(card => card.kind === "vitality").id);
  change(ui, "combatSelectSlot", 0);
  assert.equal(ui.storage.get(key), before, "selection-only QA export stays byte-identical");
  assert.deepEqual(hud(ui), [id]);
  command(ui, "ATTACK");
  const after = E.importSave(ui.storage.get(key)), enemy = after.enemies.find(enemy => enemy.id === id);
  assert.equal(enemy.node, H(after).position); assert.equal(E.node(after, enemy.node).tile, "tile-17");
  assert.equal(E.enemyTileSpeedPenalty(after, enemy), 1);
  assert(after.commands.at(-1).pullIds.includes(id));
  assert.doesNotMatch(ui.el("mapContext").innerHTML + ui.el("decisions").innerHTML, /끌어온 뒤:/, "committed selection leaves no stale pull preview");
});

test("canonical QA: area count excludes the current main target and refreshes/clears through real target/card handlers", () => {
  const s = checkpoint(0), ui = launch(s), id = "huntsman-mob-1", before = ui.storage.get(key);
  target(ui, id); change(ui, "combatSelectCard", H(s).hand[0].id); change(ui, "combatSelectSlot", 0);
  const others = s.enemies.filter(enemy => enemy.id !== id && E.distance(s, H(s).position, enemy.node) <= 1);
  assert(others.length >= 2);
  assert.match(ui.el("combatSelection").innerHTML, new RegExp(`공격 실행 시 · 추가 <b>${others.length}명 × 피해 1`));
  assert.deepEqual(hud(ui), [id], "additional targets gain no name/HP overlays");
  const second = others.find(enemy => enemy.node === H(s).position); assert(second);
  target(ui, second.id); assert.deepEqual(hud(ui), [second.id]);
  change(ui, "combatSelectCard", ""); assert.doesNotMatch(ui.el("combatSelection").innerHTML, /attack-area-preview/);
  change(ui, "combatSelectCard", H(s).hand[0].id);
  assert.equal(ui.storage.get(key), before); assert(ui.el("combatSelection").innerHTML.includes("attack-area-preview"));
  command(ui, "ATTACK");
  assert.doesNotMatch(ui.el("combatSelection").innerHTML, /attack-area-preview/, "enemy reaction mode clears pre-commit area notice");
  command(ui, "RESOLVE");
  const after = E.importSave(ui.storage.get(key));
  for (const other of s.enemies.filter(enemy => enemy.id !== second.id && E.distance(s, H(s).position, enemy.node) <= 1))
    assert.equal(after.enemies.find(enemy => enemy.id === other.id)?.hp ?? 0, other.hp - 1);
});
