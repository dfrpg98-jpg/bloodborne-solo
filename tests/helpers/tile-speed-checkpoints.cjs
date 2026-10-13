'use strict';
const E=require('../../hunt-engine');
const files={10:'v074-shelter-natural-commands.json',31:'v074-patient-natural-commands.json'};
function missionCheckpoint(card){
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,
    qa:{preset:'custom',startRewards:[],startConsumables:[]}}),boundary=s,following=[];
  const all=require('../fixtures/'+files[card]);
  for(const [index,command] of all.entries()){
    const using=()=>command.type==='USE_REWARD'&&E.killReactionActions(s).some(a=>!a.disabled&&a.command.rewardId===command.rewardId&&a.command.enemyId===command.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
    if(E.applyTileSpeedRuling(s)!==s){boundary=s;following=[];}
    following.push(command);s=E.dispatch(s,command);
    const e=s.combat&&s.enemies.find(e=>e.id===s.combat.enemyId);
    if(s.phase==='combat_react'&&e&&s.mission.targets[e.missionId]?.card===card&&
      E.node(s,e.node).tile==='tile-17'&&s.combat.action?.kind==='special'&&
      (card===31||s.combat.action.damage===4))return {card,before:boundary,commands:following,legacy:s,tail:all.slice(index+1)};
  }throw Error('No naturally generated mission '+card+' chapel special');
}
function ordinaryCheckpoint(){
  let s=E.create(7,'burial',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,
    qa:{preset:'custom',startRewards:[],startConsumables:[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')]}});
  for(const c of [{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},
    {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-17:top'},{type:'EXPLORE',edge:'E'},
    {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-03:room'},{type:'STEP',node:'tile-03:entry'},
    {type:'STEP',node:'tile-17:top'}])s=E.dispatch(s,c);
  return {before:s,commands:[{type:'ATTACK',cardId:E.hunter(s).hand[0].id,slot:0,enemyId:'scourge-beast-1'}]};
}
module.exports={missionCheckpoint,ordinaryCheckpoint};
