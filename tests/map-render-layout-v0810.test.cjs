const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../tile-geometry');
const L=require('../map-render-layout');
const E=require('../hunt-engine');
function node(tileId,spaceId) {return `${tileId}:${spaceId}`;}
function point(entry) {return [entry.x,entry.y];}
function gap(a,b) {return Math.hypot(a.x-b.x,a.y-b.y);}
function contains(point,polygon) {
  // Independent winding-number check supports the concave blocked-building tile.
  let winding=0;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    const cross=(b[0]-a[0])*(point[1]-a[1])-(point[0]-a[0])*(b[1]-a[1]);
    if(a[1]<=point[1]&&b[1]>point[1]&&cross>0)winding++;
    if(a[1]>point[1]&&b[1]<=point[1]&&cross<0)winding--;
  }
  return winding!==0;
}
function frozen(value) {
  if(value&&typeof value==='object') {for(const item of Object.values(value))frozen(item);Object.freeze(value);}
  return value;
}

test('all twenty tiles keep lamps and remaining treasure at exact printed marker points in all four rotations',()=>{
  for(const [tileId,definition] of Object.entries(G.tiles))for(const rotation of [0,1,2,3]) {
    const loot=definition.markers.filter(marker=>marker.kind==='consumable').map(marker=>node(tileId,marker.spaceId));
    const result=L.layout({tileId,rotation,loot});
    for(const [markerIndex,marker] of definition.markers.entries()) {
      if(!['lamp','consumable'].includes(marker.kind))continue;
      const type=marker.kind==='lamp'?'lamp':'chest';
      const entry=result.find(item=>item.type===type&&item.markerIndex===markerIndex);
      assert(entry,`${tileId} rotation${rotation} marker${markerIndex}`);
      assert.deepEqual(point(entry),G.rotatePoint(marker.point,rotation));
      assert.equal(entry.node,node(tileId,marker.spaceId));assert.equal(entry.count,1);
    }
    assert(result.every(item=>['lamp','chest'].includes(item.type)));
  }
});

test('treasure is distributed across the individual consumable markers without inventing another treasure point',()=>{
  const tileId='tile-03',id=node(tileId,'room');
  const two=L.layout({tileId,loot:[id,id]}).filter(item=>item.type==='chest');
  assert.deepEqual(two.map(item=>point(item)),[[37,37],[61,37]]);
  assert.deepEqual(two.map(item=>item.count),[1,1]);
  const one=L.layout({tileId,loot:[id]}).filter(item=>item.type==='chest');
  assert.equal(one.length,1);assert.equal(one[0].count,1);
  const three=L.layout({tileId,loot:[id,id,id]}).filter(item=>item.type==='chest');
  assert.deepEqual(three.map(item=>item.count),[2,1]);
  assert.equal(L.layout({tileId,loot:[]}).filter(item=>item.type==='chest').length,0);
});

test('each normal enemy uses the spawn point of its own publicly assigned marker in its current node',()=>{
  for(const [tileId,definition] of Object.entries(G.tiles))for(const rotation of [0,1,2,3]) {
    const enemies=definition.markers.filter(marker=>marker.kind==='spawn').map((marker,index)=>
      ({id:`enemy-${index}`,node:node(tileId,marker.spaceId),markerId:marker.markerId}));
    const entries=L.layout({tileId,rotation,enemies}).filter(item=>item.type==='enemy');
    for(const enemy of enemies) {
      const marker=definition.markers.find(item=>item.kind==='spawn'&&item.markerId===enemy.markerId&&
        node(tileId,item.spaceId)===enemy.node);
      const placed=entries.find(item=>item.id===enemy.id);
      assert(placed);assert.deepEqual(point(placed),G.rotatePoint(marker.point,rotation));
      assert.equal(placed.node,enemy.node);assert.equal(placed.anchorKind,'spawn');
    }
  }
});

test('several figures sharing a spawn node spread out while the first remains on its actual marker',()=>{
  const tileId='tile-11',id=node(tileId,'street');
  const input={tileId,rotation:0,enemies:[1,2,3,4].map(n=>({id:`minion-${n}`,node:id,markerId:'gold'})),
    hunter:{id:'hunter',node:id},tokens:[{id:'escort',node:id}]};
  const entries=L.layout(input).filter(item=>['enemy','hunter','token'].includes(item.type));
  assert.deepEqual(point(entries.find(item=>item.id==='minion-1')),[51,34]);
  for(const entry of entries) {
    assert(contains(point(entry),G.polygon(tileId,'street')),entry.id);
    assert.equal(entry.node,id);assert(!entry.crowded,`${entry.id} has enough room`);
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)
    assert(gap(entries[i],entries[j])>=entries[i].radius+entries[j].radius+2,
      `${entries[i].id}/${entries[j].id} must not overlap`);
  assert.deepEqual(L.layout(input),L.layout({...input,enemies:[...input.enemies].reverse()}),
    'positions do not change when the engine array order changes');
});

test('mission lamp occupant stays exactly on the lamp while hunter and survivor avoid its footprint',()=>{
  for(const tileId of ['tile-04','tile-14','tile-17'])for(const rotation of [0,1,2,3]) {
    const marker=G.definition(tileId).markers.find(item=>item.kind==='lamp');
    const id=node(tileId,marker.spaceId);
    const result=L.layout({tileId,rotation,enemies:[{id:'mission-enemy',node:id,anchorKind:'lamp'}],
      hunter:{id:'hunter',node:id},tokens:[{id:'rescue',node:id}]});
    const enemy=result.find(item=>item.type==='enemy');
    assert.deepEqual(point(enemy),G.rotatePoint(marker.point,rotation));
    for(const entry of result.filter(item=>['hunter','token'].includes(item.type))) {
      assert(contains(point(entry),G.polygon(tileId,marker.spaceId,rotation)));
      assert(gap(enemy,entry)>=enemy.radius+entry.radius+2);
    }
  }
});

test('survivors avoid all printed objects and unoccupied spawn marks in every geometry cell',()=>{
  for(const [tileId,definition] of Object.entries(G.tiles))for(const spaceId of Object.keys(definition.spaces)) {
    const id=node(tileId,spaceId),token={id:'visible-survivor',node:id};
    const result=L.layout({tileId,tokens:[token]});const placed=result.find(item=>item.type==='token');
    assert(placed);assert(contains(point(placed),G.polygon(tileId,spaceId)));
    for(const marker of definition.markers.filter(item=>item.spaceId===spaceId))
      assert(Math.hypot(placed.x-marker.point[0],placed.y-marker.point[1])>=11,
        `${tileId}:${spaceId} survivor overlaps ${marker.kind}`);
  }
});

test('moved enemies with no matching marker use a safe point in the logical cell, including concave spaces',()=>{
  for(const tileId of ['tile-03','tile-10','tile-12'])for(const spaceId of Object.keys(G.definition(tileId).spaces))
    for(const rotation of [0,1,2,3]) {
      const id=node(tileId,spaceId),result=L.layout({tileId,rotation,
        enemies:[{id:'moved-enemy',node:id,markerId:'unmatched'}],hunter:{id:'hunter',node:id}});
      const enemies=result.filter(item=>item.type==='enemy'||item.type==='hunter');
      assert.equal(enemies.length,2);
      for(const entry of enemies)assert(contains(point(entry),G.polygon(tileId,spaceId,rotation)));
      assert(gap(enemies[0],enemies[1])>=12);
      assert.equal(enemies[0].anchorKind,'space');
    }
});

test('rotation changes presentation coordinates only and never logical nodes or renderer input',()=>{
  const geometryBefore=JSON.stringify(G.tiles);
  const s=E.create(819414940,'beast-claw',0,null,'hunter-pistol','center',{campaign:true});
  const prefix=require('./fixtures/v089-courtyard-encounter-user-prefix.json');
  let actual=s;for(const command of prefix.commands)actual=E.dispatch(actual,command);
  const original=JSON.stringify(actual),h=E.hunter(actual);
  const input=frozen({tileId:'tile-04',rotation:0,loot:actual.loot,
    enemies:actual.enemies.map(enemy=>({id:enemy.id,node:enemy.node,anchorKind:'lamp'})),
    hunter:{id:'hunter',node:h.position},tokens:E.missionView(actual).tokens.filter(item=>item.node)});
  const normal=L.layout(input),rotated=L.layout({...input,rotation:1});
  assert.equal(normal.length,rotated.length);
  normal.forEach((item,index)=>{
    assert.equal(rotated[index].node,item.node);assert.equal(rotated[index].id,item.id);
    if(item.anchorKind&&item.anchorKind!=='space')
      assert.deepEqual(point(rotated[index]),G.rotatePoint(point(item),1));
    else {
      // Free figures repack because their bodies stay upright on a rotated tile.
      const spaceId=item.node.slice(item.node.indexOf(':')+1);
      assert(contains(point(rotated[index]),G.polygon('tile-04',spaceId,1)));
    }
  });
  assert.equal(JSON.stringify(actual),original);assert.equal(JSON.stringify(G.tiles),geometryBefore);
  assert(normal.every(item=>!('rules' in item)&&!('name' in item)&&!('card' in item)),
    'coordinate output cannot disclose unrevealed text or mission identities');
});

test('out-of-tile public entries are ignored and fallback treasure remains in its requested cell',()=>{
  const result=L.layout({tileId:'tile-11',loot:['tile-11:house'],
    enemies:[{id:'foreign',node:'tile-03:room',markerId:'gold'}],
    tokens:[{id:'foreign-survivor',node:'tile-03:room'}]});
  assert(!result.some(item=>item.id.startsWith('foreign')));
  const chest=result.find(item=>item.type==='chest');
  assert(chest.fallback);assert.equal(chest.count,1);assert.equal(chest.node,'tile-11:house');
  assert(contains(point(chest),G.polygon('tile-11','house')));
  assert.throws(()=>L.layout({tileId:'tile-11',rotation:0.5}),/./);
});

test('two spawn marks of the same kind each receive one figure before extras are dispersed',()=>{
  // Isolated geometry contract for a duplicated printed marker, not a claim
  // that the present twenty tiles contain a duplicate color in one cell.
  const original=G.tiles['tile-03'];
  try {
    G.tiles['tile-03']={...original,markers:original.markers.map(marker=>
      marker.kind==='spawn'?{...marker,markerId:'gold'}:marker)};
    const result=L.layout({tileId:'tile-03',enemies:[
      {id:'same-kind-1',node:'tile-03:room',markerId:'gold'},
      {id:'same-kind-2',node:'tile-03:room',markerId:'gold'},
    ]}).filter(item=>item.type==='enemy');
    assert.deepEqual(result.map(item=>point(item)),[[20,23],[79,23]]);
    assert(result.every(item=>!item.crowded));
  } finally {G.tiles['tile-03']=original;}
});

test('an overcrowded cell keeps every public entity inside and declares count-badge fallback honestly',()=>{
  const result=L.layout({tileId:'tile-12',tokens:Array.from({length:20},(_,index)=>
    ({id:`token-${String(index).padStart(2,'0')}`,node:'tile-12:middle-left'}))})
    .filter(item=>item.type==='token');
  assert.equal(result.length,20);
  assert(result.some(item=>item.crowded&&['spacing-reduced','cell-crowded','body-overlap','body-outside-tile'].includes(item.reason)));
  for(const entry of result)assert(contains(point(entry),G.polygon('tile-12','middle-left')));
});


function visualBox(entry) {
  const defaults={lamp:[11,20],chest:[14,12],enemy:[18,28],hunter:[18,28],token:[10,16]};
  const [width,height]=defaults[entry.type];
  const w=entry.visualWidth||width,h=entry.visualHeight||height;
  return {left:entry.x-w/2,right:entry.x+w/2,top:entry.y-h,bottom:entry.y+3};
}
function intersectsBox(a,b) {
  return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
    Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}

test('a pursuing enemy with no marker in the destination does not displace the hunter through a stationary enemy',()=>{
  for(const rotation of [0,1,2,3]) {
    const base={tileId:'tile-01',rotation,
      enemies:[{id:'scourge-beast-1',node:'tile-01:top',markerId:'gold'}],
      hunter:{id:'hunter',node:'tile-01:top'}};
    const before=L.layout(frozen(base));
    const after=L.layout({...base,enemies:[...base.enemies,
      {id:'huntsmans-minion-1',node:'tile-01:top',markerId:'red'}]});
    const hunterBefore=before.find(e=>e.id==='hunter'),hunterAfter=after.find(e=>e.id==='hunter');
    assert.deepEqual(point(hunterAfter),point(hunterBefore),`rotation${rotation}: pursuit must not trigger a cross-body hunter repack`);
    const beast=after.find(e=>e.id==='scourge-beast-1'),pursuer=after.find(e=>e.id==='huntsmans-minion-1');
    assert.deepEqual(point(beast),point(before.find(e=>e.id==='scourge-beast-1')));
    assert.equal(beast.anchorKind,'spawn');assert.equal(pursuer.anchorKind,'space');
    for(const a of [hunterAfter,beast,pursuer])for(const b of [hunterAfter,beast,pursuer]) {
      if(a===b)continue;
      assert.equal(intersectsBox(visualBox(a),visualBox(b)),0,`rotation${rotation}: ${a.id}/${b.id}`);
    }
    assert.deepEqual(after,L.layout({...base,enemies:[...base.enemies,
      {id:'huntsmans-minion-1',node:'tile-01:top',markerId:'red'}].reverse()}));
  }
});

test('two or three survivors avoid full upright character and chest rectangles in the crowded real room through all rotations',()=>{
  for(const count of [2,3])for(const rotation of [0,1,2,3]) {
    const result=L.layout({tileId:'tile-03',rotation,
      enemies:[{id:'gold-enemy',node:'tile-03:room',markerId:'gold'},
        {id:'purple-enemy',node:'tile-03:room',markerId:'purple'}],
      hunter:{id:'hunter',node:'tile-03:room'},loot:['tile-03:room','tile-03:room'],
      tokens:Array.from({length:count},(_,i)=>({id:`survivor-${i}`,node:'tile-03:room'}))});
    const tokens=result.filter(item=>item.type==='token');assert.equal(tokens.length,count);
    for(const token of tokens) {
      const bounds=visualBox(token);
      assert(bounds.left>=0&&bounds.top>=0&&bounds.right<=100&&bounds.bottom<=100,
        `rotation${rotation}/${token.id} sprite must fit in the tile`);
      assert(contains(point(token),G.polygon('tile-03','room',rotation)));
      assert(!token.crowded,`rotation${rotation}/${token.id} room has enough actual body space`);
      for(const other of result.filter(item=>item.id!==token.id))
        assert.equal(intersectsBox(bounds,visualBox(other)),0,
          `rotation${rotation}/${token.id} overlaps upright ${other.id}`);
    }
    const gold=result.find(item=>item.id==='gold-enemy'),purple=result.find(item=>item.id==='purple-enemy');
    assert.deepEqual(point(gold),G.rotatePoint([20,23],rotation));
    assert.deepEqual(point(purple),G.rotatePoint([79,23],rotation));
    const hunter=result.find(item=>item.id==='hunter');
    assert(contains(point(hunter),G.polygon('tile-03','room',rotation)));
    if(!hunter.crowded) {
      for(const other of result.filter(item=>item.id!==hunter.id))
        assert.equal(intersectsBox(visualBox(hunter),visualBox(other)),0,
          `rotation${rotation} hunter avoids full upright ${other.id}`);
    } else assert(['body-overlap','body-outside-tile','spacing-reduced','cell-crowded'].includes(hunter.reason));
  }
});

test('seed 13 pulled room enemies and hunter avoid complete bodies in the entry cell after rotation',()=>{
  const input=frozen({tileId:'tile-03',enemies:[
    {id:'huntsman-mob-1',node:'tile-03:entry',markerId:'gold'},
    {id:'scourge-beast-1',node:'tile-03:entry',markerId:'purple'},
  ],hunter:{id:'hunter',node:'tile-03:entry'},loot:['tile-03:room','tile-03:room'],
  tokens:[{id:'rescue',node:'tile-03:room'}]});
  const original=JSON.stringify(input);
  // The old foot-circle-only positions passed their radius test but covered
  // 306 tile-percent-squared of one another's upright body (18 x 17).
  const oldA={type:'enemy',x:50,y:73},oldB={type:'enemy',x:50,y:59};
  assert.equal(intersectsBox(visualBox(oldA),visualBox(oldB)),306);
  for(const rotation of [0,1,2,3]) {
    const result=L.layout({...input,rotation});
    const actors=result.filter(item=>item.type==='enemy'||item.type==='hunter');
    assert.equal(actors.length,3);
    for(const actor of actors) {
      assert.equal(actor.node,'tile-03:entry');
      assert(contains(point(actor),G.polygon('tile-03','entry',rotation)));
      assert(!actor.crowded,`rotation${rotation}/${actor.id} has enough body space`);
      for(const other of result.filter(item=>item.id!==actor.id))
        assert.equal(intersectsBox(visualBox(actor),visualBox(other)),0,
          `rotation${rotation}/${actor.id} body overlaps ${other.id}`);
    }
    const chests=result.filter(item=>item.type==='chest');
    assert.deepEqual(chests.map(point),[[37,37],[61,37]].map(p=>G.rotatePoint(p,rotation)));
    assert.deepEqual(result,L.layout({...input,rotation,enemies:[...input.enemies].reverse()}));
  }
  assert.equal(JSON.stringify(input),original);
});

test('a moved enemy sorting before a printed occupant cannot cover its reserved upright body',()=>{
  for(const rotation of [0,1,2,3]) {
    const result=L.layout({tileId:'tile-11',rotation,enemies:[
      {id:'a-moved',node:'tile-11:street',markerId:'unmatched'},
      {id:'z-printed',node:'tile-11:street',markerId:'gold'},
    ]});
    const moved=result.find(item=>item.id==='a-moved'),printed=result.find(item=>item.id==='z-printed');
    assert.deepEqual(point(printed),G.rotatePoint([51,34],rotation));
    assert.equal(intersectsBox(visualBox(moved),visualBox(printed)),0);
    assert(contains(point(moved),G.polygon('tile-11','street',rotation)));
  }
});

test('an impossible body fit preserves all logical actors and reports crowding instead of pretending they fit',()=>{
  const result=L.layout({tileId:'tile-12',enemies:[
    {id:'large-1',node:'tile-12:middle-left',anchorKind:'lamp',visualWidth:65,visualHeight:45},
    {id:'large-2',node:'tile-12:middle-left',markerId:'unmatched',visualWidth:65,visualHeight:45},
  ],hunter:{id:'hunter',node:'tile-12:middle-left',visualWidth:65,visualHeight:45}});
  const actors=result.filter(item=>item.type==='enemy'||item.type==='hunter');
  assert.equal(actors.length,3);
  assert.deepEqual(point(actors.find(item=>item.id==='large-1')),[32,51]);
  assert(actors.some(item=>item.crowded));
  for(const actor of actors) {
    assert.equal(actor.node,'tile-12:middle-left');
    assert(contains(point(actor),G.polygon('tile-12','middle-left')));
  }
});

test('survivors respect explicit large upright boss dimensions instead of rotating the sprite bounds with its tile',()=>{
  for(const rotation of [0,1,2,3]) {
    const result=L.layout({tileId:'tile-04',rotation,
      enemies:[{id:'boss',node:'tile-04:center',anchorKind:'lamp',visualWidth:36,visualHeight:40}],
      tokens:[{id:'rescue',node:'tile-04:center'},{id:'escort',node:'tile-04:center'}]});
    const boss=result.find(item=>item.type==='enemy');
    assert.equal(boss.visualWidth,36);assert.equal(boss.visualHeight,40);
    for(const token of result.filter(item=>item.type==='token')) {
      assert.equal(intersectsBox(visualBox(token),visualBox(boss)),0);
      assert(contains(point(token),G.polygon('tile-04','center',rotation)));
    }
    assert.deepEqual(point(boss),G.rotatePoint([50,50],rotation));
  }
});
