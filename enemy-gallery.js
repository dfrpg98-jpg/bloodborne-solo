(function(){
  "use strict";
  const $=id=>document.getElementById(id),V=window.BBEnemyVisuals;
  const viewport=$("enemyGalleryViewport"),host=$("enemyGalleryEffects"),select=$("galleryEnemy");
  if(!V || !window.BBHuntPresentation){$("enemyGalleryStatus").textContent="미리보기 파일을 불러오지 못했습니다. 설치 폴더의 파일을 확인하세요.";return;}
  function spec(key){
    const base=key.replace(/^e-/,""),boss=base.match(/^cleric-beast-([12])$/),normal=base.match(/^(huntsman-mob|scourge-beast|huntsmans-minion)-([ab])$/);
    return boss?{enemyId:"cleric-beast",side:"actual",phase:Number(boss[1])}:normal?{enemyId:normal[1],side:normal[2],phase:1}:
      {enemyId:base,side:base.endsWith("-b")?"b":base==="iosefka-hostile"?"1-2":"a",phase:1};
  }
  const profiles=V.ids.map(key=>{const s=spec(key);return V.definition(s.enemyId,s.side,s.phase);}).filter(Boolean);
  if(!profiles.length){$("enemyGalleryStatus").textContent="선택할 적 외형 자료가 없습니다.";return;}
  let selected=profiles[0],revision=0,hp=6,fallen=false,x=.34,lastAction="대기",loadingSince=Date.now();
  const originalAssets=window.BBEnemyCharacterAssets||{};
  function hasAnimation(name){const frames=originalAssets[selected.skin]?.animations?.[name]?.frames;return Array.isArray(frames)&&new Set(frames).size>1;}
  function hasMotion(slot){return hasAnimation("attack-"+slot);}
  const buttons=[];
  for(let i=0;i<5;i++){const button=document.createElement("button");button.id="galleryEnemyAction"+i;button.onclick=()=>previewAttack(i);$("enemyGalleryActions").append(button);buttons.push(button);}
  function label(p){return p.name+" · "+(p.boss?p.phase+"페이즈":p.actions.map(action=>action.name).join(" / "));}
  for(const p of profiles){const option=document.createElement("option");option.value=p.skin;option.textContent=label(p);select.append(option);}
  const presentation=window.BBHuntPresentation({document,Phaser:window.Phaser,viewport,host,
    characters:{...window.BBCharacterAssets,...window.BBWeaponCharacterAssets,...window.BBEnemyCharacterAssets},
    onReady:()=>render()});
  function enemy(){return {id:"enemy",kind:"enemy",skin:selected.skin,enemyId:selected.enemyId,enemySide:selected.side,
    enemyPhase:selected.phase,hp,x:viewport.clientWidth*x,y:viewport.clientHeight-60,scale:selected.boss?2.3:2.1,
    fallbackSkin:selected.boss?"boss":selected.enemyId==="scourge-beast"?"beast":"mob"};}
  function hunter(){return {id:"hunter",kind:"hunter",skin:"hunter",hp:99,x:viewport.clientWidth*.74,y:viewport.clientHeight-60,scale:1.8};}
  function updateStatus(){
    const ready=host.dataset.presentationEnemyReady==="true";
    const registered=!!originalAssets[selected.skin];
    $("enemyGalleryStatus").textContent=fallen?label(selected)+" · 쓰러짐. 대기로 돌아가 다시 확인하세요.":
      ready?label(selected)+" · "+(hasAnimation("idle")?"원작 외형":"원작 정지 외형")+" · "+lastAction:!registered?label(selected)+" · 원작 자산 준비 중 · 현재 대체 외형":
        Date.now()-loadingSince>10000?label(selected)+" · 원작 그림 연결 확인 필요 · 현재 대체 외형 (로딩 지연 또는 실패)":
        label(selected)+" · 원작 그림을 불러오는 중입니다.";
    host.dataset.galleryEnemyProfile=selected.skin;host.dataset.galleryEnemyAction=lastAction;
  }
  function render(actions=[]){
    select.value=selected.skin;
    buttons.forEach((b,i)=>{const a=selected.actions[i],motion=hasMotion(i);b.textContent=a?a.name+(motion?"":" · 효과만"):"행동 없음";b.title=a&&!motion?"원작 고유 동작 미확보 · 공개 효과만 미리보기":"";b.disabled=!a;b.hidden=!a;});
    $("galleryEnemyWalk").textContent=hasAnimation("walk")?"이동 동작":"이동 연출";
    $("galleryEnemyHit").textContent=hasAnimation("hit")?"피격 동작":"피격 효과";
    $("galleryEnemyDeath").textContent=hasAnimation("death")?"쓰러짐 동작":"쓰러짐 효과";
    const phaseButton=$("galleryEnemyPhase");phaseButton.hidden=!selected.boss;phaseButton.textContent=(selected.phase===1?"2페이즈로 전환":"1페이즈로 돌아가기")+(hasAnimation("transform")||hasAnimation("phase")?"":" · 전환 효과");
    presentation.resize({width:viewport.clientWidth,height:viewport.clientHeight});
    presentation.sync({sceneId:"enemy-gallery",revision,actors:fallen?[hunter()]:[enemy(),hunter()],actions,view:{x:0,y:0,zoom:1}});
    updateStatus();
  }
  function preview(actions=[],name="대기"){revision++;fallen=false;hp=6;lastAction=name;render(actions);}
  function previewAttack(slot){
    const a=selected.actions[slot];if(!a)return;
    const visual=V.action(selected.enemyId,selected.side,selected.phase,a.name);if(!visual)return;
    const actualMotion=hasMotion(slot)&&host.dataset.presentationEnemyReady==="true";
    const type=!actualMotion||visual.actionType==="ability"?"ability":visual.motion==="shot"?"shot":"attack";
    host.dataset.galleryEnemyActionMode=actualMotion?"original-motion":"public-effect-only";
    preview([{type,fromId:"enemy",toId:"hunter",damage:0,...visual}],a.name+(actualMotion?"":" · 원작 동작 준비 중, 공개 효과만 미리보기"));
  }
  select.onchange=()=>{const found=profiles.find(p=>p.skin===select.value);if(!found)return;selected=found;x=.34;loadingSince=Date.now();preview();};
  $("galleryEnemyPhase").onclick=()=>{
    if(!selected.boss)return;
    const next=profiles.find(p=>p.enemyId===selected.enemyId&&p.phase!==selected.phase);if(!next)return;
    selected=next;loadingSince=Date.now();preview([{type:"phase",fromId:"enemy",skin:selected.skin}],"페이즈 전환");
  };
  $("galleryEnemyWalk").onclick=()=>{const from={x:viewport.clientWidth*x,y:viewport.clientHeight-60};x=x===.34?.46:.34;preview([{type:"move",fromId:"enemy",from}],"이동");};
  $("galleryEnemyHit").onclick=()=>{fallen=false;hp=Math.max(1,hp-1);revision++;lastAction="피격";render([{type:"attack",fromId:"hunter",toId:"enemy",damage:1,attackStyle:"other"}]);};
  $("galleryEnemyDeath").onclick=()=>{fallen=true;revision++;lastAction="쓰러짐";render([{type:"attack",fromId:"hunter",toId:"enemy",damage:hp,attackStyle:"other"}]);};
  $("galleryEnemyIdle").onclick=()=>preview();
  window.addEventListener("resize",()=>render());
  const statusTimer=window.setInterval(updateStatus,350);
  window.addEventListener("pagehide",()=>{window.clearInterval(statusTimer);presentation.destroy();},{once:true});
  render();
})();
