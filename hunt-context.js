(function (root) {
  "use strict";
  const local = typeof module !== "undefined" && module.exports;
  const E = local ? require("./hunt-engine.js") : root.BBHunt;
  const M = local ? require("./chapter-engine.js") : root.BBChapter;
  const missions = local ? require("./mission-engine.js") : root.BBMission;
  const directionNames = { N: "북쪽", E: "동쪽", S: "남쪽", W: "서쪽" };
  function enemyInsightTokens(state, enemy) {
    if (!enemy) return null;
    if (Number.isFinite(enemy.insightTokens)) return enemy.insightTokens;
    const target = state.mission?.targets?.[enemy.missionId];
    return target?.enemyId === enemy.id && Number.isFinite(target.tokens) ? target.tokens : null;
  }

  // Context is a public-state description, not a speculative reducer run.
  // In particular no card, tile, enemy-action or reward deck is examined here.
  function view(state, target, selection = {}) {
    const h = E.hunter(state), kind = target?.kind;
    const e = kind === "enemy" ? state.enemies.find(x => x.id === target.enemyId) : null;
    const nodeId = e?.node || target?.node, n = E.node(state, nodeId);
    if (!n || !["cell", "entrance", "enemy"].includes(kind) || kind === "enemy" && !e)
      return { kind: kind || "cell", title: "지도 대상", nodeId: null, enemyId: null,
        actions: [], hint: "현재 공개된 지도에서 대상을 선택하세요." };
    const chosen = h.hand.find(c => c.id === selection.cardId), def = chosen && E.card(chosen);
    const at = E.node(state, h.position), phase = state.phase;
    const locked = state.rewardChoices?.length ? "획득한 보상의 장착·보관 선택을 먼저 마치세요." :
      h.inDream || h.hp <= 0 ? "현재 지도에서 행동할 수 없습니다." : "";
    const actions = [], result = { kind, title: kind === "enemy" ?
      `${E.enemyDef(state, e).name} #${e.figure}` : kind === "entrance" ?
      `${directionNames[target.edge] || "지도"} 출입구` : n.name,
      nodeId, enemyId: e?.id || null, actions, hint: "",
      fog: missions.fogged(state, n.tile),
      brokenLamp: missions.fogged(state, n.tile) && n.icons.some(icon => icon.kind === "lamp") };
    const add = (id, label, cost, reason, command = null, sequence = null) => {
      const problem = locked || reason || "";
      actions.push({ id, label, cost, enabled: !problem, reason: problem, command,
        ...(sequence ? { sequence } : {}) });
    };
    const stepReason = (from, to) => {
      const a = E.node(state, from), b = E.node(state, to);
      if (!a || !b || !E.neighbors(state, from).includes(to)) return "인접한 칸으로만 이동할 수 있습니다.";
      if (!E.canLeave(state, from)) return "대교에서 적과 같은 칸을 벗어날 수 없습니다.";
      if (missions.fogged(state, a.tile) && a.tile !== b.tile) return "안개 진입로를 걸어서 벗어날 수 없습니다.";
      if (!missions.canEnter(state, from, to)) return "현재 공개된 임무에 의해 진입할 수 없는 칸입니다.";
      return "";
    };
    const movementCost = phase === "move" ? "이동력 1 · 추가 카드 없음" :
      `스탯 카드 1장 버림 · 이동력 1 사용 / 최대 ${def?.move || 2}칸`;
    const phaseReason = "현재 단계의 선택을 먼저 마치세요.";

    const escort = state.mission?.escort,
      escortObject = kind === "cell" && target.objectKind === "token" && target.objectId === "escort",
      escortHere = !!escort?.node && escort.node === h.position && !escort.carrierId && nodeId === h.position,
      showEscortChoice = kind === "cell" && escortHere && (escortObject || !target.objectKind);
    if (kind === "cell") {
      if (phase === "enemy_path") {
        add("enemy-step", "적을 이 칸으로 이동", "적 이동력 1 · 카드 없음",
          E.moveOptions(state).includes(nodeId) ? "" : "표시된 적 이동 경로에서 선택하세요.",
          { type: "ENEMY_STEP", node: nodeId });
      } else if (phase === "boss_move") {
        add("boss-step", "이 칸으로 이동", "공개된 효과에 따른 이동 · 카드 없음",
          E.bossMoveOptions(state).includes(nodeId) ? "" : "표시된 효과 이동 경로에서 선택하세요.",
          { type: "BOSS_STEP", node: nodeId });
      } else if (nodeId !== h.position) {
        const reason = !["hunter", "move"].includes(phase) ? phaseReason :
          stepReason(h.position, nodeId) || (phase === "hunter" && !chosen ? "하단 손패에서 버릴 스탯 카드 1장을 선택하세요." : "");
        add("move", "이 칸으로 이동", movementCost, reason,
          phase === "move" ? { type: "STEP", node: nodeId } : null,
          phase === "hunter" ? [{ type: "MOVE", cardId: chosen?.id || null }, { type: "STEP", node: nodeId }] : null);
      } else {
        result.hint = "사냥꾼이 있는 칸입니다.";
        if (phase === "move") add("stop-move", "여기서 이동 마치기", "추가 비용 없음", "", { type: "STOP_MOVE" });
        if (phase === "hunter") {
          const options = E.interactionOptions(state);
          const available = options.loot || options.heal || options.teleport || options.workshop ||
            options.provisionalNpc || options.missionRescue;
          if (available && !escortObject) {
            add("interact", "이 칸에서 상호작용", "스탯 카드 1장 버림",
              !chosen ? "하단 손패에서 버릴 스탯 카드 1장을 선택하세요." :
                options.workshop && !h.consumables.length && !options.loot && !options.heal && !options.teleport &&
                !options.provisionalNpc && !options.missionRescue ? "교환할 보유 소모품이 없습니다." : "");
            result.hint = "같은 칸의 대상을 함께 선택할 수 있습니다. 적이 있으면 적의 행동을 먼저 처리합니다.";
          }
        }
      }
    } else if (kind === "entrance") {
      const exit = M.openExits(state.world).find(x => x.node === nodeId && x.edge === target.edge);
      const source = state.world.tiles.find(t => t.tileId === n.tile), vector = M.vectors[target.edge];
      const destination = source && vector && state.world.tiles.find(t =>
        t.x === source.x + vector[0] && t.y === source.y + vector[1]);
      const linked = destination && E.neighbors(state, nodeId).find(id => E.node(state, id).tile === destination.tileId);
      const moveTo = nodeId !== h.position ? nodeId : !exit && linked ? linked : null;
      if (moveTo) {
        const reason = !["hunter", "move"].includes(phase) ? phaseReason :
          stepReason(h.position, moveTo) || (phase === "hunter" && !chosen ? "하단 손패에서 버릴 스탯 카드 1장을 선택하세요." : "");
        add("move", nodeId !== h.position ? "출입구 칸으로 이동" : "출입구를 지나 이동", movementCost, reason,
          phase === "move" ? { type: "STEP", node: moveTo } : null,
          phase === "hunter" ? [{ type: "MOVE", cardId: chosen?.id || null }, { type: "STEP", node: moveTo }] : null);
        result.hint = nodeId !== h.position ? "출입구가 있는 칸에서 다음 행동을 선택합니다." : "이미 공개된 연결 칸으로 이동합니다.";
        return result;
      }
      const reason = !["hunter", "move"].includes(phase) ? phaseReason :
        !exit ? "이 출입구는 이미 연결되었거나 열려 있지 않습니다." :
        nodeId !== h.position ? "출입구가 있는 칸으로 먼저 이동하세요." :
        !E.canLeave(state, h.position) ? "대교에서 적과 같은 칸을 벗어날 수 없습니다." :
        missions.fogged(state, at?.tile) ? "안개 진입로를 탐험으로 벗어날 수 없습니다." :
        !state.world.tileDeck.length ? "남은 타일이 없습니다." :
        phase === "hunter" && !chosen ? "하단 손패에서 버릴 스탯 카드 1장을 선택하세요." : "";
      add("explore", "이 출입구로 탐험", movementCost, reason,
        phase === "move" ? { type: "EXPLORE", edge: target.edge } : null,
        phase === "hunter" ? [{ type: "MOVE", cardId: chosen?.id || null }, { type: "EXPLORE", edge: target.edge }] : null);
      result.hint = "탐험을 실행하면 새 타일이 공개됩니다. 회전과 배치는 직접 선택합니다.";
    } else {
      const distance = h.inDream ? null : E.distance(state, h.position, nodeId), insight = enemyInsightTokens(state, e);
      result.hint = `체력 ${e.hp} / ${E.enemyDef(state, e).maxHp}${distance !== null && Number.isFinite(distance) ? ` · ${distance}칸 거리` : ""}${insight !== null ? ` · 계몽 토큰 ${insight}개` : ""}`;
      if (["hunter", "combat_choose"].includes(phase)) {
        const counter = phase === "combat_choose", slots = E.slots(state), slot = selection.slot;
        const pulls = selection.pullIds || [], candidates = new Set(E.pullCandidates(state).map(x => x.id));
        const validPulls = Array.isArray(pulls) && new Set(pulls).size === pulls.length && pulls.every(id => candidates.has(id));
        const pulled = validPulls && pulls.includes(e.id), same = e.node === h.position || pulled;
        const commonReason = counter && state.combat?.enemyId !== e.id ? "현재 조우한 적에게 대응하세요." :
          !chosen ? "하단 손패에서 공격에 놓을 스탯 카드 1장을 선택하세요." :
          !Number.isInteger(slot) || !slots[slot] || h.slots[slot] ? "하단 무기에서 빈 공격 슬롯을 선택하세요." :
          !validPulls ? "현재 무기로 끌어올 수 있는 적을 선택하세요." : "";
        const cost = `스탯 카드 1장 배치 · 빈 공격 슬롯${Number.isInteger(slot) && slots[slot] ? ` ${slot + 1}번` : " 1개"}`;
        const base = { type: counter ? "COUNTER" : "ATTACK", enemyId: e.id, cardId: chosen?.id || null, slot };
        const pullsBlockLeap = at?.tile === "tile-18" && validPulls && pulls.length > 0;
        const paths = !counter && !same && def?.leap && !selection.replaceCardEffects && !pullsBlockLeap ?
          E.leapPaths(state, e.node).filter(path => path.length > 1 && path.slice(1).every((to, i) => !stepReason(path[i], to))) : [];
        if (paths.length) paths.forEach((route, i) => add(`leap-${i}`, "도약 공격 · " + route.slice(1).map(id => E.node(state, id).name).join(" → "),
          cost + ` · 도약 ${route.length - 1}칸`, commonReason, { ...base, leapPath: route }));
        else add("attack", counter ? "이 적에게 맞서 공격" : "이 적 공격", cost,
          commonReason || (!same ? pullsBlockLeap ? "대교에 적을 끌어오면 그 칸에서 도약으로 벗어날 수 없습니다." :
            "같은 칸으로 이동하거나 끌어오기·도약을 선택해야 공격할 수 있습니다." : ""), base);
      }
      const gun = E.firearm(state), attack = gun.actual && gun.trigger === "hunter-turn",
        effect = gun.actual && gun.trigger === "hunter-effect";
      const firearmPhase = attack ? ["hunter", "combat_choose"].includes(phase) :
        effect ? phase === "hunter" : phase === "combat_react";
      if (gun.trigger !== "enemy-enters" && firearmPhase) {
        const replacement = (selection.rewardIds || []).some(id => h.rewards?.some(r => r.id === id && r.kind === "rune-clawmark"));
        const reason = !h.firearmReady ? "화기가 소진되어 있습니다." :
          replacement && attack ? "손톱자국은 스탯 카드 공격에만 사용할 수 있습니다." :
          !E.canFirearm(state) ? "현재 공개된 상황에서는 이 화기를 사용할 수 없습니다." :
          attack && phase === "combat_choose" && state.combat?.enemyId !== e.id ||
          !attack && !effect && state.combat?.enemyId !== e.id ? "현재 조우한 적에게 대응하세요." :
          (attack || effect) && e.node !== h.position ? "같은 칸의 적을 선택하세요." :
          effect && E.enemyDef(state, e).boss ? "보스가 아닌 적을 선택하세요." : "";
        add("firearm", `${gun.name} 사용`, "화기 소진 · 스탯 카드 비용 없음", reason,
          attack || effect ? { type: "FIREARM", enemyId: e.id } : { type: "FIREARM" });
      }
      if (phase === "activation") add("activate", "이 적 활성화", "가장 가까운 적부터 · 카드 없음",
        E.eligible(state).some(x => x.id === e.id) ? "" : "가장 가까운 활성화 대상부터 선택하세요.",
        { type: "ACTIVATE", enemyId: e.id });
      if (phase === "interaction_order") add("interaction-enemy", "이 적의 반격 먼저 처리", "추가 비용 없음",
        E.interactionEnemies(state).some(x => x.id === e.id) ? "" : "같은 칸의 상호작용 반격 대상을 선택하세요.",
        { type: "INTERACTION_ENEMY", enemyId: e.id });
      if (!actions.length) result.hint += " · 현재 단계의 선택은 행동 패널에서 진행하세요.";
    }
    if (escortObject) {
      if (escort?.carrierId === state.activeHunterId && nodeId === h.position)
        result.hint = "생존자를 데리고 이동 중입니다. 순간이동하거나 사냥꾼의 꿈에 입장하면 원래 칸으로 돌아갑니다.";
      else if (escort?.node === nodeId && nodeId !== h.position)
        result.hint = "생존자가 있는 칸으로 이동한 뒤, 그 칸에서 나갈 때 동행 여부를 확인합니다. 추가 비용은 없습니다.";
      else if (escortHere)
        result.hint = "이 칸에서 이동해 나갈 때 생존자와 동행할지 확인합니다. 이동에 쓰는 손패 외에 추가 비용은 없습니다.";
      result.hint += " 별도 상호작용은 필요하지 않습니다.";
    } else if (showEscortChoice) {
      result.hint += (result.hint ? " " : "") + "이 칸에서 나갈 때 생존자와 동행할지 확인합니다. 추가 비용은 없습니다.";
    }
    return result;
  }

  const api = { view, enemyInsightTokens };
  if (local) module.exports = api;
  else root.BBHuntContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this);


