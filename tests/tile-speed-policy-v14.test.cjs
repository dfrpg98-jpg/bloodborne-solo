'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../hunt-engine'),
  UI=require('../hunt-combat-feedback'),Effects=require('../hunt-enemy-mission-effects'),
  {missionCheckpoint,ordinaryCheckpoint}=require('./helpers/tile-speed-checkpoints.cjs');
const replay=(s,commands)=>commands.reduce((s,c)=>E.dispatch(s,c),s);
for(const card of [10,31]){
  test('mission '+card+' exact legacy replay, recorded adoption, corrected chapel special and resolve',()=>{
    const r=missionCheckpoint(card),original=E.exportSave(r.before),legacy=E.importSave(original);
    assert.deepEqual(legacy,r.before);assert.deepEqual(E.importSave(E.exportSave(r.legacy)),r.legacy);
    const adopted=E.applyTileSpeedRuling(legacy);assert.equal(adopted.tileSpeedRuling,'all-attacks');
    assert.deepEqual(adopted.commands.slice(0,-1),legacy.commands);assert.equal(adopted.setup.rulesVersion,14);
    const changed=structuredClone(adopted);delete changed.tileSpeedRuling;changed.commands.pop();changed.revision--;
    assert.deepEqual(changed,legacy,'adoption must not run gameplay hooks');
    assert.strictEqual(E.applyTileSpeedRuling(adopted),adopted);
    const current=replay(adopted,r.commands),enemy=current.enemies.find(e=>e.id===current.combat.enemyId);
    assert.equal(r.legacy.combat.action.speed,3);assert.equal(current.combat.action.speed,2);
    assert.equal(current.combat.action.damage,card===10?4:3);
    assert.equal(current.combat.action.stun,card===31);
    assert.deepEqual(current.mission.targets,r.legacy.mission.targets,'attack declaration preserves tokens');
    assert.deepEqual(E.importSave(E.exportSave(current)),current);
    const displayed=UI.contextualAction(E.enemyDef(current,enemy).special,{tileId:'tile-17',missionId:enemy.missionId,
      tileSpeedPenalty:E.enemyTileSpeedPenalty(current,enemy),resolvedAction:current.combat.action});
    assert.equal(displayed.action.speed,2);assert(displayed.modifiers.some(x=>x.includes('속도 -1')));
    assert(!Effects.describe(current,E).some(x=>x.effects.some(t=>t.includes('감소를 받지'))));
    const resolved=E.dispatch(current,{type:'RESOLVE'});assert.deepEqual(E.importSave(E.exportSave(resolved)),resolved);
  });
  test('mission '+card+' imported pending legacy attack defers adoption and keeps old speed',()=>{
    const {legacy,tail}=missionCheckpoint(card),s=E.importSave(E.exportSave(legacy));
    assert.strictEqual(E.applyTileSpeedRuling(s),s);assert.equal(s.combat.action.speed,3);
    assert.throws(()=>E.dispatch(s,{type:'APPLY_TILE_SPEED_RULING'}));
    let after=s;
    for(const command of tail){
      after=E.dispatch(after,command);
      if(E.applyTileSpeedRuling(after)!==after)break;
    }
    const adopted=E.applyTileSpeedRuling(after);assert.equal(adopted.tileSpeedRuling,'all-attacks');
    assert.deepEqual(E.importSave(E.exportSave(adopted)),adopted);
    assert.deepEqual(adopted.commands.slice(0,-1),after.commands);
  });
}
test('ordinary chapel attack remains 1 to 0 and subsequent combat is replayable',()=>{
  const r=ordinaryCheckpoint(),s=replay(E.applyTileSpeedRuling(r.before),r.commands);
  assert.equal(s.combat.action.speed,0);assert.equal(s.combat.action.damage,4);
  assert.equal(s.combat.action.name,'달려들어 뜯기');
  assert.deepEqual(E.importSave(E.exportSave(E.dispatch(s,{type:'RESOLVE'}))),E.dispatch(s,{type:'RESOLVE'}));
});
test('unrecorded policy edits and duplicate adoption are rejected',()=>{
  const s=ordinaryCheckpoint().before,p=JSON.parse(E.exportSave(s));p.state.tileSpeedRuling='all-attacks';
  assert.throws(()=>E.importSave(JSON.stringify(p)),/명령 기록/);
  const adopted=E.applyTileSpeedRuling(s);assert.throws(()=>E.dispatch(adopted,{type:'APPLY_TILE_SPEED_RULING'}));
});
test('actual app startup records adoption for safe QA save and defers an imported pending attack',()=>{
  const {boot}=require('./helpers/ui-harness.cjs'),key='bloodborne-hunt-qa-v1';
  for(const source of [missionCheckpoint(10).before,missionCheckpoint(31).legacy]){
    const ui=boot(source,E.missionView(source),E.rewardsView(source),{realInventory:true,
      storage:{[key]:E.exportSave(source),'bloodborne-hunt-active-mode':'qa'},engine:{...E}});
    const saved=E.importSave(ui.storage.get(key));assert.deepEqual(saved,E.applyTileSpeedRuling(source));
  }
});
