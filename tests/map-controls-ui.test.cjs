"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../hunt-engine"), M = require("../chapter-engine"), G = require("../tile-geometry"), U = require("../hunt-map-controls");
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

test("two real half-tile branches in one direction require an explicit destination instead of picking the first", () => {
  const state = timeline[32], ui = launch(state), before = ui.storage.get(key);
  assert.equal(state.phase, "move"); assert.equal(E.hunter(state).position, "tile-17:top");
  const down = U.movement(state).directions.find(direction => direction.edge === "S");
  assert.equal(down.options.filter(option => option.enabled).length, 2);
  direction(ui, "S").click(); assert.equal(ui.storage.get(key), before);
  const choices = ui.el("movementControls").querySelectorAll("[data-move-option]");
  assert.equal(choices.length, 2); choices[1].click();
  assert.deepEqual(saved(ui), E.dispatch(state, down.options[1].command));
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

test("tile inspection shows current enemies, insight, objects, companions and printed rules without changing any game command", () => {
  const state = timeline.find(state => E.missionView(state)?.fog?.includes("tile-04") &&
    state.enemies.some(enemy => enemy.node.startsWith("tile-04:")));
  assert(state); const ui = launch(state), before = ui.storage.get(key);
  const title = ui.el("chapterMap").querySelectorAll("[data-tile-info]").find(button => button.dataset.tileInfo === "tile-04");
  assert(title); title.click(); assert.equal(ui.storage.get(key), before);
  assert.match(ui.el("tileInfo").textContent, /마당 등불|망가진 등불|계몽/);
  const info = U.tileInfo(state, "tile-04"); assert(info.fog); assert(info.spaces.some(space => space.enemies.length));
  assert(info.spaces.some(space => space.interactions.some(text => text.includes("꿈 복귀 불가"))));
  assert(ui.el("tileInfo").querySelectorAll("[data-special-info]").length);
  ui.el("tileInfo").querySelectorAll("[data-special-info]")[0].click(); assert.equal(ui.el("enemyDetailDialog").open, true);
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

test("the movement panel remains between the hand and weapon and the stylesheet supplies actual responsive three-column layout", () => {
  const html = fs.readFileSync(path.join(root, "hunt.html"), "utf8"), css = fs.readFileSync(path.join(root, "hunt-map-controls.css"), "utf8");
  assert(html.indexOf('id="handHeading"') < html.indexOf('id="movementHeading"'));
  assert(html.indexOf('id="movementHeading"') < html.indexOf('id="weaponName"'));
  assert(html.indexOf('id="tileInfoPanel"') < html.indexOf('id="mapHeading"'));
  assert.match(css, /grid-template-columns: minmax\(180px, 220px\) minmax\(0, 1fr\) minmax\(270px, 320px\)/);
  assert.match(css, /@media \(max-width: 720px\)/); assert.match(css, /@media \(max-width: 480px\)/);
});
