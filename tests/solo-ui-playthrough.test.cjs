const test=require('node:test'), assert=require('node:assert/strict');
const E=require('../hunt-engine'), {clickCommand}=require('./helpers/public-command-ui.cjs');
const path=require('./fixtures/full-campaign-actual-v10-commands.json');
test('actual offline controller completes three chapters through enabled controls and reloads each of 325 public decisions',()=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
  for(let i=0;i<path.length;i++){
    try{s=clickCommand(s,path[i]);}catch(error){throw new Error(`UI command ${i+1}/${path.length}: ${error.message}`,{cause:error});}
  }
  assert.equal(s.result,'campaign-win');assert.equal(s.mission.chapter,3);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
