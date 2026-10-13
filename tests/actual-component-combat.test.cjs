const test=require("node:test"),assert=require("node:assert/strict");
const {E,A,go,fixture,enemyAction,attack,dodge,hand,chapter}=require("./actual-combat-helper.cjs");
const M=require("../chapter-engine.js"), Missions=require("../mission-engine.js");
test("female fury reveals a weakened basic attack before an unresolved slower hunter attack",()=>{
  let s=attack(enemyAction(fixture("female-patient-a"),"special","basic"),1);
  assert.equal(s.combat.action.code,"female-fury"); s=go(s,"RESOLVE");
  assert.equal(s.phase,"combat_react"); assert.equal(E.hunter(s).hp,4);
  assert.equal(s.combat.action.kind,"basic"); assert.equal(s.combat.action.damage,0);
  s=go(s,"RESOLVE"); assert.equal(E.hunter(s).hp,4); assert.equal(s.enemies.length,0);
});
test("female fury does not repeat an already resolved hunter hit on its additional card",()=>{
  let s=attack(enemyAction(fixture("female-patient-a"),"special","basic"),0);
  s=go(s,"RESOLVE"); assert.equal(s.enemies[0].hp,1);
  assert.equal(s.combat.attack,null); s=go(s,"RESOLVE"); assert.equal(s.enemies[0].hp,1);
});
test("numbing mist removes female fury's additional reveal while retaining its attack damage",()=>{
  let s=fixture("female-patient-a",1,undefined,{item:"numbing-mist"});
  s=attack(enemyAction(s,"special"),0,{itemIds:[E.hunter(s).consumables[0].id]});
  s=go(s,"RESOLVE"); assert.equal(s.phase,"hunter"); assert.equal(E.hunter(s).hp,4);
  assert.equal(s.enemyDiscard.length,1);
});
test("female blood disease reflects actual defended attack damage and has a separate speed-three dodge",()=>{
  let s=attack(enemyAction(fixture("female-patient-a"),"ability"),1);
  assert.equal(s.phase,"boss_react"); assert.equal(s.enemies.length,0);
  assert.deepEqual(E.combatReaction(s),{title:"화혈병",damage:3,dodgeSpeed:3,effects:["독"]});
  s=go(s,"RESOLVE"); assert.equal(E.hunter(s).hp,3); assert(E.hunter(s).status.poison);
  let avoided=attack(enemyAction(fixture("female-patient-a"),"ability"),1);
  avoided=dodge(avoided,0); assert.equal(avoided.phase,"hunter"); assert.equal(E.hunter(avoided).hp,6);
  assert(!E.hunter(avoided).status.poison);
});
test("female blood disease status respects immunity and its damage does not receive frenzy attack bonus",()=>{
  let s=fixture("female-patient-a",1,["indomitable","endurance","strength"]);
  E.hunter(s).status.frenzy=true; s=attack(enemyAction(s,"ability"),1);
  assert.equal(E.combatReaction(s).damage,2); s=go(s,"RESOLVE");
  assert.equal(E.hunter(s).hp,4); assert(!E.hunter(s).status.poison);
});
test("female B vomit cannot be dodged and applies its printed poison and stun",()=>{
  let s=attack(enemyAction(fixture("female-patient-b"),"special"),0);
  assert(!E.canDodge(s,E.hunter(s).hand[0].id,1)); s=go(s,"RESOLVE");
  assert.equal(E.hunter(s).hp,3); assert(E.hunter(s).status.poison); assert.equal(s.phase,"stun");
  s=go(s,"STUN_DISCARD",{cardId:E.hunter(s).hand[0].id}); assert.equal(s.phase,"hunter");
});
test("Iosefka pistol requires a speed-three dodge before another public action and interrupts the declared hunter attack on failure",()=>{
  let s=attack(enemyAction(fixture("iosefka-hostile"),"ability","basic"),1);
  assert.equal(s.phase,"boss_react"); assert.equal(E.combatReaction(s).dodgeSpeed,3);
  s=go(s,"RESOLVE"); assert.equal(s.phase,"combat_react"); assert(s.combat.cancelHunter);
  s=go(s,"RESOLVE"); assert.equal(s.enemies[0].hp,10); assert.equal(E.hunter(s).hp,4);
  assert(E.hunter(s).status.poison);
  let dodged=attack(enemyAction(fixture("iosefka-hostile"),"ability","basic"),1);
  dodged=go(dodge(dodged,0),"RESOLVE"); assert(!dodged.combat.cancelHunter);
  dodged=go(dodged,"RESOLVE"); assert.equal(dodged.enemies[0].hp,7);
});
test("Iosefka augur's direct forced movement is prevented by a dodge",()=>{
  let s=go(attack(enemyAction(fixture("iosefka-hostile"),"special"),1),"RESOLVE");
  assert.equal(s.phase,"boss_move"); assert.equal(E.hunter(s).hp,3);
  assert.equal(s.enemies[0].hp,7); const to=E.bossMoveOptions(s)[0]; s=go(s,"BOSS_STEP",{node:to});
  assert.equal(E.hunter(s).position,to);
  let avoided=go(dodge(attack(enemyAction(fixture("iosefka-hostile"),"special"),1),0),"RESOLVE");
  assert.equal(avoided.phase,"hunter"); assert.equal(E.hunter(avoided).position,"tile-14:center");
});
test("card31 replaces either patient face's special attack completely in version nine",()=>{
  for(const spec of ["female-patient-a","female-patient-b"]) {
    const s=chapter(2), e={missionId:"unit"}; s.mission.targets.unit={card:31};
    const d=Missions.targetDef(s,e,A.definition(spec));
    assert.equal(d.special.name,"갈가리 찢기"); assert.equal(d.special.damage,3);
    assert(d.special.stun); assert.equal(d.special.code,undefined); assert.equal(d.special.poison,false);
    assert.equal(d.special.undodgeable,false);
  }
});
test("a released chapter-three boss reset clears separate sheet insight and restores its current phase health",()=>{
  let s=chapter(3), e=s.enemies.find((x)=>x.missionId==="main");
  s.mission.revealed.push(42);s.mission.discarded.push(41);s.mission.fog=[];
  e.insightTokens=2; e.hp=5; s.track=4; E.hunter(s).position="tile-14:center";
  s=go(s,"DREAM",{cardId:E.hunter(s).hand[0].id});
  e=s.enemies.find((x)=>x.missionId==="main");assert.equal(e.hp,10);assert.equal(e.insightTokens,0);
});
test("patient face is randomly prepared once per chapter and persists through later resets",()=>{
  const seen=new Set();
  for(let seed=1;seed<=12;seed++) {
    let s=chapter(2,[16],seed), at="tile-17:top";
    const p=s.world.tileDeck.indexOf("tile-17");assert(p>=0);
    let added=false;
    for(const anchor of M.openExits(s.world)) {
      const rotation=M.placementOptions(s.world,"tile-17",anchor,false)[0];if(rotation===undefined)continue;
      const [dx,dy]=M.vectors[anchor.edge];s.world.tiles.push({tileId:"tile-17",x:anchor.x+dx,y:anchor.y+dy,rotation});
      s.world.tileDeck.splice(p,1);added=true;break;
    }
    assert(added); E.hunter(s).position="tile-17:lower-left";hand(s,["strength","endurance","vitality"]);
    s=go(s,"MOVE",{cardId:E.hunter(s).hand[0].id});s=go(s,"STEP",{node:at});
    if(s.phase==="move")s=go(s,"STOP_MOVE");
    const e=s.enemies.find((x)=>x.missionId==="patient");assert(e);
    seen.add(e.componentSpec);assert.equal(e.componentSpec,s.world.componentFaces.femalePatient);assert.equal(e.hp,3);
    E.hunter(s).position="tile-14:center";s.phase="hunter";s.track=4;
    s=go(s,"DREAM",{cardId:E.hunter(s).hand[0].id});
    assert.equal(s.enemies.find((x)=>x.missionId==="patient").componentSpec,e.componentSpec);
    assert.equal(s.world.componentFaces.femalePatient,e.componentSpec);
  }
  assert.deepEqual([...seen].sort(),["female-patient-a","female-patient-b"]);
});
