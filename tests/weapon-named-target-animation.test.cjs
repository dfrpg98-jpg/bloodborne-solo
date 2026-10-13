'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../hunt-animation-events');
const first='scourge-beast-1',second='scourge-beast-2',line='슬롯 효과 · 재앙의 야수에게 피해 1.';
function view(revision,hp1=4,hp2=4,lines=[],combatTarget){return {revision,sceneId:'chapter-1',actors:[
  {id:'hunter',kind:'hunter',node:'tile-11:street',hp:6,weaponId:'ludwigs-holy-blade',weaponFace:1},
  ...(hp1==null?[]:[{id:first,kind:'enemy',node:'tile-11:street',hp:hp1,name:'재앙의 야수'}]),
  ...(hp2==null?[]:[{id:second,kind:'enemy',node:'tile-11:street',hp:hp2,name:'재앙의 야수'}])],
  events:lines.map(text=>({round:1,text})),...(combatTarget?{combat:{enemyId:combatTarget}}:{})};}
const hits=(after,commands=[],before=view(1))=>A.describe(before,after,commands).filter(x=>x.type==='attack');
const choice={type:'WEAPON_CHOICE',enemyId:second};
test('selected second same-name enemy is the sole impact for its damage',()=>{
  const actions=hits(view(2,4,3,[line]),[choice]);assert.equal(actions.length,1);assert.equal(actions[0].toId,second);assert.equal(actions[0].damage,1);
});
test('blocked explicit selection retains its one zero-damage impact',()=>{
  const actions=hits(view(2,4,4,[line]),[choice]);assert.equal(actions.length,1);assert.equal(actions[0].toId,second);assert.equal(actions[0].damage,0);
});
test('implicit combat target does not override another enemy visible health loss',()=>{
  const actions=hits(view(2,4,3,[line],first),[{type:'RESOLVE'}],view(1,4,4,[],first));assert.deepEqual(actions.map(x=>x.toId),[second]);
});
test('without a selected target health loss identifies the named victim',()=>{
  assert.deepEqual(hits(view(2,4,3,[line]),[{type:'USE_CONSUMABLE'}]).map(x=>x.toId),[second]);
});
test('true area damage retains two distinct same-name impacts',()=>{
  const actions=hits(view(2,3,3,[line,line]),[{type:'RESOLVE'}]);assert.deepEqual(actions.map(x=>x.toId).sort(),[first,second]);assert(actions.every(x=>x.damage===1));
});
test('explicit target and real splash damage are each emitted once',()=>{
  const actions=hits(view(2,3,3,[line,line]),[choice]);assert.equal(actions.length,2);assert.deepEqual(actions.map(x=>x.toId).sort(),[first,second]);
});
test('ambiguous unchanged twins do not acquire an invented impact',()=>{
  assert.equal(hits(view(2,4,4,[line]),[{type:'USE_CONSUMABLE'}]).length,0);
});
test('a single blocked named victim remains identifiable without target args',()=>{
  const actions=hits(view(2,4,null,[line]),[],view(1,4,null));assert.equal(actions.length,1);assert.equal(actions[0].toId,first);assert.equal(actions[0].damage,0);
});
test('a defeated second twin never redirects its impact to the surviving first',()=>{
  const after=view(2);after.actors=after.actors.filter(x=>x.id!==second);after.events=[{round:1,text:line},{round:1,text:'재앙의 야수 처치 · 유지 획득'}];
  assert.deepEqual(hits(after,[choice]).map(x=>x.toId),[second]);
});
