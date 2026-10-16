const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/hunt-engine'), M = require('../src/chapter-engine');
const R = require('../src/rewards-engine');
const commands = require('./fixtures/chapter-one-v8-commands.json');
const legacyCommands = require('./fixtures/chapter-one-commands.json');
const go=(s,type,args={})=>E.dispatch(s,{type,...args});
function completeOne() {
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true});
  for (const a of commands) s=E.dispatch(s,a);
  return s;
}
test('chapter two and three special setup preserves card 17 topology, supplies and deterministic choices',()=>{
  for (const chapter of [2,3]) for(let seed=1;seed<=64;seed++) {
    const s=M.create(seed,'right',chapter);
    assert.equal(s.chapter,chapter);assert.equal(s.tilePool.length,9);
    assert.equal(s.tiles.length,4);assert.equal(s.tileDeck.length,5);
    assert.equal(new Set(s.tilePool).size,9);
    const central=s.tiles.find(p=>p.tileId==='tile-14'),grave=s.tiles.find(p=>p.tileId==='tile-13'),
      crypt=s.tiles.find(p=>p.tileId==='tile-19'),connector=s.tiles.find(p=>p.tileId===s.specialSetup.connector);
    assert.equal(grave.x+connector.x,2*central.x);assert.equal(grave.y+connector.y,2*central.y);
    assert.equal(Math.abs(crypt.x-connector.x)+Math.abs(crypt.y-connector.y),1);
    assert(new Set(M.tile(connector.tileId).exits.map(e=>e.edge)).size>=2);
    const graph=M.graph(s);assert(graph.nodes.every(n=>Number.isFinite(M.distance(s,s.position,n.id))));
    assert.deepEqual(M.importSave(M.exportSave(s)),s);
  }
});
test('natural chapter one completion advances with growth inventory and resets chapter supplies at the chosen start',()=>{
  const won=completeOne(), old=E.hunter(won), cards=[...old.deck].sort((a,b)=>a.id.localeCompare(b.id));
  const prepared=go(won,'ENTER_BETWEEN_CHAPTERS');
  assert.equal(prepared.phase,'between_chapters');assert(E.hunter(prepared).inDream);
  assert.deepEqual(E.importSave(E.exportSave(prepared)),prepared);
  for(const startSpace of ['left','center','right']) {
    const s=go(prepared,'START_NEXT_CHAPTER',{startSpace,face:0}), h=E.hunter(s);
    assert.equal(s.phase,'hunter');assert.equal(s.mission.chapter,2);assert.equal(s.world.chapter,2);
    assert.equal(s.track,1);assert.equal(s.round,1);assert.equal(h.hp,6);assert.equal(h.face,0);
    assert.equal(h.position,`tile-14:${startSpace}`);assert.equal(h.inDream,false);assert.equal(h.hand.length,3);
    assert.deepEqual([...h.deck,...h.hand].sort((a,b)=>a.id.localeCompare(b.id)),cards);
    assert.deepEqual(h.consumables,old.consumables);assert.deepEqual(h.ownedFirearms,old.ownedFirearms);
    assert.deepEqual(h.rewards,old.rewards);
    assert.deepEqual(s.mission.history,[{chapter:1,completed:won.mission.completed,revealed:won.mission.revealed}]);
    assert.deepEqual(s.mission.completed,[]);assert.deepEqual(s.mission.revealed,[17,18]);
    assert.equal(s.consumableDiscard.length,0);assert.equal(s.removedCards.every(id=>!E.data.upgrades.includes(id)),true);
    assert.deepEqual(E.importSave(E.exportSave(s)),s);
  }
});
test('chapter transition rejects invalid phase start and unresolved equipment atomically',()=>{
  const won=completeOne(), prepared=go(won,'ENTER_BETWEEN_CHAPTERS'), before=structuredClone(prepared);
  assert.throws(()=>go(won,'START_NEXT_CHAPTER',{startSpace:'center'}),/사냥이 끝|준비/);
  assert.throws(()=>go(prepared,'START_NEXT_CHAPTER',{startSpace:'missing'}),/시작 칸/);
  assert.throws(()=>go(prepared,'START_NEXT_CHAPTER',{startSpace:'center',face:2}),/무기 면/);
  assert.deepEqual(prepared,before);
  R.grant(prepared,'beast-roar');
  assert(prepared.rewardChoices.length);
  const pending=structuredClone(prepared);
  assert.throws(()=>go(prepared,'START_NEXT_CHAPTER',{startSpace:'center'}),/보상/);
  assert.deepEqual(prepared,pending);
  const fresh=E.create(3,'burial',0,null,'hunter-pistol','center',{campaign:true});
  assert.throws(()=>go(fresh,'ENTER_BETWEEN_CHAPTERS'),/완료/);
});
test('new provisional boss reset heals its current phase and keeps its moved position',()=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:false,provisional:'cleric-beast'});
  s=go(s,'MOVE',{cardId:E.hunter(s).hand[0].id});s=go(s,'EXPLORE',{edge:'N'});
  s=go(s,'PLACE_TILE',{rotation:E.placementOptions(s)[0]});
  s=go(s,'STOP_MOVE');
  const boss=s.enemies[0], at=E.nodes(s).find(n=>n.tile!=='tile-14').id;
  boss.node=at;boss.provisionalPhase=2;s.provisional.phase=2;boss.hp=1;
  s.track=4;
  s=go(s,'DREAM',{cardId:E.hunter(s).hand[0].id});
  assert.equal(s.enemies[0].node,at);assert.equal(s.enemies[0].provisionalPhase,2);
  assert.equal(s.enemies[0].hp,E.enemyDef(s,s.enemies[0]).maxHp);
});
test('legacy chapter one saves can enter the new chapter flow and still replay exactly',()=>{
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,legacyReplay:true});
  for(const a of legacyCommands)s=E.dispatch(s,a);
  assert(!Object.hasOwn(s.setup,'rulesVersion'));
  s=E.importSave(E.exportSave(s));
  s=go(s,'ENTER_BETWEEN_CHAPTERS');
  s=go(s,'START_NEXT_CHAPTER',{startSpace:'left'});
  assert.equal(s.setup.rulesVersion,7);assert.equal(s.mission.chapter,2);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
