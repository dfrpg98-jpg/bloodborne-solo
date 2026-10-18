"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Auto = require("../src/hunt-automatic-combat");
const Death = require("../src/hunt-death-feedback");
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
