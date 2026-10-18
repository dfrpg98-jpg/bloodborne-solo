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
  const windows = window.BBHuntWindowManager?.install(document, { onBlocked: () => showError("열린 창을 닫거나 대기 중인 선택을 마치세요.") });
  const entry = window.BBHuntEntry?.parse(window.location?.search || "") || null;
  window.BBGameHelp?.mount($("gameHelpContent"));
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
  // Remove development placeholders from already-public text; preserve cell names.
  const locationText = value => String(value ?? "").replace(/명칭 없는 타일\s*\d+\s*(?:\/\s*)?/g, "").trim();
  const uiText = (text, context = "skill") => {
    const cleaned = window.BBHuntPublicText?.clean(text, context) ?? String(text ?? "");
    return locationText(cleaned).replace(/\b([a-z][a-z0-9-]*)(을|를|이|가|은|는)?/g, (original, id, suffix) => {
      const name = D.consumables?.[id]?.name;
      if (!name) return original;
      const last = name.codePointAt(name.length - 1), hasEnding = last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28;
      const particle = suffix === "을" || suffix === "를" ? hasEnding ? "을" : "를" :
        suffix === "이" || suffix === "가" ? hasEnding ? "이" : "가" : suffix === "은" || suffix === "는" ? hasEnding ? "은" : "는" : suffix || "";
      return name + particle;
    });
  };
  const faceName = (face, index = 0) => uiText(face?.name || "").trim() || (index ? "변형 상태" : "기본 형태");
  function pendingDamageAllocations(effects = []) {
    const first = effects[0];
    if (first?.kind !== "damage" || first.all || first.target === "combat") return 0;
    let count = 0;
    // Only the current matching batch is public progress. Later movement or
    // automatic damage may change targets before another choice is needed.
    for (const effect of effects) {
      if (effect.kind !== "damage" || effect.all || effect.target !== first.target ||
          (effect.range || 0) !== (first.range || 0) || effect.damage !== first.damage) break;
      count++;
    }
    return count;
  }
  const combatFeedback = window.BBHuntCombatFeedback;
  combatFeedback?.installFirearmTooltips?.(document);
  const firearmNameHTML = (gun, context) => combatFeedback?.firearmNameHTML(gun, context,
    rule => uiText(rule, "equipment")) || esc(gun?.name || gun?.id || "화기");
  function polishPlayerText(container = document.body) {
    if (!container || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(container, 4);
    let text;
    while ((text = walker.nextNode())) {
      const parent = text.parentElement;
      // The shared manual is edited as complete instructions, including exact
      // button labels. Term shortcuts must not rewrite it after rendering.
      if (!parent || parent.closest("script,style,textarea,#gameHelpContent")) continue;
      const context = parent.closest("#objectiveDetail,#revealedCards,#storyPanel,#pastChapters,#missionNotices,#storyDialog") ? "mission" :
        parent.closest(".inventory-panel,#startingItemSetup") ? "item" : parent.closest(".rewards-panel") ? "reward" : "skill";
      if (/카드|앞면|뒷면|[AB]\s*면|명칭 없는 타일/.test(text.nodeValue)) text.nodeValue = uiText(text.nodeValue, context);
    }
  }
  const button = (label, type, args = {}, disabled = false, cls = "") =>
    `<button class="${cls}" data-command="${type}" data-args="${esc(JSON.stringify(args))}" ${disabled ? "disabled" : ""}>${label}${actionLossHint({ type, ...args })}</button>`;
  function actionLossHint(command) {
    const notice = window.BBHuntActionLoss?.preview(E, state, command);
    return notice ? `<span class="action-loss-warning">⚠ ${esc(notice.summary)}</span>` : "";
  }
  const commandButton = (option, cls = "") => {
    const { type, ...args } = option.command;
    const held = args.itemId && (E.hunter(state).consumables || []).find(item => item.id === args.itemId),
      item = held && consumableDefinitions()?.[held.kind],
      label = item ? option.label.replace(held.name || held.kind, item.name) : option.label;
    const effect = type === "WEAPON_CHOICE" && state.weaponEffects?.[0],
      target = state.enemies.find(enemy => enemy.id === (args.enemyId || effect?.enemyId || (type === "ENTRY_WEAPON" && state.firearmEntry?.enemyId))),
      targetLabel = target ? effect?.kind === "damage" ? `${enemyTargetLabel(target)} · 피해 ${effect.damage}` : `${label} · 대상: ${enemyTargetLabel(target)}` : label,
      context = ["WEAPON_SHOT", "ENTRY_WEAPON", "WEAPON_CHOICE"].includes(type) ? "skill" : "mission";
    const action = button(esc(uiText(targetLabel, context)), type, args, !!option.disabled, cls);
    return target ? `<div class="enemy-target-choice">${action}${inspectTargetButton(target.id)}</div>` : action;
  };
  const missionView = () => E.missionView ? E.missionView(state) : null;
  const tokenRevival = enemyId => {
    const enemy = state.enemies.find(enemy => enemy.id === enemyId);
    return enemy && combatFeedback?.tokenRevival?.({ enemy, definition: E.enemyDef(state, enemy),
      mission: missionView(), hunterNode: E.hunter(state).position });
  };
  const applyLoadedRuling = (loaded) => {
    const chapel = E.applyChapelRuling ? E.applyChapelRuling(loaded) : loaded;
    const combat = E.applyCombatReactionRuling ? E.applyCombatReactionRuling(chapel) : chapel;
    const tile = E.applyTileSpeedRuling ? E.applyTileSpeedRuling(combat) : combat;
    return E.applyLeapMoveRuling ? E.applyLeapMoveRuling(tile) : tile;
  };
  const isQa = () => !!state.setup?.qa;
  const saveKey = () => isQa() ? qaKey : key;
  const consumableDefinitions = () => E.consumableDefinitions ? E.consumableDefinitions(state) : D.consumables;
  const attackReplacesCardEffects = () => [...selectedRewards].some((id) => E.hunter(state).rewards?.some((r) => r.id === id && r.kind === "rune-clawmark"));
  const nodeName = (id) => uiText(window.BBHuntLocationLabels?.node(state, id, E) || E.node(state, id)?.name || "지도 밖", "location");
  function enemyTargetLabel(value) {
    const enemy = typeof value === "string" ? state.enemies.find(e => e.id === value) : value;
    if (!enemy) return "현재 대상 없음";
    const definition = E.enemyDef(state, enemy);
    const group = state.enemies.filter(e => E.enemyDef(state, e).name === definition.name);
    return definition.name + (group.length > 1 ? `#${group.findIndex(e => e.id === enemy.id) + 1}` : "");
  }
  function inspectTargetButton(enemyId) {
    return `<button type="button" class="target-inspect" data-inspect-target="${esc(enemyId)}" aria-label="${esc(enemyTargetLabel(enemyId))} · 지도에서 확인">지도에서 확인</button>`;
  }
  const tileReference = (placed) => window.BBHuntLocationLabels?.tile(state, placed.tileId, placed)?.reference ||
    (M.tile(placed.tileId)?.named ? M.tile(placed.tileId).displayName : "새 지도 구역");
  const placementOptions = () => E.placementOptions
    ? E.placementOptions(state)
    : M.placementOptions(state.world, state.world.pending.tileId, state.world.pending.anchor);
  let state = E.create(undefined, "burial", 0, null, "hunter-pistol", "center", { campaign: true }),
    selectedCard = null,
    selectedSlot = null,
    selectedEnemy = null,
    mapTarget = null,
    inspectionOpener = null,
    inspectedTile = null,
    movementDirection = null,
    pendingEscort = null,
    escortPromptOpener = null,
    pendingActionLoss = null,
    pendingHunterAction = null,
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
    rewardSelections = new Map(),
    pickerEnemySelections = new Map(),
    enemyStatusOffsets = new Map(),
    nextStartSpace = "",
    nextFace = null,
    returnFaceChoice = null,
    returnFaceState = null,
    weaponBoost = "none",
    reloadSecondCardId = null,
    interactionSelectionKey = null,
    interactionMissionSelected = true,
    restoredPrevious = false,
    startupError = "",
    setupRequired = true;
  const practiceRewards = new Map(), qaRewards = new Map(), qaConsumables = new Map();
  let lastSetupMode = "campaign", importRequest = 0;
  // Reading a story is presentation only. No story field is added to replayed
  // game state or saved commands, including when older saves are resumed.
  const readStories = new Set();
  let storyEntries = [], storySelection = null, storyOpener = null, storyReturnPanel = null;
  // Mission feedback is presentation only: acknowledging it never spends a
  // hand card, advances a turn, or adds commands to a replay save.
  let queuedAttachmentPopup = false;
  let missionUpdates = [], pendingMissionUpdates = [], lastMissionUpdateBatch = [], missionUpdateSequence = 0, missionFocusedObjectiveId = null;
  const missionUpdateLabels = { new: "새로운 임무", updated: "목표 변경", completed: "임무 완수", chapter: "챕터 완수", "enemy-effect": "적 능력 변화" };
  function chapterProgressHTML(progress) {
    if (!progress) return "";
    return `<p class="chapter-progress-caption target-selection-status">보상 → 마지막 꿈에서 성장 → ${progress.final ? "캠페인 기록 보관" : "다음 챕터 준비"}</p><ol class="chapter-progress-steps">${progress.steps.map(step => `<li data-status="${esc(step.status)}"><strong>${esc(step.label)}</strong><span ${step.status === "current" ? "" : "hidden"}>${esc(step.description)}</span></li>`).join("")}</ol>`;
  }
  function missionUpdateHTML(update) {
    return `<article class="mission-update-item" data-kind="${esc(update.kind)}"><p class="mission-update-tag">${esc(missionUpdateLabels[update.kind] || "임무 변화")}</p><h3>${esc(uiText(update.title, "mission"))}</h3><p class="mission-update-objective">${esc(uiText(update.description, "mission"))}</p>${(update.effects || []).map(effect => `<p class="mission-update-context">${esc(uiText(effect, "mission"))}</p>`).join("")}</article>`;
  }
  function recordMissionUpdates(updates) {
    if (!updates.length) return;
    const batch = updates.map(update => ({ ...update, sequence: ++missionUpdateSequence }));
    pendingMissionUpdates.push(...batch);
    missionUpdates.push(...batch);
    const active = [...batch].reverse().find(update => ["new", "updated"].includes(update.kind) && update.objectiveId);
    if (active) missionFocusedObjectiveId = active.objectiveId;
    // The journal is a recent session record; the engine remains the source
    // of the full campaign history when a saved hunt is resumed.
    missionUpdates = missionUpdates.slice(-40);
    lastMissionUpdateBatch = [...pendingMissionUpdates];
  }
  function renderMissionFeedback() {
    const count = pendingMissionUpdates.length, latest = missionUpdates[missionUpdates.length - 1];
    $("openMissionUpdates").hidden = !latest;
    $("openMissionUpdates").dataset.unread = String(count > 0);
    $("openMissionUpdates").setAttribute("aria-label", count ? `미확인 임무 변화 ${count}개 확인` : "최근 임무 변화 다시 확인");
    $("missionUpdateCount").hidden = !count;
    $("missionUpdateCount").textContent = count ? String(count) : "";
    $("missionRecent").hidden = !latest;
    $("missionRecent").textContent = latest ? `${count ? `미확인 ${count}개 · ` : "최근 · "}${missionUpdateLabels[latest.kind]}: ${uiText(latest.title, "mission")}` : "";
    $("missionRecent").dataset.kind = latest?.kind || "";
    $("missionUpdateHistory").innerHTML = missionUpdates.length ? [...missionUpdates].reverse().map(missionUpdateHTML).join("") : '<p class="muted">이 사냥을 이어가는 동안 발생한 임무 변화가 이곳에 기록됩니다.</p>';
  }
  function showMissionUpdates() {
    const batch = pendingMissionUpdates.length ? pendingMissionUpdates : lastMissionUpdateBatch;
    if (!batch.length || setupRequired || $("setupDialog").open || $("deathDialog")?.open) return;
    shell?.close(); historyPopup?.close();
    if ($("storyDialog").open) closeStory();
    const notice = window.BBHuntMissionFeedback?.notice?.(batch, state, { E });
    const completed = batch.every(update => ["completed", "chapter"].includes(update.kind));
    $("missionUpdateEyebrow").textContent = notice?.eyebrow || "사냥의 변화";
    $("missionUpdateTitle").textContent = notice?.title || (batch.length === 1 ? missionUpdateLabels[batch[0].kind] : "임무가 변경되었습니다");
    $("missionUpdateDialog").dataset.kind = notice?.kind || (completed ? "completed" : "new");
    $("missionUpdateSummary").hidden = false;
    $("missionUpdateSummary").textContent = notice?.summary || (E.rewardsView?.(state)?.choices.length
      ? "임무 결과를 확인한 뒤, 행동 패널에서 획득한 보상을 선택하세요."
      : "변경된 목표와 결과를 확인한 뒤 사냥을 계속하세요.");
    $("missionUpdateProgress").innerHTML = chapterProgressHTML(notice?.progress);
    $("missionUpdateContinue").textContent = notice?.progress ? notice.continueLabel : "확인하고 계속하기";
    const ordered = notice?.events || batch;
    $("missionUpdateList").innerHTML = ordered.map(missionUpdateHTML).join("");
    $("missionUpdateDialog").showModal();
    $("missionUpdateContinue").focus?.({ preventScroll: true });
  }
  function acknowledgeMissionUpdates() {
    if (pendingMissionUpdates.length) lastMissionUpdateBatch = [...pendingMissionUpdates];
    pendingMissionUpdates = [];
    if ($("missionUpdateDialog").open) $("missionUpdateDialog").close();
    renderMission();
    $("phaseTitle").setAttribute("tabindex", "-1");
    $("phaseTitle").focus?.({ preventScroll: true });
    if (queuedAttachmentPopup && !$("openAttachments").hidden) {
      queuedAttachmentPopup = false;
      attachmentPopup?.open($("openAttachments"));
    }
  }
  function resetMissionFeedback() {
    queuedAttachmentPopup = false;
    missionUpdates = []; pendingMissionUpdates = []; lastMissionUpdateBatch = []; missionUpdateSequence = 0; missionFocusedObjectiveId = null;
    if ($("missionUpdateDialog").open) $("missionUpdateDialog").close();
  }
  $("openMissionUpdates").onclick = showMissionUpdates;
  $("missionUpdateContinue").onclick = acknowledgeMissionUpdates;
  $("missionUpdateDialog").addEventListener("cancel", event => { event.preventDefault(); acknowledgeMissionUpdates(); });
  function showDeathFeedback(notice) {
    if (!notice || !$("deathDialog")) return;
    shell?.close(); historyPopup?.close();
    if ($("storyDialog").open) closeStory();
    if ($("missionUpdateDialog").open) $("missionUpdateDialog").close();
    $("deathTitle").textContent = notice.title;
    $("deathContinue").textContent = notice.continueLabel;
    $("deathDetails").innerHTML = `<p id="deathSummary" class="death-cause"><span>사망 원인</span><strong>${esc(uiText(notice.summary, "combat"))}</strong></p>${notice.entries.length ? `<ul class="death-damage-list">${notice.entries.map(entry => `<li>${esc(uiText(entry.source, "combat"))}<b>${entry.kind === "health-cost" ? "체력 지불" : "받은 피해"} ${entry.amount}</b></li>`).join("")}</ul><p class="death-damage-total">이번 처리에서 ${[notice.damageTotal > 0 && `받은 피해 ${notice.damageTotal}`, notice.healthCostTotal > 0 && `지불한 체력 ${notice.healthCostTotal}`].filter(Boolean).join(" · ")}</p>` : ""}<p>${esc(notice.consequence)}</p><p class="muted">${esc(notice.footnote)}</p>`;
    $("deathDialog").showModal();
    $("deathContinue").focus?.({ preventScroll: true });
  }
  function acknowledgeDeath() {
    $("deathDialog").close();
    if (pendingMissionUpdates.length) showMissionUpdates();
    else { $("phaseTitle").setAttribute("tabindex", "-1"); $("phaseTitle").focus?.({ preventScroll: true }); }
  }
  $("deathContinue").onclick = acknowledgeDeath;
  $("deathDialog").addEventListener("cancel", event => { event.preventDefault(); acknowledgeDeath(); });
  if (!entry) try {
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
    describeEnemy: enemyTargetLabel,
    describeNode: nodeName,
    inspectEnemy,
    previewEnemy,
    onControlsChange: () => shell?.refresh?.(),
    previewLoss: command => window.BBHuntActionLoss?.preview(E, state, command)?.summary || "",
    refresh: renderDecisions,
  });
  const shell = window.BBHuntShell?.({ document, onCenterMap: () => centerMap(true), onPanelChange: panel => {
    if (!["inventory", "rewards"].includes(panel)) return;
    const box = $(panel === "inventory" ? "itemDetail" : "rewards"), controls = [...box.querySelectorAll("select")],
      remembered = pickerEnemySelections.get(panel),
      rememberedAvailable = remembered && controls.some(el => el.value === remembered || (el.id || el.getAttribute?.("id") || "").endsWith("-" + remembered)),
      select = controls.find(el => /^(itemEnemy|rewardEnemy-)/.test(el.id || el.getAttribute?.("id") || ""));
    if (rememberedAvailable || select?.value) previewEnemy(rememberedAvailable ? remembered : select.value);
  } });
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
      dialog.showModal();
      dialog.scrollTop = 0;
      const body = dialog.querySelector(".compact-dialog-content"); if (body) body.scrollTop = 0;
      close.focus?.({ preventScroll: true });
    } };
  }
  const historyPopup = compactDialog("enemyHistoryDialog", "closeEnemyHistory", () => $("deckStatus").querySelector("[data-enemy-history]")),
    attachmentPopup = compactDialog("attachmentDialog", "closeAttachments", () => $("openAttachments")),
    missionGuidePopup = compactDialog("missionGuideDialog", "closeMissionGuide");
  $("openAttachments").onclick = () => attachmentPopup?.open($("openAttachments"));
  presentation = window.BBHuntPresentation?.({ document, Phaser: window.Phaser,
    viewport: $("mapViewport"), host: $("mapEffects"), characters: { ...window.BBCharacterAssets, ...window.BBWeaponCharacterAssets },
    onReady: () => syncPresentation(), onActorPositions: updateEnemyStatusPositions,
    onActorHitAreas: renderEnemyHitAreas });
  camera = window.BBHuntCamera?.({ document, viewport: $("mapViewport"),
    content: $("chapterMap"), surface: $("mapSurface"), padEdges: true, baseScale: 1.44, onChange: ({ zoom }) => {
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
    if ($("loadDialog")?.open) $("loadEntryError").textContent = message;
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
  const upgradePopup = compactDialog("upgradeDialog", "closeUpgrade");
  function upgradeHTML({ market = true } = {}) {
    const helper = window.BBHuntUpgradeOverview;
    return helper ? helper.renderHTML(helper.view(state, E), { clean: text => uiText(text), market }) : "";
  }
  (document.querySelectorAll?.("[data-upgrade-overview]") || []).forEach(button => button.onclick = () => {
    $("upgradeOverview").innerHTML = upgradeHTML();
    upgradePopup?.open(button);
  });
  function send(type, args = {}) {
    return sendCommands([{ type, ...args }]);
  }
  function closeEscortPrompt() {
    pendingEscort = null;
    if ($("escortDialog").open) $("escortDialog").close();
  }
  function answerEscort(accept) {
    const pending = pendingEscort;
    if (!pending) return;
    closeEscortPrompt();
    if (pending.sourceState !== state || pending.sourceRevision !== state.revision) {
      showError("진행 상태가 변경되었습니다. 이동할 칸을 다시 선택하세요.");
      return;
    }
    requestLossOrCommit(accept ? pending.acceptCommands : pending.declineCommands);
  }
  $("escortAccept").onclick = () => answerEscort(true);
  $("escortDecline").onclick = () => answerEscort(false);
  $("escortCancel").onclick = closeEscortPrompt;
  $("escortDialog").addEventListener("cancel", event => { event.preventDefault(); closeEscortPrompt(); });
  $("escortDialog").addEventListener("close", () => {
    pendingEscort = null;
    const opener = escortPromptOpener; escortPromptOpener = null;
    if (opener?.isConnected !== false) opener?.focus?.({ preventScroll: true });
  });
  function sendCommands(commands) {
    if (windows && !windows.canExecute(commands)) return false;
    if ($("missionUpdateDialog").open || $("deathDialog").open) return false;
    if ($("attachmentDialog").open && commands.some(command => command.type !== "REASSIGN_REWARD")) return false;
    if (pendingEscort || pendingActionLoss) return false;
    const decision = window.BBHuntDeparture?.plan(E, state, commands);
    if (!decision) return requestLossOrCommit(commands);
    pendingEscort = { ...decision, sourceState: state };
    escortPromptOpener = document.activeElement;
    $("escortPromptTitle").textContent = decision.title;
    $("escortPromptDescription").textContent = `${uiText(decision.name, "mission")}와 함께 이동할지 선택하세요. 동행에는 추가 비용이 없습니다.`;
    shell?.close();
    $("escortDialog").showModal();
    $("escortAccept").focus?.({ preventScroll: true });
    showError("");
    return false;
  }
  function cancelActionLoss() {
    const pending = pendingActionLoss;
    pendingActionLoss = null;
    if ($("actionLossDialog").open) $("actionLossDialog").close();
    if (pending?.returnPanel) shell?.open(pending.returnPanel, pending.opener);
    pending?.opener?.focus?.({ preventScroll: true });
  }
  function requestLossOrCommit(commands) {
    const notice = window.BBHuntActionLoss?.plan(E, state, commands);
    if (!notice) return commitCommands(commands);
    pendingActionLoss = { ...notice, sourceState: state, returnPanel: shell?.activePanel(), opener: document.activeElement };
    $("actionLossTitle").textContent = notice.title;
    $("actionLossSummary").textContent = notice.summary;
    $("actionLossDescription").textContent = notice.description;
    $("actionLossList").innerHTML = notice.losses.map(loss => `<li>${esc(loss.description)}</li>`).join("");
    shell?.close();
    $("actionLossDialog").showModal();
    $("actionLossCancel").focus?.({ preventScroll: true });
    return false;
  }
  $("actionLossCancel").onclick = cancelActionLoss;
  $("actionLossDialog").addEventListener("cancel", event => { event.preventDefault(); cancelActionLoss(); });
  $("actionLossAccept").onclick = () => {
    const pending = pendingActionLoss;
    if (!pending) return;
    pendingActionLoss = null;
    $("actionLossDialog").close();
    if (pending.sourceState !== state || pending.sourceRevision !== state.revision) {
      showError("진행 상태가 변경되었습니다. 이동을 다시 선택하세요.");
      return;
    }
    commitCommands(pending.commands);
  };
  function commitCommands(commands) {
    if (windows && !windows.canExecute(commands)) return false;
    const previousDeclaredVisual = declaredWeaponVisual;
    try {
      const previous = state, before = animationSnapshot(), last = commands[commands.length - 1], type = last.type;
      // Validate the entire convenience action before committing its original
      // commands. Costs, event order and replay data still belong to the engine.
      let next = state, observedSteps = [];
      for (const command of commands) {
        const blocked = window.BBHuntActionAvailability?.blockedReason(next, E, command);
        if (blocked) throw new Error(blocked);
        const prior = next;
        if (command.type === "MOVE" && E.applyMovementDeclarationRuling) next = E.applyMovementDeclarationRuling(next);
        next = E.dispatch(next, command);
        currentAttackVisual(next, prior);
        observedSteps.push([prior, next]);
      }
      for (let count = 0; count < 12; count++) {
        const automatic = window.BBHuntAutomaticCombat?.nextCommand(next, E);
        if (!automatic) break;
        const prior = next;
        next = E.dispatch(next, automatic);
        observedSteps.push([prior, next]);
        commands = [...commands, automatic];
      }
      const observedUpdates = observedSteps.flatMap(([prior, following]) => window.BBHuntMissionFeedback?.describe(prior, following,
        { E, publicText: window.BBHuntPublicText, data: window.BBLongHunt }) || []);
      const deathNotice = observedSteps.map(([prior, following]) => window.BBHuntDeathFeedback?.describe(prior, following)).find(Boolean);
      const tileAdopted = E.applyTileSpeedRuling ? E.applyTileSpeedRuling(next) : next;
      state = E.applyLeapMoveRuling ? E.applyLeapMoveRuling(tileAdopted) : tileAdopted;
      const updates = window.BBHuntMissionFeedback?.reconcileTileSpeedAdoption?.(observedUpdates, next, state, { E }) || observedUpdates;
      recordMissionUpdates(updates);
      for (const [prior, following] of observedSteps) enemyHistory.observe(prior, following);
      presentationActions = window.BBHuntAnimationEvents?.describe(before, animationSnapshot(), commands) || [];
      needsCameraFollow = E.hunter(previous).position !== E.hunter(state).position ||
        previous.world.pending?.tileId !== state.world.pending?.tileId || previous.mission?.chapter !== state.mission?.chapter;
      mapTarget = null;
      pendingHunterAction = null;
      shell?.close();
      shell?.showProgress?.();
      if (type === "START_NEXT_CHAPTER") { nextStartSpace = ""; nextFace = null; }
      if (type === "ENTER_BETWEEN_CHAPTERS") { nextStartSpace = ""; nextFace = E.hunter(state).face; }
      pulls.clear();
      selectedRewards.clear();
      rewardSelections.clear();
      pickerEnemySelections.clear();
      reloadSecondCardId = null;
      weaponBoost = "none";
      inventory.clear();
      save();
      render();
      showError("");
      const attachmentTiming = (type === "TRANSFORM" || type === "FREE_TRANSFORM" && last.accept ||
        ["RETURN", "START_NEXT_CHAPTER"].includes(type) && last.reassignAttachments || type === "EQUIP_REWARD") &&
        !$("openAttachments").hidden;
      queuedAttachmentPopup = !!attachmentTiming;
      if (deathNotice) showDeathFeedback(deathNotice);
      else if (updates.length) showMissionUpdates();
      else if (queuedAttachmentPopup) {
        queuedAttachmentPopup = false;
        attachmentPopup?.open($("openAttachments"));
      }
      return true;
    } catch (e) {
      declaredWeaponVisual = previousDeclaredVisual;
      showError(e.message);
      return false;
    }
  }
  function bind(box) {
    box.querySelectorAll("[data-inspect-target]").forEach(b => b.onclick = () => inspectEnemy(b.dataset.inspectTarget));
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
      `<p class="eyebrow">사냥꾼</p><h2>체력 ${h.hp} / 6 <small>· 피의 유지 ${h.echoes} / 3</small></h2><p class="status-location">${h.inDream ? "사냥꾼의 꿈" : esc(nodeName(h.position))}</p>${h.status.poison || h.status.frenzy ? `<p class="hunter-status-chips">${h.status.poison ? "<span class=\"status-chip poison\">독</span>" : ""}${h.status.frenzy ? "<span class=\"status-chip frenzy\">발광</span>" : ""}</p>` : ""}`;
    renderFirearm();
    if ($("upgradeDialog")?.open) $("upgradeOverview").innerHTML = upgradeHTML();
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
    if (!h.firearmReady) {
      const cost = actual ? gun.prepareCost || 1 : 1,
        chosen = h.hand.find(card => card.id === selectedCard),
        second = h.hand.find(card => card.id === reloadSecondCardId && card.id !== selectedCard),
        allowed = state.phase === "hunter" && !E.rewardsView?.(state)?.choices.length,
        args = actual ? { cardIds: cost === 1 ? [selectedCard] : [selectedCard, second?.id || null] } : { cardId: selectedCard };
      return (cost > 1 ? `<label>함께 버릴 카드<select id="firearmReloadSecond"><option value="">선택하세요</option>${h.hand.filter(card => card.id !== selectedCard).map(card => `<option value="${esc(card.id)}" ${second?.id === card.id ? "selected" : ""}>${esc(E.card(card).name)}</option>`).join("")}</select></label>` : "") +
        button(`화기 다시 준비 · 손패 ${cost}장`, "RELOAD", args, !allowed || !chosen || cost > 1 && !second) +
        (actual && gun.prepareEchoCost ? button(`피의 유지 ${gun.prepareEchoCost}개로 준비`, "RELOAD", { payEcho: true, cardIds: [] }, !allowed || h.echoes < gun.prepareEchoCost) : "");
    }
    if (actual && gun.trigger === "enemy-enters") return "";
    const attack = actual && gun.trigger === "hunter-turn", effect = actual && gun.trigger === "hunter-effect",
      targetId = attack && state.phase === "combat_choose" ? state.combat?.enemyId : selectedEnemy,
      target = state.enemies.find((e) => e.id === targetId),
      attackRewardIds = state.setup.rulesVersion >= 11 ? [...selectedRewards] : [],
      statReplacement = attack && attackRewardIds.some((id) => h.rewards?.some((r) => r.id === id && r.kind === "rune-clawmark")),
      redundant = window.BBHuntActionAvailability?.blockedReason(state, E, { type: "FIREARM" }),
      allowed = !redundant && E.canFirearm(state) && !E.rewardsView?.(state)?.choices?.length && !statReplacement && (!(attack || effect) || target?.node === h.position) && (!effect || target && !E.enemyDef(state, target).boss);
    if (attack && !["hunter", "combat_choose"].includes(state.phase)) return "";
    if (effect && state.phase !== "hunter") return "";
    const label = redundant ? "회피 완료 · 화기 소모 불필요" : attack ? state.phase === "combat_choose" ? `${gun.name}로 맞서 공격` : `${gun.name} 공격 · 선택한 적`
      : effect ? `${gun.name} · 선택한 적에게 피해 및 이동` : actual && gun.trigger === "enemy-attack" ? "적 공격 속도 -1 · 모든 공격 효과 제거" : "화기 사용 · 기본 공격 방해";
    const args = attack || effect ? { enemyId: target?.id || null } : {},
      boostCode = state.setup.rulesVersion >= 10 ? E.weaponFace(state).effect?.code : null;
    if (attack && attackRewardIds.length) args.rewardIds = attackRewardIds;
    if (attack && boostCode === "attack_sacrifice_damage") args.weaponBoost = weaponBoost === "none" ? 0 : +weaponBoost;
    if (attack && boostCode === "attack_sacrifice_speed_or_damage") args.weaponBoost = ["speed", "damage"].includes(weaponBoost) ? weaponBoost : "none";
    return ((attack || effect) && target ? `<p class="target-selection-summary">대상: ${esc(enemyTargetLabel(target))}</p>` : "") + button(label, "FIREARM", args, !allowed) + (statReplacement ? '<p class="muted">손톱자국은 스탯 카드 공격에만 사용합니다. 선택을 해제하면 화기로 공격할 수 있습니다.</p>' : "");
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
    $("firearm").innerHTML = `<p class="eyebrow">장착 화기</p><h2>${firearmNameHTML(gun, "equipped")} <small class="${h.firearmReady ? "ready" : "spent"}">${h.firearmReady ? "준비됨" : "소진됨"}</small></h2><section class="firearm-rules" aria-label="화기 효과와 준비"><h3>화기 효과와 준비</h3><p>${printed}</p>${preparation}</section>${firearmAction()}`;
    bind($("firearm"));
    if ($("firearmReloadSecond")) $("firearmReloadSecond").onchange = () => {
      reloadSecondCardId = $("firearmReloadSecond").value || null; renderFirearm();
    };
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
    const progress = window.BBHuntMissionFeedback?.chapterProgress?.(state, { E });
    $("chapterProgress").hidden = !progress;
    $("chapterProgress").innerHTML = progress ? `<h3>챕터 ${progress.chapter} 완수</h3>${chapterProgressHTML(progress)}<p>${esc(progress.summary)}</p>` : "";
    $("missionPanel").hidden = !view;
    renderMissionFeedback();
    renderStories(view && !provisional ? view : null);
    $("modeLabel").textContent = view ? `${isQa() ? "검증 전용 · " : ""}기나긴 사냥 · 챕터 ${chapter}` : "실제 지도 · 전투 연습";
    $("qaModeBadge").hidden = !isQa();
    document.title = view ? `블러드본 · ${isQa() ? "검증 전용 · " : ""}기나긴 사냥 챕터 ${chapter}` : "블러드본 · 사냥 연습";
    $("modeNotice").innerHTML = view
      ? `<strong>기나긴 사냥 · 챕터 ${chapter}${view.won ? " 완수" : ""}</strong><span>${view.won ? chapter === 3 ? "기나긴 사냥의 마지막 사냥을 완수했습니다. 마지막 꿈에서 성장을 마치고 전체 캠페인 기록을 보관하세요." : state.phase === "between_chapters" ? `장비를 교체하고 중앙 등불 타일의 시작 칸을 골라 챕터 ${chapter + 1} 시작을 준비하세요.` : "사냥을 완수했습니다. 마지막 꿈에서 성장을 마친 뒤 다음 챕터를 준비할 수 있습니다." : "공개된 임무를 따라 사냥을 진행하세요. 챕터 사이에는 보관한 장비를 교체하고 다음 사냥의 시작 칸을 선택합니다."}</span>`
      : "<strong>실제 지도 전투 연습</strong><span>이 사냥은 임무 없이 탐험·전투·꿈의 업그레이드를 연습하는 모드입니다. 새 사냥에서 기나긴 사냥 챕터 1을 선택할 수 있습니다.</span>";
    if (provisional) {
      $("modeLabel").textContent = `임시 구성물 시험 · ${provisional.name}`;
      $("modeNotice").innerHTML = `<strong>${esc(provisional.name)}${state.result === "provisional-win" ? " · 시험 완료" : provisional.npc ? " · 상호작용" : provisional.phase ? ` · ${esc(provisional.phase)}페이즈` : ""}</strong><span>${esc(provisional.notice)} 이 시험은 기나긴 사냥 캠페인과 별도로 진행하며 임시 작성된 구성물을 사용합니다.</span>`;
    }
    if (isQa()) $("modeNotice").innerHTML = $("modeNotice").innerHTML
      .replace("<strong>기나긴 사냥", "<strong>검증 전용 · 기나긴 사냥")
      .replace("</span>", " 테스트 장비와 시작 지급을 사용하며, 일반 사냥과 별도로 자동 저장됩니다.</span>");
    if (!view) {
      // Mission controls and journal details also live outside the hidden HUD.
      for (const id of ["missionActions", "objectiveDetail", "chapterConditionDetail", "missionNotices", "revealedCards", "pastChapters",
        "missionInsight", "missionObjectives", "chapterConditions", "chapterSpecialRules", "missionTokens", "missionFog"]) $(id).innerHTML = "";
      $("chapterSpecialRules").hidden = true;
      $("missionHistory").hidden = true;
      $("missionFog").hidden = true;
      return;
    }
    $("missionInsight").textContent = `이번 챕터 완료 계몽 ${view.insight}장`;
    const publicChapter = window.BBHuntPublicText.chapter(state, view, window.BBLongHunt),
      objectives = publicChapter?.objectives || view.objectives.filter((o) => o.status !== "미발견"),
      doneStatus = (o) => ["completed", "complete", "done", "완료"].includes(o.status),
      objectiveHTML = (o) => {
        const done = doneStatus(o), description = chapter === 1 && o.id === "main" && !view.revealed.includes(2)
          ? "계몽 2장 이상을 모은 뒤 중앙 등불 타일에서 이동을 마치세요." : o.description,
          update = [...pendingMissionUpdates].reverse().find(entry => entry.objectiveId === o.id),
          marker = update ? update.kind === "completed" || update.kind === "chapter" ? "completed" : update.kind === "updated" ? "updated" : "new" : "";
        const insightProgress = chapter === 1 && o.id === "main" && !view.revealed.includes(2)
          ? `<div class="objective-progress"><span>계몽 <b>${view.insight} / 2</b></span><div class="objective-meter" role="progressbar" aria-label="이번 챕터 계몽" aria-valuemin="0" aria-valuemax="2" aria-valuenow="${Math.min(2, view.insight)}"><i style="width:${Math.min(100, view.insight * 50)}%"></i></div></div>` : "";
        return `<article class="mission-objective ${done ? "completed" : ""}${update ? " changed" : ""}" data-objective-kind="${esc(o.kind || (o.id === "main" ? "required" : "insight"))}"${marker ? ` data-mission-change="${marker}"` : ""}><div class="objective-heading"><div class="objective-meta"><small class="objective-category">${esc(o.categoryLabel || (o.id === "main" ? "필수 목표" : "계몽 선택 임무"))}</small><small class="objective-status">${esc(o.status)}${update ? ` · ${esc(missionUpdateLabels[update.kind])}` : ""}</small></div><b>${done ? "✓ " : ""}${esc(uiText(o.title, "mission"))}</b>${o.guidance?.length ? `<button type="button" data-mission-guide="${esc(o.id)}">획득·유인 방법</button>` : ""}</div><span class="muted">${esc(window.BBHuntPublicText.sentence(description || ""))}</span>${insightProgress}${o.reward ? `<small class="objective-reward">${esc(o.reward.text)}</small>` : ""}</article>`;
      },
      latestChanged = [...pendingMissionUpdates].reverse().map(update => objectives.find(o => o.id === update.objectiveId && o.id !== "main")).find(Boolean),
      primary = latestChanged || objectives.find(o => o.id === missionFocusedObjectiveId && !doneStatus(o)) || objectives.find((o) => !doneStatus(o)) || objectives[0],
      allObjectives = objectives.length ? `<section class="objective-group"><h3>필수 목표</h3>${objectives.filter(o => o.kind === "required" || o.id === "main").map(objectiveHTML).join("")}</section><section class="objective-group"><h3>계몽 선택 임무</h3><p class="muted">${esc(publicChapter?.insightChoiceDescription || "필수 목표에서 요구하는 계몽 개수를 확인하고 원하는 임무를 선택하세요.")}</p>${objectives.filter(o => o.kind === "insight" || o.id !== "main").map(objectiveHTML).join("") || '<p class="muted">아직 공개된 선택 임무가 없습니다.</p>'}</section>` : '<p class="muted">공개된 임무 기록을 확인하세요.</p>';
    const main = publicChapter?.main || objectives.find(o => o.id === "main") || primary;
    $("missionObjectives").innerHTML = main ? objectiveHTML(main) + (primary && primary.id !== main.id ? `<div class="secondary-objective">${objectiveHTML(primary)}</div>` : "") : allObjectives;
    const activations = publicChapter?.activations || [], nextPlaces = activations.filter(trigger => !trigger.known);
    $("chapterConditions").innerHTML = `<span class="condition-label">계몽 단서</span>${nextPlaces.length ? `<div class="mission-places">${nextPlaces.map(trigger => `<span class="mission-place">${esc(trigger.title)}</span>`).join("")}</div><span class="condition-action">이 타일에서 이동을 마치면 단서가 공개됩니다.</span>` : '<span class="condition-action">공개된 선택 임무에서 계몽을 얻으세요.</span>'}`;
    const specialRules = window.BBHuntMissionHUD?.specialRules?.(view) || [];
    $("chapterSpecialRules").hidden = !specialRules.length;
    $("chapterSpecialRules").innerHTML = specialRules.length ? `<h3>챕터 특수 규칙</h3>${specialRules.map(rule => rule.scope === "setup"
      ? `<details class="chapter-special-rule setup-rule"><summary>${esc(rule.title)}</summary><p>${esc(rule.text)}</p></details>`
      : `<div class="chapter-special-rule"><b>${esc(rule.title)}</b><p>${esc(rule.text)}</p></div>`).join("")}` : "";
    $("chapterConditionDetail").innerHTML = `<h3>챕터 ${chapter} · 계몽 단서를 확인하는 조건</h3>${activations.map(trigger => `<p>${trigger.known ? "✓ " : ""}${esc(trigger.description)}${trigger.known ? " 이미 조사한 장소입니다." : ""}</p>`).join("")}`;
    if ($("objectiveDetail")) $("objectiveDetail").innerHTML = allObjectives;
    const hud = window.BBHuntMissionHUD?.view(view) || view;
    $("missionTokens").innerHTML = hud.tokens.map((t) => `<span class="mission-token">◆ ${esc(t.name)} · ${t.carrierId !== null && t.carrierId !== undefined ? "사냥꾼이 운반 중" : esc(nodeName(t.node))}</span>`).join("") + (hud.targets || []).map((t) => `<span class="mission-token">◇ ${esc(window.BBLongHunt.cards.find((c) => c.number === t.card)?.title || "특수 적")} · 계몽 토큰 ${t.tokens}개</span>`).join("") + (hud.counters || []).map((c) => `<span class="mission-token">${esc(c.name)} · ${c.id === "card-57" ? `남은 임무 토큰 ${esc(c.value)}개` : esc(c.value)}</span>`).join("");
    const lifecycleNotices = chapter > 1
      ? ["이전 챕터의 미완료 임무·임무 토큰·대상 적은 초기화되었습니다. 완료한 계몽 기록은 보관하며, 이번 챕터의 계몽 획득 수에는 더하지 않습니다."] : [];
    if (chapter === 3 && view.revealed.includes(53) && view.revealed.includes(35))
      lifecycleNotices.push("대교에서 발견한 사건으로 새로운 구조 임무가 시작되었습니다. 이후 진행은 현재 공개된 임무의 지시를 따르세요.");
    $("missionNotices").innerHTML = [...lifecycleNotices, ...(view.notices || [])].map((notice) => `<p>${esc(uiText(notice, "mission"))}</p>`).join("");
    const history = view.history || state.mission?.history || [];
    $("missionHistory").hidden = !history.length;
    $("pastChapters").innerHTML = history.map((ch) => `<section><p>✓ 챕터 ${ch.chapter} 완수 · 완료 임무 ${storyEntries.filter(entry => entry.chapter === ch.chapter && ch.completed?.includes(entry.number)).map(entry => esc(entry.title)).join(", ") || "없음"}</p><div class="story-list">${storyEntries.filter((entry) => entry.chapter === ch.chapter).map(storyButton).join("")}</div></section>`).join("");
    bindStoryButtons($("pastChapters"));
    $("missionFog").textContent = "";
    $("missionFog").hidden = true;
    const actions = view.pending || state.rewardChoices?.length ? [] : (E.missionActions ? E.missionActions(state) : [])
      .filter(action => action.command.type !== "MISSION_PICKUP");
    $("missionActions").innerHTML = actions.map((a) => commandButton(a)).join("");
    bind($("missionActions"));
    for (const container of [$("missionObjectives"), $("objectiveDetail"), $("chapterConditionDetail")])
      container?.querySelectorAll("[data-mission-guide]").forEach(button => button.onclick = () => openMissionGuide(button.dataset.missionGuide, button));
    $("revealedCards").innerHTML = view.revealed.map((number) => {
      const card = window.BBLongHunt.cards.find((c) => c.number === number);
      if (!card) return "";
      const completed = view.completed.includes(number), discarded = view.discarded?.includes(number);
      const publicEntry = window.BBHuntPublicText.entry(card, state, { data: window.BBLongHunt, chapter });
      if (!publicEntry) return "";
      return `<article class="revealed-card ${completed || discarded ? "completed" : ""}"><p class="eyebrow">${esc(publicEntry.type)}${discarded ? " · 효과 종료" : completed ? " · 완료" : ""}</p><h3>${esc(publicEntry.title)}</h3>${discarded ? '<p class="muted">이 임무의 효과는 종료되었습니다. 아래 문구는 공개된 기록입니다.</p>' : ""}${publicEntry.rules.map((r) => `<p>${esc(r)}</p>`).join("")}</article>`;
    }).join("");
  }
  function openMissionGuide(id, opener) {
    const chapter = window.BBHuntPublicText.chapter(state, missionView(), window.BBLongHunt),
      objective = chapter?.objectives.find(objective => objective.id === id);
    if (!objective?.guidance?.length) return;
    const actions = state.rewardChoices?.length || missionView()?.pending ? [] : (E.missionActions?.(state) || [])
      .filter(action => objective.actionTypes.includes(action.command.type));
    $("missionGuideTitle").textContent = `${objective.title} · 진행 방법`;
    $("missionGuideContent").innerHTML = `<ol>${objective.guidance.map(text => `<li>${esc(text)}</li>`).join("")}</ol><h3>지금 가능한 행동</h3>${actions.length ? actions.map(action => commandButton(action)).join("") : '<p class="muted">플레이어의 차례에 필요한 소모품과 위치를 갖추면 유인·바치기 행동이 여기에 표시됩니다. 대기 중인 보상·전투 선택을 먼저 마치세요.</p>'}`;
    $("missionGuideContent").querySelectorAll("[data-command]").forEach(button => button.onclick = () => {
      missionGuidePopup?.close(); send(button.dataset.command, JSON.parse(button.dataset.args || "{}"));
    });
    missionGuidePopup?.open(opener);
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
      if ($("storyPendingBadge")) { $("storyPendingBadge").textContent = ""; $("storyPendingBadge").hidden = true; }
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
    $("closeStory").textContent = ({ journal: "일지로 돌아가기", help: "메뉴로 돌아가기", guide: "도움말로 돌아가기", rewards: "장비·보상으로 돌아가기", inventory: "소모품으로 돌아가기", enemies: "적 도감으로 돌아가기" })[storyReturnPanel] || (setupRequired ? "사냥 준비로 돌아가기" : "사냥으로 돌아가기");
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
    $("storyDialog").showModal();
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
    closeEscortPrompt();
    pendingActionLoss = null;
    if ($("actionLossDialog").open) $("actionLossDialog").close();
    resetMissionFeedback();
    // Map selections belong to the old hunt, even when node or figure IDs recur.
    inspectionOpener = null;
    mapTarget = null;
    selectedEnemy = null;
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
          opts = (targets) => targets.map((t) => `<option value="${esc(t.enemyId)}">${esc(enemyTargetLabel(t.enemyId))}</option>`).join(""),
          destinations = (target) => (target.destinations || []).map((n) => `<option value="${esc(n.node)}">${esc(nodeName(n.node))}</option>`).join("");
        if (control.type === "enemies-destinations")
          actions = `<p class="muted">모든 적 · 목적지 각각 선택</p>` + control.targets.map((t) => `<div class="enemy-target-row"><label>${esc(enemyTargetLabel(t.enemyId))}<select id="rewardMove-${r.id}-${t.enemyId}">${destinations(t)}</select></label></div>`).join("");
        else if (control.type === "echo-option")
          actions = `<label class="checkrow"><input id="rewardEcho-${r.id}" type="checkbox" ${control.available ? "" : "disabled"}>피의 유지 1개를 소모하여 추가 치유 2</label>`;
        else if (control.type === "slot")
          actions = `<label>비울 공격 슬롯<select id="rewardSlot-${r.id}">${control.slots.map((slot) => `<option value="${slot.slot}">${esc(slot.name || (slot.slot + 1) + "번 슬롯")} · ${slot.occupied ? "카드 있음" : "비어 있음"}</option>`).join("")}</select></label>`;
        else if (control.type === "lamp")
          actions = `<label>이동할 등불<select id="rewardLamp-${r.id}" ${control.targets.length ? "" : "disabled"}>${control.targets.map((n) => `<option value="${esc(n.node)}">${esc(uiText(n.name, "location"))}</option>`).join("")}</select></label>`;
        else {
          actions = `<label>대상 적<select id="rewardEnemy-${r.id}">${opts(control.targets)}</select></label>`;
          if (control.type === "enemy-destination") actions += `<label>이동 목적지<select id="rewardNode-${r.id}"></select></label>`;
          actions += `<div id="rewardTarget-${r.id}" class="target-selection-status" aria-live="polite"></div><div id="rewardInspect-${r.id}"></div>`;
        }
        actions += `<button data-reward-use="${r.id}" ${r.usable && !pending ? "" : "disabled"}>${esc(r.name)} 사용${actionLossHint({ type: "USE_REWARD", rewardId: r.id })}</button>`;
      } else if (r.kind === "lantern" && r.equipped) {
        actions = `<label>이동할 등불<select id="rewardLamp-${r.id}">${E.nodes(state).filter((n) => n.lamp).map((n) => `<option value="${n.id}">${esc(uiText(n.name, "location"))}</option>`).join("")}</select></label><button data-reward-use="${r.id}" data-reward-kind="lantern" ${r.usable && !pending ? "" : "disabled"}>등불 사용${actionLossHint({ type: "USE_REWARD", rewardId: r.id })}</button>`;
      } else if (r.kind === "rune-eye" && r.equipped) {
        const cards = (list) => list.map((c) => `<option value="${c.id}">${esc(E.card(c).name)} · ${esc(c.id)}</option>`).join("");
        actions = `<label>버릴 손패<select id="rewardDiscard-${r.id}">${cards(h.hand)}</select></label><label>가져올 버림 카드<select id="rewardTake-${r.id}">${cards(h.discard)}</select></label><button data-reward-use="${r.id}" data-reward-kind="rune-eye" ${r.usable && h.hand.length && h.discard.length && !pending ? "" : "disabled"}>선택한 카드 교환</button>`;
      } else if (r.kind === "rune-rapture" && r.equipped) {
        actions = button("피의 기쁨 · 손패 1장 뽑기 · 체력 1 회복", "USE_REWARD", { rewardId: r.id }, !r.usable || pending);
        if (r.usable) actions = `<p class="muted">${state.killReaction
          ? '다른 처치 문자도 사용할 수 있습니다. 처치 효과 사용 마치기를 누르면 이 처치의 사용 기회가 끝납니다.'
          : '지금 사용하거나 다른 행동을 하면 이 처치의 사용 기회가 끝납니다.'}</p>` + actions;
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
      return `<article class="reward-card"><p class="eyebrow">${r.subtype === "rune" ? "카릴 문자" : r.subtype === "quest" ? "임무 물품" : "사냥 도구"}</p><h3>${esc(r.name)}</h3><p class="reward-state ${!r.ready ? "spent" : ""}">${status}${r.triggerArmed ? " · 다음 죽음에 사용 선택됨" : ""}${r.limitUsed ? " · 이번 챕터 사용 완료" : ""}</p><p>${esc(uiText(r.rules, "reward"))}</p>${r.disabledReason || r.runtimeNote ? `<p class="reward-unavailable">${esc(r.disabledReason || r.runtimeNote)}</p>` : ""}${actions ? `<div class="reward-actions">${actions}</div>` : ""}</article>`;
    }).join("") || `<p class="muted">${missionView() ? "보상은 임무를 완료하면 획득합니다." : "획득한 보상이 없습니다. 새 사냥의 전투 연습에서 시작 보상을 선택해 효과를 확인할 수 있습니다."}</p>`;
    const owned = view.firearms.filter((g) => !g.equipped);
    if (owned.length) $("rewards").innerHTML += `<article class="reward-card"><p class="eyebrow">보관한 화기</p>${owned.map((g) => `<p>${firearmNameHTML(g, "stored")}</p>${between ? button("이 화기 장착", "EQUIP_FIREARM", { firearmId: g.id }, pending) : ""}`).join("")}<p class="muted">화기는 획득할 때 또는 챕터 사이에 교체합니다.</p></article>`;
    bind($("rewards"));
    bindRewardAttack($("rewards"));
    view.rewards.filter(r => r.equipped && r.controls).forEach(r => {
      const control = r.controls;
      if (control.type === "enemies-destinations") {
        for (const target of control.targets) {
          const key = "rewardMove-" + r.id + "-" + target.enemyId, select = $(key), saved = rewardSelections.get(key);
          if (target.destinations.some(n => n.node === saved)) select.value = saved;
          select.onchange = () => { rewardSelections.set(key, select.value); previewEnemy(target.enemyId); };
        }
        return;
      }
      if (!["enemy", "enemy-destination"].includes(control.type)) return;
      const select = $("rewardEnemy-" + r.id), destination = $("rewardNode-" + r.id),
        saved = rewardSelections.get("enemy:" + r.id),
        targetChanged = saved && !control.targets.some(t => t.enemyId === saved);
      select.value = control.targets.some(t => t.enemyId === saved) ? saved : control.targets[0]?.enemyId || "";
      const update = () => {
        const target = control.targets.find(t => t.enemyId === select.value);
        rewardSelections.set("enemy:" + r.id, select.value);
        if (destination) {
          const key = "node:" + r.id + ":" + select.value, remembered = rewardSelections.get(key);
          destination.innerHTML = (target?.destinations || []).map(n => `<option value="${esc(n.node)}">${esc(nodeName(n.node))}</option>`).join("");
          destination.value = target?.destinations?.some(n => n.node === remembered) ? remembered : target?.destinations?.[0]?.node || "";
          destination.onchange = () => rewardSelections.set(key, destination.value);
        }
        $("rewardTarget-" + r.id).textContent = target ? `선택한 대상: ${enemyTargetLabel(target.enemyId)}` : "선택 가능한 대상이 없습니다.";

      };
      select.onchange = () => { update(); if (select.value) previewEnemy(select.value); };
      update();
      if (targetChanged) $("rewardTarget-" + r.id).textContent += " · 이전 대상은 현재 선택할 수 없어 대상을 변경했습니다. 확인 후 사용하세요.";
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
      return `<div class="reward-pending"><h3>${firearmNameHTML(g || { id: choice.firearmId }, "acquired")} 획득</h3><p>장착하거나 보관하세요.</p><div class="actions">${button("화기 장착", "EQUIP_FIREARM", { firearmId: choice.firearmId }, false, "primary")}${button("화기 보관", "KEEP_FIREARM", { firearmId: choice.firearmId })}</div></div>`;
    }
    const r = view.rewards.find((r) => r.id === choice.rewardId);
    if (!r) return "";
    const current = view.rewards.filter((x) => x.equipped && x.subtype === r.subtype),
      replace = current.length >= 2 ? current : [null];
    const opts = replace.flatMap((old) => (r.persistent ? E.slots(state).map((_, i) => i) : [null]).map((slot) => {
      const args = { rewardId: r.id };
      if (old) args.replaceId = old.id;
      if (slot !== null) args.slot = slot;
      const slotFact = slot !== null && window.BBHuntCombatControls?.slotFacts(state, E)[slot],
        label = slotFact ? window.BBHuntCombatControls.attachmentOptionHTML(slotFact, r,
          { clean: text => uiText(text, "combat"), placement: true, replaceId: old?.id }) : `${slot !== null ? (slot + 1) + "번 슬롯에 " : ""}장착`;
      return button(`${old ? esc(old.name) + "을 보관하고 " : ""}${label}`, "EQUIP_REWARD", args, false, slotFact ? "attachment-slot-option" : "primary");
    })).join("");
    const description = r.persistent ? `<p class="attachment-choice-hint">장착할 공격을 선택하세요.</p>` : `<p>${esc(uiText(r.rules, "reward"))}</p><p class="muted">사냥 도구와 카릴 문자는 각각 2장까지 장착합니다. 보관한 카드는 챕터 사이에 교체할 수 있습니다.</p>`;
    return `<div class="reward-pending ${r.persistent ? "attachment-pending" : ""}"><h3 title="${esc(uiText(r.rules, "reward"))}">${esc(r.name)} ${stored ? "교체 장착" : "획득"}</h3>${description}<div class="choice-grid">${opts}${stored ? "" : button("이 보상 보관", "KEEP_REWARD", { rewardId: r.id })}</div></div>`;
  }
  function renderHand() {
    // These controls are recreated below. Preserve the user's reading position
    // and focus only while that same card or usable slot remains available.
    const focused = document.activeElement,
      reading = [["hand", "[data-card]", "card"], ["slots", "[data-slot]", "slot"]]
        .map(([id, selector, key]) => {
          const container = $(id), controls = Array.from(container.querySelectorAll(selector));
          return { container, selector, key, scrollTop: container.scrollTop,
            offsets: new Map(controls.map(control => [control.dataset[key], control.scrollTop])),
            focusedKey: controls.find(control => control === focused)?.dataset[key] };
        });
    const h = E.hunter(state);
    if (!h.hand.some(card => card.id === selectedCard)) selectedCard = null;
    if (selectedSlot !== null && (h.slots[selectedSlot] || !E.slots(state)[selectedSlot])) selectedSlot = null;
    $("handCount").textContent = `${h.hand.length}장`;
    $("cardHint").textContent = state.phase === "over"
      ? "사냥이 종료되었습니다. 기록을 저장할 수 있습니다."
      : "1–9 손패 선택";
    $("hand").innerHTML =
      h.hand
        .map((c) => {
          const d = E.card(c), text = ({ "기본 기술": "방해 · 느린 적 공격 취소", "기본 지구력": "회피 · 슬롯 비움", "기본 활력": "즉시 1장 뽑기" })[d.name] || uiText(d.text),
            fullText = uiText(d.name + " · " + d.text);
          return `<button class="stat-card ${d.type} ${selectedCard === c.id ? "selected" : ""}" data-card="${c.id}" aria-pressed="${selectedCard === c.id}" aria-label="${esc(fullText)}" title="${esc(fullText)}"><small>${d.type === "strength" ? "근력" : d.type === "skill" ? "기술" : d.type === "endurance" ? "지구력" : "활력"}</small><b>${esc(d.name)}</b><span>${esc(text)}</span></button>`;
        })
        .join("") ||
      `<p class="muted">${state.phase === "over" ? "마지막 사냥의 카드 기록을 보관했습니다." : "손패가 비었습니다. 차례를 마쳐 보충하세요."}</p>`;
    $("hand")
      .querySelectorAll("[data-card]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedCard = selectedCard === b.dataset.card ? null : b.dataset.card;
            shell?.showProgress?.();
            renderHand();
            renderFirearm();
            renderDecisions();
          }),
      );
    $("deckCount").textContent =
      `덱 ${h.deck.length}장 · 버림 ${h.discard.length}장 · 슬롯 ${h.slots.filter(Boolean).length}장 / 총 12장`;
    renderWeaponLoadout();
    for (const previous of reading) {
      const controls = Array.from(previous.container.querySelectorAll(previous.selector));
      for (const control of controls) {
        const offset = previous.offsets.get(control.dataset[previous.key]);
        if (offset !== undefined) control.scrollTop = offset;
      }
      previous.container.scrollTop = previous.scrollTop;
      if (previous.focusedKey !== undefined) {
        const control = controls.find(control => !control.disabled && control.dataset[previous.key] === previous.focusedKey);
        control?.focus({ preventScroll: true });
      }
    }
  }
  function returnFaceSelection() {
    return state.phase === "return" && returnFaceState === state && E.weapon(state).faces[returnFaceChoice]
      ? returnFaceChoice : E.hunter(state).face;
  }
  function renderWeaponLoadout() {
    // Return choices are a display projection. Only RETURN commits the face,
    // repairs displaced attachments, and opens any permitted reassignment.
    const bankScroll = $("weaponSlotBank").scrollTop,
      canonical = E.hunter(state), preview = state.phase === "return",
      faceIndex = returnFaceSelection(), projected = faceIndex === canonical.face ? state : {
        ...state, hunters: { ...state.hunters, [state.activeHunterId]: { ...canonical, face: faceIndex } },
      }, h = E.hunter(projected),
      weapon = E.weapon(projected), face = E.weaponFace(projected), availableSlots = E.slots(projected), slotFacts = window.BBHuntCombatControls?.slotFacts(projected, E),
      attachmentView = E.rewardsView?.(state), attachments = attachmentView?.rewards.filter(reward => reward.equipped && reward.persistent) || [];
    $("weaponName").textContent = weapon.name;
    $("weaponFace").textContent = faceName(face, h.face);
    $("weaponAbility").textContent = uiText(face.text || "고유 효과가 없습니다.");
    $("slots").style.gridTemplateColumns = `repeat(${availableSlots.length}, minmax(0, 1fr))`;
    $("weaponSlotBank").dataset.slotCount = String(availableSlots.length);
    $("weaponSlotBank").dataset.preview = String(preview);
    $("slots").innerHTML = availableSlots
      .map((sl, i) => {
        const occupied = !!h.slots[i], selected = !preview && !occupied && selectedSlot === i;
        const attached = attachments.filter(reward => reward.slot === i);
        const formula = slotFacts && (slotFacts[i].upgradeDamage || slotFacts[i].upgradeSpeed)
          ? window.BBHuntCombatControls.slotFormulaHTML(slotFacts[i]) : `<span>속도 ${sl.speed} · 피해 ${sl.damage}</span>`;
        return `<button class="hunt-slot ${selected ? "selected" : ""} ${occupied ? "occupied" : ""}" data-slot="${i}" aria-pressed="${selected}" aria-disabled="${occupied || preview}" ${occupied || preview ? "disabled" : ""}><small class="slot-state">${i + 1}번 슬롯 · ${occupied ? "사용됨" : "비어 있음"}</small><b>${esc(sl.name)}</b>${formula}${attached.map(reward => `<span class="slot-attachment" title="${esc(uiText(reward.rules, "reward"))}">◆ ${esc(reward.name)}${reward.kind === "bloodstone-shard" ? " · 공격 피해 +1" : reward.kind === "bloodstone-chunk" ? " · 속도 +1 · 공격 피해 +1" : ""}</span>`).join("")}${sl.text ? `<small>${esc(uiText(sl.text))}</small>` : ""}<small>${occupied ? h.slots[i].faceDown ? "효과 없이 사용한 기술 · 스탯 효과 미적용" : esc(E.card(h.slots[i]).name) : ""}</small></button>`;
      })
      .join("");
    const movable = !preview && !attachmentView?.choices.length ? attachments.filter(reward => reward.reassignable) : [];
    $("openAttachments").hidden = !movable.length;
    $("attachmentChoices").innerHTML = movable.map(reward => `<section class="attachment-choice"><h3 title="${esc(uiText(reward.rules, "reward"))}">${esc(reward.name)} · 현재 ${reward.slot + 1}번 슬롯</h3><div class="actions">${availableSlots.map((slot, index) => button(slotFacts ? window.BBHuntCombatControls.attachmentOptionHTML(slotFacts[index], reward, { clean: text => uiText(text, "combat") }) : `${index + 1}번 슬롯 · ${esc(slot.name)} · 속도 ${slot.speed} · 피해 ${slot.damage}`, "REASSIGN_REWARD", { rewardId: reward.id, slot: index }, index === reward.slot, "attachment-slot-option")).join("")}</div></section>`).join("");
    bind($("attachmentChoices"));
    $("slots")
      .querySelectorAll("[data-slot]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const slot = +b.dataset.slot;
            if (E.hunter(state).slots[slot] || !E.slots(state)[slot]) return;
            selectedSlot = pendingHunterAction?.type === "ATTACK" ? slot : selectedSlot === slot ? null : slot;
            shell?.showProgress?.();
            renderHand();
            renderDecisions();
          }),
      );
    $("weaponSlotBank").scrollTop = bankScroll;
  }
  function hunterActionView(type = pendingHunterAction?.type, commandArgs = {}) {
    return window.BBHuntActionMenu?.view(state, E, window.BBHuntContext, {
      type, cardId: selectedCard, slot: selectedSlot,
      enemyId: mapTarget?.kind === "enemy" ? mapTarget.enemyId : null,
      pullIds: [...pulls], rewardIds: [...selectedRewards], replaceCardEffects: attackReplacesCardEffects(),
      routeIndex: pendingHunterAction?.routeIndex,
      blockedReason: window.BBHuntActionAvailability?.blockedReason,
      commandArgs,
    });
  }
  function beginHunterAction(type) {
    const model = hunterActionView(type);
    if (pendingHunterAction || !model?.actions.some(action => action.type === type && action.enabled) ||
        windows?.isBlocked()) return;
    pendingHunterAction = { type, sourceState: state, sourceRevision: state.revision, routeIndex: null,
      before: { selectedCard, selectedSlot, selectedEnemy, mapTarget, inspectedTile,
        weaponBoost, pulls: [...pulls], rewards: [...selectedRewards], items: inventory.ids() } };
    selectedCard = null;
    if (type === "ATTACK") selectedSlot = model.slot >= 0 ? model.slot : null;
    shell?.showProgress?.();
    renderHand(); renderDecisions();
  }
  function cancelHunterAction() {
    const pending = pendingHunterAction;
    if (!pending) return;
    pendingHunterAction = null;
    if (pending.sourceState === state && pending.sourceRevision === state.revision) {
      ({ selectedCard, selectedSlot, selectedEnemy, mapTarget, inspectedTile, weaponBoost } = pending.before);
      pulls = new Set(pending.before.pulls); selectedRewards = new Set(pending.before.rewards);
      inventory.restoreSelection?.(pending.before.items);
    }
    inventory.render(); renderHand(); renderMap(); renderDecisions(); syncPresentation();
    $("hunterActionBar")?.querySelector(`[data-hunter-intent="${pending.type}"]`)?.focus?.({ preventScroll: true });
  }
  function renderHunterActionBar() {
    const bar = $("hunterActionBar"), model = hunterActionView();
    if (!bar || !model) return;
    bar.innerHTML = model.actions.map(action => `<button type="button" data-hunter-intent="${action.type}" aria-pressed="${pendingHunterAction?.type === action.type}" ${action.enabled && !pendingHunterAction ? "" : "disabled"}>${action.label}${action.type === "ATTACK" ? `<small>선택한 적: ${esc(model.selectedEnemy ? enemyTargetLabel(model.selectedEnemy) : "없음")}</small>` : ""}${actionLossHint({ type: action.type })}</button>`).join("");
    bar.querySelectorAll("[data-hunter-intent]").forEach(button => button.onclick = () => beginHunterAction(button.dataset.hunterIntent));
  }
  function renderDecisions() {
    if (pendingHunterAction && (pendingHunterAction.sourceState !== state || state.phase !== "hunter")) pendingHunterAction = null;
    renderHunterActionBar();
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
      kill_react: "처치 효과 선택",
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
    let help = "", html = "", attackBoostHTML = "";
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
    const checkPulls = () => {
      const previews = window.BBHuntAttackPreview?.pullView(state, E, [...pulls]) || [];
      return E.pullCandidates(state)
        .map(
          (e) =>
            `<label class="checkrow"><input type="checkbox" data-pull="${e.id}" ${pulls.has(e.id) ? "checked" : ""}>공격 전에 끌어오기 · ${esc(enemyTargetLabel(e))}</label>${mapTarget?.enemyId === e.id ? "" : pullHint(previews.find(preview => preview.enemyId === e.id))}${inspectTargetButton(e.id)}`,
        )
        .join("");
    };
    if (p === "hunter") {
      help =
        window.BBHuntActionMenu ? "" : "아래 손패에서 카드를 고르고 행동하세요. 공격·회피는 빈 슬롯도 선택합니다.";
      html = window.BBHuntActionMenu ? "" : `<p class="target-selection-status">${esc(selectHint)}</p><div class="actions">${button("이동", "MOVE", { cardId: selectedCard }, !chosen)}${button("무기 변형", "TRANSFORM", { cardId: selectedCard }, !chosen)}${button("꿈으로 이동", "DREAM", { cardId: selectedCard }, !chosen)}</div>`;
      if (mapTarget) html = `<details class="utility-actions"><summary>다른 행동 · 변형·꿈·화기 준비</summary>${html}</details>`;
      const target = state.enemies.find((e) => e.id === selectedEnemy);
      html += checkPulls();
      if (target && !mapTarget && !window.BBHuntActionMenu) {
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
                .map((n) => `<option value="${n.id}">${esc(uiText(n.name, "location"))}${n.lamp ? " · 등불" : " · 안개 진입로 안으로 이동"}</option>`)
                .join("")}</select></label><p class="muted">중앙 등불의 특수 효과로 안개 진입로 안의 칸에도 들어갈 수 있습니다. 그곳의 망가진 등불은 사용할 수 없고, 꿈에서 돌아오는 목적지로도 선택할 수 없습니다.</p>`
            : ""
        }${o.workshop ? `<label>성배 교단 예배당 · 소모품 1장 교환<select id="tileExchangeItem"><option value="">교환하지 않음</option>${h.consumables.map((item) => `<option value="${esc(item.id)}">${esc(consumableDefinitions()[item.kind].name)}</option>`).join("")}${o.loot ? '<option value="after-loot">소모품 획득 후 교환할 카드 선택</option>' : ""}</select></label><p class="muted">선택한 소모품을 버리고 피의 유지 1개를 얻습니다(최대 3개). 소모품의 일반 사용 효과는 적용하지 않습니다.${h.consumables.length || o.loot ? "" : " 교환할 소모품이 없습니다."}</p>` : ""}${o.loot || o.heal || o.teleport || o.missionRescue || o.workshop ? `<button id="interact" ${chosen ? "" : "disabled"}>상호작용 실행</button><div id="interactionLossHint"></div>` : ""}</details>`;
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
      help = state.move.costPending ? `예약: ${uiText(E.card(E.hunter(state).hand.find(card => card.id === state.move.cardId)).name)} · 첫 칸 진입 시 소모` :
        `남은 이동력 ${state.move.remaining}. 이동을 마치면 적의 추격을 처리합니다.`;
      const carry = (E.missionActions ? E.missionActions(state) : []).find(action => action.command.type === "MISSION_PICKUP");
      if (carry) help += "이 칸에서 걸어서 이동해 나갈 때 생존자와 동행할지 확인합니다. 추가 비용은 없습니다. 순간이동·꿈 입장에는 생존자가 함께 이동하지 않습니다.";
      html = button("이동 마치기", "STOP_MOVE", {}, E.canStopMove ? !E.canStopMove(state) : false) +
        (E.canCancelMove?.(state) ? button("이동 선언 취소", "CANCEL_MOVE") : "");
    } else if (p === "tile_place") {
      help =
        "출입구가 이어지는 방향을 선택하세요. 배치 후 적·소모품을 놓고 연결된 칸으로 진입합니다.";
      const q = state.world.pending,
        t = M.tile(q.tileId),
        opts = placementOptions();
      html = `<h3>${esc(tileReference(preview() || q))} · ${t.spaces.length}칸 타일 배치</h3><p class="muted">지도에 표시된 미리보기에서 방향을 확인하세요. 구역 표시는 중앙 등불을 기준으로 한 지도상 위치입니다.</p><div class="actions">${[0, 1, 2, 3].map((r) => `<button data-rotation="${r}" class="${rotation === r ? "primary" : ""}" ${opts.includes(r) ? "" : "disabled"}>${r * 90}°</button>`).join("")}</div>${button("이 방향으로 배치하고 진입", "PLACE_TILE", { rotation }, false, "primary")}`;
    } else if (p === "exchange_choice") {
      help = "획득한 소모품도 교환할 수 있습니다. 1장을 버려 피의 유지 1개를 얻거나 교환을 마치세요. 추가 스탯 카드 비용은 없습니다.";
      html = h.consumables.map((item) => button(`${esc(consumableDefinitions()[item.kind].name)} 교환 · 유지 +1`, "EXCHANGE_CHOICE", { itemId: item.id })).join("")
        + button("교환하지 않고 마치기", "EXCHANGE_CHOICE", { skip: true });
    } else if (p === "interaction_order") {
      help = "같은 칸의 적들이 상호작용에 앞서 반격합니다. 사냥꾼에게 가장 불리한 결과가 되는 순서로 먼저 행동할 적을 선택하세요. 이 반격에는 맞서 공격하거나 회피할 수 없습니다.";
      html = E.interactionEnemies(state).map((enemy) => button(
        esc(enemyTargetLabel(enemy)),
        "INTERACTION_ENEMY", { enemyId: enemy.id },
      )).join("");
    } else if (p === "spawn_choice") {
      help =
        "피규어 4개가 모두 사용 중입니다. 가장 먼 적 중 사냥꾼에게 가장 불리한 결과가 되도록 고르세요.";
      html = state.spawnChoices
        .map((id) => {
          const e = state.enemies.find((e) => e.id === id);
          return button(
            esc(enemyTargetLabel(e)),
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
      html = `<p>${esc(entry.title || entry.enemyName || "루드비히 장총")}${entry.damage !== undefined ? ` · 피해 ${entry.damage}` : ""}</p>${state.firearmEntry?.enemyId ? `<p class="target-selection-summary">대상: ${esc(enemyTargetLabel(state.firearmEntry.enemyId))}</p>` : ""}${button("장총 소진 · 진입한 적에게 피해 2", "FIREARM_ENTRY", { accept: true }, false, "primary")}${button("장총을 사용하지 않고 계속", "FIREARM_ENTRY", { accept: false })}`;
    } else if (p === "enemy_path") {
      help =
        "같은 조건의 경로가 여러 개입니다. 사냥꾼에게 가장 불리한 결과가 되도록 선택하세요.";
      html = `<p class="target-selection-summary">이동할 적: ${esc(enemyTargetLabel(state.enemyMove?.enemyId))}</p><div class="compact-choices">` + E.moveOptions(state)
        .map((n) =>
          button(esc(nodeName(n)), "ENEMY_STEP", { node: n }),
        )
        .join("") + '</div>';
    } else if (p === "combat_choose") {
      help =
        "적 행동을 공개하기 전에 맞서 공격할 카드·슬롯과 공격용 소모품을 선택하세요.";
      html = `${mapTarget?.kind === "enemy" ? "" : `<p class="target-selection-status">${esc(selectHint)}</p>`}${checkPulls()}${mapTarget?.kind === "enemy" ? "" : button("맞서 공격", "COUNTER", actionArgs, !canCommit, "primary")}${button("공격하지 않고 행동 공개", "NO_ATTACK")}`;
      if (actualGun() && E.firearm(state).trigger === "hunter-turn") html += firearmAction();
    } else if (p === "boss_react") {
      const reaction = E.combatReaction?.(state) || {};
      $("phaseTitle").textContent = reaction.title || "전용 능력 대응";
      const blockPerSpeed = reaction.dodgeBlockPerSpeed || state.combat?.immediate?.dodgeBlockPerSpeed,
        dodged = !!state.combat?.dodged && !blockPerSpeed;
      help = dodged ? "" : blockPerSpeed
        ? `회피 속도마다 ${blockPerSpeed}피해를 방어합니다. 회피 카드와 빈 슬롯을 고른 뒤 ‘이 효과 회피’를 눌러 확정하세요.`
        : `합계 속도 ${reaction.dodgeSpeed ?? 1} 이상인 회피 카드와 빈 슬롯을 고른 뒤 ‘이 효과 회피’를 눌러 확정하세요.${reaction.effects?.length ? " " + reaction.effects.join(" · ") : ""}`;
      if (c.noDodge || c.origin === "interaction" || c.immediate?.unavoidable)
        help = "이 효과는 회피할 수 없습니다. 효과를 받고 계속하세요.";
      html = `<p class="target-selection-status">${esc(selectHint)}</p>${button(dodged ? "회피 선택됨" : "이 효과 회피", "DODGE", { cardId: selectedCard, slot: selectedSlot }, !canCommit || !E.canDodge(state, selectedCard, selectedSlot))}${button(dodged ? "회피 적용 후 계속" : reaction.damage ? `피해 ${reaction.damage}와 효과를 받고 계속` : "회피하지 않고 효과 처리", "RESOLVE", {}, false, "primary")}`;
    } else if (p === "combat_react" || p === "combat_extra") {
      const extra = p === "combat_extra", blocked = c.noDodge || c.origin === "interaction" || !extra && c.action?.undodgeable;
      help = blocked ? extra
        ? "이 추가 타격은 회피할 수 없습니다. ‘추가 피해 받기’로 계속하세요."
        : "현재 전투는 회피할 수 없습니다. 사용할 수 있는 다른 대응을 고른 뒤 ‘전투 처리’를 누르세요."
        : !extra && c.dodged ? ""
        : extra
        ? "첫 공격을 피했거나 방해했어도 별도의 속도 2 회피가 필요합니다. 카드와 빈 슬롯을 고른 뒤 ‘추가 타격 회피’를 누르세요. 피하지 않으려면 ‘추가 피해 받기’를 선택합니다."
        : "";
      html = `<p class="target-selection-status">${esc(selectHint)}</p>${button(c.dodged && !extra ? "회피 선택됨" : extra ? "추가 타격 회피" : "회피", extra ? "EXTRA_DODGE" : "DODGE", { cardId: selectedCard, slot: selectedSlot }, !canCommit || !E.canDodge(state, selectedCard, selectedSlot, extra))}`;
      if (!extra) html += firearmAction();
      html += button(
        extra ? "추가 피해 받기" : "전투 처리",
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
        "효과로 비용 없이 무기를 변형할 수 있습니다. 변형하면 모든 슬롯이 비워집니다.";
      html =
        button("무료로 변형", "FREE_TRANSFORM", { accept: true }) +
        button("현재 형태 유지", "FREE_TRANSFORM", { accept: false });
    } else if (p === "activation") {
      help = "현재 활성화 순위의 적들 중 먼저 행동할 피규어를 선택하세요. 여러 순서가 가능하면 사냥꾼에게 가장 불리한 결과가 되는 순서를 따릅니다.";
      html = E.eligible(state)
        .map((e) =>
          button(
            esc(enemyTargetLabel(e)),
            "ACTIVATE",
            { enemyId: e.id },
          ),
        )
        .join("");
    } else if (p === "kill_react") {
      help = "적 처치로 발동한 카릴 문자를 사용할 수 있습니다. 사용을 마치면 전투를 이어갑니다.";
      html = (E.killReactionActions?.(state) || []).map((action) => commandButton(action, "primary")).join("");
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
      help = "공개된 등불 중 귀환할 곳과 무기 형태를 선택하세요. 형태를 바꾸어 귀환하면, 다음 행동 전에 부착 보상을 원하는 슬롯으로 옮길 수 있습니다.";
      html =
        `<label>무기 형태<select id="returnFace">${E.weapon(state).faces.map((face, index) => `<option value="${index}" ${index === returnFaceSelection() ? "selected" : ""}>${esc(faceName(face, index))}</option>`).join("")}</select></label>` +
        E.nodes(state)
          .filter((n) => n.lamp)
          .map(
            (n) =>
              `<button data-return="${n.id}">${esc(uiText(n.name, "location"))}에서 귀환</button>`,
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
        ? entry.stops.map((stop) => button(`${esc(uiText(stop.name, "location"))}에 멈춤 · 횃불 소진, 피해 1`, "ENTRY_REWARD", { accept: true, node: stop.node }, false, "primary")).join("")
        : button("횃불 소진 · 적을 멈추고 피해 1", "ENTRY_REWARD", { accept: true }, !entry, "primary");
      html += button("횃불 사용하지 않음 · 이동 계속", "ENTRY_REWARD", { accept: false });
      if (entry?.enemyId) html = `<p class="target-selection-summary">대상: ${esc(enemyTargetLabel(entry.enemyId))}</p>${inspectTargetButton(entry.enemyId)}` + html;
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
      help = `챕터 ${chapter} 완수. 장비를 교체한 뒤, 시작 칸과 무기 형태를 고르세요. 시작 칸을 정한 후 챕터 특수 규칙을 적용합니다.`;
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
    if (["upgrade_pick", "upgrade_replace"].includes(p)) html += upgradeHTML({ market: false });
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
      const push = p === "weapon_choice" && state.weaponEffects?.[0]?.kind === "push" ? state.weaponEffects[0] : null,
        allocations = p === "weapon_choice" && E.weapon(state).id === "uncanny-ludwigs-holy-blade"
          ? pendingDamageAllocations(state.weaponEffects) : 0;
      help = p.includes("entry") ? "손패 1장과 빈 슬롯 1개가 필요합니다. 기술을 뒷면으로 놓고 고정 피해 2를 줍니다. 카드 고유 효과와 공격 강화는 적용되지 않습니다." : push ? `이동 선택지 ${weaponChoices.length}개 · 남은 이동 최대 ${push.remaining}칸` : allocations ? `선택할 대상 ${weaponChoices.length}개 · 남은 피해 배분 ${allocations}회` : `선택할 대상 ${weaponChoices.length}개 · 아래 고정 선택 버튼에서 위치와 번호를 확인하세요.`;
      html = `<p class="target-selection-status">${esc(selectHint)}</p>${weaponChoices.map((option) => commandButton(option)).join("")}`;
    } else if (!rewards?.choices.length && weaponChoices.length) html += `<div class="weapon-effect-choices"><p class="muted">${esc(E.weapon(state).name)} · 고유 효과</p>${weaponChoices.map((option) => commandButton(option)).join("")}</div>`;
    if (["hunter", "combat_choose"].includes(p) && ["attack_sacrifice_damage", "attack_sacrifice_speed_or_damage"].includes(boostCode)) {
      const options = boostCode === "attack_sacrifice_damage"
        ? [["none", "사용하지 않음"], ["1", "피해 1을 받고 공격 피해 +1"], ["2", "피해 2를 받고 공격 피해 +2"]]
        : [["none", "사용하지 않음"], ["speed", "피해 1을 받고 공격 속도 +1"], ["damage", "피해 1을 받고 공격 피해 +1"]];
      attackBoostHTML = `<label>공격에 사용할 무기 고유 효과<select id="weaponBoost">${options.map(([value, label]) => `<option value="${value}" ${weaponBoost === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>`;
      html = attackBoostHTML + html;
    }
    if (p === "hunter" && !rewards?.choices.length && !state.weaponEffects?.length &&
        E.weapon(state).id === "uncanny-ludwigs-holy-blade") {
      const last = state.commands?.findLast(command => !command.type.startsWith("APPLY_"));
      if (last?.type === "WEAPON_CHOICE" && last.enemyId) help = `피해 배분 완료 · ${help}`;
    }
    if (p === "hunter" && pendingHunterAction && !rewards?.choices.length) {
      const model = hunterActionView(pendingHunterAction.type, actionArgs), command = model?.command,
        extra = pendingHunterAction.type === "ATTACK" ? attackBoostHTML + checkPulls() + (rewards?.rewards || []).filter(reward => reward.attackSelectable).map(reward => rewardAttackOption(reward, reward.name)).join("") : "";
      $("phaseTitle").textContent = "행동하기";
      help = "행동하기 위해 소모할 패를 선택해주세요";
      html = extra + (model?.routes.length > 1 ? `<label class="hunter-action-route">도약 경로<select id="hunterActionRoute"><option value="">경로 선택</option>${model.routes.map((route, index) => `<option value="${index}" ${pendingHunterAction.routeIndex === index ? "selected" : ""}>${esc(uiText(route.label))}</option>`).join("")}</select></label>` : "") +
        (chosen && model?.reason ? `<p class="hunter-action-reason">${esc(model.reason)}</p>` : "") +
        `<button id="confirmHunterAction" class="primary" ${command ? `data-command="${command.type}" data-args="${esc(JSON.stringify(Object.fromEntries(Object.entries(command).filter(([key]) => key !== "type"))))}"` : ""} ${model?.enabled ? "" : "disabled"}>행동하기${actionLossHint(command || { type: pendingHunterAction.type })}</button><button id="cancelHunterAction" type="button">행동취소</button>`;
    }
    $("phaseHelp").textContent = help;
    $("decisions").innerHTML = html;
    bind($("decisions"));
    bindRewardAttack($("decisions"));
    if ($("cancelHunterAction")) $("cancelHunterAction").onclick = cancelHunterAction;
    if ($("hunterActionRoute")) $("hunterActionRoute").onchange = () => { pendingHunterAction.routeIndex = $("hunterActionRoute").value === "" ? null : +$("hunterActionRoute").value; renderDecisions(); };
    if ($("weaponBoost")) $("weaponBoost").onchange = () => { weaponBoost = $("weaponBoost").value; renderFirearm(); renderDecisions(); };
    if ($("reloadSecondCard")) $("reloadSecondCard").onchange = () => {
      reloadSecondCardId = $("reloadSecondCard").value || null;
      renderDecisions();
    };
    if ($("exportChapterSave")) $("exportChapterSave").onclick = () => $("save").click();
    if ($("returnFace")) $("returnFace").onchange = () => {
      returnFaceChoice = +$("returnFace").value;
      returnFaceState = state;
      renderWeaponLoadout();
    };
    if ($("nextChapterStart")) {
      window.BBStartPlacement.mount($("nextChapterPlacement"), $("nextChapterStart"), $("startNextChapter"));
      const rememberStart = () => { nextStartSpace = $("nextChapterStart").value; };
      $("nextChapterStart").addEventListener("change", rememberStart);
      $("nextChapterPlacement").addEventListener("click", rememberStart);
      $("nextChapterFace").onchange = () => { nextFace = +$("nextChapterFace").value; };
      $("startNextChapter").onclick = () => {
        const face = +$("nextChapterFace").value;
        send("START_NEXT_CHAPTER", { startSpace: $("nextChapterStart").value, face,
          ...(face !== E.hunter(state).face ? { reassignAttachments: true } : {}) });
      };
    }
    const combatEnemy = c && state.enemies.find(enemy => enemy.id === c.enemyId), combatDefinition = combatEnemy && E.enemyDef(state, combatEnemy),
      combatChanges = c?.action && combatEnemy ? contextualEnemyAction(combatDefinition, combatEnemy,
        combatDefinition[c.action.kind] || c.action).modifiers : [];
    $("combatInfo").innerHTML = c && combatFeedback ? combatFeedback.combatHTML({ combat: c, phase: p, labels: ED.labels, enemyModifiers: combatChanges,
      enemyName: state.enemies.some(e => e.id === c.enemyId) ? enemyTargetLabel(c.enemyId) : "처치된 적",
      clean: text => uiText(text, "combat") }) : c
      ? `<div class="combat-card"><b>${esc(state.enemies.some((e) => e.id === c.enemyId) ? E.enemyDef(state, state.enemies.find((e) => e.id === c.enemyId)).name : "처치된 적")}</b><p>${c.action ? `${esc(ED.labels[c.action.kind])} · ${esc(c.action.name)}${c.action.type !== "ability" && Number.isFinite(c.action.speed) ? " · 속도 " + c.action.speed : ""}${Number.isFinite(c.action.damage) && (c.action.type !== "ability" || c.action.damage > 0) ? " · 피해 " + c.action.damage : ""}` : "적 행동 공개 전"}</p>${c.action?.rules?.length ? `<p>${c.action.rules.map(rule => esc(uiText(rule))).join("<br>")}</p>` : ""}<small>${c.attack ? `사냥꾼 공격 · 속도 ${c.attack.speed} / 피해 ${c.attack.damage}` : c.flame ? `${esc(c.flame.name || E.firearm(state).name)} 공격 · 속도 ${c.flame.speed} / 피해 ${c.flame.damage}${c.flame.interrupt ? " · 방해" : ""}${c.flame.splash ? ` · 같은 칸의 다른 적에게 피해 ${c.flame.splash}` : ""}` : "사냥꾼 공격 없음"} · 방어 ${c.defense}${c.dodged ? " · 회피 선택됨" : ""}${c.cancelEnemy ? " · 적 공격 방해됨" : ""}${c.noDodge ? " · 회피 불가" : ""}</small></div>`
      : "";
    renderEnemyHistory();
    $("deckStatus").innerHTML = `<div class="deck-summary"><span class="enemy-deck-remaining"><span>적 행동 · 남음</span><b>${state.enemyDeck.length}</b></span><button type="button" data-enemy-history aria-controls="enemyHistoryDialog" aria-label="버린 적 행동과 공개 순서 확인">버림 <b>${state.enemyDiscard.length}</b></button><span class="last-enemy-action"><span>마지막 공개</span><strong>${ED.labels[state.enemyDiscard.at(-1)] || "없음"}</strong></span></div>`;
    $("deckStatus").querySelector("[data-enemy-history]").onclick = event => {
      renderEnemyHistory(); historyPopup?.open(event.currentTarget);
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
          (b.onclick = () => {
            const face = +$("returnFace").value;
            send("RETURN", { node: b.dataset.return, face,
              ...(face !== E.hunter(state).face ? { reassignAttachments: true } : {}) });
          }),
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
    if ($("tileLamp")) {
      const updateLoss = () => { $("interactionLossHint").innerHTML = $("tileLamp").value ? actionLossHint({ type: "INTERACT", lamp: $("tileLamp").value }) : ""; };
      $("tileLamp").onchange = updateLoss;
      updateLoss();
    }
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
    // An internal default target is not an inspected or prepared attack.
    const preparedAttack = p === "hunter" && [$("decisions"), $("mapContext")].some(box =>
      [...(box?.querySelectorAll("[data-command]") || [])].some(button => button.dataset.command === "ATTACK" && !button.disabled)),
      outcomeEnemyId = p === "hunter" ? (isMapEnemySelected(selectedEnemy) || preparedAttack ? selectedEnemy : null) : c?.enemyId || selectedEnemy,
      outcome = !rewards?.choices.length && outcomeEnemyId && ["hunter", "combat_choose", "combat_react", "combat_extra", "boss_react"].includes(p)
        ? combatOutcome(outcomeEnemyId) : null,
      outcomeOptions = { clean: text => uiText(text, "combat") },
      compactOutcome = window.BBHuntOutcomePreview?.renderHTML(outcome, { ...outcomeOptions, compact: true }) || "";
    $("attackConsequences").hidden = !compactOutcome;
    $("attackConsequences").innerHTML = compactOutcome;
    if (outcome) {
      const details = window.BBHuntOutcomePreview.renderHTML(outcome, outcomeOptions);
      if (details) $("combatInfo").innerHTML = `<details class="combat-outcome-details"><summary>전투 전체 순서와 후속 효과 확인</summary>${details}</details>` + $("combatInfo").innerHTML;
    }
    renderCombatSelection(rewards);
    renderActionDock();
    renderMovementControls();
  }
  function combatOutcome(enemyId) {
    const enemy = state.enemies.find(item => item.id === enemyId);
    if (!enemy && !(state.phase === "combat_extra" && state.combat?.extra)) return null;
    return window.BBHuntOutcomePreview?.describe({ enemy, definition: enemy && E.enemyDef(state, enemy),
      mission: missionView(), hunter: E.hunter(state), combat: state.combat, phase: state.phase });
  }
  function renderCombatSelection(rewards) {
    const box = $("combatSelection"), controls = window.BBHuntCombatControls,
      visible = controls && !rewards?.choices.length && ["hunter", "combat_choose", "combat_react", "combat_extra", "boss_react", "weapon_entry", "entry_weapon"].includes(state.phase)
        && (state.phase !== "hunter" || !window.BBHuntActionMenu || pendingHunterAction?.type === "ATTACK");
    box.hidden = !visible;
    box.innerHTML = "";
    if (!visible) return;
    const dodge = ["combat_react", "combat_extra", "boss_react"].includes(state.phase),
      items = E.hunter(state).consumables.filter(item => inventory.ids().includes(item.id)).map(item => consumableDefinitions()[item.kind]),
      appliedEffects = !dodge && weaponBoost !== "none" ? [{ name: "선택한 무기 고유 효과", text: $("weaponBoost")?.selectedOptions?.[0]?.textContent || weaponBoost }] : [],
      fixedEntry = state.phase === "weapon_entry",
      innateShot = E.weaponChoices?.(state, { cardId: selectedCard, slot: selectedSlot, enemyId: selectedEnemy })
        .some(option => option.command.type === "WEAPON_SHOT"),
      attackPreview = !dodge && !fixedEntry ? window.BBHuntAttackPreview?.view(state, E, {
        kind: state.phase === "combat_choose" ? "COUNTER" : "ATTACK",
        cardId: selectedCard, slot: selectedSlot, enemyId: selectedEnemy || state.combat?.enemyId, pullIds: [...pulls],
        rewardIds: [...selectedRewards], itemIds: inventory.ids(),
        weaponBoost: E.weaponFace(state).effect?.code === "attack_sacrifice_damage" ?
          weaponBoost === "none" ? 0 : +weaponBoost : weaponBoost,
      }) : null,
      model = controls.view(state, E, { cardId: selectedCard, slot: selectedSlot, mode: dodge ? "dodge" : "attack",
        rewardIds: [...selectedRewards], items, appliedEffects,
        ...(fixedEntry ? { actionKind: "fixed-damage", fixedDamage: 2, actionLabel: "총창 진입 대응" } : {}),
        ...(innateShot ? { fixedAction: { label: "수은탄 사격", damage: 2,
          requiredSlot: E.weaponFace(state).effect.parameters.slot } } : {}) });
    const clean = text => uiText(text, "combat");
    box.innerHTML = controls.renderHTML(model, { clean }).replace('<div class="combat-selection-effects">',
      '<div class="combat-selection-effects">' + (window.BBHuntAttackPreview?.renderHTML(attackPreview, { clean }) || ""));
    const choices = [...$("decisions").querySelectorAll("[data-reward-attack]")];
    if (choices.length) {
      const detail = document.createElement("details"), summary = document.createElement("summary");
      detail.className = "combat-reward-options";
      summary.textContent = `공격에 사용할 룬 · ${choices.filter(choice => choice.checked).length}개 선택`;
      detail.append(summary);
      for (const choice of choices) {
        const label = choice.closest?.("label");
        if (label) detail.append(label);
      }
      box.append(detail);
    }
  }
  function renderActionDock() {
    const dock = $("decisionActions");
    if (!dock) return;
    // Move the original controls, including their bound handlers and disabled
    // state. Explanations can scroll without duplicating a game command.
    dock.replaceChildren();
    if (pendingHunterAction) {
      for (const id of ["confirmHunterAction", "cancelHunterAction"]) if ($(id)) dock.append($(id));
      dock.hidden = !dock.children.length;
      return;
    }
    const core = new Set(["MOVE", "END_TURN", "STOP_MOVE", "CANCEL_MOVE",
      "ATTACK", "COUNTER", "NO_ATTACK", "DODGE", "EXTRA_DODGE", "RESOLVE", "EXTRA_TAKE", "WEAPON_CHOICE", "ENTRY_WEAPON", "WEAPON_SHOT"]);
    const controls = [...$("decisions").querySelectorAll("[data-command]"), ...$("mapContext").querySelectorAll("[data-command]")];
    const order = ["WEAPON_CHOICE", "ENTRY_WEAPON", "WEAPON_SHOT", "ATTACK", "COUNTER", "NO_ATTACK", "DODGE", "EXTRA_DODGE", "RESOLVE", "EXTRA_TAKE", "MOVE", "STOP_MOVE", "CANCEL_MOVE", "END_TURN"];
    controls.sort((a, b) => order.indexOf(a.dataset.command) - order.indexOf(b.dataset.command));
    const hasAttack = controls.some(control => ["ATTACK", "COUNTER"].includes(control.dataset.command));
    for (const control of controls) {
      if (!core.has(control.dataset.command) || control.closest?.("details")) continue;
      // Movement remains in its dedicated controller while an attack is being
      // prepared; do not crowd the commit area with a second movement button.
      if (hasAttack && control.dataset.command === "MOVE") continue;
      // Keep the target identity, confirmation and map inspection together.
      dock.append(control.closest?.(".enemy-target-choice") || control);
    }
    for (const id of ["refill", "startNextChapter", "exportChapterSave"]) {
      const control = $(id); if (control) dock.append(control);
    }
    dock.hidden = !dock.children.length;
  }
  function renderMovementControls() {
    const box = $("movementControls"), controls = window.BBHuntMapControls;
    if (!box || !controls) return;
    const view = controls.movement(state, { cardId: selectedCard });
    $("movementRemaining").textContent = view.moving ? `남음 ${view.remaining}` : "";
    $("movementRemaining").hidden = !view.moving;
    if (!view.moving) movementDirection = null;
    const chosenDirection = view.directions.find(direction => direction.edge === movementDirection && direction.options.some(option => option.enabled));
    if (!chosenDirection) movementDirection = null;
    box.innerHTML = `<p class="movement-hint">${esc(uiText(view.hint))}</p>${!view.moving ? button("이동 선언 · 손패 1장", "MOVE", { cardId: selectedCard }, !view.start.enabled) : ""}<div class="movement-pad" role="group" aria-label="이동 방향">${view.directions.map(direction => {
      const enabled = direction.options.some(option => option.enabled),
        hint = enabled ? direction.options.filter(option => option.enabled).map(option => uiText(option.label)).join(" / ") :
          direction.options[0]?.reason || "이 방향으로 연결된 칸이나 열린 출입구가 없습니다.";
      return `<button type="button" data-move-direction="${direction.edge}" ${enabled ? "" : "disabled"} aria-label="${direction.name} 이동" title="${esc(hint)}">${{N:"↑",E:"→",S:"↓",W:"←",NE:"↗",SE:"↘",SW:"↙",NW:"↖"}[direction.edge]}</button>`;
    }).join("")}<span class="movement-center" aria-hidden="true">${view.moving ? view.remaining : "이동"}</span></div>${chosenDirection ? `<div class="movement-destinations"><p>${chosenDirection.name} · 이동할 칸을 선택하세요</p>${chosenDirection.options.map((option, index) => `<button type="button" data-move-option="${index}" ${option.enabled ? "" : "disabled"} title="${esc(option.reason || option.cost)}">${esc(uiText(option.label))}</button>`).join("")}</div>` : ""}${view.moving ? button("이동 마치기", "STOP_MOVE", {}, !view.stop.enabled) + (view.cancel?.enabled ? button("이동 선언 취소", "CANCEL_MOVE") : "") : ""}`;
    bind(box);
    box.querySelectorAll("[data-move-direction]").forEach(button => button.onclick = () => {
      if (button.disabled) return;
      const direction = view.directions.find(direction => direction.edge === button.dataset.moveDirection),
        enabled = direction?.options.filter(option => option.enabled) || [];
      if (enabled.length === 1 && enabled[0].command) {
        movementDirection = null;
        sendCommands([enabled[0].command]);
      } else if (enabled.length > 1) {
        movementDirection = direction.edge;
        renderMovementControls();
      }
    });
    box.querySelectorAll("[data-move-option]").forEach(button => button.onclick = () => {
      if (button.disabled) return;
      const option = chosenDirection?.options[Number(button.dataset.moveOption)];
      if (option?.enabled && option.command) { movementDirection = null; sendCommands([option.command]); }
    });
  }
  function renderTileInfo() {
    const box = $("tileInfo"), controls = window.BBHuntMapControls;
    if (!box || !controls) return;
    const current = E.node(state, E.hunter(state).position)?.tile;
    if (!state.world.tiles.some(tile => tile.tileId === inspectedTile)) inspectedTile = current || state.world.tiles[0]?.tileId;
    const selectedNode = mapTarget?.kind === "enemy" ? state.enemies.find(enemy => enemy.id === mapTarget.enemyId)?.node : mapTarget?.node;
    const view = controls.tileInfo(state, inspectedTile, { node: selectedNode, selectedOnly: true });
    $("inspectCurrentTile").disabled = !current;
    $("inspectCurrentTile").onclick = () => { inspectedTile = current; mapTarget = null; centerMap(true); renderMap(); renderDecisions(); syncPresentation(); };
    if (!view) { box.innerHTML = '<p class="muted">지도 타일을 선택하면 내용과 특수 규칙을 확인할 수 있습니다.</p>'; return; }
    const tileName = view.name || tileReference(state.world.tiles.find(tile => tile.tileId === view.id)),
      enemies = view.spaces.flatMap(space => space.enemies);
    box.innerHTML = `<div class="tile-info-summary"><div class="tile-info-title"><h3>${esc(tileName)}</h3>${view.spaces.length === 1 && view.spaces[0].name !== tileName ? `<span>${esc(uiText(view.spaces[0].name))}</span>` : ""}</div>${view.fog ? '<p class="context-lamp-warning">안개 진입로 · 타일 밖으로 걸어서 나갈 수 없습니다.</p>' : ""}${view.rules.map(rule => `<p class="tile-info-rule">${esc(uiText(rule))}</p>`).join("")}${view.spaces.map(space => `<section class="tile-info-space">${view.spaces.length > 1 && space.name !== view.name ? `<h4>${esc(uiText(space.name))}</h4>` : ""}${space.interactions.map(text => `<p class="tile-info-object">${esc(uiText(text))}</p>`).join("")}${space.tokens.map(token => `<p class="tile-info-companion">◆ ${esc(uiText(token.name))}${token.count > 1 ? ` ${token.count}명` : ""}${token.carrierId === state.activeHunterId ? " · 동행 중" : ""}</p>`).join("")}</section>`).join("")}</div>${enemies.length ? `<div class="tile-info-enemies" aria-label="선택한 칸의 적">${enemies.map(enemy => `<button type="button" class="tile-info-enemy" data-special-info="${esc(enemy.id)}" aria-label="${esc(enemy.name)} 공격과 능력 보기">${esc(enemyTargetLabel(enemy.id))}<small>체력 ${enemy.hp} / ${enemy.maxHp}${Number.isFinite(enemy.insight) ? ` · 계몽 ${enemy.insight}개` : ""}</small></button>`).join("")}</div>` : ""}`;
    box.querySelectorAll("[data-special-info]").forEach(button => button.onclick = () => inspectEnemyButton(button));
  }
  function renderContext(actionArgs = {}) {
    const box = $("mapContext");
    if (!box) return;
    box.hidden = !mapTarget;
    if (!mapTarget) { box.innerHTML = ""; return; }
    if (mapTarget.kind === "enemy-type") { renderEnemyTypeContext(box, mapTarget.enemyKind); return; }
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
    const pullPreview = view.enemyId && window.BBHuntAttackPreview?.pullView(state, E, [...pulls]).find(preview => preview.enemyId === view.enemyId);
    box.innerHTML = `<div class="context-heading"><div><p class="eyebrow">선택한 대상</p><h3 id="enemyInspectionTitle">${esc(uiText(mapTarget.kind === "enemy" ? enemyTargetLabel(view.enemyId) : mapTarget.objectName || (view.nodeId ? nodeName(view.nodeId) : view.title), "location"))}</h3></div><button id="clearMapTarget" type="button" aria-label="대상 선택 닫기">×</button></div><div id="enemyInspectionContent">${view.hint ? `<p class="context-hint">${esc(uiText(view.hint, "location"))}</p>` : ""}${pullHint(pullPreview)}<div class="context-actions">${actions.map((action, index) => {
      const c = command(action), { type, ...args } = c || {};
      if (type === "ATTACK" && state.phase === "hunter" && window.BBHuntActionMenu) {
        const enabled = !pendingHunterAction && hunterActionView().actions.find(item => item.type === "ATTACK")?.enabled;
        return enabled ? '<div class="context-action"><button type="button" data-hunter-intent="ATTACK">이 적 공격하기</button></div>' : "";
      }
      const selfCost = ["ATTACK", "COUNTER", "FIREARM"].includes(type) && actionArgs.weaponBoost && actionArgs.weaponBoost !== "none"
        ? ` · 자기 피해 ${typeof actionArgs.weaponBoost === "number" ? actionArgs.weaponBoost : 1}` : "";
      const resourceCost = (["ATTACK", "COUNTER"].includes(type) && inventory.ids().length ? ` · 소모품 ${inventory.ids().length}장 사용` : "")
        + (["ATTACK", "COUNTER", "FIREARM"].includes(type) && selectedRewards.size ? ` · 선택 보상 ${selectedRewards.size}장 소진` : "");
      return `<div class="context-action"><button data-context-id="${esc(action.id)}" ${c ? `data-command="${type}" data-args="${esc(JSON.stringify(args))}"` : `data-context-action="${index}"`} ${action.enabled ? "" : "disabled"}>${esc(action.label)}${["ATTACK", "COUNTER"].includes(type) ? "" : `<small>${esc(action.cost + selfCost + resourceCost)}</small>`}${c ? actionLossHint(c) : ""}</button>${!action.enabled && action.reason && !["ATTACK", "COUNTER"].includes(type) ? `<p class="context-reason">${esc(action.reason)}</p>` : ""}</div>`;
    }).join("")}</div>${view.brokenLamp ? '<p class="context-lamp-warning">망가진 등불 · 사용할 수 없고, 사냥꾼의 꿈에서 돌아오는 목적지로 선택할 수 없습니다.</p>' : ""}${view.fog ? '<p class="context-fog-note">안개가 생길 때 이 타일의 일반 적이 제거됩니다.</p>' : ""}${view.enemyId ? `<section class="context-enemy-abilities" aria-label="선택한 적의 공격과 능력"><h4>공격과 능력</h4>${publicEnemyAbilities(E.enemyDef(state, state.enemies.find(enemy => enemy.id === view.enemyId)), state.enemies.find(enemy => enemy.id === view.enemyId))}</section>` : ""}</div>`;
    bind(box);
    box.querySelectorAll("[data-hunter-intent]").forEach(button => button.onclick = () => beginHunterAction(button.dataset.hunterIntent));
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
    $("clearMapTarget").onclick = closeEnemyInspection;
  }
  function renderEnemyHistory() {
    const history = enemyHistory.view();
    $("enemyActionHistory").innerHTML = history.records.map(record => `<li><strong>${esc(ED.labels[record.kind])}</strong>${record.enemy ? `<span>${esc(uiText(record.enemy))} · ${esc(uiText(record.action))}</span>` : ""}</li>`).join("") || '<li class="muted">아직 공개된 적 행동이 없습니다.</li>';
  }
  function contextualEnemyAction(definition, enemy, action) {
    if (!combatFeedback || !enemy || !action) return { action, modifiers: [] };
    const combat = state.combat?.enemyId === enemy.id ? state.combat : null,
      disclosed = combat?.action?.name === action.name && combat.action.kind === action.kind,
      tileId = E.node(state, enemy.node)?.tile,
      buffSource = disclosed ? (combat.history || []).filter(entry => entry.kind === "ability").map(entry => entry.name).join(" · ") : "";
    return combatFeedback.contextualAction(action, { tileId, tileName: M.tile(tileId)?.displayName,
      ignoreTileSpeed: definition.ignoreTileSpeed === true, missionId: enemy.missionId,
      ...(E.enemyTileSpeedPenalty ? {tileSpeedPenalty:E.enemyTileSpeedPenalty(state, enemy, definition)} : {}),
      ...(disclosed ? { resolvedAction: combat.action, buff: combat.buff, buffSource } : {}) });
  }
  function pullHint(preview) {
    if (!preview) return "";
    return window.BBHuntAttackPreview.pullHTML(preview,
      window.BBHuntLocationLabels?.tile(state, preview.tileId)?.reference, { clean: text => uiText(text, "combat") });
  }
  function publicEnemyAction(action, showStats = true, modifiers = []) {
    if (!action) return "";
    if (combatFeedback) return combatFeedback.actionDetailsHTML(action, { showStats, modifiers,
      showDodge: showStats && Number.isFinite(action.dodgeSpeed), clean: text => uiText(text, "combat") });
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
  function publicEnemyAbilities(d, enemy) {
    const changes = enemy ? window.BBEnemyMissionEffects?.describe(state, E).filter(effect => effect.enemyId === enemy.id) || [] : [],
      changed = combatFeedback?.missionEffectsHTML(changes, text => uiText(text, "combat")) || "";
    if (d.boss) {
      // Only the current, already revealed combat action is public. Boss
      // definitions also contain future actions and must not be enumerated.
      const c = enemy && state.combat?.enemyId === enemy.id ? state.combat : null,
        actions = [c?.action, c?.immediate, c?.extra].filter(Boolean),
        unique = actions.filter((action, index) => actions.findIndex(other => other.name === action.name) === index);
      return changed + (unique.length ? `<dl>${unique.map(action => {
        const prepared = contextualEnemyAction(d, enemy, d[action.kind] || action);
        return `<dt>현재 공개된 행동</dt><dd>${publicEnemyAction(prepared.action, true, prepared.modifiers)}</dd>`;
      }).join("")}</dl>` : '<p class="muted">아직 공개된 행동이 없습니다.</p>');
    }
    // The effective definition includes the currently revealed mission rules.
    // Its original printed face remains reference material, not the live attack.
    const f = d.face, basic = d.basic || f?.basicAttack, special = d.special || f?.specialAttack, ability = d.ability || f?.ability;
    return changed + `<dl>${[["기본 공격", basic], ["특수 공격", special], ["전용 능력", ability]].filter(([, action]) => action).map(([label, action]) => {
      const prepared = contextualEnemyAction(d, enemy, action);
      return `<dt>${label}</dt><dd>${publicEnemyAction(prepared.action, action.type !== "ability" && (label !== "전용 능력" || action.type === "attack"), prepared.modifiers)}</dd>`;
    }).join("")}</dl>`;
  }
  function inspectEnemyButton(button) {
    const assignment = button.dataset.enemyInfo && state.world.assignments.find(a => a.enemyId === button.dataset.enemyInfo),
      enemy = button.dataset.specialInfo && state.enemies.find(e => e.id === button.dataset.specialInfo);
    if (!assignment && !enemy) return;
    const individuals = assignment ? regularEnemies(assignment.enemyId) : [], target = enemy || (individuals.length === 1 ? individuals[0] : null);
    rememberEnemyInspectionSource(button);
    if (target) selectMapEnemy(target.id, button);
    else {
      selectedEnemy = null;
      mapTarget = { kind: "enemy-type", enemyKind: assignment.enemyId };
      shell?.showProgress?.({ preserveDialog: true });
      renderMap(); renderFirearm(); renderDecisions(); syncPresentation();
    }
    $("mapContext")?.focus?.({ preventScroll: true });
  }
  function regularEnemies(kind) {
    return state.enemies.filter(enemy => enemy.kind === kind && !enemy.componentId && !enemy.provisionalKind && !enemy.extendedId);
  }
  function renderEnemyTypeContext(box, kind) {
    const assignment = state.world.assignments.find(item => item.enemyId === kind);
    if (!assignment) { mapTarget = null; box.hidden = true; box.innerHTML = ""; return; }
    const definition = E.enemyDef(state, kind), individuals = regularEnemies(kind),
      altered = individuals.some(enemy => enemy.missionId);
    box.innerHTML = `<div class="context-heading"><div><p class="eyebrow">적 정보</p><h3 id="enemyInspectionTitle">${esc(uiText(definition.name))}</h3></div><button id="clearMapTarget" type="button" aria-label="대상 선택 닫기">×</button></div><div id="enemyInspectionContent"><p class="context-hint">체력 ${definition.maxHp ?? definition.health} · 이동 ${definition.move} · 지도 위 ${individuals.length}마리</p>${individuals.length ? `<div class="enemy-instance-choices" aria-label="개체 선택">${individuals.map(enemy => `<button type="button" data-inspect-target="${esc(enemy.id)}">${esc(enemyTargetLabel(enemy.id))}<small>${enemy.hp} / ${E.enemyDef(state, enemy).maxHp}</small></button>`).join("")}</div>` : ""}${altered ? '<p class="muted">임무 효과는 해당 개체를 선택해 확인하세요.</p>' : ""}<section class="context-enemy-abilities">${publicEnemyAbilities(definition, null)}</section></div>`;
    bind(box);
    $("clearMapTarget").onclick = closeEnemyInspection;
  }
  function rememberEnemyInspectionSource(opener) {
    // Instance choices replace their own DOM. Keep the original roster/tile
    // source while navigating from a species reference to an individual.
    if ($("mapContext")?.contains?.(opener) && inspectionOpener) return;
    const key = ["enemyInfo", "specialInfo", "enemy", "inspectTarget"]
      .find(name => opener?.dataset?.[name]);
    if (!key) { inspectionOpener = null; return; }
    const scopes = ["enemyRoster", "tileInfo", "chapterMap", "enemyStatusLayer",
      "nearEnemies", "decisionActions", "decisions", "itemDetail", "rewards"];
    const scope = scopes.find(id => $(id)?.contains?.(opener)) || null;
    const value = opener.dataset[key], enemyId = key === "enemyInfo" ? null : value;
    inspectionOpener = { scope, key, value, enemyId,
      enemyKind: key === "enemyInfo" ? value : state.enemies.find(enemy => enemy.id === value)?.kind };
  }
  function enemyInspectionSource(source) {
    const scopes = ["enemyRoster", "tileInfo", "chapterMap", "enemyStatusLayer",
      "nearEnemies", "decisionActions", "decisions", "itemDetail", "rewards"];
    const find = (key, value, preferred) => {
      if (!value) return null;
      const attribute = "data-" + key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
      for (const id of [...new Set([preferred, ...scopes].filter(Boolean))]) {
        const button = [...($(id)?.querySelectorAll("[" + attribute + "]") || [])]
          .find(candidate => candidate.dataset[key] === value && !candidate.disabled);
        if (button) return button;
      }
      return null;
    };
    return source && (find(source.key, source.value, source.scope) ||
      find("specialInfo", source.enemyId, "enemyRoster") ||
      find("enemy", source.enemyId, "chapterMap") ||
      find("enemyInfo", source.enemyKind, "enemyRoster")) || $("workspaceProgressTab");
  }
  function closeEnemyInspection() {
    const opener = ["enemy", "enemy-type"].includes(mapTarget?.kind) ? inspectionOpener : null;
    inspectionOpener = null; mapTarget = null;
    renderMap(); renderDecisions(); syncPresentation();
    enemyInspectionSource(opener)?.focus?.({ preventScroll: true });
  }
  function selectMapEnemy(enemyId, opener) {
    const enemy = state.enemies.find(item => item.id === enemyId);
    if (!enemy) return;
    shell?.showProgress?.({ preserveDialog: true });
    selectedEnemy = enemyId; mapTarget = { kind: "enemy", enemyId };
    rememberEnemyInspectionSource(opener);
    inspectedTile = E.node(state, enemy.node)?.tile || inspectedTile;
    renderMap(); renderFirearm(); renderDecisions(); shell?.bind(); syncPresentation();
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
    $("enemyRoster").querySelectorAll("button").forEach(button => button.onclick = () => inspectEnemyButton(button));
  }
  const G = window.BBTileGeometry;
  function mapScene(p, ghost, mission, h) {
    if (ghost) return [];
    const prefix = p.tileId + ":", tokens = (mission?.tokens || []).map(token => ({
      ...token, node: token.carrierId === state.activeHunterId && !h.inDream ? h.position : token.node,
    })).filter(token => token.node?.startsWith(prefix));
    const carried = mission?.counters?.find(counter => counter.id === "survivors-held");
    if (carried?.value > 0 && !h.inDream && h.position?.startsWith(prefix))
      tokens.push({ id: "survivors-held", node: h.position, name: "구조한 생존자", count: carried.value });
    return window.BBMapRenderLayout.layout({ tileId: p.tileId, rotation: p.rotation,
      enemies: state.enemies.filter(enemy => enemy.node.startsWith(prefix)).map(enemy => {
        const markers = G.definition(p.tileId).markers.filter(marker => `${p.tileId}:${marker.spaceId}` === enemy.node),
          assigned = state.world.assignments.find(assignment => assignment.enemyId === enemy.kind)?.marker,
          lamp = enemy.missionId && markers.some(marker => marker.kind === "lamp"),
          spawn = markers.filter(marker => marker.kind === "spawn"),
          markerId = enemy.missionId && !lamp && spawn.length === 1 ? spawn[0].markerId : assigned;
        return { id: enemy.id, node: enemy.node, markerId,
          ...(lamp ? { anchorKind: "lamp" } : {}),
          ...(characterSkin(enemy) === "cleric-beast" ? { visualWidth: 60, visualHeight: 56 } :
            E.enemyDef(state, enemy).boss ? { visualWidth: 36, visualHeight: 40 } :
            characterSkin(enemy) === "scourge-beast" ? { visualWidth: 24, visualHeight: 28 } : {}),
        };
      }), hunter: !h.inDream && h.position?.startsWith(prefix) ? { id: "hunter", node: h.position } : null,
      loot: state.loot.filter(node => node.startsWith(prefix)), tokens,
    }).map(entry => entry.type === "token" ? { ...entry, token: tokens.find(token => token.id === entry.id) } : entry);
  }
  function mapObjectHTML(entry, fog) {
    const broken = entry.type === "lamp" && fog,
      name = entry.type === "lamp" ? broken ? "망가진 등불" : "등불"
        : entry.type === "chest" ? "보물상자" : entry.token?.name || "생존자",
      count = entry.type === "token" ? entry.token?.count || 1 : entry.count || 1,
      file = entry.type === "lamp" ? broken ? "broken-lamp" : "lamp"
        : entry.type === "chest" ? "chest" : "survivor",
      compact = entry.crowded && entry.type === "token",
      caption = entry.type === "token" || broken,
      hint = entry.type === "chest" ? ` · 남은 소모품 ${count}` : count > 1 ? ` · ${count}명` : "";
    return `<div class="map-scene-object object-${entry.type} ${compact ? "object-crowded" : ""}" data-layout-id="${esc(entry.id)}" style="left:${entry.x}%;top:${entry.y}%;--object-width:${entry.visualWidth}%"><button type="button" class="map-object ${broken ? "broken-lamp-label" : ""}" data-map-object="${entry.type}" data-map-object-id="${esc(entry.id)}" data-object-node="${esc(entry.node)}" data-object-name="${esc(name)}" aria-label="${esc(name + hint)} · 행동과 비용 보기" title="${esc(name + hint)}${broken ? " · 사용 및 꿈 복귀 불가" : ""}"><img src="assets/objects/${file}.svg" alt="" draggable="false">${caption ? `<span class="map-object-caption">${esc(name)}${count > 1 ? ` ${count}` : ""}</span>` : count > 1 ? `<span class="map-object-count">${count}</span>` : ""}</button></div>`;
  }
  function tileHTML(p, ghost = false) {
    const def = M.tile(p.tileId), h = E.hunter(state),
      reachable = window.BBHuntMapControls ? window.BBHuntMapControls.movement(state, { cardId: selectedCard }).directions
        .flatMap(direction => direction.options).filter(option => option.enabled && option.command?.type === "STEP")
        .map(option => option.command.node) : E.neighbors(state, h.position), mission = missionView(),
      currentTile = E.node(state, h.position)?.tile,
      currentFog = !!mission?.fog.includes(currentTile),
      fog = !ghost && !!mission?.fog.includes(p.tileId), scene = mapScene(p, ghost, mission, h);
    return `<div class="tile-cell ${ghost ? "ghost" : ""} ${fog ? "fog-tile" : ""}" data-tile="${p.tileId}" data-inspected="${!ghost && p.tileId === inspectedTile}"><img class="tile-diagram" src="${G.mapImage(p.tileId)}" data-tile-art="${p.tileId}" data-tile-rotation="${p.rotation}" alt="" style="transform:rotate(${p.rotation * 90}deg)"><div class="tile-name">${ghost ? def.named ? `<span class="tile-label">${esc(def.displayName)}</span>` : `<span class="tile-reference">${esc(tileReference(p))}</span>` : `<button type="button" class="tile-info-trigger ${def.named ? "" : "anonymous"}" data-tile-info="${p.tileId}" aria-label="${esc(tileReference(p))} · 타일 정보 보기">${def.named ? esc(def.displayName) : `<span class="tile-reference">${esc(tileReference(p))}</span>`}</button>`}${ghost || fog ? `<span>${ghost ? "미리보기" : "안개"}</span>` : ""}</div>${def.spaces.map((n) => {
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
        brokenLamp = fog && n.icons.some(icon => icon.kind === "lamp"),
        hunter = scene.find(entry => entry.type === "hunter" && entry.node === id),
        hunterX = hunter ? (hunter.x-left)/width*100 : localX,
        hunterY = hunter ? (hunter.y-top)/height*100 : localY;
      return `<button class="space diagram-space ${here ? "here" : ""} ${reach ? "reachable" : ""} ${mapTarget?.kind === "cell" && mapTarget.node === id ? "context-selected" : ""} ${ghost ? "ghost-space" : ""}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;clip-path:polygon(${polygon})" data-node="${esc(id)}" aria-pressed="${mapTarget?.kind === "cell" && mapTarget.node === id}" ${ghost ? "disabled" : ""} aria-label="${esc(G.spaceLabel(def, n, p.rotation))}${brokenLamp ? " · 망가진 등불" : ""}${here ? " · 사냥꾼" : ""}${loot ? " · 소모품 " + loot : ""}${figures.length ? " · 적 " + figures.length : ""}" title="${esc(G.spaceLabel(def, n, p.rotation))}${brokenLamp ? " · 망가진 등불 · 사용 및 꿈 복귀 불가" : ""}"><span class="node-anchor" data-node-anchor="${esc(id)}" style="left:${localX}%;top:${localY}%" aria-hidden="true"></span>${hunter ? `<span class="hunter-anchor" data-layout-id="hunter" data-presentation-id="hunter" data-presentation-kind="hunter" data-presentation-node="${esc(id)}" data-presentation-skin="${esc(hunterVisual().skin)}" style="left:${hunterX}%;top:${hunterY}%" aria-hidden="true"></span>` : ""}${here ? `<span class="space-status" style="left:${hunterX}%;top:${Math.min(95,hunterY+10)}%"><span class="hunter-map-marker">● 사냥꾼</span></span>` : ""}</button>`;
    }).join("")}${scene.filter(entry => ["lamp", "chest", "token"].includes(entry.type)).map(entry => mapObjectHTML(entry, fog)).join("")}${scene.filter(entry => entry.type === "enemy").map(entry => {
      const enemy = state.enemies.find(enemy => enemy.id === entry.id),
        assigned = state.world.assignments.find(assignment => assignment.enemyId === enemy.kind), d = E.enemyDef(state, enemy),
        marker = enemy.missionId || enemy.provisionalKind || enemy.componentId || !assigned ? "★" : ["●", "▲", "■"][assigned.slot - 1],
        insight = window.BBHuntContext?.enemyInsightTokens(state, enemy), tokenLabel = Number.isFinite(insight) ? ` · 계몽 토큰 ${insight}개` : "",
        selected = isMapEnemySelected(enemy.id);
      return `<div class="map-figures scene-figure ${entry.anchorKind === "lamp" ? "lamp-figures" : ""}" data-layout-id="${esc(entry.id)}" style="left:${entry.x}%;top:${entry.y}%"><button type="button" class="map-figure ${selected ? "selected" : ""}" data-enemy="${esc(enemy.id)}" data-presentation-id="${esc(enemy.id)}" data-presentation-kind="enemy" data-presentation-node="${esc(entry.node)}" data-presentation-skin="${characterSkin(enemy)}" aria-pressed="${selected}" aria-label="${esc(enemyTargetLabel(enemy))} · 체력 ${enemy.hp} / ${d.maxHp}${tokenLabel} · 대상 선택" title="${esc(enemyTargetLabel(enemy))} · 체력 ${enemy.hp}/${d.maxHp}${tokenLabel}" style="--marker:${colors[assigned?.marker] || colors.gold}">${marker}${Number.isFinite(insight) ? `<span class="enemy-insight-badge" aria-hidden="true">✧ ${insight}</span>` : ""}</button></div>`;
    }).join("")}${ghost ? "" : gateHTML(p)}${tileSpaceLabelsHTML(p, def, ghost)}</div>`;
  }
  function tileSpaceLabelsHTML(p, definition, ghost) {
    const spaces = definition.spaces.map(space => ({ space, point: G.point(p.tileId, space.id, p.rotation) }))
      .sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]);
    return `<div class="tile-space-labels" aria-label="칸 이름">${spaces.map(({ space }) => {
      const label = esc(G.spaceLabel(definition, space, p.rotation));
      return ghost ? `<span>${label}</span>` : `<button type="button" data-space-label-node="${esc(p.tileId + ":" + space.id)}">${label}</button>`;
    }).join("")}</div>`;
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
    const current = E.node(state, E.hunter(state).position)?.tile;
    if (!state.world.tiles.some(tile => tile.tileId === inspectedTile)) inspectedTile = current || state.world.tiles[0]?.tileId;
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
    if (mapTarget?.objectId && ![...$("chapterMap").querySelectorAll("[data-map-object-id]")]
        .some(object => object.dataset.mapObjectId === mapTarget.objectId && object.dataset.objectNode === mapTarget.node)) {
      delete mapTarget.objectId; delete mapTarget.objectKind; delete mapTarget.objectName;
    }
    bind($("chapterMap"));
    bindMapTargets();
    bindEnemyTargets($("chapterMap"));
    renderTileInfo();
    $("tileCount").textContent =
      `공개 ${state.world.tiles.length + (state.world.pending ? 1 : 0)} / ${state.world.tilePool.length} · 더미 ${state.world.tileDeck.length}`;
    const n = E.nodes(state).find((n) => n.id === E.hunter(state).position),
      def = n ? M.tile(n.tileId) : null;
    const locationDetail = n
      ? `<b>현재 위치 · ${esc(nodeName(n.id))}</b>${def.rules.length ? '<p class="muted">' + def.rules.map(rule => esc(uiText(rule))).join(" ") + "</p>" : ""}${def.id === "tile-07" ? '<p class="muted">성배 교단 예배당 칸에서 상호작용하면 소모품 1개를 버리고 피의 유지 1개를 얻습니다. 같은 상호작용에서 획득한 소모품도 교환할 수 있습니다.</p>' : ""}`
      : "<b>현재 위치 · 사냥꾼의 꿈</b>";
    $("locationText").textContent = n ? `현재 위치 · ${nodeName(n.id)}` : "현재 위치 · 사냥꾼의 꿈";
    if ($("locationDetail")) $("locationDetail").innerHTML = locationDetail;
    $("nearEnemies").innerHTML = state.enemies
      .map(
        (e) =>
          `<div class="hunt-enemy ${isMapEnemySelected(e.id) ? "selected" : ""}"><span>${esc(enemyTargetLabel(e))}<br>체력 ${e.hp} / ${E.enemyDef(state, e).maxHp} · ${E.hunter(state).inDream ? "" : E.distance(state, E.hunter(state).position, e.node) + "칸 거리"}</span><button data-enemy="${e.id}">대상 선택</button></div>`,
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
        selectMapEnemy(button.dataset.enemy, button);
      };
    });
  }
  function inspectEnemy(enemyId) {
    selectMapEnemy(enemyId, document.activeElement);
  }
  function previewEnemy(enemyId, inspect = false) {
    const enemy = state.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    const panel = shell?.activePanel();
    if (["inventory", "rewards"].includes(panel)) pickerEnemySelections.set(panel, enemyId);
    selectedEnemy = enemyId;
    mapTarget = { kind: "enemy", enemyId };
    inspectedTile = E.node(state, enemy.node)?.tile || inspectedTile;
    if (inspect) shell?.close();
    renderMap(); renderFirearm(); renderDecisions(); shell?.bind(); syncPresentation();
    const marker = [...$("chapterMap").querySelectorAll("[data-enemy]")].find(b => b.dataset.enemy === enemyId);
    camera?.centerOn(marker, { smooth: false });
    if (panel && $("infoDialog").classList.contains("target-picker")) {
      const viewport = $("mapViewport"), v = viewport.getBoundingClientRect(), d = $("infoDialog").getBoundingClientRect(),
        right = document.documentElement?.dataset.targetPicker === "right",
        available = right ? Math.max(0, Math.min(v.right, d.left) - v.left) : Math.max(0, Math.min(v.bottom, d.top) - v.top);
      if (right && available > 0) viewport.scrollLeft += Math.max(0, (v.width - available) / 2);
      if (!right && available > 0) viewport.scrollTop += Math.max(0, (v.height - available) / 2);
      syncPresentation();
    }
    if (inspect) marker?.focus({ preventScroll: true });
  }
  function bindMapTargets() {
    $("chapterMap").querySelectorAll("[data-tile-info]").forEach(button => button.onclick = () => {
      inspectedTile = button.dataset.tileInfo;
      mapTarget = null;
      renderMap(); renderDecisions(); syncPresentation();
    });
    $("chapterMap").querySelectorAll("[data-space-label-node]").forEach(button => {
      button.onclick = () => selectMapCell({ kind: "cell", node: button.dataset.spaceLabelNode });
    });
    $("chapterMap").querySelectorAll("[data-map-object]").forEach(b => {
      b.onclick = () => {
        shell?.showProgress?.();
        mapTarget = { kind: "cell", node: b.dataset.objectNode, objectKind: b.dataset.mapObject,
          objectName: b.dataset.objectName, objectId: b.dataset.mapObjectId };
        inspectedTile = E.node(state, mapTarget.node)?.tile || inspectedTile;
        renderMap(); renderDecisions(); syncPresentation();
        $("mapContext")?.focus();
      };
    });
    $("chapterMap").querySelectorAll("[data-node]").forEach((b) => {
      b.onclick = () => {
        if (b.disabled) return;
        selectMapCell(b.dataset.entrance
          ? { kind: "entrance", node: b.dataset.node, edge: b.dataset.edge, tileId: b.dataset.tileId }
          : { kind: "cell", node: b.dataset.node });
      };
    });
  }
  function selectMapCell(target) {
    shell?.showProgress?.();
    mapTarget = target;
    inspectedTile = E.node(state, target.node)?.tile || inspectedTile;
    if (state.phase === "move") {
      const action = window.BBHuntContext?.view(state, target, { cardId: selectedCard }).actions
        .find(action => action.id === "move" && action.enabled && action.command?.type === "STEP"),
        allowed = window.BBHuntMapControls?.movement(state, { cardId: selectedCard }).directions
          .some(direction => direction.options.some(option => option.enabled && option.command?.type === "STEP" &&
            option.command.node === action?.command.node));
      if (action && allowed) { sendCommands([action.command]); return; }
    }
    renderMap(); renderDecisions(); syncPresentation();
    $("mapContext")?.focus();
  }
  function characterSkin(enemy) {
    const d = E.enemyDef(state, enemy);
    if (window.BBEnemyVisuals) return window.BBEnemyVisuals.skin(enemy, d);
    // Keep readable legacy markers if the separate appearance adapter fails.
    if (d.boss) return "boss";
    if (d.npcEnemy || /이오세프카/.test(d.name)) return "female";
    if (/beast|dog|hound|crow|spider|rat/i.test(enemy.kind) || /야수|사냥개|늑대|까마귀|거미|쥐/.test(d.name) && !/야수.?사냥/.test(d.name)) return "beast";
    return "mob";
  }
  function isMapEnemySelected(enemyId) {
    return mapTarget?.kind === "enemy" && mapTarget.enemyId === enemyId && selectedEnemy === enemyId;
  }
  function renderEnemyStatuses(actors) {
    const layer = $("enemyStatusLayer");
    if (!layer) return;
    const viewport = $("mapViewport"), width = viewport.clientWidth || 700,
      height = viewport.clientHeight || 400, placed = [];
    enemyStatusOffsets = new Map();
    layer.innerHTML = actors.filter(a => a.kind === "enemy" && a.selected && a.hp > 0 && a.x >= -20 && a.x <= width + 20 && a.y >= -20 && a.y <= height + 20)
      .map(actor => {
      const enemy = state.enemies.find(e => e.id === actor.id), definition = E.enemyDef(state, enemy),
        name = enemyTargetLabel(enemy), insight = window.BBHuntContext?.enemyInsightTokens(state, enemy),
        health = Math.max(0, Math.min(100, enemy.hp / definition.maxHp * 100));
      const cardHeight = Number.isFinite(insight) ? 60 : 44,
        candidates = [[-52,20],[-52,-116],[-164,-100],[60,-100],[-164,-22],[60,-22],[-52,-164],[-52,66]]
          .map(([x,y]) => ({left:Math.max(0,Math.min(width-108,actor.x+x)),top:Math.max(0,Math.min(height-cardHeight,actor.y+y))})),
        fits = p => !placed.some(q => p.left < q.left+108 && p.left+108 > q.left && p.top < q.top+q.height+4 && p.top+cardHeight+4 > q.top),
        chosen = candidates.find(fits) || candidates[0], {left,top} = chosen;
      placed.push({left, top, height:cardHeight}); enemyStatusOffsets.set(actor.id, { x: left - actor.x, y: top - actor.y });
      return `<div class="enemy-map-status ${selectedEnemy === actor.id ? "selected" : ""}" data-status-enemy="${esc(actor.id)}" style="left:${left}px;top:${top}px"><span class="enemy-status-link" aria-hidden="true" style="left:${actor.x-left}px;top:${actor.y-top}px;width:${Math.hypot(52-(actor.x-left),cardHeight/2-(actor.y-top))}px;transform:rotate(${Math.atan2(cardHeight/2-(actor.y-top),52-(actor.x-left))}rad)"></span><button type="button" class="enemy-map-name" data-enemy="${esc(actor.id)}" aria-pressed="${selectedEnemy === actor.id}">${esc(name)}</button><span class="enemy-health-track" role="progressbar" aria-label="${esc(name)} 체력" aria-valuemin="0" aria-valuenow="${enemy.hp}" aria-valuemax="${definition.maxHp}"><span class="enemy-health-fill" style="width:${health}%;--health:${health}%"></span></span><span class="enemy-health-number">${enemy.hp}/${definition.maxHp}</span>${Number.isFinite(insight) ? `<span class="enemy-insight-pips" aria-label="계몽 토큰 ${insight}개">${Array.from({length:Math.min(5,insight)},()=>"✧").join("") || "◇"} <b>${insight}</b></span>` : ""}</div>`;
    }).join("");
    bindEnemyTargets(layer);
  }
  function updateEnemyStatusPositions(actors) {
    const cards = $("enemyStatusLayer")?.querySelectorAll("[data-status-enemy]") || [];
    for (const actor of actors) {
      const card = [...cards].find(c => c.dataset.statusEnemy === actor.id), offset = enemyStatusOffsets.get(actor.id);
      if (card && offset) { card.style.left = `${actor.x + offset.x}px`; card.style.top = `${actor.y + offset.y}px`; }
    }
  }
  function renderEnemyHitAreas(areas) {
    const layer = $("enemyHitLayer");
    if (!layer) return;
    const living = areas.filter(area => state.enemies.some(enemy => enemy.id === area.id && enemy.hp > 0) &&
      [area.left, area.top, area.width, area.height].every(Number.isFinite));
    const current = [...layer.querySelectorAll("[data-enemy]")];
    if (current.map(button => button.dataset.enemy).join("|") !== living.map(area => area.id).join("|")) {
      layer.innerHTML = living.map(area => `<button type="button" class="enemy-sprite-target" data-enemy="${esc(area.id)}" tabindex="-1" aria-label="${esc(enemyTargetLabel(area.id))} · 대상 선택"></button>`).join("");
      bindEnemyTargets(layer);
    }
    for (const button of layer.querySelectorAll("[data-enemy]")) {
      const area = living.find(area => area.id === button.dataset.enemy);
      button.style.left = `${area.left}px`; button.style.top = `${area.top}px`;
      button.style.width = `${area.width}px`; button.style.height = `${area.height}px`;
      button.style.zIndex = String(Math.max(1, Math.round(area.top + area.height)));
      button.setAttribute("aria-pressed", String(isMapEnemySelected(area.id)));
    }
  }
  function syncPresentation() {
    if (rendering) return;
    const viewport = $("mapViewport"), bounds = viewport.getBoundingClientRect(),
      zoom = camera?.scale?.() || camera?.zoom() || 1, tileSize = Math.max(170, Math.min(290, (viewport.clientHeight || 300) - 10)),
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
        scale, hp: kind === "hunter" ? h.hp : enemy?.hp, selected: kind === "enemy" && isMapEnemySelected(id),
        ...point(anchor) };
    });
    const actions = presentationActions.map((action) => {
      if (action.type !== "move") return action;
      const origin = nodes.get(action.fromNode), prior = presentationOrigins.get(action.fromId);
      if (!origin) return action;
      return { ...action, from: { x: origin.x + (prior?.dx || 0) * scale / (prior?.scale || scale),
        y: origin.y + (prior?.dy || 0) * scale / (prior?.scale || scale) } };
    });
    presentation?.resize({ width: viewport.clientWidth || 1, height: viewport.clientHeight || 1 });
    renderEnemyStatuses(actors);
    presentation?.sync({ sceneId: sceneId(), revision: state.revision, actors, actions,
      view: { x: (viewport.scrollLeft || 0) - (viewport.clientWidth || 0) / 2,
        y: (viewport.scrollTop || 0) - (viewport.clientHeight || 0) / 2, zoom } });
    // Required character bodies load together; an optional weapon sheet can
    // continue loading while the common hunter body remains visible.
    const charactersReady = presentation?.status?.().charactersReady === true;
    if (!charactersReady) renderEnemyHitAreas([]);
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
    const map = $("chapterMap"), tiles = [...map.querySelectorAll("[data-tile]")]
      .filter(tile => !tile.classList.contains("ghost") && state.world.tiles.some(placed => placed.tileId === tile.dataset.tile)),
      focus = map.querySelector(previewTile ? ".ghost" : ".hunter-anchor") || map.querySelector(".space.here") ||
        tiles.find(tile => tile.dataset.tile === inspectedTile) || tiles[0],
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
    if (setupRequired) { showError("사냥을 시작한 뒤 저장할 수 있습니다."); return; }
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
  function adoptLoadedState(loaded) {
    // Validate and adopt policies completely before replacing the current hunt.
    const adopted = applyLoadedRuling(loaded);
    state = adopted;
    resetStoryReading();
    setupRequired = false;
    restoredPrevious = false;
    nextStartSpace = "";
    nextFace = null;
    if ($("setupDialog").open) $("setupDialog").close();
    if ($("loadDialog")?.open) $("loadDialog").close();
    shell?.close();
    selectedCard = null;
    selectedSlot = null;
    selectedEnemy = null;
    mapTarget = null;
    inspectedTile = null;
    shell?.showProgress?.();
    pulls.clear();
    selectedRewards.clear();
    rewardSelections.clear();
    pickerEnemySelections.clear();
    inventory.clear();
    pendingHunterAction = null;
  }
  function resumeAutomaticCombat() {
    const command = !setupRequired && window.BBHuntAutomaticCombat?.nextCommand(state, E);
    return command ? commitCommands([command]) : false;
  }
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    // Retain the File object, but let the same file be selected again even if
    // this read is cancelled or superseded before it completes.
    e.target.value = "";
    const request = ++importRequest;
    let sourceState = state;
    try {
      const text = await f.text();
      if (request !== importRequest || state !== sourceState) return;
      adoptLoadedState(E.importSave(text));
      sourceState = state;
      save();
      render();
      showError("");
      resumeAutomaticCombat();
    } catch (x) {
      if (request !== importRequest || state !== sourceState) return;
      showError(x.message);
      if ($("setupDialog").open) $("setupError").textContent = x.message;
    }
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
      $("loadEntryNormal").hidden = !normal;
      $("loadEntryQa").hidden = !qa;
    } catch { /* File save remains available. */ }
  }
  function restoreStored(storageKey, label) {
    importRequest++;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) throw new Error(`이 브라우저에 ${label} 자동 저장이 없습니다.`);
      adoptLoadedState(E.importSave(saved));
      restoredPrevious = storageKey === previousKey;
      save();
      render();
      showError("");
      resumeAutomaticCombat();
      return true;
    } catch (e) { showError(e.message); return false; }
  }
  if ($("restoreV05")) $("restoreV05").onclick = () => restoreStored(oldKey, "v0.5");
  if ($("restoreV06")) $("restoreV06").onclick = () => restoreStored(previousKey, "v0.6");
  $("loadV06Setup").onclick = () => restoreStored(previousKey, "v0.6");
  const restoreNormal = () => {
    try { return restoreStored(localStorage.getItem(key) ? key : previousKey, "일반 사냥"); }
    catch (error) { showError(error.message); return false; }
  };
  $("resumeNormal").onclick = $("resumeNormalSetup").onclick = restoreNormal;
  $("resumeQa").onclick = $("resumeQaSetup").onclick = () => restoreStored(qaKey, "검증 사냥");
  $("loadEntryNormal").onclick = restoreNormal;
  $("loadEntryQa").onclick = () => restoreStored(qaKey, "검증 사냥");
  $("loadEntryFile").onclick = () => $("file").click();
  function leaveLoadDialog() {
    importRequest++;
    if (setupRequired) window.location.assign("index.html");
    else $("loadDialog").close();
  }
  $("loadEntryCancel").onclick = leaveLoadDialog;
  $("loadDialog").addEventListener("cancel", event => { event.preventDefault(); leaveLoadDialog(); });
  function openLoadDialog() {
    shell?.close();
    renderResumeButtons();
    $("loadEntryError").textContent = "";
    $("loadDialog").showModal();
    $("loadEntryFile").focus?.({ preventScroll: true });
  }
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
    importRequest++;
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
  $("setupDialog").addEventListener("cancel", (e) => { importRequest++; if (setupRequired) e.preventDefault(); });
  $("cancelSetup").onclick = () => { importRequest++; $("setupDialog").close(); };
  $("confirmSetup").onclick = () => {
    importRequest++;
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
      state = applyLoadedRuling(state);
      resetStoryReading();
      setupRequired = false;
      restoredPrevious = false;
      nextStartSpace = "";
      nextFace = null;
      selectedCard = null;
      selectedSlot = null;
      selectedRewards.clear();
      rewardSelections.clear();
      pickerEnemySelections.clear();
      selectedEnemy = null;
      pulls.clear();
      inventory.clear();
      save();
      render();
      $("setupDialog").close();
      recordMissionUpdates(window.BBHuntMissionFeedback?.describe(null, state,
        { E, publicText: window.BBHuntPublicText, data: window.BBLongHunt }) || []);
      renderMission();
      showMissionUpdates();
    } catch (e) {
      $("setupError").textContent = e.message;
    }
  };
  renderSetupWeapons(true);
  renderPracticeTargets();
  renderPracticeRewards();
  renderQaSetup();
  render();
  window.BBHuntEntry?.consume(window);
  if (entry?.action === "load" || entry?.action === "continue") {
    openLoadDialog();
    if (entry.action === "continue") {
      if (entry.mode === "qa") restoreStored(qaKey, "검증 사냥");
      else restoreNormal();
    }
  } else {
    if (startupError) showError(startupError);
    else if (!entry && !setupRequired) { save(); resumeAutomaticCombat(); }
    if (setupRequired) openSetup();
  }
})();
