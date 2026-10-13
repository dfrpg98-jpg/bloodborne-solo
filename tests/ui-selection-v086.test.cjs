"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), { boot } = require("./helpers/ui-harness.cjs");
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json"), key = "bloodborne-hunt-v07";
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: s => s,
  applyCombatReactionRuling: s => s };
const checkpoints = new Map();
let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
checkpoints.set(0, state);
for (let i = 0; i < 10; i++) { state = E.dispatch(state, commands[i]); checkpoints.set(i + 1, state); }
function launch(state) {
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine, realInventory: true, storage: { [key]: saved } });
  return { state, ui, saved };
}
const slots = f => f.ui.el("slots").querySelectorAll("[data-slot]");
const selected = f => slots(f).filter(slot => slot.getAttribute("aria-pressed") === "true").map(slot => +slot.dataset.slot);
function clickSlot(f, index) { const slot = slots(f).find(slot => +slot.dataset.slot === index); assert(slot); slot.click(); }
function clickCard(f, cardId) {
  const card = f.ui.el("hand").querySelectorAll("[data-card]").find(card => card.dataset.card === cardId);
  assert(card); card.click();
}
function enemyTarget(f, enemyId) {
  const target = f.ui.el("chapterMap").querySelectorAll("[data-enemy]").find(target => target.dataset.enemy === enemyId);
  assert(target); target.click();
}
function actions(f, type) {
  return ["decisions", "mapContext", "firearm"].flatMap(id => f.ui.el(id).querySelectorAll("[data-command]"))
    .filter(button => button.dataset.command === type);
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(key), f.saved, "presentation selections preserve exact existing save bytes");
  assert.equal(f.ui.el("error").textContent, "");
}
function execute(f, type, reference) {
  const button = actions(f, type).find(button => !button.disabled); assert(button, `${type} is explicitly enabled`); button.click();
  const actual = E.importSave(f.ui.storage.get(key)), expected = E.dispatch(f.state, reference);
  const behavior = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
  assert.deepEqual(behavior(actual), behavior(expected), "controller preserves exact original rule result and costs");
  for (const [key, value] of Object.entries(reference)) if (key !== "boost")
    assert.deepEqual(actual.commands.at(-1)[key], value, `the original command preserves ${key}`);
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual);
  assert.equal(f.ui.el("error").textContent, "");
  return actual;
}

test("a restored hunter turn starts without a selected weapon slot and uses the requested player labels", () => {
  const f = launch(checkpoints.get(0));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("phaseTitle").textContent, "플레이어의 차례");
  assert.match(f.ui.el("decisions").innerHTML, />플레이어의 차례 마치기<\/button>/);
  clickCard(f, E.hunter(f.state).hand[0].id);
  assert.deepEqual(selected(f), [], "selecting a card does not select the first empty slot");
  unchanged(f);
});

test("slot clicks select, cancel the same slot, and replace another selection without saving", () => {
  const f = launch(checkpoints.get(4));
  clickSlot(f, 0); assert.deepEqual(selected(f), [0]);
  clickSlot(f, 0); assert.deepEqual(selected(f), []);
  clickSlot(f, 0); clickSlot(f, 1); assert.deepEqual(selected(f), [1]);
  clickCard(f, E.hunter(f.state).hand[0].id); assert.deepEqual(selected(f), [1]);
  enemyTarget(f, f.state.enemies[0].id); assert.deepEqual(selected(f), [1]);
  clickSlot(f, 1); assert.deepEqual(selected(f), []);
  unchanged(f);
});

test("a card and target cannot activate an attack until a slot is explicitly selected, and deselection disables it again", () => {
  const f = launch(checkpoints.get(9)), command = commands[9];
  enemyTarget(f, command.enemyId); clickCard(f, command.cardId);
  assert(actions(f, "ATTACK").length); assert(actions(f, "ATTACK").every(button => button.disabled));
  assert.match(f.ui.el("mapContext").textContent, /빈 공격 슬롯을 선택/);
  for (const action of actions(f, "ATTACK")) action.click(); unchanged(f);
  clickSlot(f, command.slot); assert(actions(f, "ATTACK").some(button => !button.disabled));
  clickSlot(f, command.slot); assert(actions(f, "ATTACK").every(button => button.disabled)); unchanged(f);
  clickSlot(f, command.slot);
  const actual = execute(f, "ATTACK", command);
  assert(E.hunter(actual).slots[command.slot]);
  assert.deepEqual(selected(f), [], "using the selected slot does not select a different empty slot");
});

test("counterattacks require an explicit slot and preserve the exact selected command", () => {
  const f = launch(checkpoints.get(5)), command = commands[5];
  clickCard(f, command.cardId);
  assert(actions(f, "COUNTER").length); assert(actions(f, "COUNTER").every(button => button.disabled)); unchanged(f);
  clickSlot(f, command.slot);
  execute(f, "COUNTER", command);
  assert.deepEqual(selected(f), []);
});

test("loaded occupied slots do not cause another empty slot to be selected, and dodging still needs an explicit legal slot", () => {
  const f = launch(checkpoints.get(6)), h = E.hunter(f.state);
  assert(h.slots.some(Boolean)); assert.deepEqual(selected(f), []);
  const card = h.hand.find(card => E.card(card).dodge), index = E.slots(f.state).findIndex((_, index) => E.canDodge(f.state, card.id, index));
  assert(card); assert(index >= 0); clickCard(f, card.id);
  assert(actions(f, "DODGE")[0].disabled); unchanged(f);
  clickSlot(f, index); assert.equal(actions(f, "DODGE")[0].disabled, false);
  clickSlot(f, index); assert.equal(actions(f, "DODGE")[0].disabled, true); unchanged(f);
  clickSlot(f, index); const actual = execute(f, "DODGE", { type: "DODGE", cardId: card.id, slot: index });
  assert.deepEqual(selected(f), E.hunter(actual).slots[index] ? [] : [index], "only the explicit still-empty slot may remain selected");
});

test("a two-slot transformation clears a now-invalid selected slot without choosing slot zero", () => {
  const state = E.create(90, "kirkhammer", 0, null, "hunter-pistol", "center", { campaign: true }), f = launch(state);
  clickSlot(f, 2); clickCard(f, E.hunter(state).hand[0].id);
  const actual = execute(f, "TRANSFORM", { type: "TRANSFORM", cardId: E.hunter(state).hand[0].id });
  assert.equal(E.slots(actual).length, 2); assert.equal(slots(f).length, 2);
  assert.deepEqual(selected(f), []);
});

test("resuming the stored hunt and starting a new hunt both clear a previous explicit slot selection", () => {
  const f = launch(checkpoints.get(4));
  clickSlot(f, 0); f.ui.el("new").click(); f.ui.el("resumeNormalSetup").click();
  assert.deepEqual(selected(f), []); unchanged(f);
  clickSlot(f, 1); f.ui.el("new").click();
  f.ui.el("seed").value = "123";
  f.ui.el("weapon").value = "beast-claw"; f.ui.el("weapon").fire("change");
  f.ui.el("face").value = "0"; f.ui.el("face").fire("change");
  f.ui.el("start").value = "center"; f.ui.el("start").fire("change");
  assert.equal(f.ui.el("confirmSetup").disabled, false); f.ui.el("confirmSetup").click();
  const actual = E.importSave(f.ui.storage.get(key));
  assert.deepEqual(actual, E.create(123, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true }));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("phaseTitle").textContent, "플레이어의 차례");
  assert.equal(f.ui.el("setupError").textContent, "");
});

test("importing a different actual replay clears an existing slot selection and preserves the imported save exactly", async () => {
  const f = launch(checkpoints.get(4)), imported = E.exportSave(checkpoints.get(0));
  clickSlot(f, 1); clickCard(f, E.hunter(f.state).hand[0].id); unchanged(f);
  const file = f.ui.el("file"); file.files = [{ text: async () => imported }];
  await file.onchange({ target: file });
  assert.equal(f.ui.storage.get(key), imported);
  assert.deepEqual(E.importSave(f.ui.storage.get(key)), checkpoints.get(0));
  assert.deepEqual(selected(f), []);
  assert.equal(f.ui.el("error").textContent, "");
});

test("the Reiterpallasch weapon choice preserves null and requires its exact explicitly selected aiming slot", () => {
  const fixture = require("./fixtures/weapon-campaign-completion/manifest.json").cases.find(item => item.weaponId === "reiterpallasch");
  const trace = require("./fixtures/weapon-campaign-completion/" + fixture.commandsFile);
  let state = E.create(fixture.seed, fixture.weaponId, fixture.startFace, fixture.startingConsumable,
    fixture.initialFirearmId, fixture.startSpace, { campaign: true, rulesVersion: fixture.rulesVersion });
  for (const command of trace.slice(0, 136)) state = E.dispatch(state, command);
  const reference = { type: "WEAPON_SHOT", cardId: trace[136].cardId, slot: 1, enemyId: trace[136].enemyId }, f = launch(state);
  assert.equal(E.hunter(state).face, 1); enemyTarget(f, reference.enemyId); clickCard(f, reference.cardId);
  assert(actions(f, "WEAPON_SHOT").length); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled)); unchanged(f);
  clickSlot(f, 0); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled));
  clickSlot(f, 1); assert(actions(f, "WEAPON_SHOT").some(button => !button.disabled));
  clickSlot(f, 1); assert(actions(f, "WEAPON_SHOT").every(button => button.disabled)); unchanged(f);
  clickSlot(f, 1); const actual = execute(f, "WEAPON_SHOT", reference);
  assert.equal(E.hunter(actual).slots[1].faceDown, true);
  assert.deepEqual(selected(f), []);
});

function firearmState(id, spent) {
  let s = E.create(90, "beast-claw", 0, null, id, "center", { campaign: true, firearmOverride: true });
  if (!spent) return s;
  for (const command of commands.slice(0, 4)) s = E.dispatch(s, command);
  if (id === "flamesprayer") {
    s = E.dispatch(s, { type: "FIREARM", enemyId: s.enemies[0].id }); s = E.dispatch(s, { type: "RESOLVE" });
  } else {
    for (const type of ["END_TURN", "NO_ATTACK", "FIREARM", "RESOLVE"]) s = E.dispatch(s, { type });
    if (s.phase === "refill") s = E.dispatch(s, { type: "REFILL", discardIds: [] });
  }
  assert.equal(s.phase, "hunter"); assert.equal(E.hunter(s).firearmReady, false);
  assert.deepEqual(E.importSave(E.exportSave(s)), s); return s;
}
for (const [id, cost] of [["hunter-pistol", 1], ["flamesprayer", 2]]) {
  test(`${id} hides preparation guidance while ready and preserves its printed effect`, () => {
    const f = launch(firearmState(id, false));
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0);
    assert.match(f.ui.el("firearm").textContent, /준비됨/);
    assert(f.ui.el("firearm").textContent.includes(E.firearm(f.state).name));
    assert.match(f.ui.el("firearm").innerHTML, /firearm-rules/);
    assert.match(f.ui.el("firearm").textContent, id === "hunter-pistol" ? /기본 공격.*방해/ : /속도 2.*피해 2.*방해/);
    assert.doesNotMatch(f.ui.el("firearm").textContent, /차례.{0,30}(?:버리|버려).*준비/, "a printed preparation rule cannot leak into the ready-only effect paragraph");
    assert.deepEqual(selected(f), []); unchanged(f);
  });
  test(`${id} shows the exact ${cost}-card player-turn preparation cost only while spent and prepares through the original command`, () => {
    const f = launch(firearmState(id, true)), cards = E.hunter(f.state).hand.slice(0, cost).map(card => card.id);
    assert.equal(cards.length, cost);
    const guidance = f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]");
    assert.equal(guidance.length, 1);
    assert.match(f.ui.el("firearm").innerHTML, new RegExp(`플레이어의 차례에 손패 ${cost}장을 버려 준비`));
    assert.match(f.ui.el("firearm").textContent, /소진됨/);
    clickCard(f, cards[0]);
    if (cost === 2) {
      assert(actions(f, "RELOAD").filter(button => !button.disabled).length === 0);
      const second = f.ui.el("reloadSecondCard"); second.value = cards[1]; second.fire("change");
    }
    assert.deepEqual(selected(f), [], "preparing a firearm never needs or chooses a weapon slot"); unchanged(f);
    const actual = execute(f, "RELOAD", { type: "RELOAD", ...(id === "hunter-pistol" ? { cardId: cards[0] } : { cardIds: cards }) });
    assert.equal(E.hunter(actual).firearmReady, true);
    assert.equal(E.hunter(actual).hand.length, E.hunter(f.state).hand.length - cost);
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0);
    assert.deepEqual(selected(f), []);
  });
}

test("every provided ready firearm retains its exact public effect rules while withholding preparation instructions", () => {
  for (const id of Object.keys(E.data.firearms)) {
    const f = launch(firearmState(id, false)), gun = E.firearm(f.state), text = f.ui.el("firearm").textContent;
    assert.equal(f.ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0, `${id}: no preparation paragraph`);
    assert.doesNotMatch(text, /차례.{0,30}(?:버리|버려).*준비/, `${id}: no preparation instruction in effect paragraph`);
    const preparations = new Set([gun.prepareText, gun.readyRule]);
    for (const rule of (gun.rules || []).filter(rule => !preparations.has(rule)))
      assert(text.includes(f.ui.window.BBHuntPublicText.clean(rule)), `${id}: its original public effect rule remains visible`);
    unchanged(f);
  }
});
