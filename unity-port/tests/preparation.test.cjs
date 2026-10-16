'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require('../tools/reference-source.cjs')('hunt-engine.js'),{newSession,project}=require('../tools/oracle.cjs');
const root=path.resolve(__dirname,'..');
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
const hash=x=>crypto.createHash('sha256').update(canonical(x),'utf8').digest('hex');
function rejectPrivate(value){
  const banned=new Set(['rng','initialSeed','setup','commands','world','deck','draw','enemyDeck','enemyDiscard','upgradeDeck','tileDeck','consumableDeck','market','sourceState','pendingRewards','bossDecks','chapelArrival']);
  if(Array.isArray(value))return value.forEach(rejectPrivate);
  if(value&&typeof value==='object')for(const[key,child]of Object.entries(value)){assert(!banned.has(key),'private key leaked: '+key);rejectPrivate(child);}
}
test('every captured public checkpoint excludes private decks, seed, commands and pending outcomes',()=>{
  const index=require('../MigrationPrivate/Parity/index.json');let count=0;
  for(const item of index.traces){const data=require(path.join(root,'MigrationPrivate/Parity',item.file));for(const entry of data.checkpoints){rejectPrivate(entry.view);count++;}}
  assert(count>100);
});
test('unknown private fields cannot cross public allowlist; unopened title and deck poison remain hidden',()=>{
  const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  s.debugSecret='UNOPENED_PRIVATE_POISON';s.world.debugSecret='UNOPENED_PRIVATE_POISON';
  s.enemyDeck.push('UNOPENED_PRIVATE_POISON');
  const output=project(s);rejectPrivate(output);assert(!JSON.stringify(output).includes('UNOPENED_PRIVATE_POISON'));
  const other=E.create(4294967295,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  assert.equal(output.sceneId,project(other).sceneId,'scene identity cannot encode the seed');
  assert.equal(output.sceneId,'session-1:1:unity-prep');
  const known=new Set(s.mission.revealed);
  assert(output.chapter.entries.every(x=>known.has(x.number)));
  assert(!output.chapter.entries.some(x=>x.number===60));
});

test('scene tokens reset only after successful create or import and remain stable during a session',()=>{
  const session=newSession();
  const first=session({id:1,op:'create',setup:{seed:90,options:{campaign:true,rulesVersion:14}}});
  assert.equal(first.view.sceneId,'session-1:1:unity-prep');
  assert.equal(session({id:2,op:'view'}).view.sceneId,first.view.sceneId);
  const other=newSession()({id:1,op:'create',setup:{seed:123456789,options:{campaign:true,rulesVersion:14}}});
  assert.equal(other.view.sceneId,first.view.sceneId,'separate seeds start with the same opaque lifecycle identity');
  const second=session({id:3,op:'create',setup:{seed:90,options:{campaign:true,rulesVersion:14}}});
  assert.equal(second.view.sceneId,'session-2:1:unity-prep');
  const saved=session({id:4,op:'export-save'}).save;
  const imported=session({id:5,op:'import-save',save:saved});
  assert.equal(imported.view.sceneId,'session-3:1:unity-prep');
  const before=session({id:6,op:'export-save'}).save;
  const tampered=JSON.parse(before);tampered.state.hunters['hunter-1'].hp=5;
  assert.throws(()=>session({id:7,op:'import-save',save:JSON.stringify(tampered)}));
  assert.equal(session({id:8,op:'export-save'}).save,before);
  assert.equal(session({id:9,op:'view'}).view.sceneId,imported.view.sceneId);
  assert.throws(()=>session({id:10,op:'create',setup:{weaponId:'unknown'}}));
  assert.equal(session({id:11,op:'view'}).view.sceneId,imported.view.sceneId);
  const next=session({id:12,op:'import-save',save:saved});
  assert.equal(next.view.sceneId,'session-4:1:unity-prep','failed resets do not consume an identity');
});

test('Tonitrus practice attacks and imported combats recover charge without requiring a campaign setup',()=>{
  const setup={seed:90,weaponId:'tonitrus',face:0,startingConsumable:null,firearmId:'hunter-pistol',startSpace:'center',
    options:{campaign:false,rulesVersion:14,practiceTarget:'church-servant'}};
  for(const charged of [false,true]){
    const session=newSession(),initial=session({id:1,op:'create',setup});
    const cards=initial.view.hunter.hand,commands=[];
    if(charged)commands.push({type:'TRANSFORM',cardId:cards[0].id});
    commands.push({type:'ATTACK',enemyId:'practice-target',cardId:cards[charged?1:0].id,slot:0});
    const result=session({id:2,op:'dispatch',expectedRevision:0,commands});
    assert.equal(result.view.phase,'combat_react');
    assert.equal(result.view.combat.attackSkin,charged?'w-tonitrus-b':'w-tonitrus-a');
    assert.equal(result.view.sceneId,initial.view.sceneId);
    const saved=session({id:3,op:'export-save'}).save;
    const reference=commands.reduce((s,c)=>E.dispatch(s,c),E.create(setup.seed,setup.weaponId,setup.face,null,
      setup.firearmId,setup.startSpace,setup.options));
    assert.deepEqual(E.importSave(saved),reference);
    const imported=newSession()({id:4,op:'import-save',save:saved});
    assert.deepEqual(imported.view,result.view);rejectPrivate(imported.view);
  }
});
test('batch keeps ordered original commands and rejects every partial commit after a later failure',()=>{
  const session=newSession();const initial=session({id:1,op:'create',setup:{seed:90,face:1,options:{campaign:true,rulesVersion:13}}});
  const cardId=initial.view.hunter.hand[0].id;
  assert.throws(()=>session({id:2,op:'dispatch',expectedRevision:0,commands:[{type:'MOVE',cardId},{type:'NOT_A_COMMAND'}]}));
  assert.equal(session({id:3,op:'view'}).view.revision,0);
  const next=session({id:4,op:'dispatch',expectedRevision:0,commands:[{type:'MOVE',cardId},{type:'STOP_MOVE'}]});
  assert.equal(next.view.revision,2);
  const saved=JSON.parse(session({id:5,op:'export-save'}).save);
  assert.deepEqual(saved.state.commands,[{type:'MOVE',cardId},{type:'STOP_MOVE'}]);
  assert.throws(()=>session({id:6,op:'dispatch',expectedRevision:0,commands:[{type:'END_TURN'}]}),/Stale/);
  rejectPrivate(next.view);
});
test('fresh oracle imports original save before separately recorded chapel adoption',()=>{
  const fixture=require('../MigrationPrivate/Parity/legacy12-pending-and-adoption.json');
  let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:12});
  for(const c of fixture.commands.slice(0,315))s=E.dispatch(s,c);
  const session=newSession(),save=E.exportSave(s),loaded=session({id:1,op:'import-save',save});
  assert.equal(loaded.view.revision,s.revision);
  assert.deepEqual(JSON.parse(session({id:2,op:'export-save'}).save).state,s);
  session({id:3,op:'apply-chapel-ruling'});
  const adopted=JSON.parse(session({id:4,op:'export-save'}).save).state;
  assert.equal(adopted.setup.rulesVersion,12);assert.equal(adopted.chapelRuling,'escort-first');
  assert.deepEqual(adopted.commands.at(-1),{type:'APPLY_CHAPEL_RULING'});
  const tampered=JSON.parse(save);tampered.state.chapelRuling='escort-first';
  assert.throws(()=>session({id:5,op:'import-save',save:JSON.stringify(tampered)}));
  assert.deepEqual(JSON.parse(session({id:6,op:'export-save'}).save).state,adopted);
});
test('source module closure and runtime asset copies match their exported SHA-256 provenance',()=>{
  const source=require('../MigrationPrivate/source-manifest-v1.json'),assets=require('../MigrationPrivate/assets-manifest-v1.json');
  const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for(const file of source.sourceFiles)assert.equal(sha(path.join(root,'ReferenceEngine',file.path)),file.sha256,file.path);
  for(const file of assets.entries)assert.equal(sha(path.join(root,'UnityStarter',file.unityPath)),file.sha256,file.sourcePath);
  assert(!assets.entries.some(x=>/reference|photo|IMG_|DSC_/i.test(x.sourcePath)));
});
test('content covers all gameplay namespaces and preserves excluded function contracts rather than treating data as behavior',()=>{
  const content=require('../MigrationPrivate/content-v1.json');
  assert.equal(content.schemaVersion,1);assert.equal(content.visibility,'authoritative-private');
  assert.equal(Object.keys(content.weaponVisuals).length,15);assert.equal(Object.keys(content.tileGeometry).length,20);
  assert.equal(content.campaign.cards.length,60);assert(content.modules['boss-components.js'].executableMembersExcluded.includes('boss-components.js.draw'));
  assert.equal(Object.keys(content.modules['rewards-engine.js'].data.definitions).length,32);
  assert(!fs.existsSync(path.join(root,'UnityStarter/Assets/Bloodborne/content-v1.json')));
});
test('new kill reactions expose only legal public commands, save exactly and adopt legacy policy separately',()=>{
  if(typeof E.applyCombatReactionRuling!=='function')return;
  const data=require('../MigrationPrivate/Parity/current14-kill-reaction-pending.json');
  const session=newSession();session({id:1,op:'create',setup:{...data.setup,options:data.setup.options}});
  session({id:2,op:'dispatch',expectedRevision:0,commands:data.commands});
  const view=session({id:3,op:'view'}).view;
  assert.equal(view.phase,'kill_react');assert.equal(view.hunter.hp,2);rejectPrivate(view);
  assert(view.reactionActions.some(x=>x.command.type==='USE_REWARD'));assert(view.reactionActions.some(x=>x.command.type==='PASS_KILL_REACTION'));
  const opaque=session({id:4,op:'export-save'}).save;
  assert.deepEqual(E.importSave(opaque),JSON.parse(opaque).state);
  const old=newSession();old({id:1,op:'create',setup:{...data.setup,options:{...data.setup.options,rulesVersion:13}}});
  const before=JSON.parse(old({id:2,op:'export-save'}).save).state;
  old({id:3,op:'apply-combat-reaction-ruling'});
  const after=JSON.parse(old({id:4,op:'export-save'}).save).state;
  assert.equal(after.setup.rulesVersion,13);assert.equal(after.combatReactionRuling,'immediate');
  assert.deepEqual(after.commands,[{type:'APPLY_COMBAT_REACTION_RULING'}]);assert.deepEqual(before.commands,[]);
  assert.deepEqual(E.importSave(E.exportSave(after)),after);
});
test('all fifteen current rules14 campaigns match oracle public and event parity at every accepted original command',()=>{
  if(E.create().setup.rulesVersion<14)return;
  const index=require('../MigrationPrivate/Parity/index.json');
  const cases=index.traces.filter(x=>x.name.startsWith('current14-campaign-'));
  assert.equal(cases.length,15);
  for(const item of cases){
    const fixture=require(path.join(root,'MigrationPrivate/Parity',item.file));
    const session=newSession();const initial=session({id:1,op:'create',setup:fixture.setup});
    assert.equal(hash(initial.view),fixture.checks[0].publicHash,item.name+' creation');
    let result=initial;
    for(const[i,command]of fixture.commands.entries()){
      result=session({id:i+2,op:'dispatch',expectedRevision:i,commands:[command]});
      assert.equal(hash(result.view),fixture.checks[i+1].publicHash,item.name+' public '+i);
      assert.equal(hash(result.actions),fixture.checks[i+1].eventHash,item.name+' events '+i);
    }
    assert.equal(result.view.result,'campaign-win',item.name);assert.equal(result.view.chapter.chapter,3);
    const actual=JSON.parse(session({id:3,op:'export-save'}).save);
    assert.deepEqual(actual,fixture.expectedFinalSave,item.name);
    assert.deepEqual(E.importSave(JSON.stringify(actual)),actual.state);
    rejectPrivate(result.view);
  }
});
