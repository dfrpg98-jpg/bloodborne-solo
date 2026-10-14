'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../hunt-engine'),P=require('../scripts/helpers/cloud-weapon-branch-plans.cjs');
test('Chikage dodge multi-target pending choice exports and imports before resolving it',()=>{
 const plan=P.build(P.definitions().find(x=>x.id==='chikage-1-dodge-heal-multi-target'));
 let state=P.ruling(plan.checkpoint),pending;
 for(const step of plan.steps){for(const c of step.expectedBatch)state=E.dispatch(state,c);state=P.ruling(state);
  assert.deepEqual(E.importSave(E.exportSave(state)),state);
  if(step.command.type==='DODGE'){pending=state;assert.equal(state.phase,'weapon_choice');assert.equal(E.hunter(state).hp,4);assert(!Object.hasOwn(state.weaponAfter,'immediate'));}
 }
 assert(pending);assert.equal(state.phase,'hunter');assert.equal(P.pub(state).pending.weaponEffects.length,0);
});
