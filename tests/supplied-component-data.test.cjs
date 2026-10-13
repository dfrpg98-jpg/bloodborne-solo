const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), vm = require("node:vm");
const { referenceSource } = require("./helpers/reference-source.cjs");
const A = require("../actual-components"), F = require("../firearms-engine"), T = require("../temporary-components");
const source = require("../components/supplied-components.json"), root = path.join(__dirname, "..");

test("supplied component photos retain their exact bytes, hashes and card provenance", () => {
  assert.equal(source.photos.length, 4);
  for (const photo of source.photos) {
    const bytes = fs.readFileSync(referenceSource(photo.path));
    assert.equal(bytes.length, photo.bytes);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), photo.sha256);
    assert(photo.cards.length >= 2);
  }
  for (const card of source.enemyCards) for (const face of card.source.faces || [card.source]) {
    assert(source.photos.some((photo) => photo.id === face.photoId && photo.path === face.image));
    assert(face.position);
  }
});
test("female patient sides preserve their printed health, attack numbers and distinct special effects", () => {
  const a = A.definition("female-patient-a"), b = A.definition("female-patient-b");
  for (const side of [a, b]) {
    assert.equal(side.health, 3);
    assert.equal(side.maxHp, 3);
    assert.deepEqual([side.basic.name, side.basic.speed, side.basic.damage], ["발톱 가르기", 2, 2]);
    assert.equal(side.ability.type, "ability");
    assert.equal(side.ability.code, "female-blood-disease");
    assert.equal(side.ability.dodgeSpeed, 3);
    assert.match(side.ability.rules[0], /그만큼 피해를 받고 독/);
  }
  assert.deepEqual([a.special.name, a.special.speed, a.special.damage, a.special.type], ["화혈병의 분노", 3, 2, "attack"]);
  assert.equal(a.special.code, "female-fury");
  assert.match(a.special.rules[0], /기본 공격이라면.*-2 피해/);
  assert.match(a.special.rules[0], /특수 공격이나 전용 능력.*방해와 독/);
  assert.deepEqual([b.special.name, b.special.speed, b.special.damage], ["붙잡고 토하기", 2, 3]);
  assert(b.special.poison && b.special.stun && b.special.undodgeable);
});
test("Iosefka uses the one-player face while retaining the three-player health face as source", () => {
  const card = source.enemyCards.find((card) => card.id === "iosefka-hostile"), definition = A.definition(card.id);
  assert.equal(card.sideRole, "hunter-count");
  assert.deepEqual(card.healthByHunterCount, { 1: 10, 2: 10, 3: 18, 4: 18 });
  assert.equal(definition.health, 10);
  assert.equal(definition.sideId, "1-2");
  assert.deepEqual([definition.basic.speed, definition.basic.damage, definition.basic.poison], [3, 2, true]);
  assert.deepEqual([definition.special.speed, definition.special.damage, definition.special.interrupt], [2, 3, true]);
  assert.equal(definition.special.forceHunterMove, 1);
  assert.equal(definition.special.allHunters, true);
  assert.equal(definition.ability.code, "iosefka-pistol");
  assert.match(definition.ability.rules.join(" "), /속도 3.*공격을 방해.*다른 적 행동 카드 1장/);
});
test("actual adapters preserve shared enemy deck counts and keep temporary trials separate", () => {
  assert.deepEqual(A.composition, { basic: 3, special: 2, ability: 1 });
  assert.equal(Object.values(A.composition).reduce((sum, count) => sum + count, 0), 6);
  assert.equal(A.definition("cleric-beast"), null);
  assert.equal(A.definition("iosefka"), null);
  assert.throws(() => A.definition("female-patient-a", 2), /페이즈 전환/);
  assert.equal(T.definition("female-patient-a").health, 4);
  for (const id of Object.keys(A.specimens)) {
    const definition = A.definition(id, 1, 5);
    assert(definition.actual && !definition.temporary && !definition.boss);
    assert.equal(definition.order, 5);
    assert.equal(definition.sourceLabel, definition.source.title);
    assert(definition.face.image);
  }
});
test("firearm effects and preparation costs preserve photos and direct user transcription", () => {
  const rifle = A.firearm("ludwig-rifle"), repeating = A.firearm("repeating-pistol"), flame = A.firearm("flamesprayer");
  assert.equal(rifle.trigger, "enemy-enters"); assert.equal(rifle.damage, 2); assert.equal(rifle.prepareCost, 2);
  assert.match(rifle.rules[0], /이동해 들어올 때.*2 피해/);
  assert.equal(repeating.trigger, "enemy-basic"); assert(repeating.interrupt);
  assert.equal(repeating.prepareCost, 1); assert(repeating.prepareOnTransform);
  assert.deepEqual([flame.speed, flame.damage, flame.interrupt, flame.splash, flame.prepareCost], [2, 2, true, 1, 2]);
  assert.equal(flame.source.kind, "user-text"); assert.equal(flame.source.image, null);
  assert.match(flame.source.text, /속도2피해2방해/);
  for (const gun of [rifle, repeating, flame]) assert(gun.actual && !gun.temporary && gun.sourceLabel);
});
test("browser mirrors load offline and match the source without mutating transcriptions", () => {
  const before = JSON.stringify(source), context = vm.createContext({});
  for (const file of ["components/supplied-components.js", "actual-components.js", "firearms-engine.js"])
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.BBSuppliedComponents)), source);
  assert.deepEqual(JSON.parse(JSON.stringify(context.BBActualComponents.definition("iosefka-hostile"))), A.definition("iosefka-hostile"));
  assert.equal(typeof context.BBFirearms.dispatch, "function");
  const definition = A.definition("female-patient-a"), gun = A.firearm("ludwig-rifle");
  definition.special.rules.push("caller mutation"); gun.rules.push("caller mutation");
  assert(!A.definition("female-patient-a").special.rules.includes("caller mutation"));
  assert(!A.firearm("ludwig-rifle").rules.includes("caller mutation"));
  assert.equal(JSON.stringify(source), before);
});

function fixture(gunId, overrides = {}) {
  const state = { setup: { rulesVersion: 9 }, mission: { won: false }, phase: "hunter",
    hunters: { hunter: { hp: 6, inDream: false, firearmId: gunId, firearmReady: true, position: "room",
      hand: [{ id: "a" }, { id: "b" }, { id: "c" }], discard: [] } },
    enemies: [{ id: "enemy-1", hp: 3, node: "room" }, { id: "enemy-2", hp: 3, node: "room" }],
    events: [], ...overrides };
  const helpers = {
    hunter: (s) => s.hunters.hunter, firearm: (s) => A.firearm(s.hunters.hunter.firearmId),
    enemy: (s, id) => s.enemies.find((enemy) => enemy.id === id), enemyDef: () => ({ name: "대상 적" }),
    log: (s, text) => s.events.push(text),
    pay: (s, id) => { const h = s.hunters.hunter; h.discard.push(h.hand.splice(h.hand.findIndex((card) => card.id === id), 1)[0]); },
    damageEnemy: (s, enemy, amount, context) => { enemy.hp -= amount; s.damageContext = context; return amount; },
    kill: (s, enemy) => { s.killed = enemy.id; s.enemies = s.enemies.filter((item) => item !== enemy); },
    interruptCombat: (s) => { s.combat.cancelEnemy = true; },
    addFlameAttack: (s, enemyId) => { s.flameTarget = enemyId; },
    pauseFirearmEntry: (s, enemy) => { s.firearmEntry = { enemyId: enemy.id, afterPhase: s.phase }; s.phase = "firearm_react"; },
    resumeFirearmEntry: (s) => { s.phase = s.firearmEntry.afterPhase; delete s.firearmEntry; },
  };
  return { s: state, h: helpers };
}
function react(s, extra = {}) {
  s.phase = "combat_react"; s.combat = { enemyId: "enemy-1", origin: "attack", cancelEnemy: false,
    action: { kind: "basic", type: "attack", uninterruptible: false }, ...extra };
}
test("actual firearm hooks leave version eight and old provisional replay states untouched", () => {
  const { s, h } = fixture("ludwig-rifle"); s.setup.rulesVersion = 8;
  const before = structuredClone(s);
  assert.equal(F.enabled(s, h), false);
  assert.equal(F.dispatch(s, { type: "FIREARM" }, h), false);
  assert.equal(F.onEnemyStep(s, s.enemies[0], "outside", "room", h), false);
  assert.deepEqual(s, before);
  s.setup.rulesVersion = 9; s.provisional = { componentId: "cleric-beast" };
  assert.equal(F.enabled(s, h), false);
});
test("new actual-map combat practice uses supplied firearm effects without a campaign mission", () => {
  const { s, h } = fixture("flamesprayer"); delete s.mission;
  assert(F.enabled(s, h)); assert(F.canUse(s, h));
  F.dispatch(s, { type: "FIREARM", enemyId: "enemy-1" }, h);
  assert.equal(s.flameTarget, "enemy-1");
});
test("two-card firearm reload rejects duplicate, missing, short and wrong-time payment atomically", () => {
  for (const gunId of ["ludwig-rifle", "flamesprayer"]) {
    const { s, h } = fixture(gunId); s.hunters.hunter.firearmReady = false;
    for (const ids of [["a"], ["a", "a"], ["a", "missing"], ["a", "b", "c"]]) {
      const before = structuredClone(s);
      assert.throws(() => F.dispatch(s, { type: "RELOAD", cardIds: ids }, h));
      assert.deepEqual(s, before);
    }
    s.phase = "combat_react";
    const before = structuredClone(s);
    assert.throws(() => F.reload(s, ["a", "b"], h), /차례/); assert.deepEqual(s, before);
    s.phase = "hunter";
    F.dispatch(s, { type: "RELOAD", cardIds: ["a", "b"] }, h);
    assert(s.hunters.hunter.firearmReady);
    assert.deepEqual(s.hunters.hunter.discard.map((card) => card.id), ["a", "b"]);
    assert.throws(() => F.reload(s, ["c", "a"], h), /이미 준비/);
  }
});
test("the repeating firearm reloads with one card or a transformation and interrupts only a legal basic attack", () => {
  const { s, h } = fixture("repeating-pistol"); s.hunters.hunter.firearmReady = false;
  F.dispatch(s, { type: "RELOAD", cardId: "a" }, h);
  react(s); assert(F.canUse(s, h)); F.dispatch(s, { type: "FIREARM" }, h);
  assert(s.combat.cancelEnemy); assert(!s.hunters.hunter.firearmReady);
  const remaining = s.hunters.hunter.hand.length;
  assert(F.onTransform(s, h)); assert.equal(s.hunters.hunter.hand.length, remaining);
  s.combat.cancelEnemy = false; s.combat.action.uninterruptible = true;
  assert.equal(F.canUse(s, h), false);
  s.combat.action.uninterruptible = false; s.combat.action.kind = "special";
  assert.equal(F.canUse(s, h), false);
  const rifle = fixture("ludwig-rifle"); rifle.s.hunters.hunter.firearmReady = false;
  assert.equal(F.onTransform(rifle.s, rifle.h), false);
});
test("long rifle offers entry damage only for movement into the hunter space and preserves decline continuation", () => {
  const { s, h } = fixture("ludwig-rifle"), e = s.enemies[0];
  assert.equal(F.onEnemyStep(s, e, null, "room", h), false);
  assert.equal(F.onEnemyStep(s, e, "room", "room", h), false);
  e.node = "elsewhere"; assert.equal(F.onEnemyStep(s, e, "outside", "elsewhere", h), false);
  e.node = "room"; s.phase = "enemy_path";
  assert(F.onEnemyStep(s, e, "outside", "room", h)); assert(F.canUse(s, h));
  const before = structuredClone(s);
  assert.throws(() => F.dispatch(s, { type: "FIREARM_ENTRY", accept: "yes" }, h)); assert.deepEqual(s, before);
  F.dispatch(s, { type: "FIREARM_ENTRY", accept: false }, h);
  assert.equal(s.phase, "enemy_path"); assert(s.hunters.hunter.firearmReady); assert.equal(e.hp, 3);
  F.onEnemyStep(s, e, "outside", "room", h); F.dispatch(s, { type: "FIREARM_ENTRY", accept: true }, h);
  assert.equal(e.hp, 1); assert(!s.hunters.hunter.firearmReady); assert.equal(s.phase, "enemy_path");
  assert.equal(s.damageContext.kind, "firearm-entry");
});
test("lethal entry firearm damage uses the engine death hook before resuming movement", () => {
  const { s, h } = fixture("ludwig-rifle"); s.enemies[0].hp = 2;
  F.onEnemyStep(s, s.enemies[0], "outside", "room", h);
  F.dispatch(s, { type: "FIREARM_ENTRY", accept: true }, h);
  assert.equal(s.killed, "enemy-1"); assert(!s.enemies.some((enemy) => enemy.id === "enemy-1"));
  assert.equal(s.phase, "hunter"); assert.equal(s.firearmEntry, undefined);
});
test("flamesprayer declares a standalone hunter attack or the counter attack before revealing the enemy card", () => {
  const { s, h } = fixture("flamesprayer"), before = structuredClone(s);
  assert(F.canUse(s, h));
  assert.throws(() => F.dispatch(s, { type: "FIREARM" }, h), /대상/); assert.deepEqual(s, before);
  const hand = structuredClone(s.hunters.hunter.hand);
  F.dispatch(s, { type: "FIREARM", enemyId: "enemy-2" }, h);
  assert.equal(s.flameTarget, "enemy-2"); assert(!s.hunters.hunter.firearmReady);
  assert.deepEqual(s.hunters.hunter.hand, hand);
  const second = fixture("flamesprayer");
  second.s.phase = "combat_choose";
  second.s.combat = { enemyId: "enemy-1", origin: "activation", attack: null, action: null };
  const unchanged = structuredClone(second.s);
  assert.throws(() => F.dispatch(second.s, { type: "FIREARM", enemyId: "enemy-2" }, second.h), /현재 전투/);
  assert.deepEqual(second.s, unchanged);
  assert(F.canUse(second.s, second.h)); F.dispatch(second.s, { type: "FIREARM" }, second.h);
  assert.equal(second.s.flameTarget, "enemy-1"); assert.equal(second.s.combat.attack, null);
  assert.deepEqual(second.s.hunters.hunter.hand, unchanged.hunters.hunter.hand);
});
test("flamesprayer rejects every reaction after an enemy reveal and cannot add a second declared attack", () => {
  for (const phase of ["combat_react", "combat_choose"]) {
    for (const fields of [
      { action: { kind: "basic", type: "attack" } },
      { attack: { cardId: "a", speed: 3, damage: 2 } },
      { flame: { speed: 2, damage: 2, interrupt: true } },
    ]) {
      const { s, h } = fixture("flamesprayer");
      s.phase = phase; s.combat = { enemyId: "enemy-1", origin: "activation", ...fields };
      const before = structuredClone(s);
      assert.equal(F.canUse(s, h), false);
      assert.throws(() => F.dispatch(s, { type: "FIREARM" }, h));
      assert.deepEqual(s, before);
    }
  }
  const { s, h } = fixture("flamesprayer");
  s.phase = "combat_react"; s.combat = { enemyId: "enemy-1", origin: "activation" };
  assert.equal(F.canUse(s, h), false);
});
test("flamesprayer cannot attack during interaction retaliation or use a remote target", () => {
  const { s, h } = fixture("flamesprayer");
  s.phase = "combat_choose"; s.combat = { enemyId: "enemy-1", origin: "interaction" };
  assert.equal(F.canUse(s, h), false);
  const before = structuredClone(s); assert.throws(() => F.dispatch(s, { type: "FIREARM" }, h)); assert.deepEqual(s, before);
  s.phase = "hunter"; s.enemies[1].node = "remote";
  const unchanged = structuredClone(s);
  assert.throws(() => F.dispatch(s, { type: "FIREARM", enemyId: "enemy-2" }, h), /같은 칸/);
  assert.deepEqual(s, unchanged);
});
