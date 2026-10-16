(function(){
  "use strict";
  const $=id=>document.getElementById(id),V=window.BBWeaponVisuals;
  const viewport=$("galleryViewport"),host=$("galleryEffects"),select=$("galleryWeapon");
  let weaponId=V.ids[0],face=0,revision=0,hp=6,fallen=false,x=.4;
  const presentation=window.BBHuntPresentation({document,Phaser:window.Phaser,viewport,host,
    characters:{...window.BBCharacterAssets,...window.BBWeaponCharacterAssets},onReady:()=>render()});
  for(const id of V.ids){const option=document.createElement("option");option.value=id;option.textContent=V.definition(id).name;select.append(option);}
  function hunter(){return {id:"hunter",kind:"hunter",weaponId,weaponFace:face,skin:V.skin(weaponId,face,weaponId==="tonitrus"&&face===1),hp,x:viewport.clientWidth*x,y:viewport.clientHeight-60,scale:2.1};}
  function target(){return {id:"dummy",kind:"enemy",skin:"mob",hp:99,x:viewport.clientWidth*.72,y:viewport.clientHeight-60,scale:1.6};}
  function render(actions=[]){
    const w=V.definition(weaponId);select.value=weaponId;
    for(let i=0;i<2;i++){const b=$("galleryForm"+i);b.textContent=weaponId==="tonitrus"?(i?"전기 충전":"충전 전"):w.faces[i].name;b.setAttribute("aria-pressed",String(face===i));}
    for(let i=0;i<3;i++){const a=w.faces[face].attacks[i],b=$("galleryAttack"+i);b.textContent=a?a.name:"공격 슬롯 없음";b.disabled=!a;}
    presentation.resize({width:viewport.clientWidth,height:viewport.clientHeight});
    presentation.sync({sceneId:"weapon-gallery",revision,actors:fallen?[target()]:[hunter(),target()],actions,view:{x:0,y:0,zoom:1}});
    const ready=host.dataset.presentationWeaponReady==="true";
    $("galleryStatus").textContent=fallen?"쓰러짐 · 대기로 돌아가 다시 확인하세요.":ready?w.name+" · "+(weaponId==="tonitrus"?(face?"전기 충전":"충전 전"):w.faces[face].name):"선택한 무기의 그림을 불러오는 중입니다.";
  }
  function action(actions){revision++;fallen=false;hp=6;render(actions);}
  select.onchange=()=>{weaponId=select.value;face=0;fallen=false;hp=6;revision++;render();};
  for(let i=0;i<2;i++)$("galleryForm"+i).onclick=()=>{face=i;action([]);};
  $("galleryTransform").onclick=()=>{face=1-face;action([{type:"transform",fromId:"hunter",skin:V.skin(weaponId,face,weaponId==="tonitrus"&&face===1)}]);};
  for(let i=0;i<3;i++)$("galleryAttack"+i).onclick=()=>{const a=V.attack(weaponId,face,i,weaponId==="tonitrus"&&face===1);if(a)action([{type:a.motion==="shot"?"shot":"attack",fromId:"hunter",toId:"dummy",damage:0,...a}]);};
  $("galleryWalk").onclick=()=>{const from={x:viewport.clientWidth*x,y:viewport.clientHeight-60};x=x===.4?.28:.4;action([{type:"move",fromId:"hunter",from}]);};
  $("galleryHit").onclick=()=>{fallen=false;hp=Math.max(1,hp-1);revision++;render([{type:"attack",fromId:"dummy",toId:"hunter",damage:1}]);};
  $("galleryDeath").onclick=()=>{fallen=true;revision++;render([{type:"attack",fromId:"dummy",toId:"hunter",damage:6}]);};
  $("galleryIdle").onclick=()=>action([]);
  window.addEventListener("resize",()=>render());
  render();
})();
