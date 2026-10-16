const assert=require('node:assert/strict');
const E=require('../../src/hunt-engine'), {boot}=require('./ui-harness.cjs');
const ActionLoss=require('../../src/hunt-action-loss');
const plain=x=>JSON.parse(JSON.stringify(x));
const containers=['mapContext','decisions','missionActions','rewards','firearm','componentCards','chapterMap','explorationActions'];
function matches(actual,wanted){return Object.entries(wanted).every(([k,v])=>JSON.stringify(actual[k])===JSON.stringify(v));}
function controllerCommand(state,command){
  // Current public RETURN explicitly opens an optional attachment window when
  // choosing the opposite face. Keep legacy fixture bytes unchanged, and
  // project only this new, intentional field for actual controller clicks.
  return command.type==='RETURN'&&command.face!==E.hunter(state).face&&!Object.hasOwn(command,'reassignAttachments')
    ?{...command,reassignAttachments:true}:command;
}
function controllerBatch(state,commands){
  if(!commands.some(command=>command.type==='RETURN'))return commands;
  const projected=[];let cursor=state;
  for(const command of commands){const accepted=controllerCommand(cursor,command);projected.push(accepted);cursor=E.dispatch(cursor,accepted);}
  return projected;
}
function clickCommand(s,command,options={}){
  const ui=boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
    storage:{'bloodborne-hunt-v07':E.exportSave(s)},engine:{
      create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
      // Historical traces must replay the requested command in their original
      // rule context. Automatic adoption of the current chapel ruling has its
      // own real-startup tests; adding it here would change each checkpoint.
      applyChapelRuling:state=>state,
      applyCombatReactionRuling:state=>state,
      applyLeapMoveRuling:state=>state,
      missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
      interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView,
    }});
  options.onBoot?.(ui);
  const originalSave=ui.storage.get('bloodborne-hunt-v07');
  const change=(id,value)=>{const element=ui.el(id);assert(element,`missing ${id}`);element.value=String(value);element.fire('change');};
  const chosenCard=command.cardId||(command.type==='RELOAD'&&command.cardIds?.[0]);
  if(chosenCard && E.hunter(s).hand.some(c=>c.id===chosenCard)){
    const card=ui.el('hand').querySelectorAll('[data-card]').find(b=>b.dataset.card===chosenCard);
    assert(card,'card selectable');card.click();
  }
  if(Number.isInteger(command.slot)){
    const slot=ui.el('slots').querySelectorAll('[data-slot]').find(b=>+b.dataset.slot===command.slot);
    if(slot)slot.click();
  }
  if(command.enemyId && ['ATTACK','FIREARM','WEAPON_SHOT'].includes(command.type)){
    const mapTarget=ui.el('chapterMap').querySelectorAll('[data-enemy]').find(b=>b.dataset.enemy===command.enemyId);
    if(!mapTarget)options.beforeTarget?.(ui);
    const target=mapTarget||ui.el('nearEnemies').querySelectorAll('[data-enemy]').find(b=>b.dataset.enemy===command.enemyId);
    assert(target,'enemy selectable');target.click();
    if(!mapTarget)options.afterTarget?.(ui);
  }
  if(command.node && ['STEP','BOSS_STEP','ENEMY_STEP'].includes(command.type)){
    const target=ui.el('chapterMap').querySelectorAll('[data-node]').find(b=>b.dataset.node===command.node&&!b.disabled);
    if(target)target.click();
  }
  if(command.type==='EXPLORE'){
    const entrance=ui.el('chapterMap').querySelectorAll('[data-entrance]').find(b=>
      !b.disabled && (b.dataset.edge===command.edge || b.dataset.entrance===command.edge ||
        b.dataset.entrance?.endsWith(':'+command.edge)));
    if(entrance)entrance.click();
  }
  for(const id of command.pullIds||[]){
    const input=ui.el('decisions').querySelectorAll('[data-pull]').find(b=>b.dataset.pull===id);
    assert(input,'pull choice visible');input.checked=true;input.fire('change');
  }
  for(const id of command.rewardIds||[]){
    const input=ui.el('decisions').querySelectorAll('[data-reward-attack]').find(b=>b.dataset.rewardAttack===id);
    assert(input,'attack reward visible');input.checked=true;input.fire('change');
  }
  if(command.weaponBoost!==undefined && ui.el('weaponBoost'))change('weaponBoost',command.weaponBoost||'none');
  if(command.type==='RELOAD'&&command.cardIds?.length>1)change('reloadSecondCard',command.cardIds[1]);
  if(command.itemIds?.length)options.beforeInventory?.(ui);
  for(const id of command.itemIds||[]){
    const item=ui.el('inventory').querySelectorAll('[data-item]').find(b=>b.dataset.item===id);
    assert(item,'attack consumable visible');item.click();
    assert(ui.el('toggleAttackItem')&&!ui.el('toggleAttackItem').disabled,'attack consumable enabled');
    ui.el('toggleAttackItem').click();
  }
  if(command.itemIds?.length)options.afterInventory?.(ui);
  if(command.type==='PLACE_TILE'){
    const rotation=ui.el('decisions').querySelectorAll('[data-rotation]').find(b=>+b.dataset.rotation===command.rotation);
    assert(rotation&&!rotation.disabled,'legal tile rotation visible');rotation.click();
  }
  if(command.type==='REFILL'){
    for(const element of ui.el('decisions').querySelectorAll('[data-refill]')) element.checked=(command.discardIds||[]).includes(element.dataset.refill);
    ui.el('refill').click();
  }else if(command.type==='RETURN'){
    change('returnFace',command.face);
    const destination=ui.el('decisions').querySelectorAll('[data-return]').find(b=>b.dataset.return===command.node);
    assert(destination,'return destination visible');destination.click();
  }else if(command.type==='START_NEXT_CHAPTER'){
    change('nextChapterStart',command.startSpace);
    if(command.face!==undefined)change('nextChapterFace',command.face);
    ui.el('startNextChapter').click();
  }else if(command.type==='USE_CONSUMABLE'){
    options.beforeInventory?.(ui);
    const item=ui.el('inventory').querySelectorAll('[data-item]').find(b=>b.dataset.item===command.itemId);
    assert(item,'consumable selectable');item.click();
    for(const [key,id]of Object.entries({enemyId:'itemEnemy',node:'itemNode',slot:'itemSlot',rewardId:'itemReward'}))if(command[key]!==undefined)change(id,command[key]);
    assert(ui.el('useItem')&&!ui.el('useItem').disabled,'consumable use control enabled');ui.el('useItem').click();
  }else if(command.type==='INTERACT' && !command.mission){
    if(ui.el('tileRescue')){ui.el('tileRescue').checked=false;ui.el('tileRescue').fire('change');}
    if(ui.el('lootCount'))change('lootCount',command.lootCount||0);
    if(ui.el('tileHeal'))ui.el('tileHeal').checked=!!command.heal;
    if(ui.el('tileLamp'))change('tileLamp',command.lamp||'');
    assert(ui.el('interact')&&!ui.el('interact').disabled,'interaction control enabled');ui.el('interact').click();
  }else{
    if(command.type==='USE_REWARD'){
      options.beforeReward?.(ui);
      if(command.node && ui.el('rewardLamp-'+command.rewardId))change('rewardLamp-'+command.rewardId,command.node);
      if(command.node && ui.el('rewardNode-'+command.rewardId))change('rewardNode-'+command.rewardId,command.node);
      for(const move of command.moves||[]){
        change('rewardMove-'+command.rewardId+'-'+move.enemyId,move.node);
      }
    }
    const buttons=containers.flatMap(id=>ui.el(id)?.querySelectorAll('[data-command]')||[]);
    // The reducer accepts an explicit no-op boost; ordinary weapons do not
    // render a boost selector or serialize that optional argument.
    const wanted={...command};
    // Historical planner traces contain an unused `boost` field. The actual
    // reducer and controller both read only `weaponBoost`.
    delete wanted.boost;
    if(wanted.type==='RELOAD'){
      if(wanted.cardIds)delete wanted.cardId;
      else if(wanted.cardId){wanted.cardIds=[wanted.cardId];delete wanted.cardId;}
    }
    const boostCode=E.weapon(s).faces[E.hunter(s).face].effect?.code;
    if(wanted.weaponBoost==='none'&&!['attack_sacrifice_damage','attack_sacrifice_speed_or_damage'].includes(boostCode))delete wanted.weaponBoost;
    const button=buttons.find(b=>b.dataset.command===command.type&&!b.disabled&&matches({type:b.dataset.command,...JSON.parse(b.dataset.args)},wanted));
    if(button)button.click();
    else if(command.type==='USE_REWARD'){
      const reward=ui.el('rewards').querySelectorAll('[data-reward-use]').find(b=>b.dataset.rewardUse===command.rewardId&&!b.disabled);
      assert(reward,'reward use control enabled');reward.click();
    }else assert.fail(`No enabled UI action for ${s.phase}: ${JSON.stringify(command)}`);
  }
  const departure=ui.el('escortDialog'),expectedCommands=controllerBatch(s,options.expectedCommands||[command]);
  assert(Array.isArray(expectedCommands),'the expected public command batch is explicit');
  if(departure?.open){
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),originalSave,'a departure request preserves the exact save before its answer');
    assert.equal(E.importSave(ui.storage.get('bloodborne-hunt-v07')).revision,s.revision,'a departure request commits no movement, optional pickup or cost');
    options.onDepartureRequest?.(ui);
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),originalSave,'inspecting the departure prompt preserves the save');
    const answer=options.departureAnswer||'decline',id={accept:'escortAccept',decline:'escortDecline',cancel:'escortCancel'}[answer];
    assert(id,`unknown departure answer ${answer}`);
    const button=ui.el(id);assert(button&&!button.disabled,`the ${answer} departure answer is available`);button.click();
    assert.equal(departure.open,false,'the answered departure dialog closes');
  }else if(options.departureAnswer){
    assert.fail(`The requested ${options.departureAnswer} departure answer needs a real departure dialog`);
  }
  const lossDialog=ui.el('actionLossDialog'),lossPlan=ActionLoss.plan(E,s,expectedCommands);
  if(lossDialog?.open){
    // This replay explicitly requests the complete historical command batch.
    // Accept only its independently matched loss plan; never blindly dismiss
    // an arbitrary modal or add an approval behavior to the product itself.
    assert(lossPlan,`Unexpected action-loss confirmation for ${JSON.stringify(expectedCommands)}`);
    assert.deepEqual(plain(lossPlan.commands),plain(expectedCommands),'the loss confirmation belongs to the explicitly requested command batch');
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),originalSave,'a loss question spends no card, item or companion');
    assert.equal(ui.el('actionLossSummary').textContent,lossPlan.summary,'the displayed losses match the public requested action');
    for(const loss of lossPlan.losses)assert(ui.el('actionLossList').textContent.includes(loss.description),'every planned loss is explained before confirmation');
    options.onActionLossRequest?.(ui,lossPlan);
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),originalSave,'inspecting the loss question preserves the exact save');
    const accept=ui.el('actionLossAccept');assert(accept&&!accept.disabled,'scripted transport has an explicit enabled loss confirmation');
    accept.click();assert.equal(lossDialog.open,false,'the accepted action-loss dialog closes');
  }else if(lossPlan)assert.fail(`Missing action-loss confirmation for ${JSON.stringify(expectedCommands)}`);
  if(ui.el('attachmentDialog')?.open){
    const beforeClose=ui.storage.get('bloodborne-hunt-v07');
    options.onAttachmentRequest?.(ui);
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),beforeClose,'inspecting optional attachment destinations changes no slot or resource');
    const close=ui.el('closeAttachments');assert(close&&!close.disabled,'optional attachment changes can be declined without a command');
    close.click();assert.equal(ui.el('attachmentDialog').open,false,'the replay explicitly keeps the current attachment slots');
    assert.equal(ui.storage.get('bloodborne-hunt-v07'),beforeClose,'closing optional reassignment preserves the exact save');
  }
  assert.equal(ui.el('error').textContent,'',`UI rejected ${JSON.stringify(command)}`);
  const next=E.importSave(ui.storage.get('bloodborne-hunt-v07'));
  assert.equal(next.revision,s.revision+expectedCommands.length,'only the explicitly expected public command batch commits');
  const committed=next.commands.slice(s.commands.length);
  assert.deepEqual(committed.map(c=>c.type),expectedCommands.map(c=>c.type),'the UI records the complete intended reducer batch once');
  for(const [index,wanted]of expectedCommands.entries())if(wanted.type==='RETURN')
    assert.deepEqual(plain(committed[index]),plain(wanted),'the return records its exact selected destination, face and explicit current attachment timing');
  const reference=expectedCommands.reduce((state,c)=>E.dispatch(state,c),s),functional=state=>{const copy=plain(state);delete copy.commands;return copy;};
  assert.deepEqual(functional(next),functional(reference),'actual UI commands preserve the intended original-rule result');
  if(!expectedCommands.length)assert.equal(ui.storage.get('bloodborne-hunt-v07'),originalSave,'cancel preserves the exact save');
  return next;
}
// Historical traces used MISSION_PICKUP to arm a future departure. The new
// public controller asks at departure instead. Preserve the original engine
// stream separately and compare every gameplay field at each checkpoint. The
// reference adopts only the explicit current RETURN timing when that command
// is actually clicked through the public controller.
function traceBehavior(state,ignorePickupReservation=false){
  const copy=plain(state);delete copy.commands;delete copy.revision;delete copy.log;
  if(ignorePickupReservation&&copy.mission?.escort)delete copy.mission.escort.pickup;
  return copy;
}
function replayPublicTrace(initial,commands,options={}){
  let state=initial,reference=initial,uiCommandCount=0,uiActions=0,deferredReservations=0;
  for(let index=0;index<commands.length;index++){
    const command=commands[index],beforeReference=reference;
    reference=E.dispatch(reference,command);
    let clicked=false,expectedCommands=[];
    try{
      if(command.type==='MISSION_PICKUP'){
        // This is a legacy intent, not a surviving UI button. It may be unused
        // (for example STOP_MOVE, a story choice, then teleport), so never
        // fabricate a click or mutate the player's actual save here.
        deferredReservations++;
      }else{
        const leaving=['STEP','EXPLORE'].includes(command.type),escort=state.mission?.escort;
        const eligible=leaving&&E.missionActions(state).some(a=>a.command.type==='MISSION_PICKUP');
        const intent=!!beforeReference.mission?.escort?.pickup;
        if(eligible&&!!escort.pickup!==intent)expectedCommands.push({type:'MISSION_PICKUP'});
        expectedCommands.push(command);
        clicked=options.shouldClick?!!options.shouldClick(beforeReference,command,reference,index):true;
        if(clicked){
          expectedCommands=controllerBatch(state,expectedCommands);
          const projected=controllerCommand(beforeReference,command);
          if(projected!==command)reference=E.dispatch(beforeReference,projected);
          const clickOptions={...(options.clickOptions||{}),expectedCommands};
          if(eligible)clickOptions.departureAnswer=intent?'accept':'decline';
          state=clickCommand(state,command,clickOptions);
          uiCommandCount+=expectedCommands.length;uiActions++;
        }else state=expectedCommands.reduce((value,c)=>E.dispatch(value,c),state);
      }
      // Ignore only the temporarily deferred pickup flag when it actually
      // differs. Carrier identity, token positions, NPC follow, resources,
      // random state, health, mission completion and every other field match.
      const pending=state.mission?.escort?.pickup!==reference.mission?.escort?.pickup;
      assert.deepEqual(traceBehavior(state,pending),traceBehavior(reference,pending),`original gameplay result at command ${index+1}`);
      options.onCheckpoint?.({state,reference,beforeReference,command,index,clicked,expectedCommands});
    }catch(error){throw new Error(`${options.label||'public trace'} command ${index+1}/${commands.length} (${command.type}): ${error.message}`,{cause:error});}
  }
  assert.deepEqual(traceBehavior(state),traceBehavior(reference),'final gameplay and pickup state equal the trace with only explicitly accepted controller return timing');
  return {state,reference,originalCommandCount:commands.length,uiCommandCount,uiActions,deferredReservations};
}
module.exports={clickCommand,replayPublicTrace};
