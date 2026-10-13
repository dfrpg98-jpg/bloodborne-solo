(function (root) {
  "use strict";
  const D =
    typeof module !== "undefined" && module.exports
      ? require("./hunt-data.js")
      : root.BBHuntData;
  const M =
    typeof module !== "undefined" && module.exports
      ? require("./chapter-engine.js")
      : root.BBChapter;
  const missions = typeof module !== "undefined" && module.exports
    ? require("./mission-engine.js") : root.BBMission;
  const rewards = typeof module !== "undefined" && module.exports
    ? require("./rewards-engine.js") : root.BBRewards;
  const temporary = typeof module !== "undefined" && module.exports
    ? require("./temporary-components.js") : root.BBTemporaryComponents;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const enemyDeck =
    typeof module !== "undefined" && module.exports
      ? require("./enemy-deck.js")
      : root.BBEnemyDeck;
  const fail = (message) => {
    throw new Error(message);
  };
  const need = (condition, message) => {
    if (!condition) fail(message);
  };
  const hunter = (s) => s.hunters[s.activeHunterId];
  const nodes = (s) =>
    M.graph(s.world).nodes.map((n) => ({
      ...n,
      tile: n.tileId,
      name: M.tile(n.tileId).displayName + " / " + (n.placeName || n.label),
      lamp: n.icons.some((i) => i.kind === "lamp") && !missions.fogged(s, n.tileId),
    }));
  const edges = (s) => M.graph(s.world).edges;
  const node = (s, id) => nodes(s).find((n) => n.id === id);
  const card = (c) => D.cards[c.kind];
  const enemy = (s, id) => s.enemies.find((e) => e.id === id);
  const firearm = (s) => D.firearms[hunter(s).firearmId || "hunter-pistol"];
  const canFirearm = (s) =>
    !!(
      hunter(s).firearmReady &&
      s.phase === "combat_react" &&
      s.combat?.action?.kind === "basic" &&
      s.combat.action.type === "attack" &&
      !s.combat.action.uninterruptible &&
      !!enemy(s, s.combat.enemyId) &&
      !s.combat.cancelEnemy
    );
  const weapon = (s) => D.weapons[hunter(s).weaponId];
  const weaponFace = (s) => weapon(s).faces[hunter(s).face];
  const slots = (s) => weaponFace(s).slots;
  const log = (s, text) => {
    s.events.push({ round: s.round, text });
    if (s.events.length > 180) s.events.shift();
  };
  function missionHelpers() {
    return { hunter, log, need, node, nodes, neighbors, distance, draw, drawConsumable,
      pay, clearSlot, slots, weaponFace, card, takeDamage, kill, resume, explore,
      openExits: (s) => M.openExits(s.world),
      spawnMission: (s, t) => {
        s.spawnQueue.push({ kind: t.kind, node: t.node, missionId: t.id });
      },
      grant: (s, id) => rewards.grant(s, id, rewardHelpers()), missionActions };
  }
  function rewardHelpers() {
    return { hunter, log, need, draw, drawConsumable, pay, take, clearSlot, nodes,
      neighbors, distance, teleport, kill, takeDamage, slots, weaponFace, card };
  }
  function missionActions(s) {
    if (s.phase === "mission_death") {
      const out = [{ label: "3피해를 받는다", command: { type: "MISSION_DEATH_TAKE" } }];
      for (const x of hunter(s).hand) for (let slot = 0; slot < 3; slot++)
        if (deathDodgePossible(s, x.id, slot)) out.unshift({
          label: `${card(x).name} / ${slots(s)[slot].name}으로 회피`,
          command: { type: "MISSION_DEATH_DODGE", cardId: x.id, slot } });
      return out;
    }
    return missions.actions(s, missionHelpers());
  }
  function fogCrossing(s, from, to) {
    const a = node(s, from)?.tile, b = node(s, to)?.tile;
    return a !== b && (missions.fogged(s, a) || missions.fogged(s, b));
  }
  function centralLampDestinations(s) {
    return nodes(s).filter((n) => n.lamp || missions.fogged(s, n.tile));
  }
  function teleport(s, to, allowFogDestination = false) {
    const h = hunter(s);
    const destination = node(s, to);
    need(destination && (destination.lamp || allowFogDestination && missions.fogged(s, destination.tile)),
      "사용할 수 있는 등불 또는 허용된 안개 안 칸을 선택하세요.");
    need(!missions.fogged(s, node(s, h.position)?.tile) || sameTile(s, h.position, to),
      "안개 진입로 안에서는 꿈 이외의 방법으로 탈출할 수 없습니다.");
    missions.onTeleport(s, missionHelpers());
    h.position = to;
    missions.onMovementEnd(s, false, missionHelpers());
  }
  function flushMissionSpawns(s) {
    if (!s.mission || !s.spawnQueue.length || s.spawnAfter) return;
    const after = { type: "mission_phase", phase: s.phase };
    s.spawnAfter = after; finishSpawns(s);
  }
  function provisionalView(s) {
    if (!s.provisional) return null;
    const d = temporary.specimens[s.provisional.componentId];
    return { name: d.name, componentId: s.provisional.componentId,
      phase: s.provisional.phase, notice: temporary.notice, npc: !!d.npc };
  }
  function spawnProvisional(s) {
    if (!s.provisional || s.provisional.finished) return;
    const id = s.provisional.componentId, d = temporary.specimens[id];
    if (d.npc) return;
    s.enemies.push({ id: d.baseKind + "-1", kind: d.baseKind, figure: 1,
      node: "tile-14:center", hp: temporary.definition(id, s.provisional.phase).maxHp,
      provisionalKind: id, provisionalPhase: s.provisional.phase });
  }
  function random(s) {
    let x = s.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
  }
  function shuffle(s, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function neighbors(s, id) {
    return edges(s)
      .filter((e) => e.includes(id))
      .map((e) => e.find((x) => x !== id));
  }
  function path(s, from, to) {
    const q = [[from]],
      seen = new Set([from]);
    while (q.length) {
      const p = q.shift(),
        last = p[p.length - 1];
      if (last === to) return p;
      for (const x of neighbors(s, last))
        if (!seen.has(x)) {
          seen.add(x);
          q.push([...p, x]);
        }
    }
    return [];
  }
  function sameTile(s, a, b) {
    return node(s, a).tile === node(s, b).tile;
  }
  function distance(s, a, b) {
    const route = path(s, a, b);
    return route.length ? route.length - 1 : Infinity;
  }
  function pullCandidates(s) {
    const h = hunter(s),
      range = weaponFace(s).pullRange;
    if (h.inDream || !range) return [];
    return s.enemies.filter(
      (e) => e.node !== h.position && distance(s, h.position, e.node) <= range && !fogCrossing(s, e.node, h.position),
    );
  }
  function pullBeforeAttack(s, ids = []) {
    need(
      Array.isArray(ids) && new Set(ids).size === ids.length,
      "끌어올 적 선택을 확인하세요.",
    );
    const candidates = new Set(pullCandidates(s).map((e) => e.id));
    need(
      ids.every((id) => candidates.has(id)),
      "현재 무기로 끌어올 수 있는 2칸 이내의 적만 선택하세요.",
    );
    for (const id of ids) {
      const e = enemy(s, id);
      e.node = hunter(s).position;
      log(
        s,
        `장송의 칼날 · 공격 전: ${enemyDef(s, e).name}을 사냥꾼의 칸으로 이동시켰습니다.`,
      );
    }
  }
  function nearby(s, a, b) {
    return (
      sameTile(s, a, b) ||
      edges(s).some(
        ([x, y]) =>
          (sameTile(s, x, a) && sameTile(s, y, b)) ||
          (sameTile(s, y, a) && sameTile(s, x, b)),
      )
    );
  }
  function draw(s, count) {
    const h = hunter(s);
    for (let i = 0; i < count; i++) {
      if (!h.deck.length && h.discard.length) {
        h.deck = shuffle(s, h.discard);
        h.discard = [];
        log(s, "버린 스탯 카드를 섞어 덱을 다시 구성했습니다.");
      }
      if (!h.deck.length) break;
      h.hand.push(h.deck.shift());
    }
  }
  function drawConsumable(s) {
    if (!s.consumableDeck.length && s.consumableDiscard.length) {
      s.consumableDeck = shuffle(s, s.consumableDiscard);
      s.consumableDiscard = [];
      log(s, "버린 소모품을 섞어 소모품 덱을 다시 구성했습니다.");
    }
    const item = s.consumableDeck.shift();
    if (item) {
      hunter(s).consumables.push(item);
      log(s, `소모품 획득 · ${D.consumables[item.kind].name}.`);
    } else
      log(s, "소모품 덱과 버림 더미가 모두 비어 있어 획득하지 못했습니다.");
  }
  function consume(s, id, timing) {
    const h = hunter(s),
      i = h.consumables.findIndex((x) => x.id === id);
    need(i >= 0, "보유한 소모품을 선택하세요.");
    const item = h.consumables[i],
      def = D.consumables[item.kind];
    need(
      def.runtime === "playable",
      def.runtimeNote || "현재 사용할 수 없는 소모품입니다.",
    );
    need(def.timing === timing, "이 소모품의 사용 시점이 아닙니다.");
    h.consumables.splice(i, 1);
    s.consumableDiscard.push(item);
    log(s, `${def.name} 사용 · 소모품 버림 더미에 놓았습니다.`);
    return def.effects;
  }
  function attackConsumables(s, ids = []) {
    need(
      Array.isArray(ids) && new Set(ids).size === ids.length,
      "소모품 선택이 중복되었습니다.",
    );
    const bonus = {
      speed: 0,
      damage: 0,
      defense: 0,
      removeEnemyAttackEffects: false,
    };
    for (const id of ids) {
      const f = consume(s, id, "공격할 때");
      bonus.speed += f.speed || 0;
      bonus.damage += f.damage || 0;
      bonus.defense += f.defense || 0;
      bonus.removeEnemyAttackEffects ||= !!f.removeEnemyAttackEffects;
    }
    return bonus;
  }
  function useConsumable(s, a) {
    const h = hunter(s),
      f = consume(s, a.itemId, "사냥꾼의 차례");
    // dispatch works on a clone: any invalid target rolls back both the item and all effects.
    let target;
    if (f.target === "enemy" || f.target === "enemy-destination") {
      target = enemy(s, a.enemyId);
      need(
        target && distance(s, h.position, target.node) <= f.range,
        "효과 범위 안에 있는 적을 선택하세요.",
      );
      need(
        !f.nonBoss || !enemyDef(s, target).boss,
        "보스가 아닌 적을 선택하세요.",
      );
    }
    if (f.target === "slot") {
      need(
        Number.isInteger(a.slot) &&
          a.slot >= 0 &&
          a.slot < 3 &&
          h.slots[a.slot],
        "비울 카드가 있는 공격 슬롯을 선택하세요.",
      );
      clearSlot(s, a.slot);
    }
    if (f.target === "lamp") {
      need(node(s, a.node)?.lamp, "사용할 수 있는 등불 칸을 선택하세요.");
      teleport(s, a.node);
      log(s, `${node(s, a.node).name}(으)로 순간이동 · 추격 없음.`);
    }
    if (f.moveEnemy) {
      need(
        node(s, a.node) && distance(s, target.node, a.node) <= f.moveEnemy,
        "선택한 적으로부터 2칸 이내의 목적지를 선택하세요.",
      );
      need(path(s, target.node, a.node).every((at, i, p) => !i || !fogCrossing(s, p[i - 1], at)),
        "적은 안개 진입로를 통과할 수 없습니다.");
      target.node = a.node;
      log(s, `${enemyDef(s, target).name} 이동 → ${node(s, a.node).name}.`);
    }
    if (f.skipActivation && !s.skipActivation.includes(target.id))
      s.skipActivation.push(target.id);
    if (f.damage) {
      target.hp -= f.damage;
      log(s, `소모품 피해 ${f.damage}.`);
      kill(s, target);
    }
    if (f.draw) draw(s, f.draw);
    if (f.removeStatus) h.status[f.removeStatus] = false;
    if (f.heal) h.hp = Math.min(6, h.hp + f.heal);
    if (f.echoes) h.echoes = Math.min(3, h.echoes + f.echoes);
    if (f.readyFirearm) h.firearmReady = true;
    if (f.readyReward) {
      need(s.mission, "보상을 사용하는 긴 사냥 모드에서 골수 가루를 사용할 수 있습니다.");
      rewards.ready(s, a.rewardId, rewardHelpers());
    }
    if (f.move) {
      s.move = {
        remaining: f.move,
        path: [h.position],
        chasers: [],
        source: "consumable",
      };
      s.phase = "move";
      log(s, "푸른 비약 · 이동 2 시작. 이동을 마치면 추격을 처리합니다.");
    }
  }
  function take(s, id) {
    const h = hunter(s),
      i = h.hand.findIndex((c) => c.id === id);
    need(i >= 0, "손에 있는 스탯 카드를 선택하세요.");
    return h.hand.splice(i, 1)[0];
  }
  function pay(s, id) {
    const c = take(s, id);
    hunter(s).discard.push(c);
    return c;
  }
  function clearSlot(s, index) {
    const h = hunter(s);
    if (h.slots[index]) {
      h.discard.push(h.slots[index]);
      h.slots[index] = null;
    }
  }
  function allCards(h) {
    return [...h.deck, ...h.hand, ...h.discard, ...h.slots.filter(Boolean)];
  }
  function eligible(s) {
    const h = hunter(s);
    if (h.inDream) return [];
    const a = s.enemies.filter(
      (e) =>
        !s.activation.includes(e.id) &&
        !s.skipActivation.includes(e.id) &&
        nearby(s, e.node, h.position) && !fogCrossing(s, e.node, h.position),
    );
    if (!a.length) return a;
    const min = Math.min(...a.map((e) => enemyDef(s, e).order));
    return a.filter((e) => enemyDef(s, e).order === min);
  }
  function continueActivation(s) {
    if (hunter(s).inDream) return;
    const options = eligible(s);
    if (options.length === 1) activateEnemy(s, options[0]);
    else if (options.length) s.phase = "activation";
    else nextRound(s);
  }
  function exportSave(s) {
    assertState(s);
    return JSON.stringify(
      { format: "bloodborne-hunt-save", version: 1, state: s },
      null,
      2,
    );
  }
  function canonical(x) {
    if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
    if (x && typeof x === "object")
      return (
        "{" +
        Object.keys(x)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(x[k]))
          .join(",") +
        "}"
      );
    return JSON.stringify(x);
  }
  function importSave(text) {
    need(
      typeof text === "string" && text.length < 2000000,
      "저장 파일은 2MB 이하여야 합니다.",
    );
    const p = JSON.parse(text);
    need(
      p.format === "bloodborne-hunt-save" && p.version === 1,
      "지원하지 않는 저장 형식입니다.",
    );
    assertState(p.state);
    let verified = create(
      p.state.initialSeed,
      p.state.setup.weaponId,
      p.state.setup.face,
      p.state.setup.startingConsumable,
      p.state.setup.firearmId,
      p.state.setup.startSpace,
      { campaign: !!p.state.setup.campaign, provisional: p.state.setup.provisional },
    );
    for (const command of p.state.commands)
      verified = dispatch(verified, command);
    need(
      canonical(verified) === canonical(p.state),
      "저장 상태가 명령 기록과 일치하지 않습니다. 손상되거나 수동 편집된 파일인지 확인하세요.",
    );
    return verified;
  }
  function enemyDef(s, e) {
    const kind = typeof e === "string" ? e : e.kind;
    if (typeof e === "object" && e.provisionalKind) {
      const order = s.world.assignments.find((a) => a.enemyId === kind).slot;
      return temporary.definition(e.provisionalKind, e.provisionalPhase, order);
    }
    const a = s.world.assignments.find((a) => a.enemyId === kind),
      base = D.enemies[kind];
    const face = base.sides.find((f) => f.id === a.sideId);
    const convert = (x, kind) => ({
      name: x.name,
      speed: x.speed,
      damage: x.damage,
      kind,
      type: "attack",
      stun: x.keywords.includes("기절"),
      interrupt: x.keywords.includes("방해"),
      undodgeable: x.keywords.includes("회피할 수 없습니다."),
      uninterruptible: x.keywords.includes("방해할 수 없습니다."),
      rules: x.rules,
      followup:
        kind === "special" && base.id === "scourge-beast" && face.id === "b",
    });
    const ability = {
      ...face.ability,
      kind: "ability",
      type: "ability",
      text: face.ability.rules.join(" "),
      code: kind + ":" + face.id,
      dodgeSpeed:
        kind === "huntsman-mob" && face.id === "b"
          ? 2
          : kind === "huntsmans-minion" && face.id === "a"
            ? 1
            : null,
    };
    return missions.targetDef(s, typeof e === "string" ? null : e, {
      ...base,
      maxHp: base.health,
      order: a.slot,
      sideId: a.sideId,
      face,
      move: base.movementOverride?.activation || 1,
      pursuit: base.movementOverride?.pursuit || 1,
      basic: convert(face.basicAttack, "basic"),
      special: convert(face.specialAttack, "special"),
      ability,
    });
  }
  function nameAt(s, id) {
    return node(s, id)?.name || "사냥꾼의 꿈";
  }
  function spawnOnTile(s, p) {
    for (const space of M.tile(p.tileId).spaces)
      for (const icon of space.icons) {
        const at = p.tileId + ":" + space.id;
        if (icon.kind === "consumable")
          for (let i = 0; i < icon.count; i++) s.loot.push(at);
        if (icon.kind === "spawn" && !s.provisional && !missions.fogged(s, p.tileId))
          for (let i = 0; i < icon.count; i++)
            s.spawnQueue.push({
              kind: s.world.assignments.find((a) => a.marker === icon.markerId)
                .enemyId,
              node: at,
            });
      }
  }
  function farthest(s, kind) {
    const figures = s.enemies.filter((e) => e.kind === kind && !e.missionId),
      h = hunter(s);
    const measure = (e) =>
      h.inDream ? Infinity : distance(s, h.position, e.node);
    const max = Math.max(...figures.map(measure));
    return figures.filter((e) => measure(e) === max);
  }
  function spawnFigure(s, job, figure) {
    const old = s.enemies.find(
      (e) => e.kind === job.kind && e.figure === figure,
    );
    s.activation = s.activation.filter((id) => id !== job.kind + "-" + figure);
    s.skipActivation = s.skipActivation.filter(
      (id) => id !== job.kind + "-" + figure,
    );
    if (old) {
      old.node = job.node;
      old.hp = enemyDef(s, old).maxHp;
      if (job.missionId) old.missionId = job.missionId;
      log(
        s,
        `${enemyDef(s, old).name} #${figure} 재출현 · 가장 먼 피규어 재사용, 체력 회복.`,
      );
    } else {
      s.enemies.push({
        id: job.kind + "-" + figure,
        kind: job.kind,
        figure,
        node: job.node,
        hp: D.enemies[job.kind].health,
        ...(job.missionId ? { missionId: job.missionId } : {}),
      });
      log(s, `${D.enemies[job.kind].name} #${figure} 출현.`);
    }
    if (job.missionId) s.mission.targets[job.missionId].enemyId = job.kind + "-" + figure;
  }
  function finishSpawns(s) {
    while (s.spawnQueue.length) {
      if (!s.spawnQueue[0].missionId && missions.fogged(s, node(s, s.spawnQueue[0].node)?.tile)) {
        s.spawnQueue.shift();
        log(s, "안개 진입로 · 일반 적의 출현을 막았습니다.");
        continue;
      }
      const job = s.spawnQueue[0],
        free = [1, 2, 3, 4].find(
          (n) => !s.enemies.some((e) => e.kind === job.kind && e.figure === n),
        );
      if (free) {
        s.spawnQueue.shift();
        spawnFigure(s, job, free);
      } else {
        const candidates = farthest(s, job.kind);
        if (candidates.length > 1) {
          s.phase = "spawn_choice";
          s.spawnChoices = candidates.map((e) => e.id);
          return;
        }
        s.spawnQueue.shift();
        spawnFigure(s, job, candidates[0].figure);
      }
    }
    s.spawnChoices = [];
    const after = s.spawnAfter;
    s.spawnAfter = null;
    resume(s, after);
  }
  function resetMap(s, after) {
    s.enemies = [];
    spawnProvisional(s);
    s.skipActivation = [];
    s.loot = [];
    s.spawnQueue = [];
    s.spawnQueue.push(...missions.reset(s, missionHelpers()));
    for (const p of s.world.tiles) spawnOnTile(s, p);
    const h = hunter(s);
    s.spawnQueue.sort(
      (a, b) =>
        (Number(!!b.missionId) - Number(!!a.missionId)) || (h.inDream
          ? 0
          : distance(s, h.position, a.node) -
            distance(s, h.position, b.node)) ||
        s.world.assignments.find((x) => x.enemyId === a.kind).slot -
          s.world.assignments.find((x) => x.enemyId === b.kind).slot,
    );
    log(
      s,
      "지도 초기화 · 가까운 출현 지점부터 적과 소모품을 복원합니다. 면·슬롯·행동 덱은 유지합니다.",
    );
    s.spawnAfter = after;
    finishSpawns(s);
  }
  function advance(s, reason, after) {
    s.track = Math.min(D.track.length, s.track + 1);
    log(s, `사냥 트랙 ${s.track}/${D.track.length} · ${reason}`);
    if (D.track.resets.includes(s.track)) resetMap(s, after);
    else resume(s, after);
  }
  function nextRound(s) {
    if (s.mission?.won && !s.mission.chapterDream) { beginChapterDream(s); return; }
    if (s.lastRound) {
      s.phase = "over";
      s.result = "loss";
      log(s, "사냥 트랙의 마지막 라운드가 끝났습니다.");
      return;
    }
    s.round++;
    s.activation = [];
    s.skipActivation = [];
    s.clinicUsed = false;
    advance(s, "새 라운드", { type: "round_ready" });
  }
  function finishDream(s) {
    const h = hunter(s);
    h.deck = shuffle(s, h.deck);
    h.hp = 6;
    h.status = { poison: false, frenzy: false };
    h.firearmReady = true;
    s.dream = null;
    log(s, "사냥꾼의 꿈에서 체력·화기·상태 이상을 회복했습니다.");
    if (s.mission?.chapterDream) {
      s.phase = "over"; s.result = "chapter-win";
      log(s, "챕터 1 완료 · 성장·소모품·보상·화기·계몽을 저장해 다음 챕터 준비를 기다립니다.");
      return;
    }
    nextRound(s);
  }
  function beginChapterDream(s) {
    if (!s.mission?.won || s.mission.chapterDream) return;
    s.mission.chapterDream = true;
    enterDream(s, false);
  }
  function enterDream(s, dead) {
    const h = hunter(s);
    if (s.mission?.won) s.mission.chapterDream = true;
    const savedCredit = s.mission ? rewards.onDream(s, dead, rewardHelpers()) : 0;
    missions.onTeleport(s, missionHelpers());
    if (dead) {
      h.echoes = 0;
      log(s, "처치당했습니다. 모든 피의 유지를 잃고 꿈에 입장합니다.");
    } else log(s, "사냥꾼의 꿈에 입장합니다.");
    const credit = h.echoes + savedCredit;
    h.echoes = 0;
    h.inDream = true;
    h.position = null;
    h.deck = allCards(h);
    h.hand = [];
    h.discard = [];
    h.slots = [null, null, null];
    s.combat = null;
    s.move = null;
    s.interaction = null;
    s.enemyMove = null;
    s.cardChoices = [];
    s.freeTransform = null;
    s.activation = [];
    s.leap = null;
    if (s.mission) s.mission.deathPending = false;
    s.dream = { credit, purchased: [] };
    if (s.mission?.chapterDream) resume(s, { type: "dream_shop" });
    else advance(s, "사냥꾼의 꿈 입장", { type: "dream_shop" });
  }
  function canLeave(s, from) {
    return (
      node(s, from)?.tile !== "tile-18" ||
      !s.enemies.some((e) => e.node === from)
    );
  }
  function stepHunter(s, to) {
    const h = hunter(s),
      prev = h.position;
    need(canLeave(s, prev), "대교에서 적과 같은 칸을 벗어날 수 없습니다.");
    need(neighbors(s, prev).includes(to), "인접한 칸으로만 이동하세요.");
    need(!missions.fogged(s, node(s, prev).tile) || sameTile(s, prev, to),
      "안개 진입로를 걸어서 벗어날 수 없습니다. 임무를 완수하거나 꿈에 입장하세요.");
    for (const e of s.enemies)
      if (
        e.node === prev ||
        (sameTile(s, e.node, prev) && !sameTile(s, prev, to))
      ) {
        if (!s.move.chasers.some((x) => x.enemyId === e.id))
          s.move.chasers.push({
            enemyId: e.id,
            anchor: prev,
            trailIndex: s.move.path.length - 1,
          });
      }
    missions.onStep(s, prev, to, missionHelpers());
    h.position = to;
    s.move.path.push(to);
    s.move.remaining--;
    log(s, `${nameAt(s, to)} 이동 · 남은 이동력 ${s.move.remaining}.`);
    if (!s.move.remaining) finishMove(s);
    else s.phase = "move";
  }
  function explore(s, edge, survivorNode = null) {
    const h = hunter(s);
    need(
      survivorNode || canLeave(s, h.position),
      "대교에서 적과 같은 칸을 벗어날 수 없습니다.",
    );
    const anchor = M.openExits(s.world).find(
      (e) => e.node === (survivorNode || h.position) && e.edge === edge,
    );
    need(anchor, "현재 칸의 열린 출입구를 선택하세요.");
    need(s.world.tileDeck.length, "남은 타일이 없습니다.");
    let next;
    const rejected = [],
      needsExit = s.world.tileDeck.length > 1;
    while (s.world.tileDeck.length) {
      const id = s.world.tileDeck.shift();
      if (missions.placementOptions(s, missionHelpers(), { tileId: id, anchor,
        ...(survivorNode ? { survivor: true } : {}) }, needsExit).length) {
        next = id;
        break;
      }
      rejected.push(id);
    }
    need(next, "출입구를 유지할 수 있는 타일이 없습니다.");
    if (rejected.length) {
      s.world.tileDeck = shuffle(s, [...s.world.tileDeck, ...rejected]);
      log(s, "모든 출입구를 막는 타일을 더미에 돌려 섞었습니다.");
    }
    need(survivorNode || !missions.fogged(s, node(s, h.position).tile),
      "안개 진입로를 탐험으로 벗어날 수 없습니다.");
    s.world.pending = { tileId: next, anchor, ...(survivorNode ? { survivor: true } : {}) };
    s.phase = "tile_place";
    log(s, `${M.tile(next).displayName} 공개 · 회전 방향을 선택하세요.`);
  }
  function placeTile(s, rotation) {
    const p = s.world.pending;
    need(
      p && missions.placementOptions(s, missionHelpers()).includes(rotation),
      "연결 가능한 방향을 선택하세요.",
    );
    const [dx, dy] = M.vectors[p.anchor.edge],
      t = {
        tileId: p.tileId,
        x: p.anchor.x + dx,
        y: p.anchor.y + dy,
        rotation,
      };
    s.world.tiles.push(t);
    s.world.pending = null;
    spawnOnTile(s, t);
    const opposite = { N: "S", S: "N", W: "E", E: "W" }[p.anchor.edge],
      entry = M.exits(t).find((e) => e.edge === opposite).node;
    s.spawnAfter = { type: p.survivor ? "survivor_entry" : "tile_entry", node: entry };
    finishSpawns(s);
  }
  function moveOptions(s) {
    const m = s.enemyMove,
      e = enemy(s, m.enemyId);
    if (!e) return [];
    const d = distance(s, e.node, m.anchor);
    if (m.mode === "toward")
      return neighbors(s, e.node).filter((n) => !fogCrossing(s, e.node, n)).filter(
        (n) => distance(s, n, m.anchor) === d - 1,
      );
    if (m.mode === "away")
      return neighbors(s, e.node).filter((n) => !fogCrossing(s, e.node, n) && distance(s, n, m.anchor) > d);
    if (m.mode === "pursuit") {
      const route = m.route;
      if (e.node === m.anchor && route.length > 1) return fogCrossing(s, e.node, route[1]) ? [] : [route[1]];
      return neighbors(s, e.node).filter((n) => !fogCrossing(s, e.node, n)).filter(
        (n) => distance(s, n, m.anchor) === d - 1,
      );
    }
    return [];
  }
  function takeEnemyStep(s, to) {
    const m = s.enemyMove,
      e = enemy(s, m.enemyId),
      prev = e.node;
    e.node = to;
    if (m.mode === "pursuit" && s.move && to === hunter(s).position)
      s.move.pursuedIntoEnd = true;
    m.remaining--;
    if (m.mode === "pursuit" && prev === m.anchor && m.route.length > 1) {
      m.route.shift();
      m.anchor = m.route[0];
    }
    if (m.drag && hunter(s).position === prev) hunter(s).position = to;
    log(
      s,
      `${enemyDef(s, e).name} → ${nameAt(s, to)}${m.drag ? " · 사냥꾼도 이동" : ""}.`,
    );
  }
  function runEnemyMove(s) {
    const m = s.enemyMove,
      e = enemy(s, m.enemyId);
    while (e && m.remaining > 0) {
      if (m.mode !== "away" && e.node === hunter(s).position) break;
      const options = moveOptions(s);
      if (!options.length) break;
      if (options.length > 1) {
        s.phase = "enemy_path";
        return;
      }
      takeEnemyStep(s, options[0]);
    }
    const after = m.after;
    s.enemyMove = null;
    resume(s, after);
  }
  function activateEnemy(s, e) {
    s.activation.push(e.id);
    s.enemyMove = {
      enemyId: e.id,
      remaining: enemyDef(s, e).move,
      mode: "toward",
      anchor: hunter(s).position,
      after: { type: "activation_attack", enemyId: e.id },
    };
    runEnemyMove(s);
  }
  function finishMove(s) {
    s.move.pursuitQueue = [...s.move.chasers];
    continuePursuit(s);
  }
  function continuePursuit(s) {
    const m = s.move;
    while (m.pursuitQueue.length) {
      const ch = m.pursuitQueue.shift(),
        e = enemy(s, ch.enemyId);
      if (!e || e.node === hunter(s).position) continue;
      s.enemyMove = {
        enemyId: e.id,
        remaining: enemyDef(s, e).pursuit,
        mode: "pursuit",
        anchor: ch.anchor,
        route: m.path.slice(ch.trailIndex),
        after: { type: "pursuit" },
      };
      runEnemyMove(s);
      return;
    }
    const moved = m.path.length > 1;
    s.move = null;
    s.phase = "hunter";
    if (moved) missions.onMovementEnd(s, !!m.pursuedIntoEnd, missionHelpers());
    if (s.leap) {
      const a = s.leap;
      s.leap = null;
      const e = enemy(s, a.enemyId);
      if (!e || e.node !== hunter(s).position) {
        s.phase = "hunter";
        log(
          s,
          "도약 이동 종료 · 대상과 같은 칸이 아니므로 공격할 수 없습니다.",
        );
        return;
      }
      chooseCombat(s, e.id, "hunter");
      commitAttack(s, a.cardId, a.slot, a.itemIds, a.rewardIds);
      return;
    }
    if (s.phase !== "mission_choice") s.phase = "hunter";
    log(s, "이동과 추격을 마쳤습니다.");
  }
  function resume(s, a) {
    if (!a) return;
    if (a.type === "mission_phase") { s.phase = a.phase; return; }
    if (a.type === "mission_hunter") { s.phase = "hunter"; return; }
    if (a.type === "mission_activation") { continueActivation(s); return; }
    if (a.type === "survivor_entry") { missions.survivorEntry(s, a.node, missionHelpers()); return; }
    if (a.type === "mission_death_done") {
      if (a.freeTransform) { offerTransform(s, { type: "mission_death_done" }); return; }
      const after = s.mission.deathAfter; s.mission.deathAfter = null;
      resume(s, after || { type: "mission_hunter" }); return;
    }
    if (a.type === "tile_entry") {
      stepHunter(s, a.node);
      return;
    }
    if (a.type === "round_ready") {
      s.lastRound = s.track === D.track.length;
      s.phase = "refill";
      return;
    }
    if (a.type === "dream_shop") {
      if (s.dream.credit) s.phase = "upgrade_pick";
      else finishDream(s);
      return;
    }
    if (a.type === "activation_attack") {
      const e = enemy(s, a.enemyId);
      if (e && e.node === hunter(s).position)
        chooseCombat(s, e.id, "activation");
      else continueActivation(s);
      return;
    }
    if (a.type === "pursuit") {
      continuePursuit(s);
      return;
    }
    if (a.type === "combat") {
      resolve(s);
      return;
    }
    if (a.type === "ability_damage") {
      abilityDamage(s);
      return;
    }
    if (a.type === "attack_ready") {
      reveal(s);
      return;
    }
    if (a.type === "dodge_ready") {
      afterDodge(s, a);
      return;
    }
    if (a.type === "react") {
      s.phase = "combat_react";
      return;
    }
    if (a.type === "extra_done") {
      resolve(s);
      return;
    }
    if (a.type === "end_combat") {
      finishCombatOrigin(s, a.origin);
      return;
    }
    fail("지원하지 않는 이어가기 단계.");
  }

  function chooseCombat(s, id, origin) {
    s.combat = {
      enemyId: id,
      origin,
      attack: null,
      action: null,
      dodged: false,
      shot: false,
      cancelHunter: false,
      cancelEnemy: false,
      groups: null,
      index: 0,
      history: [],
      buff: { speed: 0, damage: 0, interrupt: false },
      immune: [],
      defense: 0,
      pending: [],
      extra: null,
      noDodge: false,
    };
    s.phase = "combat_choose";
  }
  function kill(s, e) {
    if (e.hp > 0) return;
    if (e.provisionalKind) {
      const phases = temporary.specimens[e.provisionalKind].phases;
      if (e.provisionalPhase < phases.length) {
        e.provisionalPhase++;
        s.provisional.phase = e.provisionalPhase;
        e.hp = enemyDef(s, e).maxHp;
        log(s, "임시 성직자 야수 · 2단계로 전환하고 체력을 회복합니다.");
        return;
      }
      s.provisional.finished = true;
    }
    if (missions.beforeKill(s, e, missionHelpers())) return;
    s.enemies = s.enemies.filter((x) => x.id !== e.id);
    const h = hunter(s);
    h.echoes = Math.min(3, h.echoes + 1);
    s.kills++;
    log(s, `${enemyDef(s, e).name} 처치 · 피의 유지 +1 (최대 3).`);
    const reward = s.combat?.attack?.onKill;
    if (reward && h.hp > 0) {
      draw(s, reward.draw);
      h.hp = Math.min(6, h.hp + reward.heal);
      log(s, "피의 갈망 · 카드 1장, 치유 1.");
    }
    missions.onKill(s, e, missionHelpers());
    if (s.mission) rewards.onKill(s, rewardHelpers());
  }
  function place(s, id, index, replacement = null) {
    const h = hunter(s);
    need(
      Number.isInteger(index) && index >= 0 && index < 3 && !h.slots[index],
      "빈 공격 슬롯을 선택하세요.",
    );
    const x = take(s, id),
      def = replacement || card(x);
    h.slots[index] = x;
    if (def.draw) draw(s, def.draw);
    if (def.heal) h.hp = Math.min(6, h.hp + def.heal);
    if (def.clear) clearSlot(s, index);
    if (s.combat) {
      s.combat.defense += def.defense || 0;
      s.combat.immune = [
        ...new Set([...s.combat.immune, ...(def.immune || [])]),
      ];
    }
    if (def.clearChoice) s.cardChoices.push({ type: "clear-slot" });
    if (def.discardAfterDraw) s.cardChoices.push({ type: "discard" });
    if (def.removeStatus) s.cardChoices.push({ type: "status" });
    return x;
  }
  function finishCardChoices(s, after) {
    if (after) s.cardAfter = after;
    const h = hunter(s);
    while (s.cardChoices.length) {
      const q = s.cardChoices[0];
      const options =
        q.type === "clear-slot"
          ? h.slots.map((x, i) => (x ? i : null)).filter((x) => x !== null)
          : q.type === "discard"
            ? h.hand.map((x) => x.id)
            : Object.keys(h.status).filter((k) => h.status[k]);
      if (!options.length) {
        s.cardChoices.shift();
        continue;
      }
      if (options.length > 1) {
        s.phase = "card_choice";
        return;
      }
      applyCardChoice(s, options[0]);
    }
    const a = s.cardAfter;
    s.cardAfter = null;
    resume(s, a);
  }
  function applyCardChoice(s, value) {
    const q = s.cardChoices.shift(),
      h = hunter(s);
    if (q.type === "clear-slot") {
      need(
        Number.isInteger(value) && !!h.slots[value],
        "비울 슬롯을 선택하세요.",
      );
      clearSlot(s, value);
    }
    if (q.type === "discard") {
      pay(s, value);
      log(s, "끈기 · 뽑은 뒤 카드 1장을 버렸습니다.");
    }
    if (q.type === "status") {
      need(
        ["poison", "frenzy"].includes(value) && h.status[value],
        "제거할 상태 이상을 선택하세요.",
      );
      h.status[value] = false;
    }
  }
  function commitAttack(s, id, index, itemIds, rewardIds) {
    const slot = slots(s)[index];
    need(slot, "공격 슬롯을 선택하세요.");
    const rewardBonus = s.mission ? rewards.attackBonus(s, index, rewardIds || [], rewardHelpers()) : {},
      replacement = rewardBonus.replaceCardEffects ? {} : null,
      bonus = attackConsumables(s, itemIds),
      x = place(s, id, index, replacement),
      def = replacement ? { ...replacement, name: card(x).name } : card(x),
      c = s.combat;
    c.attack = {
      name: slot.name,
      speed: slot.speed + (def.speed || 0) + bonus.speed + (rewardBonus.speed || 0),
      damage: slot.damage + (def.damage || 0) + bonus.damage + (rewardBonus.damage || 0),
      interrupt: !!def.interrupt || !!rewardBonus.interrupt,
      splash: weaponFace(s).splash ? clone(weaponFace(s).splash) : null,
      afterAttackHeal: def.afterAttackHeal || 0,
      onKill: def.onKill || null,
      freeTransform: !!def.freeTransform,
    };
    c.defense += bonus.defense;
    c.removeEnemyAttackEffects = bonus.removeEnemyAttackEffects;
    log(
      s,
      `${def.name} → ${slot.name} (속도 ${c.attack.speed}, 피해 ${c.attack.damage}).`,
    );
    finishCardChoices(s, { type: "attack_ready" });
  }
  function reveal(s) {
    const c = s.combat,
      e = enemy(s, c.enemyId);
    if (!e) {
      endCombat(s);
      return;
    }
    const kind = enemyDeck.draw(s, shuffle),
      d = enemyDef(s, e);
    c.action = clone(d[kind]);
    c.history.push({ kind, name: c.action.name });
    log(
      s,
      `${d.name} ${d.temporary ? s.provisional.phase + "단계" : d.sideId.toUpperCase() + "면"} · ${enemyDeck.labels[kind]}: ${c.action.name}.`,
    );
    if (kind === "ability" && c.action.type === "ability") {
      c.abilityPending = true;
      c.abilityReactionOffered = false;
      if (
        c.action.speed === null &&
        hunter(s).hand.some((x) => card(x).cheapShot) &&
        e.node === hunter(s).position
      ) {
        c.cheapShotAfter = "instant";
        s.phase = "cheap_shot";
        return;
      }
      resolveRevealedAbility(s);
      return;
    }
    c.action.speed = Math.max(
      0,
      c.action.speed +
        c.buff.speed -
        (node(s, e.node).tile === "tile-17" && e.missionId !== "shelter" ? 1 : 0),
    );
    c.action.damage += c.buff.damage;
    c.action.interrupt ||= c.buff.interrupt;
    if (c.removeEnemyAttackEffects) {
      for (const k of [
        "stun",
        "interrupt",
        "undodgeable",
        "uninterruptible",
        "followup",
      ])
        c.action[k] = false;
      log(s, "마비 안개 · 공격 효과 제거. 속도와 피해는 유지합니다.");
    }
    s.phase = "combat_react";
  }
  function resolveRevealedAbility(s) {
    const c = s.combat,
      e = enemy(s, c.enemyId);
    if (!e) {
      endCombat(s);
      return;
    }
    c.abilityPending = false;
    const code = c.action.code;
    if (code === "huntsman-mob:a") {
      c.buff.speed++;
      c.buff.damage++;
      log(
        s,
        "발광한 무리 · 다음 공격 속도 +1, 피해 +1. 다른 행동 카드를 공개합니다.",
      );
      reveal(s);
    } else if (code === "scourge-beast:b") {
      c.buff.damage++;
      c.buff.interrupt = true;
      log(
        s,
        "날것 그대로의 분노 · 다음 공격 피해 +1, 방해. 다른 행동 카드를 공개합니다.",
      );
      reveal(s);
    } else if (code === "huntsmans-minion:b") {
      if (hunter(s).hand.length) s.phase = "ability_choice";
      else {
        applyBrickPenalty(s);
        reveal(s);
      }
    } else s.phase = "combat_react";
  }
  function applyBrickPenalty(s) {
    const c = s.combat;
    if (c.attack) c.attack.speed = Math.max(0, c.attack.speed - 2);
    c.noDodge = true;
    log(s, "벽돌 후려갈기기 · 이번 전투 공격 속도 -2, 회피 불가.");
  }
  function canDodge(s, id, index, extra = false) {
    const c = s.combat,
      h = hunter(s),
      x = h.hand.find((x) => x.id === id),
      def = x && card(x),
      slot = slots(s)[index];
    if (
      !c ||
      !x ||
      !def.dodge ||
      !slot ||
      h.slots[index] ||
      c.origin === "interaction" ||
      c.noDodge
    )
      return false;
    if (extra)
      return (
        s.phase === "combat_extra" &&
        slot.speed + (def.speed || 0) >= c.extra.dodgeSpeed
      );
    if (s.phase !== "combat_react" || c.dodged || !enemy(s, c.enemyId))
      return false;
    const speed =
      c.action.type === "ability" ? c.action.dodgeSpeed : c.action.speed;
    return (
      speed !== null &&
      speed !== undefined &&
      !c.action.undodgeable &&
      !(c.cancelEnemy && c.action.type === "attack") &&
      slot.speed + (def.speed || 0) >= speed
    );
  }
  function dodge(s, a, extra = false) {
    need(
      canDodge(s, a.cardId, a.slot, extra),
      "회피 가능한 카드·속도·빈 슬롯을 선택하세요.",
    );
    const x = place(s, a.cardId, a.slot),
      def = card(x),
      c = s.combat;
    if (extra) c.extra = null;
    else c.dodged = true;
    log(
      s,
      extra
        ? "추가 타격을 별도로 회피했습니다."
        : "회피 · 사냥꾼에게 직접 적용되는 피해와 효과를 피합니다.",
    );
    finishCardChoices(s, {
      type: "dodge_ready",
      extra,
      damage: def.afterDodgeDamage || 0,
      freeTransform: !!def.freeTransform,
    });
  }
  function afterDodge(s, a) {
    const c = s.combat,
      e = enemy(s, c.enemyId);
    if (s.mission) rewards.onDodge(s, rewardHelpers());
    if (a.damage && e) {
      e.hp -= a.damage;
      log(s, `반격 · 적에게 ${a.damage} 피해.`);
      kill(s, e);
    }
    const after = a.extra ? { type: "extra_done" } : { type: "react" };
    if (a.freeTransform) {
      offerTransform(s, after);
      return;
    }
    if (!enemy(s, c.enemyId) && !a.extra) {
      endCombat(s);
      return;
    }
    resume(s, after);
  }
  function offerTransform(s, after) {
    s.freeTransform = after;
    s.phase = "free_transform";
  }
  function takeDamage(s, n, label, attack = false) {
    const h = hunter(s),
      c = s.combat,
      amount = Math.max(
        0,
        n + (attack && h.status.frenzy ? 1 : 0) - (c?.defense || 0),
      );
    h.hp = Math.max(0, h.hp - amount);
    log(s, `${label} · 사냥꾼에게 ${amount} 피해.`);
  }
  function pendingCombat(s) {
    const c = s.combat,
      h = hunter(s);
    while (c.pending.length) {
      const q = c.pending.shift();
      if (q.type === "stun" && !c.immune.includes("stun")) {
        if (h.hand.length) {
          s.phase = "stun";
          return false;
        }
        h.hp = Math.max(0, h.hp - 1);
        log(s, "기절 · 버릴 카드가 없어 피해 1.");
        if (h.hp <= 0) {
          enterDream(s, true);
          return false;
        }
      }
      if (q.type === "extra") {
        c.extra = { damage: 2, dodgeSpeed: 2 };
        if (c.origin === "interaction" || c.noDodge) {
          takeDamage(s, 2, "다단 가르기 추가 피해", false);
          c.extra = null;
          if (h.hp <= 0) {
            enterDream(s, true);
            return false;
          }
          continue;
        }
        s.phase = "combat_extra";
        return false;
      }
      if (q.type === "transform") {
        offerTransform(s, { type: "combat" });
        return false;
      }
    }
    return true;
  }
  function runTimedAbility(s) {
    const c = s.combat,
      e = enemy(s, c.enemyId);
    if (!e) {
      resolve(s);
      return;
    }
    if (
      !c.abilityReactionOffered &&
      hunter(s).hand.some((x) => card(x).cheapShot) &&
      e.node === hunter(s).position
    ) {
      c.abilityReactionOffered = true;
      c.cheapShotAfter = "timed";
      s.phase = "cheap_shot";
      return;
    }
    const code = c.action.code;
    c.abilityFrom = e.node;
    c.abilityTargeted = hunter(s).position === e.node;
    if (code === "scourge-beast:a") {
      s.spawnQueue.push({ kind: "scourge-beast", node: e.node });
      s.spawnAfter = { type: "combat" };
      finishSpawns(s);
      return;
    }
    const dash = code === "huntsmans-minion:a";
    s.enemyMove = {
      enemyId: e.id,
      remaining: dash ? 2 : 1,
      mode: "away",
      anchor: e.node,
      drag: dash && !c.dodged && hunter(s).position === e.node,
      after: { type: "ability_damage" },
    };
    runEnemyMove(s);
  }
  function abilityDamage(s) {
    const c = s.combat,
      h = hunter(s),
      dash = c.action.code === "huntsmans-minion:a";
    if (
      !c.dodged &&
      c.abilityTargeted &&
      (dash || h.position === c.abilityFrom)
    ) {
      takeDamage(s, 3, c.action.name, false);
      if (dash) c.pending.push({ type: "stun" });
      if (h.hp <= 0) {
        enterDream(s, true);
        return;
      }
    } else
      log(
        s,
        `${c.action.name} · 직접 피해를 피했습니다. 적의 이동은 유지합니다.`,
      );
    resolve(s);
  }
  function finishCombatOrigin(s, origin) {
    if (s.provisional?.finished) {
      s.phase = "over"; s.result = "provisional-win"; return;
    }
    if (s.mission?.deathPending) {
      offerDeathReaction(s, { type: "end_combat", origin }); return;
    }
    if (s.mission?.won) { beginChapterDream(s); return; }
    if (origin === "activation") continueActivation(s);
    else if (origin === "interaction") nextInteraction(s);
    else s.phase = "hunter";
  }
  function endCombat(s) {
    const origin = s.combat.origin;
    s.combat = null;
    finishCombatOrigin(s, origin);
  }
  function offerDeathReaction(s, after) {
    s.mission.deathPending = false; s.mission.deathAfter = after;
    s.phase = "mission_death";
    log(s, "포악한 야수 처치 · 속도 1로 회피하거나 피해 3을 받으세요.");
  }
  function deathDodgePossible(s, id, index) {
    const h = hunter(s), x = h.hand.find((x) => x.id === id), d = x && card(x), slot = slots(s)[index];
    return s.phase === "mission_death" && d?.dodge && slot && !h.slots[index] && slot.speed + (d.speed || 0) >= 1;
  }
  function resolve(s) {
    const c = s.combat;
    if (!c || hunter(s).inDream) return;
    if (!pendingCombat(s)) return;
    if (!c.groups) {
      const speeds = [
        ...(c.attack ? [c.attack.speed] : []),
        ...(c.action.speed !== null ? [c.action.speed] : []),
      ];
      c.groups = [...new Set(speeds)]
        .sort((a, b) => b - a)
        .flatMap((speed) => [
          ...(c.action.type === "ability" && c.action.speed === speed
            ? [{ speed, ability: true }]
            : []),
          { speed, ability: false },
        ]);
    }
    while (c.index < c.groups.length) {
      const group = c.groups[c.index++],
        h = hunter(s),
        e = enemy(s, c.enemyId);
      if (!e) {
        endCombat(s);
        return;
      }
      if (group.ability) {
        runTimedAbility(s);
        return;
      }
      const speed = group.speed,
        ha = !!(c.attack && c.attack.speed === speed && !c.cancelHunter),
        enemyTiming = c.action.type === "attack" && c.action.speed === speed,
        ea = enemyTiming && !c.cancelEnemy && !c.dodged,
        shared = e.node === h.position;
      if (enemyTiming && e.missionId === "shelter" && c.action.kind === "special")
        c.action.damage = (e.hp < enemyDef(s, e).maxHp ? 4 : 2) + c.buff.damage;
      // Snapshot both hits before changes for same-speed combat.
      if (ha) {
        if (shared) {
          e.hp -= c.attack.damage;
          log(s, `${c.attack.name} · 적에게 ${c.attack.damage} 피해.`);
        } else
          log(
            s,
            `${c.attack.name} · 대상이 다른 칸에 있어 직접 피해가 닿지 않습니다.`,
          );
        if (c.attack.splash)
          for (const other of s.enemies.filter(
            (x) =>
              x.id !== e.id &&
              distance(s, h.position, x.node) <= c.attack.splash.range,
          )) {
            other.hp -= c.attack.splash.damage;
            log(
              s,
              `장송의 칼날 범위 피해 · ${enemyDef(s, other).name}에게 1 피해.`,
            );
          }
        if (
          shared &&
          c.attack.interrupt &&
          c.action.type === "attack" &&
          speed > c.action.speed &&
          !c.action.uninterruptible
        ) {
          c.cancelEnemy = true;
          log(s, "방해 · 더 느린 적 공격 취소.");
        }
      }
      if (ea && shared) {
        takeDamage(s, c.action.damage, c.action.name, true);
        if (
          c.action.interrupt &&
          c.attack &&
          speed > c.attack.speed &&
          !c.immune.includes("interrupt")
        ) {
          c.cancelHunter = true;
          log(s, "적의 방해 · 사냥꾼 공격 취소.");
        }
        if (c.action.stun) c.pending.push({ type: "stun" });
      }
      if (enemyTiming && shared && c.action.followup)
        c.pending.push({ type: "extra" });
      for (const dead of [...s.enemies].filter((e) => e.hp <= 0)) kill(s, dead);
      if (h.hp <= 0) {
        enterDream(s, true);
        return;
      }
      if (ha && c.attack.afterAttackHeal) {
        h.hp = Math.min(6, h.hp + c.attack.afterAttackHeal);
        log(s, `리게인 · 공격 후 치유 ${c.attack.afterAttackHeal}.`);
      }
      if (ha && c.attack.freeTransform) c.pending.push({ type: "transform" });
      if (!pendingCombat(s)) return;
    }
    endCombat(s);
  }

  function transform(s) {
    for (let i = 0; i < 3; i++) clearSlot(s, i);
    hunter(s).face = 1 - hunter(s).face;
    log(s, "무기 변형 · 모든 슬롯을 비웠습니다.");
    if (s.mission) rewards.onTransform(s);
  }
  function payAction(s, id) {
    const x = pay(s, id),
      n = card(x).nonAttackHeal || 0;
    if (n) {
      hunter(s).hp = Math.min(6, hunter(s).hp + n);
      log(s, `한숨돌리기 · 치유 ${n}.`);
    }
    return x;
  }
  function leapPaths(s, to) {
    const out = [],
      start = hunter(s).position;
    function walk(p) {
      const at = p[p.length - 1];
      if (at === to) {
        out.push(p);
        return;
      }
      if (p.length === 3 || !canLeave(s, at)) return;
      for (const n of neighbors(s, at)) if (!p.includes(n)) walk([...p, n]);
    }
    walk([start]);
    return out;
  }
  function interactionOptions(s) {
    const h = hunter(s),
      n = node(s, h.position);
    if (!n) return { loot: 0 };
    return {
      loot: s.loot.filter((x) => x === n.id).length,
      teleport: n.lamp && n.tile === "tile-14" && n.id.endsWith(":center"),
      heal: n.tile === "tile-12",
      workshop: n.id === "tile-07:top",
      provisionalNpc: !!s.provisional && s.provisional.componentId === "iosefka" && n.id === "tile-14:center",
      ...(s.mission ? { missionRescue: missions.rescueInteraction(s, missionHelpers()) } : {}),
    };
  }
  function nextInteraction(s) {
    const q = s.interaction,
      h = hunter(s);
    if (!q || h.position !== q.node) {
      s.interaction = null;
      s.phase = "hunter";
      log(s, "상호작용 위치에서 벗어나 효과를 완료하지 못했습니다.");
      return;
    }
    while (q.enemies.length) {
      const id = q.enemies.shift(),
        e = enemy(s, id);
      if (!e || e.node !== h.position) continue;
      chooseCombat(s, id, "interaction");
      reveal(s);
      return;
    }
    if (!q.applied) {
      q.applied = true;
      if (q.heal) {
        h.hp = Math.min(6, h.hp + 2);
        log(s, "대성당 · 치유 2.");
      }
      if (q.exchange && !q.exchangeAfterLoot) exchangeConsumable(s, q.exchangeItemId);
      for (let i = 0; i < q.loot; i++) s.loot.splice(s.loot.indexOf(q.node), 1);
      s.lootRemaining = q.loot;
    }
    collectLoot(s);
  }
  function exchangeConsumable(s, itemId) {
    const h = hunter(s), index = h.consumables.findIndex((item) => item.id === itemId);
    need(index >= 0, "교환할 보유 소모품을 선택하세요.");
    const item = h.consumables.splice(index, 1)[0];
    s.consumableDiscard.push(item);
    h.echoes = Math.min(3, h.echoes + 1);
    log(s, `성배 교단 예배당 · ${D.consumables[item.kind].name}을(를) 사용하여 피의 유지 1 획득.`);
  }
  function collectLoot(s) {
    const q = s.interaction;
    while (s.lootRemaining > 0) {
      s.lootRemaining--;
      if (q.node.startsWith("tile-19:")) {
        for (let i = 0; i < 3; i++) {
          if (!s.consumableDeck.length && s.consumableDiscard.length) {
            s.consumableDeck = shuffle(s, s.consumableDiscard);
            s.consumableDiscard = [];
          }
          if (s.consumableDeck.length)
            s.lootChoice.push(s.consumableDeck.shift());
        }
        if (s.lootChoice.length) {
          s.phase = "loot_choice";
          return;
        }
      } else drawConsumable(s);
    }
    if (q.exchangeAfterLoot && !q.exchanged) {
      s.phase = "exchange_choice";
      return;
    }
    if (q.lamp) {
      teleport(s, q.lamp, true);
      log(s, `중앙 등불 · ${nameAt(s, q.lamp)}(으)로 순간이동.`);
    }
    const rescue = q.mission === "rescue";
    if (q.provisionalNpc) {
      hHealProvisional(s);
    }
    s.interaction = null;
    if (rescue) missions.startRescue(s, missionHelpers());
    else if (s.phase !== "mission_choice" && s.phase !== "spawn_choice") s.phase = "hunter";
  }
  function hHealProvisional(s) {
    const h = hunter(s);
    h.hp = Math.min(6, h.hp + temporary.specimens.iosefka.interaction.heal);
    s.provisional.npcVisits++;
    log(s, "이오세프카 · 임시 효과로 치유 2. 실제 NPC 카드 효과가 아닙니다.");
  }
  function dispatch(previous, command) {
    need(command && typeof command === "object", "올바른 명령이 아닙니다.");
    const s = clone(previous),
      a = command,
      h = hunter(s);
    need(
      !a.hunterId || a.hunterId === s.activeHunterId,
      "현재 사냥꾼의 차례가 아닙니다.",
    );
    need(s.phase !== "over" || s.result === "chapter-win" && s.rewardChoices?.length &&
      ["EQUIP_REWARD", "KEEP_REWARD"].includes(a.type), "사냥이 끝났습니다. 새 사냥을 시작하세요.");
    const phase = (p) =>
      need(s.phase === p, "현재 단계에서는 사용할 수 없는 행동입니다.");
    const handled = s.mission && rewards.dispatch(s, a, rewardHelpers());
    const missionHandled = !handled && missions.dispatch(s, a, missionHelpers());
    if (!handled && !missionHandled) switch (a.type) {
      case "MOVE": {
        phase("hunter");
        const x = payAction(s, a.cardId);
        s.move = {
          remaining: card(x).move || 2,
          path: [h.position],
          chasers: [],
        };
        s.phase = "move";
        log(s, `이동 시작 · 최대 ${s.move.remaining}칸.`);
        break;
      }
      case "STEP":
        phase("move");
        stepHunter(s, a.node);
        break;
      case "STOP_MOVE":
        phase("move");
        finishMove(s);
        break;
      case "EXPLORE":
        phase("move");
        explore(s, a.edge);
        break;
      case "PLACE_TILE":
        phase("tile_place");
        placeTile(s, a.rotation);
        break;
      case "SPAWN_CHOICE": {
        phase("spawn_choice");
        need(
          s.spawnChoices.includes(a.enemyId),
          "가장 먼 피규어를 선택하세요.",
        );
        const e = enemy(s, a.enemyId),
          job = s.spawnQueue.shift();
        spawnFigure(s, job, e.figure);
        finishSpawns(s);
        break;
      }
      case "ENEMY_STEP":
        phase("enemy_path");
        need(
          moveOptions(s).includes(a.node),
          "표시된 적 이동 경로를 선택하세요.",
        );
        takeEnemyStep(s, a.node);
        runEnemyMove(s);
        break;
      case "TRANSFORM":
        phase("hunter");
        payAction(s, a.cardId);
        transform(s);
        break;
      case "ATTACK": {
        phase("hunter");
        pullBeforeAttack(s, a.pullIds);
        const e = enemy(s, a.enemyId),
          x = h.hand.find((x) => x.id === a.cardId);
        need(
          e &&
            x &&
            Number.isInteger(a.slot) &&
            slots(s)[a.slot] &&
            !h.slots[a.slot],
          "대상·손패·빈 공격 슬롯을 선택하세요.",
        );
        if (e.node !== h.position) {
          const bonus = s.mission ? rewards.attackBonus(clone(s), a.slot, a.rewardIds || [], rewardHelpers()) : {};
          need(card(x).leap && !bonus.replaceCardEffects, "같은 칸의 적만 공격할 수 있습니다.");
          const route = leapPaths(s, e.node).find(
            (p) => JSON.stringify(p) === JSON.stringify(a.leapPath),
          );
          need(route && route.length > 1, "도약으로 진입할 경로를 선택하세요.");
          // Validate consumables before any movement/choice can commit part of this attack.
          attackConsumables(clone(s), a.itemIds);
          if (s.mission) rewards.attackBonus(clone(s), a.slot, a.rewardIds || [], rewardHelpers());
          s.leap = clone(a);
          s.move = {
            remaining: route.length - 1,
            path: [h.position],
            chasers: [],
          };
          for (const to of route.slice(1)) stepHunter(s, to);
        } else {
          chooseCombat(s, e.id, "hunter");
          commitAttack(s, a.cardId, a.slot, a.itemIds, a.rewardIds);
        }
        break;
      }
      case "COUNTER":
        phase("combat_choose");
        pullBeforeAttack(s, a.pullIds);
        commitAttack(s, a.cardId, a.slot, a.itemIds, a.rewardIds);
        break;
      case "NO_ATTACK":
        phase("combat_choose");
        reveal(s);
        break;
      case "DODGE":
        phase("combat_react");
        dodge(s, a);
        break;
      case "EXTRA_DODGE":
        phase("combat_extra");
        dodge(s, a, true);
        break;
      case "EXTRA_TAKE":
        phase("combat_extra");
        takeDamage(s, s.combat.extra.damage, "다단 가르기 추가 피해");
        s.combat.extra = null;
        if (h.hp <= 0) enterDream(s, true);
        else resolve(s);
        break;
      case "FIREARM":
        phase("combat_react");
        need(
          canFirearm(s),
          "준비된 화기로 방해 가능한 기본 공격에만 사용할 수 있습니다.",
        );
        h.firearmReady = false;
        s.combat.cancelEnemy = true;
        s.combat.shot = true;
        log(s, `${firearm(s).name} · 기본 공격 자동 방해, 화기 소진.`);
        break;
      case "RESOLVE":
        phase("combat_react");
        resolve(s);
        break;
      case "STUN_DISCARD":
        phase("stun");
        pay(s, a.cardId);
        log(s, "기절 · 카드 1장을 버렸습니다.");
        resolve(s);
        break;
      case "ABILITY_CHOICE":
        phase("ability_choice");
        if (a.cardId) pay(s, a.cardId);
        else applyBrickPenalty(s);
        reveal(s);
        break;
      case "CHEAP_SHOT": {
        phase("cheap_shot");
        if (a.cardId) {
          const x = h.hand.find((x) => x.id === a.cardId),
            e = enemy(s, s.combat.enemyId);
          need(
            x && card(x).cheapShot && e?.node === h.position,
            "비열한 일격 카드를 선택하세요.",
          );
          pay(s, a.cardId);
          e.hp -= 2;
          log(s, "비열한 일격 · 손에서 버리며 피해 2.");
          kill(s, e);
          if (!enemy(s, e.id)) {
            endCombat(s);
            break;
          }
          if (h.hand.some((x) => card(x).cheapShot)) break;
        }
        if (s.combat.cheapShotAfter === "timed") runTimedAbility(s);
        else resolveRevealedAbility(s);
        break;
      }
      case "CARD_CHOICE":
        phase("card_choice");
        applyCardChoice(s, a.value);
        finishCardChoices(s);
        break;
      case "FREE_TRANSFORM": {
        phase("free_transform");
        const after = s.freeTransform;
        s.freeTransform = null;
        need(typeof a.accept === "boolean", "변형 여부를 선택하세요.");
        if (a.accept) transform(s);
        resume(s, after);
        break;
      }
      case "RELOAD":
        phase("hunter");
        need(!h.firearmReady, "이미 준비된 화기입니다.");
        pay(s, a.cardId);
        h.firearmReady = true;
        log(s, "카드 1장을 버려 화기를 준비했습니다.");
        break;
      case "USE_CONSUMABLE":
        phase("hunter");
        useConsumable(s, a);
        break;
      case "INTERACT": {
        phase("hunter");
        const opt = interactionOptions(s),
          count = a.lootCount || 0;
        need(
          Number.isInteger(count) && count >= 0 && count <= opt.loot,
          "획득할 소모품 토큰 수를 확인하세요.",
        );
        need(!a.heal || opt.heal, "대성당에서 사용할 수 있습니다.");
        need(
          !a.lamp || (opt.teleport && centralLampDestinations(s).some((n) => n.id === a.lamp)),
          "중앙 등불에서 목적지 등불 또는 안개 안 칸을 선택하세요.",
        );
        need(!a.exchange || opt.workshop, "성배 교단 예배당 명칭 칸에서 교환할 수 있습니다.");
        need(!a.exchangeAfterLoot || a.exchange && count > 0,
          "획득 후 교환하려면 같은 상호작용에서 소모품 토큰을 획득하세요.");
        need(!a.exchange || a.exchangeAfterLoot || h.consumables.some((item) => item.id === a.exchangeItemId),
          "교환할 보유 소모품을 선택하세요.");
        need(!a.mission || a.mission === "rescue" && opt.missionRescue, "같은 칸의 구조 토큰을 선택하세요.");
        need(!a.provisionalNpc || opt.provisionalNpc, "임시 이오세프카는 중앙 등불 칸에서 만날 수 있습니다.");
        need(count || a.heal || a.lamp || a.exchange || a.mission || a.provisionalNpc, "상호작용할 대상을 선택하세요.");
        payAction(s, a.cardId);
        s.interaction = {
          node: h.position,
          enemies: s.enemies
            .filter((e) => e.node === h.position)
            .sort((a, b) => enemyDef(s, a).order - enemyDef(s, b).order)
            .map((e) => e.id),
          loot: count,
          heal: !!a.heal,
          lamp: a.lamp || null,
          exchange: !!a.exchange,
          applied: false,
          ...(a.exchangeAfterLoot ? { exchangeAfterLoot: true } :
            a.exchange ? { exchangeItemId: a.exchangeItemId } : {}),
          ...(a.mission ? { mission: a.mission } : {}),
          ...(a.provisionalNpc ? { provisionalNpc: true } : {}),
        };
        nextInteraction(s);
        break;
      }
      case "EXCHANGE_CHOICE":
        phase("exchange_choice");
        need(s.interaction?.exchangeAfterLoot && !s.interaction.exchanged,
          "소모품 획득 후 교환 선택 단계가 아닙니다.");
        if (a.skip === true) log(s, "성배 교단 예배당 · 소모품 교환을 건너뛰었습니다.");
        else exchangeConsumable(s, a.itemId);
        s.interaction.exchanged = true;
        collectLoot(s);
        break;
      case "LOOT_CHOICE": {
        phase("loot_choice");
        const i = s.lootChoice.findIndex((x) => x.id === a.itemId);
        need(i >= 0, "획득할 소모품을 선택하세요.");
        const item = s.lootChoice.splice(i, 1)[0];
        h.consumables.push(item);
        s.consumableDeck = shuffle(s, [...s.consumableDeck, ...s.lootChoice]);
        s.lootChoice = [];
        log(
          s,
          `지하 묘지 · ${D.consumables[item.kind].name} 선택, 나머지는 더미에 섞었습니다.`,
        );
        collectLoot(s);
        break;
      }
      case "CLINIC":
        phase("hunter");
        need(
          node(s, h.position)?.tile === "tile-20" && !s.clinicUsed,
          "진료소에서 차례마다 한 번 사용할 수 있습니다.",
        );
        s.clinicUsed = true;
        h.hp--;
        log(s, "이오셰프카의 진료소 · 피해 1, 카드 1장.");
        if (h.hp <= 0) enterDream(s, true);
        else draw(s, 1);
        break;
      case "DREAM":
        phase("hunter");
        payAction(s, a.cardId);
        enterDream(s, false);
        break;
      case "END_TURN":
        phase("hunter");
        if (h.status.poison) {
          h.hp--;
          log(s, "차례 종료 · 독 피해 1.");
          if (h.hp <= 0) {
            enterDream(s, true);
            break;
          }
        }
        s.activation = [];
        log(s, "차례 종료 · 적 활성화.");
        if (!missions.turnEnd(s, missionHelpers())) continueActivation(s);
        break;
      case "MISSION_DEATH_DODGE": {
        phase("mission_death");
        need(deathDodgePossible(s, a.cardId, a.slot), "속도 1 이상 회피 카드와 빈 슬롯을 선택하세요.");
        const x = place(s, a.cardId, a.slot);
        log(s, "포악한 야수의 마지막 공격을 회피했습니다.");
        rewards.onDodge(s, rewardHelpers());
        finishCardChoices(s, { type: "mission_death_done", freeTransform: !!card(x).freeTransform });
        break;
      }
      case "MISSION_DEATH_TAKE":
        phase("mission_death");
        takeDamage(s, 3, "포악한 야수의 마지막 공격");
        if (h.hp <= 0) { s.mission.deathAfter = null; enterDream(s, true); }
        else resume(s, { type: "mission_death_done" });
        break;
      case "ACTIVATE":
        phase("activation");
        need(
          eligible(s).some((e) => e.id === a.enemyId),
          "현재 순서의 적을 선택하세요.",
        );
        activateEnemy(s, enemy(s, a.enemyId));
        break;
      case "REFILL": {
        phase("refill");
        const ids = a.discardIds || [];
        need(
          Array.isArray(ids) && new Set(ids).size === ids.length,
          "버릴 카드 선택이 중복되었습니다.",
        );
        for (const id of ids) pay(s, id);
        draw(s, Math.max(0, 3 - h.hand.length));
        s.phase = h.inDream ? "return" : "hunter";
        log(s, "손패를 3장까지 보충했습니다.");
        break;
      }
      case "RETURN":
        phase("return");
        need(
          node(s, a.node)?.lamp && [0, 1].includes(a.face),
          "귀환 등불과 무기 면을 선택하세요.",
        );
        h.position = a.node;
        h.inDream = false;
        h.face = a.face;
        s.phase = "hunter";
        log(s, `${nameAt(s, a.node)}에서 귀환했습니다.`);
        break;
      case "PICK_UPGRADE":
        phase("upgrade_pick");
        need(
          Number.isInteger(a.index) && !!s.market[a.index],
          "업그레이드 카드를 선택하세요.",
        );
        s.dream.purchased.push({
          id: `card-${++s.uid}`,
          kind: s.market[a.index],
        });
        s.market[a.index] = s.upgradeDeck.shift() || null;
        s.dream.credit--;
        if (!s.dream.credit || s.market.every((x) => !x)) {
          s.dream.credit = 0;
          s.phase = "upgrade_replace";
        }
        break;
      case "REPLACE_UPGRADE": {
        phase("upgrade_replace");
        const c = s.dream.purchased.shift();
        if (a.replaceId) {
          const i = h.deck.findIndex((x) => x.id === a.replaceId);
          need(i >= 0, "교체할 카드를 선택하세요.");
          s.removedCards.push(h.deck[i].kind);
          h.deck.splice(i, 1, c);
          log(s, `${card(c).name}을 덱에 넣었습니다. 덱은 12장입니다.`);
        } else {
          s.removedCards.push(c.kind);
          log(s, `${card(c).name}을 덱에 넣지 않았습니다.`);
        }
        if (!s.dream.purchased.length) finishDream(s);
        break;
      }
      default:
        fail("알 수 없는 명령입니다.");
    }
    if (s.mission?.deathPending && !s.combat && s.phase === "hunter") offerDeathReaction(s, { type: "mission_hunter" });
    flushMissionSpawns(s);
    if (s.mission?.won && !s.combat && !s.mission.deathAfter && s.phase === "hunter") beginChapterDream(s);
    if (s.provisional?.finished && !s.combat && s.phase === "hunter") { s.phase = "over"; s.result = "provisional-win"; }
    s.revision++;
    s.commands.push(clone(command));
    assertState(s);
    return s;
  }

  function create(
    seed = 20261011,
    weaponId = "burial",
    face = 0,
    startingConsumable = null,
    firearmId = "hunter-pistol",
    startSpace = "center",
    options = { campaign: false },
  ) {
    need(
      weaponId === "burial",
      "현재 실제 지도 모드는 장송의 칼날을 사용합니다.",
    );
    need([0, 1].includes(face), "무기 면을 선택하세요.");
    need(Object.hasOwn(D.firearms, firearmId), "지원하는 화기를 선택하세요.");
    need(
      startingConsumable === null ||
        D.consumables[startingConsumable]?.runtime === "playable",
      "시작 소모품을 확인하세요.",
    );
    const map = M.create(seed, startSpace);
    need(options && typeof options.campaign === "boolean", "캠페인 시작 설정을 확인하세요.");
    need(!options.provisional || temporary?.specimens[options.provisional] && !options.campaign,
      "임시 구성품 시험 설정을 확인하세요.");
    const s = {
      schema: 1,
      contentId: D.id,
      rng: map.rng,
      initialSeed: map.seed,
      setup: { weaponId, face, startingConsumable, firearmId, startSpace,
        ...(options.campaign ? { campaign: true } : {}),
        ...(options.provisional ? { provisional: options.provisional } : {}) },
      revision: 0,
      round: 1,
      track: 1,
      lastRound: false,
      phase: "hunter",
      result: null,
      activeHunterId: "hunter-1",
      hunters: {},
      world: {
        assignments: map.assignments,
        tilePool: map.tilePool,
        tileDeck: map.tileDeck,
        tiles: map.tiles,
        pending: null,
      },
      enemies: [],
      loot: [],
      enemyDeck: map.enemyDeck,
      enemyDiscard: [],
      market: [],
      upgradeDeck: [],
      removedCards: [],
      consumableDeck: [],
      consumableDiscard: [],
      skipActivation: [],
      uid: 12,
      activation: [],
      combat: null,
      move: null,
      interaction: null,
      dream: null,
      spawnQueue: [],
      spawnChoices: [],
      spawnAfter: null,
      enemyMove: null,
      cardChoices: [],
      cardAfter: null,
      freeTransform: null,
      lootChoice: [],
      lootRemaining: 0,
      clinicUsed: false,
      leap: null,
      kills: 0,
      events: [],
      commands: [],
    };
    const types = ["endurance", "skill", "strength", "vitality"];
    const deck = Array.from({ length: 12 }, (_, i) => ({
      id: `card-${i + 1}`,
      kind: types[Math.floor(i / 3)],
    }));
    s.hunters["hunter-1"] = {
      id: "hunter-1",
      name: "사냥꾼",
      hp: 6,
      echoes: 0,
      position: map.position,
      inDream: false,
      weaponId,
      face,
      hand: [],
      deck: shuffle(s, deck),
      discard: [],
      slots: [null, null, null],
      status: { poison: false, frenzy: false },
      firearmId,
      firearmReady: true,
      consumables: [],
    };
    s.upgradeDeck = shuffle(
      s,
      D.upgrades.flatMap((id) => Array(3).fill(id)),
    );
    s.market = s.upgradeDeck.splice(0, 4);
    draw(s, 3);
    s.consumableDeck = Object.values(D.consumables)
      .filter((x) => x.runtime !== "excluded")
      .flatMap((d) =>
        Array.from({ length: d.count }, (_, i) => ({
          id: `item-${d.id}-${i + 1}`,
          kind: d.id,
        })),
      );
    if (startingConsumable) {
      const i = s.consumableDeck.findIndex(
        (x) => x.kind === startingConsumable,
      );
      hunter(s).consumables.push(...s.consumableDeck.splice(i, 1));
      log(
        s,
        "선택한 테스트 시작 소모품 1장을 전체 덱에서 꺼냈습니다. 정규 시작 지급이 아닙니다.",
      );
    }
    shuffle(s, s.consumableDeck);
    if (options.campaign) { rewards.init(s); missions.init(s, missionHelpers()); }
    if (options.provisional) {
      s.provisional = { componentId: options.provisional, phase: 1, finished: false, npcVisits: 0 };
      spawnProvisional(s);
      log(s, temporary.notice);
    }
    log(
      s,
      options.campaign ? "기나긴 사냥 챕터 1 · 임무와 보상 연결 플레이를 시작합니다." : options.provisional ?
        "임시 구성품 시험을 시작합니다. 새 사냥에서 구성품을 바꿀 수 있습니다." :
        "실제 지도 전투 시작 · 챕터 1 준비를 사용합니다. 시나리오 임무와 보상은 아직 연결 전입니다.",
    );
    assertState(s);
    return s;
  }
  function assertState(s) {
    need(
      s && s.schema === 1 && s.contentId === D.id,
      "이 저장은 실제 지도 전투 v0.5용이 아닙니다. 훈련/탐험 저장은 해당 화면에서 여세요.",
    );
    need(
      Number.isInteger(s.rng) && s.rng > 0 && s.rng <= 4294967295,
      "난수 오류.",
    );
    need(
      s.activeHunterId === "hunter-1" && Object.keys(s.hunters).length === 1,
      "현재는 1인용입니다.",
    );
    const h = hunter(s),
      all = allCards(h);
    need(
      s.setup.weaponId === "burial" &&
        h.weaponId === s.setup.weaponId &&
        Object.hasOwn(D.firearms, h.firearmId) &&
        (h.firearmId === s.setup.firearmId || s.mission && h.ownedFirearms.includes(h.firearmId)),
      "장비 설정 오류.",
    );
    need([0, 1].includes(h.face) && h.slots.length === 3, "무기 상태 오류.");
    need(
      all.length === 12 &&
        new Set(all.map((c) => c.id)).size === 12 &&
        all.every((c) => D.cards[c.kind]),
      "사냥꾼 덱은 정확히 12장이어야 합니다.",
    );
    need(
      Number.isInteger(h.hp) &&
        h.hp >= 0 &&
        h.hp <= 6 &&
        Number.isInteger(h.echoes) &&
        h.echoes >= 0 &&
        h.echoes <= 3,
      "사냥꾼 수치 오류.",
    );
    need(
      h.inDream ? h.position === null : !!node(s, h.position),
      "사냥꾼 위치 오류.",
    );
    const assignments = s.world.assignments;
    need(
      assignments.length === 3 &&
        new Set(assignments.map((a) => a.enemyId)).size === 3 &&
        assignments.every(
          (a, i) =>
            a.slot === i + 1 &&
            a.marker === ["gold", "red", "purple"][i] &&
            D.enemies[a.enemyId]?.sides.some((f) => f.id === a.sideId),
        ),
      "적 면·슬롯 배정 오류.",
    );
    const tiles = [
      ...s.world.tiles.map((p) => p.tileId),
      ...s.world.tileDeck,
      ...(s.world.pending ? [s.world.pending.tileId] : []),
    ];
    need(
      tiles.length === 7 &&
        new Set(tiles).size === 7 &&
        tiles.every((id) => s.world.tilePool.includes(id)),
      "타일 수량 오류.",
    );
    need(
      new Set(s.world.tiles.map((p) => `${p.x},${p.y}`)).size ===
        s.world.tiles.length &&
        s.world.tiles.every(
          (p) =>
            M.tile(p.tileId) &&
            Number.isInteger(p.x) &&
            Number.isInteger(p.y) &&
            [0, 1, 2, 3].includes(p.rotation),
        ),
      "타일 배치 오류.",
    );
    need(
      s.enemies.length <= 12 &&
        new Set(s.enemies.map((e) => e.id)).size === s.enemies.length,
      "피규어 개수 오류.",
    );
    for (const e of s.enemies)
      need(
        D.enemies[e.kind] &&
          [1, 2, 3, 4].includes(e.figure) &&
          e.id === e.kind + "-" + e.figure &&
          node(s, e.node) &&
          Number.isInteger(e.hp) &&
          e.hp > 0 &&
          e.hp <= enemyDef(s, e).maxHp,
        "적 상태 오류.",
      );
    for (const kind of Object.keys(D.enemies))
      need(
        s.enemies.filter((e) => e.kind === kind).length <= 4,
        "피규어 공급 초과.",
      );
    need(enemyDeck.valid(s), "공용 적 행동 덱 수량 오류.");
    for (const at of s.loot)
      need(
        node(s, at)?.icons.some((i) => i.kind === "consumable"),
        "소모품 위치 오류.",
      );
    const items = [
      ...h.consumables,
      ...s.consumableDeck,
      ...s.consumableDiscard,
      ...s.lootChoice,
    ];
    need(
      items.length === 36 && new Set(items.map((i) => i.id)).size === 36,
      "소모품 수량 오류.",
    );
    for (const i of items)
      need(
        D.consumables[i.kind] &&
          i.id.match(/^item-/) &&
          D.consumables[i.kind].runtime !== "excluded",
        "소모품 데이터 오류.",
      );
    const stats = [
      ...all.map((x) => x.kind),
      ...s.market.filter(Boolean),
      ...s.upgradeDeck,
      ...s.removedCards,
      ...(s.dream?.purchased || []).map((x) => x.kind),
    ];
    for (const id of Object.keys(D.cards))
      need(stats.filter((x) => x === id).length === 3, `스탯 수량 오류: ${id}`);
    need(
      s.market.length === 4 &&
        s.market.every((x) => x === null || D.upgrades.includes(x)),
      "업그레이드 시장 오류.",
    );
    need(
      Number.isInteger(s.track) &&
        s.track >= 1 &&
        s.track <= 16 &&
        Number.isInteger(s.round) &&
        s.round >= 1,
      "사냥 트랙 오류.",
    );
    need(
      [
        "hunter",
        "move",
        "tile_place",
        "spawn_choice",
        "enemy_path",
        "combat_choose",
        "combat_react",
        "combat_extra",
        "ability_choice",
        "cheap_shot",
        "card_choice",
        "free_transform",
        "stun",
        "activation",
        "refill",
        "return",
        "upgrade_pick",
        "upgrade_replace",
        "loot_choice",
        "exchange_choice",
        "mission_survivor",
        "mission_choice",
        "mission_death",
        "over",
      ].includes(s.phase),
      "진행 단계 오류.",
    );
    if (s.phase === "exchange_choice") need(s.interaction?.exchangeAfterLoot &&
      !s.interaction.exchanged && s.interaction.node === h.position &&
      h.position === "tile-07:top" && s.lootRemaining === 0,
      "예배당 교환 선택 상태 오류.");
    need(
      Array.isArray(s.commands) &&
        s.commands.length <= 10000 &&
        s.commands.length === s.revision,
      "명령 기록 오류.",
    );
    need(
      s.events.length <= 180 &&
        s.events.every(
          (e) => typeof e.text === "string" && e.text.length < 1000,
        ),
      "사건 기록 오류.",
    );
    if (
      [
        "combat_choose",
        "combat_react",
        "combat_extra",
        "ability_choice",
        "cheap_shot",
        "stun",
      ].includes(s.phase)
    )
      need(s.combat, "전투 상태 누락.");
    if (s.phase === "move")
      need(
        s.move && s.move.remaining > 0 && s.move.remaining <= 3,
        "이동 상태 오류.",
      );
    if (s.phase === "tile_place")
      need(s.world.pending && (s.move || s.world.pending.survivor && s.mission?.survivor.remaining), "배치 상태 오류.");
    if (s.phase === "spawn_choice")
      need(s.spawnQueue.length && s.spawnChoices.length > 1, "출현 선택 오류.");
    if (s.phase === "enemy_path")
      need(s.enemyMove && moveOptions(s).length > 1, "적 경로 선택 오류.");
    if (s.mission) {
      need(s.setup.campaign === true && s.mission.chapter === 1 &&
        new Set(s.mission.revealed).size === s.mission.revealed.length &&
        s.mission.revealed.every((x) => Number.isInteger(x) && x >= 1 && x <= 16), "임무 상태 오류.");
      rewards.assert(s);
    }
    if (s.provisional) {
      need(s.setup.provisional === s.provisional.componentId && temporary.specimens[s.provisional.componentId] &&
        [1, 2].includes(s.provisional.phase) && !s.mission, "임시 구성품 상태 오류.");
    }
    return true;
  }

  const api = {
    nodes,
    edges,
    enemyDef,
    canDodge,
    moveOptions,
    leapPaths,
    interactionOptions,
    centralLampDestinations,
    canLeave,
    create,
    dispatch,
    assertState,
    exportSave,
    importSave,
    hunter,
    slots,
    weapon,
    weaponFace,
    firearm,
    canFirearm,
    distance,
    pullCandidates,
    eligible,
    neighbors,
    path,
    node,
    card,
    missionView: (s) => missions.view(s, missionHelpers()),
    missionActions,
    rewardsView: (s) => rewards.view(s),
    provisionalView,
    placementOptions: (s) => missions.placementOptions(s, missionHelpers()),
    data: D,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBHunt = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
