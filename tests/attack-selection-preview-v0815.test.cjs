"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), R = require("../src/rewards-engine"), P = require("../src/hunt-attack-preview");
const { hand } = require("./actual-combat-helper.cjs");
const H = E.hunter, go = (s, type, args = {}) => E.dispatch(s, { type, ...args });

function fixture(id, face = 0, cards = ["strength", "endurance", "vitality"]) {
  const s = E.create(123, id, face, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  s.world.assignments.find(assignment => assignment.enemyId === "huntsman-mob").sideId = "a";
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(s).position, hp: 4 }];
  s.loot = [];
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; s.enemyDiscard = [];
  hand(s, cards); E.assertState(s); return s;
}
function equip(s, kind, slot = 0) {
  const rewardId = R.grant(s, kind);
  return s.rewardChoices.some(choice => choice.rewardId === rewardId) ? go(s, "EQUIP_REWARD", { rewardId, slot }) : s;
}
function nextRound(s) { s = go(s, "END_TURN"); return s.phase === "refill" ? go(s, "REFILL", { discardIds: [] }) : s; }
function item(s, kind) {
  const index = s.consumableDeck.findIndex(item => item.kind === kind);
  assert(index >= 0, kind); const [item] = s.consumableDeck.splice(index, 1); H(s).consumables.push(item); return item.id;
}
function input(s, kind = "strength", slot = 0, extras = {}) {
  const card = H(s).hand.find(card => card.kind === kind); assert(card, kind);
  return { cardId: card.id, slot, ...extras };
}
function compare(s, selection) {
  const before = structuredClone(s), preview = P.view(s, E, selection);
  assert.deepEqual(s, before, "selection must not consume a choice or mutate state");
  assert(preview.ready, preview.reason || preview.requirement);
  const after = go(s, selection.kind || "ATTACK", { enemyId: s.enemies[0].id, ...selection });
  if (preview.willAttack !== false && !preview.fixed) {
    assert(after.combat?.attack, "the real declaration prepared an attack");
    for (const key of ["speed", "damage", "interrupt", "afterAttackHeal", "freeTransform", "healDealt"])
      assert.equal(preview.attack[key], after.combat.attack[key], key);
    assert.equal(preview.attack.interruptEqual, !!after.combat.attack.interruptEqual);
    assert.deepEqual(preview.attack.splash, after.combat.attack.splash);
    assert.equal(preview.hp.afterDeclaration, H(after).hp, "instant healing and self-payment order");
  }
  return { preview, after };
}

test("Chikage's confirmed damage includes the selected self-payment, card, and HP result before revealing any action", () => {
  const s = fixture("chikage"), selection = input(s, "strength", 1, { weaponBoost: "damage" }),
    { preview, after } = compare(s, selection);
  assert.equal(preview.damage, 4); assert.equal(preview.speed, 2);
  assert.deepEqual(preview.formula.damage, { base: 2, card: 1, attachment: 0, reward: 0, item: 0, weapon: 1, total: 4 });
  assert.equal(preview.hp.selfDamage, 1); assert.equal(preview.hp.afterDeclaration, 5);
  assert.equal(H(after).hp, 5); assert.match(P.renderHTML(preview), /무기 1 = <b>4<\/b>/);
  assert.match(P.renderHTML(preview), /자해 1.*체력 6 → <b>5<\/b>/);
  const speed = compare(s, { ...selection, weaponBoost: "speed" }).preview;
  assert.equal(speed.speed, 3); assert.equal(speed.damage, 3);
  const ordinary = compare(s, { ...selection, weaponBoost: "none" }).preview;
  assert.equal(ordinary.damage, 3); assert.equal(ordinary.hp.selfDamage, 0);
});

test("fatal self-payment predicts no attack and does not promise healing from an unexecuted regain", () => {
  const s = fixture("chikage", 0, ["regain", "endurance", "vitality"]); H(s).hp = 1;
  const { preview, after } = compare(s, input(s, "regain", 1, { weaponBoost: "damage" }));
  assert.equal(preview.hp.afterPayment, 0); assert.equal(preview.hp.afterDeclaration, 0);
  assert.equal(preview.willAttack, false); assert.equal(preview.attack.afterAttackHeal, 2);
  assert.match(P.renderHTML(preview), /공격을 실행하기 전에 사망/);
  assert.equal(H(after).inDream, true); assert.equal(after.combat, null);
});

test("a publicly armed unused corruption rune is distinguished from dying to the optional self-payment", () => {
  let s = equip(fixture("chikage"), "rune-corruption"); H(s).hp = 1;
  const rune = H(s).rewards.find(reward => reward.kind === "rune-corruption"); rune.triggerArmed = true;
  const { preview, after } = compare(s, input(s, "strength", 1, { weaponBoost: "damage" }));
  assert.equal(preview.willAttack, true); assert.equal(preview.hp.afterPayment, 0); assert.equal(preview.hp.afterDeclaration, 6);
  assert.equal(preview.hp.preventedBy.id, rune.id); assert.equal(H(after).rewards.find(reward => reward.id === rune.id).ready, false);
  assert.match(P.renderHTML(preview), /타락.*소모.*체력 6/);
});

test("Tonitrus transformation's one remaining charge is included and consumed by the next real attack", () => {
  let s = fixture("tonitrus", 0, ["vitality", "endurance", "strength"]); s.enemies = [];
  s = go(s, "TRANSFORM", { cardId: H(s).hand.find(card => card.kind === "vitality").id });
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(s).position, hp: 4 }];
  const { preview, after } = compare(s, input(s, "endurance", 2));
  assert.equal(preview.speed, 2); assert.equal(preview.damage, 4);
  assert.equal(preview.charge.remainingAttacks, 1); assert.equal(preview.charge.consumedOnThisAttack, true);
  assert.match(P.renderHTML(preview), /충전 1회 남음.*이번 공격에 적용 후 소모.*이번 라운드가 끝나면 만료/);
  assert.equal(H(after).weaponCharge, undefined);
  let later = go(after, "RESOLVE");
  later.enemies = [{ id: "huntsman-mob-2", kind: "huntsman-mob", figure: 2, node: H(later).position, hp: 4 }];
  const second = compare(later, input(later, "strength", 2)).preview;
  assert.equal(second.speed, 1); assert.equal(second.damage, 4); assert.equal(second.charge.remainingAttacks, 0);
});

test("Tonitrus round-end expiration is reflected regardless of the visible electric weapon face", () => {
  let s = fixture("tonitrus", 0, ["vitality", "strength", "skill"]); s.enemies = [];
  s = go(s, "TRANSFORM", { cardId: H(s).hand[0].id }); assert(H(s).weaponCharge);
  s = nextRound(s); assert.equal(H(s).weaponCharge, undefined);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(s).position, hp: 4 }];
  const { preview } = compare(s, input(s, "strength", 2));
  assert.equal(preview.speed, 1); assert.equal(preview.damage, 4); assert.equal(preview.charge.active, false);
  assert.match(P.renderHTML(preview), /충전 보너스 없음/);
});

test("beast claw adds one speed and damage at HP one through three, including the reported HP-two vigor case", () => {
  for (const hp of [1, 2, 3, 4, 6]) {
    const s = fixture("beast-claw"); H(s).hp = hp;
    const { preview } = compare(s, input(s, "vitality", 1));
    assert.equal(preview.speed, hp <= 3 ? 3 : 2); assert.equal(preview.damage, hp <= 3 ? 3 : 2);
    assert.equal(preview.formula.damage.weapon, hp <= 3 ? 1 : 0);
  }
});

test("immediate card healing precedes the claw threshold while tear attachment healing follows it", () => {
  let s = fixture("beast-claw", 0, ["energized", "strength", "vitality"]); H(s).hp = 3;
  const ordinary = compare(s, input(s, "energized", 1)).preview;
  assert.equal(ordinary.hp.afterCard, 4); assert.equal(ordinary.formula.damage.weapon, 0);
  s = equip(s, "tear-gem", 1);
  const tear = compare(s, input(s, "vitality", 1)).preview;
  assert.equal(tear.hp.afterCard, 3); assert.equal(tear.hp.afterDeclaration, 4); assert.equal(tear.formula.damage.weapon, 1);
});

test("rifle-spear counts two real MOVE declarations despite each covering a different number of cells", () => {
  let s = fixture("rifle-spear", 1, ["endurance", "skill", "vitality", "strength"]); s.enemies = [];
  s = go(s, "MOVE", { cardId: H(s).hand[0].id });
  s = go(s, "STEP", { node: "tile-14:left" }); s = go(s, "STEP", { node: "tile-14:center" });
  assert.equal(s.phase, "hunter", "two steps finish the first MOVE automatically");
  s = go(s, "MOVE", { cardId: H(s).hand[0].id }); s = go(s, "STEP", { node: "tile-14:right" }); s = go(s, "STOP_MOVE");
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(s).position, hp: 4 }];
  const { preview } = compare(s, input(s, "vitality", 0));
  assert.equal(preview.damage, 4); assert.equal(preview.moveActions, 2);
  assert.match(P.renderHTML(preview), /이동 행동 2회.*이동한 칸 수와 별도로/);
});

test("rifle movement bonus persists for subsequent attacks and resets at the actual next round", () => {
  let s = fixture("rifle-spear", 1); H(s).moveActionsRound = 3;
  const first = compare(s, input(s, "endurance", 0)); assert.equal(first.preview.damage, 5);
  s = go(first.after, "RESOLVE");
  s.enemies = [{ id: "huntsman-mob-2", kind: "huntsman-mob", figure: 2, node: H(s).position, hp: 4 }];
  assert.equal(compare(s, input(s, "strength", 0)).preview.damage, 6);
  s.enemies = []; s = nextRound(s);
  s.enemies = [{ id: "huntsman-mob-2", kind: "huntsman-mob", figure: 2, node: H(s).position, hp: 4 }];
  assert.equal(compare(s, input(s, "strength", 0)).preview.formula.damage.weapon, 0);
});

test("the legacy public round-count object is interpreted by the same weapon rules helper", () => {
  const s = fixture("rifle-spear", 1); H(s).moveActionsRound = { round: s.round, count: 2 };
  assert.equal(compare(s, input(s)).preview.damage, 5);
  H(s).moveActionsRound.round = s.round - 1;
  assert.equal(compare(s, input(s)).preview.damage, 3);
});

test("card, attached chunk, two attack rewards and two consumables produce the same totals as ATTACK", () => {
  let s = fixture("rifle-spear", 1, ["nimble", "endurance", "vitality"]);
  for (const kind of ["bloodstone-chunk", "rune-hunter", "empty-shell"]) s = equip(s, kind);
  H(s).moveActionsRound = 2;
  const itemIds = [item(s, "fire-paper"), item(s, "bolt-paper")],
    rewardIds = H(s).rewards.filter(reward => ["rune-hunter", "empty-shell"].includes(reward.kind)).map(reward => reward.id),
    { preview } = compare(s, input(s, "nimble", 0, { itemIds, rewardIds }));
  assert.equal(preview.speed, 7); assert.equal(preview.damage, 8);
  assert.deepEqual(preview.formula.damage, { base: 2, card: 1, attachment: 1, reward: 1, item: 1, weapon: 2, total: 8 });
  assert.equal(preview.attack.freeTransform, true);
});

test("two equipped permanent attachments are counted once each and only on their current slot", () => {
  let s = fixture("rifle-spear", 1);
  s = equip(s, "bloodstone-shard", 0); s = equip(s, "bloodstone-chunk", 0);
  assert.equal(compare(s, input(s, "strength", 0)).preview.damage, 5);
  const other = compare(s, input(s, "strength", 1)).preview;
  assert.equal(other.formula.damage.attachment, 0); assert.equal(other.formula.speed.attachment, 0);
  const rune = R.grant(s, "rune-writhe");
  const stagger = compare(s, input(s, "strength", 0, { rewardIds: [rune] })).preview;
  assert.equal(stagger.attack.interrupt, true); assert.equal(stagger.attack.interruptEqual, true);
});

test("clawmark replacement suppresses card speed, damage, healing, and clearing before weapon evaluation", () => {
  let s = equip(fixture("beast-claw", 0, ["energized", "nimble", "endurance"]), "rune-clawmark"); H(s).hp = 3;
  const rewardIds = [H(s).rewards[0].id], energized = compare(s, input(s, "energized", 1, { rewardIds })).preview;
  assert.equal(energized.hp.afterCard, 3); assert.equal(energized.damage, 4); assert.equal(energized.attack.interrupt, true);
  const nimble = compare(s, input(s, "nimble", 1, { rewardIds })).preview;
  assert.equal(nimble.formula.speed.card, 0); assert.equal(nimble.formula.damage.card, 0);
  const endurance = compare(s, input(s, "endurance", 1, { rewardIds })).after;
  assert.equal(H(endurance).slots[1].kind, "endurance");
});

test("mercy combo counts the just-placed card, but excludes an immediately cleared card", () => {
  const s = fixture("blade-of-mercy", 1, ["strength", "endurance", "vitality"]);
  const card = H(s).hand.find(card => card.kind === "vitality"), at = H(s).hand.indexOf(card); H(s).hand.splice(at, 1); H(s).slots[0] = card;
  assert.equal(compare(s, input(s, "strength", 2)).preview.formula.damage.weapon, 2);
  assert.equal(compare(s, input(s, "endurance", 2)).preview.formula.damage.weapon, 1);
});

test("the cane's equal-speed exception appears only in the correct face's attack context", () => {
  for (const face of [0, 1]) {
    const s = fixture("threaded-cane", face, ["skill", "strength", "vitality"]),
      { preview, after } = compare(s, input(s, "skill", 1));
    assert.equal(preview.attack.interruptEqual, face === 1);
    if (face === 1) {
      assert.match(P.renderHTML(preview), /같은 속도에서도 방해/);
      assert.equal(after.combat.attack.speed, after.combat.action.speed);
      assert.equal(H(go(after, "RESOLVE")).hp, 6);
    } else assert.doesNotMatch(P.renderHTML(preview), /같은 속도에서도 방해/);
  }
  const noStagger = compare(fixture("threaded-cane", 1), input(fixture("threaded-cane", 1), "strength", 1)).preview;
  assert.match(P.renderHTML(noStagger), /현재 선택에는 방해 효과가 없습니다/);
  assert.equal(P.view(fixture("threaded-cane", 1), E, { kind: "FIREARM" }), null, "a cannon must not inherit a card attack label");
});

test("Reiter's named slot is fixed damage and ignores every card, attachment and selected attack bonus", () => {
  let s = fixture("reiterpallasch", 1, ["nimble", "strength", "vitality"]);
  for (const kind of ["bloodstone-shard", "bloodstone-chunk", "rune-clawmark"]) s = equip(s, kind, 1);
  const selection = input(s, "nimble", 1, { kind: "WEAPON_SHOT", itemIds: [item(s, "fire-paper")], rewardIds: [H(s).rewards.at(-1).id] }),
    before = structuredClone(s), preview = P.view(s, E, selection);
  assert.equal(preview.ready, true); assert.equal(preview.damage, 2); assert.equal(preview.speed, null);
  assert.equal(preview.attack, null); assert.equal(preview.suppressedCardEffects, true);
  assert.match(P.renderHTML(preview), /고정 피해 2/); assert.match(P.renderHTML(preview), /카드 효과·슬롯 피해·부착 강화·무기 공격 보정 미적용/);
  assert.deepEqual(s, before);
  const actual = go(s, "WEAPON_SHOT", { enemyId: s.enemies[0].id, cardId: selection.cardId, slot: 1 });
  assert.equal(actual.enemies[0].hp, 2); assert.equal(H(actual).slots[1].faceDown, true); assert.equal(actual.enemyDiscard.length, 0);
  assert.equal(H(actual).rewards.at(-1).ready, true); assert.equal(H(actual).consumables.length, 1);
  assert.equal(P.view(s, E, { ...selection, slot: 0 }).ready, false);
});

test("rifle entry costs a face-down card but never displays normal attack damage or card effects as applied", () => {
  let s = fixture("rifle-spear", 0); s.enemies[0].node = "tile-14:left"; s = go(s, "END_TURN");
  assert.equal(s.phase, "weapon_entry");
  const selection = input(s, "strength", 1, { kind: "ENTRY_WEAPON" }), preview = P.view(s, E, selection),
    actual = go(s, "ENTRY_WEAPON", { cardId: selection.cardId, slot: selection.slot, accept: true });
  assert.equal(preview.damage, 2); assert.equal(actual.enemies[0].hp, 2); assert.equal(H(actual).slots[1].faceDown, true);
  assert.equal(actual.enemyDiscard.length, 0); assert.doesNotMatch(P.renderHTML(preview), /속도|카드 1 =/);
});

test("incomplete, occupied and invalid choices remain explanatory without inventing final attack values", () => {
  const s = fixture("chikage"), selection = input(s);
  assert.equal(P.view(s, E, {}).ready, false);
  assert.match(P.renderHTML(P.view(s, E, {})), /손패 1장과 빈 공격 슬롯을 선택/);
  assert.equal(P.view(s, E, { ...selection, slot: "0" }).ready, false);
  assert.equal(P.view(s, E, { ...selection, weaponBoost: "both" }).ready, false);
  assert.equal(P.view(s, E, { ...selection, rewardIds: ["missing"] }).ready, false);
  assert.equal(P.view(s, E, { ...selection, itemIds: ["missing"] }).ready, false);
  H(s).slots[0] = H(s).hand.pop(); assert.equal(P.view(s, E, selection).ready, false);
});

test("all supplied weapon faces and every empty slot match actual ATTACK for strength, skill and clearing endurance cards", () => {
  const weapons = require("../src/extended-weapons").weapons;
  let declarations = 0;
  for (const weapon of Object.values(weapons)) for (const face of [0, 1])
    for (const slot of weapon.faces[face].slots.keys()) for (const kind of ["strength", "skill", "endurance"]) {
      const state = fixture(weapon.id, face, ["strength", "skill", "endurance"]), selection = input(state, kind, slot);
      try { compare(state, selection); }
      catch (error) { error.message = `${weapon.id}/${face}/slot${slot}/${kind}: ${error.message}`; throw error; }
      declarations++;
    }
  assert.equal(declarations, 237);
});

test("a frozen public state with explosive hidden-deck and dispatcher getters can still produce the same public preview", () => {
  const s = fixture("beast-claw"); H(s).hp = 2;
  for (const key of ["enemyDeck", "enemyDiscard", "consumableDeck", "upgradeDeck", "rng", "history", "events", "enemies"])
    Object.defineProperty(s, key, { get() { throw Error(`hidden ${key}`); }, configurable: true });
  for (const key of ["deck", "discard"]) Object.defineProperty(H(s), key, { get() { throw Error(`hidden ${key}`); } });
  const safeEngine = { hunter: E.hunter, card: E.card, weaponFace: E.weaponFace, slots: E.slots,
    get dispatch() { throw Error("dispatch forbidden"); }, get importSave() { throw Error("import forbidden"); } };
  Object.freeze(H(s).slots); Object.freeze(H(s).hand); Object.freeze(H(s)); Object.freeze(s);
  const selection = Object.freeze(input(s, "vitality", 1)), preview = P.view(s, safeEngine, selection);
  assert.equal(preview.speed, 3); assert.equal(preview.damage, 3);
  assert.doesNotMatch(JSON.stringify(preview), /enemyDeck|enemyDiscard|rng|hidden|huntsman/);
});
