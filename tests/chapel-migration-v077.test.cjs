const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine.js');
const pendingCommands=require('./fixtures/v075-chapel-timing-natural-pending-commands.json');
const oldBranches={
  'chapel-first':require('./fixtures/v075-chapel-timing-natural-chapel-first-commands.json'),
  'escort-first':require('./fixtures/v075-chapel-timing-natural-escort-first-commands.json'),
};
const H=E.hunter,clone=structuredClone;
let checkpoints;
function old(count=315){
  if(!checkpoints){
    let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:12});
    checkpoints=new Map([[0,s]]);
    for(let i=0;i<pendingCommands.length;i++){
      s=E.dispatch(s,pendingCommands[i]);checkpoints.set(i+1,s);
    }
  }
  return clone(checkpoints.get(count));
}
function gameplay(s){const x=clone(s);delete x.chapelRuling;delete x.commands;delete x.revision;return x;}
function checkAdoption(before,after){
  assert.equal(after.chapelRuling,'escort-first');assert.equal(after.setup.rulesVersion,12);
  assert.equal(after.revision,before.revision+1);assert.equal(after.commands.length,before.commands.length+1);
  assert.deepEqual(after.commands.at(-1),{type:'APPLY_CHAPEL_RULING'});
  assert.deepEqual(after.commands.slice(0,-1),before.commands);
  assert.deepEqual(E.importSave(E.exportSave(after)),after);
  assert.strictEqual(E.applyChapelRuling(after),after,'repeated adoption is a true no-op');
  assert.throws(()=>E.dispatch(after,{type:'APPLY_CHAPEL_RULING'}),'duplicate recorded adoption is rejected');
}
function resolved(branch,settled=true){
  let s=old();
  const tail=oldBranches[branch].slice(315);
  for(const c of settled?tail:tail.slice(0,1))s=E.dispatch(s,c);
  return s;
}

test('legacy prearrival save adopts future escort-first policy without changing any gameplay state',()=>{
  const before=old(314),saved=E.exportSave(before),restored=E.importSave(saved);
  assert.deepEqual(restored,before,'import remains a pure exact restoration');
  const adopted=E.applyChapelRuling(restored);checkAdoption(restored,adopted);
  assert.deepEqual(gameplay(adopted),gameplay(before));
  const arrival=E.dispatch(adopted,pendingCommands[314]);
  assert(arrival.mission.completed.includes(39));assert(arrival.mission.revealed.includes(57));
  assert(!arrival.mission.revealed.includes(59));assert.equal(arrival.phase,'hunter');
  assert.equal(arrival.mission.chapelArrival,undefined);assert.equal(arrival.rewardChoices.length,2);
  assert.deepEqual(E.importSave(E.exportSave(arrival)),arrival);
});

test('legacy pending simultaneous save records one adoption and resolves escort first exactly once',()=>{
  const before=old(),reference=E.dispatch(before,{type:'MISSION_CHOICE',choice:'escort-first'});
  const adopted=E.applyChapelRuling(E.importSave(E.exportSave(before)));checkAdoption(before,adopted);
  assert.deepEqual(gameplay(adopted),gameplay(reference));
  assert.equal(adopted.mission.chapelArrival,undefined);assert.equal(adopted.missionArrivalAfter,undefined);
  assert.equal(adopted.mission.completed.filter(n=>n===39).length,1);
  assert.equal(H(adopted).rewards.filter(r=>r.kind==='old-hunter-bone').length,1);
});

for(const branch of ['chapel-first','escort-first'])for(const settled of [false,true]){
  test(`legacy already resolved ${branch}, rewards ${settled?'settled':'pending'}:adoption preserves outcome and windows`,()=>{
    const before=resolved(branch,settled),adopted=E.applyChapelRuling(before);
    checkAdoption(before,adopted);assert.deepEqual(gameplay(adopted),gameplay(before));
    assert.equal(adopted.mission.donationWindow,branch==='chapel-first');
    assert(adopted.mission.revealed.includes(branch==='chapel-first'?59:57));
    assert(!adopted.mission.revealed.includes(branch==='chapel-first'?57:59));
    assert.equal(adopted.rewardChoices.length,settled?0:2);
  });
}

test('adopted old policy persists through chapter transition while unfinished mission state resets',()=>{
  const index=pendingCommands.map(c=>c.type).lastIndexOf('START_NEXT_CHAPTER');
  assert(index>0);const before=old(index);assert.equal(before.phase,'between_chapters');
  const adopted=E.applyChapelRuling(before);checkAdoption(before,adopted);
  assert.deepEqual(gameplay(adopted),gameplay(before));
  const next=E.dispatch(adopted,pendingCommands[index]);
  assert.equal(next.mission.chapter,3);assert.equal(next.chapelRuling,'escort-first');
  assert.deepEqual(next.mission.history[1].completed,before.mission.completed);
  assert(!next.mission.revealed.includes(37));assert.equal(next.mission.escort.carrierId,null);
  assert.deepEqual(E.importSave(E.exportSave(next)),next);
});

test('new rules13 and noncampaign practice do not add adoption commands',()=>{
  for(const s of [E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true}),
    E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:false,rulesVersion:12})]){
    assert.strictEqual(E.applyChapelRuling(s),s);assert.equal(s.chapelRuling,undefined);
  }
});

test('legacy completed campaign adopts metadata without reopening the over state',()=>{
  const manifest=require('./fixtures/weapon-campaign-completion/manifest.json');
  const item=manifest.cases.find(x=>x.weaponId==='burial');assert(item);
  const commands=require('./fixtures/weapon-campaign-completion/'+item.commandsFile);
  let s=E.create(item.seed,item.weaponId,item.startFace,null,item.initialFirearmId,item.startSpace,
    {campaign:true,rulesVersion:12});
  for(const c of commands)s=E.dispatch(s,c);
  assert.equal(s.phase,'over');assert.equal(s.result,'campaign-win');
  const after=E.applyChapelRuling(s);checkAdoption(s,after);
  assert.deepEqual(gameplay(after),gameplay(s));
  assert.equal(after.phase,'over');assert.equal(after.result,'campaign-win');
});

test('a hand edited policy flag cannot bypass exact save replay verification',()=>{
  const before=old(314),tampered=clone(before);tampered.chapelRuling='escort-first';
  E.assertState(tampered);
  assert.throws(()=>E.importSave(E.exportSave(tampered)));
  const wrong=clone(before);wrong.chapelRuling='chapel-first';assert.throws(()=>E.assertState(wrong));
});

test('assembled reward and donation windows remain unchanged by metadata adoption',()=>{
  // Explicitly arranged boundary, separate from the natural/import proofs.
  const before=old(314);H(before).rewardKillWindow=true;H(before).rewardTransformWindow=true;
  H(before).rewardTurnStartWindow=true;H(before).rewardBeastWindow={round:before.round};
  before.mission.donationWindow=true;
  const after=E.applyChapelRuling(before);
  assert.deepEqual(gameplay(after),gameplay(before));E.assertState(after);
});
