'use strict';
// --model-only never loads Playwright. Browser mode imports one legal checkpoint
// per row, then uses public controls only; raw saves never enter evidence files.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const E=require('../hunt-engine'),U=require('../hunt-map-controls');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/cloud-weapon-followup-branches');
const {definitions,build,pub,ruling}=require('./helpers/cloud-weapon-branch-plans.cjs');
function functional(s){const copy=structuredClone(s);delete copy.commands;return copy;}
function plans(){const wanted=(process.env.MOTION_CASE_FILTER||'').split(',').filter(Boolean),all=definitions().filter(x=>!wanted.length||wanted.includes(x.id)),shard=Number(process.env.MOTION_SHARD||0),total=Number(process.env.MOTION_SHARDS||1);return all.filter((_,i)=>i%total===shard).map(build);}
if(process.argv.includes('--model-only')){const rows=plans();console.log(JSON.stringify({method:'Normal create/dispatch preparation only; not actual browser evidence.',count:rows.length,cases:rows.map(x=>({id:x.id,steps:x.steps.length,effect:x.effectCompleted.phase,final:x.final.phase}))},null,2));process.exit(0);}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});});
const report={sourceCommit:process.env.GITHUB_SHA||'local-uncommitted',node:process.version,method:'One legal QA import per row followed by actual Chromium clicks, read-only saved-state/public DOM comparisons and timed screenshots. No renderer/engine state injection.',cases:[],failures:[],pageErrors:[],consoleErrors:[],limitations:['Representative weapon branches; the separate32row base evidence provides all30startingforms.','Only representative moments are captured; screenshots require visual review and do not certify every animation frame.','Public DOM coordinates are logical endpoints, not canvas in-flight coordinates. Continuous WebM and actual timestamped canvas images require visual review.']};
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8787,'127.0.0.1',resolve);});try{
 const {chromium}=require('playwright');browser=await chromium.launch({headless:true});report.browser=browser.version();
 for(const spec of plans()){
  const context=await browser.newContext({viewport:{width:1459,height:1252},reducedMotion:'no-preference',recordVideo:{dir:path.join(root,'test-results/weapon-followup-video-temporary'),size:{width:1459,height:1252}}}),page=await context.newPage();const video=page.video(),begun=Date.now();
  const row={fastRequested:!!spec.fast,cameraRequested:!!spec.camera,preparationSource:spec.source,id:spec.id,kind:'representative-effect-branch',weapon:spec.weapon,initialFace:spec.face,freeTransformAccept:spec.accept,setup:spec.setup,preparationCommands:spec.preparationCommands,preparationMethod:'Engine create/dispatch only; actual browser actions begin after the single public import.',steps:[],screenshots:[],startedAt:new Date(begun).toISOString()};
  page.on('pageerror',e=>report.pageErrors.push({id:spec.id,error:e.message}));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({id:spec.id,text:m.text()});});
  let model=ruling(spec.checkpoint);
  const saved=async()=>{const raw=await page.evaluate(()=>localStorage.getItem('bloodborne-hunt-qa-v1'));assert(raw,'QA save missing');return E.importSave(raw);};
  const clean=async()=>assert.equal(await page.locator('#error').innerText(),'');
  async function acknowledge(){for(let n=0;n<20;n++){if(!await page.locator('#missionUpdateDialog').evaluate(x=>x.open))return;const before=E.exportSave(await saved());await page.locator('#missionUpdateContinue').click();assert.equal(E.exportSave(await saved()),before,'Mission notice acknowledgment changed the game');}throw Error('Mission notice acknowledgment did not finish');}
  async function panelsClosed(){if(await page.locator('#infoDialog').evaluate(x=>x.open))await page.locator('#closeInfo').click();}
  async function counter(){return page.locator('[data-presentation-attacks]').first().evaluate(x=>({renderer:x.dataset.presentation,rendererVersion:x.dataset.presentationVersion,moves:Number(x.dataset.presentationMoves||0),attacks:Number(x.dataset.presentationAttacks||0),shots:Number(x.dataset.presentationShots||0),actors:Number(x.dataset.presentationActors||0),characters:x.dataset.presentationCharacters,motion:x.dataset.presentationMotion,weapon:x.dataset.presentationWeapon,weaponReady:x.dataset.presentationWeaponReady}));}
  async function endpoints(){return page.locator('#chapterMap').evaluate(map=>{const bodies=[...map.querySelectorAll('[data-presentation-id]')].map(a=>{const r=a.getBoundingClientRect(),t=a.closest('.tile-cell')?.getBoundingClientRect();if(!t)return null;const x=r.x+r.width/2,y=r.y+r.height/2,boss=a.dataset.presentationSkin==='boss',width=t.width*(boss?.18:.09),height=t.height*(boss?.40:.28);return{id:a.dataset.presentationId,node:a.dataset.presentationNode,skin:a.dataset.presentationSkin,foot:{x,y},box:{left:x-width,right:x+width,top:y-height,bottom:y+t.height*.03}};}).filter(Boolean);const overlaps=[];for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],w=Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left),h=Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top);if(w>1&&h>1)overlaps.push({a:a.id,b:b.id,width:w,height:h,area:w*h});}return{method:'Public DOM anchor endpoint body-clearance estimate; not rendered pixel or in-flight sprite positions.',bodies,overlaps};});}
  async function shot(label){const wait=['first-movement','next-movement'].includes(label)||label.endsWith('-impact')?120:label.includes('complete')||label.includes('settled')?1200:650;await page.waitForTimeout(wait);await panelsClosed();const file=`${spec.id}-${label}.png`,requestedAtMs=Date.now()-begun;await page.screenshot({path:path.join(out,file),fullPage:true});const counters=await counter();assert.equal(counters.renderer,'phaser');assert.equal(counters.characters,'ready');assert.equal(counters.motion,'full');assert.equal(counters.weaponReady,'true');row.screenshots.push({file,label,requestedAtMs,capturedAtMs:Date.now()-begun,publicState:pub(await saved()),counters,endpointGeometry:await endpoints()});}
  async function click(command,stepEscortAccept=false){await acknowledge();await panelsClosed();
   if(command.type==='REFILL'){await page.locator('#refill').click();await clean();return;}
   if(command.type==='RETURN'){await page.locator('#returnFace').selectOption(String(command.face));await page.locator(`[data-return="${command.node}"]`).click();await clean();return;}
   if(command.type==='START_NEXT_CHAPTER'){await page.locator('#nextChapterStart').selectOption(command.startSpace);await page.locator('#nextChapterFace').selectOption(String(command.face));await page.locator('#startNextChapter').click();await clean();return;}
   if(command.type==='PLACE_TILE')await page.locator(`[data-rotation="${command.rotation}"]`).click();
   if(command.type==='USE_CONSUMABLE'){await page.locator('.top-actions [data-panel="inventory"]').click();await page.locator(`[data-item="${command.itemId}"]`).click();for(const [key,id]of Object.entries({enemyId:'itemEnemy',node:'itemNode',slot:'itemSlot',rewardId:'itemReward'}))if(command[key]!==undefined)await page.locator('#'+id).selectOption(String(command[key]));await page.locator('#useItem').click();await clean();await panelsClosed();return;}
   if(command.cardId&&E.hunter(model).hand.some(c=>c.id===command.cardId)){
    const card=page.locator(`#hand [data-card="${command.cardId}"]`);if(await card.getAttribute('aria-pressed')!=='true')await card.click();
   }
   if(Number.isInteger(command.slot)){const slot=page.locator(`#slots [data-slot="${command.slot}"]`);if(await slot.count()&&await slot.getAttribute('aria-pressed')!=='true')await slot.click();}
   if(command.enemyId&&['ATTACK','COUNTER','WEAPON_SHOT'].includes(command.type)){
    const enemy=page.locator(`#chapterMap [data-enemy="${command.enemyId}"]`).first();assert(await enemy.count(),'Map enemy target missing');if(await enemy.getAttribute('aria-pressed')!=='true')await enemy.click();
   }
   if(command.weaponBoost!==undefined&&await page.locator('#weaponBoost').count())await page.locator('#weaponBoost').selectOption(command.weaponBoost===0?'none':String(command.weaponBoost));
   for(const id of command.pullIds||[])await page.locator(`[data-pull="${id}"]`).check();
   for(const id of command.rewardIds||[])await page.locator(`#decisions [data-reward-attack="${id}"]`).check();
   if(command.type==='STEP'){
    const movement=U.movement(model),dir=movement.directions.find(d=>d.options.some(o=>o.command.node===command.node));assert(dir,'No public movement direction');await page.locator(`[data-move-direction="${dir.edge}"]`).click();
    if(dir.options.filter(o=>o.enabled).length>1){const i=dir.options.findIndex(o=>o.command.node===command.node);await page.locator(`[data-move-option="${i}"]`).click();}
   }else{
    const candidates=page.locator(`[data-command="${command.type}"]:not([disabled])`);let target;
    for(let i=0;i<await candidates.count();i++){const b=candidates.nth(i);if(!await b.isVisible())continue;const args=JSON.parse(await b.getAttribute('data-args')||'{}');if(Object.entries(command).every(([k,v])=>k==='type'||JSON.stringify(args[k])===JSON.stringify(v))){target=b;break;}}
    assert(target,`No public enabled action ${model.phase}: ${JSON.stringify(command)}`);await target.click();
   }
   if(await page.locator('#escortDialog').evaluate(x=>x.open))await page.locator(stepEscortAccept?'#escortAccept':'#escortDecline').click();await clean();
  }
  try{
   await page.goto('http://127.0.0.1:8787/hunt.html');await page.locator('#file').setInputFiles({name:'qa-followup-start.json',mimeType:'application/json',buffer:Buffer.from(E.exportSave(spec.checkpoint))});
   await page.waitForFunction(expected=>!document.querySelector('#setupDialog').open&&localStorage.getItem('bloodborne-hunt-qa-v1')===expected,E.exportSave(model),{timeout:20000});assert.deepEqual(await saved(),model);await acknowledge();await clean();
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-presentation-attacks]')).some(x=>x.dataset.presentationCharacters==='ready'),null,{timeout:20000});await page.waitForTimeout(800);row.before=pub(await saved());row.counterBefore=await counter();
   await shot('initial-public-import');
   async function canvasSample(label,wait=0){if(wait)await page.waitForTimeout(wait);await panelsClosed();const file=`${spec.id}-${label}.png`,started=Date.now()-begun;
    await page.locator('#mapViewport').screenshot({path:path.join(out,file),animations:'allow'});row.screenshots.push({file,label,requestedAtMs:started,capturedAtMs:Date.now()-begun,publicState:pub(await saved()),counters:await counter(),endpointGeometry:await endpoints(),method:'Actual canvas screenshot; endpointGeometry only describes DOM logical anchors.'});}
   let cameraDone=false;
   for(const [index,step]of spec.steps.entries()){
    const at=Date.now()-begun;if(!spec.fast)await page.waitForTimeout(350);
    const prior=pub(model);await click(step.command,step.escortChoice==='accept');let expected=model;for(const c of step.expectedBatch)expected=E.dispatch(expected,c);expected=ruling(expected);
    const actual=await saved();assert.deepEqual(functional(actual),functional(expected),`${spec.id}: ${step.command.type} result`);
    const actualTypes=actual.commands.slice(model.commands.length).map(c=>c.type),expectedTypes=expected.commands.slice(model.commands.length).map(c=>c.type);
    assert.deepEqual(actualTypes,expectedTypes,'Only the public action batch and recorded policy adoption may commit');assert.equal(actualTypes.filter(x=>x===step.command.type).length,1,'Public requested command committed once');
    model=actual;row.steps.push({command:step.command,actualCommittedTypes:actualTypes,escortChoice:step.escortChoice,stage:step.stage,requestedAtMs:at,completedAtMs:Date.now()-begun,publicState:pub(actual),publicControls:await page.locator('#decisions').innerText(),combatText:await page.locator('#combatInfo').innerText(),counters:await counter()});await acknowledge();
    if(step.effectCompleted){assert.deepEqual(pub(model),spec.effectCompleted);row.effectCompleted=pub(model);if(!spec.fast)await canvasSample('effect-complete',1000);}
    if(!spec.fast&&['FREE_TRANSFORM','TRANSFORM'].includes(step.command.type)){
      const start=Date.now();for(const [frame,offset]of [0,100,300,700].entries())await canvasSample(`transform-${index}-frame${frame}`,Math.max(0,offset-(Date.now()-start)));
    }else if(!spec.fast&&(step.command.type==='STEP'||step.command.type==='WEAPON_CHOICE'&&step.command.node))await canvasSample(`movement-${index}-early`,80);
    if(spec.camera&&!cameraDone&&(step.command.type==='STEP'||step.command.node&&step.command.type==='WEAPON_CHOICE')){
      const before=E.exportSave(await saved()),box=await page.locator('#mapViewport').boundingBox();
      await page.locator('#zoomIn').click();await page.mouse.move(box.x+box.width-28,box.y+box.height-25);await page.mouse.down();await page.mouse.move(box.x+box.width-75,box.y+box.height-45,{steps:3});await page.mouse.up();
      assert.equal(E.exportSave(await saved()),before,'Camera operation must not change game state');row.cameraCheck={atMs:Date.now()-begun,method:'Public zoom and drag during the presented movement',gameplayUnchanged:true};await canvasSample('camera-during-movement',80);cameraDone=true;
    }
   }
   await canvasSample('final-idle',1300);
   assert.deepEqual(pub(model),spec.final);if(spec.terminalExpected){assert.equal(model.phase,'over');assert.equal(model.result,'loss');assert.equal(await page.locator('[data-command="MOVE"]:not([disabled])').count(),0);assert.throws(()=>E.dispatch(model,{type:'MOVE',cardId:E.hunter(model).hand[0]?.id}));row.terminal={result:model.result,nextMoveUnavailableInUI:true,modelAlsoRejectsNextAction:true};}else assert.equal(model.phase,'hunter');row.after=pub(model);row.counterAfter=await counter();row.actualImports=1;row.phaseTitle=await page.locator('#phaseTitle').innerText();row.status=spec.terminalExpected?'actual-ui-terminal-verified':'actual-ui-sequence-verified';row.motionReview='Timestamped canvas samples and continuous WebM captured; visual review remains separate';assert(row.counterAfter.moves>row.counterBefore.moves,'No movement rendered');assert(row.counterAfter.attacks>row.counterBefore.attacks,'No real following combat presentation');if(!spec.terminalExpected){assert(row.steps.some(x=>x.stage==='next-movement'&&x.command.type==='MOVE'),'No next MOVE');assert(row.steps.some(x=>x.stage==='next-movement'&&x.command.type==='STEP'),'No next STEP');assert(row.steps.some(x=>x.stage==='next-pursuit'&&x.command.type==='STOP_MOVE'),'No next STOP_MOVE');}await clean();
  }catch(error){row.status='failed';row.error=error.stack;report.failures.push({id:spec.id,error:error.stack});try{await shot('failure');}catch(e){row.failureCaptureError=e.message;}}
  finally{row.finishedAt=new Date().toISOString();await context.close();if(video){row.video=`${spec.id}.webm`;await video.saveAs(path.join(out,row.video));}report.cases.push(row);}
 }
}catch(error){report.failures.push({stage:'runner',error:error.stack});}finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({count:report.cases.length,cases:report.cases.map(x=>({id:x.id,status:x.status,error:x.error})),failures:report.failures,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));if(report.failures.length||report.pageErrors.length||report.consoleErrors.length)process.exitCode=1;}})();

