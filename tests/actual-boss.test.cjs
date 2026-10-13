const test = require("node:test"), assert = require("node:assert/strict");
const { E, B, go, fixture, bossAction, attack, dodge, chapter, hand } = require("./actual-combat-helper.cjs");
test("actual Cleric Beast retains all printed health counts and both exact five-card decks", () => {
  assert.deepEqual(B.specimen.phases.map((p) => p.health), [[10,14,20,24],[8,12,16,20]]);
  for (let n=1; n<=4; n++) assert.equal(B.definition("cleric-beast", 2, 4, n).maxHp, [8,12,16,20][n-1]);
  const s = fixture(), e = s.enemies[0];
  assert.equal(E.enemyDef(s,e).maxHp,10); assert(B.valid(e));
  assert.deepEqual(e.bossDecks.map((d)=>d.draw), B.specimen.phases.map((p)=>p.deck));
  e.bossDecks[0].draw[0] = "grab"; assert.throws(()=>E.assertState(s), /실제 성직자/);
});
test("actual boss insight exhausts the firearm once and subtracts tokens from the current attack", () => {
  let s = attack(bossAction(fixture(),"slam")); assert(E.canBossInsight(s));
  s = go(s,"BOSS_INSIGHT"); assert.equal(s.enemies[0].insightTokens,1);
  assert.equal(E.hunter(s).firearmReady,false); assert(!E.canBossInsight(s));
  const before = structuredClone(s); assert.throws(()=>go(s,"BOSS_INSIGHT")); assert.deepEqual(s,before);
  s = go(s,"RESOLVE"); assert.equal(E.hunter(s).hp,3); assert.equal(s.enemies[0].hp,8);
  let zero = fixture(); zero.enemies[0].insightTokens=7;
  zero = go(attack(bossAction(zero,"slam")),"RESOLVE"); assert.equal(E.hunter(zero).hp,6);
});
test("recovery removes insight, defends two damage, shuffles its current deck, and neither heals nor reveals another card", () => {
  let s = fixture(); s.enemies[0].hp=7; s.enemies[0].insightTokens=3;
  const otherDeck=structuredClone(s.enemies[0].bossDecks[1]);
  s = attack(bossAction(s,"recovery"));
  assert.equal(s.phase,"hunter"); assert.equal(s.combat,null);
  assert.equal(s.enemies[0].hp,7); assert.equal(s.enemies[0].insightTokens,0);
  assert.equal(s.enemies[0].bossDecks[0].draw.length,5); assert.equal(s.enemies[0].bossDecks[0].discard.length,0);
  assert.deepEqual(s.enemies[0].bossDecks[1],otherDeck);
  assert.equal(s.events.filter((x)=>x.text.includes("페이즈 · 회복:")).length,1);
});
test("grab and grab-throw have speed three and interrupt only a slower hunter attack", () => {
  let s = go(attack(bossAction(fixture(),"grab"),1),"RESOLVE");
  assert.equal(E.hunter(s).hp,3); assert.equal(s.enemies[0].hp,10);
  let equal = go(attack(bossAction(fixture(),"grab"),0),"RESOLVE");
  assert.equal(E.hunter(equal).hp,3); assert.equal(equal.enemies[0].hp,8);
  let thrown=go(attack(bossAction(fixture("cleric-beast",2),"grab-throw"),1),"RESOLVE");
  assert.equal(thrown.phase,"stun"); assert.equal(E.hunter(thrown).hp,3);
  thrown=go(thrown,"STUN_DISCARD",{cardId:E.hunter(thrown).hand[0].id});
  assert.equal(thrown.phase,"boss_move"); assert.equal(E.bossMoveOptions(thrown).length,2);
  const destination=E.bossMoveOptions(thrown)[0]; thrown=go(thrown,"BOSS_STEP",{node:destination});
  assert.equal(E.hunter(thrown).position,destination); assert.equal(thrown.phase,"hunter");
});
test("a successful grab-throw dodge prevents damage, stun and the hunter's forced movement", () => {
  let s=attack(bossAction(fixture("cleric-beast",2),"grab-throw"),1);
  s=go(dodge(s,0),"RESOLVE"); assert.equal(E.hunter(s).hp,6);
  assert.equal(E.hunter(s).position,"tile-14:center"); assert.equal(s.phase,"hunter");
  assert.equal(s.enemies[0].hp,5);
});
test("dash-sweep is undodgeable, offers firearm insight and makes the surviving boss move farther", () => {
  let s=attack(bossAction(fixture(),"dash-sweep"));
  assert(!E.canDodge(s,E.hunter(s).hand[0].id,1)); assert(E.canBossInsight(s));
  s=go(s,"RESOLVE"); assert.equal(E.hunter(s).hp,2); assert.equal(s.phase,"boss_move");
  const to=E.bossMoveOptions(s)[0]; s=go(s,"BOSS_STEP",{node:to});
  assert.equal(s.enemies[0].node,to); assert.equal(s.phase,"hunter");
  let cancelled=go(attack(bossAction(fixture("cleric-beast",1,["skill","endurance","strength"]),"dash-sweep")),"RESOLVE");
  assert.equal(E.hunter(cancelled).hp,6); assert.equal(cancelled.enemies[0].node,"tile-14:center");
});
test("leap-slam requests an immediate speed-one dodge, then reveals another boss card with a fresh dodge opportunity", () => {
  let s=attack(bossAction(fixture("cleric-beast",2,["strength","endurance","endurance"]),"leap-slam"),1);
  assert.equal(s.phase,"boss_react"); assert.deepEqual(E.combatReaction(s),{title:"뛰어 내려찍기",damage:2,dodgeSpeed:1,effects:["기절"]});
  s=go(dodge(s,0),"RESOLVE"); assert.equal(s.phase,"combat_react");
  assert.equal(s.combat.action.id,"slam"); assert.equal(s.combat.dodged,false);
  s=go(dodge(s,0),"RESOLVE"); assert.equal(E.hunter(s).hp,6); assert.equal(s.enemies[0].hp,5);
});
test("undodged leap-slam deals two, requests stun and reveals its followup only after stun resolves", () => {
  let s=go(attack(bossAction(fixture("cleric-beast",2),"leap-slam")),"RESOLVE");
  assert.equal(E.hunter(s).hp,4); assert.equal(s.phase,"stun");
  assert.equal(s.enemies[0].bossDecks[1].discard.length,1);
  s=go(s,"STUN_DISCARD",{cardId:E.hunter(s).hand[0].id});
  assert.equal(s.phase,"combat_react"); assert.equal(s.enemies[0].bossDecks[1].discard.length,2);
});
test("destructive slam cannot be interrupted, has no firearm insight offer, and dodge adds one to the hunter attack", () => {
  let s=attack(bossAction(fixture("cleric-beast",2),"destructive-slam"),1);
  assert(!E.canBossInsight(s)); s=go(dodge(s,0),"RESOLVE");
  assert.equal(E.hunter(s).hp,6); assert.equal(s.enemies[0].hp,4);
  let unstoppable=attack(bossAction(fixture("cleric-beast",2,["skill","endurance","strength"]),"destructive-slam"));
  unstoppable=go(unstoppable,"RESOLVE"); assert(E.hunter(unstoppable).inDream);
});
test("phase-one defeat restores the printed phase-two health without overflow and retains its separate deck", () => {
  let s=fixture(); s.enemies[0].hp=1; s.enemies[0].insightTokens=2;
  const phaseTwo=structuredClone(s.enemies[0].bossDecks[1]);
  s=go(attack(bossAction(s,"slam")),"RESOLVE");
  assert.equal(s.enemies[0].componentPhase,2); assert.equal(s.enemies[0].hp,8);
  assert.equal(s.enemies[0].insightTokens,2); assert.deepEqual(s.enemies[0].bossDecks[1],phaseTwo);
});
test("numbing mist removes boss attack effects but preserves printed speed and damage", () => {
  let s=fixture("cleric-beast",2,undefined,{item:"numbing-mist"});
  const item=E.hunter(s).consumables[0].id;
  s=attack(bossAction(s,"grab-throw"),1,{itemIds:[item]});
  assert(!E.canBossInsight(s)); s=go(s,"RESOLVE");
  assert.equal(E.hunter(s).hp,3); assert.equal(s.phase,"hunter");
  assert.equal(E.hunter(s).position,"tile-14:center"); assert.equal(s.enemies[0].hp,5);
});
test("an actual phase-two final kill completes card44 and the final dream without advancing the hunt track",()=>{
  let s=chapter(3),e=s.enemies.find((x)=>x.missionId==="main");
  s.mission.revealed.push(42);s.mission.discarded.push(41);s.mission.fog=[];
  e.componentPhase=2;e.hp=1;E.hunter(s).position=e.node;s.enemies=[e];
  hand(s,["strength","endurance","vitality"]);bossAction(s,"slam");
  const track=s.track;s=go(attack(s),"RESOLVE");
  assert(s.mission.completed.includes(44));assert(s.mission.revealed.includes(44));assert(s.mission.won);
  assert.equal(s.enemies.length,0);assert.equal(s.track,track);
  assert.equal(E.hunter(s).hp,6);assert.equal(s.phase,"upgrade_pick");
  while(s.phase==="upgrade_pick") {
    s=go(s,"PICK_UPGRADE",{index:s.market.findIndex(Boolean)});
    s=go(s,"REPLACE_UPGRADE",{replaceId:E.hunter(s).deck[0].id});
  }
  assert.equal(s.phase,"over");assert.equal(s.result,"campaign-win");assert.equal(s.track,track);
  E.assertState(s);
});
