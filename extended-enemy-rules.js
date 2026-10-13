(function (root) {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const enabled = (s, e) => !!(s.setup?.rulesVersion >= 10 && !s.provisional && e?.extendedId);
  const immune = (c, keyword) => (c.immune || []).includes(keyword);
  const hunterAttack = (c) => c.attack || c.flame;
  const shared = (s, e, h) => e.node === h.hunter(s).position;
  function immediate(s, c, h, reaction) {
    h.startImmediate(s, { name: c.action.name, ...reaction });
    return true;
  }
  function onReveal(s, c, e, h) {
    if (!enabled(s, e) || !c.action?.extended) return false;
    const a = c.action, hunter = h.hunter(s);
    // An attack effect removed by Numbing Mist cannot reappear through a code
    // hook. Printed white-background abilities remain separate abilities.
    if (a.type === "attack" && c.removeEnemyAttackEffects) {
      delete a.code;
      return false;
    }
    if (a.type === "attack") {
      if (a.code === "bloody-crow-chikage" && h.enemyDef(s, e).maxHp - e.hp >= a.woundThreshold) {
        a.speed += 1; a.damage += 1;
        h.log(s, "피투성이 까마귀 · 상처 조건으로 속도+1, 피해+1.");
      } else if (a.code === "eileen-blade-of-mercy") {
        const attack = hunterAttack(c);
        if (attack) a.damage += Math.max(0, a.speed - attack.speed);
      } else if (a.code === "blood-knight-sword" && (e.corruptionTokens || 0) > 0) {
        e.corruptionTokens -= 1; a.speed += 1; a.damage += 1;
        h.log(s, "혈족의 기사 · 피의 타락1을 제거하여 속도+1, 피해+1.");
      } else if (a.code === "bloodlicker-greedy") {
        a.speed += hunter.echoes || 0; a.damage += hunter.echoes || 0;
      } else if (a.code === "djura-stake-driver" && c.origin === "activation") {
        c.action = clone(h.enemyDef(s, e).special);
        h.log(s, "듀라 · 적 활성화의 말뚝박이 대신 말뚝 발사 공격을 합니다.");
      }
      return false;
    }
    if (a.speed !== null) return false;
    switch (a.code) {
      case "church-servant-horrifying-illusion":
        if (hunter.status.frenzy) {
          if (!immune(c, "stun")) c.pending.push({ type: "stun" });
          h.log(s, "무시무시한 환상 · 이미 발광 상태이므로 기절.");
        } else {
          if (!immune(c, "frenzy")) hunter.status.frenzy = true;
          h.log(s, "무시무시한 환상 · 발광. 다른 적 행동 카드를 공개합니다.");
        }
        c.pending.push({ type: "next_enemy_card" }); h.resolve(s); return true;
      case "church-servant-arcane-barrage":
        c.extendedAfterAttackReaction = { name: a.name, damage: 5, dodgeSpeed: 0,
          dodgeBlockPerSpeed: 2 };
        h.resolve(s); return true;
      case "church-giant-idle":
        h.log(s, "멍 때리기 · 교단 거인은 공격하지 않습니다.");
        h.resolve(s); return true;
      case "bloody-crow-supply":
        if (h.enemyDef(s, e).maxHp - e.hp >= a.woundThreshold) {
          e.hp = Math.min(h.enemyDef(s, e).maxHp, e.hp + a.heal);
          h.log(s, `피투성이 까마귀 · 수혈액으로 치유${a.heal}.`);
          h.resolve(s);
        } else {
          c.cancelHunter = true;
          h.log(s, "피투성이 까마귀 · 사냥꾼 공격을 회피하고 1칸 멀리 이동.");
          h.startBossMove(s, "enemy", 1);
        }
        return true;
      case "henryk-poison-knife":
        return immediate(s, c, h, { damage: 1, dodgeSpeed: 3, poison: true, revealNext: true });
      case "eileen-pistol":
        return immediate(s, c, h, { damage: 0, dodgeSpeed: 3, interruptHunter: true, revealNext: true });
      case "djuras-ally-bloodlust":
        c.buff.speed += 1; c.buff.interrupt = true;
        h.log(s, "듀라의 동료 · 다음 공격 속도+1, 방해. 다른 적 행동 카드 공개.");
        h.reveal(s); return true;
      case "alfred-rifle":
        return immediate(s, c, h, { damage: 0, dodgeSpeed: 2, interruptHunter: true,
          stun: true, revealNext: true });
      case "djura-shotgun":
        return immediate(s, c, h, { damage: 1, dodgeSpeed: 2, stun: true, revealNext: true });
      case "blood-knight-focus":
        e.corruptionTokens = (e.corruptionTokens || 0) + 1;
        c.enemyDefense = (c.enemyDefense || 0) + e.corruptionTokens;
        h.log(s, `혈족의 기사 · 피의 타락1 획득, 사냥꾼 공격 피해${e.corruptionTokens} 방어.`);
        h.resolve(s); return true;
      case "cainhurst-knight-parry": {
        const attack = hunterAttack(c);
        // The card explicitly permits interruption despite being a white
        // ability. No printed speed condition accompanies that exception.
        if (attack?.interrupt && !c.cancelHunter) {
          c.cancelEnemy = true;
          h.log(s, "쳐내기 · 선언된 사냥꾼 공격의 방해로 전용 능력을 취소했습니다.");
          h.resolve(s); return true;
        }
        return immediate(s, c, h, { damage: attack?.damage || 0, dodgeSpeed: null,
          unavoidable: true, interruptHunter: true });
      }
      default: return false;
    }
  }
  function beforeAttackGroup(s, c, e, info, h) {
    if (!enabled(s, e) || !c.action?.extended || c.action.type !== "attack" ||
      c.removeEnemyAttackEffects || !info.enemyTiming) return;
    const a = c.action;
    // This conditional printed damage is distinct from the general +1 damage
    // inflicted by Frenzy, and therefore both can apply to a frenzied hunter.
    if (a.code === "church-servant-unholy-mark" && h.hunter(s).status.frenzy && !c.extendedMarkApplied) {
      a.damage += 1; c.extendedMarkApplied = true;
    }
    if (a.code === "male-patient-blood-toxin" && info.ea && info.shared &&
      h.hunter(s).status.poison && !c.extendedToxinApplied) {
      a.poison = false; a.stun = true; c.extendedToxinApplied = true;
      const attack = hunterAttack(c);
      if (attack && !c.attackResolved && !c.flameResolved) attack.damage = Math.max(0, attack.damage - 2);
      h.log(s, "화혈병 독소 · 이미 독 상태이므로 기절, 남은 사냥꾼 공격 피해-2.");
    }
  }
  function onDodge(s, info, h) {
    const c = s.combat;
    // A revealed barrage remains pending after the hunter kills its source.
    if (!(s.setup?.rulesVersion >= 10 && !s.provisional) || !c?.immediate?.dodgeBlockPerSpeed) return;
    if (Number.isFinite(info?.speed)) c.immediate.dodgeBlock = Math.max(0, info.speed) * c.immediate.dodgeBlockPerSpeed;
  }
  function afterHunterAttack(s, c, e, damage, h) {
    if (!enabled(s, e) || !c.extendedAfterAttackReaction) return;
    const reaction = c.extendedAfterAttackReaction;
    delete c.extendedAfterAttackReaction;
    c.pending.push({ type: "immediate", reaction });
  }
  function afterEnemyAttack(s, c, e, h, damage = 0) {
    if (!enabled(s, e) || c.removeEnemyAttackEffects || !(damage > 0)) return;
    if (c.action.code === "djuras-ally-regain" && e.hp > 0) {
      e.hp = Math.min(h.enemyDef(s, e).maxHp, e.hp + 2);
      h.log(s, "듀라의 동료 · 공격이 피해를 주어 치유2.");
    } else if (c.action.code === "blood-knight-riposte") {
      e.corruptionTokens = (e.corruptionTokens || 0) + 1;
      h.log(s, "혈족의 기사 · 치명적인 응수가 피해를 주어 피의 타락1 획득.");
    }
  }
  function beforeKill(s, e, h) {
    const c = s.combat;
    if (!enabled(s, e) || !c || c.enemyId !== e.id || c.action?.code !== "male-patient-death-echo" ||
      c.cancelEnemy || c.removeEnemyAttackEffects || c.extendedDeathEchoQueued || !shared(s, e, h)) return;
    c.extendedDeathEchoQueued = true;
    c.pending.push({ type: "immediate", reaction: { name: "죽음의 메아리", damage: 2,
      dodgeSpeed: null, unavoidable: true, poison: true } });
    h.log(s, "죽음의 메아리 · 방해되지 않은 야수환자 처치 반응.");
  }
  function beforeEnemyDamage(s, e, amount, context, h) {
    const c = s.combat;
    if (!enabled(s, e) || !c || c.enemyId !== e.id || c.removeEnemyAttackEffects ||
      !["hunter-attack", "firearm-attack"].includes(context.kind) || c.action?.code !== "cainhurst-knight-rapier") return amount;
    const attack = context.kind === "firearm-attack" ? c.flame : c.attack;
    if (!attack || ![1, 2].includes(attack.speed)) return amount;
    h.log(s, "레이피어 · 속도1 또는2의 사냥꾼 공격 피해1 방어.");
    return Math.max(0, amount - 1);
  }
  function resolveTimed(s, c, e, h) {
    if (!enabled(s, e) || !c.action?.extended) return false;
    if (c.action.code === "male-patient-pack") {
      h.spawnNormal(s, e.kind, e.node, { extendedId: e.extendedId,
        extendedSide: e.extendedSide || h.enemyDef(s, e).sideId });
      s.spawnAfter = { type: "combat" };
      h.finishSpawns(s); return true;
    }
    if (c.action.code === "bloodlicker-dodge-leap") {
      if (c.origin === "activation" && !c.extendedReactivation) c.extendedReactivate = true;
      h.startBossMove(s, "enemy", 1); return true;
    }
    return false;
  }
  function afterAllAttacks(s, c, e, h) {
    if (!enabled(s, e)) return false;
    if (c.extendedAfterAttackReaction) {
      const reaction = c.extendedAfterAttackReaction;
      delete c.extendedAfterAttackReaction;
      c.pending.push({ type: "immediate", reaction });
      return true;
    }
    if (!e || e.hp <= 0 || h.enemy(s, e.id) !== e) return false;
    if (!c.cancelEnemy && !c.removeEnemyAttackEffects &&
      ["bloody-crow-repeating-pistol", "alfred-combo"].includes(c.action?.code) && !c.extendedFollowupQueued) {
      c.extendedFollowupQueued = true;
      c.pending.push({ type: "extended_followup", enemyId: e.id,
        action: clone(h.enemyDef(s, e).basic) });
      return true;
    }
    if (c.extendedReactivate && !c.extendedReactivateQueued) {
      c.extendedReactivateQueued = true;
      c.pending.push({ type: "extended_reactivate", enemyId: e.id, once: true });
      return true;
    }
    return false;
  }
  const api = { enabled, onReveal, beforeAttackGroup, onDodge, afterHunterAttack,
    afterEnemyAttack, beforeKill, beforeEnemyDamage, resolveTimed, afterAllAttacks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBExtendedEnemyRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
