(function(){
  "use strict";
  const $=id=>document.getElementById(id),V=window.BBWeaponVisuals;
  const viewport=$("galleryViewport"),host=$("galleryEffects"),select=$("galleryWeapon");
  if(!V || !window.BBHuntPresentation){$("galleryStatus").textContent="미리보기 파일을 불러오지 못했습니다. 설치 폴더의 파일을 확인하세요.";return;}
  let weaponId=V.ids[0],face=0,revision=0,hp=6,fallen=false,x=.4,lastAction="정지 모습",loadingSince=Date.now();
  const originalAssets=window.BBWeaponCharacterAssets||{};
  function selectedSkin(){return V.skin(weaponId,face,weaponId==="tonitrus"&&face===1);}
  function hasAnimation(name){const frames=originalAssets[selectedSkin()]?.animations?.[name]?.frames;return Array.isArray(frames)&&new Set(frames).size>1;}
  function formName(i=face){return weaponId==="tonitrus"?(i?"전기 충전":"충전 전"):V.definition(weaponId).faces[i].name.replace(/(?:[AB]\s*면|앞면|뒷면)/g,"").replace(/\s*·\s*$/g,"").trim();}
  const presentation=window.BBHuntPresentation({document,Phaser:window.Phaser,viewport,host,
    characters:{...window.BBCharacterAssets,...window.BBWeaponCharacterAssets},onReady:()=>render()});
  for(const id of V.ids){const option=document.createElement("option");option.value=id;option.textContent=V.definition(id).name;select.append(option);}
  function hunter(){return {id:"hunter",kind:"hunter",weaponId,weaponFace:face,skin:selectedSkin(),hp,x:viewport.clientWidth*x,y:viewport.clientHeight-60,scale:2.1};}
  function target(){return {id:"dummy",kind:"enemy",skin:"mob",hp:99,x:viewport.clientWidth*.72,y:viewport.clientHeight-60,scale:1.6};}
  function render(actions=[]){
    const w=V.definition(weaponId);select.value=weaponId;
    for(let i=0;i<2;i++){const b=$("galleryForm"+i);b.textContent=formName(i);b.setAttribute("aria-pressed",String(face===i));}
    for(let i=0;i<3;i++){const a=w.faces[face].attacks[i],b=$("galleryAttack"+i),motion=hasAnimation("attack-"+i);b.textContent=a?a.name+(motion?" · 확보한 원작 동작":" · 효과만"):"공격 슬롯 없음";b.title=a&&!motion?"원작 고유 공격 미확보 · 슬롯에 연결한 효과만 확인":"";b.disabled=!a;}
    $("galleryWalk").textContent=hasAnimation("walk")?"확보한 이동 동작":"이동 연출";
    $("galleryHit").textContent=hasAnimation("hit")?"확보한 피격 동작":"피격 효과";
    $("galleryDeath").textContent=hasAnimation("death")?"확보한 쓰러짐 동작":"쓰러짐 효과";
    $("galleryTransform").textContent=hasAnimation("transform")?"확보한 변형 동작":"형태 전환 효과";
    $("galleryIdle").textContent=hasAnimation("idle")?"확보한 대기 동작":"정지 모습";
    presentation.resize({width:viewport.clientWidth,height:viewport.clientHeight});
    presentation.sync({sceneId:"weapon-gallery",revision,actors:fallen?[target()]:[hunter(),target()],actions,view:{x:0,y:0,zoom:1}});
    updateStatus();
  }
  function updateStatus(){
    const ready=host.dataset.presentationWeaponReady==="true",registered=!!originalAssets[selectedSkin()],name=V.definition(weaponId).name+" · "+formName();
    $("galleryStatus").textContent=fallen?name+" · 쓰러짐 효과. 정지 모습으로 돌아가 다시 확인하세요.":ready?name+" · "+(hasAnimation("idle")?"확보한 원작 대기 동작":"원작 정지 외형")+" · "+lastAction:
      !registered?name+" · 원작 자산 준비 중 · 현재 대체 외형":Date.now()-loadingSince>10000?name+" · 원작 그림 연결 확인 필요 · 현재 대체 외형 (로딩 지연 또는 실패)":name+" · 원작 그림을 불러오는 중입니다.";
    host.dataset.galleryWeaponSkin=selectedSkin();host.dataset.galleryWeaponAction=lastAction;
  }
  function action(actions,name="정지 모습"){revision++;fallen=false;hp=6;lastAction=name;render(actions);}
  select.onchange=()=>{weaponId=select.value;face=0;fallen=false;hp=6;revision++;lastAction="정지 모습";loadingSince=Date.now();render();};
  for(let i=0;i<2;i++)$("galleryForm"+i).onclick=()=>{face=i;loadingSince=Date.now();action([]);};
  $("galleryTransform").onclick=()=>{face=1-face;loadingSince=Date.now();action([{type:"transform",fromId:"hunter",skin:selectedSkin()}],hasAnimation("transform")?"확보한 변형 동작":"형태 전환 효과");};
  for(let i=0;i<3;i++)$("galleryAttack"+i).onclick=()=>{const a=V.attack(weaponId,face,i,weaponId==="tonitrus"&&face===1);if(a){const motion=hasAnimation("attack-"+i)&&host.dataset.presentationWeaponReady==="true";host.dataset.galleryWeaponActionMode=motion?"original-motion":"effect-only";action([{type:a.motion==="shot"?"shot":"attack",fromId:"hunter",toId:"dummy",damage:0,...a}],V.definition(weaponId).faces[face].attacks[i].name+(motion?" · 확보한 원작 프레임":" · 효과만"));}};
  $("galleryWalk").onclick=()=>{const from={x:viewport.clientWidth*x,y:viewport.clientHeight-60};x=x===.4?.28:.4;action([{type:"move",fromId:"hunter",from}],hasAnimation("walk")?"확보한 이동 동작":"이동 연출");};
  $("galleryHit").onclick=()=>{fallen=false;hp=Math.max(1,hp-1);revision++;lastAction=hasAnimation("hit")?"확보한 피격 동작":"피격 효과";render([{type:"attack",fromId:"dummy",toId:"hunter",damage:1}]);};
  $("galleryDeath").onclick=()=>{fallen=true;revision++;lastAction=hasAnimation("death")?"확보한 쓰러짐 동작":"쓰러짐 효과";render([{type:"attack",fromId:"dummy",toId:"hunter",damage:6}]);};
  $("galleryIdle").onclick=()=>action([]);
  window.addEventListener("resize",()=>render());
  const statusTimer=window.setInterval(updateStatus,350);
  window.addEventListener("pagehide",()=>{window.clearInterval(statusTimer);presentation.destroy();},{once:true});
  render();
})();
