'use strict';
// Real Chromium only. Checkpoints are regenerated through create/dispatch and
// loaded through the product file input. No raw saves enter the evidence folder.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),E=require('../hunt-engine'),U=require('../hunt-map-controls'),
  Effects=require('../hunt-enemy-mission-effects'),Feedback=require('../hunt-mission-feedback');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/cloud-tile-speed-qa');
fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:process.env.GITHUB_SHA||'local-uncommitted',node:process.version,
  method:'Actual Chromium UI clicks. Original rules14 QA checkpoints generated with create/dispatch and imported through the product file input; recorded adoption, no hand-assembled state.',
  observations:[],failures:[],pageErrors:[],screenshots:[],limitations:['Focused Issue32 browser verification; earlier UI1–12 screenshots are not repeated. Reference originals reviewed privately, not uploaded.']};
const supplies=[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')];
function initial(seed=140,weapon='burial',face=0){return E.create(seed,weapon,face,null,'hunter-pistol','center',
  {campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:supplies}});}
function replay(s,commands){for(const c of commands)s=E.dispatch(s,c);assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;}
function naturalReplay(s,commands){for(const c of commands){
  const using=()=>c.type==='USE_REWARD'&&E.killReactionActions(s).some(a=>!a.disabled&&a.command.type===c.type&&a.command.rewardId===c.rewardId&&a.command.enemyId===c.enemyId);
  while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
  s=E.dispatch(s,c);
}assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});});
let browser,page;
async function screenshot(name){const file=name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});report.screenshots.push(file);}
async function saved(){const text=await page.evaluate(()=>localStorage.getItem('bloodborne-hunt-qa-v1'));assert(text,'QA save missing');return E.importSave(text);}
async function clean(){assert.equal(await page.locator('#error').innerText(),'');}
function sameState(actual,expected){const a=structuredClone(actual),b=structuredClone(expected);delete a.commands;delete b.commands;assert.deepEqual(a,b);}
async function load(s){const expected=E.applyTileSpeedRuling(s);assert.deepEqual(E.importSave(E.exportSave(s)),s);await page.locator('#file').setInputFiles({name:'qa-browser-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(E.exportSave(s))});
  await page.waitForFunction(expected=>!document.querySelector('#setupDialog').open&&localStorage.getItem('bloodborne-hunt-qa-v1')===expected,E.exportSave(expected));
  await clean();assert.deepEqual(await saved(),expected);return expected;}
async function acknowledge(){if(await page.locator('#missionUpdateDialog').evaluate(x=>x.open)){const before=E.exportSave(await saved());await page.locator('#missionUpdateContinue').click();assert.equal(E.exportSave(await saved()),before,'Acknowledging an alert spent an action');}}
async function clickCommand(command){
  if(command.type==='REFILL'){await page.locator('#refill').click();await clean();return;}
  if(command.type==='USE_CONSUMABLE'){
    await page.locator('.top-actions [data-panel=inventory]').click();
    await page.locator(`[data-item="${command.itemId}"]`).click();await page.locator('#useItem').click();await clean();return;
  }
  if(command.type==='USE_REWARD'&&command.node){
    await page.locator('.top-actions [data-panel=rewards]').click();
    await page.locator(`[id="rewardLamp-${command.rewardId}"]`).selectOption(command.node);
    await page.locator(`[data-reward-use="${command.rewardId}"]`).click();await clean();return;
  }
  if(command.type==='STEP'){
    const s=await saved(),dir=U.movement(s).directions.find(d=>d.options.some(o=>o.command.node===command.node));assert(dir);
    await page.locator(`[data-move-direction="${dir.edge}"]`).click();
    if(dir.options.filter(o=>o.enabled).length>1){const index=dir.options.findIndex(o=>o.command.node===command.node);await page.locator(`[data-move-option="${index}"]`).click();}
    await clean();return;
  }
  if(command.type==='PLACE_TILE')await page.locator(`[data-rotation="${command.rotation}"]`).click();
  if(command.cardId&&['ATTACK','COUNTER','TRANSFORM','MOVE','DREAM'].includes(command.type))await page.locator(`[data-card="${command.cardId}"]`).click();
  if(['ATTACK','COUNTER'].includes(command.type)){
    await page.locator(`[data-slot="${command.slot}"]`).click();
    if(command.enemyId)await page.locator(`[data-enemy="${command.enemyId}"]`).first().click();
  }
  const candidates=page.locator(`[data-command="${command.type}"]:not([disabled])`);
  let picked=null;
  for(let i=0;i<await candidates.count();i++){
    const b=candidates.nth(i),args=JSON.parse(await b.getAttribute('data-args')||'{}');
    if(Object.entries(command).every(([k,v])=>k==='type'||JSON.stringify(args[k])===JSON.stringify(v))){picked=b;break;}
  }
  assert(picked,'No actual enabled control for '+JSON.stringify(command));await picked.click();await clean();
}
async function transition(s,c){const next=E.applyTileSpeedRuling(E.dispatch(s,c));await clickCommand(c);const actual=await saved();sameState(actual,next);return actual;}
async function attempt(name,fn){try{await fn();report.observations.push({name,status:'passed'});}catch(e){report.failures.push({name,error:e.stack});try{await screenshot(name+'-failure');}catch{}}}
const {missionCheckpoint,ordinaryCheckpoint}=require('../tests/helpers/tile-speed-checkpoints.cjs');
function summary(s){const e=s.combat&&s.enemies.find(e=>e.id===s.combat.enemyId);return {phase:s.phase,
  hunterHp:E.hunter(s).hp,enemyHp:e?.hp,action:s.combat?.action,policy:s.tileSpeedRuling,
  tokens:e?s.mission.targets[e.missionId]?.tokens:undefined};}
(async()=>{
  await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true});report.browser=browser.version();
    page=await browser.newPage({viewport:{width:1208,height:848},reducedMotion:'no-preference'});
    page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto('http://127.0.0.1:8787/hunt.html');
    for(const card of [10,31]){
      const r=missionCheckpoint(card);
      await attempt('mission-'+card+'-legacy-safe-import-and-new-chapel-attack',async()=>{
        let s=await load(r.before);assert.equal(s.tileSpeedRuling,'all-attacks');
        assert.deepEqual(s.commands.slice(0,-1),r.before.commands);
        await screenshot('mission-'+card+'-safe-import');
        for(const c of r.commands){s=await transition(s,c);await acknowledge();}
        assert.equal(s.combat.action.speed,2);assert.equal(s.combat.action.damage,card===10?4:3);
        const text=await page.locator('#combatInfo').innerText();assert.match(text,/속도 3 → 2/);assert.match(text,/오에돈 예배당 · 속도 -1/);
        await screenshot('mission-'+card+'-corrected-special');
        const before=summary(s);s=await transition(s,{type:'RESOLVE'});await acknowledge();
        await screenshot('mission-'+card+'-after-resolve');
        if(card===10&&s.phase==='mission_death'){s=await transition(s,{type:'MISSION_DEATH_TAKE'});assert.equal(E.hunter(s).hp,1);await acknowledge();await screenshot('mission-10-final-kill-reaction');}
        report.observations.push({name:'mission-'+card+'-numbers-and-reproduction',initialSeed:90,
          historicalCommandCount:r.before.commands.length,actualCommands:r.commands,
          legacy:summary(r.legacy),corrected:before,afterResolve:summary(s)});
      });
      await attempt('mission-'+card+'-pending-old-save-replay-and-deferred-adoption',async()=>{
        let s=await load(r.legacy);assert.deepEqual(s,r.legacy);assert.equal(s.combat.action.speed,3);
        assert.match(await page.locator('#combatInfo').innerText(),/기존 저장 판정/);
        await screenshot('mission-'+card+'-pending-old-attack');
        for(const c of r.tail){s=await transition(s,c);await acknowledge();if(s.tileSpeedRuling)break;}
        assert.equal(s.tileSpeedRuling,'all-attacks');assert.deepEqual(E.importSave(E.exportSave(s)),s);
        await screenshot('mission-'+card+'-deferred-adoption');
        report.observations.push({name:'mission-'+card+'-preserved-history',historicalCommands:r.legacy.commands.length,
          adoptedAfter:s.commands.slice(r.legacy.commands.length),state:summary(s)});
        if(card===31){s=await transition(s,{type:'REFILL'});s=await transition(s,r.tail.find(c=>c.type==='ATTACK'));
          assert.equal(s.combat.action.speed,1);assert.match(await page.locator('#combatInfo').innerText(),/속도 2 → 1/);
          await screenshot('mission-31-subsequent-combat');s=await transition(s,{type:'RESOLVE'});await acknowledge();}
      });
    }
    await attempt('ordinary-enemy-one-to-zero-attack-and-resolve',async()=>{
      const r=ordinaryCheckpoint();let s=await load(r.before);
      for(const c of r.commands)s=await transition(s,c);
      assert.equal(s.combat.action.speed,0);assert.equal(s.combat.action.damage,4);
      assert.match(await page.locator('#combatInfo').innerText(),/속도 1 → 0/);
      await screenshot('ordinary-one-to-zero');s=await transition(s,{type:'RESOLVE'});await acknowledge();
      await screenshot('ordinary-after-resolve');
    });
  }catch(e){report.failures.push({name:'browser-setup',error:e.stack});}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));if(report.failures.length||report.pageErrors.length)process.exitCode=1;}
})();
