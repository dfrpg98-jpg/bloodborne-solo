"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), P = require("../src/hunt-public-text"),
  C = require("../campaigns/long-hunt/data.json"), { boot } = require("./helpers/ui-harness.cjs");
const commands = require("./fixtures/v074-optional-58-natural-commands.json"), key = "bloodborne-hunt-v07";
let cached = null;
function checkpoints() {
  if (cached) return cached;
  // This is the repository's historical rules-13 public-command trace. It is
  // not the parent's cloud-only dev.17 save or a new current-policy playthrough.
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  const result = { byRemaining: new Map(), follow: null, beforeReveal: null };
  for (let index = 0; index < commands.length; index++) {
    const before = state; state = E.dispatch(state, commands[index]);
    if (!before.mission.revealed.includes(57) && state.mission.revealed.includes(57)) result.beforeReveal = before;
    if (state.mission.revealed.includes(57) && before.mission.counters?.[57] !== state.mission.counters[57])
      result.byRemaining.set(state.mission.counters[57], { state, index: index + 1, command: commands[index] });
    if (!result.follow && commands[index].type === "MISSION_NPC_FOLLOW") result.follow = { before, state, command: commands[index] };
  }
  assert.deepEqual([...result.byRemaining.keys()], [2, 1, 0]); assert(result.beforeReveal && result.follow);
  for (const { state } of result.byRemaining.values()) {
    const saved = E.exportSave(state); assert.equal(E.exportSave(E.importSave(saved)), saved);
  }
  return cached = result;
}
function objective(state) {
  const view = E.missionView(state), source = view.objectives.find(item => item.id === "card-57");
  assert(source); return P.objective(source, state, view);
}
function launch(state) {
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    storage: { [key]: saved }, engine: { ...E, applyChapelRuling: value => value,
      applyCombatReactionRuling: value => value, applyTileSpeedRuling: value => value, applyLeapMoveRuling: value => value },
  });
  assert.equal(ui.el("error").textContent, ""); return { ui, saved };
}

test("the disclosed salvation rule starts with hunter-count plus one tokens and removes one per qualifying kill", () => {
  const rule = C.cards.find(card => card.number === 57).rules.join(" ");
  assert.match(rule, /\[사냥꾼 수\]\+1개/);
  assert.match(rule, /NPC가 위치한 칸에서 야수 사냥 무리 또는 야수 사냥 하수인을 처치할 때마다.*토큰 1개를 제거/);
  assert.match(rule, /NPC가 위치한 칸에서 이동해 나가는 사냥꾼은, NPC와 함께 이동할 수/);
  assert(C.resolvedQuestions?.some?.(item => item.card === 57) || C.cards.find(card => card.number === 57).resolvedQuestions.includes("Q57"));
  const records = checkpoints().byRemaining;
  assert.deepEqual([...records.values()].map(record => [record.index, record.command.type]),
    [[223, "STEP"], [234, "RESOLVE"], [252, "RESOLVE"]]);
});

for (const [remaining, progress] of [[2, "0/2"], [1, "1/2"], [0, "2/2"]])
  test(`salvation's public objective shows ${progress} qualifying kills when ${remaining} mission tokens remain`, () => {
    const state = checkpoints().byRemaining.get(remaining).state, saved = E.exportSave(state), actual = objective(state);
    assert(actual.description.startsWith("NPC와 같은 칸의 무리/하인 처치 " + progress));
    assert.equal(actual.kind, "insight"); assert.deepEqual(actual.sourceCards, [57]);
    assert.deepEqual(actual.guidance, []); assert.deepEqual(actual.actionTypes, []);
    if (remaining) assert.match(actual.description, /NPC 칸에서 도보 동행 가능/);
    else { assert.equal(actual.status, "완료"); assert.doesNotMatch(actual.description, /동행 가능/); }
    assert.doesNotMatch(actual.description, /58|사냥의 짜릿함|카릴|보상/);
    assert.equal(E.exportSave(state), saved);
    assert.deepEqual(objective(E.importSave(saved)), actual);
  });

test("unrevealed or archived salvation cannot leak its task, counter or following hint into the active chapter", () => {
  const state = checkpoints().beforeReveal, view = E.missionView(state), saved = E.exportSave(state);
  assert(!state.mission.revealed.includes(57));
  assert.equal(P.objective({ id: "card-57", title: "구원", status: "진행 중", description: "숨겨진 조건" }, state, view), null);
  assert(!P.chapter(state, view, C).objectives.some(item => item.id === "card-57"));
  const minimal = { hunters: { a: {} }, mission: { chapter: 3, revealed: [40], completed: [],
    counters: {}, history: [{ chapter: 2, revealed: [57], completed: [] }] } };
  Object.defineProperty(minimal.mission.counters, "57", { get() { throw new Error("unopened counter was read"); } });
  assert.equal(P.objective({ id: "card-57", status: "진행 중" }, minimal, { chapter: 3 }), null);
  assert.equal(E.exportSave(state), saved);
});

test("the short walking hint describes an available public following choice without automatically enabling it", () => {
  const { before, state } = checkpoints().follow, saved = E.exportSave(before), actual = objective(before);
  assert.match(actual.description, /NPC 칸에서 도보 동행 가능/);
  const command = E.missionActions(before).find(action => action.command.type === "MISSION_NPC_FOLLOW");
  assert.equal(command.label, "NPC와 함께 이동"); assert.equal(before.mission.npc.follow, false);
  assert.equal(state.mission.npc.follow, true); assert.equal(E.exportSave(before), saved);
});

test("the denominator follows the disclosed hunter-count rule without inventing progress when a counter is missing", () => {
  // Minimal presentation-only inputs, not gameplay saves or multiplayer runs.
  const state = { hunters: { a: {}, b: {}, c: {} }, mission: { chapter: 3, revealed: [57], completed: [], counters: { 57: 3 } } },
    source = { id: "card-57", title: "구원", status: "진행 중", description: "NPC와 같은 칸에서 사냥 무리/하수인을 처치" };
  assert.match(P.objective(source, state, { chapter: 3 }).description, /처치 1\/4/);
  delete state.mission.counters[57];
  const unknown = P.objective(source, state, { chapter: 3 }).description;
  assert.match(unknown, /총 4회/); assert.doesNotMatch(unknown, /0\/4/);
});

test("the actual UI keeps completed kills and remaining mission tokens distinct and renders the same progress after reload", () => {
  for (const [remaining, { state }] of checkpoints().byRemaining) {
    const { ui, saved } = launch(state), description = objective(state).description;
    assert(ui.el("objectiveDetail").textContent.includes(description));
    assert.match(ui.el("missionTokens").textContent, new RegExp(`구원 · 남은 임무 토큰 ${remaining}개`));
    assert.equal(ui.el("missionUpdateDialog").open, false, "loading a public checkpoint does not replay an old mission notification");
    assert.equal(ui.storage.get(key), saved);
    const reload = launch(E.importSave(saved));
    assert.equal(reload.ui.el("objectiveDetail").textContent, ui.el("objectiveDetail").textContent);
    assert.equal(reload.ui.storage.get(key), saved);
  }
});
