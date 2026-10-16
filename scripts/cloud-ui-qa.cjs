'use strict';
// Real Chromium only. Checkpoints are regenerated through create/dispatch and
// loaded through the product file input. No raw saves enter the evidence folder.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),E=require('../src/hunt-engine'),U=require('../src/hunt-map-controls'),
  Effects=require('../src/hunt-enemy-mission-effects'),Feedback=require('../src/hunt-mission-feedback');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/cloud-ui-qa');
fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:process.env.GITHUB_SHA||'local-uncommitted',node:process.version,
  method:'Actual Chromium UI clicks. Normal create/dispatch QA checkpoints; no hand-assembled state.',
  observations:[],failures:[],pageErrors:[],screenshots:[],limitations:['UI observations do not certify official rules; private original-photo audit is recorded separately.']};
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
  if(command.cardId&&['ATTACK','TRANSFORM','MOVE','DREAM'].includes(command.type))await page.locator(`[data-card="${command.cardId}"]`).click();
  if(command.type==='ATTACK'){
    await page.locator(`[data-slot="${command.slot}"]`).click();
    await page.locator(`[data-enemy="${command.enemyId}"]`).first().click();
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
function naturalRecords(){const records=[];
  for(const [file,wanted] of [['full-campaign-actual-v10-commands.json',3],['v074-shelter-natural-commands.json',10],['v074-patient-natural-commands.json',31],['v074-ch2-bridge-natural-commands.json',36]]){
    let s=E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}});
    const commands=require('../tests/fixtures/'+file);
    for(const c of commands){
      const using=()=>c.type==='USE_REWARD'&&E.killReactionActions(s).some(a=>!a.disabled&&a.command.type==='USE_REWARD'&&a.command.rewardId===c.rewardId&&a.command.enemyId===c.enemyId);
      while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
      const prior=s;s=E.dispatch(s,c);
      if(Effects.describe(s,E).some(effect=>effect.card===wanted)){records.push({wanted,prior,next:s,command:c});break;}
    }
  }assert.equal(records.length,4);return records;
}
function chapelCombat(){let s=E.create(90,'beast-claw',0,null,'hunter-pistol','center',
  {campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}});
  for(const c of require('../tests/fixtures/weapon-campaign-completion/beast-claw-0.json')){
    const using=()=>c.type==='USE_REWARD'&&E.killReactionActions(s).some(a=>!a.disabled&&a.command.type===c.type&&a.command.rewardId===c.rewardId&&a.command.enemyId===c.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
    s=E.dispatch(s,c);const e=s.combat&&s.enemies.find(e=>e.id===s.combat.enemyId);
    if(s.phase==='combat_react'&&e?.kind==='scourge-beast'&&e.missionId!=='shelter'&&E.node(s,e.node)?.tile==='tile-17'&&s.combat.action?.kind==='special')return s;
  }throw Error('No normal chapel combat in natural replay');
}
function chapelZero(){const commands=[{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},
  {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-17:top'},{type:'EXPLORE',edge:'E'},
  {type:'PLACE_TILE',rotation:1},{type:'STEP',node:'tile-03:room'},{type:'STEP',node:'tile-03:entry'}];
  return {before:replay(initial(7),commands),commands,step:{type:'STEP',node:'tile-17:top'}};
}
function firearmReward(){let s=E.create(90,'burial',1,null,'hunter-pistol','center',
  {campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}});
  for(const c of require('../tests/fixtures/full-campaign-actual-v10-commands.json')){
    const using=()=>c.type==='USE_REWARD'&&E.killReactionActions(s).some(a=>!a.disabled&&a.command.type===c.type&&a.command.rewardId===c.rewardId&&a.command.enemyId===c.enemyId);
    while(s.phase==='kill_react'&&!s.rewardChoices.length&&!using())s=E.dispatch(s,{type:'PASS_KILL_REACTION'});
    s=E.dispatch(s,c);if(s.rewardChoices.some(c=>c.firearmId))return s;
  }throw Error('No natural firearm reward');
}
(async()=>{
  await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
  try{
    browser=await chromium.launch({headless:true});report.browser=browser.version();
    page=await browser.newPage({viewport:{width:1208,height:848},reducedMotion:'no-preference'});
    page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto('http://127.0.0.1:8787/hunt.html');
    await attempt('responsive-hand-selection-and-tooltips',async()=>{
      let s=replay(initial(),[{type:'USE_CONSUMABLE',itemId:'item-qa-1-11'}]);assert.equal(E.hunter(s).hand.length,6);s=await load(s);
      for(const width of [1208,848,390]){
        await page.setViewportSize({width,height:848});
        const layout=await page.locator('#hand').evaluate(el=>({cols:getComputedStyle(el).gridTemplateColumns.split(' ').length,
          overflow:getComputedStyle(el).overflowY,scroll:el.scrollHeight,height:el.clientHeight,cards:[...el.children].map(x=>({w:x.clientWidth,h:x.clientHeight}))}));
        assert(layout.cols<=3);assert.equal(layout.overflow,'auto');assert(layout.scroll>layout.height,'Large hand has no scroll range');
        const card=page.locator('#hand [data-card]').first();await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');await card.click();assert.equal(await card.getAttribute('aria-pressed'),'false');
        const slot=page.locator('#slots [data-slot]').first();await slot.click();assert.equal(await slot.getAttribute('aria-pressed'),'true');await slot.click();assert.equal(await slot.getAttribute('aria-pressed'),'false');
        assert.deepEqual(await saved(),s);
        const gun=page.locator('#firearm [data-firearm-info]').first();await gun.hover();
        assert.equal(await gun.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).display),'block');await gun.focus();
        assert.equal(await gun.locator('[role=tooltip]').evaluate(el=>getComputedStyle(el).display),'block');
        const box=await gun.locator('[role=tooltip]').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=848,'Firearm tooltip leaves the viewport');
        const slots=await page.locator('#slots').evaluate(el=>({overflow:getComputedStyle(el).overflowY,scroll:el.scrollHeight,height:el.clientHeight,
          spill:[...el.children].some(card=>card.scrollHeight>card.clientHeight+2)}));assert(!slots.spill,'Slot text spills outside its card');
        if(slots.scroll>slots.height+2)assert(['auto','scroll'].includes(slots.overflow),'Offscreen slot text has no scroll path');
        report.observations.push({name:'viewport-'+width,layout,tooltip:await gun.getAttribute('title')});await screenshot('hand-tooltip-'+width);
      }
      await page.setViewportSize({width:1208,height:848});
      for(const count of [5,4]){const id=E.hunter(s).hand[0].id;await page.locator(`[data-card="${id}"]`).click();
        await page.locator('#movementControls [data-command=MOVE]').click();s=E.dispatch(s,{type:'MOVE',cardId:id});
        await page.locator('#movementControls [data-command=STOP_MOVE]').click();s=E.dispatch(s,{type:'STOP_MOVE'});assert.deepEqual(await saved(),s);
        assert.equal(await page.locator('#hand [data-card]').count(),count);await screenshot('hand-'+count+'-cards');}
      const tile=page.locator('[data-tile-info="tile-14"]');await tile.click();assert.match(await page.locator('#tileInfo').innerText(),/中央|중앙|순간이동/);assert.deepEqual(await saved(),s);
    });
    await attempt('direction-controller-continuity',async()=>{
      let s=initial();s=await load(s);const id=E.hunter(s).hand[0].id;await page.locator(`[data-card="${id}"]`).click();
      await page.locator('#movementControls [data-command=MOVE]').click();s=E.dispatch(s,{type:'MOVE',cardId:id});assert.deepEqual(await saved(),s);
      await page.locator('[data-move-direction=E]').click();s=E.dispatch(s,{type:'STEP',node:'tile-14:right'});assert.deepEqual(await saved(),s);
      await page.locator('#movementControls [data-command=STOP_MOVE]').click();s=E.dispatch(s,{type:'STOP_MOVE'});assert.deepEqual(await saved(),s);await acknowledge();
      await clean();await screenshot('controller-after-move');
    });
    await attempt('naturally-earned-firearm-tooltip-and-equip',async()=>{
      let s=firearmReward();s=await load(s);const choice=s.rewardChoices.find(c=>c.firearmId),gun=E.rewardsView(s).firearms.find(g=>g.id===choice.firearmId);
      assert(gun.actual);const name=page.locator(`#decisions [data-firearm-info="${gun.id}"]`);await name.hover();await name.focus();
      assert.match(await name.getAttribute('title'),/손패 2장/);const box=await name.locator('[role=tooltip]').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=1208&&box.y+box.height<=848);
      assert.deepEqual(await saved(),s);await screenshot('earned-firearm-tooltip');s=await transition(s,{type:'EQUIP_FIREARM',firearmId:gun.id});
      assert.equal(await page.locator('#firearm [data-firearm-info]').getAttribute('data-firearm-info'),gun.id);await screenshot('earned-firearm-equipped');
    });
    await attempt('controller-real-branch-choice',async()=>{
      let s=naturalReplay(E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}}),
        require('../tests/fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,32));
      s=await load(s);const down=U.movement(s).directions.find(d=>d.edge==='S');assert.equal(down.options.filter(o=>o.enabled).length,2);
      await page.locator('[data-move-direction=S]').click();assert.deepEqual(await saved(),s);await screenshot('controller-branch-choice');
      await page.locator('[data-move-option="1"]').click();assert.deepEqual(await saved(),E.dispatch(s,down.options[1].command));await acknowledge();
    });
    await attempt('controller-real-escort-confirmation',async()=>{
      let s=naturalReplay(E.create(90,'burial',1,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}}),
        require('../tests/fixtures/v074-shelter-natural-commands.json').slice(0,75));
      s=await load(s);await page.locator('[data-card="card-1"]').click();await page.locator('#movementControls [data-command=MOVE]').click();s=E.dispatch(s,{type:'MOVE',cardId:'card-1'});
      assert.deepEqual(await saved(),s);const d=U.movement(s).directions.find(d=>d.options.some(o=>o.command.node==='tile-11:street'));assert(d);
      await page.locator(`[data-move-direction="${d.edge}"]`).click();assert.equal(await page.locator('#escortDialog').evaluate(x=>x.open),true);
      assert.deepEqual(await saved(),s);await screenshot('controller-escort-confirm');await page.locator('#escortAccept').click();
      s=replay(s,[{type:'MISSION_PICKUP'},{type:'STEP',node:'tile-11:street'}]);assert.deepEqual(await saved(),s);await acknowledge();
    });
    await attempt('rotated-tile-and-combat-continuity',async()=>{
      let s=replay(initial(),[{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},{type:'PLACE_TILE',rotation:0}]);s=await load(s);
      const view=U.movement(s),direction=view.directions.find(d=>d.options.some(o=>o.command.node==='tile-01:top'));
      assert(direction);await page.locator(`[data-move-direction="${direction.edge}"]`).click();s=E.dispatch(s,{type:'STEP',node:'tile-01:top'});assert.deepEqual(await saved(),s);
      s=await transition(s,{type:'STOP_MOVE'});await acknowledge();
      if(s.phase==='weapon_entry')s=await transition(s,{type:'ENTRY_WEAPON',accept:false});
      if(s.phase==='firearm_react')s=await transition(s,{type:'FIREARM_ENTRY',accept:false});
      s=await transition(s,{type:'USE_CONSUMABLE',itemId:'item-qa-1-11'});
      const id=E.hunter(s).hand.find(c=>c.kind==='strength')?.id||E.hunter(s).hand[0].id;
      s=await transition(s,{type:'ATTACK',cardId:id,slot:0,enemyId:'scourge-beast-1'});
      assert.match(await page.locator('#combatInfo').innerText(),/속도|피해/);assert.equal(await page.locator('[data-slot="0"]').isDisabled(),true);
      assert.match(await page.locator('[data-slot="0"]').innerText(),/사용됨/);await screenshot('current-combat');
      if(['combat_react','boss_react'].includes(s.phase))s=await transition(s,{type:'RESOLVE'});await acknowledge();await screenshot('after-resolve');
    });
    for(const record of naturalRecords())await attempt('mission-'+record.wanted+'-actual-trigger',async()=>{
      const prior=await load(record.prior),next=E.applyTileSpeedRuling(E.dispatch(prior,record.command));
      await clickCommand(record.command);sameState(await saved(),next);
      const changes=Feedback.describe(prior,next,{E,publicText:require('../src/hunt-public-text'),data:require('../campaigns/long-hunt/data.json')});
      assert(changes.length);assert.equal(await page.locator('#missionUpdateDialog').evaluate(x=>x.open),true);
      const alert=await page.locator('#missionUpdateList').innerText();assert.match(alert,/속도|피해|공격|능력/);await screenshot('mission-'+record.wanted+'-alert');
      await acknowledge();const effect=Effects.describe(next,E).find(x=>x.card===record.wanted);assert(effect);
      const enemy=next.enemies.find(e=>e.id===effect.enemyId);await page.locator(`[data-tile-info="${E.node(next,enemy.node).tile}"]`).click();
      await page.locator(`#tileInfo [data-special-info="${enemy.id}"]`).click();
      const detail=await page.locator('#enemyDetailContent').innerText();assert(detail.includes(effect.description));
      await screenshot('mission-'+record.wanted+'-detail');await page.locator('#closeEnemyDetail').click();
      report.observations.push({name:'mission-'+record.wanted+'-public-alert',alert,effect});
      await clean();
    });
    await attempt('chapel-zero-speed-and-real-detail',async()=>{
      let s=chapelCombat();s=await load(s);const e=s.enemies.find(e=>e.id===s.combat.enemyId),base=E.enemyDef(s,e).special;
      assert.equal(s.combat.action.speed,Math.max(0,base.speed-1));
      const text=await page.locator('#combatInfo').innerText();assert.match(text,/오에돈 예배당 · 속도 -1/);
      assert(text.includes(`속도 ${base.speed} → ${s.combat.action.speed}`));
      await page.locator(`[data-enemy="${e.id}"]`).first().click();assert.match(await page.locator('#mapContext').innerText(),/오에돈 예배당 · 속도 -1/);
      await page.locator('[data-tile-info="tile-17"]').click();assert.match(await page.locator('#tileInfo').innerText(),/속도/);
      assert.deepEqual(await saved(),s);await screenshot('chapel-zero-speed');
      for(const img of await page.locator('[data-tile-art][data-tile-rotation]:not([data-tile-rotation="0"])').all()){
        await page.waitForFunction(el=>el.src.startsWith('blob:')&&el.complete&&el.naturalWidth>0,await img.elementHandle());
        report.observations.push({name:'rotated-art-loaded',tile:await img.getAttribute('data-tile-art'),rotation:await img.getAttribute('data-tile-rotation')});
      }
      await screenshot('rotated-tiles');
    });
    await attempt('chapel-one-to-zero-actual-pursuit-and-attack',async()=>{
      const checkpoint=chapelZero();let s=await load(checkpoint.before);s=await transition(s,checkpoint.step);
      assert.equal(E.hunter(s).position,'tile-17:top');const e=s.enemies.find(e=>e.id==='scourge-beast-1');assert.equal(e.node,'tile-17:top');
      await page.locator(`#chapterMap [data-enemy="${e.id}"]`).click();assert.match(await page.locator('#mapContext').innerText(),/속도 1 → 0/);await screenshot('chapel-one-to-zero-detail');
      const command={type:'ATTACK',cardId:E.hunter(s).hand[0].id,slot:0,enemyId:e.id};s=await transition(s,command);
      assert.equal(s.combat.action.speed,0);assert.equal(s.combat.action.name,'달려들어 뜯기');assert.match(await page.locator('#combatInfo').innerText(),/속도 1 → 0/);
      await screenshot('chapel-one-to-zero-combat');s=await transition(s,{type:'RESOLVE'});await acknowledge();await clean();await screenshot('chapel-one-to-zero-after-resolve');
      const arts=page.locator('#chapterMap [data-tile-art][data-tile-rotation="1"]');assert(await arts.count()>0);
      for(const img of await arts.all())await page.waitForFunction(el=>el.src.startsWith('blob:')&&el.complete&&el.naturalWidth>0,await img.elementHandle());
      report.observations.push({name:'chapel-zero-normal-command-preparation',seed:7,commands:checkpoint.commands,actualCommands:[checkpoint.step,command,{type:'RESOLVE'}]});
    });
    await attempt('real-unnamed-location-cleanup',async()=>{
      let s=naturalReplay(E.create(90,'beast-claw',0,null,'hunter-pistol','center',{campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[]}}),
        require('../tests/fixtures/weapon-campaign-completion/beast-claw-0.json').slice(0,132));
      assert.match(E.node(s,E.hunter(s).position).name,/명칭 없는/);s=await load(s);
      for(const id of ['status','chapterMap','huntLog'])assert.doesNotMatch(await page.locator('#'+id).innerText(),/명칭 없는 타일/);
      assert.deepEqual(await saved(),s);await screenshot('unnamed-cell-label');
    });
  }catch(e){report.failures.push({name:'browser-run',error:e.stack});}
  finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({browser:report.browser,passed:report.observations.length,failures:report.failures,pageErrors:report.pageErrors},null,2));if(report.failures.length||report.pageErrors.length)process.exitCode=1;}
})();
