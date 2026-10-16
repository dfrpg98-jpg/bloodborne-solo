'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..');
// Model metadata only: raw save files remain in memory.
const E=require(path.join(root,'hunt-engine.js'));
const out=null;
const qa={preset:'custom',startRewards:[],startConsumables:[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')]};
const base=[{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},{type:'PLACE_TILE',rotation:0}];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function publicState(s){const h=E.hunter(s);return{phase:s.phase,round:s.round,track:s.track,position:h.position,hp:h.hp,weaponId:h.weaponId,face:h.face,hand:h.hand.map(c=>({id:c.id,name:E.card(c).name,kind:c.kind})),enemies:s.enemies.map(e=>({id:e.id,name:E.enemyDef(s,e).name,node:e.node,hp:e.hp})),commandCount:s.commands.length};}
function checkpoint(s,folder,name,nextCommands){const raw=E.exportSave(s);assert.deepEqual(E.importSave(raw),s);return{checkpointName:name,publicModelSummary:publicState(s),exportSha256:sha(raw),nextCommands};}
const profiles=[];
for(const face of [0,1]) for(const weaponId of Object.keys(E.data.weapons).filter(id=>id!=='training')){
  const folder=null;
  const firearmId=E.data.weapons[weaponId].defaultFirearm||'hunter-pistol';
  const setup={seed:140,weaponId,face,startingConsumable:null,firearmId,startSpace:'center',options:{campaign:true,rulesVersion:14,qa}};
  let s=E.create(setup.seed,weaponId,face,null,firearmId,'center',setup.options);for(const c of base)s=E.dispatch(s,c);
  assert.equal(E.hunter(s).position,'tile-01:bottom');assert.equal(s.enemies.length,2);
  const checkpoints={};
  checkpoints.beforeWalk=checkpoint(s,folder,'before-walk',[{type:'STEP',node:'tile-01:top'},{type:'STOP_MOVE'}]);
  s=E.dispatch(s,{type:'STEP',node:'tile-01:top'});
  checkpoints.beforePursuit=checkpoint(s,folder,'before-pursuit',[{type:'STOP_MOVE'}]);
  s=E.dispatch(s,{type:'STOP_MOVE'});
  const chaseResponses=[];
  if(s.phase==='weapon_entry'){const c={type:'ENTRY_WEAPON',accept:false};chaseResponses.push(c);s=E.dispatch(s,c);}
  if(s.phase==='firearm_react'){const c={type:'FIREARM_ENTRY',accept:false};chaseResponses.push(c);s=E.dispatch(s,c);}
  assert.equal(s.phase,'hunter');assert.ok(s.enemies.every(e=>e.node==='tile-01:top'));
  s=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:'item-qa-1-11'});
  checkpoints.beforeTransform=checkpoint(s,folder,'before-transform',[{type:'TRANSFORM',cardId:'card-1'},{type:'TRANSFORM',cardId:'card-3'}]);
  const transformResults=[];
  for(const cardId of ['card-1','card-3']){s=E.dispatch(s,{type:'TRANSFORM',cardId});transformResults.push(publicState(s));}
  assert.equal(s.phase,'hunter');assert.equal(E.hunter(s).face,face);
  const card=E.hunter(s).hand.find(x=>x.kind==='strength')||E.hunter(s).hand[0];
  const attack={type:'ATTACK',cardId:card.id,slot:0,enemyId:'scourge-beast-1'};
  checkpoints.beforeCombat=checkpoint(s,folder,'before-combat',[attack,{type:'RESOLVE'}]);
  const attackerBefore=publicState(s);s=E.dispatch(s,attack);
  const attackDeclared=publicState(s);let firstResolution=null;
  if(['combat_react','boss_react'].includes(s.phase)){
    s=E.dispatch(s,{type:'RESOLVE'});firstResolution=publicState(s);
    checkpoints.afterFirstResolve=checkpoint(s,folder,'after-first-resolve',[]);
  }
  profiles.push({weaponId,name:E.data.weapons[weaponId].name,setup,preparationCommands:base,chaseResponses,checkpoints,transformResults,combat:{attackerBefore,attack,attackDeclared,firstResolution},verification:'Every checkpoint is unmodified E.create/E.dispatch state exported by E.exportSave and exact-replayed by E.importSave.'});
}
const manifest={method:'Engine-only QA model, no browser observations or raw saves included',version:require(path.join(root,'package.json')).version,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),qaSupplies:{heal:10,cards:10,travel:10},seed:140,profiles};
process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
