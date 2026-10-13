'use strict';
// The user requested source photo/video pixels in v084. Actual asset checks
// now validate native stills; synthetic animation-bank tests remain separate.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),dir=path.join(base,'assets','characters');
const metadata=JSON.parse(fs.readFileSync(path.join(dir,'weapon-manifest.json'),'utf8'));
const components=JSON.parse(fs.readFileSync(path.join(base,'components','extended-weapons.json'),'utf8'));
const ids=[...components.weapons.map(w=>w.id),'burial'];
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function decodePng(raw){
 const width=raw.readUInt32BE(16),height=raw.readUInt32BE(20),chunks=[];
 assert.equal(raw[24],8);assert.equal(raw[25],6);assert.equal(raw[28],0);
 for(let p=8;p<raw.length;){const n=raw.readUInt32BE(p),kind=raw.subarray(p+4,p+8).toString('ascii');if(kind==='IDAT')chunks.push(raw.subarray(p+8,p+8+n));p+=n+12;}
 const input=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4,rgba=Buffer.alloc(stride*height);
 assert.equal(input.length,(stride+1)*height);
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<height;y++){const kind=input[y*(stride+1)];assert.ok(kind<=4);
  for(let x=0;x<stride;x++){const i=y*stride+x,v=input[y*(stride+1)+1+x],a=x>=4?rgba[i-4]:0,b=y?rgba[i-stride]:0,c=y&&x>=4?rgba[i-stride-4]:0;
   const predictor=kind===0?0:kind===1?a:kind===2?b:kind===3?Math.floor((a+b)/2):paeth(a,b,c);rgba[i]=(v+predictor)&255;}}
 const rgb=Buffer.alloc(width*height*3);let foreground=0,clear=0;
 for(let i=0;i<width*height;i++){rgba.copy(rgb,i*3,i*4,i*4+3);if(rgba[i*4+3]>16)foreground++;if(rgba[i*4+3]===0)clear++;}
 return {width,height,rgb,foreground,clear};
}

test('all fifteen weapons retain both exact public form IDs with reciprocal native source sheets',()=>{
 assert.equal(Object.keys(metadata).length,30,'internal partial generation is not a complete release');
 for(const id of ids)for(const face of [0,1]){const key=`w-${id}-${face?'b':'a'}`,m=metadata[key];assert.ok(m,key);assert.equal(m.weaponId,id);assert.equal(m.face,face);
  assert.deepEqual(m.relatedSkins,[`w-${id}-${face?'a':'b'}`]);assert.ok(m.weaponName&&m.formName);}
 assert.equal(new Set(Object.values(metadata).map(m=>m.sha256)).size,30);
});

test('runtime PNGs retain their native crop dimensions and byte-exact cutout copy hash',()=>{
 for(const [key,m]of Object.entries(metadata)){const raw=fs.readFileSync(path.join(base,m.path));
  assert.deepEqual([...raw.subarray(0,8)],[137,80,78,71,13,10,26,10],key);
  assert.deepEqual([raw.readUInt32BE(16),raw.readUInt32BE(20)],m.dimensions,key);assert.equal(hash(raw),m.sha256,key);
  assert.equal(m.provenance.sourceCutoutSha256,m.sha256);assert.equal(m.provenance.runtimePngByteExactToCutout,true);
  assert.equal(m.provenance.rgbResampled,false);assert.equal(m.provenance.rgbRecoloured,false);assert.equal(m.provenance.imageGenerationUsed,false);}
});

test('independently decoded PNG RGB exactly equals the original decoded photo or video crop',()=>{
 for(const [key,m]of Object.entries(metadata)){const decoded=decodePng(fs.readFileSync(path.join(base,m.path)));
  assert.equal(hash(decoded.rgb),m.provenance.sourceRgbSha256,key);assert.equal(hash(decoded.rgb),m.provenance.outputRgbSha256,key);
  assert.equal(m.provenance.changedRgbPixels,0);assert.ok(decoded.clear>0,`${key}: real transparent background`);
  assert.ok(decoded.foreground>1000,`${key}: substantive original subject pixels`);
  assert.equal(decoded.foreground,m.provenance.foregroundAlphaOver16,key);}
});

test('one source still is one idle pose, with no fabricated walk, attacks or 24-frame motion claims',()=>{
 for(const [key,m]of Object.entries(metadata)){assert.equal(m.frameCount,1,key);assert.equal(m.frames,1,key);
  assert.deepEqual(Object.keys(m.atlasData.frames),['0']);assert.deepEqual(Object.keys(m.animations),['idle']);
  assert.deepEqual(m.animations.idle,{frames:[0],frameRate:1,repeat:-1});assert.equal(m.provenance.staticPoseOnly,true);
  assert.equal(m.provenance.fullAnimationCaptured,false);assert.equal(m.allowFlip,false);}
});

test('native virtual padding contains every source pixel and uses a measured 75px body instead of weapon height',()=>{
 for(const [key,m]of Object.entries(metadata)){const f=m.atlasData.frames[0],r=f.frame,s=f.spriteSourceSize,S=m.frameHeight;
  assert.ok(S>=m.dimensions[1]&&S<=4096,key);assert.deepEqual(f.sourceSize,{w:S,h:S});
  assert.deepEqual(r,{x:0,y:0,w:m.dimensions[0],h:m.dimensions[1]});assert.deepEqual([s.w,s.h],[r.w,r.h]);
  assert.ok(s.x>=0&&s.y>=0&&s.x+s.w<=S&&s.y+s.h<=S);assert.equal(m.originX,.5);assert.ok(m.originY>0&&m.originY<=1);
  const n=m.bodyNormalization;assert.equal(n.targetVisibleHeight,75);assert.ok(n.measuredBodyHeight>50);
  assert.ok(Math.abs(m.displayHeight*n.measuredBodyHeight/S-75)<.001,key);
  assert.ok(Math.abs(f.supportAnchor.x+f.renderOffset.x-S*m.originX)<.001);
  assert.ok(Math.abs(f.supportAnchor.y+f.renderOffset.y-S*m.originY)<.001);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(base,m.atlasPath),'utf8')),m.atlasData,key);}
});

test('fourteen card appearance pairs point to their actual supplied photographs and hashes',()=>{
 for(const w of components.weapons)for(const face of [0,1]){const m=metadata[`w-${w.id}-${face?'b':'a'}`],source=w.faces[face].source;
  assert.equal(m.provenance.pixelSource,'user-card-photograph');assert.equal(m.provenance.sourceFilename,source.filename);
  assert.equal(m.provenance.sourceSha256,source.sha256);assert.equal(m.provenance.sourceFileUnchanged,true);
  assert.deepEqual(m.provenance.sourceDimensions,[4000,3000]);
  const [l,t,r,b]=m.provenance.sourceCropBounds;assert.ok(l>=0&&t>=0&&r<=4000&&b<=3000&&r>l&&b>t);}
});

test('asset globals remain separate and runtime URLs serve transparent derivatives without full card photos',()=>{
 const existing=Object.freeze({keep:true}),context={window:{BBCharacterAssets:existing}};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'weapon-manifest.js'),'utf8'),context);
 assert.equal(context.window.BBCharacterAssets,existing);assert.deepEqual(JSON.parse(JSON.stringify(context.window.BBWeaponCharacterAssets)),metadata);
 for(const [key,m]of Object.entries(metadata)){for(const p of [m.path,m.atlasPath,m.atlasData.meta.image]){
  assert.ok(!/\.jpe?g(?:$|[?#])/i.test(p),key);assert.ok(!p.includes('참고자료')&&!p.includes('components/images'),key);assert.ok(!/^(?:https?:|file:|[A-Z]:)/i.test(p));}
  assert.equal(path.basename(m.provenance.sourceFilename),m.provenance.sourceFilename);assert.match(m.provenance.sourceSha256,/^[a-f\d]{64}$/);
  assert.equal(typeof m.provenance.sourceAlreadyClipped,'boolean');assert.ok(Array.isArray(m.provenance.sourceLimitations));}
});
