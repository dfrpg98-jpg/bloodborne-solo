const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine.js'),{replayPublicTrace}=require('./helpers/public-command-ui.cjs');
const {records}=require('./fixtures/v075-clinic-completion-manifest.json');
assert.deepEqual(records.map(x=>x.card),[51,52]);
function replay(card,ui){
  const r=records.find(x=>x.card===card),t=r.setup;
  assert.equal(t.startingConsumable,null);assert.equal(t.rulesVersion,12);
  const commands=require('./fixtures/'+r.commandsFile);
  assert.equal(commands.length,r.commandCount);
  // Frozen public traces are historical rules13 regressions. Current rules14
  // natural campaigns are verified separately with explicit kill reactions.
  let s=E.create(t.seed,t.weaponId,t.face,null,t.firearmId,t.startSpace,{campaign:true,rulesVersion:13});
  let entry=false,completed=false;let collected=0;
  const checkpoint=(before,next,index)=>{
    s=next;
    if(s.mission.chapter===3){
      const gained=(s.mission.heldSurvivors[s.activeHunterId]||0)-(before.mission.heldSurvivors?.[s.activeHunterId]||0);
      if(gained>0)collected+=gained;
      if(s.mission.revealed.includes(card)&&!entry){
        entry=true;assert.equal(E.missionView(s).insight,0);
        const history=s.mission.history[1].completed;
        assert(history.includes(card===51?28:26));
        assert(!history.includes(card===51?26:28));
        if(card===52)assert(!history.includes(34));
      }
      if(s.mission.completed.includes(r.completionCard))completed=true;
    }
    if(ui||r.checkpoints.includes(index+1))assert.deepEqual(E.importSave(E.exportSave(s)),s);
  };
  if(ui){
    const replay=replayPublicTrace(s,commands,{label:`card ${card}`,onCheckpoint({state,beforeReference,index}){checkpoint(beforeReference,state,index);}});
    s=replay.state;
  }else{
    for(const [index,command] of commands.entries()){const before=s;checkpoint(before,E.dispatch(s,command),index);}
  }
  assert(entry&&completed);assert.equal(s.result,null);
  assert.equal(s.phase,r.final.phase);assert.equal(s.track,r.final.track);
  assert.equal(E.hunter(s).hp,r.final.hp);assert(!E.hunter(s).inDream);
  assert.equal(E.hunter(s).position,r.final.position);
  assert.deepEqual(s.mission.completed,r.final.completed);
  assert.equal(s.rewardChoices.length,0);
  assert(E.hunter(s).rewards.some(x=>x.kind===r.reward));
  assert.equal(E.missionView(s).objectives.find(x=>x.id===`card-${card}`).status,'완료');
  if(card===52){assert(collected>=2);assert.equal(s.mission.deposits.clinic,2);
    assert.equal(s.mission.heldSurvivors[s.activeHunterId]||0,0);assert.equal(E.missionView(s).insight,1);}
  return s;
}
test('historical rules13 natural card 51 finishes research and rewards from a normal chapter-one start',()=>replay(51,false));
test('historical rules13 natural card 52 delivers two new survivors and grants the clinic sanctuary without a retained lock',()=>replay(52,false));
test('historical rules13 actual controller completes all natural card 51 decisions and restarts every saved action',()=>replay(51,true));
test('historical rules13 actual controller completes all natural card 52 decisions and restarts every saved action',()=>replay(52,true));
