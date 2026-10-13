(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./hunt-data.js") : root.BBHuntData;
  const ids = ["arianna-blood", "music-box", "adella-blood", "call-beyond", "hunter-torch",
    "tiny-tonitrus", "bloodstone-chunk", "tear-gem", "queen-flesh", "ring", "ritual-material",
    "rune-communion", "rune-radiance", "rune-corruption", "rune-guidance", "rune-beast"];
  const persistent = new Set(["bloodstone-chunk", "tear-gem"]);
  const quests = new Set(["music-box", "ritual-material"]);
  const chapterLimited = new Set(["rune-radiance", "rune-corruption"]);
  const definitions = Object.fromEntries(D.components.cards.filter((c) => ids.includes(c.id)).map((c) =>
    [c.id, {...c, subtype:quests.has(c.id) ? "quest" : c.id.startsWith("rune-") ? "rune" : "tool",
      persistent:persistent.has(c.id), minimumRulesVersion:11, activeUse:!quests.has(c.id)}]));
  const hunter = (s) => s.hunters[s.activeHunterId];
  const enabled = (s) => !!(s.setup?.rulesVersion >= 11 && !s.provisional);
  const need = (ok, message) => { if (!ok) throw new Error(message); };
  const say = (s,h,text) => h.log?.(s,text);
  const chapter = (s) => s.mission?.chapter || s.world?.chapter || 1;
  const limitUsed = (s,r) => chapterLimited.has(r.kind) && r.lastUsedChapter === chapter(s);
  const usable = (s,r) => enabled(s) && r.equipped && r.ready && !limitUsed(s,r);
  const boss = (s,e,h) => !!(e.boss || e.bossDecks || h.enemyDef?.(s,e)?.boss);
  const alive = (s) => hunter(s).hp > 0 && !hunter(s).inDream;
  const hunterTurn = (s) => s.phase === "hunter" && alive(s);
  const enemyTargets = (s,r,h) => (s.enemies || []).filter((e) => e.hp > 0 &&
    (r.kind === "call-beyond" ? e.node === hunter(s).position :
     ["tiny-tonitrus","rune-beast"].includes(r.kind) && typeof h.distance === "function" &&
       h.distance(s,hunter(s).position,e.node) <= 1 && (r.kind !== "tiny-tonitrus" || !boss(s,e,h))));
  function controls(s,r,h = {}) {
    if (r.kind === "adella-blood") return {type:"echo-option",available:hunter(s).echoes > 0};
    if (r.kind === "rune-guidance") return {type:"slot",slots:(hunter(s).slots || []).map((c,slot) =>
      ({slot,name:h.slots?.(s)?.[slot]?.name || `${slot+1}번 슬롯`,occupied:!!c}))};
    if (["tiny-tonitrus","rune-beast"].includes(r.kind)) return {type:"enemy",targets:enemyTargets(s,r,h).map((e) =>
      ({enemyId:e.id,name:h.enemyDef?.(s,e)?.name || D.enemies[e.kind]?.name || e.kind}))};
    return null;
  }
  function canUse(s,r,h = {}) {
    if (!usable(s,r) || quests.has(r.kind) || persistent.has(r.kind) || r.kind === "hunter-torch" || r.kind === "rune-corruption") return false;
    if (r.kind === "rune-beast") return !!hunter(s).rewardBeastWindow && alive(s) && enemyTargets(s,r,h).length > 0;
    if (!hunterTurn(s)) return false;
    if (r.kind === "queen-flesh") return !!hunter(s).rewardTurnStartWindow;
    if (r.kind === "rune-radiance") return hunter(s).hand.length < 3;
    if (r.kind === "rune-guidance") return hunter(s).slots.length > 0;
    if (["call-beyond","tiny-tonitrus"].includes(r.kind)) return enemyTargets(s,r,h).length > 0;
    return ["arianna-blood","adella-blood","ring","rune-communion"].includes(r.kind);
  }
  function use(s,r,a,h = {}) {
    if (!definitions[r.kind]) return false;
    need(enabled(s),"추가 보상은 새 규칙 사냥에서 사용할 수 있습니다.");
    need(canUse(s,r,h),"이 보상의 발동 시점과 사용 조건을 확인하세요.");
    const p = hunter(s);
    let target;
    if (["tiny-tonitrus","rune-beast"].includes(r.kind)) {
      target = enemyTargets(s,r,h).find((e) => e.id === a.enemyId);
      need(target,"1칸 이내의 적을 선택하세요. 작은 토니트루스는 보스를 대상으로 삼을 수 없습니다.");
      need(typeof h.damageEnemy === "function" && typeof h.kill === "function","적 피해와 처치 연결이 필요합니다.");
      if (r.kind === "tiny-tonitrus") need(typeof h.skipEnemyActivation === "function","적 활성화 억제 연결이 필요합니다.");
    }
    if (r.kind === "call-beyond") need(typeof h.damageEnemy === "function" && typeof h.kill === "function","적 피해와 처치 연결이 필요합니다.");
    if (r.kind === "adella-blood") {
      need(a.payEcho === undefined || typeof a.payEcho === "boolean","추가 치유에 피의 유지를 사용할지 선택하세요.");
      need(!a.payEcho || p.echoes > 0,"추가 치유에 필요한 피의 유지가 없습니다.");
    }
    if (["arianna-blood","rune-radiance"].includes(r.kind)) need(typeof h.draw === "function","카드 뽑기 연결이 필요합니다.");
    if (r.kind === "rune-guidance") {
      need(Number.isInteger(a.slot) && a.slot >= 0 && a.slot < p.slots.length,"비울 공격 슬롯을 선택하세요.");
      need(typeof h.clearSlot === "function" && typeof h.startRewardMove === "function","슬롯 비우기와 이동 연결이 필요합니다.");
    }
    // Exhaust before nested kill, dream or movement resolvers: a dream can then refresh it normally.
    r.ready = false;
    if (chapterLimited.has(r.kind)) r.lastUsedChapter = chapter(s);
    say(s,h,`${definitions[r.kind].name} 사용 · 소진했습니다.`);
    if (r.kind === "arianna-blood") { h.draw(s,1); p.hp = Math.min(6,p.hp+1); }
    if (r.kind === "adella-blood") { if(a.payEcho) p.echoes--; p.hp = Math.min(6,p.hp+1+(a.payEcho?2:0)); }
    if (r.kind === "rune-communion") p.hp = Math.min(6,p.hp+2);
    if (r.kind === "queen-flesh") { p.hp = Math.min(6,p.hp+1); p.rewardTurnStartWindow = false; }
    if (r.kind === "rune-radiance") h.draw(s,3-p.hand.length);
    if (r.kind === "ring") for(const other of Object.values(s.hunters)) {
      if (!other.inDream && other.hp > 0 && other.position &&
          (other.id === s.activeHunterId || other === p || h.distance?.(s,p.position,other.position) <= 2))
        other.hp = Math.min(6,other.hp+1);
    }
    if (r.kind === "call-beyond") {
      // Apply one simultaneous effect to a fixed snapshot before resolving any death side effects.
      const targets = enemyTargets(s,r,h);
      for(const e of targets) h.damageEnemy(s,e,2,{source:"reward",rewardKind:r.kind});
      for(const e of targets) if(s.enemies.some((x) => x.id === e.id)) h.kill(s,e);
    }
    if (target) {
      if(r.kind === "rune-beast") p.rewardBeastWindow = false;
      h.damageEnemy(s,target,2,{source:"reward",rewardKind:r.kind});
      h.kill(s,target);
      if(r.kind === "tiny-tonitrus" && s.enemies.some((e) => e.id === target.id)) h.skipEnemyActivation(s,target.id);
    }
    if (r.kind === "rune-guidance") { h.clearSlot(s,a.slot); h.startRewardMove(s,2); }
    return true;
  }
  function onTurnStart(s) {
    if(!enabled(s)) return;
    const p = hunter(s);
    p.rewardTurnStartWindow = alive(s);
  }
  function onChapterStart(s) {
    if(!enabled(s)) return;
    const p = hunter(s);
    delete p.rewardBeastWindow;
    for(const r of p.rewards || []) { delete r.lastUsedChapter; r.ready = true; r.triggerArmed = false; }
    onTurnStart(s);
  }
  function preventDeath(s,h = {}) {
    if(!enabled(s) || hunter(s).hp > 0 || hunter(s).inDream) return false;
    const r = hunter(s).rewards.find((r) => r.kind === "rune-corruption" && usable(s,r) && r.triggerArmed);
    if(!r) return false;
    r.ready = false; r.triggerArmed = false; r.lastUsedChapter = chapter(s);
    hunter(s).hp = 6;
    say(s,h,"카릴 문자:타락 · 처치를 막고 모든 피해를 치유했습니다. 이번 챕터 사용을 마쳤습니다.");
    return true;
  }
  function onEnemyStep(s,e,from,to,h = {}) {
    if(!enabled(s) || !alive(s) || !from || from === to || to !== hunter(s).position ||
       !e || e.hp <= 0 || e.node !== to || boss(s,e,h)) return false;
    const r = hunter(s).rewards.find((r) => r.kind === "hunter-torch" && usable(s,r));
    if(!r) return false;
    need(typeof h.pauseFirearmEntry === "function","적 진입 반응 연결이 필요합니다.");
    h.pauseFirearmEntry(s,e);
    Object.assign(s.firearmEntry,{rewardId:r.id,from,to});
    s.phase = "reward_entry";
    return true;
  }
  function dispatchEntry(s,a,h = {}) {
    if(a.type !== "ENTRY_REWARD") return false;
    need(enabled(s) && s.phase === "reward_entry" && s.firearmEntry?.rewardId,"횃불로 적의 진입에 대응할 단계가 아닙니다.");
    need(typeof a.accept === "boolean","횃불을 사용할지 선택하세요.");
    const entry = s.firearmEntry, r = hunter(s).rewards.find((r) => r.id === entry.rewardId),
      e = s.enemies.find((e) => e.id === entry.enemyId);
    need(e && r && r.kind === "hunter-torch" && usable(s,r),"준비된 횃불과 진입한 적을 확인하세요.");
    need(typeof h.resumeRewardEntry === "function","적 진입 이어가기 연결이 필요합니다.");
    if(a.accept) {
      need(typeof h.stopRewardEntry === "function" && typeof h.damageEnemy === "function" && typeof h.kill === "function","횃불 이동 중지와 피해 연결이 필요합니다.");
      const stops=h.rewardEntryStops?.(s,entry) || [{node:entry.from}],
        destination=a.node || (stops.length === 1 ? stops[0].node : null);
      need(destination && stops.some((x) => x.node === destination),"횃불로 적이 멈출 사냥꾼 1칸 이내의 목적지를 선택하세요.");
      r.ready = false;
      h.stopRewardEntry(s,e,destination);
      h.damageEnemy(s,e,1,{source:"reward",rewardKind:r.kind});
      say(s,h,"야수 사냥의 횃불 · 적은 1칸 멀리서 멈추고 피해 1, 횃불 소진.");
      h.kill(s,e);
    }
    h.resumeRewardEntry(s,{accepted:a.accept});
    return true;
  }
  function entryView(s,h = {}) {
    if(s.phase !== "reward_entry" || !s.firearmEntry?.rewardId) return null;
    const e = s.enemies.find((e) => e.id === s.firearmEntry.enemyId);
    return e ? {rewardId:s.firearmEntry.rewardId,title:"야수 사냥의 횃불 · 적 진입 반응",
      enemyId:e.id,enemyName:h.enemyDef?.(s,e)?.name || e.kind,damage:1,
      stops:h.rewardEntryStops?.(s,s.firearmEntry) || [{node:s.firearmEntry.from,name:s.firearmEntry.from}]} : null;
  }
  const api = {ids,definitions,enabled,persistent,quests,chapterLimited,chapter,limitUsed,usable,
    controls,canUse,use,onTurnStart,onChapterStart,preventDeath,onEnemyStep,dispatchEntry,entryView};
  if(typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBExtendedRewards = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
