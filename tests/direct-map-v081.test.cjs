"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), M = require("../chapter-engine");
const { boot } = require("./helpers/ui-harness.cjs");
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const normalKey = "bloodborne-hunt-v07";
const realEngine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: state => state,
  applyCombatReactionRuling: state => state };
function initial() { return E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 }); }
function checkpoint(count) { let state = initial(); for (const command of commands.slice(0, count)) state = E.dispatch(state, command); return state; }
function realBoot(state) { return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
  storage: { [normalKey]: E.exportSave(state) }, engine: realEngine }); }
function mapTarget(ui, attribute, value) {
  const button = ui.el("chapterMap").querySelectorAll(`[data-${attribute}]`).find(element => element.dataset[attribute] === value);
  assert(button, `revealed ${attribute} target ${value} is selectable`); assert.equal(button.disabled, false); return button;
}
function chooseCard(ui, cardId) {
  const card = ui.el("hand").querySelectorAll("[data-card]").find(element => element.dataset.card === cardId);
  assert(card, "owned hand card is selectable"); card.click();
}
function chooseSlot(ui, index) {
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find(element => Number(element.dataset.slot) === index);
  assert(slot, "printed weapon slot is selectable"); slot.click();
}
function contextAction(ui, id) {
  return ui.el("mapContext").querySelectorAll("[data-context-id]").find(element => element.dataset.contextId === id && !element.disabled);
}
function commandAction(ui, type) {
  return ["mapContext", "decisions"].flatMap(id => ui.el(id)?.querySelectorAll("[data-command]") || [])
    .find(element => element.dataset.command === type && !element.disabled);
}
function unchanged(ui, before) {
  assert.equal(ui.el("error").textContent, ""); assert.equal(ui.storage.get(normalKey), before, "selection never writes a game command");
  assert.equal(ui.commands.length, 0);
}
function functional(state) { const value = JSON.parse(JSON.stringify(state)); delete value.commands; return value; }
function saved(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(normalKey)); }

test("every revealed cell and entrance can be inspected without consuming a card or revealing the next tile", () => {
  const state = initial(), ui = realBoot(state), before = ui.storage.get(normalKey),
    nodes = new Set(E.nodes(state).map(node => node.id)), exits = M.openExits(state.world);
  assert(ui.el("mapContext"), "the map selection has a dedicated action and cost panel");
  const cells = ui.el("chapterMap").querySelectorAll("[data-node]").filter(element => !element.hasAttribute("data-entrance"));
  assert.equal(cells.length, nodes.size, "all actually placed spaces are selectable");
  for (const cell of cells) {
    assert(nodes.has(cell.dataset.node)); assert.equal(cell.disabled, false); cell.click();
    assert(ui.el("mapContext").textContent.trim(), "the selected space has readable context"); unchanged(ui, before);
  }
  const entrance = exits.find(exit => exit.node === E.hunter(state).position);
  assert(entrance); mapTarget(ui, "entrance", `${entrance.tileId}:${entrance.edge}`).click(); unchanged(ui, before);
  for (const tileId of state.world.tileDeck) assert(!ui.el("chapterMap").innerHTML.includes(`data-tile="${tileId}"`), "the exploration preview cannot reveal the future tile");
});

test("a cell action spends one selected card and one movement point through the original MOVE then STEP commands", () => {
  const state = initial(), ui = realBoot(state), before = ui.storage.get(normalKey), cardId = commands[0].cardId,
    node = E.neighbors(state, E.hunter(state).position)[0];
  assert(node); mapTarget(ui, "node", node).click(); chooseCard(ui, cardId); unchanged(ui, before);
  assert.match(ui.el("mapContext").textContent, /카드\s*1장/);
  assert.match(ui.el("mapContext").textContent, /이동력\s*1/);
  const action = contextAction(ui, "move"); assert(action, "one contextual movement action is enabled"); action.click();
  const next = saved(ui), reference = E.dispatch(E.dispatch(state, { type: "MOVE", cardId }), { type: "STEP", node });
  assert.equal(next.revision, state.revision + 2); assert.deepEqual(functional(next), functional(reference));
  assert.equal(E.hunter(next).position, node); assert.equal(E.hunter(next).hand.length, E.hunter(state).hand.length - 1);
  assert.deepEqual(E.importSave(E.exportSave(next)), next);
});

test("an entrance action combines movement preparation and exploration while revealing only the tile actually drawn", () => {
  const state = initial(), ui = realBoot(state), before = ui.storage.get(normalKey), cardId = commands[0].cardId,
    entrance = M.openExits(state.world).find(exit => exit.edge === "N" && exit.node === E.hunter(state).position);
  assert(entrance); mapTarget(ui, "entrance", `${entrance.tileId}:${entrance.edge}`).click(); chooseCard(ui, cardId); unchanged(ui, before);
  assert.match(ui.el("mapContext").textContent, /카드\s*1장/);
  assert.match(ui.el("mapContext").textContent, /이동력\s*1/);
  const action = contextAction(ui, "explore"); assert(action, "one contextual exploration action is enabled"); action.click();
  const next = saved(ui), reference = E.dispatch(E.dispatch(state, { type: "MOVE", cardId }), { type: "EXPLORE", edge: entrance.edge });
  assert.equal(next.revision, state.revision + 2); assert.deepEqual(functional(next), functional(reference));
  assert.equal(next.phase, "tile_place"); assert(ui.el("chapterMap").innerHTML.includes(`data-tile="${next.world.pending.tileId}"`));
  for (const tileId of next.world.tileDeck) assert(!ui.el("chapterMap").innerHTML.includes(`data-tile="${tileId}"`));
});

test("selecting an enemy prepares an attack with its actual card and slot cost before the enemy action is drawn", () => {
  const state = checkpoint(9), command = commands[9], ui = realBoot(state), before = ui.storage.get(normalKey);
  assert.equal(command.type, "ATTACK"); assert.equal(state.phase, "hunter");
  mapTarget(ui, "enemy", command.enemyId).click(); chooseCard(ui, command.cardId); chooseSlot(ui, command.slot); unchanged(ui, before);
  assert.match(ui.el("mapContext").textContent, /카드\s*1장/); assert.match(ui.el("mapContext").textContent, /슬롯/);
  assert.equal(state.combat?.action, undefined, "the attack-selection state has no drawn enemy action");
  const action = commandAction(ui, "ATTACK"); assert(action, "the selected attack is enabled"); action.click();
  const next = saved(ui), reference = E.dispatch(state, command);
  assert.equal(next.revision, state.revision + 1); assert.deepEqual(functional(next), functional(reference));
  assert.equal(next.phase, "combat_react"); assert(next.combat.action);
  assert.match(ui.el("combatInfo").textContent, new RegExp(next.combat.action.name));
});

test("inspecting a distant enemy cannot make an ordinary melee attack legal", () => {
  let state, distant, card;
  for (let index = 0; index < commands.length; index++) {
    const candidate = checkpoint(index), h = E.hunter(candidate);
    if (candidate.phase !== "hunter" || h.inDream) continue;
    const enemy = candidate.enemies.find(value => value.node !== h.position);
    const selected = h.hand.find(value => !E.card(value).leap);
    if (enemy && selected) { state = candidate; distant = enemy; card = selected; break; }
  }
  assert(state && distant && card, "normal play reaches a distant enemy with an ordinary card");
  const ui = realBoot(state), before = ui.storage.get(normalKey);
  mapTarget(ui, "enemy", distant.id).click(); chooseCard(ui, card.id);
  const emptySlot = E.hunter(state).slots.findIndex(value => !value); assert(emptySlot >= 0); chooseSlot(ui, emptySlot); unchanged(ui, before);
  assert.equal(commandAction(ui, "ATTACK"), undefined, "map selection does not bypass colocation or leap rules");
});

test("mandatory reward and combat reactions remain blocking while map targets are inspected", () => {
  for (const state of [checkpoint(13), checkpoint(6)]) {
    const ui = realBoot(state), before = ui.storage.get(normalKey);
    for (const target of ui.el("chapterMap").querySelectorAll("[data-node]").filter(value => !value.hasAttribute("data-entrance")).slice(0, 2)) target.click();
    unchanged(ui, before); assert.equal(commandAction(ui, "MOVE"), undefined); assert.equal(contextAction(ui, "move"), undefined);
    if (state.rewardChoices.length) {
      const choice = state.rewardChoices[0]; assert(commandAction(ui, choice.firearmId ? "KEEP_FIREARM" : "KEEP_REWARD"));
    } else assert(commandAction(ui, "RESOLVE"), "the actual combat decision remains actionable");
  }
});

test("boss inspection hides all undrawn behavior cards and reveals only the action drawn in the current combat", () => {
  for (const count of [211, 218, 321, 350]) {
    const state = checkpoint(count), boss = state.enemies.find(enemy => enemy.componentId === "cleric-beast");
    assert(boss, "the test uses a boss spawned through ordinary campaign commands");
    const ui = realBoot(state), before = ui.storage.get(normalKey); mapTarget(ui, "enemy", boss.id).click(); unchanged(ui, before);
    const definition = E.enemyDef(state, boss), behaviorNames = Object.values(definition)
      .filter(value => value && typeof value === "object" && value.type && value.name).map(value => value.name),
      shown = state.combat?.enemyId === boss.id ? state.combat.action?.name : null,
      inspected = ui.el("componentCards").textContent + ui.el("mapContext").textContent;
    for (const name of behaviorNames) {
      if (name === shown) assert(inspected.includes(name), "the actually drawn action remains readable");
      else assert(!inspected.includes(name), `undrawn boss behavior remains hidden: ${name}`);
    }
    for (const entry of ui.el("storyList").querySelectorAll("[data-story-key]"))
      assert(E.missionView(state).revealed.includes(Number(entry.dataset.storyKey.split(":")[1])), "inspection lists only actually revealed missions");
    assert.doesNotMatch(inspected, /campaigns\/long-hunt\/images|components\/images|참고자료\/|bossDecks/);
  }
});
