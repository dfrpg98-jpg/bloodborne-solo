"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine.js'),{boot}=require('./helpers/ui-harness.cjs');
const normalKey='bloodborne-hunt-v07',qaKey='bloodborne-hunt-qa-v1',activeKey='bloodborne-hunt-active-mode';
const normal=()=>E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true});
const qa=()=>E.create(90,'qa-test-weapon',0,null,'hunter-pistol','center',{campaign:true,qa:{preset:'fast'}});
const realEngine={create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
  missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
  interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView};
function realBoot(storage,options={}){const state=normal();return boot(state,E.missionView(state),E.rewardsView(state),
  {storage,engine:realEngine,realInventory:true,...options});}
function change(ui,id,value){const el=ui.el(id);assert(el,'missing '+id);el.value=String(value);el.fire('change');}
function clickAction(ui,type){const b=ui.el('decisions').querySelectorAll('[data-command]').find(b=>b.dataset.command===type&&!b.disabled);
  assert(b,'no enabled '+type+' action');b.click();assert.equal(ui.el('error').textContent,'');}

test('normal setup hides QA weapon and supplies while QA setup exposes them explicitly',()=>{
  const ui=realBoot({[normalKey]:E.exportSave(normal())});ui.el('new').click();
  assert.equal(ui.el('playMode').value,'campaign');
  assert(!ui.el('weapon').innerHTML.includes('qa-test-weapon'));
  assert(!ui.el('startingItem').innerHTML.includes('qa-heal'));
  assert.equal(ui.el('qaSetup').hidden,true);assert.equal(ui.el('qaModeBadge').hidden,true);
  change(ui,'playMode','qa-campaign');
  assert(ui.el('weapon').innerHTML.includes('qa-test-weapon'));
  assert.equal(ui.el('qaSetup').hidden,false);assert.equal(ui.el('startingItemSetup').hidden,true);
  assert(ui.el('qaConsumables').innerHTML.includes('qa-heal'));
  change(ui,'playMode','campaign');assert(!ui.el('weapon').innerHTML.includes('qa-test-weapon'));
  assert.equal(ui.el('qaSetup').hidden,true);
});

test('starting a QA hunt and using its real inventory preserves the normal autosave byte for byte',()=>{
  const saved=E.exportSave(normal()),ui=realBoot({[normalKey]:saved});ui.el('new').click();
  change(ui,'playMode','qa-campaign');change(ui,'weapon','qa-test-weapon');change(ui,'qaPreset','fast');
  change(ui,'seed',90);change(ui,'start','center');assert.equal(ui.el('confirmSetup').disabled,false);
  ui.el('confirmSetup').click();assert.equal(ui.el('error').textContent,'');
  let s=E.importSave(ui.storage.get(qaKey));assert.equal(s.setup.qa.preset,'fast');
  assert.equal(ui.storage.get(normalKey),saved);assert.equal(ui.storage.get(activeKey),'qa');
  assert.equal(ui.el('qaModeBadge').hidden,false);assert.equal(ui.el('resumeNormal').hidden,false);
  const item=E.hunter(s).consumables.find(i=>i.kind==='qa-cards'),
    card=ui.el('inventory').querySelectorAll('[data-item]').find(b=>b.dataset.item===item.id);
  assert(card,'QA consumable is selectable in the real inventory');card.click();
  assert(ui.el('useItem')&&!ui.el('useItem').disabled);ui.el('useItem').click();
  assert.equal(ui.el('error').textContent,'');s=E.importSave(ui.storage.get(qaKey));
  assert.equal(s.commands.at(-1).type,'USE_CONSUMABLE');assert.equal(E.hunter(s).hand.length,6);
  assert.equal(ui.storage.get(normalKey),saved);
});

test('normal and QA resume buttons restore separate exact replays and set the active marker',()=>{
  const normalSave=E.exportSave(normal()),qaSave=E.exportSave(qa()),
    ui=realBoot({[normalKey]:normalSave,[qaKey]:qaSave,[activeKey]:'qa'});
  assert.equal(ui.el('qaModeBadge').hidden,false);assert.equal(ui.el('resumeNormal').hidden,false);
  ui.el('resumeNormal').click();assert.equal(ui.el('error').textContent,'');
  assert.equal(ui.el('qaModeBadge').hidden,true);assert.equal(ui.storage.get(activeKey),'normal');
  assert.equal(ui.storage.get(normalKey),normalSave);assert.equal(ui.storage.get(qaKey),qaSave);
  assert.equal(ui.el('resumeQa').hidden,false);ui.el('resumeQa').click();
  assert.equal(ui.el('qaModeBadge').hidden,false);assert.equal(ui.storage.get(activeKey),'qa');
  assert.equal(ui.storage.get(normalKey),normalSave);assert.equal(ui.storage.get(qaKey),qaSave);
  const reloaded=realBoot(Object.fromEntries(ui.storage));assert.equal(reloaded.el('qaModeBadge').hidden,false);
  assert.deepEqual(E.importSave(reloaded.storage.get(qaKey)),qa());
});

test('QA file import routes only to the QA autosave and keeps the existing normal progression',async()=>{
  const normalSave=E.exportSave(normal());let q=qa();q=E.dispatch(q,{type:'END_TURN'});
  const qaSave=E.exportSave(q),ui=realBoot({[normalKey]:normalSave});
  const input={files:[{text:async()=>qaSave}],value:'fixture'};
  await ui.el('file').onchange({target:input});
  assert.equal(ui.el('error').textContent,'');assert.equal(input.value,'');
  assert.equal(ui.storage.get(normalKey),normalSave);assert.equal(ui.storage.get(qaKey),qaSave);
  assert.equal(ui.storage.get(activeKey),'qa');assert.equal(ui.el('qaModeBadge').hidden,false);
});

test('custom QA setup serializes selected reward and consumable quantities through actual start controls',()=>{
  const saved=E.exportSave(normal()),ui=realBoot({[normalKey]:saved});ui.el('new').click();
  change(ui,'playMode','qa-campaign');change(ui,'weapon','burial');change(ui,'qaPreset','custom');
  for(const [container,attribute,id]of [['qaRewards','qaReward','music-box'],['qaConsumables','qaConsumable','qa-heal']]){
    const el=ui.el(container).querySelectorAll('[data-'+attribute.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')
      .find(s=>s.dataset[attribute]===id);assert(el,'custom selection '+id);el.value='1';el.fire('change');
  }
  change(ui,'seed',90);change(ui,'start','center');ui.el('confirmSetup').click();
  assert.equal(ui.el('error').textContent,'');const s=E.importSave(ui.storage.get(qaKey));
  assert.equal(s.setup.weaponId,'burial');assert.equal(s.setup.qa.preset,'custom');
  assert.deepEqual(s.setup.qa.startRewards,['music-box']);assert.deepEqual(s.setup.qa.startConsumables,['qa-heal']);
  assert.equal(ui.storage.get(normalKey),saved);assert.equal(ui.el('qaModeBadge').hidden,false);
});

test('a normal command after returning from QA changes only the normal save',()=>{
  const normalSave=E.exportSave(normal()),qaSave=E.exportSave(qa()),
    ui=realBoot({[normalKey]:normalSave,[qaKey]:qaSave,[activeKey]:'qa'});
  ui.el('resumeNormal').click();clickAction(ui,'END_TURN');
  assert.equal(ui.storage.get(qaKey),qaSave);assert.equal(ui.storage.get(activeKey),'normal');
  const s=E.importSave(ui.storage.get(normalKey));assert.equal(s.commands.at(-1).type,'END_TURN');
  assert.equal(Object.hasOwn(s.setup,'qa'),false);assert.equal(ui.el('qaModeBadge').hidden,true);
});

test('real QA inventory starts a six-step movement and stops it without changing the normal save',()=>{
  const normalSave=E.exportSave(normal()),q=qa(),ui=realBoot({[normalKey]:normalSave,[qaKey]:E.exportSave(q),[activeKey]:'qa'});
  const item=E.hunter(q).consumables.find(i=>i.kind==='qa-travel'),
    card=ui.el('inventory').querySelectorAll('[data-item]').find(b=>b.dataset.item===item.id);
  assert(card);card.click();assert(ui.el('useItem')&&!ui.el('useItem').disabled);ui.el('useItem').click();
  assert.equal(ui.el('error').textContent,'');let s=E.importSave(ui.storage.get(qaKey));
  assert.equal(s.phase,'move');assert.equal(s.move.remaining,6);
  clickAction(ui,'STOP_MOVE');s=E.importSave(ui.storage.get(qaKey));assert.equal(s.phase,'hunter');
  assert.equal(ui.storage.get(normalKey),normalSave);assert.equal(ui.el('qaModeBadge').hidden,false);
});
