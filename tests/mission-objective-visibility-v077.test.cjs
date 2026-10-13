const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),{boot}=require('./helpers/ui-harness.cjs');

// Literal public wording keeps this integration check independent of the
// presenter implementation. The raw objective and public save remain intact.
const publicDescriptions=new Map([
 ['계몽 임무 2개 완료 후 중앙 등불에서 이동 종료','계몽 2개 이상을 모은 뒤 중앙 등불 타일에서 이동을 마치세요.'],
 ['중앙 등불의 재앙의 야수 우두머리 처치','중앙 등불의 재앙의 야수 우두머리 처치하세요.'],
 ['마당 등불의 야수 사냥 무리 처치','마당 등불의 야수 사냥 무리 처치하세요.'],
 ['민가 생존자를 오에돈 예배당으로 호위','민가 생존자를 오에돈 예배당으로 호위하세요.'],
 ['오에돈 예배당의 재앙의 야수 처치','오에돈 예배당의 재앙의 야수 처치하세요.'],
 ['폐가 생존자 토큰과 상호작용','폐가 생존자 토큰과 상호작용하세요.'],
 ['생존자가 있는 칸에서 적의 추격 없이 이동 종료','생존자가 있는 칸에서 적의 추격 없이 이동을 마치세요.'],
 ['공개된 구조 카드의 선택 해결','구조 임무에서 제시한 선택을 해결하세요.'],
 ['공동묘지에 시체 2개를 바치기','공동묘지에 시체 2개를 바치세요.'],
 ['진료소에서 야수 사냥 무리 또는 야수 사냥 하인 처치','진료소에서 야수 사냥 무리 또는 야수 사냥 하인 처치하세요.'],
 ['진료소에서 재앙의 야수 처치','진료소에서 재앙의 야수 처치하세요.'],
 ['소모품 수집으로 얻은 생존자 2개를 진료소에 인도','소모품 수집으로 얻은 생존자 2개를 진료소에 인도하세요.'],
 ['대교의 야수 사냥 하인 처치','대교의 야수 사냥 하인 처치하세요.'],
 ['대교의 생존자를 진료소 또는 예배당으로 호위','대교의 생존자를 진료소 또는 예배당으로 호위하세요.'],
]);
function publicDescription(objective){
 assert(publicDescriptions.has(objective.description),`literal public description exists: ${objective.description}`);
 return publicDescriptions.get(objective.description);
}

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
let won=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
for(const command of require('./fixtures/full-campaign-actual-v10-commands.json')){
 won=E.dispatch(won,command);
 if(won.mission.won){checkpoints.set('chapter-one-won',won);break;}
}
function at(number){
 const s=checkpoints.get(number);assert(s,`natural checkpoint for card ${number}`);
 assert.deepEqual(E.importSave(E.exportSave(s)),s);
 const view=E.missionView(s);
 const ui=boot(s,view,E.rewardsView(s),{realInventory:true,engine:E,
  storage:{'bloodborne-hunt-v07':E.exportSave(s)}});
 assert.equal(ui.el('error').textContent,'');
 // The fixed HUD always keeps the main goal, plus a distinct current secondary
 // when the main has finished; the journal contains every
 // revealed goal. Check both actual rendered descriptions before testing the
 // card-specific future-information boundaries below.
 const visible=view.objectives.filter(o=>o.status!=='미발견'),
  description=publicDescription,
  completed=o=>['completed','complete','done','완료'].includes(o.status),
  primary=visible.find(o=>!completed(o))||visible[0],
  main=visible.find(o=>o.id==='main')||primary,
  fixed=main?[main,...(primary&&primary.id!==main.id?[primary]:[])]:visible;
 assert.deepEqual(renderedDescriptions(ui,'missionObjectives'),fixed.map(description),
  'the HUD retains the public main objective and only a distinct currently active secondary');
 const before=ui.storage.get('bloodborne-hunt-v07'),
  journal=ui.document.querySelectorAll('[data-panel]').find(button=>button.dataset.panel==='journal');
 assert(journal,'the full objective journal has an actual entry point');journal.focus();journal.click();
 assert.equal(ui.el('infoDialog').open,true);
 assert.equal(ui.document.querySelectorAll('[data-info-panel]').find(panel=>panel.dataset.infoPanel==='journal').hidden,false);
 assert.deepEqual(renderedDescriptions(ui,'objectiveDetail'),visible.map(description),
  'the opened journal contains exactly the currently revealed objective descriptions');
 assert.deepEqual(renderedDescriptions(ui,'missionObjectives'),fixed.map(description),
  'opening the journal cannot add an unrevealed goal to the fixed HUD');
 assert.equal(ui.storage.get('bloodborne-hunt-v07'),before,'reading objectives preserves the exact saved game');
 for(const id of ['missionObjectives','objectiveDetail'])assert.doesNotMatch(ui.el(id).textContent,/카드|[AB]\s*면|앞면|뒷면|\d+번\s*카드/,
  'rendered public objectives contain no internal card or face labels');
 return {s,view,ui};
}
function renderedDescriptions(ui,id){
 const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 return [...ui.el(id).innerHTML.matchAll(/<article class="mission-objective\b[^"\n]*">([\s\S]*?)<\/article>/g)]
  .map(match=>{const description=match[1].match(/<span class="muted">([\s\S]*?)<\/span>/);
   assert(description,'each rendered objective has its actual description');return decode(description[1]);});
}
function objective(number,id){
 const result=at(number);result.objective=result.view.objectives.find(o=>o.id===id);
 assert(result.objective,`visible current objective ${id}`);
 const description=publicDescription(result.objective);
 assert(result.ui.el('objectiveDetail').textContent.includes(description),'the polished current objective is present in the opened journal');
 result.objective={...result.objective,description};return result;
}

test('a fresh hunt names and describes only the already-revealed main mission',()=>{
 const {s,view,ui}=at(1);assert.deepEqual(s.mission.revealed,[1]);
 assert.deepEqual(view.objectives.map(o=>o.id),['main']);
 for(const id of ['missionObjectives','objectiveDetail']){
  assert.match(ui.el(id).textContent,/계몽 2개 이상/);
  assert.doesNotMatch(ui.el(id).textContent,/우두머리|피신처|구조|사냥을 시작하다/);
 }
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
 assert.match(o.description,/적의 추격 없이 이동을 마치세요/);
 assert.doesNotMatch(o.description,/선택|공격|도망|보상/);
});
test('card 14 permits its disclosed choice while future rune rewards stay absent',()=>{
 const {objective:o}=objective(14,'rescue');assert.match(o.description,/제시한 선택을 해결하세요/);
 assert.doesNotMatch(o.description,/피의 기쁨|카릴 문자|보상/);
});
test('card 18 shows only corpse deposits before card 19 adds an insight requirement',()=>{
 const {s,objective:o}=objective(18,'main');assert.deepEqual(s.mission.revealed,[17,18]);
 assert.match(o.description,/공동묘지에 시체 2개를 바치세요/);
 assert.doesNotMatch(o.description,/계몽|성직자|페이즈|지하묘지/);
});
test('card 24 does not reveal the later scourge beast objective and the clinic still draws a hand skill',()=>{
 const {s,objective:o,ui}=objective(24,'card-24');assert(!s.mission.revealed.includes(25));
 assert.match(o.description,/야수 사냥 무리 또는 야수 사냥 하인 처치/);
 assert.doesNotMatch(o.description,/재앙의 야수|수혈액|보상/);
 assert.match(ui.el('locationDetail').textContent,/이오세프카의 진료소/);
 assert.match(ui.el('locationDetail').textContent,/1 피해를 받으면서 기술 1개를 뽑을 수 있습니다/);
 assert.doesNotMatch(ui.el('locationDetail').textContent,/임무 1개|새로운 임무|카드/,
  'opening the mission journal cannot change a location skill-draw rule into a mission reveal');
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

test('the won main mission stays on the fixed HUD beside the current disclosed secondary mission',()=>{
 const {s,view,ui}=at('chapter-one-won');
 assert.equal(s.mission.won,true);assert.equal(view.chapter,1);
 assert.equal(view.objectives.find(o=>o.id==='main').status,'완료');
 assert.equal(view.objectives.find(o=>o.id==='shelter').status,'진행 중');
 assert.deepEqual(renderedDescriptions(ui,'missionObjectives'),[
  '중앙 등불의 재앙의 야수 우두머리 처치하세요.',
  '민가 생존자를 오에돈 예배당으로 호위하세요.',
 ],'completed main is retained instead of being replaced by the unfinished secondary');
 assert.doesNotMatch(ui.el('missionObjectives').textContent,/예배당의 재앙의 야수|성직자|페이즈|보상/,
  'showing a secondary does not reveal its future fight, reward, or next chapter');
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
