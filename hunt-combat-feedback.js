(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntCombatFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Render only the equipment and resolved action supplied by the controller.
  // No rules state, deck, random source, command or save crosses this boundary.
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const number = value => Number.isFinite(value) ? value : null;
  const cleanText = (value, clean) => clean ? clean(String(value ?? "")) : String(value ?? "");
  const unique = values => [...new Set(values.filter(value => typeof value === "string" && value.trim()))];
  function firearmRules(gun, clean) {
    if (!gun) return [];
    const printed = Array.isArray(gun.rules) && gun.rules.length ? gun.rules :
      [gun.ability || gun.text, gun.useNote, gun.prepareText || gun.readyRule, gun.dreamRule];
    return unique(printed.map(rule => cleanText(String(rule ?? "")
      .replace(/(?:자신의\s*)?사냥꾼\s*차례/g, "플레이어의 차례")
      .replace(/(?:손의\s*)?카드\s*(\d+)\s*장/g, "손패 $1장"), clean)));
  }
  function firearmNameHTML(gun, context = "equipment", clean) {
    const name = gun?.name || gun?.id || "화기", rules = firearmRules(gun, clean);
    if (!rules.length) return esc(name);
    const id = "firearm-effect-" + String(context).replace(/[^a-z0-9_-]/gi, "-") + "-" +
      String(gun.id || "gun").replace(/[^a-z0-9_-]/gi, "-");
    return `<span class="firearm-name-tooltip" tabindex="0" title="${esc(rules.join("\n"))}" aria-label="${esc(name)} · 능력과 준비 방법" aria-describedby="${id}" data-firearm-info="${esc(gun.id || "")}">${esc(name)}<span id="${id}" class="firearm-effect-tooltip" role="tooltip">${rules.map(rule => `<span>${esc(rule)}</span>`).join("")}</span></span>`;
  }
  const knownKeywords = {
    "방해": "interrupt", "기절": "stun", "독": "poison", "발광": "frenzy",
    "회피 불가": "undodgeable", "회피할 수 없습니다.": "undodgeable",
    "방해 불가": "uninterruptible", "방해할 수 없습니다.": "uninterruptible",
  };
  function effects(action, side = "enemy") {
    if (!action) return [];
    const result = [], keywords = Array.isArray(action.keywords) ? action.keywords : [];
    const enabled = key => Object.hasOwn(action, key) ? !!action[key] :
      keywords.some(keyword => knownKeywords[keyword] === key);
    const add = (label, text) => result.push({ label, text });
    if (enabled("interrupt")) add(action.interruptEqual ? "방해 · 같은 속도 포함" : "방해",
      side === "hunter" ? action.interruptEqual
        ? "방해 가능한 적의 공격을, 더 빠르거나 같은 속도에서 취소합니다."
        : "더 느린 적의 공격을 취소합니다. 방해 불가인 공격에는 적용되지 않습니다."
        : "더 느린 플레이어의 공격을 취소합니다. 방해 면역이면 적용되지 않습니다.");
    if (enabled("stun")) add("기절", "효과를 받으면 손패 1장을 버립니다. 버릴 손패가 없으면 피해 1을 받습니다.");
    if (enabled("poison")) add("독", "독 상태 이상을 받습니다. 플레이어의 차례 종료 시 피해 1을 받습니다.");
    if (enabled("frenzy")) add("발광", "발광 상태 이상을 받습니다. 공격으로 받는 피해가 1 증가합니다.");
    if (enabled("undodgeable")) add("회피 불가", "이 공격은 회피할 수 없습니다.");
    if (enabled("uninterruptible")) add("방해 불가", "이 공격은 방해로 취소할 수 없습니다.");
    if (action.followup) add("추가 타격", "첫 공격을 회피하거나 방해해도, 회피 속도 2의 추가 타격에 대응해야 합니다. 피하지 않으면 피해 2를 받습니다.");
    if (action.bossInsightReduction) add("계몽에 따른 피해 감소", "보스의 계몽 토큰 1개마다 이 공격의 피해가 1 감소합니다.");
    if (action.bossInsight) add("공격 전 계몽", "공격 전에 준비된 화기를 소진하여 보스에게 계몽 토큰 1개를 놓을 수 있습니다.");
    if (action.allHunters) add("같은 칸의 모든 사냥꾼", "이 칸의 모든 사냥꾼을 대상으로 합니다.");
    if (number(action.forceHunterMove) > 0) add("사냥꾼 강제 이동", `공격의 효과로 사냥꾼을 ${action.forceHunterMove}칸 멀리 이동합니다.`);
    if (number(action.afterAttackMove) > 0) add("적 이동", `공격 후 이 적을 ${action.afterAttackMove}칸 멀리 이동합니다.`);
    if (number(action.afterDodgeDamageBonus) > 0) add("회피 후 공격 강화", `이 공격을 회피하면 플레이어의 공격 피해가 ${action.afterDodgeDamageBonus} 증가합니다.`);
    if (action.otherHunters && number(action.otherHunters.damage) !== null) add("다른 사냥꾼의 대응", `이 칸의 다른 사냥꾼은 회피 속도 ${action.otherHunters.dodgeSpeed}로 회피하거나 피해 ${action.otherHunters.damage}를 받습니다.`);
    if (number(action.defense) > 0) add("적 방어", `이 적은 플레이어의 공격 피해를 ${action.defense} 방어합니다.`);
    if (number(action.splash) > 0) add("같은 칸의 범위 피해", `대상 외에 같은 칸의 다른 모든 적에게 피해 ${action.splash}를 줍니다.`);
    else if (action.splash && number(action.splash.damage) !== null && number(action.splash.range) !== null)
      add("범위 피해", `대상 외에 ${action.splash.range}칸 이내의 다른 적에게 피해 ${action.splash.damage}를 줍니다.`);
    if (number(action.afterAttackHeal) > 0) add("공격 후 치유", `공격 후 체력을 ${action.afterAttackHeal} 회복합니다.`);
    if (action.healDealt) add("준 피해만큼 치유", "공격으로 실제 준 피해만큼 체력을 회복합니다.");
    if (action.freeTransform) add("공격 후 무료 변형", "공격 후 무기를 무료로 변형할 수 있습니다.");
    if (action.onKill && (number(action.onKill.draw) > 0 || number(action.onKill.heal) > 0)) add("처치 효과",
      [number(action.onKill.draw) > 0 && `적 처치 시 손패 ${action.onKill.draw}장을 뽑습니다.`,
        number(action.onKill.heal) > 0 && `체력을 ${action.onKill.heal} 회복합니다.`].filter(Boolean).join(" "));
    for (const keyword of keywords) if (typeof keyword === "string" && !knownKeywords[keyword])
      add(keyword, keyword);
    return result.filter((effect, index) => result.findIndex(other => other.label === effect.label) === index);
  }
  function effectsHTML(action, side, clean, removed = false) {
    const list = removed ? [] : effects(action, side);
    return list.length ? `<ul class="combat-effect-list">${list.map(effect => `<li><strong>${esc(cleanText(effect.label, clean))}</strong><span>${esc(cleanText(effect.text, clean))}</span></li>`).join("")}</ul>` :
      '<p class="combat-no-effects">추가 효과 없음</p>';
  }
  function rulesHTML(action, clean, removed = false) {
    const rules = unique([...(Array.isArray(action?.rules) ? action.rules : []),
      ...(!action?.rules?.length && typeof action?.text === "string" ? [action.text] : [])]);
    if (!rules.length) return "";
    return `<div class="combat-rule-description"><p class="combat-rules-caption">${removed ? "원래 행동 설명 · 현재 공격의 부가 효과 제거됨" : "행동 설명"}</p><ul>${rules.map(rule => `<li>${esc(cleanText(rule, clean))}</li>`).join("")}</ul></div>`;
  }
  function statsHTML(action, showStats = true, showDodge = false) {
    const stats = [];
    if (showStats && action?.type !== "ability" && number(action?.speed) !== null) stats.push(["속도", action.speed]);
    if (showDodge && number(action?.dodgeSpeed) !== null) stats.push(["회피 속도", action.dodgeSpeed]);
    if (showStats && number(action?.damage) !== null && (action?.type !== "ability" || action.damage > 0)) stats.push(["피해", action.damage]);
    return stats.length ? `<div class="combat-stats">${stats.map(([label, value]) => `<span class="enemy-action-stats">${label} <b>${value}</b></span>`).join("")}</div>` : "";
  }
  function contextualAction(base, context = {}) {
    if (!base) return { action: base, modifiers: [] };
    const action = { ...(context.resolvedAction || base) }, modifiers = [];
    if (base.type === "ability" || number(base.speed) === null) return { action, modifiers };
    const atSlowTile = context.tileId === "tile-17", ignoresTile = context.ignoreTileSpeed === true || context.missionId === "shelter",
      penalty = atSlowTile && !ignoresTile ? 1 : 0, buff = context.buff || {},
      speed = number(buff.speed) || 0, damage = number(buff.damage) || 0,
      source = context.buffSource || "현재 공개된 능력";
    if (!context.resolvedAction) {
      action.speed = Math.max(0, base.speed + speed - penalty);
      if (number(base.damage) !== null) action.damage = base.damage + damage;
      if (buff.interrupt) action.interrupt = true;
    }
    if (penalty) modifiers.push(`${context.tileName || "현재 타일"} · 속도 -1`);
    else if (atSlowTile && ignoresTile) modifiers.push("현재 임무 적용 · 타일의 속도 감소 미적용");
    if (speed) modifiers.push(`${source} · 속도 ${speed > 0 ? "+" : ""}${speed}`);
    if (damage) modifiers.push(`${source} · 피해 ${damage > 0 ? "+" : ""}${damage}`);
    if (buff.interrupt) modifiers.push(`${source} · 방해 추가`);
    if (context.resolvedAction && number(action.speed) !== null && action.speed !== Math.max(0, base.speed + speed - penalty))
      modifiers.push("현재 공개된 전투 효과 · 속도 추가 변화");
    if (context.resolvedAction && number(base.damage) !== null && number(action.damage) !== null && action.damage !== base.damage + damage)
      modifiers.push("현재 공개된 전투 효과 · 피해 추가 변화");
    if (modifiers.length || base.speed !== action.speed || base.damage !== action.damage)
      modifiers.push([number(action.speed) !== null && `속도 ${base.speed} → ${action.speed}`,
        number(base.damage) !== null && number(action.damage) !== null && `피해 ${base.damage} → ${action.damage}`].filter(Boolean).join(" · "));
    return { action, modifiers };
  }
  function modifiersHTML(modifiers, clean) {
    return modifiers?.length ? `<div class="combat-applied-modifiers"><p>적 공격에 적용된 변화</p><ul>${modifiers.map(modifier => `<li>${esc(cleanText(modifier, clean))}</li>`).join("")}</ul></div>` : "";
  }
  function actionDetailsHTML(action, options = {}) {
    if (!action) return "";
    const { side = "enemy", showStats = true, showDodge = false, clean, removed = false, modifiers = [] } = options;
    return `<strong class="combat-action-name">${esc(cleanText(action.name || action.label || "능력", clean))}</strong>${statsHTML(action, showStats, showDodge)}${modifiersHTML(modifiers, clean)}${effectsHTML(action, side, clean, removed)}${rulesHTML(action, clean, removed)}`;
  }
  function combatHTML({ combat, enemyName = "적", phase, labels = {}, clean, enemyModifiers = [] } = {}) {
    if (!combat) return "";
    const player = combat.attack || combat.flame, flame = !combat.attack && !!combat.flame,
      immediate = phase === "boss_react" && combat.immediate,
      extra = phase === "combat_extra" && combat.extra;
    let action = combat.action, label = action ? labels[action.kind] || (action.type === "ability" ? "전용 능력" : "행동 공격") : "행동 공개 전";
    if (immediate) { action = { ...immediate, type: "ability", rules: combat.action?.rules || [] }; label = "전용 능력 대응"; }
    if (extra) { action = { ...extra, name: "다단 가르기 · 추가 타격", type: "ability", rules: ["첫 공격을 회피하거나 방해했더라도 추가 타격에는 별도로 대응합니다."] }; label = "추가 타격"; }
    const removed = !immediate && !extra && !!combat.removeEnemyAttackEffects;
    let order = "공개된 행동의 지시를 확인하세요.";
    if (extra) order = "첫 공격과 별개로 추가 타격에 대응하세요. 회피 속도 2가 필요합니다.";
    else if (immediate) order = "공개된 전용 능력에 대응하세요. 아래 회피 조건과 피해를 확인하세요.";
    else if (!action) order = "플레이어의 공격을 선택한 뒤 적 행동을 공개합니다.";
    else if (combat.cancelEnemy) order = "현재 적 공격이 취소되었습니다.";
    else if (combat.cancelHunter) order = "플레이어의 공격이 취소되었습니다. 공개된 적 행동을 처리합니다.";
    else if (combat.dodged) order = "현재 적 공격에 회피를 선택했습니다.";
    else if (player && action.type !== "ability" && number(player.speed) !== null && number(action.speed) !== null)
      order = player.speed > action.speed ? "플레이어의 공격이 먼저입니다." : player.speed < action.speed ? "적의 공격이 먼저입니다." :
        player.interrupt && player.interruptEqual ? "같은 속도 · 플레이어의 동속 방해 효과를 적용합니다." : "같은 속도 · 두 공격을 동시에 처리합니다.";
    const status = [number(combat.defense) > 0 && `플레이어 방어 ${combat.defense}`,
      combat.noDodge && "이번 전투 회피 불가", combat.cancelHunter && "플레이어 공격 취소됨",
      combat.dodged && (extra ? "첫 공격 회피 선택됨" : "회피 선택됨"), combat.cancelEnemy && (extra ? "첫 공격 취소됨" : "적 공격 취소됨"),
      (combat.attackResolved || combat.flameResolved) && "플레이어 공격 처리 완료",
      removed && "적 공격의 모든 부가 효과 제거됨",
      ...(Array.isArray(combat.immune) ? combat.immune.map(value => ({ interrupt: "방해 면역", stun: "기절 면역", poison: "독 면역", frenzy: "발광 면역" })[value]) : [])].filter(Boolean);
    return `<section class="combat-comparison" aria-label="현재 전투의 공격 비교"><p class="combat-opponent">${esc(cleanText(enemyName, clean))}와 전투</p><p class="combat-order" role="status">${esc(order)}</p><div class="combat-comparison-grid"><article class="combat-side combat-side-hunter"><h3>플레이어 · ${combat.attackResolved || combat.flameResolved ? "처리한 " : ""}${flame ? "화기 공격" : "장치무기 공격"}</h3>${player ? actionDetailsHTML({ ...player, type: "attack" }, { side: "hunter", clean }) : '<p class="combat-empty-action">선택한 공격 없음</p>'}${player?.weaponFace?.text ? `<p class="combat-weapon-effect"><b>사용한 무기의 고유 효과</b><span>${esc(cleanText(player.weaponFace.text, clean))}</span></p>` : ""}</article><article class="combat-side combat-side-enemy"><h3>적 · ${esc(label)}</h3>${action ? actionDetailsHTML(action, { clean, showDodge: !!immediate || !!extra, removed,
      modifiers: immediate || extra ? [] : enemyModifiers }) : '<p class="combat-empty-action">아직 행동을 공개하지 않았습니다.</p>'}</article></div>${status.length ? `<ul class="combat-current-status">${status.map(value => `<li>${esc(value)}</li>`).join("")}</ul>` : ""}</section>`;
  }
  function missionEffectsHTML(entries, clean) {
    return entries?.length ? `<section class="enemy-mission-effects" aria-label="임무로 변경된 적 능력"><h4>임무로 변경된 능력</h4>${entries.map(entry => `<p><strong>${esc(cleanText(entry.title || "현재 임무", clean))}</strong>${entry.description ? `<span>${esc(cleanText(entry.description, clean))}</span>` : ""}</p>${(entry.effects || []).map(effect => `<p>${esc(cleanText(effect, clean))}</p>`).join("")}`).join("")}</section>` : "";
  }
  return Object.freeze({ firearmRules, firearmNameHTML, effects, contextualAction, actionDetailsHTML, combatHTML, missionEffectsHTML });
});
