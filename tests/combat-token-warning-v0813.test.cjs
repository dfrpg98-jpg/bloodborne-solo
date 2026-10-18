"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Feedback = require("../src/hunt-combat-feedback");
const Controls = require("../src/hunt-map-controls"), { boot } = require("./helpers/ui-harness.cjs");
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07";
function launch(state) {
  const normalSave = E.exportSave(E.create(91, "burial", 0, null, "hunter-pistol", "center", { campaign: true }));
  return { normalSave, ui: boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [qaKey]: E.exportSave(state), [normalKey]: normalSave, "bloodborne-hunt-active-mode": "qa" },
    window: { BBHuntMapControls: Controls }, engine: { ...E,
      applyTileSpeedRuling: state => state, applyChapelRuling: state => state, applyCombatReactionRuling: state => state } }) };
}
function current(ui) { assert.equal(ui.el("error").textContent, ""); return E.importSave(ui.storage.get(qaKey)); }
function selectEnemy(ui, id) {
  const button = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(button => button.dataset.enemy === id);
  assert(button, `map has enemy ${id}`); button.click();
}

// Exercise actual public commands in QA mode, with no hand, enemy or deck edits.
function mobEncounter(moveKind = "endurance") {
  let state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "fast" } });
  const cardId = E.hunter(state).hand.find(card => card.kind === moveKind).id;
  for (const command of [{ type: "MOVE", cardId }, { type: "EXPLORE", edge: "N" },
    { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" }]) state = E.dispatch(state, command);
  assert.equal(E.hunter(state).position, "tile-04:center");
  assert.equal(state.mission.targets.mob.tokens, 1);
  return state;
}
function revival(state, enemy = state.enemies.find(enemy => enemy.missionId === "mob")) {
  return Feedback.tokenRevival({ enemy, definition: enemy && E.enemyDef(state, enemy),
    mission: E.missionView(state), hunterNode: E.hunter(state).position });
}
function attack(state, kind = "strength") {
  return E.dispatch(state, { type: "ATTACK", enemyId: state.enemies.find(enemy => enemy.missionId === "mob").id,
    cardId: E.hunter(state).hand.find(card => card.kind === kind).id, slot: 0 });
}

test("a naturally revealed mob warns before attack declaration without exposing its future action or changing replay", () => {
  const state = mobEncounter(), saved = E.exportSave(state), descriptor = revival(state),
    html = Feedback.tokenRevivalHTML(descriptor);
  assert.equal(descriptor.tokens, 1); assert.equal(descriptor.hp, descriptor.maxHp);
  assert.match(html, /처치 대신 토큰 소모·완전 회복/);
  assert.match(html, /토큰 소모 후 회복 · 적 공격 계속/);
  assert.match(html, /처치될 만큼 피해를 받으면/);
  assert.match(html, /적 처치·처치 보상은 발생하지 않습니다/);
  assert.match(html, /적 행동은 공격 확정 후 공개됩니다/);
  assert.doesNotMatch(html, /도끼 휘두르기|방패 치기/);
  assert.equal(E.exportSave(state), saved);
});

test("the comparison warns that a faster lethal strike revives the mob and still receives its slower attack", () => {
  const before = attack(mobEncounter()), saved = E.exportSave(before), descriptor = revival(before),
    html = Feedback.combatHTML({ combat: before.combat, phase: before.phase,
      enemyName: descriptor.enemyName, tokenRevival: descriptor });
  assert(before.combat.attack.damage >= descriptor.hp);
  assert(before.combat.attack.speed > before.combat.action.speed);
  assert.match(html, /토큰 소모 후 회복 · 적 공격 계속/);
  assert(html.indexOf("combat-token-warning") < html.indexOf("combat-comparison-grid"));
  assert.equal(E.exportSave(before), saved, "the preview neither spends the token nor resolves an attack");
  const after = E.dispatch(before, { type: "RESOLVE" }), enemy = after.enemies.find(enemy => enemy.id === descriptor.enemyId);
  assert.equal(after.mission.targets.mob.tokens, 0); assert.equal(enemy.hp, descriptor.maxHp);
  assert.equal(E.hunter(after).hp, 4); assert.equal(after.kills, 0); assert.equal(E.hunter(after).echoes, 0);
  assert.equal(revival(after), null, "the spent token no longer produces a revival warning");
  assert.deepEqual(E.importSave(E.exportSave(after)), after);
});

test("a separate valid interrupt survives token revival instead of falsely forecasting an unavoidable attack", () => {
  let start = mobEncounter();
  start = E.dispatch(start, { type: "USE_CONSUMABLE", itemId: E.hunter(start).consumables.find(item => item.kind === "qa-cards").id });
  const before = attack(start, "skill"), descriptor = revival(before),
    html = Feedback.combatHTML({ combat: before.combat, phase: before.phase, tokenRevival: descriptor });
  assert(before.combat.attack.interrupt); assert(before.combat.attack.speed > before.combat.action.speed);
  assert.match(html, /선택한 공격의 방해 적용/);
  assert.doesNotMatch(html, /토큰 소모 후 회복 · 적 공격 계속/);
  const after = E.dispatch(before, { type: "RESOLVE" });
  assert.equal(after.mission.targets.mob.tokens, 0); assert.equal(E.hunter(after).hp, 6);
  assert.equal(after.enemies.find(enemy => enemy.id === descriptor.enemyId).hp, descriptor.maxHp);
  assert.equal(after.kills, 0);
  const shot = E.dispatch(attack(mobEncounter()), { type: "FIREARM" }), canceled = Feedback.tokenRevivalHTML(revival(shot), {
    combat: shot.combat, phase: shot.phase });
  assert(shot.combat.cancelEnemy); assert.match(canceled, /현재 적 공격 취소 유지/);
  assert.doesNotMatch(canceled, /적 공격 계속/);
});

test("the warning keeps dodge and separately pending followup consequences distinct", () => {
  const before = attack(mobEncounter()), descriptor = revival(before),
    dodged = { ...before.combat, dodged: true, cancelEnemy: true, extra: { damage: 2, dodgeSpeed: 2 } },
    extra = Feedback.combatHTML({ combat: dodged, phase: "combat_extra", tokenRevival: descriptor });
  assert.match(extra, /토큰 회복 후에도 별도 추가 타격 대응 필요/);
  assert.doesNotMatch(extra, /현재 적 공격 취소 유지|현재 적 공격 회피 선택 유지/);
  const ordinaryDodge = Feedback.tokenRevivalHTML(descriptor, { combat: { ...before.combat, dodged: true }, phase: "combat_react" });
  assert.match(ordinaryDodge, /현재 적 공격 회피 선택 유지/);
  assert.match(ordinaryDodge, /별도의 추가 타격에는 따로 대응/);
});

test("only a living, disclosed, matched target with remaining tokens can produce a warning", () => {
  const state = mobEncounter(), enemy = state.enemies.find(enemy => enemy.missionId === "mob"),
    mission = E.missionView(state), definition = E.enemyDef(state, enemy), facts = { enemy, definition, mission };
  Object.defineProperty(mission, "futureCards", { get() { throw Error("future cards cannot be inspected"); } });
  assert(Feedback.tokenRevival(facts));
  assert.equal(Feedback.tokenRevival({ ...facts, mission: { ...mission, revealed: [1] } }), null);
  for (const target of [{ ...mission.targets[0], tokens: 0 }, { ...mission.targets[0], complete: true },
    { ...mission.targets[0], enemyId: "different-enemy" }])
    assert.equal(Feedback.tokenRevival({ ...facts, mission: { ...mission, targets: [target] } }), null);
  assert.equal(Feedback.tokenRevival({ ...facts, enemy: { ...enemy, hp: 0 } }), null);
  assert.equal(Feedback.tokenRevival({ ...facts, enemy: { ...enemy, missionId: undefined } }), null);
  assert.equal(Feedback.tokenRevival({ ...facts, mission: null }), null);
});

test("public names are escaped and a different combat cannot lend its cancellation to this target", () => {
  const descriptor = { enemyId: "mob", enemyName: '<img src=x onerror="alert(1)">', hp: 4, maxHp: 4, tokens: 2 },
    html = Feedback.tokenRevivalHTML(descriptor, { combat: { enemyId: "other", cancelEnemy: true } });
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
  assert.match(html, /임무 계몽 토큰 2개/); assert.match(html, /적 공격 계속/);
  assert.equal(Feedback.tokenRevivalHTML(null), "");
});

test("actual map selection warns before ATTACK, keeps its bound commit in the action dock and removes the warning once spent", () => {
  const start = mobEncounter(), mob = start.enemies.find(enemy => enemy.missionId === "mob"),
    { ui, normalSave } = launch(start), save = ui.storage.get(qaKey);
  selectEnemy(ui, mob.id);
  const intent = ui.el("hunterActionBar").querySelectorAll("[data-hunter-intent]").find(button => button.dataset.hunterIntent === "ATTACK");
  assert(intent && !intent.disabled); intent.click();
  assert.equal(ui.el("confirmHunterAction").disabled, true);
  const card = E.hunter(start).hand.find(card => card.kind === "strength");
  ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === card.id).click();
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find(button => button.dataset.slot === "0");
  if (slot.getAttribute("aria-pressed") !== "true") slot.click();
  assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("attackConsequences").textContent, /토큰 소모 후 완전 회복/);
  assert.match(ui.el("combatInfo").textContent, /토큰 1개.*처치될 피해.*체력 4 \/ 4.*회복/);
  assert.match(ui.el("attackConsequences").textContent, /적 공격 계속/);
  assert.match(ui.el("combatInfo").textContent, /처치·처치 보상은 발생하지 않습니다/);
  assert.equal(ui.storage.get(qaKey), save, "inspection and selection do not commit an attack");
  assert.doesNotMatch(ui.el("combatInfo").innerHTML, /combat-comparison|현재 전투의 공격 비교/, "only the public mission warning appears before an action is revealed");
  const commit = ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === "ATTACK");
  assert(commit, "the map-selected attack commit is outside the scrolling explanations"); assert.equal(commit.disabled, false);
  commit.click(); const comparison = current(ui);
  assert.equal(comparison.phase, "combat_react"); assert.equal(comparison.commands.at(-1).type, "ATTACK");
  assert.equal(comparison.commands.at(-1).enemyId, mob.id);
  assert.deepEqual(comparison, E.dispatch(start, comparison.commands.at(-1)));
  assert.match(ui.el("combatInfo").textContent, /토큰 소모 후 완전 회복 · 적 공격 계속/);
  assert.equal(ui.el("attackConsequences").hidden, false);
  const resolve = ui.el("decisionActions").querySelectorAll("[data-command]").find(button => button.dataset.command === "RESOLVE");
  assert(resolve && !resolve.disabled); resolve.click(); const after = current(ui);
  assert.deepEqual(after, E.dispatch(comparison, { type: "RESOLVE" }));
  assert.equal(after.mission.targets.mob.tokens, 0); assert.equal(E.hunter(after).hp, 4);
  assert.equal(ui.el("attackConsequences").hidden, true); assert.equal(ui.el("attackConsequences").innerHTML, "");
  assert.equal(ui.el("combatInfo").innerHTML, "");
  assert.equal(ui.storage.get(normalKey), normalSave, "QA warning and combat preserve the normal autosave");
});

test("switching actual selected enemies updates the warning without borrowing the other target's token", () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14,
    qa: { preset: "custom", startRewards: [], startConsumables: [] } });
  for (const command of require("./fixtures/full-campaign-actual-v10-commands.json").slice(0, 111)) {
    while (state.phase === "kill_react" && !state.rewardChoices.length)
      state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
    state = E.dispatch(state, command);
  }
  const target = state.enemies.find(enemy => enemy.missionId === "main"), ordinary = state.enemies.find(enemy => !enemy.missionId),
    { ui } = launch(state), saved = ui.storage.get(qaKey);
  assert(target && ordinary); assert(state.mission.targets.main.tokens > 0);
  selectEnemy(ui, target.id); assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("combatInfo").textContent, /토큰 \d+개.*처치될 피해.*회복/);
  selectEnemy(ui, ordinary.id); assert.equal(ui.el("attackConsequences").hidden, true);
  assert.equal(ui.el("attackConsequences").innerHTML, "");
  selectEnemy(ui, target.id); assert.equal(ui.el("attackConsequences").hidden, false);
  assert.equal(ui.storage.get(qaKey), saved, "changing selected targets commits no commands or token effects");
});
