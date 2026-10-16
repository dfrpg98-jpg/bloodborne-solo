"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const events = require("../src/hunt-animation-events");
const actor = (id, node, hp = 6, kind = "enemy") => ({ id, node, hp, kind });
const snapshot = (revision, overrides = {}) => ({ revision, sceneId: "chapter-1", firearmReady: true,
  actors: [actor("hunter", "a", 6, "hunter"), actor("e1", "a", 4), actor("e2", "b", 3)], events: [], ...overrides });
const line = text => ({ round: 1, text });

test("selecting, zooming and re-rendering public actors never invents a rule action", () => {
  const a = snapshot(1), b = snapshot(1, { actors: [actor("hunter", "a", 6, "hunter"), actor("e1", "b", 2)] });
  assert.deepEqual(events.describe(a, b, [{ type: "STEP" }]), []);
  assert.deepEqual(events.describe(a, snapshot(2), [{ type: "ATTACK", enemyId: "e1" }]), []);
});
test("automatic pursuit, activation and forced displacement report every actually moved public actor", () => {
  const a = snapshot(1), b = snapshot(2, { actors: [actor("hunter", "c", 6, "hunter"), actor("e1", "c", 4), actor("e2", "d", 3)] });
  const result = events.describe(a, b, [{ type: "END_TURN" }]);
  assert.deepEqual(result.map(action => action.fromId), ["hunter", "e1", "e2"]);
  assert(result.every(action => action.type === "move"));
  assert.deepEqual(result[1], { type: "move", fromId: "e1", fromNode: "a", toNode: "c" });
});
test("both speed-group attacks animate only after actual public resolution, including zero defended damage", () => {
  const combat = { enemyId: "e1", attackName: "강력한 후리기", enemyActionName: "도끼 휘두르기" }, a = snapshot(1, { combat }),
    b = snapshot(2, { events: [line("도끼 휘두르기 · 사냥꾼에게 2 피해."), line("강력한 후리기 · 적에게 0 피해.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "RESOLVE" }]), [
    { type: "attack", fromId: "e1", toId: "hunter", damage: 2 },
    { type: "attack", fromId: "hunter", toId: "e1", damage: 0 },
  ]);
  assert.deepEqual(events.describe(a, snapshot(2, { combat, events: [line("적의 방해 · 사냥꾼 공격 취소.")] }), [{ type: "RESOLVE" }]), []);
});
test("a healed crowd target and a hunter killed then healed in the dream still use actual damage logs", () => {
  const a = snapshot(1, { combat: { enemyId: "e1", enemyActionName: "도끼 휘두르기" } }), b = snapshot(2, {
    events: [line("도끼 휘두르기 · 사냥꾼에게 6 피해."), line("강력한 후리기 · 적에게 3 피해."), line("군중 · 전치유."), line("사냥꾼의 꿈에서 회복했습니다.")] });
  assert.equal(events.describe(a, b, [{ type: "RESOLVE" }]).filter(action => action.type === "attack").length, 2);
});
test("using an interrupting firearm produces a shot without pretending the hunter or enemy attack resolved", () => {
  const a = snapshot(1, { combat: { enemyId: "e1", enemyActionName: "도끼 휘두르기" } }), b = snapshot(2, {
    firearmReady: false, events: [line("사냥꾼의 권총 · 기본 공격 자동 방해, 화기 소진.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "FIREARM" }]), [{ type: "shot", fromId: "hunter", toId: "e1" }]);
  assert.deepEqual(events.describe(a, b, [{ type: "BOSS_INSIGHT" }]), []);
});
test("a declared flamethrower shot waits for its public speed-group resolution", () => {
  const a = snapshot(1), combat = { enemyId: "e1", flameName: "화염방사기" },
    b = snapshot(2, { firearmReady: false, combat, events: [line("화염방사기 · 속도 2, 피해 2, 방해, 화기 소진.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "FIREARM", enemyId: "e1" }]), []);
  const c = snapshot(3, { firearmReady: false, events: [...b.events, line("화염방사기 · 적에게 2 피해.")] });
  assert.deepEqual(events.describe(b, c, [{ type: "RESOLVE" }]), [{ type: "shot", fromId: "hunter", toId: "e1", damage: 2 }]);
});
test("entry shots distinguish accepting, declining and actual zero defended damage", () => {
  const a = snapshot(1, { firearmEntry: { enemyId: "e1" } }), b = snapshot(2, {
    firearmReady: false, events: [line("루드비히의 장총 · 진입한 성직자 야수에게 피해 0, 화기 소진.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "FIREARM_ENTRY", accept: true }]), [{ type: "shot", fromId: "hunter", toId: "e1", damage: 0 }]);
  assert.deepEqual(events.describe(a, snapshot(2), [{ type: "FIREARM_ENTRY", accept: false }]), []);
});
test("bounded public log overlap handles repeated identical hits without replaying old effects", () => {
  const a = snapshot(1, { combat: { enemyId: "e1", enemyActionName: "도끼 휘두르기" },
    events: [line("오래된 로그"), line("도끼 휘두르기 · 사냥꾼에게 2 피해.")] }),
    b = snapshot(2, { events: [a.events[1], line("도끼 휘두르기 · 사냥꾼에게 2 피해.")] });
  assert.equal(events.describe(a, b, [{ type: "RESOLVE" }]).length, 1);
});
test("new scenes and respawned enemy IDs snap instead of showing invented walk routes", () => {
  const a = snapshot(1), changed = [actor("hunter", "a", 6, "hunter"), actor("e1", "c", 4)];
  assert.deepEqual(events.describe(a, snapshot(2, { sceneId: "chapter-2", actors: changed }), [{ type: "START_NEXT_CHAPTER" }]), []);
  assert.deepEqual(events.describe(a, snapshot(2, { actors: changed, events: [line("지도 초기화 · 가까운 출현 지점부터 복원합니다.")] }), [{ type: "END_TURN" }]), []);
});
test("public named splash and weapon effects use the exact visible actor and actual health loss", () => {
  const a = snapshot(1, { actors: [actor("hunter", "a", 6, "hunter"), { ...actor("e1", "a", 4), name: "재앙의 야수" },
    { ...actor("e2", "a", 3), name: "야수 사냥 하인" }], combat: { enemyId: "e1", flameName: "화염방사기" } }),
    b = snapshot(2, { actors: [a.actors[0], { ...a.actors[1], hp: 2 }, { ...a.actors[2], hp: 2 }],
      events: [line("화염방사기 · 재앙의 야수에게 피해 2."), line("화염방사기 · 같은 칸 야수 사냥 하인에게 피해1.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "RESOLVE" }]), [
    { type: "shot", fromId: "hunter", toId: "e1", damage: 2 },
    { type: "shot", fromId: "hunter", toId: "e2", damage: 1 },
  ]);
  const defended = snapshot(2, { actors: a.actors, events: [line("도끼 · 야수 사냥 하인에게 피해 2.")] });
  assert.equal(events.describe(a, defended, [{ type: "WEAPON_CHOICE", enemyId: "e2" }])[0].damage, 0);
});
test("a targeted item kill can animate its confirmed public defeat without needing a living post-action target", () => {
  const a = snapshot(1, { actors: [actor("hunter", "a", 6, "hunter"), { ...actor("e1", "a", 4), name: "재앙의 야수" }] }),
    b = snapshot(2, { actors: [a.actors[0]], events: [line("재앙의 야수 처치 · 피의 유지 +1 (최대 3)."), line("성스러운 종 · 적을 처치합니다.")] });
  assert.deepEqual(events.describe(a, b, [{ type: "USE_REWARD", enemyId: "e1" }]), [
    { type: "attack", fromId: "hunter", toId: "e1", damage: 4 },
  ]);
});
test("the classifier reads only allowlisted public fields and never mutates frozen snapshots", () => {
  const a = snapshot(1), b = snapshot(2, { combat: { enemyId: "e1" }, events: [line("강력한 후리기 · 적에게 3 피해.")] });
  for (const object of [a, b, ...a.actors, ...b.actors]) {
    for (const key of ["deck", "bossDecks", "nextReward", "state", "unrevealed"])
      Object.defineProperty(object, key, { get() { throw Error("hidden data accessed"); } });
    Object.freeze(object);
  }
  assert.doesNotThrow(() => events.describe(a, b, [{ type: "RESOLVE" }]));
  assert.equal(events.describe(a, b, [{ type: "RESOLVE" }])[0].toId, "e1");
  assert.deepEqual(events.describe(snapshot(1), snapshot(2, { events: [line("강력한 후리기 · 적에게 3 피해.")] }), [{ type: "RESOLVE", enemyId: "unknown" }]), []);
});
