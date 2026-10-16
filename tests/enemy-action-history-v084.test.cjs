const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/hunt-engine');
const ED = require('../src/enemy-deck');
const makeHistory = require('../src/enemy-action-history');

test('six public actions remain until the next actual shuffle, which starts a fresh record', () => {
  const history = makeHistory({ E, labels: ED.labels });
  let state = { enemyDeck: ['basic','special','basic','ability','basic','special'], enemyDiscard: [], events: [], round: 1 };
  for (let i = 0; i < 6; i++) {
    const before = structuredClone(state), kind = ED.draw(state, (_s, cards) => [...cards].reverse());
    state.events.push({ round: 1, text: `야수 사냥 무리 A면 · ${ED.labels[kind]}: 행동${i}.` });
    history.observe(before, state);
    assert.deepEqual(history.view().records.map(r => r.kind), state.enemyDiscard);
  }
  assert.equal(history.view().records.length, 6);
  const before = structuredClone(state), kind = ED.draw(state, (_s, cards) => [...cards].reverse());
  state.events.push({ round: 2, text: `야수 사냥 무리 A면 · ${ED.labels[kind]}: 새 행동.` });
  history.observe(before, state);
  assert.deepEqual(history.view().records.map(r => r.action), ['새 행동']);
  assert.deepEqual(history.view().records.map(r => r.kind), state.enemyDiscard);
});

test('bounded event logs do not lose a revealed action, and boss decks stay separate', () => {
  const history = makeHistory({ E, labels: ED.labels });
  const before = { enemyDeck: ['basic'], enemyDiscard: ['special'], events: Array.from({length:180}, (_,i)=>({round:1,text:'이동'+i})) };
  history.reset(before);
  const after = structuredClone(before); after.enemyDeck=[]; after.enemyDiscard.push('basic');
  after.events.shift(); after.events.push({round:2,text:'야수 사냥 하인 B면 · 기본 공격: 벽돌 강타.'});
  history.observe(before, after);
  const boss = structuredClone(after); boss.events.shift(); boss.events.push({round:2,text:'성직자 야수 2페이즈 · 내려찍기: 내려찍기.'});
  history.observe(after, boss);
  assert.deepEqual(history.view().records.map(r=>r.kind),after.enemyDiscard);
  assert.deepEqual(history.view().records.filter(r=>r.action).map(r=>r.action), ['벽돌 강타']);
  assert(!JSON.stringify(history.view()).includes('내려찍기'));
});

test('supported temporary non-boss trials restore their genuine shared stage-labelled reveal without changing the save', () => {
  for(const provisional of ['female-patient-a','female-patient-b','iosefka-hostile']){
    let state=E.create(123,'burial',0,null,'hunter-pistol','center',{campaign:false,provisional});
    const history=makeHistory({E,labels:ED.labels});history.reset(state);
    const before=state;
    state=E.dispatch(state,{type:'ATTACK',enemyId:state.enemies[0].id,cardId:E.hunter(state).hand[0].id,slot:0});
    const save=E.exportSave(state);history.observe(before,state);
    assert.equal(state.enemyDiscard.length,1);
    assert.deepEqual(history.view().records.map(record=>record.kind),state.enemyDiscard);
    assert.equal(history.view().records[0].action,state.combat.action.name);
    assert.equal(history.view().records[0].enemy,E.enemyDef(state,state.enemies[0]).name);
    assert.equal(history.view().replayComplete,true);
    const loaded=E.importSave(save),guarded={...loaded};
    for(const key of ['enemyDeck','commands','setup'])Object.defineProperty(guarded,key,{get(){throw Error('unnecessary hidden/replay read: '+key);}});
    const restored=makeHistory({E:{create(){throw Error('verified public log must not replay');}},labels:ED.labels});
    restored.reset(guarded);assert.deepEqual(restored.view(),history.view());
    assert.equal(E.exportSave(state),save);assert.equal(E.exportSave(loaded),save);
  }
});

test('temporary Cleric stage actions never replace an existing matching-kind shared reveal or read its own boss deck', () => {
  const shared=Object.freeze({round:1,text:'야수 사냥 무리 A면 · 기본 공격: 도끼 휘두르기.'});
  const deck=new Proxy([], {get(_target,key){if(key==='length')return 5;throw Error('hidden shared draw order read');}});
  let source={enemyDeck:deck,enemyDiscard:Object.freeze(['basic']),events:Object.freeze([shared]),mission:{chapter:1}};
  const history=makeHistory({E:{create(){throw Error('public log is sufficient');}},labels:ED.labels});history.reset(source);
  const expected=history.view();
  for(const text of ['성직자 야수 · 임시 1단계 · 기본 공격: 임시 · 팔 휘두르기.',
    '성직자 야수 · 임시 2단계 · 특수 공격: 임시 · 연속 내려치기.',
    '성직자 야수 2페이즈 · 내려찍기: 내려찍기.']){
    const before=source;source={...source,events:Object.freeze([...source.events,Object.freeze({round:1,text})])};
    Object.defineProperty(source,'bossDecks',{get(){throw Error('hidden boss deck read');}});
    history.observe(before,source);assert.deepEqual(history.view(),expected);
    const guarded={...source};Object.defineProperty(guarded,'commands',{get(){throw Error('unnecessary replay');}});
    history.reset(guarded);assert.deepEqual(history.view(),expected,'same-kind boss action cannot become the shared last-N record');
  }
});

test('a public discard with no parseable log or commands exposes only its known kind order and reports incomplete details', () => {
  const source=Object.freeze({enemyDiscard:Object.freeze(['basic','special']),events:Object.freeze([{round:4,text:'이전 형식의 공개 문구'}]),
    commands:Object.freeze([]),mission:Object.freeze({chapter:2})});
  const before=JSON.stringify(source),history=makeHistory({E:{create(){throw Error('there are no replay commands');}},labels:ED.labels});
  history.reset(source);const view=history.view();
  assert.equal(view.replayComplete,false);assert.deepEqual(view.records.map(record=>record.kind),source.enemyDiscard);
  assert.deepEqual(view.records.map(record=>[record.order,record.round,record.enemy,record.action]),[[1,null,'',''],[2,null,'','']]);
  view.records[0].kind='not-public';assert.equal(history.view().records[0].kind,'basic');assert.equal(JSON.stringify(source),before);
});

test('successful command replay with an unrecognized reveal still falls back to public kinds rather than claiming an empty complete history', () => {
  const initial={enemyDeck:Array(6).fill('opaque'),enemyDiscard:[],events:[]};
  const resolved={enemyDeck:Array(5).fill('opaque'),enemyDiscard:['ability'],events:[{round:1,text:'과거 형식으로 공개한 전용 능력'}]};
  const source={...resolved,initialSeed:1,setup:{},commands:[{type:'ACCEPTED_OLD'}]};
  const before=JSON.stringify(source),history=makeHistory({E:{create(){return initial;},dispatch(){return resolved;}},labels:ED.labels});
  history.reset(source);
  assert.equal(history.view().replayComplete,false);assert.deepEqual(history.view().records.map(record=>record.kind),['ability']);
  assert.equal(history.view().records[0].action,'');assert.equal(JSON.stringify(source),before);
});

test('an incomplete previous cycle becomes complete only when the shared deck actually shuffles and reveals its new first action', () => {
  const before={enemyDeck:[],enemyDiscard:['basic','special','basic','special','ability','basic'],events:[],round:1};
  const history=makeHistory({E,labels:ED.labels});history.reset(before);
  assert.equal(history.view().replayComplete,false);assert.equal(history.view().records.length,6);
  const after=structuredClone(before),kind=ED.draw(after,(_state,cards)=>[...cards].reverse());
  after.events.push({round:2,text:`야수 사냥 무리 A면 · ${ED.labels[kind]}: 새로운 첫 행동.`});
  history.observe(before,after);
  assert.equal(history.view().replayComplete,true);assert.deepEqual(history.view().records.map(record=>record.action),['새로운 첫 행동']);
  assert.deepEqual(history.view().records.map(record=>record.kind),after.enemyDiscard);
});

test('old normal campaign saves restore exactly the current discard order without changing rules or save data', () => {
  const commands = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/full-campaign-actual-v10-commands.json'),'utf8'));
  let state = E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  const history = makeHistory({E, labels:ED.labels});
  let lastPublic = null;
  for (const command of commands) {
    const before=state; state=E.dispatch(state,command); history.observe(before,state);
    assert.deepEqual(history.view().records.map(r=>r.kind),state.enemyDiscard);
    let repeatedReplay = 0;
    const restoredFromPublicLog = makeHistory({E:{...E,create(...args){repeatedReplay++;return E.create(...args);}},labels:ED.labels});
    restoredFromPublicLog.reset(state);
    assert.deepEqual(restoredFromPublicLog.view(),history.view());
    assert.equal(repeatedReplay,0,'a verified save with its current public actions does not replay the campaign twice');
    if(state.enemyDiscard.length) lastPublic={state,view:history.view()};
  }
  const saved = E.exportSave(state), restored = makeHistory({E, labels:ED.labels});
  restored.reset(state);
  assert.deepEqual(restored.view(),history.view());
  assert.equal(E.exportSave(state),saved);
  assert.equal(restored.view().replayComplete,true);
  assert(restored.view().records.length <= 6);
  assert(lastPublic);
  const missingPublicLog={...lastPublic.state,events:[]};
  restored.reset(missingPublicLog);
  assert.deepEqual(restored.view(),lastPublic.view,'a truncated public log falls back to verified command replay');
});
