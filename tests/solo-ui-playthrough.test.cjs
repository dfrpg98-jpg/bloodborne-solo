const test=require('node:test'), assert=require('node:assert/strict');
const E=require('../hunt-engine'), {replayPublicTrace}=require('./helpers/public-command-ui.cjs');
const path=require('./fixtures/full-campaign-actual-v10-commands.json');
test('actual offline controller projects 325 original commands through public controls and restores every resulting save',t=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  const replay=replayPublicTrace(s,path,{label:'three-chapter controller'});
  s=replay.state;assert.equal(replay.originalCommandCount,325);
  t.diagnostic(JSON.stringify({originalCommandCount:replay.originalCommandCount,uiCommandCount:replay.uiCommandCount,deferredReservations:replay.deferredReservations}));
  assert.equal(s.result,'campaign-win');assert.equal(s.mission.chapter,3);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
