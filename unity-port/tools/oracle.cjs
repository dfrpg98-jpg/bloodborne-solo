'use strict';
// Local stdio development bridge. No listening port or production JS embedding.
const readline=require('node:readline');
const reference=require('./reference-source.cjs');
const E=reference('hunt-engine.js');
const animations=reference('hunt-animation-events.js');
const departure=reference('hunt-departure.js');
const project=require('./public-view.cjs')(E,reference('hunt-public-text.js'),
  reference('weapon-visuals.js'),reference('campaigns/long-hunt/data.json'));
function newSession() {
  let state=null,sceneId=null,successfulResets=0;
  return request => {
    if(!request || typeof request!=='object' || !Number.isInteger(request.id))throw Error('Request id must be an integer.');
    if(request.op==='create'){
      const x=request.setup || {};
      const next=E.create(x.seed??20261011,x.weaponId??'burial',x.face??0,x.startingConsumable??null,
        x.firearmId??'hunter-pistol',x.startSpace??'center',x.options??{campaign:true});
      const nextSceneId=`session-${successfulResets+1}`,view=project(next,nextSceneId);
      state=next;sceneId=nextSceneId;successfulResets++;
      return {id:request.id,ok:true,view,actions:[]};
    }
    // Import is permitted before a session is created; it validates its own setup.
    if(request.op==='import-save'){
      const next=E.importSave(request.save);
      const nextSceneId=`session-${successfulResets+1}`,view=project(next,nextSceneId);
      state=next;sceneId=nextSceneId;successfulResets++;
      return {id:request.id,ok:true,view,actions:[]};
    }
    if(!state)throw Error('Create or import a session first.');
    if(request.op==='view')return {id:request.id,ok:true,view:project(state,sceneId),actions:[]};
    if(request.op==='propose'){
      const plan=departure.plan(E,state,request.commands);
      return {id:request.id,ok:true,revision:state.revision,departure:plan ?
        {title:plan.title,name:plan.name,acceptCommands:plan.acceptCommands,declineCommands:plan.declineCommands} : null};
    }
    if(request.op==='export-save')return {id:request.id,ok:true,save:E.exportSave(state)};
    let next=state,commands=[];
    if(request.op==='apply-chapel-ruling')next=E.applyChapelRuling(state);
    else if(request.op==='apply-combat-reaction-ruling'){
      if(typeof E.applyCombatReactionRuling!=='function')throw Error('This reference engine does not implement combat-reaction adoption.');
      next=E.applyCombatReactionRuling(state);
    }
    else if(request.op==='dispatch'){
      if(request.expectedRevision!==state.revision)throw Error('Stale revision.');
      if(!Array.isArray(request.commands)||!request.commands.length)throw Error('A nonempty command batch is required.');
      commands=request.commands;
      // Exactly the existing commitCommands semantics: ordered dispatch to
      // temporary state, atomic commit after every original command succeeds.
      for(const command of commands)next=E.dispatch(next,command);
    }else throw Error('Unsupported operation.');
    const before=project(state,sceneId),after=project(next,sceneId);
    const actions=animations.describe(before,after,commands);
    state=next;
    return {id:request.id,ok:true,view:after,actions};
  };
}
module.exports={newSession,project};
if(require.main===module){
  const handle=newSession();
  for(const key of ['SIGINT','SIGTERM'])process.on(key,()=>process.exit(0));
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  lines.on('line',line=>{
    let request;
    try{
      // Embedded save strings are JSON-escaped again in this transport envelope.
      // Preserve the source's <2M save limit inside E.importSave, rather than
      // incorrectly applying it to the longer outer request line.
      if(line.length>=13000000)throw Error('Transport envelope exceeds 13 million UTF-16 code units.');
      request=JSON.parse(line);process.stdout.write(JSON.stringify(handle(request))+'\n');
    }catch(error){process.stdout.write(JSON.stringify({id:request?.id??null,ok:false,error:error.message})+'\n');}
  });
}
