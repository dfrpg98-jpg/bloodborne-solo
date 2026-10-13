const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),{boot}=require('./helpers/ui-harness.cjs');

// Each checkpoint is produced by public commands from a fresh hunt. No mission
// cards, history, map, or inventory are injected to manufacture visibility.
const wanted=new Set([1,2,8,9,12,13,14,18,24,25,35,37]),checkpoints=new Map();
for(const [file,stop]of [
 ['full-campaign-actual-v10-commands.json',25],
 ['v074-shelter-natural-commands.json',9],
 ['v074-ch2-bridge-natural-commands.json',37],
]){
 let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
 if(!checkpoints.has(1))checkpoints.set(1,s);
 for(const command of require('./fixtures/'+file)){
  s=E.dispatch(s,command);
  for(const number of wanted)if(!checkpoints.has(number)&&s.mission.revealed.includes(number))checkpoints.set(number,s);
  if(checkpoints.has(stop))break;
 }
}
function at(number){
 const s=checkpoints.get(number);assert(s,`natural checkpoint for card ${number}`);
 assert.deepEqual(E.importSave(E.exportSave(s)),s);
 const view=E.missionView(s);
 const ui=boot(s,view,E.rewardsView(s),{realInventory:true,engine:E,
  storage:{'bloodborne-hunt-v07':E.exportSave(s)}});
 assert.equal(ui.el('error').textContent,'');return {s,view,ui};
}
function objective(number,id){
 const result=at(number);result.objective=result.view.objectives.find(o=>o.id===id);
 assert(result.objective,`visible current objective ${id}`);
 assert(result.ui.el('missionObjectives').textContent.includes(result.objective.description));return result;
}

test('a fresh hunt names and describes only the already-revealed main mission',()=>{
 const {s,view,ui}=at(1);assert.deepEqual(s.mission.revealed,[1]);
 assert.deepEqual(view.objectives.map(o=>o.id),['main']);
 assert.match(ui.el('missionObjectives').textContent,/계몽 2장 이상/);
 assert.doesNotMatch(ui.el('missionObjectives').textContent,/우두머리|피신처|구조|사냥을 시작하다/);
});
test('card 2 makes the revealed main boss objective visible',()=>{
 const {objective:o}=objective(2,'main');assert.match(o.description,/재앙의 야수 우두머리 처치/);
});
test('card 8 shows escort instructions without the unrevealed chapel beast',()=>{
 const {s,objective:o}=objective(8,'shelter');assert(!s.mission.revealed.includes(9));
 assert.match(o.description,/민가 생존자를 오에돈 예배당으로 호위/);
 assert.doesNotMatch(o.description,/야수|처치|보상|손톱자국/);
});
test('card 9 reveals the chapel beast objective only after the escort arrival',()=>{
 const {s,objective:o}=objective(9,'shelter');assert(s.mission.revealed.includes(10));
 assert.match(o.description,/오에돈 예배당의 재앙의 야수 처치/);
 assert.doesNotMatch(o.description,/보상|손톱자국/);
});
test('card 12 shows interaction without predicting a chase or later choice',()=>{
 const {s,objective:o}=objective(12,'rescue');assert(!s.mission.revealed.includes(13));
 assert.match(o.description,/폐가 생존자 토큰과 상호작용/);
 assert.doesNotMatch(o.description,/추격|따라잡|선택|공격|도망|보상/);
});
test('card 13 reveals the chase condition without predicting the card 14 choice',()=>{
 const {s,objective:o}=objective(13,'rescue');assert(!s.mission.revealed.includes(14));
 assert.match(o.description,/적의 추격 없이 이동 종료/);
 assert.doesNotMatch(o.description,/선택|공격|도망|보상/);
});
test('card 14 permits its disclosed choice while future rune rewards stay absent',()=>{
 const {objective:o}=objective(14,'rescue');assert.match(o.description,/선택 해결/);
 assert.doesNotMatch(o.description,/피의 기쁨|카릴 문자|보상/);
});
test('card 18 shows only corpse deposits before card 19 adds an insight requirement',()=>{
 const {s,objective:o}=objective(18,'main');assert.deepEqual(s.mission.revealed,[17,18]);
 assert.match(o.description,/공동묘지에 시체 2개를 바치기/);
 assert.doesNotMatch(o.description,/계몽|성직자|페이즈|지하묘지/);
});
test('card 24 does not reveal the later scourge beast objective',()=>{
 const {s,objective:o}=objective(24,'card-24');assert(!s.mission.revealed.includes(25));
 assert.match(o.description,/야수 사냥 무리 또는 야수 사냥 하인 처치/);
 assert.doesNotMatch(o.description,/재앙의 야수|수혈액|보상/);
});
test('card 25 permits the now-disclosed scourge beast objective without its reward',()=>{
 const {objective:o}=objective(25,'card-24');assert.match(o.description,/재앙의 야수 처치/);
 assert.doesNotMatch(o.description,/수혈액|보상/);
});
test('card 35 shows the bridge minion fight without predicting the rescued escort',()=>{
 const {s,objective:o}=objective(35,'bridge');assert(!s.mission.revealed.includes(37));
 assert.match(o.description,/대교의 야수 사냥 하인 처치/);
 assert.doesNotMatch(o.description,/생존자|호위|진료소|예배당|연발총|유골/);
});
test('card 37 shows its disclosed destinations without predicting either reward',()=>{
 const {s,objective:o}=objective(37,'bridge');assert(!s.mission.revealed.includes(38));assert(!s.mission.revealed.includes(39));
 assert.match(o.description,/생존자를 진료소 또는 예배당으로 호위/);
 assert.doesNotMatch(o.description,/연발총|유골|불길한 경고|보상|56|57/);
});
test('an old real pending chapel save receives a neutral title and no future mission or reward comparison',()=>{
 let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:12});
 for(const command of require('./fixtures/v075-chapel-timing-natural-pending-commands.json'))s=E.dispatch(s,command);
 assert.equal(s.mission.choice,'chapel-order');assert(!s.mission.revealed.includes(39));
 assert.deepEqual(E.importSave(E.exportSave(s)),s);
 const pending=E.missionView(s).pending;
 assert.equal(pending.title,'호위 완료와 예배당 사건');
 assert.match(pending.description,/현재 공개된 카드의 지시/);
 assert.doesNotMatch(pending.description,/33|39|57|59|정령|화염방사기|꿈틀거림|고대 사냥꾼|연발총|더 불리|NPC/);
});
