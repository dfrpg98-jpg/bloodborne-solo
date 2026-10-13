const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../hunt-engine.js'),manifest=require('./fixtures/weapon-campaign-completion/manifest.json');
test('natural weapon completion manifest reports only the supplied public command traces',()=>{
  assert.equal(manifest.availableWeaponCount,Object.keys(E.data.weapons).filter(id=>id!=='training').length);
  assert.equal(manifest.completedWeaponCount,new Set(manifest.cases.map(c=>c.weaponId)).size);
  assert.equal(manifest.completedStartingFaceCount,manifest.cases.length);
  assert.equal(manifest.chapterOneStartingFaceCount,30);assert.equal(manifest.chapterOne.length,30);
  assert.equal(manifest.completedWeaponCount,15,'release includes a normal full-campaign victory for every supplied weapon');
  assert([...manifest.chapterOne,...manifest.cases].every(c=>c.startingConsumable===null),'test starting gifts are excluded from natural victory evidence');
});
for(const fixture of manifest.chapterOne)test(`${fixture.weaponId}, initial face ${fixture.startFace}: chapter-one natural win using the supplied default firearm`,()=>{
  assert.equal(fixture.startingConsumable,null,'normal campaign setup must not grant a practice consumable');
  const commands=require(path.join(__dirname,'fixtures/weapon-campaign-completion',fixture.commandsFile));
  let s=E.create(fixture.seed,fixture.weaponId,fixture.startFace,fixture.startingConsumable,fixture.initialFirearmId,fixture.startSpace,{campaign:true,rulesVersion:fixture.rulesVersion}),completed=0;
  assert.equal(E.hunter(s).firearmId,E.data.weapons[fixture.weaponId].defaultFirearm||'hunter-pistol');
  for(const command of commands){s=E.dispatch(s,command);assert.equal(E.hunter(s).weaponId,fixture.weaponId);if(s.mission.completed.length>completed){completed=s.mission.completed.length;const loaded=E.importSave(E.exportSave(s));assert.deepEqual(loaded,s);s=loaded;}}
  assert.equal(s.mission.chapter,1);assert(s.mission.won);assert.equal(s.commands.length,fixture.commandCount);assert.equal(s.track,fixture.finalTrack);assert.deepEqual([...s.mission.completed].sort((a,b)=>a-b),[4,7,15]);assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
for(const fixture of manifest.cases)test(`${fixture.weaponId}, initial face ${fixture.startFace}: natural three-chapter victory and exact save checkpoints`,()=>{
  assert.equal(fixture.startingConsumable,null,'normal campaign setup must not grant a practice consumable');
  const commands=require(path.join(__dirname,'fixtures/weapon-campaign-completion',fixture.commandsFile));
  let s=E.create(fixture.seed,fixture.weaponId,fixture.startFace,fixture.startingConsumable,fixture.initialFirearmId,fixture.startSpace,{campaign:true,rulesVersion:fixture.rulesVersion});
  assert.equal(E.hunter(s).firearmId,E.data.weapons[fixture.weaponId].defaultFirearm||'hunter-pistol');
  const chapters=new Set([1]),bossPhases=new Set(),storageCheckpoints=new Set(),weaponChoices=new Set();
  const checkpoint=mark=>{const loaded=E.importSave(E.exportSave(s));assert.deepEqual(loaded,s,mark);s=loaded;storageCheckpoints.add(mark);};
  checkpoint('creation');
  for(const [index,command]of commands.entries()){
    s=E.dispatch(s,command);assert.equal(s.commands.length,index+1);assert.equal(E.hunter(s).weaponId,fixture.weaponId);
    if(!chapters.has(s.mission.chapter)){chapters.add(s.mission.chapter);checkpoint(`chapter-${s.mission.chapter}`);}
    const boss=s.enemies.find(e=>e.componentId==='cleric-beast'&&e.missionId==='main');
    if(boss){const mark=`${s.mission.chapter}:${boss.componentPhase}`;assert.equal(boss.actualComponent,true);assert.equal(E.enemyDef(s,boss).maxHp,boss.componentPhase===1?10:8);if(!bossPhases.has(mark)){bossPhases.add(mark);checkpoint(`boss-${mark}`);}}
    if(['between_chapters','weapon_choice','weapon_entry','free_transform','firearm_react'].includes(s.phase)&&!weaponChoices.has(s.phase)){weaponChoices.add(s.phase);checkpoint(s.phase);}
  }
  assert.deepEqual([...chapters],[1,2,3]);assert.deepEqual([...bossPhases],['2:1','2:2','3:1','3:2']);
  assert.equal(s.result,'campaign-win');assert.equal(s.mission.chapter,3);assert.equal(s.commands.length,fixture.commandCount);assert.equal(s.track,fixture.finalTrack);assert.equal(E.hunter(s).hp,fixture.finalHp);assert.equal(E.hunter(s).firearmId,fixture.finalFirearmId);
  checkpoint('campaign-win');assert(storageCheckpoints.size>=8);assert.equal(storageCheckpoints.size,fixture.saveCheckpointCount);
});
