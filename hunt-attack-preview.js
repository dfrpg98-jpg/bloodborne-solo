(function (root, factory) {
  "use strict";
  const rules = typeof module === "object" && module.exports ? require("./weapon-rules.js") : root.BBWeaponRules;
  const api = factory(rules);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntAttackPreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (weaponRules) {
  "use strict";
  // Read disclosed choices only. In particular, do not dispatch a hypothetical
  // attack, copy a rules state, inspect a draw pile, or reveal the next enemy card.
  const number = value => Number.isFinite(value) ? value : 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const text = (value, clean) => clean ? clean(String(value ?? "")) : String(value ?? "");
  const attackRewardKinds = new Set(["rune-clawmark", "rune-writhe", "rune-hunter", "empty-shell"]);
  const fixedKinds = new Set(["WEAPON_SHOT", "ENTRY_WEAPON"]);

  function view(state, engine, selection = {}) {
    const kind = selection.kind || "ATTACK", fixed = fixedKinds.has(kind),
      h = engine.hunter(state), face = engine.weaponFace(state),
      cardInstance = h.hand.find(card => card.id === selection.cardId),
      slot = Number.isInteger(selection.slot) ? engine.slots(state)[selection.slot] : null,
      model = { kind, fixed, ready: false, attack: null, warnings: [], notes: [],
        requirement: fixed ? "손패 기술 1장과 빈 슬롯을 선택하세요. 카드는 뒷면으로 놓습니다." : "손패 1장과 빈 공격 슬롯을 선택하세요." };
    if (!["ATTACK", "COUNTER", ...fixedKinds].includes(kind)) return null;
    if (!cardInstance || !slot || h.slots[selection.slot]) return model;
    const printedCard = engine.card(cardInstance);
    model.card = { id: cardInstance.id, name: printedCard.name, text: printedCard.text || "" };
    model.slot = { index: selection.slot, name: slot.name };
    if (fixed) {
      const code = weaponRules.code(face), parameters = face.effect?.parameters || {};
      if (kind === "WEAPON_SHOT" && (code !== "quicksilver_place_card_damage_same_space" || selection.slot !== parameters.slot) ||
          kind === "ENTRY_WEAPON" && code !== "enemy_entry_place_card_damage_two") return model;
      model.ready = true;
      model.damage = kind === "WEAPON_SHOT" ? number(parameters.damage) : 2;
      model.speed = null;
      model.suppressedCardEffects = true;
      model.hp = { before: h.hp, afterCard: h.hp, selfDamage: 0, afterPayment: h.hp, afterDeclaration: h.hp, fatal: false };
      model.notes.push("고정 피해 · 카드 효과·슬롯 피해·부착 강화·무기 공격 보정 미적용", "적 행동 카드를 공개하거나 소모하지 않습니다.");
      return model;
    }

    const rewardsEnabled = !!state.mission || state.setup?.rulesVersion >= 11 && !state.provisional,
      extendedRewards = state.setup?.rulesVersion >= 11 && !state.provisional,
      rewardIds = selection.rewardIds || [], itemIds = selection.itemIds || [],
      rewards = rewardsEnabled ? h.rewards || [] : [], chosenRewards = [], chosenItems = [],
      invalid = reason => Object.assign(model, { reason });
    if (!Array.isArray(rewardIds) || new Set(rewardIds).size !== rewardIds.length ||
        !Array.isArray(itemIds) || new Set(itemIds).size !== itemIds.length) return invalid("중복되지 않은 보상·소모품을 선택하세요.");
    for (const id of rewardIds) {
      const reward = rewards.find(reward => reward.id === id && reward.equipped && reward.ready && attackRewardKinds.has(reward.kind));
      if (!reward) return invalid("공격할 때 사용할 수 있는 준비된 보상을 선택하세요.");
      chosenRewards.push(reward);
    }
    if (chosenRewards.filter(reward => reward.kind === "rune-clawmark").length > 1) return invalid("손톱자국 문자는 하나만 선택하세요.");
    const definitions = itemIds.length ? engine.consumableDefinitions(state) : null;
    for (const id of itemIds) {
      const item = h.consumables.find(item => item.id === id), definition = item && definitions[item.kind];
      if (!definition || definition.runtime !== "playable" || definition.timing !== "공격할 때") return invalid("공격할 때 사용할 수 있는 소모품을 선택하세요.");
      chosenItems.push(definition);
    }
    const replacement = chosenRewards.some(reward => reward.kind === "rune-clawmark"),
      card = replacement ? {} : printedCard,
      attachments = rewards.filter(reward => reward.equipped && reward.slot === selection.slot),
      shardDamage = attachments.filter(reward => reward.kind === "bloodstone-shard" || extendedRewards && reward.kind === "bloodstone-chunk").length,
      chunkSpeed = extendedRewards ? attachments.filter(reward => reward.kind === "bloodstone-chunk").length : 0,
      tearHeal = extendedRewards ? attachments.filter(reward => reward.kind === "tear-gem").length : 0,
      reward = { speed: chunkSpeed, damage: shardDamage + (replacement ? 1 : 0), interrupt: replacement,
        interruptEqual: false, freeTransform: false };
    for (const chosen of chosenRewards) {
      if (chosen.kind === "empty-shell") { reward.speed++; reward.damage++; }
      if (chosen.kind === "rune-hunter") { reward.speed++; reward.freeTransform = true; }
      if (chosen.kind === "rune-writhe") { reward.interrupt = true; reward.interruptEqual = true; }
    }
    const itemBonus = chosenItems.reduce((sum, item) => {
      for (const property of ["speed", "damage", "defense"]) sum[property] += number(item.effects?.[property]);
      sum.removeEnemyAttackEffects ||= !!item.effects?.removeEnemyAttackEffects;
      return sum;
    }, { speed: 0, damage: 0, defense: 0, removeEnemyAttackEffects: false });

    // commitAttack places the card before consulting weapon-rules: immediate
    // card healing and clearing affect low-health and occupied-slot conditions.
    // This projection contains only the public scalar inputs that helper reads.
    const leapEligible = state.leapMoveRuling === "move-action" && kind === "ATTACK" && state.phase === "hunter" && card.leap,
      target = leapEligible ? state.enemies?.find(enemy => enemy.id === selection.enemyId) : null,
      previousMoveActions = typeof h.moveActionsRound === "number" ? h.moveActionsRound :
        h.moveActionsRound?.round === state.round ? number(h.moveActionsRound.count) : 0,
      leapMoveActions = leapEligible && target && target.node !== h.position &&
        engine.leapPaths(state, target.node).some(route => route.length > 1) ? 1 : 0,
      projectedMoveActions = previousMoveActions + leapMoveActions,
      afterCardHp = Math.min(6, h.hp + number(card.heal)), placedSlots = h.slots.map(Boolean);
    placedSlots[selection.slot] = !card.clear;
    const publicHunter = { hp: afterCardHp, slots: placedSlots, moveActionsRound: projectedMoveActions,
      weaponCharge: h.weaponCharge ? { round: h.weaponCharge.round, speed: h.weaponCharge.speed, damage: h.weaponCharge.damage } : undefined },
      publicState = { setup: { rulesVersion: state.setup?.rulesVersion }, provisional: !!state.provisional,
        round: state.round, activeHunterId: "public", hunters: { public: publicHunter } };
    let wb;
    try { wb = weaponRules.attackBonus(publicState, face, selection.slot, card, reward, selection.weaponBoost); }
    catch (error) { return invalid(error.message); }
    const speed = number(slot.speed) + number(card.speed) + itemBonus.speed + reward.speed + wb.speed,
      damage = number(slot.damage) + number(card.damage) + itemBonus.damage + reward.damage + wb.damage,
      afterPayment = Math.max(0, afterCardHp - wb.selfDamage),
      chapter = state.mission?.chapter || state.world?.chapter || 1,
      prevention = afterPayment <= 0 && wb.selfDamage && extendedRewards && !h.inDream ?
        rewards.find(reward => reward.kind === "rune-corruption" && reward.equipped && reward.ready && reward.triggerArmed && reward.lastUsedChapter !== chapter) : null,
      fatal = afterPayment <= 0 && !prevention,
      afterDeclaration = fatal ? 0 : Math.min(6, (prevention ? 6 : afterPayment) + wb.heal + tearHeal);
    model.ready = true;
    model.speed = speed; model.damage = damage;
    model.willAttack = !fatal;
    model.suppressedCardEffects = replacement;
    model.hp = { before: h.hp, afterCard: afterCardHp, cardHeal: afterCardHp - h.hp,
      selfDamage: wb.selfDamage, afterPayment, afterDeclaration, fatal,
      preventedBy: prevention ? { id: prevention.id, kind: prevention.kind } : null,
      weaponHeal: wb.heal, attachmentHeal: tearHeal };
    model.attack = { name: slot.name, speed, damage, interrupt: !!card.interrupt || !!reward.interrupt,
      interruptEqual: !!reward.interruptEqual || !!wb.interruptEqual,
      afterAttackHeal: number(card.afterAttackHeal), healDealt: wb.healDealt,
      freeTransform: !!card.freeTransform || !!reward.freeTransform || wb.freeTransform,
      noDodge: wb.noDodge, immuneInterrupt: wb.immuneInterrupt,
      splash: wb.splash || face.splash || null, onKill: card.onKill || null };
    model.formula = {
      speed: { base: number(slot.speed), card: number(card.speed), attachment: chunkSpeed,
        reward: reward.speed - chunkSpeed, item: itemBonus.speed, weapon: wb.speed, total: speed },
      damage: { base: number(slot.damage), card: number(card.damage), attachment: shardDamage,
        reward: reward.damage - shardDamage, item: itemBonus.damage, weapon: wb.damage, total: damage },
    };
    model.moveActions = projectedMoveActions;
    model.leapMoveActions = leapMoveActions;
    const effectCode = weaponRules.code(face);
    if (effectCode === "damage_per_move_action_this_round" && weaponRules.enabled(publicState))
      model.notes.push(leapMoveActions ? `도약 선행 이동 1회 포함 · 실행 후 이번 라운드 이동 행동 ${model.moveActions}회 · 이동한 칸 수와 별도로 계산합니다.` :
        `이번 라운드 이동 행동 ${model.moveActions}회 · 이동한 칸 수와 별도로 계산합니다.`);
    if (effectCode === "transform_next_attack_speed_damage_one" && weaponRules.enabled(publicState)) {
      model.charge = { active: wb.consumeCharge, remainingAttacks: wb.consumeCharge ? 1 : 0,
        consumedOnThisAttack: wb.consumeCharge && !fatal, expires: "이번 라운드가 끝나면 만료", round: state.round };
      model.notes.push(wb.consumeCharge ? "충전 1회 남음 · 이번 공격에 적용 후 소모 · 이번 라운드가 끝나면 만료" :
        "충전 보너스 없음 · 형태의 전기 표시와 별도로 다음 공격 충전을 계산합니다.");
    }
    if (model.attack.interruptEqual && model.attack.interrupt)
      model.notes.push("방해 · 적과 같은 속도에서도 방해 적용 가능");
    else if (wb.interruptEqual) model.notes.push("이 무기는 동속 방해 가능 · 현재 선택에는 방해 효과가 없습니다.");
    if (model.attack.afterAttackHeal) model.notes.push(`공격 실행 후 치유 ${model.attack.afterAttackHeal} · 공격 전에 받는 피해를 먼저 처리합니다.`);
    if (model.attack.healDealt) model.notes.push("공격으로 준 피해만큼 공격 실행 후 치유합니다.");
    if (fatal) model.warnings.push("자해 후 체력 0 · 공격을 실행하기 전에 사망합니다.");
    if (prevention) model.warnings.push("자해로 체력 0이 되면 준비된 타락 문자를 소모해 체력 6으로 회복합니다.");
    return model;
  }

  function formulaHTML(label, formula) {
    return `${label} ${esc(formula.base)}${[["카드", formula.card], ["부착 강화", formula.attachment],
      ["룬·도구", formula.reward], ["소모품", formula.item], ["무기", formula.weapon]]
      .filter(([, value]) => value).map(([name, value]) => ` + ${name} ${esc(value)}`).join("")} = <b>${esc(formula.total)}</b>`;
  }
  function renderHTML(model, { clean } = {}) {
    if (!model) return "";
    if (!model.ready) return `<p class="attack-preview-requirement">${esc(text(model.reason || model.requirement, clean))}</p>`;
    const title = model.fixed ? `고유 행동 · 고정 피해 ${model.damage}` : `확정 전 공격 · 속도 ${model.speed} · 피해 ${model.damage}`,
      formula = model.fixed ? "" : `<p class="attack-preview-formula">${formulaHTML("속도", model.formula.speed)}<br>${formulaHTML("피해", model.formula.damage)}</p>`,
      hp = model.hp, hpText = hp.selfDamage ? `<p class="attack-preview-hp">${hp.cardHeal ? `카드 치유 후 체력 ${esc(hp.afterCard)} · ` : ""}자해 ${esc(hp.selfDamage)} · 체력 ${esc(hp.before)} → <b>${esc(hp.afterDeclaration)}</b>${hp.weaponHeal || hp.attachmentHeal ? ` · 즉시 치유 ${esc(hp.weaponHeal + hp.attachmentHeal)}` : ""}</p>` : "";
    return `<div class="attack-selection-preview${model.hp.fatal ? " is-danger" : ""}" role="note"><strong>${esc(title)}</strong>${formula}${hpText}${model.warnings.map(warning => `<p class="attack-preview-warning">${esc(text(warning, clean))}</p>`).join("")}${model.notes.map(note => `<p class="attack-preview-note">${esc(text(note, clean))}</p>`).join("")}</div>`;
  }
  return { view, renderHTML };
});
