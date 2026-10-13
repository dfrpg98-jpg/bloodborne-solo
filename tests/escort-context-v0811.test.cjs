'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),Context=require('../hunt-context');
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
  const action=inspect(s).actions.find(action=>action.id==='escort-move-start');assert(action&&action.enabled);
  for(const value of action.sequence)s=command(s,value);return s;
}
function normalRoom() {
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  for(const value of require('./fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,35))s=E.dispatch(s,value);
  return checked(s);
}

test('public mission08 token inspection offers departure escort with no INTERACT or additional hand-card charge',()=>{
  const s=house(),view=inspect(s),action=view.actions.find(a=>a.id==='escort-move-start');
  assert(action&&action.enabled);assert.equal(action.label,'생존자와 이동 시작');
  assert.match(action.cost,/손패 1장/);assert.match(action.cost,/추가 비용 없음/);
  assert.match(view.hint,/이동해 나갈 때/);
  assert.deepEqual(action.sequence.map(c=>c.type),['MOVE','MISSION_PICKUP']);
  assert(!view.actions.some(a=>a.id==='interact'||a.command?.type==='INTERACT'));
  assert.equal(s.revision,4);assert.equal(s.mission.escort.carrierId,null);
});

test('escort movement requires choosing an existing hand card before any command is executed',()=>{
  const s=house(),view=inspect(s,escortTarget('tile-11:house'),null);
  const action=view.actions.find(a=>a.id==='escort-move-start');assert(action);assert.equal(action.enabled,false);
  assert.match(action.reason,/손패/);assert.equal(H(s).hand.length,2);
  const stale=inspect(s,escortTarget('tile-11:house'),'missing-card');
  assert.equal(stale.actions.find(a=>a.id==='escort-move-start').enabled,false);
});

test('explicit escort start pays for MOVE once, arms free pickup and carries the token only after an actual departure',()=>{
  const before=house(),after=start(before);
  assert.equal(after.phase,'move');assert.equal(H(after).hand.length,H(before).hand.length-1);
  assert.equal(H(after).position,'tile-11:house');assert.equal(after.mission.escort.node,'tile-11:house');
  assert.equal(after.mission.escort.carrierId,null);assert.equal(after.mission.escort.pickup,true);
  assert.equal(after.enemyDeck.length,before.enemyDeck.length);assert.equal(after.enemyDiscard.length,before.enemyDiscard.length);
  assert.equal(after.move.remaining,2);assert.equal(H(after).hp,H(before).hp);
  const departed=command(after,{type:'STEP',node:'tile-11:street'});
  assert.equal(departed.mission.escort.carrierId,departed.activeHunterId);assert.equal(departed.mission.escort.node,null);
  assert.equal(H(departed).hand.length,H(after).hand.length);assert.equal(departed.move.remaining,1);
  assert.equal(before.mission.escort.node,'tile-11:house','the original checkpoint is retained');
});

test('the in-movement pickup is a free explicit toggle while ordinary map movement continues to leave the survivor behind',()=>{
  const before=house();let moving=command(before,{type:'MOVE',cardId:H(before).hand[0].id});
  const pickup=inspect(moving).actions.find(a=>a.id==='escort-pickup');
  assert(pickup&&pickup.enabled);assert.equal(pickup.command.type,'MISSION_PICKUP');assert.equal(pickup.cost,'추가 비용 없음');
  const handCount=H(moving).hand.length,remaining=moving.move.remaining;
  moving=command(moving,pickup.command);
  const leave=inspect(moving).actions.find(a=>a.id==='escort-pickup');
  assert.equal(leave.label,'생존자를 이곳에 남겨 두기');moving=command(moving,leave.command);
  assert.equal(moving.mission.escort.pickup,false);assert.equal(H(moving).hand.length,handCount);assert.equal(moving.move.remaining,remaining);
  moving=command(moving,{type:'STEP',node:'tile-11:street'});
  assert.equal(moving.mission.escort.node,'tile-11:house');assert.equal(moving.mission.escort.carrierId,null);
  const plain=inspect(before,{kind:'cell',node:'tile-11:street'}).actions.find(a=>a.id==='move');
  assert.deepEqual(plain.sequence.map(c=>c.type),['MOVE','STEP'],'ordinary routes never opt in automatically');
});

test('an escort elsewhere on the same tile requires first reaching its exact cell and can then be picked up within that same MOVE',()=>{
  const atHouse=house();let s=command(atHouse,{type:'MOVE',cardId:H(atHouse).hand[0].id});
  s=command(s,{type:'STEP',node:'tile-11:street'});s=command(s,{type:'STOP_MOVE'});
  const remote=inspect(s);assert(!remote.actions.some(a=>/^escort-/.test(a.id)));
  assert.match(remote.hint,/생존자가 있는 칸/);
  const move=remote.actions.find(a=>a.id==='move');assert(move&&move.enabled);
  for(const c of move.sequence)s=command(s,c);
  assert.equal(s.phase,'move');assert.equal(H(s).position,'tile-11:house');assert.equal(s.move.remaining,1);
  const free=inspect(s).actions.find(a=>a.id==='escort-pickup');assert(free&&free.enabled);
  const paid=H(s).hand.length;s=command(s,free.command);s=command(s,{type:'STEP',node:'tile-11:street'});
  assert.equal(s.mission.escort.carrierId,s.activeHunterId);assert.equal(H(s).hand.length,paid);
});

test('restarting from an already-armed non-departure does not toggle the selected escort off',()=>{
  let s=start(house());s=command(s,{type:'STOP_MOVE'});
  assert.equal(s.mission.escort.pickup,true);assert.equal(s.mission.escort.carrierId,null);
  const action=inspect(s).actions.find(a=>a.id==='escort-move-start');assert(action&&action.enabled);
  assert.deepEqual(action.sequence.map(c=>c.type),['MOVE']);
  for(const c of action.sequence)s=command(s,c);
  s=command(s,{type:'STEP',node:'tile-11:street'});assert.equal(s.mission.escort.carrierId,s.activeHunterId);
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

