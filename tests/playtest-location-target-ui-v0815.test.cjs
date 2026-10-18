"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"), L = require("../src/hunt-location-labels"),
  MapControls = require("../src/hunt-map-controls"), { boot } = require("./helpers/ui-harness.cjs"), { hand } = require("./actual-combat-helper.cjs");
const key = "bloodborne-hunt-v07", plain = value => JSON.parse(JSON.stringify(value));
const launch = state => boot(state, E.missionView(state), E.rewardsView(state), {
  realInventory: true, storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: MapControls },
  engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s },
});
for (const [seed, id, count] of [[92, "tile-05", 3], [3, "tile-08", 2]]) {
  test(`unnamed ${count}-cell tile retains a public map address through preview, rotation, placement and movement`, () => {
    let state = E.create(seed, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
    state = E.dispatch(state, { type: "MOVE", cardId: E.hunter(state).hand[0].id });
    state = E.dispatch(state, { type: "EXPLORE", edge: "N" });
    assert.equal(state.world.pending.tileId, id);
    const saved = E.exportSave(state), ui = launch(state);
    assert.match(ui.el("decisions").textContent, new RegExp(`북쪽 1 구역 · ${count}칸 타일 배치`));
    assert.doesNotMatch(ui.el("decisions").textContent, /명칭 없는|tile-\d/);
    assert.match(ui.el("chapterMap").innerHTML, /북쪽 1 구역/);
    const rotations = E.placementOptions(state);
    for (const rotation of rotations) {
      ui.el("decisions").querySelectorAll("[data-rotation]").find(button => +button.dataset.rotation === rotation).click();
      assert.match(ui.el("chapterMap").innerHTML, /북쪽 1 구역/);
      assert.equal(ui.storage.get(key), saved, "changing preview rotation has no gameplay cost");
    }
    const rotation = rotations.at(-1);
    ui.buttons("decisions").find(button => button.dataset.command === "PLACE_TILE").click();
    state = E.dispatch(state, { type: "PLACE_TILE", rotation });
    assert.deepEqual(E.importSave(ui.storage.get(key)), state, "spawn, loot, cell entry and cost unchanged");
    assert.match(ui.el("locationText").textContent, /북쪽 1 구역 \/ /);
    const tileButton = ui.el("chapterMap").querySelectorAll("[data-tile-info]").find(button => button.dataset.tileInfo === id);
    assert.match(tileButton.getAttribute("aria-label"), /북쪽 1 구역 · 타일 정보 보기/);
    tileButton.click(); assert.equal(ui.el("tileInspectionStatus"), null);
    assert.equal(ui.el("tileInfo").querySelectorAll(".tile-info-space").length, 1);
    assert.doesNotMatch(ui.el("tileInfo").textContent, /명칭 없는|사냥꾼의 현재 위치/);
    assert.equal(ui.el("chapterMap").querySelectorAll("[data-tile]").find(tile => tile.dataset.tile === id).dataset.inspected, "true");
    assert.equal(L.tile(state, id).name, null, "the address is not an invented printed tile name");
    const next = MapControls.movement(state).directions.flatMap(direction => direction.options)
      .find(option => option.enabled && option.command?.type === "STEP" && option.command.node.startsWith(id + ":"))?.command.node;
    if (next && state.phase === "move") {
      ui.el("chapterMap").querySelectorAll("[data-node]").find(button => button.dataset.node === next).click();
      state = E.dispatch(state, { type: "STEP", node: next });
      assert.deepEqual(E.importSave(ui.storage.get(key)), state);
      assert.match(ui.el("status").textContent, /북쪽 1 구역/);
    }
  });
}
test("location identities inspect only revealed tiles and remain unique independent of rotation", () => {
  const state = E.create(92, "burial", 0, null, "hunter-pistol", "center", { campaign: true });
  assert.equal(L.tile(state, state.world.tileDeck[0]), null);
  assert.equal(L.tile(state, "tile-14").reference, "중앙 등불");
  const copy = structuredClone(state); copy.world.tiles[0].rotation = 3;
  assert.equal(L.tile(copy, "tile-14").reference, "중앙 등불");
});
test("axe follow-up choices distinguish equal-name equal-HP enemies and dispatch damage only to the chosen target", () => {
  let state = E.create(90, "hunter-axe", 1, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 13 });
  state.world.assignments.find(a => a.enemyId === "huntsmans-minion").sideId = "a";
  state.enemies = [
    { id: "scourge-beast-1", kind: "scourge-beast", figure: 1, node: "tile-14:center", hp: 1 },
    { id: "huntsmans-minion-1", kind: "huntsmans-minion", figure: 1, node: "tile-14:left", hp: 5 },
    { id: "huntsmans-minion-2", kind: "huntsmans-minion", figure: 2, node: "tile-14:right", hp: 5 },
  ];
  hand(state, ["strength", "endurance", "vitality"]); E.assertState(state);
  state = E.dispatch(state, { type: "ATTACK", enemyId: "scourge-beast-1", cardId: E.hunter(state).hand[0].id, slot: 0 });
  state = E.dispatch(state, { type: "RESOLVE" }); assert.equal(state.phase, "weapon_choice");
  // Deliberately constructed equal-HP opponents are a unit fixture, not a
  // claimed canonical player save. Run the real UI handlers/reducer on it.
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: JSON.stringify(state) }, window: { BBHuntMapControls: MapControls },
    engine: { ...E, importSave: JSON.parse, exportSave: JSON.stringify,
      applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s },
  }), options = ui.el("decisionActions").querySelectorAll("[data-command]")
    .filter(button => button.dataset.command === "WEAPON_CHOICE");
  assert.equal(options.length, 2);
  assert.match(ui.el("decisions").textContent, /하인#1.*피해 2/);
  assert.match(ui.el("decisions").textContent, /하인#2.*피해 2/);
  const targetLabels = [...ui.el("decisions").innerHTML.matchAll(/<button\b[^>]*data-command="WEAPON_CHOICE"[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1]);
  assert.equal(targetLabels.length, 2);
  for (const label of targetLabels) assert.doesNotMatch(label, /중앙 등불|왼쪽 칸|오른쪽 칸|체력/,
    "short choice labels identify the target without an address or health paragraph");
  assert.equal(JSON.parse(options[0].dataset.args).enemyId, "huntsmans-minion-1");
  assert.equal(JSON.parse(options[1].dataset.args).enemyId, "huntsmans-minion-2");
  assert.match(ui.el("phaseHelp").textContent, /선택할 대상 2개/);
  options[1].click(); const result = JSON.parse(ui.storage.get(key));
  assert.deepEqual(result, E.dispatch(state, { type: "WEAPON_CHOICE", enemyId: "huntsmans-minion-2" }));
  assert.equal(result.enemies.find(e => e.id === "huntsmans-minion-1").hp, 5);
  assert.equal(result.enemies.find(e => e.id === "huntsmans-minion-2").hp, 3);
  E.assertState(result); assert.equal(ui.el("error").textContent, "");
});
