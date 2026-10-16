const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.join(__dirname,'..'),meta=require('../assets/characters/manifest.json');
const named=require('../src/enemy-visuals').ids,legacy=['beast','boss','female','hunter','mob'];
test('offline character manifest exposes only local texture metadata and agrees with its JSON source',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'assets/characters/manifest.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.BBCharacterAssets)),meta);
 assert.deepEqual(Object.keys(meta).sort(),[...legacy,...named].sort());
 assert.doesNotMatch(JSON.stringify(meta),/https?:|bossDecks|missionBranch|참고자료|long-hunt\/images/);
});
for(const skin of legacy) test(`${skin} has sixteen bounded transparent PNG atlas frames with preserved padding and an explicit ground anchor`,()=>{
 const d=meta[skin];
 const png=fs.readFileSync(path.join(root,d.path)),atlas=JSON.parse(fs.readFileSync(path.join(root,d.atlasPath),'utf8'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png[25],6,'RGBA PNG retains transparency');
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),d.sha256);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.deepEqual(d.dimensions,[width,height]);assert.deepEqual(atlas,d.atlasData);assert.equal(Object.keys(atlas.frames).length,16);
 for(let index=0;index<16;index++){
  const f=atlas.frames[index],r=f.frame,t=f.spriteSourceSize,s=f.sourceSize;
  assert(r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);
  assert(t.x>=0&&t.y>=0&&t.x+t.w<=s.w&&t.y+t.h<=s.h);assert.deepEqual([s.w,s.h],[d.frameWidth,d.frameHeight]);
  assert.equal(t.y+t.h,460,'preserve the packed source rectangle bottom, including transparent padding');
  assert.equal(d.originY*s.h,skin==='beast'?432:460,'the ground anchor is independent of packed transparent padding');
 }
});

test('named enemies use six independent required textures instead of aliases to generic bodies',()=>{
 const existing=new Set(legacy.map(skin=>meta[skin].sha256)),namedHashes=[];
 for(const skin of named){const d=meta[skin];assert(d,skin);
  assert.notEqual(d.optional,true,`${skin}: the named bodies load as required actors`);
  assert.equal(d.path,`assets/characters/${skin}.png`);assert.equal(d.atlasPath,`assets/characters/${skin}.atlas.json`);
  assert(!existing.has(d.sha256),`${skin}: use newly drawn pixels, not a renamed generic image`);namedHashes.push(d.sha256);
 }
 assert.equal(new Set(namedHashes).size,named.length,'the six enemies remain visibly distinct texture sources');
});

for(const skin of named) test(`${skin} retains bounded transparent atlas data and all five animated states`,()=>{
 const d=meta[skin];assert(d,skin);
 const png=fs.readFileSync(path.join(root,d.path)),atlas=JSON.parse(fs.readFileSync(path.join(root,d.atlasPath),'utf8'));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png[25],6,'RGBA texture retains alpha');
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),d.sha256);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.deepEqual(d.dimensions,[width,height]);assert.deepEqual(atlas,d.atlasData);
 assert.equal(d.frameCount??d.frames,16);assert.equal(Object.keys(atlas.frames).length,16);
 assert(Number.isFinite(d.originY)&&d.originY>=.5&&d.originY<=1,'explicit stable ground anchor');
 assert(Number.isFinite(d.displayHeight)&&d.displayHeight>=24&&d.displayHeight<=(skin==='cleric-beast'?512:256),'explicit map-scale size');
 for(let index=0;index<16;index++){
  const f=atlas.frames[index],r=f.frame,t=f.spriteSourceSize,s=f.sourceSize;
  assert(r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);
  assert(t.x>=0&&t.y>=0&&t.w===r.w&&t.h===r.h&&t.x+t.w<=s.w&&t.y+t.h<=s.h);
  assert.deepEqual([s.w,s.h],[d.frameWidth,d.frameHeight]);assert.notEqual(f.rotated,true);
 }
 const animations=d.animations||{idle:[0,1,2,3],walk:[4,5,6,7],attack:[8,9,10,11],hit:[12,13],death:[14,15]};
 for(const pose of ['idle','walk','attack','hit','death']){
  const frames=Array.isArray(animations[pose])?animations[pose]:animations[pose]?.frames;
  assert(Array.isArray(frames)&&frames.length>=2,`${skin}/${pose}: preserve an animated state`);
  assert(frames.every(frame=>Number.isInteger(frame)&&frame>=0&&frame<16),`${skin}/${pose}: bounded frame index`);
  assert(new Set(frames).size>=2,`${skin}/${pose}: do not reduce the state to one repeated frame`);
 }
});
