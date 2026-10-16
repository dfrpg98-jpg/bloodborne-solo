"use strict";
// Fast developer smoke. It intentionally uses QA equipment and cannot prove
// normal campaign balance or completion with the printed components.
const E=require("../src/hunt-engine"),assert=require("node:assert/strict");
const start=performance.now();
let s=E.create(90,"qa-test-weapon",0,null,"hunter-pistol","center",{campaign:true,qa:{preset:"fast"}});
let saveChecks=0;
function checkpoint(){assert.deepEqual(E.importSave(E.exportSave(s)),s);saveChecks++;}
function go(command){s=E.dispatch(s,command);}
checkpoint();
go({type:"USE_CONSUMABLE",itemId:E.hunter(s).consumables.find(i=>i.kind==="qa-travel").id});
for(const node of ["tile-14:left","tile-14:center","tile-14:right","tile-14:center","tile-14:left"])
  go({type:"STEP",node});
go({type:"STOP_MOVE"});
checkpoint();
go({type:"USE_CONSUMABLE",itemId:E.hunter(s).consumables.find(i=>i.kind==="qa-cards").id});
go({type:"USE_CONSUMABLE",itemId:E.hunter(s).consumables.find(i=>i.kind==="qa-heal").id});
checkpoint();
console.log(JSON.stringify({mode:"qa",commands:s.commands.length,saveCheckpoints:saveChecks,
  elapsedMs:Math.round((performance.now()-start)*100)/100,normalCampaignProof:false}));
