const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),{boot}=require('./helpers/ui-harness.cjs');
const timing=require('./fixtures/v075-chapel-timing-natural-escort-first-commands.json');
const clinic52=require('./fixtures/v075-clinic52-completed-natural-commands.json');
// Replay each supplied natural prefix once. These are real public-command
// states; the controller boots each checkpoint through its real save importer.
const checkpoints=new Map();
function collect(commands,wanted,label){
 let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:12});
 for(const [index,command]of commands.entries()){
  const before=s;s=E.dispatch(s,command);
  if(wanted(s,before,command,index))checkpoints.set(label(s,before,command,index),s);
 }
}
collect(timing,(s,b,c,i)=>[276,303,317].includes(i),(_s,_b,_c,i)=>({276:'new-chapter',303:'new-escort',317:'current-warning'}[i]));
collect(clinic52,(s,b)=>s.mission.chapter===3&&s.mission.revealed.includes(53)&&!b.mission.revealed.includes(53),()=> 'past-warning');
function uiAt(name){
 const s=checkpoints.get(name);assert(s,`natural checkpoint exists: ${name}`);
 assert.deepEqual(E.importSave(E.exportSave(s)),s);
 const ui=boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
  storage:{'bloodborne-hunt-v07':E.exportSave(s)},engine:E});
 assert.equal(ui.el('error').textContent,'');return {s,ui};
}
test('natural chapter-three startup explains the reset and shows zero current insight despite retained chapter-two completions',()=>{
 const {s,ui}=uiAt('new-chapter');
 assert.deepEqual(s.mission.history[1].completed,[26,34,23]);
 assert.deepEqual(s.mission.revealed,[17,40,41]);assert.deepEqual(s.mission.completed,[]);
 assert.deepEqual(Object.keys(s.mission.targets),['main']);
 assert.equal(ui.el('missionInsight').textContent,'이번 챕터 완료 계몽 0장');
 assert.match(ui.el('missionNotices').textContent,/이전 챕터의 미완료 임무·임무 토큰·대상 적은 초기화/);
 assert.match(ui.el('missionNotices').textContent,/이번 챕터의 계몽 획득 수에는 더하지 않습니다/);
 assert.doesNotMatch(ui.el('missionNotices').textContent,/53번 카드의 지시로/);
 assert.match(ui.el('pastChapters').textContent,/완료 임무 이오세프카의 연구, 안전한 피신처: 오에돈 예배당, 야수를 가두었다/);
 assert.doesNotMatch(ui.el('pastChapters').textContent,/완료 카드|완료 임무\s*26\b/,'archived completions use known mission names, not internal card numbers');
 assert.doesNotMatch(ui.el('missionTokens').textContent,/호위 생존자/);
});
test('the naturally reopened bridge creates a new escort notice and token without counting card 37 as completed insight',()=>{
 const {s,ui}=uiAt('new-escort');
 assert([53,35,36,37].every(n=>s.mission.revealed.includes(n)));
 assert.deepEqual(s.mission.completed,[]);assert.equal(s.mission.escort.node,'tile-18:top');
 assert.equal(s.mission.targets.bridge.complete,true);
 assert.equal(ui.el('missionInsight').textContent,'이번 챕터 완료 계몽 0장');
 assert.match(ui.el('missionNotices').textContent,/대교에서 발견한 사건으로 새로운 구조 임무가 시작되었습니다/);
 assert.match(ui.el('missionNotices').textContent,/현재 공개된 임무의 지시를 따르세요/);
 assert.doesNotMatch(ui.el('missionNotices').textContent,/카드|\d+번/,'public chapter notices do not expose internal record numbers');
 assert.doesNotMatch(ui.el('missionNotices').textContent,/38|39/,'unrevealed escort endings stay hidden');
 assert.match(ui.el('missionTokens').textContent,/호위 생존자/);
});
test('retained warning 39 changes the new bridge branch to 54 while current insight remains zero',()=>{
 const {s,ui}=uiAt('past-warning');
 assert.deepEqual(s.mission.history[1].completed,[26,39,23]);
 assert(s.mission.revealed.includes(54));assert(!s.mission.revealed.includes(35));
 assert.equal(ui.el('missionInsight').textContent,'이번 챕터 완료 계몽 0장');
 assert.match(ui.el('pastChapters').textContent,/완료 임무 이오세프카의 연구, 불길한 경고, 야수를 가두었다/);
 assert.doesNotMatch(ui.el('pastChapters').textContent,/완료 카드|완료 임무\s*26\b/,'retained warning is readable by its disclosed mission name');
 assert.match(ui.el('missionNotices').textContent,/완료한 계몽 기록은 보관/);
 assert.doesNotMatch(ui.el('missionNotices').textContent,/53번 카드의 지시로 35번부터/);
});
test('a new chapter-three escort warning raises only the current chapter insight to one after mandatory reward choices',()=>{
 const {s,ui}=uiAt('current-warning');
 assert.deepEqual(s.mission.history[1].completed,[26,34,23]);
 assert.deepEqual(s.mission.completed,[39]);assert.equal(s.rewardChoices.length,0);
 assert.equal(ui.el('missionInsight').textContent,'이번 챕터 완료 계몽 1장');
 assert.match(ui.el('pastChapters').textContent,/완료 임무 이오세프카의 연구, 안전한 피신처: 오에돈 예배당, 야수를 가두었다/);
 assert.doesNotMatch(ui.el('pastChapters').textContent,/완료 카드|완료 임무\s*26\b/,'past completion titles do not change when a new chapter warning completes');
 assert.doesNotMatch(ui.el('missionTokens').textContent,/호위 생존자/);
});
