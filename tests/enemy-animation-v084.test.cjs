const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, atlas, poseFrames, faceA, faceB } = require('./helpers/presentation-harness-v084.cjs');
const visuals = require('../enemy-visuals');
const boss1 = 'e-cleric-beast-1', boss2 = 'e-cleric-beast-2';
const hunter = () => ({ id: 'hunter', kind: 'hunter', skin: faceA, weaponId: 'threaded-cane', weaponFace: 0, x: 80, y: 100, hp: 6 });
const enemy = (skin = boss1, phase = 1, hp = 10) => ({ id: 'e1', kind: 'enemy', skin, fallbackSkin: 'boss', enemyId: 'cleric-beast', enemySide: 'actual', enemyPhase: phase, x: 150, y: 100, hp });
function addEnemies(c) {
  for (const skin of visuals.ids) {
    const boss = skin.startsWith('e-cleric'), count = boss ? 32 : 24;
    const frames = boss ? { idle:[0,1],walk:[2,3,4,5],...Object.fromEntries(Array.from({length:5},(_,n)=>['attack-'+n,[6+4*n,7+4*n,8+4*n,9+4*n]])),hit:[26,27],death:[28,29],transform:[30,31] } : poseFrames;
    c[skin] = { path:`assets/characters/${skin}.png`,atlasPath:`assets/characters/${skin}.atlas.json`,atlasData:atlas(count),frameCount:count,
      frameWidth:512,frameHeight:512,displayHeight:boss?300:128,originY:460/512,relatedSkins:boss?[skin===boss1?boss2:boss1]:[],
      animations:Object.fromEntries(Object.entries(frames).map(([name,frames])=>[name,{frames,frameRate:name==='attack-4'?9:12}])) };
  }
}
function equipped(options={}) { const f=fixture({...options,custom(c){addEnemies(c);options.custom?.(c);}}); f.adapter.sync({sceneId:'hunt',revision:1,actors:[hunter(),enemy()]}); f.boot(); return f; }
const act=(slot,extra={})=>({type:'attack',fromId:'e1',toId:'hunter',attackStyle:'enemy',attackSlot:slot,damage:0,...extra});

for (const slot of [0,1,2,3,4]) test(`public boss action bank ${slot} uses the current boss texture`,()=>{
  const f=equipped(); f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),enemy()],actions:[act(slot)]});
  assert.equal(f.sprites[1].plays.at(-1),`bb-${boss1}-attack-${slot}`);
  assert.equal(f.sprites[1].texture,'bb-character-'+boss1);
  assert.equal(f.sprites[0].plays.at(-1),`bb-${faceA}-idle`,'zero damage does not invent a hunter hit');
});
test('recovery is a distinct resolved ability pose, without a fabricated impact',()=>{
  const f=equipped(); f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),enemy()],actions:[{type:'ability',fromId:'e1',skin:boss1,attackSlot:1,pose:'attack-1',motion:'recover'}]});
  assert.equal(f.sprites[1].plays.at(-1),`bb-${boss1}-attack-1`);
  assert.equal(f.host.dataset.presentationAbilities,'1'); assert.equal(f.adapter.status().attacks,0);
  assert.equal(f.sprites[0].plays.at(-1),`bb-${faceA}-idle`);
});
test('doctor interrupt shot keeps the doctor action bank and displays a muzzle flash',()=>{
  const f=equipped(), doctor={...enemy('e-iosefka-hostile'),enemyId:'iosefka-hostile',enemySide:'1-2',fallbackSkin:'mob'};
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),doctor]});f.finishLoad();
  f.adapter.sync({sceneId:'hunt',revision:3,actors:[hunter(),doctor],actions:[{type:'ability',fromId:'e1',skin:doctor.skin,attackSlot:2,pose:'attack-2',motion:'shot'}]});
  assert.equal(f.sprites.find(s=>!s.destroyed&&s.texture==='bb-character-e-iosefka-hostile').plays.at(-1),'bb-e-iosefka-hostile-attack-2');
  assert.equal(f.adapter.status().shots,1);assert.ok(f.graphics.some(g=>g.commands.some(c=>c[0]==='fillCircle'&&c[3]===7)));
});
test('an actual phase transition waits for the heavy source attack and uses the new phase',()=>{
  const f=equipped(); f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),enemy(boss2,2,8)],actions:[act(4,{skin:boss1}),{type:'phase',fromId:'e1',skin:boss2}]});
  assert.equal(f.sprites[1].texture,'bb-character-'+boss1,JSON.stringify({plays:f.sprites[1].plays,timers:f.timers.map(t=>t.delay),loads:f.loads.map(l=>l.key)})); assert.equal(f.timers[0].delay,445);
  f.timer(f.timers[0]);assert.equal(f.sprites[1].texture,'bb-character-'+boss2);assert.equal(f.sprites[1].plays.at(-1),`bb-${boss2}-transform`);
  assert.equal(f.host.dataset.presentationPhases,'1');
});
test('loading a current phase or repeating its action does not invent a phase transition',()=>{
  const f=equipped();f.adapter.sync({sceneId:'loaded',revision:8,actors:[hunter(),enemy(boss2,2)],actions:[{type:'phase',fromId:'e1',skin:boss2}]});
  assert.ok(!f.sprites.at(-1).plays.some(k=>k.endsWith('transform')));
  f.adapter.sync({sceneId:'loaded',revision:9,actors:[hunter(),enemy(boss2,2)],actions:[{type:'phase',fromId:'e1'}]});
  assert.equal(f.host.dataset.presentationPhases,'0');
});
test('missing original enemy sheets leave the DOM token visible and never block hunter assets',()=>{
  const f=equipped({missing:['bb-character-'+boss1]});assert.equal(f.sprites.length,1);assert.equal(f.host.dataset.presentationEnemyReady,'false');
  assert.equal(f.sprites[0].texture,'bb-character-'+faceA);assert.equal(f.adapter.status().characters,1);assert.equal(f.adapter.actorReady('e1'),false);assert.equal(f.adapter.actorReady('hunter'),true);
});
test('an enemy with no imported manifest leaves its DOM token instead of showing a generated body',()=>{
  const f=fixture();f.adapter.sync({sceneId:'hunt',revision:1,actors:[hunter(),enemy()]});f.boot();
  assert.equal(f.sprites.length,1);assert.equal(f.host.dataset.presentationEnemy,boss1);assert.equal(f.host.dataset.presentationEnemyReady,'false');assert.equal(f.adapter.actorReady('e1'),false);
});
test('reduced motion still shows the current enemy phase without animating it',()=>{
  const f=equipped({reduced:true});f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),enemy(boss2,2)],actions:[{type:'phase',fromId:'e1',skin:boss2},act(4)]});
  assert.equal(f.sprites[1].texture,'bb-character-'+boss2);assert.equal(f.host.dataset.presentationPhases,'0');assert.equal(f.adapter.status().attacks,0);
});

function offsetFixture(extra={}) { return equipped({...extra,geometry:true,custom(c){
  for (const [skin,x] of [[faceA,-34],[faceB,20]]) {
    for (const [index,frame] of Object.entries(c[skin].atlasData.frames)) {frame.renderOffset={x:+index===1?x+8:x,y:2};frame.clipRects=[{x:200,y:424,w:32,h:32}];}
  } extra.custom?.(c);
}}); }
test('frame draw offsets use true source scale and mirror without moving public or shadow anchors',()=>{
  const f=offsetFixture(), sprite=f.sprites[0], shadow=f.graphics[0];
  assert.equal(sprite.x,80-34*.25);assert.equal(sprite.y,100+2*.25);assert.equal(shadow.x,80);assert.equal(shadow.y,102);
  sprite.advanceFrame('1');assert.equal(sprite.x,80-26*.25);assert.equal(sprite.mask.graphics.x,sprite.x);assert.equal(sprite.mask.graphics.y,sprite.y);
  sprite.setFlipX(true);f.frame();assert.equal(sprite.x,80+26*.25);assert.equal(shadow.x,80);assert.equal(f.adapter.status().moves,0);
});
test('offset movement tweens the world anchor and follows frames at every intermediate position',()=>{
  const f=offsetFixture(), sprite=f.sprites[0];f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...hunter(),x:120},enemy()],actions:[{type:'move',fromId:'hunter'}]});
  const movement=f.tweens.find(t=>t.x===120);assert.notEqual(movement.targets,sprite);assert.equal(movement.targets.x,80);
  movement.targets.x=100;movement.onUpdate();assert.equal(sprite.x,100-34*.25);assert.equal(sprite.mask.graphics.x,sprite.x);
  sprite.advanceFrame('1');assert.equal(sprite.x,100-26*.25);f.tween(movement);assert.equal(sprite.x,120-34*.25);assert.equal(f.graphics[0].x,120);
});
test('source-form attack offsets restore the equipped form without moving its node',()=>{
  const f=offsetFixture(), sprite=f.sprites[0];f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...hunter(),skin:faceB,weaponFace:1},enemy()],actions:[{type:'attack',fromId:'hunter',toId:'e1',attackStyle:'weapon',attackSlot:0,skin:faceA,damage:0}]});
  assert.equal(sprite.x,80-34*.25);sprite.complete(`animationcomplete-bb-${faceA}-attack-0`);assert.equal(sprite.x,80+20*.25);assert.equal(f.graphics[0].x,80);
});
test('draw offset metadata is copied and audit-only support fields never reach Phaser',()=>{
  const f=offsetFixture();f.characters[faceA].atlasData.frames['0'].renderOffset.x=400;
  assert.equal(f.sprites[0].x,80-34*.25);
  const loaded=f.loads.find(l=>l.key==='bb-character-'+faceA).data.frames['0'];assert.deepEqual(loaded.renderOffset,{x:-34,y:2});assert.ok(!('supportAnchor' in loaded));
});
test('a pixel-source actor keeps its native asymmetry while moving and attacking toward the left',()=>{
  const f=equipped({custom(c){c[boss1].allowFlip=false;c[boss1].nativeFacing='left';c[boss1].atlasData.frames['6'].renderOffset={x:20,y:0};}});
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),{...enemy(),x:120}],actions:[{type:'move',fromId:'e1'}]});assert.equal(f.sprites[1].flipX,false);
  f.adapter.sync({sceneId:'hunt',revision:3,actors:[hunter(),{...enemy(),x:120}],actions:[act(0)]});assert.equal(f.sprites[1].flipX,false);assert.equal(f.sprites[1].x,120+20*300/512);
});
test('a genuine single-frame idle source has no invented attack bank but retains public effects',()=>{
  const f=equipped({custom(c){c[boss1].frameCount=1;c[boss1].atlasData=atlas(1);c[boss1].animations={idle:{frames:[0],frameRate:1}};c[boss1].relatedSkins=[];}});
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[hunter(),enemy()],actions:[act(3)]});
  assert.equal(f.sprites[1].plays.at(-1),`bb-${boss1}-idle`);assert.ok(!f.definitions.some(d=>d.key.startsWith(`bb-${boss1}-attack`)));assert.equal(f.adapter.status().attacks,1);
});
test('native non-square original pixel crops keep their dimensions and measured foot origin',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json'),data=manifest['e-scourge-beast-a'];assert.ok(data,'the original Scourge source is registered');
  const f=fixture({custom(c){Object.assign(c,manifest);}}),a={...enemy('e-scourge-beast-a'),enemyId:'scourge-beast',enemySide:'a',fallbackSkin:'beast'};
  f.adapter.sync({sceneId:'hunt',revision:1,actors:[hunter(),a]});f.boot();
  assert.equal(f.sprites[1].texture,'bb-character-e-scourge-beast-a');assert.deepEqual(f.sprites[1].origin,[data.originX,data.originY]);
  assert.equal(f.sprites[1].height,data.displayHeight);assert.equal(f.sprites[1].width,data.displayHeight*data.frameWidth/data.frameHeight);
  const loaded=f.loads.find(l=>l.key==='bb-character-e-scourge-beast-a');assert.deepEqual(loaded.data.frames['0'].sourceSize,{w:data.frameWidth,h:data.frameHeight});
  assert.equal(f.host.dataset.presentationEnemyReady,'true');assert.equal(f.definitions.filter(d=>d.key.startsWith('bb-e-scourge-beast-a')).length,1);
});
test('native per-frame masks respect the measured horizontal foot origin as well as scale',()=>{
  const f=equipped({geometry:true,custom(c){c[boss1].originX=.6;c[boss1].atlasData.frames['0'].clipRects=[{x:200,y:424,w:32,h:32}];}});
  assert.deepEqual(f.sprites[1].origin,[.6,460/512]);assert.ok(f.sprites[1].mask.graphics.commands.some(c=>c[0]==='fillRect'&&Math.abs(c[1]-(200-512*.6))<1e-8));
});
test('a resolved static-source attack pins the public source form without inventing a swing',()=>{
  const f=equipped({custom(c){for(const skin of [faceA,faceB]){c[skin].frameCount=1;c[skin].atlasData=atlas(1);c[skin].animations={idle:{frames:[0],frameRate:1}};}}});
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...hunter(),skin:faceB,weaponFace:1},enemy()],actions:[{type:'attack',fromId:'hunter',toId:'e1',attackStyle:'weapon',attackSlot:0,skin:faceA,damage:0}]});
  assert.equal(f.sprites[0].texture,'bb-character-'+faceA);assert.equal(f.sprites[0].plays.at(-1),`bb-${faceA}-idle`);assert.ok(!f.definitions.some(d=>d.key.includes('w-threaded-cane')&&d.key.includes('attack')));
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...hunter(),skin:faceB,weaponFace:1,x:60},enemy()]});assert.equal(f.sprites[0].texture,'bb-character-'+faceA);
  f.timer(f.timers[0]);assert.equal(f.sprites[0].texture,'bb-character-'+faceB);
});
test('a newer rule revision cancels a temporary static source and restores current equipment',()=>{
  const f=equipped({custom(c){for(const skin of [faceA,faceB]){c[skin].frameCount=1;c[skin].atlasData=atlas(1);c[skin].animations={idle:{frames:[0],frameRate:1}};}}});
  const current={...hunter(),skin:faceB,weaponFace:1};f.adapter.sync({sceneId:'hunt',revision:2,actors:[current,enemy()],actions:[{type:'attack',fromId:'hunter',toId:'e1',attackStyle:'weapon',skin:faceA,attackSlot:0}]});
  f.adapter.sync({sceneId:'hunt',revision:3,actors:[current,enemy()]});assert.equal(f.sprites[0].texture,'bb-character-'+faceB);assert.equal(f.timers[0].removed,true);
});
test('all eleven shipped original enemy profiles load only their truthful native source poses',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json');assert.equal(Object.keys(manifest).length,11);
  for(const [skin,data]of Object.entries(manifest)){
    const f=fixture({custom(c){Object.assign(c,manifest);}});f.adapter.sync({sceneId:'hunt',revision:1,actors:[hunter(),{...enemy(skin),fallbackSkin:'mob'}]});f.boot();
    assert.equal(f.sprites[1].texture,'bb-character-'+skin);assert.equal(f.host.dataset.presentationEnemyReady,'true');
    assert.equal(data.sourceProof.rgbChangedPixels,0);assert.equal(data.allowFlip,false);
    if(skin.startsWith('e-huntsman-mob-')){
      assert.equal(data.frameCount,4);assert.deepEqual(data.animations,{idle:{frames:[1],frameRate:1},walk:{frames:[0,1,2,3],frameRate:12.5}});
      assert.equal(data.sourceKind,'original-game-animation-pixels');assert.equal(data.motionCoverage,'partial-source-approach-walk-only');
      assert.deepEqual(data.sourceProof.frames.map(frame=>frame.sourceFrame),[39,40,41,42]);
      assert.equal(new Set(data.sourceProof.frames.map(frame=>frame.rgbSha256)).size,4,'four actual source frames are distinct');
    }else{
      assert.deepEqual(data.animations,{idle:{frames:[0],frameRate:1}});assert.equal(data.frameCount,1);
      assert.ok(['original-model-render-pixels','original-card-art-pixels','original-game-still-pixels'].includes(data.sourceKind));assert.equal(data.motionCoverage,'static-idle-only');
    }
    const loaded=f.loads.find(l=>l.key==='bb-character-'+skin);assert.deepEqual(loaded.data.frames['0'].sourceSize,{w:data.frameWidth,h:data.frameHeight});
  }
});

test('the shipped native Huntsman step follows public movement with each original boot support fixed to its map anchor',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json'),skin='e-huntsman-mob-a',data=manifest[skin];
  const actor={...enemy(skin),enemyId:'huntsman-mob',enemySide:'a',fallbackSkin:'mob'},f=fixture({custom(c){Object.assign(c,manifest);}});
  f.adapter.sync({sceneId:'hunt',revision:1,actors:[actor]});f.boot();const sprite=f.sprites[0];
  assert.equal(sprite.plays.at(-1),'bb-'+skin+'-idle');assert.equal(sprite.frame,'1');
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...actor,x:180}],actions:[{type:'move',fromId:'e1'}]});
  assert.equal(sprite.plays.at(-1),'bb-'+skin+'-walk');assert.equal(sprite.flipX,false);
  const movement=f.tweens.find(tween=>tween.x===180);assert.ok(movement);assert.equal(movement.duration,340);
  for(const index of [0,1,2,3]){
    sprite.advanceFrame(String(index));const frame=data.atlasData.frames[String(index)],support=frame.supportAnchor;
    const x=sprite.x+(support.x-data.originX*data.frameWidth)*sprite.scaleX;
    const y=sprite.y+(support.y-data.originY*data.frameHeight)*sprite.scaleY;
    assert.ok(Math.abs(x-actor.x)<1e-6,'native planted boot X follows public map anchor');
    assert.ok(Math.abs(y-actor.y)<1e-6,'native planted boot Y follows public map anchor');
  }
  f.tween(movement);assert.equal(sprite.plays.at(-1),'bb-'+skin+'-idle');assert.equal(sprite.frame,'1');
  assert.equal(sprite.x,180);assert.equal(sprite.y,actor.y);
});

test('uncaptured enemy attacks never borrow the Huntsman approach or the inactive patient gesture',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json');
  for(const skin of ['e-huntsman-mob-a','e-huntsman-mob-b','e-female-patient-a','e-female-patient-b']){
    const actor={...enemy(skin),enemyId:skin.includes('female')?'female-patient':'huntsman-mob',fallbackSkin:'mob'},f=fixture({custom(c){Object.assign(c,manifest);}});
    f.adapter.sync({sceneId:'hunt',revision:1,actors:[hunter(),actor]});f.boot();
    for(const slot of [0,1,2]){
      const prior=f.sprites[1].plays.length;
      f.adapter.sync({sceneId:'hunt',revision:slot+2,actors:[hunter(),actor],actions:[act(slot,{skin})]});
      assert.equal(f.sprites[1].plays.length,prior,'unavailable source attack leaves exact original idle pose');
    }
    assert.ok(!f.definitions.some(def=>def.key.startsWith('bb-'+skin+'-attack')));
  }
});

test('the shipped Cleric rule phase selects another exact original viewpoint at the same body scale and map support',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json'),front=manifest[boss1],side=manifest[boss2];
  assert.equal(front.sourceProof.sourceSha256,side.sourceProof.sourceSha256,'two original views share one unmodified model source');
  assert.notDeepEqual(front.sourceProof.nativeCrop,side.sourceProof.nativeCrop,'phase two selects the real original side angle');
  for(const data of [front,side]){
    const bounds=data.sourceProof.visibleBounds;
    assert.ok(Math.abs(data.displayHeight*(bounds[3]-bounds[1])/data.frameHeight-125)<1e-5,'same visible body scale');
    assert.equal(data.allowFlip,false);assert.deepEqual(data.animations,{idle:{frames:[0],frameRate:1}});
  }
  const f=fixture({custom(c){Object.assign(c,manifest);}});f.adapter.sync({sceneId:'hunt',revision:1,actors:[enemy()]});f.boot();
  const sprite=f.sprites[0];f.adapter.sync({sceneId:'hunt',revision:2,actors:[enemy(boss2,2)],actions:[{type:'phase',fromId:'e1',skin:boss2}]});
  assert.equal(sprite.texture,'bb-character-'+boss2);assert.equal(sprite.plays.at(-1),'bb-'+boss2+'-idle');
  assert.equal(sprite.x,150);assert.equal(sprite.y,100);assert.equal(f.host.dataset.presentationPhases,'1');
  assert.ok(!f.definitions.some(def=>def.key==='bb-'+boss2+'-phase'||def.key==='bb-'+boss2+'-transform'),'an angle change is not a captured transformation');
});

test('the clearer original Patient still retains one real cloak-covered pose and the existing visible body scale',()=>{
  const manifest=require('../assets/characters/enemy-manifest.json'),a=manifest['e-female-patient-a'],b=manifest['e-female-patient-b'];
  for(const data of [a,b]){
    assert.equal(data.sourceKind,'original-game-still-pixels');assert.equal(data.sourceProof.sourceFile,'Beast_Patient_29_%3F2.webp');
    assert.deepEqual([data.frameWidth,data.frameHeight],[500,729]);
    const bounds=data.sourceProof.visibleBounds;
    assert.ok(Math.abs(data.displayHeight*(bounds[3]-bounds[1])/data.frameHeight-75)<1e-5);
    assert.deepEqual(data.animations,{idle:{frames:[0],frameRate:1}});assert.equal(data.allowFlip,false);
  }
  assert.equal(a.sourceProof.rgbSha256,b.sourceProof.rgbSha256,'printed rule sides share the same true still');
});
test('a mapped source that is still loading moves only its public path, without a generated substitute body',()=>{
  const f=fixture({custom:addEnemies});f.boot();f.adapter.sync({sceneId:'hunt',revision:1,actors:[enemy()]});
  f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...enemy(),x:180}],actions:[{type:'move',fromId:'e1'}]});
  assert.equal(f.sprites.length,0);assert.equal(f.adapter.actorReady('e1'),false);assert.equal(f.host.dataset.presentationEnemyReady,'false');
  assert.ok(!f.graphics.some(g=>g.commands.some(c=>c[0]==='fillPoints')),'no synthetic temporary body is drawn');
  f.finishLoad();assert.equal(f.adapter.actorReady('e1'),true);assert.equal(f.sprites[0].texture,'bb-character-'+boss1);
});
test('a new unready form removes the previously loaded sprite until its actual source is ready',()=>{
  const f=equipped({missing:['bb-character-'+faceB]});f.adapter.sync({sceneId:'hunt',revision:2,actors:[{...hunter(),skin:faceB,weaponFace:1},enemy()],actions:[{type:'transform',fromId:'hunter'}]});
  assert.equal(f.adapter.actorReady('hunter'),false);assert.ok(f.sprites[0].destroyed);assert.ok(!f.sprites.some(s=>!s.destroyed&&s.texture==='bb-character-hunter'));
});
test('unmapped practice generic actors remain supported in the existing separate preview scope',()=>{
  const f=fixture();f.adapter.sync({sceneId:'practice',revision:1,actors:[{...hunter(),skin:'hunter'}, {...enemy(),skin:'mob'}]});f.boot();
  assert.equal(f.adapter.actorReady('hunter'),true);assert.equal(f.adapter.actorReady('e1'),true);assert.deepEqual(f.sprites.map(s=>s.texture),['bb-character-hunter','bb-character-mob']);
});
