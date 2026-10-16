(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports
    ? require("./hunt-data.js") : root.BBHuntData;
  const X = typeof module !== "undefined" && module.exports
    ? require("./extended-rewards.js") : root.BBExtendedRewards;
  const supported = new Set([
    "bloodstone-shard", "lantern", "rune-moon", "rune-clawmark",
    "rune-rapture", "rune-eye",
    "beast-roar", "iosefka-vial", "messengers-gift", "rune-formless",
    "rune-writhe", "old-hunter-bone", "augur", "executioner-gloves",
    "rune-hunter", "empty-shell",
  ]);
  const attackKinds = new Set(["rune-clawmark", "rune-writhe", "rune-hunter", "empty-shell"]);
  const definitions = Object.fromEntries(D.components.cards
    .filter((c) => supported.has(c.id))
    .map((c) => [c.id, { ...c, subtype: c.id.startsWith("rune-") ? "rune" : "tool",
      persistent: c.id === "bloodstone-shard" }]));
  Object.assign(definitions,X.definitions);
  const hunter = (s) => s.hunters[s.activeHunterId];
  const need = (ok, text) => { if (!ok) throw new Error(text); };
  const say = (s, helpers, text) => { if (helpers.log) helpers.log(s, text); };
  const betweenChapters = (s) => ["chapter_complete", "between_chapters"].includes(s.phase);
  const get = (s, id) => hunter(s).rewards.find((r) => r.id === id);
  const equipped = (s, subtype) => hunter(s).rewards.filter(
    (r) => r.equipped && definitions[r.kind].subtype === subtype);
  const known = (s,kind) => definitions[kind] &&
    (!definitions[kind].minimumRulesVersion || X.enabled(s));
  const slotCount = (s,helpers = {}) => X.enabled(s)
    ? (helpers.slots?.(s)?.length || hunter(s).slots.length) : 3;
  function init(s) {
    const h = hunter(s);
    h.rewards ||= [];
    h.ownedFirearms ||= [h.firearmId || "hunter-pistol"];
    h.rewardKillWindow ??= false;
    h.rewardTransformWindow ??= false;
    s.rewardChoices ||= [];
    return s;
  }
  function readyItem(s, id, kind) {
    const r = get(s, id);
    need(r && r.equipped && r.ready && (!kind || r.kind === kind),
      "장착하고 준비된 보상을 선택하세요.");
    need(known(s,r.kind) && !X.limitUsed(s,r),"이 보상은 이번 규칙 또는 챕터에서 사용할 수 없습니다.");
    return r;
  }
  function grant(s, kind, helpers = {}) {
    init(s);
    const h = hunter(s);
    if (D.firearms[kind]) {
      if (h.ownedFirearms.includes(kind)) return null;
      h.ownedFirearms.push(kind);
      s.rewardChoices.push({ firearmId: kind, reason: "firearm" });
      say(s, helpers, `${D.firearms[kind].name} 획득 · 장착하거나 보관하세요.`);
      return kind;
    }
    const d = definitions[kind];
    need(d && known(s,kind), "현재 지원하지 않는 보상입니다.");
    const qaStart=!!s.setup?.qa && helpers.qaStart===true;
    const count = Object.values(s.hunters).reduce((n, p) => n +
      (p.rewards || []).filter((r) => r.kind === kind && !!r.qaStart===qaStart).length, 0);
    need(count < d.count, "보상 카드 공급이 부족합니다.");
    s.uid = (s.uid || 0) + 1;
    const r = { id: `reward-${s.uid}`, kind, equipped: false, ready: true,
      slot: null, triggerArmed: false, ...(qaStart ? {qaStart:true} : {}) };
    h.rewards.push(r);
    if(d.subtype === "quest") {
      say(s,helpers,`${d.name} 획득 · 사용 불가 임무 물품으로 보관합니다.`);
      return r.id;
    }
    if (equipped(s, d.subtype).length >= 2)
      s.rewardChoices.push({ rewardId: r.id, reason: "equip" });
    else if (d.persistent)
      s.rewardChoices.push({ rewardId: r.id, reason: "slot" });
    else r.equipped = true;
    say(s, helpers, `${d.name} 획득${r.equipped ? " · 장착" : " · 장착 또는 보관 선택"}.`);
    return r.id;
  }
  function pendingReward(s, id) {
    return s.rewardChoices.find((q) => q.rewardId === id);
  }
  function finishChoice(s, field, id) {
    s.rewardChoices = s.rewardChoices.filter((q) => q[field] !== id);
  }
  function equipReward(s, a, helpers) {
    const r = get(s, a.rewardId);
    need(r && (pendingReward(s, r.id) || betweenChapters(s)),
      "새로 획득한 보상 또는 챕터 사이에 보관한 보상만 장착할 수 있습니다.");
    const d = definitions[r.kind], old = a.replaceId ? get(s, a.replaceId) : null;
    need(known(s,r.kind) && d.subtype !== "quest","사용 불가 임무 물품은 장착하지 않고 보관합니다.");
    need(!r.equipped, "이미 장착한 보상입니다.");
    if (a.replaceId) need(old && old.equipped && old.id !== r.id &&
      definitions[old.kind].subtype === d.subtype, "교체할 같은 종류의 보상을 선택하세요.");
    need(equipped(s, d.subtype).length - (old ? 1 : 0) < 2,
      "사냥 도구와 카릴 문자는 각각 2장까지 장착합니다. 교체할 보상을 선택하세요.");
    if (d.persistent) need(Number.isInteger(a.slot) && a.slot >= 0 && a.slot < slotCount(s,helpers),
      X.enabled(s) ? "슬롯 부착 보상을 놓을 공격 슬롯을 선택하세요." : "혈석의 파편을 놓을 공격 슬롯을 선택하세요.");
    if (old) { old.equipped = false; old.triggerArmed = false; old.slot = null; }
    r.equipped = true;
    r.slot = d.persistent ? a.slot : null;
    finishChoice(s, "rewardId", r.id);
    say(s, helpers, `${d.name} 장착${d.persistent ? ` · ${a.slot + 1}번 슬롯` : ""}.`);
  }
  function use(s, a, helpers) {
    const h = hunter(s), r = readyItem(s, a.rewardId), d = definitions[r.kind];
    if(X.use(s,r,a,helpers)) return;
    if (r.kind === "old-hunter-bone") {
      need(canAutoDodge(s, helpers), "회피할 수 있는 공격을 받을 때 유골을 사용하세요.");
      need(typeof helpers.autoDodge === "function", "자동 회피 연결이 필요합니다.");
      // The resolver can enter the dream. Exhaust before it runs so dream refresh wins.
      r.ready = false;
      say(s, helpers, `${d.name} 사용 · 소진했습니다.`);
      helpers.autoDodge(s);
      return;
    } else if (r.kind === "rune-rapture") {
      need(h.rewardKillWindow && h.hp > 0 && !h.inDream,
        "적을 처치한 직후 생존한 사냥꾼만 피의 기쁨을 사용할 수 있습니다.");
      need(typeof helpers.draw === "function", "카드 뽑기 연결이 필요합니다.");
      helpers.draw(s, 1);
      h.hp = Math.min(6, h.hp + 1);
      h.rewardKillWindow = false;
    } else {
      need(s.phase === "hunter" && !h.inDream && h.hp > 0,
        "보상은 사냥꾼의 차례에 행동 전후로 사용하세요.");
      if (r.kind === "lantern") {
        const n = targetsView(s, "lantern", helpers).targets.find((n) => n.node === a.node);
        need(n,
          "공개된 정상 등불 칸을 선택하세요. 파괴되었거나 안개 안의 이동 불가 등불은 대상이 아닙니다.");
        if (helpers.teleport) helpers.teleport(s, a.node);
        else h.position = a.node;
      } else if (r.kind === "rune-eye") {
        const from = h.hand.findIndex((c) => c.id === a.discardId),
          to = h.discard.findIndex((c) => c.id === a.takeId);
        need(from >= 0 && to >= 0, "버릴 손패와 회수할 버림 더미 카드를 선택하세요.");
        const returned = h.discard.splice(to, 1)[0];
        h.discard.push(h.hand.splice(from, 1)[0]);
        h.hand.push(returned);
      } else if (r.kind === "iosefka-vial") {
        h.hp = Math.min(6, h.hp + 2);
      } else if (r.kind === "rune-formless") {
        need(!h.firearmReady, "화기가 이미 준비되어 있습니다.");
        h.firearmReady = true;
      } else if (r.kind === "messengers-gift") {
        need(typeof helpers.skipNextActivation === "function", "적 활성화 억제 연결이 필요합니다.");
        helpers.skipNextActivation(s);
      } else if (r.kind === "beast-roar") {
        const targets = s.enemies.filter((e) => e.node === h.position);
        need(targets.length > 0, "같은 칸에 이동시킬 적이 없습니다.");
        need(Array.isArray(a.moves) && a.moves.length === targets.length &&
          new Set(a.moves.map((m) => m.enemyId)).size === targets.length &&
          a.moves.every((m) => targets.some((e) => e.id === m.enemyId)),
          "같은 칸에 있는 모든 적의 목적지를 각각 선택하세요.");
        need(typeof helpers.displaceEnemy === "function", "적 이동 연결이 필요합니다.");
        for (const move of a.moves) validateDisplacement(s, targets.find((e) => e.id === move.enemyId), move.node, helpers);
        for (const move of a.moves) helpers.displaceEnemy(s, targets.find((e) => e.id === move.enemyId), move.node);
      } else if (r.kind === "augur") {
        const target = s.enemies.find((e) => e.id === a.enemyId && e.node === h.position);
        need(target, "같은 칸에 있는 적을 선택하세요.");
        validateDisplacement(s, target, a.node, helpers);
        need(typeof helpers.kill === "function" && typeof helpers.displaceEnemy === "function",
          "적 피해와 이동 연결이 필요합니다.");
        if (helpers.damageEnemy) helpers.damageEnemy(s, target, 2, { source: "reward", rewardKind: r.kind });
        else target.hp -= 2;
        say(s, helpers, `${d.name} · 적에게 2 피해.`);
        helpers.kill(s, target);
        const living = s.enemies.find((e) => e.id === target.id);
        if (living) helpers.displaceEnemy(s, living, a.node);
      } else if (r.kind === "executioner-gloves") {
        const target = s.enemies.find((e) => e.id === a.enemyId);
        need(target && target.hp > 0 && target.hp <= 2 &&
          typeof helpers.distance === "function" && helpers.distance(s, h.position, target.node) <= 2,
          "2칸 이내에 있는 체력 2 이하인 적을 선택하세요.");
        need(typeof helpers.kill === "function", "적 처치 연결이 필요합니다.");
        target.hp = 0;
        say(s, helpers, `${d.name} · 적을 처치합니다.`);
        helpers.kill(s, target);
      } else throw new Error("이 보상의 발동 시점에 맞는 선택을 사용하세요.");
    }
    r.ready = false;
    say(s, helpers, `${d.name} 사용 · 소진했습니다.`);
  }
  function validateDisplacement(s, target, destination, helpers) {
    need(typeof helpers.canDisplace === "function" &&
      helpers.canDisplace(s, target, destination, 2),
      "안개 진입로를 통과하지 않는 2칸 이내의 적 이동 목적지를 선택하세요.");
  }
  function canAutoDodge(s, helpers = {}) {
    const h = hunter(s), c = s.combat;
    if (helpers.canAutoDodge) return !!helpers.canAutoDodge(s);
    if (!h || h.inDream || h.hp <= 0) return false;
    if (s.phase === "mission_death") return true;
    if (!c || c.noDodge || c.origin === "interaction") return false;
    if (s.phase === "combat_extra") return !!c.extra;
    return s.phase === "combat_react" && c.action?.type === "attack" &&
      !c.action.undodgeable && !c.dodged && !c.cancelEnemy &&
      s.enemies.some((e) => e.id === c.enemyId && e.node === h.position);
  }
  function dispatch(s, a, helpers = {}) {
    init(s);
    const h = hunter(s);
    const killSerialBefore=h.rewardKillSerial || 0;
    const types = new Set(["USE_REWARD", "EQUIP_REWARD", "KEEP_REWARD",
      "SET_REWARD_TRIGGER", "REASSIGN_REWARD", "EQUIP_FIREARM", "KEEP_FIREARM", "ENTRY_REWARD"]);
    const equipmentChoice = ["EQUIP_REWARD", "KEEP_REWARD", "EQUIP_FIREARM", "KEEP_FIREARM"].includes(a.type);
    need(!s.rewardChoices.length || equipmentChoice,
      "획득한 보상의 장착·공격 슬롯·보관 선택을 먼저 마치세요.");
    if (!types.has(a.type)) {
      h.rewardKillWindow = false;
      h.rewardTransformWindow = false;
      if(X.enabled(s)) {h.rewardTurnStartWindow=false;delete h.rewardBeastWindow;}
      return false;
    }
    if(a.type === "ENTRY_REWARD") return X.dispatchEntry(s,a,helpers);
    if (a.type === "USE_REWARD") use(s, a, helpers);
    if (a.type === "EQUIP_REWARD") equipReward(s, a, helpers);
    if (a.type === "KEEP_REWARD") {
      const r = get(s, a.rewardId);
      need(r && (pendingReward(s, r.id) || betweenChapters(s)), "보관할 보상을 선택하세요.");
      r.equipped = false; r.slot = null; r.triggerArmed = false;
      finishChoice(s, "rewardId", r.id);
      say(s, helpers, `${definitions[r.kind].name} 보관 · 챕터 사이에 교체할 수 있습니다.`);
    }
    if (a.type === "SET_REWARD_TRIGGER") {
      need(s.phase === "hunter" && typeof a.enabled === "boolean", "사냥꾼 차례에 발동 여부를 선택하세요.");
      const r = get(s, a.rewardId);
      need(r?.equipped && (r.kind === "rune-moon" || X.enabled(s) && r.kind === "rune-corruption") &&
        (!a.enabled || r.ready && !X.limitUsed(s,r)), "준비된 죽음 반응 문자를 선택하세요.");
      r.triggerArmed = a.enabled;
      say(s, helpers, r.kind === "rune-moon" ? `카릴 문자: 달 · 다음 죽음에 사용 ${a.enabled ? "선택" : "해제"}.` :
        `${definitions[r.kind].name} · 다음 치명적 피해에 사용 ${a.enabled ? "선택" : "해제"}.`);
    }
    if (a.type === "REASSIGN_REWARD") {
      const r = readyItem(s, a.rewardId);
      need(definitions[r.kind].persistent && h.rewardTransformWindow && Number.isInteger(a.slot) && a.slot >= 0 && a.slot < slotCount(s,helpers),
        X.enabled(s) ? "무기를 변형한 직후 슬롯 부착 보상을 옮길 슬롯을 선택하세요." : "무기를 변형한 직후 혈석의 파편을 옮길 슬롯을 선택하세요.");
      r.slot = a.slot;
      say(s, helpers, `${definitions[r.kind].name} · ${a.slot + 1}번 슬롯으로 옮겼습니다.`);
    }
    if (a.type === "EQUIP_FIREARM" || a.type === "KEEP_FIREARM") {
      need(h.ownedFirearms.includes(a.firearmId), "획득한 화기를 선택하세요.");
      const pending = s.rewardChoices.find((q) => q.firearmId === a.firearmId);
      need(pending || betweenChapters(s), "새로 획득했거나 챕터 사이에 보관한 화기만 교체할 수 있습니다.");
      if (a.type === "EQUIP_FIREARM") {
        h.firearmId = a.firearmId; h.firearmReady = true;
        say(s, helpers, `${D.firearms[a.firearmId].name} 장착 · 기존 화기는 보관합니다.`);
      } else say(s, helpers, `${D.firearms[a.firearmId].name} 보관.`);
      finishChoice(s, "firearmId", a.firearmId);
    }
    if (a.type !== "REASSIGN_REWARD" && !equipmentChoice) h.rewardTransformWindow = false;
    // Equipment granted by the killing event must be resolved before normal actions.
    // Those mandatory choices do not consume the optional on-kill reaction window.
    const freshKill=X.enabled(s) && (h.rewardKillSerial || 0)!==killSerialBefore;
    if (!equipmentChoice && !freshKill && !(a.type === "USE_REWARD" && get(s, a.rewardId)?.kind === "rune-rapture"))
      h.rewardKillWindow = false;
    if(X.enabled(s) && !equipmentChoice) {
      if(!(a.type === "USE_REWARD" && get(s,a.rewardId)?.kind === "queen-flesh")) h.rewardTurnStartWindow=false;
      // A beast hit can kill another enemy and open a fresh on-kill window.
      if(!freshKill && !(a.type === "USE_REWARD" && get(s,a.rewardId)?.kind === "rune-beast")) delete h.rewardBeastWindow;
    }
    return true;
  }
  // Called before placing the stat card: a replacement suppresses ALL printed stat effects.
  function attackBonus(s, slot, rewardIds = [], helpers = {}) {
    init(s);
    need(Number.isInteger(slot) && (X.enabled(s) && slot === -1 || slot >= 0 && slot < slotCount(s,helpers)), "공격 슬롯을 선택하세요.");
    need(Array.isArray(rewardIds) && new Set(rewardIds).size === rewardIds.length,
      "보상 선택이 중복되었습니다.");
    const chosen = rewardIds.map((id) => {
      const r = readyItem(s, id);
      need(attackKinds.has(r.kind), "공격할 때 사용할 수 있는 준비된 보상을 선택하세요.");
      return r;
    });
    const clawmarks = chosen.filter((r) => r.kind === "rune-clawmark");
    need(clawmarks.length <= 1, "한 스탯 카드에는 손톱자국 문자 하나를 선택하세요.");
    need(slot !== -1 || !clawmarks.length,"스탯 카드를 놓지 않는 화기 공격에는 손톱자국 효과 대체를 사용할 수 없습니다.");
    const attachments = equipped(s,"tool").filter((r) => r.slot === slot);
    const damage = attachments.filter((r) => r.kind === "bloodstone-shard" || X.enabled(s) && r.kind === "bloodstone-chunk").length;
    const bonus = { speed: 0, damage: damage + (clawmarks.length ? 1 : 0),
      interrupt: !!clawmarks.length, replaceCardEffects: !!clawmarks.length };
    if(X.enabled(s)) {
      bonus.speed += attachments.filter((r) => r.kind === "bloodstone-chunk").length;
      const heal=attachments.filter((r) => r.kind === "tear-gem").length;
      if(heal) bonus.heal=heal;
    }
    for (const r of chosen) {
      r.ready = false;
      if (r.kind === "rune-clawmark")
        say(s, helpers, "카릴 문자: 손톱자국 · 스탯 효과를 +1피해·방해로 대체, 소진했습니다.");
      else {
        if (r.kind === "empty-shell") { bonus.speed++; bonus.damage++; }
        if (r.kind === "rune-hunter") { bonus.speed++; bonus.freeTransform = true; }
        if (r.kind === "rune-writhe") { bonus.interrupt = true; bonus.interruptEqual = true; }
        say(s, helpers, `${definitions[r.kind].name} 사용 · 소진했습니다.`);
      }
    }
    return bonus;
  }
  function onDream(s, dead = false, helpers = {}) {
    init(s);
    const h = hunter(s), moon = h.rewards.find((r) =>
      r.kind === "rune-moon" && r.equipped && r.ready && r.triggerArmed);
    const saved = dead && h.echoes > 0 && moon ? 1 : 0;
    if (saved) {
      moon.ready = false;
      say(s, helpers, "카릴 문자: 달 · 피의 유지 1개를 꿈에서 즉시 사용할 수 있도록 보존했습니다.");
    }
    if (dead) for (const r of h.rewards) r.triggerArmed = false;
    for (const r of h.rewards) r.ready = true;
    h.rewardKillWindow = false;
    h.rewardTransformWindow = false;
    if (Object.hasOwn(h, "rewardSkipActivation")) delete h.rewardSkipActivation;
    if(X.enabled(s)) {h.rewardTurnStartWindow=false;delete h.rewardBeastWindow;}
    return saved;
  }
  function onKill(s) {
    init(s);
    const h = hunter(s);
    h.rewardKillWindow = h.hp > 0 && !h.inDream && h.rewards.some((r) =>
      r.equipped && r.ready && r.kind === "rune-rapture");
    if(X.enabled(s)) h.rewardBeastWindow=h.hp>0 && !h.inDream && h.rewards.some((r) =>
      r.equipped && r.ready && r.kind === "rune-beast");
    if(X.enabled(s)) h.rewardKillSerial=(h.rewardKillSerial || 0)+1;
  }
  function onDodge() { /* No chapter-one reward is triggered by dodging. */ }
  function reconcileSlots(s,helpers = {}) {
    init(s); const h=hunter(s);
    if(X.enabled(s)) for(const r of h.rewards) if(r.equipped && definitions[r.kind].persistent && r.slot >= slotCount(s,helpers)) {
      r.equipped=false;r.slot=null;
      if(!pendingReward(s,r.id)) s.rewardChoices.push({rewardId:r.id,reason:"slot"});
    }
  }
  function onTransform(s,helpers = {}) {
    init(s);hunter(s).rewardTransformWindow = true;reconcileSlots(s,helpers);
  }
  function ready(s, id, helpers = {}) {
    init(s);
    const r = get(s, id);
    need(r?.equipped && !r.ready && !definitions[r.kind].persistent,
      "준비할 소진된 장착 보상을 선택하세요.");
    need(!X.limitUsed(s,r),"이번 챕터에 한 번 사용한 보상은 다음 챕터에 다시 사용할 수 있습니다.");
    r.ready = true;
    say(s, helpers, `${definitions[r.kind].name} 준비.`);
  }
  function targetsView(s, kind, helpers) {
    const h = hunter(s), enemies = s.enemies || [];
    const name = (e) => helpers.enemyDef?.(s, e)?.name || D.enemies[e.kind]?.name || e.kind;
    const nodes = helpers.nodes?.(s) || [];
    if (kind === "lantern") return { type: "lamp",
      targets: nodes.filter((n) =>
        (n.lamp !== undefined ? n.lamp : n.icons?.some((i) => i.kind === "lamp")) &&
        (!helpers.canTeleport || helpers.canTeleport(s, n.id)))
        .map((n) => ({ node: n.id, name: n.name || n.id })),
    };
    const destination = (e) => (helpers.displacementDestinations?.(s, e, 2) || [])
      .map((n) => typeof n === "string" ? { node: n, name: nodes.find((x) => x.id === n)?.name || n } :
        { node: n.id || n.node, name: n.name || n.id || n.node });
    if (kind === "beast-roar" || kind === "augur") return {
      type: kind === "beast-roar" ? "enemies-destinations" : "enemy-destination",
      targets: enemies.filter((e) => e.node === h.position)
        .map((e) => ({ enemyId: e.id, name: name(e), destinations: destination(e) })),
    };
    if (kind === "executioner-gloves") return { type: "enemy",
      targets: enemies.filter((e) => e.hp > 0 && e.hp <= 2 &&
        helpers.distance && helpers.distance(s, h.position, e.node) <= 2)
        .map((e) => ({ enemyId: e.id, name: name(e) })),
    };
    return null;
  }
  function view(s, helpers = {}) {
    const h = hunter(s);
    const currentTile = (helpers.nodes?.(s) || []).find((n) => n.id === h.position)?.tile;
    const lanternBlockedReason = s.result || s.phase === "over" ? "사냥이 종료되었습니다." :
      h.inDream ? "사냥꾼의 꿈에서는 사용할 수 없습니다." :
      s.mission?.fog?.includes(currentTile) ? "안개 진입로 안에서는 꿈으로만 나갈 수 있습니다." :
      "현재 이동할 수 있는 등불이 없습니다.";
    return {
      choices: s.rewardChoices || [],
      rewards: (h.rewards || []).map((r) => {
        const d = definitions[r.kind];
        const hunterTurn = s.phase === "hunter" && !h.inDream && h.hp > 0;
        const controls = X.controls(s,r,helpers) || targetsView(s, r.kind, helpers);
        const laterHunterUsable = hunterTurn &&
          (["iosefka-vial", "messengers-gift"].includes(r.kind) ||
           r.kind === "rune-formless" && !h.firearmReady ||
           ["beast-roar", "augur", "executioner-gloves"].includes(r.kind) && controls.targets.length > 0);
        return { ...r, name: d.name, rules: d.rules, timing: d.timing,
          subtype: d.subtype, persistent: d.persistent, photos: d.photos || [],
          usable: X.definitions[r.kind] ? X.canUse(s,r,helpers) : r.equipped && r.ready &&
            (r.kind === "lantern" && hunterTurn && controls.targets.length > 0 ||
             r.kind === "rune-eye" && hunterTurn && h.hand.length > 0 && h.discard.length > 0 ||
             r.kind === "rune-rapture" && h.rewardKillWindow && h.hp > 0 && !h.inDream ||
             laterHunterUsable || r.kind === "old-hunter-bone" && canAutoDodge(s, helpers)),
          attackSelectable: attackKinds.has(r.kind) && r.equipped && r.ready &&
            ["hunter", "combat_choose"].includes(s.phase),
          triggerSelectable: (r.kind === "rune-moon" || X.enabled(s) && r.kind === "rune-corruption") &&
            r.equipped && r.ready && !X.limitUsed(s,r) && hunterTurn,
          reassignable: d.persistent && r.equipped && !!h.rewardTransformWindow,
          ...(r.kind === "lantern" && (s.result || h.inDream || !controls.targets.length) ?
            {disabledReason:lanternBlockedReason} : {}),
          ...(X.definitions[r.kind] ? {limitUsed:X.limitUsed(s,r), activeUse:d.activeUse,
            disabledReason:d.subtype === "quest" ? "사용 불가 임무 물품 · 획득 임무는 해당 캠페인 자료가 필요합니다." :
              X.limitUsed(s,r) ? "이번 챕터 사용 완료 · 꿈이나 도구 준비로 횟수 제한을 되돌릴 수 없습니다." :
              r.kind === "queen-flesh" && !h.rewardTurnStartWindow ? "차례 시작 직후에 사용합니다." :
              r.kind === "hunter-torch" ? "보스가 아닌 적이 같은 칸으로 이동해 들어올 때 반응을 선택합니다." :
              r.kind === "rune-corruption" ? "다음 치명적 피해에 사용할지 미리 선택합니다." : ""} : {}),
          ...(controls ? { controls } : {}),
        };
      }),
      firearms: (h.ownedFirearms || [h.firearmId || "hunter-pistol"]).map((id) =>
        ({ id, ...(helpers.firearmDefinition?.(s,id) || D.firearms[id]), equipped: h.firearmId === id,
          ready: h.firearmId === id && h.firearmReady })),
      killWindow: !!h.rewardKillWindow, transformWindow: !!h.rewardTransformWindow,
      ...(X.enabled(s) ? {entry:X.entryView(s,helpers)} : {}),
    };
  }
  function assert(s) {
    const ids = new Set();
    for (const h of Object.values(s.hunters)) {
      for (const r of h.rewards || []) {
        need(typeof r.id === "string" && !ids.has(r.id) && known(s,r.kind), "보상 상태를 확인하세요.");
        need(r.qaStart===undefined || r.qaStart===true && s.setup?.qa &&
          s.setup.qa.startRewards.includes(r.kind),"검증 시작 보상 기록 오류.");
        ids.add(r.id);
        need(typeof r.equipped === "boolean" && typeof r.ready === "boolean", "보상 장착·준비 상태를 확인하세요.");
        need(!definitions[r.kind].persistent || r.ready, X.enabled(s) ? "슬롯 부착 보상은 소진되지 않습니다." : "혈석의 파편은 소진되지 않습니다.");
        if (r.equipped && definitions[r.kind].persistent)
          need(Number.isInteger(r.slot) && r.slot >= 0 && r.slot < (X.enabled(s) ? h.slots.length : 3), X.enabled(s) ? "슬롯 부착 보상의 슬롯을 확인하세요." : "혈석의 파편 슬롯을 확인하세요.");
        if(X.definitions[r.kind]) {
          need(definitions[r.kind].subtype !== "quest" || !r.equipped,"사용 불가 임무 물품은 보관합니다.");
          need(r.lastUsedChapter === undefined || Number.isInteger(r.lastUsedChapter) && r.lastUsedChapter >= 1 && r.lastUsedChapter <= 3,
            "챕터별 보상 사용 기록을 확인하세요.");
        }
      }
      for (const subtype of ["tool", "rune"])
        need((h.rewards || []).filter((r) => r.equipped && definitions[r.kind].subtype === subtype).length <= 2,
          "같은 종류의 보상 장착 제한을 초과했습니다.");
      need(new Set(h.ownedFirearms).size === h.ownedFirearms.length &&
        h.ownedFirearms.includes(h.firearmId || "hunter-pistol") && h.ownedFirearms.every((id) => D.firearms[id]),
        "화기 보관·장착 상태를 확인하세요.");
    }
    for (const [kind, d] of Object.entries(definitions))
      need(Object.values(s.hunters).reduce((n, h) => n + (h.rewards || []).filter((r) => r.kind === kind && !r.qaStart).length, 0) <= d.count,
        "보상 카드 공급을 초과했습니다.");
    if(s.setup?.qa)for(const kind of Object.keys(definitions))
      need(Object.values(s.hunters).reduce((n,h)=>n+(h.rewards||[]).filter(r=>r.kind===kind&&r.qaStart).length,0)<=
        s.setup.qa.startRewards.filter(id=>id===kind).length,"검증 시작 보상 수량 오류.");
    for (const q of s.rewardChoices || [])
      need(q.rewardId ? get(s, q.rewardId) && !get(s, q.rewardId).equipped :
        hunter(s).ownedFirearms.includes(q.firearmId), "보상 선택 상태를 확인하세요.");
    return true;
  }
  const api = { definitions, init, grant, dispatch, attackBonus, onDream, onKill,
    onDodge, onTransform, ready, view, assert, canAutoDodge,
    onTurnStart:X.onTurnStart,onChapterStart:X.onChapterStart,preventDeath:X.preventDeath,
    onEnemyStep:X.onEnemyStep,entryView:X.entryView };
  api.reconcileSlots=reconcileSlots;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BBRewards = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
