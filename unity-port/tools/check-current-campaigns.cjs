'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('./reference-source.cjs')('hunt-engine.js');
const source=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const folder=path.join(source,'tests/fixtures/weapon-campaign-completion');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const results=[];
for(const item of manifest.cases){
  const commands=JSON.parse(fs.readFileSync(path.join(folder,item.commandsFile),'utf8'));
  let s=E.create(item.seed,item.weaponId,item.startFace,null,item.initialFirearmId,item.startSpace,{campaign:true,rulesVersion:14}),passes=0;
  for(const [i,command]of commands.entries())try{
    const reactionUse=()=>command.type==='USE_REWARD'&&E.killReactionActions(s).some(x=>!x.disabled&&
      x.command.type==='USE_REWARD'&&x.command.rewardId===command.rewardId&&x.command.enemyId===command.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!reactionUse()){s=E.dispatch(s,{type:'PASS_KILL_REACTION'});passes++;}
    s=E.dispatch(s,command);
  }catch(error){throw Error(item.weaponId+' source command '+i+' '+command.type+' phase '+s.phase+': '+error.message);}
  while(s.phase==='kill_react'&&!s.rewardChoices.length){s=E.dispatch(s,{type:'PASS_KILL_REACTION'});passes++;}
  assert.equal(s.result,'campaign-win');assert.equal(s.mission.chapter,3);assert(E.hunter(s).hp>0);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  results.push({weaponId:item.weaponId,rulesVersion:14,originalCommands:commands.length,insertedReactionPasses:passes,acceptedCommands:s.commands.length,finalHp:E.hunter(s).hp});
}
const report={status:'passed',count:results.length,method:'original campaign commands plus recorded deliberate PASS_KILL_REACTION after pending rewards settle',results};
const output=path.resolve(__dirname,'../Validation/current14-campaigns-report.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('PASS '+results.length+' rules14 full campaigns, '+results.reduce((sum,x)=>sum+x.insertedReactionPasses,0)+' recorded reaction passes; every final save exactly replayed.');
