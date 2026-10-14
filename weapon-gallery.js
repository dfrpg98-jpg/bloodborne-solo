(function(){
  "use strict";
  const $=id=>document.getElementById(id),V=window.BBWeaponVisuals;
  const viewport=$("galleryViewport"),host=$("galleryEffects"),select=$("galleryWeapon"),subjectSelect=$("gallerySubject");
  const subjects={hunter:"공통 사냥꾼",mob:"공통 인간형 적",beast:"공통 야수형 적",boss:"공통 보스",female:"공통 여성 NPC",
    ...(window.BBEnemyVisuals?.names||{})};
  let subject="weapon",weaponId=V.ids[0],face=0,revision=0,hp=6,fallen=false,x=.4;
  const presentation=window.BBHuntPresentation({document,Phaser:window.Phaser,viewport,host,
    characters:{...window.BBCharacterAssets,...window.BBWeaponCharacterAssets},onReady:()=>render()});
  for(const id of V.ids){const option=document.createElement("option");option.value=id;option.textContent=V.definition(id).name;select.append(option);}
  function previewScale(){return subject==="cleric-beast"?Math.min(2.1,viewport.clientWidth/500):2.1;}
  function hunter(){return {id:"hunter",kind:subject==="weapon"||subject==="hunter"?"hunter":"enemy",
    ...(subject==="weapon"?{weaponId,weaponFace:face,skin:V.skin(weaponId,face,weaponId==="tonitrus"&&face===1)}:{skin:subject}),
    hp,x:viewport.clientWidth*x,y:viewport.clientHeight-60,scale:previewScale()};}
  function target(){return {id:"dummy",kind:"enemy",skin:"mob",hp:99,x:viewport.clientWidth*.72,y:viewport.clientHeight-60,scale:previewScale()*1.6/2.1};}
  function render(actions=[]){
    viewport.dataset.subject=subject;
    const w=V.definition(weaponId),weaponPreview=subject==="weapon";select.value=weaponId;subjectSelect.value=subject;
    select.hidden=!weaponPreview;$("galleryWeaponLabel").hidden=!weaponPreview;$("galleryTransform").disabled=!weaponPreview;
    for(let i=0;i<2;i++){const b=$("galleryForm"+i);b.hidden=!weaponPreview;b.disabled=!weaponPreview;
      b.textContent=weaponId==="tonitrus"?(i?"전기 충전":"충전 전"):w.faces[i].name;b.setAttribute("aria-pressed",String(weaponPreview&&face===i));}
    for(let i=0;i<3;i++){const a=w.faces[face].attacks[i],b=$("galleryAttack"+i);b.hidden=!weaponPreview&&i>0;
      b.textContent=weaponPreview?(a?a.name:"공격 슬롯 없음"):"공통 공격";b.disabled=weaponPreview?!a:i>0;}
    presentation.resize({width:viewport.clientWidth,height:viewport.clientHeight});
    presentation.sync({sceneId:"weapon-gallery",revision,actors:fallen?[target()]:[hunter(),target()],actions,view:{x:0,y:0,zoom:1}});
    const ready=weaponPreview?host.dataset.presentationWeaponReady==="true":presentation.status().charactersReady;
    $("galleryStatus").textContent=fallen?"쓰러짐 · 대기로 돌아가 다시 확인하세요.":ready?weaponPreview?w.name+" · "+(weaponId==="tonitrus"?(face?"전기 충전":"충전 전"):w.faces[face].name):subjects[subject]+" · 동작 미리보기":"선택한 캐릭터의 그림을 불러오는 중입니다.";
  }
  function action(actions){revision++;fallen=false;hp=6;render(actions);}
  select.onchange=()=>{weaponId=select.value;face=0;fallen=false;hp=6;revision++;render();};
  subjectSelect.onchange=()=>{subject=Object.hasOwn(subjects,subjectSelect.value)?subjectSelect.value:"weapon";fallen=false;hp=6;x=.4;revision++;render();};
  for(let i=0;i<2;i++)$("galleryForm"+i).onclick=()=>{if(subject!=="weapon")return;face=i;action([]);};
  $("galleryTransform").onclick=()=>{if(subject!=="weapon")return;face=1-face;action([{type:"transform",fromId:"hunter",skin:V.skin(weaponId,face,weaponId==="tonitrus"&&face===1)}]);};
  for(let i=0;i<3;i++)$("galleryAttack"+i).onclick=()=>{if(subject!=="weapon"){if(i===0)action([{type:"attack",fromId:"hunter",toId:"dummy",damage:0,skin:subject}]);return;}
    const a=V.attack(weaponId,face,i,weaponId==="tonitrus"&&face===1);if(a)action([{type:a.motion==="shot"?"shot":"attack",fromId:"hunter",toId:"dummy",damage:0,...a}]);};
  $("galleryWalk").onclick=()=>{const from={x:viewport.clientWidth*x,y:viewport.clientHeight-60};x=x===.4?.28:.4;action([{type:"move",fromId:"hunter",from}]);};
  $("galleryHit").onclick=()=>{fallen=false;hp=Math.max(1,hp-1);revision++;render([{type:"attack",fromId:"dummy",toId:"hunter",damage:1}]);};
  $("galleryDeath").onclick=()=>{fallen=true;revision++;render([{type:"attack",fromId:"dummy",toId:"hunter",damage:6}]);};
  $("galleryIdle").onclick=()=>action([]);
  window.addEventListener("resize",()=>render());
  render();
})();
