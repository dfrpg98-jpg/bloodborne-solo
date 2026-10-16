'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine');
const {boot}=require('./helpers/ui-harness.cjs');
const commands=require('./fixtures/v074-shelter-natural-commands.json');
const key='bloodborne-hunt-v07';
let house;
function checkpoint(){
 if(!house){let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
  for(const command of commands.slice(0,75))s=E.dispatch(s,command);house=s;}
 return structuredClone(house);
}
function launch(state){return boot(state,E.missionView(state),E.rewardsView(state),{realInventory:true,
 storage:{[key]:E.exportSave(state)},engine:{create:E.create,importSave:E.importSave,exportSave:E.exportSave,
  dispatch:E.dispatch,missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
  interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView,applyChapelRuling:s=>s}});}
function saved(ui){assert.equal(ui.el('error').textContent,'');return E.importSave(ui.storage.get(key));}
function token(ui,id){const b=ui.el('chapterMap').querySelectorAll('[data-map-object-id]').find(x=>x.dataset.mapObjectId===id);assert(b);return b;}
function action(ui,id){return ui.el('mapContext').querySelectorAll('[data-context-id]').find(x=>x.dataset.contextId===id);}
function command(ui,type){return ui.buttons('decisions').find(x=>x.dataset.command===type);}
function card(ui,id='card-1'){const b=ui.el('hand').querySelectorAll('[data-card]').find(x=>x.dataset.card===id);assert(b);b.click();}
function cell(ui,node){const b=ui.el('chapterMap').querySelectorAll('[data-node]').find(x=>x.dataset.node===node&&!x.hasAttribute('data-entrance'));assert(b);b.click();}
function dispatch(state,...list){return list.reduce((s,c)=>E.dispatch(s,c),state);}

test('inspecting the house escort is presentation only and exposes neither paid interaction nor manual pickup',()=>{
 const s=checkpoint(),ui=launch(s),before=ui.storage.get(key);token(ui,'escort').click();
 assert.equal(ui.storage.get(key),before);assert.equal(ui.el('infoDialog').open,false);
 assert(!action(ui,'escort-move-start'));assert(!action(ui,'escort-pickup'));assert(!action(ui,'interact'));
 assert.match(ui.el('mapContext').textContent,/동행할지 확인/);
});

test('direct departure asks before spending the ordinary movement card and Yes carries with no interaction',()=>{
 const s=checkpoint(),ui=launch(s),before=ui.storage.get(key);cell(ui,'tile-11:street');card(ui);action(ui,'move').click();
 assert.equal(ui.el('escortDialog').open,true);assert.equal(ui.storage.get(key),before);
 ui.el('escortAccept').click();const result=saved(ui);
 assert.deepEqual(result,dispatch(s,{type:'MOVE',cardId:'card-1'},{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}));
 assert.equal(E.hunter(result).hand.length,E.hunter(s).hand.length-1);
 assert.equal(result.mission.escort.carrierId,result.activeHunterId);assert.equal(token(ui,'escort').dataset.objectNode,'tile-11:street');
 assert(!result.commands.slice(s.commands.length).some(c=>c.type==='INTERACT'));
});

test('an already started move asks on departure and No leaves the survivor in its named space',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'}),ui=launch(s),before=ui.storage.get(key);
 assert(!command(ui,'MISSION_PICKUP'));assert(!ui.buttons('missionActions').some(x=>x.dataset.command==='MISSION_PICKUP'));
 cell(ui,'tile-11:street');action(ui,'move').click();assert.equal(ui.storage.get(key),before);
 ui.el('escortDecline').click();assert.deepEqual(saved(ui),E.dispatch(s,{type:'STEP',node:'tile-11:street'}));
 assert.equal(saved(ui).mission.escort.node,'tile-11:house');assert.equal(saved(ui).mission.escort.carrierId,null);
});

test('No on an old armed save clears only the not-yet-acquired reservation before normal departure',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'},{type:'MISSION_PICKUP'}),ui=launch(s);
 cell(ui,'tile-11:street');action(ui,'move').click();ui.el('escortDecline').click();
 assert.deepEqual(saved(ui),dispatch(s,{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}));
 assert.equal(saved(ui).mission.escort.node,'tile-11:house');
});

test('being in the street of the same tile does not grant pickup from the house cell',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'},{type:'STEP',node:'tile-11:street'}),ui=launch(s),before=ui.storage.get(key);
 token(ui,'escort').click();assert(!action(ui,'escort-move-start'));assert(!action(ui,'escort-pickup'));
 assert(!command(ui,'MISSION_PICKUP'));assert(action(ui,'move'));assert.equal(ui.storage.get(key),before);
});

test('the independent room survivor retains its printed paid rescue interaction',()=>{
 let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
 for(const c of require('./fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,35))s=E.dispatch(s,c);
 const ui=launch(s),before=ui.storage.get(key);token(ui,'rescue').click();assert(action(ui,'interact'));
 assert(!command(ui,'MISSION_PICKUP'));assert.equal(ui.storage.get(key),before);assert.equal(ui.el('escortDialog').open,false);
 assert.match(ui.el('mapContext').textContent,/1장/);
});

test('inspecting a carried escort offers neither pickup nor dropping and never asks again on the next step',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'},{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}),ui=launch(s),before=ui.storage.get(key);
 token(ui,'escort').click();assert(!action(ui,'escort-pickup'));assert(!action(ui,'interact'));
 assert.match(ui.el('mapContext').textContent,/데리고 이동 중/);assert.equal(ui.storage.get(key),before);
 cell(ui,'tile-11:house');action(ui,'move').click();assert.equal(ui.el('escortDialog').open,false);
 assert.equal(saved(ui).mission.escort.carrierId,s.activeHunterId);
});
