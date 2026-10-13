const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine.js'),{clickCommand}=require('./helpers/public-command-ui.cjs');
const pendingCommands=require('./fixtures/v075-chapel-timing-natural-pending-commands.json');
const alternatives={
  'chapel-first':require('./fixtures/v075-chapel-timing-natural-chapel-first-commands.json'),
  'escort-first':require('./fixtures/v075-chapel-timing-natural-escort-first-commands.json'),
};
function natural(count=pendingCommands.length){
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  for(const c of pendingCommands.slice(0,count))s=E.dispatch(s,c);
  return s;
}
test('natural chapel arrival reaches the unresolved simultaneous effects and restores the pending decision',()=>{
  const before=natural(314),restored=E.importSave(E.exportSave(before));
  assert.equal(before.phase,'firearm_react');
  const pending=clickCommand(restored,pendingCommands[314]);
  assert.equal(pending.setup.rulesVersion,12);assert.equal(pending.mission.chapter,3);
  assert.deepEqual(pending.mission.history[1].completed,[26,34,23]);
  assert.equal(pending.mission.choice,'chapel-order');assert.equal(pending.phase,'mission_choice');
  assert.equal(pending.mission.chapelArrival.beforeCard,59);assert(!pending.mission.completed.includes(39));
  assert.equal(pending.mission.escort.carrierId,pending.activeHunterId);
  assert.equal(E.missionView(pending).pending.options.length,2);
  assert.deepEqual(E.importSave(E.exportSave(pending)),pending);
});
function resolve(branch){
  const commands=alternatives[branch];
  assert.deepEqual(commands.slice(0,315),pendingCommands);
  let s=E.importSave(E.exportSave(natural()));
  for(const c of commands.slice(315)){
    s=clickCommand(s,c);assert.deepEqual(E.importSave(E.exportSave(s)),s);
  }
  assert.equal(s.phase,'hunter');assert.equal(E.hunter(s).hp,6);assert.equal(s.track,4);
  assert.equal(s.mission.choice,false);assert(!s.mission.chapelArrival&&!s.missionArrivalAfter);
  assert.deepEqual(s.mission.completed,[39]);assert.equal(s.rewardChoices.length,0);
  assert(E.hunter(s).ownedFirearms.includes('repeating-pistol'));
  assert(E.hunter(s).rewards.some(r=>r.kind==='old-hunter-bone'));
  assert(s.mission.revealed.includes(branch==='chapel-first'?59:57));
  assert(!s.mission.revealed.includes(branch==='chapel-first'?57:59));
  assert.equal(s.mission.donationWindow,branch==='chapel-first');
}
test('natural chapel-first adjudication completes escort rewards through actual controls and save resumes',()=>resolve('chapel-first'));
test('natural escort-first adjudication completes escort rewards through actual controls and save resumes',()=>resolve('escort-first'));
