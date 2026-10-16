(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntDeathFeedback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const deathLine = "처치당했습니다. 모든 피의 유지를 잃고 꿈에 입장합니다.";
  // Only public health, end-state flags and journal entries cross this boundary.
  // The engine may recover health within the same command as lethal damage;
  // a net-health comparison therefore cannot establish a death or its cause.
  function snapshot(state) {
    if (!state) return null;
    const h = state.hunters?.[state.activeHunterId] || state.hunter;
    return {
      revision: state.revision,
      initialSeed: state.initialSeed,
      hunterId: state.activeHunterId || state.hunterId,
      hunter: h ? { hp: h.hp, inDream: h.inDream } : null,
      phase: state.phase,
      result: state.result,
      events: (state.events || []).filter(event => event && typeof event.text === "string")
        .map(event => ({ round: event.round, text: event.text })),
    };
  }
  function newEvents(before, after) {
    const a = before.events, b = after.events;
    // The journal rolls at 180 entries. Tail/prefix overlap also distinguishes
    // another occurrence of an identical attack from its earlier public log.
    for (let overlap = Math.min(a.length, b.length); overlap >= 0; overlap--) {
      if (a.slice(a.length - overlap).every((event, i) =>
        event.round === b[i].round && event.text === b[i].text)) return b.slice(overlap);
    }
    return [];
  }
  function healthEntry(text) {
    let match = text.match(/^(.+?) · 사냥꾼에게 (\d+) 피해\.$/);
    if (match) return { source: match[1], amount: Number(match[2]), kind: "damage" };
    match = text.match(/^기절 · 버릴 카드가 없어 피해 (\d+)\.$/);
    if (match) return { source: "기절 · 버릴 손패 없음", amount: Number(match[1]), kind: "damage" };
    match = text.match(/^차례 종료 · 독 피해 (\d+)\.$/);
    if (match) return { source: "독 · 플레이어 차례 종료", amount: Number(match[1]), kind: "damage" };
    match = text.match(/^이오셰프카의 진료소 · 피해 (\d+), 카드 \d+장\.$/);
    if (match) return { source: "이오셰프카의 진료소", amount: Number(match[1]), kind: "damage" };
    match = text.match(/^(.+?) · 추가 공격 효과를 위해 피해 (\d+)\.$/);
    if (match) return { source: `${match[1]} 추가 공격 효과`, amount: Number(match[2]), kind: "health-cost" };
    match = text.match(/^(.+?) · 체력 (\d+)을 지불했습니다\.$/);
    if (match) return { source: `${match[1]} 추가 공격 효과`, amount: Number(match[2]), kind: "health-cost" };
    return null;
  }
  function describe(previous, following) {
    const before = snapshot(previous), after = snapshot(following);
    if (!before?.hunter || !after?.hunter || !Number.isFinite(before.revision) ||
      !Number.isFinite(after.revision) || after.revision <= before.revision ||
      before.initialSeed !== after.initialSeed || before.hunterId !== after.hunterId ||
      before.hunter.inDream || !after.hunter.inDream) return null;
    const events = newEvents(before, after), deathIndex = events.findIndex(event => event.text === deathLine);
    // Voluntary Dream visits, chapter completion and prevented lethal damage
    // never produce this authoritative engine log. Loading a save does not
    // constitute a new command and must not replay an old death notice.
    if (deathIndex < 0) return null;
    const entries = events.slice(0, deathIndex).map(event => healthEntry(event.text))
      .filter(entry => entry && entry.amount > 0), fatal = entries[entries.length - 1];
    const damageTotal = entries.filter(entry => entry.kind === "damage").reduce((sum, entry) => sum + entry.amount, 0),
      healthCostTotal = entries.filter(entry => entry.kind === "health-cost").reduce((sum, entry) => sum + entry.amount, 0);
    // A lethal command may finish Dream recovery and end the final round in
    // one dispatch. Restored HP/inDream do not imply that play can continue.
    const terminal = after.phase === "over";
    return {
      terminal,
      title: terminal ? "사냥꾼 사망 · 사냥 종료" : "사냥꾼이 사망했습니다",
      cause: fatal?.source || "체력이 0이 되었습니다",
      fatalAmount: fatal?.amount ?? null,
      fatalKind: fatal?.kind || null,
      hpBefore: Number.isFinite(before.hunter.hp) ? before.hunter.hp : null,
      // Damage amounts are the engine's public, defense-adjusted values. They
      // can exceed remaining HP; never mislabel them as a net-health delta.
      damageTotal, healthCostTotal, entries,
      summary: fatal ? `${fatal.source} · ${fatal.kind === "health-cost" ? "체력 지불" : "피해"} ${fatal.amount}` : "이번 처리에서 체력이 0이 되어 사망했습니다.",
      consequence: terminal ? "이번 사냥이 종료되었습니다. 사냥 종료 화면에서 결과를 확인하세요." :
        "체력이 0이 되어 사냥꾼의 꿈에 들어왔습니다.",
      continueLabel: terminal ? "사냥 종료 결과 확인" : "확인하고 꿈에서 계속",
      footnote: terminal ? "받은 피해와 사냥 종료는 이미 처리되었습니다. 확인에는 행동 비용이 들지 않습니다." :
        "받은 피해와 꿈 이동은 이미 처리되었습니다. 확인에는 행동 비용이 들지 않습니다.",
    };
  }
  return { snapshot, describe };
});
