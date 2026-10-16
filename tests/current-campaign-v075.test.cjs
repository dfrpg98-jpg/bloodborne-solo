const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine.js');
const manifest=require('./fixtures/weapon-campaign-completion/manifest.json');
assert.equal(manifest.availableWeaponCount,15);
for(const item of manifest.cases)test(`historical rules thirteen public campaign completion: ${item.weaponId}`,()=>{
  const commands=require('./fixtures/weapon-campaign-completion/'+item.commandsFile);
  let s=E.create(item.seed,item.weaponId,item.startFace,null,item.initialFirearmId,item.startSpace,{campaign:true,rulesVersion:13});
  assert.equal(s.setup.rulesVersion,13);
  for(const command of commands)s=E.dispatch(s,command);
  assert.equal(s.result,'campaign-win');
  assert.equal(s.mission.chapter,3);
  assert.equal(s.setup.weaponId,item.weaponId);
  assert(E.hunter(s).hp>0);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
