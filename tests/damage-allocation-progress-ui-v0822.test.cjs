"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"),
  { checkpoint } = require("./helpers/damage-allocation-qa.cjs");
const key = "bloodborne-hunt-qa-v1", H = E.hunter;
function launch(state) {
  state = E.applyLeapMoveRuling(E.applyTileSpeedRuling(E.applyCombatReactionRuling(E.applyChapelRuling(state))));
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine: { ...E }, realInventory: true,
    storage: { [key]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
  });
  return { ui, current: () => E.importSave(ui.storage.get(key)) };
}
function click(ui, type, matches = () => true) {
  const button = ["decisionActions", "decisions", "firearm"].flatMap(id => ui.buttons(id)).find(button =>
    button.dataset.command === type && !button.disabled && matches(JSON.parse(button.dataset.args || "{}")));
  assert(button, `enabled ${type}`); button.click(); assert.equal(ui.el("error").textContent, "");
}
const hp = state => state.enemies.map(enemy => [enemy.id, enemy.hp]);

test("SYNTHETIC-QA: real transform and UI allocations show 2 → 1 → complete with unchanged eligible count", () => {
  const { ui, current } = launch(checkpoint()), before = current(), hand = H(before).hand.map(card => card.id);
  require("./helpers/combat-selection-ui.cjs").choose(ui, "card", "card-2");
  assert.equal(E.exportSave(current()), E.exportSave(before), "selection cannot spend a card or alter the save");
  click(ui, "TRANSFORM");
  assert.equal(current().weaponEffects.length, 2);
  assert.equal(ui.el("phaseHelp").textContent, "선택할 대상 2개 · 남은 피해 배분 2회");
  const afterTransform = current();
  ui.el("decisions").querySelectorAll("[data-inspect-target]").find(button => button.dataset.inspectTarget === "huntsman-mob-1").click();
  assert.deepEqual(ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]").map(x => x.dataset.statusEnemy), ["huntsman-mob-1"]);
  click(ui, "WEAPON_CHOICE", args => args.enemyId === "huntsman-mob-1");
  assert.equal(ui.el("phaseHelp").textContent, "선택할 대상 2개 · 남은 피해 배분 1회");
  assert.deepEqual(hp(current()), hp(E.dispatch(afterTransform, { type: "WEAPON_CHOICE", enemyId: "huntsman-mob-1" })));
  assert.equal(ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]").length, 0, "an applied choice does not reveal every enemy HUD");
  const oneLeft = current();
  click(ui, "WEAPON_CHOICE", args => args.enemyId === "huntsmans-minion-1");
  const done = current();
  assert.equal(done.phase, "hunter"); assert.equal(done.weaponEffects, undefined);
  assert.match(ui.el("phaseHelp").textContent, /^피해 배분 완료 · /);
  assert.equal(done.enemies.find(enemy => enemy.id === "huntsman-mob-1").hp, 3);
  assert.equal(done.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 1);
  assert.equal(H(done).hp, H(before).hp);
  assert.deepEqual(H(done).hand.map(card => card.id), hand.filter(id => id !== "card-2"));
  assert.equal(E.exportSave(done), E.exportSave(E.dispatch(oneLeft, { type: "WEAPON_CHOICE", enemyId: "huntsmans-minion-1" })));
  assert.match(launch(done).ui.el("phaseHelp").textContent, /^피해 배분 완료 · /, "completion derives from the saved last command");
  click(ui, "END_TURN");
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /피해 배분|남은.*배분/);
});

test("SYNTHETIC-QA: killing the first target can auto-resolve the last allocation without another click", () => {
  const { ui, current } = launch(checkpoint(10, true));
  assert.match(ui.el("phaseHelp").textContent, /남은 피해 배분 2회/);
  assert.equal(current().enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 1);
  click(ui, "WEAPON_CHOICE", args => args.enemyId === "huntsmans-minion-1");
  assert.equal(current().phase, "hunter");
  assert.equal(current().enemies.find(enemy => enemy.id === "huntsmans-minion-1")?.hp || 0, 0);
  assert.equal(current().enemies.find(enemy => enemy.id === "huntsman-mob-1").hp, 3);
  assert.equal(H(current()).hp, 2);
  assert.match(ui.el("phaseHelp").textContent, /^피해 배분 완료/);
});

test("SYNTHETIC component scope: progress stops at a different effect instead of counting the entire queue", () => {
  // Deliberate presentation-only queues; not canonical saves or campaign evidence.
  const base = checkpoint(10), first = base.weaponEffects[0];
  for (const boundary of [{ kind: "move", remaining: 1 }, { kind: "push", remaining: 1 },
    { ...first, all: true }, { ...first, target: "combat" }, { ...first, range: 1 }, { ...first, damage: 2 }]) {
    const state = structuredClone(base); state.weaponEffects = [first, boundary, first];
    const ui = boot(state, E.missionView(state), E.rewardsView(state));
    assert.match(ui.el("phaseHelp").textContent, /남은 피해 배분 1회/);
  }
});

test("SYNTHETIC-QA: Uncanny with an overridden blunderbuss finishes a push without claiming damage allocation completion", () => {
  let state = E.create(6, "uncanny-ludwigs-holy-blade", 0, null, "hunter-blunderbuss", "center", {
    campaign: true, rulesVersion: 14, firearmOverride: true,
    qa: { preset: "custom", startRewards: [], startConsumables: [] },
  });
  for (const command of [{ type: "MOVE", cardId: "card-1" }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STEP", node: "tile-03:room" }]) state = E.dispatch(state, command);
  const { ui, current } = launch(E.importSave(E.exportSave(state)));
  ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "huntsmans-minion-1").click();
  click(ui, "FIREARM");
  assert.equal(current().weaponEffects[0].kind, "push");
  assert.match(ui.el("phaseHelp").textContent, /이동 선택지 1개 · 남은 이동 최대 1칸/);
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /피해 배분/);
  click(ui, "WEAPON_CHOICE", args => args.node === "tile-03:entry");
  assert.equal(current().phase, "hunter");
  assert.doesNotMatch(ui.el("phaseHelp").textContent, /피해 배분/);
  assert(H(current()).slots.every(slot => !slot), "no Uncanny slot was cleared");
});
