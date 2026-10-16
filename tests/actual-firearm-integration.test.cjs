const test=require("node:test"),assert=require("node:assert/strict");
const {E,go,hand,fixture,bossAction,chapter}=require("./actual-combat-helper.cjs");
const M=require("../src/chapter-engine.js");
function normal(gun="ludwig-rifle",hp=4,face=0,item=null) {
  const s=E.create(123,"burial",face,item,gun,"center",{campaign:false,rulesVersion:9});
  s.world.assignments.find((a)=>a.enemyId==="huntsman-mob").sideId="a";
  s.world.assignments=s.world.assignments.sort((a,b)=>a.enemyId==="huntsman-mob"?-1:b.enemyId==="huntsman-mob"?1:0)
    .map((a,i)=>({...a,slot:i+1,marker:["gold","red","purple"][i]}));
  s.enemies=[{id:"huntsman-mob-1",kind:"huntsman-mob",figure:1,node:"tile-14:left",hp}];
  s.enemyDeck=["basic","basic","basic","special","special","ability"];s.enemyDiscard=[];
  s.loot=[];hand(s,["strength","endurance","vitality"]);E.assertState(s);return s;
}
test("rifle entry pauses activation before an enemy card is revealed and can kill before countering",()=>{
  let s=go(normal(undefined,2),"END_TURN");assert.equal(s.phase,"firearm_react");
  assert.equal(s.enemyDiscard.length,0);assert.equal(E.firearmEntryView(s).damage,2);
  s=go(s,"FIREARM_ENTRY",{accept:true});assert.equal(s.phase,"refill");
  assert.equal(s.enemies.length,0);assert.equal(E.hunter(s).hp,6);assert(!E.hunter(s).firearmReady);
  let declined=go(normal(),"END_TURN");declined=go(declined,"FIREARM_ENTRY",{accept:false});
  assert.equal(declined.phase,"combat_choose");assert.equal(declined.enemyDiscard.length,0);
  assert(E.hunter(declined).firearmReady);declined=go(declined,"NO_ATTACK");
  assert.equal(declined.combat.action.kind,"basic");
});
test("rifle pull entry occurs before the stat card is spent and resumes the declared attack after the choice",()=>{
  let s=normal(undefined,4,1),id=E.hunter(s).hand[0].id;
  s=go(s,"ATTACK",{enemyId:s.enemies[0].id,cardId:id,slot:1,pullIds:[s.enemies[0].id]});
  assert.equal(s.phase,"firearm_react");assert.equal(s.enemyDiscard.length,0);
  assert(E.hunter(s).hand.some((c)=>c.id===id));assert.equal(s.combat,null);
  s=go(s,"FIREARM_ENTRY",{accept:true});assert.equal(s.phase,"combat_react");
  assert.equal(s.enemies[0].hp,2);assert(!E.hunter(s).hand.some((c)=>c.id===id));
  s=go(s,"RESOLVE");assert.equal(s.enemies.length,0);
  let killed=normal(undefined,2,1),cardId=E.hunter(killed).hand[0].id;
  killed=go(killed,"ATTACK",{enemyId:killed.enemies[0].id,cardId,slot:1,pullIds:[killed.enemies[0].id]});
  killed=go(killed,"FIREARM_ENTRY",{accept:true});assert.equal(killed.phase,"hunter");
  assert(E.hunter(killed).hand.some((c)=>c.id===cardId));assert.equal(killed.enemyDiscard.length,0);
});
test("multiple pulls preserve each unused rifle opportunity and decline resumes the next pull",()=>{
  let s=normal(undefined,4,1);
  s.enemies.push({id:"huntsman-mob-2",kind:"huntsman-mob",figure:2,node:"tile-14:right",hp:4});
  const ids=s.enemies.map((e)=>e.id);
  s=go(s,"ATTACK",{enemyId:ids[1],cardId:E.hunter(s).hand[0].id,slot:1,pullIds:ids});
  assert.equal(s.firearmEntry.enemyId,ids[0]);assert.equal(s.enemies[1].node,"tile-14:right");
  s=go(s,"FIREARM_ENTRY",{accept:false});assert.equal(s.phase,"firearm_react");
  assert.equal(s.firearmEntry.enemyId,ids[1]);s=go(s,"FIREARM_ENTRY",{accept:true});
  assert.equal(s.phase,"combat_react");assert.equal(s.enemies[1].hp,2);
});
test("rifle also offers its entry reaction after a consumable moves an enemy into the hunter space",()=>{
  const moving=Object.values(E.data.consumables).find((c)=>c.effects.moveEnemy);assert(moving);
  let s=normal(undefined,4,0,moving.id);
  s=go(s,"USE_CONSUMABLE",{itemId:E.hunter(s).consumables[0].id,enemyId:s.enemies[0].id,node:"tile-14:center"});
  assert.equal(s.phase,"firearm_react");s=go(s,"FIREARM_ENTRY",{accept:true});
  assert.equal(s.phase,"hunter");assert.equal(s.enemies[0].hp,2);
});
test("actual reload costs two cards atomically for rifle and flame, and repeated pistol prepares on transform",()=>{
  for(const gun of ["ludwig-rifle","flamesprayer"]) {
    let s=normal(gun);E.hunter(s).firearmReady=false;const before=structuredClone(s),ids=E.hunter(s).hand.map((c)=>c.id);
    assert.throws(()=>go(s,"RELOAD",{cardIds:[ids[0],ids[0]]}));assert.deepEqual(s,before);
    assert.throws(()=>go(s,"RELOAD",{cardId:ids[0]}));assert.deepEqual(s,before);
    s=go(s,"RELOAD",{cardIds:ids.slice(0,2)});assert(E.hunter(s).firearmReady);assert.equal(E.hunter(s).hand.length,1);
  }
  let repeated=normal("repeating-pistol");E.hunter(repeated).firearmReady=false;
  repeated=go(repeated,"TRANSFORM",{cardId:E.hunter(repeated).hand[0].id});assert(E.hunter(repeated).firearmReady);
});
test("flame declares its sole speed-two attack before revealing, with splash and faster interrupt",()=>{
  let s=normal("flamesprayer");s.enemies[0].node=E.hunter(s).position;
  s.world.assignments.find((a)=>a.enemyId==="huntsman-mob").sideId="b";
  s.enemies.push({id:"huntsman-mob-2",kind:"huntsman-mob",figure:2,node:E.hunter(s).position,hp:4});
  s.enemyDeck=["special","basic","basic","basic","special","ability"];
  const cards=structuredClone(E.hunter(s).hand);s=go(s,"FIREARM",{enemyId:s.enemies[0].id});
  assert.equal(s.phase,"combat_react");assert.equal(s.combat.attack,null);
  assert.deepEqual(E.hunter(s).hand,cards);assert.equal(s.combat.flame.damage,2);
  s=go(s,"RESOLVE");assert.equal(s.enemies[0].hp,2);assert.equal(s.enemies[1].hp,3);assert.equal(E.hunter(s).hp,6);
  let counter=normal("flamesprayer");counter.enemies[0].node=E.hunter(counter).position;
  counter=go(counter,"END_TURN");assert.equal(counter.phase,"combat_choose");assert(E.canFirearm(counter));
  counter=go(counter,"FIREARM",{enemyId:counter.enemies[0].id});assert.equal(counter.phase,"combat_react");
  assert.equal(E.hunter(counter).hand.length,3);
  const before=structuredClone(counter);assert.throws(()=>go(counter,"FIREARM"));assert.deepEqual(counter,before);
});
test("destructive-slam dodge gives the declared flame attack its printed bonus",()=>{
  let s=bossAction(fixture("cleric-beast",2,undefined,{firearm:"flamesprayer"}),"destructive-slam");
  s=go(s,"FIREARM",{enemyId:s.enemies[0].id});
  s=go(s,"DODGE",{cardId:E.hunter(s).hand.find((c)=>E.card(c).dodge).id,slot:0});
  assert.equal(s.combat.flame.damage,3);s=go(s,"RESOLVE");assert.equal(s.enemies[0].hp,5);
});
test("rifle lethal mission entry resolves its speed-one death reaction before continuing activation",()=>{
  let s=E.create(123,"burial",0,null,"ludwig-rifle","center",{campaign:true,rulesVersion:9});
  s.world.assignments.find((a)=>a.enemyId==="scourge-beast").sideId="a";
  s.mission.targets.shelter={id:"shelter",card:10,tile:"tile-14",node:"tile-14:left",kind:"scourge-beast",initialTokens:0,tokens:0,complete:false,enemyId:null};
  s.mission.revealed.push(8,10);s.enemies=[{id:"scourge-beast-1",kind:"scourge-beast",figure:1,node:"tile-14:left",hp:2,missionId:"shelter"}];
  hand(s,["strength","endurance","vitality"]);s=go(s,"END_TURN");assert.equal(s.phase,"firearm_react");
  s=go(s,"FIREARM_ENTRY",{accept:true});assert.equal(s.phase,"mission_death");assert.equal(s.track,1);
  s=go(s,"MISSION_DEATH_DODGE",{cardId:E.hunter(s).hand.find((c)=>E.card(c).dodge).id,slot:0});
  assert.equal(s.phase,"refill");assert.equal(s.track,2);assert.equal(E.hunter(s).hp,6);
});
test("card43 recovery summons its beast immediately before the declared flame attack applies splash",()=>{
  let s=chapter(3),e=s.enemies.find((x)=>x.missionId==="main");
  s.mission.revealed.push(42,43);s.mission.discarded.push(41);s.mission.fog=[];
  E.hunter(s).position=e.node;E.hunter(s).firearmId="flamesprayer";E.hunter(s).ownedFirearms.push("flamesprayer");
  s.enemies=[e];bossAction(s,"recovery");s=go(s,"FIREARM",{enemyId:e.id});
  assert.equal(s.phase,"hunter");const summoned=s.enemies.find((x)=>!x.componentId);
  assert(summoned);assert.equal(summoned.node,e.node);assert.equal(summoned.hp,3);
  assert.equal(s.enemies.find((x)=>x.componentId).hp,10);
});
test("card43 waits for the farthest figure choice before applying the declared attack",()=>{
  let s=chapter(3),e=s.enemies.find((x)=>x.missionId==="main");
  s.mission.revealed.push(42,43);s.mission.discarded.push(41);s.mission.fog=[];
  E.hunter(s).position=e.node;E.hunter(s).firearmId="flamesprayer";E.hunter(s).ownedFirearms.push("flamesprayer");
  s.enemies=[e,...[1,2,3,4].map((figure)=>({id:`scourge-beast-${figure}`,kind:"scourge-beast",figure,node:"tile-14:center",hp:4}))];
  bossAction(s,"recovery");s=go(s,"FIREARM",{enemyId:e.id});
  assert.equal(s.phase,"spawn_choice");assert.equal(s.enemies.find((x)=>x.componentId).hp,10);
  assert.equal(s.combat.flameResolved,undefined);assert.equal(s.spawnChoices.length,4);
  const id=s.spawnChoices[0];s=go(s,"SPAWN_CHOICE",{enemyId:id});
  assert.equal(s.phase,"hunter");assert.equal(s.enemies.find((x)=>x.id===id).node,e.node);
  assert.equal(s.enemies.find((x)=>x.id===id).hp,3);
});
test("natural public exploration and rifle pull continuations round-trip by exact command replay",()=>{
  let s;
  for(let seed=1;seed<=20;seed++) {
    let candidate=E.create(seed,"burial",1,null,"ludwig-rifle","center",{campaign:false,rulesVersion:9});
    candidate=go(candidate,"MOVE",{cardId:E.hunter(candidate).hand[0].id});
    candidate=go(candidate,"STEP",{node:"tile-14:left"});
    candidate=go(candidate,"EXPLORE",{edge:"W"});
    candidate=go(candidate,"PLACE_TILE",{rotation:E.placementOptions(candidate)[0]});
    for(let step=0;step<10&&!['hunter','combat_choose'].includes(candidate.phase);step++) {
      if(candidate.phase==="move")candidate=go(candidate,"STOP_MOVE");
      else if(candidate.phase==="firearm_react")candidate=go(candidate,"FIREARM_ENTRY",{accept:false});
      else if(candidate.phase==="enemy_path")candidate=go(candidate,"ENEMY_STEP",{node:E.moveOptions(candidate)[0]});
      else if(candidate.phase==="spawn_choice")candidate=go(candidate,"SPAWN_CHOICE",{enemyId:candidate.spawnChoices[0]});
      else break;
    }
    if(candidate.phase==="hunter"&&E.pullCandidates(candidate).length){s=candidate;break;}
  }
  assert(s,"a seeded natural exploration must leave an adjacent pull target");
  const target=E.pullCandidates(s)[0];
  s=go(s,"ATTACK",{enemyId:target.id,cardId:E.hunter(s).hand[0].id,slot:1,pullIds:[target.id]});
  assert.equal(s.phase,"firearm_react");assert.deepEqual(E.importSave(E.exportSave(s)),s);
  s=go(s,"FIREARM_ENTRY",{accept:false});assert.equal(s.phase,"combat_react");
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
