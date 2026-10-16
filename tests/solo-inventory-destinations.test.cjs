const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),{boot}=require('./helpers/ui-harness.cjs');
const fogCommands=require('./fixtures/v074-lantern-fog-commands.json');
function fogState(){let s=E.create(90,'rifle-spear',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:11});for(const c of fogCommands)s=E.dispatch(s,c);return s;}
function give(s,kind){const index=s.consumableDeck.findIndex(c=>c.kind===kind);assert(index>=0);E.hunter(s).consumables.push(...s.consumableDeck.splice(index,1));}
function open(s,kind){const ui=boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true});const item=E.hunter(s).consumables.find(c=>c.kind===kind);ui.el('inventory').querySelectorAll('[data-item]').find(b=>b.dataset.item===item.id).click();return {ui,item};}
const targets=element=>[...element.innerHTML.matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]);
test('inventory mark offers only legal intact lamps and every listed move is accepted',()=>{
  const s=E.create(90,'burial',1,'bold-mark','hunter-pistol','center',{campaign:true,rulesVersion:11}),{ui,item}=open(s,'bold-mark');
  const listed=targets(ui.el('itemNode'));
  assert(listed.length>0);assert.equal(ui.el('useItem').disabled,false);
  assert.deepEqual(listed,E.nodes(s).filter(n=>E.canTeleport(s,n.id)).map(n=>n.id));
  for(const node of listed){const next=E.dispatch(s,{type:'USE_CONSUMABLE',itemId:item.id,node});assert.equal(E.hunter(next).position,node);assert.deepEqual(E.importSave(E.exportSave(next)),next);}
});
test('arranged consumable boundary on a public fog checkpoint disables mark without forbidden lamps',()=>{
  const s=fogState();give(s,'bold-mark');const {ui}=open(s,'bold-mark');
  assert.deepEqual(targets(ui.el('itemNode')),[]);assert.equal(ui.el('useItem').disabled,true);assert.match(ui.el('itemDetail').textContent,/안개/);
});
test('arranged stone boundary offers destinations accepted by fog path validation',()=>{
  const s=fogState();give(s,'pebble');const {ui,item}=open(s,'pebble'),foe=s.enemies.find(e=>E.node(s,e.node).tile==='tile-17');assert(foe);
  ui.el('itemEnemy').value=foe.id;ui.el('itemEnemy').fire('change');
  const listed=targets(ui.el('itemNode'));assert(listed.length>0);
  assert(listed.every(id=>E.node(s,id).tile==='tile-17'));
  for(const node of listed)assert.doesNotThrow(()=>E.dispatch(s,{type:'USE_CONSUMABLE',itemId:item.id,enemyId:foe.id,node}));
});
