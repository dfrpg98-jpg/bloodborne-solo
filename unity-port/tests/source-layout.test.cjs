'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const tools=path.resolve(__dirname,'../tools'),repository=path.resolve(__dirname,'../..');

function referenceLoader(nested){
  const root=path.join(repository,'unused-reference-fixture'),module={exports:{}},requested=[];
  vm.runInNewContext(fs.readFileSync(path.join(tools,'reference-source.cjs'),'utf8'),{
    __dirname:tools,module,require(file){
      if(file==='node:fs')return {existsSync:full=>nested&&full===path.join(root,'src/hunt-engine.js')};
      if(file==='node:path')return path;
      requested.push(file);return file;
    },
  });
  return {root,load:module.exports.from(root),requested};
}

test('historical flat reference snapshots keep their original module and data paths',()=>{
  const {root,load}=referenceLoader(false);
  assert.equal(load('hunt-engine.js'),path.join(root,'hunt-engine.js'));
  assert.equal(load('campaigns/long-hunt/data.json'),path.join(root,'campaigns/long-hunt/data.json'));
});

test('organized reference snapshots use src for runtime modules without moving component data',()=>{
  const {root,load}=referenceLoader(true);
  assert.equal(load('hunt-engine.js'),path.join(root,'src/hunt-engine.js'));
  assert.equal(load('weapon-visuals.js'),path.join(root,'src/weapon-visuals.js'));
  assert.equal(load('components/cards.js'),path.join(root,'components/cards.js'));
  assert.equal(load('campaigns/long-hunt/data.json'),path.join(root,'campaigns/long-hunt/data.json'));
});

test('organized export resolves the real source closure and keeps all writes in memory',()=>{
  const filename=path.join(tools,'export.cjs'),output=path.resolve(tools,'..'),writes=new Map(),gitCalls=[];
  const virtualFs={...fs,mkdirSync(){},writeFileSync(file,bytes){writes.set(file,String(bytes));},
    // Asset copying is outside this source-boundary check; do not duplicate art.
    readdirSync(file){assert.equal(file,path.join(repository,'assets'));return [];},
    copyFileSync(){throw Error('This check must not copy runtime art.');}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
    __dirname:tools,process:{argv:[process.execPath,filename,repository]},console:{log(){}},
    require(file){
      if(file==='node:fs')return virtualFs;
      if(file==='node:child_process')return {execFileSync(command,args,options){
        gitCalls.push({command,args,cwd:options.cwd});return args[0]==='rev-parse'?'source-layout-check\n':'';
      }};
      return require(file);
    },
  });
  const read=file=>JSON.parse(writes.get(path.join(output,file)));
  const source=read('MigrationPrivate/source-manifest-v1.json'),content=read('MigrationPrivate/content-v1.json');
  assert(source.sourceFiles.some(file=>file.path==='src/hunt-engine.js'));
  assert(source.sourceFiles.some(file=>file.path==='components/cards.js'));
  assert(source.sourceFiles.some(file=>file.path==='campaigns/long-hunt/data.json'));
  assert(!source.sourceFiles.some(file=>file.path==='hunt-engine.js'));
  for(const file of source.sourceFiles){
    const copied=writes.get(path.join(output,'ReferenceEngine',file.path));
    assert.equal(copied,fs.readFileSync(path.join(repository,file.path),'utf8'),file.path);
    assert.equal(crypto.createHash('sha256').update(copied).digest('hex'),file.sha256,file.path);
  }
  assert.equal(content.sourceGameVersion,require(path.join(repository,'package.json')).version);
  assert(content.modules['boss-components.js'].executableMembersExcluded.includes('boss-components.js.draw'));
  const commands=read('MigrationPrivate/command-catalog-v1.json').commands;
  assert(commands.length>0);assert(commands.every(command=>command.handlers.every(handler=>handler.startsWith('src/'))));
  assert.equal(gitCalls.length,2);assert(gitCalls.every(call=>call.cwd===repository));
});
