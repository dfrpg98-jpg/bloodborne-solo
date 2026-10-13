const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../engine.js'),h=E.hunter;
const send=(s,type,a={})=>E.dispatch(s,{type,...a});
test('all named test firearms use pistol rules, spend and reload correctly',()=>{
 for(const id of Object.keys(E.data.firearms)){
  let s=E.create(91,'burial',0,null,id);
  assert.equal(E.firearm(s).ability,E.data.firearm.ability);
  assert.equal(E.firearm(s).readyRule,E.data.firearm.readyRule);
  assert.equal(!!E.firearm(s).temporary,id!=='hunter-pistol');
  h(s).position='w0';s.enemyDeck=['basic','basic','basic','special','special','ability'];
  s=send(s,'ATTACK',{enemyId:'scout-1',cardId:h(s).hand[0].id,slot:0});
  s=send(s,'FIREARM');assert.equal(h(s).firearmReady,false);assert.equal(s.combat.cancelEnemy,true);
  assert(s.events.at(-1).text.includes(E.firearm(s).name));
  s=send(s,'RESOLVE');const count=h(s).hand.length;s=send(s,'RELOAD',{cardId:h(s).hand[0].id});
  assert.equal(h(s).firearmReady,true);assert.equal(h(s).hand.length,count-1);
 }
});
test('selected firearms persist through command replay and invalid IDs are rejected',()=>{
 for(const id of Object.keys(E.data.firearms)){
  let s=E.create(91,'burial',0,null,id);s=send(s,'MOVE',{cardId:h(s).hand[0].id});s=send(s,'STEP',{node:'c1'});
  assert.deepEqual(E.importSave(E.exportSave(s)),s);assert.equal(E.firearm(s).id,id);
 }
 assert.throws(()=>E.create(91,'burial',0,null,'invented-gun'));
});
test('default v0.3 state remains without optional firearm fields and photo confirmation retains raw text',()=>{
 const s=E.create();assert.equal(Object.hasOwn(s.setup,'firearmId'),false);assert.equal(Object.hasOwn(h(s),'firearmId'),false);
 const c=E.data.components;assert.equal(c.questions.length,0);
 assert.deepEqual(c.cards.find(x=>x.id==='quick').confirmedEffects,{dodge:true,draw:1,clear:true});
 assert.equal(c.cards.flatMap(x=>x.photos||[]).length,9);
 for(const x of c.cards.flatMap(x=>x.photos||[]))assert(fs.existsSync(require('node:path').join(__dirname,'..',x.path)));
});
