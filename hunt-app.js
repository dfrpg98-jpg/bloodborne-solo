(function () {
  "use strict";
  const E = window.BBHunt,
    M = window.BBChapter,
    D = E.data,
    ED = window.BBEnemyDeck,
    $ = (id) => document.getElementById(id),
    key = "bloodborne-hunt-v07",
    qaKey = "bloodborne-hunt-qa-v1",
    activeModeKey = "bloodborne-hunt-active-mode",
    previousKey = "bloodborne-hunt-v06",
    oldKey = "bloodborne-hunt-v05";
  const esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const colors = { gold: "#dec079", red: "#dc9784", purple: "#bca0d4" },
    directionNames = { N: "북쪽 ↑", E: "동쪽 →", S: "남쪽 ↓", W: "서쪽 ←" };
  const uiText = (text, context = "skill") => {
    const cleaned = window.BBHuntPublicText?.clean(text, context) ?? String(text ?? "");
    return cleaned.replace(/\b([a-z][a-z0-9-]*)(을|를|이|가|은|는)?/g, (original, id, suffix) => {
      const name = D.consumables?.[id]?.name;
      if (!name) return original;
      const last = name.codePointAt(name.length - 1), hasEnding = last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28;
      const particle = suffix === "을" || suffix === "를" ? hasEnding ? "을" : "를" :
        suffix === "이" || suffix === "가" ? hasEnding ? "이" : "가" : suffix === "은" || suffix === "는" ? hasEnding ? "은" : "는" : suffix || "";
      return name + particle;
    });
  };
  const faceName = (face, index = 0) => uiText(face?.name || "").trim() || (index ? "변형 상태" : "기본 형태");
  function polishPlayerText(container = document.body) {
    if (!container || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(container, 4);
    let text;
    while ((text = walker.nextNode())) {
      const parent = text.parentElement;
      if (!parent || parent.closest("script,style,textarea")) continue;
      const context = parent.closest("#objectiveDetail,#revealedCards,#storyPanel,#pastChapters,#missionNotices,#storyDialog") ? "mission" :
        parent.closest(".inventory-panel,#startingItemSetup") ? "item" : parent.closest(".rewards-panel") ? "reward" : "skill";
      if (/카드|앞면|뒷면|[AB]\s*면/.test(text.nodeValue)) text.nodeValue = uiText(text.nodeValue, context);
    }
  }
  const button = (label, type, args = {}, disabled = false, cls = "") =>
    `<button class="${cls}" data-command="${type}" data-args="${esc(JSON.stringify(args))}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const commandButton = (option, cls = "") => {
    const { type, ...args } = option.command;
    const held = args.itemId && (E.hunter(state).consumables || []).find(item => item.id === args.itemId),
      item = held && consumableDefinitions()?.[held.kind],
      label = item ? option.label.replace(held.name || held.kind, item.name) : option.label;
    return button(esc(uiText(label, "mission")), type, args, !!option.disabled, cls);
  };
  const missionView = () => E.missionView ? E.missionView(state) : null;
  const applyLoadedRuling = (loaded) => E.applyChapelRuling ? E.applyChapelRuling(loaded) : loaded;
  const isQa = () => !!state.setup?.qa;
  const saveKey = () => isQa() ? qaKey : key;
  const consumableDefinitions = () => E.consumableDefinitions ? E.consumableDefinitions(state) : D.consumables;
  const attackReplacesCardEffects = () => [...selectedRewards].some((id) => E.hunter(state).rewards?.some((r) => r.id === id && r.kind === "rune-clawmark"));
  const nodeName = (id) => E.node(state, id)?.name || "지도 밖";
  const placementOptions = () => E.placementOptions
    ? E.placementOptions(state)
    : M.placementOptions(state.world, state.world.pending.tileId, state.world.pending.anchor);
  let state = E.create(undefined, "burial", 0, null, "hunter-pistol", "center", { campaign: true }),
    selectedCard = null,
    selectedSlot = null,
    selectedEnemy = null,
    mapTarget = null,
    presentationActions = [],
    presentationSession = 1,
    presentationOrigins = new Map(),
    declaredWeaponVisual = null,
    needsCameraFollow = true,
    rendering = false,
    camera = null,
    presentation = null,
    rotation = null,
    previewTile = null,
    mapColumns = 1,
    pulls = new Set(),
    selectedRewards = new Set(),
    nextStartSpace = "",
    nextFace = null,
    weaponBoost = "none",
    reloadSecondCardId = null,
    interactionSelectionKey = null,
    interactionMissionSelected = true,
    restoredPrevious = false,
    startupError = "",
    setupRequired = true;
  const practiceRewards = new Map(), qaRewards = new Map(), qaConsumables = new Map();
  let lastSetupMode = "campaign";
  // Reading a story is presentation only. No story field is added to replayed
  // game state or saved commands, including when older saves are resumed.
  const readStories = new Set();
  let storyEntries = [], storySelection = null, storyOpener = null, storyReturnPanel = null;
  try {
    const current = localStorage.getItem(key), qaSaved = localStorage.getItem(qaKey),
      useQa = localStorage.getItem(activeModeKey) === "qa" && !!qaSaved,
      saved = useQa ? qaSaved : current || localStorage.getItem(previousKey) || qaSaved;
    if (saved) { state = applyLoadedRuling(E.importSave(saved)); setupRequired = false; }
    restoredPrevious = !!saved && !current && !isQa();
  } catch {
    startupError =
      "자동 저장을 읽지 못했습니다. 내보낸 실제 지도 저장 파일을 불러오세요.";
  }
  const enemyHistory = window.BBEnemyActionHistory({ E, labels: ED.labels });
  enemyHistory.reset(state);
  const invData = { ...D };
  Object.defineProperty(invData, "nodes", { get: () => E.nodes(state) });
  Object.defineProperty(invData, "consumables", { get: consumableDefinitions });
  const inventory = window.BBInventory({
    E: {
      ...E,
      data: invData,
      distance: (a, b) => E.distance(state, a, b),
      node: (id) => E.node(state, id),
      enemyDef: (e) => E.enemyDef(state, e),
      canTeleport: (to) => E.canTeleport(state, to),
      path: (a, b) => E.path(state, a, b),
    },
    getState: () => state,
    send,
    refresh: renderDecisions,
  });
  const shell = window.BBHuntShell?.({ document, onCenterMap: () => centerMap(true) });
  function compactDialog(dialogId, closeId, restoreSource) {
    const dialog = $(dialogId), close = $(closeId);
    if (!dialog || !close) return null;
    let opener = null;
    const dismiss = () => { if (dialog.open) dialog.close(); };
    close.onclick = dismiss;
    dialog.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener("close", () => {
      const target = opener?.isConnected === false ? restoreSource?.() : opener;
      target?.focus?.({ preventScroll: true });
    });
    return { close: dismiss, open(source) {
      shell?.close();
      opener = source;
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      const body = dialog.querySelector(".compact-dialog-content"); if (body) body.scrollTop = 0;
      close.focus?.({ preventScroll: true });
    } };
  }
  const historyPopup = compactDialog("enemyHistoryDialog", "closeEnemyHistory", () => $("deckStatus").querySelector("[data-enemy-history]")),
    enemyPopup = compactDialog("enemyDetailDialog", "closeEnemyDetail");
  presentation = window.BBHuntPresentation?.({ document, Phaser: window.Phaser,
    viewport: $("mapViewport"), host: $("mapEffects"), characters: { ...window.BBCharacterAssets, ...window.BBWeaponCharacterAssets },
    onReady: () => syncPresentation() });
  camera = window.BBHuntCamera?.({ document, viewport: $("mapViewport"),
    content: $("chapterMap"), surface: $("mapSurface"), padEdges: true, onChange: ({ zoom }) => {
      if ($("zoomLabel")) $("zoomLabel").textContent = `${Math.round(zoom * 100)}%`;
      if (!rendering) syncPresentation();
    } });
  function sceneId() { return `${state.initialSeed}:${state.mission?.chapter || 0}:${presentationSession}`; }
  function hunterVisual(source = state) {
    const h = E.hunter(source), charged = h.weaponCharge?.round === source.round;
    return { weaponId: h.weaponId, weaponFace: h.face,
      skin: window.BBWeaponVisuals?.skin(h.weaponId, h.face, charged) || "hunter" };
  }
  function attackDeclaration(source) {
    const c = source.combat;
    if (!c?.attack) return null;
    const h = E.hunter(source), history = source.commands || [];
    let index = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      const command = history[i];
      if (["ATTACK", "COUNTER"].includes(command.type) && Number.isInteger(command.slot) &&
        (!command.enemyId || command.enemyId === c.enemyId)) { index = i; break; }
    }
    const faces = D.weapons[h.weaponId]?.faces || [];
    let face = c.attack.weaponFace ? faces.findIndex(value => JSON.stringify(value) === JSON.stringify(c.attack.weaponFace)) : h.face;
    if (face < 0) face = h.face;
    const slot = index >= 0 ? history[index].slot : faces[face]?.slots?.findIndex(value => value.name === c.attack.name);
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) return null;
    return { weaponId: h.weaponId, face, slot, index,
      signature: `${source.initialSeed}:${source.mission?.chapter || 0}:${c.enemyId}:${c.attack.name}:${index}` };
  }
  function recoveredCharge(source, index) {
    if (E.hunter(source).weaponId !== "tonitrus" || index < 0) return false;
    try {
      // A loaded combat has already consumed its charge. Replay its own accepted
      // inputs on a disposable copy, once, to recover the public pre-attack glow.
      const setup = source.setup;
      let replay = E.create(source.initialSeed, setup.weaponId, setup.face, setup.startingConsumable,
        setup.firearmId, setup.startSpace, { campaign: !!setup.campaign, provisional: setup.provisional,
          ...(setup.firearmOverride ? { firearmOverride: true } : {}),
          ...(setup.practiceTarget ? { practiceTarget: setup.practiceTarget, practiceSide: setup.practiceSide } : {}),
          ...(Object.hasOwn(setup, "practiceRewards") ? { practiceRewards: setup.practiceRewards } : {}),
          ...(setup.qa ? { qa: setup.qa } : {}), rulesVersion: setup.rulesVersion ?? null });
      for (const command of source.commands.slice(0, index)) replay = E.dispatch(replay, command);
      return E.hunter(replay).weaponCharge?.round === replay.round;
    } catch (_) { return false; }
  }
  function currentAttackVisual(source = state, previous = null) {
    const declaration = attackDeclaration(source);
    if (!declaration || !window.BBWeaponVisuals) return null;
    if (declaredWeaponVisual?.signature === declaration.signature) return declaredWeaponVisual.visual;
    const charged = previous && E.hunter(previous).weaponId === declaration.weaponId
      ? E.hunter(previous).weaponCharge?.round === previous.round : recoveredCharge(source, declaration.index);
    const visual = window.BBWeaponVisuals.attack(declaration.weaponId, declaration.face, declaration.slot, charged) ||
      { skin: "hunter", attackSlot: declaration.slot, attackStyle: "weapon", motion: "slash",
        weaponId: declaration.weaponId, weaponFace: declaration.face };
    declaredWeaponVisual = { signature: declaration.signature, visual };
    return visual;
  }
  function animationSnapshot() {
    const h = E.hunter(state), c = state.combat, visual = currentAttackVisual();
    return { sceneId: sceneId(), revision: state.revision, firearmReady: h.firearmReady,
      actors: [{ id: "hunter", kind: "hunter", node: h.position, hp: h.hp, ...hunterVisual() },
        ...state.enemies.map((e) => ({ id: e.id, kind: "enemy", node: e.node, hp: e.hp, name: E.enemyDef(state, e).name }))],
      events: state.events.map(({ round, text }) => ({ round, text })),
      combat: c ? { enemyId: c.enemyId, attackName: c.attack?.name, enemyActionName: c.action?.name,
        ...(visual ? { attackSlot: visual.attackSlot, attackSkin: visual.skin, attackStyle: visual.attackStyle, motion: visual.motion,
          weaponId: visual.weaponId, weaponFace: visual.weaponFace } : {}),
        immediateName: c.immediate?.name || c.immediate?.label, extraName: c.extra?.name || c.extra?.label,
        flameName: c.flame ? c.flame.name || E.firearm(state).name : undefined } : null,
      weaponShot: state.commands?.at(-1)?.type === "WEAPON_SHOT"
        ? window.BBWeaponVisuals?.attack(h.weaponId, h.face, state.commands.at(-1).slot, h.weaponCharge?.round === state.round) : null,
      firearmEntry: state.firearmEntry ? { enemyId: state.firearmEntry.enemyId } : null };
  }
  function showError(message = "") {
    $("error").textContent = message;
    if ($("infoError")) $("infoError").textContent = message;
  }
  function save() {
    try {
      localStorage.setItem(saveKey(), E.exportSave(state));
      localStorage.setItem(activeModeKey, isQa() ? "qa" : "normal");
      $("saveStatus").textContent = isQa() ? "검증 전용 진행 · 별도 자동 저장됨" : `${restoredPrevious ? "v0.6에서 이어온 진행 · " : ""}자동 저장됨`;
    } catch {
      $("saveStatus").textContent =
        "자동 저장 불가 · 저장 내보내기를 이용하세요";
    }
  }
  function send(type, args = {}) {
    return sendCommands([{ type, ...args }]);
  }
  function sendCommands(commands) {
    const previousDeclaredVisual = declaredWeaponVisual;
    try {
      const previous = state, before = animationSnapshot(), last = commands[commands.length - 1], type = last.type;
      // Validate the entire convenience action before committing its original
      // commands. Costs, event order and replay data still belong to the engine.
      let next = state, observedSteps = [];
      for (const command of commands) {
        const prior = next; next = E.dispatch(next, command);
        currentAttackVisual(next, prior);
        observedSteps.push([prior, next]);
      }
      state = next;
      for (const [prior, following] of observedSteps) enemyHistory.observe(prior, following);
      presentationActions = window.BBHuntAnimationEvents?.describe(before, animationSnapshot(), commands) || [];
      needsCameraFollow = E.hunter(previous).position !== E.hunter(state).position ||
        previous.world.pending?.tileId !== state.world.pending?.tileId || previous.mission?.chapter !== state.mission?.chapter;
      mapTarget = null;
      shell?.close();
      if (type === "START_NEXT_CHAPTER") { nextStartSpace = ""; nextFace = null; }
      if (type === "ENTER_BETWEEN_CHAPTERS") { nextStartSpace = ""; nextFace = E.hunter(state).face; }
      pulls.clear();
      selectedRewards.clear();
      reloadSecondCardId = null;
      weaponBoost = "none";
      inventory.clear();
      save();
      render();
      showError("");
      return true;
    } catch (e) {
      declaredWeaponVisual = previousDeclaredVisual;
      showError(e.message);
      return false;
    }
  }
  function bind(box) {
    box
      .querySelectorAll("[data-command]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            send(b.dataset.command, JSON.parse(b.dataset.args || "{}"))),
      );
  }
  function choices(cards, type, keyName) {
    return `<div class="choice-grid">${cards.map((c) => button(`${esc(E.card(c).name)}<small>${esc(E.card(c).text)}</small>`, type, { [keyName]: c.id })).join("")}</div>`;
  }
  function render() {
    rendering = true;
    renderResumeButtons();
    const h = E.hunter(state);
    if (!h.hand.some((c) => c.id === selectedCard)) selectedCard = null;
    if (!state.enemies.some((e) => e.id === selectedEnemy))
      selectedEnemy =
        state.enemies.find((e) => e.node === h.position)?.id ||
        state.enemies[0]?.id ||
        null;
    const currentSlots = E.slots(state);
    if (selectedSlot !== null && (!currentSlots[selectedSlot] || h.slots[selectedSlot])) selectedSlot = null;
    const valid = new Set(E.pullCandidates(state).map((e) => e.id));
    pulls = new Set([...pulls].filter((id) => valid.has(id)));
    $("roundLabel").textContent = `라운드 ${state.round} · 처치 ${state.kills}`;
    $("track").innerHTML = Array.from(
      { length: 16 },
      (_, i) =>
        `<span class="tick ${D.track.resets.includes(i + 1) ? "reset" : ""} ${i + 1 === state.track ? "current" : ""}">${i + 1}</span>`,
    ).join("");
    $("lastRound").textContent = state.lastRound ? "마지막 라운드" : "";
    $("status").innerHTML =
      `<p class="eyebrow">사냥꾼</p><h2>체력 ${h.hp} / 6 <small>· 피의 유지 ${h.echoes} / 3</small></h2><p>${h.inDream ? "사냥꾼의 꿈" : esc(E.node(state, h.position).name)}</p><p class="muted">독 ${h.status.poison ? "있음" : "없음"} · 발광 ${h.status.frenzy ? "있음" : "없음"}</p>`;
    renderFirearm();
    renderMission();
    renderRewards();
    renderMap();
    renderHand();
    inventory.render();
    renderDecisions();
    renderEnemies();
    renderComponents();
    $("huntLog").innerHTML = state.events
      .slice()
      .reverse()
      .map((e) => `<p><small>라운드 ${e.round}</small> ${esc(uiText(e.text))}</p>`)
      .join("");
    polishPlayerText();
    shell?.sync({ phase: state.phase, mandatoryReward: !!E.rewardsView?.(state)?.choices.length,
      setupOpen: setupRequired || $("setupDialog").open });
    resizeMap();
    if (needsCameraFollow) centerMap(true, false);
    needsCameraFollow = false;
    rendering = false;
    syncPresentation();
  }
  function actualGun() {
    const gun = E.firearm(state);
    return gun.actual === true && gun.temporary !== true;
  }
  function firearmAction() {
    const gun = E.firearm(state), h = E.hunter(state), actual = actualGun();
    if (actual && gun.trigger === "enemy-enters") return "";
    const attack = actual && gun.trigger === "hunter-turn", effect = actual && gun.trigger === "hunter-effect",
      targetId = attack && state.phase === "combat_choose" ? state.combat?.enemyId : selectedEnemy,
      target = state.enemies.find((e) => e.id === targetId),
      attackRewardIds = state.setup.rulesVersion >= 11 ? [...selectedRewards] : [],
      statReplacement = attack && attackRewardIds.some((id) => h.rewards?.some((r) => r.id === id && r.kind === "rune-clawmark")),
      allowed = E.canFirearm(state) && !E.rewardsView?.(state)?.choices?.length && !statReplacement && (!(attack || effect) || target?.node === h.position) && (!effect || target && !E.enemyDef(state, target).boss);
    if (attack && !["hunter", "combat_choose"].includes(state.phase)) return "";
    if (effect && state.phase !== "hunter") return "";
    const label = attack ? state.phase === "combat_choose" ? `${gun.name}로 맞서 공격` : `${gun.name} 공격 · 선택한 적`
      : effect ? `${gun.name} · 선택한 적에게 피해 및 이동` : actual && gun.trigger === "enemy-attack" ? "적 공격 속도 -1 · 모든 공격 효과 제거" : "화기 사용 · 기본 공격 방해";
    const args = attack || effect ? { enemyId: target?.id || null } : {},
      boostCode = state.setup.rulesVersion >= 10 ? E.weaponFace(state).effect?.code : null;
    if (attack && attackRewardIds.length) args.rewardIds = attackRewardIds;
    if (attack && boostCode === "attack_sacrifice_damage") args.weaponBoost = weaponBoost === "none" ? 0 : +weaponBoost;
    if (attack && boostCode === "attack_sacrifice_speed_or_damage") args.weaponBoost = ["speed", "damage"].includes(weaponBoost) ? weaponBoost : "none";
    return button(label, "FIREARM", args, !allowed) + (statReplacement ? '<p class="muted">손톱자국은 스탯 카드 공격에만 사용합니다. 선택을 해제하면 화기로 공격할 수 있습니다.</p>' : "");
  }
  function renderFirearm() {
    const h = E.hunter(state), gun = E.firearm(state), actual = actualGun(),
      cost = actual ? gun.prepareCost || 1 : 1,
      description = actual && gun.trigger === "enemy-enters"
        ? "적이 사냥꾼의 칸으로 이동해 들어올 때 소진하여 그 적에게 피해 2를 줍니다."
        : actual && gun.trigger === "hunter-turn"
          ? `자기 차례에 속도 ${gun.speed ?? 2} · 피해 ${gun.damage ?? 2}${gun.interrupt === false ? "" : " · 방해"} 공격을 합니다.${gun.splash === 0 ? "" : ` 공격 후 같은 칸의 다른 적들에게 피해 ${gun.splash ?? 1}을 줍니다.`}`
          : "적의 기본 공격을 자동으로 방해합니다.",
      preparationRules = new Set([gun.prepareText, gun.readyRule].filter(Boolean)),
      effectRules = Array.isArray(gun.rules) ? gun.rules.filter(rule => !preparationRules.has(rule)) : [],
      printed = effectRules.length ? effectRules.map(rule => esc(uiText(rule))).join("<br>") : esc(description);
    const preparation = h.firearmReady ? "" : `<p class="muted" data-firearm-preparation>플레이어의 차례에 손패 ${cost}장을 버려 준비${actual && gun.prepareEchoCost ? ` 또는 피의 유지 ${gun.prepareEchoCost}개로 준비` : ""} · 꿈에서 회복${actual && gun.prepareOnTransform ? " · 무기를 변형할 때도 준비" : ""}${!actual && h.firearmId !== "hunter-pistol" ? "<br>이 저장/시험에서는 단총과 같은 능력으로 임시 동작" : ""}</p>`;
    $("firearm").innerHTML = `<p class="eyebrow">장착 화기</p><h2>${esc(gun.name)} <small class="${h.firearmReady ? "ready" : "spent"}">${h.firearmReady ? "준비됨" : "소진됨"}</small></h2><section class="firearm-rules" aria-label="화기 효과와 준비"><h3>화기 효과와 준비</h3><p>${printed}</p>${preparation}</section>${firearmAction()}`;
    bind($("firearm"));
  }
  function renderComponents() {
    const figures = state.enemies.filter((e) => e.componentId || e.provisionalKind);
    $("componentsPanel").hidden = !figures.length;
    $("componentCards").innerHTML = figures.map((e) => {
      const d = E.enemyDef(state, e), actual = d.actual === true && d.temporary !== true,
        describe = (a) => {
          if (!a) return "";
          const effects = [a.stun && "기절", a.interrupt && "방해", a.poison && "독", a.frenzy && "발광",
            a.undodgeable && "회피 불가", a.uninterruptible && "방해 불가",
            a.bossInsightReduction && "보스의 계몽 토큰마다 피해 -1",
            a.forceHunterMove && `공격당한 사냥꾼 ${a.forceHunterMove}칸 멀리 이동`].filter(Boolean);
          return `${esc(a.name)}${a.type !== "ability" && Number.isFinite(a.speed) ? ` · 속도 ${a.speed}` : ""}${a.type === "attack" && a.damage !== undefined ? ` · 피해 ${a.damage}` : ""}${effects.length ? `<p>${effects.map(esc).join(" · ")}</p>` : ""}${a.rules?.length ? `<p>${a.rules.map(rule => esc(uiText(rule))).join("<br>")}</p>` : ""}`;
        },
        boss = d.boss ? `<p class="component-tokens">계몽 토큰 ${e.insightTokens || 0}개</p>${actual ? button("화기 소진 · 보스에게 계몽 토큰 +1", "BOSS_INSIGHT", {}, !E.canBossInsight?.(state)) : ""}` : "";
      const actions = d.boss && actual ? (state.combat?.enemyId === e.id && state.combat.action ? [state.combat.action] : []) : null,
        abilityText = actions ? actions.map((a) => `<dt>${esc(a.type === "ability" ? "전용 능력" : "행동 공격")}</dt><dd>${describe(a)}</dd>`).join("")
          : `<dt>기본 공격</dt><dd>${describe(d.basic)}</dd><dt>특수 공격</dt><dd>${describe(d.special)}</dd><dt>전용 능력</dt><dd>${describe(d.ability)}</dd>`;
      return `<article class="component-card"><p class="eyebrow">${actual ? d.boss ? "보스" : "특수 적" : "임시 시험 상대"}${d.boss && e.componentPhase ? ` · ${e.componentPhase}페이즈` : ""}</p><h3>${esc(d.name)}</h3><p>체력 ${e.hp} / ${d.maxHp} · ${esc(nodeName(e.node))}</p>${boss}<details><summary>${actions ? "현재 공개된 행동" : "공격과 전용 능력"}</summary>${actions && !actions.length ? '<p class="muted">아직 행동을 시작하지 않았습니다.</p>' : `<dl>${abilityText}</dl>`}</details></article>`;
    }).join("");
    bind($("componentCards"));
  }
  function renderMission() {
    const view = missionView(), provisional = E.provisionalView ? E.provisionalView(state) : null,
      chapter = view?.chapter || 1;
    $("missionPanel").hidden = !view;
    renderStories(view && !provisional ? view : null);
    $("modeLabel").textContent = view ? `${isQa() ? "검증 전용 · " : ""}기나긴 사냥 · 챕터 ${chapter}` : "실제 지도 · 전투 연습";
    $("qaModeBadge").hidden = !isQa();
    document.title = view ? `블러드본 · ${isQa() ? "검증 전용 · " : ""}기나긴 사냥 챕터 ${chapter}` : "블러드본 · 사냥 연습";
    $("modeNotice").innerHTML = view
      ? `<strong>기나긴 사냥 · 챕터 ${chapter}${view.won ? " 완수" : ""}</strong><span>${view.won ? chapter === 3 ? "기나긴 사냥의 마지막 사냥을 완수했습니다. 마지막 꿈에서 성장을 마치고 전체 캠페인 기록을 보관하세요." : state.phase === "between_chapters" ? `장비를 교체하고 중앙 등불 타일의 시작 칸을 골라 챕터 ${chapter + 1}을 시작하세요.` : "사냥을 완수했습니다. 마지막 꿈에서 성장을 마친 뒤 다음 챕터를 준비할 수 있습니다." : "공개된 임무를 따라 사냥을 진행하세요. 챕터 사이에는 보관한 장비를 교체하고 다음 사냥의 시작 칸을 선택합니다."}</span>`
      : "<strong>실제 지도 전투 연습</strong><span>이 사냥은 임무 없이 탐험·전투·꿈의 업그레이드를 연습하는 모드입니다. 새 사냥에서 기나긴 사냥 챕터 1을 선택할 수 있습니다.</span>";
    if (provisional) {
      $("modeLabel").textContent = `임시 구성물 시험 · ${provisional.name}`;
      $("modeNotice").innerHTML = `<strong>${esc(provisional.name)}${state.result === "provisional-win" ? " · 시험 완료" : provisional.npc ? " · 상호작용" : provisional.phase ? ` · ${esc(provisional.phase)}페이즈` : ""}</strong><span>${esc(provisional.notice)} 이 시험은 기나긴 사냥 캠페인과 별도로 진행하며 임시 작성된 구성물을 사용합니다.</span>`;
    }
    if (isQa()) $("modeNotice").innerHTML = $("modeNotice").innerHTML
      .replace("<strong>기나긴 사냥", "<strong>검증 전용 · 기나긴 사냥")
      .replace("</span>", " 테스트 장비와 시작 지급을 사용하며, 일반 사냥과 별도로 자동 저장됩니다.</span>");
    if (!view) return;
    $("missionInsight").textContent = `이번 챕터 완료 계몽 ${view.insight}장`;
    const publicChapter = window.BBHuntPublicText.chapter(state, view, window.BBLongHunt),
      objectives = publicChapter?.objectives || view.objectives.filter((o) => o.status !== "미발견"),
      doneStatus = (o) => ["completed", "complete", "done", "완료"].includes(o.status),
      objectiveHTML = (o) => {
        const done = doneStatus(o), description = chapter === 1 && o.id === "main" && !view.revealed.includes(2)
          ? "계몽 2장 이상을 모은 뒤 중앙 등불 타일에서 이동을 마치세요." : o.description;
        return `<article class="mission-objective ${done ? "completed" : ""}"><b>${done ? "✓ " : ""}${esc(uiText(o.title, "mission"))} <small>${esc(o.status)}</small></b><span class="muted">${esc(window.BBHuntPublicText.sentence(description || ""))}</span></article>`;
      },
      primary = objectives.find((o) => !doneStatus(o)) || objectives[0],
      allObjectives = objectives.map(objectiveHTML).join("") || '<p class="muted">공개된 임무 기록을 확인하세요.</p>';
    const main = publicChapter?.main || objectives.find(o => o.id === "main") || primary;
    $("missionObjectives").innerHTML = main ? objectiveHTML(main) + (primary && primary.id !== main.id ? `<div class="secondary-objective">${objectiveHTML(primary)}</div>` : "") : allObjectives;
    const activations = publicChapter?.activations || [], nextPlaces = activations.filter(trigger => !trigger.known);
    $("chapterConditions").innerHTML = `<span class="condition-label">계몽 단서</span> ${nextPlaces.length ? nextPlaces.map(trigger => esc(trigger.title)).join(" · ") + "에서 이동을 마치세요." : "방문한 장소의 공개 임무를 확인하세요."}`;
    $("chapterConditionDetail").innerHTML = `<h3>챕터 ${chapter} · 계몽 단서를 확인하는 조건</h3>${activations.map(trigger => `<p>${trigger.known ? "✓ " : ""}${esc(trigger.description)}${trigger.known ? " 이미 조사한 장소입니다." : ""}</p>`).join("")}${publicChapter?.insightObjectives.map(objectiveHTML).join("") || ""}`;
    if ($("objectiveDetail")) $("objectiveDetail").innerHTML = allObjectives;
    $("missionTokens").innerHTML = view.tokens.map((t) => `<span class="mission-token">◆ ${esc(t.name)} · ${t.carrierId !== null && t.carrierId !== undefined ? "사냥꾼이 운반 중" : esc(nodeName(t.node))}</span>`).join("") + (view.targets || []).filter((t) => !t.complete && t.tokens !== undefined).map((t) => `<span class="mission-token">◇ ${esc(window.BBLongHunt.cards.find((c) => c.number === t.card)?.title || "특수 적")} · 계몽 토큰 ${t.tokens}개</span>`).join("") + (view.counters || []).map((c) => `<span class="mission-token">${esc(c.name)} · ${esc(c.value)}</span>`).join("");
    const lifecycleNotices = chapter > 1
      ? ["이전 챕터의 미완료 임무·임무 토큰·대상 적은 초기화되었습니다. 완료한 계몽 기록은 보관하며, 이번 챕터의 계몽 획득 수에는 더하지 않습니다."] : [];
    if (chapter === 3 && view.revealed.includes(53) && view.revealed.includes(35))
      lifecycleNotices.push("대교에서 발견한 사건으로 새로운 구조 임무가 시작되었습니다. 이후 진행은 현재 공개된 임무의 지시를 따르세요.");
    $("missionNotices").innerHTML = [...lifecycleNotices, ...(view.notices || [])].map((notice) => `<p>${esc(uiText(notice, "mission"))}</p>`).join("");
    const history = view.history || state.mission?.history || [];
    $("missionHistory").hidden = !history.length;
    $("pastChapters").innerHTML = history.map((ch) => `<section><p>✓ 챕터 ${ch.chapter} 완수 · 완료 임무 ${storyEntries.filter(entry => entry.chapter === ch.chapter && ch.completed?.includes(entry.number)).map(entry => esc(entry.title)).join(", ") || "없음"}</p><div class="story-list">${storyEntries.filter((entry) => entry.chapter === ch.chapter).map(storyButton).join("")}</div></section>`).join("");
    bindStoryButtons($("pastChapters"));
    $("missionFog").textContent = view.fog.length ? `안개 진입로 · ${view.fog.map((id) => M.tile(id)?.displayName || id).join(", ")}` : "";
    const actions = view.pending || state.rewardChoices?.length ? [] : (E.missionActions ? E.missionActions(state) : []);
    $("missionActions").innerHTML = actions.map((a) => commandButton(a)).join("");
    bind($("missionActions"));
    $("revealedCards").innerHTML = view.revealed.map((number) => {
      const card = window.BBLongHunt.cards.find((c) => c.number === number);
      if (!card) return "";
      const completed = view.completed.includes(number), discarded = view.discarded?.includes(number);
      const publicEntry = window.BBHuntPublicText.entry(card, state, { data: window.BBLongHunt, chapter });
      if (!publicEntry) return "";
      return `<article class="revealed-card ${completed || discarded ? "completed" : ""}"><p class="eyebrow">${esc(publicEntry.type)}${discarded ? " · 효과 종료" : completed ? " · 완료" : ""}</p><h3>${esc(publicEntry.title)}</h3>${discarded ? '<p class="muted">이 임무의 효과는 종료되었습니다. 아래 문구는 공개된 기록입니다.</p>' : ""}${publicEntry.rules.map((r) => `<p>${esc(r)}</p>`).join("")}</article>`;
    }).join("");
  }
  function storyParagraphs(entry) {
    const text = entry.key === "intro" ? window.BBNarrativeText?.intro : window.BBNarrativeText?.cards?.[entry.number];
    return text?.paragraphs || (entry.narrative ? [entry.narrative] : []);
  }
  function storyButton(entry) {
    return `<button data-story-key="${esc(entry.key)}" class="${readStories.has(entry.key) ? "" : "story-unread"}">${esc(entry.title)}${readStories.has(entry.key) ? '<small>읽음</small>' : `<small>${storyParagraphs(entry).length ? '이야기 읽기' : '기록 읽기'}</small>`}</button>`;
  }
  function bindStoryButtons(container) {
    container.querySelectorAll("[data-story-key]").forEach((button) => {
      button.onclick = () => openStory(button.dataset.storyKey, button);
    });
  }
  function renderStories(view) {
    const panel = $("storyPanel"), dialog = $("storyDialog");
    panel.hidden = !view || setupRequired;
    if (!view || setupRequired) {
      storyEntries = [];
      $("storyIntro").innerHTML = $("storyNotice").innerHTML = $("storyList").innerHTML = "";
      if (dialog.open) closeStory();
      return;
    }
    const data = window.BBLongHunt, intro = data.preface.find((entry) => entry.id === "intro"),
      chapters = [...(view.history || state.mission?.history || []), view];
    storyEntries = intro ? [{ ...intro, key: "intro", chapter: null }] : [];
    const seen = new Set(storyEntries.map((entry) => entry.key));
    for (const chapter of chapters) for (const number of chapter.revealed || []) {
      const key = `${chapter.chapter}:${number}`, card = data.cards.find((entry) => entry.number === number);
      if (!card || seen.has(key)) continue;
      seen.add(key); storyEntries.push({ ...card, key, chapter: chapter.chapter });
    }
    $("storyIntro").innerHTML = intro ? storyButton(storyEntries[0]) : "";
    bindStoryButtons($("storyIntro"));
    const current = storyEntries.filter((entry) => entry.chapter === view.chapter),
      unread = current.filter((entry) => !readStories.has(entry.key));
    if ($("storyPendingBadge")) {
      $("storyPendingBadge").textContent = String(unread.length);
      $("storyPendingBadge").hidden = !unread.length;
    }
    $("storyList").innerHTML = current.map(storyButton).join("");
    bindStoryButtons($("storyList"));
    $("storyNotice").innerHTML = unread.length
      ? `<p><strong>아직 읽지 않은 이야기 ${unread.length}개</strong> · 지금 밝혀진 이야기를 읽을 수 있습니다.</p>${storyButton(unread[0])}`
      : '<p class="muted">현재 공개된 이야기를 모두 읽었습니다. 아래 목록에서 다시 읽을 수 있습니다.</p>';
    bindStoryButtons($("storyNotice"));
    if (dialog.open && !storyEntries.some((entry) => entry.key === storySelection)) closeStory();
  }
  function openStory(key, opener) {
    // Keys are resolved against the current permitted list, never the entire
    // source archive. Altering a UI attribute cannot open an unrevealed card.
    const entry = storyEntries.find((entry) => entry.key === key);
    if (!entry || setupRequired || !missionView()) return;
    if (!$("storyDialog").open) {
      storyOpener = opener || null;
      storyReturnPanel = shell?.activePanel() || null;
    }
    shell?.close();
    storySelection = key;
    readStories.add(key);
    const isIntro = entry.key === "intro", index = storyEntries.indexOf(entry);
    $("storyMeta").textContent = isIntro ? "기나긴 사냥 · 도입부" : `챕터 ${entry.chapter} · ${uiText(entry.type, "mission")}`;
    $("storyTitle").textContent = entry.title;
    $("storyDescription").textContent = isIntro ? "야남에서 시작되는 기나긴 사냥" : "지금까지 밝혀진 이야기와 단서";
    const paragraphs = storyParagraphs(entry);
    $("storyText").innerHTML = paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
    $("storyText").hidden = !paragraphs.length;
    const publicEntry = window.BBHuntPublicText.entry(entry, state, { data: window.BBLongHunt, chapter: entry.chapter });
    $("storyRules").innerHTML = isIntro ? "" : `<h3>임무 기록</h3>${(publicEntry?.rules || []).map((rule) => `<p>${esc(rule)}</p>`).join("")}`;
    $("storyRules").hidden = isIntro;
    $("storyZoom").value = "100";
    updateStoryZoom();
    $("previousStory").disabled = index === 0;
    $("nextStory").disabled = index === storyEntries.length - 1;
    $("storyPosition").textContent = `${index + 1} / ${storyEntries.length} · 공개된 이야기`;
    if (!$("storyDialog").open) $("storyDialog").showModal();
    $("storyDialog").scrollTop = 0;
    polishPlayerText($("storyDialog"));
    renderStories(missionView());
    const history = missionView().history || state.mission?.history || [];
    $("pastChapters").innerHTML = history.map((ch) => `<section><p>✓ 챕터 ${ch.chapter} 완수 · 완료 임무 ${storyEntries.filter(entry => entry.chapter === ch.chapter && ch.completed?.includes(entry.number)).map(entry => esc(entry.title)).join(", ") || "없음"}</p><div class="story-list">${storyEntries.filter((entry) => entry.chapter === ch.chapter).map(storyButton).join("")}</div></section>`).join("");
    bindStoryButtons($("pastChapters"));
  }
  function updateStoryZoom() {
    const zoom = Math.max(100, Math.min(150, Number($("storyZoom").value) || 100));
    $("storyZoomValue").textContent = `${zoom}%`;
    $("storyText").style.fontSize = `${zoom / 100}em`;
    $("storyRules").style.fontSize = `${zoom / 100}em`;
  }
  function closeStory() {
    $("storyDialog").close();
    $("storyRules").innerHTML = $("storyText").innerHTML = "";
  }
  function resetStoryReading() {
    enemyHistory.reset(state);
    presentationSession++; presentationActions = []; presentationOrigins.clear(); declaredWeaponVisual = null; needsCameraFollow = true;
    readStories.clear();
    storyReturnPanel = null;
    reloadSecondCardId = null;
    if ($("storyDialog").open) closeStory();
  }
  $("closeStory").onclick = closeStory;
  $("storyDialog").addEventListener("close", () => {
    $("storyRules").innerHTML = $("storyText").innerHTML = "";
    const opener = storyOpener?.isConnected !== false ? storyOpener :
      ["storyIntro", "storyNotice", "storyList", "pastChapters"].flatMap((id) =>
        [...$(id).querySelectorAll("[data-story-key]")]).find((button) => button.dataset.storyKey === storySelection);
    if (storyReturnPanel) shell?.open(storyReturnPanel);
    opener?.focus?.({ preventScroll: true });
    storyOpener = null;
    storyReturnPanel = null;
  });
  $("storyZoom").oninput = updateStoryZoom;
  $("previousStory").onclick = () => {
    const index = storyEntries.findIndex((entry) => entry.key === storySelection);
    if (index > 0) openStory(storyEntries[index - 1].key);
  };
  $("nextStory").onclick = () => {
    const index = storyEntries.findIndex((entry) => entry.key === storySelection);
    if (index >= 0 && index + 1 < storyEntries.length) openStory(storyEntries[index + 1].key);
  };
  function renderRewards() {
    const view = E.rewardsView ? E.rewardsView(state) : null;
    $("rewardsPanel").hidden = !view;
    if (!view) return;
    const h = E.hunter(state), pending = !!view.choices.length,
      between = state.phase === "between_chapters";
    selectedRewards = new Set([...selectedRewards].filter((id) => view.rewards.some((r) => r.id === id && r.attackSelectable)));
    $("rewardsCount").textContent = `${view.rewards.some((r) => r.qaStart) ? "검증 시작 지급 포함 · " : state.setup.practiceRewards?.length ? "연습 지급 · " : ""}${view.rewards.length}장 · 사냥 도구 ${view.rewards.filter((r) => r.equipped && r.subtype === "tool").length}/2 · 카릴 문자 ${view.rewards.filter((r) => r.equipped && r.subtype === "rune").length}/2`;
    $("rewards").innerHTML = view.rewards.map((r) => {
      let actions = "";
      if (r.controls && r.equipped) {
        const control = r.controls,
          opts = (targets) => targets.map((t) => `<option value="${esc(t.enemyId)}">${esc(t.name)}</option>`).join(""),
          destinations = (target) => (target.destinations || []).map((n) => `<option value="${esc(n.node)}">${esc(n.name)}</option>`).join("");
        if (control.type === "enemies-destinations")
          actions = control.targets.map((t) => `<label>${esc(t.name)}의 이동 목적지<select id="rewardMove-${r.id}-${t.enemyId}">${destinations(t)}</select></label>`).join("");
        else if (control.type === "echo-option")
          actions = `<label class="checkrow"><input id="rewardEcho-${r.id}" type="checkbox" ${control.available ? "" : "disabled"}>피의 유지 1개를 소모하여 추가 치유 2</label>`;
        else if (control.type === "slot")
          actions = `<label>비울 공격 슬롯<select id="rewardSlot-${r.id}">${control.slots.map((slot) => `<option value="${slot.slot}">${esc(slot.name || (slot.slot + 1) + "번 슬롯")} · ${slot.occupied ? "카드 있음" : "비어 있음"}</option>`).join("")}</select></label>`;
        else if (control.type === "lamp")
          actions = `<label>이동할 등불<select id="rewardLamp-${r.id}" ${control.targets.length ? "" : "disabled"}>${control.targets.map((n) => `<option value="${esc(n.node)}">${esc(n.name)}</option>`).join("")}</select></label>`;
        else {
          actions = `<label>대상 적<select id="rewardEnemy-${r.id}">${opts(control.targets)}</select></label>`;
          if (control.type === "enemy-destination") actions += `<label>이동 목적지<select id="rewardNode-${r.id}"></select></label>`;
        }
        actions += `<button data-reward-use="${r.id}" ${r.usable && !pending ? "" : "disabled"}>${esc(r.name)} 사용</button>`;
      } else if (r.kind === "lantern" && r.equipped) {
        actions = `<label>이동할 등불<select id="rewardLamp-${r.id}">${E.nodes(state).filter((n) => n.lamp).map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join("")}</select></label><button data-reward-use="${r.id}" data-reward-kind="lantern" ${r.usable && !pending ? "" : "disabled"}>등불 사용</button>`;
      } else if (r.kind === "rune-eye" && r.equipped) {
        const cards = (list) => list.map((c) => `<option value="${c.id}">${esc(E.card(c).name)} · ${esc(c.id)}</option>`).join("");
        actions = `<label>버릴 손패<select id="rewardDiscard-${r.id}">${cards(h.hand)}</select></label><label>가져올 버림 카드<select id="rewardTake-${r.id}">${cards(h.discard)}</select></label><button data-reward-use="${r.id}" data-reward-kind="rune-eye" ${r.usable && h.hand.length && h.discard.length && !pending ? "" : "disabled"}>선택한 카드 교환</button>`;
      } else if (r.kind === "rune-rapture" && r.equipped) {
        actions = button("피의 기쁨 · 카드 1장, 치유 1", "USE_REWARD", { rewardId: r.id }, !r.usable || pending);
        if (r.usable) actions = '<p class="muted">지금 사용하거나 다른 행동을 하면 이 처치의 사용 기회가 끝납니다.</p>' + actions;
      } else if (r.equipped && ["iosefka-vial", "messengers-gift", "rune-formless", "old-hunter-bone", "arianna-blood", "call-beyond", "queen-flesh", "ring", "rune-communion", "rune-radiance"].includes(r.kind)) {
        actions = button(`${esc(r.name)} 사용`, "USE_REWARD", { rewardId: r.id }, !r.usable || pending);
      }
      if (r.triggerSelectable)
        actions += button(r.triggerArmed ? "다음 죽음에 사용 선택 해제" : `다음 죽음에 ${esc(r.name)} 사용`, "SET_REWARD_TRIGGER", { rewardId: r.id, enabled: !r.triggerArmed }, pending);
      if (r.reassignable && !pending)
        actions += `<p class="muted">변형 직후 · 슬롯 부착 보상을 옮길 수 있습니다.</p><div class="actions">${E.slots(state).map((sl, slot) => button(`${slot + 1}번으로 옮기기`, "REASSIGN_REWARD", { rewardId: r.id, slot }, slot === r.slot)).join("")}</div>`;
      if (r.attackSelectable && !pending)
        actions += rewardAttackOption(r, "다음 공격에 이 보상 사용", "inventory");
      if (between && !pending && r.subtype !== "quest")
        actions += r.equipped ? button("이 보상 보관", "KEEP_REWARD", { rewardId: r.id }) : rewardChoiceHTML({ ...view, choices: [{ rewardId: r.id }] }, true);
      const status = `${r.qaStart ? "검증 시작 지급 · " : ""}${r.subtype === "quest" ? "임무 물품 · 사용 효과 없음" : !r.equipped ? "보관 중" : r.persistent ? `${r.slot + 1}번 공격 슬롯 · 지속 효과` : r.ready ? "장착 · 준비됨" : "장착 · 소진됨"}`;
      return `<article class="reward-card"><p class="eyebrow">${r.subtype === "rune" ? "카릴 문자" : r.subtype === "quest" ? "임무 물품" : "사냥 도구"}</p><h3>${esc(r.name)}</h3><p class="reward-state ${!r.ready ? "spent" : ""}">${status}${r.triggerArmed ? " · 다음 죽음에 사용 선택됨" : ""}${r.limitUsed ? " · 이번 챕터 사용 완료" : ""}</p><p>${esc(r.rules)}</p>${r.disabledReason || r.runtimeNote ? `<p class="reward-unavailable">${esc(r.disabledReason || r.runtimeNote)}</p>` : ""}${actions ? `<div class="reward-actions">${actions}</div>` : ""}</article>`;
    }).join("") || `<p class="muted">${missionView() ? "보상은 임무를 완료하면 획득합니다." : "획득한 보상이 없습니다. 새 사냥의 전투 연습에서 시작 보상을 선택해 효과를 확인할 수 있습니다."}</p>`;
    const owned = view.firearms.filter((g) => !g.equipped);
    if (owned.length) $("rewards").innerHTML += `<article class="reward-card"><p class="eyebrow">보관한 화기</p>${owned.map((g) => `<p>${esc(g.name)}</p>${between ? button("이 화기 장착", "EQUIP_FIREARM", { firearmId: g.id }, pending) : ""}`).join("")}<p class="muted">화기는 획득할 때 또는 챕터 사이에 교체합니다.</p></article>`;
    bind($("rewards"));
    bindRewardAttack($("rewards"));
    view.rewards.filter((r) => r.controls?.type === "enemy-destination" && r.equipped).forEach((r) => {
      const select = $("rewardEnemy-" + r.id), destination = $("rewardNode-" + r.id);
      const update = () => {
        const target = r.controls.targets.find((t) => t.enemyId === select.value);
        destination.innerHTML = (target?.destinations || []).map((n) => `<option value="${esc(n.node)}">${esc(n.name)}</option>`).join("");
      };
      select.onchange = update;
      update();
    });
    $("rewards").querySelectorAll("[data-reward-use]").forEach((b) => b.onclick = () => {
      const id = b.dataset.rewardUse, r = view.rewards.find((r) => r.id === id), args = { rewardId: id };
      if (r.controls?.type === "enemies-destinations") args.moves = r.controls.targets.map((t) => ({ enemyId: t.enemyId, node: $("rewardMove-" + id + "-" + t.enemyId).value }));
      else if (r.controls?.type === "enemy-destination") { args.enemyId = $("rewardEnemy-" + id).value; args.node = $("rewardNode-" + id).value; }
      else if (r.controls?.type === "enemy") args.enemyId = $("rewardEnemy-" + id).value;
      else if (r.controls?.type === "echo-option") args.payEcho = $("rewardEcho-" + id).checked;
      else if (r.controls?.type === "slot") args.slot = +$("rewardSlot-" + id).value;
      else if (r.kind === "lantern") args.node = $("rewardLamp-" + id).value;
      else if (r.kind === "rune-eye") { args.discardId = $("rewardDiscard-" + id).value; args.takeId = $("rewardTake-" + id).value; }
      send("USE_REWARD", args);
    });
  }
  function bindRewardAttack(box) {
    box.querySelectorAll("[data-reward-attack]").forEach((b) => b.onchange = () => {
      b.checked ? selectedRewards.add(b.dataset.rewardAttack) : selectedRewards.delete(b.dataset.rewardAttack);
      renderRewards();
      renderFirearm();
      renderDecisions();
    });
  }
  function rewardAttackOption(reward, label, context = "decision") {
    const effect = uiText(reward.rules || ""),
      tooltipId = `reward-effect-${context}-${reward.id}`;
    return `<label class="checkrow reward-attack-option" title="${esc(effect)}"><input type="checkbox" data-reward-attack="${esc(reward.id)}" aria-describedby="${esc(tooltipId)}" ${selectedRewards.has(reward.id) ? "checked" : ""}>${esc(label)}<span id="${esc(tooltipId)}" class="reward-effect-tooltip" role="tooltip">${esc(effect)}</span></label>`;
  }
  function rewardChoiceHTML(view, stored = false) {
    const choice = view.choices[0];
    if (choice.firearmId) {
      const g = view.firearms.find((g) => g.id === choice.firearmId);
      return `<div class="reward-pending"><h3>${esc(g?.name || choice.firearmId)} 획득</h3><p>지금 장착하거나 이후를 위해 보관하세요.</p><div class="actions">${button("화기 장착", "EQUIP_FIREARM", { firearmId: choice.firearmId }, false, "primary")}${button("화기 보관", "KEEP_FIREARM", { firearmId: choice.firearmId })}</div></div>`;
    }
    const r = view.rewards.find((r) => r.id === choice.rewardId);
    if (!r) return "";
    const current = view.rewards.filter((x) => x.equipped && x.subtype === r.subtype),
      replace = current.length >= 2 ? current : [null];
    const opts = replace.flatMap((old) => (r.persistent ? E.slots(state).map((_, i) => i) : [null]).map((slot) => {
      const args = { rewardId: r.id };
      if (old) args.replaceId = old.id;
      if (slot !== null) args.slot = slot;
      return button(`${old ? esc(old.name) + "을 보관하고 " : ""}${slot !== null ? (slot + 1) + "번 슬롯에 " : ""}장착`, "EQUIP_REWARD", args, false, "primary");
    })).join("");
    return `<div class="reward-pending"><h3>${esc(r.name)} ${stored ? "교체 장착" : "획득"}</h3><p>${esc(r.rules)}</p><p class="muted">사냥 도구와 카릴 문자는 각각 2장까지 장착합니다. 보관한 카드는 챕터 사이에 교체할 수 있습니다.</p><div class="choice-grid">${opts}${stored ? "" : button("이 보상 보관", "KEEP_REWARD", { rewardId: r.id })}</div></div>`;
  }
  function renderHand() {
    const h = E.hunter(state);
    $("handCount").textContent = `${h.hand.length}장`;
    $("cardHint").textContent = state.phase === "over"
      ? "사냥이 종료되었습니다. 기록을 저장할 수 있습니다."
      : "행동에 사용할 기술을 선택하세요.";
    $("hand").innerHTML =
      h.hand
        .map((c) => {
          const d = E.card(c);
          return `<button class="stat-card ${d.type} ${selectedCard === c.id ? "selected" : ""}" data-card="${c.id}" aria-pressed="${selectedCard === c.id}" title="${esc(uiText(d.name + ' · ' + d.text))}"><small>${d.type === "strength" ? "근력" : d.type === "skill" ? "기술" : d.type === "endurance" ? "지구력" : "활력"}</small><b>${esc(d.name)}</b><span>${esc(uiText(d.text))}</span></button>`;
        })
        .join("") ||
      `<p class="muted">${state.phase === "over" ? "마지막 사냥의 카드 기록을 보관했습니다." : "손패가 비었습니다. 차례를 마쳐 보충하세요."}</p>`;
    $("hand")
      .querySelectorAll("[data-card]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedCard = b.dataset.card;
            renderHand();
            renderDecisions();
          }),
      );
    $("deckCount").textContent =
      `덱 ${h.deck.length}장 · 버림 ${h.discard.length}장 · 슬롯 ${h.slots.filter(Boolean).length}장 / 총 12장`;
    const weapon = E.weapon(state), face = E.weaponFace(state), availableSlots = E.slots(state);
    $("weaponName").textContent = weapon.name;
    $("weaponFace").textContent = faceName(face, h.face);
    $("weaponAbility").textContent = uiText(face.text || "고유 효과가 없습니다.");
    $("slots").style.gridTemplateColumns = `repeat(${availableSlots.length}, minmax(0, 1fr))`;
    $("slots").innerHTML = availableSlots
      .map(
        (sl, i) =>
          `<button class="hunt-slot ${selectedSlot === i ? "selected" : ""} ${h.slots[i] ? "occupied" : ""}" data-slot="${i}" aria-pressed="${selectedSlot === i}"><small>${i + 1}번 슬롯 · ${h.slots[i] ? "점유" : "비어 있음"}</small><b>${esc(sl.name)}</b><span>속도 ${sl.speed} · 피해 ${sl.damage}</span>${sl.text ? `<small>${esc(uiText(sl.text))}</small>` : ""}<small>${h.slots[i] ? h.slots[i].faceDown ? "효과 없이 사용한 기술 · 스탯 효과 미적용" : esc(E.card(h.slots[i]).name) : "선택하여 공격 / 회피"}</small></button>`,
      )
      .join("");
    $("slots")
      .querySelectorAll("[data-slot]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const slot = +b.dataset.slot;
            selectedSlot = selectedSlot === slot ? null : slot;
            renderHand();
            renderDecisions();
          }),
      );
  }
  function renderDecisions() {
    renderFirearm();
    const h = E.hunter(state),
      p = state.phase,
      c = state.combat,
      chosen = h.hand.find((x) => x.id === selectedCard),
      slot = E.slots(state)[selectedSlot],
      empty = !!slot && !h.slots[selectedSlot],
      canCommit = !!chosen && empty;
    const names = {
      hunter: "플레이어의 차례",
      move: "이동과 탐험",
      tile_place: "새 타일 배치",
      spawn_choice: "피규어 재배치",
      enemy_path: "적 이동 경로",
      boss_move: "효과에 따른 이동",
      boss_react: "전용 능력 대응",
      firearm_react: "장총 · 진입한 적 대응",
      combat_choose: "적과 조우",
      combat_react: "전투 대응",
      combat_extra: "다단 가르기 · 두 번째 타격",
      ability_choice: "벽돌 후려갈기기",
      cheap_shot: "비열한 일격 사용 기회",
      card_choice: "스탯 카드 효과 선택",
      free_transform: "무료 무기 변형",
      stun: "기절 · 카드 버리기",
      activation: "적 활성화 순서",
      refill: "다음 차례 · 손패 보충",
      return: "야남으로 귀환",
      upgrade_pick: "꿈 · 업그레이드 획득",
      upgrade_replace: "꿈 · 덱 교체",
      loot_choice: "지하묘지 · 소모품 선택",
      exchange_choice: "예배당 · 교환할 소모품 선택",
      interaction_order: "상호작용 · 적의 반격 순서",
      mission_survivor: "구조한 생존자 이동",
      mission_choice: "임무의 선택",
      mission_death: "죽음 뒤의 회피",
      between_chapters: "다음 챕터 준비",
      weapon_choice: "장치 무기 효과 선택",
      weapon_entry: "장치 무기 · 진입한 적 대응",
      reward_entry: "야수 사냥의 횃불 · 진입한 적 대응",
      over: "사냥 종료",
    };
    $("phaseTitle").textContent = names[p];
    let help = "",
      html = "";
    const actionArgs = {
      cardId: selectedCard,
      slot: selectedSlot,
      itemIds: inventory.ids(),
      pullIds: [...pulls],
      rewardIds: [...selectedRewards],
    };
    const boostCode = state.setup.rulesVersion >= 10 ? E.weaponFace(state).effect?.code : null;
    if (boostCode === "attack_sacrifice_damage") actionArgs.weaponBoost = weaponBoost === "none" ? 0 : +weaponBoost;
    if (boostCode === "attack_sacrifice_speed_or_damage") actionArgs.weaponBoost = ["speed", "damage"].includes(weaponBoost) ? weaponBoost : "none";
    const selectHint = `선택 카드: ${chosen ? E.card(chosen).name : "없음"} · 슬롯: ${slot ? selectedSlot + 1 + "번" + (empty ? "" : " (점유됨)") : "없음"}`;
    const checkPulls = () =>
      E.pullCandidates(state)
        .map(
          (e) =>
            `<label class="checkrow"><input type="checkbox" data-pull="${e.id}" ${pulls.has(e.id) ? "checked" : ""}>공격 전에 끌어오기 · ${esc(E.enemyDef(state, e).name)} #${e.figure}</label>`,
        )
        .join("");
    if (p === "hunter") {
      help =
        "아래 손패에서 카드를 고르고 행동하세요. 공격·회피는 빈 슬롯도 선택합니다.";
      const gun = E.firearm(state), realGun = actualGun(), reloadCost = realGun ? gun.prepareCost || 1 : 1;
      html = `<p class="muted">${esc(selectHint)}</p><div class="actions">${button("이동", "MOVE", { cardId: selectedCard }, !chosen)}${button("무기 변형", "TRANSFORM", { cardId: selectedCard }, !chosen)}${button("꿈으로 이동", "DREAM", { cardId: selectedCard }, !chosen)}${reloadCost === 1 ? button("화기 다시 준비 · 손패 1장", "RELOAD", realGun ? { cardIds: [selectedCard] } : { cardId: selectedCard }, !chosen || h.firearmReady) : ""}</div>`;
      if (reloadCost > 1) {
        const second = h.hand.find((card) => card.id === reloadSecondCardId && card.id !== selectedCard);
        html += `<div class="reload-choice"><p class="muted">${esc(gun.name)} 재준비 · 서로 다른 손패 ${reloadCost}장</p><label>두 번째로 버릴 손패<select id="reloadSecondCard"><option value="">손패를 선택하세요</option>${h.hand.filter((card) => card.id !== selectedCard).map((card) => `<option value="${esc(card.id)}" ${card.id === reloadSecondCardId ? "selected" : ""}>${esc(E.card(card).name)}</option>`).join("")}</select></label>${button("화기 다시 준비 · 손패 2장", "RELOAD", { cardIds: [selectedCard, second?.id || null] }, !chosen || !second || h.firearmReady)}</div>`;
      }
      if (realGun && gun.prepareEchoCost) html += button(`화기 다시 준비 · 피의 유지 ${gun.prepareEchoCost}개`, "RELOAD", { payEcho: true, cardIds: [] }, h.firearmReady || h.echoes < gun.prepareEchoCost);
      if (mapTarget) html = `<details class="utility-actions"><summary>다른 행동 · 변형·꿈·화기 준비</summary>${html}</details>`;
      const target = state.enemies.find((e) => e.id === selectedEnemy);
      html += checkPulls();
      if (target && !mapTarget) {
        html += `<p>공격 대상 · ${esc(E.enemyDef(state, target).name)} #${target.figure} · 체력 ${target.hp}</p>`;
        const same = target.node === h.position || pulls.has(target.id),
          paths =
            chosen && E.card(chosen).leap && !attackReplacesCardEffects()
              ? E.leapPaths(state, target.node).filter((p) => p.length > 1)
              : [];
        if (!same && paths.length)
          html += paths
            .map((route) =>
              button(
                `도약 공격 · ${route
                  .slice(1)
                  .map((n) => esc(E.node(state, n).name))
                  .join(" → ")}`,
                "ATTACK",
                { ...actionArgs, enemyId: target.id, leapPath: route },
                !canCommit,
                "primary",
              ),
            )
            .join("");
        else
          html += button(
            "선택한 카드와 슬롯으로 공격",
            "ATTACK",
            { ...actionArgs, enemyId: target.id },
            !canCommit || !same,
            "primary",
          );
      }
      const o = E.interactionOptions(state);
      const interactionKey = `${sceneId()}:${state.revision}:${h.position}`;
      if (interactionSelectionKey !== interactionKey) {
        interactionSelectionKey = interactionKey;
        interactionMissionSelected = true;
      }
      if (o.missionRescue)
        html += button("임무 대상 · 상호작용", "INTERACT", { cardId: selectedCard, mission: "rescue" }, !chosen, "primary");
      if (o.loot || o.heal || o.teleport || o.provisionalNpc || o.missionRescue || o.workshop) {
        html += `<details id="contextInteraction" ${mapTarget?.kind === "cell" && mapTarget.node === h.position ? "open" : ""}><summary>상호작용 · 손패 1장</summary><p class="muted">같은 칸의 여러 대상을 손패 1장으로 동시에 상호작용할 수 있습니다. 적들이 먼저 행동하며, 이때 맞서 공격하거나 회피할 수 없습니다.</p>${o.missionRescue ? `<label class="checkrow"><input id="tileRescue" type="checkbox" ${interactionMissionSelected ? "checked" : ""}>임무 상호작용도 함께 선택</label>` : ""}${o.provisionalNpc ? button("임시 NPC · 카드 1장을 버려 치유 2", "INTERACT", { cardId: selectedCard, provisionalNpc: true }, !chosen) : ""}${o.loot ? `<label>획득할 소모품 토큰<select id="lootCount">${Array.from({ length: o.loot + 1 }, (_, i) => `<option value="${i}" ${i === o.loot ? "selected" : ""}>${i}개</option>`).join("")}</select></label>` : ""}${o.heal ? '<label class="checkrow"><input id="tileHeal" type="checkbox" checked>대성당 · 치유 2</label>' : ""}${
          o.teleport
            ? `<label>중앙 등불 순간이동 · 등불 또는 안개 안 칸<select id="tileLamp"><option value="">사용하지 않음</option>${E.centralLampDestinations(state)
                .map((n) => `<option value="${n.id}">${esc(n.name)}${n.lamp ? "" : " · 안개 안"}</option>`)
                .join("")}</select></label>`
            : ""
        }${o.workshop ? `<label>성배 교단 예배당 · 소모품 1장 교환<select id="tileExchangeItem"><option value="">교환하지 않음</option>${h.consumables.map((item) => `<option value="${esc(item.id)}">${esc(consumableDefinitions()[item.kind].name)}</option>`).join("")}${o.loot ? '<option value="after-loot">소모품 획득 후 교환할 카드 선택</option>' : ""}</select></label><p class="muted">선택한 소모품을 버리고 피의 유지 1개를 얻습니다(최대 3개). 소모품의 일반 사용 효과는 적용하지 않습니다.${h.consumables.length || o.loot ? "" : " 교환할 소모품이 없습니다."}</p>` : ""}${o.loot || o.heal || o.teleport || o.missionRescue || o.workshop ? `<button id="interact" ${chosen ? "" : "disabled"}>상호작용 실행</button>` : ""}</details>`;
      }
      if (E.node(state, h.position).tile === "tile-20")
        html += button(
          "진료소 · 피해 1, 카드 1장",
          "CLINIC",
          {},
          state.clinicUsed,
        );
      html += button("플레이어의 차례 마치기", "END_TURN");
    } else if (p === "move") {
      help = `남은 이동력 ${state.move.remaining}. 밝은 칸 또는 현재 칸의 출입구를 누르세요. 이동을 마치면 적의 추격을 처리합니다.`;
      if ((E.missionActions ? E.missionActions(state) : []).some((a) => a.command.type === "MISSION_PICKUP"))
        help += " 호위 토큰을 함께 옮기려면 현재 임무의 운반 버튼을 먼저 선택하세요.";
      html = button("여기서 이동 마치기", "STOP_MOVE");
    } else if (p === "tile_place") {
      help =
        "출입구가 이어지는 방향을 선택하세요. 배치 후 적·소모품을 놓고 연결된 칸으로 진입합니다.";
      const q = state.world.pending,
        t = M.tile(q.tileId),
        opts = placementOptions();
      html = `<h3>${esc(t.displayName)}</h3><p class="muted">지도에 표시된 미리보기에서 방향을 확인하세요.</p><div class="actions">${[0, 1, 2, 3].map((r) => `<button data-rotation="${r}" class="${rotation === r ? "primary" : ""}" ${opts.includes(r) ? "" : "disabled"}>${r * 90}°</button>`).join("")}</div>${button("이 방향으로 배치하고 진입", "PLACE_TILE", { rotation }, false, "primary")}`;
    } else if (p === "exchange_choice") {
      help = "획득한 소모품도 교환할 수 있습니다. 1장을 버려 피의 유지 1개를 얻거나 교환을 마치세요. 추가 스탯 카드 비용은 없습니다.";
      html = h.consumables.map((item) => button(`${esc(consumableDefinitions()[item.kind].name)} 교환 · 유지 +1`, "EXCHANGE_CHOICE", { itemId: item.id })).join("")
        + button("교환하지 않고 마치기", "EXCHANGE_CHOICE", { skip: true });
    } else if (p === "interaction_order") {
      help = "같은 칸의 적들이 상호작용에 앞서 반격합니다. 사냥꾼에게 가장 불리한 결과가 되는 순서로 먼저 행동할 적을 선택하세요. 이 반격에는 맞서 공격하거나 회피할 수 없습니다.";
      html = E.interactionEnemies(state).map((enemy) => button(
        `${esc(E.enemyDef(state, enemy).name)} #${enemy.figure} · ${esc(E.node(state, enemy.node).name)}`,
        "INTERACTION_ENEMY", { enemyId: enemy.id },
      )).join("");
    } else if (p === "spawn_choice") {
      help =
        "피규어 4개가 모두 사용 중입니다. 가장 먼 적 중 사냥꾼에게 가장 불리한 결과가 되도록 고르세요.";
      html = state.spawnChoices
        .map((id) => {
          const e = state.enemies.find((e) => e.id === id);
          return button(
            `${esc(E.enemyDef(state, e).name)} #${e.figure} · ${esc(E.node(state, e.node).name)}`,
            "SPAWN_CHOICE",
            { enemyId: id },
          );
        })
        .join("");
    } else if (p === "boss_move") {
      help = "표시된 이동 효과를 해결할 칸을 선택하세요. 여러 경로가 가능하면 사냥꾼에게 가장 불리한 결과를 따릅니다.";
      html = (E.bossMoveOptions?.(state) || []).map((node) => button(esc(nodeName(node)), "BOSS_STEP", { node })).join("");
    } else if (p === "firearm_react") {
      const entry = E.firearmEntryView?.(state) || {};
      help = "적이 사냥꾼의 칸으로 이동해 들어왔습니다. 준비된 장총을 소진해 피해 2를 주거나 사용하지 않고 계속합니다.";
      html = `<p>${esc(entry.title || entry.enemyName || "루드비히 장총")}${entry.damage !== undefined ? ` · 피해 ${entry.damage}` : ""}</p>${button("장총 소진 · 진입한 적에게 피해 2", "FIREARM_ENTRY", { accept: true }, false, "primary")}${button("장총을 사용하지 않고 계속", "FIREARM_ENTRY", { accept: false })}`;
    } else if (p === "enemy_path") {
      help =
        "같은 조건의 경로가 여러 개입니다. 사냥꾼에게 가장 불리한 결과가 되도록 선택하세요.";
      html = '<div class="compact-choices">' + E.moveOptions(state)
        .map((n) =>
          button(esc(E.node(state, n).name), "ENEMY_STEP", { node: n }),
        )
        .join("") + '</div>';
    } else if (p === "combat_choose") {
      help =
        "적 행동을 공개하기 전에 맞서 공격할 카드·슬롯과 공격용 소모품을 선택하세요.";
      html = `${mapTarget?.kind === "enemy" ? "" : `<p>${esc(selectHint)}</p>`}${checkPulls()}${mapTarget?.kind === "enemy" ? "" : button("맞서 공격", "COUNTER", actionArgs, !canCommit, "primary")}${button("공격하지 않고 행동 공개", "NO_ATTACK")}`;
      if (actualGun() && E.firearm(state).trigger === "hunter-turn") html += firearmAction();
    } else if (p === "boss_react") {
      const reaction = E.combatReaction?.(state) || {};
      $("phaseTitle").textContent = reaction.title || "전용 능력 대응";
      const blockPerSpeed = reaction.dodgeBlockPerSpeed || state.combat?.immediate?.dodgeBlockPerSpeed;
      help = blockPerSpeed
        ? `회피 속도마다 ${blockPerSpeed}피해를 방어합니다. 회피 카드와 빈 슬롯을 선택하세요.`
        : `속도 ${reaction.dodgeSpeed ?? 1} 이상 회피 카드와 빈 슬롯을 선택하세요.${reaction.effects?.length ? " " + reaction.effects.join(" · ") : ""}`;
      html = `<p>${esc(selectHint)}</p>${button("이 효과 회피", "DODGE", { cardId: selectedCard, slot: selectedSlot }, !canCommit || !E.canDodge(state, selectedCard, selectedSlot))}${button(reaction.damage ? `피해 ${reaction.damage}와 효과를 받고 계속` : "회피하지 않고 효과 처리", "RESOLVE", {}, false, "primary")}`;
    } else if (p === "combat_react" || p === "combat_extra") {
      const extra = p === "combat_extra";
      help = extra
        ? "첫 공격을 피했거나 방해했어도 별도의 속도 2 회피가 필요합니다."
        : "회피할 경우 손패의 회피 카드와 충분한 속도의 빈 슬롯을 선택하세요.";
      html = `<p>${esc(selectHint)}</p>${button(extra ? "추가 타격 회피" : "회피", extra ? "EXTRA_DODGE" : "DODGE", { cardId: selectedCard, slot: selectedSlot }, !canCommit || !E.canDodge(state, selectedCard, selectedSlot, extra))}`;
      if (!extra) html += firearmAction();
      html += button(
        extra ? "추가 피해 받기" : "속도 순서대로 전투 처리",
        extra ? "EXTRA_TAKE" : "RESOLVE",
        {},
        false,
        "primary",
      );
    } else if (p === "stun") {
      help = "기절로 손에서 카드 1장을 버립니다.";
      html = choices(h.hand, "STUN_DISCARD", "cardId");
    } else if (p === "ability_choice") {
      help =
        "카드 1장을 버리거나, 이번 전투에서 공격 속도 -2와 회피 불가를 받습니다. 다음 적 행동은 자동 공개됩니다.";
      html =
        choices(h.hand, "ABILITY_CHOICE", "cardId") +
        button("버리지 않고 불이익 적용", "ABILITY_CHOICE");
    } else if (p === "cheap_shot") {
      help =
        "능력을 사용한 적에게 피해 2를 주려면 비열한 일격을 손에서 버리세요.";
      html =
        choices(
          h.hand.filter((x) => E.card(x).cheapShot),
          "CHEAP_SHOT",
          "cardId",
        ) + button("사용하지 않고 능력 진행", "CHEAP_SHOT");
    } else if (p === "card_choice") {
      const q = state.cardChoices[0];
      help =
        q.type === "discard"
          ? "끈기 · 카드 2장을 뽑았습니다. 버릴 카드 1장을 고르세요."
          : q.type === "status"
            ? "끈기 · 제거할 상태 이상을 고르세요."
            : "활기 · 비울 슬롯을 고르세요.";
      html =
        q.type === "discard"
          ? choices(h.hand, "CARD_CHOICE", "value")
          : q.type === "status"
            ? Object.keys(h.status)
                .filter((k) => h.status[k])
                .map((value) =>
                  button(
                    value === "poison" ? "독 제거" : "발광 제거",
                    "CARD_CHOICE",
                    { value },
                  ),
                )
                .join("")
            : h.slots
                .map((x, i) =>
                  x
                    ? button(
                        `${i + 1}번 · ${esc(E.card(x).name)}`,
                        "CARD_CHOICE",
                        { value: i },
                      )
                    : "",
                )
                .join("");
    } else if (p === "free_transform") {
      help =
        "카드 효과로 비용 없이 무기를 변형할 수 있습니다. 변형하면 모든 슬롯이 비워집니다.";
      html =
        button("무료로 변형", "FREE_TRANSFORM", { accept: true }) +
        button("현재 형태 유지", "FREE_TRANSFORM", { accept: false });
    } else if (p === "activation") {
      help = "현재 활성화 순위의 적들 중 먼저 행동할 피규어를 선택하세요. 여러 순서가 가능하면 사냥꾼에게 가장 불리한 결과가 되는 순서를 따릅니다.";
      html = E.eligible(state)
        .map((e) =>
          button(
            `${esc(E.enemyDef(state, e).name)} #${e.figure} · ${esc(E.node(state, e.node).name)}`,
            "ACTIVATE",
            { enemyId: e.id },
          ),
        )
        .join("");
    } else if (p === "refill") {
      help = "남은 손패를 원하는 만큼 버린 뒤 3장이 될 때까지 뽑습니다.";
      html =
        h.hand
          .map(
            (x) =>
              `<label class="checkrow"><input type="checkbox" data-refill="${x.id}">${esc(E.card(x).name)} 버리기</label>`,
          )
          .join("") + '<button id="refill" class="primary">손패 보충</button>';
    } else if (p === "return") {
      help = "공개된 등불 중 귀환할 곳과 무기 형태를 선택하세요.";
      html =
        `<label>무기 형태<select id="returnFace">${E.weapon(state).faces.map((face, index) => `<option value="${index}">${esc(faceName(face, index))}</option>`).join("")}</select></label>` +
        E.nodes(state)
          .filter((n) => n.lamp)
          .map(
            (n) =>
              `<button data-return="${n.id}">${esc(n.name)}에서 귀환</button>`,
          )
          .join("");
    } else if (p === "upgrade_pick") {
      help = `남은 피의 유지 ${state.dream.credit}. 카드를 고를 때마다 시장을 보충합니다.`;
      html = `<div class="choice-grid">${state.market.map((id, index) => (id ? button(`${esc(D.cards[id].name)}<small>${esc(D.cards[id].text)}</small>`, "PICK_UPGRADE", { index }) : "<p>빈 구획</p>")).join("")}</div>`;
    } else if (p === "upgrade_replace") {
      const x = state.dream.purchased[0];
      help = `획득: ${E.card(x).name} · ${E.card(x).text}`;
      html =
        "<p>덱에서 뺄 카드를 선택하면 이 카드로 교체합니다. 덱은 12장을 유지합니다.</p>" +
        choices(h.deck, "REPLACE_UPGRADE", "replaceId") +
        button("이 업그레이드를 덱에 넣지 않기", "REPLACE_UPGRADE");
    } else if (p === "loot_choice") {
      help = "3장 중 1장을 고릅니다. 나머지는 소모품 덱에 다시 섞습니다.";
      html = state.lootChoice
        .map((x) =>
          button(
            `${esc(consumableDefinitions()[x.kind].name)}<small>${esc(consumableDefinitions()[x.kind].rules)}</small>`,
            "LOOT_CHOICE",
            { itemId: x.id },
          ),
        )
        .join("");
    } else if (p === "reward_entry") {
      const entry = E.rewardsView?.(state)?.entry;
      help = entry ? `${entry.enemyName}이 칸에 진입하려 합니다. 횃불을 소진하면 적이 1칸 멀리서 멈추고 피해 1을 받습니다.` : "진입한 적에게 횃불을 사용할지 선택하세요.";
      html = entry?.stops?.length
        ? entry.stops.map((stop) => button(`${esc(stop.name)}에 멈춤 · 횃불 소진, 피해 1`, "ENTRY_REWARD", { accept: true, node: stop.node }, false, "primary")).join("")
        : button("횃불 소진 · 적을 멈추고 피해 1", "ENTRY_REWARD", { accept: true }, !entry, "primary");
      html += button("횃불 사용하지 않음 · 이동 계속", "ENTRY_REWARD", { accept: false });
    } else if (["mission_survivor", "mission_choice", "mission_death"].includes(p)) {
      const chapelOrder = p === "mission_choice" && state.mission?.choice === "chapel-order",
        pending = chapelOrder ? {
          type: "choice", title: "호위 완료 후 예배당 사건 처리",
          options: [{ label: "호위 완료 후 예배당 사건 처리",
            command: { type: "MISSION_CHOICE", choice: "escort-first" } }],
        } : missionView()?.pending;
      help = pending ? pending.title + (pending.type === "survivor-move" ? ` · 남은 이동력 ${pending.remaining}` : "") : "임무의 다음 선택을 진행하세요.";
      if (pending?.description) help += " · " + pending.description;
      html = (pending?.options || (E.missionActions ? E.missionActions(state) : [])).map((a) => commandButton(a, "primary")).join("");
    } else if (p === "between_chapters") {
      const chapter = missionView()?.chapter || 1, face = nextFace === null ? h.face : nextFace;
      help = `챕터 ${chapter}을 완수했습니다. 아래 보상에서 장비를 교체한 뒤, 다음 사냥의 시작 칸과 무기 형태를 고르세요.`;
      html = `<label>챕터 ${chapter + 1}의 시작 칸<select id="nextChapterStart"><option value="">시작할 칸을 직접 선택하세요</option>${["left", "center", "right"].map((id) => `<option value="${id}" ${nextStartSpace === id ? "selected" : ""}>${id === "left" ? "왼쪽 칸" : id === "right" ? "오른쪽 칸" : "중앙 등불"}</option>`).join("")}</select></label><div id="nextChapterPlacement"></div><label>시작 무기 형태<select id="nextChapterFace">${E.weapon(state).faces.map((part, index) => `<option value="${index}" ${face === index ? "selected" : ""}>${esc(faceName(part, index))}</option>`).join("")}</select></label><button id="startNextChapter" class="primary" ${nextStartSpace ? "" : "disabled"}>챕터 ${chapter + 1} 시작</button><button id="exportChapterSave">여기까지 저장 내보내기</button>`;
    } else if (p === "over") {
      const won = state.result === "chapter-win" || missionView()?.won,
        trialWon = state.result === "provisional-win",
        chapter = missionView()?.chapter || 1;
      help = trialWon
        ? "임시 적 시험을 완료했습니다. 이 결과는 기나긴 사냥의 정식 챕터 완료와 별개입니다. 시험 기록을 저장하거나 새 사냥에서 다음 모드를 선택하세요."
        : won
        ? chapter === 3 ? "기나긴 사냥 챕터 1~3을 모두 완수했습니다. 전체 캠페인의 기록과 보상을 파일로 보관하세요." : `챕터 ${chapter}의 사냥과 마지막 꿈을 마쳤습니다. 장비를 교체하고 다음 챕터를 시작할 수 있습니다.`
        : "사냥이 종료되었습니다. 상단의 새 사냥으로 다시 시작할 수 있습니다.";
      if (won || trialWon) {
        $("phaseTitle").textContent = trialWon ? "임시 적 시험 완료" : chapter === 3 ? "기나긴 사냥 캠페인 완수" : `챕터 ${chapter} 완수`;
        html = `<button id="exportChapterSave" class="primary">${trialWon ? "시험 결과" : "완료한 사냥"} 저장 내보내기</button>`;
        if (won && chapter < 3) html += button(`챕터 ${chapter + 1} 준비 · 장비 교체`, "ENTER_BETWEEN_CHAPTERS", {}, false, "primary");
      }
    }
    if (E.canBossInsight?.(state)) html += button("화기 소진 · 보스 시트에 계몽 토큰 +1", "BOSS_INSIGHT");
    if (["hunter", "combat_choose"].includes(p) && inventory.names().length)
      html += `<p class="muted">공격에 함께 사용: ${inventory.names().map(esc).join(", ")}</p>`;
    const rewards = E.rewardsView ? E.rewardsView(state) : null;
    if (rewards && ["combat_react", "combat_extra", "mission_death", "boss_react"].includes(p))
      html += rewards.rewards.filter((r) => r.kind === "old-hunter-bone" && r.usable).map((r) => button(`${esc(r.name)} · 자동 회피`, "USE_REWARD", { rewardId: r.id })).join("");
    if (["hunter", "combat_choose"].includes(p) && rewards)
      html += rewards.rewards.filter((r) => r.attackSelectable).map((r) => rewardAttackOption(r, r.name)).join("");
    if (rewards?.choices.length) {
      $("phaseTitle").textContent = "획득한 보상 선택";
      help = "다음 행동 전에 보상의 장착·슬롯·보관을 결정하세요.";
      html = rewardChoiceHTML(rewards);
    }
    const weaponChoices = E.weaponChoices?.(state, { cardId: selectedCard, slot: selectedSlot, enemyId: selectedEnemy }) || [];
    if (!rewards?.choices.length && (p.startsWith("weapon_") || p === "entry_weapon")) {
      $("phaseTitle").textContent = p.includes("entry") ? "장치 무기 · 진입한 적 대응" : "장치 무기 효과 선택";
      help = p.includes("entry") ? "무기 능력을 사용하려면 손에 든 카드와 빈 슬롯을 선택하세요." : "장치 무기의 효과를 처리할 대상이나 이동할 칸을 선택하세요.";
      html = `<p>${esc(selectHint)}</p>${weaponChoices.map((option) => commandButton(option)).join("")}`;
    } else if (!rewards?.choices.length && weaponChoices.length) html += `<div class="weapon-effect-choices"><p class="muted">${esc(E.weapon(state).name)} · 고유 효과</p>${weaponChoices.map((option) => commandButton(option)).join("")}</div>`;
    if (["hunter", "combat_choose"].includes(p) && ["attack_sacrifice_damage", "attack_sacrifice_speed_or_damage"].includes(boostCode)) {
      const options = boostCode === "attack_sacrifice_damage"
        ? [["none", "사용하지 않음"], ["1", "피해 1을 받고 공격 피해 +1"], ["2", "피해 2를 받고 공격 피해 +2"]]
        : [["none", "사용하지 않음"], ["speed", "피해 1을 받고 공격 속도 +1"], ["damage", "피해 1을 받고 공격 피해 +1"]];
      html = `<label>공격에 사용할 무기 고유 효과<select id="weaponBoost">${options.map(([value, label]) => `<option value="${value}" ${weaponBoost === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>` + html;
    }
    $("phaseHelp").textContent = help;
    $("decisions").innerHTML = html;
    bind($("decisions"));
    bindRewardAttack($("decisions"));
    if ($("weaponBoost")) $("weaponBoost").onchange = () => { weaponBoost = $("weaponBoost").value; renderFirearm(); renderDecisions(); };
    if ($("reloadSecondCard")) $("reloadSecondCard").onchange = () => {
      reloadSecondCardId = $("reloadSecondCard").value || null;
      renderDecisions();
    };
    if ($("exportChapterSave")) $("exportChapterSave").onclick = () => $("save").click();
    if ($("nextChapterStart")) {
      window.BBStartPlacement.mount($("nextChapterPlacement"), $("nextChapterStart"), $("startNextChapter"));
      const rememberStart = () => { nextStartSpace = $("nextChapterStart").value; };
      $("nextChapterStart").addEventListener("change", rememberStart);
      $("nextChapterPlacement").addEventListener("click", rememberStart);
      $("nextChapterFace").onchange = () => { nextFace = +$("nextChapterFace").value; };
      $("startNextChapter").onclick = () => send("START_NEXT_CHAPTER", { startSpace: $("nextChapterStart").value, face: +$("nextChapterFace").value });
    }
    $("combatInfo").innerHTML = c
      ? `<div class="combat-card"><b>${esc(state.enemies.some((e) => e.id === c.enemyId) ? E.enemyDef(state, state.enemies.find((e) => e.id === c.enemyId)).name : "처치된 적")}</b><p>${c.action ? `${esc(ED.labels[c.action.kind])} · ${esc(c.action.name)}${c.action.type !== "ability" && Number.isFinite(c.action.speed) ? " · 속도 " + c.action.speed : ""}${Number.isFinite(c.action.damage) && (c.action.type !== "ability" || c.action.damage > 0) ? " · 피해 " + c.action.damage : ""}` : "적 행동 공개 전"}</p>${c.action?.rules?.length ? `<p>${c.action.rules.map(rule => esc(uiText(rule))).join("<br>")}</p>` : ""}<small>${c.attack ? `사냥꾼 공격 · 속도 ${c.attack.speed} / 피해 ${c.attack.damage}` : c.flame ? `${esc(c.flame.name || E.firearm(state).name)} 공격 · 속도 ${c.flame.speed} / 피해 ${c.flame.damage}${c.flame.interrupt ? " · 방해" : ""}${c.flame.splash ? ` · 같은 칸의 다른 적에게 피해 ${c.flame.splash}` : ""}` : "사냥꾼 공격 없음"} · 방어 ${c.defense}${c.dodged ? " · 회피 선택됨" : ""}${c.cancelEnemy ? " · 적 공격 방해됨" : ""}${c.noDodge ? " · 회피 불가" : ""}</small></div>`
      : "";
    renderEnemyHistory();
    $("deckStatus").innerHTML = `<div class="deck-summary"><span>적 행동 · 남음 ${state.enemyDeck.length}</span><button type="button" data-enemy-history aria-controls="enemyHistoryDialog" aria-label="버린 적 행동과 공개 순서 확인">버림 ${state.enemyDiscard.length}</button><span class="last-enemy-action">마지막 공개: ${ED.labels[state.enemyDiscard.at(-1)] || "없음"}</span></div>`;
    $("deckStatus").querySelector("[data-enemy-history]").onclick = event => {
      renderEnemyHistory(); enemyPopup?.close(); historyPopup?.open(event.currentTarget);
    };
    polishPlayerText($("decisions"));
    polishPlayerText($("phaseHelp"));
    polishPlayerText($("mapContext"));
    $("decisions")
      .querySelectorAll("[data-pull]")
      .forEach(
        (b) =>
          (b.onchange = () => {
            b.checked
              ? pulls.add(b.dataset.pull)
              : pulls.delete(b.dataset.pull);
            renderDecisions();
          }),
      );
    $("decisions")
      .querySelectorAll("[data-rotation]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            rotation = +b.dataset.rotation;
            renderMap();
            renderDecisions();
          }),
      );
    $("decisions")
      .querySelectorAll("[data-return]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            send("RETURN", {
              node: b.dataset.return,
              face: +$("returnFace").value,
            })),
      );
    if ($("refill"))
      $("refill").onclick = () =>
        send("REFILL", {
          discardIds: [
            ...$("decisions").querySelectorAll("[data-refill]:checked"),
          ].map((x) => x.dataset.refill),
        });
    if ($("tileExchangeItem") && $("lootCount")) {
      const updateExchangeChoice = () => {
        const option = $("tileExchangeItem").querySelector('option[value="after-loot"]');
        if (!option) return;
        option.disabled = !+$("lootCount").value;
        if (option.disabled && $("tileExchangeItem").value === "after-loot") $("tileExchangeItem").value = "";
      };
      $("lootCount").onchange = updateExchangeChoice;
      updateExchangeChoice();
    }
    if ($("tileRescue")) $("tileRescue").onchange = () => { interactionMissionSelected = $("tileRescue").checked; };
    if ($("interact"))
      $("interact").onclick = () =>
        send("INTERACT", {
          cardId: selectedCard,
          lootCount: +($("lootCount")?.value || 0),
          heal: !!$("tileHeal")?.checked,
          lamp: $("tileLamp")?.value || null,
          ...($("tileRescue")?.checked ? { mission: "rescue" } : {}),
          ...($("tileExchangeItem")?.value === "after-loot"
            ? { exchange: true, exchangeAfterLoot: true }
            : $("tileExchangeItem")?.value ? { exchange: true, exchangeItemId: $("tileExchangeItem").value } : {}),
        });
    renderContext(actionArgs);
  }
  function renderContext(actionArgs = {}) {
    const box = $("mapContext");
    if (!box) return;
    box.hidden = !mapTarget;
    if (!mapTarget) { box.innerHTML = ""; return; }
    const view = window.BBHuntContext?.view(state, mapTarget, { cardId: selectedCard,
      slot: selectedSlot, pullIds: [...pulls], rewardIds: [...selectedRewards], replaceCardEffects: attackReplacesCardEffects() });
    if (!view) { box.innerHTML = ""; return; }
    const actions = view.actions || [];
    const command = (action) => {
      if (!action.command) return null;
      const { type, args, ...rest } = action.command;
      return { type, ...rest, ...args,
        ...(["ATTACK", "COUNTER"].includes(type) ? actionArgs : {}),
        ...(type === "FIREARM" && E.firearm(state).trigger === "hunter-turn" ? {
          ...(state.setup.rulesVersion >= 11 && selectedRewards.size ? { rewardIds: [...selectedRewards] } : {}),
          ...(Object.hasOwn(actionArgs, "weaponBoost") ? { weaponBoost: actionArgs.weaponBoost } : {}) } : {}) };
    };
    box.innerHTML = `<div class="context-heading"><div><p class="eyebrow">선택한 대상</p><h3>${esc(view.title)}</h3></div><button id="clearMapTarget" type="button" aria-label="대상 선택 닫기">×</button></div>${view.hint ? `<p class="context-hint">${esc(view.hint)}</p>` : ""}<div class="context-actions">${actions.map((action, index) => {
      const c = command(action), { type, ...args } = c || {};
      const selfCost = ["ATTACK", "COUNTER", "FIREARM"].includes(type) && actionArgs.weaponBoost && actionArgs.weaponBoost !== "none"
        ? ` · 자기 피해 ${typeof actionArgs.weaponBoost === "number" ? actionArgs.weaponBoost : 1}` : "";
      const resourceCost = (["ATTACK", "COUNTER"].includes(type) && inventory.ids().length ? ` · 소모품 ${inventory.ids().length}장 사용` : "")
        + (["ATTACK", "COUNTER", "FIREARM"].includes(type) && selectedRewards.size ? ` · 선택 보상 ${selectedRewards.size}장 소진` : "");
      return `<div class="context-action"><button data-context-id="${esc(action.id)}" ${c ? `data-command="${type}" data-args="${esc(JSON.stringify(args))}"` : `data-context-action="${index}"`} ${action.enabled ? "" : "disabled"}>${esc(action.label)}<small>${esc(action.cost + selfCost + resourceCost)}</small></button>${!action.enabled && action.reason ? `<p class="context-reason">${esc(action.reason)}</p>` : ""}</div>`;
    }).join("")}</div>`;
    bind(box);
    box.querySelectorAll("[data-context-action]").forEach((b) => {
      b.onclick = () => {
        const action = actions[+b.dataset.contextAction];
        if (!action?.enabled) return;
        if (action.sequence) sendCommands(action.sequence.map((c) => {
          const { type, args, ...rest } = c; return { type, ...rest, ...args };
        }));
        else if (action.id === "interact") {
          const details = $("contextInteraction"); if (details) details.open = true;
          $("interact")?.focus();
        }
      };
    });
    $("clearMapTarget").onclick = () => { mapTarget = null; renderMap(); renderDecisions(); };
  }
  function renderEnemyHistory() {
    const history = enemyHistory.view();
    $("enemyActionHistory").innerHTML = history.records.map(record => `<li><strong>${esc(ED.labels[record.kind])}</strong>${record.enemy ? `<span>${esc(uiText(record.enemy))} · ${esc(uiText(record.action))}</span>` : ""}</li>`).join("") || '<li class="muted">아직 공개된 적 행동이 없습니다.</li>';
  }
  function publicEnemyAction(action, showStats = true) {
    if (!action) return "";
    const values = showStats ? [Number.isFinite(action.speed) ? `속도 ${action.speed}` : "",
      Number.isFinite(action.dodgeSpeed) ? `회피 속도 ${action.dodgeSpeed}` : "",
      Number.isFinite(action.damage) && (action.type !== "ability" || action.damage > 0) ? `피해 ${action.damage}` : ""].filter(Boolean) : [],
      effects = [...new Set([...(action.keywords || []), action.interrupt && "방해", action.stun && "기절",
        action.poison && "독", action.frenzy && "발광", action.undodgeable && "회피 불가",
        action.uninterruptible && "방해 불가", action.bossInsightReduction && "계몽 토큰마다 피해 -1",
        action.forceHunterMove && `사냥꾼을 ${action.forceHunterMove}칸 멀리 이동`,
        action.allHunters && "이 칸의 모든 사냥꾼을 대상으로 합니다.",
        action.bossInsight && "공격 전에 화기를 소진하여 보스에게 계몽 토큰 1개를 놓을 수 있습니다.",
        action.afterAttackMove && `공격 후 이 적을 ${action.afterAttackMove}칸 멀리 이동합니다.`,
        action.afterDodgeDamageBonus && `회피하면 사냥꾼의 공격 피해 +${action.afterDodgeDamageBonus}`,
        action.otherHunters && `이 칸의 다른 사냥꾼은 회피(속도 ${action.otherHunters.dodgeSpeed})하거나 피해 ${action.otherHunters.damage}를 받습니다.`].filter(Boolean))];
    return `<strong>${esc(uiText(action.name || action.label || "능력"))}</strong>${values.length ? `<span class="enemy-action-stats">${values.join(" · ")}</span>` : ""}${effects.length ? `<p>${effects.map(effect => esc(uiText(effect))).join(" · ")}</p>` : ""}${action.rules?.length ? `<p>${action.rules.map(rule => esc(uiText(rule))).join("<br>")}</p>` : ""}`;
  }
  function openEnemyDetail(button) {
    const assignment = button.dataset.enemyInfo && state.world.assignments.find(a => a.enemyId === button.dataset.enemyInfo),
      enemy = button.dataset.specialInfo && state.enemies.find(e => e.id === button.dataset.specialInfo);
    if (!assignment && !enemy) return;
    const d = E.enemyDef(state, enemy || assignment.enemyId), f = d.face,
      stats = `<p class="muted">${enemy ? `체력 ${enemy.hp} / ${d.maxHp}` : `체력 ${d.maxHp ?? d.health}`} · 이동 ${d.move}${d.boss && enemy?.componentPhase ? ` · ${enemy.componentPhase}페이즈` : ""}</p>`;
    let detail;
    if (d.boss) {
      // Only the current, already revealed combat action is public. Boss
      // definitions also contain future actions and must not be enumerated.
      const c = state.combat?.enemyId === enemy.id ? state.combat : null,
        actions = [c?.action, c?.immediate, c?.extra].filter(Boolean),
        unique = actions.filter((action, index) => actions.findIndex(other => other.name === action.name) === index);
      detail = `<p>계몽 토큰 ${enemy.insightTokens || 0}개</p>${unique.length ? `<dl>${unique.map(action => `<dt>현재 공개된 행동</dt><dd>${publicEnemyAction(action)}</dd>`).join("")}</dl>` : '<p class="muted">아직 공개된 행동이 없습니다.</p>'}`;
    } else {
      const basic = f?.basicAttack || d.basic, special = f?.specialAttack || d.special, ability = f?.ability || d.ability;
      detail = `<dl>${[["기본 공격", basic], ["특수 공격", special], ["전용 능력", ability]].filter(([, action]) => action).map(([label, action]) => `<dt>${label}</dt><dd>${publicEnemyAction(action, label !== "전용 능력")}</dd>`).join("")}</dl>`;
    }
    $("enemyDetailTitle").textContent = uiText(d.name);
    $("enemyDetailContent").innerHTML = stats + detail;
    historyPopup?.close(); enemyPopup?.open(button);
  }
  function renderEnemies() {
    $("setupInfo").textContent =
      `시드 ${state.initialSeed} · 새 사냥마다 배정 · 초기화 시 유지`;
    const attack = (a) =>
      `${esc(a.name)} · 속도 ${a.speed} / 피해 ${a.damage}${a.keywords.length ? " · " + a.keywords.map(esc).join(" · ") : ""}${a.rules.length ? "<br>" + a.rules.map(rule => esc(uiText(rule))).join("<br>") : ""}`;
    $("chapterEnemies").innerHTML = state.world.assignments
      .map((a) => {
        const d = E.enemyDef(state, a.enemyId),
          f = d.face;
        return `<article id="enemy-info-${esc(a.enemyId)}" class="assignment" style="--marker:${colors[a.marker]}"><span class="marker">${a.slot}순위 · ${a.marker === "gold" ? "금색" : a.marker === "red" ? "적갈색" : "보라색"} 마커</span><h3>${esc(d.name)}</h3><p>체력 ${d.health} · 지도 위 ${state.enemies.filter((e) => e.kind === a.enemyId).length} / 4개 · 이동 ${d.move}</p><dl><dt>기본 공격</dt><dd>${attack(f.basicAttack)}</dd><dt>특수 공격</dt><dd>${attack(f.specialAttack)}</dd><dt>전용 능력 · ${esc(f.ability.name)}</dt><dd>${f.ability.rules.map(rule => esc(uiText(rule))).join("<br>")}</dd></dl></article>`;
      })
      .join("");
    const markerName = marker => marker === "gold" ? "금색" : marker === "red" ? "적갈색" : "보라색";
    $("enemyRoster").innerHTML = state.world.assignments.map(a => `<button class="enemy-roster-entry" type="button" data-enemy-info="${esc(a.enemyId)}" style="--marker:${colors[a.marker]}" aria-label="${esc(E.enemyDef(state, a.enemyId).name)} 공격과 능력 보기"><span class="roster-marker"><i aria-hidden="true"></i>${a.slot}순위 · ${markerName(a.marker)}</span><strong>${esc(E.enemyDef(state, a.enemyId).name)}</strong></button>`).join("") + state.enemies.filter(e => e.componentId || e.provisionalKind).filter((enemy, index, all) => all.findIndex(other => E.enemyDef(state, other).name === E.enemyDef(state, enemy).name) === index).map(e => `<button class="enemy-roster-entry special-roster-entry" type="button" data-special-info="${esc(e.id)}"><span class="roster-marker">★ 특수 적${E.enemyDef(state, e).boss && e.componentPhase ? ` · ${e.componentPhase}페이즈` : ""}</span><strong>${esc(E.enemyDef(state, e).name)}</strong></button>`).join("");
    $("enemyRoster").querySelectorAll("button").forEach(button => button.onclick = () => openEnemyDetail(button));
  }
  const G = window.BBTileGeometry;
  function tileHTML(p, ghost = false) {
    const def = M.tile(p.tileId), h = E.hunter(state),
      reachable = E.neighbors(state, h.position), mission = missionView(),
      currentTile = E.node(state, h.position)?.tile,
      currentFog = !!mission?.fog.includes(currentTile),
      fog = !ghost && !!mission?.fog.includes(p.tileId);
    return `<div class="tile-cell ${ghost ? "ghost" : ""} ${fog ? "fog-tile" : ""}" data-tile="${p.tileId}"><img class="tile-diagram" src="${G.image(p.tileId)}" alt="" style="transform:rotate(${p.rotation * 90}deg)"><div class="tile-name"><a href="${G.image(p.tileId)}" target="_blank">${esc(def.displayName)} ↗</a><span>${ghost ? "미리보기" : fog ? "안개" : p.rotation * 90 + "°"}</span></div>${def.spaces.map((n) => {
      const id = `${p.tileId}:${n.id}`, [x, y] = G.point(p.tileId, n.id, p.rotation),
        outline = G.polygon(p.tileId, n.id, p.rotation),
        left = Math.min(...outline.map(([x]) => x)), top = Math.min(...outline.map(([,y]) => y)),
        width = Math.max(...outline.map(([x]) => x)) - left, height = Math.max(...outline.map(([,y]) => y)) - top,
        polygon = outline.map(([x,y]) => `${(x-left)/width*100}% ${(y-top)/height*100}%`).join(","),
        localX = (x-left)/width*100, localY = (y-top)/height*100,
        here = !ghost && id === h.position,
        reach = !ghost && state.phase === "move" && reachable.includes(id) && (!currentFog || p.tileId === currentTile),
        loot = ghost ? 0 : state.loot.filter((l) => l === id).length,
        figures = ghost ? [] : state.enemies.filter((f) => f.node === id),
        tokens = ghost ? [] : (mission?.tokens || []).filter((t) => t.node === id || (t.carrierId === state.activeHunterId && here));
      const status = `${here ? '<span class="hunter-map-marker">● 사냥꾼</span>' : ""}${loot ? `<small>◇ 남은 소모품 ${loot}</small>` : ""}${tokens.map((t) => `<small class="map-mission-token">◆ ${esc(t.name)}</small>`).join("")}`;
      return `<button class="space diagram-space ${here ? "here" : ""} ${reach ? "reachable" : ""} ${mapTarget?.kind === "cell" && mapTarget.node === id ? "context-selected" : ""} ${ghost ? "ghost-space" : ""}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;clip-path:polygon(${polygon})" data-node="${esc(id)}" aria-pressed="${mapTarget?.kind === "cell" && mapTarget.node === id}" ${ghost ? "disabled" : ""} aria-label="${esc(n.placeName || n.label)}${here ? " · 사냥꾼" : ""}${loot ? " · 소모품 " + loot : ""}${figures.length ? " · 적 " + figures.length : ""}" title="${esc(n.placeName || n.label)}"><span class="node-anchor" data-node-anchor="${esc(id)}" style="left:${localX}%;top:${localY}%" aria-hidden="true"></span>${here && !h.inDream ? `<span class="hunter-anchor" data-presentation-id="hunter" data-presentation-kind="hunter" data-presentation-node="${esc(id)}" data-presentation-skin="${esc(hunterVisual().skin)}" style="left:${localX}%;top:${localY}%" aria-hidden="true"></span>` : ""}<span class="space-status" style="left:${localX}%;top:${Math.min(90,localY+10)}%">${status}</span></button>`;
    }).join("")}${ghost ? "" : def.spaces.map((space) => {
      const node = `${p.tileId}:${space.id}`, figures = state.enemies.filter((enemy) => enemy.node === node);
      if (!figures.length) return "";
      const [x, y] = G.point(p.tileId, space.id, p.rotation);
      return `<div class="map-figures" style="left:${x}%;top:${Math.min(82, y + 18)}%">${figures.map((enemy) => {
        const assigned = state.world.assignments.find((assignment) => assignment.enemyId === enemy.kind), d = E.enemyDef(state, enemy),
          marker = enemy.missionId || enemy.provisionalKind || enemy.componentId || !assigned ? "★" : ["①", "②", "③"][assigned.slot - 1];
        return `<button type="button" class="map-figure ${selectedEnemy === enemy.id ? "selected" : ""}" data-enemy="${esc(enemy.id)}" data-presentation-id="${esc(enemy.id)}" data-presentation-kind="enemy" data-presentation-node="${esc(node)}" data-presentation-skin="${characterSkin(enemy)}" aria-pressed="${selectedEnemy === enemy.id}" aria-label="${esc(d.name)} ${enemy.figure}번 · 체력 ${enemy.hp} · 대상 선택" title="${esc(d.name)} · 체력 ${enemy.hp}/${d.maxHp}" style="--marker:${colors[assigned?.marker] || colors.gold}">${marker}<small>${enemy.figure}</small></button>`;
      }).join("")}</div>`;
    }).join("")}${ghost ? "" : gateHTML(p)}</div>`;
  }
  function gateHTML(p) {
    const directions = ["N", "E", "S", "W"], open = M.openExits(state.world);
    return G.definition(p.tileId).exits.map((gate) => {
      const edge = directions[(directions.indexOf(gate.edge) + p.rotation) % 4],
        node = `${p.tileId}:${gate.spaceId}`, [x, y] = G.rotatePoint(gate.point, p.rotation),
        unexplored = open.some((exit) => exit.node === node && exit.edge === edge),
        selected = mapTarget?.kind === "entrance" && mapTarget.node === node && mapTarget.edge === edge;
      return `<button type="button" class="map-gate ${unexplored ? "unexplored" : "connected"} ${selected ? "selected" : ""}" data-entrance="${p.tileId}:${edge}" data-node="${node}" data-edge="${edge}" data-tile-id="${p.tileId}" aria-pressed="${selected}" aria-label="${esc(directionNames[edge])} 출입구 · ${unexplored ? "탐험" : "연결 통로"} · 행동과 비용 보기" title="${esc(directionNames[edge])} 출입구 · ${unexplored ? "탐험 비용 보기" : "이동 비용 보기"}" style="left:${Math.max(5,Math.min(95,x))}%;top:${Math.max(5,Math.min(95,y))}%">${{N:"↑",E:"→",S:"↓",W:"←"}[edge]}</button>`;
    }).join("");
  }
  function preview() {
    if (!state.world.pending) {
      rotation = null;
      previewTile = null;
      return null;
    }
    const p = state.world.pending,
      options = placementOptions();
    if (previewTile !== p.tileId || !options.includes(rotation)) {
      rotation = options[0];
      previewTile = p.tileId;
    }
    const [dx, dy] = M.vectors[p.anchor.edge];
    return {
      tileId: p.tileId,
      rotation,
      x: p.anchor.x + dx,
      y: p.anchor.y + dy,
    };
  }
  function renderMap() {
    const ghost = preview(),
      placed = [...state.world.tiles, ...(ghost ? [ghost] : [])],
      open = M.openExits(state.world);
    const border = open.map((e) => {
      const [dx, dy] = M.vectors[e.edge];
      return { x: e.x + dx, y: e.y + dy };
    });
    const points = [...placed, ...border],
      minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x)),
      minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    const currentTile = E.node(state, E.hunter(state).position)?.tile,
      currentFog = !!missionView()?.fog.includes(currentTile);
    const available = M.openExits(state.world).filter(
      (e) => e.node === E.hunter(state).position && !currentFog,
    );
    let html = "";
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = placed.find((p) => p.x === x && p.y === y);
        if (p) html += tileHTML(p, !!ghost && p === ghost);
        else {
          const exit = available.find((e) => {
            const [dx, dy] = M.vectors[e.edge];
            return e.x + dx === x && e.y + dy === y;
          });
          html += `<div class="tile-empty">${exit && state.world.tileDeck.length ? button(`${directionNames[exit.edge]} 탐험`, "EXPLORE", { edge: exit.edge }, state.phase !== "move", "explore-empty") : "미탐험 구역"}</div>`;
        }
      }
    mapColumns = maxX - minX + 1;
    resizeMap();
    $("chapterMap").innerHTML = html;
    bind($("chapterMap"));
    bindMapTargets();
    bindEnemyTargets($("chapterMap"));
    $("tileCount").textContent =
      `공개 ${state.world.tiles.length + (state.world.pending ? 1 : 0)} / ${state.world.tilePool.length} · 더미 ${state.world.tileDeck.length}`;
    const n = E.nodes(state).find((n) => n.id === E.hunter(state).position),
      def = n ? M.tile(n.tileId) : null;
    const locationDetail = n
      ? `<b>현재 위치 · ${esc(n.name)}</b>${def.rules.length ? '<p class="muted">' + def.rules.map(rule => esc(uiText(rule))).join(" ") + "</p>" : ""}${def.id === "tile-07" ? '<p class="muted">성배 교단 예배당 칸에서 상호작용하면 소모품 1개를 버리고 피의 유지 1개를 얻습니다. 같은 상호작용에서 획득한 소모품도 교환할 수 있습니다.</p>' : ""}`
      : "<b>현재 위치 · 사냥꾼의 꿈</b>";
    $("locationText").textContent = n ? `현재 위치 · ${n.name}` : "현재 위치 · 사냥꾼의 꿈";
    if ($("locationDetail")) $("locationDetail").innerHTML = locationDetail;
    $("nearEnemies").innerHTML = state.enemies
      .map(
        (e) =>
          `<div class="hunt-enemy ${selectedEnemy === e.id ? "selected" : ""}"><span>${esc(E.enemyDef(state, e).name)} #${e.figure} · ${esc(E.node(state, e.node).name)}<br>체력 ${e.hp} / ${E.enemyDef(state, e).maxHp} · ${E.hunter(state).inDream ? "" : E.distance(state, E.hunter(state).position, e.node) + "칸 거리"}</span><button data-enemy="${e.id}">대상 선택</button></div>`,
      )
      .join("");
    bindEnemyTargets($("nearEnemies"));
    $("explorationActions").innerHTML = state.world.tileDeck.length
      ? available
          .map((e) =>
            button(
              `${directionNames[e.edge]} 출입구로 탐험`,
              "EXPLORE",
              { edge: e.edge },
              state.phase !== "move",
            ),
          )
          .join("")
      : '<p class="muted">챕터의 모든 타일을 공개했습니다.</p>';
    if (!available.length && state.world.tileDeck.length)
      $("explorationActions").innerHTML =
        '<p class="muted">열린 출입구가 있는 칸으로 이동하면 탐험할 수 있습니다.</p>';
    bind($("explorationActions"));
    camera?.layout({ notify: false });
  }
  function bindEnemyTargets(box) {
    box.querySelectorAll("[data-enemy]").forEach((button) => {
      button.onclick = () => {
        selectedEnemy = button.dataset.enemy;
        mapTarget = { kind: "enemy", enemyId: selectedEnemy };
        if (shell?.activePanel() === "enemies") shell.close();
        renderMap(); renderFirearm(); renderDecisions(); shell?.bind(); syncPresentation();
      };
    });
  }
  function bindMapTargets() {
    $("chapterMap").querySelectorAll("[data-node]").forEach((b) => {
      b.onclick = () => {
        if (b.disabled) return;
        mapTarget = b.dataset.entrance
          ? { kind: "entrance", node: b.dataset.node, edge: b.dataset.edge, tileId: b.dataset.tileId }
          : { kind: "cell", node: b.dataset.node };
        renderMap(); renderDecisions(); syncPresentation();
        $("mapContext")?.focus();
      };
    });
  }
  function characterSkin(enemy) {
    const d = E.enemyDef(state, enemy);
    if (d.boss) return "boss";
    if (d.npcEnemy || /이오세프카/.test(d.name)) return "female";
    if (/beast|dog|hound|crow|spider|rat/i.test(enemy.kind) || /야수|사냥개|늑대|까마귀|거미|쥐/.test(d.name) && !/야수.?사냥/.test(d.name)) return "beast";
    return "mob";
  }
  function syncPresentation() {
    if (!presentation || rendering) return;
    const viewport = $("mapViewport"), bounds = viewport.getBoundingClientRect(),
      zoom = camera?.zoom() || 1, tileSize = Math.max(170, Math.min(290, (viewport.clientHeight || 300) - 10)),
      scale = zoom * tileSize / 290;
    const host = $("mapEffects");
    host.style.left = `${viewport.clientLeft || 0}px`; host.style.top = `${viewport.clientTop || 0}px`;
    host.style.width = `${viewport.clientWidth || 1}px`; host.style.height = `${viewport.clientHeight || 1}px`;
    const point = (element) => {
      const r = element.getBoundingClientRect();
      return { x: (r.left + r.right) / 2 - bounds.left - (viewport.clientLeft || 0), y: (r.top + r.bottom) / 2 - bounds.top - (viewport.clientTop || 0) };
    };
    const nodes = new Map([...$("chapterMap").querySelectorAll("[data-node-anchor]")].map((anchor) => [anchor.dataset.nodeAnchor, point(anchor)]));
    const h = E.hunter(state), actors = [...$("chapterMap").querySelectorAll("[data-presentation-id]")].map((anchor) => {
      const id = anchor.dataset.presentationId, kind = anchor.dataset.presentationKind,
        enemy = kind === "enemy" ? state.enemies.find((e) => e.id === id) : null;
      return { id, kind, node: anchor.dataset.presentationNode, skin: anchor.dataset.presentationSkin,
        ...(kind === "hunter" ? hunterVisual() : {}),
        scale, hp: kind === "hunter" ? h.hp : enemy?.hp, selected: kind === "enemy" && mapTarget?.kind === "enemy" && selectedEnemy === id,
        ...point(anchor) };
    });
    const actions = presentationActions.map((action) => {
      if (action.type !== "move") return action;
      const origin = nodes.get(action.fromNode), prior = presentationOrigins.get(action.fromId);
      if (!origin) return action;
      return { ...action, from: { x: origin.x + (prior?.dx || 0) * scale / (prior?.scale || scale),
        y: origin.y + (prior?.dy || 0) * scale / (prior?.scale || scale) } };
    });
    presentation.resize({ width: viewport.clientWidth || 1, height: viewport.clientHeight || 1 });
    presentation.sync({ sceneId: sceneId(), revision: state.revision, actors, actions,
      view: { x: (viewport.scrollLeft || 0) - (viewport.clientWidth || 0) / 2,
        y: (viewport.scrollTop || 0) - (viewport.clientHeight || 0) / 2, zoom } });
    // The v0.8.3 renderer loads its five generic bodies together and uses the
    // hunter body while an optional weapon sheet is still loading.
    const charactersReady = presentation.status?.().charactersReady === true;
    for (const marker of $("chapterMap").querySelectorAll(".hunter-map-marker"))
      marker.setAttribute("data-character-ready", String(charactersReady));
    for (const marker of $("chapterMap").querySelectorAll(".map-figure"))
      marker.setAttribute("data-character-ready", String(charactersReady));
    presentationActions = [];
    presentationOrigins = new Map(actors.map((actor) => {
      const n = nodes.get(actor.node) || actor;
      return [actor.id, { dx: actor.x - n.x, dy: actor.y - n.y, scale }];
    }));
  }

  function resizeMap() {
    const viewport = $("mapViewport"), height = viewport.clientHeight,
      size = height ? Math.max(170, Math.min(290, height - 10)) : 290;
    $("chapterMap").style.setProperty?.("--map-tile-size", `${size}px`);
    $("chapterMap").style.gridTemplateColumns = `repeat(${mapColumns},${size}px)`;
    camera?.layout({ notify: false });
  }
  window.addEventListener?.("resize", () => { resizeMap(); centerMap(true); syncPresentation(); });
  $("mapViewport").addEventListener("scroll", syncPresentation);
  function centerMap(force = false, smooth = true) {
    const focus = $("chapterMap").querySelector(previewTile ? ".ghost" : ".hunter-anchor") || $("chapterMap").querySelector(".space.here"),
      viewport = $("mapViewport");
    if (!focus) return;
    const r = focus.getBoundingClientRect(), v = viewport.getBoundingClientRect();
    const outside = r.left < v.left + 20 || r.right > v.right - 20 || r.top < v.top + 20 || r.bottom > v.bottom - 20;
    if (camera && (force || outside)) camera.centerOn(focus, { smooth });
    else if (!camera) {
      if (force || r.left < v.left + 12 || r.right > v.right - 12) viewport.scrollLeft += (r.left + r.right - v.left - v.right) / 2;
      if (force || r.top < v.top + 12 || r.bottom > v.bottom - 12) viewport.scrollTop += (r.top + r.bottom - v.top - v.bottom) / 2;
    }
    if (force && presentation && !rendering) {
      syncPresentation();
      const anchor = $("chapterMap").querySelector(".hunter-anchor"), a = anchor?.getBoundingClientRect();
      if (a) presentation.focus({ x: (a.left + a.right) / 2 - v.left - (viewport.clientLeft || 0), y: (a.top + a.bottom) / 2 - v.top - (viewport.clientTop || 0) });
    }
  }
  for (const [id, method] of [["zoomIn", "zoomIn"], ["zoomOut", "zoomOut"], ["zoomReset", "reset"], ["zoomFit", "fit"]]) {
    if ($(id)) $(id).onclick = () => camera?.[method]();
  }

  $("save").onclick = () => {
    const blob = new Blob([E.exportSave(state)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    const provisional = E.provisionalView ? E.provisionalView(state) : null;
    a.download = `bloodborne-v07-${isQa() ? "qa-" : ""}${missionView() ? "campaign-ch" + missionView().chapter : provisional ? "trial-" + provisional.componentId : "practice"}-${state.initialSeed}-r${state.round}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("load").onclick = () => $("file").click();
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      state = applyLoadedRuling(E.importSave(await f.text()));
      resetStoryReading();
      setupRequired = false;
      restoredPrevious = false;
      nextStartSpace = "";
      nextFace = null;
      if ($("setupDialog").open) $("setupDialog").close();
      selectedCard = null;
      selectedSlot = null;
      selectedRewards.clear();
      pulls.clear();
      inventory.clear();
      save();
      render();
      showError("");
    } catch (x) {
      $("error").textContent = x.message;
      if ($("setupDialog").open) $("setupError").textContent = x.message;
    }
    e.target.value = "";
  };
  function renderSetupGuns() {
    const selected = $("gun").value, actualMode = setupActualMode();
    $("gun").innerHTML = `${actualMode ? '<option value="">화기를 선택하세요</option>' : ""}` + Object.entries(D.firearms).map(([id, gun]) => {
      const actual = actualMode && (window.BBExtendedFirearms?.firearm(id) || window.BBActualComponents?.firearm(id)),
        label = id === "hunter-pistol" ? "" : actual ? " · 실물 고유 효과" : " · 임시 단총 능력";
      return `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(actual?.name || gun.name)}${label}</option>`;
    }).join("");
    $("gun").value = Object.hasOwn(D.firearms, selected) ? selected : actualMode ? "" : "hunter-pistol";
  }
  const setupQaMode = () => $("playMode").value === "qa-campaign";
  const setupActualMode = () => ["campaign", "practice", "qa-campaign"].includes($("playMode").value);
  const setupWeapons = () => setupQaMode() && E.qaData?.weapon ? { ...D.weapons, [E.qaData.weapon.id]: E.qaData.weapon } : D.weapons;
  const setupWeapon = () => setupWeapons()[$("weapon").value || "burial"] || D.weapons.burial;
  const knownDefaultFirearm = () => Object.hasOwn(D.firearms, setupWeapon().defaultFirearm || "hunter-pistol");
  function validateSetupLoadout() {
    const actual = setupActualMode(), weapon = setupWeapon(), expected = weapon.defaultFirearm || "hunter-pistol",
      selected = $("gun").value, defaultKnown = knownDefaultFirearm(),
      changed = actual && selected !== expected,
      gunName = D.firearms[expected]?.name || ({ cannon: "대포", evelyn: "에블린" })[expected] || expected;
    $("defaultGunNotice").textContent = actual
      ? `${weapon.name}의 기본 화기: ${gunName}${defaultKnown ? "" : " · 카드 자료 확인이 필요합니다. 제공된 화기를 선택해 대체 연습할 수 있습니다."}`
      : "별도 임시 구성품 시험에서는 장송의 칼날과 기존 임시 화기 규칙을 사용합니다.";
    $("firearmOverrideLabel").hidden = $("firearmOverrideNotice").hidden = !changed;
    const qaValid = !setupQaMode() || $("qaPreset").value === "fast" || (selectionCount(qaRewards) <= 16 && selectionCount(qaConsumables) <= 40),
      valid = !!selected && (!changed || $("firearmOverride").checked) && qaValid;
    $("confirmSetup").disabled = !$("start").value || !valid;
    return valid;
  }
  function renderSetupWeaponPreview() {
    const weapon = setupWeapon(), face = weapon.faces[+$("face").value || 0];
    $("setupWeaponPreview").innerHTML = `<p><strong>${esc(weapon.name)} · ${esc(faceName(face, +$("face").value || 0))}</strong></p><p>${esc(uiText(face.text || ""))}</p><div class="setup-slot-preview">${face.slots.map((slot, index) => `<span><b>${index + 1}번 · ${esc(slot.name)}</b><small>속도 ${slot.speed} · 피해 ${slot.damage}</small>${slot.text ? `<small>${esc(uiText(slot.text))}</small>` : ""}</span>`).join("")}</div>`;
  }
  function renderSetupWeapons(useDefaultGun = false) {
    const actual = setupActualMode(), definitions = setupWeapons(), selected = actual ? $("weapon").value || "burial" : "burial",
      face = +$("face").value || 0;
    $("weapon").innerHTML = Object.entries(definitions).filter(([id]) => id !== "training" && (actual || id === "burial"))
      .map(([id, weapon]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${esc(weapon.name)}</option>`).join("");
    $("weapon").value = Object.hasOwn(definitions, selected) ? selected : "burial";
    $("weapon").disabled = !actual;
    $("face").innerHTML = setupWeapon().faces.map((part, index) => `<option value="${index}" ${index === face ? "selected" : ""}>${esc(faceName(part, index))}</option>`).join("");
    $("face").value = String(face);
    renderSetupGuns();
    if (useDefaultGun) {
      const expected = setupWeapon().defaultFirearm || "hunter-pistol";
      $("gun").value = Object.hasOwn(D.firearms, expected) ? expected : "";
      $("firearmOverride").checked = false;
    }
    renderSetupWeaponPreview();
    validateSetupLoadout();
  }
  function renderPracticeTargets() {
    const source = window.BBExtendedEnemies?.specimens || {},
      specimens = Array.isArray(source) ? source : Object.values(source), selected = $("practiceTarget").value;
    $("practiceSetup").hidden = $("playMode").value !== "practice";
    $("practiceTarget").innerHTML = '<option value="">현재 캠페인의 일반 적 · 지도 탐험</option>' + specimens.map((target) => `<option value="${esc(target.id)}" ${target.id === selected ? "selected" : ""}>${esc(target.name)}</option>`).join("");
    $("practiceTarget").value = specimens.some((target) => target.id === selected) ? selected : "";
    const target = specimens.find((part) => part.id === $("practiceTarget").value), variants = target?.faces?.[0]?.sideId === "a";
    $("practiceSideLabel").hidden = !target || !variants;
    if (!variants) $("practiceSide").value = "a";
    $("practiceTargetNotice").textContent = target
      ? `선택한 적 1개가 사냥꾼과 같은 칸에서 시작합니다.${variants ? " 연습할 적의 상태를 고르세요." : " 혼자 사냥할 때의 능력을 사용합니다."}` : "기나긴 사냥의 일반 적 배정으로 탐험과 전투를 연습합니다.";
  }
  function renderPracticeRewards() {
    const definitions = window.BBRewards?.definitions || {};
    $("practiceRewards").innerHTML = Object.values(definitions).map((reward) => {
      const count = practiceRewards.get(reward.id) || 0, note = reward.subtype === "quest" ? "사용 효과가 없는 임무 물품" : reward.availabilityNote || "";
      return `<label>${esc(reward.name)}<select data-practice-reward="${esc(reward.id)}" aria-label="${esc(reward.name)} 지급 수량">${Array.from({ length: reward.count + 1 }, (_, i) => `<option value="${i}" ${i === count ? "selected" : ""}>${i ? i + "장 지급" : "지급하지 않음"}</option>`).join("")}</select>${note ? `<small>${esc(note)}</small>` : ""}</label>`;
    }).join("");
    $("practiceRewards").querySelectorAll("[data-practice-reward]").forEach((select) => select.onchange = () => {
      const value = +select.value;
      if (value) practiceRewards.set(select.dataset.practiceReward, value);
      else practiceRewards.delete(select.dataset.practiceReward);
      updatePracticeRewardsNotice();
    });
    updatePracticeRewardsNotice();
  }
  function updatePracticeRewardsNotice() {
    const count = [...practiceRewards.values()].reduce((n, value) => n + value, 0);
    $("practiceRewardsNotice").textContent = count ? `${count}장 연습 지급 · 시작 설정과 저장 파일에 기록합니다.` : "선택한 연습 보상 없음";
  }
  try {
    if ($("restoreV05")) $("restoreV05").hidden = !localStorage.getItem(oldKey);
    if ($("restoreV06")) $("restoreV06").hidden = !localStorage.getItem(previousKey);
    $("loadV06Setup").hidden = !localStorage.getItem(previousKey);
  } catch { /* File save remains available. */ }
  function selectionCount(selection) { return [...selection.values()].reduce((count, value) => count + value, 0); }
  function selectionIds(selection) { return [...selection].flatMap(([id, count]) => Array(count).fill(id)); }
  function startSupplyNames(ids, definitions) {
    const counts = new Map();
    for (const id of ids || []) counts.set(id, (counts.get(id) || 0) + 1);
    return [...counts].map(([id, count]) => `${definitions[id]?.name || id}${count > 1 ? ` ${count}장` : ""}`).join(", ");
  }
  function renderQaSetup() {
    const active = setupQaMode(), custom = $("qaPreset").value === "custom",
      definitions = window.BBRewards?.definitions || {},
      consumables = { ...D.consumables, ...(E.qaData?.consumables || {}) },
      preset = E.qaData?.presets?.fast;
    $("qaSetup").hidden = !active;
    $("qaCustomSetup").hidden = !custom;
    $("qaPresetNotice").hidden = custom;
    $("startingItemSetup").hidden = active;
    $("confirmSetup").textContent = active ? "검증 사냥 시작" : "새 사냥 시작";
    $("qaPresetNotice").textContent = preset
      ? `빠른 임무 검증 시작 지급: ${startSupplyNames(preset.startRewards, definitions)} / ${startSupplyNames(preset.startConsumables, consumables)}. 장치 무기는 아래에서 직접 선택합니다.`
      : "검증 전용 시작 지급은 일반 사냥의 획득 보상과 별도로 기록됩니다.";
    $("qaRewards").innerHTML = Object.values(definitions).map((reward) => `<label>${esc(reward.name)}<select data-qa-reward="${esc(reward.id)}" aria-label="${esc(reward.name)} 검증 지급 수량">${Array.from({ length: reward.count + 1 }, (_, count) => `<option value="${count}" ${count === (qaRewards.get(reward.id) || 0) ? "selected" : ""}>${count ? count + "장 지급" : "지급하지 않음"}</option>`).join("")}</select>${reward.subtype === "quest" ? "<small>사용 효과가 없는 임무 물품</small>" : ""}</label>`).join("");
    $("qaConsumables").innerHTML = Object.entries(consumables).filter(([id, item]) => item.runtime === "playable" || id.startsWith("qa-")).map(([id, item]) => {
      const limit = id.startsWith("qa-") ? 10 : item.count || 0;
      return `<label>${esc(item.name)}<select data-qa-consumable="${esc(id)}" aria-label="${esc(item.name)} 검증 지급 수량">${Array.from({ length: limit + 1 }, (_, count) => `<option value="${count}" ${count === (qaConsumables.get(id) || 0) ? "selected" : ""}>${count ? count + "장 지급" : "지급하지 않음"}</option>`).join("")}</select><small>${esc(item.rules || item.text || "")}</small></label>`;
    }).join("");
    $("qaRewards").querySelectorAll("[data-qa-reward]").forEach((select) => select.onchange = () => {
      if (+select.value) qaRewards.set(select.dataset.qaReward, +select.value);
      else qaRewards.delete(select.dataset.qaReward);
      updateQaSetupNotice();
    });
    $("qaConsumables").querySelectorAll("[data-qa-consumable]").forEach((select) => select.onchange = () => {
      if (+select.value) qaConsumables.set(select.dataset.qaConsumable, +select.value);
      else qaConsumables.delete(select.dataset.qaConsumable);
      updateQaSetupNotice();
    });
    updateQaSetupNotice();
  }
  function updateQaSetupNotice() {
    const rewards = selectionCount(qaRewards), consumables = selectionCount(qaConsumables), invalid = rewards > 16 || consumables > 40;
    $("qaSetupNotice").textContent = `직접 선택: 시작 보상 ${rewards}/16장 · 소모품 ${consumables}/40장${invalid ? " · 지급 상한을 초과했습니다." : " · 시작 후 보상을 장착하거나 보관합니다."}`;
    $("qaSetupNotice").className = invalid ? "error" : "muted";
    validateSetupLoadout();
  }
  function renderResumeButtons() {
    try {
      const normal = !!(localStorage.getItem(key) || localStorage.getItem(previousKey)), qa = !!localStorage.getItem(qaKey);
      $("resumeNormal").hidden = !normal || !isQa();
      $("resumeQa").hidden = !qa || isQa();
      $("resumeNormalSetup").hidden = !normal;
      $("resumeQaSetup").hidden = !qa;
    } catch { /* File save remains available. */ }
  }
  function restoreStored(storageKey, label) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) throw new Error(`이 브라우저에 ${label} 자동 저장이 없습니다.`);
      state = applyLoadedRuling(E.importSave(saved));
      resetStoryReading();
      restoredPrevious = storageKey === previousKey;
      setupRequired = false;
      nextStartSpace = "";
      nextFace = null;
      if ($("setupDialog").open) $("setupDialog").close();
      selectedCard = null;
      selectedSlot = null;
      selectedRewards.clear();
      selectedEnemy = null;
      pulls.clear();
      inventory.clear();
      save();
      render();
      showError("");
    } catch (e) { showError(e.message); }
  }
  if ($("restoreV05")) $("restoreV05").onclick = () => restoreStored(oldKey, "v0.5");
  if ($("restoreV06")) $("restoreV06").onclick = () => restoreStored(previousKey, "v0.6");
  $("loadV06Setup").onclick = () => restoreStored(previousKey, "v0.6");
  const restoreNormal = () => {
    try { restoreStored(localStorage.getItem(key) ? key : previousKey, "일반 사냥"); }
    catch (error) { showError(error.message); }
  };
  $("resumeNormal").onclick = $("resumeNormalSetup").onclick = restoreNormal;
  $("resumeQa").onclick = $("resumeQaSetup").onclick = () => restoreStored(qaKey, "검증 사냥");
  $("startingItem").innerHTML += Object.values(D.consumables)
    .filter((x) => x.runtime === "playable")
    .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
    .join("");
  const startPlacement = window.BBStartPlacement.mount($("startPlacement"), $("start"), $("confirmSetup"));
  $("start").addEventListener("change", validateSetupLoadout);
  $("startPlacement").addEventListener("click", validateSetupLoadout);
  function renderSetupStory() {
    renderSetupWeapons();
    renderPracticeTargets();
    renderPracticeRewards();
    renderQaSetup();
    $("setupStory").hidden = !["campaign", "qa-campaign"].includes($("playMode").value);
    $("setupStoryText").textContent = window.BBLongHunt.preface.find((entry) => entry.id === "intro")?.narrative || "";
  }
  $("playMode").onchange = () => {
    if (setupQaMode() && lastSetupMode !== "qa-campaign" && E.qaData?.weapon) {
      $("weapon").value = E.qaData.weapon.id;
      $("face").value = "0";
      $("gun").value = E.qaData.weapon.defaultFirearm || "hunter-pistol";
      $("firearmOverride").checked = false;
    }
    lastSetupMode = $("playMode").value;
    renderSetupStory();
  };
  $("qaPreset").onchange = renderQaSetup;
  $("weapon").onchange = () => renderSetupWeapons(true);
  $("face").onchange = renderSetupWeaponPreview;
  $("gun").onchange = validateSetupLoadout;
  $("firearmOverride").onchange = validateSetupLoadout;
  $("practiceTarget").onchange = renderPracticeTargets;
  function openSetup() {
    shell?.close();
    $("seed").value = Date.now() % 4294967295;
    $("start").value = "";
    startPlacement.update();
    $("cancelSetup").hidden = setupRequired;
    $("setupIntro").textContent = setupRequired
      ? "시작할 칸을 선택한 뒤 사냥을 시작하세요. 저장 파일이 있으면 불러올 수도 있습니다."
      : "현재 진행을 보관하려면 먼저 저장을 내보내세요.";
    $("setupError").textContent = "";
    renderSetupStory();
    renderResumeButtons();
    $("setupDialog").showModal();
  }
  $("new").onclick = openSetup;
  $("loadSetup").onclick = () => $("file").click();
  $("setupDialog").addEventListener("cancel", (e) => { if (setupRequired) e.preventDefault(); });
  $("cancelSetup").onclick = () => $("setupDialog").close();
  $("confirmSetup").onclick = () => {
    try {
      if (setupQaMode() && $("qaPreset").value === "custom" && (selectionCount(qaRewards) > 16 || selectionCount(qaConsumables) > 40)) throw new Error("검증 시작 보상은 총 16장, 소모품은 총 40장까지 지급할 수 있습니다.");
      if (!validateSetupLoadout()) throw new Error("화기를 선택하세요. 기본 화기를 대신한다면 대체 연습 설정을 확인해야 합니다.");
      state = E.create(
        +$("seed").value,
        $("weapon").value,
        +$("face").value,
        setupQaMode() ? null : $("startingItem").value || null,
        $("gun").value,
        $("start").value,
        { campaign: ["campaign", "qa-campaign"].includes($("playMode").value),
          ...(setupQaMode() ? { qa: $("qaPreset").value === "custom" ? { preset: "custom", startRewards: selectionIds(qaRewards), startConsumables: selectionIds(qaConsumables) } : { preset: "fast" } } : {}),
          ...(setupActualMode() && $("gun").value !== (setupWeapon().defaultFirearm || "hunter-pistol") ? { firearmOverride: true } : {}),
          ...($("playMode").value === "practice" && $("practiceTarget").value ? { practiceTarget: $("practiceTarget").value, practiceSide: $("practiceSide").value } : {}),
          ...($("playMode").value === "practice" && practiceRewards.size ? { practiceRewards: [...practiceRewards].flatMap(([id, count]) => Array(count).fill(id)) } : {}),
          ...(!["campaign", "practice", "qa-campaign"].includes($("playMode").value) ? { provisional: $("playMode").value } : {}) },
      );
      resetStoryReading();
      setupRequired = false;
      restoredPrevious = false;
      nextStartSpace = "";
      nextFace = null;
      selectedCard = null;
      selectedSlot = null;
      selectedRewards.clear();
      selectedEnemy = null;
      pulls.clear();
      inventory.clear();
      save();
      render();
      $("setupDialog").close();
    } catch (e) {
      $("setupError").textContent = e.message;
    }
  };
  renderSetupWeapons(true);
  renderPracticeTargets();
  renderPracticeRewards();
  renderQaSetup();
  render();
  if (startupError) showError(startupError);
  else if (!setupRequired) save();
  if (setupRequired) openSetup();
})();
