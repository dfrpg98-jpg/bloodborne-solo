const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine');
const C=require('../campaigns/long-hunt/data.json');
const fixture=require('./fixtures/v089-courtyard-encounter-user-prefix.json');
const H=E.hunter;
function create(rulesVersion) {
  const setup=fixture.setup;
  return E.create(fixture.initialSeed,setup.weaponId,setup.face,setup.startingConsumable,
    setup.firearmId,setup.startSpace,{campaign:true,rulesVersion});
}
function replay(s,commands) {
  for(const c of commands)s=E.dispatch(s,c);
  E.assertState(s);
  assert.deepEqual(E.importSave(E.exportSave(s)),s,'all checkpoints restore from real command history');
  return s;
}
// The original user's first five accepted commands, and a public-command route
// from the same untouched start which leaves the pursuer on the adjacent tile.
// No positions, HP, deck order, enemies or mission flags are assembled by hand.
for(const rulesVersion of [13]) {
  test(`rules${rulesVersion}: original player route removes only the pursuer that entered the courtyard before fog`,()=>{
    const before=replay(create(rulesVersion),fixture.commands.slice(0,4));
    assert.equal(H(before).position,'tile-11:street');
    assert.deepEqual(before.enemies.map(e=>({id:e.id,node:e.node})),[
      {id:'huntsmans-minion-1',node:'tile-11:street'},
    ]);
    const after=replay(before,[fixture.commands[4]]);
    assert.deepEqual(before.mission.fog,[],'dispatch retains its input checkpoint');
    assert.deepEqual(after.mission.fog,['tile-04']);
    const events=after.events.slice(before.events.length).map(e=>e.text);
    const pursuit=events.indexOf('야수 사냥 하인 → 마당 등불 / 마당 등불.');
    const fog=events.findIndex(text=>text.includes('안개 진입로, 등불 파괴, 일반 적 제거'));
    assert(pursuit>=0&&fog>pursuit,'pursuit precedes mission fog creation');
    assert.deepEqual(after.enemies.map(e=>({id:e.id,node:e.node,missionId:e.missionId})),[
      {id:'huntsman-mob-1',node:'tile-04:center',missionId:'mob'},
    ]);
    assert.equal(after.kills,before.kills,'fog removal is not a combat kill');
    assert.equal(H(after).echoes,H(before).echoes,'fog removal grants no echoes');
    assert.equal(after.mission.targets.mob.tokens,1);
  });
  test(`rules${rulesVersion}: courtyard fog preserves the same minion when a longer route leaves it on the house street`,()=>{
    let s=replay(create(rulesVersion),fixture.commands.slice(0,3));
    s=replay(s,[
      {type:'STEP',node:'tile-11:house'},
      {type:'MOVE',cardId:'card-12'},
      {type:'STEP',node:'tile-11:street'},
      {type:'EXPLORE',edge:'N'},
      {type:'PLACE_TILE',rotation:0},
    ]);
    assert.equal(H(s).position,'tile-04:center');
    assert.deepEqual(s.mission.fog,['tile-04']);
    const minion=s.enemies.find(e=>e.id==='huntsmans-minion-1');
    assert(minion);assert.equal(minion.node,'tile-11:street');assert.equal(minion.hp,5);
    const mob=s.enemies.find(e=>e.missionId==='mob');
    assert(mob);assert.equal(mob.node,'tile-04:center');assert.equal(s.enemies.length,2);
    assert.equal(s.kills,0);assert.equal(H(s).echoes,0);
  });
}
test('courtyard mission enemy spawns in the printed lantern space, even though the lantern is currently broken',()=>{
  const s=replay(create(13),fixture.commands);
  const card=C.cards.find(c=>c.number===5);
  assert(card.rules.some(rule=>rule.includes('[등불 기호] 칸에 야수 사냥 무리 하나가 출현')));
  const target=s.mission.targets.mob;
  const [tileId,spaceId]=target.node.split(':');
  const space=C.tiles.find(t=>t.id===tileId).spaces.find(n=>n.id===spaceId);
  assert(space.icons.some(icon=>icon.kind==='lamp'),'target uses the literal printed lantern space');
  assert.equal(E.node(s,target.node).lamp,false,'fog disables its function, not its location');
  assert.equal(s.enemies.find(e=>e.id===target.enemyId).node,target.node);
});
