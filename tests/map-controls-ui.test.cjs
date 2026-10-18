"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"), G = require("../src/tile-geometry"), U = require("../src/hunt-map-controls");
const { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07", root = path.join(__dirname, "..");
const plain = value => JSON.parse(JSON.stringify(value));
const initial = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
const fixture = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const timeline = [initial()];
for (const command of fixture) timeline.push(E.dispatch(timeline.at(-1), command));
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: U },
    engine: { ...E, applyTileSpeedRuling:state=>state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } });
}
function saved(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); }
function command(ui, type) { return ui.el("movementControls").querySelectorAll("[data-command]").find(button => button.dataset.command === type); }
function direction(ui, edge) { return ui.el("movementControls").querySelectorAll("[data-move-direction]").find(button => button.dataset.moveDirection === edge); }
function select(ui, cardId) {
  const card = ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId);
  assert(card); card.click();
}

test("movement controls spend the selected hand card once, then STEP and STOP_MOVE use the canonical costs", () => {
  const state = initial(), ui = launch(state), before = ui.storage.get(key), id = E.hunter(state).hand[0].id;
  assert.equal(command(ui, "MOVE").disabled, true);
  assert(U.movement(state).directions.every(direction => direction.options.every(option => !option.enabled)));
  select(ui, id); assert.equal(ui.storage.get(key), before); assert.equal(command(ui, "MOVE").disabled, false);
  assert.equal(direction(ui, "E").disabled, true, "directional movement begins only after the paid MOVE");
  command(ui, "MOVE").click();
  let reference = E.dispatch(state, { type: "MOVE", cardId: id }); assert.deepEqual(saved(ui), reference);
  assert.match(ui.el("movementRemaining").textContent, /2/);
  direction(ui, "E").click(); reference = E.dispatch(reference, { type: "STEP", node: "tile-14:right" });
  assert.deepEqual(saved(ui), reference); assert.equal(E.hunter(reference).discard.length, E.hunter(state).discard.length + 1);
  command(ui, "STOP_MOVE").click(); reference = E.dispatch(reference, { type: "STOP_MOVE" });
  assert.deepEqual(saved(ui), reference); assert.equal(reference.phase, "hunter");
});

test("the directional EXPLORE reveals only the drawn tile and preserves the existing legal placement flow", () => {
  const state = initial(), id = E.hunter(state).hand[0].id, ui = launch(state), before = ui.storage.get(key);
  const hidden = state.world.tileDeck[0];
  assert(!ui.el("tileInfo").innerHTML.includes(hidden)); assert(!ui.el("movementControls").innerHTML.includes(hidden));
  select(ui, id); assert.equal(ui.storage.get(key), before); command(ui, "MOVE").click(); direction(ui, "N").click();
  let reference = E.dispatch(E.dispatch(state, { type: "MOVE", cardId: id }), { type: "EXPLORE", edge: "N" });
  assert.deepEqual(saved(ui), reference); assert.equal(reference.phase, "tile_place");
  assert(ui.el("movementControls").querySelectorAll("[data-move-direction]").every(button => button.disabled));
  assert(!command(ui, "STOP_MOVE"), "a pending tile must be placed before the move can finish");
  const rotation = E.placementOptions(reference)[0];
  ui.el("decisions").querySelectorAll("[data-rotation]").find(button => Number(button.dataset.rotation) === rotation).click();
  ui.buttons("decisions").find(button => button.dataset.command === "PLACE_TILE").click();
  reference = E.dispatch(reference, { type: "PLACE_TILE", rotation });
  assert.deepEqual(saved(ui), reference); assert.equal(reference.move.remaining, 1);
});

test("two real half-tile branches use separate diagonal buttons instead of an ambiguous down button", () => {
  const state = timeline[32], ui = launch(state), before = ui.storage.get(key);
  assert.equal(state.phase, "move"); assert.equal(E.hunter(state).position, "tile-17:top");
  const downRight = U.movement(state).directions.find(direction => direction.edge === "SE");
  assert.equal(downRight.options.filter(option => option.enabled).length, 1);
  assert.equal(direction(ui, "S").disabled, true);
  direction(ui, "S").click(); assert.equal(ui.storage.get(key), before);
  assert.equal(ui.el("movementControls").querySelectorAll("[data-move-option]").length, 0);
  direction(ui, "SE").click();
  assert.deepEqual(saved(ui), E.dispatch(state, downRight.options[0].command));
  assert.equal(E.hunter(saved(ui)).position, "tile-17:lower-right");
});

test("directional departure uses the existing survivor confirmation and does not commit before the answer", () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  for (const command of require("./fixtures/v074-shelter-natural-commands.json").slice(0, 75)) state = E.dispatch(state, command);
  const ui = launch(state); select(ui, "card-1"); command(ui, "MOVE").click();
  const walking = saved(ui), before = ui.storage.get(key), view = U.movement(walking);
  const destination = view.directions.find(direction => direction.options.some(option => option.command?.node === "tile-11:street"));
  assert(destination); direction(ui, destination.edge).click(); assert.equal(ui.el("escortDialog").open, true);
  assert.equal(ui.storage.get(key), before, "the STEP waits for the already implemented escort answer");
  ui.el("escortAccept").click();
  const reference = E.dispatch(E.dispatch(walking, { type: "MISSION_PICKUP" }), { type: "STEP", node: "tile-11:street" });
  assert.deepEqual(saved(ui), reference); assert.equal(reference.mission.escort.carrierId, reference.activeHunterId);
});

test("mandatory reward, combat and fog constraints remain blocking in the direction controller", () => {
  const reward = timeline.find(state => state.phase === "hunter" && E.rewardsView(state)?.choices?.length);
  const ui = launch(reward); select(ui, E.hunter(reward).hand[0].id);
  assert.equal(command(ui, "MOVE").disabled, true); assert.match(ui.el("movementControls").textContent, /보상 선택/);
  const combat = timeline.find(state => state.phase === "combat_react"), combatUi = launch(combat);
  assert.equal(command(combatUi, "MOVE").disabled, true);
  assert(combatUi.el("movementControls").querySelectorAll("[data-move-direction]").every(button => button.disabled));
  const fog = timeline.find(state => state.phase === "move" && E.missionView(state)?.fog?.includes(E.node(state, E.hunter(state).position)?.tile));
  assert(fog); const view = U.movement(fog);
  for (const direction of view.directions) for (const option of direction.options) {
    if (option.command?.type === "EXPLORE" || option.command?.node && E.node(fog, option.command.node).tile !== E.node(fog, E.hunter(fog).position).tile)
      assert.equal(option.enabled, false, "walking out of fog cannot bypass the original context restriction");
  }
});

test("selected-space inspection shows its actual enemy and insight, with tile-wide rules and no game command", () => {
  const state = timeline.find(state => E.missionView(state)?.fog?.includes("tile-04") &&
    state.enemies.some(enemy => enemy.node.startsWith("tile-04:")));
  assert(state); const ui = launch(state), before = ui.storage.get(key);
  const title = ui.el("chapterMap").querySelectorAll("[data-tile-info]").find(button => button.dataset.tileInfo === "tile-04");
  assert(title); title.click(); assert.equal(ui.storage.get(key), before);
  assert.equal(ui.el("tileInfo").querySelectorAll(".tile-info-space").length, 1);
  const enemy = state.enemies.find(enemy => enemy.node.startsWith("tile-04:")),
    figure = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === enemy.id);
  assert(figure); figure.click();
  assert.match(ui.el("tileInfo").textContent, /마당 등불|망가진 등불|계몽/);
  const info = U.tileInfo(state, "tile-04"); assert(info.fog); assert(info.spaces.some(space => space.enemies.length));
  assert(info.spaces.some(space => space.interactions.some(text => text.includes("꿈 복귀 불가"))));
  assert(ui.el("tileInfo").querySelectorAll("[data-special-info]").length);
  assert.equal(ui.el("tileInfo").querySelectorAll(".tile-info-space").length, 1);
  const chip = ui.el("tileInfo").querySelectorAll("[data-special-info]")[0]; chip.focus(); chip.click();
  assert.equal(ui.el("mapContext").hidden, false); assert.equal(ui.el("workspaceProgress").hidden, false);
  assert.equal(ui.el("enemyDetailDialog"), null, "tile enemies use the same inline target view as map figures");
  assert(ui.el("enemyInspectionTitle")); assert(ui.el("enemyInspectionContent"));
  assert(ui.el("mapContext").textContent.includes(E.enemyDef(state, enemy).name));
  for (const action of [E.enemyDef(state, enemy).basic, E.enemyDef(state, enemy).special, E.enemyDef(state, enemy).ability])
    assert(ui.el("mapContext").textContent.includes(ui.window.BBHuntPublicText.clean(action.name, "skill")));
  assert.equal(ui.storage.get(key), before);
  ui.el("clearMapTarget").click(); assert.equal(ui.el("mapContext").hidden, true);
  const restoredChip = ui.el("tileInfo").querySelectorAll("[data-special-info]").find(button => button.dataset.specialInfo === enemy.id);
  assert(restoredChip); assert.equal(ui.document.activeElement, restoredChip, "closing returns focus to the current tile chip");
  assert.equal(ui.storage.get(key), before);
  const withLoot = timeline.find(state => state.loot.length && E.missionView(state)?.tokens?.some(token => token.node));
  assert(withLoot); const allInfo = withLoot.world.tiles.map(tile => U.tileInfo(withLoot, tile.tileId));
  assert(allInfo.some(info => info.spaces.some(space => space.loot > 0)));
  assert(allInfo.some(info => info.spaces.some(space => space.tokens.length)));
  const initialInfo = U.tileInfo(initial(), "tile-14"); assert.match(initialInfo.rules[0], /瞬間|순간이동/);
  assert.equal(U.tileInfo(initial(), initial().world.tileDeck[0]), null, "unrevealed tile contents are never inspected");
});

test("unnamed tiles omit their invented display name in both the map and tile panel", () => {
  const state = timeline.find(state => state.world.tiles.some(tile => !M.tile(tile.tileId).named));
  assert(state); const anonymous = state.world.tiles.find(tile => !M.tile(tile.tileId).named), ui = launch(state);
  assert.equal(U.tileInfo(state, anonymous.tileId).name, null);
  const button = ui.el("chapterMap").querySelectorAll("[data-tile-info]").find(button => button.dataset.tileInfo === anonymous.tileId);
  assert(button); assert(!button.getAttribute("aria-label").includes("명칭 없는")); button.click();
  assert(!ui.el("tileInfo").textContent.includes("명칭 없는"));
  assert(!ui.el("chapterMap").innerHTML.match(/tile-info-trigger[^>]*>명칭 없는/));
});

test("an empty space on an unnamed public tile retains its map address and selected-space label without taking an action", () => {
  const state = timeline.find(state => state.world.tiles.some(tile => !M.tile(tile.tileId).named));
  assert(state);
  const placed = state.world.tiles.find(tile => !M.tile(tile.tileId).named), definition = M.tile(placed.tileId),
    space = definition.spaces.find(space => !space.icons.length);
  assert(space, "the natural command fixture has revealed an empty unnamed space");
  const ui = launch(state), before = ui.storage.get(key), commandsBefore = saved(ui).commands.length,
    reference = ui.window.BBHuntLocationLabels.tile(state, placed.tileId).reference,
    node = placed.tileId + ":" + space.id,
    cell = ui.el("chapterMap").querySelectorAll("[data-node]").find(button => button.dataset.node === node);
  assert(cell); cell.click();
  const panel = ui.el("tileInfo");
  assert(panel.textContent.includes(reference), "the public map address identifies the inspected unnamed tile");
  assert(panel.textContent.includes(G.spaceLabel(definition, space, placed.rotation)), "selectedOnly uses the map's displayed space name");
  assert.doesNotMatch(panel.textContent, /비어있음|적 없음/);
  assert.equal(panel.querySelectorAll(".tile-info-enemies").length, 0, "an empty enemy column does not take space from the tile rules");
  assert.equal(panel.querySelectorAll(".tile-info-space").length, 1);
  assert(!panel.textContent.includes(definition.displayName), "no invented printed tile name is exposed");
  assert(!panel.textContent.includes(placed.tileId), "development identifiers are not player names");
  for (const other of definition.spaces.filter(other => other.id !== space.id))
    assert(!panel.textContent.includes(G.spaceLabel(definition, other, placed.rotation)), "other spaces remain omitted");
  assert.equal(ui.storage.get(key), before, "inspection leaves the exact save bytes unchanged");
  assert.equal(saved(ui).commands.length, commandsBefore, "inspection records no engine command");
  ui.el("inspectCurrentTile").click();
  assert(ui.el("tileInfo").textContent.includes("중앙 등불"), "named tiles retain their existing public name");
  assert.equal(ui.storage.get(key), before);
});

test("shared space names match every existing map diagram and the selected tile information", () => {
  for (const tileId of Object.keys(G.tiles)) {
    const tile = M.tile(tileId), svg = fs.readFileSync(path.join(root, G.image(tileId)), "utf8");
    for (const space of tile.spaces) {
      const printed = svg.match(new RegExp(`<text data-space-label="${space.id}"[^>]*>([^<]*)</text>`));
      assert(printed, tileId + ":" + space.id);
      assert.equal(G.spaceLabel(tile, space), printed[1], "tile information and the generator use the map's existing visible label");
    }
  }
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 8 });
  for (const command of require("./fixtures/full-campaign-v8-commands.json")) {
    state = E.dispatch(state, command);
    if (state.world.tiles.some(tile => tile.tileId === "tile-10")) break;
  }
  assert(state, "the natural campaign has revealed the two spaces around the building");
  const ui = launch(state), before = ui.storage.get(key), tile = M.tile("tile-10");
  for (const space of tile.spaces) {
    const button = ui.el("chapterMap").querySelectorAll("[data-node]").find(button => button.dataset.node === tile.id + ":" + space.id);
    const label = G.spaceLabel(tile, space);
    assert.equal(button.getAttribute("title"), label);
    button.click();
    assert(ui.el("tileInfo").innerHTML.includes(`<span>${label}</span>`), "the selected space title matches its map label");
    assert(!ui.el("tileInfo").textContent.includes(space.label), "the longer development description is not another space name");
    assert.doesNotMatch(ui.el("tileInfo").textContent, /비어있음|적 없음/);
    assert.equal(ui.storage.get(key), before);
  }
});

test("crossing a tile boundary keeps the inspected tile without repeating hunter location, and current-location inspection costs nothing", () => {
  const index = timeline.findIndex((state, i) => i + 1 < timeline.length && state.phase === "move" &&
    fixture[i]?.type === "STEP" && E.node(state, E.hunter(state).position).tile !== E.node(timeline[i + 1], E.hunter(timeline[i + 1]).position).tile);
  assert(index >= 0);
  const state = timeline[index], to = fixture[index].node, previousTile = E.node(state, E.hunter(state).position).tile, ui = launch(state);
  ui.el("chapterMap").querySelectorAll("[data-tile-info]").find(b => b.dataset.tileInfo === previousTile).click();
  const edge = U.movement(state).directions.find(d => d.options.some(o => o.command?.node === to));
  assert(edge); direction(ui, edge.edge).click();
  const options = ui.el("movementControls").querySelectorAll("[data-move-option]");
  if (options.length) {
    const selected = U.movement(state).directions.find(d => d.edge === edge.edge).options;
    options.find(b => selected[Number(b.dataset.moveOption)].command.node === to).click();
  }
  const reference = timeline[index + 1]; assert.deepEqual(saved(ui), reference);
  assert.equal(ui.el("tileInspectionStatus"), null);
  assert.equal(ui.el("chapterMap").querySelectorAll("[data-tile]").find(tile => tile.dataset.tile === previousTile).dataset.inspected, "true");
  assert.equal(ui.el("tileInfo").querySelectorAll(".tile-info-space").length, 1);
  assert.doesNotMatch(ui.el("tileInfo").textContent, /사냥꾼의 현재 위치|현재 놓인 대상 없음/);
  const before = ui.storage.get(key); ui.el("inspectCurrentTile").click();
  assert.equal(ui.storage.get(key), before);
  assert.equal(ui.el("chapterMap").querySelectorAll("[data-tile]").find(tile => tile.dataset.tile === E.node(reference, E.hunter(reference).position).tile).dataset.inspected, "true");
  const currentNode = E.node(reference, E.hunter(reference).position),
    currentSpace = M.tile(currentNode.tile).spaces.find(space => space.id === currentNode.spaceId);
  assert(ui.el("tileInfo").textContent.includes(currentSpace.placeName || currentSpace.label));
});

test("fixed core controls retain their original costs, selected card and phase-specific command handlers", () => {
  const state = initial(), ui = launch(state), dock = ui.el("decisionActions");
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]")
    .find(button => button.dataset.hunterIntent === "MOVE" && !button.disabled);
  assert(intent, "the movement action is available before selecting a card");
  const before = ui.storage.get(key); intent.click();
  assert.equal(ui.storage.get(key), before, "choosing the action does not spend its card");
  assert.equal(ui.el("confirmHunterAction").disabled, true);
  const cardId = E.hunter(state).hand[0].id; select(ui, cardId);
  dock.children.find(b => b.dataset.command === "MOVE").click();
  const moving = E.dispatch(state, { type: "MOVE", cardId }); assert.deepEqual(saved(ui), moving);
  assert(dock.children.some(b => b.dataset.command === "STOP_MOVE"));
  assert(!dock.children.some(b => b.dataset.command === "END_TURN"));
  dock.children.find(b => b.dataset.command === "STOP_MOVE").click();
  assert.deepEqual(saved(ui), E.dispatch(moving, { type: "STOP_MOVE" }));
});

test("every tile's printed labels counterrotate at their original local coordinates while boundaries, markers and text remain unchanged", () => {
  for (const tileId of Object.keys(G.tiles)) {
    const source = fs.readFileSync(path.join(root, "assets/tiles", tileId + ".svg"), "utf8");
    const originalTags = [...source.matchAll(/<text\b[^>]*data-space-label="([^"]+)"[^>]*>/g)];
    assert(originalTags.length > 0);
    for (let rotation = 0; rotation < 4; rotation++) {
      const upright = U.uprightSVG(source, rotation);
      const expected = source.replace(/<text\b[^>]*>/g, tag => {
        if (!rotation || !tag.includes("data-space-label=")) return tag;
        const x = tag.match(/\bx="([\d.\-]+)"/)[1], y = tag.match(/\by="([\d.\-]+)"/)[1];
        return tag.slice(0, -1) + ` transform="rotate(${-90 * rotation} ${x} ${y})">`;
      });
      assert.equal(upright, expected, `${tileId} rotation ${rotation}: only text orientation changes`);
      for (const [tag, spaceId] of originalTags) {
        const sourcePoint = [Number(tag.match(/\bx="([\d.\-]+)"/)[1]) / 10,
          Number(tag.match(/\by="([\d.\-]+)"/)[1]) / 10];
        assert.deepEqual(sourcePoint, G.definition(tileId).spaces[spaceId].labelPoint,
          `${tileId}:${spaceId} uses the same printed label position as the clickable geometry`);
        const [x, y] = G.rotatePoint(sourcePoint, rotation);
        assert(x >= 0 && x <= 100 && y >= 0 && y <= 100);
      }
    }
  }
});

test("movement remains between hand and weapon while goals get a full column and selected-space details stay compact above the map", () => {
  const html = fs.readFileSync(path.join(root, "hunt.html"), "utf8"), css = fs.readFileSync(path.join(root, "styles/hunt-workspace-layout.css"), "utf8");
  assert(html.indexOf('id="handHeading"') < html.indexOf('id="movementHeading"'));
  assert(html.indexOf('id="movementHeading"') < html.indexOf('id="weaponName"'));
  assert(html.indexOf('id="tileInfoPanel"') < html.indexOf('id="mapHeading"'));
  assert(html.indexOf('id="tileInfoPanel"') < html.indexOf('id="missionPanel"'));
  assert.match(css, /grid-template-columns: var\(--objective-width\) minmax\(0, 1fr\) var\(--decision-width, 320px\)/);
  assert.match(css, /@media \(max-width: 720px\)/); assert.match(css, /@media \(max-width: 480px\)/);
});
