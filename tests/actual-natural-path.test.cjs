const test=require('node:test'),assert=require('node:assert/strict'),E=require('../hunt-engine.js');
const commands=require('./fixtures/actual-boss-natural-commands.json');
test('new solo commands naturally reach the actual chapter-two boss and replay its insight movement decision',()=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:9});
  for(const c of commands)s=E.dispatch(s,c);
  assert.equal(s.setup.rulesVersion,9);
  assert.equal(s.mission.chapter,2);
  assert.deepEqual(s.mission.completed,[26,28]);
  assert.equal(s.phase,'combat_react');
  const boss=s.enemies.find(e=>e.missionId==='main');
  assert.equal(boss.hp,10); assert.equal(boss.insightTokens,0);
  assert.equal(E.enemyDef(s,boss).actual,true);
  assert.equal(s.combat.action.name,'돌진 휩쓸기');
  assert(E.canBossInsight(s));
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  s=E.dispatch(s,{type:'BOSS_INSIGHT'});
  assert.equal(s.enemies.find(e=>e.id===boss.id).insightTokens,1);
  assert.equal(E.hunter(s).firearmReady,false);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  s=E.dispatch(s,{type:'RESOLVE'});
  assert.equal(E.hunter(s).hp,3); assert.equal(s.phase,'boss_move');
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  const target=E.bossMoveOptions(s)[0];
  s=E.dispatch(s,{type:'BOSS_STEP',node:typeof target==='string'?target:target.id});
  assert.equal(s.enemies.find(e=>e.id===boss.id).hp,10);
  assert.notEqual(s.enemies.find(e=>e.id===boss.id).node,E.hunter(s).position);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});

test('public version-ten commands complete chapters one and two with actual health decks movement and a final dream',()=>{
  const path=require('./fixtures/actual-chapter-two-win-commands.json');
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:10});
  const phases=new Set(),checkpoints=new Set();
  for(const c of path){
    s=E.dispatch(s,c);
    const boss=s.enemies.find(e=>e.missionId==='main');
    if(s.mission.chapter===2&&boss){
      assert.equal(E.enemyDef(s,boss).actual,true); phases.add(boss.componentPhase);
      assert.equal(E.enemyDef(s,boss).maxHp,boss.componentPhase===1?10:8);
      if(!checkpoints.has(boss.componentPhase)){
        assert.deepEqual(E.importSave(E.exportSave(s)),s);checkpoints.add(boss.componentPhase);
      }
    }
  }
  assert.deepEqual([...phases],[1,2]);
  assert.equal(s.mission.chapter,2);assert.equal(s.result,'chapter-win');
  assert.equal(s.phase,'over');assert.equal(s.track,16);
  assert.equal(s.mission.won,true);assert.equal(s.mission.chapterDream,true);
  assert.deepEqual(s.mission.completed,[26,28,23]);
  assert.deepEqual(s.mission.history[0].completed,[7,15,4]);
  assert.equal(E.hunter(s).inDream,true);assert.equal(E.hunter(s).hp,6);
  assert.equal(E.hunter(s).deck.length,12);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
