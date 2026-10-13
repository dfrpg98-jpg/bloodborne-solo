const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),V=require('../enemy-visuals'),W=require('../weapon-visuals'),{boot}=require('./helpers/ui-harness.cjs');
const saveKey='bloodborne-hunt-v07',checkpoints=new Map(),resolved=[],phaseTransitions=[];
function collect(commands,setup){
 let s=E.create(setup.seed??90,setup.weaponId||'burial',setup.startFace??setup.face??1,setup.startingConsumable??null,setup.initialFirearmId||setup.firearmId||'hunter-pistol',setup.startSpace||'center',{campaign:true,rulesVersion:setup.rulesVersion??11});
 for(const command of commands){
  for(const e of s.enemies){const d=E.enemyDef(s,e),skin=V.skin(e.componentSpec||e.extendedId||d.id||e.componentId||e.kind,d.sideId||'a',e.componentPhase||d.phase||1);if(skin&&!checkpoints.has(skin))checkpoints.set(skin,s);}
  const next=E.dispatch(s,command);
  if(command.type==='RESOLVE'&&s.combat){const lines=next.events.slice(-15).map(x=>x.text);resolved.push({state:s,command,next,lines});if(lines.some(t=>/페이즈로 전환/.test(t))&&next.enemies.some(e=>e.componentPhase===2)&&!s.enemies.some(e=>e.componentPhase===2))phaseTransitions.push({state:s,command,next});}
  s=next;
 }
}
const manifest=require('./fixtures/weapon-campaign-completion/manifest.json'),main=manifest.cases.find(x=>x.weaponId==='threaded-cane');
collect(require('./fixtures/weapon-campaign-completion/'+main.commandsFile),main);
collect(require('./fixtures/v074-patient-natural-commands.json'),{});
collect(require('./fixtures/v074-attack-iosefka-natural-commands.json'),{});
function launch(state,extra={},ready={}){
 const snapshots=[],mounts=[],saved=E.exportSave(state);const ui=boot(state,E.missionView(state),E.rewardsView(state),{realInventory:true,storage:{[saveKey]:saved},
 engine:{create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,missionView:E.missionView,rewardsView:E.rewardsView,applyChapelRuling:s=>s},
 window:{BBEnemyVisuals:V,BBWeaponVisuals:W,BBCharacterAssets:{hunter:{path:'assets/characters/hunter.png'}},BBEnemyCharacterAssets:{},
 BBHuntPresentation(options){mounts.push(options);return {sync(value){snapshots.push(JSON.parse(JSON.stringify(value)));},actorReady(id){return ready[id]===true;},resize(){},focus(){},destroy(){}};},...extra}});
 return {ui,snapshots,mounts,saved};
}
const latest=f=>f.snapshots.at(-1),enemyActors=f=>latest(f).actors.filter(x=>x.kind==='enemy');
function resolve(f){const b=f.ui.document.querySelectorAll('[data-command]').find(e=>e.dataset.command==='RESOLVE'&&!e.disabled);assert(b,'RESOLVE is enabled through the actual UI');b.click();assert.equal(f.ui.el('error').textContent,'');}

for(const skin of ['e-huntsman-mob-a','e-huntsman-mob-b','e-scourge-beast-a','e-scourge-beast-b','e-huntsmans-minion-a','e-huntsmans-minion-b','e-female-patient-a','e-iosefka-hostile','e-cleric-beast-1','e-cleric-beast-2'])test(`${skin} normal-play save exposes its exact public appearance without changing save data`,()=>{
 const state=checkpoints.get(skin);assert(state,skin+' exists in a natural command trace');const f=launch(state);
 assert.ok(enemyActors(f).some(a=>a.skin===skin));assert.deepEqual(latest(f).actions,[]);assert.equal(f.ui.storage.get(saveKey),f.saved);assert.equal(E.exportSave(state),f.saved);
 const a=enemyActors(f).find(a=>a.skin===skin);assert.equal(a.skin,V.skin(a.enemyId,a.enemySide,a.enemyPhase));
 assert.doesNotMatch(JSON.stringify(latest(f)),/bossDecks|actionDeck|pendingReward|nextAction|futureRewards|参考|참고자료|\.jpg/);
});
test('special patients and Iosefka keep component identity despite basic enemy kinds',()=>{
 for(const skin of ['e-female-patient-a','e-iosefka-hostile']){
  const state=checkpoints.get(skin),f=launch(state),a=enemyActors(f).find(a=>a.skin===skin),source=state.enemies.find(e=>e.id===a.id);
  assert.notEqual(a.enemyId,source.kind);assert.equal(a.enemyId,source.componentSpec);
 }
});
test('an optional imported enemy manifest is merged without being required to run the UI',()=>{
 const state=checkpoints.get('e-cleric-beast-1'),f=launch(state,{BBEnemyCharacterAssets:{'e-cleric-beast-1':{path:'assets/characters/source-cleric.png'}}});
 assert.equal(f.mounts[0].characters['e-cleric-beast-1'].path,'assets/characters/source-cleric.png');assert.equal(f.ui.storage.get(saveKey),f.saved);
 const missing=launch(state);assert.ok(missing.mounts[0].characters.hunter);assert.ok(!missing.mounts[0].characters['e-cleric-beast-1']);
});
test('actual UI resolution plays public enemy actions and preserves exact rule-state and accepted commands',()=>{
 const record=resolved.find(r=>r.state.combat.action?.type==='attack'&&E.hunter(r.next).hp<E.hunter(r.state).hp&&!r.next.enemies.some(e=>e.componentPhase===2));assert(record);
 const f=launch(record.state);resolve(f);const actual=E.importSave(f.ui.storage.get(saveKey));assert.deepEqual(actual,record.next);
 const a=latest(f).actions.find(x=>['attack','shot'].includes(x.type)&&x.fromId===record.state.combat.enemyId);assert(a);assert.equal(a.attackStyle,'enemy');assert.ok(a.skin.startsWith('e-'));
 assert.equal(a.damage,E.hunter(record.state).hp-E.hunter(record.next).hp);
});
test('actual boss phase change uses the next visible phase, retaining the old-phase damage source',()=>{
 const record=phaseTransitions[0];assert(record);const f=launch(record.state);resolve(f);assert.deepEqual(E.importSave(f.ui.storage.get(saveKey)),record.next);
 const phase=latest(f).actions.find(a=>a.type==='phase');assert(phase);assert.equal(phase.skin,'e-cleric-beast-2');
 const hit=latest(f).actions.find(a=>a.toId===phase.fromId&&a.fromId==='hunter');assert(hit);assert.equal(hit.targetSkin,'e-cleric-beast-1');
 assert.equal(enemyActors(f).find(a=>a.id===phase.fromId).enemyPhase,2);
});
test('camera refresh never plays a combat pose or exposes the undisclosed deck',()=>{
 const state=checkpoints.get('e-cleric-beast-2'),f=launch(state),stored=f.ui.storage.get(saveKey);f.ui.el('mapViewport').fire('scroll');
 assert.deepEqual(latest(f).actions,[]);assert.equal(f.ui.storage.get(saveKey),stored);
 assert.doesNotMatch(JSON.stringify(latest(f)),/draw|discard|bossDecks|actionDeck|revealNext/);
});
test('each DOM actor token follows its own original-source readiness while other actors remain selectable',()=>{
 const state=checkpoints.get('e-cleric-beast-1'),ready={},f=launch(state,{},ready);
 const token=f.ui.el('chapterMap').querySelectorAll('.hunter-map-marker')[0],figures=f.ui.el('chapterMap').querySelectorAll('.map-figure');assert(token);assert(figures.length);
 assert.equal(token.getAttribute('data-character-ready'),'false');assert.ok(figures.every(e=>e.getAttribute('data-character-ready')==='false'));
 ready.hunter=true;ready[figures[0].dataset.presentationId]=true;f.ui.el('mapViewport').fire('scroll');
 assert.equal(token.getAttribute('data-character-ready'),'true');assert.equal(figures[0].getAttribute('data-character-ready'),'true');
 assert.ok(figures.slice(1).every(e=>e.getAttribute('data-character-ready')==='false'));assert.equal(f.ui.storage.get(saveKey),f.saved);
 ready.hunter=false;f.ui.el('mapViewport').fire('scroll');assert.equal(token.getAttribute('data-character-ready'),'false');assert.equal(f.ui.storage.get(saveKey),f.saved);
});
