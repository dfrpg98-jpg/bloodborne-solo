"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), E = require("../src/hunt-engine"),
  { boot } = require("./helpers/ui-harness.cjs"), Q = require("./helpers/rifle-leap-checkpoints.cjs");
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07", H = E.hunter;
const adopt = s => E.applyLeapMoveRuling(E.applyTileSpeedRuling(s));
function launch(state) {
  const normal = E.exportSave(E.create(722, "burial", 0, null, "hunter-pistol", "center", { campaign: true }));
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true, engine: { ...E },
    storage: { [qaKey]: E.exportSave(state), [normalKey]: normal, "bloodborne-hunt-active-mode": "qa" } });
  return { ui, normal };
}
function select(ui, command) {
  ui.el("hand").querySelectorAll("[data-card]").find(b => b.dataset.card === command.cardId).click();
  ui.el("slots").querySelectorAll("[data-slot]").find(b => +b.dataset.slot === command.slot).click();
  ui.el("chapterMap").querySelectorAll("[data-enemy]").find(b => b.dataset.enemy === command.enemyId).click();
}
function current(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(qaKey)); }

test("safe legacy rifle import records forward adoption once without rewriting the existing commands or spending resources", () => {
  const before = Q.beforeLeap(), { ui, normal } = launch(before), actual = current(ui), expected = adopt(before);
  assert.deepEqual(actual, expected); assert.equal(actual.leapMoveRuling, "move-action");
  assert.deepEqual(actual.commands.slice(0, before.commands.length), before.commands);
  assert.deepEqual(H(actual), H(before)); assert.deepEqual(actual.enemies, before.enemies);
  assert.equal(actual.rng, before.rng); assert.equal(ui.storage.get(normalKey), normal);
  assert.strictEqual(E.applyLeapMoveRuling(actual), actual);
});

test("attached first slot: real card/slot/target selectors preview 2+1+1+1=5, then the leap button commits the same attack", () => {
  const state = adopt(Q.beforeLeap(["bloodstone-shard"])), command = Q.selection(state, { slot: 0 }),
    { ui, normal } = launch(state), saved = ui.storage.get(qaKey);
  select(ui, command);
  const html = ui.el("combatSelection").innerHTML;
  assert.match(html, /도약 선행 이동 1회 포함/); assert.match(html, /이동 행동 1회/);
  assert.match(html, /피해 2 \+ 카드 1 \+ 부착 강화 1 \+ 무기 1 = <b>5<\/b>/);
  assert.equal(ui.storage.get(qaKey), saved, "changing public choices cannot declare the movement or spend the card");
  const button = ui.document.querySelectorAll("[data-command]").find(b => b.dataset.command === "ATTACK" &&
    JSON.stringify(JSON.parse(b.dataset.args).leapPath) === JSON.stringify(command.leapPath));
  assert(button && !button.disabled); button.click();
  const actual = current(ui), expected = E.dispatch(state, { type: "ATTACK", ...JSON.parse(button.dataset.args) });
  assert.deepEqual(actual, expected); assert.equal(H(actual).moveActionsRound, 1);
  assert.equal(actual.combat.attack.damage, 5); assert.equal(H(actual).slots[0].id, command.cardId);
  assert.equal(actual.commands.length, state.commands.length + 1); assert.equal(ui.storage.get(normalKey), normal);
});

test("a legacy attack already in progress retains damage4 and count0 when the controller loads it", () => {
  const before = Q.beforeLeap(), command = Q.selection(before), oldAttack = E.dispatch(before, command);
  assert.equal(oldAttack.combat.attack.damage, 4); assert.equal(H(oldAttack).moveActionsRound || 0, 0);
  const { ui } = launch(oldAttack), actual = current(ui);
  assert.deepEqual(actual, oldAttack); assert.equal(actual.leapMoveRuling, undefined);
  assert.equal(actual.combat.attack.damage, 4);
});
