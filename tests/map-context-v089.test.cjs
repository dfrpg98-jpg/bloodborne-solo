"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), B = require("../src/boss-components"), M = require("../src/chapter-engine");
const { boot } = require("./helpers/ui-harness.cjs");
const userBytes = fs.readFileSync(path.join(__dirname, "fixtures/user-play-fog-v089.json"), "utf8");
const user = JSON.parse(userBytes).state;
const key = "bloodborne-hunt-v07";
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: state => state };
function launch(state, bytes = E.exportSave(state)) {
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { engine, realInventory: true,
    storage: { [key]: bytes, "bloodborne-hunt-active-mode": "normal" } });
  return { state, ui, bytes };
}
function userAt(count) {
  let s = E.create(user.initialSeed, user.setup.weaponId, user.setup.face,
    user.setup.startingConsumable, user.setup.firearmId, user.setup.startSpace, user.setup);
  for (const command of user.commands.slice(0, count)) s = E.dispatch(s, command);
  return s;
}
function ordinaryAt(count) {
  let s = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
  for (const command of commands.slice(0, count)) s = E.dispatch(s, command);
  return s;
}
function inspect(f, kind, value) {
  const control = f.ui.el("chapterMap").querySelectorAll(`[data-${kind}]`)
    .find(button => button.dataset[kind] === value && !button.hasAttribute("data-entrance"));
  assert(control, `public ${kind} ${value} is selectable`); assert.equal(control.disabled, false); control.click();
  assert.equal(f.ui.el("mapContext").hidden, false); return f.ui.el("mapContext");
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(key), f.bytes, "inspection must preserve the exact original saved bytes");
  assert.equal(f.ui.el("error").textContent, "");
  assert.equal(f.ui.commands.length, 0, "inspection is not a gameplay command");
  assert.equal(f.ui.el("enemyDetailDialog").open, false, "map abilities appear inline rather than opening a modal");
  assert.equal(f.ui.el("infoDialog").open, false);
}
function clean(f, text) { return f.ui.window.BBHuntPublicText.clean(text, "skill"); }
function fullPublicAbilities(f, enemy, box) {
  const d = E.enemyDef(f.state, enemy), actions = [d.face?.basicAttack || d.basic,
    d.face?.specialAttack || d.special, d.face?.ability || d.ability].filter(Boolean);
  const text = box.textContent;
  for (const label of ["기본 공격", "특수 공격", "전용 능력"]) assert(text.includes(label), `inline ${label} remains readable`);
  for (const action of actions) {
    assert(text.includes(clean(f, action.name)), `inline ${action.name} is visible`);
    for (const rule of action.rules || []) assert(text.includes(clean(f, rule)), "inline inspection includes the full public rules");
  }
  assert.doesNotMatch(text, /campaigns\/long-hunt\/images|components\/images|bossDecks|참고자료\/|\[속도 \d+\]\s*속도로/);
}
function chooseCard(f, id) {
  const button = f.ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === id);
  assert(button); button.click();
}
function chooseSlot(f, slot) {
  const button = f.ui.el("slots").querySelectorAll("[data-slot]").find(button => Number(button.dataset.slot) === slot);
  assert(button); button.click();
}
function command(f, type) {
  return f.ui.el("mapContext").querySelectorAll("[data-command]").find(button => button.dataset.command === type && !button.disabled);
}
function behavior(state) { const copy = structuredClone(state); delete copy.commands; return copy; }

test("placed tile names are plain labels while an actual placement still offers its legal rotation choices", () => {
  const f = launch(userAt(5)), map = f.ui.el("chapterMap");
  assert.equal(map.querySelectorAll("a").length, 0, "tile inspection cannot open a separate image window");
  const titles = [...map.innerHTML.matchAll(/<div class="tile-name">([\s\S]*?)<\/div>/g)].map(match => match[1]);
  assert.equal(titles.length, f.state.world.tiles.length);
  for (const title of titles) assert.doesNotMatch(title, /<a\b|href=|target=|↗|[0-9]+°/, "placed-tile orientation is not exposed as a label");
  const entrance = M.openExits(f.state.world).find(exit => exit.node === E.hunter(f.state).position);
  if (entrance) assert(map.querySelectorAll("[data-entrance]").some(button => button.dataset.entrance === `${entrance.tileId}:${entrance.edge}`));
  unchanged(f);
  const pending = launch(userAt(4)); assert.equal(pending.state.phase, "tile_place");
  assert(pending.ui.el("decisions").querySelectorAll("[data-rotation]").length > 0, "actual tile placement keeps rotation controls");
  unchanged(pending);
});

for (const [count, tokens] of [[5, 1], [10, 0], [18, 0]])
  test(`the observed courtyard enemy at user command ${count} exposes ${tokens} mission insight tokens and all three public abilities inline`, () => {
    const state = count === 18 ? E.importSave(userBytes) : userAt(count),
      f = launch(state, count === 18 ? userBytes : E.exportSave(state)), enemy = state.enemies.find(enemy => enemy.missionId === "mob");
    assert(enemy); assert.equal(state.mission.targets.mob.tokens, tokens);
    const box = inspect(f, "enemy", enemy.id);
    assert(box.textContent.includes(`계몽 토큰 ${tokens}개`), "zero is visible after removing the token rather than disappearing");
    fullPublicAbilities(f, enemy, box); unchanged(f);
    if (E.hunter(state).hand.length) chooseCard(f, E.hunter(state).hand[0].id);
    const empty = E.hunter(state).slots.findIndex(slot => !slot); if (empty >= 0) chooseSlot(f, empty);
    assert(f.ui.el("mapContext").textContent.includes(`계몽 토큰 ${tokens}개`));
    fullPublicAbilities(f, enemy, f.ui.el("mapContext")); unchanged(f);
  });

test("seeing the mission enemy's token and abilities leaves its original single-card attack command, draw and cost unchanged", () => {
  const state = userAt(5), f = launch(state), attack = user.commands[5];
  assert.equal(attack.type, "ATTACK"); inspect(f, "enemy", attack.enemyId);
  chooseCard(f, attack.cardId); chooseSlot(f, attack.slot); unchanged(f);
  const control = command(f, "ATTACK"); assert(control); control.click();
  const actual = E.importSave(f.ui.storage.get(key)), expected = E.dispatch(state, attack);
  assert.deepEqual(behavior(actual), behavior(expected), "inline ability rendering cannot change the chosen attack or reveal a different action");
  assert.equal(actual.phase, "combat_react");
  assert.equal(actual.revision, state.revision + 1);
  assert.equal(E.hunter(actual).slots[attack.slot].id, attack.cardId);
  assert.equal(E.hunter(actual).hand.some(card => card.id === attack.cardId), false);
  assert.equal(actual.enemyDiscard.length, state.enemyDiscard.length + 1);
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual);
  assert.equal(f.ui.el("error").textContent, "");
});

test("the actual courtyard tile identifies its broken lamp without permitting a dream return to that node", () => {
  const state = userAt(13), f = launch(state), lampNode = "tile-04:center";
  assert.equal(state.phase, "return"); assert.equal(E.node(state, lampNode).lamp, false);
  const box = inspect(f, "node", lampNode);
  assert(box.textContent.includes("망가진 등불"));
  assert(box.textContent.includes("꿈"), "the disabled lamp explanation includes dream return");
  assert(f.ui.el("chapterMap").textContent.includes("망가진 등불"), "a broken lamp is visible on the map itself");
  const destinations = f.ui.el("decisions").querySelectorAll("[data-return]").map(button => button.dataset.return);
  assert(destinations.includes("tile-14:center")); assert(!destinations.includes(lampNode));
  unchanged(f);
});

test("the central-lamp mission exception remains available and explains fog entry without making that broken lamp a normal return destination", () => {
  const f = launch(userAt(17)); assert.equal(E.hunter(f.state).position, "tile-14:center");
  assert.equal(E.interactionOptions(f.state).teleport, true);
  inspect(f, "node", "tile-14:center"); chooseCard(f, user.commands[17].cardId);
  const destination = f.ui.el("tileLamp"); assert(destination);
  assert(destination.innerHTML.includes('value="tile-04:center"'), "the revealed special central-lamp fog-entry destination stays available");
  assert.match(f.ui.el("decisions").textContent, /안개/);
  assert.match(f.ui.el("decisions").textContent, /망가진 등불/);
  unchanged(f);
  destination.value = "tile-04:center"; destination.fire("change");
  const rescue = f.ui.el("tileRescue"); if (rescue) { rescue.checked = false; rescue.fire("change"); }
  assert.equal(f.ui.el("interact").disabled, false); f.ui.el("interact").click();
  const actual = E.importSave(f.ui.storage.get(key)), expected = E.dispatch(f.state, user.commands[17]);
  assert.deepEqual(behavior(actual), behavior(expected));
  assert.equal(E.hunter(actual).position, "tile-04:center");
  assert.equal(E.node(actual, "tile-04:center").lamp, false, "entering fog does not repair or reactivate the lamp");
});

for (const [spec, file, count] of [
  ["female-patient-a", "v074-patient-natural-commands.json", 187],
  ["iosefka-hostile", "v074-attack-iosefka-natural-commands.json", 297],
]) test(`${spec} map inspection retains the current public component abilities without copying another enemy's abilities`, () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true });
  for (const cmd of require("./fixtures/" + file).slice(0, count)) state = E.dispatch(state, cmd);
  const enemy = state.enemies.find(enemy => enemy.componentSpec === spec); assert(enemy);
  const f = launch(state), box = inspect(f, "enemy", enemy.id); fullPublicAbilities(f, enemy, box);
  const current = E.enemyDef(state, enemy), actions = [current.basic, current.special, current.ability].filter(Boolean).map(action => action.name);
  for (const other of state.enemies.filter(other => other.id !== enemy.id)) {
    const d = E.enemyDef(state, other);
    for (const action of [d.face?.basicAttack || d.basic, d.face?.specialAttack || d.special, d.face?.ability || d.ability].filter(Boolean))
      if (!actions.includes(action.name)) assert(!box.textContent.includes(clean(f, action.name)), "another enemy's attack is outside the selected context");
  }
  unchanged(f);
});

for (const count of [211, 218]) test(`the natural boss at command ${count} exposes only currently public combat actions in map context`, () => {
  const state = ordinaryAt(count), boss = state.enemies.find(enemy => enemy.componentId === "cleric-beast"); assert(boss);
  const f = launch(state), box = inspect(f, "enemy", boss.id),
    c = state.combat?.enemyId === boss.id ? state.combat : null,
    visible = [...new Set([c?.action, c?.immediate, c?.extra].filter(Boolean).map(action => action.name))];
  assert(box.textContent.includes(`계몽 토큰 ${boss.insightTokens || 0}개`));
  for (const name of visible) assert(box.textContent.includes(clean(f, name)), "an already revealed boss action stays readable inline");
  for (const phase of [1, 2]) for (const action of Object.values(B.definition("cleric-beast", phase)).filter(action => action?.type && action.name))
    if (!visible.includes(action.name)) assert(!box.textContent.includes(clean(f, action.name)), `undrawn phase ${phase} action ${action.name} stays hidden`);
  assert.doesNotMatch(box.innerHTML, /bossDecks|enemyDeck|campaigns\/long-hunt\/images|components\/images/);
  unchanged(f);
  const other = state.enemies.find(enemy => enemy.id !== boss.id);
  if (other) {
    const next = inspect(f, "enemy", other.id);
    for (const name of visible) assert(!next.textContent.includes(clean(f, name)), "switching targets cannot copy the boss combat into a different enemy");
    unchanged(f);
  }
});
