(function (root) {
  "use strict";
  const W = typeof module !== "undefined" && module.exports ? require("./weapon-rules.js") : root.BBWeaponRules;
  const enabled = W.enabled;
  function enqueue(s, effect, h) {
    if (!enabled(s) || h.hunter(s).inDream || h.hunter(s).hp <= 0 || !effect) return;
    if (effect.heal) h.hunter(s).hp = Math.min(6, h.hunter(s).hp + effect.heal);
    if (effect.draw) h.draw(s, effect.draw);
    if (effect.damage) (s.weaponEffects ||= []).push({kind:"damage", ...effect});
    if (effect.move) (s.weaponEffects ||= []).push({kind:"move", remaining:effect.move});
  }
  function targets(s, q, h) {
    return s.enemies.filter(e => e.hp > 0 && !h.fogCrossing(s,h.hunter(s).position,e.node) &&
      (q.target !== "combat" || e.id === s.combat?.enemyId) &&
      h.distance(s,h.hunter(s).position,e.node) <= (q.range || 0));
  }
  function hit(s,q,e,h) {
    h.damageEnemy(s,e,q.damage,{kind:"weapon-effect"});
    h.log(s,`${h.weapon(s).name} · ${h.enemyDef(s,e).name}에게 피해 ${q.damage}.`);
    h.kill(s,e);
  }
  function continueEffects(s,h) {
    while (s.weaponEffects?.length) {
      const q = s.weaponEffects[0];
      if (h.hunter(s).inDream || h.hunter(s).hp <= 0 || s.mission?.won) { s.weaponEffects=[]; break; }
      if (q.kind === "damage") {
        const choices=targets(s,q,h);
        if (!choices.length) {s.weaponEffects.shift();continue;}
        if (q.all) {
          s.weaponEffects.shift();
          for(const e of choices) if(h.enemy(s,e.id)) hit(s,q,e,h);
          continue;
        }
        if (choices.length === 1) {s.weaponEffects.shift();hit(s,q,choices[0],h);continue;}
        s.phase="weapon_choice"; return;
      }
      if (q.kind === "move") {
        s.weaponEffects.shift();
        s.move={remaining:q.remaining,path:[h.hunter(s).position],chasers:[],source:"weapon",weaponAfter:{type:"weapon_continue"}};
        s.phase="move";
        h.log(s,q.source==="reward" ? `${q.name} · 최대 ${q.remaining}칸 이동.` : `${h.weapon(s).name} · 처치 후 최대 ${q.remaining}칸 이동.`);
        return;
      }
      if (q.kind === "push") {
        const e=h.enemy(s,q.enemyId);
        if(!e || !q.remaining || !pushOptions(s,q,h).length) {s.weaponEffects.shift();continue;}
        s.phase="weapon_choice"; return;
      }
      throw new Error("지원하지 않는 무기 효과입니다.");
    }
    const after=s.weaponAfter; delete s.weaponAfter; delete s.weaponEffects;
    h.resume(s,after);
  }
  function drain(s,after,h) {
    if(!enabled(s) || !s.weaponEffects?.length) return false;
    s.weaponAfter=after; continueEffects(s,h); return true;
  }
  function pushOptions(s,q,h) {
    const e=h.enemy(s,q.enemyId); if(!e) return [];
    const d=h.distance(s,q.anchor,e.node);
    return h.neighbors(s,e.node).filter(to => !h.fogCrossing(s,e.node,to) && h.distance(s,q.anchor,to)>d);
  }
  function pushAfterAttack(s,face,h) {
    if(!enabled(s) || W.code(face)!=="after_attack_push_all_within_one") return;
    const p=face.effect.parameters,anchor=h.hunter(s).position;
    for(const e of s.enemies.filter(e=>e.hp>0 && h.distance(s,anchor,e.node)<=p.range && !h.fogCrossing(s,anchor,e.node)))
      (s.weaponEffects ||= []).push({kind:"push",enemyId:e.id,anchor,remaining:p.maxDistance});
  }
  function onEnemyStep(s,e,from,to,h) {
    const hunter=h.hunter(s);
    if(!enabled(s) || W.code(h.weaponFace(s))!=="enemy_entry_place_card_damage_two" ||
      hunter.inDream || hunter.hp<=0 || !from || from===to || e.hp<=0 || to!==hunter.position ||
      !hunter.hand.length || !h.slots(s).some((_,i)=>!hunter.slots[i])) return false;
    h.pauseFirearmEntry(s,e); s.firearmEntry.weapon=true; s.phase="weapon_entry";
    return true;
  }
  function finishEntry(s,h) {
    s.phase="firearm_react";
    if (!h.canFirearm(s) || !h.enemy(s,s.firearmEntry.enemyId)) h.resumeFirearmEntry(s);
  }
  function dispatch(s,a,h) {
    if(!enabled(s)) return false;
    if(a.type==="WEAPON_CHOICE") {
      h.need(s.phase==="weapon_choice" && s.weaponEffects?.length,"무기 효과 선택 단계가 아닙니다.");
      const q=s.weaponEffects[0];
      if(q.kind==="damage") {
        const e=targets(s,q,h).find(e=>e.id===a.enemyId);
        h.need(e,"범위 내의 무기 효과 대상을 선택하세요.");
        s.weaponEffects.shift();hit(s,q,e,h);
      } else if(q.kind==="push") {
        if(a.stop===true) {h.need(!q.mandatory,"이 효과의 이동은 필수입니다.");s.weaponEffects.shift();}
        else {
          h.need(pushOptions(s,q,h).includes(a.node),"더 멀어지는 유효 칸을 선택하세요.");
          h.displaceEnemy(s,h.enemy(s,q.enemyId),a.node);q.remaining--;
        }
      }
      continueEffects(s,h);return true;
    }
    if(a.type==="ENTRY_WEAPON") {
      h.need(s.phase==="weapon_entry" && s.firearmEntry?.weapon,"총창 진입 반응 단계가 아닙니다.");
      h.need(typeof a.accept==="boolean","총창을 사용할지 선택하세요.");
      if(a.accept) {
        const e=h.enemy(s,s.firearmEntry.enemyId);
        h.need(e && e.hp>0 && e.node===h.hunter(s).position,"진입한 적이 없습니다.");
        h.putFaceDown(s,a.cardId,a.slot);
        h.damageEnemy(s,e,2,{kind:"weapon-entry"});h.kill(s,e);
        h.log(s,"총창 · 카드를 뒷면으로 놓고 진입한 적에게 피해 2.");
      }
      finishEntry(s,h);return true;
    }
    if(a.type==="WEAPON_SHOT") {
      const face=h.weaponFace(s),p=face.effect?.parameters;
      h.need(s.phase==="hunter" && W.code(face)==="quicksilver_place_card_damage_same_space","수은탄 사격을 사용할 시점이 아닙니다.");
      h.need(a.slot===p.slot,"수은탄 사격 슬롯을 선택하세요.");
      const e=h.enemy(s,a.enemyId);
      h.need(e && e.hp>0 && e.node===h.hunter(s).position,"같은 칸의 적을 선택하세요.");
      h.putFaceDown(s,a.cardId,a.slot);
      h.damageEnemy(s,e,p.damage,{kind:"weapon-shot"});h.kill(s,e);
      h.log(s,"레이테르팔라슈 · 카드를 뒷면으로 놓고 피해 2.");
      drain(s,{type:"mission_hunter"},h);return true;
    }
    return false;
  }
  function choices(s,selection,h) {
    if(!enabled(s)) return [];
    if(s.phase==="weapon_choice") {
      const q=s.weaponEffects?.[0];if(!q)return [];
      if(q.kind==="damage")return targets(s,q,h).map(e=>({label:`${h.enemyDef(s,e).name} · 피해 ${q.damage}`,command:{type:"WEAPON_CHOICE",enemyId:e.id}}));
      if(q.kind==="push")return [...(q.mandatory ? [] : [{label:"여기서 이동 마치기",command:{type:"WEAPON_CHOICE",stop:true}}]),...pushOptions(s,q,h).map(node=>({label:`${h.enemyDef(s,h.enemy(s,q.enemyId)).name} → ${h.nameAt(s,node)}`,command:{type:"WEAPON_CHOICE",node}}))];
    }
    const card=h.hunter(s).hand.find(c=>c.id===selection.cardId),slot=selection.slot;
    const legal=card && Number.isInteger(slot) && h.slots(s)[slot] && !h.hunter(s).slots[slot];
    if(s.phase==="weapon_entry") return [{label:"총창 사용하지 않기",command:{type:"ENTRY_WEAPON",accept:false}},
      {label:"선택한 카드를 뒷면으로 놓고 피해 2",command:{type:"ENTRY_WEAPON",accept:true,cardId:selection.cardId,slot},disabled:!legal}];
    if(s.phase==="hunter" && W.code(h.weaponFace(s))==="quicksilver_place_card_damage_same_space") {
      const e=h.enemy(s,selection.enemyId),p=h.weaponFace(s).effect.parameters;
      return [{label:"수은탄 사격 · 뒷면으로 놓고 피해 2",command:{type:"WEAPON_SHOT",cardId:selection.cardId,slot,enemyId:selection.enemyId},disabled:!legal || slot!==p.slot || !e || e.node!==h.hunter(s).position}];
    }
    return [];
  }
  const api={enqueue,drain,continueEffects,pushAfterAttack,onEnemyStep,dispatch,choices};
  if(typeof module!=="undefined" && module.exports)module.exports=api;else root.BBWeaponFlow=api;
})(typeof globalThis!=="undefined"?globalThis:this);
