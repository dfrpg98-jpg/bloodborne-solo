const test=require('node:test'),assert=require('node:assert/strict');
const events=require('../hunt-animation-events'),visuals=require('../enemy-visuals'),catalog=require('../components/enemy-visuals.json');
const profiles=Object.values(catalog);
const hunter=()=>({id:'hunter',kind:'hunter',node:'a',hp:6,skin:'w-threaded-cane-a',weaponId:'threaded-cane',weaponFace:0});
const enemy=(profile=profiles.find(p=>p.skin==='e-cleric-beast-1'),extra={})=>({id:'e1',kind:'enemy',node:'a',hp:10,name:profile.name,enemyId:profile.enemyId,enemySide:profile.side,enemyPhase:profile.phase,skin:profile.skin,...extra});
const line=text=>({round:1,text});
const snap=(revision,overrides={})=>({sceneId:'normal',revision,actors:[hunter(),enemy()],events:[],...overrides});
const profile=skin=>profiles.find(p=>p.skin===skin);
const combat=(p,action,overrides={})=>({enemyId:'e1',enemyActionName:action.name,enemyActionType:action.type,enemyAction:visuals.action(p.enemyId,p.side,p.phase,action),...overrides});

test('campaign appearance catalog has exactly the eleven public profiles and 36 printed actions',()=>{
  assert.equal(profiles.length,11);assert.equal(profiles.reduce((n,p)=>n+p.actions.length,0),36);
  for(const p of profiles)assert.equal(visuals.skin(p.enemyId,p.side,p.phase),p.skin);
  assert.equal(visuals.skin('unknown','a',1),null);
});
for(const p of profiles)for(const a of p.actions)test(`${p.skin} / ${a.name} maps to its own public bank`,()=>{
  const v=visuals.action(p.enemyId,p.side,p.phase,a.name);assert.ok(v);assert.equal(v.skin,p.skin);assert.equal(v.attackSlot,a.slot);assert.equal(v.pose,'attack-'+a.slot);
  assert.equal(v.motion,a.motion);assert.equal(v.actionType,a.type);assert.equal(v.attackStyle,'enemy');
  if(a.type==='attack'){
    const before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,a)}),after=snap(2,{actors:[{...hunter(),hp:4},enemy(p)],events:[line(`${a.name} · 사냥꾼에게 2 피해.`)]});
    const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.equal(result.length,1);assert.equal(result[0].attackSlot,a.slot);assert.equal(result[0].skin,p.skin);assert.equal(result[0].damage,2);
  }
});
test('an exposed action card or a cheap-shot pause never plays its unresolved enemy pose',()=>{
  const p=profile('e-huntsman-mob-a'),a=p.actions[2],before=snap(1,{actors:[hunter(),enemy(p)]}),after=snap(2,{actors:[hunter(),enemy(p)],combat:combat(p,a),events:[line(`${p.name} A면 · 능력: ${a.name}.`)]});
  assert.deepEqual(events.describe(before,after,[{type:'ATTACK',slot:0,enemyId:'e1'}]),[]);
  assert.deepEqual(events.describe({...before,combat:combat(p,a)},after,[{type:'CHEAP_SHOT',cardId:'card-1'}]),[]);
});
test('Cleric recovery uses its bank without implying health restoration or a hunter hit',()=>{
  const p=profile('e-cleric-beast-1'),a=p.actions[1],before=snap(1,{combat:combat(p,a)}),after=snap(2,{events:[line('성직자 야수 회복 · 계몽 제거, 사냥꾼 공격 피해 2 방어, 현재 행동 덱을 다시 섞습니다.')]});
  assert.deepEqual(events.describe(before,after,[{type:'RESOLVE'}]),[{type:'ability',fromId:'e1',skin:p.skin,attackSlot:1,attackStyle:'enemy',motion:'recover',pose:'attack-1'}]);
});
test('the leap and the newly revealed slam are two separate resolved actions',()=>{
  const p=profile('e-cleric-beast-2'),leap=p.actions[3],slam=p.actions[0],before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,leap,{immediateName:leap.name,immediateAction:visuals.action(p.enemyId,p.side,p.phase,leap)})}),
    after=snap(2,{actors:[{...hunter(),hp:2},enemy(p)],combat:combat(p,slam),events:[line(`${leap.name} · 사냥꾼에게 2 피해.`),line(`성직자 야수 2페이즈 · ${slam.name}: ${slam.name}.`),line(`${slam.name} · 사냥꾼에게 2 피해.`)]});
  const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.deepEqual(result.map(a=>a.attackSlot),[3,0]);assert.deepEqual(result.map(a=>a.damage),[2,2]);
});
test('a dodged immediate leap still plays its own movement bank once, without fabricated damage',()=>{
  const p=profile('e-cleric-beast-2'),leap=p.actions[3],before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,leap,{immediateAction:visuals.action(p.enemyId,p.side,p.phase,leap)})}),after=snap(2,{actors:[hunter(),enemy(p)]});
  const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.equal(result.length,1);assert.equal(result[0].attackSlot,3);assert.equal(result[0].damage,0);
  assert.deepEqual(events.describe(before,{...after,combat:before.combat},[{type:'DODGE'}]),[]);
});
test('a resolved zero-damage doctor pistol shot uses its own bank while a reaction pause stays quiet',()=>{
  const p=profile('e-iosefka-hostile'),a=p.actions[2],before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,a,{immediateAction:visuals.action(p.enemyId,p.side,p.phase,a)})}),after=snap(2,{actors:[hunter(),enemy(p)]});
  const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.equal(result[0].type,'shot');assert.equal(result[0].attackSlot,2);assert.equal(result[0].damage,0);
  assert.deepEqual(events.describe(before,after,[{type:'FIREARM',accept:false}]),[]);
});
test('spawn roar plays only after its resolved public spawn',()=>{
  const p=profile('e-scourge-beast-a'),a=p.actions[2],before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,a)}),after=snap(2,{actors:[hunter(),enemy(p)],events:[line('재앙의 야수 #2 출현.')]});
  const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.equal(result[0].type,'ability');assert.equal(result[0].attackSlot,2);assert.equal(result[0].motion,'roar');
  assert.deepEqual(events.describe(before,after,[{type:'ATTACK',enemyId:'e1'}]),[]);
});
test('only a publicly confirmed boss phase change emits phase; its old-phase hit is pinned',()=>{
  const p=profile('e-cleric-beast-1'),q=profile('e-cleric-beast-2'),before=snap(1,{combat:{enemyId:'e1',attackName:'찌르기'}}),after=snap(2,{actors:[hunter(),enemy(q)],events:[line('찌르기 · 적에게 3 피해.'),line('성직자 야수 · 2페이즈로 전환, 초과 피해는 넘기지 않습니다.')]});
  const result=events.describe(before,after,[{type:'RESOLVE'}]);assert.equal(result[0].targetSkin,p.skin);assert.deepEqual(result[1],{type:'phase',fromId:'e1',skin:q.skin});
  assert.deepEqual(events.describe(before,{...after,events:[]},[]),[]);assert.deepEqual(events.describe(before,{...after,sceneId:'loaded'},[{type:'RESOLVE'}]),[]);
});
test('female component sides retain their identity instead of their basic-enemy proxy',()=>{
  assert.equal(visuals.skin('female-patient','a',1),'e-female-patient-a');assert.equal(visuals.skin('female-patient','b',1),'e-female-patient-b');
  assert.equal(visuals.skin('iosefka','1-2',1),'e-iosefka-hostile');
});
test('frozen public enemy snapshots never touch future boss actions or mutate source data',()=>{
  const p=profile('e-cleric-beast-2'),a=p.actions[4],before=snap(1,{actors:[hunter(),enemy(p)],combat:combat(p,a)}),after=snap(2,{actors:[{...hunter(),hp:2},enemy(p)],events:[line(`${a.name} · 사냥꾼에게 4 피해.`)]});
  const original=JSON.stringify([before,after]);
  for(const o of [before,after,before.combat,...before.actors,...after.actors]) {for(const k of ['deck','bossDecks','nextAction','state','futureRewards'])Object.defineProperty(o,k,{get(){throw Error('hidden getter');}});Object.freeze(o);}
  assert.equal(events.describe(before,after,[{type:'RESOLVE'}])[0].attackSlot,4);assert.equal(JSON.stringify([before,after]),original);
});
