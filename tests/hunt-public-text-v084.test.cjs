const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../src/hunt-public-text'), E = require('../src/hunt-engine');
const C = require('../campaigns/long-hunt/data.json');
const source = number => C.cards.find(item => item.number === number);
const text = value => JSON.stringify(value);
const allCodes = /\d+\s*번\s*카드|[AB]\s*면|앞면|뒷면/;

// These minimal read-only inputs exercise presentation permissions. They are
// not fabricated gameplay fixtures or evidence of normal campaign completion.
function presentationInput(revealed, completed = [], history = [], chapter = 3) {
  return { hunters: [{}], mission: { chapter, revealed, completed, history, discarded: [] } };
}
for (const [target, prior, words] of [[46,[26,28],/새로운 진실/],[51,[28],/새로운 위협/],[52,[26],/피신처로 마련할/],[24,[],/해결해야 할 일을 조사/]]) {
  test(`resolved clinic event shows only the actual ${target} branch`, () => {
    const s = presentationInput([40,41,45,target], [], [{chapter:2,revealed:[...prior],completed:[...prior]}]);
    const frozen = structuredClone(s), result = P.entry(source(45), s, { data:C });
    assert.equal(result.rules.length, 1); assert.match(result.rules[0], words);
    assert.doesNotMatch(text(result), /그렇지 않으면|갖고 있지 않|46번|51번|52번|24번|카드/);
    assert.deepEqual(s, frozen);
  });
}
test('re-reading an earlier clinic event cannot change its resolved branch after later research rewards', () => {
  const s = presentationInput([40,41,45,51,26], [26], [{chapter:2,revealed:[28],completed:[28]}]);
  assert.match(P.entry(source(45), s, {data:C}).rules[0], /새로운 위협/);
  assert.doesNotMatch(P.entry(source(45), s, {data:C}).rules[0], /새로운 진실/);
});
test('later disclosure of another referenced event cannot erase or replace the first resolved clinic outcome', () => {
  const s=presentationInput([40,41,45,51,26,24],[26],[{chapter:2,revealed:[28],completed:[28]}]);
  assert.match(P.entry(source(45),s,{data:C}).rules[0],/새로운 위협/);
  assert.doesNotMatch(P.entry(source(45),s,{data:C}).rules[0],/먼저 해결|새로운 진실|해결해야 할 일을 조사/);
});
test('an unresolved old chapel decision does not infer or expose either future result', () => {
  let s = E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:12});
  for (const command of require('./fixtures/v075-chapel-timing-natural-pending-commands.json')) s=E.dispatch(s,command);
  assert.equal(s.mission.choice,'chapel-order');
  const before=E.exportSave(s), result=P.entry(source(56),s,{data:C});
  assert.deepEqual(result.rules,['이곳의 상황을 확인하고 있습니다. 현재 진행 중인 사건을 먼저 해결하세요.']);
  assert.doesNotMatch(text(result),/불길한 경고|안전한 피신처|구원|소모품|57|59|33/);
  assert.equal(E.exportSave(s),before);
});
test('currently disclosed choices stay available while their unopened outcome names stay hidden', () => {
  const s=presentationInput([1,12,13,14],[],[],1), result=P.entry(source(14),s,{data:C});
  assert.match(text(result),/여자를 공격|도망치라고 말/);
  assert.doesNotMatch(text(result),/피의 기쁨|자비를 베풀다|15번|16번|카드/);
});
test('unknown and forged record titles cannot cross the public-story boundary', () => {
  const s=presentationInput([1],[],[],1);
  assert.equal(P.entry(source(45),s,{data:C}),null);
  assert.equal(P.entry(source(1),s,{data:C,chapter:3}),null);
  const forged=P.entry({number:1,title:'미래 결말',rules:['미래 보상'],image:'secret.jpg'},s,{data:C});
  assert.equal(forged.title,'재앙의 근원');assert.doesNotMatch(text(forged),/미래|secret/);
});
test('current chapter activation hints expose prepared places but no future task or reward names', () => {
  const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  const before=E.exportSave(s), v=P.chapter(s,E.missionView(s),C);
  assert.equal(v.chapter,1);assert.deepEqual(v.objectives.map(item=>item.id),['main']);
  assert.deepEqual(v.activations.map(item=>item.title),['마당 등불','민가','폐가']);
  assert.match(v.main.description,/계몽 2개 이상/);
  assert.doesNotMatch(text(v),/우두머리|성직자|피신처|구조|루드비히|손톱자국|이오세프카|대교/);
  assert.equal(P.chapter(s,{...E.missionView(s),chapter:3},C),null);
  assert.equal(E.exportSave(s),before);
});
test('archived public stories remain readable without opening unrevealed archived records', () => {
  const s=presentationInput([40,41],[],[{chapter:1,revealed:[1,8],completed:[]}]);
  assert(P.entry({...source(8),chapter:1},s,{data:C}));
  assert.equal(P.entry({...source(9),chapter:1},s,{data:C}),null);
});
test('mission sentences keep their condition and finish naturally after internal reveal references are removed', () => {
  const all=presentationInput(C.cards.map(item=>item.number),[],[],1);
  for (const c of C.cards) {
    const result=P.entry(c,all,{data:C});
    for (const line of result.rules) {
      assert.doesNotMatch(line,/카드|\d+번|[:：]$/,'public mission '+c.number+': '+line);
      assert.match(line,/[.!?]$/,'complete sentence '+c.number+': '+line);
    }
  }
  assert.match(P.clean(source(5).rules[2]),/야수 사냥 무리를 처치하면 이번 임무를 완수합니다\.$/);
  assert.match(P.clean(source(8).rules[1]),/토큰을 가진 채로 오에돈 예배당 타일에서 이동을 마치면 새로운 이야기가 이어집니다\.$/);
});
test('contextual names remove board labels while preserving gameplay values and readable action costs', () => {
  assert.equal(P.clean('스탯 카드 2장을 버려 준비합니다.','skill'),'기술 2개를 버려 준비합니다.');
  assert.equal(P.clean('소모품 카드 1장을 버립니다.','skill'),'소모품 1개를 버립니다.');
  assert.equal(P.clean('장치무기 카드 A면 · 빠른 공격','skill'),'장치무기 · 빠른 공격');
  assert.equal(P.clean('뒷면으로 뒤집습니다.','skill'),'다른 형태로 전환합니다.');
  assert.doesNotMatch(P.clean('A/B면 · 3속도 4피해','skill'),allCodes);
  assert.match(P.clean('적 행동 카드 · 속도 3 / 피해 4','skill'),/속도 3 \/ 피해 4/);
});
test('context replacements inflect Korean particles and quantities without changing the number or source meaning', () => {
  for (const [context,label,obj,sub,topic,withWord] of [
    ['skill','기술','을','이','은','로'],['equipment','장비','를','가','는','로'],
    ['item','소모품','을','이','은','으로'],['mission','임무','를','가','는','로']
  ]) {
    assert.equal(P.clean('해당 카드를 사용합니다.',context),`해당 ${label}${obj} 사용합니다.`);
    assert.equal(P.clean('카드가 준비되었습니다.',context),`${label}${sub} 준비되었습니다.`);
    assert.equal(P.clean('카드는 다시 준비합니다.',context),`${label}${topic} 다시 준비합니다.`);
    assert.equal(P.clean('카드로 행동합니다.',context),`${label}${withWord} 행동합니다.`);
    assert.equal(P.clean('카드 2장을 버립니다.',context),`${label} 2개를 버립니다.`);
  }
  assert.equal(P.clean('소모품 카드가 준비되었습니다.','skill'),'소모품이 준비되었습니다.');
  assert.equal(P.clean('해당 기술를 소모품 덱에서 1장 가져옵니다.','item'),'해당 기술을 소모품 덱에서 1장 가져옵니다.');
  assert.equal(P.clean(P.clean('스탯 카드 2장을 버립니다.','skill'),'skill'),'기술 2개를 버립니다.');
});
test('clinic rules draw a hand skill while named enemy references keep the actor and exact token count', () => {
  const clinic='자기 차례마다 한 번씩, 사냥꾼은 1 피해를 받으면서 카드 1장을 뽑을 수 있습니다.';
  assert.equal(P.clean(clinic,'skill'),'자기 차례마다 한 번씩, 사냥꾼은 1 피해를 받으면서 기술 1개를 뽑을 수 있습니다.');
  assert.doesNotMatch(P.clean(clinic,'skill'),/임무|장비|소모품/);
  for(const context of ['skill','mission','item','equipment']){
    assert.equal(P.clean('성직자 야수 카드에 계몽 토큰 1개를 놓습니다.',context),'성직자 야수에게 계몽 토큰 1개를 놓습니다.');
    assert.equal(P.clean('성직자 야수 카드의 계몽 토큰마다 -1 피해를 줍니다.',context),'성직자 야수의 계몽 토큰마다 -1 피해를 줍니다.');
    assert.equal(P.clean('이오세프카 NPC 카드를 선택합니다.',context),'이오세프카를 선택합니다.');
  }
});
test('public log and transition labels omit internal identifiers without looking up an unopened title', () => {
  assert.equal(P.clean('기나긴 사냥 45 · 안전한 피신처','skill'),'기나긴 사냥 · 안전한 피신처');
  const transition=P.clean('53번 카드의 지시로 35번을 이번 챕터에서 새로 공개했습니다. 이후 진행은 현재 공개된 카드의 지시를 따르세요.','mission');
  assert.equal(transition,'임무 기록의 지시로 새로운 임무를 이번 챕터에서 새로 공개했습니다. 이후 진행은 현재 공개된 임무의 지시를 따르세요.');
  assert.doesNotMatch(transition,/\d+번|카드|아슬아슬한 구조|불길한 경고|보상/);
});
test('task infinitives end as instructions while their original values and choices stay intact', () => {
  assert.equal(P.sentence('소모품 수집으로 얻은 생존자 2개를 진료소에 인도'),'소모품 수집으로 얻은 생존자 2개를 진료소에 인도하세요.');
  assert.equal(P.sentence('이오세프카를 공격하거나 실험을 돕기'),'이오세프카를 공격하거나 실험을 돕세요.');
  assert.equal(P.sentence('진료소에서 야수 사냥 무리 또는 야수 사냥 하인 처치'),'진료소에서 야수 사냥 무리 또는 야수 사냥 하인을 처치하세요.');
  assert.equal(P.sentence('재앙의 야수를 처치해 계몽 토큰 제거'),'재앙의 야수를 처치해 계몽 토큰을 제거하세요.');
  assert.equal(P.sentence('이번 챕터 계몽 2개 또는 두 번째 초기화까지 성직자 야수 봉인'),'이번 챕터 계몽 2개 또는 두 번째 초기화까지 성직자 야수를 봉인해 두세요.');
  assert.equal(P.sentence('예배당에서 이동을 마친 직후 소모품 기부'),'예배당에서 이동을 마친 직후 소모품을 기부하세요.');
  assert.equal(P.sentence('진료소의 이오세프카를 처치하세요.'),'진료소의 이오세프카를 처치하세요.');
});
for (const item of require('./fixtures/v075-clinic-completion-manifest.json').records) {
  test(`normal public-command clinic ${item.card} route retains its result through completion and save replay`, () => {
    const cfg=item.setup;let s=E.create(cfg.seed,cfg.weaponId,cfg.face,cfg.startingConsumable,cfg.firearmId,cfg.startSpace,{campaign:true,rulesVersion:cfg.rulesVersion});
    let entrance=null;
    for (const command of require('./fixtures/'+item.commandsFile)) {
      s=E.dispatch(s,command);
      if (!entrance && s.mission.chapter===3 && s.mission.revealed.includes(45)) entrance=P.entry(source(45),s,{data:C}).rules;
    }
    assert(entrance);assert(s.mission.completed.includes(item.completionCard));
    const before=E.exportSave(s), report=P.chapter(s,E.missionView(s),C);
    assert.deepEqual(P.entry(source(45),s,{data:C}).rules,entrance);
    assert.doesNotMatch(text(report.entries),allCodes);
    assert.equal(E.exportSave(s),before);assert.deepEqual(E.importSave(before),s);
  });
}
