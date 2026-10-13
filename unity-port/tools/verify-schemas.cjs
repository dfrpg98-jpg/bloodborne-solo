'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const Ajv=require('ajv/dist/2020'),E=require('../ReferenceEngine/hunt-engine.js'),{newSession}=require('./oracle.cjs');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const schemas=Object.fromEntries(['command','save','content','public-view'].map(name=>[name,read('schemas/'+name+'-v1.schema.json')]));
const ajv=new Ajv({allErrors:true,strict:true,allowUnionTypes:true});
for(const schema of Object.values(schemas))ajv.addSchema(schema);
let assertions=0;
function valid(name,value){const validate=ajv.getSchema(schemas[name].$id);assert(validate(value),name+': '+JSON.stringify(validate.errors));assertions++;}
function invalid(name,value){assert.equal(ajv.getSchema(schemas[name].$id)(value),false,name+' must reject invalid shape');assertions++;}
const command={type:'END_TURN',hunterId:null,recordedAt:'2026-10-13T12:00:00.000+05:30',choice:{optional:null,enabled:false,ids:[]}};
valid('command',command);invalid('command',{type:'end_turn'});
const state=E.dispatch(E.create(90),command),save=JSON.parse(E.exportSave(state));
valid('save',save);
valid('save',JSON.parse(E.exportSave(E.create(90,'burial',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:null}))));
invalid('save',{...save,version:2});
const view=newSession()({id:1,op:'create',setup:{seed:90,options:{campaign:true}}}).view;
valid('public-view',view);invalid('public-view',{...view,initialSeed:90});
const content=read('MigrationPrivate/content-v1.json');valid('content',content);invalid('content',{...content,schemaVersion:2});
// Reproduce the corrected contract defect with the old reference in memory;
// no source schema or generated artifact is modified by this check.
const previous=JSON.parse(JSON.stringify(schemas.save));
previous.properties.state.properties.commands.items.$ref='command-v1.schema.json';
const oldAjv=new Ajv({strict:true,allowUnionTypes:true});oldAjv.addSchema(schemas.command);
let previousFailure=null;
try{oldAjv.compile(previous);}catch(error){previousFailure=error.message;}
assert(previousFailure&&/(resolve reference|URN)/.test(previousFailure),'old relative command reference must fail under its URN base');assertions++;
const index=read('MigrationPrivate/Parity/index.json');
let traces=0,commands=0,checkpoints=0;
for(const entry of index.traces){
  const fixture=read('MigrationPrivate/Parity/'+entry.file);
  valid('save',fixture.expectedFinalSave);traces++;
  for(const original of fixture.commands){valid('command',original);commands++;}
  for(const checkpoint of fixture.checkpoints){valid('public-view',checkpoint.view);checkpoints++;}
}
const report={status:'passed',assertions,validator:'Ajv draft 2020-12',validatorVersion:require('ajv/package.json').version,
  schemaIds:Object.values(schemas).map(schema=>schema.$id),previousRelativeReferenceFailure:previousFailure,
  parityTraces:traces,originalCommands:commands,publicCheckpoints:checkpoints,
  scope:['all schemas compiled in an explicit ID registry','all captured final save candidates, original commands and public checkpoints','actual current and legacy source save candidates','actual oracle public view and exported content','source-accepted null hunterId and nested optional payloads','invalid format versions and unapproved public root fields'],
  excluded:['authoritative reducer replay validation by JSON Schema','nested public privacy by JSON Schema','Unity Editor compilation']};
fs.mkdirSync(path.join(root,'Validation'),{recursive:true});
fs.writeFileSync(path.join(root,'Validation/schema-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS '+assertions+' registered JSON Schema assertions (Ajv '+report.validatorVersion+').');
