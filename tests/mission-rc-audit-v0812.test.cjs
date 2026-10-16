'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../src/hunt-engine'),M=require('../src/chapter-engine');
const commands=require('./fixtures/full-campaign-actual-v10-commands.json');
const H=E.hunter;

function chapterThreeStart() {
  let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:13});
  for(const command of commands.slice(0,278))s=E.dispatch(s,command);
  assert.equal(s.mission.chapter,3);assert.equal(s.phase,'hunter');
  assert.equal(H(s).position,'tile-14:center');assert(s.mission.revealed.includes(41));
  return s;
}

test('rules14 is a supported chapter world tag without changing the direct map default',()=>{
  for(const chapter of [1,2,3]) {
    const s=M.create(90,'center',chapter,{rulesVersion:14});
    assert.equal(s.rulesVersion,14);M.assertState(s);
    assert.deepEqual(M.importSave(M.exportSave(s)),s);
  }
  assert.equal(M.create(90).rulesVersion,9);
});

test('natural chapter3 captivity excludes both forbidden crypt cells from central lamp destinations',()=>{
  const s=chapterThreeStart(),before=structuredClone(s);
  const destinations=E.centralLampDestinations(s).map(n=>n.id);
  assert.deepEqual(destinations,['tile-14:center']);
  for(const lamp of ['tile-19:top','tile-19:bottom']) {
    assert.throws(()=>E.dispatch(s,{type:'INTERACT',cardId:H(s).hand[0].id,lamp}),/등불.*안개|진입할 수 없는/);
    assert.deepEqual(s,before);
  }
  assert.deepEqual(E.importSave(E.exportSave(s)),s);
});
