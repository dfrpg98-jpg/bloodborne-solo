"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Preview = require("../src/hunt-outcome-preview");
const { hand, fixture: componentFixture } = require("./actual-combat-helper.cjs");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function facts(s, enemy = s.enemies.find(e => e.id === s.combat?.enemyId) || s.enemies[0]) {
  return { enemy, definition: enemy && E.enemyDef(s, enemy), mission: E.missionView(s),
    hunter: E.hunter(s), combat: s.combat, phase: s.phase };
}
function replay(file) {
  let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 14 });
  const states = [s];
  for (const command of require("./fixtures/" + file)) {
    const using = () => command.type === "USE_REWARD" && E.killReactionActions(s).some(a =>
      !a.disabled && a.command.rewardId === command.rewardId && a.command.enemyId === command.enemyId);
    while (s.phase === "kill_react" && !s.rewardChoices.length && !using()) s = go(s, "PASS_KILL_REACTION");
    s = E.dispatch(s, command); states.push(s);
  }
  return states;
}
const patient = replay("v074-patient-natural-commands.json"), shelter = replay("v074-shelter-natural-commands.json");
const warning = (model, id) => model?.warnings.find(w => w.id === id);
function followupFixture({ hp = 3, cards = ["regain", "endurance", "vitality"], slot = 1 } = {}) {
  const s = E.create(123, "burial", 1, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  s.world.assignments.find(a => a.enemyId === "scourge-beast").sideId = "b";
  s.enemies = [{ id: "scourge-beast-1", kind: "scourge-beast", figure: 1, node: E.hunter(s).position, hp: 4 }];
  s.loot = []; s.enemyDeck = ["special", "basic", "basic", "basic", "special", "ability"]; s.enemyDiscard = [];
  hand(s, cards); E.hunter(s).hp = hp; E.assertState(s);
  return go(s, "ATTACK", { enemyId: s.enemies[0].id, cardId: E.hunter(s).hand[0].id, slot });
}
test("natural chapter-two patient exposes both remaining lives and its known final death reaction before ATTACK", () => {
  const seen = new Set();
  for (const state of patient) {
    const enemy = state.enemies.find(e => e.missionId === "patient");
    if (!enemy || state.phase !== "hunter") continue;
    const saved = E.exportSave(state), model = Preview.describe(facts(state, enemy)), tokens = state.mission.targets.patient.tokens;
    seen.add(tokens); assert.equal(!!warning(model, "revival"), tokens > 0);
    assert.equal(model.deathReaction.damage, 3); assert.equal(model.deathReaction.dodgeSpeed, 1);
    assert.equal(model.deathReaction.remainingTokens, tokens); assert(warning(model, "last-attack"));
    assert.match(Preview.renderHTML(model), /속도 1 회피.*피해 3/s);
    assert.match(Preview.renderHTML(model), /적 행동은 공격 확정 후 공개/);
    assert.equal(E.exportSave(state), saved, "reading consequences cannot spend lives, reveal an action or change a save");
    assert.equal(model.sequence.length, 0, "unknown enemy action has no invented combat order");
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
  assert.equal(patient.at(-1).phase, "mission_death");
  assert.equal(patient.at(-1).mission.targets.patient.complete, true);
  assert.equal(E.hunter(patient.at(-1)).hp, 3);
});
test("chapter-one shelter also warns about its printed last attack after its remaining token is consumed", () => {
  const state = shelter.find(s => s.phase === "hunter" && s.mission.targets.shelter?.tokens === 0 &&
    s.enemies.some(e => e.missionId === "shelter"));
  assert(state); const enemy = state.enemies.find(e => e.missionId === "shelter"), model = Preview.describe(facts(state, enemy));
  assert(warning(model, "last-attack")); assert.equal(warning(model, "revival"), undefined);
  assert.match(warning(model, "last-attack").title, /최종 처치 후.*피해 3/);
});
test("a faster hit against blood frenzy keeps its public wounded-condition damage conditional", () => {
  const state = shelter.find(s => s.phase === "combat_react" && s.combat?.action.kind === "special" &&
    s.enemies.find(e => e.id === s.combat.enemyId)?.missionId === "shelter");
  assert(state); const input = facts(state), combat = { ...input.combat, defense: 1,
    attack: { ...input.combat.attack, speed: input.combat.action.speed + 1 } },
    model = Preview.describe({ ...input, combat });
  assert.equal(combat.buff.damage, 1); assert.equal(model.incoming.firstMinimum, 2); assert.equal(model.incoming.first, 4);
  assert.match(model.sequence.find(s => s.id === "enemy-first").detail, /가득.*피해 2.*다친.*피해 4.*받을 피해 2~4/);
  assert.match(model.sequence.find(s => s.id === "enemy-first").detail, /토큰 회복.*조건/);
});
test("an undisclosed, completed or mismatched mission cannot expose extra lives or future final-kill rules", () => {
  const state = patient.find(s => s.phase === "hunter" && s.mission.targets.patient?.tokens === 2),
    enemy = state.enemies.find(e => e.missionId === "patient"), input = facts(state, enemy);
  for (const mission of [{ ...input.mission, revealed: [30] },
    { ...input.mission, targets: input.mission.targets.map(t => ({ ...t, complete: true })) },
    { ...input.mission, targets: input.mission.targets.map(t => ({ ...t, enemyId: "different" })) }]) {
    const model = Preview.describe({ ...input, mission });
    assert.equal(warning(model, "revival"), undefined); assert.equal(warning(model, "last-attack"), undefined);
    assert.equal(Preview.renderHTML(model), "");
  }
  assert.equal(Preview.describe({ ...input, enemy: { ...enemy, hp: 0 } }), null);
});
test("a public boss phase warns that depleting phase one health is not a final kill", () => {
  let state = componentFixture("cleric-beast", 1); const model = Preview.describe(facts(state));
  assert.match(warning(model, "boss-phase").detail, /초과 피해.*넘기지/);
  state.enemies[0].hp = 1;
  state = go(state, "ATTACK", { enemyId: state.enemies[0].id, cardId: E.hunter(state).hand[0].id, slot: 0 });
  state = go(state, "RESOLVE");
  assert.equal(state.enemies[0].componentPhase, 2); assert.equal(state.kills, 0);
  assert.equal(warning(Preview.describe(facts(state)), "boss-phase"), undefined);
});
test("the disclosed chapter-two invulnerability is visible without using a future boss action", () => {
  const states = replay("full-campaign-actual-v10-commands.json"), state = states.find(s => s.mission.chapter === 2 &&
    s.mission.revealed.includes(22) && !s.mission.targets.main?.complete);
  assert(state); const enemy = state.enemies.find(e => e.missionId === "main"), input = facts(state, enemy);
  Object.defineProperty(input, "enemyDeck", { get() { throw Error("hidden deck must not be read"); } });
  assert(warning(Preview.describe(input), "damage-immunity"));
  const completed = { ...input.mission, discarded: [...input.mission.discarded, 22] };
  assert.equal(warning(Preview.describe({ ...input, mission: completed }), "damage-immunity"), undefined);
});
test("actual two plus two followup occurs before a slower regain, and the preview warns of death before healing", () => {
  const before = followupFixture(), saved = E.exportSave(before), model = Preview.describe(facts(before));
  assert.equal(before.combat.action.damage, 2); assert.equal(before.combat.action.followup, true);
  assert.equal(before.combat.attack.speed, 1); assert.equal(before.combat.attack.afterAttackHeal, 2);
  assert.deepEqual(model.sequence.map(s => s.id), ["enemy-first", "enemy-followup", "hunter-attack"]);
  assert.equal(model.incoming.first, 2); assert.equal(model.incoming.followup, 2);
  assert.equal(model.incoming.total, 4); assert.equal(model.incoming.beforeHealing, 4);
  assert.equal(model.incoming.fatalBeforeHealing, true); assert(warning(model, "fatal-before-heal"));
  assert.match(Preview.renderHTML(model), /첫 타격 2 \+ 추가 타격 2.*합계 4 피해/);
  assert.equal(E.exportSave(before), saved);
  const extra = go(before, "RESOLVE");
  assert.equal(extra.phase, "combat_extra"); assert.equal(E.hunter(extra).hp, 1);
  assert.equal(extra.combat.attackResolved, undefined);
  const remaining = Preview.describe(facts(extra));
  assert.equal(remaining.incoming.first, 0); assert.equal(remaining.incoming.total, 2);
  assert.deepEqual(remaining.sequence.map(s => s.id), ["enemy-followup", "hunter-attack"]);
  assert(warning(remaining, "fatal-before-heal"));
  const after = go(extra, "EXTRA_TAKE");
  assert.equal(E.hunter(after).inDream, true);
  assert(!after.events.some(e => e.text.includes("공격 후 치유")), "death prevents the slower regain entirely");
});
test("dodging only the first hit leaves the separate two-damage followup before slower healing", () => {
  const before = followupFixture(), cardId = E.hunter(before).hand.find(c => c.kind === "endurance").id,
    dodged = go(before, "DODGE", { cardId, slot: 0 }), model = Preview.describe(facts(dodged));
  assert.equal(model.incoming.first, 0); assert.equal(model.incoming.followup, 2);
  assert.equal(model.incoming.beforeHealing, 2); assert.equal(model.incoming.fatalBeforeHealing, false);
  assert.equal(warning(model, "fatal-before-heal"), undefined);
  const extra = go(dodged, "RESOLVE"); assert.equal(E.hunter(extra).hp, 3); assert.equal(extra.phase, "combat_extra");
  const after = go(extra, "EXTRA_TAKE"); assert.equal(E.hunter(after).hp, 3); assert.equal(E.hunter(after).inDream, false);
});
test("separate-hit defense and frenzy use the engine's actual attack and nonattack damage rules", () => {
  const state = followupFixture(); state.combat.defense = 1; E.hunter(state).status.frenzy = true;
  const model = Preview.describe(facts(state));
  assert.equal(model.incoming.first, 2); assert.equal(model.incoming.followup, 1);
  assert.equal(model.incoming.total, 3, "frenzy increases the first attack, not the separate nonattack followup");
  const extra = go(state, "RESOLVE"); assert.equal(E.hunter(extra).hp, 1);
  const after = go(extra, "EXTRA_TAKE"); assert.equal(E.hunter(after).inDream, true);
});
test("simultaneous lethal damage also precedes regain, without incorrectly placing a later followup before that heal", () => {
  const state = followupFixture({ hp: 2, slot: 0 }), model = Preview.describe(facts(state));
  assert.equal(state.combat.attack.speed, state.combat.action.speed);
  assert.equal(model.incoming.beforeHealing, 2); assert(warning(model, "fatal-before-heal"));
  assert.equal(model.sequence[0].id, "simultaneous");
  const after = go(state, "RESOLVE"); assert.equal(E.hunter(after).inDream, true);
  assert(!after.events.some(e => e.text.includes("공격 후 치유")));
});
test("an already queued extra hit stays visible even after a simultaneous final kill removes the enemy figure", () => {
  const before = followupFixture({ hp: 6, slot: 0 }); before.enemies[0].hp = 1;
  const extra = go(before, "RESOLVE");
  assert.equal(extra.phase, "combat_extra"); assert.equal(extra.enemies.length, 0);
  assert.equal(E.hunter(extra).hp, 6, "first damage and then regain already happened at the same speed");
  const model = Preview.describe({ combat: extra.combat, phase: extra.phase, hunter: E.hunter(extra) });
  assert.equal(model.incoming.first, 0); assert.equal(model.incoming.followup, 2);
  assert.equal(model.incoming.total, 2); assert.equal(model.incoming.beforeHealing, 0);
  assert.deepEqual(model.sequence.map(s => s.id), ["enemy-followup"]);
  assert.match(Preview.renderHTML(model), /남은 추가 타격.*피해 2/);
  const after = go(extra, "EXTRA_TAKE"); assert.equal(E.hunter(after).hp, 4);
});
test("another enemy's combat cannot lend a resolved action or cancellation to an inspected target", () => {
  const state = patient.find(s => s.phase === "hunter" && s.mission.targets.patient?.tokens === 2),
    enemy = state.enemies.find(e => e.missionId === "patient"), input = facts(state, enemy),
    model = Preview.describe({ ...input, combat: { enemyId: "other", cancelEnemy: true,
      action: { type: "attack", name: "future secret", speed: 9, damage: 9 } } });
  assert.equal(model.enemyActionUnknown, true); assert.equal(model.incoming, null);
  assert.match(warning(model, "revival").title, /적 공격 계속/);
  assert.doesNotMatch(Preview.renderHTML(model), /future secret/);
});
test("names are escaped, public input objects are untouched and empty ordinary targets produce no forecast", () => {
  const state = followupFixture(), input = facts(state), before = structuredClone(input);
  Preview.describe(input); assert.deepEqual(input, before);
  const model = Preview.describe({ ...input, combat: null, definition: { ...input.definition, name: '<img src=x onerror="bad()">' },
    mission: { revealed: [31], targets: [{ id: "patient", enemyId: input.enemy.id, card: 31, tokens: 2 }] },
    enemy: { ...input.enemy, missionId: "patient" } });
  const html = Preview.renderHTML(model, { clean: text => text + " <unsafe>" });
  assert.match(html, /&lt;unsafe&gt;/); assert.doesNotMatch(html, /<unsafe>|<img/);
  assert.equal(Preview.renderHTML(Preview.describe({ ...input, combat: null })), "");
});
test("fixed compact warning keeps fatal risk and full followup total without duplicating expanded explanations", () => {
  const model = Preview.describe(facts(followupFixture())), compact = Preview.renderHTML(model, { compact: true }),
    expanded = Preview.renderHTML(model);
  assert.match(compact, /회복 전에 사망 가능/);
  assert.match(compact, /첫 타격 2 \+ 추가 타격 2.*합계 4 피해/);
  assert(compact.indexOf("fatal-before-heal") < compact.indexOf("followup-total"));
  assert.match(compact, /위 전투 상세에서 처리 순서 확인/);
  assert.doesNotMatch(compact, /체력이 0이 되면|추가 타격 처리 뒤|조건부 예고|outcome-sequence/);
  assert.match(expanded, /체력이 0이 되면 공격 후 치유로 되살아나지/);
  assert.match(expanded, /추가 타격 처리 뒤에 더 느린 플레이어 공격/);
  assert.match(expanded, /조건부 예고/); assert.match(expanded, /outcome-sequence/);
});
test("compact warning shows at most three prioritized titles, a remaining count and preserves all expanded warnings", () => {
  const model = { warnings: [
    { id: "poison", title: "독 주의", detail: "독 상세 설명" },
    { id: "last-attack", title: "최종 처치 후 대응", detail: "처치 후 상세 설명" },
    { id: "revival", title: "토큰 소모 후 완전 회복", detail: "토큰 상세 설명" },
    { id: "followup-total", title: "첫 2 + 추가 2 = 합계 4", detail: "추가 타격 상세 설명" },
    { id: "fatal-before-heal", title: "회복 전에 사망 가능", detail: "사망 상세 설명", critical: true },
  ], sequence: [], unknownDetail: "확정 전 비공개 행동 설명", enemyActionUnknown: true }, before = structuredClone(model),
    compact = Preview.renderHTML(model, { compact: true }), expanded = Preview.renderHTML(model);
  assert.equal((compact.match(/data-outcome=/g) || []).length, 3);
  assert(compact.indexOf("fatal-before-heal") < compact.indexOf("followup-total"));
  assert(compact.indexOf("followup-total") < compact.indexOf("revival"));
  assert.match(compact, /추가 예고 2개/); assert.doesNotMatch(compact, /상세 설명|비공개 행동 설명|조건부 예고/);
  for (const item of model.warnings) { assert(expanded.includes(item.title)); assert(expanded.includes(item.detail)); }
  assert.match(expanded, /확정 전 비공개 행동 설명/); assert.deepEqual(model, before);
});
test("a fresh QA hunt legally buys regain and reaches its first-two-plus-extra-two lethal sequence without fixture edits", () => {
  const { setup, commands } = require("./fixtures/v0813-dev14-followup-regain-legal-commands.json");
  let state = E.create(setup.seed, setup.weaponId, setup.face, null, setup.firearmId, setup.startSpace, setup.options);
  for (const command of commands.slice(0, 21)) state = E.dispatch(state, command);
  assert.equal(state.phase, "hunter"); assert.equal(E.hunter(state).hp, 3);
  assert.equal(E.hunter(state).position, "tile-11:street");
  assert(E.hunter(state).hand.some(c => c.kind === "regain" && c.id === "card-13"));
  assert.equal(state.commands.length, 21);
  const before = E.exportSave(state), declared = E.dispatch(state, commands[21]), model = Preview.describe(facts(declared));
  assert.equal(declared.combat.attack.speed, 1); assert.equal(declared.combat.attack.afterAttackHeal, 2);
  assert.equal(declared.combat.action.speed, 2); assert.equal(declared.combat.action.damage, 2);
  assert.equal(declared.combat.action.followup, true); assert(warning(model, "fatal-before-heal"));
  assert.match(Preview.renderHTML(model, { compact: true }), /합계 4 피해/);
  const extra = E.dispatch(declared, commands[22]);
  assert.equal(extra.phase, "combat_extra"); assert.equal(E.hunter(extra).hp, 1);
  assert.equal(Preview.describe(facts(extra)).incoming.total, 2);
  const after = E.dispatch(extra, commands[23]); assert(E.hunter(after).inDream);
  assert(!after.events.some(e => e.text.includes("공격 후 치유")));
  for (const save of [before, E.exportSave(declared), E.exportSave(extra), E.exportSave(after)])
    assert.equal(E.exportSave(E.importSave(save)), save, "all four checkpoints replay exactly from legitimate setup and commands");
});
