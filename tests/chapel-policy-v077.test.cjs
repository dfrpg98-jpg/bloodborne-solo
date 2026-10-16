const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine.js');
const {clickCommand,replayPublicTrace}=require('./helpers/public-command-ui.cjs');
const {boot}=require('./helpers/ui-harness.cjs');
const naturalCommands=require('./fixtures/v077-chapel-escort-first-natural-commands.json');
const oldPendingCommands=require('./fixtures/v075-chapel-timing-natural-pending-commands.json');
const boundaryCommands=require('./fixtures/v074-first-chapel-warning-natural-commands.json');
const H=E.hunter,clone=structuredClone;

function replay(commands,count=commands.length,rulesVersion=13){
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion});
  for(const c of commands.slice(0,count))s=E.dispatch(s,c);
  return s;
}
function checkGrant(s){
  assert.equal(s.mission.completed.filter(n=>n===39).length,1);
  assert.equal(s.mission.revealed.filter(n=>n===39).length,1);
  assert.equal(H(s).rewards.filter(r=>r.kind==='old-hunter-bone').length,1);
  assert(H(s).ownedFirearms.includes('repeating-pistol'));
  assert.equal(s.mission.escort.carrierId,null);
  assert.equal(s.mission.escort.node,null);
  assert.equal(s.mission.choice,false);
  assert.equal(s.mission.chapelArrival,undefined);
  assert.equal(s.missionArrivalAfter,undefined);
}
function checkAutomaticArrival(s){
  assert.equal(s.setup.rulesVersion,13);assert.equal(s.mission.chapter,3);
  checkGrant(s);
  assert(s.mission.revealed.includes(56)&&s.mission.revealed.includes(57));
  assert(s.mission.revealed.indexOf(39)<s.mission.revealed.indexOf(56));
  assert(s.mission.revealed.indexOf(56)<s.mission.revealed.indexOf(57));
  assert(!s.mission.revealed.includes(33)&&!s.mission.revealed.includes(59));
  assert.equal(s.mission.counters[57],2);assert.equal(s.mission.npc.node,'tile-17:top');
  assert.equal(s.mission.donationWindow,false);
  assert(!E.missionActions(s).some(x=>x.command.type==='MISSION_CHOICE'));
  assert.equal(E.missionView(s).pending,null);
}
function settle(s){
  while(s.rewardChoices.length){const q=s.rewardChoices[0];
    s=E.dispatch(s,q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId});}
  return s;
}

test('rules13 natural 315th command completes39 before revealing56 and57 without a timing decision',()=>{
  assert.equal(naturalCommands.length,317);
  assert.deepEqual(naturalCommands.slice(0,315),oldPendingCommands);
  assert(!naturalCommands.some(c=>c.type==='MISSION_CHOICE'&&['chapel-first','escort-first'].includes(c.choice)));
  const before=replay(naturalCommands,314),arrival=E.dispatch(before,naturalCommands[314]);
  assert.equal(before.phase,'firearm_react');assert.equal(arrival.phase,'hunter');
  assert.deepEqual(arrival.mission.history[1].completed,[26,34,23]);
  checkAutomaticArrival(arrival);assert.equal(arrival.rewardChoices.length,2);
  assert.equal(H(arrival).hp,H(before).hp);assert.equal(arrival.track,before.track);
  assert.deepEqual(E.importSave(E.exportSave(before)),before);
  assert.deepEqual(E.importSave(E.exportSave(arrival)),arrival);
  assert.throws(()=>E.dispatch(arrival,{type:'END_TURN'}));
  assert.throws(()=>E.dispatch(arrival,{type:'MISSION_CHOICE',choice:'escort-first'}));
  let s=arrival;
  for(const c of naturalCommands.slice(315)){s=clickCommand(s,c);assert.deepEqual(E.importSave(E.exportSave(s)),s);}
  checkAutomaticArrival(s);assert.equal(s.rewardChoices.length,0);
  assert.equal(s.phase,'hunter');assert.equal(s.track,4);assert.equal(H(s).hp,6);
  assert.deepEqual(s.mission.completed,[39]);assert.equal(E.missionView(s).insight,1);
});

test('317 original natural rules13 commands project through real controls with exact save restoration and no adjudication button',t=>{
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  assert.equal(s.setup.rulesVersion,13);
  const replay=replayPublicTrace(s,naturalCommands,{label:'natural chapel',onCheckpoint({state,index}){
    if(index===314){checkAutomaticArrival(state);assert.equal(state.rewardChoices.length,2);}
  }});
  s=replay.state;assert.equal(replay.originalCommandCount,317);
  t.diagnostic(JSON.stringify({originalCommandCount:replay.originalCommandCount,uiCommandCount:replay.uiCommandCount,deferredReservations:replay.deferredReservations}));
  checkAutomaticArrival(s);assert.equal(s.rewardChoices.length,0);
});

test('legacy importer remains exact and fallback controller offers only escort-first completion',()=>{
  const pending=replay(oldPendingCommands,315,12),saved=E.exportSave(pending);
  assert.equal(pending.phase,'mission_choice');assert.equal(pending.mission.choice,'chapel-order');
  const restored=E.importSave(saved);assert.deepEqual(restored,pending);
  const view=E.missionView(restored),ui=boot(restored,view,E.rewardsView(restored),{realInventory:true,
    storage:{'bloodborne-hunt-v07':saved},engine:{importSave:E.importSave,exportSave:E.exportSave,
      applyChapelRuling:state=>state,
      dispatch:E.dispatch,missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions}});
  const buttons=ui.buttons('decisions').filter(b=>b.dataset.command==='MISSION_CHOICE');
  assert.equal(buttons.length,1);assert.equal(JSON.parse(buttons[0].dataset.args).choice,'escort-first');
  assert.equal(view.pending.options.length,1);
  assert(!/33|57|59/.test(view.pending.description||''),'unrevealed branch numbers are absent');
  let next=clickCommand(restored,{type:'MISSION_CHOICE',choice:'escort-first'});
  checkGrant(next);assert(next.mission.revealed.includes(57));assert(!next.mission.revealed.includes(59));
  assert.equal(next.setup.rulesVersion,12);assert.deepEqual(E.importSave(E.exportSave(next)),next);
  next=settle(next);assert.deepEqual(E.importSave(E.exportSave(next)),next);
  assert.equal(next.rewardChoices.length,0);
});

let checkpoint;
function boundary({retained=[],survivors=0}={}){
  if(!checkpoint){
    let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
    for(const c of boundaryCommands.slice(0,-1))s=E.dispatch(s,c);
    assert.equal(s.phase,'move');assert.equal(boundaryCommands.at(-1).type,'STOP_MOVE');
    checkpoint=s;
  }
  // These explicit history/token changes are isolated rule contracts, never a
  // natural saved campaign. The real importer rejects their fabricated log.
  const s=clone(checkpoint),history=s.mission.history[1];
  history.completed=history.completed.filter(n=>![28,34,39].includes(n));
  history.revealed=history.revealed.filter(n=>![28,34,39].includes(n));
  history.completed.push(...retained);history.revealed.push(...retained);
  s.mission.heldSurvivors[s.activeHunterId]=survivors;
  E.assertState(s);return s;
}
for(const retained of [[],[28],[34],[28,34]])for(const survivors of [0,2]){
  test(`assembled history ${retained.join('+')||'none'}, survivor tokens ${survivors}:39 then57 preserves tokens`,()=>{
    const before=boundary({retained,survivors}),snapshot=clone(before),s=E.dispatch(before,{type:'STOP_MOVE'});
    assert.deepEqual(before,snapshot,'reducer preserves the checkpoint');
    checkAutomaticArrival(s);assert.equal(s.mission.heldSurvivors[s.activeHunterId]||0,survivors);
    assert.equal(s.mission.deposits.chapel,0);assert.equal(s.rewardChoices.length,2);
    assert.equal(H(s).hp,H(before).hp);assert.equal(s.track,before.track);
    assert.deepEqual(H(s).hand,H(before).hand);assert.equal(s.mission.completed.includes(34),false);
    assert.equal(E.missionView(s).insight,1);E.assertState(s);
    assert.throws(()=>E.importSave(E.exportSave(s)),undefined,'assembled state cannot claim a natural save');
  });
}

test('assembled earlier39 already meets56 and opens57 without a fresh escort',()=>{
  const s=boundary({retained:[39]});s.mission.escort.carrierId=null;s.mission.escort.node=null;
  const next=E.dispatch(s,{type:'STOP_MOVE'});
  assert(next.mission.revealed.includes(56)&&next.mission.revealed.includes(57));
  assert(!next.mission.completed.includes(39),'previous chapter39 is retained without duplicate completion');
  assert.equal(next.mission.chapelArrival,undefined);assert.equal(next.rewardChoices.length,0);
  assert.equal(E.missionView(next).insight,0);E.assertState(next);
});

test('assembled first chapel arrival without37 still follows56 ordinary conditions',()=>{
  for(const [retained,card]of [[[],33],[[34],59]]){
    const s=boundary({retained});s.mission.escort.carrierId=null;s.mission.escort.node=null;
    const next=E.dispatch(s,{type:'STOP_MOVE'});
    assert(next.mission.revealed.includes(card));assert(!next.mission.revealed.includes(57));
    assert(!next.mission.completed.includes(39));assert.equal(next.rewardChoices.length,0);
    assert.equal(next.mission.chapelArrival,undefined);E.assertState(next);
  }
});

test('assembled leap attack resumes once with mandatory39 rewards before combat controls',()=>{
  const s=boundary(),target=s.enemies.find(e=>e.id==='huntsmans-minion-1'),cardId=H(s).hand[0].id;
  target.node=H(s).position;s.leap={enemyId:target.id,cardId,slot:0,itemIds:[],rewardIds:[]};
  const after=E.dispatch(s,{type:'STOP_MOVE'});checkAutomaticArrival(after);
  assert.equal(after.leap,null);assert.equal(after.combat.enemyId,target.id);
  assert.equal(H(after).slots[0].id,cardId);assert(!H(after).hand.some(c=>c.id===cardId));
  assert.equal([...H(after).hand,...H(after).deck,...H(after).discard,...H(after).slots.filter(Boolean)]
    .filter(c=>c.id===cardId).length,1);
  assert.equal(after.rewardChoices.length,2);
  const ui=boot(after,E.missionView(after),E.rewardsView(after),{realInventory:true});
  assert(ui.buttons('decisions').some(b=>b.dataset.command==='KEEP_REWARD'));
  assert(!ui.buttons('decisions').some(b=>b.dataset.command==='RESOLVE'));
  const ready=settle(after);assert.equal(ready.combat.enemyId,target.id);assert.equal(H(ready).slots[0].id,cardId);
  E.assertState(ready);
});

test('assembled weapon movement continuation starts once and rewards block the next movement control',()=>{
  const s=boundary();s.move.weaponAfter={type:'weapon_continue'};
  s.weaponAfter={type:'weapon_phase',phase:'hunter'};s.weaponEffects=[{kind:'move',remaining:1}];
  const after=E.dispatch(s,{type:'STOP_MOVE'});checkAutomaticArrival(after);
  assert.equal(after.phase,'move');assert.equal(after.move.source,'weapon');assert.equal(after.move.remaining,1);
  assert.deepEqual(after.weaponEffects,[]);assert.equal(after.rewardChoices.length,2);
  const ui=boot(after,E.missionView(after),E.rewardsView(after),{realInventory:true});
  assert(ui.buttons('decisions').some(b=>b.dataset.command==='KEEP_REWARD'));
  assert(!ui.buttons('decisions').some(b=>b.dataset.command==='STOP_MOVE'));
  const done=E.dispatch(settle(after),{type:'STOP_MOVE'});checkGrant(done);
  assert.equal(done.phase,'hunter');assert.equal(done.weaponEffects,undefined);assert.equal(done.weaponAfter,undefined);
});
