(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntCombatControls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // A view of disclosed equipment and choices only. This module never dispatches,
  // simulates an action, spends a reward, or looks at an unrevealed deck.
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const types = { strength: "근력", skill: "기술", endurance: "지구력", vitality: "활력" };
  const cleanText = (value, clean) => clean ? clean(String(value ?? "")) : String(value ?? "");
  const finite = value => Number.isFinite(value) ? value : 0;

  function attachmentBonus(reward, policy) {
    return { damage: policy.rewards && (reward.kind === "bloodstone-shard" || policy.extended && reward.kind === "bloodstone-chunk") ? 1 : 0,
      speed: policy.extended && reward.kind === "bloodstone-chunk" ? 1 : 0,
      heal: policy.extended && reward.kind === "tear-gem" ? 1 : 0 };
  }

  function slotFacts(state, engine) {
    const h = engine.hunter(state), session = !!state.mission || state.setup?.rulesVersion >= 11 && !state.provisional,
      extended = state.setup?.rulesVersion >= 11 && !state.provisional,
      equipped = session ? (engine.rewardsView?.(state)?.rewards || []).filter(reward => reward.equipped && reward.persistent) : [],
      attachmentPolicy = { rewards: session, extended };
    return engine.slots(state).map((slot, index) => {
      const attachments = equipped.filter(reward => reward.slot === index).map(reward => ({
        id: reward.id, kind: reward.kind, name: reward.name, rules: reward.rules,
      })), bonuses = attachments.map(reward => attachmentBonus(reward, attachmentPolicy)),
        upgradeDamage = bonuses.reduce((sum, bonus) => sum + bonus.damage, 0),
        upgradeSpeed = bonuses.reduce((sum, bonus) => sum + bonus.speed, 0),
        upgradeHeal = bonuses.reduce((sum, bonus) => sum + bonus.heal, 0);
      return { index, name: slot.name, text: slot.text || "", speed: finite(slot.speed), damage: finite(slot.damage),
        upgradeDamage, upgradeSpeed, upgradeHeal, totalDamage: finite(slot.damage) + upgradeDamage,
        totalSpeed: finite(slot.speed) + upgradeSpeed, occupied: !!h.slots[index], attachments, attachmentPolicy };
    });
  }

  function attachmentDestination(slot, reward) {
    if (!slot || !reward) return null;
    const policy = slot.attachmentPolicy || { rewards: false, extended: false },
      others = slot.attachments.filter(item => reward.id == null || item.id !== reward.id),
      bonuses = others.map(item => attachmentBonus(item, policy)), added = attachmentBonus(reward, policy),
      otherDamage = bonuses.reduce((sum, bonus) => sum + bonus.damage, 0),
      otherSpeed = bonuses.reduce((sum, bonus) => sum + bonus.speed, 0),
      otherHeal = bonuses.reduce((sum, bonus) => sum + bonus.heal, 0);
    return { index: slot.index, name: slot.name, text: slot.text, baseDamage: slot.damage, baseSpeed: slot.speed,
      current: reward.id != null && slot.attachments.some(item => item.id === reward.id),
      beforeDamage: slot.totalDamage, beforeSpeed: slot.totalSpeed, otherDamage, otherSpeed,
      addedDamage: added.damage, addedSpeed: added.speed,
      damage: slot.damage + otherDamage + added.damage, speed: slot.speed + otherSpeed + added.speed,
      heal: otherHeal + added.heal };
  }

  function attachmentOptionHTML(slot, reward, { clean, placement = false } = {}) {
    const destination = attachmentDestination(slot, reward);
    if (!destination) return "";
    return `<span class="attachment-destination-name">${destination.index + 1}번 슬롯${placement ? "에 장착" : destination.current ? " · 현재 위치" : "으로 옮기기"} · ${esc(cleanText(destination.name, clean))}</span><small class="attachment-destination-stats">속도 ${esc(destination.beforeSpeed)} → <b>${esc(destination.speed)}</b> · 슬롯 피해 ${esc(destination.beforeDamage)} → <b>${esc(destination.damage)}</b></small><small class="attachment-destination-formula">기본 피해 ${esc(destination.baseDamage)} + 다른 부착 강화 ${esc(destination.otherDamage)} + 이 보상 ${esc(destination.addedDamage)} = 부착 후 슬롯 피해 ${esc(destination.damage)}</small>${destination.heal ? `<small class="attachment-destination-effects">공격 확정 시 치유 ${esc(destination.heal)}</small>` : ""}${destination.text ? `<small class="attachment-destination-effects">슬롯 설명 · ${esc(cleanText(destination.text, clean))}</small>` : ""}`;
  }

  function slotFormulaHTML(slot) {
    if (!slot) return "";
    const speed = slot.upgradeSpeed
      ? `속도 ${esc(slot.speed)} + 강화 ${esc(slot.upgradeSpeed)} = <b>${esc(slot.totalSpeed)}</b>`
      : `속도 ${esc(slot.speed)}`;
    return `<span class="slot-strength-speed">${speed}</span><span class="slot-strength-damage">기본 피해 ${esc(slot.damage)} + 강화 ${esc(slot.upgradeDamage)} = <b>피해 ${esc(slot.totalDamage)}</b></span>`;
  }

  function view(state, engine, selection = {}) {
    const h = engine.hunter(state), rewards = engine.rewardsView?.(state)?.rewards || [],
      rewardIds = new Set(selection.rewardIds || []), mode = selection.mode === "dodge" ? "dodge" : "attack",
      fixedDamage = selection.actionKind === "fixed-damage" && mode === "attack" && Number.isFinite(selection.fixedDamage)
        ? Math.max(0, selection.fixedDamage) : null,
      fixed = fixedDamage !== null,
      hand = h.hand.map(instance => {
        const card = engine.card(instance);
        return { id: instance.id, name: card.name, type: card.type, text: card.text || "", dodge: !!card.dodge, speed: finite(card.speed) };
      }), slots = slotFacts(state, engine),
      selectedCard = hand.find(card => card.id === selection.cardId) || null,
      selectedSlot = slots.find(slot => slot.index === selection.slot && !slot.occupied) || null,
      selectedRewards = mode === "attack" && !fixed ? rewards.filter(reward => rewardIds.has(reward.id) && reward.attackSelectable) : [],
      replacement = selectedRewards.find(reward => reward.kind === "rune-clawmark") || null;
    const extraEffects = [
      ...(mode === "attack" && !fixed && selectedSlot ? selectedSlot.attachments : []).map(reward => ({ name: reward.name, text: reward.rules || "" })),
      ...selectedRewards.map(reward => ({ name: reward.name, text: reward.rules || "" })),
      ...(mode === "attack" && !fixed ? selection.items || [] : []).map(item => typeof item === "string" ?
        { name: item, text: "" } : { name: item.name || "소모품", text: item.rules || item.text || "" }),
      ...(!fixed ? selection.appliedEffects || [] : []).map(effect => typeof effect === "string" ?
        { name: effect, text: "" } : { name: effect.name || "적용 효과", text: effect.text || effect.rules || "" }),
    ];
    return { mode, hand, slots, selectedCard, selectedSlot,
      actionKind: fixed ? "fixed-damage" : mode, fixedDamage,
      actionLabel: selection.actionLabel || "무기 고유 행동", requiredSlot: selection.requiredSlot,
      fixedAction: mode === "attack" && !fixed && Number.isFinite(selection.fixedAction?.damage)
        ? { ...selection.fixedAction, damage: Math.max(0, selection.fixedAction.damage) } : null,
      replacement: replacement ? { name: replacement.name, text: replacement.rules || "공격 피해 +1 · 방해" } : null,
      extraEffects, ...(!fixed && selection.attack ? { attack: { ...selection.attack } } : {}) };
  }

  function cardEffectHTML(model, clean) {
    if (!model.selectedCard) return '<p class="combat-selection-hint">사용할 카드를 선택하세요.</p>';
    const text = cleanText(model.selectedCard.text || "추가 카드 효과 없음", clean);
    if (model.actionKind === "fixed-damage") return `<p class="combat-suppressed-effect"><span>미적용</span> ${esc(text)}</p><p class="combat-selection-hint">기술을 뒷면으로 놓습니다. 카드의 피해·속도·방해·뽑기·회복·슬롯 비우기 효과는 적용되지 않습니다.</p>`;
    if (!model.replacement) return `<p class="combat-selected-card-effect"><strong>카드 효과</strong> ${esc(text)}</p>${model.mode === "dodge" && !model.selectedCard.dodge ? '<p class="combat-selection-hint">이 카드에는 회피 효과가 없습니다.</p>' : ""}`;
    return `<div class="combat-card-replacement" role="note"><p><strong>${esc(cleanText(model.replacement.name, clean))} · 원래 카드 효과 대체</strong></p><p class="combat-suppressed-effect"><span>미적용</span> ${esc(text)}</p><p class="combat-replacement-effect">대신 적용 · 공격 피해 +1 · 방해</p><small>원래 카드의 피해·속도·뽑기·회복·슬롯 비우기 등 모든 스탯 효과가 적용되지 않습니다.</small></div>`;
  }

  function fixedActionHTML(action, model, clean, separate = false) {
    if (!action) return "";
    const hasSlotRequirement = Number.isInteger(action.requiredSlot),
      slotRequirement = hasSlotRequirement ? `${action.requiredSlot + 1}번 빈 슬롯` : "빈 슬롯 1개",
      ready = !!model.selectedCard && !!model.selectedSlot && (!hasSlotRequirement || model.selectedSlot.index === action.requiredSlot);
    return `<section class="combat-fixed-action" role="note"><p><strong>${esc(cleanText(action.label || "무기 고유 행동", clean))}${separate ? " · 일반 공격과 별도" : ""}</strong> · <b>고정 피해 ${esc(action.damage)}</b></p><p>필요: 손패 기술 1개 · ${esc(slotRequirement)}. 기술을 뒷면으로 놓아 사용합니다.</p><small>카드·슬롯의 공격 수치와 부착 강화, 룬·소모품의 공격 보정은 이 고정 피해에 더하지 않습니다.</small><p class="combat-selection-hint">${ready ? "기술과 빈 슬롯 선택 완료 · 고유 행동 버튼으로 확정하세요." : "기술과 필요한 빈 슬롯을 선택하면 고유 행동을 사용할 수 있습니다."}</p></section>`;
  }

  function renderHTML(model, { clean } = {}) {
    if (!model) return "";
    const fixed = model.actionKind === "fixed-damage",
      mode = fixed ? "고유 행동" : model.mode === "dodge" ? "회피" : "공격", selectedCardId = model.selectedCard?.id,
      selectedSlotIndex = model.selectedSlot?.index;
    const cards = model.hand.map(card => `<option value="${esc(card.id)}" ${card.id === selectedCardId ? "selected" : ""}>${esc(types[card.type] || "카드")} · ${esc(cleanText(card.name, clean))}</option>`).join("");
    const slots = model.slots.map(slot => `<option value="${esc(slot.index)}" ${slot.index === selectedSlotIndex ? "selected" : ""} ${slot.occupied ? "disabled" : ""}>${slot.index + 1}번 · ${esc(cleanText(slot.name, clean))}${fixed ? " · 수치 미적용" : ` · 속도 ${esc(model.mode === "dodge" ? slot.speed : slot.totalSpeed)}${model.mode === "dodge" ? "" : ` · 피해 ${esc(slot.totalDamage)}`}`}${slot.occupied ? " · 사용됨" : ""}</option>`).join("");
    const applied = model.extraEffects.length ? `<details class="combat-selection-extras"><summary>추가 적용 ${model.extraEffects.length}개 · ${model.extraEffects.map(effect => esc(cleanText(effect.name, clean))).join(" · ")}</summary><ul>${model.extraEffects.map(effect => `<li><strong>${esc(cleanText(effect.name, clean))}</strong>${effect.text ? `<p>${esc(cleanText(effect.text, clean))}</p>` : ""}</li>`).join("")}</ul></details>` : "";
    const selectedFormula = !model.selectedSlot || fixed ? "" : model.mode === "dodge" ?
      `슬롯 속도 ${esc(model.selectedSlot.speed)}${model.selectedCard ? ` + 카드 ${esc(model.selectedCard.speed)} = 회피 속도 <b>${esc(model.selectedSlot.speed + model.selectedCard.speed)}</b>` : ""}${model.selectedSlot.upgradeSpeed || model.selectedSlot.upgradeDamage ? "<small>공격 강화는 회피에 미적용</small>" : ""}` : slotFormulaHTML(model.selectedSlot);
    return `<div class="combat-selection-heading"><h3>${mode} 준비</h3><span>선택 → 아래 버튼으로 확정</span></div><div class="combat-selection-fields"><label for="combatSelectCard">${mode} 카드<select id="combatSelectCard" data-combat-select="card"><option value="" ${!selectedCardId ? "selected" : ""}>선택 안 함</option>${cards}</select></label><label for="combatSelectSlot">빈 ${mode} 슬롯<select id="combatSelectSlot" data-combat-select="slot"><option value="" ${selectedSlotIndex === undefined ? "selected" : ""}>선택 안 함</option>${slots}</select></label></div><div class="combat-selection-effects">${fixed ? fixedActionHTML({ label: model.actionLabel, damage: model.fixedDamage, requiredSlot: model.requiredSlot }, model, clean) : ""}${selectedFormula ? `<p class="combat-selected-slot-formula">${selectedFormula}</p>` : ""}${cardEffectHTML(model, clean)}${applied}${model.attack ? `<p class="combat-selected-attack-stats">적용 후 공격 · 속도 <b>${esc(model.attack.speed)}</b> · 피해 <b>${esc(model.attack.damage)}</b></p>` : ""}${fixedActionHTML(model.fixedAction, model, clean, true)}</div>`;
  }
  return { slotFacts, slotFormulaHTML, attachmentDestination, attachmentOptionHTML, view, renderHTML };
});
