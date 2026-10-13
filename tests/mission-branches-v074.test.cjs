const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),Mission=require('../mission-engine');
const C=require('../campaigns/long-hunt/data.json');
const H=E.hunter,clone=structuredClone;
const setups=require('./fixtures/v074-mission-natural-setups.json');
const fixtures={
 patient:require('./fixtures/v074-patient-natural-commands.json'),
 bridge:require('./fixtures/v074-bridge-natural-commands.json'),
 attack:require('./fixtures/v074-attack-iosefka-natural-commands.json'),
 help:require('./fixtures/v074-help-iosefka-natural-commands.json'),
 warning:require('./fixtures/v074-first-chapel-warning-natural-commands.json'),
 shelter:require('./fixtures/v074-shelter-natural-commands.json'),
 cull:require('./fixtures/v074-optional-55-natural-commands.json'),
 salvation:require('./fixtures/v074-optional-58-natural-commands.json'),
 supplies:require('./fixtures/v074-supplies-natural-commands.json'),
 clinicEscort:require('./fixtures/v074-clinic-escort-chapter-two-natural-commands.json'),
 earlyCull:require('./fixtures/v074-cull-before-release-natural-commands.json'),
 laterCull:require('./fixtures/v074-cull-later-release-natural-commands.json'),
 clinic52Locked:require('./fixtures/v074-clinic52-locked-natural-commands.json'),
 clinic51:require('./fixtures/v074-clinic51-natural-commands.json'),
};
function natural(commands,options={},setup={}){
 let s=E.create(setup.seed??90,setup.weaponId||'burial',setup.face??1,setup.startingConsumable??null,
  setup.firearmId||'hunter-pistol',setup.startSpace||'center',{campaign:true,...options});
 const revealed=new Set(),checkpoints=[];
 for(let i=0;i<commands.length;i++){
  const before=new Set(s.mission.revealed);s=E.dispatch(s,commands[i]);
  for(const n of s.mission.revealed)revealed.add(n);
  // Resume actual decisions/encounters rather than only an already-finished save.
  const fresh=s.mission.revealed.filter(n=>!before.has(n));
  if(fresh.some(n=>[9,10,14,30,31,32,35,36,37,38,39,46,47,48,49,50,51,52,54,55,56,57,58,59,60].includes(n))){
   assert.deepEqual(E.importSave(E.exportSave(s)),s);checkpoints.push({index:i,fresh,phase:s.phase});
  }
 }
 assert.deepEqual(E.importSave(E.exportSave(s)),s);
 return {s,revealed,checkpoints};
}
for(const rules of [{name:'released rules 11',options:{rulesVersion:11}},{name:'current campaign rules',options:{}}]){
 test(`${rules.name}: retained clinic sanctuary without research naturally opens card 51 after the chapter-two main victory`,()=>{
  const {s,revealed}=natural(fixtures.clinic51,rules.options,setups['v074-clinic51-natural-commands.json']);
  assert.deepEqual(s.mission.history[1].completed,[28,39,23]);
  assert.equal(s.mission.chapter,3);assert.equal(s.track,2);assert.equal(H(s).hp,3);
  assert([45,51].every(n=>revealed.has(n)));assert(!s.mission.revealed.some(n=>[46,52].includes(n)));
  assert.deepEqual(s.mission.completed,[]);assert(!s.mission.revealed.includes(25));
  assert.match(E.missionView(s).objectives.find(o=>o.id==='card-51').description,/진료소에서 재앙의 야수 처치/);
  assert.equal(H(s).position,'tile-20:entry');
 });
 test(`${rules.name}: retained research and chapel sanctuary naturally open the locked clinic 52 branch`,()=>{
  const {s,revealed}=natural(fixtures.clinic52Locked,rules.options,setups['v074-clinic52-locked-natural-commands.json']);
  assert.deepEqual(s.mission.history[1].completed,[26,34,23]);
  assert.equal(s.mission.chapter,3);assert.equal(s.track,1);assert.equal(H(s).hp,6);
  assert([45,52].every(n=>revealed.has(n)));assert(!s.mission.revealed.some(n=>[46,51].includes(n)));
  assert.equal(E.missionView(s).insight,0);assert.deepEqual(s.mission.completed,[]);
  assert.match(E.missionView(s).objectives.find(o=>o.id==='card-52').description,/완수할 수 없음/);
  // Card 34 remains owned across chapters and locks the clinic sanctuary.
  // This is a natural branch entrance, not a completion claim for card 52.
  assert.equal(s.mission.heldSurvivors[H(s).id]||0,0);assert.equal(s.mission.deposits.clinic,0);
 });
 test(`${rules.name}: chapter-one mercy naturally changes the chapel into a patient with two revivals`,()=>{
  const {s,revealed}=natural(fixtures.patient,rules.options);
  assert.deepEqual(s.mission.history[0].completed,[7,16,4]);
  assert([29,30,31,32].every(n=>revealed.has(n)));
  assert.equal(s.mission.targets.patient.initialTokens,2);assert.equal(s.mission.targets.patient.tokens,0);
  assert(s.mission.targets.patient.complete);assert.equal(s.phase,'mission_death');
  assert.equal(s.track,8);assert.equal(H(s).hp,3);
  assert.deepEqual(s.mission.completed,[32]);assert.equal(E.missionView(s).insight,1);
  assert(H(s).rewards.some(r=>r.kind==='rune-formless'));
  assert(!s.enemies.some(e=>e.missionId==='patient'));assert(!s.mission.fog.includes('tile-17'));
  // This trace used its last card to win. The printed optional death dodge is
  // therefore unavailable, and taking the real three damage enters the Dream.
  assert(E.missionActions(s).every(x=>x.command.type==='MISSION_DEATH_TAKE'));
  const settled=E.dispatch(s,{type:'KEEP_REWARD',rewardId:s.rewardChoices[0].rewardId});
  const after=E.dispatch(settled,{type:'MISSION_DEATH_TAKE'});
  assert.equal(H(after).hp,6);assert(H(after).inDream);
  // Death advances the Dream once and ends this solo round once.
  assert.equal(after.track,10);
  assert.equal(after.mission.completed.filter(n=>n===32).length,1);
  assert.deepEqual(E.importSave(E.exportSave(after)),after);
 });
 test(`${rules.name}: the optional house escort naturally opens 9/10 and completes shelter reward 11`,()=>{
  const {s,revealed}=natural(fixtures.shelter,rules.options);
  assert([8,9,10,11].every(n=>revealed.has(n)));assert(s.mission.targets.shelter.complete);
  assert.equal(s.mission.targets.shelter.tokens,0);assert.deepEqual(s.mission.completed,[7,11]);
  assert(!s.mission.fog.includes('tile-17'));assert(H(s).rewards.some(r=>r.kind==='rune-clawmark'));
  // This optional-objective trace stops after the reward. It is not a claim
  // that this particular, late-track strategy also wins the main chapter.
  assert(!s.mission.won);assert.equal(s.mission.chapter,1);
 });
 test(`${rules.name}: real bridge strikes remove its revival and leave an optional survivor rather than insight`,()=>{
  const {s,revealed}=natural(fixtures.bridge,rules.options);
  assert([35,36,37].every(n=>revealed.has(n)));
  assert.equal(s.mission.targets.bridge.tokens,0);assert(s.mission.targets.bridge.complete);
  assert.deepEqual(s.mission.completed,[]);assert.equal(E.missionView(s).insight,0);
  assert.equal(s.mission.escort.node,'tile-18:top');assert.equal(s.mission.escort.carrierId,null);
  assert(!s.mission.fog.includes('tile-18'));
 });
 test(`${rules.name}: attacking Iosefka naturally completes 48 with the supplied six-health NPC`,()=>{
  const {s,revealed}=natural(fixtures.attack,rules.options);
  assert([45,46,47,48].every(n=>revealed.has(n)));assert(!revealed.has(49));assert(!revealed.has(50));
  assert.deepEqual(s.mission.history[1].completed,[26,28,23]);
  assert.deepEqual(s.mission.completed,[48]);assert.equal(E.missionView(s).insight,1);
  assert.equal(s.track,7);assert.equal(H(s).hp,4);assert(!s.mission.fog.includes('tile-20'));
  assert(!s.enemies.some(e=>e.missionId==='iosefka'));assert(H(s).rewards.some(r=>r.kind==='augur'));
 });
 test(`${rules.name}: helping Iosefka naturally catches and delivers the survivor for 50`,()=>{
  const {s,revealed}=natural(fixtures.help,rules.options);
  assert([45,46,49,50].every(n=>revealed.has(n)));assert(!revealed.has(47));assert(!revealed.has(48));
  assert(fixtures.help.some(c=>c.type==='INTERACT'&&c.mission==='rescue'));
  assert(fixtures.help.some(c=>c.type==='MISSION_SURVIVOR_STEP'));
  assert(!fixtures.help.some(c=>c.type==='MISSION_SURVIVOR_EXPLORE'&&fixtures.help.indexOf(c)>277));
  assert.deepEqual(s.mission.completed,[50]);assert.equal(s.mission.survivor.node,null);
  assert.equal(s.mission.survivor.carrierId,null);assert(H(s).rewards.some(r=>r.kind==='augur'));
 });
  test(`${rules.name}: first chapel arrival follows its saved rule version for warning 39 and 56`,()=>{
  const {s}=natural(fixtures.warning,rules.options);
  const prefix=natural(fixtures.warning.slice(0,-1),rules.options).s;
  assert(!prefix.mission.revealed.includes(56));assert(!prefix.mission.completed.includes(39));
  assert.equal(prefix.mission.escort.carrierId,prefix.activeHunterId);
  assert.deepEqual(s.mission.completed,[39]);assert.equal(s.track,8);assert.equal(H(s).hp,3);
   assert(s.mission.revealed.includes(56));
   if(s.setup.rulesVersion>=13) {
    assert(s.mission.revealed.includes(57));assert(!s.mission.revealed.includes(33));
    assert(s.mission.revealed.indexOf(39)<s.mission.revealed.indexOf(56));
   } else {
    assert(s.mission.revealed.includes(33));assert(!s.mission.revealed.includes(57));
    assert(s.mission.revealed.indexOf(56)<s.mission.revealed.indexOf(39));
   }
  assert(!s.mission.completed.includes(38));assert.equal(s.mission.escort.carrierId,null);
  assert(H(s).ownedFirearms.includes('repeating-pistol'));assert(H(s).rewards.some(r=>r.kind==='old-hunter-bone'));
 });
 test(`${rules.name}: the real chapter-two bridge escort reaches the clinic for 38 and the main chapter can still finish`,()=>{
  const {s,revealed}=natural(fixtures.clinicEscort,rules.options);
  assert([35,36,37,38,34,23].every(n=>revealed.has(n)));
  assert.deepEqual(s.mission.completed,[38,34,23]);assert(s.mission.won);
  assert.equal(s.mission.chapter,2);assert.equal(s.mission.escort.node,null);
  assert.equal(s.mission.escort.carrierId,null);assert(!s.mission.completed.includes(39));
  assert(H(s).ownedFirearms.includes('repeating-pistol'));assert(H(s).rewards.some(r=>r.kind==='old-hunter-bone'));
 });
 test(`${rules.name}: three real scourge-beast kills complete the bridge cull and remove rule 43`,()=>{
  const {s,revealed}=natural(fixtures.cull,rules.options);
  assert([53,54,55,42,43].every(n=>revealed.has(n)));
  assert.deepEqual(s.mission.completed,[55]);assert.equal(s.mission.counters[54],0);
  assert(s.mission.discarded.includes(43));assert(H(s).rewards.some(r=>r.kind==='executioner-gloves'));
 });
 test(`${rules.name}: the chapel NPC follows public movement and its two real huntsman kills grant salvation 58`,()=>{
  const {s,revealed}=natural(fixtures.salvation,rules.options);
  assert([56,57,58].every(n=>revealed.has(n)));assert.deepEqual(s.mission.completed,[58]);
  assert.equal(s.mission.counters[57],0);assert.equal(s.mission.npc.node,null);
  assert.equal(s.mission.npc.follow,false);assert(H(s).rewards.some(r=>r.kind==='rune-hunter'));
  assert(fixtures.salvation.some(c=>c.type==='MISSION_NPC_FOLLOW'));
 });
 test(`${rules.name}: actual looted consumables are donated during the chapel window for supplies 60`,()=>{
  const {s,revealed}=natural(fixtures.supplies,rules.options);
  assert([56,59,60].every(n=>revealed.has(n)));assert.deepEqual(s.mission.history[1].completed,[38,34,23]);
  assert.deepEqual(s.mission.completed,[60]);assert.equal(s.mission.counters[59],0);
  assert(H(s).ownedFirearms.includes('flamesprayer'));assert(H(s).rewards.some(r=>r.kind==='empty-shell'));
  assert(fixtures.supplies.some(c=>c.type==='INTERACT'&&c.lootCount));
  assert(fixtures.supplies.some(c=>c.type==='MISSION_DONATE'));
 });
 test(`${rules.name}: a natural cull completed before the time release is retained for the later rule removal`,()=>{
  const {s,revealed}=natural(fixtures.earlyCull,rules.options);
  assert(revealed.has(55));assert(!revealed.has(42));assert(!revealed.has(43));
  assert.deepEqual(s.mission.completed,[55]);assert.equal(s.mission.counters[54],0);
  assert.equal(s.track,5);assert.equal(s.phase,'stun');
  const later=natural(fixtures.laterCull,rules.options).s;
  assert.equal(later.track,9);assert([42,43].every(n=>later.mission.revealed.includes(n)));
  assert([41,43].every(n=>later.mission.discarded.includes(n)));
  assert.deepEqual(later.mission.completed,[55]);
 });
}

// Isolated mission contracts below deliberately assemble retained outcomes.
// They cover source-card predicates, and are not natural playthrough evidence.
function helpers(){return {
 hunter:H,node:(_s,id)=>{const [tile,space]=id.split(':');return {tile,id,...C.tiles.find(x=>x.id===tile).spaces.find(x=>x.id===space)};},
 log:()=>{},need:(ok,message)=>assert(ok,message),spawnMission:()=>{},spawnNormal:()=>{},
 grant:(s,id)=>s.testGrants.push(id),drawConsumable:s=>s.testConsumables++,
 resume:s=>{s.phase='hunter';},missionActions:()=>[],
};}
function isolated(history,position){const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
 s.testGrants=[];s.testConsumables=0;s.enemies=[];H(s).position=position;
 Mission.init(s,helpers(),3,history);return s;
}
const profiles=[];
for(const mercy of [15,16])for(const sanctuary of [null,28,34])for(const research of [false,true])for(const bridge of [null,38,39])
 profiles.push({mercy,sanctuary,research,bridge});
for(const profile of profiles)test(`source branch contract ${JSON.stringify(profile)}`,()=>{
 const prior=[23,...(profile.sanctuary?[profile.sanctuary]:[]),...(profile.research?[26]:[]),...(profile.bridge?[profile.bridge]:[])];
 const history=[{chapter:1,completed:[7,profile.mercy,4],revealed:[]},{chapter:2,completed:prior,revealed:[]}];
 const expectedClinic=profile.sanctuary===28?(profile.research?46:51):profile.research?52:24;
 const expectedChapel=profile.bridge===39?57:profile.sanctuary===34?59:33;
 const expectedBridge=profile.bridge?54:35;
 for(const [position,want,alternatives] of [['tile-20:room',expectedClinic,[46,51,52,24]],['tile-17:top',expectedChapel,[57,59,33]],['tile-18:top',expectedBridge,[54,35]]]){
  const s=isolated(history,position);Mission.onMovementEnd(s,false,helpers());
  assert(s.mission.revealed.includes(want));
  assert(alternatives.filter(n=>n!==want).every(n=>!s.mission.revealed.includes(n)));
  assert.equal(Mission.insight(s),0);assert.deepEqual(s.mission.completed,[]);
 }
});
test('card 51 requires the clinic beast only and its visible objective does not request the obsolete huntsman prerequisite',()=>{
 const history=[{chapter:1,completed:[7,15,4],revealed:[]},{chapter:2,completed:[28,23],revealed:[]}];
 const s=isolated(history,'tile-20:room');Mission.onMovementEnd(s,false,helpers());
 const objective=Mission.view(s,helpers()).objectives.find(x=>x.id==='card-51');
 assert.equal(objective.description,'진료소에서 재앙의 야수 처치');
 assert(C.cards.find(c=>c.number===51).rules.every(x=>!x.includes('야수 사냥 무리')));
 Mission.onKill(s,{kind:'scourge-beast',node:'tile-20:room'},helpers());
 assert.deepEqual(s.mission.completed,[26]);assert.deepEqual(s.testGrants,['iosefka-vial']);assert.equal(s.testConsumables,1);
});
test('isolated card 52 collects and deposits two new survivors for card 28 without counting retained research as current insight',()=>{
 const history=[{chapter:1,completed:[7,15,4],revealed:[]},{chapter:2,completed:[26,38,23],revealed:[]}];
 const s=isolated(history,'tile-20:room');Mission.onMovementEnd(s,false,helpers());
 assert(s.mission.revealed.includes(52));assert.equal(Mission.insight(s),0);
 H(s).position='tile-13:middle';Mission.onLoot(s,H(s).position,2,helpers());
 assert.equal(s.mission.heldSurvivors[H(s).id],2);
 H(s).position='tile-20:room';Mission.onMovementEnd(s,false,helpers());
 assert.deepEqual(s.mission.completed,[28]);assert.equal(s.mission.deposits.clinic,2);
 assert.equal(s.mission.heldSurvivors[H(s).id],0);assert.equal(Mission.insight(s),1);
 assert.deepEqual(s.testGrants,['messengers-gift']);
});
test('isolated card 52 preserves the retained chapel lock through survivor collection and clinic movement end',()=>{
 const history=[{chapter:1,completed:[7,15,4],revealed:[]},{chapter:2,completed:[26,34,23],revealed:[]}];
 const s=isolated(history,'tile-20:room');Mission.onMovementEnd(s,false,helpers());
 assert(s.mission.revealed.includes(52));
 H(s).position='tile-13:middle';Mission.onLoot(s,H(s).position,2,helpers());
 assert.equal(s.mission.heldSurvivors[H(s).id]||0,0);
 H(s).position='tile-20:room';Mission.onMovementEnd(s,false,helpers());
 assert.deepEqual(s.mission.completed,[]);assert.equal(s.mission.deposits.clinic,0);
 assert.deepEqual(s.testGrants,[]);assert.equal(Mission.insight(s),0);
});
test('an unrelated mission figure cannot dereference an absent target or award an undefined card',()=>{
 const s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true}),before=clone(s);
 const def={basic:{speed:2,damage:2}},figure={kind:'scourge-beast',node:'tile-14:center',missionId:'unregistered'};
 assert.equal(Mission.targetDef(s,figure,def),def);assert.doesNotThrow(()=>Mission.onKill(s,figure,helpers()));
 assert.deepEqual(s,before);
});
