"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), Availability = require("../hunt-action-availability");
const { boot } = require("./helpers/ui-harness.cjs");
const source = require("./fixtures/v074-patient-natural-commands.json"),
  followup = require("./fixtures/v0813-dev14-followup-regain-legal-commands.json");
function firstBasic(gun = "hunter-pistol", rulesVersion = 14, startRewards = []) {
  let state = E.create(90, "burial", 1, null, gun, "center", { campaign: true, rulesVersion,
    ...(rulesVersion >= 10 && gun !== "hunter-pistol" ? { firearmOverride: true } : {}),
    ...(rulesVersion >= 14 ? { qa: { preset: "custom", startRewards, startConsumables: [] } } : {}) });
  for (const command of source.slice(0, 5)) state = E.dispatch(state, command);
  assert.equal(state.phase, "combat_react"); assert.equal(state.combat.action.kind, "basic");
  return state;
}
const dodge = state => E.dispatch(state, { type: "DODGE", cardId: "card-1", slot: 0 });

for (const gun of ["hunter-pistol", "repeating-pistol", "evelyn"]) {
  test(`${gun}: an accepted dodge prevents only a new redundant basic-interrupt choice and preserves exact save bytes`, () => {
    const state = firstBasic(gun);
    assert.equal(Availability.blockedReason(state, E, { type: "FIREARM" }), null);
    const dodged = dodge(state), saved = E.exportSave(dodged);
    assert.equal(dodged.combat.dodged, true); assert.equal(E.hunter(dodged).firearmReady, true);
    assert.match(Availability.blockedReason(dodged, E, { type: "FIREARM" }), /이미 회피한 기본 공격.*화기를 소진하지 않고/);
    assert.equal(E.exportSave(dodged), saved);
    assert.deepEqual(E.importSave(saved), dodged);
    assert.equal(Availability.blockedReason(dodged, E, { type: "RESOLVE" }), null);
    assert.equal(Availability.blockedReason(dodged, E, { type: "FIREARM_ENTRY", accept: true }), null);
    assert.equal(Availability.blockedReason(dodged, E, { type: "BOSS_INSIGHT" }), null);
    assert.equal(Availability.blockedReason(dodged, E, { type: "USE_REWARD", rewardId: "unrelated" }), null);
    const finished = E.dispatch(dodged, { type: "RESOLVE" });
    assert.equal(E.hunter(finished).firearmReady, true, "normal combat processing does not spend the prepared gun");
    // A presentation fix must not make an already recorded historical command
    // invalid. The unchanged reducer still imports the original wasted shot.
    const historical = E.dispatch(dodged, { type: "FIREARM" });
    assert.equal(E.hunter(historical).firearmReady, false);
    assert.equal(E.exportSave(E.importSave(E.exportSave(historical))), E.exportSave(historical));
  });
}

test("the original firearm path is protected according to its actual legacy behavior rather than its newer equipment trigger", () => {
  for (const gun of ["hunter-pistol", "repeating-pistol", "flamesprayer", "ludwig-rifle"]) {
    const state = firstBasic(gun, 8), dodged = dodge(state), saved = E.exportSave(dodged);
    assert.equal(E.canFirearm(dodged), true, "legacy guns use the original basic-interrupt command");
    assert.match(Availability.blockedReason(dodged, E, { type: "FIREARM" }), /이미 회피/);
    const historical = E.dispatch(dodged, { type: "FIREARM" });
    assert.equal(E.hunter(historical).firearmReady, false); assert.equal(E.exportSave(dodged), saved);
    assert.equal(E.exportSave(E.importSave(E.exportSave(historical))), E.exportSave(historical));
  }
});

test("effect-removing Rosmarinus remains usable after a dodge because it removes the independently pending followup", () => {
  const cfg = followup.setup;
  let state = E.create(cfg.seed, cfg.weaponId, cfg.face, null, "rosmarinus", cfg.startSpace,
    { ...cfg.options, firearmOverride: true });
  for (const command of followup.commands.slice(0, 22)) state = E.dispatch(state, command);
  assert.equal(state.combat.action.followup, true);
  state = dodge(state); assert.equal(state.combat.dodged, true); assert.equal(E.canFirearm(state), true);
  assert.equal(Availability.blockedReason(state, E, { type: "FIREARM" }), null);
  const fired = E.dispatch(state, { type: "FIREARM" });
  assert.equal(fired.combat.action.followup, undefined); assert.equal(fired.combat.removeEnemyAttackEffects, true);
  const resolved = E.dispatch(fired, { type: "RESOLVE" });
  assert.equal(resolved.phase, "hunter"); assert.equal(E.hunter(resolved).hp, 5);
  assert.equal(E.hunter(resolved).firearmReady, false);
  assert.equal(E.exportSave(E.importSave(E.exportSave(resolved))), E.exportSave(resolved));
});

test("the ordinary dodge guard already prevents spending a second card or auto-dodge reward for the same hit", () => {
  const dodged = dodge(firstBasic("hunter-pistol", 14, ["old-hunter-bone"])), saved = E.exportSave(dodged);
  for (const card of E.hunter(dodged).hand) for (let slot = 0; slot < E.slots(dodged).length; slot++)
    assert.equal(E.canDodge(dodged, card.id, slot), false);
  assert.throws(() => E.dispatch(dodged, { type: "DODGE", cardId: E.hunter(dodged).hand[0].id, slot: 0 }));
  const bone = E.rewardsView(dodged).rewards.find(reward => reward.kind === "old-hunter-bone");
  assert(bone && bone.ready); assert.equal(bone.usable, false);
  assert.throws(() => E.dispatch(dodged, { type: "USE_REWARD", rewardId: bone.id }));
  assert.equal(E.exportSave(dodged), saved);
});

test("pending followup, attack declaration, entry firearm and other commands receive no blanket combat prohibition", () => {
  const cfg = followup.setup;
  let state = E.create(cfg.seed, cfg.weaponId, cfg.face, null, cfg.firearmId, cfg.startSpace, cfg.options);
  for (const command of followup.commands.slice(0, 23)) state = E.dispatch(state, command);
  assert.equal(state.phase, "combat_extra");
  for (const command of [{ type: "EXTRA_DODGE" }, { type: "EXTRA_TAKE" }, { type: "FIREARM" }, { type: "USE_REWARD" }])
    assert.equal(Availability.blockedReason(state, E, command), null);
  assert.equal(Availability.blockedReason(null, E, { type: "FIREARM" }), null);
  assert.equal(Availability.blockedReason({}, E, { type: "FIREARM" }), null);
  assert.equal(Availability.blockedReason(dodge(firstBasic()), {}, { type: "FIREARM" }), null);
});

function launch(state) {
  const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1",
    normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true })), calls = [],
    ui = boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
      storage: { [normalKey]: normalSave, [qaKey]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
      engine: { ...E, applyTileSpeedRuling: s => s, applyChapelRuling: s => s, applyCombatReactionRuling: s => s,
        dispatch(s, command) { calls.push(command); return E.dispatch(s, command); } } });
  assert.equal(ui.el("error").textContent, ""); return { ui, calls, normalSave, normalKey, qaKey };
}
function chooseDodge(ui) {
  ui.el("combatSelectCard").value = "card-1"; ui.el("combatSelectCard").fire("change");
  ui.el("combatSelectSlot").value = "0"; ui.el("combatSelectSlot").fire("change");
  const button = ui.buttons("decisionActions").find(button => button.dataset.command === "DODGE");
  assert(button && !button.disabled); button.click(); assert.equal(ui.el("error").textContent, "");
}

for (const gun of ["hunter-pistol", "repeating-pistol", "evelyn"]) {
  test(`${gun}: actual fixed dodge controls disable both redundant firearm buttons, reject a stale click and retain both saves`, () => {
    const state = firstBasic(gun), { ui, calls, normalSave, normalKey, qaKey } = launch(state),
      oldButtons = ["firearm", "decisions"].map(area => ui.buttons(area).find(button => button.dataset.command === "FIREARM"));
    assert(oldButtons.every(button => button && !button.disabled));
    chooseDodge(ui);
    const dodgedSave = ui.storage.get(qaKey), actual = E.importSave(dodgedSave);
    assert.deepEqual(actual, dodge(state)); assert.equal(E.hunter(actual).firearmReady, true);
    const disabled = ["firearm", "decisions"].map(area => ui.buttons(area).find(button => button.dataset.command === "FIREARM"));
    assert.equal(disabled.length, 2);
    for (const button of disabled) assert(button && button.disabled);
    for (const area of ["firearm", "decisions"]) assert.match(ui.el(area).innerHTML, /회피 완료 · 화기 소모 불필요/);
    oldButtons[0].click();
    assert.match(ui.el("error").textContent, /이미 회피한 기본 공격/);
    // Departure planning may validate a disposable clone, but the UI policy
    // rejects the real commit: neither a resource nor a save command changes.
    assert.equal(ui.storage.get(qaKey), dodgedSave); assert.equal(ui.storage.get(normalKey), normalSave);
    const resolve = ui.buttons("decisionActions").find(button => button.dataset.command === "RESOLVE"); assert(resolve && !resolve.disabled);
    resolve.click(); assert.equal(ui.el("error").textContent, "");
    const continued = E.importSave(ui.storage.get(qaKey)); assert.deepEqual(continued, E.dispatch(actual, { type: "RESOLVE" }));
    assert.equal(E.hunter(continued).firearmReady, true); assert.equal(ui.storage.get(normalKey), normalSave);
  });
}

test("the real UI retains useful Rosmarinus effect removal after the first dodge and prevents its independent followup", () => {
  const cfg = followup.setup;
  let state = E.create(cfg.seed, cfg.weaponId, cfg.face, null, "rosmarinus", cfg.startSpace, { ...cfg.options, firearmOverride: true });
  for (const command of followup.commands.slice(0, 22)) state = E.dispatch(state, command);
  const { ui, normalSave, normalKey, qaKey } = launch(state);
  chooseDodge(ui);
  for (const area of ["firearm", "decisions"]) {
    const button = ui.buttons(area).find(button => button.dataset.command === "FIREARM");
    assert(button && !button.disabled); assert.doesNotMatch(button.textContent || button.innerHTML, /화기 소모 불필요/);
  }
  const firearm = ui.buttons("firearm").find(button => button.dataset.command === "FIREARM"); firearm.click();
  assert.equal(ui.el("error").textContent, "");
  const fired = E.importSave(ui.storage.get(qaKey));
  assert.equal(fired.combat.removeEnemyAttackEffects, true); assert.equal(fired.combat.action.followup, undefined);
  const resolve = ui.buttons("decisionActions").find(button => button.dataset.command === "RESOLVE"); assert(resolve && !resolve.disabled); resolve.click();
  const final = E.importSave(ui.storage.get(qaKey)); assert.equal(final.phase, "hunter"); assert.equal(E.hunter(final).hp, 5);
  assert.equal(E.hunter(final).firearmReady, false); assert.equal(ui.storage.get(normalKey), normalSave);
});
