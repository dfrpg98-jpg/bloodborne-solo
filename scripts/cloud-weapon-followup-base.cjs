'use strict';
// --model-only never loads Playwright. Browser mode imports one legal checkpoint
// per row, then uses public controls only; raw saves never enter evidence files.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),U=require('../hunt-map-controls');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/cloud-weapon-followup-base');
const qa={preset:'custom',startRewards:[],startConsumables:[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')]};
const prefix=[{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},{type:'PLACE_TILE',rotation:0}];
function ruling(s){for(const key of ['applyChapelRuling','applyCombatReactionRuling','applyTileSpeedRuling'])if(E[key])s=E[key](s);return s;}
function pub(s){const h=E.hunter(s);return{phase:s.phase,round:s.round,revision:s.revision,weaponId:h.weaponId,face:h.face,hp:h.hp,position:h.position,hand:h.hand.map(c=>({id:c.id,kind:c.kind})),slots:h.slots.map(c=>c?{id:c.id,kind:c.kind,faceDown:!!c.faceDown}:null),enemies:s.enemies.map(e=>({id:e.id,node:e.node,hp:e.hp})),pending:{freeTransform:!!s.freeTransform,weaponEffects:s.weaponEffects?.length||0,weaponAfter:!!s.weaponAfter,weaponMoveReturn:!!s.weaponMoveReturn,move:!!s.move,combat:!!s.combat,rewardChoices:s.rewardChoices?.length||0}};}
function functional(s){const copy=structuredClone(s);delete copy.commands;return copy;}
function plans(){const cases=[];for(const weapon of Object.keys(E.data.weapons).filter(id=>id!=='training'))for(const face of [0,1])cases.push({id:`${weapon}-${face}-base`,weapon,face,accept:false,kind:'base'});
 // Base rows decline free transformations; only the distinct accept path is added.
 for(const [weapon,face] of [['ludwigs-holy-blade',0],['uncanny-ludwigs-holy-blade',1]])cases.push({id:`${weapon}-${face}-free-accept`,weapon,face,accept:true,kind:'explicit-free-transform-branch'});
 assert.equal(cases.length,32);return cases.map(plan);}
function plan(spec){const setup={seed:140,weaponId:spec.weapon,face:spec.face,firearmId:E.data.weapons[spec.weapon].defaultFirearm||'hunter-pistol',startSpace:'center',options:{campaign:true,rulesVersion:14,qa}};
 let s=E.create(setup.seed,setup.weaponId,setup.face,null,setup.firearmId,setup.startSpace,setup.options);for(const c of prefix)s=E.dispatch(s,c);assert.equal(s.phase,'move');assert.deepEqual(E.importSave(E.exportSave(s)),s);const checkpoint=s,steps=[];s=ruling(s);
 function add(command,stage,screenshot){const before=pub(s);s=ruling(E.dispatch(s,command));steps.push({command,stage,screenshot,before,after:pub(s)});return s;}
 function settle(stage){for(let n=0;n<80&&s.phase!=='hunter';n++){
  let c;const h=E.hunter(s);
  if(s.rewardChoices?.length){const q=s.rewardChoices[0];c=q.firearmId?{type:'KEEP_FIREARM',firearmId:q.firearmId}:{type:'KEEP_REWARD',rewardId:q.rewardId};}
  else switch(s.phase){
   case'combat_react':case'boss_react':c={type:'RESOLVE'};break;
   case'combat_choose':c={type:'NO_ATTACK'};break;
   case'combat_extra':c={type:'EXTRA_TAKE'};break;
   case'free_transform':c={type:'FREE_TRANSFORM',accept:spec.accept};break;
   case'weapon_choice':{const choices=E.weaponChoices(s);c=(choices.find(x=>x.command.stop&&!x.disabled)||choices.find(x=>!x.disabled))?.command;break;}
   case'weapon_entry':c={type:'ENTRY_WEAPON',accept:false};break;
   case'firearm_react':c={type:'FIREARM_ENTRY',accept:false};break;
   case'kill_react':c={type:'PASS_KILL_REACTION'};break;
   case'move':c={type:'STOP_MOVE'};break;
   case'enemy_path':c={type:'ENEMY_STEP',node:E.moveOptions(s)[0]};break;
   case'boss_move':c={type:'BOSS_STEP',node:E.bossMoveOptions(s)[0]};break;
   case'activation':c={type:'ACTIVATE',enemyId:E.eligible(s)[0]?.id};break;
   case'cheap_shot':c={type:'CHEAP_SHOT'};break;
   case'stun':c={type:'STUN_DISCARD',cardId:h.hand[0]?.id};break;
   case'card_choice':{const q=s.cardChoices[0];c={type:'CARD_CHOICE',value:q.type==='discard'?h.hand[0]?.id:q.type==='status'?Object.keys(h.status).find(k=>h.status[k]):h.slots.findIndex(Boolean)};break;}
   default:c=(E.missionActions(s).find(x=>x.command.choice==='release')||E.missionActions(s)[0])?.command;
  }
  assert(c,`Unsupported continuation ${spec.id}/${s.phase}`);add(c,stage);
 }assert.equal(s.phase,'hunter',`${spec.id} continuation did not finish`);}
 add({type:'STEP',node:'tile-01:top'},'first-movement','first-movement');add({type:'STOP_MOVE'},'first-pursuit');settle('first-pursuit');steps.at(-1).screenshot='first-pursuit-settled';
 add({type:'USE_CONSUMABLE',itemId:'item-qa-1-11'},'qa-initial-hand');settle('qa-initial-hand');
 add({type:'TRANSFORM',cardId:'card-1'},'paid-transform-other','paid-transform-other');settle('paid-transform-other');add({type:'TRANSFORM',cardId:'card-3'},'paid-transform-back');settle('paid-transform-back');
 add({type:'ATTACK',cardId:'card-8',slot:0,enemyId:'scourge-beast-1'},'first-attack');settle('first-followups');steps.at(-1).screenshot='first-followups-complete';
 // Preserve used slots and remaining hand through the second movement/attack.
 add({type:'MOVE',cardId:E.hunter(s).hand[0].id},'next-movement');add({type:'STEP',node:'tile-01:bottom'},'next-movement','next-movement');if(s.phase==='move')add({type:'STOP_MOVE'},'next-pursuit');settle('next-pursuit');
 if(E.hunter(s).hp<6)add({type:'USE_CONSUMABLE',itemId:'item-qa-1-1'},'qa-observable-heal');
 if(!E.hunter(s).slots.some(x=>!x)){add({type:'TRANSFORM',cardId:E.hunter(s).hand[0].id},'legal-slot-preparation');settle('legal-slot-preparation');}
 assert(E.hunter(s).hand.length,'No legal card remains for second attack');
 const target=s.enemies.find(e=>e.node===E.hunter(s).position);assert(target,'No actual chased live enemy for second attack');
 add({type:'ATTACK',cardId:E.hunter(s).hand[0].id,slot:E.hunter(s).slots.findIndex(x=>!x),enemyId:target.id},'second-attack');settle('second-followups');steps.at(-1).screenshot='second-followups-complete';
 assert.equal(s.phase,'hunter');assert(!s.combat&&!s.move&&!s.weaponAfter&&!s.weaponEffects&&!s.weaponMoveReturn&&!s.freeTransform&&!s.rewardChoices.length,'Pending state remained');assert.deepEqual(E.importSave(E.exportSave(s)),s);
 return{...spec,setup,preparationCommands:prefix,checkpoint,steps,final:pub(s)};
}
if(process.argv.includes('--model-only')){const rows=plans();console.log(JSON.stringify({method:'Engine-only legal QA command replay; no browser observations.',cases:rows.map(x=>({id:x.id,kind:x.kind,commands:x.steps.length,final:x.final})),count:rows.length},null,2));process.exit(0);}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});});
const report={sourceCommit:process.env.GITHUB_SHA||'local-uncommitted',node:process.version,method:'One legal QA import per row followed by actual Chromium clicks, read-only saved-state/public DOM comparisons and timed screenshots. No renderer/engine state injection.',cases:[],failures:[],pageErrors:[],consoleErrors:[],limitations:['Thirty base rows and two distinct free-transform accept branches.','Only representative moments are captured; screenshots require visual review and do not certify every animation frame.','Complex kill/clear/mission interruption branches are covered by a separate branch audit.']};
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8787,'127.0.0.1',resolve);});try{
 const {chromium}=require('playwright');browser=await chromium.launch({headless:true});report.browser=browser.version();
 for(const spec of plans()){
  const context=await browser.newContext({viewport:{width:1459,height:1252},reducedMotion:'no-preference',recordVideo:{dir:path.join(root,'test-results/weapon-followup-video-temporary'),size:{width:1459,height:1252}}}),page=await context.newPage();const video=page.video(),begun=Date.now();
  const row={id:spec.id,kind:spec.kind,weapon:spec.weapon,initialFace:spec.face,freeTransformAccept:spec.accept,setup:spec.setup,preparationCommands:spec.preparationCommands,preparationMethod:'Engine create/dispatch only; actual browser actions begin after the single public import.',steps:[],screenshots:[],startedAt:new Date(begun).toISOString()};
  page.on('pageerror',e=>report.pageErrors.push({id:spec.id,error:e.message}));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({id:spec.id,text:m.text()});});
  let model=ruling(spec.checkpoint);
  const saved=async()=>{const raw=await page.evaluate(()=>localStorage.getItem('bloodborne-hunt-qa-v1'));assert(raw,'QA save missing');return E.importSave(raw);};
  const clean=async()=>assert.equal(await page.locator('#error').innerText(),'');
  async function acknowledge(){for(let n=0;n<20;n++){if(!await page.locator('#missionUpdateDialog').evaluate(x=>x.open))return;const before=E.exportSave(await saved());await page.locator('#missionUpdateContinue').click();assert.equal(E.exportSave(await saved()),before,'Mission notice acknowledgment changed the game');}throw Error('Mission notice acknowledgment did not finish');}
  async function panelsClosed(){if(await page.locator('#infoDialog').evaluate(x=>x.open))await page.locator('#closeInfo').click();}
  async function counter(){return page.locator('[data-presentation-attacks]').first().evaluate(x=>({renderer:x.dataset.presentation,rendererVersion:x.dataset.presentationVersion,moves:Number(x.dataset.presentationMoves||0),attacks:Number(x.dataset.presentationAttacks||0),shots:Number(x.dataset.presentationShots||0),actors:Number(x.dataset.presentationActors||0),characters:x.dataset.presentationCharacters,motion:x.dataset.presentationMotion,weapon:x.dataset.presentationWeapon,weaponReady:x.dataset.presentationWeaponReady}));}
  async function endpoints(){return page.locator('#chapterMap').evaluate(map=>{const bodies=[...map.querySelectorAll('[data-presentation-id]')].map(a=>{const r=a.getBoundingClientRect(),t=a.closest('.tile-cell')?.getBoundingClientRect();if(!t)return null;const x=r.x+r.width/2,y=r.y+r.height/2,boss=a.dataset.presentationSkin==='boss',width=t.width*(boss?.18:.09),height=t.height*(boss?.40:.28);return{id:a.dataset.presentationId,node:a.dataset.presentationNode,skin:a.dataset.presentationSkin,foot:{x,y},box:{left:x-width,right:x+width,top:y-height,bottom:y+t.height*.03}};}).filter(Boolean);const overlaps=[];for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],w=Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left),h=Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top);if(w>1&&h>1)overlaps.push({a:a.id,b:b.id,width:w,height:h,area:w*h});}return{method:'Public DOM anchor endpoint body-clearance estimate; not rendered pixel or in-flight sprite positions.',bodies,overlaps};});}
  async function shot(label){const wait=['first-movement','next-movement'].includes(label)||label.endsWith('-impact')?120:label.includes('complete')||label.includes('settled')?1200:650;await page.waitForTimeout(wait);await panelsClosed();const file=`${spec.id}-${label}.png`,requestedAtMs=Date.now()-begun;await page.screenshot({path:path.join(out,file),fullPage:true});const counters=await counter();assert.equal(counters.renderer,'phaser');assert.equal(counters.characters,'ready');assert.equal(counters.motion,'full');assert.equal(counters.weaponReady,'true');row.screenshots.push({file,label,requestedAtMs,capturedAtMs:Date.now()-begun,publicState:pub(await saved()),counters,endpointGeometry:await endpoints()});}
  async function click(command){await acknowledge();await panelsClosed();
   if(command.type==='USE_CONSUMABLE'){await page.locator('.top-actions [data-panel="inventory"]').click();await page.locator(`[data-item="${command.itemId}"]`).click();await page.locator('#useItem').click();await clean();await panelsClosed();return;}
   if(command.cardId&&E.hunter(model).hand.some(c=>c.id===command.cardId)){
    const card=page.locator(`#hand [data-card="${command.cardId}"]`);if(await card.getAttribute('aria-pressed')!=='true')await card.click();
   }
   if(Number.isInteger(command.slot)){const slot=page.locator(`#slots [data-slot="${command.slot}"]`);if(await slot.count()&&await slot.getAttribute('aria-pressed')!=='true')await slot.click();}
   if(command.enemyId&&['ATTACK','COUNTER','WEAPON_SHOT'].includes(command.type)){
    const enemy=page.locator(`#chapterMap [data-enemy="${command.enemyId}"]`).first();assert(await enemy.count(),'Map enemy target missing');if(await enemy.getAttribute('aria-pressed')!=='true')await enemy.click();
   }
   if(command.type==='STEP'){
    const movement=U.movement(model),dir=movement.directions.find(d=>d.options.some(o=>o.command.node===command.node));assert(dir,'No public movement direction');await page.locator(`[data-move-direction="${dir.edge}"]`).click();
    if(dir.options.filter(o=>o.enabled).length>1){const i=dir.options.findIndex(o=>o.command.node===command.node);await page.locator(`[data-move-option="${i}"]`).click();}
   }else{
    const candidates=page.locator(`[data-command="${command.type}"]:not([disabled])`);let target;
    for(let i=0;i<await candidates.count();i++){const b=candidates.nth(i);if(!await b.isVisible())continue;const args=JSON.parse(await b.getAttribute('data-args')||'{}');if(Object.entries(command).every(([k,v])=>k==='type'||JSON.stringify(args[k])===JSON.stringify(v))){target=b;break;}}
    assert(target,`No public enabled action ${model.phase}: ${JSON.stringify(command)}`);await target.click();
   }
   if(await page.locator('#escortDialog').evaluate(x=>x.open))await page.locator('#escortDecline').click();await clean();
  }
  try{
   await page.goto('http://127.0.0.1:8787/hunt.html');await page.locator('#file').setInputFiles({name:'qa-followup-start.json',mimeType:'application/json',buffer:Buffer.from(E.exportSave(spec.checkpoint))});
   await page.waitForFunction(expected=>!document.querySelector('#setupDialog').open&&localStorage.getItem('bloodborne-hunt-qa-v1')===expected,E.exportSave(model),{timeout:20000});assert.deepEqual(await saved(),model);await acknowledge();await clean();
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-presentation-attacks]')).some(x=>x.dataset.presentationCharacters==='ready'),null,{timeout:20000});await page.waitForTimeout(800);row.before=pub(await saved());row.counterBefore=await counter();
   for(const step of spec.steps){const at=Date.now()-begun;await click(step.command);const expected=ruling(E.dispatch(model,step.command)),actual=await saved();assert.deepEqual(functional(actual),functional(expected),`${spec.id}: ${step.command.type} result`);assert.deepEqual(actual.commands.slice(model.commands.length).map(c=>c.type),[step.command.type],'Public command must commit exactly once');model=actual;row.steps.push({command:step.command,stage:step.stage,requestedAtMs:at,completedAtMs:Date.now()-begun,publicState:pub(actual),counters:await counter()});await acknowledge();if(step.command.type==='RESOLVE'&&['first-followups','second-followups'].includes(step.stage))await shot(`${step.stage}-impact`);if(step.screenshot)await shot(step.screenshot);}
   assert.deepEqual(pub(model),spec.final);assert.equal(model.phase,'hunter');row.after=pub(model);row.counterAfter=await counter();row.actualImports=1;row.phaseTitle=await page.locator('#phaseTitle').innerText();row.status='actual-ui-sequence-verified';row.motionReview='Timed image samples captured; visual frame review remains separate';assert(row.counterAfter.moves>row.counterBefore.moves,'No movement rendered');assert(row.counterAfter.attacks>=row.counterBefore.attacks+2,'Two real battles did not produce presentation attacks');await clean();
  }catch(error){row.status='failed';row.error=error.stack;report.failures.push({id:spec.id,error:error.stack});try{await shot('failure');}catch(e){row.failureCaptureError=e.message;}}
  finally{row.finishedAt=new Date().toISOString();await context.close();if(video){row.video=`${spec.id}.webm`;await video.saveAs(path.join(out,row.video));}report.cases.push(row);}
 }
}catch(error){report.failures.push({stage:'runner',error:error.stack});}finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({count:report.cases.length,cases:report.cases.map(x=>({id:x.id,status:x.status,error:x.error})),failures:report.failures,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));if(report.failures.length||report.pageErrors.length||report.consoleErrors.length)process.exitCode=1;}})();
