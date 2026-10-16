(function (root) {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  function intent(E, state, command) {
    if (command.type === "DREAM") return { kind: "dream", name: "꿈 입장" };
    if (command.type === "INTERACT" && command.lamp) return { kind: "teleport", name: "중앙 등불 순간이동" };
    if (command.type === "USE_REWARD" && (E.hunter(state)?.rewards || [])
      .some(reward => reward.id === command.rewardId && reward.kind === "lantern"))
      return { kind: "teleport", name: "휴대용 등불 순간이동" };
    if (command.type === "USE_CONSUMABLE" && (E.hunter(state)?.consumables || [])
      .some(item => item.id === command.itemId && item.kind === "bold-mark"))
      return { kind: "teleport", name: "사냥꾼이라는 뚜렷한 증거 순간이동" };
    return null;
  }
  function companionLosses(E, state, command) {
    const h = E.hunter(state), view = E.missionView?.(state), mission = state.mission;
    if (!h || h.inDream || !h.position || !view || !mission) return [];
    const losses = [], owner = state.activeHunterId,
      owned = (view.tokens || []).filter(token => token.carrierId === owner),
      held = (view.counters || []).find(counter => counter.id === "survivors-held")?.value || 0,
      revealed = new Set(view.revealed || []);
    if (owned.some(token => token.id === "escort")) {
      const house = view.chapter === 1, destinationNode = mission.escort?.home || "tile-11:house",
        name = house ? "민가의 호위 생존자" : "대교의 호위 생존자",
        destination = house ? "민가 칸" : "대교의 생존자 출현 칸";
      losses.push({ id: "escort", name, count: 1, effect: "return", destinationNode,
        ruleCard: house ? 8 : 37,
        description: `${name} 1명은 ${destination}으로 돌아갑니다. 다시 그 칸에서 데리고 나와야 합니다.`,
        summary: `${house ? "민가" : "대교"} 생존자 원위치 복귀` });
    } else if ((view.tokens || []).some(token => token.id === "escort" && !token.carrierId && token.node === h.position) &&
      (command.type === "DREAM" || (command.lamp || command.node) !== h.position)) {
      // Free escort pickup belongs to walking departure, not teleportation.
      // An uncarried token stays put; do not describe it as lost or returned.
      const house = view.chapter === 1, name = house ? "민가의 호위 생존자" : "대교의 호위 생존자",
        travel = command.type === "DREAM" ? "꿈에 함께 들어가지 않고" : "함께 순간이동하지 않고";
      losses.push({ id: "escort", name, count: 1, effect: "stay", destinationNode: h.position,
        ruleCard: house ? 8 : 37,
        description: `${name} 1명은 ${travel} 현재 칸에 남습니다. 동행하려면 생존자가 있는 칸에서 걸어서 이동해 나가야 합니다.`,
        summary: "생존자 함께 이동 불가 · 현재 칸에 남음" });
    }
    if (view.chapter > 1 && Number.isInteger(held) && held > 0) {
      const ruleCard = [52, 27, 33].find(card => revealed.has(card) && !(view.discarded || []).includes(card));
      losses.push({ id: "survivors-held", name: "구조한 생존자 토큰", count: held, effect: "discard", destinationNode: null,
        ...(ruleCard ? { ruleCard } : {}),
        description: `보유 중인 구조한 생존자 토큰 ${held}개를 모두 잃습니다. 목적지의 피신처에 인도되지 않습니다.`,
        summary: `생존자 ${held}명 상실` });
    }
    if (view.chapter > 1 && revealed.has(49) && owned.some(token => token.id === "rescue")) {
      losses.push({ id: "rescue", name: "붙잡은 실험 생존자", count: 1, effect: "drop", destinationNode: h.position,
        ruleCard: 49, description: "붙잡은 실험 생존자 1명은 지금 사냥꾼이 있는 칸에 떨어집니다. 다시 그 칸에서 상호작용해 붙잡아야 합니다.",
        summary: "실험 생존자 현재 칸에 남김" });
    }
    if (view.chapter > 1 && revealed.has(57) && mission.npc?.follow && mission.npc.node === h.position) {
      losses.push({ id: "salvation-npc", name: "함께 이동하던 구원 NPC", count: 1, effect: "stay", destinationNode: h.position,
        ruleCard: 57, description: "함께 이동하던 구원 NPC는 현재 칸에 남고, 동행 선택이 해제됩니다. NPC 토큰이 제거되는 것은 아닙니다.",
        summary: "구원 NPC 현재 칸에 남김" });
    }
    return losses;
  }
  function plan(E, state, commands) {
    if (!E || typeof E.dispatch !== "function" || typeof E.hunter !== "function" ||
      !state || !Array.isArray(commands) || !commands.length) return null;
    try {
      const requested = copy(commands), losses = [], actionNames = [];
      if (!requested.some(command => command && ["DREAM", "INTERACT", "USE_REWARD", "USE_CONSUMABLE"].includes(command.type))) return null;
      if (requested.length === 1 && (!intent(E, state, requested[0]) || !companionLosses(E, state, requested[0]).length)) return null;
      let preview = copy(state);
      for (let index = 0; index < requested.length; index++) {
        const command = requested[index], action = intent(E, preview, command),
          candidates = action ? companionLosses(E, preview, command) : [];
        // The reducer validates the whole requested batch on disposable copies.
        // No preview state, drawn card or random outcome is exposed or committed.
        preview = E.dispatch(preview, copy(command));
        if (action && candidates.length) {
          losses.push(...candidates.map(loss => ({ ...loss, commandIndex: index })));
          if (!actionNames.includes(action.name)) actionNames.push(action.name);
        }
      }
      if (!losses.length) return null;
      return { title: "생존자·동행자 이동 결과 확인",
        description: `${actionNames.join(" · ")}이 실행되면 다음과 같이 처리됩니다. 계속하시겠습니까?`,
        losses, summary: losses.map(loss => loss.summary).join(" · "),
        commands: copy(requested), sourceRevision: state.revision };
    } catch (_) {
      // Invalid actions retain the normal command-handler error. They neither
      // spend a cost nor produce a misleading confirmation request.
      return null;
    }
  }
  function preview(E, state, command) {
    // A public button hint deliberately does not validate costs or a target.
    // Its badge can be shown before the player selects the cost card. Only
    // plan() may authorize displaying the actionable confirmation dialog.
    if (!E || typeof E.hunter !== "function" || !state || !command || typeof command !== "object") return null;
    try {
      const action = intent(E, state, command), losses = action && companionLosses(E, state, command);
      if (!losses?.length) return null;
      return { title: "생존자·동행자 이동 결과 주의",
        description: `${action.name}이 실행되면 다음과 같이 처리됩니다.`,
        losses, summary: losses.map(loss => loss.summary).join(" · "), sourceRevision: state.revision };
    } catch (_) { return null; }
  }
  const api = Object.freeze({ plan, preview });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BBHuntActionLoss = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
