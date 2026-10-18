"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1", activeKey = "bloodborne-hunt-active-mode";
const normal = () => E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
function qaWithEnemy() {
  let state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, qa: { preset: "fast" } });
  // These accepted commands reveal the courtyard and spawn its mission enemy.
  for (const command of [{ type: "MOVE", cardId: "card-3" }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" }]) state = E.dispatch(state, command);
  return state;
}
function launch() {
  const qa = qaWithEnemy(), normalSave = E.exportSave(normal()), qaSave = E.exportSave(qa),
    ui = boot(qa, E.missionView(qa), E.rewardsView(qa), { realInventory: true, engine: { ...E, applyTileSpeedRuling: s => s },
      storage: { [normalKey]: normalSave, [qaKey]: qaSave, [activeKey]: "qa" } });
  return { ui, qa, normalSave, qaSave };
}
function inspect(ui, kind) {
  const targets = ui.el("chapterMap").querySelectorAll(kind === "enemy" ? "[data-enemy]" : "[data-node]"),
    target = targets.find(target => !target.disabled && (kind === "enemy" ||
      (kind === "entrance" ? target.hasAttribute("data-entrance") : !target.hasAttribute("data-entrance"))));
  assert(target, `a public ${kind} target exists`); target.click();
  assert.equal(ui.el("mapContext").hidden, false);
  assert.match(ui.el("decisions").innerHTML, /class="utility-actions"/, "selected targets collapse unrelated actions");
}
function assertUnselected(ui) {
  assert.equal(ui.el("mapContext").hidden, true, "a replaced hunt has no selected map target");
  assert.equal(ui.el("mapContext").innerHTML, "", "old target details cannot survive a hunt replacement");
  assert.doesNotMatch(ui.el("decisions").innerHTML, /class="utility-actions"/, "basic actions are directly visible");
  assert.equal(ui.el("error").textContent, "");
}
function moveFromNormal(ui, before) {
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .find(button => button.dataset.hunterIntent === "MOVE" && !button.disabled);
  assert(intent, "the restored hunt offers the movement action before choosing a hand card");
  const saved = ui.storage.get(normalKey); intent.click();
  assert.equal(ui.storage.get(normalKey), saved, "choosing the movement action does not change the restored replay");
  assert.equal(ui.el("confirmHunterAction").disabled, true, "movement confirmation waits for a hand card");
  const cardId = E.hunter(before).hand[0].id,
    card = ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId);
  assert(card); card.click(); assertUnselected(ui);
  const move = ui.buttons("decisionActions").find(button => button.dataset.command === "MOVE" && !button.disabled);
  assert(move, "movement is available after explicitly choosing a hand card"); move.click();
  assert.deepEqual(E.importSave(ui.storage.get(normalKey)), E.dispatch(before, { type: "MOVE", cardId }),
    "the restored hunt continues with its original costs and exact engine result");
}

for (const kind of ["enemy", "cell", "entrance"]) {
  test(`resuming the normal hunt clears a QA ${kind} selection and allows the next move`, () => {
    const { ui, qaSave, normalSave } = launch(); inspect(ui, kind);
    assert.equal(ui.storage.get(qaKey), qaSave, "inspection does not change the QA replay");
    ui.el("resumeNormal").click(); assertUnselected(ui);
    assert.equal(ui.storage.get(normalKey), normalSave, "resuming preserves the exact normal replay");
    assert.equal(ui.storage.get(qaKey), qaSave, "resuming preserves the exact QA replay");
    moveFromNormal(ui, normal()); assert.equal(ui.storage.get(qaKey), qaSave);
  });

  test(`importing a different hunt clears an existing ${kind} selection`, async () => {
    const { ui, qaSave, normalSave } = launch(); inspect(ui, kind);
    const input = { files: [{ text: async () => normalSave }], value: "normal.json" };
    await ui.el("file").onchange({ target: input }); assertUnselected(ui);
    assert.equal(input.value, ""); assert.equal(ui.storage.get(normalKey), normalSave);
    assert.equal(ui.storage.get(qaKey), qaSave); moveFromNormal(ui, normal());
  });

  test(`starting a new hunt clears an existing ${kind} selection`, () => {
    const { ui, qaSave } = launch(); inspect(ui, kind); ui.el("new").click();
    for (const [id, value] of [["playMode", "campaign"], ["weapon", "burial"], ["face", "0"],
      ["gun", "hunter-pistol"], ["seed", "91"], ["start", "center"]]) {
      ui.el(id).value = value; ui.el(id).fire("change");
    }
    assert.equal(ui.el("confirmSetup").disabled, false); ui.el("confirmSetup").click();
    assert.equal(ui.el("setupError").textContent, ""); assertUnselected(ui);
    assert.equal(ui.el("missionUpdateDialog").open, true, "the new mission is still announced");
    const expected = E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
    assert.deepEqual(E.importSave(ui.storage.get(normalKey)), expected); assert.equal(ui.storage.get(qaKey), qaSave);
    ui.el("missionUpdateContinue").click(); moveFromNormal(ui, expected);
  });
}

test("a rejected file keeps the existing hunt and map selection available", async () => {
  const { ui, qaSave, normalSave } = launch(); inspect(ui, "enemy");
  const before = ui.el("mapContext").innerHTML,
    input = { files: [{ text: async () => "not a saved hunt" }], value: "bad.json" };
  await ui.el("file").onchange({ target: input });
  assert.equal(ui.el("mapContext").hidden, false); assert.equal(ui.el("mapContext").innerHTML, before);
  assert.equal(ui.storage.get(qaKey), qaSave); assert.equal(ui.storage.get(normalKey), normalSave);
  assert(ui.el("error").textContent, "the failed import reports its error");
});

test("ordinary card and slot inspection keeps a valid map target selected", () => {
  const { ui, qa, qaSave } = launch(); inspect(ui, "enemy");
  const enemyName = E.enemyDef(qa, qa.enemies[0]).name;
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.el("slots").querySelectorAll("[data-slot]")[0].click();
  assert.equal(ui.el("mapContext").hidden, false); assert(ui.el("mapContext").textContent.includes(enemyName));
  assert.match(ui.el("decisions").innerHTML, /class="utility-actions"/);
  assert.equal(ui.storage.get(qaKey), qaSave, "inspection remains presentation only");
});
