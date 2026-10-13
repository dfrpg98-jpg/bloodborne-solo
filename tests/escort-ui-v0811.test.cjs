'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine');
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

test('inspecting the house escort offers walking departure rather than paid interaction and never alters the actual save',()=>{
 const s=checkpoint(),ui=launch(s),before=ui.storage.get(key);token(ui,'escort').click();
 assert.equal(ui.storage.get(key),before);assert.equal(ui.el('infoDialog').open,false);
 assert(action(ui,'escort-move-start'));assert(action(ui,'escort-move-start').disabled);
 assert(!action(ui,'interact'));assert.match(ui.el('mapContext').textContent,/생존자/);
 assert.match(ui.el('mapContext').textContent,/상호작용/);card(ui);
 assert.equal(action(ui,'escort-move-start').disabled,false);assert.equal(ui.storage.get(key),before);
});

test('starting an explicit escort uses only the ordinary MOVE hand card; leaving the house attaches the survivor without INTERACT',()=>{
 const s=checkpoint(),ui=launch(s);token(ui,'escort').click();card(ui);action(ui,'escort-move-start').click();
 const ready=saved(ui),reference=dispatch(s,{type:'MOVE',cardId:'card-1'},{type:'MISSION_PICKUP'});
 assert.deepEqual(ready,reference);assert.equal(ready.phase,'move');assert.equal(ready.mission.escort.node,'tile-11:house');
 assert.equal(ready.mission.escort.carrierId,null);assert.equal(ready.mission.escort.pickup,true);
 assert.equal(E.hunter(ready).hand.length,E.hunter(s).hand.length-1);
 assert(command(ui,'MISSION_PICKUP'));assert.match(ui.el('decisions').textContent,/남겨/);
 assert.match(ui.el('decisions').textContent,/추가 비용 없음/);
 cell(ui,'tile-11:street');action(ui,'move').click();
 const departed=saved(ui);assert.deepEqual(departed,E.dispatch(reference,{type:'STEP',node:'tile-11:street'}));
 assert.equal(departed.mission.escort.carrierId,departed.activeHunterId);assert.equal(departed.mission.escort.node,null);
 assert.equal(E.hunter(departed).hand.length,E.hunter(s).hand.length-1);
 assert(!departed.commands.slice(s.commands.length).some(c=>c.type==='INTERACT'));
 assert.equal(token(ui,'escort').dataset.objectNode,'tile-11:street');
});

test('an already started move exposes the free pickup in the action panel and cancellation leaves the survivor at home',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'}),ui=launch(s),before=E.hunter(s).hand.length;
 assert(command(ui,'MISSION_PICKUP'));assert.match(ui.el('decisions').textContent,/추가 비용 없음/);
 assert(!ui.buttons('missionActions').some(x=>x.dataset.command==='MISSION_PICKUP'));
 command(ui,'MISSION_PICKUP').click();assert.equal(saved(ui).mission.escort.pickup,true);
 command(ui,'MISSION_PICKUP').click();assert.equal(saved(ui).mission.escort.pickup,false);
 assert.equal(E.hunter(saved(ui)).hand.length,before);
 cell(ui,'tile-11:street');action(ui,'move').click();const result=saved(ui);
 assert.equal(result.mission.escort.node,'tile-11:house');assert.equal(result.mission.escort.carrierId,null);
 assert.deepEqual(result,dispatch(s,{type:'MISSION_PICKUP'},{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}));
});

test('ordinary direct map movement retains the option to leave the escort behind with the exact existing MOVE and STEP sequence',()=>{
 const s=checkpoint(),ui=launch(s);cell(ui,'tile-11:street');card(ui);action(ui,'move').click();
 assert.deepEqual(saved(ui),dispatch(s,{type:'MOVE',cardId:'card-1'},{type:'STEP',node:'tile-11:street'}));
 assert.equal(saved(ui).mission.escort.carrierId,null);assert.equal(saved(ui).mission.escort.node,'tile-11:house');
});

test('being in the street of the same tile does not grant pickup from the different house cell',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'},{type:'STEP',node:'tile-11:street'}),ui=launch(s),before=ui.storage.get(key);
 token(ui,'escort').click();assert(!action(ui,'escort-move-start'));assert(!action(ui,'escort-pickup'));
 assert(!command(ui,'MISSION_PICKUP'));assert(action(ui,'move'));assert.equal(ui.storage.get(key),before);
});

test('the different room survivor retains its printed paid rescue interaction',()=>{
 let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
 for(const c of require('./fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,35))s=E.dispatch(s,c);
 const ui=launch(s),before=ui.storage.get(key);token(ui,'rescue').click();assert(action(ui,'interact'));
 assert(!action(ui,'escort-move-start'));assert(!command(ui,'MISSION_PICKUP'));assert.equal(ui.storage.get(key),before);
 assert.match(ui.el('mapContext').textContent,/1장/);
});


test('inspecting a carried escort explains walking companionship without offering another pickup or interaction',()=>{
 const s=dispatch(checkpoint(),{type:'MOVE',cardId:'card-1'},{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}),ui=launch(s),before=ui.storage.get(key);
 token(ui,'escort').click();assert(!action(ui,'escort-move-start'));assert(!action(ui,'escort-pickup'));
 assert(!action(ui,'interact'));assert.match(ui.el('mapContext').textContent,/데리고 이동 중/);
 assert.equal(ui.storage.get(key),before);assert.deepEqual(saved(ui),s);
});
