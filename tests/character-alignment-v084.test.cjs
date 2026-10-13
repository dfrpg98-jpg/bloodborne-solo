'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),dir=path.join(base,'assets','characters');
const weapons=JSON.parse(fs.readFileSync(path.join(dir,'weapon-manifest.json'),'utf8'));
const generic=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');

test('native stills and five fallback atlases expose finite draw offsets in their actual source coordinates',()=>{
 assert.equal(Object.keys(weapons).length,30,'partial internal assets are not a complete release');
 assert.equal(Object.keys(generic).length,5);let count=0;
 for(const [skin,m]of Object.entries({...generic,...weapons})){const S=m.frameHeight,ox=m.originX??.5,oy=m.originY;
  assert.ok(S>=64&&S<=4096);for(const [key,f]of Object.entries(m.atlasData.frames)){count++;
   assert.deepEqual(f.sourceSize,{w:S,h:S});assert.deepEqual(Object.keys(f.renderOffset).sort(),['x','y']);
   assert.ok(Object.values(f.renderOffset).every(n=>Number.isFinite(n)&&Math.abs(n)<=S/2));
   assert.ok(Number.isFinite(f.supportAnchor.x)&&Number.isFinite(f.supportAnchor.y));
   assert.ok(Math.abs(f.supportAnchor.targetX-S*ox)<.001);assert.ok(Math.abs(f.supportAnchor.targetY-S*oy)<.001);
   assert.ok(['support-locked','animation-bank-baseline'].includes(f.supportAnchor.policy));
   assert.ok(Number.isInteger(f.supportAnchor.referenceFrame));}
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(base,m.atlasPath),'utf8')),m.atlasData,skin);}
 assert.equal(count,110,'30 genuine stills plus80 existing fallback frames; no fabricated extra poses');
});

test('original weapon idle support remains pinned to the actor anchor at its native scale',()=>{
 for(const [skin,m]of Object.entries(weapons)){const f=m.atlasData.frames[0],S=m.frameHeight;
  assert.equal(f.supportAnchor.policy,'support-locked');assert.equal(f.supportAnchor.referenceFrame,0);
  assert.ok(Math.abs(f.supportAnchor.x+f.renderOffset.x-S*m.originX)<.001,skin);
  assert.ok(Math.abs(f.supportAnchor.y+f.renderOffset.y-S*m.originY)<.001,skin);
  assert.ok(Math.abs(m.displayHeight*m.bodyNormalization.measuredBodyHeight/S-75)<.001,skin);}
});

test('Burial Blade idle cannot alternate between unaligned unrelated still poses',()=>{
 for(const skin of ['w-burial-a','w-burial-b']){const m=weapons[skin];assert.ok(m,skin);
  assert.equal(m.frames,1);assert.equal(m.frameCount,1);assert.deepEqual(m.animations.idle.frames,[0]);
  assert.equal(Object.keys(m.atlasData.frames).length,1);assert.equal(m.provenance.pixelSource,'existing-gameplay-capture');
  assert.equal(m.provenance.imageGenerationUsed,false);assert.equal(m.allowFlip,false);}
});

test('existing fallback attack banks preserve their own intentional lunge delta',()=>{
 let moving=0;for(const [skin,m]of Object.entries(generic))for(const indexes of [[8,9,10,11],[12,13],[14,15]]){
  const first=m.atlasData.frames[indexes[0]];for(const i of indexes){const f=m.atlasData.frames[i];
   assert.equal(f.supportAnchor.policy,'animation-bank-baseline');assert.equal(f.supportAnchor.referenceFrame,indexes[0]);
   assert.deepEqual(f.renderOffset,first.renderOffset);const before=f.supportAnchor.x-first.supportAnchor.x;
   const after=f.supportAnchor.x+f.renderOffset.x-first.supportAnchor.x-first.renderOffset.x;
   assert.ok(Math.abs(before-after)<.001,`${skin}/${i}`);if(Math.abs(before)>10)moving++;}}
 assert.ok(moving>0);
});

test('Beast Claw uses the supplied paired person/outfit pixels without an automatic facing flip or recolour',()=>{
 const a=weapons['w-beast-claw-a'],b=weapons['w-beast-claw-b'];
 assert.equal(a.provenance.sourceFilename,'20261011_235510.jpg');assert.equal(b.provenance.sourceFilename,'20261011_235516.jpg');
 assert.notEqual(a.sha256,b.sha256);for(const m of [a,b]){assert.equal(m.allowFlip,false);
  assert.equal(m.provenance.rgbRecoloured,false);assert.equal(m.provenance.rgbResampled,false);assert.equal(m.provenance.imageGenerationUsed,false);
  assert.equal(m.provenance.staticPoseOnly,true);assert.ok(Math.abs(m.bodyNormalization.estimatedVisibleHeight-75)<.001);}
 assert.ok(Math.abs(a.bodyNormalization.estimatedVisibleHeight-b.bodyNormalization.estimatedVisibleHeight)<.001);
});

test('generic fallback keeps five original identities, raw image hashes and an independent runtime global',()=>{
 assert.deepEqual(Object.keys(generic).sort(),['hunter','mob','beast','boss','female'].sort());
 const previous=Object.freeze({weapons:true}),context={window:{BBWeaponCharacterAssets:previous}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'manifest.js'),'utf8'),context);assert.equal(context.window.BBWeaponCharacterAssets,previous);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.BBCharacterAssets)),generic);
 for(const [skin,m]of Object.entries(generic)){assert.equal(hash(fs.readFileSync(path.join(base,m.path))),m.sha256,skin);
  assert.equal(Object.keys(m.atlasData.frames).length,16);assert.equal(m.alignment.sourceBytesUnchanged,true);
  for(const index of [0,1,2,3,4,5,6,7]){const f=m.atlasData.frames[index];
   assert.ok(Math.abs(f.supportAnchor.x+f.renderOffset.x-256)<.001);assert.ok(Math.abs(f.supportAnchor.y+f.renderOffset.y-460)<.001);}}
});
