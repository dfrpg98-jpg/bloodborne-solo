"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine.js"), Feedback = require("../hunt-death-feedback.js");
const { hand } = require("./actual-combat-helper.cjs");
const go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function fixture(weapon = "burial", face = 0, rewards = []) {
  const s = E.create(123, weapon, face, null, "hunter-pistol", "center",
    { campaign: false, rulesVersion: 14, practiceRewards: rewards });
  const h = E.hunter(s);
  s.world.assignments.find(a => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: h.position, hp: 4 }];
  s.loot = []; hand(s, ["strength", "endurance", "vitality"]);
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = [];
  E.assertState(s); return s;
}
function attacked(s) {
  s = go(s, "END_TURN"); assert.equal(s.phase, "combat_choose");
  return go(s, "NO_ATTACK");
}
test("a lethal enemy attack keeps its cause and real damage when the same command recovers Dream health", () => {
  let before = fixture(); E.hunter(before).hp = 1; before = attacked(before);
  const after = go(before, "RESOLVE"), originalBefore = structuredClone(before), originalAfter = structuredClone(after);
  assert.equal(E.hunter(after).hp, 6); assert.equal(E.hunter(after).inDream, true);
  const result = Feedback.describe(before, after);
  assert.equal(result.cause, "도끼 휘두르기"); assert.equal(result.fatalAmount, 2);
  assert.equal(result.hpBefore, 1); assert.equal(result.damageTotal, 2); assert.equal(result.healthCostTotal, 0);
  assert.deepEqual(result.entries, [{ source: "도끼 휘두르기", amount: 2, kind: "damage" }]);
  assert.deepEqual(before, originalBefore); assert.deepEqual(after, originalAfter);
});
test("lethal poison is identified without attributing an enemy attack that never happened", () => {
  const before = fixture(); before.enemies = []; E.hunter(before).hp = 1; E.hunter(before).status.poison = true;
  const after = go(before, "END_TURN"), result = Feedback.describe(before, after);
  assert.equal(E.hunter(after).hp, 6); assert.equal(result.cause, "독 · 플레이어 차례 종료");
  assert.equal(result.damageTotal, 1); assert.equal(result.entries.length, 1);
});
test("lethal weapon sacrifice is separated from received enemy damage", () => {
  const before = fixture("logarius-wheel", 1); E.hunter(before).hp = 1;
  const after = go(before, "ATTACK", { enemyId: before.enemies[0].id, cardId: E.hunter(before).hand[0].id, slot: 0, weaponBoost: 1 });
  const result = Feedback.describe(before, after);
  assert.match(result.cause, /로가리우스의 바퀴.*추가 공격 효과/);
  assert.equal(result.fatalKind, "health-cost"); assert.equal(result.fatalAmount, 1);
  assert.equal(result.healthCostTotal, 1); assert.equal(result.damageTotal, 0);
});
test("the clinic's lethal printed damage is identified independently of combat", () => {
  const before = fixture(); before.enemies = [];
  // A revealed tile fixture uses the real clinic command and tile node.
  if (!before.world.tilePool.includes("tile-20")) {
    const old = before.world.tileDeck.pop();
    before.world.tilePool.splice(before.world.tilePool.indexOf(old), 1, "tile-20");
    before.world.tileDeck.push("tile-20");
  }
  before.world.tileDeck.splice(before.world.tileDeck.indexOf("tile-20"), 1);
  before.world.tiles.push({ tileId: "tile-20", x: 0, y: -1, rotation: 0 });
  E.hunter(before).position = E.nodes(before).find(n => n.tile === "tile-20").id; E.hunter(before).hp = 1;
  const after = go(before, "CLINIC"), result = Feedback.describe(before, after);
  assert.equal(result.cause, "이오셰프카의 진료소"); assert.equal(result.damageTotal, 1);
});
test("prevented lethal attacks, poison and health sacrifices do not announce a death", () => {
  for (const kind of ["attack", "poison", "cost"]) {
    let before = fixture(kind === "cost" ? "logarius-wheel" : "burial", kind === "cost" ? 1 : 0, ["rune-corruption"]);
    E.hunter(before).hp = 1;
    before = go(before, "SET_REWARD_TRIGGER", { rewardId: E.hunter(before).rewards[0].id, enabled: true });
    let after;
    if (kind === "attack") { before = attacked(before); after = go(before, "RESOLVE"); }
    if (kind === "poison") { before.enemies = []; E.hunter(before).status.poison = true; after = go(before, "END_TURN"); }
    if (kind === "cost") after = go(before, "ATTACK", { enemyId: before.enemies[0].id, cardId: E.hunter(before).hand[0].id, slot: 0, weaponBoost: 1 });
    assert.equal(E.hunter(after).inDream, false, kind); assert.equal(Feedback.describe(before, after), null, kind);
  }
});
test("a voluntary Dream visit and commands issued inside the Dream do not announce death", () => {
  const before = fixture(), after = go(before, "DREAM", { cardId: E.hunter(before).hand[0].id });
  assert.equal(E.hunter(after).inDream, true); assert.equal(Feedback.describe(before, after), null);
  const same = structuredClone(after); same.revision++;
  assert.equal(Feedback.describe(after, same), null);
});
test("a natural mission last-attack choice is not a hunter death, while accepting its lethal damage is", () => {
  const commands = require("./fixtures/v074-patient-natural-commands.json");
  let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  for (const command of commands) s = E.dispatch(s, command);
  assert.equal(s.phase, "mission_death"); assert.equal(E.hunter(s).hp, 3); assert.equal(E.hunter(s).inDream, false);
  const settled = go(s, "KEEP_REWARD", { rewardId: s.rewardChoices[0].rewardId });
  assert.equal(Feedback.describe(s, settled), null);
  const after = go(settled, "MISSION_DEATH_TAKE"), result = Feedback.describe(settled, after);
  assert.equal(result.cause, "포악한 야수의 마지막 공격"); assert.equal(result.damageTotal, 3);
  assert.equal(E.hunter(after).hp, 6); assert.equal(after.track, settled.track + 2);
  assert.deepEqual(E.importSave(E.exportSave(after)), after);
});
test("a new QA hunt naturally reaches lethal combat and only its final new damage enters the notice", () => {
  let s = E.create(1061844653, "qa-test-weapon", 0, null, "hunter-pistol", "center",
    { campaign: true, qa: { preset: "fast" } });
  const commands = [
    { type: "MOVE", cardId: "card-9" }, { type: "STEP", node: "tile-14:left" }, { type: "STOP_MOVE" },
    { type: "MOVE", cardId: "card-2" }, { type: "EXPLORE", edge: "W" }, { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" },
    { type: "END_TURN" }, { type: "NO_ATTACK" }, { type: "RESOLVE" }, { type: "REFILL" },
    { type: "END_TURN" }, { type: "NO_ATTACK" }, { type: "RESOLVE" }, { type: "ENEMY_STEP", node: "tile-14:left" },
    { type: "REFILL" }, { type: "END_TURN" }, { type: "NO_ATTACK" }, { type: "RESOLVE" },
  ];
  const notices = [];
  for (const command of commands) {
    const before = s; s = E.dispatch(s, command);
    const notice = Feedback.describe(before, s); if (notice) notices.push(notice);
  }
  assert.equal(notices.length, 1); assert.equal(notices[0].hpBefore, 1);
  assert.equal(notices[0].damageTotal, 2); assert.equal(notices[0].cause, "도끼 휘두르기");
  assert.equal(E.hunter(s).hp, 6); assert.equal(E.hunter(s).inDream, true); assert.equal(s.phase, "refill");
  assert.equal(s.commands.length, 19); assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
const line = text => ({ round: 1, text }), death = line("처치당했습니다. 모든 피의 유지를 잃고 꿈에 입장합니다.");
function publicSnapshot(revision, inDream, events) {
  return { revision, initialSeed: 7, hunterId: "hunter", hunter: { hp: inDream ? 6 : 2, inDream }, events };
}
test("rolled journal entries retain repeated attacks and all damage before death", () => {
  const hit = line("다단 가르기 · 사냥꾼에게 1 피해."), a = Array.from({ length: 179 }, (_, i) => line(`기록 ${i}`));
  const before = publicSnapshot(1, false, [...a, hit]), after = publicSnapshot(2, true, [...a.slice(3), hit, hit, line("기절 · 버릴 카드가 없어 피해 1."), death]);
  assert.equal(after.events.length, 180);
  const result = Feedback.describe(before, after);
  assert.equal(result.entries.length, 2); assert.equal(result.damageTotal, 2);
  assert.equal(result.cause, "기절 · 버릴 손패 없음");
});
test("an old death or a previous attack cannot become the cause of a later voluntary visit", () => {
  const before = publicSnapshot(10, false, [line("옛 공격 · 사냥꾼에게 6 피해."), death]);
  const after = publicSnapshot(11, true, [...before.events, line("사냥꾼의 꿈에 입장합니다.")]);
  assert.equal(Feedback.describe(before, after), null);
});
test("unknown future damage wording reports a confirmed death without inventing a cause or amount", () => {
  const before = publicSnapshot(1, false, []), after = publicSnapshot(2, true, [line("향후 효과의 공개 문구"), death]);
  const result = Feedback.describe(before, after);
  assert.equal(result.fatalAmount, null); assert.equal(result.damageTotal, 0); assert.equal(result.entries.length, 0);
  assert.match(result.summary, /체력이 0/);
});
test("reloading the same save, changing hunts or switching hunters cannot replay a notice", () => {
  const before = publicSnapshot(1, false, []), after = publicSnapshot(2, true, [death]);
  for (const change of [{ revision: 1 }, { initialSeed: 8 }, { hunterId: "other" }])
    assert.equal(Feedback.describe(before, { ...after, ...change }), null);
  assert.equal(Feedback.describe(after, after), null);
});
test("snapshots expose only public health and journal data, never combat plans or hidden decks", () => {
  const s = fixture(), view = Feedback.snapshot(s);
  assert.deepEqual(Object.keys(view).sort(), ["events", "hunter", "hunterId", "initialSeed", "revision"]);
  assert.deepEqual(Object.keys(view.hunter).sort(), ["hp", "inDream"]);
  const clone = structuredClone(view); Feedback.describe(view, view); assert.deepEqual(view, clone);
});

const { boot } = require("./helpers/ui-harness.cjs"), MissionFeedback = require("../hunt-mission-feedback.js");
const qaKey = "bloodborne-hunt-qa-v1", normalKey = "bloodborne-hunt-v07";
function qaBeforeLethalAttack() {
  let s = E.create(1061844653, "qa-test-weapon", 0, null, "hunter-pistol", "center",
    { campaign: true, qa: { preset: "fast" } });
  const commands = [
    { type: "MOVE", cardId: "card-9" }, { type: "STEP", node: "tile-14:left" }, { type: "STOP_MOVE" },
    { type: "MOVE", cardId: "card-2" }, { type: "EXPLORE", edge: "W" }, { type: "PLACE_TILE", rotation: 0 }, { type: "STOP_MOVE" },
    { type: "END_TURN" }, { type: "NO_ATTACK" }, { type: "RESOLVE" }, { type: "REFILL" },
    { type: "END_TURN" }, { type: "NO_ATTACK" }, { type: "RESOLVE" }, { type: "ENEMY_STEP", node: "tile-14:left" },
    { type: "REFILL" }, { type: "END_TURN" }, { type: "NO_ATTACK" },
  ];
  for (const command of commands) s = E.dispatch(s, command);
  assert.equal(s.phase, "combat_react"); assert.equal(E.hunter(s).hp, 1);
  assert.deepEqual(E.importSave(E.exportSave(s)), s); return s;
}
function realDeathUI(state = qaBeforeLethalAttack(), windowOverrides = {}) {
  const normal = E.exportSave(E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true })), dispatched = [];
  const ui = boot(state, E.missionView(state), E.rewardsView(state), {
    realInventory: true,
    storage: { [normalKey]: normal, [qaKey]: E.exportSave(state), "bloodborne-hunt-active-mode": "qa" },
    engine: { ...E, applyTileSpeedRuling: s => s,
      dispatch: (s, command) => { dispatched.push(command); return E.dispatch(s, command); } },
    window: { BBHuntDeathFeedback: Feedback, ...windowOverrides },
  });
  assert.equal(ui.el("error").textContent, ""); return { ui, normal, dispatched };
}
function clickUICommand(ui, type) {
  const button = ui.buttons("decisions").find(button => button.dataset.command === type && !button.disabled);
  assert(button, `actual action panel offers ${type}`); button.click(); assert.equal(ui.el("error").textContent, "");
}
test("actual QA RESOLVE opens its death summary before restored Dream play and acknowledgement is a pure UI action", () => {
  const before = qaBeforeLethalAttack(), expected = E.dispatch(before, { type: "RESOLVE" }), { ui, normal, dispatched } = realDeathUI(before);
  assert.equal(ui.el("deathDialog").open, false);
  clickUICommand(ui, "RESOLVE");
  assert.equal(ui.el("deathDialog").open, true); assert.equal(ui.el("missionUpdateDialog").open, false);
  assert.equal(ui.el("deathTitle").textContent, "사냥꾼이 사망했습니다");
  assert.match(ui.el("deathDetails").textContent, /도끼 휘두르기.*피해 2/);
  assert.equal(ui.document.activeElement, ui.el("deathContinue"));
  const saved = ui.storage.get(qaKey), dispatchCount = dispatched.length; assert.deepEqual(E.importSave(saved), expected);
  assert.equal(E.hunter(E.importSave(saved)).hp, 6); assert.equal(ui.storage.get(normalKey), normal);
  assert.equal(E.importSave(saved).commands.length, before.commands.length + 1);
  ui.el("deathContinue").click();
  assert.equal(ui.el("deathDialog").open, false); assert.equal(ui.storage.get(qaKey), saved);
  assert.equal(dispatched.length, dispatchCount); assert.equal(ui.document.activeElement, ui.el("phaseTitle"));
  assert(ui.el("refill") && !ui.el("refill").disabled); ui.el("refill").click();
  const resumed = E.importSave(ui.storage.get(qaKey)); assert.equal(resumed.phase, "return");
  assert.equal(resumed.commands.length, before.commands.length + 2); assert.equal(ui.el("deathDialog").open, false);
});
test("a gameplay click behind the death modal cannot add a command or change either saved hunt", () => {
  const { ui, normal, dispatched } = realDeathUI(); clickUICommand(ui, "RESOLVE");
  const saved = ui.storage.get(qaKey), dispatchCount = dispatched.length, refill = ui.el("refill");
  assert(refill && !refill.disabled); refill.click();
  assert.equal(ui.el("deathDialog").open, true); assert.equal(ui.storage.get(qaKey), saved);
  assert.equal(ui.storage.get(normalKey), normal); assert.equal(dispatched.length, dispatchCount);
});
test("Escape acknowledges the death without spending anything, and reloading that save cannot replay its old summary", () => {
  const { ui, dispatched } = realDeathUI(); clickUICommand(ui, "RESOLVE");
  const saved = ui.storage.get(qaKey), dispatchCount = dispatched.length, cancelled = ui.el("deathDialog").fire("cancel");
  assert.equal(cancelled.defaultPrevented, true); assert.equal(ui.el("deathDialog").open, false);
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(dispatched.length, dispatchCount);
  const resumed = realDeathUI(E.importSave(saved)).ui;
  assert.equal(resumed.el("deathDialog").open, false); assert.equal(resumed.el("missionUpdateDialog").open, false);
  assert.equal(resumed.storage.get(qaKey), saved);
});
test("the death modal precedes a queued public mission notice and both acknowledgements preserve exact saved bytes", () => {
  // This isolates presentation ordering by supplying a same-command public
  // mission notification; the hunt and death still use the real engine replay.
  const notice = { kind: "updated", title: "공개된 임무 변화", description: "변경된 공개 목표를 확인하세요.", effects: [] };
  const { ui, dispatched } = realDeathUI(undefined, { BBHuntMissionFeedback: {
    ...MissionFeedback,
    describe: (before, after, options) => [
      ...MissionFeedback.describe(before, after, options), ...(Feedback.describe(before, after) ? [notice] : []),
    ],
  } });
  clickUICommand(ui, "RESOLVE"); const saved = ui.storage.get(qaKey), dispatchCount = dispatched.length;
  assert.equal(ui.el("deathDialog").open, true); assert.equal(ui.el("missionUpdateDialog").open, false);
  ui.el("openMissionUpdates").click(); assert.equal(ui.el("missionUpdateDialog").open, false);
  ui.el("deathContinue").click();
  assert.equal(ui.el("deathDialog").open, false); assert.equal(ui.el("missionUpdateDialog").open, true);
  assert.match(ui.el("missionUpdateList").textContent, /공개된 임무 변화/);
  assert.equal(ui.storage.get(qaKey), saved); assert.equal(dispatched.length, dispatchCount);
  ui.el("missionUpdateContinue").click();
  assert.equal(ui.el("missionUpdateDialog").open, false); assert.equal(ui.storage.get(qaKey), saved);
  assert.equal(dispatched.length, dispatchCount);
});
