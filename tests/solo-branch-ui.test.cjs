const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../hunt-engine'),{clickCommand}=require('./helpers/public-command-ui.cjs');
const fixtureDir=path.join(__dirname,'fixtures');
const fixtures=fs.readdirSync(fixtureDir).filter(file=>/^v074-.*-natural-commands\.json$/.test(file)).sort();
const setupsPath=path.join(fixtureDir,'v074-mission-natural-setups.json');
const setups=fs.existsSync(setupsPath)?JSON.parse(fs.readFileSync(setupsPath,'utf8')):{};
for(const file of fixtures)test(`natural branch controls and restored final decisions: ${file}`,()=>{
  const setup=setups[file]||{seed:90,weaponId:'burial',face:1,firearmId:'hunter-pistol',startSpace:'center',rulesVersion:11};
  assert.equal(setup.startingConsumable??null,null);
  let s=E.create(setup.seed,setup.weaponId,setup.face,null,setup.firearmId,setup.startSpace,{campaign:true,rulesVersion:setup.rulesVersion});
  const commands=require('./fixtures/'+file),seen=new Set();let checked=0;
  for(let i=0;i<commands.length;i++){
    const c=commands[i],next=E.dispatch(s,c);
    const special=c.type.startsWith('MISSION_')||(c.type==='INTERACT'&&c.mission);
    const missionEnemy=s.enemies.find(e=>e.id===(c.enemyId||s.combat?.enemyId))?.missionId;
    const conclusion=missionEnemy&&next.mission.completed.length>s.mission.completed.length;
    const identity=JSON.stringify([s.phase,c.type,c.choice,c.mission,c.count]);
    if((special&&!seen.has(identity))||conclusion||i===commands.length-1){
      try{s=clickCommand(s,c);}catch(error){throw new Error(`${file} UI command ${i+1}: ${error.message}`,{cause:error});}
      seen.add(identity);checked++;
    }else s=next;
  }
  assert(checked>=2,'covers an optional mission decision and its final resolution');
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  // A lethal final blow may defer the order of the mission resolution and death.
  // Exercise every real offered order through the controller after reloading.
  if(s.phase==='mission_death'){
    while(s.rewardChoices.length){
      const q=s.rewardChoices[0];
      s=clickCommand(s,q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId});
    }
    const actions=E.missionActions(s);assert(actions.length>0);
    for(const action of actions)clickCommand(s,action.command);
  }
});
