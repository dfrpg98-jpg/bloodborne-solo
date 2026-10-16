'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const audit=path.resolve(__dirname,'..'),repo=path.resolve(__dirname,'../../../..');
const E=require(path.join(repo,'hunt-engine')),F=require(path.join(repo,'hunt-mission-feedback')),P=require(path.join(repo,'hunt-public-text')),D=require(path.join(repo,'campaigns/long-hunt/data.json'));
const read=f=>JSON.parse(fs.readFileSync(path.join(audit,f),'utf8')),q=read('fixtures/qa-setup.json'),results=read('results.json');
const outputs=[];
for(const run of results.runs){
 const commands=read(run.fixtures),proof=read(run.replay),expected=proof.events;let s=E.create(q.seed,q.setup.weaponId,q.setup.face,q.setup.startingConsumable,q.setup.firearmId,q.setup.startSpace,{campaign:true,qa:q.setup.qa,rulesVersion:q.setup.rulesVersion}),events=[];
 for(const [index,c]of commands.entries()){const before=s;s=E.dispatch(s,c);const e=F.describe(before,s,{E,publicText:P,data:D});if(e.length)events.push({step:index+1,chapter:s.mission.chapter,command:c,phase:s.phase,events:e});}
 assert.deepEqual(events,expected,run.id+' mission event replay');
 assert.equal(commands.length,260);assert.equal(s.result,'campaign-win');assert.equal(s.phase,'over');assert.equal(s.mission.chapter,3);assert.equal(s.mission.won,true);assert.deepEqual(s.rewardChoices,[]);assert.deepEqual(s.mission.history.map(x=>x.completed),[[7,11,4],[26,28,39,23]]);assert.deepEqual(s.mission.completed,[48,58,44]);E.assertState(s);
 const h=E.hunter(s),final={phase:s.phase,result:s.result,track:s.track,round:s.round,hp:h.hp,echoes:h.echoes,inDream:h.inDream,rewardChoices:s.rewardChoices,slots:h.slots,missionWon:s.mission.won};assert.deepEqual(final,proof.final,run.id+' final state');
 outputs.push({run:run.id,acceptedCommands:commands.length,notificationBatches:events.length,notificationEvents:events.reduce((n,x)=>n+x.events.length,0),final});
}
console.log(JSON.stringify({method:'Offline reproduction of actual-browser public commands; no browser operation and no private save output.',runs:outputs},null,2));
