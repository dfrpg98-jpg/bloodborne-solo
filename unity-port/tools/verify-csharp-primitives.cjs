'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),vectors=require('../MigrationPrivate/Parity/numeric-vectors.json');
const build=path.join(root,'Validation/csharp-primitives');fs.mkdirSync(build,{recursive:true});
let assertions=[],count=0;
for(const item of vectors.rng){
  assertions.push(`Check(DeterministicRandom.MixSeed(${item.seed}u)==${item.mixedSeed}u,"mix${item.seed}");`);
  assertions.push(`r=new DeterministicRandom(${item.mixedSeed}u);`);count++;
  for(const [i,value]of item.values.entries()){assertions.push(`r.Next();Check(r.State==${value}u,"draw${item.seed}-${i}");`);count++;}
  assertions.push(`r=new DeterministicRandom(${item.mixedSeed}u); int[] a${item.seed}={0,1,2,3,4,5,6,7,8,9,10,11}; r.Shuffle(a${item.seed});`);
  for(let i=0;i<12;i++){assertions.push(`Check(a${item.seed}[${i}]==${item.shuffle[i]},"shuffle${item.seed}-${i}");`);count++;}
  assertions.push(`Check(r.State==${item.shuffleFinalRng}u,"shuffleRng${item.seed}");`);count++;
}
for(const [i,item]of vectors.geometry.entries()){
  assertions.push(`p=TileCoordinates.Rotate(new TilePoint(${item.input[0]},${item.input[1]}),${item.rotation});Check(p.X==${item.point[0]}&&p.Y==${item.point[1]},"point${i}");`);count++;
  const original=require('../MigrationPrivate/content-v1.json').tileGeometry[item.tileId].spaces[item.spaceId].polygon;
  for(const [j,vertex]of original.entries()){
    const result=item.polygon[j];assertions.push(`p=TileCoordinates.Rotate(new TilePoint(${vertex[0]},${vertex[1]}),${item.rotation});Check(p.X==${result[0]}&&p.Y==${result[1]},"polygon${i}-${j}");`);count++;
  }
}
assertions.push('p=TileCoordinates.UnityLocal(new TilePoint(0,100),2);Check(p.X==-1&&p.Y==-1,"y-up-bottom-left");');count++;
const harness='using System;using Bloodborne.Port.Domain;class PrimitiveCheck {static void Check(bool ok,string name){if(!ok)throw new Exception(name);}static void Main(){DeterministicRandom r;TilePoint p;'+assertions.join('\n')+'Console.WriteLine("PASS '+count+' C# primitive parity assertions");}}';
const file=path.join(build,'PrimitiveCheck.cs'),exe=path.join(build,'PrimitiveCheck.exe');fs.writeFileSync(file,harness);
const compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
const compile=cp.spawnSync(compiler,['/nologo','/optimize+','/out:'+exe,path.join(root,'UnityStarter/Assets/Bloodborne/Scripts/Domain/DeterministicPrimitives.cs'),file],{encoding:'utf8'});
if(compile.status!==0)throw Error(compile.stdout+compile.stderr);
const result=cp.spawnSync(exe,[],{encoding:'utf8'});if(result.status!==0)throw Error(result.stdout+result.stderr);
fs.writeFileSync(path.join(root,'Validation/csharp-primitives-report.json'),JSON.stringify({status:'passed',assertions:count,
  compiler,compilerVersion:'Microsoft .NET Framework C# compiler (local)',scope:['unsigned xorshift32','seed avalanche','Fisher-Yates order and RNG advancement','20-tile points and all polygon vertices under eight signed/wrapped quarter turns','Unity y-up conversion'],
  excluded:['full C# reducers','Unity Editor compilation','Newtonsoft DTO compilation','sprite rendering','animations','map scene execution']},null,2)+'\n');
console.log(result.stdout.trim());
