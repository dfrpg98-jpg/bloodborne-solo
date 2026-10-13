(function (root) {
  "use strict";
  const D =
    typeof module !== "undefined" && module.exports
      ? require("./data.js")
      : root.BBData;
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
  const node = (id) => D.nodes.find((n) => n.id === id);
  const card = (c) => D.cards[c.kind];
  const enemy = (s, id) => s.enemies.find((e) => e.id === id);
  const firearm = (s) => D.firearms[hunter(s).firearmId || "hunter-pistol"];
  const canFirearm = (s) =>
    !!(
      hunter(s).firearmReady &&
      s.phase === "combat_react" &&
      s.combat?.action?.kind === "basic" &&
      !s.combat.cancelEnemy
    );
  const weapon = (s) => D.weapons[hunter(s).weaponId];
  const weaponFace = (s) => weapon(s).faces[hunter(s).face];
  const slots = (s) => weaponFace(s).slots;
  const log = (s, text) => {
    s.events.push({ round: s.round, text });
    if (s.events.length > 180) s.events.shift();
  };
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
  function neighbors(id) {
    return D.edges
      .filter((e) => e.includes(id))
      .map((e) => e.find((x) => x !== id));
  }
  function path(from, to) {
    const q = [[from]],
      seen = new Set([from]);
    while (q.length) {
      const p = q.shift(),
        last = p[p.length - 1];
      if (last === to) return p;
      for (const x of neighbors(last))
        if (!seen.has(x)) {
          seen.add(x);
          q.push([...p, x]);
        }
    }
    return [];
  }
  function sameTile(a, b) {
    return node(a).tile === node(b).tile;
  }
  function distance(a, b) {
    const route = path(a, b);
    return route.length ? route.length - 1 : Infinity;
  }
  function pullCandidates(s) {
    const h = hunter(s),
      range = weaponFace(s).pullRange;
    if (h.inDream || !range) return [];
    return s.enemies.filter(
      (e) => e.node !== h.position && distance(h.position, e.node) <= range,
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
        `장송의 칼날 · 공격 전: ${D.enemies[e.kind].name}을 사냥꾼의 칸으로 이동시켰습니다.`,
      );
    }
  }
  function nearby(a, b) {
    return (
      sameTile(a, b) ||
      D.edges.some(
        ([x, y]) =>
          (sameTile(x, a) && sameTile(y, b)) ||
          (sameTile(y, a) && sameTile(x, b)),
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
        target && distance(h.position, target.node) <= f.range,
        "효과 범위 안에 있는 적을 선택하세요.",
      );
      need(
        !f.nonBoss || !D.enemies[target.kind].boss,
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
      need(node(a.node)?.lamp, "사용할 수 있는 등불 칸을 선택하세요.");
      h.position = a.node;
      log(s, `${node(a.node).name}(으)로 순간이동 · 추격 없음.`);
    }
    if (f.moveEnemy) {
      need(
        node(a.node) && distance(target.node, a.node) <= f.moveEnemy,
        "선택한 적으로부터 2칸 이내의 목적지를 선택하세요.",
      );
      target.node = a.node;
      log(s, `${D.enemies[target.kind].name} 이동 → ${node(a.node).name}.`);
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
  function place(s, id, index) {
    const h = hunter(s);
    need(
      Number.isInteger(index) && index >= 0 && index < 3,
      "공격 슬롯을 선택하세요.",
    );
    need(!h.slots[index], "빈 공격 슬롯을 선택하세요.");
    const c = take(s, id);
    h.slots[index] = c;
    const def = card(c);
    if (def.draw) draw(s, def.draw);
    if (def.heal) h.hp = Math.min(6, h.hp + def.heal);
    if (def.clear) clearSlot(s, index);
    return c;
  }
  function freshEnemies() {
    return D.spawns.map((e) => ({ ...e, hp: D.enemies[e.kind].maxHp }));
  }
  function resetMap(s) {
    s.enemies = freshEnemies();
    s.skipActivation = [];
    s.loot = D.nodes.filter((n) => n.loot).map((n) => n.id);
    log(
      s,
      "지도 초기화: 훈련 적이 출현 지점에 복귀하고 소모품이 보충되었습니다.",
    );
  }
  function advance(s, reason) {
    s.track = Math.min(D.track.length, s.track + 1);
    log(s, `사냥 트랙 ${s.track}/${D.track.length} · ${reason}`);
    if (D.track.resets.includes(s.track)) resetMap(s);
  }
  function allCards(h) {
    return [...h.deck, ...h.hand, ...h.discard, ...h.slots.filter(Boolean)];
  }
  function nextRound(s) {
    if (s.lastRound) {
      s.phase = "over";
      s.result = "loss";
      log(s, "마지막 라운드가 끝났습니다. 사냥 실패.");
      return;
    }
    s.round++;
    advance(s, "새 라운드");
    s.lastRound = s.track === D.track.length;
    s.phase = "refill";
    s.activation = [];
    s.skipActivation = [];
    if (s.lastRound)
      log(
        s,
        "마지막 라운드입니다. 이번 라운드가 끝나기 전에 목표를 달성하세요.",
      );
  }
  function finishDream(s) {
    const h = hunter(s);
    h.deck = shuffle(s, h.deck);
    h.hp = 6;
    h.status = { poison: false, frenzy: false };
    h.firearmReady = true;
    s.dream = null;
    log(s, "꿈에서 회복했습니다. 체력 6 · 상태 이상 제거 · 화기 준비.");
    nextRound(s);
  }
  function enterDream(s, dead) {
    const h = hunter(s);
    if (dead) {
      h.echoes = 0;
      log(s, "사냥꾼이 쓰러졌습니다. 피의 유지를 모두 잃고 꿈에 입장합니다.");
    } else log(s, "자발적으로 사냥꾼의 꿈에 입장했습니다.");
    const credit = h.echoes;
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
    s.activation = [];
    advance(s, "사냥꾼의 꿈 입장");
    s.dream = { credit, purchased: [], replaceIndex: 0 };
    if (credit) {
      s.phase = "upgrade_pick";
      log(s, `피의 유지 ${credit}개를 업그레이드 ${credit}장으로 교환하세요.`);
    } else finishDream(s);
  }
  function kill(s, e) {
    if (e.hp > 0) return;
    const h = hunter(s);
    s.enemies = s.enemies.filter((x) => x.id !== e.id);
    h.echoes = Math.min(3, h.echoes + 1);
    log(s, `${D.enemies[e.kind].name} 처치 · 피의 유지 +1 (최대 3).`);
    if (e.id === "sentinel-1") s.mission.guardDown = true;
  }
  function eligible(s) {
    const h = hunter(s);
    if (h.inDream) return [];
    const a = s.enemies.filter(
      (e) =>
        !s.activation.includes(e.id) &&
        !s.skipActivation.includes(e.id) &&
        nearby(e.node, h.position),
    );
    if (!a.length) return a;
    const min = Math.min(...a.map((e) => D.enemies[e.kind].order));
    return a.filter((e) => D.enemies[e.kind].order === min);
  }
  function activateEnemy(s, e) {
    const h = hunter(s);
    s.activation.push(e.id);
    if (e.node !== h.position) {
      const next = path(e.node, h.position)[1];
      if (next) e.node = next;
      log(s, `${D.enemies[e.kind].name}이 사냥꾼을 향해 1칸 이동.`);
    }
    if (e.node === h.position) chooseCombat(s, e.id, "activation");
    else continueActivation(s);
  }
  function continueActivation(s) {
    if (hunter(s).inDream) return;
    const options = eligible(s);
    if (options.length === 1) activateEnemy(s, options[0]);
    else if (options.length) s.phase = "activation";
    else nextRound(s);
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
    };
    s.phase = "combat_choose";
  }
  function reveal(s) {
    const c = s.combat,
      e = enemy(s, c.enemyId),
      h = hunter(s);
    const kind = enemyDeck.draw(s, shuffle);
    c.action = { ...D.enemies[e.kind][kind], kind };
    if (c.removeEnemyAttackEffects && kind !== "ability") {
      // Training attacks only have these keyword effects; damage and speed remain unchanged.
      delete c.action.stun;
      delete c.action.poison;
      delete c.action.interrupt;
      log(
        s,
        "마비 안개 · 적 공격의 효과를 제거했습니다. 속도와 피해는 유지됩니다.",
      );
    }
    log(
      s,
      `${D.enemies[e.kind].name} · ${kind === "basic" ? "기본 공격" : kind === "special" ? "특수 공격" : "전용 능력"}: ${c.action.name}`,
    );
    if (kind === "ability") {
      if (c.action.heal)
        e.hp = Math.min(D.enemies[e.kind].maxHp, e.hp + c.action.heal);
      if (c.action.frenzy) h.status.frenzy = true;
      log(s, c.action.text);
    }
    s.phase = "combat_react";
  }
  function commitAttack(s, id, index, itemIds) {
    const slot = slots(s)[index];
    need(slot, "슬롯을 선택하세요.");
    const bonus = attackConsumables(s, itemIds);
    const placed = place(s, id, index),
      def = card(placed);
    s.combat.attack = {
      name: slot.name,
      speed: slot.speed + bonus.speed,
      damage: slot.damage + (def.damage || 0) + bonus.damage,
      interrupt: !!def.interrupt,
      splash: weaponFace(s).splash ? clone(weaponFace(s).splash) : null,
    };
    s.combat.defense = bonus.defense;
    s.combat.removeEnemyAttackEffects = bonus.removeEnemyAttackEffects;
    log(
      s,
      `${card(placed).name} → ${slot.name} (속도 ${s.combat.attack.speed}, 피해 ${s.combat.attack.damage})`,
    );
    reveal(s);
  }
  function interactFinish(s) {
    const h = hunter(s);
    if (h.inDream) return;
    const at = h.position;
    if (s.loot.includes(at)) {
      s.loot = s.loot.filter((x) => x !== at);
      drawConsumable(s);
    }
    if (at === "e1" && s.mission.guardDown && !s.mission.seal) {
      s.mission.seal = true;
      log(s, "봉인을 회수했습니다. 시작 등불로 돌아가 상호작용하세요.");
    }
    if (at === "c0" && s.mission.seal) {
      s.result = "win";
      s.phase = "over";
      log(s, "훈련 임무 완료. 사냥 성공!");
    } else s.phase = "hunter";
    s.interaction = null;
  }
  function nextInteraction(s) {
    const next = s.interaction.find((id) => enemy(s, id));
    if (next) {
      s.interaction = s.interaction.filter((id) => id !== next);
      chooseCombat(s, next, "interaction");
      reveal(s);
    } else interactFinish(s);
  }
  function endCombat(s) {
    const origin = s.combat.origin;
    s.combat = null;
    if (origin === "activation") continueActivation(s);
    else if (origin === "interaction") nextInteraction(s);
    else s.phase = "hunter";
  }
  function resolve(s) {
    const c = s.combat;
    if (!c.groups) {
      const speeds = [];
      if (c.attack) speeds.push(c.attack.speed);
      if (c.action.kind !== "ability") speeds.push(c.action.speed);
      c.groups = [...new Set(speeds)].sort((a, b) => b - a);
    }
    while (c.index < c.groups.length) {
      const speed = c.groups[c.index++],
        h = hunter(s),
        e = enemy(s, c.enemyId);
      if (!e) {
        endCombat(s);
        return;
      }
      const ha = c.attack && c.attack.speed === speed && !c.cancelHunter;
      const ea =
        c.action.kind !== "ability" &&
        c.action.speed === speed &&
        !c.cancelEnemy &&
        !c.dodged;
      // Determine both attacks before changing health: equal speeds hit simultaneously.
      if (ha) {
        e.hp -= c.attack.damage;
        log(s, `${c.attack.name}: ${c.attack.damage} 피해.`);
        if (c.attack.splash) {
          const { range, damage } = c.attack.splash;
          const others = s.enemies.filter(
            (other) =>
              other.id !== e.id && distance(h.position, other.node) <= range,
          );
          for (const other of others) {
            other.hp -= damage;
            log(
              s,
              `장송의 칼날 · 공격 속도 ${speed}: ${D.enemies[other.kind].name}에게 범위 피해 ${damage}.`,
            );
          }
        }
        if (
          c.attack.interrupt &&
          c.action.kind !== "ability" &&
          c.attack.speed > c.action.speed
        ) {
          c.cancelEnemy = true;
          log(s, "방해: 더 느린 적의 공격을 취소했습니다.");
        }
      }
      let stun = false;
      if (ea) {
        const amount = Math.max(
          0,
          c.action.damage + (h.status.frenzy ? 1 : 0) - (c.defense || 0),
        );
        h.hp -= amount;
        log(s, `${c.action.name}: 사냥꾼에게 ${amount} 피해.`);
        if (c.action.interrupt && c.attack && c.action.speed > c.attack.speed) {
          c.cancelHunter = true;
          log(s, "적의 방해로 사냥꾼 공격이 취소되었습니다.");
        }
        if (c.action.poison) h.status.poison = true;
        stun = !!c.action.stun;
      }
      for (const defeated of s.enemies.filter((other) => other.hp <= 0))
        kill(s, defeated);
      if (h.hp <= 0) {
        enterDream(s, true);
        return;
      }
      if (stun) {
        if (h.hand.length) {
          s.phase = "stun";
          log(s, "기절: 버릴 손패 1장을 선택하세요.");
          return;
        }
        h.hp--;
        log(s, "기절: 버릴 손패가 없어 피해 1.");
        if (h.hp <= 0) {
          enterDream(s, true);
          return;
        }
      }
    }
    endCombat(s);
  }
  function finishMove(s) {
    const h = hunter(s),
      m = s.move;
    for (const id of m.chasers) {
      const e = enemy(s, id);
      if (!e) continue;
      const traversed = m.path.indexOf(e.node);
      let dest;
      if (traversed >= 0 && traversed < m.path.length - 1)
        dest = m.path[traversed + 1];
      else dest = path(e.node, h.position)[1];
      if (dest && e.node !== h.position) {
        e.node = dest;
        log(
          s,
          `${D.enemies[e.kind].name}이 이동 경로를 따라 1칸 추격했습니다.`,
        );
      }
    }
    s.move = null;
    s.phase = "hunter";
  }
  function create(
    seed = 20261011,
    weaponId = "burial",
    face = 0,
    startingConsumable = "blood-vial",
    firearmId,
  ) {
    need(Object.hasOwn(D.weapons, weaponId), "지원하지 않는 장치 무기입니다.");
    need(face === 0 || face === 1, "시작 무기 형태를 선택하세요.");
    need(
      startingConsumable === null ||
        D.consumables[startingConsumable]?.runtime === "playable",
      "훈련 시작 소모품을 선택하세요.",
    );
    need(
      firearmId === undefined || Object.hasOwn(D.firearms, firearmId),
      "지원하지 않는 화기입니다.",
    );
    const s = {
      schema: 1,
      contentId: D.id,
      rng: seed >>> 0 || 1,
      initialSeed: seed >>> 0 || 1,
      setup: { weaponId, face, startingConsumable },
      revision: 0,
      round: 1,
      track: 1,
      lastRound: false,
      phase: "hunter",
      result: null,
      activeHunterId: "hunter-1",
      hunters: {},
      enemies: freshEnemies(),
      loot: D.nodes.filter((n) => n.loot).map((n) => n.id),
      enemyDeck: [],
      enemyDiscard: [],
      market: [],
      upgradeDeck: [],
      consumableDeck: [],
      consumableDiscard: [],
      skipActivation: [],
      uid: 12,
      activation: [],
      combat: null,
      move: null,
      interaction: null,
      dream: null,
      mission: { guardDown: false, seal: false },
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
      position: "c0",
      inDream: false,
      weaponId,
      face,
      hand: [],
      deck: shuffle(s, deck),
      discard: [],
      slots: [null, null, null],
      status: { poison: false, frenzy: false },
      firearmReady: true,
      consumables: [],
    };
    if (firearmId !== undefined) {
      s.setup.firearmId = firearmId;
      s.hunters["hunter-1"].firearmId = firearmId;
    }
    s.enemyDeck = enemyDeck.create(s, shuffle);
    s.upgradeDeck = shuffle(
      s,
      Array.from({ length: 24 }, (_, i) => D.upgrades[i % 4]),
    );
    s.market = s.upgradeDeck.splice(0, 4);
    draw(s, 3);
    s.consumableDeck = Object.values(D.consumables)
      .filter((d) => d.runtime !== "excluded")
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
      s.hunters["hunter-1"].consumables.push(...s.consumableDeck.splice(i, 1));
      log(
        s,
        `훈련 지급 · ${D.consumables[startingConsumable].name} 1장. 정규 캠페인의 시작 지급 규칙은 아닙니다.`,
      );
    }
    shuffle(s, s.consumableDeck);
    log(s, "훈련 시작. 파수꾼 처치 → 봉인 제단 상호작용 → 시작 등불 상호작용.");
    assertState(s);
    return s;
  }
  function dispatch(previous, command) {
    need(command && typeof command === "object", "올바른 명령이 아닙니다.");
    const s = clone(previous),
      a = command,
      h = hunter(s);
    need(
      !a.hunterId || a.hunterId === s.activeHunterId,
      "현재 차례인 사냥꾼만 행동할 수 있습니다.",
    );
    need(s.phase !== "over", "게임이 종료되었습니다. 새 훈련을 시작하세요.");
    const phase = (p) =>
      need(s.phase === p, "현재 단계에서는 사용할 수 없는 행동입니다.");
    switch (a.type) {
      case "MOVE":
        phase("hunter");
        pay(s, a.cardId);
        s.move = { remaining: 2, path: [h.position], chasers: [] };
        s.phase = "move";
        log(s, "이동 시작 · 최대 2칸.");
        break;
      case "STEP": {
        phase("move");
        need(
          neighbors(h.position).includes(a.node),
          "인접한 칸만 이동할 수 있습니다.",
        );
        const prev = h.position;
        for (const e of s.enemies) {
          if (
            e.node === prev ||
            (sameTile(e.node, prev) && !sameTile(prev, a.node))
          )
            if (!s.move.chasers.includes(e.id)) s.move.chasers.push(e.id);
        }
        h.position = a.node;
        s.move.path.push(a.node);
        s.move.remaining--;
        log(s, `${node(a.node).name}(으)로 이동.`);
        if (!s.move.remaining) finishMove(s);
        break;
      }
      case "STOP_MOVE":
        phase("move");
        finishMove(s);
        break;
      case "TRANSFORM":
        phase("hunter");
        pay(s, a.cardId);
        for (let i = 0; i < 3; i++) clearSlot(s, i);
        h.face = 1 - h.face;
        log(s, "장치 무기 변형 · 모든 슬롯을 비웠습니다.");
        break;
      case "ATTACK": {
        phase("hunter");
        // Movement and attack are one atomic command: invalid attacks cannot grant a free pull.
        pullBeforeAttack(s, a.pullIds);
        const e = enemy(s, a.enemyId);
        need(e && e.node === h.position, "같은 칸에 있는 적을 선택하세요.");
        chooseCombat(s, e.id, "hunter");
        commitAttack(s, a.cardId, a.slot, a.itemIds);
        break;
      }
      case "COUNTER":
        phase("combat_choose");
        pullBeforeAttack(s, a.pullIds);
        commitAttack(s, a.cardId, a.slot, a.itemIds);
        break;
      case "NO_ATTACK":
        phase("combat_choose");
        reveal(s);
        break;
      case "DODGE": {
        phase("combat_react");
        const c = s.combat;
        need(
          c.origin !== "interaction",
          "상호작용 도중에는 회피할 수 없습니다.",
        );
        need(
          c.action.kind !== "ability" && !c.cancelEnemy && !c.dodged,
          "회피할 공격이 없습니다.",
        );
        const chosen = h.hand.find((x) => x.id === a.cardId);
        need(chosen && card(chosen).dodge, "회피 카드가 필요합니다.");
        need(
          slots(s)[a.slot] && slots(s)[a.slot].speed >= c.action.speed,
          "적 공격 이상의 속도를 가진 빈 슬롯이 필요합니다.",
        );
        place(s, a.cardId, a.slot);
        c.dodged = true;
        log(s, "회피: 적의 피해와 직접 효과를 피했습니다.");
        break;
      }
      case "FIREARM": {
        phase("combat_react");
        const c = s.combat;
        need(h.firearmReady, "화기가 소진 상태입니다.");
        need(canFirearm(s), "기본 공격이 공개되었을 때 사용하세요.");
        h.firearmReady = false;
        c.cancelEnemy = true;
        c.shot = true;
        log(s, `${firearm(s).name}: 기본 공격 자동 방해 · 화기 소진.`);
        break;
      }
      case "RESOLVE":
        phase("combat_react");
        resolve(s);
        break;
      case "STUN_DISCARD":
        phase("stun");
        pay(s, a.cardId);
        log(s, "기절 효과로 카드 1장을 버렸습니다.");
        resolve(s);
        break;
      case "RELOAD":
        phase("hunter");
        need(!h.firearmReady, "화기가 이미 준비되어 있습니다.");
        pay(s, a.cardId);
        h.firearmReady = true;
        log(s, "카드 1장을 버려 화기를 준비했습니다.");
        break;
      case "USE_CONSUMABLE":
        phase("hunter");
        useConsumable(s, a);
        break;
      case "INTERACT":
        phase("hunter");
        need(
          s.loot.includes(h.position) ||
            (h.position === "e1" && s.mission.guardDown && !s.mission.seal) ||
            (h.position === "c0" && s.mission.seal),
          "이 칸에는 지금 상호작용할 대상이 없습니다.",
        );
        pay(s, a.cardId);
        s.interaction = s.enemies
          .filter((e) => e.node === h.position)
          .sort((a, b) => D.enemies[a.kind].order - D.enemies[b.kind].order)
          .map((e) => e.id);
        nextInteraction(s);
        break;
      case "DREAM":
        phase("hunter");
        pay(s, a.cardId);
        enterDream(s, false);
        break;
      case "END_TURN":
        phase("hunter");
        if (h.status.poison) {
          h.hp--;
          log(s, "사냥꾼 차례 종료 · 독 피해 1.");
          if (h.hp <= 0) {
            enterDream(s, true);
            break;
          }
        }
        s.activation = [];
        log(s, "사냥꾼 차례 종료 · 적 활성화.");
        continueActivation(s);
        break;
      case "ACTIVATE": {
        phase("activation");
        need(
          eligible(s).some((e) => e.id === a.enemyId),
          "현재 순서의 적을 선택하세요.",
        );
        activateEnemy(s, enemy(s, a.enemyId));
        break;
      }
      case "REFILL": {
        phase("refill");
        const ids = a.discardIds || [];
        need(
          Array.isArray(ids) && new Set(ids).size === ids.length,
          "버릴 카드 선택을 확인하세요.",
        );
        for (const id of ids) pay(s, id);
        draw(s, Math.max(0, 3 - h.hand.length));
        s.phase = h.inDream ? "return" : "hunter";
        log(s, "손패를 3장까지 보충했습니다.");
        break;
      }
      case "RETURN":
        phase("return");
        need(node(a.node) && node(a.node).lamp, "등불 칸을 선택하세요.");
        need(a.face === 0 || a.face === 1, "무기 형태를 선택하세요.");
        h.position = a.node;
        h.inDream = false;
        h.face = a.face;
        s.phase = "hunter";
        log(s, "등불에서 야남으로 귀환했습니다.");
        break;
      case "PICK_UPGRADE": {
        phase("upgrade_pick");
        need(
          Number.isInteger(a.index) &&
            a.index >= 0 &&
            a.index < s.market.length,
          "업그레이드를 선택하세요.",
        );
        need(s.market[a.index], "이 업그레이드 구획은 비었습니다.");
        s.dream.purchased.push({
          id: `card-${++s.uid}`,
          kind: s.market[a.index],
        });
        s.market[a.index] = s.upgradeDeck.shift() || null;
        s.dream.credit--;
        if (!s.dream.credit) s.phase = "upgrade_replace";
        break;
      }
      case "REPLACE_UPGRADE": {
        phase("upgrade_replace");
        const c = s.dream.purchased.shift();
        if (a.replaceId) {
          const i = h.deck.findIndex((x) => x.id === a.replaceId);
          need(i >= 0, "교체할 기존 카드를 선택하세요.");
          h.deck.splice(i, 1, c);
          log(s, `${card(c).name}을 덱에 넣었습니다. 덱 크기는 12장입니다.`);
        } else log(s, `${card(c).name}을 덱에 넣지 않고 버렸습니다.`);
        if (!s.dream.purchased.length) finishDream(s);
        break;
      }
      default:
        fail("알 수 없는 명령입니다.");
    }
    s.revision++;
    s.commands.push(clone(command));
    assertState(s);
    return s;
  }
  function assertState(s) {
    need(
      s && s.schema === 1 && s.contentId === D.id,
      "이 버전과 호환되지 않는 저장 파일입니다.",
    );
    need(
      Number.isInteger(s.rng) && s.rng > 0 && s.rng <= 4294967295,
      "난수 상태 오류.",
    );
    need(
      s.activeHunterId === "hunter-1" && Object.keys(s.hunters).length === 1,
      "이 버전은 1인용 저장만 지원합니다.",
    );
    const h = hunter(s);
    need(
      s.setup &&
        Object.hasOwn(D.weapons, s.setup.weaponId) &&
        [0, 1].includes(s.setup.face) &&
        h.weaponId === s.setup.weaponId,
      "무기 설정 오류.",
    );
    need(
      h && Array.isArray(h.slots) && h.slots.length === 3,
      "슬롯 상태 오류.",
    );
    need(
      h.firearmId === s.setup.firearmId &&
        (h.firearmId === undefined || Object.hasOwn(D.firearms, h.firearmId)),
      "화기 설정 오류.",
    );
    const all = allCards(h);
    need(
      all.length === 12 && new Set(all.map((c) => c.id)).size === 12,
      "사냥꾼 덱은 정확히 12장이어야 합니다.",
    );
    for (const c of all)
      need(
        c && typeof c.id === "string" && c.id.length < 80 && D.cards[c.kind],
        "카드 데이터 오류.",
      );
    need(Number.isInteger(h.hp) && h.hp >= 0 && h.hp <= 6, "체력 범위 오류.");
    need(
      Number.isInteger(h.echoes) && h.echoes >= 0 && h.echoes <= 3,
      "피의 유지 범위 오류.",
    );
    need(
      Array.isArray(h.consumables) &&
        Array.isArray(s.consumableDeck) &&
        Array.isArray(s.consumableDiscard),
      "소모품 구역 오류.",
    );
    const items = [
      ...h.consumables,
      ...s.consumableDeck,
      ...s.consumableDiscard,
    ];
    const expectedItems = Object.values(D.consumables)
      .filter((d) => d.runtime !== "excluded")
      .flatMap((d) =>
        Array.from({ length: d.count }, (_, i) => `item-${d.id}-${i + 1}`),
      );
    need(
      items.length === expectedItems.length &&
        new Set(items.map((x) => x.id)).size === items.length &&
        items.every(
          (x) =>
            expectedItems.includes(x.id) &&
            x.id.startsWith(`item-${x.kind}-`) &&
            D.consumables[x.kind],
        ),
      "소모품 36장의 수량/고유성 오류.",
    );
    need(
      Array.isArray(s.skipActivation) &&
        new Set(s.skipActivation).size === s.skipActivation.length &&
        s.skipActivation.every((id) => D.spawns.some((e) => e.id === id)),
      "활성화 억제 대상 오류.",
    );
    need(h.face === 0 || h.face === 1, "무기 형태 오류.");
    need(
      h.inDream ? h.position === null : !!node(h.position),
      "사냥꾼 위치 오류.",
    );
    need(
      typeof h.status.poison === "boolean" &&
        typeof h.status.frenzy === "boolean" &&
        typeof h.firearmReady === "boolean",
      "상태 데이터 오류.",
    );
    need(
      Number.isInteger(s.track) && s.track >= 1 && s.track <= D.track.length,
      "트랙 범위 오류.",
    );
    need(
      Number.isInteger(s.round) && s.round >= 1 && Number.isInteger(s.revision),
      "라운드 데이터 오류.",
    );
    need(
      [
        "hunter",
        "move",
        "combat_choose",
        "combat_react",
        "stun",
        "activation",
        "refill",
        "return",
        "upgrade_pick",
        "upgrade_replace",
        "over",
      ].includes(s.phase),
      "진행 단계 오류.",
    );
    need(
      Array.isArray(s.events) &&
        s.events.length <= 180 &&
        s.events.every(
          (e) => typeof e.text === "string" && e.text.length < 1000,
        ),
      "기록 데이터 오류.",
    );
    need(
      Array.isArray(s.commands) && s.commands.length < 10000,
      "명령 기록 오류.",
    );
    need(
      Array.isArray(s.enemies) &&
        s.enemies.length <= 2 &&
        new Set(s.enemies.map((e) => e.id)).size === s.enemies.length,
      "적 데이터 오류.",
    );
    for (const e of s.enemies)
      need(
        D.spawns.some((x) => x.id === e.id && x.kind === e.kind) &&
          node(e.node) &&
          Number.isInteger(e.hp) &&
          e.hp > 0 &&
          e.hp <= D.enemies[e.kind].maxHp,
        "적 상태 오류.",
      );
    const actions = [...s.enemyDeck, ...s.enemyDiscard];
    need(
      actions.length === 6 &&
        actions.filter((x) => x === "basic").length === 3 &&
        actions.filter((x) => x === "special").length === 2 &&
        actions.filter((x) => x === "ability").length === 1,
      "적 행동 덱 오류.",
    );
    need(
      Array.isArray(s.loot) &&
        s.loot.every((x) => D.nodes.some((n) => n.id === x && n.loot)),
      "소모품 위치 오류.",
    );
    need(
      Array.isArray(s.market) &&
        s.market.length === 4 &&
        s.market.every((x) => x === null || D.upgrades.includes(x)),
      "업그레이드 시장 오류.",
    );
    need(
      Array.isArray(s.upgradeDeck) &&
        s.upgradeDeck.every((x) => D.upgrades.includes(x)),
      "업그레이드 덱 오류.",
    );
    need(
      s.mission &&
        typeof s.mission.guardDown === "boolean" &&
        typeof s.mission.seal === "boolean",
      "임무 데이터 오류.",
    );
    if (["combat_choose", "combat_react"].includes(s.phase))
      need(s.combat && enemy(s, s.combat.enemyId), "전투 상태 오류.");
    if (s.phase === "stun")
      need(
        s.combat && D.spawns.some((e) => e.id === s.combat.enemyId),
        "기절 전투 상태 오류.",
      );
    if (s.phase === "move")
      need(
        s.move &&
          [1, 2].includes(s.move.remaining) &&
          Array.isArray(s.move.path) &&
          s.move.path.every((x) => node(x)),
        "이동 상태 오류.",
      );
    if (s.phase.startsWith("upgrade"))
      need(s.dream && Array.isArray(s.dream.purchased), "꿈 상태 오류.");
    return true;
  }
  function exportSave(s) {
    assertState(s);
    return JSON.stringify(
      { format: "bloodborne-solo-save", version: 1, state: s },
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
      p.format === "bloodborne-solo-save" && p.version === 1,
      "지원하지 않는 저장 형식입니다.",
    );
    assertState(p.state);
    let verified = create(
      p.state.initialSeed,
      p.state.setup.weaponId,
      p.state.setup.face,
      p.state.setup.startingConsumable,
      p.state.setup.firearmId,
    );
    for (const command of p.state.commands)
      verified = dispatch(verified, command);
    need(
      canonical(verified) === canonical(p.state),
      "저장 상태가 명령 기록과 일치하지 않습니다. 손상되거나 수동 편집된 파일인지 확인하세요.",
    );
    return verified;
  }
  const api = {
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
    data: D,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
