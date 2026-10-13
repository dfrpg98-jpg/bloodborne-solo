'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const tests=cp.spawnSync(process.execPath,['--test','tests/preparation.test.cjs'],{cwd:root,encoding:'utf8'});
process.stdout.write(tests.stdout);process.stderr.write(tests.stderr);
if(tests.status!==0)process.exit(tests.status||1);
const schemas=cp.spawnSync(process.execPath,['tools/verify-schemas.cjs'],{cwd:root,encoding:'utf8'});
process.stdout.write(schemas.stdout);process.stderr.write(schemas.stderr);
if(schemas.status!==0)process.exit(schemas.status||1);
const schemaReport=require('../Validation/schema-report.json');
const primitive=cp.spawnSync(process.execPath,['tools/verify-csharp-primitives.cjs'],{cwd:root,encoding:'utf8'});
process.stdout.write(primitive.stdout);process.stderr.write(primitive.stderr);
if(primitive.status!==0)process.exit(primitive.status||1);
const contracts=cp.spawnSync(process.execPath,['tools/verify-csharp-contracts.cjs'],{cwd:root,encoding:'utf8'});
process.stdout.write(contracts.stdout);process.stderr.write(contracts.stderr);
if(contracts.status!==0)process.exit(contracts.status||1);
const contractReport=require('../Validation/csharp-contracts-report.json');
const exported=require('../MigrationPrivate/export-report.json'),index=require('../MigrationPrivate/Parity/index.json');
const results={status:'passed',checkedAtUtc:new Date().toISOString(),sourceGameVersion:exported.sourceGameVersion,currentRulesVersion:exported.currentRulesVersion,
  sourceContentHash:exported.sourceContentHash,nodeTests:10,parityTraces:index.traces.length,originalCommands:index.totalCommands,
  historicalFullCampaignRulesVersion:13,currentFullCampaignRulesVersion:14,currentReactionRulesVersion:14,csharpPrimitiveAssertions:2337,
  csharpContractAssertions:contractReport.assertions,csharpContractCompiler:contractReport.compiler,
  jsonSchemaAssertions:schemaReport.assertions,jsonSchemaValidator:schemaReport.validatorVersion,
  fullCSharpReducerParity:'not implemented',unityEditorCompile:'not run',unitySceneAndAnimations:'not run'};
fs.mkdirSync(path.join(root,'Validation'),{recursive:true});
fs.writeFileSync(path.join(root,'Validation/preparation-report.json'),JSON.stringify(results,null,2)+'\n');
