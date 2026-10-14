'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),F=require('../hunt-mission-feedback'),{boot}=require('./helpers/ui-harness.cjs');
const fixture=require('./fixtures/weapon-campaign-completion/beast-claw-0.json');
function pendingMovement(){
 let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,
  qa:{preset:'custom',startRewards:[],startConsumables:[]}});
 for(const original of fixture.slice(0,110)){
  const c=original.type==='MISSION_CHOICE'&&original.choice==='attack'?{...original,choice:'release'}:original;
  const using=()=>E.killReactionActions(s).some(a=>a.command.type===c.type&&a.command.rewardId===c.rewardId&&a.command.enemyId===c.enemyId);
  while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
  s=E.dispatch(s,c);
 }
 assert.equal(s.phase,'move');assert.equal(s.move.source,'weapon');assert.equal(E.hunter(s).position,'tile-17:top');
 assert.strictEqual(E.applyTileSpeedRuling(s),s);assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;
}
async function imported(s){
 const initial=E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14});
 const ui=boot(initial,E.missionView(initial),E.rewardsView(initial),{realInventory:true,engine:{...E},
  storage:{'bloodborne-hunt-v07':E.exportSave(initial),'bloodborne-hunt-active-mode':'normal'}});
 await ui.el('file').onchange({target:{files:[{text:async()=>E.exportSave(s)}],value:'qa.json'}});
 assert.equal(ui.el('error').textContent,'');assert.deepEqual(E.importSave(ui.storage.get('bloodborne-hunt-qa-v1')),s);
 assert.equal(ui.el('missionUpdateDialog').open,false,'Import must not replay historical notices');return ui;
}
test('delayed tile-policy adoption removes the stale exemption from the newly disclosed mission notice',async()=>{
 const before=pendingMovement(),ui=await imported(before);
 ui.el('decisions').querySelectorAll('[data-command]').find(b=>b.dataset.command==='STOP_MOVE'&&!b.disabled).click();
 const actual=E.importSave(ui.storage.get('bloodborne-hunt-qa-v1')),enemy=actual.enemies.find(e=>e.missionId==='patient');
 assert.deepEqual(actual,E.applyTileSpeedRuling(E.dispatch(before,{type:'STOP_MOVE'})),'Only the original STOP_MOVE followed by safe adoption may commit');
 assert.deepEqual(actual.commands.slice(before.commands.length).map(c=>c.type),['STOP_MOVE','APPLY_TILE_SPEED_RULING']);
 assert.equal(actual.phase,'hunter');assert.equal(E.enemyTileSpeedPenalty(actual,enemy),1);assert.equal(ui.el('error').textContent,'');
 const text=ui.el('missionUpdateList').textContent;
 assert.match(text,/오에돈 예배당 대학살/);assert.match(text,/갈가리 찢기/);assert.match(text,/피해 3/);assert.match(text,/기절/);
 assert.doesNotMatch(text,/속도 감소를 받지 않습니다/,'New notice must reflect the final adopted policy');
 const save=ui.storage.get('bloodborne-hunt-qa-v1');ui.el('missionUpdateContinue').click();
 ui.el('openMissionUpdates').click();assert.equal(ui.el('missionUpdateList').textContent,text,'Manual reopening preserves the corrected original notice');
 assert.equal(ui.storage.get('bloodborne-hunt-qa-v1'),save,'Acknowledgment and reopening spend no action');
});
test('importing an already revealed legacy attack still defers policy adoption and opens no old notice',async()=>{
 const s=require('./helpers/tile-speed-checkpoints.cjs').missionCheckpoint(31).legacy,ui=await imported(s);
 const actual=E.importSave(ui.storage.get('bloodborne-hunt-qa-v1'));
 assert.equal(actual.combat.action.speed,3);assert.equal(actual.tileSpeedRuling,undefined);
 assert.equal(ui.el('missionUpdateDialog').open,false);assert.equal(ui.el('missionUpdateList').textContent,'');
});
test('policy reconciliation preserves other batch notices and never rewrites prior notice objects',()=>{
 const previous=pendingMovement(),following=E.dispatch(previous,{type:'STOP_MOVE'}),adopted=E.applyTileSpeedRuling(following);
 const options={E,publicText:require('../hunt-public-text')},events=F.describe(previous,following,options);
 assert.equal(events.length,1);assert(events[0].effects.some(text=>text.includes('감소를 받지')));
 const first=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14});
 const earlier=F.describe(null,first,options),batch=[...earlier,...events],original=structuredClone(batch);
 const corrected=F.reconcileTileSpeedAdoption(batch,following,adopted,{E});
 assert.deepEqual(batch,original,'Previously recorded notice objects must not be mutated');
 assert.equal(corrected.length,batch.length,'Policy adoption must not synthesize an extra mission event');
 for(let i=0;i<earlier.length;i++)assert.strictEqual(corrected[i],earlier[i],'Earlier mission stages retain their original content and identity');
 assert.deepEqual(corrected.at(-1).effects,events[0].effects.filter(text=>!text.includes('감소를 받지')));
 assert.equal(corrected.at(-1).key,events[0].key,'The accepted gameplay event keeps its identity');
});
test('policy-only reconciliation cannot announce unseen missions or change a deferred legacy attack',()=>{
 const previous=pendingMovement(),following=E.dispatch(previous,{type:'STOP_MOVE'}),adopted=E.applyTileSpeedRuling(following);
 const empty=[];assert.strictEqual(F.reconcileTileSpeedAdoption(empty,following,adopted,{E}),empty);
 const legacy=require('./helpers/tile-speed-checkpoints.cjs').missionCheckpoint(31).legacy;
 const events=F.describe(previous,following,{E,publicText:require('../hunt-public-text')});
 assert.strictEqual(F.reconcileTileSpeedAdoption(events,legacy,E.applyTileSpeedRuling(legacy),{E}),events);
 assert.strictEqual(F.reconcileTileSpeedAdoption(events,adopted,adopted,{E}),events);
});
