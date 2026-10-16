"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const E = require("../src/hunt-engine"), manifest = require("./fixtures/weapon-campaign-completion/manifest.json");
const H = E.hunter, go = (state, type, args = {}) => E.dispatch(state, { type, ...args });
const hash = state => crypto.createHash("sha256").update(E.exportSave(state)).digest("hex");
const shard = state => H(state).rewards.find(reward => reward.kind === "bloodstone-shard");
function exact(state) {
  const saved = E.exportSave(state);
  assert.equal(E.exportSave(E.importSave(saved)), saved);
}
function currentBoundary() {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true });
  for (const command of require("./fixtures/chapter-one-v8-commands.json")) state = E.dispatch(state, command);
  return go(state, "ENTER_BETWEEN_CHAPTERS");
}
const current = currentBoundary(), boundaries = new Map();
function boundary(weapon, completedChapter) {
  if (!boundaries.has(weapon)) {
    const fixture = manifest.cases.find(item => item.weaponId === weapon), found = new Map();
    let state = E.create(fixture.seed, weapon, fixture.startFace, null, fixture.initialFirearmId,
      fixture.startSpace, { campaign: true, rulesVersion: fixture.rulesVersion });
    for (const command of require("./fixtures/weapon-campaign-completion/" + fixture.commandsFile)) {
      if (command.type === "START_NEXT_CHAPTER") {
        found.set(state.mission.chapter, state);
        if (state.mission.chapter === 2) break;
      }
      state = E.dispatch(state, command);
    }
    boundaries.set(weapon, found);
  }
  return boundaries.get(weapon).get(completedChapter);
}

test("old chapter-start commands retain their recorded rules14 bytes with the attachment window closed", () => {
  // Captured before the dev.25 change from this committed public-command trace.
  assert.equal(hash(current), "e0fb31c49629ab57eae28328b38cb049fd7367dde651d30a16e7bc4450190074");
  for (const [face, expected] of [[0, "5ef149f1a2febe949cda55d72160dab4a4363f652f9f411db8b8d2c0640d511c"],
    [1, "1e3c57174c3304e35453369d75812b451c842240ee3fcbd7d2e778f0682be829"]]) {
    const after = go(current, "START_NEXT_CHAPTER", { startSpace: "center", face });
    assert.equal(hash(after), expected);
    assert.equal(H(after).rewardTransformWindow, false); exact(after);
  }
  exact(current);
});

for (const completedChapter of [1, 2]) test(`explicit other-face chapter ${completedChapter + 1} start opens only attachment reassignment`, () => {
  const before = completedChapter === 1 ? current : boundary("burial", 2), saved = E.exportSave(before),
    args = { startSpace: "right", face: 1 - H(before).face },
    legacy = go(before, "START_NEXT_CHAPTER", args),
    after = go(before, "START_NEXT_CHAPTER", { ...args, reassignAttachments: true }), expected = structuredClone(legacy);
  H(expected).rewardTransformWindow = true;
  expected.commands[expected.commands.length - 1].reassignAttachments = true;
  assert.deepEqual(after, expected, "no extra card, RNG, track, spawn, firearm or weapon-charge effect is added");
  assert.equal(E.exportSave(before), saved);
  assert(E.rewardsView(after).rewards.find(reward => reward.id === shard(after).id).reassignable);
  const slot = (shard(after).slot + 1) % E.slots(after).length,
    moved = go(after, "REASSIGN_REWARD", { rewardId: shard(after).id, slot });
  assert.equal(shard(moved).slot, slot);
  assert.deepEqual(H(moved).hand, H(after).hand); assert.equal(moved.rng, after.rng);
  assert.equal(moved.round, 1); assert.equal(moved.track, 1);
  assert.equal(H(moved).rewards.filter(reward => reward.equipped).length,
    H(after).rewards.filter(reward => reward.equipped).length);
  exact(after); exact(moved);
});

test("a same-face or explicitly declined chapter start does not create a free attachment timing", () => {
  for (const face of [H(current).face, 1 - H(current).face]) {
    const after = go(current, "START_NEXT_CHAPTER", { startSpace: "left", face, reassignAttachments: false });
    assert.equal(H(after).rewardTransformWindow, false);
    assert(!E.rewardsView(after).rewards.some(reward => reward.reassignable)); exact(after);
  }
});

test("invalid chapter reassignment flags and a claimed same-face transform fail without changing the original save", () => {
  const saved = E.exportSave(current), base = { startSpace: "center", face: 1 - H(current).face };
  for (const reassignAttachments of [null, 1, "true", {}, []])
    assert.throws(() => go(current, "START_NEXT_CHAPTER", { ...base, reassignAttachments }), /재배치/);
  assert.throws(() => go(current, "START_NEXT_CHAPTER", {
    startSpace: "center", face: H(current).face, reassignAttachments: true,
  }), /반대 면/);
  assert.equal(E.exportSave(current), saved);
});

test("a shrinking chapter-start weapon repairs an invalid gem slot before optional reassignment", () => {
  let before = boundary("kirkhammer", 2);
  assert.equal(H(before).face, 0); assert.equal(E.slots(before).length, 3);
  before = go(before, "KEEP_REWARD", { rewardId: shard(before).id });
  before = go(before, "EQUIP_REWARD", { rewardId: shard(before).id, slot: 2 });
  const after = go(before, "START_NEXT_CHAPTER", { startSpace: "center", face: 1, reassignAttachments: true });
  assert.equal(E.slots(after).length, 2); assert.equal(H(after).rewardTransformWindow, true);
  assert.deepEqual(after.rewardChoices, [{ rewardId: shard(after).id, reason: "slot" }]);
  assert.equal(shard(after).equipped, false);
  assert.throws(() => go(after, "REASSIGN_REWARD", { rewardId: shard(after).id, slot: 0 }), /선택/);
  const repaired = go(after, "EQUIP_REWARD", { rewardId: shard(after).id, slot: 1 });
  assert.equal(repaired.rewardChoices.length, 0); assert.equal(H(repaired).rewardTransformWindow, true);
  const moved = go(repaired, "REASSIGN_REWARD", { rewardId: shard(repaired).id, slot: 0 });
  assert.equal(shard(moved).slot, 0); exact(after); exact(moved);
});

test("the optional chapter-start window closes on the next normal action", () => {
  const after = go(current, "START_NEXT_CHAPTER", {
    startSpace: "center", face: 1 - H(current).face, reassignAttachments: true,
  }), moving = go(after, "MOVE", { cardId: H(after).hand[0].id });
  assert.equal(moving.phase, "move"); assert.equal(H(moving).rewardTransformWindow, false);
  assert.throws(() => go(moving, "REASSIGN_REWARD", { rewardId: shard(moving).id, slot: 0 }), /변형한 직후/);
  exact(moving);
});

test("choosing Tonitrus's other chapter-start face does not activate its paid-transform charge", () => {
  const before = boundary("tonitrus", 1), after = go(before, "START_NEXT_CHAPTER", {
    startSpace: "center", face: 1 - H(before).face, reassignAttachments: true,
  });
  assert.equal(H(after).rewardTransformWindow, true);
  assert.equal(H(after).weaponCharge, undefined); exact(after);
});
