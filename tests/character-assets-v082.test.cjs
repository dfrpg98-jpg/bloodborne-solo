const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.join(__dirname,'..'),meta=require('../assets/characters/manifest.json');
test('offline character manifest exposes only local texture metadata and agrees with its JSON source',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'assets/characters/manifest.js'),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.BBCharacterAssets)),meta);
 assert.deepEqual(Object.keys(meta).sort(),['beast','boss','female','hunter','mob']);
 assert.doesNotMatch(JSON.stringify(meta),/https?:|bossDecks|missionBranch|참고자료|long-hunt\/images/);
});
for(const [skin,d]of Object.entries(meta)) test(`${skin} has sixteen bounded transparent PNG atlas frames with preserved padding and an explicit ground anchor`,()=>{
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
