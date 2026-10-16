(function (root) {
  "use strict";
  const enabled = (s) => !!(s?.setup?.rulesVersion >= 10 && !s.provisional);
  const code = (face) => face?.effect?.code || null;
  const hunter = (s) => s.hunters[s.activeHunterId];
  const params = (face) => face?.effect?.parameters || {};
  function neutral() {
    return { speed: 0, damage: 0, interruptEqual: false, noDodge: false,
      immuneInterrupt: false, heal: 0, selfDamage: 0, healDealt: false,
      freeTransform: false, splash: null, consumeCharge: false };
  }
  function attackBonus(s, face, slot, cardEffects = {}, rewardBonus = {}, boost) {
    const result = neutral();
    if (!enabled(s)) return result;
    const h = hunter(s), effect = code(face), p = params(face);
    const defaultBoost = boost === undefined || boost === null || boost === "none";
    if (effect === "attack_sacrifice_damage") {
      if (!(defaultBoost || Number.isInteger(boost) && boost >= 0 && boost <= p.maxSelfDamage))
        throw new Error("바퀴의 추가 피해는 0, 1, 2 중 하나를 선택하세요.");
      result.selfDamage = defaultBoost ? 0 : boost;
      result.damage += result.selfDamage * p.damagePerSelfDamage;
    } else if (effect === "attack_sacrifice_speed_or_damage") {
      if (!(defaultBoost || boost === "speed" || boost === "damage"))
        throw new Error("치카게는 추가 효과 없음, 속도, 피해 중 하나를 선택하세요.");
      if (!defaultBoost) {
        result.selfDamage = p.selfDamage;
        result[boost] += p[boost];
      }
    } else if (!defaultBoost) {
      throw new Error("현재 무기 면에는 체력을 지불하는 공격 효과가 없습니다.");
    }
    if (effect === "stagger_equal_speed") result.interruptEqual = true;
    if (effect === "stagger_attack_damage_one" && (cardEffects.interrupt || rewardBonus.interrupt))
      result.damage += p.damage;
    if (effect === "damage_per_move_action_this_round") {
      const count = typeof h.moveActionsRound === "number" ? h.moveActionsRound
        : h.moveActionsRound?.round === s.round ? h.moveActionsRound.count || 0 : 0;
      result.damage += count * p.damagePerAction;
    }
    if (effect === "finishing_combo_damage_per_filled_slot" && slot === p.slot)
      result.damage += h.slots.filter(Boolean).length * p.damagePerSlot;
    if (effect === "regain_heal_damage_dealt" && slot === p.slot) result.healDealt = true;
    if (effect === "combo_after_attack_free_transform" && slot === p.slot) result.freeTransform = true;
    if (effect === "destructive_attack_no_interrupt_or_dodge" && slot === p.slot) {
      result.immuneInterrupt = !!p.uninterruptible;
      result.noDodge = !!p.noDodge;
    }
    if (effect === "attack_heal") result.heal += p.heal;
    if (effect === "low_health_speed_damage" && h.hp <= p.maxHp) {
      result.speed += p.speed; result.damage += p.damage;
    }
    if (effect === "transform_next_attack_speed_damage_one" && h.weaponCharge?.round === s.round) {
      result.speed += h.weaponCharge.speed || 0;
      result.damage += h.weaponCharge.damage || 0;
      result.consumeCharge = true;
    }
    if (face?.slots?.[slot]?.splash) result.splash = { ...face.slots[slot].splash };
    return result;
  }
  function afterDodge(s, face, dodgeSpeed, enemySpeed) {
    if (!enabled(s)) return {};
    const effect = code(face), p = params(face);
    if (effect === "dodge_damage_all_within_one")
      return { heal: 0, damage: p.damage, range: p.range, all: true, target: "same-space" };
    if (effect === "dodge_heal_damage_one_same_space")
      return { heal: p.heal, damage: p.damage, range: 0, all: false, target: "same-space" };
    if (effect === "dodge_matching_speed_damage" && dodgeSpeed === enemySpeed)
      return { heal: 0, damage: p.damage, range: 0, all: false, target: "combat" };
    return {};
  }
  function afterClear(face) {
    return code(face) === "clear_slot_damage_one_same_space"
      ? { damage: params(face).damage, range: 0, target: "same-space" } : null;
  }
  function afterKill(face) {
    const p = params(face);
    if (code(face) === "kill_damage_one_within_one") return { damage: p.damage, range: p.range };
    if (code(face) === "kill_draw_one_heal_one") return { draw: p.draw, heal: p.heal };
    if (code(face) === "kill_heal_and_move") return { heal: p.heal, move: p.move };
    return {};
  }
  function afterTransform(s, face) {
    if (!enabled(s) || code(face) !== "transform_next_attack_speed_damage_one") return null;
    return { round: s.round, speed: params(face).speed, damage: params(face).damage };
  }
  const api = { enabled, code, attackBonus, afterDodge, afterClear, afterKill, afterTransform };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBWeaponRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
