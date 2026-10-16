const test=require('node:test'), assert=require('node:assert/strict');
const R=require('../src/rewards-engine.js'), X=require('../src/extended-rewards.js'), D=require('../src/hunt-data.js');
const clone=(s)=>JSON.parse(JSON.stringify(s)), H=(s)=>s.hunters[s.activeHunterId];
function fixture(version=11) {
  const s={setup:{rulesVersion:version},activeHunterId:'h',phase:'hunter',uid:0,round:1,events:[],
    mission:{chapter:1},world:{chapter:1},rewardChoices:[],enemies:[],skipActivation:[],hunters:{h:{
      id:'h',hp:3,echoes:2,inDream:false,position:'a',face:0,firearmId:'hunter-pistol',firearmReady:true,
      slots:[null,null,null],hand:[],deck:[{id:'s1',kind:'strength'},{id:'s2',kind:'skill'},{id:'s3',kind:'endurance'}],discard:[]}}};
  R.init(s);return s;
}
const pos={a:0,b:1,c:2,d:3}, calls=[];
const h={
  log:(s,text)=>s.events.push(text), slots:(s)=>H(s).slots.map((_c,i)=>({name:`slot${i}`})),
  enemyDef:(_s,e)=>({name:e.id,boss:!!e.boss}),distance:(_s,a,b)=>Math.abs(pos[a]-pos[b]),
  draw:(s,n)=>{while(n-- && H(s).deck.length) H(s).hand.push(H(s).deck.shift());},
  damageEnemy:(s,e,n,c)=>{calls.push(['damage',e.id,n,c]);e.hp-=n;},
  kill:(s,e)=>{if(e.hp>0)return;s.enemies=s.enemies.filter(x=>x.id!==e.id);H(s).echoes=Math.min(3,H(s).echoes+1);R.onKill(s);},
  skipEnemyActivation:(s,id)=>{if(!s.skipActivation.includes(id))s.skipActivation.push(id);},
  clearSlot:(s,i)=>{if(!H(s).slots[i])return;calls.push(['clear',i]);H(s).discard.push(H(s).slots[i]);H(s).slots[i]=null;},
  startRewardMove:(s,n)=>{calls.push(['move',n]);s.move={remaining:n};s.phase='move';},
  pauseFirearmEntry:(s,e)=>{s.firearmEntry={enemyId:e.id,afterPhase:s.phase};s.phase='firearm_react';},
  stopRewardEntry:(s,e,from)=>{e.node=from;if(s.enemyMove)s.enemyMove.remaining=0;},
  resumeRewardEntry:(s,options)=>{calls.push(['resume-entry',options.accepted]);s.phase=s.firearmEntry.afterPhase;delete s.firearmEntry;},
};
const item=(s,id)=>H(s).rewards.find(r=>r.id===id), grant=(s,kind)=>R.grant(s,kind,h);
function go(s,type,args={}){const next=clone(s);R.dispatch(next,{type,...args},h);R.assert(next);return next;}
const enemy=(id,node='a',hp=4,extra={})=>({id,kind:'huntsman-mob',node,hp,...extra});
function equip(s,id,slot=0,replaceId){return go(s,'EQUIP_REWARD',{rewardId:id,slot,...(replaceId?{replaceId}:{})});}
test('all 16 remaining printed reward cards retain their source text and quantities',()=>{
  assert.equal(Object.keys(R.definitions).length,32);
  assert.equal(X.ids.length,16);
  for(const id of X.ids){const raw=D.components.cards.find(c=>c.id===id), d=R.definitions[id];
    assert.equal(d.rules,raw.rules,id);assert.equal(d.rawRules,raw.rawRules,id);assert.equal(d.count,raw.count,id);
    assert.equal(d.minimumRulesVersion,11,id);assert.equal(d.subtype,id.startsWith('rune-')?'rune':X.quests.has(id)?'quest':'tool');}
  assert.equal(X.ids.filter(id=>!X.quests.has(id)).length,14);
});
test('old rule versions reject every additional reward without changing state',()=>{
  for(const version of [7,8,9,10])for(const kind of X.ids){const s=fixture(version),before=clone(s);
    assert.throws(()=>grant(s,kind),/지원하지/);assert.deepEqual(s,before);}
  const s=fixture(11);s.provisional=true;assert.throws(()=>grant(s,'arianna-blood'));
});
test('unusable music box and ritual material are stored without equipment slots or invented actions',()=>{
  const s=fixture(),a=grant(s,'music-box');for(let i=0;i<10;i++)grant(s,'ritual-material');
  assert.equal(H(s).rewards.length,11);assert.equal(s.rewardChoices.length,0);assert(H(s).rewards.every(r=>!r.equipped));
  s.phase='between_chapters';assert.throws(()=>go(s,'EQUIP_REWARD',{rewardId:a}),/사용 불가/);
  assert.throws(()=>grant(s,'ritual-material'),/공급/);
  for(const r of R.view(s,h).rewards){assert.equal(r.usable,false);assert.equal(r.activeUse,false);assert.equal(r.subtype,'quest');}
});
test('Arianna blood draws one and heals one while Adella optionally spends one echo to heal three',()=>{
  let s=fixture(),a=grant(s,'arianna-blood'),b=grant(s,'adella-blood');
  s=go(s,'USE_REWARD',{rewardId:a});assert.equal(H(s).hp,4);assert.equal(H(s).hand.length,1);assert.equal(item(s,a).ready,false);
  s=go(s,'USE_REWARD',{rewardId:b,payEcho:true});assert.equal(H(s).hp,6);assert.equal(H(s).echoes,1);assert.equal(item(s,b).ready,false);
  R.onDream(s,false,h);H(s).hp=1;s=go(s,'USE_REWARD',{rewardId:b,payEcho:false});assert.equal(H(s).hp,2);assert.equal(H(s).echoes,1);
});
test('Adella missing echo or non-boolean choice rolls back without exhaustion',()=>{
  const s=fixture(),id=grant(s,'adella-blood');H(s).echoes=0;
  for(const payEcho of [true,1]){const before=clone(s);assert.throws(()=>go(s,'USE_REWARD',{rewardId:id,payEcho}));assert.deepEqual(s,before);}
});
test('communion and marriage ring heal in the hunter turn, respecting the six health ceiling',()=>{
  let s=fixture(),id=grant(s,'rune-communion'),ring=grant(s,'ring');
  s=go(s,'USE_REWARD',{rewardId:id});assert.equal(H(s).hp,5);assert.equal(item(s,id).ready,false);
  s=go(s,'USE_REWARD',{rewardId:ring});assert.equal(H(s).hp,6);assert.equal(item(s,ring).ready,false);
});
test('ring heals only living hunters within two spaces, with self included',()=>{
  const s=fixture(),id=grant(s,'ring');
  s.hunters.near={id:'near',hp:2,position:'c',inDream:false};s.hunters.far={id:'far',hp:2,position:'d',inDream:false};
  s.hunters.dead={id:'dead',hp:0,position:'a',inDream:false};s.hunters.dream={id:'dream',hp:2,position:null,inDream:true};
  R.dispatch(s,{type:'USE_REWARD',rewardId:id},h);
  assert.equal(H(s).hp,4);assert.equal(s.hunters.near.hp,3);assert.equal(s.hunters.far.hp,2);
  assert.equal(s.hunters.dead.hp,0);assert.equal(s.hunters.dream.hp,2);
});
test('queen flesh is an optional exhausting reward only at the turn start window',()=>{
  let s=fixture(),id=grant(s,'queen-flesh');assert.equal(R.view(s,h).rewards[0].usable,false);
  R.onTurnStart(s);assert.equal(H(s).rewardTurnStartWindow,true);assert.equal(R.view(s,h).rewards[0].usable,true);
  s=go(s,'USE_REWARD',{rewardId:id});assert.equal(H(s).hp,4);assert.equal(item(s,id).ready,false);
  R.onDream(s,false,h);R.onTurnStart(s);assert.equal(item(s,id).ready,true);
  assert.equal(R.dispatch(s,{type:'MOVE'},h),false);assert.equal(H(s).rewardTurnStartWindow,false);
  assert.throws(()=>go(s,'USE_REWARD',{rewardId:id}),/시점/);
});
test('radiance draws up to three once per chapter, and neither dream nor readiness bypasses the limit',()=>{
  let s=fixture(),id=grant(s,'rune-radiance');H(s).hand.push(H(s).deck.shift());
  s=go(s,'USE_REWARD',{rewardId:id});assert.equal(H(s).hand.length,3);assert.equal(item(s,id).lastUsedChapter,1);
  R.onDream(s,false,h);assert.equal(item(s,id).ready,true);assert.equal(R.view(s,h).rewards[0].limitUsed,true);
  H(s).hand=[];assert.throws(()=>go(s,'USE_REWARD',{rewardId:id}),/챕터/);
  item(s,id).ready=false;assert.throws(()=>R.ready(s,id,h),/다음 챕터/);
  s.mission.chapter=2;s.world.chapter=2;R.onChapterStart(s);H(s).deck=[{id:'new1'},{id:'new2'},{id:'new3'}];
  s=go(s,'USE_REWARD',{rewardId:id});assert.equal(H(s).hand.length,3);assert.equal(item(s,id).lastUsedChapter,2);
});
test('radiance at three cards cannot waste its chapter use',()=>{
  const s=fixture(),id=grant(s,'rune-radiance');H(s).hand=H(s).deck.splice(0,3);
  const before=clone(s);assert.throws(()=>go(s,'USE_REWARD',{rewardId:id}));assert.deepEqual(s,before);
});
test('corruption prevents only an armed lethal hit, heals all damage, and preserves statuses and echoes',()=>{
  let s=fixture(),id=grant(s,'rune-corruption');H(s).status={poison:true,frenzy:true};H(s).hp=0;
  assert.equal(R.preventDeath(s,h),false);H(s).hp=1;s=go(s,'SET_REWARD_TRIGGER',{rewardId:id,enabled:true});
  H(s).hp=0;assert.equal(R.preventDeath(s,h),true);assert.equal(H(s).hp,6);assert.equal(H(s).echoes,2);
  assert.deepEqual(H(s).status,{poison:true,frenzy:true});assert.equal(H(s).inDream,false);assert.equal(item(s,id).ready,false);
  assert.equal(item(s,id).triggerArmed,false);assert.equal(item(s,id).lastUsedChapter,1);
  R.onDream(s,false,h);assert.throws(()=>go(s,'SET_REWARD_TRIGGER',{rewardId:id,enabled:true}));
  H(s).hp=0;assert.equal(R.preventDeath(s,h),false);
  s.mission.chapter=2;R.onChapterStart(s);H(s).hp=2;s=go(s,'SET_REWARD_TRIGGER',{rewardId:id,enabled:true});
  H(s).hp=0;assert.equal(R.preventDeath(s,h),true);assert.equal(item(s,id).lastUsedChapter,2);
});
test('call beyond damages all same-space enemies before any kill hooks and includes bosses',()=>{
  let s=fixture(),id=grant(s,'call-beyond');s.enemies=[enemy('one','a',2),enemy('boss','a',5,{boss:true}),enemy('far','b',2)];
  calls.length=0;s=go(s,'USE_REWARD',{rewardId:id});
  assert.deepEqual(s.enemies.map(e=>[e.id,e.hp]),[['boss',3],['far',2]]);assert.equal(item(s,id).ready,false);
  assert.deepEqual(calls.filter(c=>c[0]==='damage').map(c=>[c[1],c[2]]),[['one',2],['boss',2]]);
});
test('tiny Tonitrus excludes bosses and remote targets, deals two, and skips only the surviving chosen enemy',()=>{
  let s=fixture(),id=grant(s,'tiny-tonitrus');s.enemies=[enemy('near','b',4),enemy('far','c'),enemy('boss','a',4,{boss:true})];
  assert.deepEqual(R.view(s,h).rewards[0].controls.targets.map(e=>e.enemyId),['near']);
  for(const enemyId of ['boss','far','unknown'])assert.throws(()=>go(s,'USE_REWARD',{rewardId:id,enemyId}));
  s=go(s,'USE_REWARD',{rewardId:id,enemyId:'near'});assert.equal(s.enemies[0].hp,2);assert.deepEqual(s.skipActivation,['near']);
  R.onDream(s,false,h);s.skipActivation=[];s=go(s,'USE_REWARD',{rewardId:id,enemyId:'near'});
  assert.equal(s.enemies.some(e=>e.id==='near'),false);assert.deepEqual(s.skipActivation,[]);
});
test('guidance clears an occupied slot before a normal two-space move without a stat-card cost',()=>{
  let s=fixture(),id=grant(s,'rune-guidance');H(s).slots[2]={id:'used',kind:'strength'};
  assert.deepEqual(R.view(s,h).rewards[0].controls.slots.map(x=>x.occupied),[false,false,true]);
  assert.throws(()=>go(s,'USE_REWARD',{rewardId:id,slot:3}),/공격 슬롯/);calls.length=0;
  s=go(s,'USE_REWARD',{rewardId:id,slot:2});assert.equal(H(s).slots[2],null);assert.equal(H(s).discard[0].id,'used');
  assert.equal(s.phase,'move');assert.equal(s.move.remaining,2);assert.equal(item(s,id).ready,false);
  assert.deepEqual(calls,[['clear',2],['move',2]]);
});
test('beast rune opens only on a living hunter kill, deals two within one space and can open the next kill reaction',()=>{
  let s=fixture(),first=grant(s,'rune-beast'),second=grant(s,'rune-beast');s.enemies=[enemy('next','b',2),enemy('further','b',4)];
  assert.throws(()=>go(s,'USE_REWARD',{rewardId:first,enemyId:'next'}));R.onKill(s);
  s=go(s,'USE_REWARD',{rewardId:first,enemyId:'next'});assert.equal(item(s,first).ready,false);assert.equal(item(s,second).ready,true);
  assert.equal(H(s).rewardBeastWindow,true);s=go(s,'USE_REWARD',{rewardId:second,enemyId:'further'});
  assert.equal(s.enemies[0].hp,2);assert.equal(H(s).rewardBeastWindow,false);
  R.onDream(s,false,h);H(s).hp=0;R.onKill(s);assert.equal(H(s).rewardBeastWindow,false);
});
test('torch entry can be declined without exhaustion or accepted to stop at the previous space and deal one',()=>{
  let s=fixture(),id=grant(s,'hunter-torch');s.enemies=[enemy('entering','a',3)];s.enemyMove={remaining:2};
  assert.equal(R.onEnemyStep(s,s.enemies[0],'b','a',h),true);assert.equal(s.phase,'reward_entry');
  assert.equal(R.entryView(s,h).enemyId,'entering');s=go(s,'ENTRY_REWARD',{accept:false});
  assert.equal(s.phase,'hunter');assert.equal(item(s,id).ready,true);assert.equal(s.enemies[0].node,'a');
  assert.equal(R.onEnemyStep(s,s.enemies[0],'b','a',h),true);s=go(s,'ENTRY_REWARD',{accept:true});
  assert.equal(item(s,id).ready,false);assert.equal(s.enemies[0].node,'b');assert.equal(s.enemies[0].hp,2);assert.equal(s.enemyMove.remaining,0);
});
test('torch ignores bosses, stationary enemies and entries to another space',()=>{
  const s=fixture();grant(s,'hunter-torch');
  for(const [e,from,to] of [[enemy('boss','a',3,{boss:true}),'b','a'],[enemy('still'),'a','a'],[enemy('elsewhere','b'),'c','b']])
    assert.equal(R.onEnemyStep(s,e,from,to,h),false);
  assert.equal(s.phase,'hunter');
});
test('chunk and tear attach without exhaustion and contribute only to their chosen attack slot',()=>{
  let s=fixture(),chunk=grant(s,'bloodstone-chunk'),tear=grant(s,'tear-gem');
  s=equip(s,chunk,1);s=equip(s,tear,1);
  assert.deepEqual(R.attackBonus(s,1,[],h),{speed:1,damage:1,interrupt:false,replaceCardEffects:false,heal:1});
  assert.deepEqual(R.attackBonus(s,0,[],h),{speed:0,damage:0,interrupt:false,replaceCardEffects:false});
  assert.equal(item(s,chunk).ready,true);assert.equal(item(s,tear).ready,true);
});
test('persistent attachment must be reassigned when transforming from three slots into one',()=>{
  let s=fixture(),id=grant(s,'bloodstone-chunk');s=equip(s,id,2);H(s).slots=[null];R.onTransform(s,h);R.assert(s);
  assert.equal(item(s,id).equipped,false);assert.equal(item(s,id).slot,null);assert.deepEqual(s.rewardChoices,[{rewardId:id,reason:'slot'}]);
  assert.throws(()=>go(s,'EQUIP_REWARD',{rewardId:id,slot:1}));s=equip(s,id,0);
  assert.equal(item(s,id).equipped,true);assert.equal(item(s,id).slot,0);assert.equal(s.rewardChoices.length,0);
});
test('within-range attachment can move on transformation; persistent rewards cannot be exhausted or overequipped',()=>{
  let s=fixture(),a=grant(s,'bloodstone-chunk'),b=grant(s,'tear-gem');s=equip(s,a,1);s=equip(s,b,2);
  R.onTransform(s,h);s=go(s,'REASSIGN_REWARD',{rewardId:b,slot:0});assert.equal(item(s,b).slot,0);
  const third=grant(s,'bloodstone-shard');assert.throws(()=>go(s,'EQUIP_REWARD',{rewardId:third,slot:0}),/2장/);
  s=equip(s,third,0,a);assert.equal(item(s,a).equipped,false);assert.equal(item(s,third).equipped,true);
});
test('new reward views are read-only and include chapter-limit and trigger affordances',()=>{
  const s=fixture(),id=grant(s,'rune-corruption');grant(s,'tiny-tonitrus');s.enemies=[enemy('near')];const before=clone(s),view=R.view(s,h);
  assert.equal(view.rewards.find(r=>r.id===id).triggerSelectable,true);assert.equal(view.rewards.find(r=>r.id===id).limitUsed,false);
  assert.match(view.rewards.find(r=>r.id===id).disabledReason,/치명적/);assert.deepEqual(s,before);
});
test('standalone firearm attacks can use broad attack rewards while excluding gems and stat replacement',()=>{
  let s=fixture(),chunk=grant(s,'bloodstone-chunk');s=equip(s,chunk,0);
  const shell=grant(s,'empty-shell');
  const rune=grant(s,'rune-hunter'),writhe=grant(s,'rune-writhe');
  assert.deepEqual(R.attackBonus(s,-1,[shell,rune,writhe],h),{speed:2,damage:1,interrupt:true,replaceCardEffects:false,
    freeTransform:true,interruptEqual:true});
  const other=fixture(),claw=grant(other,'rune-clawmark'),before=clone(other);
  assert.throws(()=>R.attackBonus(other,-1,[claw],h),/스탯 카드/);assert.deepEqual(other,before);
  assert.throws(()=>R.attackBonus(fixture(10),-1,[],h),/공격 슬롯/);
});
test('new firearm and weapon commands expire old optional windows before opening any fresh kill window',()=>{
  const s=fixture();grant(s,'queen-flesh');R.onTurnStart(s);H(s).rewardKillWindow=true;H(s).rewardBeastWindow=true;
  assert.equal(R.dispatch(s,{type:'FIREARM'},h),false);assert.equal(H(s).rewardTurnStartWindow,false);
  assert.equal(H(s).rewardKillWindow,false);assert.equal(Object.hasOwn(H(s),'rewardBeastWindow'),false);
  const id=grant(s,'bloodstone-chunk');assert.throws(()=>R.dispatch(s,{type:'FIREARM'},h),/선택을 먼저/);
  R.dispatch(s,{type:'KEEP_REWARD',rewardId:id},h);
});
test('a reward kill preserves freshly opened beast and rapture windows',()=>{
  let s=fixture(),call=grant(s,'call-beyond'),beast=grant(s,'rune-beast'),rapture=grant(s,'rune-rapture');
  s.enemies=[enemy('dead','a',2),enemy('next','b',4)];s=go(s,'USE_REWARD',{rewardId:call});
  assert.equal(H(s).rewardKillWindow,true);assert.equal(H(s).rewardBeastWindow,true);
  assert.equal(R.view(s,h).rewards.find(r=>r.id===beast).usable,true);
  assert.equal(R.view(s,h).rewards.find(r=>r.id===rapture).usable,true);
});
test('torch leap entry must choose a legal one-space stopping point before spending its reward',()=>{
  const s=fixture(),id=grant(s,'hunter-torch');s.enemies=[enemy('entering')];R.onEnemyStep(s,s.enemies[0],'d','a',h);
  const special={...h,rewardEntryStops:()=>[{node:'b',name:'one'},{node:'c',name:'alternative'}]};
  const before=clone(s);assert.throws(()=>R.dispatch(clone(s),{type:'ENTRY_REWARD',accept:true},special),/목적지/);
  assert.deepEqual(s,before);assert.equal(item(s,id).ready,true);
  assert.throws(()=>R.dispatch(clone(s),{type:'ENTRY_REWARD',accept:true,node:'d'},special),/목적지/);
  R.dispatch(s,{type:'ENTRY_REWARD',accept:true,node:'b'},special);assert.equal(s.enemies[0].node,'b');assert.equal(item(s,id).ready,false);
});

const E=require('../src/hunt-engine.js'), C=require('./actual-combat-helper.cjs');
const IG=(s,type,args={})=>E.dispatch(s,{type,...args}), IH=E.hunter;
function integrated(weapon='burial',face=0,rewards=[],gun='hunter-pistol') {
  const s=E.create(123,weapon,face,null,gun,'center',{campaign:false,rulesVersion:11,practiceRewards:rewards});
  s.world.assignments.find(a=>a.enemyId==='huntsman-mob').sideId='a';
  s.enemies=[{id:'huntsman-mob-1',kind:'huntsman-mob',figure:1,node:IH(s).position,hp:4}];s.loot=[];
  C.hand(s,['strength','endurance','vitality']);C.enemyAction(s,'basic');E.assertState(s);return s;
}
const rid=(s,kind)=>IH(s).rewards.find(r=>r.kind===kind).id;
const stat=(s,kind)=>IH(s).hand.find(c=>c.kind===kind).id;
const IA=(s,slot=1,args={})=>IG(s,'ATTACK',{enemyId:s.enemies[0].id,cardId:stat(s,'strength'),slot,...args});
test('public practice reward setup includes all 32 cards and replays equipment choices exactly',()=>{
  for(const kind of Object.keys(R.definitions)) {
    let s=E.create(212,'burial',0,null,'hunter-pistol','center',{campaign:false,rulesVersion:11,practiceRewards:[kind]});
    assert.equal(IH(s).rewards[0].kind,kind);assert.deepEqual(E.importSave(E.exportSave(s)),s,kind);
    if(s.rewardChoices.length)s=IG(s,'EQUIP_REWARD',{rewardId:IH(s).rewards[0].id,slot:0});
    assert.deepEqual(E.importSave(E.exportSave(s)),s,kind+' equipped');
  }
  let s=E.create(213,'burial',0,null,'hunter-pistol','center',{campaign:false,rulesVersion:11,practiceRewards:X.ids});
  while(s.rewardChoices.length)s=IG(s,'KEEP_REWARD',{rewardId:s.rewardChoices[0].rewardId});
  assert.equal(IH(s).rewards.length,16);assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
test('public practice setup rejects invented campaign grants, unsupported rewards, oversupply and legacy rules',()=>{
  for(const options of [{campaign:true,practiceRewards:['arianna-blood']},{campaign:false,practiceRewards:['not-a-card']},
    {campaign:false,practiceRewards:['arianna-blood','arianna-blood']},{campaign:false,rulesVersion:10,practiceRewards:[]}])
    assert.throws(()=>E.create(213,'burial',0,null,'hunter-pistol','center',options));
});
test('public start-turn queen reward and a used radiance survive exact save replay through a dream',()=>{
  let s=E.create(214,'burial',0,null,'hunter-pistol','center',{campaign:false,rulesVersion:11,practiceRewards:['queen-flesh','rune-radiance']});
  assert.equal(E.rewardsView(s).rewards.find(r=>r.kind==='queen-flesh').usable,true);
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'queen-flesh')});s=IG(s,'MOVE',{cardId:IH(s).hand[0].id});s=IG(s,'STOP_MOVE');
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'rune-radiance')});assert.equal(IH(s).hand.length,3);
  s=IG(s,'DREAM',{cardId:IH(s).hand[0].id});assert.equal(IH(s).inDream,true);
  assert.equal(E.rewardsView(s).rewards.find(r=>r.kind==='rune-radiance').limitUsed,true);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
test('integrated gems affect only their attached attack and tear heals at declaration before enemy damage',()=>{
  let s=integrated('burial',0,['bloodstone-chunk','tear-gem']);
  s=IG(s,'EQUIP_REWARD',{rewardId:rid(s,'bloodstone-chunk'),slot:0});
  s=IG(s,'EQUIP_REWARD',{rewardId:rid(s,'tear-gem'),slot:1});IH(s).hp=2;
  s=IA(s,1);assert.equal(s.combat.attack.speed,2);assert.equal(s.combat.attack.damage,3);assert.equal(IH(s).hp,3);
  s=IG(s,'RESOLVE');assert.equal(IH(s).hp,1);assert.equal(s.enemies[0].hp,1);
  assert(IH(s).rewards.every(r=>r.ready));
});
test('integrated guidance runs the sword clear-slot damage before its two-space movement and resumes cleanly',()=>{
  let s=integrated('ludwigs-holy-blade',1,['rune-guidance']);
  s=IA(s,0);s=IG(s,'FIREARM');s=IG(s,'RESOLVE');assert.equal(s.phase,'hunter');assert(IH(s).slots[0]);
  const before=s.enemies[0].hp,hand=IH(s).hand.length;
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'rune-guidance'),slot:0});
  assert.equal(s.enemies[0].hp,before-1);assert.equal(IH(s).slots[0],null);assert.equal(s.phase,'move');
  assert.equal(s.move.remaining,2);assert.equal(IH(s).hand.length,hand);
  s=IG(s,'STOP_MOVE');assert.equal(s.phase,'hunter');assert.equal(s.weaponEffects,undefined);assert.equal(s.weaponAfter,undefined);
});
test('integrated torch declines through rifle-spear and rifle reactions, preserving the enemy activation',()=>{
  let s=integrated('rifle-spear',0,['hunter-torch'],'ludwig-rifle');s.enemies[0].node='tile-14:left';
  s=IG(s,'END_TURN');assert.equal(s.phase,'reward_entry');s=IG(s,'ENTRY_REWARD',{accept:false});
  assert.equal(s.phase,'weapon_entry');s=IG(s,'ENTRY_WEAPON',{accept:false});assert.equal(s.phase,'firearm_react');
  s=IG(s,'FIREARM_ENTRY',{accept:false});assert.equal(s.phase,'combat_choose');
  assert.equal(s.combat.enemyId,'huntsman-mob-1');assert.equal(IH(s).firearmReady,true);
  assert.equal(IH(s).rewards[0].ready,true);assert.equal(s.enemyDiscard.length,0);
});
test('integrated torch stops activation movement exactly one space away without revealing an attack',()=>{
  let s=integrated('burial',0,['hunter-torch']);s.enemies[0].node='tile-14:left';s=IG(s,'END_TURN');
  assert.equal(s.phase,'reward_entry');assert.deepEqual(E.rewardsView(s).entry.stops.map(n=>n.node),['tile-14:left']);
  s=IG(s,'ENTRY_REWARD',{accept:true});assert.equal(s.phase,'refill');assert.equal(s.enemies[0].node,'tile-14:left');
  assert.equal(s.enemies[0].hp,3);assert.equal(s.enemyDiscard.length,0);assert.equal(IH(s).hp,6);
});
test('integrated torch cancels a pull declaration if the chosen target stops outside the hunter space',()=>{
  let s=integrated('burial',1,['hunter-torch']);s.enemies[0].node='tile-14:left';const cardId=stat(s,'strength');
  s=IG(s,'ATTACK',{enemyId:s.enemies[0].id,cardId,slot:1,pullIds:[s.enemies[0].id]});
  assert.equal(s.phase,'reward_entry');assert(IH(s).hand.some(c=>c.id===cardId));
  s=IG(s,'ENTRY_REWARD',{accept:true});assert.equal(s.phase,'hunter');assert.equal(s.combat,null);
  assert(IH(s).hand.some(c=>c.id===cardId));assert.equal(s.enemies[0].node,'tile-14:left');assert.equal(s.enemyDiscard.length,0);
});
test('integrated corruption prevents direct weapon sacrifice, poison death and an equal-speed lethal attack',()=>{
  for(const cause of ['self','poison','equal']) {
    let s=integrated(cause==='self'?'logarius-wheel':'burial',cause==='self'?1:0,['rune-corruption']);
    IH(s).hp=cause==='equal'?2:1;s=IG(s,'SET_REWARD_TRIGGER',{rewardId:rid(s,'rune-corruption'),enabled:true});
    if(cause==='self')s=IA(s,0,{weaponBoost:1});
    if(cause==='poison'){s.enemies=[];IH(s).status.poison=true;s=IG(s,'END_TURN');}
    if(cause==='equal'){s=IA(s,1);assert.equal(s.combat.attack.speed,s.combat.action.speed);s=IG(s,'RESOLVE');}
    assert.equal(IH(s).hp,6,cause);assert.equal(IH(s).inDream,false,cause);
    assert.equal(IH(s).rewards[0].lastUsedChapter,1,cause);assert.equal(IH(s).rewards[0].ready,false,cause);
  }
});
test('integrated standalone firearm attack applies selected attack runes and offers a free transform afterward',()=>{
  let s=integrated('burial',0,['empty-shell','rune-hunter','rune-writhe'],'cannon');
  s=IG(s,'FIREARM',{enemyId:s.enemies[0].id,rewardIds:IH(s).rewards.map(r=>r.id)});
  assert.equal(s.combat.flame.speed,3);assert.equal(s.combat.flame.damage,4);assert.equal(s.combat.flame.interrupt,true);
  assert.equal(s.combat.flame.interruptEqual,true);assert.equal(s.combat.flame.freeTransform,true);
  s=IG(s,'RESOLVE');assert.equal(s.phase,'free_transform');s=IG(s,'FREE_TRANSFORM',{accept:true});
  assert.equal(IH(s).face,1);assert(IH(s).rewards.every(r=>!r.ready));assert.equal(IH(s).hp,6);
});
test('integrated torch decline keeps a pulled attack command through the rifle reaction before paying its stat card',()=>{
  let s=integrated('burial',1,['hunter-torch'],'ludwig-rifle');s.enemies[0].node='tile-14:left';const cardId=stat(s,'strength');
  s=IG(s,'ATTACK',{enemyId:s.enemies[0].id,cardId,slot:1,pullIds:[s.enemies[0].id]});
  assert.equal(s.phase,'reward_entry');s=IG(s,'ENTRY_REWARD',{accept:false});assert.equal(s.phase,'firearm_react');
  assert(IH(s).hand.some(c=>c.id===cardId));s=IG(s,'FIREARM_ENTRY',{accept:false});
  assert.equal(s.phase,'combat_react');assert.equal(IH(s).slots[1].id,cardId);
  assert.equal(s.enemyDiscard.length,1);assert.equal(IH(s).rewards[0].ready,true);
});
test('a printed once-per-chapter rune cannot be readied with bone ash and the rejected use retains the consumable',()=>{
  let s=E.create(216,'burial',0,'bone-ash','hunter-pistol','center',
    {campaign:false,rulesVersion:11,practiceRewards:['rune-radiance']});
  s=IG(s,'MOVE',{cardId:IH(s).hand[0].id});s=IG(s,'STOP_MOVE');
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'rune-radiance')});
  const before=clone(s),itemId=IH(s).consumables[0].id;
  assert.throws(()=>IG(s,'USE_CONSUMABLE',{itemId,rewardId:rid(s,'rune-radiance')}),/다음 챕터/);
  assert.deepEqual(s,before);assert.equal(IH(s).consumables[0].id,itemId);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
test('guidance can move with an already empty slot and does not create a sword clear-slot damage effect',()=>{
  let s=integrated('ludwigs-holy-blade',1,['rune-guidance']);const hp=s.enemies[0].hp;
  assert.equal(E.rewardsView(s).rewards[0].usable,true);
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'rune-guidance'),slot:2});assert.equal(s.phase,'move');
  assert.equal(s.move.remaining,2);assert.equal(s.enemies[0].hp,hp);assert.equal(IH(s).discard.length,0);
  s=IG(s,'STOP_MOVE');assert.equal(s.phase,'hunter');assert.equal(s.enemies[0].hp,hp);
});
test('a queen flesh equipped during mandatory initial reward choices keeps its start-turn use window and saves exactly',()=>{
  let s=E.create(217,'burial',0,null,'hunter-pistol','center',
    {campaign:false,rulesVersion:11,practiceRewards:['arianna-blood','adella-blood','queen-flesh']});
  assert.equal(IH(s).rewardTurnStartWindow,true);assert.equal(s.rewardChoices.length,1);
  s=IG(s,'EQUIP_REWARD',{rewardId:rid(s,'queen-flesh'),replaceId:rid(s,'arianna-blood')});
  assert.equal(E.rewardsView(s).rewards.find(r=>r.kind==='queen-flesh').usable,true);
  s=IG(s,'USE_REWARD',{rewardId:rid(s,'queen-flesh')});assert.equal(IH(s).rewards.find(r=>r.kind==='queen-flesh').ready,false);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
