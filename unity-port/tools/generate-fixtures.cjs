'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const reference=require('./reference-source.cjs');
const E=reference('hunt-engine.js');
const G=reference('tile-geometry.js');
const A=reference('hunt-animation-events.js');
const {project}=require('./oracle.cjs');
const source=path.resolve(process.argv[2] || path.join(__dirname,'../..'));
const destination=path.resolve(__dirname,'../MigrationPrivate/Parity');fs.mkdirSync(destination,{recursive:true});
const read=file=>JSON.parse(fs.readFileSync(path.join(source,'tests/fixtures',file),'utf8'));
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
const hash=x=>crypto.createHash('sha256').update(canonical(x),'utf8').digest('hex');
const save=(name,value)=>fs.writeFileSync(path.join(destination,name),JSON.stringify(value,null,2)+'\n');
const index=[];
function trace(name,setup,commands,requireWin=false){
  let s=E.create(setup.seed,setup.weaponId,setup.face,setup.startingConsumable,setup.firearmId,setup.startSpace,setup.options),before=project(s);
  const checks=[{index:0,stateHash:hash(s),publicHash:hash(before),phase:s.phase}],seen=new Set([s.phase]);
  const checkpoints=[{index:0,view:before}];
  for(let i=0;i<commands.length;i++){
    const command=commands[i];s=E.dispatch(s,command);const after=project(s),events=A.describe(before,after,[command]);
    checks.push({index:i+1,stateHash:hash(s),publicHash:hash(after),eventHash:hash(events),phase:s.phase});
    if(!seen.has(s.phase)||s.phase==='between_chapters'||(s.combat&&s.enemies.some(e=>e.bossDecks))&&!checkpoints.some(c=>c.bossPhase===`${s.mission?.chapter}:${s.enemies.find(e=>e.bossDecks)?.componentPhase}`)){
      checkpoints.push({index:i+1,view:after,bossPhase:s.enemies.find(e=>e.bossDecks)?`${s.mission?.chapter}:${s.enemies.find(e=>e.bossDecks).componentPhase}`:undefined});
      assert.deepEqual(E.importSave(E.exportSave(s)),s);
    }
    seen.add(s.phase);before=after;
  }
  if(requireWin)assert.equal(s.result,'campaign-win',name);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  save(name+'.json',{format:'bloodborne-unity-parity',schemaVersion:1,visibility:'developer-private',name,setup,commands,checks,checkpoints,expectedFinalSave:JSON.parse(E.exportSave(s))});
  index.push({name,file:name+'.json',commands:commands.length,rulesVersion:setup.options.rulesVersion??null,result:s.result,phases:[...seen]});
  return s;
}
const manifest=read('weapon-campaign-completion/manifest.json');
// Freeze full campaign/face traces to rules13: these are compatibility goldens,
// even when the exporting source has a newer current default.
for(const item of manifest.cases)trace('current13-'+item.weaponId,{seed:item.seed,weaponId:item.weaponId,face:item.startFace,startingConsumable:null,
  firearmId:item.initialFirearmId,startSpace:item.startSpace,options:{campaign:true,rulesVersion:13}},read('weapon-campaign-completion/'+item.commandsFile),true);
// Both initial faces use the current rules, in addition to the full campaign set.
for(const item of manifest.chapterOne)trace(`face13-${item.weaponId}-${item.startFace}`,{seed:item.seed,weaponId:item.weaponId,face:item.startFace,startingConsumable:null,
  firearmId:item.initialFirearmId,startSpace:item.startSpace,options:{campaign:true,rulesVersion:13}},read('weapon-campaign-completion/'+item.commandsFile));
if(E.create().setup.rulesVersion>=14)for(const item of manifest.cases){
  const setup={seed:item.seed,weaponId:item.weaponId,face:item.startFace,startingConsumable:null,firearmId:item.initialFirearmId,startSpace:item.startSpace,options:{campaign:true,rulesVersion:14}};
  let s=E.create(setup.seed,setup.weaponId,setup.face,null,setup.firearmId,setup.startSpace,setup.options),commands=[];
  for(const original of read('weapon-campaign-completion/'+item.commandsFile)){
    const reactionUse=()=>original.type==='USE_REWARD'&&E.killReactionActions(s).some(x=>!x.disabled&&
      x.command.type==='USE_REWARD'&&x.command.rewardId===original.rewardId&&x.command.enemyId===original.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!reactionUse()){
      const pass={type:'PASS_KILL_REACTION'};s=E.dispatch(s,pass);commands.push(pass);
    }
    s=E.dispatch(s,original);commands.push(original);
  }
  while(s.phase==='kill_react'&&!s.rewardChoices.length){const pass={type:'PASS_KILL_REACTION'};s=E.dispatch(s,pass);commands.push(pass);}
  assert.equal(s.result,'campaign-win');
  trace('current14-campaign-'+item.weaponId,setup,commands,true);
}
for(const [rulesVersion,file] of [[7,'chapter-one-commands.json'],[8,'chapter-one-v8-commands.json'],[9,'actual-boss-natural-commands.json'],[10,'full-campaign-actual-v10-commands.json'],[11,'full-campaign-actual-v10-commands.json']])
  trace('legacy'+rulesVersion,{seed:90,weaponId:'burial',face:1,startingConsumable:null,firearmId:'hunter-pistol',startSpace:'center',options:{campaign:true,rulesVersion}},read(file));
const pending=read('v075-chapel-timing-natural-pending-commands.json');
trace('legacy12-pending-and-adoption',{seed:90,weaponId:'beast-claw',face:0,startingConsumable:null,firearmId:'hunter-pistol',startSpace:'center',options:{campaign:true,rulesVersion:12}},
  [...pending.slice(0,315),{type:'APPLY_CHAPEL_RULING'}]);
trace('legacy-missing-rules',{seed:90,weaponId:'burial',face:0,startingConsumable:null,firearmId:'hunter-pistol',startSpace:'center',options:{campaign:true,rulesVersion:null}},[]);
// Exact old saved command sequences, including a user fog-save fixture.
for(const file of ['v061-owned-bone-ash-save.json','user-play-fog-v089.json']){
  const restored=E.importSave(JSON.stringify(read(file))),x=restored.setup;
  trace('saved-'+file.replace('.json',''),{seed:restored.initialSeed,weaponId:x.weaponId,face:x.face,startingConsumable:x.startingConsumable,
    firearmId:x.firearmId,startSpace:x.startSpace,options:{...x,rulesVersion:x.rulesVersion??null}},restored.commands);
}
if(E.create().setup.rulesVersion>=14){
  const natural=read('natural-kill-reaction-v14.json');
  const setup={seed:natural.seed,weaponId:'burial',face:0,startingConsumable:null,firearmId:'hunter-pistol',startSpace:'center',
    options:{campaign:false,rulesVersion:14,practiceRewards:['rune-rapture','rune-beast']}};
  const pendingState=trace('current14-kill-reaction-pending',setup,natural.commands);
  assert.equal(pendingState.phase,'kill_react');assert.equal(E.hunter(pendingState).hp,2);
  function extend(state,commands){
    let current=state,copy=[...commands],guard=0;
    while(current.phase==='kill_react'&&guard++<10){
      const actions=E.killReactionActions(current).filter(x=>!x.disabled);
      const choice=actions.find(x=>x.command.type==='USE_REWARD') || actions.find(x=>x.command.type==='PASS_KILL_REACTION');
      assert(choice);copy.push(choice.command);current=E.dispatch(current,choice.command);
    }
    assert.notEqual(current.phase,'kill_react');return copy;
  }
  trace('current14-kill-reaction-rapture-beast-resume',setup,extend(pendingState,natural.commands));
  const legacySetup={...setup,options:{...setup.options,rulesVersion:13}};
  const adopted=trace('legacy13-adopted-kill-reaction-pending',legacySetup,[{type:'APPLY_COMBAT_REACTION_RULING'},...natural.commands]);
  assert.equal(adopted.phase,'kill_react');assert.equal(adopted.combatReactionRuling,'immediate');
  trace('legacy13-adopted-kill-reaction-resume',legacySetup,extend(adopted,[{type:'APPLY_COMBAT_REACTION_RULING'},...natural.commands]));
  const fast=read('natural-fast-kill-reaction-v14.json'),fastSetup={...setup,seed:fast.seed};
  const fastPending=trace('current14-fast-lethal-reaction-pending',fastSetup,fast.commands);
  assert.equal(fastPending.phase,'kill_react');assert.equal(E.hunter(fastPending).hp,4);
  const rapture=E.killReactionActions(fastPending).find(x=>x.command.type==='USE_REWARD'&&
    E.hunter(fastPending).rewards.find(r=>r.id===x.command.rewardId)?.kind==='rune-rapture');
  assert(rapture);
  let protectedState=E.dispatch(fastPending,rapture.command);assert.equal(E.hunter(protectedState).hp,5);
  const pass={type:'PASS_KILL_REACTION'};protectedState=E.dispatch(protectedState,pass);
  assert.equal(E.hunter(protectedState).hp,1);assert.equal(protectedState.phase,'stun');
  const discard={type:'STUN_DISCARD',cardId:E.hunter(protectedState).hand[0].id};
  protectedState=E.dispatch(protectedState,discard);assert.equal(protectedState.phase,'hunter');
  trace('current14-fast-rapture-prevents-death',fastSetup,[...fast.commands,rapture.command,pass,discard]);
  const oldFast=trace('legacy13-fast-lethal-before-adoption',{...fastSetup,options:{...fastSetup.options,rulesVersion:13}},
    fast.commands.filter(x=>x.type!=='PASS_KILL_REACTION'));
  assert(E.hunter(oldFast).inDream,'old replay preserves the lethal outcome');
}
function random(s){let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function mixSeed(seed){let x=seed>>>0||1;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return (x^(x>>>16))>>>0||1;}
const numeric=[];
for(const seed of [0,1,2,90,123,20261011,2147483648,4294967295]){let s={rng:mixSeed(seed)},values=[];for(let i=0;i<10;i++){random(s);values.push(s.rng);}
  s={rng:mixSeed(seed)};const shuffle=Array.from({length:12},(_,i)=>i);for(let i=shuffle.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[shuffle[i],shuffle[j]]=[shuffle[j],shuffle[i]];}
  numeric.push({seed,mixedSeed:mixSeed(seed),values,shuffle,shuffleFinalRng:s.rng});}
save('numeric-vectors.json',{format:'bloodborne-numeric-parity',schemaVersion:1,rng:numeric,
  geometry:Object.keys(G.tiles).flatMap(tileId=>Object.keys(G.tiles[tileId].spaces).flatMap(spaceId=>[-5,-1,0,1,2,3,4,9].map(rotation=>({tileId,spaceId,rotation,input:G.tiles[tileId].spaces[spaceId].point,point:G.point(tileId,spaceId,rotation),polygon:G.polygon(tileId,spaceId,rotation)}))))});
save('index.json',{format:'bloodborne-parity-index',schemaVersion:1,canonicalHash:'SHA-256 of UTF-8 JS canonical: sorted ordinal object keys; array order preserved; JSON.stringify scalars; absent differs from null',
  currentRulesVersion:E.create().setup.rulesVersion,historicalCampaignRulesVersion:13,referenceGameVersion:require('../MigrationPrivate/export-report.json').sourceGameVersion,traces:index,totalCommands:index.reduce((s,x)=>s+x.commands,0),
  uniqueCommandTypes:[...new Set(index.flatMap(item=>JSON.parse(fs.readFileSync(path.join(destination,item.file),'utf8')).commands.map(c=>c.type)))].sort(),
  status:'JS-generated-and-exact-replayed; C# full reducers pending'});
console.log(`Generated ${index.length} natural traces, ${index.reduce((s,x)=>s+x.commands,0)} commands; every final save exactly replayed.`);
module.exports={canonical,hash};
