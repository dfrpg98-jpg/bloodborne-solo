"use strict";
const test = require("node:test"), assert = require("node:assert/strict"),
  fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"),
  G = require("../src/tile-geometry"), Controls = require("../src/hunt-map-controls"),
  { boot } = require("./helpers/ui-harness.cjs"),
  recipes = require("./fixtures/map-preview-dev38-recipes.json");
const key = "bloodborne-hunt-v07";
function reached(recipe) {
  const setup = recipe.setup;
  let state = E.create(setup.seed, setup.weaponId, setup.face, setup.startingConsumable,
    setup.firearmId, setup.startSpace, setup.options);
  for (const command of recipe.commands) state = E.dispatch(state, command);
  assert.equal(state.setup.qa, undefined); assert.equal(state.phase, "tile_place");
  assert.equal(state.world.pending.tileId, recipe.id);
  assert.deepEqual(E.importSave(E.exportSave(state)), state);
  return state;
}
function launch(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: Controls },
    engine: { ...E, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
  });
}
function contains(polygon, x, y) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index], [xj, yj] = polygon[previous];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

test("every caption stays inside its own rotated space's lower edge without rotating the text", () => {
  for (const tileId of Object.keys(G.tiles)) for (let rotation = 0; rotation < 4; rotation++) {
    for (const space of M.tile(tileId).spaces) {
      const position = G.labelPlacement(tileId, space.id, rotation),
        polygon = G.polygon(tileId, space.id, rotation),
        southGate = Math.max(...polygon.map(([, y]) => y)) > 89 && G.definition(tileId).exits.some(gate =>
          G.rotatePoint(gate.point, rotation)[1] === 100);
      assert(contains(polygon, position.x, position.y), `${tileId}:${space.id} rotation ${rotation}`);
      assert(contains(polygon, position.x - position.width / 2, position.y));
      assert(contains(polygon, position.x + position.width / 2, position.y));
      assert.equal(position.y, Math.min(Math.max(...polygon.map(([, y]) => y)) - 2, southGate ? 89 : 100));
      assert(position.width > 0 && position.width <= 96);
      assert.equal(position.gateClearance, southGate ? 16 : 0);
      if (southGate) assert(position.y <= 89, "a south entrance cannot cover its caption");
    }
  }
});

test("left/right captions follow their displayed spaces and a rotated entrance is named consistently", () => {
  const tile = M.tile("tile-04"), left = tile.spaces.find(space => space.id === "left"),
    right = tile.spaces.find(space => space.id === "right");
  assert(G.labelPlacement(tile.id, left.id, 0).x < G.labelPlacement(tile.id, right.id, 0).x);
  assert(G.labelPlacement(tile.id, left.id, 2).x > G.labelPlacement(tile.id, right.id, 2).x);
  assert.equal(G.spaceLabel(tile, left, 2), "오른쪽 칸");
  assert.equal(G.spaceLabel(tile, right, 2), "왼쪽 칸");
  const ruin = M.tile("tile-03"), entry = ruin.spaces.find(space => space.id === "entry");
  assert.equal(G.spaceLabel(ruin, entry, 2), "위쪽 입구 칸");
  assert(G.labelPlacement(ruin.id, entry.id, 2).y < 60);
});

test("all twenty local map images exist with standalone SVG content and unchanged public paths", () => {
  assert.equal(Object.keys(G.tiles).length, 20);
  for (const tileId of Object.keys(G.tiles)) {
    assert.equal(G.mapImage(tileId), `assets/tiles/map/${tileId}.svg`);
    const svg = fs.readFileSync(path.join(__dirname, "..", G.mapImage(tileId)), "utf8");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 1000 1000" width="1000" height="1000"/);
    assert.doesNotMatch(svg, /(?:href|src)="(?:https?:|\.\.\/|\/)/,
      "the image must decode without external resources or a different preview-relative base path");
  }
  const css = fs.readFileSync(path.join(__dirname, "../styles/hunt-map-interaction.css"), "utf8");
  assert.match(css, /\.hunt-main \.tile-space-labels \{[^}]*inset: 0/);
  assert.doesNotMatch(css, /top:\s*calc\(100%/);
  assert.match(css, /\.hunt-main \.chapter-map \{ row-gap: 0; \}/);
});

for (const recipe of recipes.cases) test(`${recipe.id}: normal public exploration preview rotates and places the same decodable image`, () => {
  const state = reached(recipe), ui = launch(state), before = ui.storage.get(key),
    map = ui.el("chapterMap"), options = E.placementOptions(state);
  assert(options.length);
  function verifyPreview(rotation) {
    const image = map.querySelectorAll("[data-tile-art]").find(image => image.dataset.tileArt === recipe.id);
    assert(image); assert.equal(image.getAttribute("src"), G.mapImage(recipe.id));
    assert.equal(image.dataset.tileRotation, String(rotation));
    assert(fs.existsSync(path.join(__dirname, "..", image.getAttribute("src"))));
    const tile = M.tile(recipe.id);
    for (const space of tile.spaces) assert(map.innerHTML.includes(G.spaceLabel(tile, space, rotation)));
  }
  verifyPreview(options[0]);
  const rotation = options.at(-1), rotate = ui.el("decisions").querySelectorAll("[data-rotation]")
    .find(button => Number(button.dataset.rotation) === rotation);
  assert(rotate && !rotate.disabled); rotate.click(); verifyPreview(rotation);
  assert.equal(ui.storage.get(key), before, "rotating an exploration preview spends no card or save command");
  const place = [...ui.el("decisions").querySelectorAll("[data-command]"),
    ...ui.el("decisionActions").querySelectorAll("[data-command]")]
    .find(button => button.dataset.command === "PLACE_TILE");
  assert(place && !place.disabled); place.click(); assert.equal(ui.el("error").textContent, "");
  const after = E.importSave(ui.storage.get(key));
  assert.deepEqual(after, E.dispatch(state, { type: "PLACE_TILE", rotation }));
  const image = map.querySelectorAll("[data-tile-art]").find(image => image.dataset.tileArt === recipe.id);
  assert(image); assert.equal(image.getAttribute("src"), G.mapImage(recipe.id));
});
