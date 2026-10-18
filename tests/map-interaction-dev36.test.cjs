"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine"), G = require("../src/tile-geometry"),
  U = require("../src/hunt-map-controls"), L = require("../src/hunt-location-labels"), Camera = require("../src/hunt-camera"),
  Presentation = require("../src/hunt-presentation"), { boot } = require("./helpers/ui-harness.cjs");
const key = "bloodborne-hunt-v07", initial = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const timeline = [initial()];
for (const command of commands) timeline.push(E.dispatch(timeline.at(-1), command));
function launch(state, window = {}) {
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state) }, window: { BBHuntMapControls: U, ...window },
    engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s } });
}
function saved(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(key)); }
function mapCell(ui, node) { return ui.el("chapterMap").querySelectorAll("[data-node]").find(button => button.dataset.node === node && !button.dataset.entrance); }

test("screen-relative space names rotate while named places remain fixed and all callers agree", () => {
  const ruin = M.tile("tile-03"), entry = ruin.spaces.find(space => space.id === "entry"),
    lamp = M.tile("tile-04"), left = lamp.spaces.find(space => space.id === "left");
  assert.deepEqual([0, 1, 2, 3].map(rotation => G.spaceLabel(ruin, entry, rotation)),
    ["아래쪽 입구 칸", "왼쪽 입구 칸", "위쪽 입구 칸", "오른쪽 입구 칸"]);
  assert.deepEqual([0, 1, 2, 3].map(rotation => G.spaceLabel(lamp, left, rotation)),
    ["왼쪽 칸", "위 칸", "오른쪽 칸", "아래 칸"]);
  for (const tileId of Object.keys(G.tiles)) for (let rotation = 0; rotation < 4; rotation++) {
    const tile = M.tile(tileId), state = initial();
    state.world.tiles = [{ tileId, rotation, x: 0, y: 0 }];
    E.hunter(state).position = tileId + ":" + tile.spaces[0].id;
    const info = U.tileInfo(state, tileId);
    for (const space of tile.spaces) {
      const label = G.spaceLabel(tile, space, rotation), node = tileId + ":" + space.id;
      assert.equal(info.spaces.find(item => item.node === node).name, label);
      assert(L.node(state, node, E).includes(label));
      if (!/(위|아래|왼쪽|오른쪽)/.test(G.spaceLabel(tile, space))) assert.equal(label, G.spaceLabel(tile, space));
    }
  }
});

test("runtime tile artwork omits baked labels while the bottom legend stays upright and names selected spaces", () => {
  for (const tileId of Object.keys(G.tiles)) {
    const svg = fs.readFileSync(path.join(__dirname, "../assets/tiles", tileId + ".svg"), "utf8");
    const mapArtwork = fs.readFileSync(path.join(__dirname, "..", G.mapImage(tileId)), "utf8");
    assert.doesNotMatch(mapArtwork, /data-space-label=/, "offline map artwork needs no fetch or DOM rewrite");
    const originalGeometry = svg.replace(/<g font-family="Malgun Gothic,Apple SD Gothic Neo,Arial,sans-serif">[\s\S]*?<\/g>/, "");
    assert.equal(mapArtwork.replace(/<g font-family="Malgun Gothic,Apple SD Gothic Neo,Arial,sans-serif">[\s\S]*?<\/g>/, ""), originalGeometry,
      "only the printed label group changes in the offline map copy");
    assert.match(mapArtwork, /<svg/);
  }
  const state = timeline.find(state => state.world.tiles.some(placed => placed.rotation === 2 && M.tile(placed.tileId).spaces.some(space => /왼쪽|아래/.test(G.spaceLabel(M.tile(placed.tileId), space)))));
  assert(state, "normal play has a rotated public tile");
  const ui = launch(state), before = ui.storage.get(key), placed = state.world.tiles.find(placed => placed.rotation === 2), tile = M.tile(placed.tileId);
  for (const space of tile.spaces) {
    const node = placed.tileId + ":" + space.id, label = G.spaceLabel(tile, space, placed.rotation),
      legend = ui.el("chapterMap").querySelectorAll("[data-space-label-node]").find(button => button.dataset.spaceLabelNode === node);
    assert(legend); assert.equal(mapCell(ui, node).getAttribute("title"), label);
    legend.click(); assert(ui.el("tileInfo").textContent.includes(label));
    assert.equal(ui.storage.get(key), before);
  }
});

test("clicking an allowed destination during movement commits exactly the existing STEP and its normal card cost", () => {
  const start = initial(), cardId = E.hunter(start).hand[0].id, state = E.dispatch(start, { type: "MOVE", cardId }), ui = launch(state);
  const option = U.movement(state).directions.flatMap(direction => direction.options).find(option => option.enabled && option.command?.type === "STEP");
  assert(option); mapCell(ui, option.command.node).click();
  assert.deepEqual(saved(ui), E.dispatch(state, option.command));
  assert.equal(saved(ui).commands.at(-1).type, "STEP");
  assert.equal(E.hunter(saved(ui)).hand.length, E.hunter(start).hand.length - 1);
});

test("direct map movement respects diagonal-only button mode and unreachable inspection cannot jump", () => {
  const state = timeline.find(state => state.phase === "move" && U.movement(state).diagonalMode &&
    U.movement(state).directions.some(direction => ["N", "E", "S", "W"].includes(direction.edge) && direction.options.some(option => !option.enabled && option.command?.type === "STEP")));
  assert(state, "normal play reaches a split-space junction");
  const ui = launch(state), before = ui.storage.get(key), movement = U.movement(state),
    blocked = movement.directions.filter(direction => ["N", "E", "S", "W"].includes(direction.edge)).flatMap(direction => direction.options).find(option => option.command?.type === "STEP");
  assert(blocked); mapCell(ui, blocked.command.node).click(); assert.equal(ui.storage.get(key), before);
  const allowed = movement.directions.flatMap(direction => direction.options).find(option => option.enabled && option.command?.type === "STEP");
  mapCell(ui, allowed.command.node).click(); assert.deepEqual(saved(ui), E.dispatch(state, allowed.command));
});

test("map click departure keeps the survivor confirmation and commits only the chosen escort command sequence", () => {
  const state = timeline.find(state => state.phase === "move" && state.mission?.escort?.node === E.hunter(state).position &&
    !state.mission.escort.carrierId && U.movement(state).directions.some(direction => direction.options.some(option => option.enabled && option.command?.type === "STEP")));
  assert(state); const ui = launch(state), before = ui.storage.get(key), option = U.movement(state).directions.flatMap(direction => direction.options).find(option => option.enabled && option.command?.type === "STEP");
  mapCell(ui, option.command.node).click(); assert.equal(ui.storage.get(key), before); assert(ui.el("escortDialog").open);
  ui.el("escortAccept").click();
  const plan = require("../src/hunt-departure").plan(E, state, [option.command]);
  let reference = state; for (const command of plan.acceptCommands) reference = E.dispatch(reference, command);
  assert.deepEqual(saved(ui), reference);
});

test("the new map100 percent is the prior144 percent and fit/reset keep map-only coordinates consistent", () => {
  const viewport = { clientWidth: 800, clientHeight: 600, scrollLeft: 300, scrollTop: 250, addEventListener() {}, removeEventListener() {} },
    content = { offsetWidth: 500, offsetHeight: 400, style: {} }, surface = { style: {} }, notices = [],
    camera = Camera({ document: {}, viewport, content, surface, baseScale: 1.44, onChange: value => notices.push(value) });
  assert.equal(camera.zoom(), 1); assert.equal(camera.scale(), 1.44); assert.equal(content.style.transform, "scale(1.44)");
  const worldX = (viewport.scrollLeft + 120) / camera.scale(), worldY = (viewport.scrollTop + 80) / camera.scale();
  camera.setZoom(1.2, { anchorX: 120, anchorY: 80 });
  assert(Math.abs((viewport.scrollLeft + 120) / camera.scale() - worldX) < 1e-8);
  assert(Math.abs((viewport.scrollTop + 80) / camera.scale() - worldY) < 1e-8);
  camera.reset(); assert.equal(camera.scale(), 1.44); assert.equal(notices.at(-1).zoom, 1);
  camera.fit(); assert(Math.abs(camera.scale() - 1.44) < 1e-8, "a small map stays at its fit size within the existing max limit");
});

test("enemy sprite overlay selects the same enemy without spending a card and leaves uncovered object targets available", () => {
  const state = timeline.find(state => state.enemies.length > 0 && state.phase === "hunter"), enemy = state.enemies[0];
  let onHitAreas;
  const ui = launch(state, { BBHuntPresentation: options => {
    onHitAreas = options.onActorHitAreas;
    return { resize() {}, sync() {}, status: () => ({ charactersReady: true }), focus() {} };
  } }), before = ui.storage.get(key);
  onHitAreas([{ id: enemy.id, left: 50, top: 60, width: 42, height: 80 }]);
  const hit = ui.el("enemyHitLayer").querySelectorAll("[data-enemy]")[0];
  assert(hit); assert.equal(hit.style.width, "42px"); assert.equal(hit.style.height, "80px"); hit.click();
  assert(ui.el("mapContext").textContent.includes(E.enemyDef(state, enemy).name)); assert.equal(ui.storage.get(key), before);
  assert(ui.el("chapterMap").querySelectorAll("[data-map-object]").length > 0);
  onHitAreas([]); assert.equal(ui.el("enemyHitLayer").querySelectorAll("[data-enemy]").length, 0);
});

test("sprite hit areas use the actual trimmed animation body, including zoom and live tween positions", () => {
  let configuration; const sprites = [], hitAreas = [];
  const trim = { x: 30, y: 20, w: 40, h: 60 },
    atlasData = { frames: { "0": { frame: { x: 0, y: 0, w: 40, h: 60 }, rotated: false,
      trimmed: true, spriteSourceSize: trim, sourceSize: { w: 100, h: 100 } } }, meta: { size: { w: 40, h: 60 } } },
    character = { path: "assets/characters/mob.png", atlasPath: "assets/characters/mob.atlas.json", atlasData,
      frameWidth: 100, frameHeight: 100, frameCount: 1, displayHeight: 100, originY: .8, animations: { idle: [0] } };
  const sprite = (x, y, frame) => ({ x, y, frame, alpha: 1, anims: { stop() {} },
    setDepth() {}, setDisplaySize() {}, setOrigin() {}, play() {}, setFrame(value) { this.frame = value; },
    setTexture(_, value) { this.frame = value; }, removeAllListeners() {}, destroy() {} });
  const graphics = () => new Proxy({ destroy() {} }, { get(target, name) { return target[name] || (() => target); } });
  const scene = { load: { atlas() {} }, textures: { exists: () => true },
    anims: { exists: () => false, create() {}, generateFrameNumbers: (_, value) => value.frames },
    add: { sprite(x, y, texture, frame) { const value = sprite(x, y, frame); sprites.push(value); return value; }, graphics },
    tweens: { add() {}, killTweensOf() {}, killAll() {} } };
  const presentation = Presentation({ document: { createElement() {}, defaultView: { matchMedia: () => ({ matches: true }) } },
    viewport: { clientWidth: 800, clientHeight: 600 }, host: { dataset: {} }, characters: { mob: character },
    Phaser: { CANVAS: 1, Game: class { constructor(config) { configuration = config; this.canvas = { style: {}, setAttribute() {} }; this.scale = { resize() {} }; } destroy() {} } },
    onActorHitAreas: value => hitAreas.push(value) });
  configuration.scene.preload.call(scene); configuration.scene.create.call(scene);
  presentation.sync({ sceneId: "hit", revision: 1, actors: [{ id: "enemy", kind: "enemy", skin: "mob", x: 200, y: 200, scale: 1.44, hp: 4 }] });
  let area = hitAreas.at(-1)[0];
  assert.deepEqual(area, { id: "enemy", left: 168.2, top: 110.60000000000001, width: 63.60000000000002, height: 92.39999999999999 });
  assert(area.top < 130 && area.top + area.height > 200, "the head and torso above the foot marker are selectable");
  sprites[0].x = 250; sprites[0].y = 220; configuration.scene.update.call(scene, 0, 16);
  const moved = hitAreas.at(-1)[0]; assert(Math.abs(moved.left - area.left - 50) < 1e-8); assert(Math.abs(moved.top - area.top - 20) < 1e-8);
  sprites[0].flipX = true; configuration.scene.update.call(scene, 0, 16);
  assert.equal(hitAreas.at(-1)[0].width, moved.width);
  presentation.destroy();
});

test("start-space hover preserves transparent artwork rather than the generic gray button hover", () => {
  const css = fs.readFileSync(path.join(__dirname, "../styles/hunt-map-interaction.css"), "utf8");
  assert.match(css, /\.start-space:not\(:disabled\):hover/); assert.match(css, /filter: none; backdrop-filter: none/);
  assert.match(css, /background: #7dc5d52e/);
});
