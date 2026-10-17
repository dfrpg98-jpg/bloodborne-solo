(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports
    ? require("./hunt-enemy-mission-effects") : root.BBEnemyMissionEffects);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntMissionFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (enemyEffects) {
  "use strict";
  // Presentation only. A caller observes accepted command transitions; this
  // module never dispatches, reads storage, changes a save, or replays history.
  // Stage numbers identify the same public objective across its successive
  // instructions. Reward and special-rule revelations are not new missions.
  const stages = Object.freeze({
    main: [1, 2, 18, 19, 20, 21, 40], mob: [5], shelter: [8, 9],
    rescue: [12, 13, 14], "card-24": [24, 25], "card-51": [51],
    "card-27": [27], "card-52": [52], "card-30": [30], "card-33": [33],
    bridge: [35, 37], truth: [46, 47, 49], "card-54": [54],
    "card-57": [57], "card-59": [59]
  });
  const outcomes = Object.freeze({
    4: ["main", "중앙 등불의 재앙의 야수 우두머리를 처치했습니다."],
    7: ["mob", "마당 등불의 야수 사냥 무리를 처치했습니다."],
    11: ["shelter", "오에돈 예배당의 재앙의 야수를 처치했습니다."],
    15: ["rescue", "구조한 여자를 공격하는 선택을 마쳤습니다."],
    16: ["rescue", "구조한 여자에게 도망치라고 말했습니다."],
    23: ["main", "성직자 야수를 오에돈의 지하묘지로 유인했습니다."],
    26: [["card-51", "card-24"], "진료소의 재앙의 야수를 처치했습니다."],
    28: [["card-52", "card-27"], "필요한 생존자들을 이오세프카의 진료소로 인도했습니다."],
    32: ["card-30", "오에돈 예배당의 여성 야수 환자를 처치했습니다."],
    34: ["card-33", "필요한 생존자들을 오에돈 예배당으로 인도했습니다."],
    38: ["bridge", "대교의 생존자를 이오세프카의 진료소로 호위했습니다."],
    39: ["bridge", "대교의 생존자를 오에돈 예배당으로 호위했습니다."],
    44: ["main", "성직자 야수를 최종 처치했습니다."],
    48: ["truth", "진료소의 이오세프카를 처치했습니다."],
    50: ["truth", "붙잡은 실험 생존자를 이오세프카의 진료소로 호위했습니다."],
    55: ["card-54", "무리를 정리하는 임무를 완수했습니다."],
    58: ["card-57", "구원 임무를 완수했습니다."],
    60: ["card-59", "생존자를 위한 소모품 기부를 마쳤습니다."]
  });
  const finished = objective => ["완료", "complete", "completed", "done"].includes(objective?.status);
  const list = value => Array.isArray(value) ? value : [];
  const signature = (objective, state) => JSON.stringify([
    objective.title, objective.description, objective.status,
    (stages[objective.id] || []).filter(number => list(state.mission?.revealed).includes(number))
  ]);
  function describe(previous, next, options = {}) {
    const { E, publicText, data } = options;
    if (!next?.mission || !E?.missionView || !publicText?.chapter) return [];
    const nextView = E.missionView(next), current = publicText.chapter(next, nextView, data);
    if (!current) return [];
    const chapter = current.chapter, sameChapter = previous?.mission?.chapter === chapter;
    const previousView = sameChapter ? E.missionView(previous) : null;
    const prior = sameChapter ? publicText.chapter(previous, previousView, data) : null;
    const oldObjectives = new Map(list(prior?.objectives).map(objective => [objective.id, objective]));
    const newObjectives = new Map(list(current.objectives).map(objective => [objective.id, objective]));
    const events = [], completedIds = new Set();
    function add(kind, objective, title, description, discriminator = "") {
      events.push({ key: `${chapter}:${kind}:${objective.id}:${discriminator || signature(objective, next)}`,
        kind, title, description, objectiveId: objective.id, chapter });
    }
    // Never infer completions from a historical save or another chapter. Import
    // and reload callers do not invoke this observer; null means a new hunt.
    if (sameChapter) {
      const oldCompleted = new Set(list(previous.mission.completed));
      for (const number of list(next.mission.completed).filter(number => !oldCompleted.has(number))) {
        const outcome = outcomes[number];
        if (!outcome) continue;
        const ids = Array.isArray(outcome[0]) ? outcome[0] : [outcome[0]];
        const id = ids.find(id => newObjectives.has(id) || oldObjectives.has(id));
        const objective = newObjectives.get(id) || oldObjectives.get(id);
        const entry = publicText.entry?.({ number }, next, { data });
        if (!objective || !entry || completedIds.has(id)) continue;
        completedIds.add(id);
        add("completed", objective, entry.title || objective.title, outcome[1], String(number));
      }
      for (const objective of list(current.objectives)) {
        const old = oldObjectives.get(objective.id);
        if (finished(objective) && !finished(old) && !completedIds.has(objective.id)) {
          completedIds.add(objective.id);
          add("completed", objective, objective.title, `${objective.title} 임무를 완수했습니다.`);
        }
      }
    }
    for (const objective of list(current.objectives)) {
      if (completedIds.has(objective.id) || finished(objective)) continue;
      const old = oldObjectives.get(objective.id);
      if (!old) add("new", objective, objective.title, objective.description);
      else if (signature(old, previous) !== signature(objective, next))
        add("updated", objective, objective.title, objective.description);
    }
    if (sameChapter && nextView?.won && !previousView?.won) {
      const objective = newObjectives.get("main") || { id: "main" };
      add("chapter", objective, `챕터 ${chapter} 완수`,
        next.result === "campaign-win" ? "기나긴 사냥의 모든 챕터를 완수했습니다." : `챕터 ${chapter}의 사냥을 완수했습니다.`, "won");
    }
    if (sameChapter && enemyEffects) {
      const priorEffects = new Map(enemyEffects.describe(previous, E).map(change => [change.enemyId, change]));
      for (const change of enemyEffects.describe(next, E)) {
        if (priorEffects.get(change.enemyId)?.signature === change.signature) continue;
        const existing = events.find(event => event.objectiveId === change.objectiveId);
        const effects = [change.description, ...change.effects];
        const enemyChange = { enemyId: change.enemyId, title: change.title, description: change.description, effects: [...change.effects] };
        if (existing) {
          existing.effects = [...(existing.effects || []), ...effects];
          existing.enemyChanges = [...(existing.enemyChanges || []), enemyChange];
        }
        else events.push({ key: `${chapter}:enemy-effect:${change.enemyId}:${change.signature}`,
          kind: "enemy-effect", title: change.title, description: change.description,
          objectiveId: change.objectiveId, chapter, effects: change.effects, enemyChanges: [enemyChange] });
      }
    }
    // Effects are actual state deltas, attached once even when one command
    // completes several missions. No future reward or unopened branch is read.
    if (sameChapter && events.length) {
      const effects = [], gained = (nextView?.insight || 0) - (previousView?.insight || 0);
      if (gained > 0) effects.push(`이번 챕터 계몽 +${gained} · 현재 ${nextView.insight}개`);
      for (const tile of list(previousView?.fog).filter(tile => !list(nextView?.fog).includes(tile))) {
        const name = data?.tiles?.find(definition => definition.id === tile)?.name;
        if (name) effects.push(`${name}의 안개가 걷혔습니다.`);
      }
      if (effects.length) {
        const event = events.find(event => event.kind === "completed") || events[0];
        event.effects = [...(event.effects || []), ...effects];
      }
    }
    return events;
  }
  function chapterProgress(state, options = {}) {
    if (!state?.mission?.won) return null;
    const chapter = state.mission.chapter, final = chapter === 3,
      rewards = options.E?.rewardsView?.(state),
      pendingRewards = Array.isArray(rewards?.choices) ? rewards.choices.length : list(state.rewardChoices).length,
      growthDone = ["over", "between_chapters"].includes(state.phase) || ["chapter-win", "campaign-win"].includes(state.result),
      current = pendingRewards ? "rewards" : growthDone ? final ? "archive" : "next" : "growth";
    const steps = [
      { id: "rewards", label: "보상 선택", status: pendingRewards ? "current" : "done",
        description: pendingRewards ? `대기 중 보상 ${pendingRewards}개를 선택하세요.` : "대기 중인 보상 선택을 마쳤습니다." },
      { id: "growth", label: "마지막 꿈에서 성장", status: growthDone ? "done" : pendingRewards ? "pending" : "current",
        description: growthDone ? "마지막 꿈의 선택을 마쳤습니다." : "남은 후속 선택을 마친 뒤 마지막 꿈에서 피의 유지로 성장하세요." },
      { id: final ? "archive" : "next", label: final ? "캠페인 기록 보관" : `챕터 ${chapter + 1} 준비`,
        status: !pendingRewards && growthDone ? "current" : "pending",
        description: final ? "완료한 캠페인을 저장 파일로 내보내세요." : "마지막 꿈을 마친 뒤 장비와 시작 칸을 골라 다음 챕터를 준비하세요." }
    ];
    return { chapter, final, current, pendingRewards, growthDone, steps,
      summary: pendingRewards ? "보상 선택 → 마지막 꿈에서 성장 → " + steps[2].label
        : growthDone ? final ? "마지막 꿈까지 마쳤습니다. 완료한 캠페인을 보관하세요." : `마지막 꿈까지 마쳤습니다. 챕터 ${chapter + 1} 시작을 준비하세요.`
          : "마지막 꿈의 성장을 마친 뒤 " + (final ? "완료한 캠페인을 보관하세요." : `챕터 ${chapter + 1} 시작을 준비하세요.`),
      continueLabel: pendingRewards ? "보상 선택으로" : growthDone ? "완료 결과 확인" : "마지막 꿈의 선택 계속" };
  }
  function notice(updates, state, options = {}) {
    const batch = list(updates);
    if (!batch.length) return null;
    // Completion outranks both the simultaneous completed objective and any
    // other changes in the accepted batch. Acknowledging remains UI-only.
    const chapter = batch.find(event => event.kind === "chapter"),
      progress = chapterProgress(state, options),
      onlyEnemy = batch.every(event => event.kind === "enemy-effect"),
      completed = batch.every(event => ["completed", "chapter"].includes(event.kind));
    if (chapter) return { kind: "chapter", eyebrow: "사냥 완수", title: chapter.title,
      summary: progress?.summary || "챕터의 사냥을 완수했습니다. 남은 보상과 마지막 꿈의 선택을 확인하세요.",
      continueLabel: progress?.continueLabel || "완료 결과 확인", progress,
      events: [chapter, ...batch.filter(event => event !== chapter)] };
    const labels = { new: "새로운 임무", updated: "목표 변경", completed: "임무 완수", "enemy-effect": "적 능력 변화" };
    return { kind: onlyEnemy ? "enemy-effect" : completed ? "completed" : "new",
      eyebrow: onlyEnemy ? "적 능력 변화" : "사냥의 변화",
      title: onlyEnemy ? "적 능력 변화" : batch.length === 1 ? labels[batch[0].kind] || "임무 변화" : "임무가 변경되었습니다",
      summary: options.E?.rewardsView?.(state)?.choices?.length
        ? "임무 결과를 확인한 뒤, 행동 패널에서 획득한 보상을 선택하세요."
        : onlyEnemy ? "바뀐 공격과 효과를 확인한 뒤 사냥을 계속하세요." : "변경된 목표와 결과를 확인한 뒤 사냥을 계속하세요.",
      continueLabel: "확인하고 계속하기", progress: null, events: batch };
  }
  function reconcileTileSpeedAdoption(updates, previous, next, options = {}) {
    // Adoption is recorded after the accepted gameplay batch. Reconcile only
    // obsolete effect strings already disclosed by that batch; do not describe
    // its intermediate mission stages using a later gameplay state.
    if (!updates?.length || previous?.tileSpeedRuling === next?.tileSpeedRuling ||
        next?.tileSpeedRuling !== "all-attacks" || !enemyEffects || !options.E) return updates;
    const current = new Map(enemyEffects.describe(next, options.E).map(change => [change.enemyId, change]));
    const changes = enemyEffects.describe(previous, options.E).flatMap(prior => {
      const following = current.get(prior.enemyId);
      if (!following || prior.objectiveId !== following.objectiveId || prior.card !== following.card ||
          prior.description !== following.description) return [];
      const removed = prior.effects.filter(effect => !following.effects.includes(effect));
      return removed.length ? [{ prior, removed }] : [];
    });
    return updates.map(update => {
      const obsolete = new Set(changes.filter(({ prior }) => update.objectiveId === prior.objectiveId &&
        (update.description === prior.description || update.effects?.includes(prior.description)))
        .flatMap(change => change.removed));
      if (!update.effects?.some(effect => obsolete.has(effect))) return update;
      return { ...update, effects: update.effects.filter(effect => !obsolete.has(effect)),
        ...(update.enemyChanges ? { enemyChanges: update.enemyChanges.map(change => ({ ...change,
          effects: change.effects.filter(effect => !obsolete.has(effect)) })) } : {}) };
    });
  }
  return Object.freeze({ describe, chapterProgress, notice, reconcileTileSpeedAdoption });
});
