(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.BBEnemyActionHistory = factory;
})(typeof window !== "undefined" ? window : globalThis, function (options) {
  "use strict";
  const { E, labels } = options;
  // Rebuild this deck's public observations from accepted commands. Neither future draws
  // nor presentation fields are added to the verified rules/save state.
  let records = [], replayComplete = true;
  const kinds = Object.fromEntries(Object.entries(labels).map(([kind, label]) => [label, kind]));
  const same = (a, b) => a?.round === b?.round && a?.text === b?.text;
  function publicAction(event, chapter) {
    const match = /^(.+?) ([\w-]+면|\d+단계) · (기본 공격|특수 공격|전용 능력): (.+)\.$/.exec(event.text || "");
    if (!match || !kinds[match[3]]) return null;
    // Temporary patients/NPCs reveal the shared deck using a stage label.
    // The publicly named temporary Cleric is a boss: its stage-labelled
    // actions must not be mistaken for shared reveals, even if kinds match.
    if (match[2].endsWith("단계") && ["성직자 야수", "성직자 야수 · 임시"].includes(match[1].trim())) return null;
    return { chapter: chapter || null, round: event.round,
      kind: kinds[match[3]], enemy: match[1], action: match[4] };
  }
  function matchesDiscard(source) {
    const discard = source.enemyDiscard || [];
    return records.length === discard.length && records.every((record, i) => record.kind === discard[i]);
  }
  function knownDiscard(source) {
    // The kinds/order are already public. Never invent a name or round when
    // an old or incomplete log cannot substantiate that draw's details.
    replayComplete = false;
    records = (source.enemyDiscard || []).map((kind, index) => ({ order: index + 1,
      chapter: source.mission?.chapter || null, round: null, kind, enemy: "", action: "" }));
  }
  function appended(before, after) {
    const a = before.events || [], b = after.events || [];
    for (let n = Math.min(a.length, b.length); n > 0; n--) {
      if (a.slice(-n).every((event, i) => same(event, b[i]))) return b.slice(n);
    }
    return b;
  }
  function observe(before, after) {
    if (before.mission?.chapter !== after.mission?.chapter) { records = []; replayComplete = true; }
    let remaining = before.enemyDeck?.length ?? 6;
    for (const event of appended(before, after)) {
      // The engine logs this only after the shared action has been revealed.
      // Boss phase logs use "페이즈" and cannot match this shared-deck record.
      const record = publicAction(event, after.mission?.chapter);
      if (!record) continue;
      if (!remaining) { remaining = 6; records = []; replayComplete = true; }
      remaining--;
      records.push({ order: records.length + 1, ...record });
    }
    // A chapter/map reset can also create a fresh shared deck without drawing.
    if (after.enemyDiscard?.length === 0) { records = []; replayComplete = true; }
    else if (!matchesDiscard(after)) knownDiscard(after);
  }
  function reset(source) {
    records = []; replayComplete = true;
    // The current discard is exactly the last N shared reveals. Usually all N
    // are still in the public log; restoring them avoids replaying a campaign
    // a second time after importSave has already verified its commands.
    const discard = source.enemyDiscard || [];
    if (!discard.length) return;
    const logged = (source.events || []).map(event => publicAction(event, source.mission?.chapter))
      .filter(Boolean).slice(-discard.length);
    if (logged.length === discard.length && logged.every((record, i) => record.kind === discard[i])) {
      records = logged.map((record, i) => ({ order: i + 1, ...record }));
      return;
    }
    if (!source.commands?.length) { knownDiscard(source); return; }
    try {
      const s = source.setup;
      let replay = E.create(source.initialSeed, s.weaponId, s.face, s.startingConsumable,
        s.firearmId, s.startSpace, { campaign: !!s.campaign, provisional: s.provisional,
          ...(s.firearmOverride ? { firearmOverride: true } : {}),
          ...(s.practiceTarget ? { practiceTarget: s.practiceTarget, practiceSide: s.practiceSide } : {}),
          ...(Object.hasOwn(s, "practiceRewards") ? { practiceRewards: s.practiceRewards } : {}),
          ...(s.qa ? { qa: s.qa } : {}), rulesVersion: s.rulesVersion ?? null });
      for (const command of source.commands || []) {
        const before = replay; replay = E.dispatch(replay, command); observe(before, replay);
      }
      if (!matchesDiscard(source)) knownDiscard(source);
    } catch (_) {
      // A damaged replay must never turn an unknown draw into a claimed fact.
      knownDiscard(source);
    }
  }
  return { observe, reset, view: () => ({ records: records.map(record => ({ ...record })), replayComplete }) };
});
