"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), E = require("../hunt-engine"),
  Preview = require("../hunt-outcome-preview"), Q = require("./helpers/blood-frenzy-qa.cjs"),
  { boot } = require("./helpers/ui-harness.cjs");
const id = "wounded-retaliation", key = "bloodborne-hunt-qa-v1", H = E.hunter;
function facts(state) {
  const enemy = state.enemies.find(e => e.id === state.combat?.enemyId);
  return { enemy, definition: enemy && E.enemyDef(state, enemy), mission: E.missionView(state),
    hunter: H(state), combat: state.combat, phase: state.phase };
}
const warning = model => model?.warnings.find(warning => warning.id === id);
for (const variant of Q.variants) test(`SYNTHETIC-QA ${variant}: forecast stays conditional and preserves the actual public-command result`, () => {
  const before = Q.checkpoint(variant), declared = Q.strictRoundTrip(E.dispatch(before, Q.attackCommand(variant))),
    original = E.exportSave(declared), model = Preview.describe(facts(declared)), risk = warning(model),
    after = Q.strictRoundTrip(E.dispatch(declared, Q.RESOLVE));
  assert.equal(E.exportSave(declared), original, "preview cannot change state, consume a token or reveal another action");
  if (["fast", "mist"].includes(variant)) {
    assert.equal(declared.combat.action.damage, 2); assert.equal(declared.combat.action.speed, 2);
    assert.equal(declared.combat.attack.speed, 3); assert.equal(declared.combat.attack.damage, 1);
    assert(risk?.critical); assert.match(risk.title, /다친 채 생존 시 반격 최대 4피해.*현재 체력 기준 사망 가능/);
    assert.match(risk.detail, /실제 피해.*다친 채 살아남으면/);
    assert.match(Preview.renderHTML(model, { compact: true }), /data-outcome="wounded-retaliation"/);
    assert(after.events.some(event => /피의 광란.*사냥꾼에게 4 피해/.test(event.text)));
    assert(H(after).inDream); assert.equal(H(after).hp, 6, "dream recovery is after death, not surviving the four-damage hit");
    if (variant === "mist") assert(declared.combat.removeEnemyAttackEffects, "mist does not remove the numeric health condition");
  } else {
    assert.equal(risk, undefined, "same-speed, interrupted and lethal-token hits must not claim this conditional increase");
    assert(!H(after).inDream);
    assert.equal(H(after).hp, { tie: 2, interrupt: 4, token: 1 }[variant]);
    if (variant === "token") {
      assert.equal(declared.combat.action.damage, 5); assert.equal(declared.combat.buff.damage, 1);
      assert.equal(after.mission.targets.shelter.tokens, 0);
      assert.equal(after.enemies.find(enemy => enemy.missionId === "shelter").hp, 4);
      assert(after.events.some(event => /피의 광란.*사냥꾼에게 3 피해/.test(event.text)));
    }
  }
});

test("SYNTHETIC-QA real UI: the warning is beside the resolve action without opening the sequence disclosure", () => {
  const state = Q.checkpoint(), saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine: { ...E }, realInventory: true,
    storage: { [key]: saved, "bloodborne-hunt-active-mode": "qa" },
  });
  const select = (id, value) => { ui.el(id).value = String(value); ui.el(id).fire("change"); };
  select("combatSelectCard", "card-12"); select("combatSelectSlot", 0);
  assert.doesNotMatch(ui.el("attackConsequences").innerHTML, /wounded-retaliation/);
  assert.equal(ui.storage.get(key), saved, "card and slot selections do not expose the next action or save a command");
  const click = type => {
    const button = ["decisionActions", "decisions"].flatMap(id => ui.buttons(id)).find(button => button.dataset.command === type && !button.disabled);
    assert(button, type); button.click(); assert.equal(ui.el("error").textContent, "");
  };
  click("ATTACK");
  assert.equal(ui.el("attackConsequences").hidden, false);
  assert.match(ui.el("attackConsequences").innerHTML, /outcome-warning-critical.*wounded-retaliation/);
  assert.match(ui.el("attackConsequences").innerHTML, /다친 채 생존 시 반격 최대 4피해.*현재 체력 기준 사망 가능/);
  assert.match(ui.el("combatInfo").innerHTML, /피해 <b>2<\/b>/, "the disclosed snapshot is not rewritten as a guaranteed future result");
  const declared = E.importSave(ui.storage.get(key));
  click("RESOLVE");
  assert.equal(ui.storage.get(key), E.exportSave(E.dispatch(declared, Q.RESOLVE)));
});

test("SYNTHETIC component guards: no new increase warning for blocked, absent, resolved, unknown or different-cell attacks", () => {
  const input = facts(E.dispatch(Q.checkpoint(), Q.attackCommand()));
  const variants = [
    { combat: { ...input.combat, cancelHunter: true } },
    { combat: { ...input.combat, attackResolved: true } },
    { combat: { ...input.combat, cancelEnemy: true } },
    { combat: { ...input.combat, dodged: true } },
    { combat: { ...input.combat, enemyDefense: 1 } },
    { combat: { ...input.combat, attack: { ...input.combat.attack, damage: 0 } } },
    { combat: { ...input.combat, attack: { ...input.combat.attack, damage: 4 } } },
    { combat: { ...input.combat, action: null } },
    { enemy: { ...input.enemy, node: "other-cell" } },
    { mission: { ...input.mission, revealed: [] } },
  ];
  for (const edit of variants) assert.equal(warning(Preview.describe({ ...input, ...edit })), undefined);
  Object.defineProperty(input, "futureActionDeck", { get() { throw Error("hidden deck must not be accessed"); } });
  assert(warning(Preview.describe(input)));
});

test("SYNTHETIC component arithmetic: the short warning uses public damage buffs, frenzy and defense instead of hardcoded four", () => {
  const input = facts(E.dispatch(Q.checkpoint(), Q.attackCommand()));
  const model = Preview.describe({ ...input, hunter: { ...input.hunter, status: { frenzy: true } },
    combat: { ...input.combat, defense: 2, buff: { ...input.combat.buff, damage: 1 },
      action: { ...input.combat.action, damage: 3 } } });
  assert.equal(model.incoming.firstMinimum, 2); assert.equal(model.incoming.first, 4);
  assert.match(warning(model).title, /반격 최대 4피해/);
  assert.match(warning(model).detail, /강화·발광·방어/);
  const safe = Preview.describe({ ...input, hunter: { ...input.hunter, hp: 6 } });
  assert.equal(warning(safe).critical, false);
  assert.match(Preview.renderHTML(safe, { compact: true }), /wounded-retaliation.*반격 최대 4피해/);
});

test("SYNTHETIC component combat: faster regain heals before retaliation and never gets the new pre-heal death warning", () => {
  // Supply-valid hand arrangement, not a canonical import or earned save.
  const state = Q.checkpoint(); require("./actual-combat-helper.cjs").hand(state, ["regain", "endurance", "vitality"]);
  E.assertState(state);
  const declared = E.dispatch(state, { type: "ATTACK", enemyId: "scourge-beast-1", cardId: H(state).hand[0].id, slot: 0 }),
    model = Preview.describe(facts(declared)), risk = warning(model), after = E.dispatch(declared, Q.RESOLVE);
  assert.equal(declared.combat.attack.afterAttackHeal, 2); assert.equal(declared.combat.attack.speed, 3);
  assert.equal(declared.combat.attack.damage, 2); assert.equal(H(declared).hp, 4);
  assert(risk); assert.equal(risk.critical, false); assert.doesNotMatch(risk.title, /사망/);
  assert.equal(H(after).hp, 2); assert(!H(after).inDream, "HP4 → heal to6 → retaliation4 leaves HP2");
  const input = facts(declared), dealt = Preview.describe({ ...input, combat: { ...input.combat,
    attack: { ...input.combat.attack, afterAttackHeal: 0, healDealt: true } } });
  assert.equal(warning(dealt).critical, false); assert.doesNotMatch(warning(dealt).title, /사망/);
});
