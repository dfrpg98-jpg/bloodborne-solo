const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), Training = require("../engine"),
  M = require("../chapter-engine"), R = require("../rewards-engine"),
  C = require("../components/cards.json"),
  commands = require("./fixtures/chapter-one-commands.json"),
  { choose } = require("./hunt-playthrough-helper.cjs");
const H = E.hunter, go = (s, type, args = {}) => E.dispatch(s, { type, ...args });
function give(s, kind) {
  const index = s.consumableDeck.findIndex((item) => item.kind === kind);
  assert(index >= 0); const item = s.consumableDeck.splice(index, 1)[0];
  H(s).consumables.push(item); return item.id;
}
function church(startingItem = null) {
  let s = E.create(33, "burial", 0, startingItem, "hunter-pistol", "center", { campaign: true });
  assert.equal(s.world.tileDeck[0], "tile-07");
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "EXPLORE", { edge: "N" });
  s = go(s, "PLACE_TILE", { rotation: M.placementOptions(s.world,
    s.world.pending.tileId, s.world.pending.anchor)[0] });
  s = go(s, "STEP", { node: "tile-07:middle" });
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: "tile-07:top" });
  return go(s, "STOP_MOVE");
}
function exchange(s, args = {}) {
  return go(s, "INTERACT", { cardId: H(s).hand[0]?.id, exchange: true,
    exchangeItemId: H(s).consumables[0]?.id, ...args });
}
function retaliator(s) {
  s.world.assignments.find((a) => a.enemyId === "huntsman-mob").sideId = "a";
  s.enemies.push({ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1,
    hp: 4, node: H(s).position });
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
}
function resolveInteraction(s) {
  while (s.interaction && s.phase !== "exchange_choice") {
    assert(["combat_react", "stun", "combat_extra", "ability_choice"].includes(s.phase));
    s = go(s, s.phase === "combat_react" ? "RESOLVE" :
      s.phase === "combat_extra" ? "EXTRA_TAKE" :
      s.phase === "stun" ? "STUN_DISCARD" : "ABILITY_CHOICE",
      { cardId: H(s).hand[0]?.id });
  }
  return s;
}
function boneFixture() {
  const s = E.create(90, "burial", 1, "bone-ash", "hunter-pistol", "center", { campaign: true });
  const lantern = R.grant(s, "lantern"), eye = R.grant(s, "rune-eye");
  H(s).rewards.find((r) => r.id === lantern).ready = false;
  H(s).rewards.find((r) => r.id === eye).ready = false;
  return { s, lantern, eye, itemId: H(s).consumables[0].id };
}
const useBone = ({ s, itemId }, rewardId) => go(s, "USE_CONSUMABLE", { itemId, rewardId });

test("chapel exchanges one held consumable without activating its printed effect and keeps supply", () => {
  for (const kind of ["coldblood", "hunters-bell", "molotov"]) {
    const s = church(), itemId = give(s, kind), before = structuredClone(s);
    const result = exchange(s, { exchangeItemId: itemId });
    assert.equal(H(result).echoes, 1);
    assert.equal(H(result).consumables.length, 0);
    assert(result.consumableDiscard.some((x) => x.id === itemId));
    assert.equal(H(result).hand.length, H(s).hand.length - 1);
    assert.equal(result.enemies.length, 0);
    assert.deepEqual(s, before); E.assertState(result);
  }
});

test("chapel exchange is restricted to its named space and invalid costs are atomic", () => {
  const valid = church("blood-vial");
  assert.equal(E.interactionOptions(valid).workshop, true);
  for (const node of ["tile-07:middle", "tile-07:bottom", "tile-14:center"]) {
    const s = structuredClone(valid); H(s).position = node;
    assert.equal(E.interactionOptions(s).workshop, false);
    const before = structuredClone(s);
    assert.throws(() => exchange(s), /명칭 칸/); assert.deepEqual(s, before);
  }
  for (const exchangeItemId of [undefined, "foreign-item"]) {
    const before = structuredClone(valid);
    assert.throws(() => exchange(valid, { exchangeItemId }), /보유 소모품/);
    assert.deepEqual(valid, before);
  }
  assert.throws(() => exchange(valid, { exchangeAfterLoot: true }), /토큰/);
});

test("chapel combines two loot tokens and exchange for one stat card and caps echoes at three", () => {
  const s = church("blood-vial"), itemId = H(s).consumables[0].id;
  H(s).echoes = 3;
  const result = exchange(s, { lootCount: 2 });
  assert.equal(H(result).echoes, 3);
  assert.equal(H(result).consumables.length, 2);
  assert.equal(E.interactionOptions(result).loot, 0);
  assert.equal(H(result).hand.length, H(s).hand.length - 1);
  assert(result.consumableDiscard.some((x) => x.id === itemId)); E.assertState(result);
});

test("chapel retaliation precedes all effects and surviving it spends the selected item once", () => {
  const s = church("blood-vial"), itemId = H(s).consumables[0].id;
  retaliator(s); let result = exchange(s, { lootCount: 2 });
  assert.equal(result.phase, "combat_react");
  assert.equal(H(result).consumables[0].id, itemId);
  assert.equal(H(result).echoes, 0); assert.equal(E.interactionOptions(result).loot, 2);
  assert.throws(() => go(result, "DODGE", { cardId: H(result).hand[0]?.id, slot: 0 }));
  result = resolveInteraction(result);
  assert.equal(H(result).echoes, 1); assert.equal(H(result).consumables.length, 2);
  assert.equal(result.consumableDiscard.filter((x) => x.id === itemId).length, 1);
  assert.equal(result.interaction, null); E.assertState(result);
});

test("death during chapel retaliation preserves held consumables and unopened loot in both exchange modes", () => {
  for (const afterLoot of [false, true]) {
    const s = church("blood-vial"), itemId = H(s).consumables[0].id;
    H(s).hp = 1; retaliator(s);
    let result = exchange(s, { lootCount: 2, ...(afterLoot ? { exchangeAfterLoot: true } : {}) });
    result = go(result, "RESOLVE");
    assert.equal(H(result).inDream, true);
    assert(H(result).consumables.some((x) => x.id === itemId));
    assert.equal(result.consumableDiscard.length, 0);
    assert.equal(result.loot.filter((n) => n === "tile-07:top").length, 2);
    assert.equal(result.interaction, null); E.assertState(result);
  }
});

test("chapel can exchange a newly drawn item with no prior inventory and replay pending and final choices", () => {
  const s = church(); assert.equal(H(s).consumables.length, 0);
  let result = exchange(s, { lootCount: 2, exchangeAfterLoot: true });
  assert.equal(result.phase, "exchange_choice"); assert.equal(H(result).consumables.length, 2);
  assert.equal(H(result).echoes, 0); assert.equal(H(result).hand.length, H(s).hand.length - 1);
  assert.deepEqual(E.importSave(E.exportSave(result)), result);
  const itemId = H(result).consumables[0].id, before = structuredClone(result);
  assert.throws(() => go(result, "EXCHANGE_CHOICE", { itemId: "foreign" }), /보유 소모품/);
  assert.deepEqual(result, before);
  result = go(result, "EXCHANGE_CHOICE", { itemId });
  assert.equal(result.phase, "hunter"); assert.equal(H(result).consumables.length, 1);
  assert.equal(H(result).echoes, 1); assert.equal(result.interaction, null);
  assert.equal(H(result).hand.length, H(s).hand.length - 1);
  assert.deepEqual(E.importSave(E.exportSave(result)), result);
  assert.throws(() => go(result, "EXCHANGE_CHOICE", { itemId }), /현재 단계/);
});

test("chapel post-loot exchange can be declined even when the supply cannot yield an item", () => {
  let s = church(); H(s).consumables.push(...s.consumableDeck); s.consumableDeck = [];
  let result = exchange(s, { lootCount: 2, exchangeAfterLoot: true });
  assert.equal(result.phase, "exchange_choice"); assert.equal(H(result).consumables.length, 36);
  result = go(result, "EXCHANGE_CHOICE", { skip: true });
  assert.equal(H(result).consumables.length, 36); assert.equal(H(result).echoes, 0);
  assert.equal(result.phase, "hunter"); assert.equal(E.interactionOptions(result).loot, 0);
  E.assertState(result);
  s = exchange(church(), { lootCount: 1, exchangeAfterLoot: true });
  result = go(s, "EXCHANGE_CHOICE", { skip: true });
  assert.deepEqual(E.importSave(E.exportSave(result)), result);
});

test("chapel post-loot choice opens only after surviving enemy retaliation", () => {
  const s = church(); retaliator(s);
  let result = exchange(s, { lootCount: 2, exchangeAfterLoot: true });
  assert.equal(result.phase, "combat_react"); assert.equal(H(result).consumables.length, 0);
  assert.throws(() => go(result, "EXCHANGE_CHOICE", { skip: true }), /현재 단계/);
  result = resolveInteraction(result);
  assert.equal(result.phase, "exchange_choice"); assert.equal(H(result).consumables.length, 2);
  result = go(result, "EXCHANGE_CHOICE", { itemId: H(result).consumables[0].id });
  assert.equal(H(result).echoes, 1); assert.equal(H(result).consumables.length, 1);
});

test("chapel trade can recur in later turns and its direct exchange command replays exactly", () => {
  let s = exchange(church("blood-vial"), { lootCount: 2 });
  assert.equal(H(s).echoes, 1);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
  s = go(s, "END_TURN"); s = go(s, "REFILL");
  const before = H(s).hand.length;
  s = exchange(s);
  assert.equal(H(s).echoes, 2); assert.equal(H(s).hand.length, before - 1);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});

test("chapel discarded cost can be redrawn when combined loot exhausts the deck", () => {
  const s = church("blood-vial"), itemId = H(s).consumables[0].id;
  H(s).consumables.push(...s.consumableDeck); s.consumableDeck = [];
  const result = exchange(s, { lootCount: 1, exchangeItemId: itemId });
  assert.equal(H(result).echoes, 1);
  assert.equal(H(result).consumables.length, 36);
  assert(H(result).consumables.some((x) => x.id === itemId));
  assert.equal(result.consumableDiscard.length, 0);
  assert.equal(result.consumableDeck.length, 0); E.assertState(result);
});

test("bone ash readies exactly one chosen equipped exhausted tool or rune and costs no stat card", () => {
  for (const selected of ["lantern", "eye"]) {
    const f = boneFixture(), before = structuredClone(f.s), result = useBone(f, f[selected]);
    assert.equal(H(result).rewards.find((r) => r.id === f[selected]).ready, true);
    assert.equal(H(result).rewards.find((r) => r.id === f[selected === "eye" ? "lantern" : "eye"]).ready, false);
    assert.deepEqual(H(result).hand, H(f.s).hand); assert.deepEqual(H(result).discard, H(f.s).discard);
    assert.equal(H(result).consumables.length, 0);
    assert.equal(result.consumableDiscard.filter((x) => x.id === f.itemId).length, 1);
    assert.deepEqual(f.s, before); E.assertState(result);
  }
});

test("bone ash rejects ready, stored, persistent, foreign, absent and firearm targets without consumption", () => {
  for (const state of ["ready", "stored", "persistent", "foreign", "absent", "firearm"]) {
    const f = boneFixture(); let target = f.lantern;
    const reward = H(f.s).rewards.find((r) => r.id === target);
    if (state === "ready") reward.ready = true;
    if (state === "stored") reward.equipped = false;
    if (state === "persistent") {
      target = R.grant(f.s, "bloodstone-shard");
      f.s = go(f.s, "EQUIP_REWARD", { rewardId: target, replaceId: f.lantern, slot: 0 });
      H(f.s).rewards.find((r) => r.id === target).ready = false;
    }
    if (state === "foreign") target = "reward-foreign";
    if (state === "absent") target = undefined;
    if (state === "firearm") target = "hunter-pistol";
    const before = structuredClone(f.s);
    assert.throws(() => useBone(f, target), /소진된 장착 보상/); assert.deepEqual(f.s, before);
  }
});

test("bone ash cannot be spent during movement, interaction reactions, or reward-free modes", () => {
  const f = boneFixture(), moving = go(f.s, "MOVE", { cardId: H(f.s).hand[0].id });
  assert.throws(() => useBone({ ...f, s: moving }, f.lantern), /현재 단계/);
  let reaction = church("bone-ash"); retaliator(reaction);
  reaction = exchange(reaction, { lootCount: 1 });
  assert.throws(() => go(reaction, "USE_CONSUMABLE", { itemId: f.itemId, rewardId: f.lantern }), /현재 단계/);
  const standalone = E.create(90, "burial", 1, "bone-ash"), original = structuredClone(standalone);
  assert.throws(() => go(standalone, "USE_CONSUMABLE", { itemId: H(standalone).consumables[0].id }), /긴 사냥/);
  assert.deepEqual(standalone, original);
  const training = Training.create(90, "burial", 1, "bone-ash"), copy = structuredClone(training);
  assert.throws(() => Training.dispatch(training, { type: "USE_CONSUMABLE",
    itemId: Training.hunter(training).consumables[0].id }), /전투 연습/);
  assert.deepEqual(training, copy);
});

test("bone ash metadata enables existing instances without changing raw text, counts or the 36-card pool", () => {
  const definition = C.cards.find((c) => c.id === "bone-ash");
  assert.equal(definition.runtime, "playable"); assert.equal(definition.count, 2);
  assert.equal(definition.rawRules, "보상카드1장을 준비합니다.");
  const s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true });
  const id = give(s, "bone-ash"), rewardId = R.grant(s, "lantern");
  H(s).rewards[0].ready = false;
  assert.deepEqual(H(s).consumables[0], { id, kind: "bone-ash" });
  const result = go(s, "USE_CONSUMABLE", { itemId: id, rewardId });
  assert.equal(H(result).rewards[0].ready, true); E.assertState(result);
});

test("a v0.6.1 save with a naturally looted pending bone ash imports unchanged and needs no migration", () => {
  const legacy = require("./fixtures/v061-owned-bone-ash-save.json");
  const s = E.importSave(JSON.stringify(legacy));
  assert.deepEqual(s, legacy.state);
  const item = H(s).consumables.find((c) => c.kind === "bone-ash"); assert(item);
  assert.deepEqual(Object.keys(item).sort(), ["id", "kind"]);
  // Reward setup is isolated here; the separate natural lantern test validates
  // the full command history including earning, exhausting and readying a reward.
  const rewardId = R.grant(s, "lantern"); H(s).rewards[0].ready = false;
  const result = go(s, "USE_CONSUMABLE", { itemId: item.id, rewardId });
  assert.equal(H(result).rewards[0].ready, true);
  assert(result.consumableDiscard.some((c) => c.id === item.id)); E.assertState(result);
});

test("new bone ash use with a naturally earned and exhausted lantern saves by exact command replay", () => {
  let s = E.create(90, "burial", 1, "bone-ash", "hunter-pistol", "center", { campaign: true });
  for (const command of commands.slice(0, 17)) s = E.dispatch(s, command);
  s = go(s, "MOVE", { cardId: H(s).hand.find((c) => c.kind === "skill").id });
  s = go(s, "STEP", { node: "tile-04:center" }); s = go(s, "STOP_MOVE");
  s = go(s, "ATTACK", { cardId: H(s).hand.find((c) => c.kind === "strength").id,
    enemyId: "huntsman-mob-1", slot: 1 });
  while (s.phase !== "hunter") s = E.dispatch(s, choose(s));
  for (let i = 0; i < 50 && !H(s).rewards.length; i++) {
    let command = choose(s);
    if (s.phase === "hunter") {
      const h = H(s), foe = s.enemies.find((e) => e.node === h.position);
      const slot = h.slots.findIndex((x) => !x);
      command = h.hand.length && foe && slot >= 0 ? { type: "ATTACK",
        cardId: (h.hand.find((c) => c.kind === "strength") || h.hand[0]).id,
        enemyId: foe.id, slot } : { type: "END_TURN" };
    }
    s = E.dispatch(s, command);
  }
  assert(H(s).rewards.length);
  while (s.rewardChoices.length) s = go(s, "KEEP_FIREARM", { firearmId: s.rewardChoices[0].firearmId });
  assert.equal(s.phase, "hunter");
  const rewardId = H(s).rewards.find((r) => r.kind === "lantern").id;
  s = go(s, "USE_REWARD", { rewardId, node: "tile-14:center" });
  assert.equal(H(s).rewards.find((r) => r.id === rewardId).ready, false);
  const itemId = H(s).consumables.find((x) => x.kind === "bone-ash").id;
  s = go(s, "USE_CONSUMABLE", { itemId, rewardId });
  assert.equal(H(s).rewards.find((r) => r.id === rewardId).ready, true);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});

test("pre-existing chapter-one commands and a pending rescue interaction still replay without new fields", () => {
  let s = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 7 });
  for (const command of commands.slice(0, 71)) s = E.dispatch(s, command);
  s = go(s, "INTERACT", { cardId: H(s).hand[0].id, mission: "rescue", lootCount: 2 });
  assert(s.interaction); assert.equal(s.interaction.exchange, false);
  assert.equal(Object.hasOwn(s.interaction, "exchangeAfterLoot"), false);
  assert.equal(Object.hasOwn(s.interaction, "exchangeItemId"), false);
  assert.deepEqual(E.importSave(E.exportSave(s)), s);
});
