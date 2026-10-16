(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntOutcomePreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // This boundary receives public target/mission facts and an already disclosed
  // combat, never a rules state, deck, random source or command dispatcher.
  const finite = value => Number.isFinite(value) ? value : 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const actionPending = (combat, action) => !Array.isArray(combat.groups) ||
    !combat.groups.slice(0, combat.index || 0).some(group => !group.ability && group.speed === action.speed);
  function describe({ enemy, definition, mission, hunter, combat, phase, attack } = {}) {
    // A simultaneous final kill can remove the figure while its already
    // disclosed separate followup is still pending. Never erase that warning.
    const pendingExtra = phase === "combat_extra" && combat?.extra && (!enemy || enemy.id === combat.enemyId);
    if (!enemy || !(enemy.hp > 0) || !definition) {
      if (!pendingExtra) return null;
      enemy = { id: combat.enemyId, node: hunter?.position, hp: 0 };
      definition = { name: definition?.name || "처치된 적" };
    }
    const current = combat?.enemyId === enemy.id ? combat : null,
      player = current?.attack || current?.flame || (!current ? attack : null),
      target = (mission?.targets || []).find(target => target.id === enemy.missionId &&
        target.enemyId === enemy.id && !target.complete && (mission.revealed || []).includes(target.card)),
      tokens = target && Number.isInteger(target.tokens) ? target.tokens : 0,
      sameNode = hunter?.position === enemy.node,
      warnings = [], sequence = [],
      model = { enemyId: enemy.id, enemyName: definition.name || "적", warnings, sequence,
        enemyActionUnknown: !current?.action, incoming: null };
    const add = (id, title, detail, critical = false) => warnings.push({ id, title, detail, critical });
    const action = current?.action, playerPending = player && !current?.cancelHunter &&
      !current?.attackResolved && !current?.flameResolved,
      interrupts = sameNode && playerPending && player.interrupt && action?.type === "attack" &&
        !action.uninterruptible && (player.speed > action.speed || player.interruptEqual && player.speed === action.speed);
    if (tokens > 0) {
      const continuation = current?.cancelEnemy ? "현재 적 공격 취소 유지" : current?.dodged ? "현재 적 공격 회피 선택 유지" :
        interrupts ? "선택한 공격의 방해 적용 가능" : "적 공격 계속";
      add("revival", `토큰 소모 후 완전 회복 · ${continuation}`,
        `임무 계몽 토큰 ${tokens}개. 처치될 피해를 받으면 토큰 1개를 소모하고 체력 ${definition.maxHp} / ${definition.maxHp}로 회복합니다. ` +
        "처치·처치 보상은 발생하지 않습니다. 토큰 회복은 별도의 회피·방해를 취소하지 않으며, 추가 타격에는 따로 대응합니다.");
    }
    if (target && [10, 31].includes(target.card)) {
      model.deathReaction = { damage: 3, dodgeSpeed: 1, remainingTokens: tokens };
      add("last-attack", tokens > 0 ? "토큰을 모두 소진한 뒤 최종 처치해도 추가 대응 필요" : "최종 처치 후 · 속도 1 회피 또는 피해 3",
        `${tokens > 0 ? "남은 부활 토큰을 모두 소진하고 최종 처치하면" : "이 적을 최종 처치하면"} 별도로 속도 1 회피를 하거나 피해 3을 받습니다. ` +
        "처치했다고 안전해지는 것은 아닙니다. 그때 남은 체력이 3 이하이고 피해를 막지 못하면 사망할 수 있습니다.");
    }
    if (definition.boss && enemy.componentId === "cleric-beast" && definition.phase === 1) {
      add("boss-phase", "이번 체력 소진은 최종 처치가 아닌 2페이즈 전환",
        "현재 체력을 모두 줄여도 성직자 야수는 2페이즈의 체력으로 전환합니다. 초과 피해는 다음 페이즈로 넘기지 않으며, 아직 처치 보상을 얻지 않습니다.");
    }
    if (target && enemy.missionId === "main" && mission.chapter === 2 &&
      (mission.revealed || []).includes(22) && !(mission.discarded || []).includes(22)) {
      add("damage-immunity", "현재 임무 효과 · 이 성직자 야수는 피해를 입지 않음",
        "공개된 목표대로 오에돈의 지하묘지로 유인해야 합니다. 슬롯의 피해 수치만큼 체력이 줄어들지 않습니다.");
    }
    if (!current?.action) {
      if (warnings.length) model.unknownDetail = "적 행동은 공격 확정 후 공개됩니다. 아직 공개되지 않은 방어·공격 순서·추가 행동은 예측하지 않습니다.";
      return model;
    }
    if (!sameNode && phase !== "combat_extra") {
      add("different-node", "현재 서로 다른 칸 · 직접 공격 피해가 닿지 않을 수 있음",
        "현재 위치와 공개된 강제 이동을 확인하세요. 이 예고는 다른 칸으로 이동한 뒤의 공격 결과를 확정하지 않습니다.");
      return model;
    }
    if (current.reflectDamage && playerPending) add("reflection", "공격으로 준 피해가 되돌아올 수 있음",
      "실제로 준 피해만큼 별도의 반격에 대응해야 합니다. 공개된 반격의 회피 조건을 확인하세요.");
    if (action.code === "male-patient-death-echo" && !current.cancelEnemy && !current.removeEnemyAttackEffects && !interrupts) {
      add("death-echo", "처치 반응 · 죽음의 메아리 피해 2와 독",
        "이 행동을 방해하지 않고 같은 칸에서 적을 처치하면, 적의 원래 공격보다 먼저 처치해도 회피할 수 없는 피해 2와 독에 대응하게 됩니다. 방어는 별도로 적용됩니다.");
    }
    const defense = Math.max(0, finite(current.defense)), hp = finite(hunter?.hp),
      immune = new Set(current.immune || []), rawFirst = Math.max(0, finite(action.damage) -
        (action.bossInsightReduction ? finite(enemy.insightTokens) : 0)),
      bloodFrenzyMayChange = target?.card === 10 && action.kind === "special" && playerPending &&
        Number.isFinite(player.speed) && player.speed > action.speed,
      firstPending = action.type === "attack" && phase !== "combat_extra" && actionPending(current, action),
      firstActive = firstPending && !current.cancelEnemy && !current.dodged && !interrupts,
      firstMinimum = firstActive ? Math.max(0, (bloodFrenzyMayChange ? 2 + finite(current.buff?.damage) : rawFirst) +
        (hunter?.status?.frenzy ? 1 : 0) - defense) : 0,
      first = firstActive ? Math.max(0, (bloodFrenzyMayChange ? 4 + finite(current.buff?.damage) : rawFirst) +
        (hunter?.status?.frenzy ? 1 : 0) - defense) : 0,
      // The printed followup is separately queued even when the first hit is
      // dodged/interrupted. In combat_extra the first hit is already past.
      followupPending = phase === "combat_extra" && !!current.extra || firstPending && !!action.followup,
      followupRaw = phase === "combat_extra" ? finite(current.extra?.damage) : 2,
      followup = followupPending ? Math.max(0, followupRaw - defense) : 0,
      handCount = Number.isInteger(hunter?.handCount) ? hunter.handCount : Array.isArray(hunter?.hand) ? hunter.hand.length : null,
      stun = firstActive && action.stun && !immune.has("stun") && handCount === 0 ? 1 : 0,
      hasHealing = !!(player?.afterAttackHeal || player?.healDealt),
      enemyBefore = playerPending && Number.isFinite(player.speed) && Number.isFinite(action.speed) && action.speed > player.speed,
      simultaneous = playerPending && action.type === "attack" && action.speed === player.speed,
      beforeHealing = enemyBefore ? first + stun + followup : simultaneous ? first : 0;
    if (action.type === "attack" && (firstPending || phase === "combat_extra")) {
      model.incoming = { hp, defense, first, firstMinimum, followup, stun, total: first + followup + stun,
        beforeHealing, fatalBeforeHealing: hp > 0 && beforeHealing >= hp,
        followupIsSeparate: followupPending, firstAlreadyProcessed: phase === "combat_extra" };
      const leadingDamage = Math.max(0, finite(player?.damage) - Math.max(0, finite(current.enemyDefense)));
      if (bloodFrenzyMayChange && firstActive && enemy.hp === definition.maxHp &&
          leadingDamage > 0 && leadingDamage < enemy.hp && first > firstMinimum) {
        // A faster attack may heal before retaliation. Keep the damage warning,
        // but do not infer death from pre-heal HP in that case.
        const fatal = !hasHealing && hp > 0 && first >= hp;
        add("wounded-retaliation", `피의 광란 · 다친 채 생존 시 반격 최대 ${first}피해${fatal ? " · 현재 체력 기준 사망 가능" : ""}`,
          `플레이어 공격이 먼저 실제 피해를 주고 적이 다친 채 살아남으면, 피의 광란의 기본 피해가 2에서 4로 증가합니다. ` +
          `공개된 강화·발광·방어를 반영하면 받을 피해는 최대 ${first}입니다. ` +
          "회피·방해·최종 처치·토큰 완전 회복 등 추가 처리로 결과가 달라질 수 있습니다.", fatal);
      }
      const firstStep = { id: "enemy-first", title: `${action.name || "적 공격"} · 첫 타격`,
        detail: firstActive ? bloodFrenzyMayChange ? `적의 공격 시점에 체력이 가득 차 있으면 피해 2, 다친 상태면 피해 4입니다. 현재 공개된 강화·발광·방어를 반영하면 받을 피해 ${firstMinimum}~${first}. 토큰 회복으로 이 조건이 다시 달라질 수 있습니다.` :
          `피해 ${rawFirst}${hunter?.status?.frenzy ? " + 발광 1" : ""}${defense ? ` - 방어 ${defense}` : ""} → 받을 피해 ${first}.` :
          current.dodged ? "현재 첫 타격 회피 선택됨." : "현재 첫 타격은 취소되거나 선택한 방해로 취소할 수 있습니다.", damage: first };
      const extraStep = { id: "enemy-followup", title: "별도의 추가 타격", damage: followup,
        detail: `피해 ${followupRaw}${defense ? ` - 방어 ${defense}` : ""} → 피하지 않으면 피해 ${followup}. ` +
          "첫 타격의 회피·방해와 별개로 속도 2 회피가 필요합니다." };
      const hunterStep = { id: "hunter-attack", title: `플레이어 공격${hasHealing ? " → 생존 시 공격 후 치유" : ""}`,
        detail: `속도 ${player?.speed} · 피해 ${player?.damage}. ${sameNode ? "적 방어·부활·페이즈 전환은 별도로 적용합니다." :
          "대상이 다른 칸이면 직접 피해는 닿지 않습니다. 공격 후 치유는 별도 지시를 따릅니다."}` };
      if (phase === "combat_extra") {
        sequence.push(extraStep);
        if (playerPending) sequence.push(hunterStep);
      } else if (enemyBefore) {
        sequence.push(firstStep);
        if (stun) sequence.push({ id: "stun", title: "기절 · 버릴 손패 없음", detail: "손패 대신 피해 1.", damage: 1 });
        if (followupPending) sequence.push(extraStep);
        sequence.push(hunterStep);
      } else if (simultaneous) {
        sequence.push({ id: "simultaneous", title: "같은 속도 · 두 공격 동시 처리", damage: first,
          detail: `적 첫 타격으로 받을 피해 ${first}. 체력이 0이 되면 공격 후 치유 전에 사망을 처리합니다.` });
        if (followupPending) sequence.push(extraStep);
      } else {
        if (playerPending) sequence.push(hunterStep);
        sequence.push(firstStep);
        if (followupPending) sequence.push(extraStep);
      }
      if (followupPending) add("followup-total", phase === "combat_extra" ? `남은 추가 타격 · 피하지 않으면 피해 ${followup}` :
        `첫 타격 ${first} + 추가 타격 ${followup}${stun ? ` + 기절 ${stun}` : ""} · 대응하지 않으면 합계 ${first + followup + stun} 피해`,
        "현재 위치·방어·발광을 반영한 공개된 공격의 피해입니다. 추가 타격에는 별도로 대응합니다. " +
        (enemyBefore ? "추가 타격 처리 뒤에 더 느린 플레이어 공격이 진행되므로, 공격 후 치유를 먼저 받을 수 없습니다." :
          "플레이어가 적을 먼저 최종 처치하거나 칸을 벗어나면 이후 흐름이 달라질 수 있습니다."));
      if (hasHealing && hp > 0 && beforeHealing >= hp) add("fatal-before-heal", "회복 전에 사망 가능",
        `현재 체력 ${hp}. ${simultaneous ? "동속의 첫 타격으로" : "더 빠른 적 피해로"} 치유 전에 최대 ${beforeHealing} 피해를 받을 수 있습니다. ` +
        "체력이 0이 되면 공격 후 치유로 되살아나지 않습니다. 먼저 회피·방해·방어 등의 대응을 확인하세요.", true);
      else if (hasHealing && enemyBefore) add("heal-order", "더 빠른 적 피해 → 생존한 경우에만 공격 후 치유",
        "공격 후 치유는 플레이어의 공격이 실제로 처리된 뒤에 적용됩니다. 더 빠른 공격에 방해되거나 사망하면 치유를 받을 수 없습니다.");
      if (firstActive && action.interrupt && enemyBefore && !immune.has("interrupt")) add("hunter-interrupted", "적의 방해 · 더 느린 플레이어 공격과 공격 후 치유 취소 가능",
        "현재 적 공격을 막지 못하면 더 느린 플레이어 공격이 취소됩니다. 공격이 취소되면 그 공격의 리게인·공격 후 치유도 진행되지 않습니다.");
      if (firstActive && action.poison && !immune.has("poison")) add("poison", "공격의 독 · 차례 종료 시 피해 1도 주의",
        "공격을 받으면 독 상태가 됩니다. 이 예고의 전투 피해 합계에는 나중에 받는 차례 종료 독 피해를 더하지 않았습니다.");
    }
    return model;
  }
  function renderHTML(model, { compact = false, clean } = {}) {
    if (!model || !model.warnings?.length && (compact || !model.sequence?.length)) return "";
    const text = value => esc(clean ? clean(String(value ?? "")) : value);
    if (compact) {
      const priority = warning => warning.critical ? 0 : ({ "wounded-retaliation": 1, "followup-total": 1, revival: 2, "last-attack": 3 })[warning.id] ?? 4,
        ordered = [...model.warnings].sort((left, right) => priority(left) - priority(right)),
        visible = ordered.slice(0, 3), remaining = ordered.length - visible.length;
      return `<section class="combat-outcome-preview combat-outcome-preview-compact" role="note" aria-label="공격 결과와 후속 피해 예고"><ul class="outcome-compact-list">${visible.map(warning => `<li class="outcome-warning${warning.critical ? " outcome-warning-critical" : ""}" data-outcome="${esc(warning.id)}"><strong>${text(warning.title)}</strong></li>`).join("")}</ul><p class="outcome-compact-more">${remaining ? `${text(`추가 예고 ${remaining}개`)} · ` : ""}${text("위 전투 상세에서 처리 순서 확인")}</p></section>`;
    }
    const warnings = model.warnings.map(warning => `<article class="outcome-warning${warning.critical ? " outcome-warning-critical" : ""}" data-outcome="${esc(warning.id)}"><strong>${text(warning.title)}</strong><p>${text(warning.detail)}</p></article>`).join(""),
      sequence = !compact && model.sequence.length ? `<ol class="outcome-sequence">${model.sequence.map(step => `<li><strong>${text(step.title)}</strong><span>${text(step.detail)}</span></li>`).join("")}</ol>` : "";
    return `<section class="combat-outcome-preview${compact ? " combat-outcome-preview-compact" : ""}" role="note" aria-label="공격 결과와 후속 피해 예고"><h3>${model.enemyActionUnknown ? "공격 확정 전 · 알려진 결과" : "공개된 전투 · 처리 순서와 위험"}</h3>${warnings}${sequence}${model.unknownDetail ? `<p class="outcome-unknown">${text(model.unknownDetail)}</p>` : ""}<p class="outcome-conditional">${text("공개된 현재 효과를 기준으로 한 조건부 예고입니다. 추가 대응·적 처치·이동·면역에 따라 결과가 달라질 수 있습니다.")}</p></section>`;
  }
  return Object.freeze({ describe, renderHTML });
});
