'use strict';
const M=require('../../chapter-engine');
const assert=require('node:assert/strict'),E=require('../../hunt-engine'),U=require('../../hunt-map-controls'),Departure=require('../../hunt-departure');
const inputs=require('../../docs/audits/map-motion-ui-qa-v0.8.13-dev.6/fixtures/model-inputs.json');
const qa={preset:'custom',startRewards:[],startConsumables:[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')]};
function ruling(s){for(const key of ['applyChapelRuling','applyCombatReactionRuling','applyTileSpeedRuling'])if(E[key])s=E[key](s);return s;}
function pub(s){const h=E.hunter(s);return{combat:s.combat?{enemyId:s.combat.enemyId,action:s.combat.action,attack:s.combat.attack,extra:s.combat.extra}:null,phase:s.phase,result:s.result,lastRound:s.lastRound,round:s.round,track:s.track,revision:s.revision,weaponId:h.weaponId,face:h.face,hp:h.hp,position:h.position,hand:h.hand.map(c=>({id:c.id,kind:c.kind})),deckCount:h.deck.length,discard:h.discard.map(c=>c.id),slots:h.slots.map(c=>c?{id:c.id,kind:c.kind,faceDown:!!c.faceDown}:null),echoes:h.echoes,firearmReady:h.firearmReady,consumables:h.consumables.map(x=>({id:x.id,kind:x.kind})),charge:h.weaponCharge||null,moveActions:h.moveActionsRound||0,enemies:s.enemies.map(e=>({id:e.id,node:e.node,hp:e.hp})),pending:{freeTransform:!!s.freeTransform,weaponEffects:s.weaponEffects?.map(q=>({kind:q.kind,remaining:q.remaining,damage:q.damage,enemyId:q.enemyId}))||[],weaponAfter:!!s.weaponAfter,weaponMoveReturn:!!s.weaponMoveReturn,move:!!s.move,combat:!!s.combat,rewardChoices:s.rewardChoices?.length||0}};}
function original(weapon,face,stage='beforeCombat'){
 const p=inputs.profiles.find(p=>p.weaponId===weapon&&p.setup.face===face);assert(p);const q=p.setup;
 let s=E.create(q.seed,q.weaponId,q.face,q.startingConsumable,q.firearmId,q.startSpace,q.options);
 const commands=[...p.preparationCommands];if(stage!=='beforeWalk')commands.push(...p.checkpoints.beforeWalk.nextCommands,...p.chaseResponses,{type:'USE_CONSUMABLE',itemId:'item-qa-1-11'},...p.checkpoints.beforeTransform.nextCommands);
 for(const c of commands)s=E.dispatch(s,c);return{s,setup:q,preparationCommands:commands,source:`original model-inputs: ${weapon}/face${face}/${stage}`};
}
function trace(file,length){const weapon=file.replace(/-[01]$/,''),face=+file.slice(-1),gun=E.data.weapons[weapon].defaultFirearm||'hunter-pistol';
 const setup={seed:90,weaponId:weapon,face,startingConsumable:null,firearmId:gun,startSpace:'center',options:{campaign:true,rulesVersion:14,qa}};
 let s=E.create(90,weapon,face,null,gun,'center',setup.options);const commands=[];
 for(const c of require('../../tests/fixtures/weapon-campaign-completion/'+file+'.json').slice(0,length)){
  while(s.phase==='kill_react'&&!s.rewardChoices.length){try{E.dispatch(s,c);break;}catch{const pass={type:'PASS_KILL_REACTION'};s=E.dispatch(s,pass);commands.push(pass);}}
  s=E.dispatch(s,c);commands.push(c);
 }assert.deepEqual(E.importSave(E.exportSave(s)),s);return{s,setup,preparationCommands:commands,source:`normal campaign fixture ${file}.json prefix ${length}, legitimate rules14 reaction passes`};
}
function build(spec){const initial=spec.fixture?trace(spec.fixture,spec.prefix):original(spec.weapon,spec.face,spec.startStage),checkpoint=initial.s;let s=ruling(checkpoint);const steps=[],pushCounts=new Map();let weaponSteps=0,choiceCount=0;
 const add=(command,stage='effect-branch',screenshot)=>{const before=pub(s),decision=Departure.plan(E,s,[command]),batch=decision?(spec.escortAccept?decision.acceptCommands:decision.declineCommands):[command];for(const c of batch)s=E.dispatch(s,c);s=ruling(s);steps.push({command,expectedBatch:batch,escortChoice:decision?(spec.escortAccept?'accept':'decline'):null,stage,screenshot,before,after:pub(s)});return s;};
 const valid=c=>{try{E.dispatch(s,c);return true;}catch{return false;}};
 const heal=()=>{const item=E.hunter(s).consumables.find(x=>x.kind==='qa-heal');if(E.hunter(s).hp<6&&item)add({type:'USE_CONSUMABLE',itemId:item.id},'explicit-qa-heal');};
 const replenish=()=>{const item=E.hunter(s).consumables.find(x=>x.kind==='qa-cards');if(!item)throw Error('No legitimate QA hand supply');add({type:'USE_CONSUMABLE',itemId:item.id},'explicit-qa-hand-and-clear');settle('hand-clear-followups');};
 function settle(stage='effect-followups',options={}){for(let n=0;n<140;n++){
  const h=E.hunter(s);let c;
  if(s.rewardChoices?.length){const q=s.rewardChoices[0];c=q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId};}
  else if(s.phase==='hunter')return;
  else switch(s.phase){
   case'combat_react':case'boss_react':c={type:'RESOLVE'};break;
   case'combat_choose':c={type:'NO_ATTACK'};break;
   case'combat_extra':c={type:'EXTRA_TAKE'};break;
   case'free_transform':c={type:'FREE_TRANSFORM',accept:spec.accept===true};break;
   case'weapon_choice':{const choices=E.weaponChoices(s).filter(x=>!x.disabled),q=s.weaponEffects[0];
    if(q.kind==='push'){const count=pushCounts.get(q.enemyId)||0,limit=spec.pushDistance||0;c=(count<limit?choices.find(x=>x.command.node):choices.find(x=>x.command.stop))?.command||choices[0]?.command;if(c?.node)pushCounts.set(q.enemyId,count+1);}
    else{const target=spec.targets?.[choiceCount++]||spec.target;c=(choices.find(x=>x.command.enemyId===target)||choices.find(x=>x.command.enemyId&&s.enemies.find(e=>e.id===x.command.enemyId)?.hp>q.damage)||choices[0])?.command;}break;}
   case'weapon_entry':if(spec.entryAccept&&h.hand.length&&h.slots.some(x=>!x))c={type:'ENTRY_WEAPON',accept:true,cardId:h.hand[0].id,slot:h.slots.findIndex(x=>!x)};else c={type:'ENTRY_WEAPON',accept:false};break;
   case'firearm_react':c={type:'FIREARM_ENTRY',accept:false};break;
   case'reward_entry':c={type:'ENTRY_REWARD',accept:false};break;
   case'kill_react':c={type:'PASS_KILL_REACTION'};break;
   case'move':if(s.move?.source==='weapon'&&weaponSteps<(spec.weaponMoveDistance||0)){const nodes=E.neighbors(s,h.position);c=nodes.map(node=>({type:'STEP',node})).find(valid);if(c)weaponSteps++;}c||={type:'STOP_MOVE'};break;
   case'enemy_path':c={type:'ENEMY_STEP',node:E.moveOptions(s)[0]};break;
   case'boss_move':c={type:'BOSS_STEP',node:E.bossMoveOptions(s)[0]};break;
   case'activation':c={type:'ACTIVATE',enemyId:E.eligible(s)[0]?.id};break;
   case'cheap_shot':c={type:'CHEAP_SHOT'};break;
   case'stun':c={type:'STUN_DISCARD',cardId:h.hand[0]?.id};break;
   case'card_choice':{const q=s.cardChoices[0];c={type:'CARD_CHOICE',value:q.type==='discard'?h.hand[0]?.id:q.type==='status'?Object.keys(h.status).find(k=>h.status[k]):h.slots.findIndex(Boolean)};break;}
   case'ability_choice':c={type:'ABILITY_CHOICE'};break;
   case'spawn_choice':c={type:'SPAWN_CHOICE',node:s.spawnChoices[0]};break;
   case'tile_place':c=[0,1,2,3].map(rotation=>({type:'PLACE_TILE',rotation})).find(valid);break;
   case'refill':c={type:'REFILL',discardIds:[]};break;
   case'upgrade_pick':c={type:'PICK_UPGRADE',index:s.market.findIndex(Boolean)};break;
   case'upgrade_replace':c={type:'REPLACE_UPGRADE'};break;
   case'return':c={type:'RETURN',node:E.nodes(s).find(n=>n.lamp)?.id,face:h.face};break;
   case'between_chapters':c={type:'START_NEXT_CHAPTER',startSpace:'center',face:h.face};break;
   case'over':if(s.result==='chapter-win')c={type:'ENTER_BETWEEN_CHAPTERS'};else return;break;
   default:c=(E.missionActions(s).find(x=>x.command.choice==='release')||E.missionActions(s).find(x=>x.command.type==='MISSION_DEATH_TAKE')||E.missionActions(s)[0])?.command;
  }assert(c,`Unhandled ${spec.id}/${s.phase}`);add(c,stage);
 }throw Error('Followups exceeded bounded normal choices '+spec.id);}
 function attack(target,slot,card,extras={}){if(!E.hunter(s).hand.length)replenish();card||=E.hunter(s).hand[0].id;slot??=E.hunter(s).slots.findIndex(x=>!x);target||=s.enemies.find(e=>e.node===E.hunter(s).position)?.id;assert(target,'No legal attack target');add({type:'ATTACK',cardId:card,slot,enemyId:target,...extras},'representative-attack');settle();}
 function walk(node,stage='next-movement'){if(!E.hunter(s).hand.length)replenish();add({type:'MOVE',cardId:E.hunter(s).hand[0].id},stage);add({type:'STEP',node},stage);if(s.phase==='move')add({type:'STOP_MOVE'},'next-pursuit');settle('next-movement-followups');}
 function next(){settle();if(s.phase==='over')return;assert.equal(s.phase,'hunter');heal();if(!E.hunter(s).hand.length)replenish();
  const h=E.hunter(s),step=E.neighbors(s,h.position).map(node=>({type:'STEP',node}));let card=h.hand[0].id;
  add({type:'MOVE',cardId:card},'next-movement');let chosen=step.find(c=>{try{const n=E.dispatch(s,c);return n.phase==='move';}catch{return false;}})||step.find(valid);assert(chosen,'No legal following step');add(chosen,'next-movement');if(s.phase==='move')add({type:'STOP_MOVE'},'next-pursuit');settle('next-movement-followups');
  // Find a real enemy without inserting one. Explore normally if a chain killed all.
  for(let tries=0;tries<30&&!s.enemies.some(e=>e.node===E.hunter(s).position);tries++){
   if(!E.hunter(s).hand.length)replenish();heal();add({type:'MOVE',cardId:E.hunter(s).hand[0].id},'legitimate-target-search');
   for(let i=0;i<10&&s.phase==='move';i++){
    const position=E.hunter(s).position,enemy=[...s.enemies].filter(e=>Number.isFinite(E.distance(s,position,e.node))).sort((a,b)=>E.distance(s,position,a.node)-E.distance(s,position,b.node))[0];
    const options=U.movement(s).directions.flatMap(d=>d.options).filter(o=>o.enabled);
    const goal=enemy?.node||M.openExits(s.world).sort((a,b)=>E.distance(s,position,a.node)-E.distance(s,position,b.node))[0]?.node;
    const explore=options.find(o=>o.command.type==='EXPLORE'),toward=options.filter(o=>o.command.type==='STEP').sort((a,b)=>goal?E.distance(s,a.command.node,goal)-E.distance(s,b.command.node,goal):0)[0];
    const command=(enemy?toward:explore||toward)?.command;if(!command)break;add(command,'legitimate-target-search');if(s.phase!=='move')settle('exploration-followups');
    if(s.enemies.some(e=>e.node===E.hunter(s).position))break;
   }if(s.phase==='move')add({type:'STOP_MOVE'},'target-search-stop');settle('target-search-followups');
  }
  assert(s.enemies.some(e=>e.node===E.hunter(s).position),'No naturally encountered following target '+JSON.stringify({position:E.hunter(s).position,enemies:s.enemies.map(e=>[e.id,e.node]),tail:steps.slice(-8).map(x=>x.command)}));
  if(!E.hunter(s).hand.length)replenish();if(!E.hunter(s).slots.some(x=>!x)){if(E.hunter(s).hand.length<2)replenish();add({type:'TRANSFORM',cardId:E.hunter(s).hand[0].id},'paid-slot-preparation');settle('paid-slot-followups');}
  attack();assert.equal(s.phase,'hunter');assert(!s.combat&&!s.move&&!s.weaponAfter&&!s.weaponEffects&&!s.weaponMoveReturn&&!s.freeTransform&&!s.rewardChoices.length,'Unresolved following callback');
 }
 const api={add,settle,attack,heal,replenish,walk,next,get:()=>s};spec.run(api);settle();const effectCompleted=pub(s);if(steps.length)steps.at(-1).effectCompleted=true;if(spec.next!==false)next();assert.deepEqual(E.importSave(E.exportSave(s)),s);
 return{...spec,weapon:E.hunter(checkpoint).weaponId,face:E.hunter(checkpoint).face,setup:initial.setup,preparationCommands:initial.preparationCommands,source:initial.source,checkpoint,steps,effectCompleted,final:pub(s)};
}
function definitions(){const cases=[],put=(spec)=>cases.push(spec),base=(weapon,face)=>({weapon,face});
 const three=a=>{a.add({type:'USE_CONSUMABLE',itemId:'item-qa-1-22'},'normal-three-enemy-preparation');a.add({type:'EXPLORE',edge:'N'},'normal-three-enemy-preparation');a.add({type:'PLACE_TILE',rotation:1},'normal-three-enemy-preparation');a.add({type:'STOP_MOVE'},'normal-three-enemy-preparation');a.settle();};
 for(const [weapon,face,slot] of [['ludwigs-holy-blade',0,0],['uncanny-ludwigs-holy-blade',1,0],['stake-driver',0,1]])for(const accept of [false,true])for(const kill of [false,true])put({...base(weapon,face),id:`${weapon}-${face}-free-${accept?'accept':'decline'}-${kill?'kill':'survive'}`,accept,fast:kill,run:a=>{a.attack('scourge-beast-1',slot,'card-8');if(kill){if(E.hunter(a.get()).face!==face){a.add({type:'TRANSFORM',cardId:E.hunter(a.get()).hand[0].id});a.settle();}else{a.add({type:'TRANSFORM',cardId:E.hunter(a.get()).hand[0].id});a.settle();a.add({type:'TRANSFORM',cardId:E.hunter(a.get()).hand[0].id});a.settle();}a.heal();a.attack('scourge-beast-1',slot);}}});
 for(const [weapon,face] of [['uncanny-ludwigs-holy-blade',0],['kirkhammer',0],['ludwigs-holy-blade',1]])for(const count of [1,2])put({...base(weapon,face),id:`${weapon}-${face}-clear-${count}`,targets:['scourge-beast-2','scourge-beast-1'],run:a=>{three(a);a.attack('huntsmans-minion-1',0,'card-11');if(count===2){a.heal();a.attack('huntsmans-minion-1',1,'card-6');}a.replenish();}});
 for(const [weapon,face] of [['uncanny-ludwigs-holy-blade',0],['kirkhammer',0],['ludwigs-holy-blade',1]])put({...base(weapon,face),id:`${weapon}-${face}-clear-kill-rapid`,fast:true,targets:['huntsmans-minion-1','scourge-beast-2'],run:a=>{three(a);a.attack('huntsmans-minion-1',0,'card-11');a.heal();a.attack('huntsmans-minion-1',1,'card-8');a.replenish();}});
 for(const distance of [0,1,2])put({...base('stake-driver',1),id:`stake-driver-1-all-push-${distance}`,pushDistance:distance,run:a=>{a.attack('scourge-beast-1',0,'card-8');}});
 for(const distance of [0,1,2])put({id:`beast-claw-1-kill-move-${distance}`,fixture:'beast-claw-0',prefix:14,weaponMoveDistance:distance,run:a=>a.settle()});
 put({id:'beast-claw-1-mission-interruption',fixture:'beast-claw-0',prefix:61,escortAccept:true,run:a=>{a.add({type:'STEP',node:'tile-11:house'});a.add({type:'STOP_MOVE'});a.settle();}});
 for(const chain of [false,true])put({...base('hunter-axe',1),id:`hunter-axe-1-kill-${chain?'chain':'target-choice'}`,target:'scourge-beast-2',fast:chain,run:a=>{three(a);if(chain){a.attack('scourge-beast-2',0,'card-6');a.heal();}a.attack('scourge-beast-1',1,'card-8');}});
 for(const accept of [false,true])put({...base('rifle-spear',0),startStage:'beforeWalk',id:`rifle-spear-0-entry-${accept?'use':'decline'}`,entryAccept:accept,run:a=>{a.add({type:'STEP',node:'tile-01:top'});a.add({type:'STOP_MOVE'});a.settle();}});
 for(const moves of [0,1,2])put({...base('rifle-spear',1),id:`rifle-spear-1-move-bonus-${moves}`,run:a=>{for(let i=0;i<moves;i++)a.walk(i%2?'tile-01:top':'tile-01:bottom','bonus-movement');a.attack('scourge-beast-1',0,'card-8');}});
 for(const boost of ['none','speed','damage'])put({...base('chikage',0),id:`chikage-0-sacrifice-${boost}`,run:a=>a.attack('scourge-beast-1',0,'card-8',{weaponBoost:boost})});
 for(const boost of [0,1,2])put({id:`logarius-wheel-1-sacrifice-${boost}`,fixture:'logarius-wheel-0',prefix:29,run:a=>a.attack('scourge-beast-1',0,'card-2',{weaponBoost:boost})});
 put({id:'logarius-wheel-1-lethal-sacrifice',fixture:'logarius-wheel-0',prefix:202,run:a=>{a.add({type:'ATTACK',cardId:'card-10',slot:0,enemyId:a.get().enemies.find(e=>e.node===E.hunter(a.get()).position).id,weaponBoost:2});a.settle();}});
 for(const face of [0,1])put({...base('tonitrus',face),id:`tonitrus-${face}-round-expiry`,run:a=>{a.add({type:'END_TURN'});a.settle();assert(!E.hunter(a.get()).weaponCharge);}});
 const exact=[['hunter-axe-0-regain','hunter-axe-1',30,{type:'ATTACK',cardId:'card-9',slot:2,enemyId:'scourge-beast-1'}],['kirkhammer-1-uninterruptible','kirkhammer-0',10,{type:'ATTACK',cardId:'card-11',slot:1,enemyId:'huntsman-mob-1'}],['blade-of-mercy-1-finishing-combo','blade-of-mercy-0',150,{type:'ATTACK',cardId:'card-9',slot:2,enemyId:'huntsman-mob-1'}],['saw-spear-0-kill-draw-heal','saw-spear-0',74,{type:'ATTACK',cardId:'card-1',slot:0,enemyId:'scourge-beast-2'}],['beast-claw-0-low-health','beast-claw-0',73,{type:'ATTACK',cardId:'card-1',slot:2,enemyId:'scourge-beast-2'}],['threaded-cane-0-dodge-area','threaded-cane-0',5,{type:'DODGE',cardId:'card-1',slot:0}],['reiterpallasch-0-matched-dodge','reiterpallasch-0',6,{type:'DODGE',cardId:'card-1',slot:1}],['chikage-1-dodge-kill','chikage-1',97,{type:'DODGE',cardId:'card-1',slot:0}],['threaded-cane-1-equal-interrupt','threaded-cane-0',200,{type:'ATTACK',cardId:'card-11',slot:0,enemyId:'scourge-beast-3',rewardIds:['reward-18']}]];
 for(const [id,fixture,prefix,command]of exact)put({id,fixture,prefix,run:a=>{a.add(command);a.settle();}});
 put({...base('reiterpallasch',1),id:'reiterpallasch-1-shot-then-normal',run:a=>{a.add({type:'WEAPON_SHOT',cardId:'card-11',slot:1,enemyId:'scourge-beast-1'});a.settle();}});
 for(const count of [0,1,3])put({id:`burial-1-pull-${count}`,...(count?{fixture:'burial-1',prefix:39}:base('burial',1)),run:a=>{const targets=E.pullCandidates(a.get()).slice(0,count).map(e=>e.id);const enemy=targets[0]||a.get().enemies.find(e=>e.node===E.hunter(a.get()).position)?.id;a.add({type:'ATTACK',cardId:count?'card-9':'card-8',slot:1,enemyId:enemy,pullIds:targets});a.settle();}});
 put({...base('burial',0),id:'burial-0-area-chain-kill',fast:true,run:a=>{three(a);a.attack('huntsmans-minion-1',0,'card-11');a.heal();a.attack('huntsmans-minion-1',1,'card-6');a.heal();a.attack('scourge-beast-1',2,'card-8');}});
 put({...base('chikage',0),id:'chikage-1-dodge-heal-multi-target',target:'scourge-beast-2',run:a=>{three(a);a.attack('scourge-beast-1',0,'card-8',{weaponBoost:'damage'});a.add({type:'TRANSFORM',cardId:'card-6'});a.settle();a.replenish();const h=E.hunter(a.get());assert(h.hp===3,'Normal sacrifice/attack route should reachHP3');a.add({type:'ATTACK',cardId:'card-11',slot:2,enemyId:'huntsmans-minion-1'});const c=h.hand.find(c=>E.canDodge(a.get(),c.id,0));assert(c,'Legitimate dodge card required');a.add({type:'DODGE',cardId:c.id,slot:0});a.settle();}});
 const more=[['blade-of-mercy-0-equal-interrupt','blade-of-mercy-0',11,{type:'ATTACK',cardId:'card-6',slot:0,enemyId:'huntsman-mob-1'}],['logarius-wheel-0-attack-heal','logarius-wheel-0',6,{type:'ATTACK',cardId:'card-1',slot:0,enemyId:'huntsman-mob-1'}],['beast-claw-0-high-health','beast-claw-0',71,{type:'ATTACK',cardId:'card-2',slot:2,enemyId:'scourge-beast-2'}],['threaded-cane-0-nearby-dodge','threaded-cane-0',266,{type:'DODGE',cardId:'card-2',slot:0}]];
 for(const [id,fixture,prefix,command]of more)put({id,fixture,prefix,run:a=>{a.add(command);a.settle();}});
 put({...base('saw-spear',1),id:'saw-spear-1-stagger-damage',run:a=>a.attack('scourge-beast-1',0,'card-6')});
 for(const fast of [false,true])put({...base('threaded-cane',0),id:'threaded-cane-0-dodge-area-kill-'+(fast?'rapid':'human'),fast,run:a=>{a.attack('scourge-beast-1',2,'card-8');a.heal();a.replenish();a.add({type:'ATTACK',cardId:'card-6',slot:1,enemyId:'huntsmans-minion-1'});a.add({type:'DODGE',cardId:'card-2',slot:0});a.settle();}});
 for(const spec of cases)if(['stake-driver-1-all-push-2','beast-claw-1-kill-move-2','burial-1-pull-3','ludwigs-holy-blade-0-free-accept-survive'].includes(spec.id))spec.camera=true;
 put({id:'logarius-wheel-1-terminal-sacrifice',fixture:'logarius-wheel-0',prefix:231,next:false,terminalExpected:true,run:a=>{
  a.add({type:'TRANSFORM',cardId:'card-8'});a.settle();a.add({type:'ATTACK',cardId:'card-7',slot:0,enemyId:'mission-main',weaponBoost:2});a.settle();
  const travel=id=>{a.add({type:'USE_CONSUMABLE',itemId:id});const s=a.get(),boss=s.enemies.find(e=>e.id==='mission-main'),route=E.path(s,E.hunter(s).position,boss.node);for(const node of route.slice(1))a.add({type:'STEP',node});if(a.get().phase==='move')a.add({type:'STOP_MOVE'});a.settle();};
  travel('item-qa-2-21');a.add({type:'ATTACK',cardId:'card-11',slot:0,enemyId:'mission-main',weaponBoost:2});a.settle();travel('item-qa-2-22');
  const h=E.hunter(a.get());assert.equal(h.hp,1);assert.equal(a.get().track,16);assert(a.get().lastRound);a.add({type:'ATTACK',cardId:h.hand[0].id,slot:h.slots.findIndex(x=>!x),enemyId:'mission-main',weaponBoost:h.hp});assert.equal(a.get().phase,'over');assert.equal(a.get().result,'loss');
 }});
 return cases;
}
module.exports={definitions,build,pub,ruling};
