'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),G=require('../src/tile-geometry');
const {boot}=require('./helpers/ui-harness.cjs');
const rootKey='bloodborne-hunt-v07';
const engine={create:E.create,importSave:E.importSave,exportSave:E.exportSave,dispatch:E.dispatch,
  missionView:E.missionView,rewardsView:E.rewardsView,missionActions:E.missionActions,
  interactionEnemies:E.interactionEnemies,provisionalView:E.provisionalView,applyChapelRuling:s=>s};
const prefixes=new Map();
function natural(file,count,weapon='beast-claw',face=0) {
  const key=`${file}/${count}/${weapon}/${face}`;
  if(!prefixes.has(key)) {
    let s=E.create(90,weapon,face,null,'hunter-pistol','center',{campaign:true});
    for(const command of require('./fixtures/'+file).slice(0,count))s=E.dispatch(s,command);
    assert.deepEqual(E.importSave(E.exportSave(s)),s);prefixes.set(key,s);
  }
  return structuredClone(prefixes.get(key));
}
const room=count=>natural('weapon-campaign-completion/beast-claw-0.json',count);
function launch(state) {
  const bytes=E.exportSave(state);
  const ui=boot(state,E.missionView(state),E.rewardsView(state),{engine,realInventory:true,
    storage:{[rootKey]:bytes,'bloodborne-hunt-active-mode':'normal'}});
  return {state,bytes,ui};
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(rootKey),f.bytes,'object inspection must preserve the exact saved progress');
  assert.equal(f.ui.el('error').textContent,'');
  assert.equal(f.ui.el('enemyDetailDialog').open,false);assert.equal(f.ui.el('infoDialog').open,false);
}
function tileHTML(f,tileId) {
  const html=f.ui.el('chapterMap').innerHTML;
  const marker=html.indexOf(`data-tile="${tileId}"`);assert(marker>=0,tileId);
  const start=html.lastIndexOf('<div class="tile-cell',marker);
  const next=html.indexOf('<div class="tile-cell',marker+1);
  return html.slice(start,next<0?html.length:next);
}
function localEntries(f,tileId) {
  return f.ui.document.parse(tileHTML(f,tileId)).filter(element=>element.hasAttribute('data-layout-id'));
}
function coords(element) {
  const style=element.getAttribute('style');
  return ['left','top'].map(key=>Number(style.match(new RegExp(key+':([-.0-9]+)%'))?.[1]));
}
function closePoint(actual,expected) {
  actual.forEach((value,index)=>assert(Math.abs(value-expected[index])<0.000001,`${actual} versus ${expected}`));
}
function object(f,type,node) {
  return f.ui.el('chapterMap').querySelectorAll('[data-map-object]')
    .find(button=>button.dataset.mapObject===type&&button.dataset.objectNode===node);
}
function currentObjectCount(f,type,node) {
  return f.ui.el('chapterMap').querySelectorAll('[data-map-object]')
    .filter(button=>button.dataset.mapObject===type&&button.dataset.objectNode===node).length;
}
function userAt(count) {
  const original=require('./fixtures/user-play-fog-v089.json').state;
  let s=E.create(original.initialSeed,original.setup.weaponId,original.setup.face,null,
    original.setup.firearmId,original.setup.startSpace,original.setup);
  for(const command of original.commands.slice(0,count))s=E.dispatch(s,command);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;
}

test('actual public room shows two separate chests at their exact printed points and enemies at their assigned marker points',()=>{
  const f=launch(room(35)),entries=localEntries(f,'tile-03');
  assert.equal(currentObjectCount(f,'chest','tile-03:room'),2);
  assert.equal(currentObjectCount(f,'token','tile-03:room'),1);
  for(const enemy of f.state.enemies.filter(enemy=>enemy.node==='tile-03:room')) {
    const assignment=f.state.world.assignments.find(a=>a.enemyId===enemy.kind);
    const marker=G.definition('tile-03').markers.find(m=>m.kind==='spawn'&&m.markerId===assignment.marker);
    const entry=entries.find(e=>e.dataset.layoutId===enemy.id);assert(entry);
    closePoint(coords(entry),marker.point);
  }
  const chests=entries.filter(e=>e.dataset.layoutId.startsWith('chest-'));
  assert.deepEqual(chests.map(coords),[[37,37],[61,37]]);
  assert.doesNotMatch(tileHTML(f,'tile-03'),/undefined%|NaN%/);
  unchanged(f);
});

test('a room survivor appears only after the real movement-end mission trigger',()=>{
  const before=launch(room(34)),after=launch(room(35));
  assert.equal(currentObjectCount(before,'token','tile-03:room'),0);
  assert.equal(currentObjectCount(after,'token','tile-03:room'),1);
  const survivor=object(after,'token','tile-03:room');
  assert(survivor);assert(survivor.getAttribute('aria-label').includes(E.missionView(after.state).tokens[0].name));
  assert.doesNotMatch(tileHTML(before,'tile-03'),/data-layout-id="rescue"/);
  unchanged(before);unchanged(after);
});

for(const remaining of [1,0])test(`real interaction collecting treasure leaves exactly ${remaining} visible chest objects in that room`,()=>{
  let s=room(40);s=E.dispatch(s,{type:'INTERACT',cardId:'card-7',lootCount:2-remaining});
  s=E.dispatch(s,{type:'RESOLVE'});
  assert.equal(s.phase,'hunter');assert.equal(E.hunter(s).hp,1);
  assert.equal(s.loot.filter(node=>node==='tile-03:room').length,remaining);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  const f=launch(s);assert.equal(currentObjectCount(f,'chest','tile-03:room'),remaining);
  assert.equal(currentObjectCount(f,'token','tile-03:room'),1,'unselected survivor remains visible');
  unchanged(f);
});

for(const type of ['chest','token'])test(`clicking the public room ${type} selects its current cell and exposes costs without spending a hand card`,()=>{
  const f=launch(room(35)),control=object(f,type,'tile-03:room');assert(control);control.click();
  assert.equal(f.ui.el('mapContext').hidden,false);
  assert(f.ui.el('mapContext').textContent.includes(control.dataset.objectName));
  assert(f.ui.el('contextInteraction').open||f.ui.el('decisions').innerHTML.includes('id="contextInteraction" open'));
  assert.equal(f.ui.el('tileRescue').checked,true);
  assert.equal(f.ui.el('lootCount').value,'2');
  assert(f.ui.el('mapContext').textContent.includes('손패'));
  unchanged(f);
});

test('clicking the current central lamp selects the lamp without teleporting, opening an image or entering the Dream',()=>{
  const s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true}),f=launch(s);
  const lamp=object(f,'lamp','tile-14:center');assert(lamp);lamp.click();
  assert.equal(f.ui.el('mapContext').hidden,false);assert(f.ui.el('mapContext').textContent.includes('등불'));
  assert.equal(f.ui.el('chapterMap').querySelectorAll('a').length,0);
  unchanged(f);
});

test('actual fog scene renders the broken lamp at its printed point while the mission enemy retains that same anchor',()=>{
  const f=launch(userAt(18)),entries=localEntries(f,'tile-04');
  const lamp=entries.find(e=>e.dataset.layoutId==='lamp-0');assert(lamp);closePoint(coords(lamp),[50,50]);
  const enemy=f.state.enemies.find(e=>e.missionId==='mob');assert(enemy);
  closePoint(coords(entries.find(e=>e.dataset.layoutId===enemy.id)),[50,50]);
  const button=object(f,'lamp','tile-04:center');assert(button);
  assert(button.getAttribute('aria-label').includes('망가진 등불'));button.click();
  assert(f.ui.el('mapContext').textContent.includes('망가진 등불'));
  assert.equal(E.node(f.state,'tile-04:center').lamp,false);unchanged(f);
});

test('pending placement preview keeps all dynamic actors, treasure and survivors out of its ghost tile',()=>{
  const f=launch(userAt(4));assert.equal(f.state.phase,'tile_place');
  const ghost=tileHTML(f,'tile-04');assert(ghost.includes('tile-cell ghost'));
  assert.doesNotMatch(ghost,/data-map-object=|data-layout-id=|data-presentation-id=|data-enemy=/);
  unchanged(f);
});

test('a carried escort is displayed at the actual hunter cell while the original node remains null in the saved rules state',()=>{
  const s=natural('v074-clinic-escort-chapter-two-natural-commands.json',133,'burial',1),f=launch(s);
  const view=E.missionView(s),token=view.tokens.find(t=>t.id==='escort');assert(token);
  assert.equal(token.node,null);assert.equal(token.carrierId,s.activeHunterId);
  const actualNode=E.hunter(s).position;
  assert.equal(currentObjectCount(f,'token',actualNode),1);
  const control=object(f,'token',actualNode);assert(control);
  assert(control.getAttribute('aria-label').includes(token.name));control.click();unchanged(f);
});

test('later-chapter collected survivors use the public counter value as their displayed quantity',()=>{
  const s=natural('v074-clinic-escort-chapter-two-natural-commands.json',157,'burial',1),f=launch(s);
  const counter=E.missionView(s).counters.find(c=>c.id==='survivors-held');assert.equal(counter.value,2);
  const control=object(f,'token',E.hunter(s).position);assert(control);
  assert(control.getAttribute('aria-label').includes('2명'));
  assert(tileHTML(f,E.node(s,E.hunter(s).position).tile).includes(control.dataset.objectName+' 2'));
  control.click();unchanged(f);
});

for(const [file,count,missionId,markerId] of [
  ['v074-patient-natural-commands.json',175,'bridge','purple'],
  ['v074-bridge-natural-commands.json',239,'main','red'],
])test(`already-revealed mission ${missionId} uses its sole public spawn marker when its cell has no lantern`,()=>{
  const s=natural(file,count,'burial',1),f=launch(s),enemy=s.enemies.find(e=>e.missionId===missionId);
  assert(enemy);const n=E.node(s,enemy.node),p=s.world.tiles.find(p=>p.tileId===n.tile);
  const marker=G.definition(n.tile).markers.find(m=>m.spaceId===n.space&&m.kind==='spawn')||
    G.definition(n.tile).markers.find(m=>`${n.tile}:${m.spaceId}`===enemy.node&&m.kind==='spawn');
  assert(marker);assert.equal(marker.markerId,markerId);
  const entry=localEntries(f,n.tile).find(e=>e.dataset.layoutId===enemy.id);assert(entry);
  closePoint(coords(entry),G.rotatePoint(marker.point,p.rotation));unchanged(f);
});

