'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),{newSession}=require('./oracle.cjs');
const session=newSession(),initial=session({id:1,op:'create',setup:{seed:90,options:{campaign:true}}});
session({id:2,op:'dispatch',expectedRevision:0,commands:[{type:'END_TURN',recordedAt:'2026-10-13T12:00:00.000+05:30'}]});
const build=path.join(root,'Validation/csharp-contracts');fs.mkdirSync(build,{recursive:true});
const input=path.join(build,'input.json');fs.writeFileSync(input,JSON.stringify({view:initial.view,
  save:session({id:3,op:'export-save'}).save,contentPath:path.join(root,'MigrationPrivate/content-v1.json')}));
const result=cp.spawnSync(process.argv[2]||process.env.BB_POWERSHELL||'pwsh',
  ['-NoProfile','-NonInteractive','-File',path.join(__dirname,'verify-csharp-contracts.ps1'),'-InputPath',input],{encoding:'utf8'});
if(result.error)throw result.error;
if(result.status!==0)throw Error(result.stdout+result.stderr);
const report=JSON.parse(result.stdout.trim());
fs.writeFileSync(path.join(root,'Validation/csharp-contracts-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS '+report.assertions+' compiled C# JSON contract assertions ('+report.compiler+').');
