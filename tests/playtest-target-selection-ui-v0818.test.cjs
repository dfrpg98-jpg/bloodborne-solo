"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"),
  { boot } = require("./helpers/ui-harness.cjs");
const H = E.hunter, qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07", cache = new Map();
// This is the first twelve public commands of the existing dev.15 axe QA
// checkpoint, followed by ordinary movement and pursuit. Keeping this short
// prefix here avoids any dependency on a personal save or audit screenshot.
const prefix = [{ type: "APPLY_TILE_SPEED_RULING" }, { type: "USE_CONSUMABLE", itemId: "item-qa-1-1" },
  { type: "EXPLORE", edge: "N" }, { type: "PLACE_TILE", rotation: 0 },
  { type: "STEP", node: "tile-14:center" }, { type: "EXPLORE", edge: "S" },
  { type: "PLACE_TILE", rotation: 0 }, { type: "STEP", node: "tile-17:lower-left" },
  { type: "EXPLORE", edge: "W" }, { type: "PLACE_TILE", rotation: 0 },
  { type: "EXPLORE", edge: "N" }, { type: "PLACE_TILE", rotation: 0 }];
const run = (state, ...commands) => commands.reduce((s, command) => E.dispatch(s, command), state);
function checked(state) {
  const saved = E.exportSave(state); assert.equal(E.exportSave(E.importSave(saved)), saved);
  return state;
}
function checkpoint(kind = "tiny") {
  if (!cache.has(kind)) {
    const active = kind === "beast", weak = active || kind === "gloves",
      rewards = kind === "augur" || kind === "roar" ? ["augur", "beast-roar", "rune-hunter"] :
        weak ? ["tiny-tonitrus", "executioner-gloves", ...(active ? ["rune-beast"] : [])] :
          ["tiny-tonitrus", "rune-hunter"],
      items = ["qa-travel", ...(weak ? ["molotov", "molotov", "throwing-knife", "throwing-knife"] : []), "pungent-blood", "pebble"];
    let s = E.create(3, "hunter-axe", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
      qa: { preset: "custom", startRewards: rewards, startConsumables: items } });
    s = run(s, ...prefix, { type: "MOVE", cardId: H(s).hand.find(card => card.kind === "vitality").id },
      { type: "STEP", node: "tile-01:top" }, { type: "STOP_MOVE" });
    assert.equal(s.phase, "hunter");
    const minions = s.enemies.filter(enemy => enemy.kind === "huntsmans-minion");
    assert.equal(minions.length, 2); assert(minions.every(enemy => enemy.node === H(s).position && enemy.hp === 5));
    if (weak) {
      if (!active) s = E.dispatch(s, { type: "USE_REWARD", rewardId: reward(s, "tiny-tonitrus").id, enemyId: minions[0].id });
      for (const enemy of minions) {
        s = E.dispatch(s, { type: "USE_CONSUMABLE", itemId: H(s).consumables.find(item => item.kind === "molotov").id, enemyId: enemy.id });
        if (!active && enemy.id === minions[1].id) for (let i = 0; i < 2; i++)
          s = E.dispatch(s, { type: "USE_CONSUMABLE", itemId: H(s).consumables.find(item => item.kind === "throwing-knife").id, enemyId: enemy.id });
      }
    }
    if (active) {
      s = E.dispatch(s, { type: "ATTACK", enemyId: "huntsman-mob-1",
        cardId: H(s).hand.find(card => card.kind === "strength").id, slot: 1 });
      assert(E.canFirearm(s)); s = run(s, { type: "FIREARM" }, { type: "RESOLVE" });
      assert.equal(s.phase, "kill_react"); assert(E.rewardsView(s).rewards.find(item => item.kind === "rune-beast").usable);
    }
    cache.set(kind, checked(s));
  }
  return structuredClone(cache.get(kind));
}
function reward(s, kind) { const item = H(s).rewards.find(item => item.kind === kind); assert(item, kind); return item; }
function launch(s, browserGlobals = {}) {
  const normal = E.exportSave(E.create(722, "burial", 0, null, "hunter-pistol", "center", { campaign: true })),
    ui = boot(s, E.missionView(s), E.rewardsView(s), { realInventory: true, engine: { ...E }, window: browserGlobals,
      storage: { [qaKey]: E.exportSave(s), [normalKey]: normal, "bloodborne-hunt-active-mode": "qa" } });
  assert.equal(ui.storage.get(qaKey), E.exportSave(s)); return { ui, normal };
}
function current(ui) {
  assert.equal(ui.el("error").textContent, ""); return checked(E.importSave(ui.storage.get(qaKey)));
}
function panel(ui, name) {
  const button = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === name);
  assert(button); button.click();
  const inline = ["inventory", "rewards"].includes(name);
  assert.equal(ui.el("infoDialog").open, !inline);
  if (inline) assert.equal(ui.el(name === "inventory" ? "workspaceInventory" : "rewardsPanel").hidden, false);
}
function progress(ui) { ui.document.querySelectorAll("[data-workspace-tab]").find(button => button.dataset.workspaceTab === "progress").click(); }
function change(ui, id, value) {
  const select = ui.el(id); assert(select, id); select.focus({ preventScroll: true });
  select.value = value; select.fire("change");
}
function option(select, id) {
  const entry = [...select.innerHTML.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)].find(match => match[1] === id);
  assert(entry, "option " + id); return entry[2];
}
function compactLabel(state, id) {
  const enemy = state.enemies.find(enemy => enemy.id === id); assert(enemy);
  const name = E.enemyDef(state, enemy).name,
    sameName = state.enemies.filter(value => E.enemyDef(state, value).name === name);
  return name + (sameName.length > 1 ? "#" + (sameName.findIndex(value => value.id === id) + 1) : "");
}
function identity(text, state, id) {
  assert(text.includes(compactLabel(state, id)), "the compact public enemy identity remains visible");
}
function targetOptions(ui, selectId, s) {
  const select = ui.el(selectId); assert(select, selectId);
  const first = option(select, "huntsmans-minion-1"), second = option(select, "huntsmans-minion-2");
  assert.equal(first, compactLabel(s, "huntsmans-minion-1"));
  assert.equal(second, compactLabel(s, "huntsmans-minion-2")); assert.notEqual(first, second);
}
function inventorySummary(ui) {
  // The lightweight harness only populates textContent for dynamic writes;
  // static paragraph text is verified from the actual generated DOM markup.
  const entry = ui.el("itemDetail").innerHTML.match(/<p\b[^>]*id="itemTargetSummary"[^>]*>([\s\S]*?)<\/p>/);
  assert(entry); return entry[1].replace(/<[^>]*>/g, "");
}
function useReward(ui, id) {
  const button = ui.el("rewards").querySelectorAll("[data-reward-use]").find(button => button.dataset.rewardUse === id);
  assert(button && !button.disabled); button.click(); return current(ui);
}
function selectedMarkers(ui) {
  return ui.el("chapterMap").querySelectorAll("[data-enemy]").filter(button => button.classList.contains("selected")).map(button => button.dataset.enemy);
}
function statusIds(ui) {
  return ui.el("enemyStatusLayer").querySelectorAll("[data-status-enemy]").map(element => element.dataset.statusEnemy);
}
function mapStatusMarkup(ui, id) {
  const layer = ui.el("enemyStatusLayer"); assert(layer, "enemy status overlay exists");
  const rows = layer.innerHTML.split(/(?=<div\b[^>]*data-status-enemy=)/),
    row = rows.find(value => value.includes(`data-status-enemy="${id}"`));
  assert(row, "map status for " + id); return row;
}
function mapStatus(ui, s, id, tokens = null) {
  assert.deepEqual(statusIds(ui), [id], "only the explicitly selected living enemy has a name/health overlay");
  const enemy = s.enemies.find(enemy => enemy.id === id), maximum = E.enemyDef(s, enemy).maxHp,
    row = mapStatusMarkup(ui, id), health = row.match(/<span\b[^>]*class="enemy-health-track"[^>]*>/);
  assert(health); assert.match(health[0], /role="progressbar"/);
  assert.match(health[0], new RegExp(`aria-valuenow="${enemy.hp}"`));
  assert.match(health[0], new RegExp(`aria-valuemax="${maximum}"`));
  assert(row.includes(`>${compactLabel(s, id)}</button>`), "compact identity is printed next to the health bar");
  assert.match(row, new RegExp(`class="enemy-health-number">${enemy.hp}\\s*/\\s*${maximum}<`));
  const fill = row.match(/class="enemy-health-fill"[^>]*style="[^"]*width:([\d.]+)%/);
  assert(fill); assert(Math.abs(+fill[1] - enemy.hp / maximum * 100) < 0.000001);
  if (tokens === null) assert.doesNotMatch(row, /class="enemy-insight-pips"/);
  else {
    assert.match(row, new RegExp(`class="enemy-insight-pips"[^>]*aria-label="계몽 토큰 ${tokens}개"`));
    assert.match(row, new RegExp(`<b>${tokens}</b>`));
  }
}
function hunterToggle(ui, s) {
  const id = reward(s, "rune-hunter").id,
    check = ui.el("rewards").querySelectorAll("[data-reward-attack]").find(check => check.dataset.rewardAttack === id);
  assert(check); check.checked = true; check.fire("change");
}

// All state fixtures above use public reducers and strict save replay. These
// tests exercise actual controller handlers in the DOM harness; they are not
// additional native-browser campaign completions.
for (const [setup, kind] of [["tiny", "tiny-tonitrus"], ["augur", "augur"], ["gloves", "executioner-gloves"], ["beast", "rune-beast"]])
  test(`${kind}: same-cell enemies with the same name and HP have individually identifiable target options`, () => {
    const s = checkpoint(setup), { ui } = launch(s), id = reward(s, kind).id;
    targetOptions(ui, "rewardEnemy-" + id, s);
    assert(E.rewardsView(s).rewards.find(item => item.id === id).usable, "the real action is available at this checkpoint");
  });

test("Beast Roar identifies each enemy before assigning separate destinations to same-name figures", () => {
  const s = checkpoint("roar"), { ui } = launch(s), id = reward(s, "beast-roar").id, html = ui.el("rewards").innerHTML;
  for (const enemyId of ["huntsmans-minion-1", "huntsmans-minion-2"]) {
    const selectId = `rewardMove-${id}-${enemyId}`; assert(ui.el(selectId));
    const row = [...html.matchAll(/<label\b[^>]*>((?:(?!<\/label>)[\s\S])*)<\/label>/g)].find(match => match[1].includes(`id="${selectId}"`));
    assert(row, "a visible destination label identifies " + enemyId); identity(row[1], s, enemyId);
  }
});

test("a reward's eligible subset keeps the same-name numbering used throughout the map", () => {
  let s = checkpoint("augur");
  s = checked(E.dispatch(s, { type: "USE_CONSUMABLE", itemId: H(s).consumables.find(item => item.kind === "pebble").id,
    enemyId: "huntsmans-minion-1", node: "tile-01:bottom" }));
  const { ui } = launch(s), id = reward(s, "augur").id, select = ui.el("rewardEnemy-" + id),
    targets = E.rewardsView(s).rewards.find(item => item.id === id).controls.targets;
  assert.equal(targets.filter(target => target.enemyId.startsWith("huntsmans-minion-")).length, 1);
  assert.equal(option(select, "huntsmans-minion-2"), E.enemyDef(s, s.enemies.find(enemy => enemy.id === "huntsmans-minion-2")).name + "#2");
  assert.equal(s.enemies.filter(enemy => enemy.kind === "huntsmans-minion").length, 2);
});

test("opening target controls previews a visible choice and reopening rewards preserves the most recently changed reward target", () => {
  const s = checkpoint("gloves"), { ui } = launch(s), saved = ui.storage.get(qaKey),
    tiny = reward(s, "tiny-tonitrus").id, gloves = reward(s, "executioner-gloves").id;
  panel(ui, "rewards");
  assert.deepEqual(selectedMarkers(ui), [ui.el("rewardEnemy-" + tiny).value]);
  mapStatus(ui, s, ui.el("rewardEnemy-" + tiny).value);
  change(ui, "rewardEnemy-" + tiny, "huntsmans-minion-2");
  change(ui, "rewardEnemy-" + gloves, "huntsmans-minion-1");
  assert.deepEqual(selectedMarkers(ui), ["huntsmans-minion-1"]);
  progress(ui); panel(ui, "rewards");
  assert.equal(ui.el("rewardEnemy-" + tiny).value, "huntsmans-minion-2");
  assert.equal(ui.el("rewardEnemy-" + gloves).value, "huntsmans-minion-1");
  assert.deepEqual(selectedMarkers(ui), ["huntsmans-minion-1"], "opening the panel does not replace the last chosen target with a different reward's default");
  mapStatus(ui, s, "huntsmans-minion-1");
  assert.equal(ui.storage.get(qaKey), saved);
});

test("reward target two previews immediately without closing its panel, remains selected across a rune toggle and only that target takes damage", () => {
  const s = checkpoint("tiny"), { ui, normal } = launch(s), id = reward(s, "tiny-tonitrus").id,
    selectId = "rewardEnemy-" + id, summaryId = "rewardTarget-" + id, saved = ui.storage.get(qaKey);
  panel(ui, "rewards"); change(ui, selectId, "huntsmans-minion-2");
  identity(ui.el(summaryId).textContent, s, "huntsmans-minion-2");
  assert.deepEqual(selectedMarkers(ui), ["huntsmans-minion-2"]);
  mapStatus(ui, s, "huntsmans-minion-2");
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("rewardsPanel").hidden, false); assert.equal(ui.document.activeElement, ui.el(selectId));
  assert.equal(ui.storage.get(qaKey), saved);
  hunterToggle(ui, s); assert.equal(ui.el(selectId).value, "huntsmans-minion-2");
  identity(ui.el(summaryId).textContent, s, "huntsmans-minion-2"); assert.equal(ui.storage.get(qaKey), saved);
  assert.deepEqual(selectedMarkers(ui), ["huntsmans-minion-2"]);
  mapStatus(ui, s, "huntsmans-minion-2");
  assert.match(ui.el("mapContext").textContent, /#2|2번/); assert.equal(ui.storage.get(qaKey), saved);
  progress(ui);
  panel(ui, "rewards"); assert.equal(ui.el(selectId).value, "huntsmans-minion-2");
  const actual = useReward(ui, id), expected = E.dispatch(s, { type: "USE_REWARD", rewardId: id, enemyId: "huntsmans-minion-2" });
  assert.deepEqual(actual, expected); assert.equal(actual.commands.length, s.commands.length + 1);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 5);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 3);
  assert(actual.skipActivation.includes("huntsmans-minion-2")); assert(!actual.skipActivation.includes("huntsmans-minion-1"));
  assert.equal(reward(actual, "rune-hunter").ready, true); assert.equal(ui.storage.get(normalKey), normal);
});

test("Augur retains target two and its destination across an unrelated rune toggle and moves only that enemy", () => {
  const s = checkpoint("augur"), { ui } = launch(s), id = reward(s, "augur").id;
  change(ui, "rewardEnemy-" + id, "huntsmans-minion-2"); change(ui, "rewardNode-" + id, "tile-01:bottom");
  hunterToggle(ui, s); assert.equal(ui.el("rewardEnemy-" + id).value, "huntsmans-minion-2");
  assert.equal(ui.el("rewardNode-" + id).value, "tile-01:bottom");
  const actual = useReward(ui, id), expected = E.dispatch(s, { type: "USE_REWARD", rewardId: id,
    enemyId: "huntsmans-minion-2", node: "tile-01:bottom" });
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1"), s.enemies.find(enemy => enemy.id === "huntsmans-minion-1"));
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").node, "tile-01:bottom");
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 3);
});

for (const [setup, kind] of [["gloves", "executioner-gloves"], ["beast", "rune-beast"]])
  test(`${kind}: selecting figure two applies the real effect to that target and preserves figure one`, () => {
    const s = checkpoint(setup), { ui } = launch(s), id = reward(s, kind).id;
    change(ui, "rewardEnemy-" + id, "huntsmans-minion-2");
    identity(ui.el("rewardTarget-" + id).textContent, s, "huntsmans-minion-2");
    const actual = useReward(ui, id), expected = E.dispatch(s, { type: "USE_REWARD", rewardId: id, enemyId: "huntsmans-minion-2" });
    assert.deepEqual(actual, expected);
    if (setup === "gloves") {
      assert(!actual.enemies.some(enemy => enemy.id === "huntsmans-minion-2"));
      assert.deepEqual(statusIds(ui), [], "a dead target does not transfer its overlay to the automatic enemy fallback");
    }
    else assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 1);
    assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, s.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp);
  });

test("Beast Roar sends each identified figure to its own chosen destination without damaging either one", () => {
  const s = checkpoint("roar"), { ui } = launch(s), id = reward(s, "beast-roar").id,
    targets = E.rewardsView(s).rewards.find(item => item.id === id).controls.targets,
    moves = targets.map(target => ({ enemyId: target.enemyId,
      node: target.enemyId === "huntsmans-minion-1" ? "tile-01:bottom" : target.enemyId === "huntsmans-minion-2" ? "tile-11:street" : H(s).position }));
  for (const move of moves) {
    change(ui, `rewardMove-${id}-${move.enemyId}`, move.node);
    assert.deepEqual(selectedMarkers(ui), [move.enemyId], "changing a destination highlights the owner of that row");
  }
  const actual = useReward(ui, id); assert.deepEqual(actual, E.dispatch(s, { type: "USE_REWARD", rewardId: id, moves }));
  for (const move of moves) assert.equal(actual.enemies.find(enemy => enemy.id === move.enemyId).node, move.node);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 5);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 5);
});

test("after a reward effect, real HP is shown only for the enemy explicitly inspected on the map", () => {
  let s = checkpoint("tiny"); s = checked(E.dispatch(s, { type: "USE_REWARD", rewardId: reward(s, "tiny-tonitrus").id,
    enemyId: "huntsmans-minion-2" }));
  const { ui } = launch(s), saved = ui.storage.get(qaKey);
  assert.equal(s.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 3);
  assert.deepEqual(statusIds(ui), [], "loading does not turn the automatic enemy fallback into a visible overlay");
  for (const enemy of s.enemies) {
    mapFigure(ui, enemy.id); mapStatus(ui, s, enemy.id); assert.equal(ui.storage.get(qaKey), saved);
  }
});

test("initial rendering, refresh and a public file load leave enemy HUD hidden until a map or list target is explicitly selected", async () => {
  const s = checkpoint("tiny"), { ui, normal } = launch(s), saved = ui.storage.get(qaKey);
  assert.deepEqual(statusIds(ui), []);
  panel(ui, "enemies"); assert.deepEqual(statusIds(ui), [], "opening the enemy list does not select its default enemy");
  const listTarget = ui.el("nearEnemies").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === "huntsmans-minion-1");
  assert(listTarget); listTarget.click(); mapStatus(ui, s, "huntsmans-minion-1");
  mapFigure(ui, "huntsmans-minion-2"); mapStatus(ui, s, "huntsmans-minion-2");
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(ui.storage.get(normalKey), normal);
  const reload = launch(E.importSave(saved));
  assert.deepEqual(statusIds(reload.ui), [], "selection and HUD are not restored from a gameplay save");
  mapFigure(reload.ui, "huntsmans-minion-2"); mapStatus(reload.ui, s, "huntsmans-minion-2");
  const input = { files: [{ text: async () => saved }], value: "same-qa-hunt.json" };
  await reload.ui.el("file").onchange({ target: input });
  assert.equal(reload.ui.el("error").textContent, ""); assert.deepEqual(statusIds(reload.ui), []);
  assert.equal(reload.ui.storage.get(qaKey), saved); assert.equal(reload.ui.storage.get(normalKey), normal);
  assert.deepEqual(current(reload.ui), s);
});

test("selecting a cell, entrance, tile information or clearing the target removes its HUD without changing the save", () => {
  const s = checkpoint("tiny"), { ui, normal } = launch(s, { BBHuntMapControls: require("../src/hunt-map-controls") }), saved = ui.storage.get(qaKey),
    target = "huntsmans-minion-2", otherNode = E.nodes(s).find(node => node.id !== H(s).position).id,
    actions = [
      ["cell", () => ui.el("chapterMap").querySelectorAll("[data-node]").find(button => button.dataset.node === otherNode && !button.dataset.entrance)],
      ["entrance", () => ui.el("chapterMap").querySelectorAll("[data-entrance]")[0]],
      ["tile title", () => ui.el("chapterMap").querySelectorAll("[data-tile-info]")[0]],
      ["current tile information", () => ui.el("inspectCurrentTile")],
      ["clear target", () => ui.el("clearMapTarget")],
    ];
  for (const [name, action] of actions) {
    mapFigure(ui, target); mapStatus(ui, s, target);
    const button = action(); assert(button && !button.disabled); button.click();
    assert.deepEqual(statusIds(ui), [], "the enemy HUD ends with explicit non-enemy selection or cancellation: " + name);
    assert.equal(ui.storage.get(qaKey), saved); assert.equal(ui.storage.get(normalKey), normal);
  }
  assert.deepEqual(current(ui), s);
});

test("inventory target two previews immediately without a game action or closing its panel and is retained before use", () => {
  const s = checkpoint("tiny"), { ui, normal } = launch(s), item = H(s).consumables.find(item => item.kind === "pungent-blood"), saved = ui.storage.get(qaKey);
  panel(ui, "inventory"); ui.el("inventory").querySelectorAll("[data-item]").find(button => button.dataset.item === item.id).click();
  targetOptions(ui, "itemEnemy", s);
  change(ui, "itemEnemy", "huntsmans-minion-2"); identity(inventorySummary(ui), s, "huntsmans-minion-2");
  assert.deepEqual(selectedMarkers(ui), ["huntsmans-minion-2"]); assert.equal(ui.storage.get(qaKey), saved);
  mapStatus(ui, s, "huntsmans-minion-2");
  assert.equal(ui.el("infoDialog").open, false); assert.equal(ui.el("workspaceInventory").hidden, false); assert.equal(ui.document.activeElement, ui.el("itemEnemy"));
  progress(ui);
  panel(ui, "inventory"); assert.equal(ui.el("itemEnemy").value, "huntsmans-minion-2");
  ui.el("useItem").click(); const actual = current(ui);
  assert.deepEqual(actual, E.dispatch(s, { type: "USE_CONSUMABLE", itemId: item.id, enemyId: "huntsmans-minion-2" }));
  assert(actual.skipActivation.includes("huntsmans-minion-2")); assert(!actual.skipActivation.includes("huntsmans-minion-1"));
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1").hp, 5);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").hp, 5); assert.equal(ui.storage.get(normalKey), normal);
});

test("a pebble's identified enemy and destination move only figure two while figure one remains in the original cell", () => {
  const s = checkpoint("tiny"), { ui } = launch(s), item = H(s).consumables.find(item => item.kind === "pebble");
  panel(ui, "inventory"); ui.el("inventory").querySelectorAll("[data-item]").find(button => button.dataset.item === item.id).click();
  targetOptions(ui, "itemEnemy", s); change(ui, "itemEnemy", "huntsmans-minion-2"); change(ui, "itemNode", "tile-01:bottom");
  identity(inventorySummary(ui), s, "huntsmans-minion-2"); ui.el("useItem").click();
  const actual = current(ui), expected = E.dispatch(s, { type: "USE_CONSUMABLE", itemId: item.id, enemyId: "huntsmans-minion-2", node: "tile-01:bottom" });
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-1"), s.enemies.find(enemy => enemy.id === "huntsmans-minion-1"));
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsmans-minion-2").node, "tile-01:bottom");
});

// Constructed, assertState-validated fixtures isolate fixed entry reactions.
// Their two figures are assembled directly, then real END_TURN/ACTIVATE enter
// the reaction. Plain JSON is intentional: these two tests do not claim a
// canonical save import or a naturally reached campaign checkpoint.
function entryFixture(torch = false) {
  let s = E.create(123, torch ? "burial" : "rifle-spear", 0, null, "hunter-pistol", "center",
    { campaign: false, rulesVersion: 14, ...(torch ? { practiceRewards: ["hunter-torch"] } : {}) });
  s.world.assignments.find(assignment => assignment.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [1, 2].map(figure => ({ id: "huntsman-mob-" + figure, kind: "huntsman-mob", figure, node: "tile-14:left", hp: 4 }));
  s.loot = []; E.assertState(s); s = E.dispatch(s, { type: "END_TURN" });
  assert.equal(s.phase, "activation"); s = E.dispatch(s, { type: "ACTIVATE", enemyId: "huntsman-mob-2" });
  assert.equal(s.phase, torch ? "reward_entry" : "weapon_entry");
  assert.equal(s.firearmEntry.enemyId, "huntsman-mob-2"); E.assertState(s); return s;
}
function launchConstructed(s) {
  const calls = [], saved = JSON.stringify(s), ui = boot(s, E.missionView(s), E.rewardsView(s), { realInventory: true,
    storage: { [normalKey]: saved }, engine: { ...E,
      importSave: JSON.parse, exportSave: JSON.stringify,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value,
      applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      dispatch(state, command) { calls.push(JSON.parse(JSON.stringify(command))); return E.dispatch(state, command); } } });
  return { ui, calls, saved };
}
function displayFixture(figures) {
  const s = E.create(123, "hunter-axe", 1, null, "hunter-pistol", "center",
    { campaign: false, rulesVersion: 14, practiceRewards: ["tiny-tonitrus"] });
  s.world.assignments.find(assignment => assignment.enemyId === "huntsmans-minion").sideId = "a";
  s.enemies = figures.map(figure => ({ node: "tile-14:center", hp: 3, ...figure }));
  s.loot = []; E.assertState(s); return s;
}
test("current same-name enemies are numbered by array appearance order instead of their reusable figure numbers", () => {
  // Constructed presentation fixture: figure 1 has been replaced after figure
  // 2 in the current list. No natural-history or canonical-import claim is made.
  const s = displayFixture([2, 1].map(figure => ({ id: "huntsmans-minion-" + figure, kind: "huntsmans-minion", figure }))),
    before = JSON.stringify(s), { ui, calls, saved } = launchConstructed(s), id = reward(s, "tiny-tonitrus").id,
    select = ui.el("rewardEnemy-" + id), name = E.enemyDef(s, s.enemies[0]).name;
  assert.equal(option(select, "huntsmans-minion-2"), name + "#1");
  assert.equal(option(select, "huntsmans-minion-1"), name + "#2");
  assert.deepEqual(statusIds(ui), []);
  for (const enemy of s.enemies) {
    mapFigure(ui, enemy.id);
    mapStatus(ui, s, enemy.id);
    const marker = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === enemy.id);
    assert(marker.getAttribute("aria-label").startsWith(compactLabel(s, enemy.id) + " ·"),
      "map marker, status overlay and target option use the same appearance-order identity");
  }
  assert.equal(JSON.stringify(s), before); assert.equal(ui.storage.get(normalKey), saved); assert.equal(calls.length, 0);
});
test("a single enemy has only its name even when its physical figure number is four", () => {
  const s = displayFixture([{ id: "huntsmans-minion-4", kind: "huntsmans-minion", figure: 4 }]),
    { ui, calls, saved } = launchConstructed(s), id = reward(s, "tiny-tonitrus").id,
    label = option(ui.el("rewardEnemy-" + id), "huntsmans-minion-4");
  assert.equal(label, E.enemyDef(s, s.enemies[0]).name); assert.doesNotMatch(label, /#|번|체력|중앙 등불/);
  assert.deepEqual(statusIds(ui), []); mapFigure(ui, "huntsmans-minion-4");
  mapStatus(ui, s, "huntsmans-minion-4");
  assert.equal(ui.storage.get(normalKey), saved); assert.equal(calls.length, 0);
});
test("a special component and an ordinary enemy sharing a base kind keep separate public names without extra numbers", () => {
  const s = displayFixture([{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1 },
    { id: "mission-patient", kind: "huntsman-mob", figure: 1, componentId: "female-patient",
      componentSpec: "female-patient-a", componentPhase: 1, missionId: "patient" }]),
    { ui } = launchConstructed(s), id = reward(s, "tiny-tonitrus").id, select = ui.el("rewardEnemy-" + id);
  for (const enemy of s.enemies) {
    assert.equal(option(select, enemy.id), E.enemyDef(s, enemy).name);
    assert.doesNotMatch(option(select, enemy.id), /#/);
  }
});
test("map status shows mission-token counts alongside real HP without adding the token data to compact target names", () => {
  const s = E.create(123, "hunter-axe", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }),
    enemy = { id: "scourge-beast-1", kind: "scourge-beast", figure: 1, node: "tile-14:center", hp: 2, missionId: "main" };
  s.enemies = [enemy]; s.loot = [];
  s.mission.targets.main = { id: "main", card: 3, tile: "tile-14", node: enemy.node, kind: enemy.kind,
    initialTokens: 3, tokens: 2, complete: false, enemyId: enemy.id };
  E.assertState(s); const { ui, calls, saved } = launchConstructed(s);
  assert.deepEqual(statusIds(ui), []); mapFigure(ui, enemy.id);
  mapStatus(ui, s, enemy.id, 2);
  assert.equal(ui.storage.get(normalKey), saved); assert.equal(calls.length, 0);
});
test("an actual boss's explicit zero insight tokens remains visible as zero", () => {
  const B = require("../src/boss-components"), s = displayFixture([]),
    enemy = { id: "mission-main", kind: "scourge-beast", figure: 1, node: "tile-14:center", hp: 7,
      componentId: "cleric-beast", componentSpec: "cleric-beast", componentPhase: 1, missionId: "main",
      actualComponent: true, insightTokens: 0, bossDecks: B.createDecks("cleric-beast", s, (_, deck) => deck) };
  s.enemies = [enemy]; E.assertState(s); const { ui } = launchConstructed(s);
  assert.deepEqual(statusIds(ui), []); mapFigure(ui, enemy.id);
  mapStatus(ui, s, enemy.id, 0);
});
function mapFigure(ui, id) {
  const button = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === id);
  assert(button); button.click();
}
function inspectFixedEntry(ui, s, calls, saved) {
  mapFigure(ui, "huntsman-mob-1"); assert.deepEqual(selectedMarkers(ui), ["huntsman-mob-1"]);
  const inspect = ui.el("decisions").querySelectorAll("[data-inspect-target]").find(button => button.dataset.inspectTarget === "huntsman-mob-2");
  assert(inspect); inspect.click(); assert.deepEqual(selectedMarkers(ui), ["huntsman-mob-2"]);
  assert.equal(ui.storage.get(normalKey), saved); assert.equal(calls.length, 0);
  mapFigure(ui, "huntsman-mob-1"); assert.deepEqual(selectedMarkers(ui), ["huntsman-mob-1"]);
  assert.equal(ui.storage.get(normalKey), saved); assert.equal(calls.length, 0);
}

test("a fixed rifle-entry reaction identifies incoming figure two even while figure one is selected on the map", () => {
  const s = entryFixture(), { ui, calls, saved } = launchConstructed(s);
  inspectFixedEntry(ui, s, calls, saved);
  const labels = [...ui.el("decisions").innerHTML.matchAll(/<button\b[^>]*data-command="ENTRY_WEAPON"[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1]);
  assert(labels.length); for (const label of labels) identity(label, s, "huntsman-mob-2");
  const cardId = H(s).hand[0].id;
  ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === cardId).click();
  ui.el("slots").querySelectorAll("[data-slot]").find(button => +button.dataset.slot === 0).click();
  const accept = ui.buttons("decisionActions").find(button => button.dataset.command === "ENTRY_WEAPON" && JSON.parse(button.dataset.args).accept);
  assert(accept && !accept.disabled); assert.equal(calls.length, 0); assert.equal(ui.storage.get(normalKey), saved);
  const command = { type: "ENTRY_WEAPON", accept: true, cardId, slot: 0 }; accept.click();
  assert.equal(ui.el("error").textContent, ""); const actual = JSON.parse(ui.storage.get(normalKey)); E.assertState(actual);
  assert.deepEqual(actual, E.dispatch(s, command)); assert(calls.every(call => JSON.stringify(call) === JSON.stringify(command)));
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsman-mob-1").hp, 4);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsman-mob-2").hp, 2);
  assert.equal(H(actual).slots[0].faceDown, true); assert.deepEqual(actual.enemyDiscard, s.enemyDiscard);
});

test("a torch-entry reaction identifies and inspects fixed figure two without retargeting the actual one-damage effect", () => {
  const s = entryFixture(true), { ui, calls, saved } = launchConstructed(s);
  inspectFixedEntry(ui, s, calls, saved);
  const summary = ui.el("decisions").innerHTML.match(/<p\b[^>]*class="target-selection-summary"[^>]*>([\s\S]*?)<\/p>/);
  assert(summary); identity(summary[1], s, "huntsman-mob-2"); assert.doesNotMatch(summary[1], /#1|1번/);
  const accept = ui.buttons("decisions").find(button => button.dataset.command === "ENTRY_REWARD" && JSON.parse(button.dataset.args).accept);
  assert(accept && !accept.disabled); const command = { type: "ENTRY_REWARD", ...JSON.parse(accept.dataset.args) };
  assert.equal(command.enemyId, undefined, "the fixed reaction target does not need a new retargeting command field");
  accept.click(); assert.equal(ui.el("error").textContent, "");
  const actual = JSON.parse(ui.storage.get(normalKey)); E.assertState(actual);
  assert.deepEqual(actual, E.dispatch(s, command)); assert(calls.every(call => JSON.stringify(call) === JSON.stringify(command)));
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsman-mob-1").hp, 4);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsman-mob-2").hp, 3);
  assert.equal(actual.enemies.find(enemy => enemy.id === "huntsman-mob-2").node, "tile-14:left");
  assert.equal(reward(actual, "hunter-torch").ready, false); assert.deepEqual(actual.enemyDiscard, s.enemyDiscard);
});
