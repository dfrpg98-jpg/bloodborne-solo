const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {referenceRoot,referenceSource}=require('./helpers/reference-source.cjs');
function cleanFixture(folder,prefix){
 const absolute=path.resolve(folder),temp=path.resolve(os.tmpdir());
 assert.equal(path.dirname(absolute),temp,'only the explicitly created temporary child directory is removed');
 assert(path.basename(absolute).startsWith(prefix));
 fs.rmSync(absolute,{recursive:true,force:true});
}
function withRoot(value,run){
 const old=process.env.BB_REFERENCE_ROOT;
 try{if(value===undefined)delete process.env.BB_REFERENCE_ROOT;else process.env.BB_REFERENCE_ROOT=value;return run();}
 finally{if(old===undefined)delete process.env.BB_REFERENCE_ROOT;else process.env.BB_REFERENCE_ROOT=old;}
}
test('source audit defaults to its own project and an explicit developer directory supplies only the selected raw image',()=>{
 withRoot(undefined,()=>assert.equal(referenceRoot(),fs.realpathSync(path.resolve(__dirname,'..'))));
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bb-reference-audit-'));
 try{
  fs.mkdirSync(path.join(folder,'components/images'),{recursive:true});
  const file=path.join(folder,'components/images/probe.jpg'),bytes=Buffer.from('unaltered provenance probe');fs.writeFileSync(file,bytes);
  withRoot(folder,()=>{assert.equal(referenceRoot(),fs.realpathSync(folder));assert.equal(referenceSource('components/images/probe.jpg'),fs.realpathSync(file));assert.deepEqual(fs.readFileSync(referenceSource('components/images/probe.jpg')),bytes);});
 }finally{cleanFixture(folder,'bb-reference-audit-');}
});
test('source override rejects absolute/traversing/runtime/data paths rather than redirecting game files',()=>{
 for(const file of ['../components/images/a.jpg','components/images/../../a.jpg','C:\\other\\a.jpg','/other/a.jpg','assets/characters/w-burial-a.png','campaigns/long-hunt/data.json','hunt-engine.js','save.json'])
  assert.throws(()=>referenceSource(file),/relative path|directory boundaries|Only raw reference/);
});
test('bad explicit roots and missing original images fail without searching another project',()=>{
 for(const value of ['', 'relative-folder'])withRoot(value,()=>assert.throws(()=>referenceRoot(),/one absolute/));
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bb-reference-missing-'));
 try{
  withRoot(path.join(folder,'nonexistent'),()=>assert.throws(()=>referenceSource('components/images/probe.jpg'),/ENOENT/));
  withRoot(folder,()=>assert.throws(()=>referenceSource('campaigns/long-hunt/images/intro.jpg'),/ENOENT/));
 }finally{cleanFixture(folder,'bb-reference-missing-');}
});
