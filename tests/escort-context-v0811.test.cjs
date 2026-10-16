'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),Context=require('../src/hunt-context');
const H=E.hunter;
const escortTarget=node=>({kind:'cell',node,objectKind:'token',objectId:'escort'});
function checked(state) {E.assertState(state);assert.deepEqual(E.importSave(E.exportSave(state)),state);return state;}
function command(state,value) {return checked(E.dispatch(state,value));}
function house(startingConsumable=null) {
  let s=E.create(14,'beast-claw',0,startingConsumable,'hunter-pistol','center',{campaign:true});
  s=command(s,{type:'MOVE',cardId:H(s).hand[0].id});
  s=command(s,{type:'EXPLORE',edge:'N'});
  s=command(s,{type:'PLACE_TILE',rotation:1});
  s=command(s,{type:'STEP',node:'tile-11:house'});
  assert.equal(s.phase,'hunter');assert.equal(H(s).position,'tile-11:house');
  assert(s.mission.revealed.includes(8));assert.equal(s.mission.escort.node,'tile-11:house');
  return s;
}
function inspect(s,target=escortTarget('tile-11:house'),cardId=H(s).hand[0]?.id) {
  const original=JSON.stringify(s);
  const view=Context.view(s,target,{cardId});assert.equal(JSON.stringify(s),original,'inspection must not perform or pay for an action');
  return view;
}
function start(s) {
  s=command(s,{type:'MOVE',cardId:H(s).hand[0].id});
  return command(s,{type:'MISSION_PICKUP'});
}
function normalRoom() {
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  for(const value of require('./fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,35))s=E.dispatch(s,value);
  return checked(s);
}

test('public mission08 token inspection explains the departure prompt without a paid interaction or a manual reservation button',()=>{
  const s=house(),view=inspect(s);
  assert.match(view.hint,/이동해 나갈 때/);assert.match(view.hint,/동행할지 확인/);
  assert(!view.actions.some(a=>a.id==='interact'||/^escort-/.test(a.id)));
  assert.equal(s.revision,4);assert.equal(s.mission.escort.carrierId,null);
});

test('ordinary movement still requires an existing hand card without opting into escort inside the context command',()=>{
  const s=house(),target={kind:'cell',node:'tile-11:street'};
  const unchosen=inspect(s,target,null).actions.find(a=>a.id==='move');
  assert(unchosen&&!unchosen.enabled);assert.match(unchosen.reason,/카드/);
  const chosen=inspect(s,target).actions.find(a=>a.id==='move');assert(chosen.enabled);
  assert.deepEqual(chosen.sequence.map(c=>c.type),['MOVE','STEP']);
});

test('engine pickup remains free and acquires the token only on actual departure',()=>{
  const before=house(),after=start(before);
  assert.equal(after.phase,'move');assert.equal(H(after).hand.length,H(before).hand.length-1);
  assert.equal(H(after).position,'tile-11:house');assert.equal(after.mission.escort.node,'tile-11:house');
  assert.equal(after.mission.escort.carrierId,null);assert.equal(after.mission.escort.pickup,true);
  assert.equal(after.enemyDeck.length,before.enemyDeck.length);assert.equal(after.move.remaining,2);
  const departed=command(after,{type:'STEP',node:'tile-11:street'});
  assert.equal(departed.mission.escort.carrierId,departed.activeHunterId);assert.equal(departed.mission.escort.node,null);
  assert.equal(H(departed).hand.length,H(after).hand.length);assert.equal(departed.move.remaining,1);
});

test('declining a reservation is distinct from dropping an already carried survivor',()=>{
  let moving=start(house());const hand=H(moving).hand.length,remaining=moving.move.remaining;
  moving=command(moving,{type:'MISSION_PICKUP'});
  assert.equal(H(moving).hand.length,hand);assert.equal(moving.move.remaining,remaining);
  moving=command(moving,{type:'STEP',node:'tile-11:street'});
  assert.equal(moving.mission.escort.node,'tile-11:house');assert.equal(moving.mission.escort.carrierId,null);
  const carried=command(start(house()),{type:'STEP',node:'tile-11:street'});
  assert(!E.missionActions(carried).some(a=>a.command.type==='MISSION_PICKUP'));
});

test('a survivor in the named house cell cannot be picked up from the street of that tile',()=>{
  let s=command(house(),{type:'MOVE',cardId:H(house()).hand[0].id});
  s=command(s,{type:'STEP',node:'tile-11:street'});s=command(s,{type:'STOP_MOVE'});
  const remote=inspect(s);assert.match(remote.hint,/생존자가 있는 칸/);
  assert(!E.missionActions(s).some(a=>a.command.type==='MISSION_PICKUP'));
  const move=remote.actions.find(a=>a.id==='move');assert(move.enabled);
  for(const c of move.sequence)s=command(s,c);
  assert.equal(H(s).position,'tile-11:house');assert.equal(s.move.remaining,1);
  assert(E.missionActions(s).some(a=>a.command.type==='MISSION_PICKUP'));
});

test('an old armed save keeps its engine selection while inspection does not change it',()=>{
  let s=start(house());s=command(s,{type:'STOP_MOVE'});
  const before=JSON.stringify(s),view=inspect(s);
  assert.match(view.hint,/동행할지 확인/);assert.equal(JSON.stringify(s),before);
  assert.equal(s.mission.escort.pickup,true);
});

test('explicit departure escort retains the printed return-home rule for a real teleport and voluntary Dream entry',()=>{
  let teleported=start(house('bold-mark'));teleported=command(teleported,{type:'STEP',node:'tile-11:street'});
  teleported=command(teleported,{type:'STOP_MOVE'});
  const mark=H(teleported).consumables.find(i=>i.kind==='bold-mark');assert(mark);
  teleported=command(teleported,{type:'USE_CONSUMABLE',itemId:mark.id,node:'tile-14:center'});
  assert.equal(H(teleported).position,'tile-14:center');assert.equal(teleported.mission.escort.node,'tile-11:house');
  assert.equal(teleported.mission.escort.carrierId,null);assert.equal(teleported.mission.escort.pickup,false);
  let dreamed=start(house());dreamed=command(dreamed,{type:'STEP',node:'tile-11:street'});
  dreamed=command(dreamed,{type:'STOP_MOVE'});dreamed=command(dreamed,{type:'DREAM',cardId:H(dreamed).hand[0].id});
  assert(H(dreamed).inDream);assert.equal(dreamed.mission.escort.node,'tile-11:house');assert.equal(dreamed.mission.escort.carrierId,null);
});

test('the independent mission12 rescue token keeps its ordinary paid interaction for both object and cell inspection',()=>{
  const s=normalRoom();assert.equal(E.interactionOptions(s).missionRescue,true);
  for(const target of [{kind:'cell',node:'tile-03:room'},
    {kind:'cell',node:'tile-03:room',objectKind:'token',objectId:'rescue'}]) {
    const view=inspect(s,target),interaction=view.actions.find(a=>a.id==='interact');
    assert(interaction&&interaction.enabled);assert.match(interaction.cost,/카드 1장/);
    assert(!view.actions.some(a=>/^escort-/.test(a.id)),'mission12 never gains mission08 free pickup semantics');
  }
});

