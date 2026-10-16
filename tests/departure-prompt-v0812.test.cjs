'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),P=require('../src/hunt-departure');
const H=E.hunter,clone=structuredClone;
function house() {
  let s=E.create(14,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  for(const c of [{type:'MOVE',cardId:H(s).hand[0].id},{type:'EXPLORE',edge:'N'},
    {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-11:house'}])s=E.dispatch(s,c);
  assert(s.mission.revealed.includes(8));assert.equal(s.phase,'hunter');return s;
}
const cached=new Map();
function natural(file,count,weapon='burial',face=1) {
  const key=`${file}/${count}/${weapon}/${face}`;
  if(!cached.has(key)){let s=E.create(90,weapon,face,null,'hunter-pistol','center',{campaign:true});
    for(const c of require('./fixtures/'+file).slice(0,count))s=E.dispatch(s,c);
    assert.deepEqual(E.importSave(E.exportSave(s)),s);cached.set(key,s);}
  return clone(cached.get(key));
}
function replay(s,commands) {
  for(const c of commands)s=E.dispatch(s,c);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;
}
function plan(s,commands) {
  const before=clone(s),requested=clone(commands),result=P.plan(E,s,commands);
  assert.deepEqual(s,before,'planning cannot mutate rules state, saved history or RNG');
  assert.deepEqual(commands,requested,'planning cannot edit the requested commands');return result;
}
function direct(s) {return [{type:'MOVE',cardId:H(s).hand[0].id},{type:'STEP',node:'tile-11:street'}];}

for(const source of ['short actual seed14','existing canonical prefix75'])test(`${source}: a direct named-house departure asks before moving and offers valid yes/no command batches`,()=>{
  const s=source.startsWith('short')?house():natural('v074-shelter-natural-commands.json',75);
  const commands=direct(s),question=plan(s,commands);assert(question);
  assert.equal(question.title,'생존자와 동행하시겠습니까?');assert.equal(question.tokenId,'escort');
  assert.equal(question.fromNode,'tile-11:house');assert.equal(question.sourceRevision,s.revision);
  assert.deepEqual(question.acceptCommands.map(c=>c.type),['MOVE','MISSION_PICKUP','STEP']);
  assert.deepEqual(question.declineCommands,commands);
  const yes=replay(s,question.acceptCommands),no=replay(s,question.declineCommands);
  assert.equal(yes.mission.escort.carrierId,yes.activeHunterId);assert.equal(yes.mission.escort.node,null);
  assert.equal(no.mission.escort.carrierId,null);assert.equal(no.mission.escort.node,'tile-11:house');
  assert.equal(H(yes).hand.length,H(s).hand.length-1);assert.equal(H(no).hand.length,H(yes).hand.length);
  assert.equal(H(yes).position,H(no).position);assert.equal(yes.move.remaining,no.move.remaining);
  assert.deepEqual(Object.keys(question).sort(),['title','tokenId','name','acceptCommands','declineCommands','sourceRevision','fromNode'].sort());
});

test('entering the named house from another cell does not pick up its survivor; the later departure of that same MOVE asks',()=>{
  let s=house();s=replay(s,direct(s));s=replay(s,[{type:'STOP_MOVE'}]);
  const enter=[{type:'MOVE',cardId:H(s).hand[0].id},{type:'STEP',node:'tile-11:house'}];
  assert.equal(plan(s,enter),null,'the rest of the same tile is not the named house cell');
  s=replay(s,enter);assert.equal(s.phase,'move');assert.equal(s.move.remaining,1);
  const question=plan(s,[{type:'STEP',node:'tile-11:street'}]);assert(question);
  assert.deepEqual(question.acceptCommands.map(c=>c.type),['MISSION_PICKUP','STEP']);
  const yes=replay(s,question.acceptCommands);assert.equal(yes.mission.escort.carrierId,yes.activeHunterId);
});

test('an old armed reservation still asks, yes keeps it and no explicitly cancels only that pickup',()=>{
  let s=house();s=replay(s,[{type:'MOVE',cardId:H(s).hand[0].id},{type:'MISSION_PICKUP'}]);
  const command=[{type:'STEP',node:'tile-11:street'}],question=plan(s,command);assert(question);
  assert.deepEqual(question.acceptCommands,command);
  assert.deepEqual(question.declineCommands.map(c=>c.type),['MISSION_PICKUP','STEP']);
  const yes=replay(s,question.acceptCommands),no=replay(s,question.declineCommands);
  assert.equal(yes.mission.escort.carrierId,yes.activeHunterId);assert.equal(no.mission.escort.carrierId,null);
  assert.equal(no.mission.escort.pickup,false);assert.equal(H(no).hand.length,H(s).hand.length);
});

test('an already-carried escort is never asked about or dropped by a later walking request',()=>{
  const s=house(),question=plan(s,direct(s));let yes=replay(s,question.acceptCommands);
  assert.equal(plan(yes,[{type:'STEP',node:'tile-14:center'}]),null);
  yes=replay(yes,[{type:'STEP',node:'tile-14:center'}]);assert.equal(yes.mission.escort.carrierId,yes.activeHunterId);
});

test('MOVE alone, STOP_MOVE, Dream entry and teleport requests never create departure questions',()=>{
  const s=house();assert.equal(plan(s,[{type:'MOVE',cardId:H(s).hand[0].id}]),null);
  const moving=replay(s,[{type:'MOVE',cardId:H(s).hand[0].id}]);assert.equal(plan(moving,[{type:'STOP_MOVE'}]),null);
  assert.equal(plan(s,[{type:'DREAM',cardId:H(s).hand[0].id}]),null);
  const user=require('./fixtures/user-play-fog-v089.json').state;
  let before=E.create(user.initialSeed,user.setup.weaponId,user.setup.face,null,user.setup.firearmId,user.setup.startSpace,user.setup);
  before=replay(before,user.commands.slice(0,17));assert.equal(plan(before,[user.commands[17]]),null);
});

test('a valid prefix with an invalid later command is rejected without producing a choice or consuming anything',()=>{
  const s=house();assert.equal(plan(s,[...direct(s),{type:'DREAM',cardId:'missing-card'}]),null);
  assert.equal(plan(s,[{type:'MOVE',cardId:'missing-card'},{type:'STEP',node:'tile-11:street'}]),null);
});

test('actual mission37 asks at EXPLORE while free pickup is legal and stored choice controls entry/completion without a placement question',()=>{
  const s=natural('v074-clinic-escort-chapter-two-natural-commands.json',125);
  assert.equal(H(s).position,'tile-18:top');assert(s.mission.revealed.includes(37));assert.equal(s.phase,'move');
  const question=plan(s,[{type:'EXPLORE',edge:'E'}]);assert(question);
  assert.equal(question.fromNode,'tile-18:top');assert.deepEqual(question.acceptCommands.map(c=>c.type),['MISSION_PICKUP','EXPLORE']);
  let yes=replay(s,question.acceptCommands),no=replay(s,question.declineCommands);
  assert.equal(yes.phase,'tile_place');assert.equal(yes.mission.escort.pickup,true);
  assert.equal(yes.mission.escort.node,'tile-18:top');assert.equal(yes.mission.escort.carrierId,null);
  assert.equal(no.mission.escort.pickup,false);
  const placement=[{type:'PLACE_TILE',rotation:0}];
  assert.equal(plan(yes,placement),null);assert.equal(plan(no,placement),null,'older pending placement receives no illegal pickup command');
  yes=replay(yes,placement);no=replay(no,placement);
  assert(yes.mission.completed.includes(39));assert.equal(yes.mission.escort.node,null);
  assert(!no.mission.completed.includes(39));assert.equal(no.mission.escort.node,'tile-18:top');
  assert.equal(H(yes).position,'tile-17:lower-left');assert.equal(H(no).position,H(yes).position);
});

test('being on the other bridge cell is insufficient for the public mission37 pickup',()=>{
  const s=natural('v074-clinic-escort-chapter-two-natural-commands.json',124);
  assert.equal(s.phase,'move');assert.equal(H(s).position,'tile-18:bottom');
  assert.equal(s.mission.escort.node,'tile-18:top');
  assert.equal(plan(s,[{type:'STEP',node:'tile-18:top'}]),null,'arrival is distinct from departure of the specifically named cell');
});

test('uncaptured mission12 and mission49 survivors remain paid interactions and never gain a free pickup question',()=>{
  for(const s of [natural('weapon-campaign-completion/beast-claw-0.json',35,'beast-claw',0),
    natural('v074-help-iosefka-natural-commands.json',317)]) {
    assert.equal(E.interactionOptions(s).missionRescue,true);
    assert(!E.missionActions(s).some(a=>a.command.type==='MISSION_PICKUP'));
    let commands;
    for(const node of E.neighbors(s,H(s).position)) {
      const proposed=[{type:'MOVE',cardId:H(s).hand[0].id},{type:'STEP',node}];
      try{replay(s,proposed);commands=proposed;break;}catch{}
    }
    assert(commands,'a genuine legal walking-away request exists');assert.equal(plan(s,commands),null);
  }
});

// Abstract adapter contract: A and B are BOTH departure-free companions. This
// models the companionship part of the user's example, not original mission12 or49.
// Movement-end reveal timing is verified separately with the real engine/UI.
function abstractWorld() {
  const state={revision:0,phase:'move',activeHunterId:'hunter-1',hunter:{id:'hunter-1',position:'n0'},
    companions:{A:{node:'n0',carrierId:null,pickup:false,name:'생존자 A'},B:{node:'n3',carrierId:null,pickup:false,name:'생존자 B'}}};
  const engine={hunter:s=>s.hunter,
    missionView:s=>({tokens:Object.entries(s.companions).map(([id,t])=>({id,...t}))}),
    missionActions:s=>Object.entries(s.companions).filter(([,t])=>t.node===s.hunter.position&&!t.carrierId)
      .map(([id,t])=>({selected:t.pickup,command:{type:'MISSION_PICKUP',tokenId:id}})),
    dispatch:(previous,c)=>{
      const s=clone(previous);assert.equal(s.phase,'move');
      if(c.type==='MISSION_PICKUP') {const t=s.companions[c.tokenId];assert(t&&t.node===s.hunter.position&&!t.carrierId);t.pickup=!t.pickup;}
      else if(c.type==='STEP') {
        const from=s.hunter.position;assert.equal(Number(c.node.slice(1)),Number(from.slice(1))+1);
        for(const t of Object.values(s.companions))if(t.node===from&&!t.carrierId&&t.pickup){t.node=null;t.carrierId=s.activeHunterId;t.pickup=false;}
        s.hunter.position=c.node;
      } else throw Error('unsupported abstract command');
      s.revision++;return s;
    }};
  return {state,engine};
}
for(const acceptB of [false,true])test(`abstract A/B companionship policy: ${acceptB?'accepting':'declining'} B preserves the already-carried A throughout`,()=>{
  let {state,engine}=abstractWorld(),questions=[];
  for(let step=1;step<=7;step++) {
    const before=clone(state),commands=[{type:'STEP',node:`n${step}`}],question=P.plan(engine,state,commands);
    assert.deepEqual(state,before);
    if(question){questions.push(question);assert.equal(question.sourceRevision,state.revision);
      const accept=question.tokenId==='A'||acceptB;
      for(const c of accept?question.acceptCommands:question.declineCommands)state=engine.dispatch(state,c);
    } else for(const c of commands)state=engine.dispatch(state,c);
    assert.equal(state.companions.A.carrierId,state.activeHunterId,'declining a later survivor never removes A');
  }
  assert.equal(questions.length,2);assert.equal(questions[0].title,'생존자와 동행하시겠습니까?');
  assert.equal(questions[1].title,'다른 생존자와 동행하시겠습니까?');
  assert.equal(state.companions.B.carrierId,acceptB?state.activeHunterId:null);
  assert.equal(state.companions.B.node,acceptB?null:'n3');
});
