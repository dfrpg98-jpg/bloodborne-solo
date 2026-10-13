'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),publicText=require('../hunt-public-text');
const Feedback=require('../hunt-mission-feedback'),data=require('../campaigns/long-hunt/data.json');
const options={E,publicText,data},cache=new Map();
function trace(file) {
  if(cache.has(file))return cache.get(file);
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:14});
  const transitions=[];
  function dispatch(command) {
    const before=s;s=E.dispatch(s,command);
    const events=Feedback.describe(before,s,options);
    if(events.length)transitions.push({before,after:s,command,events});
  }
  for(const command of require('./fixtures/'+file)) {
    // These pre-rules14 traces retain their original choices. Explicitly pass
    // an optional kill reaction only when the next recorded command is not a
    // legal reward use. This is an actual accepted, replayable engine command.
    const usingReaction=()=>command.type==='USE_REWARD'&&E.killReactionActions(s).some(action=>
      !action.disabled&&action.command.type==='USE_REWARD'&&action.command.rewardId===command.rewardId&&
      action.command.enemyId===command.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!usingReaction())dispatch({type:'PASS_KILL_REACTION'});
    dispatch(command);
  }
  const result={transitions,state:s};cache.set(file,result);return result;
}
const full=()=>trace('full-campaign-actual-v10-commands.json');
function revealed(trace,number) {
  const transition=trace.transitions.find(t=>!t.before.mission.revealed.includes(number)&&t.after.mission.revealed.includes(number));
  assert(transition,'naturally revealed stage '+number);return transition;
}
function completed(trace,number) {
  const transition=trace.transitions.find(t=>!t.before.mission.completed.includes(number)&&t.after.mission.completed.includes(number));
  assert(transition,'naturally completed outcome '+number);return transition;
}
function event(t,kind,id) {
  const matches=t.events.filter(e=>e.kind===kind&&e.objectiveId===id);
  assert.equal(matches.length,1,`one ${kind} event for ${id}`);return matches[0];
}
function publicCopy(events) {return events.map(({title,description,effects=[]})=>[title,description,...effects].join(' ')).join('\n');}

test('a new hunt announces the public initial goal without unrevealed missions or historical completions',()=>{
  const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
  assert.deepEqual(Feedback.describe(null,s,options).map(e=>[e.kind,e.objectiveId]),[['new','main']]);
  assert.match(publicCopy(Feedback.describe(null,s,options)),/계몽 2개 이상.*중앙 등불 타일/);
  assert.doesNotMatch(publicCopy(Feedback.describe(null,s,options)),/우두머리|피신처|구조|예배당|혈석/);
  assert.deepEqual(Feedback.describe(s,s,options),[]);
  assert.deepEqual(Feedback.describe(null,E.create(),options),[],'practice has no campaign mission notices');
});

test('the actual yard encounter creates one new goal and excludes its special enemy rule',()=>{
  const t=revealed(full(),5),e=event(t,'new','mob');
  assert.equal(t.after.mission.revealed.includes(6),true);
  assert.equal(t.events.length,1);assert.equal(e.title,'사냥을 시작하다');
  assert.match(e.description,/마당 등불.*야수 사냥 무리.*처치/);
  assert.doesNotMatch(publicCopy(t.events),/군중|불굴|우두머리|랜턴|루드비히/);
});

test('an actual mission kill reports its completed goal, actual insight and fog change exactly once',()=>{
  const t=completed(full(),7),e=event(t,'completed','mob');
  assert.equal(t.events.length,1,'reward revelation cannot create a second new mission');
  assert.equal(e.title,'사냥을 시작하다');assert.equal(e.description,'마당 등불의 야수 사냥 무리를 처치했습니다.');
  assert.deepEqual(e.effects,['이번 챕터 계몽 +1 · 현재 1개','마당 등불의 안개가 걷혔습니다.']);
  assert.doesNotMatch(e.description,/처치하세요|완수하세요/);
  assert.deepEqual(Feedback.describe(t.after,t.after,options),[]);
});

test('the same shelter mission changes from escort to chapel fight and uses its disclosed completion title',()=>{
  const run=trace('v074-shelter-natural-commands.json');
  const start=revealed(run,8);event(start,'new','shelter');
  assert.doesNotMatch(publicCopy(start.events),/재앙의 야수|손톱자국/);
  const arrived=revealed(run,9),e=event(arrived,'updated','shelter');
  assert.equal(arrived.after.mission.revealed.includes(10),true);assert.equal(arrived.events.length,1);
  assert.equal(e.title,'피신처');assert.match(e.description,/예배당.*재앙의 야수.*처치/);
  assert(!arrived.events.some(e=>e.kind==='new'),'same-title next stage is an update');
  const won=completed(run,11),done=event(won,'completed','shelter');
  assert.equal(done.title,'무사히 밤을 넘기다');assert.match(done.description,/예배당.*처치했습니다/);
  assert.equal(won.events.length,1);assert(!won.events.some(e=>e.kind==='new'));
});

test('rescue interaction and resolved survivor choice expose only their current actionable stage',()=>{
  const run=full(),start=revealed(run,12),flee=revealed(run,13),choice=revealed(run,14);
  assert.match(event(start,'new','rescue').description,/폐가.*상호작용/);
  assert.doesNotMatch(publicCopy(start.events),/추격|선택|피의 기쁨|도망치/);
  assert.match(event(flee,'updated','rescue').description,/적의 추격 없이 이동/);
  assert.doesNotMatch(publicCopy(flee.events),/피의 기쁨|자비란 없다/);
  assert.match(event(choice,'updated','rescue').description,/선택을 해결/);
  assert.doesNotMatch(publicCopy(choice.events),/피의 기쁨|카릴 문자/);
  const completedChoice=event(completed(run,15),'completed','rescue');
  assert.equal(completedChoice.title,'자비란 없다');assert.match(completedChoice.description,/공격.*마쳤습니다/);
});

test('one actual clinic milestone reports both an updated research mission and a new sanctuary goal',()=>{
  const t=revealed(full(),25);
  assert.equal(t.after.mission.revealed.includes(27),true);
  assert.deepEqual(t.events.map(e=>[e.kind,e.objectiveId]),[['updated','card-24'],['new','card-27']]);
  assert.match(event(t,'updated','card-24').description,/재앙의 야수.*처치/);
  assert.match(event(t,'new','card-27').description,/생존자 2개.*진료소/);
  assert.doesNotMatch(publicCopy(t.events),/수혈액|사자의 선물/);
});

test('fresh chapter transition announces its initial goal without replaying prior outcomes',()=>{
  const run=full(),transitions=run.transitions.filter(t=>t.before.mission.chapter!==t.after.mission.chapter);
  assert.equal(transitions.length,2);
  for(const t of transitions) {
    assert.deepEqual(t.events.map(e=>[e.kind,e.objectiveId]),[['new','main']]);
    assert.equal(t.after.mission.completed.length,0);assert(t.after.mission.history.length>0);
    assert(!t.events.some(e=>e.effects),'old-chapter insight is not subtracted or re-awarded');
  }
  assert.match(transitions[0].events[0].description,/공동묘지.*시체 2개/);
  assert.match(transitions[1].events[0].description,/성직자 야수 봉인/);
});

test('actual boss phase and captivity release are objective updates without false special-rule missions',()=>{
  const run=full();
  for(const number of [2,19,20,21,42]) {
    const t=revealed(run,number);event(t,'updated','main');
    assert(!t.events.some(e=>e.kind==='new'&&e.objectiveId==='main'));
    assert.doesNotMatch(publicCopy(t.events),/멈출 줄 모르는 난동|무리 소환|카드|[AB]\s*면|앞면|뒷면|\d+번/);
  }
  assert.match(event(revealed(run,21),'updated','main').description,/지하묘지로 유인/);
  assert.match(event(revealed(run,42),'updated','main').description,/풀려난 성직자 야수.*최종 처치/);
});

test('main victory distinguishes completed goal and completed chapter, including the final campaign',()=>{
  const run=full();assert.equal(run.state.result,'campaign-win');
  for(const number of [4,23,44]) {
    const t=completed(run,number);event(t,'completed','main');
    const e=event(t,'chapter','main');assert.equal(e.title,`챕터 ${t.after.mission.chapter} 완수`);
    assert.equal(t.events.filter(e=>e.kind==='new').length,0);
  }
  assert.equal(event(completed(run,44),'chapter','main').description,'기나긴 사냥의 모든 챕터를 완수했습니다.');
});

test('every natural current-rules event is public and observing it preserves both exact saves',()=>{
  for(const run of [full(),trace('v074-shelter-natural-commands.json')])for(const t of run.transitions) {
    const before=E.exportSave(t.before),after=E.exportSave(t.after);
    const repeated=Feedback.describe(t.before,t.after,options);
    assert.deepEqual(repeated,t.events,'the observer is deterministic');
    assert.equal(E.exportSave(t.before),before);assert.equal(E.exportSave(t.after),after);
    assert.deepEqual(Feedback.describe(t.after,t.after,options),[],'ordinary render cannot repeat a notice');
    assert.doesNotMatch(publicCopy(t.events),/카드|[AB]\s*면|앞면|뒷면|\d+번\s/);
    assert.equal(new Set(t.events.map(e=>e.key)).size,t.events.length,'coincident distinct event keys are unique');
  }
  assert.deepEqual(E.importSave(E.exportSave(full().state)),full().state,'additional recorded reaction passes remain a real replayable save');
});

test('simultaneous completion and activation retains each actual result without special/reward duplicates',()=>{
  const run=trace('v074-first-chapel-warning-natural-commands.json');
  const t=completed(run,39);
  assert.equal(t.after.mission.chapter,3);assert.equal(t.after.mission.revealed.includes(57),true);
  assert.deepEqual(t.events.map(e=>[e.kind,e.objectiveId]),[['completed','bridge'],['new','card-57']]);
  assert.equal(event(t,'completed','bridge').title,'불길한 경고');
  assert.equal(event(t,'new','card-57').title,'구원');
});

test('defeating the bridge guard updates its escort objective without prematurely awarding completion',()=>{
  const t=revealed(trace('v074-first-chapel-warning-natural-commands.json'),37);
  const e=event(t,'updated','bridge');
  assert.match(e.description,/생존자를 진료소 또는 예배당으로 호위/);
  assert(!t.events.some(e=>e.kind==='completed'&&e.objectiveId==='bridge'));
  assert.doesNotMatch(publicCopy(t.events),/고대 사냥꾼의 유골|연발총|불길한 경고/);
});

test('resolved Iosefka attack is an updated current fight in both the public HUD and notification',()=>{
  const run=trace('v074-attack-iosefka-natural-commands.json'),t=revealed(run,47);
  assert.equal(event(t,'updated','truth').description,'진료소의 이오세프카를 처치하세요.');
  const view=publicText.chapter(t.after,E.missionView(t.after),data);
  assert.equal(view.objectives.find(o=>o.id==='truth').description,'진료소의 이오세프카를 처치하세요.');
  assert.doesNotMatch(publicCopy(t.events),/실험을 돕|전조|생존자/);
  const complete=event(completed(run,48),'completed','truth');
  assert.equal(complete.title,'목표 처치: 이오세프카');assert.equal(complete.description,'진료소의 이오세프카를 처치했습니다.');
});

test('resolved Iosefka help retains its distinct disclosed escort action and completed experiment outcome',()=>{
  const run=trace('v074-help-iosefka-natural-commands.json'),t=revealed(run,49);
  const e=event(t,'updated','truth');assert.match(e.description,/상호작용해 붙잡고 진료소로 호위/);
  const view=publicText.chapter(t.after,E.missionView(t.after),data);
  assert.equal(view.objectives.find(o=>o.id==='truth').description,e.description);
  assert.doesNotMatch(publicCopy(t.events),/이오세프카를 처치|전조|계속되는 실험/);
  const complete=event(completed(run,50),'completed','truth');
  assert.equal(complete.title,'계속되는 실험');assert.match(complete.description,/실험 생존자.*호위했습니다/);
});

test('a presentation contract retains two simultaneous completions while showing their combined actual insight once',()=>{
  // This is an isolated presentation contract, not a claim of a natural save.
  // Natural accepted-command coverage is provided by the campaign tests above.
  const objective=(id,title,status,description)=>({id,title,status,description});
  const before={mission:{chapter:1,revealed:[1,5,6,8,9,10],completed:[],fog:['tile-04','tile-17']},view:{chapter:1,
    insight:0,fog:['tile-04','tile-17'],objectives:[
      objective('mob','사냥을 시작하다','진행 중','마당 등불의 야수 사냥 무리 처치'),
      objective('shelter','피신처','진행 중','오에돈 예배당의 재앙의 야수 처치')
    ]}};
  const after=structuredClone(before);after.mission.revealed.push(7,11);after.mission.completed.push(7,11);
  after.mission.fog=[];after.view.fog=[];after.view.insight=2;
  after.view.objectives.forEach(o=>o.status='완료');
  const events=Feedback.describe(before,after,{...options,E:{missionView:s=>s.view}});
  assert.deepEqual(events.map(e=>[e.kind,e.objectiveId,e.title]),[
    ['completed','mob','사냥을 시작하다'],['completed','shelter','무사히 밤을 넘기다']
  ]);
  assert.equal(events.flatMap(e=>e.effects||[]).filter(text=>text.includes('계몽 +2')).length,1);
  assert.equal(events.flatMap(e=>e.effects||[]).filter(text=>text.includes('안개가 걷혔습니다')).length,2);
});
