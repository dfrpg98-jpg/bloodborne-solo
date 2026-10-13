const assert=require('node:assert/strict');
const E=require('../../hunt-engine'), {boot}=require('./ui-harness.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
const containers=['mapContext','decisions','missionActions','rewards','firearm','componentCards','chapterMap','explorationActions'];
function matches(actual,wanted){return Object.entries(wanted).every(([k,v])=>JSON.stringify(actual[k])===JSON.stringify(v));}
function clickCommand(s,command,options={}){
  const ui=boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
    storage:{'bloodborne-hunt-v07':E.exportSave(s)},engine:{
      create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
      // Historical traces must replay the requested command in their original
      // rule context. Automatic adoption of the current chapel ruling has its
      // own real-startup tests; adding it here would change each checkpoint.
      applyChapelRuling:state=>state,
      missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
      interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView,
    }});
  options.onBoot?.(ui);
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
  assert.equal(ui.el('error').textContent,'',`UI rejected ${JSON.stringify(command)}`);
  const next=E.importSave(ui.storage.get('bloodborne-hunt-v07'));
  assert.equal(next.revision,s.revision+1,'one real reducer command from UI');
  const reference=E.dispatch(s,command), functional=state=>{const copy=plain(state);delete copy.commands;return copy;};
  assert.deepEqual(functional(next),functional(reference),'actual UI command preserves intended game result');
  return next;
}
module.exports={clickCommand};
