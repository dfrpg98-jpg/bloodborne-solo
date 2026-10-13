(function(root){
  "use strict";
  const weapon={id:"qa-test-weapon",name:"검증용 장치무기",qaOnly:true,defaultFirearm:"hunter-pistol",
    faces:[12,6].map((damage,index)=>({name:index?"조절 공격면":"빠른 처치면",
      text:`검증 전용 · 세 슬롯 모두 속도 3, 피해 ${damage}. 적·임무의 방어와 판정은 그대로 처리합니다.`,
      slots:Array.from({length:3},(_,i)=>({name:`검증 공격 ${i+1}`,speed:3,damage,text:"검증 전용 공격"}))}))};
  const consumables={
    "qa-heal":{id:"qa-heal",name:"검증용 회복약",qaOnly:true,count:10,runtime:"playable",timing:"사냥꾼의 차례",
      rules:"체력을 6 치유하고 화기를 준비합니다. 검증 전용 소모품입니다.",effects:{heal:6,readyFirearm:true}},
    "qa-cards":{id:"qa-cards",name:"검증용 손패 보충",qaOnly:true,count:10,runtime:"playable",timing:"사냥꾼의 차례",
      rules:"모든 공격 슬롯을 비우고 카드 3장을 뽑습니다. 검증 전용 소모품입니다.",effects:{qaClearSlots:true,draw:3}},
    "qa-travel":{id:"qa-travel",name:"검증용 이동",qaOnly:true,count:10,runtime:"playable",timing:"사냥꾼의 차례",
      rules:"스탯 카드 없이 최대 6칸 이동합니다. 탐험·안개·추격·이동 종료 임무는 평소처럼 처리합니다.",effects:{move:6,qaLabel:"검증용 이동"}}
  };
  const presets={fast:{name:"빠른 임무 검증",startRewards:["lantern","old-hunter-bone","rune-hunter","rune-formless"],
    startConsumables:["qa-heal","qa-heal","qa-cards","qa-cards","qa-travel","qa-travel"]}};
  function normalize(input,data,rewards){
    const need=(ok,text)=>{if(!ok)throw Error(text);};
    need(input&&typeof input==="object"&&!Array.isArray(input),"검증 시작 설정을 확인하세요.");
    need(Object.keys(input).every(k=>["version","preset","startRewards","startConsumables"].includes(k)),"알 수 없는 검증 설정입니다.");
    need(input.version===undefined||input.version===1,"지원하지 않는 검증 설정 버전입니다.");
    const preset=input.preset||"custom";
    need(["fast","custom"].includes(preset),"검증 프리셋을 선택하세요.");
    const base=preset==="fast"?presets.fast:input;
    if(preset==="fast")for(const key of ["startRewards","startConsumables"])
      need(input[key]===undefined||JSON.stringify(input[key])===JSON.stringify(base[key]),"빠른 검증 프리셋의 지급 목록은 고정입니다.");
    need(Array.isArray(base.startRewards)&&base.startRewards.length<=16,"검증 시작 보상은 16장 이하입니다.");
    need(Array.isArray(base.startConsumables)&&base.startConsumables.length<=40,"검증 시작 소모품은 40장 이하입니다.");
    for(const [key,definitions] of [["startRewards",rewards],["startConsumables",{...data.consumables,...consumables}]]){
      const counts=new Map();
      for(const id of base[key]){
        need(typeof id==="string"&&Object.hasOwn(definitions,id),"지원하는 검증 지급 카드를 선택하세요.");
        const d=definitions[id];
        need(key!=="startConsumables"||d.runtime==="playable","사용 가능한 검증 소모품을 선택하세요.");
        counts.set(id,(counts.get(id)||0)+1);
        need(counts.get(id)<=d.count,"검증 지급 카드의 허용 수량을 초과했습니다.");
      }
    }
    return {version:1,preset,startRewards:[...base.startRewards],startConsumables:[...base.startConsumables]};
  }
  function issueConsumables(s,h){
    if(!s.setup.qa)return;
    const chapter=s.mission?.chapter||1;
    for(const [index,kind] of s.setup.qa.startConsumables.entries()){
      if(consumables[kind])h.consumables.push({id:`item-qa-${chapter}-${index+1}`,kind});
      else {
        const at=s.consumableDeck.findIndex(x=>x.kind===kind);
        if(at>=0)h.consumables.push(...s.consumableDeck.splice(at,1));
      }
    }
  }
  const api={weapon,consumables,presets,normalize,issueConsumables};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BBQAMode=api;
})(typeof globalThis!=="undefined"?globalThis:this);
