'use strict';
// Real cloud Chromium reproduction. Preparation uses only accepted game commands.
// Raw QA saves stay in memory and never enter the uploaded evidence directory.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const E=require('../hunt-engine');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/weapon-animation-repro');
fs.mkdirSync(out,{recursive:true});
const expectedImpacts=Number(process.env.EXPECTED_IMPACTS||2);
const report={commit:process.env.GITHUB_SHA||'local',mode:expectedImpacts===2?'before-fix-reproduction':'after-fix-regression',expectedImpacts,method:'Normal QA command preparation, product file import, actual Chromium clicks, public renderer counters and original screenshots.',cases:[],failures:[],pageErrors:[]};
const options={campaign:true,rulesVersion:14,qa:{preset:'custom',startRewards:[],startConsumables:[...Array(10).fill('qa-heal'),...Array(10).fill('qa-cards'),...Array(10).fill('qa-travel')]}};
const prefix=[{type:'USE_CONSUMABLE',itemId:'item-qa-1-21'},{type:'EXPLORE',edge:'N'},{type:'PLACE_TILE',rotation:0},{type:'STEP',node:'tile-01:top'},{type:'STOP_MOVE'},{type:'USE_CONSUMABLE',itemId:'item-qa-1-11'},{type:'TRANSFORM',cardId:'card-1'},{type:'TRANSFORM',cardId:'card-3'},{type:'USE_CONSUMABLE',itemId:'item-qa-1-22'},{type:'EXPLORE',edge:'N'},{type:'PLACE_TILE',rotation:1},{type:'STOP_MOVE'},{type:'ATTACK',cardId:'card-6',slot:0,enemyId:'huntsmans-minion-1'},{type:'RESOLVE'},{type:'USE_CONSUMABLE',itemId:'item-qa-1-12'}];
function prepare(weapon,face){let s=E.create(140,weapon,face,null,E.data.weapons[weapon].defaultFirearm||'hunter-pistol','center',options);for(const c of prefix)s=E.dispatch(s,c);assert.equal(s.phase,'weapon_choice');assert.deepEqual(E.importSave(E.exportSave(s)),s);return s;}
function ruling(s){for(const key of ['applyChapelRuling','applyCombatReactionRuling','applyTileSpeedRuling'])if(E[key])s=E[key](s);return s;}
const pub=s=>({phase:s.phase,face:E.hunter(s).face,position:E.hunter(s).position,enemies:s.enemies.map(e=>({id:e.id,node:e.node,hp:e.hp}))});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});});
if(process.argv.includes('--model-only')){for(const [w,f] of [['ludwigs-holy-blade',1],['uncanny-ludwigs-holy-blade',0],['kirkhammer',0]])console.log(JSON.stringify({weapon:w,prepared:pub(prepare(w,f))}));process.exit(0);}
(async()=>{const {chromium}=require('playwright');let browser;await new Promise(resolve=>server.listen(10080,'127.0.0.1',resolve));try{
  browser=await chromium.launch({headless:true});report.browser=browser.version();
  for(const [weapon,face] of [['ludwigs-holy-blade',1],['uncanny-ludwigs-holy-blade',0],['kirkhammer',0]]){
    const context=await browser.newContext({viewport:{width:1459,height:1252},reducedMotion:'no-preference'}),page=await context.newPage();
    const row={weapon,initialFace:face,preparationCommands:prefix,trigger:{type:'WEAPON_CHOICE',enemyId:'scourge-beast-2'},screenshots:[]};
    page.on('pageerror',error=>report.pageErrors.push({weapon,error:error.message}));
    try{
      let s=prepare(weapon,face);row.prepared=pub(s);await page.goto('http://127.0.0.1:10080/hunt.html');
      await page.locator('#file').setInputFiles({name:'qa-weapon-target.json',mimeType:'application/json',buffer:Buffer.from(E.exportSave(s))});s=ruling(s);
      await page.waitForFunction(expected=>!document.querySelector('#setupDialog').open&&localStorage.getItem('bloodborne-hunt-qa-v1')===expected,E.exportSave(s),{timeout:20000});
      const host=page.locator('[data-presentation-attacks]');await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-presentation-attacks]')).some(x=>x.dataset.presentationCharacters==='ready'),null,{timeout:20000});
      await page.waitForTimeout(1200);assert.equal(await page.locator('#error').innerText(),'');
      const start=Date.now(),shot=async label=>{const file=weapon+'-'+label+'.png',at=Date.now()-start;await page.screenshot({path:path.join(out,file)});row.screenshots.push({file,requestedAtMs:at,capturedAtMs:Date.now()-start});};
      row.before=pub(E.importSave(await page.evaluate(()=>localStorage.getItem('bloodborne-hunt-qa-v1'))));row.counterBefore=Number(await host.getAttribute('data-presentation-attacks'));await shot('before');
      const controls=page.locator('#decisions [data-command="WEAPON_CHOICE"]');let target;
      for(let i=0;i<await controls.count();i++){const b=controls.nth(i),args=JSON.parse(await b.getAttribute('data-args')||'{}');if(args.enemyId==='scourge-beast-2'&&!await b.isDisabled()){target=b;break;}}
      assert(target,'Missing public enabled target selection');await target.click();
      await page.waitForFunction(old=>Number(document.querySelector('[data-presentation-attacks]').dataset.presentationAttacks)>old,row.counterBefore,{timeout:10000});await shot('first-impact');await page.waitForTimeout(330);await shot('next-impact');await page.waitForTimeout(1100);await shot('settled');
      row.after=pub(E.importSave(await page.evaluate(()=>localStorage.getItem('bloodborne-hunt-qa-v1'))));row.counterAfter=Number(await host.getAttribute('data-presentation-attacks'));row.actualImpacts=row.counterAfter-row.counterBefore;
      assert.deepEqual(row.after,pub(ruling(E.dispatch(s,row.trigger))));assert.equal(row.after.enemies.find(e=>e.id==='scourge-beast-1').hp,4);assert.equal(row.after.enemies.find(e=>e.id==='scourge-beast-2').hp,3);assert.equal(row.after.phase,'hunter');assert.equal(row.actualImpacts,expectedImpacts);assert.equal(await page.locator('#error').innerText(),'');row.status='verified';
    }catch(error){row.status='failed';row.error=error.message;report.failures.push({weapon,error:error.message});}
    finally{report.cases.push(row);await context.close();}
  }
}catch(error){report.failures.push({stage:'browser',error:error.message});}finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({commit:report.commit,mode:report.mode,cases:report.cases.map(x=>({weapon:x.weapon,status:x.status,actualImpacts:x.actualImpacts,error:x.error})),failures:report.failures,pageErrors:report.pageErrors},null,2));if(report.failures.length||report.pageErrors.length)process.exitCode=1;}})();
