"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), W = require("../src/extended-weapons"), P = require("../src/hunt-public-text"),
  Controls = require("../src/hunt-combat-controls"), { Document } = require("./helpers/ui-harness.cjs"),
  { hand } = require("./actual-combat-helper.cjs");
const H = E.hunter, clean = text => P.clean(text, "combat"), go = (state, type, args = {}) => E.dispatch(state, { type, ...args });

// These are isolated rule/presentation fixtures, not a claimed campaign playthrough.
function fixture(id, kind = "strength") {
  const state = E.create(123, id, id === "reiterpallasch" ? 1 : 0, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14 });
  state.world.assignments.find(assignment => assignment.enemyId === "huntsman-mob").sideId = "a";
  state.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, node: H(state).position, hp: 4 }];
  state.loot = []; hand(state, [kind, "endurance", "vitality"]);
  state.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"]; state.enemyDiscard = [];
  E.assertState(state); return state;
}
function rendered(model) {
  const document = new Document(""), element = document.createElement("div");
  element.innerHTML = Controls.renderHTML(model, { clean });
  return element;
}

test("actual Reiter and rifle instructions retain face-down placement through repeated public text cleanup", () => {
  for (const [id, face] of [["reiterpallasch", 1], ["rifle-spear", 0]]) {
    const text = W.definition(id).faces[face].text;
    assert.match(clean(text), /기술 1개를 뒷면으로 놓/);
    assert.equal(clean(clean(text)), clean(text));
    assert.doesNotMatch(clean(text), /기술 1개를 으로|임무/);
  }
  assert.equal(clean("장치무기 카드 A면 · 빠른 공격"), "장치무기 · 빠른 공격");
  assert.equal(clean("뒷면으로 뒤집습니다."), "다른 형태로 전환합니다.");
});

test("actual engine options show complete skill costs rather than an empty adverb", () => {
  let rifle = fixture("rifle-spear"); rifle.enemies[0].node = "tile-14:left"; rifle = go(rifle, "END_TURN");
  const reiter = fixture("reiterpallasch"), card = H(reiter).hand[0];
  const options = [E.weaponChoices(rifle, { cardId: H(rifle).hand[0].id, slot: 0 }).find(option => option.command.accept),
    E.weaponChoices(reiter, { cardId: card.id, slot: 1, enemyId: reiter.enemies[0].id })[0]];
  assert(options.every(Boolean));
  assert.equal(clean(options[0].label), "선택한 기술을 뒷면으로 놓고 피해 2");
  assert.equal(clean(options[1].label), "수은탄 사격 · 뒷면으로 놓고 피해 2");
});

for (const kind of ["strength", "skill"]) test(`fixed innate damage marks ${kind} effects inactive before committing the real two-damage action`, () => {
  const state = fixture("reiterpallasch", kind), cardId = H(state).hand[0].id, before = JSON.stringify(state),
    model = Controls.view(state, E, { cardId, slot: 1, actionKind: "fixed-damage", fixedDamage: 2,
      actionLabel: "수은탄 사격", requiredSlot: 1, attack: { speed: 4, damage: 99 },
      items: [{ name: "추가 공격 소모품", rules: "피해 +2" }], appliedEffects: [{ name: "선택한 무기 보정", text: "피해 +1" }] }),
    element = rendered(model), html = element.innerHTML;
  assert.match(html, /고유 행동 준비/); assert.match(html, /고정 피해 2/);
  assert.match(html, /필요: 손패 기술 1개 · 2번 빈 슬롯/); assert.match(html, /기술과 빈 슬롯 선택 완료/);
  assert.match(html, /class="combat-suppressed-effect"><span>미적용<\/span>/);
  assert.equal(model.attack, undefined); assert.deepEqual(model.extraEffects, []);
  assert.doesNotMatch(html, /추가 적용|추가 공격 소모품|선택한 무기 보정|적용 후 공격|기본 피해/);
  assert.equal(JSON.stringify(state), before, "displaying inactive costs does not spend a card or inspect the enemy deck");
  const after = go(state, "WEAPON_SHOT", { cardId, slot: 1, enemyId: state.enemies[0].id });
  assert.equal(after.enemies[0].hp, 2); assert.equal(H(after).hand.length, H(state).hand.length - 1);
  assert.equal(H(after).slots[1].faceDown, true); assert.equal(H(after).slots[1].id, cardId);
  assert.deepEqual(after.enemyDeck, state.enemyDeck); assert.deepEqual(after.enemyDiscard, state.enemyDiscard);
});

test("fixed action readiness requires both the hand skill and its actual empty slot", () => {
  const state = fixture("reiterpallasch"), input = { actionKind: "fixed-damage", fixedDamage: 2, requiredSlot: 1 };
  for (const selection of [{}, { cardId: H(state).hand[0].id }, { cardId: H(state).hand[0].id, slot: 0 }]) {
    const html = rendered(Controls.view(state, E, { ...input, ...selection })).innerHTML;
    assert.match(html, /기술과 필요한 빈 슬롯을 선택하면/); assert.doesNotMatch(html, /선택 완료/);
  }
});

test("optional quicksilver shot stays distinct from an ordinary stat attack", () => {
  const state = fixture("reiterpallasch"), model = Controls.view(state, E, { cardId: H(state).hand[0].id, slot: 1,
    attack: { speed: 2, damage: 3 }, fixedAction: { label: "수은탄 사격", damage: 2, requiredSlot: 1 } }),
    html = rendered(model).innerHTML;
  assert.match(html, /카드 효과<\/strong> 공격 피해 \+1/);
  assert.match(html, /적용 후 공격 · 속도 <b>2<\/b> · 피해 <b>3<\/b>/);
  assert.match(html, /수은탄 사격 · 일반 공격과 별도/); assert.match(html, /고정 피해 2/);
  assert.match(html, /카드·슬롯의 공격 수치와 부착 강화, 룬·소모품의 공격 보정은/);
});

test("ordinary dodge does not display an innate shot even if stale fixed-action input is supplied", () => {
  const state = fixture("reiterpallasch", "endurance"), model = Controls.view(state, E, { mode: "dodge",
    cardId: H(state).hand[0].id, slot: 1, actionKind: "fixed-damage", fixedDamage: 2,
    fixedAction: { label: "수은탄 사격", damage: 2 } }), html = rendered(model).innerHTML;
  assert.match(html, /회피 준비/); assert.match(html, /회피 속도/);
  assert.doesNotMatch(html, /고정 피해|고유 행동 준비|뒷면으로 놓/);
});
