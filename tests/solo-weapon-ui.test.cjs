const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../hunt-engine'),{clickCommand}=require('./helpers/public-command-ui.cjs');
const manifest=require('./fixtures/weapon-campaign-completion/manifest.json');
const important=new Set(['ATTACK','COUNTER','TRANSFORM','FREE_TRANSFORM','ENTRY_WEAPON','WEAPON_SHOT','WEAPON_CHOICE','WEAPON_STEP','FIREARM','FIREARM_ENTRY','EQUIP_REWARD','KEEP_REWARD','KEEP_FIREARM','ENTER_BETWEEN_CHAPTERS','EQUIP_FIREARM','START_NEXT_CHAPTER']);
function check(fixture,full){
  const commands=require(path.join(__dirname,'fixtures/weapon-campaign-completion',fixture.commandsFile));
  let s=E.create(fixture.seed,fixture.weaponId,fixture.startFace,fixture.startingConsumable,fixture.initialFirearmId,fixture.startSpace,{campaign:true,rulesVersion:fixture.rulesVersion});
  const seen=new Set();let clicks=0;
  for(const [index,c]of commands.entries()){
    const mark=JSON.stringify([s.mission.chapter,E.hunter(s).face,s.phase,c.type,c.weaponBoost,c.accept]);
    if(important.has(c.type)&&!seen.has(mark)||index===commands.length-1){
      try{s=clickCommand(s,c);}catch(error){throw new Error(`${fixture.weaponId}/${fixture.startFace} command ${index+1}: ${error.message}`,{cause:error});}
      seen.add(mark);clicks++;
    }else s=E.dispatch(s,c);
  }
  assert(clicks>=3);assert.equal(E.hunter(s).weaponId,fixture.weaponId);
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
  if(full)assert.equal(s.result,'campaign-win');else {assert.equal(s.mission.chapter,1);assert(s.mission.won);}
}
for(const fixture of manifest.chapterOne)test(`offline controls preserve natural chapter-one victory: ${fixture.weaponId}/${fixture.startFace}`,()=>check(fixture,false));
for(const fixture of manifest.cases)test(`offline controls preserve natural whole-campaign victory: ${fixture.weaponId}/${fixture.startFace}`,()=>check(fixture,true));
