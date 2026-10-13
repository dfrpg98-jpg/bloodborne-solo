const test=require('node:test'),assert=require('node:assert/strict'),E=require('../hunt-engine.js');
const commands=require('./fixtures/full-campaign-actual-v10-commands.json');
test('released rules-eleven campaign wins all three chapters from 325 public commands and resumes each actual boss phase',()=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:11}),phases=new Set();
  assert.equal(s.setup.rulesVersion,11);
  for(const command of commands){
    s=E.dispatch(s,command);
    const boss=s.enemies.find(e=>e.componentId==='cleric-beast'&&e.missionId==='main');
    if(boss){
      const mark=`${s.mission.chapter}:${boss.componentPhase}`;
      assert.equal(E.enemyDef(s,boss).maxHp,boss.componentPhase===1?10:8);
      if(!phases.has(mark)){s=E.importSave(E.exportSave(s));phases.add(mark);}
    }
  }
  assert.deepEqual([...phases],['2:1','2:2','3:1','3:2']);
  assert.equal(s.result,'campaign-win');assert.equal(s.mission.chapter,3);
  assert.equal(s.track,11);assert.equal(E.hunter(s).hp,6);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
