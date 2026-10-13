"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine.js'),R=require('../rewards-engine.js'),stock=require('../data.js');
const normalCommands=require('./fixtures/v077-chapel-escort-first-natural-commands.json');
const firstFight=require('./fixtures/v078-first-fight.json');
const H=E.hunter,copy=structuredClone;
const create=(qa,weapon='qa-test-weapon',extra={})=>E.create(90,weapon,0,null,'hunter-pistol','center',{campaign:true,qa,...extra});
const custom=(startRewards=[],startConsumables=[])=>({preset:'custom',startRewards,startConsumables});
const roundtrip=s=>assert.deepEqual(E.importSave(E.exportSave(s)),s);
function remapRewardCommand(command,normal,qa){
  const mapping=new Map();
  for(const field of ['deck','hand','discard','slots']){
    const original=H(normal)[field]||[],candidates=H(qa)[field]||[];
    for(const [index,c]of original.entries())if(c&&candidates[index]?.kind===c.kind)
      mapping.set(c.id,candidates[index].id);
  }
  for(const r of H(normal).rewards){const original=H(normal).rewards.filter(x=>x.kind===r.kind),
    candidates=H(qa).rewards.filter(x=>x.kind===r.kind&&!x.qaStart);
    mapping.set(r.id,candidates[original.indexOf(r)]?.id||r.id);}
  function visit(value){if(Array.isArray(value))return value.map(visit);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));
    return typeof value==='string'&&mapping.has(value)?mapping.get(value):value;}
  return visit(command);
}

test('QA definitions stay outside stock component decks and normal creation',()=>{
  const before=JSON.stringify(stock),normal=E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true});
  assert.equal(Object.hasOwn(normal.setup,'qa'),false);
  assert.equal(E.data.weapons['qa-test-weapon'],undefined);
  for(const id of ['qa-heal','qa-cards','qa-travel'])assert.equal(E.data.consumables[id],undefined);
  assert.throws(()=>E.create(90,'qa-test-weapon',0,null,'hunter-pistol','center',{campaign:true}));
  assert.throws(()=>E.create(90,'burial',0,'qa-heal','hunter-pistol','center',{campaign:true}));
  const qa=create({preset:'fast'});
  assert.equal(JSON.stringify(stock),before);
  assert.deepEqual(E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true}),normal);
  assert.equal(Object.keys(E.data.weapons).filter(id=>id!=='training').length,15);
  assert.equal(normal.consumableDeck.length+H(normal).consumables.length+normal.consumableDiscard.length,36);
  assert.equal(E.weapon(qa).id,'qa-test-weapon');
  assert.equal(E.consumableDefinitions(normal)['qa-heal'],undefined);
  assert(E.consumableDefinitions(qa)['qa-heal']);
});

test('fast QA setup is explicit, contains separate issued items, and roundtrips exactly',()=>{
  const s=create({preset:'fast'}),q=s.setup.qa;
  assert.equal(q.version,1);assert.equal(q.preset,'fast');
  assert.deepEqual(q.startRewards,['lantern','old-hunter-bone','rune-hunter','rune-formless']);
  assert.deepEqual(q.startConsumables,['qa-heal','qa-heal','qa-cards','qa-cards','qa-travel','qa-travel']);
  assert.equal(H(s).rewards.filter(r=>r.qaStart).length,4);
  assert.equal(H(s).consumables.filter(i=>i.kind.startsWith('qa-')).length,6);
  assert.equal(s.mission.chapter,1);assert.equal(s.mission.insight||0,0);
  assert.equal(s.commands.length,0);E.assertState(s);roundtrip(s);
});

test('custom QA validates quantity limits, supported ids, and campaign scope',()=>{
  for(const qa of [{preset:'unknown'},custom(['unknown']),custom([],['unknown']),
    custom(Array(R.definitions.lantern.count+1).fill('lantern')),
    custom([],Array(11).fill('qa-heal'))])assert.throws(()=>create(qa),JSON.stringify(qa));
  assert.throws(()=>create({preset:'fast'},'qa-test-weapon',{campaign:false}));
  const s=create(custom(['music-box'],['qa-heal','blood-vial']),'burial');
  assert.equal(H(s).weaponId,'burial');assert.equal(H(s).rewards.find(r=>r.kind==='music-box').qaStart,true);
  assert(H(s).consumables.some(i=>i.kind==='blood-vial'));
  assert(H(s).consumables.some(i=>i.kind==='qa-heal'));roundtrip(s);
});

test('QA commands and setup cannot be relabelled as a verified normal save',()=>{
  let s=create({preset:'fast'});const item=H(s).consumables.find(i=>i.kind==='qa-cards');
  s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:item.id});
  assert.equal(s.commands.length,1);assert.equal(s.commands[0].type,'USE_CONSUMABLE');roundtrip(s);
  const unmarked=copy(s);delete unmarked.setup.qa;
  assert.throws(()=>E.importSave(E.exportSave(unmarked)));
  const edited=copy(s);edited.setup.qa.startRewards=[];
  assert.throws(()=>E.importSave(E.exportSave(edited)));
  const changed=copy(s);H(changed).hp=5;
  assert.throws(()=>E.importSave(E.exportSave(changed)));
});

test('public QA consumable actions use normal effect timing and preserve stock supply',()=>{
  const stockCount=s=>[...H(s).consumables,...s.consumableDeck,...s.consumableDiscard,...s.lootChoice]
    .filter(i=>Object.hasOwn(E.data.consumables,i.kind)).length;
  let s=create({preset:'fast'}),h=H(s),stockItems=stockCount(s);
  const cards=h.consumables.find(i=>i.kind==='qa-cards'),travel=h.consumables.find(i=>i.kind==='qa-travel');
  const initialHand=h.hand.length;
  s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:cards.id});
  assert.equal(H(s).hand.length,initialHand+3);assert(!H(s).consumables.some(i=>i.id===cards.id));roundtrip(s);
  s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:travel.id});assert.equal(s.phase,'move');
  assert.equal(s.move.remaining,6);roundtrip(s);
  assert.throws(()=>E.dispatch(s,{type:'USE_CONSUMABLE',itemId:H(s).consumables.find(i=>i.kind==='qa-heal').id}));
  s=E.dispatch(s,{type:'STOP_MOVE'});assert.equal(s.phase,'hunter');
  assert.equal(stockCount(s),stockItems);assert.equal(stockItems,36);roundtrip(s);
});

// This follows an already verified public normal command trace using the same
// normal weapon. It checks QA persistence and replay, not QA weapon balance or
// a new normal-campaign completion proof. Reward ids are resolved from inventory
// because an explicitly granted QA starting card changes subsequently issued ids.
test('QA starting reward persists once and spent QA supplies renew at both natural chapter transitions',()=>{
  let normal=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true}),
    qa=create(custom(['music-box'],['qa-heal']),'beast-claw');
  const initialReward=H(qa).rewards.find(r=>r.qaStart),initialItem=H(qa).consumables.find(i=>i.kind==='qa-heal');
  qa=E.dispatch(qa,{type:'USE_CONSUMABLE',itemId:initialItem.id});
  assert(!H(qa).consumables.some(i=>i.kind==='qa-heal'));roundtrip(qa);
  const seen=[];
  for(const [index,command]of normalCommands.entries()){
    const before=normal.mission.chapter;
    try{qa=E.dispatch(qa,remapRewardCommand(command,normal,qa));normal=E.dispatch(normal,command);}
    catch(error){error.message=`at normal fixture command ${index+1}: ${JSON.stringify(command)}: ${error.message}`;throw error;}
    assert.equal(qa.mission.chapter,normal.mission.chapter);assert.equal(qa.phase,normal.phase);
    if(qa.mission.chapter!==before){seen.push(qa.mission.chapter);
      assert.equal(H(qa).rewards.filter(r=>r.qaStart).length,1);
      assert.equal(H(qa).rewards.find(r=>r.qaStart).id,initialReward.id);
      assert.equal(H(qa).consumables.filter(i=>i.kind==='qa-heal').length,1);roundtrip(qa);
      const renewed=H(qa).consumables.find(i=>i.kind==='qa-heal');
      qa=E.dispatch(qa,{type:'USE_CONSUMABLE',itemId:renewed.id});roundtrip(qa);
    }
  }
  assert.deepEqual(seen,[2,3]);assert.equal(qa.mission.chapter,3);
  assert(qa.mission.completed.includes(39));assert(qa.mission.revealed.includes(57));
  assert.equal(H(qa).rewards.filter(r=>r.qaStart).length,1);roundtrip(qa);
});

// The selected natural trace earns a lantern. An explicitly issued QA lantern
// is tracked separately from that stock reward and must not exhaust its supply.
test('a QA starting lantern does not block the actual chapter-one lantern reward',()=>{
  let normal=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true}),
    qa=create(custom(['lantern'],[]),'beast-claw'),found=false;
  for(const command of normalCommands){
    qa=E.dispatch(qa,remapRewardCommand(command,normal,qa));normal=E.dispatch(normal,command);
    if(H(normal).rewards.some(r=>r.kind==='lantern')){found=true;
      assert.equal(H(qa).rewards.filter(r=>r.kind==='lantern'&&r.qaStart).length,1);
      assert.equal(H(qa).rewards.filter(r=>r.kind==='lantern'&&!r.qaStart).length,1);
      roundtrip(qa);break;
    }
  }
  assert(found,'the fixture must actually earn a normal lantern');
});

test('QA weapon kills a real spawned enemy and QA cards clear the occupied attack slot',()=>{
  let s=E.create(firstFight.seed,'qa-test-weapon',0,null,'hunter-pistol','center',
    {campaign:true,qa:custom([],['qa-cards'])});
  assert.equal(E.weapon(s).faces[0].slots[0].speed,3);assert.equal(E.weapon(s).faces[0].slots[0].damage,12);
  assert.equal(E.weapon(s).faces[1].slots[0].damage,6);
  for(const c of firstFight.qa)s=E.dispatch(s,c);
  assert.equal(firstFight.qa.length,10);assert.equal(s.kills,1);assert.equal(s.phase,'hunter');
  assert(H(s).slots.some(Boolean));roundtrip(s);
  const item=H(s).consumables.find(i=>i.kind==='qa-cards'),hand=H(s).hand.length;
  s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:item.id});
  assert(H(s).slots.every(slot=>slot===null));assert.equal(H(s).hand.length,hand+3);roundtrip(s);
});

test('QA healing after a public stock-weapon battle restores actual damage and an exhausted firearm',()=>{
  let s=E.create(firstFight.healingSeed,'burial',0,null,'hunter-pistol','center',
    {campaign:true,qa:custom([],['qa-heal'])});
  for(const c of firstFight.healingNormal)s=E.dispatch(s,c);
  assert.equal(firstFight.healingNormal.length,22);assert.equal(s.kills,1);assert.equal(s.phase,'hunter');
  assert(H(s).hp<6);assert.equal(H(s).firearmReady,false);roundtrip(s);
  const item=H(s).consumables.find(i=>i.kind==='qa-heal');s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:item.id});
  assert.equal(H(s).hp,6);assert.equal(H(s).firearmReady,true);roundtrip(s);
});
