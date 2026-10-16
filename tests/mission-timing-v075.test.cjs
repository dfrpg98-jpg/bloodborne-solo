const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/hunt-engine'), M = require('../src/chapter-engine');
const {boot} = require('./helpers/ui-harness.cjs');
const {clickCommand} = require('./helpers/public-command-ui.cjs');
const commands = require('./fixtures/v074-first-chapel-warning-natural-commands.json');
const H = E.hunter, copy = structuredClone;
const prefixes = new Map();
function prefix(rulesVersion=12) {
  if (!prefixes.has(rulesVersion)) {
    let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion});
    for (const command of commands.slice(0,-1)) s=E.dispatch(s,command);
    assert.equal(commands.at(-1).type,'STOP_MOVE');
    assert.equal(s.phase,'move'); assert.equal(E.node(s,H(s).position).tile,'tile-17');
    assert.equal(s.mission.escort.carrierId,s.activeHunterId);
    assert(!s.mission.revealed.includes(56));
    prefixes.set(rulesVersion,s);
  }
  return copy(prefixes.get(rulesVersion));
}
// Every boundary below changes retained history at a real public-command
// checkpoint. It is an isolated contract, not a natural campaign/save proof.
function contract(kind='33') {
  const s=prefix(), previous=s.mission.history[1];
  previous.completed=previous.completed.filter(n=>n!==28);
  previous.revealed=previous.revealed.filter(n=>n!==28);
  if(kind==='59') {previous.completed.push(34);previous.revealed.push(34);}
  E.assertState(s);return s;
}
function pending(kind='33') {return E.dispatch(contract(kind),{type:'STOP_MOVE'});}
function settle(s) {
  while(s.rewardChoices.length) {
    const q=s.rewardChoices[0];
    s=E.dispatch(s,q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId});
  }
  return s;
}
function checkGrant(s) {
  assert.equal(s.mission.completed.filter(n=>n===39).length,1);
  assert.equal(s.mission.revealed.filter(n=>n===39).length,1);
  assert(H(s).ownedFirearms.includes('repeating-pistol'));
  assert.equal(H(s).rewards.filter(r=>r.kind==='old-hunter-bone').length,1);
  assert.equal(s.mission.escort.carrierId,null); assert.equal(s.mission.escort.node,null);
}
// Real controller rendering/listeners and real reducer, with only its startup
// importer replaced to supply the explicitly assembled boundary. The real
// importer rejection of this state is tested separately. This is not browser
// testing or evidence of a natural saved campaign.
function contractUi(s) {
  return boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
    storage:{'bloodborne-hunt-v07':E.exportSave(s)},engine:{
      importSave:()=>copy(s),exportSave:E.exportSave,dispatch:E.dispatch,
      applyChapelRuling:state=>state,
      applyCombatReactionRuling:state=>state,
      missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
      interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView,
    }});
}
function clickContract(s,command) {
  const ui=contractUi(s), containers=['decisions','missionActions','rewards'];
  const button=containers.flatMap(id=>ui.el(id).querySelectorAll('[data-command]'))
    .find(b=>!b.disabled&&b.dataset.command===command.type&&Object.entries(command)
      .filter(([k])=>k!=='type').every(([k,v])=>JSON.parse(b.dataset.args)[k]===v));
  assert(button,'real controller offers the contract command');button.click();
  assert.equal(ui.el('error').textContent,'');
  const next=JSON.parse(ui.storage.get('bloodborne-hunt-v07')).state;
  assert.deepEqual(next,E.dispatch(s,command));E.assertState(next);return next;
}

test('rules14 is the new hunt default and chapter world preserves an explicit legacy rules13 tag',()=>{
  const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
  assert.equal(s.setup.rulesVersion,14);
  const world=M.create(90,'center',3,{rulesVersion:13});M.assertState(world);
  assert.equal(world.rulesVersion,13);
});

test('legacy rules12 retained28 arrival automatically applies locked33 and exactly imports its original save',()=>{
  const before=prefix(), next=clickCommand(before,{type:'STOP_MOVE'});
  assert.deepEqual(before.mission.history[1].completed,[26,28,23]);
  assert.equal(next.phase,'hunter');assert(!next.mission.chapelArrival);
  assert(next.mission.revealed.includes(33));assert(!next.mission.revealed.includes(57));
  assert(next.mission.revealed.indexOf(33)<next.mission.revealed.indexOf(39));
  checkGrant(next);assert.deepEqual(E.importSave(E.exportSave(next)),next);
  assert.deepEqual(E.importSave(E.exportSave(settle(next))),settle(next));
});

test('rules11 public replay is unchanged from the released engine and never adds a timing choice',()=>{
  // Captured with the frozen released v0.7.4 engine, independently of this code.
  const releasedSave=require('./fixtures/v074-first-chapel-warning-save.json');
  const previous=releasedSave.state;
  const current=E.dispatch(prefix(11),{type:'STOP_MOVE'});
  assert.deepEqual(current,previous);assert.deepEqual(E.importSave(JSON.stringify(releasedSave)),previous);
  const boundary=contract();boundary.setup.rulesVersion=11;
  const fixed=E.dispatch(boundary,{type:'STOP_MOVE'});
  assert(fixed.mission.revealed.includes(33));assert(!fixed.mission.revealed.includes(57));
  assert(!fixed.mission.chapelArrival);checkGrant(fixed);
});

for(const kind of ['33','59']) {
  test(`assembled ${kind}/57 contract pauses both effects without spending resources`,()=>{
    const before=contract(kind), original=copy(before), s=E.dispatch(before,{type:'STOP_MOVE'});
    assert.deepEqual(before,original,'reducer does not mutate the checkpoint');
    assert.equal(s.phase,'mission_choice');assert.equal(s.mission.choice,'chapel-order');
    assert.equal(s.mission.chapelArrival.beforeCard,+kind);
    assert.deepEqual(s.missionArrivalAfter,{weaponAfter:null});
    assert(s.mission.revealed.includes(56));
    assert(!s.mission.revealed.some(n=>[33,57,59,39].includes(n)));
    assert(!s.mission.completed.includes(39));assert.equal(s.rewardChoices.length,0);
    assert.equal(s.mission.escort.carrierId,s.activeHunterId);
    assert.equal(s.move,null);assert.equal(s.combat,null);
    assert.deepEqual(H(s).hand,H(before).hand);assert.equal(H(s).hp,H(before).hp);
    assert.equal(s.track,before.track);
    const view=E.missionView(s);
    assert.deepEqual(E.missionActions(s).map(x=>x.command.choice),['escort-first']);
    for(const command of [{type:'END_TURN'},{type:'MOVE',cardId:H(s).hand[0].id},{type:'MISSION_CHOICE',choice:'invalid'}])
      assert.throws(()=>E.dispatch(s,command));
    const restored=JSON.parse(E.exportSave(s)).state;E.assertState(restored);assert.deepEqual(restored,s);
    assert.throws(()=>E.importSave(E.exportSave(s)),/명령 기록과 일치하지 않습니다/,
      'real importer correctly rejects assembled history rather than claiming a natural save');
  });

  for(const choice of ['chapel-first','escort-first']) {
    test(`assembled ${kind}/57 ${choice==='chapel-first'?'legacy command':'current fallback controller'} applies ${choice} once`,()=>{
      const s=pending(kind), ui=contractUi(s);
      const controls=ui.buttons('decisions').filter(b=>b.dataset.command==='MISSION_CHOICE');
      assert.equal(controls.length,1);assert(controls.every(b=>!b.disabled));
      assert.equal(JSON.parse(controls[0].dataset.args).choice,'escort-first');
      let next=choice==='chapel-first'?E.dispatch(s,{type:'MISSION_CHOICE',choice}):clickContract(s,{type:'MISSION_CHOICE',choice});checkGrant(next);
      const expected=choice==='escort-first'?57:+kind;
      assert(next.mission.revealed.includes(expected));
      assert(!next.mission.revealed.includes(choice==='escort-first'?+kind:57));
      assert.equal(next.mission.chapelArrival,undefined);assert.equal(next.missionArrivalAfter,undefined);
      assert.equal(next.mission.choice,false);assert.equal(next.phase,'hunter');
      if(expected===57) {assert.equal(next.mission.counters[57],2);assert.equal(next.mission.npc.node,'tile-17:top');}
      if(expected===59) {assert.equal(next.mission.counters[59],2);assert.equal(next.mission.donationWindow,true);}
      assert(next.rewardChoices.length>=2);
      assert.throws(()=>E.dispatch(next,{type:'END_TURN'}),/장착.*보관 선택/);
      const rewardsUi=contractUi(next);
      assert(rewardsUi.buttons('decisions').some(b=>['EQUIP_REWARD','KEEP_REWARD'].includes(b.dataset.command)),
        'mandatory equipment choices precede ordinary actions');
      while(next.rewardChoices.length) {
        const q=next.rewardChoices[0];
        next=clickContract(next,q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId});
      }
      assert.equal(next.rewardChoices.length,0);checkGrant(next);
      assert.throws(()=>E.dispatch(next,{type:'MISSION_CHOICE',choice}),/선택할 단계/);
      const from=H(next).position;
      next=E.dispatch(next,{type:'MOVE',cardId:H(next).hand[0].id});
      next=E.dispatch(next,{type:'STEP',node:E.neighbors(next,from).find(n=>E.node(next,n).tile==='tile-17')});
      if(next.phase==='move')next=E.dispatch(next,{type:'STOP_MOVE'});
      checkGrant(next);assert(!next.mission.chapelArrival);
      assert(!next.mission.revealed.includes(choice==='escort-first'?+kind:57),
        'later movement with39 does not re-evaluate already resolved56');
    });
  }
}

test('an already-held39 uses57 without a timing choice even when a fresh escort completes',()=>{
  const s=contract();s.mission.history[1].completed.push(39);s.mission.history[1].revealed.push(39);
  const next=E.dispatch(s,{type:'STOP_MOVE'});
  assert(next.mission.revealed.includes(57));assert(!next.mission.chapelArrival);checkGrant(next);
});

test('legacy chapel-first command deposits assembled held survivors on that same arrival',()=>{
  const before=contract();before.mission.heldSurvivors[before.activeHunterId]=2;
  const waiting=E.dispatch(before,{type:'STOP_MOVE'});
  assert.equal(waiting.mission.deposits.chapel,0);
  assert.equal(waiting.mission.heldSurvivors[waiting.activeHunterId],2);
  const after=E.dispatch(waiting,{type:'MISSION_CHOICE',choice:'chapel-first'});
  assert.equal(after.mission.heldSurvivors[after.activeHunterId],0);
  assert.equal(after.mission.deposits.chapel,2);
  assert(after.mission.completed.includes(34));assert(after.mission.completed.includes(39));
  assert(!after.mission.revealed.includes(57));
  assert(H(after).rewards.some(r=>r.kind==='rune-writhe'));
  assert.equal(E.missionView(after).insight,2);checkGrant(after);E.assertState(after);
});

test('assembled escort-first57 preserves general survivor tokens instead of silently depositing them into33',()=>{
  const before=contract();before.mission.heldSurvivors[before.activeHunterId]=2;
  const waiting=E.dispatch(before,{type:'STOP_MOVE'});
  const after=clickContract(waiting,{type:'MISSION_CHOICE',choice:'escort-first'});
  assert.equal(after.mission.heldSurvivors[after.activeHunterId],2);
  assert.equal(after.mission.deposits.chapel,0);assert(!after.mission.completed.includes(34));
  assert(!after.mission.revealed.includes(33));assert(after.mission.revealed.includes(57));
  assert.equal(E.missionView(after).insight,1);checkGrant(after);E.assertState(after);
});

test('new timing state validation rejects a wrong hunter, branch card or phase',()=>{
  for(const mutate of [s=>s.mission.chapelArrival.hunterId='missing',s=>s.mission.chapelArrival.beforeCard=57,
    s=>s.phase='hunter',s=>s.mission.escort.carrierId=null]) {
    const s=pending();mutate(s);assert.throws(()=>E.assertState(s),/동시 효과 판정 상태/);
  }
});

test('assembled leap cancellation is deferred until the chapel timing choice is resolved',()=>{
  const s=contract(), cardId=H(s).hand[0].id;
  s.leap={enemyId:'huntsmans-minion-1',cardId,slot:0,itemIds:[],rewardIds:[]};
  const waiting=E.dispatch(s,{type:'STOP_MOVE'});
  assert.equal(waiting.phase,'mission_choice');assert.deepEqual(waiting.leap,s.leap);
  assert.equal(waiting.combat,null);assert(H(waiting).hand.some(c=>c.id===cardId));
  const after=E.dispatch(waiting,{type:'MISSION_CHOICE',choice:'escort-first'});
  assert.equal(after.leap,null);assert.equal(after.phase,'hunter');
  assert(H(after).hand.some(c=>c.id===cardId));assert.equal(after.missionArrivalAfter,undefined);
});

test('assembled leap attack resumes exactly once after the timing choice and mandatory rewards remain visible',()=>{
  const s=contract(), target=s.enemies.find(e=>e.id==='huntsmans-minion-1'), cardId=H(s).hand[0].id;
  target.node=H(s).position;
  s.leap={enemyId:target.id,cardId,slot:0,itemIds:[],rewardIds:[]};
  const waiting=E.dispatch(s,{type:'STOP_MOVE'});
  assert.equal(waiting.phase,'mission_choice');assert.equal(waiting.combat,null);
  const after=E.dispatch(waiting,{type:'MISSION_CHOICE',choice:'escort-first'});
  assert.equal(after.leap,null);assert.equal(after.combat.enemyId,target.id);
  assert.equal(H(after).slots[0].id,cardId);assert(!H(after).hand.some(c=>c.id===cardId));
  assert.equal([...H(after).hand,...H(after).deck,...H(after).discard,...H(after).slots.filter(Boolean)].filter(c=>c.id===cardId).length,1);
  assert.equal(after.missionArrivalAfter,undefined);
  assert(after.rewardChoices.length>=2);
  const ui=contractUi(after);
  assert(ui.buttons('decisions').some(b=>b.dataset.command==='KEEP_REWARD'));
  assert(!ui.buttons('decisions').some(b=>b.dataset.command==='RESOLVE'));
  const equipped=settle(after);assert.equal(H(equipped).slots[0].id,cardId);
  assert.equal(equipped.combat.enemyId,target.id);E.assertState(equipped);
});

test('assembled weapon movement continuation waits for mission choice then resumes its queued effect once',()=>{
  const s=contract();s.move.weaponAfter={type:'weapon_continue'};
  s.weaponAfter={type:'weapon_phase',phase:'hunter'};
  s.weaponEffects=[{kind:'move',remaining:1}];
  const waiting=E.dispatch(s,{type:'STOP_MOVE'});
  assert.equal(waiting.phase,'mission_choice');
  assert.deepEqual(waiting.missionArrivalAfter,{weaponAfter:{type:'weapon_continue'}});
  assert.deepEqual(waiting.weaponEffects,s.weaponEffects);
  assert.equal(waiting.move,null);
  const after=E.dispatch(waiting,{type:'MISSION_CHOICE',choice:'chapel-first'});
  assert.equal(after.phase,'move');assert.equal(after.move.source,'weapon');assert.equal(after.move.remaining,1);
  assert.deepEqual(after.weaponEffects,[]);assert.equal(after.missionArrivalAfter,undefined);
  assert(after.rewardChoices.length>=2);
  const ui=contractUi(after);assert(ui.buttons('decisions').some(b=>b.dataset.command==='KEEP_REWARD'));
  assert(!ui.buttons('decisions').some(b=>b.dataset.command==='STOP_MOVE'));
  const done=E.dispatch(settle(after),{type:'STOP_MOVE'});
  assert.equal(done.phase,'hunter');assert.equal(done.weaponEffects,undefined);
  assert.equal(done.weaponAfter,undefined);assert.equal(done.missionArrivalAfter,undefined);checkGrant(done);
});
