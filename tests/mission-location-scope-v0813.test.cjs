'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),Mission=require('../src/mission-engine');
const C=require('../campaigns/long-hunt/data.json');
const H=E.hunter,clone=structuredClone;
const command=(s,c)=>E.dispatch(s,c);
const run=(s,commands)=>commands.reduce(command,s);

// Real public command checkpoints are replayed once, without searching for paths.
const checkpoints=new Map();
for(const spec of [
 {file:'weapon-campaign-completion/beast-claw-0.json',points:[35],weapon:'beast-claw',face:0},
 {file:'v074-clinic-escort-chapter-two-natural-commands.json',points:[124,125],weapon:'burial',face:1},
 {file:'v074-help-iosefka-natural-commands.json',points:[317],weapon:'burial',face:1},
]) {
 let s=E.create(90,spec.weapon,spec.face,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
 const commands=require('./fixtures/'+spec.file);
 for(let i=0;i<Math.max(...spec.points);i++) {
  s=command(s,commands[i]);
  if(spec.points.includes(i+1))checkpoints.set(spec.file+'/'+(i+1),clone(s));
 }
}
const actual=(file,count)=>clone(checkpoints.get(file+'/'+count));
function house() {
 let s=E.create(14,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
 return run(s,[{type:'MOVE',cardId:H(s).hand[0].id},{type:'EXPLORE',edge:'N'},
  {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-11:house'}]);
}
function moveAway(s,to) {
 s=run(s,[{type:'MOVE',cardId:H(s).hand[0].id},{type:'STEP',node:to}]);
 return s.phase==='move'?command(s,{type:'STOP_MOVE'}):s;
}
function rejected(s,c,pattern) {
 const before=clone(s);assert.throws(()=>command(s,c),pattern);assert.deepEqual(s,before);
}

test('card08 engine pickup requires departure from the named house, not the street of that same tile',()=>{
 const before=house();assert.equal(before.mission.escort.node,'tile-11:house');
 const moving=run(before,[{type:'MOVE',cardId:H(before).hand[0].id},{type:'STEP',node:'tile-11:street'}]);
 assert.equal(moving.phase,'move');assert.equal(H(moving).position,'tile-11:street');
 assert(!E.missionActions(moving).some(a=>a.command.type==='MISSION_PICKUP'));
 rejected(moving,{type:'MISSION_PICKUP'},/민가 생존자 칸/);
 assert.equal(moving.mission.escort.node,'tile-11:house');assert.equal(moving.mission.escort.carrierId,null);
});

test('card12 rescue interaction rejects the entry cell while accepting its actual room cell',()=>{
 const same=actual('weapon-campaign-completion/beast-claw-0.json',35);
 assert.equal(H(same).position,'tile-03:room');assert.equal(same.mission.survivor.node,'tile-03:room');
 assert.equal(E.interactionOptions(same).missionRescue,true);
 const allowed=command(same,{type:'INTERACT',cardId:H(same).hand[0].id,mission:'rescue'});
 assert.equal(H(allowed).hand.length,H(same).hand.length-1,'ordinary interaction pays one actual hand card');
 const entry=moveAway(same,'tile-03:entry');assert.equal(entry.phase,'hunter');
 assert.equal(E.interactionOptions(entry).missionRescue,false);
 rejected(entry,{type:'INTERACT',cardId:H(entry).hand[0].id,mission:'rescue'},/같은 칸의 구조 토큰/);
});

test('card37 free pickup rejects the lower bridge cell and becomes legal only in the named upper cell',()=>{
 const other=actual('v074-clinic-escort-chapter-two-natural-commands.json',124);
 assert.equal(H(other).position,'tile-18:bottom');assert.equal(other.mission.escort.node,'tile-18:top');
 rejected(other,{type:'MISSION_PICKUP'},/호위 생존자 칸/);
 const same=actual('v074-clinic-escort-chapter-two-natural-commands.json',125);
 assert.equal(H(same).position,'tile-18:top');
 const selected=command(same,{type:'MISSION_PICKUP'});
 assert.equal(selected.mission.escort.pickup,true);assert.equal(selected.mission.escort.carrierId,null);
 assert.equal(H(selected).hand.length,H(same).hand.length);assert.equal(selected.move.remaining,same.move.remaining);
});

test('card49 captured survivor requires same-cell INTERACT, not another Central Lamp tile cell',()=>{
 const same=actual('v074-help-iosefka-natural-commands.json',317);
 assert.equal(H(same).position,'tile-14:center');assert.equal(same.mission.survivor.card,49);
 assert.equal(E.interactionOptions(same).missionRescue,true);
 const captured=command(same,{type:'INTERACT',cardId:H(same).hand[0].id,mission:'rescue'});
 assert.equal(captured.mission.survivor.carrierId,captured.activeHunterId);
 assert.equal(captured.mission.survivor.node,null);assert.equal(H(captured).hand.length,H(same).hand.length-1);
 const other=moveAway(same,'tile-14:left');assert.equal(other.phase,'hunter');
 assert.equal(E.interactionOptions(other).missionRescue,false);
 rejected(other,{type:'INTERACT',cardId:H(other).hand[0].id,mission:'rescue'},/같은 칸의 구조 토큰/);
});

// Isolated source-card predicate contracts: these are mission-hook unit inputs,
// not claimed to be naturally played/exportable engine saves. Only spatial
// predicates and hook outcomes are exercised. Cards18/21/41 follow the explicit
// user adjudication recorded below, rather than an asserted official clarification.
function node(_s,id) {
 const [tile,space]=id.split(':'),t=C.tiles.find(t=>t.id===tile),n=t?.spaces.find(n=>n.id===space);
 assert(n,'known source-card space '+id);return {...n,id,tile};
}
function neighbors(s,id) {
 const tile=id.split(':')[0],t=C.tiles.find(t=>t.id===tile);
 return t.adjacency.filter(e=>e.includes(id.split(':')[1])).map(e=>tile+':'+e.find(x=>x!==id.split(':')[1]));
}
function distance(s,from,to) {
 const queue=[[from,0]],seen=new Set([from]);
 for(const [id,n] of queue){if(id===to)return n;for(const next of neighbors(s,id))if(!seen.has(next)){seen.add(next);queue.push([next,n+1]);}}
 return Infinity;
}
function helpers() {return {
 hunter:H,node,neighbors,distance,need:(ok,msg)=>assert(ok,msg),log:(s,msg)=>s.testLog.push(msg),
 spawnMission:(s,t)=>s.spawnQueue.push({kind:t.kind,node:t.node,missionId:t.id,...(t.componentId?{componentId:t.componentId}:{})}),
 spawnNormal:(s,kind,node,extra)=>s.spawnQueue.push({kind,node,...extra}),
 grant:(s,id)=>s.testGrants.push(id),drawConsumable:s=>s.testDraws++,
 resume:s=>{s.phase='hunter';},missionActions:()=>[],openExits:()=>[],
};}
const help=helpers();
function contract(chapter,position,history=[]) {
 const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
 s.testLog=[];s.testGrants=[];s.testDraws=0;s.enemies=[];s.spawnQueue=[];
 H(s).position=position;Mission.init(s,help,chapter,history);return s;
}
const prior=completed=>[{chapter:1,completed:[4,7,15],revealed:[]},{chapter:2,completed,revealed:[]}];
function endAt(s,at){H(s).position=at;Mission.onMovementEnd(s,false,help);return s;}
function kills(s,kind,at){Mission.onKill(s,{kind,node:at},help);}
function spawned(s,id){const job=s.spawnQueue.find(j=>j.missionId===id);assert(job,'mission spawn '+id);return job;}
function resetNode(s,id){const job=Mission.reset(s,help).find(j=>j.missionId===id);assert(job,'mission reset '+id);return job.node;}

test('card57 NPC starts at the lamp cell, follows only from its exact node and counts kills only at its new node',()=>{
 const s=contract(3,'tile-17:lower-left',prior([23,39]));endAt(s,H(s).position);
 assert.equal(s.mission.npc.node,'tile-17:top');assert(s.mission.revealed.includes(57));
 s.phase='move';assert.throws(()=>Mission.dispatch(s,{type:'MISSION_NPC_FOLLOW'},help),/NPC 칸/);
 H(s).position='tile-17:top';Mission.dispatch(s,{type:'MISSION_NPC_FOLLOW'},help);
 Mission.onStep(s,'tile-17:top','tile-17:lower-right',help);assert.equal(s.mission.npc.node,'tile-17:lower-right');
 const count=s.mission.counters[57];kills(s,'huntsman-mob','tile-17:top');assert.equal(s.mission.counters[57],count);
 kills(s,'huntsmans-minion','tile-17:lower-right');assert.equal(s.mission.counters[57],count-1);
 assert(!s.mission.completed.includes(58));
});

test('cards24/25 use the clinic tile for kills, including its entry cell, but reject kills on another tile',()=>{
 for(const at of ['tile-20:entry','tile-20:room']) {
  const s=contract(2,at);endAt(s,at);assert(s.mission.revealed.includes(24));
  kills(s,'huntsmans-minion','tile-14:center');assert(!s.mission.revealed.includes(25));
  kills(s,'huntsmans-minion',at);assert(s.mission.revealed.includes(25));assert(s.mission.revealed.includes(27));
  kills(s,'scourge-beast','tile-14:center');assert(!s.mission.completed.includes(26));
  kills(s,'scourge-beast',at);assert(s.mission.completed.includes(26));assert(s.testGrants.includes('iosefka-vial'));
 }
});

test('card27 collects only at a consumable symbol cell and deposits on clinic entry movement end',()=>{
 const s=contract(2,'tile-20:entry');endAt(s,H(s).position);kills(s,'huntsman-mob','tile-20:entry');
 Mission.onLoot(s,'tile-13:bottom',2,help);assert.equal(s.mission.heldSurvivors[s.activeHunterId]||0,0);
 Mission.onLoot(s,'tile-13:middle',2,help);assert.equal(s.mission.heldSurvivors[s.activeHunterId],2);
 endAt(s,'tile-14:left');assert.equal(s.mission.deposits.clinic,0);assert.equal(s.mission.heldSurvivors[s.activeHunterId],2);
 endAt(s,'tile-20:entry');assert.equal(s.mission.deposits.clinic,2);assert.equal(s.mission.heldSurvivors[s.activeHunterId],0);
 assert(s.mission.completed.includes(28));
});

test('card33 accepts sanctuary delivery in either lower chapel cell as well as its lamp cell',()=>{
 for(const at of ['tile-17:lower-left','tile-17:lower-right','tile-17:top']) {
  const s=contract(2,at);endAt(s,at);assert(s.mission.revealed.includes(33));
  Mission.onLoot(s,'tile-18:bottom',1,help);assert.equal(s.mission.heldSurvivors[s.activeHunterId]||0,0);
  Mission.onLoot(s,'tile-13:middle',2,help);endAt(s,'tile-14:right');assert.equal(s.mission.deposits.chapel,0);
  endAt(s,at);assert.equal(s.mission.deposits.chapel,2);assert(s.mission.completed.includes(34));
 }
});

test('card37 delivery is tile-wide for clinic entry and both lower chapel cells, but not an unrelated lamp',()=>{
 for(const [at,reward] of [['tile-20:entry',38],['tile-17:lower-left',39],['tile-17:lower-right',39]]) {
  const s=contract(2,'tile-18:bottom');s.mission.revealed.push(37);
  Object.assign(s.mission.escort,{node:null,carrierId:s.activeHunterId,home:'tile-18:top'});
  endAt(s,'tile-14:center');assert.equal(s.mission.escort.carrierId,s.activeHunterId);assert(!s.mission.completed.includes(reward));
  endAt(s,at);assert(s.mission.completed.includes(reward));assert.equal(s.mission.escort.carrierId,null);assert.equal(s.mission.escort.node,null);
 }
});

test('card49 carried survivor delivers on clinic entry movement end, not another named tile',()=>{
 const s=contract(3,'tile-14:center',prior([23,26]));
 Object.assign(s.mission.survivor,{card:49,node:null,carrierId:s.activeHunterId});
 endAt(s,'tile-17:lower-left');assert.equal(s.mission.survivor.carrierId,s.activeHunterId);assert(!s.mission.completed.includes(50));
 endAt(s,'tile-20:entry');assert(s.mission.completed.includes(50));assert.equal(s.mission.survivor.carrierId,null);assert(s.testGrants.includes('augur'));
});

test('card51 research accepts a beast killed at clinic entry without reviving its obsolete huntsman prerequisite',()=>{
 const s=contract(3,'tile-20:entry',prior([23,28]));endAt(s,H(s).position);assert(s.mission.revealed.includes(51));
 kills(s,'scourge-beast','tile-14:center');assert(!s.mission.completed.includes(26));
 kills(s,'scourge-beast','tile-20:entry');assert(s.mission.completed.includes(26));assert(!s.mission.revealed.includes(25));
});

test('card52 collection and sanctuary completion remain available at clinic entry despite retained research',()=>{
 const s=contract(3,'tile-20:entry',prior([23,26,38]));endAt(s,H(s).position);assert(s.mission.revealed.includes(52));
 Mission.onLoot(s,'tile-13:middle',2,help);assert.equal(s.mission.heldSurvivors[s.activeHunterId],2);
 endAt(s,'tile-14:right');assert.equal(s.mission.deposits.clinic,0);
 endAt(s,'tile-20:entry');assert(s.mission.completed.includes(28));assert.equal(s.mission.deposits.clinic,2);
 assert.equal(s.mission.heldSurvivors[s.activeHunterId],0);assert(s.testGrants.includes('messengers-gift'));
});

test('card59 immediate donation window opens after movement ends in either lower chapel cell',()=>{
 for(const at of ['tile-17:lower-left','tile-17:lower-right']) {
  const s=contract(3,at,prior([23,34]));H(s).consumables=[s.consumableDeck.shift(),s.consumableDeck.shift()];
  endAt(s,at);assert(s.mission.revealed.includes(59));assert.equal(s.mission.donationWindow,true);
  const count=s.mission.counters[59],first=H(s).consumables[0];
  Mission.dispatch(s,{type:'MISSION_DONATE',itemId:first.id},help);assert.equal(s.mission.counters[59],count-1);
  assert(s.consumableDiscard.some(x=>x.id===first.id));
  endAt(s,'tile-14:center');assert.equal(s.mission.donationWindow,false);
  assert.throws(()=>Mission.dispatch(s,{type:'MISSION_DONATE',itemId:H(s).consumables[0].id},help),/예배당에서 이동을 마친 직후/);
  assert.equal(s.mission.counters[59],count-1);
 }
});

test('card05 yard encounter starts and resets on the central lamp symbol cell when arrival ends on a side cell',()=>{
 const s=contract(1,'tile-04:left');endAt(s,H(s).position);
 assert.equal(spawned(s,'mob').node,'tile-04:center');assert.equal(resetNode(s,'mob'),'tile-04:center');
 assert(s.mission.fog.includes('tile-04'));
});

test('card20 initial and reset spawn use the cemetery red symbol cell, independently of the arriving hunter cell',()=>{
 const s=contract(2,'tile-13:bottom');s.mission.revealed.push(19);s.mission.completed.push(26,28);endAt(s,H(s).position);
 assert.equal(spawned(s,'main').node,'tile-13:middle');assert.equal(resetNode(s,'main'),'tile-13:middle');
 assert.equal(spawned(s,'main').componentId,'cleric-beast');
});

test('card30 patient spawn and reset use the upper chapel lamp cell even after movement to a lower cell',()=>{
 const s=contract(2,'tile-17:lower-left',[{chapter:1,completed:[4,16],revealed:[]}]);endAt(s,H(s).position);
 const job=spawned(s,'patient');assert.equal(job.node,'tile-17:top');assert.equal(job.componentId,'female-patient');
 const e={id:'patient',missionId:'patient',node:'tile-17:lower-right'};
 Mission.onEnemyStep(s,e,'tile-17:top',e.node,help);assert.equal(resetNode(s,'patient'),'tile-17:top');
});

test('card35 bridge minion starts and resets at the upper purple symbol, not the lower arrival cell',()=>{
 const s=contract(2,'tile-18:bottom');endAt(s,H(s).position);
 assert.equal(spawned(s,'bridge').node,'tile-18:top');assert.equal(spawned(s,'bridge').kind,'huntsmans-minion');
 const e={id:'bridge',missionId:'bridge',node:'tile-18:bottom'};
 Mission.onEnemyStep(s,e,'tile-18:top',e.node,help);assert.equal(resetNode(s,'bridge'),'tile-18:top');
});

test('card40 initial boss placement is the lower crypt lamp symbol rather than its named upper cell',()=>{
 const s=contract(3,'tile-14:center',prior([23]));const job=spawned(s,'main');
 assert.equal(job.node,'tile-19:bottom');assert.equal(job.componentId,'cleric-beast');
 // This checks card40 initial placement; card41 is tested under the user ruling below.
});

test('card47 Iosefka spawns and resets at the clinic room lamp symbol after the choice made on clinic entry',()=>{
 const s=contract(3,'tile-20:entry',prior([23,26,28]));endAt(s,H(s).position);
 assert.equal(s.phase,'mission_choice');assert.equal(s.mission.choice,'iosefka');
 Mission.dispatch(s,{type:'MISSION_CHOICE',choice:'attack-iosefka'},help);
 assert.equal(spawned(s,'iosefka').node,'tile-20:room');assert.equal(spawned(s,'iosefka').componentId,'iosefka');
 const e={id:'iosefka',missionId:'iosefka',node:'tile-20:entry'};
 Mission.onEnemyStep(s,e,'tile-20:room',e.node,help);assert.equal(resetNode(s,'iosefka'),'tile-20:room');
});

// Project adjudication (2026-10-13): the user explicitly selected the existing
// whole-tile interpretation for cards18,21,41. Korean text omits the unit and
// no direct official clarification was obtained; these are approved project
// rules, not claims that the publisher resolved that ambiguity.
for(const at of ['tile-13:top','tile-13:middle','tile-13:bottom'])
 test(`user ruling card18 accepts corpse donation from every Graveyard cell: ${at}`,()=>{
  const s=contract(2,at);s.mission.heldCorpses[s.activeHunterId]=1;
  assert(Mission.actions(s,help).some(a=>a.command.type==='MISSION_CORPSES'&&a.command.count===1));
  Mission.dispatch(s,{type:'MISSION_CORPSES',count:1},help);
  assert.equal(s.mission.deposits.corpses,1);assert.equal(s.mission.heldCorpses[s.activeHunterId],0);
  assert(!s.mission.revealed.includes(19));
 });

test('user ruling card18 rejects corpse donation from a different tile and preserves held tokens',()=>{
 const s=contract(2,'tile-14:center');s.mission.heldCorpses[s.activeHunterId]=1;
 assert(!Mission.actions(s,help).some(a=>a.command.type==='MISSION_CORPSES'));
 const before=clone(s);assert.throws(()=>Mission.dispatch(s,{type:'MISSION_CORPSES',count:1},help),/공동묘지/);
 assert.deepEqual(s,before);
});

function fleeingCleric() {
 const s=contract(2,'tile-13:middle');s.mission.revealed.push(19);s.mission.completed.push(26,28);
 endAt(s,H(s).position);
 const e={id:'mission-main',missionId:'main',componentId:'cleric-beast',node:'tile-13:middle',componentPhase:2};
 s.enemies.push(e);Mission.onBossPhase(s,e,2,help);
 assert(s.mission.revealed.includes(21));assert(s.mission.revealed.includes(22));
 return {s,e};
}
for(const at of ['tile-19:bottom','tile-19:top'])
 test(`user ruling card21 completes arrival in either Crypt cell: ${at}`,()=>{
  const {s,e}=fleeingCleric();
  Mission.onEnemyStep(s,e,e.node,'tile-14:center',help);assert(!s.mission.completed.includes(23));
  Mission.onEnemyStep(s,e,'tile-14:center',at,help);assert(s.mission.completed.includes(23));
  assert.equal(s.mission.won,true);assert.equal(s.testGrants.filter(id=>id==='beast-roar').length,1);
  Mission.onEnemyStep(s,e,at,at==='tile-19:bottom'?'tile-19:top':'tile-19:bottom',help);
  assert.equal(s.testGrants.filter(id=>id==='beast-roar').length,1,'arrival rewards are not granted twice');
 });

test('user ruling card21 does not complete on another named location or lamp cell',()=>{
 const {s,e}=fleeingCleric();
 for(const at of ['tile-14:center','tile-17:top','tile-20:room']) {
  Mission.onEnemyStep(s,e,e.node,at,help);assert(!s.mission.completed.includes(23));
 }
 assert.equal(s.mission.won,false);
});

test('user ruling card41 blocks both Crypt cells, including its lower boss lamp cell',()=>{
 const s=contract(3,'tile-14:center',prior([23]));assert(s.mission.revealed.includes(41));
 for(const at of ['tile-19:bottom','tile-19:top'])assert.equal(Mission.canEnter(s,H(s).position,at),false);
 assert.equal(Mission.canEnter(s,H(s).position,'tile-14:left'),true);
 assert.equal(spawned(s,'main').node,'tile-19:bottom');
});

test('user ruling card41 releases both Crypt cells when the confinement rule ends',()=>{
 const s=contract(3,'tile-14:center',prior([23]));s.track=9;Mission.onTrackChange(s,help);
 assert(s.mission.discarded.includes(41));assert(!s.mission.fog.includes('tile-19'));
 for(const at of ['tile-19:bottom','tile-19:top'])assert.equal(Mission.canEnter(s,H(s).position,at),true);
});
