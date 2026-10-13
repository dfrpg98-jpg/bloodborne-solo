const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../hunt-engine"), T = require("../temporary-components");
const H = E.hunter, go = (s, type, a = {}) => E.dispatch(s, { type, ...a });
const create = (id) => E.create(123, "burial", 0, null, "hunter-pistol", "center", { campaign: false, provisional: id });
function fighting(id) {
  const s = create(id), h = H(s);
  h.deck.push(...h.hand); h.hand = [];
  for (const kind of ["strength", "endurance", "skill"]) {
    const i = h.deck.findIndex((c) => c.kind === kind);
    h.hand.push(...h.deck.splice(i, 1));
  }
  s.enemyDeck = ["basic", "basic", "basic", "special", "special", "ability"];
  s.enemyDiscard = [];
  return s;
}
test("temporary fixtures are explicitly separate, selectable, and exactly replayable", () => {
  for (const id of Object.keys(T.specimens)) {
    const s = create(id);
    assert.equal(s.mission, undefined);
    assert.match(E.provisionalView(s).notice, /임시/);
    assert.equal(s.enemies.length, id === "iosefka" ? 0 : 1);
    assert.deepEqual(E.importSave(E.exportSave(s)), s);
  }
  assert.throws(() => E.create(1, "burial", 0, null, "hunter-pistol", "center", {campaign:true,provisional:"cleric-beast"}), /임시/);
});
test("temporary boss changes phase on lethal damage, keeps slower attack, and grants one final kill", () => {
  let s = fighting("cleric-beast"); s.enemies[0].hp = 2;
  s = go(s, "ATTACK", {enemyId:s.enemies[0].id,cardId:H(s).hand[0].id,slot:0});
  s = go(s, "RESOLVE");
  assert.equal(s.provisional.phase, 2); assert.equal(s.enemies[0].hp, 8);
  assert.equal(s.kills, 0); assert.equal(H(s).echoes, 0); assert.equal(H(s).hp, 4);
  s.enemies[0].hp = 1;
  s = go(s, "ATTACK", {enemyId:s.enemies[0].id,cardId:H(s).hand[0].id,slot:1});
  s = go(s, "RESOLVE");
  assert.equal(s.result, "provisional-win"); assert.equal(s.kills, 1);
});
test("temporary NPC consumes a real stat card and replays interaction without inventing supply", () => {
  let s = create("iosefka"); const before = H(s).hand.length;
  assert(E.interactionOptions(s).provisionalNpc);
  s = go(s, "INTERACT", {cardId:H(s).hand[0].id,provisionalNpc:true});
  assert.equal(s.provisional.npcVisits, 1); assert.equal(H(s).hand.length, before - 1);
  assert.equal(H(s).hp, 6); assert.deepEqual(E.importSave(E.exportSave(s)), s);
  const damaged = create("iosefka"); H(damaged).hp = 2;
  assert.equal(H(go(damaged, "INTERACT", {cardId:H(damaged).hand[0].id,provisionalNpc:true})).hp, 4);
  const elsewhere = create("iosefka"); H(elsewhere).position = "tile-14:left";
  assert.throws(() => go(elsewhere, "INTERACT", {cardId:H(elsewhere).hand[0].id,provisionalNpc:true}), /중앙 등불/);
});
test("female patient faces have independent supplied temporary attacks and boss filtering", () => {
  const a = create("female-patient-a"), b = create("female-patient-b"), boss = create("cleric-beast");
  assert.equal(E.enemyDef(a,a.enemies[0]).maxHp,4);
  assert.equal(E.enemyDef(b,b.enemies[0]).maxHp,5);
  assert.equal(E.enemyDef(boss,boss.enemies[0]).boss,true);
  assert.equal(E.enemyDef(a,a.enemies[0]).boss,false);
});
