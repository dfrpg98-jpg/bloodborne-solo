(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports
    ? require("./campaigns/long-hunt/data.json") : root.BBLongHunt;
  const M = typeof module !== "undefined" && module.exports
    ? require("./chapter-engine.js") : root.BBChapter;
  const card = (n) => C.cards.find((c) => c.number === n);
  const active = (s) => !!s.mission;
  const fogged = (s, tile) => !!s.mission?.fog.includes(tile);
  function reveal(s, n, h) {
    if (s.mission.revealed.includes(n)) return false;
    s.mission.revealed.push(n);
    h.log(s, `기나긴 사냥 ${n} · ${card(n).title}`);
    return true;
  }
  function init(s, h) {
    s.mission = {
      chapter: 1, revealed: [], completed: [], fog: [], targets: {},
      escort: { node: null, carrierId: null, pickup: false },
      survivor: { node: null, remaining: 0, exploring: false, after: null },
      choice: false, won: false, deathPending: false, deathAfter: null,
    };
    reveal(s, 1, h);
  }
  function encounter(s, id, n, special, tile, node, kind, tokens, h) {
    reveal(s, n, h); reveal(s, special, h);
    s.mission.targets[id] = { id, card: special, tile, node, kind,
      initialTokens: tokens, tokens, complete: false, enemyId: null };
    if (!s.mission.fog.includes(tile)) s.mission.fog.push(tile);
    s.enemies = s.enemies.filter((e) => h.node(s, e.node).tile !== tile || e.missionId);
    h.log(s, `${C.tiles.find((t) => t.id === tile).name} · 안개 진입로, 등불 파괴, 일반 적 제거.`);
    h.spawnMission(s, s.mission.targets[id]);
  }
  function complete(s, id, reward, h) {
    const t = s.mission.targets[id];
    if (t) {
      t.complete = true;
      s.mission.fog = s.mission.fog.filter((x) => x !== t.tile);
      h.log(s, "임무 완수 · 안개를 제거하고 등불을 복원합니다.");
    }
    if (!s.mission.completed.includes(reward)) s.mission.completed.push(reward);
    reveal(s, reward, h);
    const ids = { 4: ["bloodstone-shard", "rune-moon"],
      7: ["lantern", "ludwig-rifle"], 11: ["rune-clawmark"],
      15: ["rune-rapture"], 16: ["rune-eye"] }[reward] || [];
    for (const rewardId of ids) h.grant(s, rewardId);
    if ([11, 16].includes(reward)) h.drawConsumable(s);
    if (reward === 15) h.hunter(s).echoes = Math.min(3, h.hunter(s).echoes + 1);
    if (reward === 4) {
      s.mission.won = true;
      h.log(s, "챕터 1 사냥 완수 · 남은 유지로 성장한 뒤 진행 상태를 보관합니다.");
    }
  }
  function insight(s) {
    return active(s) ? s.mission.completed.filter((n) => [7, 11, 15, 16].includes(n)).length : 0;
  }
  function onMovementEnd(s, pursuedIntoEnd, h) {
    if (!active(s) || h.hunter(s).inDream || s.mission.won) return;
    const m = s.mission, pos = h.hunter(s).position, tile = h.node(s, pos).tile;
    if (tile === "tile-04" && !m.revealed.includes(5))
      encounter(s, "mob", 5, 6, tile, "tile-04:center", "huntsman-mob", 1, h);
    if (tile === "tile-11" && reveal(s, 8, h)) m.escort.node = "tile-11:house";
    if (tile === "tile-03" && reveal(s, 12, h)) m.survivor.node = "tile-03:room";
    if (tile === "tile-17" && m.escort.carrierId && !m.revealed.includes(9)) {
      m.escort.carrierId = null; m.escort.node = null;
      encounter(s, "shelter", 9, 10, tile, "tile-17:top", "scourge-beast", 1, h);
    }
    if (m.revealed.includes(13) && !m.revealed.includes(14) &&
        m.survivor.node === pos && !pursuedIntoEnd) {
      reveal(s, 14, h); m.choice = true; m.survivor.node = null;
      s.phase = "mission_choice";
    }
    if (tile === "tile-14" && insight(s) >= 2 && !m.revealed.includes(2))
      encounter(s, "main", 2, 3, tile, "tile-14:center", "scourge-beast", 1, h);
  }
  function onStep(s, from, to, h) {
    if (!active(s)) return;
    const e = s.mission.escort;
    if (e.pickup && !e.carrierId && e.node === from && from !== to) {
      e.carrierId = s.activeHunterId; e.node = null; e.pickup = false;
      h.log(s, "민가 생존자를 데리고 이동합니다.");
    }
  }
  function onTeleport(s, h) {
    if (!active(s)) return;
    const e = s.mission.escort;
    e.pickup = false;
    if (e.carrierId) {
      e.node = "tile-11:house"; e.carrierId = null; e.pickup = false;
      h.log(s, "호위 생존자 · 순간이동/꿈 입장으로 민가에 돌아갔습니다.");
    }
  }
  function beforeKill(s, e, h) {
    const t = active(s) && e.missionId && s.mission.targets[e.missionId];
    if (!t || !t.tokens) return false;
    t.tokens--; e.hp = C.enemies.find((x) => x.id === e.kind).health;
    h.log(s, `${card(t.card).title} · 토큰 1개 제거, 전치유. 처치가 아니므로 적 공격은 계속됩니다.`);
    return true;
  }
  function onKill(s, e, h) {
    if (!active(s) || !e.missionId) return;
    const t = s.mission.targets[e.missionId];
    if (t.complete) return;
    complete(s, e.missionId, { mob: 7, shelter: 11, main: 4 }[e.missionId], h);
    if (e.missionId === "shelter" && h.hunter(s).hp > 0) s.mission.deathPending = true;
  }
  function targetDef(s, e, d) {
    if (!active(s) || !e?.missionId) return d;
    const t = s.mission.targets[e.missionId];
    if (t.card === 3) d.ability = { ...d.basic, kind: "ability", type: "attack",
      name: "광포한", damage: d.basic.damage + 1, interrupt: true, stun: true,
      uninterruptible: true, rules: [], code: "mission:main" };
    if (t.card === 10) d.special = { ...d.special, name: "피의 광란", speed: 3,
      damage: e.hp < d.maxHp ? 4 : 2, stun: false, interrupt: false,
      undodgeable: false, uninterruptible: false, followup: false, rules: [] };
    return d;
  }
  function reset(s, h) {
    if (!active(s)) return [];
    const jobs = [];
    for (const t of Object.values(s.mission.targets).filter((t) => !t.complete)) {
      t.tokens = t.initialTokens;
      jobs.push({ kind: t.kind, node: t.node, missionId: t.id });
    }
    return jobs;
  }
  function rescueInteraction(s, h) {
    if (!active(s)) return false;
    return s.mission.revealed.includes(12) && !s.mission.revealed.includes(13) &&
      s.mission.survivor.node === h.hunter(s).position;
  }
  function survivorOptions(s, h) {
    const q = s.mission.survivor, hunters = Object.values(s.hunters).filter((x) => !x.inDream);
    const nearest = (at) => Math.min(...hunters.map((x) => h.distance(s, at, x.position)));
    const d = nearest(q.node);
    const options = h.neighbors(s, q.node).filter((at) => nearest(at) > d)
      .map((at) => ({ label: `생존자 → ${h.node(s, at).name}`,
        command: { type: "MISSION_SURVIVOR_STEP", node: at } }));
    if (q.exploring && s.world.tileDeck.length)
      for (const exit of h.openExits(s).filter((x) => x.node === q.node))
        options.push({ label: `생존자 ${exit.edge} 탐험`,
          command: { type: "MISSION_SURVIVOR_EXPLORE", edge: exit.edge } });
    return options;
  }
  function nearestHunter(s, at, h) {
    return Math.min(...Object.values(s.hunters).filter((x) => !x.inDream)
      .map((x) => h.distance(s, at, x.position)));
  }
  function placementOptions(s, h, pending = s.world.pending,
      requireOpen = s.world.tileDeck.length > 0) {
    if (!pending) return [];
    const rotations = M.placementOptions(s.world, pending.tileId, pending.anchor, requireOpen);
    if (!pending.survivor) return rotations;
    const q = s.mission.survivor;
    const minimumDistance = q.minimumDistance ?? nearestHunter(s, q.node, h) + 1;
    return rotations.filter((rotation) => {
      const [dx, dy] = M.vectors[pending.anchor.edge];
      const placed = { tileId: pending.tileId, x: pending.anchor.x + dx,
        y: pending.anchor.y + dy, rotation };
      const projected = { ...s, world: { ...s.world, tiles: [...s.world.tiles, placed] } };
      const opposite = { N: "S", S: "N", E: "W", W: "E" }[pending.anchor.edge];
      const entry = M.exits(placed).find((x) => x.edge === opposite)?.node;
      return entry && nearestHunter(projected, entry, h) >= minimumDistance;
    });
  }
  function continueSurvivor(s, h) {
    const q = s.mission.survivor;
    if (q.remaining && !survivorOptions(s, h).length) {
      q.remaining = 0; h.log(s, "생존자 · 더 멀리 이동할 경로가 없어 이동을 마칩니다.");
    }
    if (q.remaining) { s.phase = "mission_survivor"; return; }
    q.exploring = false;
    const after = q.after; q.after = null;
    h.resume(s, after || { type: "mission_hunter" });
  }
  function startRescue(s, h) {
    h.need(rescueInteraction(s, h), "구조 토큰과 같은 칸에서 상호작용하세요.");
    reveal(s, 13, h);
    Object.assign(s.mission.survivor, { remaining: 4, exploring: true, after: null });
    continueSurvivor(s, h);
  }
  function turnEnd(s, h) {
    if (!active(s) || !s.mission.revealed.includes(13) || s.mission.revealed.includes(14)) return false;
    Object.assign(s.mission.survivor, { remaining: 1, exploring: false,
      after: { type: "mission_activation" } });
    continueSurvivor(s, h);
    return true;
  }
  function survivorEntry(s, at, h) {
    if (s.mission.survivor.minimumDistance !== undefined) {
      h.need(nearestHunter(s, at, h) >= s.mission.survivor.minimumDistance,
        "생존자는 가장 가까운 사냥꾼에게서 더 멀어지는 방향으로 탐험해야 합니다.");
      delete s.mission.survivor.minimumDistance;
    }
    s.mission.survivor.node = at; s.mission.survivor.remaining--;
    h.log(s, `생존자 이동 · 남은 ${s.mission.survivor.remaining}칸.`);
    continueSurvivor(s, h);
  }
  function dispatch(s, a, h) {
    if (!a.type.startsWith("MISSION_")) return false;
    h.need(active(s), "캠페인 모드에서 사용할 수 있습니다.");
    const m = s.mission;
    if (a.type === "MISSION_PICKUP") {
      h.need(s.phase === "move" && m.escort.node === h.hunter(s).position && !m.escort.carrierId,
        "민가 생존자 칸에서 이동하는 동안 선택하세요.");
      m.escort.pickup = !m.escort.pickup;
    } else if (a.type === "MISSION_CHOICE") {
      h.need(s.phase === "mission_choice" && m.choice, "구조 분기를 선택할 단계가 아닙니다.");
      h.need(["attack", "release"].includes(a.choice), "공격 또는 도망을 선택하세요.");
      m.choice = false; complete(s, "rescue", a.choice === "attack" ? 15 : 16, h);
      s.phase = "hunter";
    } else if (a.type === "MISSION_SURVIVOR_STEP" || a.type === "MISSION_SURVIVOR_EXPLORE") {
      h.need(s.phase === "mission_survivor", "생존자를 이동할 단계가 아닙니다.");
      const valid = survivorOptions(s, h).some((x) => x.command.type === a.type &&
        (a.type === "MISSION_SURVIVOR_STEP" ? x.command.node === a.node : x.command.edge === a.edge));
      h.need(valid, "가장 가까운 사냥꾼에게서 멀어지는 경로를 선택하세요.");
      if (a.type === "MISSION_SURVIVOR_STEP") survivorEntry(s, a.node, h);
      else {
        m.survivor.minimumDistance = nearestHunter(s, m.survivor.node, h) + 1;
        h.explore(s, a.edge, m.survivor.node);
      }
    } else return false;
    return true;
  }
  function actions(s, h) {
    if (!active(s)) return [];
    if (s.phase === "mission_survivor") return survivorOptions(s, h);
    if (s.phase === "mission_choice") return [
      { label: "여자를 공격한다", command: { type: "MISSION_CHOICE", choice: "attack" } },
      { label: "여자에게 도망치라고 말한다", command: { type: "MISSION_CHOICE", choice: "release" } } ];
    if (s.phase === "move" && s.mission.escort.node === h.hunter(s).position)
      return [{ label: s.mission.escort.pickup ? "호위하지 않기" : "생존자를 데리고 이동",
        command: { type: "MISSION_PICKUP" } }];
    return [];
  }
  function view(s, h) {
    if (!active(s)) return null;
    const m = s.mission, objective = (id, title, done, started, description) =>
      ({ id, title, status: done ? "완료" : started ? "진행 중" : "미발견", description });
    const objectives = [
      objective("main", "재앙의 근원", m.won, true, insight(s) >= 2 ? "중앙 등불에서 이동 종료 → 우두머리 처치" : "계몽 임무 2개 완료 후 중앙 등불로 이동"),
      objective("mob", "사냥을 시작하다", m.completed.includes(7), m.revealed.includes(5), "마당 등불의 야수 사냥 무리 처치"),
      objective("shelter", "피신처", m.completed.includes(11), m.revealed.includes(8), "민가 생존자 호위 → 오에돈 예배당의 야수 처치"),
      objective("rescue", "구조", m.completed.some((n) => [15, 16].includes(n)), m.revealed.includes(12), "폐가 생존자와 상호작용 → 추격 없이 따라잡기 → 선택"),
    ];
    const tokens = [];
    if (m.escort.node || m.escort.carrierId) tokens.push({ id: "escort", name: "호위 생존자", node: m.escort.node, carrierId: m.escort.carrierId });
    if (m.survivor.node) tokens.push({ id: "rescue", name: "구조 생존자", node: m.survivor.node, carrierId: null });
    const type = { mission_survivor: "survivor-move", mission_choice: "rescue-choice", mission_death: "death-dodge" }[s.phase];
    return { chapter: 1, insight: insight(s), revealed: [...m.revealed], completed: [...m.completed],
      won: m.won, objectives, fog: [...m.fog], tokens,
      targets: Object.values(m.targets).map((x) => ({ ...x })),
      pending: type ? { type, title: type === "survivor-move" ? "생존자 도주" : type === "death-dodge" ? "포악한 야수의 마지막 공격" : "구조 결과 선택",
        remaining: m.survivor.remaining, options: h.missionActions(s) } : null };
  }
  const api = { init, active, fogged, insight, onMovementEnd, onStep, onTeleport,
    beforeKill, onKill, targetDef, reset, rescueInteraction, startRescue, turnEnd,
    survivorEntry, placementOptions, dispatch, actions, view };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBMission = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
