"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Auto = require("../src/hunt-automatic-combat");
const Death = require("../src/hunt-death-feedback");
const Rewards = require("../src/rewards-engine"), { hand } = require("./actual-combat-helper.cjs");
const { boot } = require("./helpers/ui-harness.cjs");
const go = (state, type, args = {}) => E.dispatch(state, { type, ...args });

function patient(options = {}) {
  for (let seed = 1; seed <= 200; seed++) {
    let state = E.create(seed, "burial", 0, null, "hunter-pistol", "center", {
      campaign: false, rulesVersion: options.rulesVersion || 14,
      practiceTarget: "male-beast-patient", practiceSide: "b",
      ...(options.rewards ? { practiceRewards: options.rewards } : {}),
    });
    const card = E.hunter(state).hand.find(card => card.kind === "strength");
    if (state.enemyDeck[0] !== "special" || !card) continue;
    state = go(state, "ATTACK", { enemyId: state.enemies[0].id, cardId: card.id, slot: 1 });
    return go(state, "RESOLVE");
  }
  throw new Error("No natural public practice seed for patient death echo");
}

test("the mandatory death echo requests its canonical command without mutating a replayable practice save", () => {
  const state = patient(), before = E.exportSave(state);
  assert.equal(state.phase, "boss_react"); assert.equal(state.enemies.length, 0);
  assert.equal(state.setup.qa, undefined);
  assert.deepEqual(Auto.nextCommand(state, E), { type: "RESOLVE" });
  assert.equal(E.exportSave(state), before);
  const loaded = E.importSave(before);
  assert.deepEqual(Auto.nextCommand(loaded, E), { type: "RESOLVE" });
  const after = E.dispatch(loaded, Auto.nextCommand(loaded, E));
  assert.deepEqual(after, go(state, "RESOLVE"));
  assert.equal(after.commands.length, state.commands.length + 1);
  assert.deepEqual(after.commands.at(-1), { type: "RESOLVE" });
  assert.equal(E.hunter(after).hp, 2); assert.equal(E.hunter(after).status.poison, true);
  assert.equal(Auto.nextCommand(after, E), null);
  assert.deepEqual(E.importSave(E.exportSave(after)), after);
});

test("automatic death echo keeps reducer damage mitigation, immunity and lethal death feedback", () => {
  const original = patient();
  // Component boundaries use a real reached reaction, then vary only the
  // already-public defense/immunity/HP to exercise the unchanged resolver.
  const defended = structuredClone(original); defended.combat.defense = 1;
  const protectedResult = E.dispatch(defended, Auto.nextCommand(defended, E));
  assert.equal(E.hunter(protectedResult).hp, 3); assert.equal(E.hunter(protectedResult).status.poison, true);
  const immune = structuredClone(original); immune.combat.immune.push("poison");
  assert.equal(E.hunter(E.dispatch(immune, Auto.nextCommand(immune, E))).status.poison, false);
  const lethal = structuredClone(original); E.hunter(lethal).hp = 1;
  const death = E.dispatch(lethal, Auto.nextCommand(lethal, E));
  assert.equal(E.hunter(death).inDream, true);
  assert.equal(death.events.filter(event => event.text.includes("처치당했습니다.")).length, 1);
  const notice = Death.describe(lethal, death);
  assert(notice); assert.match(notice.summary, /죽음의 메아리/);
  assert.equal(Auto.nextCommand(death, E), null);
  const corruption = patient({ rewards: ["rune-corruption"] });
  E.hunter(corruption).hp = 1;
  E.hunter(corruption).rewards[0].triggerArmed = true;
  const prevented = E.dispatch(corruption, Auto.nextCommand(corruption, E));
  assert.equal(E.hunter(prevented).inDream, false); assert.equal(E.hunter(prevented).hp, 6);
  assert.equal(E.hunter(prevented).status.poison, true);
  assert.equal(E.hunter(prevented).rewards[0].ready, false);
  assert.equal(Death.describe(corruption, prevented), null);
});

test("automatic posthumous handling never removes real kill-reward choices", () => {
  const current = patient({ rewards: ["rune-rapture"] });
  assert.equal(current.phase, "kill_react"); assert.equal(Auto.nextCommand(current, E), null);
  const passed = go(current, "PASS_KILL_REACTION");
  assert.equal(passed.phase, "boss_react"); assert.deepEqual(Auto.nextCommand(passed, E), { type: "RESOLVE" });
  const legacy = patient({ rulesVersion: 13, rewards: ["rune-rapture"] });
  assert.equal(legacy.phase, "boss_react");
  assert(E.rewardsView(legacy).rewards.some(reward => reward.kind === "rune-rapture" && reward.usable));
  assert.equal(Auto.nextCommand(legacy, E), null);
  const used = go(legacy, "USE_REWARD", { rewardId: E.hunter(legacy).rewards[0].id });
  assert.deepEqual(Auto.nextCommand(used, E), { type: "RESOLVE" });
  const pending = patient(), rewardState = { ...E, rewardsView: () => ({ choices: [{ rewardId: "pending" }], rewards: [] }) };
  assert.equal(Auto.nextCommand(pending, rewardState), null);
});

test("ready automatic-dodge equipment remains unspent when the death echo cannot be dodged", () => {
  const state = patient({ rewards: ["old-hunter-bone"] });
  const reward = E.rewardsView(state).rewards[0];
  assert.equal(reward.ready, true); assert.equal(reward.usable, false);
  const after = E.dispatch(state, Auto.nextCommand(state, E));
  assert.equal(E.hunter(after).rewards[0].ready, true);
  assert.equal(E.hunter(after).hp, 2); assert.equal(E.hunter(after).status.poison, true);
});

test("dodgeable posthumous barrage, last-attack choices and unrelated unavoidable effects remain manual", () => {
  let barrage;
  for (let seed = 1; seed <= 200; seed++) {
    let state = E.create(seed, "kirkhammer", 1, null, "hunter-pistol", "center", {
      campaign: false, rulesVersion: 14, practiceTarget: "church-servant", practiceSide: "b",
    });
    const card = E.hunter(state).hand.find(card => card.kind === "strength");
    if (state.enemyDeck[0] !== "ability" || !card || !E.hunter(state).hand.some(card => card.kind === "endurance")) continue;
    barrage = go(state, "ATTACK", { enemyId: state.enemies[0].id, cardId: card.id, slot: 0 }); break;
  }
  assert(barrage); assert.equal(barrage.enemies.length, 0); assert.equal(barrage.phase, "boss_react");
  assert.equal(barrage.combat.immediate.dodgeBlockPerSpeed, 2);
  assert.equal(Auto.nextCommand(barrage, E), null);
  const echo = patient();
  for (const mutate of [
    state => { state.phase = "mission_death"; },
    state => { state.combat.action.code = "cainhurst-knight-parry"; },
    state => { state.combat.immediate.unavoidable = false; },
    state => { state.combat.immediate.dodgeSpeed = 1; },
    state => { delete state.combat.extendedDeathEchoQueued; },
    state => { state.enemies.push({ id: state.combat.enemyId }); },
  ]) {
    const variant = structuredClone(echo); mutate(variant);
    assert.equal(Auto.nextCommand(variant, E), null);
  }
  assert.equal(Auto.nextCommand(null, E), null);
  assert.equal(Auto.nextCommand(echo, {}), null);
});

function controller(state) {
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { "bloodborne-hunt-v07": E.exportSave(state) },
    engine: { ...E, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
    window: { BBHuntAutomaticCombat: Auto },
  });
}
const controllerState = ui => E.importSave(ui.storage.get("bloodborne-hunt-v07"));

test("the actual controller records and completes mandatory posthumous damage in the original resolve click", () => {
  const echo = patient(), setup = echo.setup;
  let declared = E.create(echo.initialSeed, setup.weaponId, setup.face, setup.startingConsumable,
    setup.firearmId, setup.startSpace, { campaign: false, rulesVersion: setup.rulesVersion,
      practiceTarget: setup.practiceTarget, practiceSide: setup.practiceSide });
  declared = E.dispatch(declared, echo.commands[0]);
  assert.equal(declared.phase, "combat_react");
  const ui = controller(declared), resolve = ui.el("decisionActions").querySelectorAll("[data-command]")
    .find(button => button.dataset.command === "RESOLVE" && !button.disabled);
  assert(resolve); resolve.click(); assert.equal(ui.el("error").textContent, "");
  const result = controllerState(ui), expected = go(echo, "RESOLVE");
  assert.deepEqual(result, expected); assert.equal(result.phase, "hunter");
  assert.equal(E.hunter(result).hp, 2); assert.equal(E.hunter(result).status.poison, true);
  assert.deepEqual(result.commands.slice(-2), [{ type: "RESOLVE" }, { type: "RESOLVE" }]);
  assert.doesNotMatch(ui.el("decisions").textContent, /효과를 받고 계속|회피하지 않고 효과 처리/);
});

test("official file import and browser-save resume each finish a pending mandatory echo exactly once", async () => {
  const echo = patient(), original = E.exportSave(echo), expected = go(echo, "RESOLVE");
  const resumed = controller(echo);
  assert.deepEqual(controllerState(resumed), expected); assert.equal(resumed.el("error").textContent, "");
  const again = controller(controllerState(resumed));
  assert.equal(again.storage.get("bloodborne-hunt-v07"), E.exportSave(expected), "reload cannot apply damage again");
  const initial = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }), loaded = controller(initial);
  const input = { files: [{ text: async () => original }], value: "practice-death-echo.json" };
  await loaded.el("file").onchange({ target: input });
  assert.equal(input.value, ""); assert.equal(loaded.el("error").textContent, "");
  assert.deepEqual(controllerState(loaded), expected);
  assert.equal(E.exportSave(echo), original, "the source file and checkpoint remain unchanged");
});

function doubleSlash({ hp = 3, dodge = false, rewards = [] } = {}) {
  // Supply-valid component boundary: disclose the exact same-speed attacks and
  // HP, then use the real reducer. This is not a canonical campaign checkpoint.
  let state = E.create(123, "burial", 1, null, "hunter-pistol", "center", {
    campaign: false, rulesVersion: 14, practiceRewards: rewards,
  });
  state.world.assignments.find(assignment => assignment.enemyId === "scourge-beast").sideId = "b";
  state.enemies = [{ id: "scourge-beast-1", kind: "scourge-beast", figure: 1,
    node: E.hunter(state).position, hp: 1 }];
  state.loot = []; E.hunter(state).hp = hp;
  hand(state, ["strength", dodge ? "tactical" : "skill", "vitality"]);
  if (dodge) {
    const hunter = E.hunter(state), occupied = hunter.hand.findIndex(card => card.kind === "vitality");
    hunter.slots[1] = hunter.hand.splice(occupied, 1)[0];
  }
  state.enemyDeck = ["special", "basic", "basic", "basic", "special", "ability"]; state.enemyDiscard = [];
  E.assertState(state);
  state = go(state, "ATTACK", { enemyId: state.enemies[0].id,
    cardId: E.hunter(state).hand.find(card => card.kind === "strength").id, slot: 0 });
  assert.equal(state.combat.attack.speed, 2); assert.equal(state.combat.attack.damage, 3);
  assert.equal(state.combat.action.speed, 2); assert.equal(state.combat.action.followup, true);
  return { declared: state, afterFirst: go(state, "RESOLVE") };
}
function componentController(state) {
  // Plain JSON import/export deliberately isolates constructed component
  // fixtures from the production replay validator and real browser storage.
  return boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { "bloodborne-hunt-v07": JSON.stringify(state) },
    engine: { ...E, importSave: JSON.parse, exportSave: JSON.stringify,
      applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value,
      applyChapelRuling: value => value, applyCombatReactionRuling: value => value },
    window: { BBHuntAutomaticCombat: Auto, BBHuntDeathFeedback: Death },
  });
}
const componentState = ui => { const state = JSON.parse(ui.storage.get("bloodborne-hunt-v07")); E.assertState(state); return state; };

test("a dead beast's forced followup auto-takes the real remaining damage and preserves HP3 to HP1 to death", () => {
  const { declared, afterFirst } = doubleSlash(), before = JSON.stringify(afterFirst);
  assert.equal(afterFirst.phase, "combat_extra"); assert.equal(E.hunter(afterFirst).hp, 1);
  assert.equal(afterFirst.enemies.length, 0);
  assert.deepEqual(Auto.nextCommand(afterFirst, E), { type: "EXTRA_TAKE" });
  assert.equal(JSON.stringify(afterFirst), before, "finding an automatic continuation never changes HP or costs");
  const expected = go(afterFirst, "EXTRA_TAKE");
  assert.equal(E.hunter(expected).inDream, true); assert.equal(expected.combat, null);
  assert.equal(expected.commands.at(-1).type, "EXTRA_TAKE");
  assert.equal(Death.describe(declared, expected).damageTotal, 4, "both same-click hits still total four actual damage");
  assert.equal(Auto.nextCommand(expected, E), null);
  const ui = componentController(declared), resolve = ui.el("decisionActions").querySelectorAll("[data-command]")
    .find(button => button.dataset.command === "RESOLVE" && !button.disabled);
  assert(resolve); resolve.click();
  assert.equal(ui.el("error").textContent, ""); assert.deepEqual(componentState(ui), expected);
  assert.equal(ui.el("deathDialog").open, true);
  const details = ui.el("deathDetails").textContent;
  assert.match(details, /사망 원인다단 가르기 추가 피해 · 피해 2/, "the final extra hit remains the direct lethal cause");
  assert.match(details, /다단 가르기받은 피해 2/, "the same click also lists its first hit");
  assert.match(details, /이번 처리에서 받은 피해 4/, "the batch total includes first-hit two plus additional-hit two");
  assert.deepEqual(componentState(ui).commands.slice(-2), [{ type: "RESOLVE" }, { type: "EXTRA_TAKE" }]);
});

test("posthumous followup keeps any legal empty-slot dodge and usable automatic-dodge reward", () => {
  const dodgable = doubleSlash({ dodge: true }).afterFirst,
    card = E.hunter(dodgable).hand.find(card => E.card(card).dodge);
  assert.equal(E.canDodge(dodgable, card.id, 1, true), false);
  assert.equal(E.canDodge(dodgable, card.id, 2, true), true, "a later empty slot is still a valid response");
  assert.equal(Auto.nextCommand(dodgable, E), null);
  const avoided = go(dodgable, "EXTRA_DODGE", { cardId: card.id, slot: 2 });
  assert.equal(E.hunter(avoided).hp, 1); assert.equal(E.hunter(avoided).inDream, false);
  const withBone = doubleSlash({ rewards: ["old-hunter-bone"] }).afterFirst,
    bone = E.rewardsView(withBone).rewards.find(reward => reward.kind === "old-hunter-bone");
  assert(bone.usable); assert.equal(Auto.nextCommand(withBone, E), null);
  const boneDodge = go(withBone, "USE_REWARD", { rewardId: bone.id });
  assert.equal(E.hunter(boneDodge).hp, 1); assert.equal(E.hunter(boneDodge).inDream, false);
  assert.equal(E.hunter(boneDodge).rewards.find(reward => reward.id === bone.id).ready, false);
});

test("mandatory reward equipment and optional kill reactions remain ahead of a forced posthumous continuation", () => {
  const pending = doubleSlash().afterFirst, rewardId = Rewards.grant(pending, "bloodstone-shard");
  E.assertState(pending); assert.equal(Auto.nextCommand(pending, E), null);
  const ui = componentController(pending), unchanged = ui.storage.get("bloodborne-hunt-v07");
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), unchanged);
  assert.equal(componentState(ui).phase, "combat_extra"); assert.equal(E.hunter(componentState(ui)).hp, 1);
  const choice = ui.el("decisions").querySelectorAll("[data-command]").find(button => button.dataset.command === "EQUIP_REWARD" &&
    JSON.parse(button.dataset.args).rewardId === rewardId && JSON.parse(button.dataset.args).slot === 1);
  assert(choice && !choice.disabled); choice.click();
  const equipped = go(pending, "EQUIP_REWARD", { rewardId, slot: 1 });
  assert.deepEqual(Auto.nextCommand(equipped, E), { type: "EXTRA_TAKE" });
  assert.deepEqual(componentState(ui), go(equipped, "EXTRA_TAKE"));
  assert.equal(componentState(ui).rewardChoices.length, 0);
  const reaction = doubleSlash({ rewards: ["rune-rapture"] }).afterFirst;
  assert.equal(reaction.phase, "kill_react"); assert.equal(Auto.nextCommand(reaction, E), null);
  assert(E.killReactionActions(reaction).some(action => action.command.type === "USE_REWARD"));
  const passed = go(reaction, "PASS_KILL_REACTION");
  assert.equal(passed.phase, "combat_extra"); assert.deepEqual(Auto.nextCommand(passed, E), { type: "EXTRA_TAKE" });
});

test("simultaneous HP1 death clears every followup and neither loading nor repeated inspection can apply it again", () => {
  const { afterFirst } = doubleSlash({ hp: 1 });
  assert.equal(afterFirst.enemies.length, 0); assert.equal(E.hunter(afterFirst).inDream, true);
  assert.equal(afterFirst.combat, null); assert.equal(Auto.nextCommand(afterFirst, E), null);
  assert.equal(afterFirst.commands.filter(command => command.type === "EXTRA_TAKE").length, 0);
  const ui = componentController(afterFirst), before = ui.storage.get("bloodborne-hunt-v07");
  assert.deepEqual(componentState(ui), afterFirst);
  assert.equal(Auto.nextCommand(componentState(ui), E), null);
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), before);
  assert.equal(afterFirst.events.filter(event => /다단 가르기 추가 피해/.test(event.text)).length, 0);
  assert.equal(afterFirst.events.filter(event => event.text.includes("처치당했습니다.")).length, 1);
});

test("living-source extras, unknown dodge capability and pending reward choices fail closed", () => {
  const state = doubleSlash().afterFirst;
  assert.equal(Auto.nextCommand(state, { ...E, canDodge: undefined }), null);
  const living = structuredClone(state); living.enemies.push({ id: living.combat.enemyId });
  assert.equal(Auto.nextCommand(living, E), null);
  const absent = structuredClone(state); absent.combat.extra = null;
  assert.equal(Auto.nextCommand(absent, E), null);
  const blocked = structuredClone(state); blocked.rewardChoices = [{ firearmId: "ludwig-rifle" }];
  assert.equal(Auto.nextCommand(blocked, { ...E, rewardsView: () => ({ rewards: [], choices: [] }) }), null);
});
