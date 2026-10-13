'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),{boot}=require('./helpers/ui-harness.cjs');

test('controller presents the public kill reaction commands instead of an empty decision phase',()=>{
 const s=E.create(91,'burial',0,null,'hunter-pistol','center',{campaign:false});
 s.phase='kill_react';
 const ui=boot(s,null,null,{engine:{
  applyCombatReactionRuling:x=>x,
  killReactionActions:()=>[
   {label:'피의 기쁨 · 손패 1장, 치유 1',command:{type:'USE_REWARD',rewardId:'rune-1'}},
   {label:'처치 효과 사용 마치기 · 전투 계속',command:{type:'PASS_KILL_REACTION'}},
  ],
 }});
 assert.equal(ui.el('phaseTitle').textContent,'처치 효과 선택');
 assert(ui.el('decisions').textContent.includes('피의 기쁨'));
 ui.buttons('decisions').find(b=>b.dataset.command==='USE_REWARD').click();
 assert.deepEqual(JSON.parse(JSON.stringify(ui.commands.at(-1))),{type:'USE_REWARD',rewardId:'rune-1'});
 ui.buttons('decisions').find(b=>b.dataset.command==='PASS_KILL_REACTION').click();
 assert.deepEqual(JSON.parse(JSON.stringify(ui.commands.at(-1))),{type:'PASS_KILL_REACTION'});
});

test('legacy file import first verifies its original replay then records the combat timing adoption',async()=>{
 const legacy=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
 const original=E.exportSave(legacy),ui=boot(E.create(91,'burial',1,null,'hunter-pistol','center',{campaign:true}),null,null,
  {engine:{create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
    applyCombatReactionRuling:E.applyCombatReactionRuling}});
 const input={files:[{text:async()=>original}],value:'selected.json'};
 await ui.el('file').onchange({target:input});
 const loaded=E.importSave(ui.storage.get('bloodborne-hunt-v07'));
 assert.equal(loaded.setup.rulesVersion,13);
 assert.equal(loaded.combatReactionRuling,'immediate');
 assert.deepEqual(loaded.commands,[{type:'APPLY_COMBAT_REACTION_RULING'}]);
 assert.strictEqual(E.applyCombatReactionRuling(loaded),loaded);
 assert.equal(original,E.exportSave(legacy),'the old save itself was not edited');
 assert.equal(input.value,'');
});

test('a rejected imported save preserves the exact existing browser save',async()=>{
 const current=E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true}),saved=E.exportSave(current);
 const ui=boot(current,E.missionView(current),E.rewardsView(current),{storage:{'bloodborne-hunt-v07':saved},
  engine:{create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
   applyCombatReactionRuling:E.applyCombatReactionRuling}});
 const bad=JSON.parse(saved);bad.state.hunters['hunter-1'].hp=5;
 const input={files:[{text:async()=>JSON.stringify(bad)}],value:'edited.json'};
 await ui.el('file').onchange({target:input});
 assert.equal(ui.storage.get('bloodborne-hunt-v07'),saved);
 assert(ui.el('error').textContent.includes('명령 기록'));
});

test('the natural reaction UI retains Rapture after Beast and names the explicit end of its timing window',()=>{
 const f=require('./fixtures/natural-kill-reaction-v14.json');
 let s=E.create(f.seed,'burial',0,null,'hunter-pistol','center',
  {campaign:false,rulesVersion:14,practiceRewards:['rune-rapture','rune-beast']});
 for(const c of f.commands)s=E.dispatch(s,c);
 const ui=boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
  storage:{'bloodborne-hunt-v07':E.exportSave(s)},engine:{
   create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
   rewardsView:E.rewardsView,killReactionActions:E.killReactionActions}});
 assert(ui.el('rewards').textContent.includes('처치 효과 사용 마치기를 누르면'));
 assert(!ui.el('rewards').textContent.includes('다른 행동을 하면 이 처치의 사용 기회가 끝납니다'));
 const beast=ui.buttons('decisions').find(b=>b.dataset.command==='USE_REWARD'&&JSON.parse(b.dataset.args).enemyId);
 assert(beast);beast.click();assert.equal(ui.el('error').textContent,'');
 const healed=ui.buttons('decisions').find(b=>b.dataset.command==='USE_REWARD'&&!JSON.parse(b.dataset.args).enemyId);
 assert(healed&&!healed.disabled);healed.click();assert.equal(ui.el('error').textContent,'');
 const restored=E.importSave(ui.storage.get('bloodborne-hunt-v07'));
 assert.equal(restored.phase,'kill_react');
 assert.equal(restored.commands.slice(-2).every(c=>c.type==='USE_REWARD'),true);
});
