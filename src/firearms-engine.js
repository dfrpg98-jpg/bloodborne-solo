(function (root) {
  "use strict";
  const need = (condition, message) => { if (!condition) throw new Error(message); };
  // This adapter is called only by the new actual-component reducer path.
  // Version 8 and older saves keep their recorded provisional firearm rules.
  const enabled = (s, h) => !!(s.setup?.rulesVersion >= 9 &&
    !s.provisional && h.firearm(s)?.actual &&
    s.setup.rulesVersion >= (h.firearm(s).minimumRulesVersion || 9));
  const alive = (s, h) => !h.hunter(s).inDream && h.hunter(s).hp > 0 && !s.mission?.won;
  function combatTarget(s, h) {
    return s.combat && h.enemy(s, s.combat.enemyId);
  }
  const isBoss = (s, enemy, h) => !!(enemy &&
    (enemy.boss || enemy.bossDecks || h.enemyDef(s, enemy)?.boss));
  function canUse(s, h) {
    if (!enabled(s, h) || !alive(s, h) || !h.hunter(s).firearmReady) return false;
    const gun = h.firearm(s), target = combatTarget(s, h), c = s.combat;
    if (gun.trigger === "enemy-enters") {
      const entering = s.firearmEntry && h.enemy(s, s.firearmEntry.enemyId);
      return !!(s.phase === "firearm_react" && entering && entering.hp > 0 && entering.node === h.hunter(s).position);
    }
    if (gun.trigger === "enemy-basic") return !!(s.phase === "combat_react" && target &&
      target.hp > 0 && c.action?.type === "attack" && c.action.kind === "basic" &&
      !c.action.uninterruptible && !c.cancelEnemy);
    if (gun.trigger === "enemy-attack") return !!(s.phase === "combat_react" && target &&
      target.hp > 0 && !isBoss(s, target, h) && c.action?.type === "attack" && !c.cancelEnemy);
    if (gun.trigger === "hunter-effect") return s.phase === "hunter" &&
      s.enemies.some((enemy) => enemy.hp > 0 && enemy.node === h.hunter(s).position && !isBoss(s, enemy, h));
    if (gun.trigger === "hunter-turn") {
      if (s.phase === "hunter") return s.enemies.some((enemy) => enemy.hp > 0 && enemy.node === h.hunter(s).position);
      // This firearm declares the hunter's attack before the enemy card is
      // revealed. It cannot add another attack to an already declared combat.
      return !!(s.phase === "combat_choose" && target && target.hp > 0 &&
        target.node === h.hunter(s).position && c.origin !== "interaction" &&
        !c.attack && !c.flame && !c.action);
    }
    return false;
  }
  function reload(s, cardIds, h, options = {}) {
    need(enabled(s, h), "실물 화기 준비 규칙을 적용할 사냥이 아닙니다.");
    need(s.phase === "hunter" && alive(s, h), "사냥꾼 차례에 화기를 준비하세요.");
    const hunter = h.hunter(s), gun = h.firearm(s);
    need(!hunter.firearmReady, "이미 준비된 화기입니다.");
    if (options.payEcho === true) {
      need(gun.prepareEchoCost > 0, "이 화기는 피의 유지로 준비할 수 없습니다.");
      need(Array.isArray(cardIds) && cardIds.length === 0, "피의 유지와 스탯 카드 중 준비 비용 하나를 선택하세요.");
      need(Number.isInteger(hunter.echoes) && hunter.echoes >= gun.prepareEchoCost, "준비할 피의 유지가 부족합니다.");
      hunter.echoes -= gun.prepareEchoCost;
      hunter.firearmReady = true;
      h.log(s, `${gun.name} · 피의 유지 ${gun.prepareEchoCost}개를 버려 준비했습니다.`);
      return true;
    }
    need(Array.isArray(cardIds) && cardIds.length === gun.prepareCost &&
      cardIds.every((id) => typeof id === "string" && id.length > 0) &&
      new Set(cardIds).size === cardIds.length,
    `서로 다른 스탯 카드 ${gun.prepareCost}장을 선택하세요.`);
    // Complete validation before paying any card so partial selection is atomic
    // even for direct unit callers; the reducer also provides clone rollback.
    need(cardIds.every((id) => hunter.hand.some((card) => card.id === id)), "손에 있는 스탯 카드를 선택하세요.");
    for (const id of cardIds) h.pay(s, id);
    hunter.firearmReady = true;
    h.log(s, `${gun.name} · 스탯 카드 ${gun.prepareCost}장을 버려 준비했습니다.`);
    return true;
  }
  function onTransform(s, h) {
    if (!enabled(s, h) || !h.firearm(s).prepareOnTransform || h.hunter(s).firearmReady) return false;
    h.hunter(s).firearmReady = true;
    h.log(s, `${h.firearm(s).name} · 무기 변형으로 무료 준비했습니다.`);
    return true;
  }
  function onEnemyStep(s, enemy, from, to, h) {
    if (!enabled(s, h) || !alive(s, h) || !h.hunter(s).firearmReady ||
        h.firearm(s).trigger !== "enemy-enters" || !from || from === to ||
        !enemy || h.enemy(s, enemy.id) !== enemy || enemy.hp <= 0 || enemy.node !== to || to !== h.hunter(s).position) return false;
    h.pauseFirearmEntry(s, enemy, from, to);
    return true;
  }
  function dispatch(s, command, h) {
    if (!enabled(s, h)) return false;
    if (command.type === "RELOAD") {
      const ids = command.cardIds ?? (command.cardId ? [command.cardId] : []);
      return reload(s, ids, h, { payEcho: command.payEcho });
    }
    if (command.type === "FIREARM_ENTRY") {
      need(s.phase === "firearm_react" && s.firearmEntry && h.firearm(s).trigger === "enemy-enters",
        "장총으로 적의 진입에 대응할 단계가 아닙니다.");
      need(typeof command.accept === "boolean", "장총을 사용할지 선택하세요.");
      if (command.accept) {
        need(canUse(s, h), "이 진입에 장총을 사용할 수 없습니다.");
        const enemy = h.enemy(s, s.firearmEntry.enemyId), gun = h.firearm(s);
        h.hunter(s).firearmReady = false;
        const damage = h.damageEnemy(s, enemy, gun.damage, { kind: "firearm-entry", firearmId: gun.id });
        h.log(s, `${gun.name} · 진입한 ${h.enemyDef(s, enemy).name}에게 피해 ${damage}, 화기 소진.`);
        if (enemy.hp <= 0) h.kill(s, enemy);
      } else h.log(s, `${h.firearm(s).name} · 사용하지 않고 적의 이동을 계속합니다.`);
      h.resumeFirearmEntry(s);
      return true;
    }
    if (command.type !== "FIREARM") return false;
    need(canUse(s, h), "현재 시점에 이 화기를 사용할 수 없습니다.");
    const gun = h.firearm(s);
    need(gun.trigger !== "enemy-enters", "장총은 적이 칸으로 들어올 때 사용 여부를 선택하세요.");
    if (gun.trigger === "enemy-basic") {
      h.hunter(s).firearmReady = false;
      h.interruptCombat(s);
      h.log(s, `${gun.name} · 기본 공격 자동 방해, 화기 소진.`);
    } else if (gun.trigger === "enemy-attack") {
      need(typeof h.stripEnemyAttackEffects === "function", "공격 효과 제거 처리기가 필요합니다.");
      h.hunter(s).firearmReady = false;
      h.stripEnemyAttackEffects(s, gun);
      h.log(s, `${gun.name} · 보스가 아닌 적의 공격 속도 -${gun.speedPenalty}, 모든 공격 효과 제거, 화기 소진.`);
    } else if (gun.trigger === "hunter-effect") {
      const target = h.enemy(s, command.enemyId);
      need(typeof command.enemyId === "string" && target && target.hp > 0 &&
        target.node === h.hunter(s).position && !isBoss(s, target, h),
        "같은 칸에 있는 보스가 아닌 적을 선택하세요.");
      need(typeof h.addBlunderbussEffect === "function", "산탄총 피해와 이동 처리기가 필요합니다.");
      h.hunter(s).firearmReady = false;
      h.addBlunderbussEffect(s, target, gun);
      h.log(s, `${gun.name} · 피해 ${gun.damage}, 살아남은 적 ${gun.push}칸 멀리 이동, 화기 소진.`);
    } else if (gun.trigger === "hunter-turn") {
      const id = s.phase === "combat_choose" ? s.combat.enemyId : command.enemyId;
      const target = h.enemy(s, id);
      need(typeof id === "string" && target && target.hp > 0 && target.node === h.hunter(s).position,
        "같은 칸의 화기 공격 대상을 선택하세요.");
      need(!command.enemyId || command.enemyId === id, "현재 전투의 적을 대상으로 선택하세요.");
      need(typeof h.addFirearmAttack === "function" || gun.id === "flamesprayer" && typeof h.addFlameAttack === "function",
        "화기 공격 처리기가 필요합니다.");
      h.hunter(s).firearmReady = false;
      if (h.addFirearmAttack) h.addFirearmAttack(s, id, gun, command.weaponBoost, command.rewardIds);
      else h.addFlameAttack(s, id);
      h.log(s, `${gun.name} · 속도 ${gun.speed}, 피해 ${gun.damage}${gun.interrupt ? ", 방해" : ""}${gun.splash ? ` · 같은 칸 다른 모든 적에게 피해 ${gun.splash}` : ""}, 화기 소진.`);
    }
    return true;
  }
  const api = { enabled, canUse, dispatch, onEnemyStep, onTransform, reload };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBFirearms = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
