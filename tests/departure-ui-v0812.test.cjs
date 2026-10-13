"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const E=require("../hunt-engine"),{boot}=require("./helpers/ui-harness.cjs");
const key="bloodborne-hunt-v07",cache=new Map();
function natural(file,count,weapon="burial",face=1){
 const id=[file,count,weapon,face].join(":");
 if(!cache.has(id)){let s=E.create(90,weapon,face,null,"hunter-pistol","center",{campaign:true});
 for(const c of require("./fixtures/"+file).slice(0,count))s=E.dispatch(s,c);cache.set(id,s);}
 return structuredClone(cache.get(id));
}
const house=()=>natural("v074-shelter-natural-commands.json",75);
const bridge=()=>natural("v074-clinic-escort-chapter-two-natural-commands.json",125);
function run(s,...commands){return commands.reduce((x,c)=>E.dispatch(x,c),s);}
function launch(s){return boot(s,E.missionView(s),E.rewardsView(s),{realInventory:true,
 storage:{[key]:E.exportSave(s)},engine:{...E,applyChapelRuling:x=>x}});}
function saved(ui){assert.equal(ui.el("error").textContent,"");return E.importSave(ui.storage.get(key));}
function action(ui,id){const b=ui.el("mapContext").querySelectorAll("[data-context-id]").find(b=>b.dataset.contextId===id);assert(b,"missing "+id);return b;}
function command(ui,type){const b=ui.buttons("decisions").find(b=>b.dataset.command===type);assert(b,"missing "+type);return b;}
function cell(ui,node){const b=ui.el("chapterMap").querySelectorAll("[data-node]").find(b=>b.dataset.node===node&&!b.hasAttribute("data-entrance"));assert(b);b.click();}
function card(ui,id="card-1"){const b=ui.el("hand").querySelectorAll("[data-card]").find(b=>b.dataset.card===id);assert(b);b.click();}
function requestHouse(ui){cell(ui,"tile-11:street");card(ui);action(ui,"move").click();}
function explore(ui){const b=ui.el("chapterMap").querySelectorAll("[data-entrance]").find(b=>b.dataset.node==="tile-18:top"&&b.dataset.edge==="E");assert(b);b.click();action(ui,"explore").click();}
function place(ui){ui.el("decisions").querySelectorAll("[data-rotation]").find(b=>b.dataset.rotation==="0").click();command(ui,"PLACE_TILE").click();}

test("departure prompt uses the requested title and only public survivor information",()=>{
 const s=house(),ui=launch(s);requestHouse(ui);
 assert.equal(ui.el("escortPromptTitle").textContent,"생존자와 동행하시겠습니까?");
 assert.match(ui.el("escortPromptDescription").textContent,/추가 비용이 없습니다/);
 assert.doesNotMatch(ui.el("escortPromptDescription").textContent,/card-|reward-|보상|완수|분기/);
 const html=require("node:fs").readFileSync(require("node:path").join(__dirname,"../hunt.html"),"utf8");
 assert.match(html,/id="escortAccept"[^>]*>예<\/button>/);assert.match(html,/id="escortDecline"[^>]*>아니오<\/button>/);
});

test("Cancel abandons the entire MOVE plus STEP convenience request without hand, position, random or save changes",()=>{
 const s=house(),ui=launch(s),before=ui.storage.get(key);requestHouse(ui);ui.el("escortCancel").click();
 assert.equal(ui.el("escortDialog").open,false);assert.equal(ui.storage.get(key),before);assert.deepEqual(saved(ui),s);
});

test("Escape cancels rather than implicitly choosing No and the next departure can ask again",()=>{
 const ui=launch(house()),before=ui.storage.get(key);requestHouse(ui);ui.el("escortDialog").fire("cancel");
 assert.equal(ui.el("escortDialog").open,false);assert.equal(ui.storage.get(key),before);
 action(ui,"move").click();assert.equal(ui.el("escortDialog").open,true);assert.equal(ui.storage.get(key),before);
});

test("a second action while an escort decision is pending cannot spend resources or replace the pending route",()=>{
 const s=house(),ui=launch(s),before=ui.storage.get(key);requestHouse(ui);action(ui,"move").click();
 assert.equal(ui.storage.get(key),before);assert.equal(ui.el("escortDialog").open,true);
 ui.el("escortAccept").click();const result=saved(ui),after=ui.storage.get(key);ui.el("escortAccept").click();
 assert.equal(ui.storage.get(key),after);assert.deepEqual(result,run(s,{type:"MOVE",cardId:"card-1"},{type:"MISSION_PICKUP"},{type:"STEP",node:"tile-11:street"}));
});

test("Yes on a legacy armed checkpoint avoids toggling off its free pickup",()=>{
 const s=run(house(),{type:"MOVE",cardId:"card-1"},{type:"MISSION_PICKUP"}),ui=launch(s);
 cell(ui,"tile-11:street");action(ui,"move").click();ui.el("escortAccept").click();
 assert.deepEqual(saved(ui),E.dispatch(s,{type:"STEP",node:"tile-11:street"}));
});

test("entering the named house during a move does not prompt until the hunter leaves that space",()=>{
 let s=run(house(),{type:"MOVE",cardId:"card-1"},{type:"STEP",node:"tile-11:street"},{type:"STOP_MOVE"});
 const ui=launch(s);cell(ui,"tile-11:house");card(ui,E.hunter(s).hand[0].id);action(ui,"move").click();
 assert.equal(ui.el("escortDialog").open,false);assert.equal(E.hunter(saved(ui)).position,"tile-11:house");
 const before=ui.storage.get(key);cell(ui,"tile-11:street");action(ui,"move").click();
 assert.equal(ui.el("escortDialog").open,true);assert.equal(ui.storage.get(key),before);
 ui.el("escortAccept").click();assert.equal(saved(ui).mission.escort.carrierId,s.activeHunterId);
});

for(const accept of [true,false])test(`real mission37 exploration asks before tile reveal; ${accept?"Yes":"No"} survives placement without a duplicate question`,()=>{
 const s=bridge(),ui=launch(s),before=ui.storage.get(key);explore(ui);
 assert.equal(ui.el("escortDialog").open,true);assert.equal(ui.storage.get(key),before);
 ui.el(accept?"escortAccept":"escortDecline").click();const pending=saved(ui);
 assert.equal(pending.phase,"tile_place");assert.equal(E.hunter(pending).position,"tile-18:top");
 assert.equal(pending.mission.escort.carrierId,null);assert.equal(pending.mission.escort.pickup,accept);
 const reference=run(s,...(accept?[{type:"MISSION_PICKUP"}]:[]),{type:"EXPLORE",edge:"E"});
 assert.deepEqual(pending,reference);place(ui);
 assert.equal(ui.el("escortDialog").open,false);assert.deepEqual(saved(ui),E.dispatch(reference,{type:"PLACE_TILE",rotation:0}));
 const result=saved(ui);assert.equal(result.mission.escort.carrierId,null);
 // This actual exploration enters the destination tile, so Yes immediately delivers the companion.
 assert.equal(result.mission.completed.includes(39),accept);
 assert.equal(result.mission.escort.node,accept?null:"tile-18:top");
});

test("a saved pending exploration retains Yes through reload and acquires only at actual tile entry",()=>{
 const s=bridge(),ui=launch(s);explore(ui);ui.el("escortAccept").click();
 const pending=saved(ui),reloaded=launch(pending);assert.equal(reloaded.el("escortDialog").open,false);place(reloaded);
 const result=saved(reloaded);assert.equal(result.mission.escort.carrierId,null);assert(result.mission.completed.includes(39));
});

test("new mission08 survivor is revealed on movement end, never during the unfinished exploration step",()=>{
 let s=E.create(14,"beast-claw",0,null,"hunter-pistol","center",{campaign:true});
 s=run(s,{type:"MOVE",cardId:E.hunter(s).hand[0].id},{type:"EXPLORE",edge:"N"},{type:"PLACE_TILE",rotation:1});
 assert.equal(s.phase,"move");assert.equal(s.move.remaining,1);assert(!s.mission.revealed.includes(8));
 assert.equal(s.mission.escort.node,null);const ui=launch(s);cell(ui,"tile-11:house");action(ui,"move").click();
 assert.equal(ui.el("escortDialog").open,false);const ended=saved(ui);assert.equal(ended.phase,"hunter");
 assert(ended.mission.revealed.includes(8));assert.equal(ended.mission.escort.node,"tile-11:house");assert.equal(ended.mission.escort.carrierId,null);
});
