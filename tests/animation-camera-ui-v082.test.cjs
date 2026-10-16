"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), { boot } = require("./helpers/ui-harness.cjs"), createCamera = require("../src/hunt-camera");
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json"), normalKey = "bloodborne-hunt-v07";
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: state => state };
const checkpoints = new Map();
let fixture = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
checkpoints.set(0, fixture);
for (let i = 0; i < commands.length; i++) { fixture = E.dispatch(fixture, commands[i]); checkpoints.set(i + 1, fixture); }
function launch(count = 0) {
  const state = checkpoints.get(count), snapshots = [], resizes = [], focuses = [], cameras = [];
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [normalKey]: E.exportSave(state) }, engine,
    setupDocument(document) {
      const viewport = document.getElementById("mapViewport"), content = document.getElementById("chapterMap");
      viewport.clientWidth = 600; viewport.clientHeight = 350; viewport.scrollLeft = 0; viewport.scrollTop = 0;
      viewport._rect = { left: 0, top: 0, right: 600, bottom: 350, width: 600, height: 350 };
      content.offsetWidth = 980; content.offsetHeight = 560;
    },
    window: {
      BBHuntCamera(options) { const camera = createCamera(options); cameras.push(camera); return camera; },
      BBHuntPresentation(options) {
        return { sync(snapshot) { snapshots.push(JSON.parse(JSON.stringify(snapshot))); },
          resize(value) { resizes.push(value); }, focus(value) { focuses.push(value); },
          status() { return { renderer: "phaser", charactersReady: true }; }, destroy() {} };
      },
    },
  });
  return { ui, state, snapshots, resizes, focuses, camera: cameras[0], saved: ui.storage.get(normalKey) };
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(normalKey), f.saved, "camera and visual inspection preserve exact replay bytes");
  assert.equal(f.ui.el("error").textContent, "");
}
function button(ui, type) {
  return ["decisions", "firearm", "mapContext"].flatMap(id => ui.el(id)?.querySelectorAll("[data-command]") || [])
    .find(element => element.dataset.command === type && !element.disabled);
}
function latest(f) { return f.snapshots.at(-1); }
function actions(f) { return latest(f).actions || (latest(f).action ? [latest(f).action] : []); }
function selectEnemy(ui, id) {
  const target = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(element => element.dataset.enemy === id);
  assert(target, "a public map figure can be selected"); target.click();
}
function selectCardAndSlot(ui, command) {
  const card = ui.el("hand").querySelectorAll("[data-card]").find(element => element.dataset.card === command.cardId);
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find(element => Number(element.dataset.slot) === command.slot);
  assert(card && slot); card.click(); slot.click();
}
function matchesRuleResult(f, command) {
  const expected = E.dispatch(f.state, command), actual = E.importSave(f.ui.storage.get(normalKey));
  const functional = state => { const copy = structuredClone(state); delete copy.commands; return copy; };
  assert.deepEqual(functional(actual), functional(expected), "the animation/camera controller keeps exact canonical costs and results");
  const recorded = actual.commands.at(-1);
  for (const [key, value] of Object.entries(command)) {
    if (key === "boost" && value === "none") continue; // Older fixtures record an unused no-op alias.
    assert.deepEqual(recorded[key], value, `the actual public command preserves ${key}`);
  }
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual, "the actual emitted command replays to the exact saved state");
}

test("zoom in, out, reset and fit are accessible presentation controls with unchanged saves", () => {
  const f = launch(); assert(f.camera, "the actual camera module is mounted");
  for (const id of ["zoomIn", "zoomOut", "zoomReset", "zoomFit", "zoomLabel", "mapSurface"]) assert(f.ui.el(id), `${id} exists`);
  f.ui.el("zoomIn").click(); assert(f.camera.zoom() > 1); unchanged(f);
  f.ui.el("zoomOut").click(); assert.equal(f.camera.zoom(), 1); unchanged(f);
  f.ui.el("zoomIn").click(); f.ui.el("zoomReset").click(); assert.equal(f.camera.zoom(), 1); unchanged(f);
  f.ui.el("zoomFit").click(); assert(f.camera.zoom() >= 0.6 && f.camera.zoom() <= 1.8); unchanged(f);
  assert.match(f.ui.el("zoomLabel").textContent, /\d+%/);
  assert.equal(latest(f).revision, f.state.revision);
  assert(actions(f).length === 0, "camera changes do not invent a walk or attack");
});
test("keyboard zoom and background panning preserve the hunt, public target and phase", () => {
  const f = launch(9), viewport = f.ui.el("mapViewport");
  selectEnemy(f.ui, commands[9].enemyId); viewport.focus();
  viewport.fire("keydown", { key: "+" }); assert(f.camera.zoom() > 1); unchanged(f);
  viewport.fire("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: 300, clientY: 150 });
  viewport.fire("pointermove", { pointerId: 1, clientX: 200, clientY: 80 });
  viewport.fire("pointerup", { pointerId: 1 }); unchanged(f);
  assert.equal(latest(f).revision, f.state.revision); assert.equal(actions(f).length, 0);
  assert.equal(f.ui.document.documentElement.dataset.phase, f.state.phase);
});
test("camera snapshots keep unscaled edge padding outside the world origin used for cached actors", () => {
  const f = launch(), viewport = f.ui.el("mapViewport"), start = latest(f).view,
    world = { x: 140, y: 80 }, pad = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 },
    startScreen = { x: world.x * start.zoom + pad.x - viewport.scrollLeft,
      y: world.y * start.zoom + pad.y - viewport.scrollTop };
  f.camera.setZoom(1.8);
  const end = latest(f).view, ratio = end.zoom / start.zoom;
  const cached = { x: (startScreen.x + start.x) * ratio - end.x,
    y: (startScreen.y + start.y) * ratio - end.y };
  const live = { x: world.x * end.zoom + pad.x - viewport.scrollLeft,
    y: world.y * end.zoom + pad.y - viewport.scrollTop };
  assert.equal(cached.x, live.x, "a vanished actor projects to the same horizontal map location as a live actor");
  assert.equal(cached.y, live.y, "a vanished actor projects to the same vertical map location as a live actor");
  unchanged(f);
});
test("public character snapshots omit decks, future missions and hidden reward or behavior data", () => {
  const f = launch(218), visible = new Set(f.state.enemies.map(enemy => enemy.id)); visible.add("hunter");
  assert(latest(f).actors.length, "visible map characters are supplied to the renderer");
  for (const actor of latest(f).actors) {
    assert(visible.has(actor.id)); assert(["hunter", "enemy"].includes(actor.kind));
    for (const key of Object.keys(actor)) assert(["id", "kind", "node", "skin", "scale", "hp", "selected", "x", "y", "weaponId", "weaponFace"].includes(key), `public actor field ${key}`);
    assert(!actor.skin || !/images|\.jpe?g|참고자료/i.test(actor.skin), "appearance selects independently drawn local assets");
  }
  assert.deepEqual(Object.keys(latest(f)).sort(), ["actions", "actors", "revision", "sceneId", "view"].sort());
  assert.doesNotMatch(JSON.stringify(latest(f)), /bossDecks|actionDeck|pendingReward|nextReward|missionBranch|unrevealed/);
  unchanged(f);
});
test("declaring an attack reveals its legal enemy card without showing a resolved swing or hit", () => {
  const f = launch(9), command = commands[9]; selectEnemy(f.ui, command.enemyId); selectCardAndSlot(f.ui, command); unchanged(f);
  const action = button(f.ui, "ATTACK"); assert(action); action.click(); matchesRuleResult(f, command);
  assert.equal(actions(f).filter(action => action.type === "attack").length, 0);
  assert.equal(E.importSave(f.ui.storage.get(normalKey)).phase, "combat_react");
});
test("resolved speed-group attacks animate both public participants while preserving all canonical costs", () => {
  const f = launch(6), command = commands[6]; assert.equal(command.type, "RESOLVE");
  const action = button(f.ui, "RESOLVE"); assert(action); action.click(); matchesRuleResult(f, command);
  const hits = actions(f).filter(action => action.type === "attack");
  assert(hits.some(action => action.fromId === "hunter" && action.toId === f.state.combat.enemyId && action.damage === 4));
  assert(hits.some(action => action.fromId === f.state.combat.enemyId && action.toId === "hunter" && action.damage === 2));
});
test("an interrupting gun shot is distinct from the pending unresolved melee attack", () => {
  const f = launch(6), action = button(f.ui, "FIREARM"); assert(action, "the real prepared pistol can interrupt this actual basic attack");
  action.click(); matchesRuleResult(f, { type: "FIREARM" });
  assert(actions(f).some(action => action.type === "shot" && action.toId === f.state.combat.enemyId));
  assert.equal(actions(f).filter(action => action.type === "attack").length, 0);
});
test("automatic enemy activation moves are animated even though the player never selected ENEMY_STEP", () => {
  const f = launch(137), command = commands[137]; assert.equal(command.type, "END_TURN");
  const action = button(f.ui, command.type); assert(action); action.click(); matchesRuleResult(f, command);
  assert(actions(f).some(action => action.type === "move" && action.fromId === "huntsman-mob-1"));
  assert.equal(E.importSave(f.ui.storage.get(normalKey)).phase, "combat_choose");
});
test("inspecting distant targets retains the user's zoom and leaves unrevealed boss actions hidden", () => {
  const f = launch(218), boss = f.state.enemies.find(enemy => enemy.componentId === "cleric-beast"); assert(boss);
  f.ui.el("zoomIn").click(); const zoom = f.camera.zoom(); selectEnemy(f.ui, boss.id);
  assert.equal(f.camera.zoom(), zoom); unchanged(f);
  const definition = E.enemyDef(f.state, boss), displayed = f.ui.el("mapContext").textContent + f.ui.el("componentCards").textContent,
    shown = f.state.combat?.enemyId === boss.id ? f.state.combat.action?.name : null;
  for (const action of Object.values(definition).filter(value => value && typeof value === "object" && value.type && value.name))
    if (action.name !== shown) assert(!displayed.includes(action.name), `future boss behavior ${action.name} stays hidden`);
  assert.equal(actions(f).length, 0);
});
