"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const E=require("../hunt-engine.js");
const {hand}=require("./actual-combat-helper.cjs");
const go=(s,type,args={})=>E.dispatch(s,{type,...args});
function fixture(rewards=["rune-rapture"],version=14,hp=2,targetHp=4,extras=[1]) {
  let s=E.create(123,"burial",0,null,"hunter-pistol","center",
    {campaign:false,rulesVersion:version,practiceRewards:rewards});
  const h=E.hunter(s);
  s.world.assignments.find(a=>a.enemyId==="huntsman-mob").sideId="a";
  s.enemies=[{id:"huntsman-mob-1",kind:"huntsman-mob",figure:1,node:h.position,hp:targetHp},
    ...extras.map((hp,i)=>({id:`huntsman-mob-${i+2}`,kind:"huntsman-mob",figure:i+2,node:"tile-14:left",hp}))];
  s.loot=[];h.hp=hp;hand(s,["strength","endurance","skill"]);
  s.enemyDeck=["basic","basic","basic","special","special","ability"];s.enemyDiscard=[];
  E.assertState(s);
  return go(s,"ATTACK",{enemyId:"huntsman-mob-1",cardId:h.hand[0].id,slot:0});
}
const useKind=(s,kind,enemyId)=>go(s,"USE_REWARD",{rewardId:E.hunter(s).rewards.find(r=>r.kind===kind&&r.ready).id,...(enemyId?{enemyId}:{})});

test("fast splash kill offers Rapture before the slower lethal attack",()=>{
  let s=go(fixture(),"RESOLVE");
  assert.equal(s.phase,"kill_react");assert.equal(E.hunter(s).hp,2);assert.equal(s.track,1);
  assert.equal(s.enemies[0].hp,2);assert.equal(s.kills,1);
  const before=structuredClone(s);
  assert.throws(()=>go(s,"END_TURN"));assert.deepEqual(s,before);
  s=useKind(s,"rune-rapture");assert.equal(E.hunter(s).hp,3);
  s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.phase,"hunter");assert.equal(E.hunter(s).hp,1);assert.equal(s.track,1);
  assert.equal(s.events.filter(e=>e.text.includes("도끼 휘두르기 · 사냥꾼에게")).length,1);
});
test("Beast can kill the remaining target before its slower attack and resumes once",()=>{
  let s=go(fixture(["rune-beast"]),"RESOLVE");
  assert.equal(s.phase,"kill_react");
  const command=E.killReactionActions(s).find(a=>a.command.enemyId==="huntsman-mob-1").command;
  s=E.dispatch(s,command);assert.equal(s.enemies.length,0);assert.equal(s.kills,2);
  s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.phase,"hunter");assert.equal(E.hunter(s).hp,2);assert.equal(s.track,1);
  assert.equal(s.events.filter(e=>e.text.includes("도끼 휘두르기 · 사냥꾼에게")).length,0);
});
test("passing a fast-kill reaction performs one death and one following round",()=>{
  let s=go(fixture(),"RESOLVE");s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.phase,"refill");assert.equal(E.hunter(s).inDream,true);assert.equal(s.round,2);assert.equal(s.track,3);
  assert.equal(s.events.filter(e=>e.text.includes("처치당했습니다.")).length,1);
  assert.equal(s.events.filter(e=>e.text.includes("사냥꾼의 꿈 입장")).length,1);
  assert.throws(()=>go(s,"PASS_KILL_REACTION"));
});
test("a simultaneous damage group finishes all kills before one reaction window",()=>{
  let s=fixture(["rune-rapture"],14,4,4,[1,1]);
  // Same-speed attacks apply together; opening the reaction cannot prevent the hit.
  s.combat.attack.speed=2;s=go(s,"RESOLVE");
  assert.equal(s.phase,"kill_react");assert.equal(E.hunter(s).hp,2);assert.equal(s.kills,2);
  assert.equal(s.enemies.length,1);
  s=useKind(s,"rune-rapture");s=go(s,"PASS_KILL_REACTION");
  assert.equal(E.hunter(s).hp,3);assert.equal(s.phase,"hunter");
});
test("simultaneous hunter death suppresses on-kill healing",()=>{
  let s=fixture(["rune-rapture"],14,2,2,[]);s.combat.attack.speed=2;s=go(s,"RESOLVE");
  assert.equal(E.hunter(s).inDream,true);assert.equal(s.phase,"refill");
  assert.equal(s.killReaction,undefined);assert.equal(E.killReactionActions(s).length,0);
});
test("two equipped runes independently react to one kill",()=>{
  let s=go(fixture(["rune-rapture","rune-beast"]),"RESOLVE");
  s=useKind(s,"rune-rapture");
  assert(E.killReactionActions(s).some(a=>a.command.enemyId==="huntsman-mob-1"));
  s=useKind(s,"rune-beast","huntsman-mob-1");s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.enemies.length,0);assert.equal(E.hunter(s).hp,3);
  assert(E.hunter(s).rewards.every(r=>!r.ready));
});
test("two copies of Rapture may both react but an exhausted copy cannot repeat",()=>{
  let s=go(fixture(["rune-rapture","rune-rapture"]),"RESOLVE");
  const first=E.hunter(s).rewards[0].id;s=useKind(s,"rune-rapture");
  assert.throws(()=>go(s,"USE_REWARD",{rewardId:first}));
  s=useKind(s,"rune-rapture");assert.equal(E.hunter(s).hp,4);
  s=go(s,"PASS_KILL_REACTION");assert.equal(E.hunter(s).hp,2);
});
test("a reaction-generated weapon kill chain returns to the pending reaction",()=>{
  let s=E.create(123,"hunter-axe",1,null,"hunter-pistol","center",
    {campaign:false,rulesVersion:14,practiceRewards:["rune-rapture","rune-beast"]});
  const h=E.hunter(s);s.world.assignments.find(a=>a.enemyId==="huntsman-mob").sideId="a";
  s.enemies=[{id:"huntsman-mob-1",kind:"huntsman-mob",figure:1,node:h.position,hp:3},
    {id:"huntsman-mob-2",kind:"huntsman-mob",figure:2,node:"tile-14:left",hp:2},
    {id:"huntsman-mob-3",kind:"huntsman-mob",figure:3,node:"tile-14:right",hp:2}];
  hand(s,["strength","endurance","vitality"]);
  s.enemyDeck=["basic","basic","basic","special","special","ability"];s.enemyDiscard=[];
  s=go(s,"ATTACK",{cardId:h.hand[0].id,enemyId:"huntsman-mob-1",slot:1});s=go(s,"RESOLVE");
  assert.equal(s.phase,"kill_react");
  s=useKind(s,"rune-beast","huntsman-mob-2");
  assert.equal(s.enemies.length,0);assert.equal(s.kills,3);assert.equal(s.phase,"kill_react");
  assert(s.combat);assert(s.killReaction);
  s=useKind(s,"rune-rapture");s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.phase,"hunter");assert.equal(s.combat,null);assert.equal(s.killReaction,undefined);
});
test("rules11-13 retain their original unpaused resolution until recorded adoption",()=>{
  for(const version of [11,12,13]) {
    const s=fixture(["rune-rapture"],version);
    const old=go(s,"RESOLVE");assert.equal(E.hunter(old).inDream,true);assert.equal(old.killReaction,undefined);
    const adopted=E.applyCombatReactionRuling(s);assert.equal(adopted.combatReactionRuling,"immediate");
    assert.equal(adopted.commands.at(-1).type,"APPLY_COMBAT_REACTION_RULING");
    assert.equal(E.applyCombatReactionRuling(adopted),adopted);
    assert.equal(go(adopted,"RESOLVE").phase,"kill_react");
  }
  const old=E.create(123,"burial",0,null,"hunter-pistol","center",{campaign:false,rulesVersion:10});
  assert.equal(E.applyCombatReactionRuling(old),old);
  assert.throws(()=>go(old,"APPLY_COMBAT_REACTION_RULING"));
});
const natural=require("./fixtures/natural-kill-reaction-v14.json");
function naturalState(version=14,count=natural.commands.length) {
  let s=E.create(natural.seed,"burial",0,null,"hunter-pistol","center",
    {campaign:false,rulesVersion:version,practiceRewards:["rune-rapture","rune-beast"]});
  for(const command of natural.commands.slice(0,count)) s=E.dispatch(s,command);
  return s;
}
const roundTrip=s=>assert.deepEqual(E.importSave(E.exportSave(s)),s);
test("natural public commands save and replay before, during and after both reactions",()=>{
  let s=naturalState(14,natural.commands.length-1);roundTrip(s);
  s=E.dispatch(s,natural.commands.at(-1));assert.equal(s.phase,"kill_react");roundTrip(s);
  const before=structuredClone(s),actions=E.killReactionActions(s);
  assert.deepEqual(s,before);assert(actions.some(a=>a.command.type==="PASS_KILL_REACTION"));
  const rapture=actions.find(a=>a.command.type==="USE_REWARD"&&!a.command.enemyId);
  const beast=actions.find(a=>a.command.enemyId);
  assert(rapture&&beast);
  const hp=E.hunter(s).hp;s=E.dispatch(s,rapture.command);
  assert.equal(E.hunter(s).hp,hp+1);roundTrip(s);
  s=E.dispatch(s,beast.command);roundTrip(s);
  s=go(s,"PASS_KILL_REACTION");roundTrip(s);
  assert.equal(s.phase,"hunter");assert.equal(s.killReaction,undefined);
});
test("recorded adoption preserves an imported rules13 natural checkpoint",()=>{
  let s=naturalState(13,natural.commands.length-1);roundTrip(s);
  const before=structuredClone(s);s=E.applyCombatReactionRuling(s);
  assert.deepEqual(s.commands.slice(0,-1),before.commands);roundTrip(s);
  s=E.dispatch(s,natural.commands.at(-1));assert.equal(s.phase,"kill_react");roundTrip(s);
  s=go(s,"PASS_KILL_REACTION");roundTrip(s);
});
test("natural fast splash kill changes lethal outcome before a slower strike and replays every continuation",()=>{
  const f=require("./fixtures/natural-fast-kill-reaction-v14.json");
  const start=version=>E.create(f.seed,"burial",0,null,"hunter-pistol","center",
    {campaign:false,rulesVersion:version,practiceRewards:["rune-rapture","rune-beast"]});
  let s=start(14);
  for(const command of f.commands.slice(0,-1))s=E.dispatch(s,command);
  assert.equal(s.phase,"combat_react");assert.equal(E.hunter(s).hp,4);
  assert.equal(s.combat.attack.speed,3);assert.equal(s.combat.action.speed,1);assert.equal(s.combat.action.damage,4);
  const track=s.track,round=s.round;roundTrip(s);
  s=E.dispatch(s,f.commands.at(-1));assert.equal(s.phase,"kill_react");roundTrip(s);
  assert(s.enemies.some(e=>e.id===s.combat.enemyId));assert.equal(E.hunter(s).hp,4);
  s=useKind(s,"rune-rapture");assert.equal(E.hunter(s).hp,5);roundTrip(s);
  s=go(s,"PASS_KILL_REACTION");
  assert.equal(s.phase,"stun");assert.equal(E.hunter(s).hp,1);assert.equal(E.hunter(s).inDream,false);roundTrip(s);
  s=go(s,"STUN_DISCARD",{cardId:E.hunter(s).hand[0].id});roundTrip(s);
  assert.equal(s.phase,"hunter");assert.equal(s.track,track);assert.equal(s.round,round);
  let old=start(13);
  for(const command of f.commands.filter(a=>a.type!=="PASS_KILL_REACTION"))old=E.dispatch(old,command);
  assert.equal(E.hunter(old).inDream,true);assert.equal(old.phase,"refill");
  assert.equal(old.track,Math.min(16,track+2));roundTrip(old);
});
