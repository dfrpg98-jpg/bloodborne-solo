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
  const has = (s, n) => s.mission.revealed.includes(n);
  const done = (s, n) => s.mission.completed.includes(n);
  const owns = (s, n) => done(s, n) || (s.mission.history || []).some((x) => x.completed.includes(n));
  const live = (s, n) => has(s, n) && !(s.mission.discarded || []).includes(n);
  const hunterCount = (s) => Object.keys(s.hunters).length;
  function init(s, h, chapter = 1, history = []) {
    s.mission = {
      chapter, revealed: [], completed: [], fog: [], targets: {},
      escort: { node: null, carrierId: null, pickup: false },
      survivor: { node: null, remaining: 0, exploring: false, after: null },
      choice: false, won: false, deathPending: false, deathAfter: null,
    };
    if (chapter === 1) reveal(s, 1, h);
    else {
      Object.assign(s.mission, { history: JSON.parse(JSON.stringify(history)), discarded: [],
        heldCorpses: {}, heldSurvivors: {}, deposits: { corpses: 0, clinic: 0, chapel: 0 },
        counters: {}, npc: { node: null, follow: false }, donationWindow: false });
      reveal(s, 17, h);
      open(s, chapter === 2 ? 18 : 40, h);
    }
  }
  function encounter(s, id, n, special, tile, node, kind, tokens, h, componentId) {
    reveal(s, n, h); if (special) reveal(s, special, h);
    s.mission.targets[id] = { id, card: special, tile, node, kind,
      initialTokens: tokens, tokens, complete: false, enemyId: null };
    if (componentId) Object.assign(s.mission.targets[id], { componentId, card: special || n });
    if (!s.mission.fog.includes(tile)) s.mission.fog.push(tile);
    s.enemies = s.enemies.filter((e) => h.node(s, e.node).tile !== tile || e.missionId || e.missionSummon);
    h.log(s, `${C.tiles.find((t) => t.id === tile).name} · 안개 진입로, 등불 파괴, 일반 적 제거.`);
    h.spawnMission(s, s.mission.targets[id]);
  }
  function complete(s, id, reward, h) {
    if (done(s, reward)) return;
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
      15: ["rune-rapture"], 16: ["rune-eye"], 23: ["beast-roar"],
      26: ["iosefka-vial"], 28: ["messengers-gift"], 32: ["rune-formless"],
      34: ["rune-writhe"], 38: ["old-hunter-bone", "repeating-pistol"],
      39: ["old-hunter-bone", "repeating-pistol"], 48: ["augur"], 50: ["augur"],
      55: ["executioner-gloves"], 58: ["rune-hunter"], 60: ["empty-shell", "flamesprayer"] }[reward] || [];
    for (const rewardId of ids) h.grant(s, rewardId);
    if ([11, 16, 26, 32, 48, 50, 58].includes(reward)) h.drawConsumable(s);
    if ([15, 23].includes(reward)) h.hunter(s).echoes = Math.min(3, h.hunter(s).echoes + 1);
    if (reward === 55) discardRule(s, 43, h);
    if ([4, 23, 44].includes(reward)) {
      s.mission.won = true;
      h.log(s, `챕터 ${s.mission.chapter} 사냥 완수 · 남은 유지로 성장한 뒤 진행 상태를 보관합니다.`);
    }
    if (s.mission.chapter > 1) check(s, h);
  }
  function insight(s) {
    return active(s) ? s.mission.completed.filter((n) =>
      [7, 11, 15, 16, 26, 28, 32, 34, 38, 39, 48, 50, 55, 58, 60].includes(n)).length : 0;
  }
  function discardRule(s, n, h) {
    if (!live(s, n)) return;
    s.mission.discarded.push(n); h.log(s, `${n} · ${card(n).title} 카드를 제거합니다.`);
  }
  function open(s, n, h) {
    if (!reveal(s, n, h)) return;
    const m = s.mission;
    if (n === 20) encounter(s, "main", 20, null, "tile-13", "tile-13:middle", "scourge-beast", 0, h, "cleric-beast");
    if (n === 21) {
      m.fog = m.fog.filter((x) => x !== "tile-13");
      if (m.targets.main) m.targets.main.tokens = 0;
    }
    if (n === 25) open(s, 27, h);
    if (n === 29) open(s, owns(s, 16) ? 30 : 33, h);
    if (n === 30) encounter(s, "patient", 30, 31, "tile-17", "tile-17:top",
      "huntsman-mob", 2 + (hunterCount(s) >= 3 ? 1 : 0), h, "female-patient");
    if (n === 35) encounter(s, "bridge", 35, 36, "tile-18", "tile-18:top", "huntsmans-minion", 1, h);
    if (n === 37) Object.assign(m.escort, { node: "tile-18:top", carrierId: null,
      pickup: false, home: "tile-18:top" });
    if (n === 40) {
      open(s, 41, h);
      encounter(s, "main", 40, null, "tile-19", "tile-19:bottom", "scourge-beast", 0, h, "cleric-beast");
    }
    if (n === 42) { discardRule(s, 41, h); m.fog = m.fog.filter((x) => x !== "tile-19"); }
    if (n === 43 && owns(s, 55)) discardRule(s, 43, h);
    if (n === 45) open(s, owns(s, 28) ? (owns(s, 26) ? 46 : 51) : (owns(s, 26) ? 52 : 24), h);
    if (n === 46) { m.choice = "iosefka"; s.phase = "mission_choice"; }
    if (n === 47) encounter(s, "iosefka", 47, null, "tile-20", "tile-20:room", "huntsmans-minion", 0, h, "iosefka");
    if (n === 49) {
      Object.assign(m.survivor, { node: h.hunter(s).position, remaining: 4,
        exploring: false, after: null, card: 49, carrierId: null });
      continueSurvivor(s, h);
    }
    if (n === 53) open(s, owns(s, 38) || owns(s, 39) ? 54 : 35, h);
    if (n === 54) m.counters[54] = hunterCount(s) + 2;
    if (n === 56) open(s, owns(s, 39) ? 57 : owns(s, 34) ? 59 : 33, h);
    if (n === 57) { m.counters[57] = hunterCount(s) + 1; m.npc.node = "tile-17:top"; }
    if (n === 59) m.counters[59] = hunterCount(s) + 1;
  }
  function check(s, h) {
    const m = s.mission;
    if (m.chapter === 2 && has(s, 19) && insight(s) >= 2) open(s, 20, h);
    if (m.chapter === 3 && live(s, 41) && insight(s) >= 2) { open(s, 42, h); open(s, 43, h); }
  }
  function onMovementEnd(s, pursuedIntoEnd, h) {
    if (!active(s) || h.hunter(s).inDream || s.mission.won) return;
    const m = s.mission, pos = h.hunter(s).position, tile = h.node(s, pos).tile;
    if (m.chapter > 1) {
      if (m.chapter === 2) {
        if (tile === "tile-20") open(s, 24, h);
        if (tile === "tile-17") open(s, 29, h);
        if (tile === "tile-18") open(s, 35, h);
      } else {
        if (tile === "tile-20") open(s, 45, h);
        if (tile === "tile-18") open(s, 53, h);
        if (tile === "tile-17") {
          // Project ruling (2026-10-12): finish the escort before evaluating
          // the first chapel visit. Older command histories retain their rules.
          if ((s.setup.rulesVersion >= 13 || s.chapelRuling === "escort-first") && !has(s, 56) &&
              m.escort.carrierId === s.activeHunterId && has(s, 37)) {
            m.escort.carrierId = null; m.escort.node = null;
            complete(s, "bridge", 39, h);
          }
          const simultaneous = s.setup.rulesVersion === 12 && !s.chapelRuling && !has(s, 56) && !owns(s, 39) &&
            m.escort.carrierId === s.activeHunterId && has(s, 37);
          if (simultaneous && !(owns(s, 28) && !owns(s, 34))) {
            reveal(s, 56, h);
            m.chapelArrival = { hunterId: s.activeHunterId, beforeCard: owns(s, 34) ? 59 : 33 };
            m.choice = "chapel-order"; s.phase = "mission_choice";
            h.log(s, "예배당 도착 · 임무 공개와 호위 완수가 동시에 발생했습니다. 사냥꾼에게 더 불리한 결과로 판정하세요.");
            return;
          }
          if (simultaneous) h.log(s, "예배당 동시 효과 · 진료소 피신처 때문에 33번은 완수할 수 없습니다. 더 불리한 잠금 결과를 먼저 적용합니다.");
          open(s, 56, h);
        }
      }
      if (m.escort.carrierId === s.activeHunterId && has(s, 37) &&
          ["tile-20", "tile-17"].includes(tile)) {
        m.escort.carrierId = null; m.escort.node = null;
        complete(s, "bridge", tile === "tile-20" ? 38 : 39, h);
      }
      if (m.survivor.card === 49 && m.survivor.carrierId === s.activeHunterId && tile === "tile-20") {
        m.survivor.carrierId = null; m.survivor.node = null;
        complete(s, "experiment", 50, h);
      }
      const held = m.heldSurvivors[s.activeHunterId] || 0;
      const clinic = tile === "tile-20" && (live(s, 27) || live(s, 52)) && !owns(s, 34) && !done(s, 28);
      const chapel = tile === "tile-17" && live(s, 33) && !owns(s, 28) && !done(s, 34);
      if (held && (clinic || chapel)) {
        const place = clinic ? "clinic" : "chapel";
        m.deposits[place] += held; m.heldSurvivors[s.activeHunterId] = 0;
        h.log(s, `피신처 · 생존자 ${held}개를 인도했습니다 (${m.deposits[place]}/${hunterCount(s) + 1}).`);
        if (m.deposits[place] >= hunterCount(s) + 1) complete(s, place, clinic ? 28 : 34, h);
      }
      m.donationWindow = tile === "tile-17" && live(s, 59) && !done(s, 60);
      check(s, h); return;
    }
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
      h.log(s, s.mission.chapter === 1 ? "민가 생존자를 데리고 이동합니다." : "호위 생존자를 데리고 이동합니다.");
    }
    if (s.mission.chapter > 1 && s.mission.npc.follow && s.mission.npc.node === from) {
      s.mission.npc.node = to; h.log(s, "구원의 NPC와 함께 이동합니다.");
    }
  }
  function onTeleport(s, h) {
    if (!active(s)) return;
    const e = s.mission.escort;
    e.pickup = false;
    if (e.carrierId) {
      e.node = e.home || "tile-11:house"; e.carrierId = null; e.pickup = false;
      h.log(s, s.mission.chapter === 1 ? "호위 생존자 · 순간이동/꿈 입장으로 민가에 돌아갔습니다." :
        "호위 생존자 · 순간이동/꿈 입장으로 원래 칸에 돌아갔습니다.");
    }
    if (s.mission.chapter > 1) {
      s.mission.heldSurvivors[s.activeHunterId] = 0;
      s.mission.npc.follow = false; s.mission.donationWindow = false;
      const q = s.mission.survivor;
      if (q.card === 49 && q.carrierId === s.activeHunterId) {
        q.node = h.hunter(s).position; q.carrierId = null;
        h.log(s, "실험 생존자를 순간이동 전 칸에 떨어뜨립니다.");
      }
    }
  }
  function beforeKill(s, e, h) {
    const t = active(s) && e.missionId && s.mission.targets[e.missionId];
    if (!t || !t.tokens) return false;
    t.tokens--; e.hp = h.enemyDef ? h.enemyDef(s, e).maxHp : C.enemies.find((x) => x.id === e.kind).health;
    h.log(s, `${card(t.card).title} · 토큰 1개 제거, 전치유. 처치가 아니므로 적 공격은 계속됩니다.`);
    return true;
  }
  function onKill(s, e, h) {
    if (!active(s)) return;
    const m = s.mission;
    if (m.chapter > 1) {
      const tile = h.node(s, e.node).tile;
      const beast = e.kind === "scourge-beast" && !e.componentId;
      const huntsman = ["huntsman-mob", "huntsmans-minion"].includes(e.kind) && !e.componentId;
      if (beast && m.chapter === 2 && live(s, 18)) {
        m.heldCorpses[s.activeHunterId] = (m.heldCorpses[s.activeHunterId] || 0) + 1;
        h.log(s, "재앙의 야수 시체 토큰 1개 획득.");
      }
      if (huntsman && tile === "tile-20" && live(s, 24) && !has(s, 25)) open(s, 25, h);
      if (beast && tile === "tile-20" && (live(s, 25) || live(s, 51)) && !done(s, 26)) complete(s, "research", 26, h);
      if (beast && live(s, 54) && m.counters[54] > 0) {
        m.counters[54]--; if (!m.counters[54]) complete(s, "cull", 55, h);
      }
      if (huntsman && live(s, 57) && m.npc.node === e.node && m.counters[57] > 0) {
        m.counters[57]--; if (!m.counters[57]) { m.npc.node = null; m.npc.follow = false; complete(s, "salvation", 58, h); }
      }
      if (!e.missionId) return;
      const t = m.targets[e.missionId];
      if (!t || t.complete) return;
      if (e.missionId === "patient") { complete(s, "patient", 32, h); if (h.hunter(s).hp > 0) m.deathPending = true; }
      else if (e.missionId === "bridge") {
        t.complete = true; m.fog = m.fog.filter((x) => x !== t.tile); open(s, 37, h);
      } else if (e.missionId === "iosefka") complete(s, "iosefka", 48, h);
      else if (e.missionId === "main" && m.chapter === 3) complete(s, "main", 44, h);
      return;
    }
    if (!e.missionId) return;
    const t = s.mission.targets[e.missionId];
    if (!t) return;
    if (t.complete) return;
    complete(s, e.missionId, { mob: 7, shelter: 11, main: 4 }[e.missionId], h);
    if (e.missionId === "shelter" && h.hunter(s).hp > 0) s.mission.deathPending = true;
  }
  function targetDef(s, e, d) {
    if (!active(s) || !e?.missionId) return d;
    const t = s.mission.targets[e.missionId];
    if (!t) return d;
    if (t.card === 3) d.ability = { ...d.basic, kind: "ability", type: "attack",
      name: "광포한", damage: d.basic.damage + 1, interrupt: true, stun: true,
      uninterruptible: true, rules: [], code: "mission:main" };
    if (t.card === 10) d.special = { ...d.special, name: "피의 광란", speed: 3,
      damage: e.hp < d.maxHp ? 4 : 2, stun: false, interrupt: false,
      undodgeable: false, uninterruptible: false, followup: false, rules: [] };
    if (t.card === 31) d.special = { ...d.special, name: "갈가리 찢기", kind: "special",
      type: "attack", speed: 3, damage: 3, stun: true, interrupt: false,
      undodgeable: false, uninterruptible: false, followup: false, rules: [] };
    if (t.card === 36) d.special = { ...d.special, name: "고통 면역", kind: "special",
      type: "attack", speed: 1, damage: 4, defense: 2, stun: false, interrupt: false,
      undodgeable: false, uninterruptible: true, followup: false, rules: [] };
    if (s.setup.rulesVersion >= 9 && [31, 36].includes(t.card)) {
      delete d.special.code;
      d.special.poison = false; d.special.frenzy = false;
      delete d.special.forceHunterMove; delete d.special.afterAttackMove;
      delete d.special.afterDodgeDamageBonus;
    }
    if (t.card === 31 && s.tileSpeedRuling !== "all-attacks") d.ignoreTileSpeed = true;
    return d;
  }
  function reset(s, h) {
    if (!active(s)) return [];
    const jobs = [];
    for (const t of Object.values(s.mission.targets).filter((t) => !t.complete)) {
      t.tokens = t.initialTokens;
      const e = s.enemies.find((e) => e.missionId === t.id);
      if (t.componentId === "cleric-beast") {
        if (s.mission.chapter === 3 && live(s, 42)) {
          t.tokens = 0;
          if (s.setup.rulesVersion >= 9 && e) e.insightTokens = 0;
        }
        jobs.push({ kind: t.kind, node: s.mission.chapter === 2 ? "tile-13:middle" : e?.node || t.currentNode || t.node,
          missionId: t.id, componentId: t.componentId, componentPhase: e?.componentPhase || t.componentPhase || 1 });
      } else jobs.push({ kind: t.kind, node: t.node, missionId: t.id,
        ...(t.componentId ? { componentId: t.componentId } : {}) });
    }
    return jobs;
  }
  function rescueInteraction(s, h) {
    if (!active(s)) return false;
    if (s.mission.survivor.card === 49) return !done(s, 50) &&
      !s.mission.survivor.carrierId && s.mission.survivor.node === h.hunter(s).position;
    return s.mission.revealed.includes(12) && !s.mission.revealed.includes(13) &&
      s.mission.survivor.node === h.hunter(s).position;
  }
  function survivorOptions(s, h) {
    const q = s.mission.survivor, hunters = Object.values(s.hunters).filter((x) => !x.inDream);
    const nearest = (at) => Math.min(...hunters.map((x) => h.distance(s, at, x.position)));
    const d = nearest(q.node);
    const options = h.neighbors(s, q.node).filter((at) => nearest(at) > d)
      .filter((at) => h.node(s, at).tile === h.node(s, q.node).tile ||
        !fogged(s, h.node(s, at).tile) && !fogged(s, h.node(s, q.node).tile))
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
      requireOpen = s.setup.rulesVersion >= 8 || s.world.tileDeck.length > 0) {
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
    if (s.mission.survivor.card === 49) {
      s.mission.survivor.carrierId = s.activeHunterId; s.mission.survivor.node = null;
      h.log(s, "실험 생존자를 붙잡았습니다. 진료소로 인도하세요.");
      s.phase = "hunter"; return;
    }
    reveal(s, 13, h);
    Object.assign(s.mission.survivor, { remaining: 4, exploring: true, after: null });
    continueSurvivor(s, h);
  }
  function turnEnd(s, h) {
    if (!active(s)) return false;
    if (s.mission.chapter > 1) {
      s.mission.npc.follow = false; s.mission.donationWindow = false;
      if (s.mission.survivor.card !== 49 || !s.mission.survivor.node || done(s, 50)) return false;
    } else if (!has(s, 13) || has(s, 14)) return false;
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
    if (!a.type.startsWith("MISSION_")) {
      if (active(s) && s.mission.chapter > 1) {
        s.mission.donationWindow = false;
        if (a.type === "MOVE") s.mission.npc.follow = false;
      }
      return false;
    }
    h.need(active(s), "캠페인 모드에서 사용할 수 있습니다.");
    const m = s.mission;
    if (a.type === "MISSION_PICKUP") {
      h.need(s.phase === "move" && m.escort.node === h.hunter(s).position && !m.escort.carrierId,
        s.mission.chapter === 1 ? "민가 생존자 칸에서 이동하는 동안 선택하세요." :
        "호위 생존자 칸에서 이동하는 동안 선택하세요.");
      m.escort.pickup = !m.escort.pickup;
    } else if (a.type === "MISSION_NPC_FOLLOW") {
      h.need(m.chapter > 1 && s.phase === "move" && live(s, 57) && m.npc.node === h.hunter(s).position,
        "구원 NPC 칸에서 이동하는 동안 선택하세요.");
      m.npc.follow = !m.npc.follow;
    } else if (a.type === "MISSION_LURE") {
      h.need(m.chapter === 2 && s.phase === "hunter" && !h.hunter(s).inDream && !m.won,
        "챕터 2 자기 차례에 야수를 유인할 수 있습니다.");
      discardConsumable(s, a.itemId, h);
      h.spawnNormal(s, "scourge-beast", h.hunter(s).position, { missionSummon: true });
    } else if (a.type === "MISSION_CORPSES") {
      const held = m.heldCorpses?.[s.activeHunterId] || 0, count = a.count ?? held;
      h.need(m.chapter === 2 && s.phase === "hunter" && h.node(s, h.hunter(s).position).tile === "tile-13" && held > 0,
        "공동묘지에서 가진 시체 토큰을 바칠 수 있습니다.");
      h.need(Number.isInteger(count) && count > 0 && count <= held, "바칠 보유 시체 토큰 수를 선택하세요.");
      m.heldCorpses[s.activeHunterId] -= count; m.deposits.corpses += count;
      h.log(s, `시체 ${count}개를 바쳤습니다 (${m.deposits.corpses}/${hunterCount(s) + 1}).`);
      if (m.deposits.corpses >= hunterCount(s) + 1) open(s, 19, h);
      check(s, h);
    } else if (a.type === "MISSION_DONATE") {
      h.need(m.chapter === 3 && s.phase === "hunter" && m.donationWindow && live(s, 59) && m.counters[59] > 0,
        "예배당에서 이동을 마친 직후 물자를 기부하세요.");
      discardConsumable(s, a.itemId, h); m.counters[59]--;
      if (!m.counters[59]) { m.donationWindow = false; complete(s, "supplies", 60, h); }
    } else if (a.type === "MISSION_CHOICE") {
      h.need(s.phase === "mission_choice" && m.choice, "구조 분기를 선택할 단계가 아닙니다.");
      if (m.choice === "chapel-order") {
        const pending = m.chapelArrival;
        h.need(pending && pending.hunterId === s.activeHunterId &&
          ["chapel-first", "escort-first"].includes(a.choice), "동시 효과의 더 불리한 결과를 판정하세요.");
        m.choice = false; delete m.chapelArrival; s.phase = "hunter";
        if (a.choice === "escort-first") {
          m.escort.carrierId = null; m.escort.node = null;
          complete(s, "bridge", 39, h); open(s, 57, h);
        } else open(s, pending.beforeCard, h);
        h.log(s, `예배당 동시 효과 판정 · ${a.choice === "escort-first" ? "39번 보상 후 57번 구원" : pending.beforeCard + "번 임무 후 39번 보상"}.`);
        onMovementEnd(s, false, h);
      } else if (m.choice === "iosefka") {
        h.need(["attack-iosefka", "help-iosefka"].includes(a.choice), "공격 또는 도움을 선택하세요.");
        m.choice = false; s.phase = "hunter"; open(s, a.choice === "attack-iosefka" ? 47 : 49, h);
      } else {
        h.need(["attack", "release"].includes(a.choice), "공격 또는 도망을 선택하세요.");
        m.choice = false; complete(s, "rescue", a.choice === "attack" ? 15 : 16, h); s.phase = "hunter";
      }
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
    if (s.phase === "mission_choice" && s.mission.choice === "chapel-order") return [
      { label: "호위 완료 후 예배당 사건 처리",
        command: { type: "MISSION_CHOICE", choice: "escort-first" } } ];
    if (s.phase === "mission_choice" && s.mission.choice === "iosefka") return [
      { label: "이오세프카를 공격한다", command: { type: "MISSION_CHOICE", choice: "attack-iosefka" } },
      { label: "이오세프카를 돕는다", command: { type: "MISSION_CHOICE", choice: "help-iosefka" } } ];
    if (s.phase === "mission_choice") return [
      { label: "여자를 공격한다", command: { type: "MISSION_CHOICE", choice: "attack" } },
      { label: "여자에게 도망치라고 말한다", command: { type: "MISSION_CHOICE", choice: "release" } } ];
    const m = s.mission, out = [];
    if (s.phase === "move" && m.escort.node === h.hunter(s).position)
      out.push({ label: m.escort.pickup ? "호위하지 않기" : "생존자를 데리고 이동", command: { type: "MISSION_PICKUP" } });
    if (s.phase === "move" && m.chapter > 1 && live(s, 57) && m.npc.node === h.hunter(s).position)
      out.push({ label: m.npc.follow ? "NPC를 두고 이동" : "NPC와 함께 이동", command: { type: "MISSION_NPC_FOLLOW" } });
    if (m.chapter > 1 && s.phase === "hunter" && !h.hunter(s).inDream && !m.won) {
      const items = h.hunter(s).consumables || [];
      if (m.chapter === 2) {
        for (const item of items) out.push({ label: `${itemName(item)} 버려 야수 유인`, command: { type: "MISSION_LURE", itemId: item.id } });
        if (h.node(s, h.hunter(s).position).tile === "tile-13" && m.heldCorpses[s.activeHunterId])
          for (let count = 1; count <= m.heldCorpses[s.activeHunterId]; count++)
            out.push({ label: `시체 ${count}개 바치기`, command: { type: "MISSION_CORPSES", count } });
      }
      if (m.donationWindow) for (const item of items)
        out.push({ label: `${itemName(item)} 기부`, command: { type: "MISSION_DONATE", itemId: item.id } });
    }
    return out;
  }
  const itemName = (item) => item.name || item.kind;
  function discardConsumable(s, id, h) {
    const items = h.hunter(s).consumables, i = items.findIndex((x) => x.id === id);
    h.need(i >= 0, "가지고 있는 소모품을 선택하세요.");
    const [item] = items.splice(i, 1); s.consumableDiscard.push(item);
    h.log(s, `임무 · ${itemName(item)}를 버립니다.`);
  }
  function onLoot(s, at, count, h) {
    if (!active(s) || s.mission.chapter === 1 || count <= 0) return;
    const m = s.mission;
    if (!h.node(s, at)?.icons.some((x) => x.kind === "consumable")) return;
    const clinic = (live(s, 27) || live(s, 52)) && !owns(s, 34) && !done(s, 28);
    const chapel = live(s, 33) && !owns(s, 28) && !done(s, 34);
    if (!clinic && !chapel) return;
    m.heldSurvivors[s.activeHunterId] = (m.heldSurvivors[s.activeHunterId] || 0) + count;
    h.log(s, `소모품 수집 · 생존자 토큰 ${count}개도 획득합니다.`);
  }
  function onBossPhase(s, e, phase, h) {
    if (!active(s) || !e.missionId) return;
    const t = s.mission.targets[e.missionId];
    if (!t) return;
    t.componentPhase = phase; t.currentNode = e.node;
    if (s.mission.chapter === 2 && e.missionId === "main" && phase === 2) {
      open(s, 21, h); open(s, 22, h); e.insightTokens = 0;
    }
  }
  function onEnemyStep(s, e, from, to, h) {
    if (!active(s) || !e.missionId) return;
    const t = s.mission.targets[e.missionId];
    if (!t) return;
    t.currentNode = to;
    if (s.mission.chapter === 2 && live(s, 21) && e.missionId === "main" && h.node(s, to)?.tile === "tile-19")
      complete(s, "main", 23, h);
  }
  function onTrackChange(s, h) {
    if (!active(s) || s.mission.chapter !== 3 || !live(s, 41)) return;
    const resets = h.trackResets || [5, 9, 13, 16];
    if (s.track >= resets[1]) { open(s, 42, h); open(s, 43, h); }
  }
  function onBossRecover(s, e, h) {
    if (active(s) && s.mission.chapter === 3 && live(s, 43) && e.missionId === "main")
      h.spawnNormal(s, "scourge-beast", e.node, { ephemeral: true, missionSummon: true });
  }
  function beforeEnemyDamage(s, e, damage, context, h) {
    if (!active(s) || !e?.missionId) return damage;
    if (s.mission.chapter === 2 && e.missionId === "main" && live(s, 22)) return 0;
    const t = s.mission.targets[e.missionId];
    if (t?.card === 36 && context?.kind === "hunter-attack" && context.action?.kind === "special")
      return Math.max(0, damage - 2);
    return damage;
  }
  function canEnter(s, from, to) {
    return !(active(s) && s.mission.chapter === 3 && live(s, 41) && to.startsWith("tile-19:"));
  }
  function roundEnd(s, h) {
    if (!active(s) || s.mission.won) return [];
    const m = s.mission, e = s.enemies.find((x) => x.missionId === "main");
    if (!e || !(m.chapter === 2 && live(s, 22) || m.chapter === 3 && live(s, 42))) return [];
    const hunters = Object.entries(s.hunters).filter(([, x]) => !x.inDream && x.hp > 0);
    if (!hunters.length) return [];
    const lowest = (a, b) => a[1].hp - b[1].hp || a[0].localeCompare(b[0]);
    if (m.chapter === 2) {
      const target = hunters.sort(lowest)[0]; return [{ enemyId: e.id, targetId: target[0], extra: true }];
    }
    const same = hunters.filter(([, x]) => x.position === e.node);
    const target = same.length ? same.sort(lowest)[0] : hunters.sort((a, b) =>
      h.distance(s, e.node, a[1].position) - h.distance(s, e.node, b[1].position) || lowest(a, b))[0];
    return [{ enemyId: e.id, targetId: target[0], move: same.length ? 0 : 4, extra: true }];
  }
  function chapelAdjudicationDescription(s, h) {
    return "이동 종료로 호위 임무와 예배당 사건이 함께 발생했습니다. 현재 공개된 카드의 지시를 처리합니다.";
  }
  function view(s, h) {
    if (!active(s)) return null;
    const m = s.mission, objective = (id, title, done, started, description) =>
      ({ id, title, status: done ? "완료" : started ? "진행 중" : "미발견", description });
    let objectives = [
      objective("main", "재앙의 근원", m.won, true, has(s, 2)
        ? "중앙 등불의 재앙의 야수 우두머리 처치" : "계몽 임무 2개 완료 후 중앙 등불에서 이동 종료"),
      objective("mob", "사냥을 시작하다", m.completed.includes(7), m.revealed.includes(5), "마당 등불의 야수 사냥 무리 처치"),
      objective("shelter", "피신처", m.completed.includes(11), m.revealed.includes(8), has(s, 9)
        ? "오에돈 예배당의 재앙의 야수 처치" : "민가 생존자를 오에돈 예배당으로 호위"),
      objective("rescue", "구조", m.completed.some((n) => [15, 16].includes(n)), m.revealed.includes(12), has(s, 14)
        ? "공개된 구조 카드의 선택 해결" : has(s, 13)
          ? "생존자가 있는 칸에서 적의 추격 없이 이동 종료" : "폐가 생존자 토큰과 상호작용"),
    ].filter((o) => o.status !== "미발견");
    if (m.chapter > 1) {
      const progress = (start, reward, text) => objective(`card-${start}`, card(start).title,
        done(s, reward), has(s, start), text);
      objectives = [objective("main", "재앙의 근원", m.won, true, m.chapter === 2
        ? has(s, 22) ? "피해를 입지 않는 성직자 야수를 지하묘지로 유인" : has(s, 20) ? "성직자 야수를 2페이즈로 전환"
          : has(s, 19) ? "이번 챕터 계몽 2개 획득" : `공동묘지에 시체 ${hunterCount(s) + 1}개를 바치기`
        : live(s, 41) ? "이번 챕터 계몽 2개 또는 두 번째 초기화까지 성직자 야수 봉인" : "풀려난 성직자 야수를 최종 처치")];
      if (has(s, 24) || has(s, 51)) objectives.push(progress(has(s, 51) ? 51 : 24, 26,
        has(s, 51) || has(s, 25) ? "진료소에서 재앙의 야수 처치" : "진료소에서 야수 사냥 무리 또는 야수 사냥 하인 처치"));
      if (has(s, 27) || has(s, 52)) objectives.push(progress(has(s, 52) ? 52 : 27, 28,
        owns(s, 34) ? "예배당 피신처 완료로 이 임무를 완수할 수 없음" : `소모품 수집으로 얻은 생존자 ${hunterCount(s) + 1}개를 진료소에 인도`));
      if (has(s, 30)) objectives.push(progress(30, 32, "환자의 임무 부활 토큰을 소진시키고 최종 처치 후 속도 1 회피"));
      if (has(s, 33)) objectives.push(progress(33, 34,
        owns(s, 28) ? "진료소 피신처 완료로 이 임무를 완수할 수 없음" : `소모품 수집으로 얻은 생존자 ${hunterCount(s) + 1}개를 예배당에 인도`));
      if (has(s, 35)) objectives.push(objective("bridge", "아슬아슬한 구조", done(s, 38) || done(s, 39), true, has(s, 37)
        ? "대교의 생존자를 진료소 또는 예배당으로 호위" : "대교의 야수 사냥 하인 처치"));
      if (has(s, 46)) objectives.push(objective("truth", "진실이 드러나다", done(s, 48) || done(s, 50), true, has(s, 49) ? "도망친 생존자와 상호작용해 붙잡고 진료소로 호위" : "이오세프카를 공격하거나 실험을 돕기"));
      if (has(s, 54)) objectives.push(progress(54, 55, "재앙의 야수를 처치해 계몽 토큰 제거"));
      if (has(s, 57)) objectives.push(progress(57, 58, "NPC와 같은 칸에서 사냥 무리/하수인을 처치"));
      if (has(s, 59)) objectives.push(progress(59, 60, "예배당에서 이동을 마친 직후 소모품 기부"));
    }
    const tokens = [];
    if (m.escort.node || m.escort.carrierId) tokens.push({ id: "escort", name: "호위 생존자", node: m.escort.node, carrierId: m.escort.carrierId });
    if (m.survivor.node || m.survivor.carrierId) tokens.push({ id: "rescue", name: m.survivor.card === 49 ? "실험 생존자" : "구조 생존자", node: m.survivor.node, carrierId: m.survivor.carrierId || null });
    if (m.npc?.node) tokens.push({ id: "salvation-npc", name: "구원 NPC", node: m.npc.node, carrierId: null });
    const type = { mission_survivor: "survivor-move", mission_choice: "rescue-choice", mission_death: "death-dodge" }[s.phase];
    const counters = m.chapter > 1 ? [
      { id: "corpses-held", name: "보유 시체", value: m.heldCorpses[s.activeHunterId] || 0 },
      { id: "corpses", name: "바친 시체", value: m.deposits.corpses },
      { id: "survivors-held", name: "보유 생존자", value: m.heldSurvivors[s.activeHunterId] || 0 },
      { id: "clinic", name: "진료소 생존자", value: m.deposits.clinic },
      { id: "chapel", name: "예배당 생존자", value: m.deposits.chapel },
      ...Object.entries(m.counters).map(([n, value]) => ({ id: `card-${n}`, name: card(Number(n)).title, value }))] : [];
    const notices = Object.values(m.targets).filter((t) => t.componentId && !t.complete &&
      !(s.setup.rulesVersion >= 9))
      .map((t) => `${t.componentId === "cleric-beast" ? "성직자 야수" : t.componentId === "female-patient" ? "여성 야수 환자" : "이오세프카"}: 사용자 승인 임시 전투 수치·효과 사용 중. 실물 자료 제공 후 교체합니다.`);
    return { chapter: m.chapter, insight: insight(s), revealed: [...m.revealed], completed: [...m.completed],
      history: m.history || [], discarded: m.discarded || [], counters, notices,
      won: m.won, objectives, fog: [...m.fog], tokens,
      targets: Object.values(m.targets).map((x) => ({ ...x })),
      pending: type ? { type, title: type === "survivor-move" ? "생존자 도주" : type === "death-dodge" ? "야수의 마지막 공격" : m.choice === "chapel-order" ? "호위 완료와 예배당 사건" : m.choice === "iosefka" ? "이오세프카에게 드러난 진실" : "구조 결과 선택",
        ...(m.choice === "chapel-order" ? { description: chapelAdjudicationDescription(s, h) } : {}),
        remaining: m.survivor.remaining, options: h.missionActions(s) } : null };
  }
  function assert(s, h) {
    if (!active(s)) return;
    const need = h.need, m = s.mission;
    const numbers = (xs) => Array.isArray(xs) && new Set(xs).size === xs.length &&
      xs.every((n) => Number.isInteger(n) && !!card(n));
    const rewards = [4, 7, 11, 15, 16, 23, 26, 28, 32, 34, 38, 39, 44, 48, 50, 55, 58, 60];
    const completed = (xs) => numbers(xs) && xs.every((n) => rewards.includes(n));
    const count = (n) => Number.isInteger(n) && n >= 0;
    const at = (node) => node === null || typeof node === "string" && !!h.node(s, node);
    const carrier = (id) => id === null || !!s.hunters[id];
    need([1, 2, 3].includes(m.chapter) && numbers(m.revealed) && completed(m.completed), "임무 챕터/카드 기록 오류.");
    need(Array.isArray(m.fog) && new Set(m.fog).size === m.fog.length &&
      m.fog.every((id) => s.world.tiles.some((p) => p.tileId === id)), "임무 안개 타일 오류.");
    need(typeof m.won === "boolean" && typeof m.deathPending === "boolean", "임무 완료 상태 오류.");
    need(m.escort && at(m.escort.node) && carrier(m.escort.carrierId) &&
      typeof m.escort.pickup === "boolean", "호위 생존자 상태 오류.");
    need(m.survivor && at(m.survivor.node) && count(m.survivor.remaining) &&
      m.survivor.remaining <= 4 && typeof m.survivor.exploring === "boolean" &&
      (m.survivor.carrierId === undefined || carrier(m.survivor.carrierId)), "도망치는 생존자 상태 오류.");
    need(m.targets && Object.entries(m.targets).every(([id, t]) => id === t.id &&
      !!card(t.card) && at(t.node) && t.node !== null &&
      (t.currentNode === undefined || at(t.currentNode)) && count(t.tokens) &&
      count(t.initialTokens) && t.tokens <= t.initialTokens && typeof t.complete === "boolean"), "임무 적/부활 토큰 오류.");
    if (m.chapter === 1) return;
    if (m.chapelArrival) need(s.setup.rulesVersion >= 12 && s.phase === "mission_choice" &&
      m.choice === "chapel-order" && m.chapelArrival.hunterId === s.activeHunterId &&
      [33, 59].includes(m.chapelArrival.beforeCard) && has(s, 56) && !owns(s, 39) &&
      h.node(s, h.hunter(s).position).tile === "tile-17" && m.escort.carrierId === s.activeHunterId,
      "예배당 동시 효과 판정 상태 오류.");
    need(Array.isArray(m.history) && m.history.length === m.chapter - 1 &&
      m.history.every((x, i) => x.chapter === i + 1 && completed(x.completed) && numbers(x.revealed)), "지난 챕터 완료 기록 오류.");
    need(numbers(m.discarded) && m.discarded.every((n) => [41, 43].includes(n) && has(s, n)), "제거한 임무 카드 오류.");
    need([m.heldCorpses, m.heldSurvivors].every((map) => map &&
      Object.entries(map).every(([id, n]) => !!s.hunters[id] && count(n))), "사냥꾼 보유 임무 토큰 오류.");
    need(m.deposits && ["corpses", "clinic", "chapel"].every((key) => count(m.deposits[key])) &&
      m.counters && Object.entries(m.counters).every(([key, n]) => ["54", "57", "59"].includes(key) && count(n)), "임무 진행 토큰 오류.");
    need(m.npc && at(m.npc.node) && typeof m.npc.follow === "boolean" &&
      typeof m.donationWindow === "boolean", "구원 NPC/기부 상태 오류.");
  }
  const api = { init, active, fogged, insight, onMovementEnd, onStep, onTeleport,
    beforeKill, onKill, targetDef, reset, rescueInteraction, startRescue, turnEnd,
    survivorEntry, placementOptions, dispatch, actions, view, onLoot, onBossPhase,
    onEnemyStep, onTrackChange, onBossRecover, beforeEnemyDamage, canEnter, roundEnd, assert };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBMission = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
