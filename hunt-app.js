(function () {
  "use strict";
  const E = window.BBHunt,
    M = window.BBChapter,
    D = E.data,
    ED = window.BBEnemyDeck,
    $ = (id) => document.getElementById(id),
    key = "bloodborne-hunt-v06",
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
  const photo = (p) => "campaigns/long-hunt/" + p,
    colors = { gold: "#dec079", red: "#dc9784", purple: "#bca0d4" },
    directionNames = { N: "북쪽 ↑", E: "동쪽 →", S: "남쪽 ↓", W: "서쪽 ←" };
  const button = (label, type, args = {}, disabled = false, cls = "") =>
    `<button class="${cls}" data-command="${type}" data-args="${esc(JSON.stringify(args))}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const commandButton = (option, cls = "") => {
    const { type, ...args } = option.command;
    return button(esc(option.label), type, args, !!option.disabled, cls);
  };
  const missionView = () => E.missionView ? E.missionView(state) : null;
  const nodeName = (id) => E.node(state, id)?.name || "지도 밖";
  const placementOptions = () => E.placementOptions
    ? E.placementOptions(state)
    : M.placementOptions(state.world, state.world.pending.tileId, state.world.pending.anchor);
  let state = E.create(undefined, "burial", 0, null, "hunter-pistol", "center", { campaign: true }),
    selectedCard = null,
    selectedSlot = 0,
    selectedEnemy = null,
    rotation = null,
    previewTile = null,
    pulls = new Set(),
    selectedReward = null,
    startupError = "";
  try {
    const saved = localStorage.getItem(key);
    if (saved) state = E.importSave(saved);
  } catch {
    startupError =
      "자동 저장을 읽지 못했습니다. 내보낸 실제 지도 저장 파일을 불러오세요.";
  }
  const invData = { ...D };
  Object.defineProperty(invData, "nodes", { get: () => E.nodes(state) });
  const inventory = window.BBInventory({
    E: {
      ...E,
      data: invData,
      distance: (a, b) => E.distance(state, a, b),
      node: (id) => E.node(state, id),
      enemyDef: (e) => E.enemyDef(state, e),
    },
    getState: () => state,
    send,
    refresh: renderDecisions,
  });
  function save() {
    try {
      localStorage.setItem(key, E.exportSave(state));
      $("saveStatus").textContent = "v0.6 진행 자동 저장됨";
    } catch {
      $("saveStatus").textContent =
        "자동 저장 불가 · 저장 내보내기를 이용하세요";
    }
  }
  function send(type, args = {}) {
    try {
      state = E.dispatch(state, { type, ...args });
      pulls.clear();
      selectedReward = null;
      inventory.clear();
      save();
      render();
      $("error").textContent = "";
    } catch (e) {
      $("error").textContent = e.message;
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
    const h = E.hunter(state);
    if (!h.hand.some((c) => c.id === selectedCard)) selectedCard = null;
    if (!state.enemies.some((e) => e.id === selectedEnemy))
      selectedEnemy =
        state.enemies.find((e) => e.node === h.position)?.id ||
        state.enemies[0]?.id ||
        null;
    if (h.slots[selectedSlot]) selectedSlot = h.slots.findIndex((x) => !x);
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
    const gun = E.firearm(state);
    $("firearm").innerHTML =
      `<p class="eyebrow">장착 화기</p><h2>${esc(gun.name)} <small class="${h.firearmReady ? "ready" : "spent"}">${h.firearmReady ? "준비됨" : "소진됨"}</small></h2><p>적의 기본 공격을 자동으로 방해합니다.</p><p class="muted">사냥꾼 차례에 카드 1장을 버려 준비 · 꿈에서 회복${h.firearmId !== "hunter-pistol" ? "<br>현재 단총과 같은 능력으로 임시 동작" : ""}</p>${button("화기 사용 · 기본 공격 방해", "FIREARM", {}, !E.canFirearm(state))}`;
    bind($("firearm"));
    renderMission();
    renderRewards();
    renderMap();
    renderHand();
    inventory.render();
    renderDecisions();
    renderEnemies();
    $("huntLog").innerHTML = state.events
      .slice()
      .reverse()
      .map((e) => `<p><small>라운드 ${e.round}</small> ${esc(e.text)}</p>`)
      .join("");
  }
  function renderMission() {
    const view = missionView(), provisional = E.provisionalView ? E.provisionalView(state) : null;
    $("missionPanel").hidden = !view;
    $("modeLabel").textContent = view ? "기나긴 사냥 · 챕터 1" : "실제 지도 · 전투 연습";
    $("modeNotice").innerHTML = view
      ? `<strong>기나긴 사냥 · 챕터 1${view.won ? " 완수" : ""}</strong><span>${view.won ? "사냥을 완수했습니다. 상단의 저장 내보내기로 기록과 보상을 보관하세요. 챕터 2~3 전환은 다음 구현 단계입니다." : "공개된 임무를 따라 계몽을 모으고 사냥을 완수하세요. 챕터 1을 마치면 진행을 파일로 내보내 보관할 수 있습니다."}</span>`
      : "<strong>실제 지도 전투 연습</strong><span>이 사냥은 임무 없이 탐험·전투·꿈의 업그레이드를 연습하는 모드입니다. 새 사냥에서 기나긴 사냥 챕터 1을 선택할 수 있습니다.</span>";
    if (provisional) {
      $("modeLabel").textContent = `임시 구성물 시험 · ${provisional.name}`;
      $("modeNotice").innerHTML = `<strong>${esc(provisional.name)}${state.result === "provisional-win" ? " · 시험 완료" : provisional.npc ? " · 상호작용" : provisional.phase ? ` · ${esc(provisional.phase)}페이즈` : ""}</strong><span>${esc(provisional.notice)} 이 시험은 기나긴 사냥 캠페인과 별도로 진행하며 임시 작성된 구성물을 사용합니다.</span>`;
    }
    if (!view) return;
    $("missionInsight").textContent = `완료한 계몽 ${view.insight}장`;
    $("missionObjectives").innerHTML = view.objectives.filter((o) => o.status !== "미발견").map((o) => {
      const done = ["completed", "complete", "done", "완료"].includes(o.status),
        description = o.id === "main" && !view.revealed.includes(2) ? "계몽 2장 이상을 모은 뒤 중앙 등불 타일에서 이동을 마치세요." : o.description;
      return `<article class="mission-objective ${done ? "completed" : ""}"><b>${done ? "✓ " : ""}${esc(o.title)} <small>${esc(o.status)}</small></b><span class="muted">${esc(description || "")}</span></article>`;
    }).join("") || '<p class="muted">공개된 임무 카드에서 다음 목표를 확인하세요.</p>';
    $("missionTokens").innerHTML = view.tokens.map((t) => `<span class="mission-token">◆ ${esc(t.name)} · ${t.carrierId !== null && t.carrierId !== undefined ? "사냥꾼이 운반 중" : esc(nodeName(t.node))}</span>`).join("") + (view.targets || []).filter((t) => !t.complete).map((t) => `<span class="mission-token">◇ ${esc(window.BBLongHunt.cards.find((c) => c.number === t.card)?.title || "특수 적")} · 계몽 토큰 ${t.tokens}개</span>`).join("");
    $("missionFog").textContent = view.fog.length ? `안개 진입로 · ${view.fog.map((id) => M.tile(id)?.displayName || id).join(", ")}` : "";
    const actions = view.pending || state.rewardChoices?.length ? [] : (E.missionActions ? E.missionActions(state) : []);
    $("missionActions").innerHTML = actions.map((a) => commandButton(a)).join("");
    bind($("missionActions"));
    $("revealedCards").innerHTML = view.revealed.map((number) => {
      const card = window.BBLongHunt.cards.find((c) => c.number === number);
      if (!card) return "";
      const completed = view.completed.includes(number);
      return `<article class="revealed-card ${completed ? "completed" : ""}"><p class="eyebrow">${esc(card.type)} · 카드 ${number}${completed ? " · 완료" : ""}</p><h3>${esc(card.title)}</h3>${card.rules.map((r) => `<p>${esc(r)}</p>`).join("")}<details><summary>이 카드의 원본 사진</summary><a href="${photo(card.image)}" target="_blank"><img src="${photo(card.image)}" loading="lazy" alt="공개된 카드 ${number} · ${esc(card.title)}"></a></details></article>`;
    }).join("");
  }
  function renderRewards() {
    const view = E.rewardsView ? E.rewardsView(state) : null;
    $("rewardsPanel").hidden = !view;
    if (!view) return;
    const h = E.hunter(state), pending = !!view.choices.length;
    if (!view.rewards.some((r) => r.id === selectedReward && r.attackSelectable)) selectedReward = null;
    $("rewardsCount").textContent = `${view.rewards.length}장 · 사냥 도구 ${view.rewards.filter((r) => r.equipped && r.subtype === "tool").length}/2 · 카릴 문자 ${view.rewards.filter((r) => r.equipped && r.subtype === "rune").length}/2`;
    $("rewards").innerHTML = view.rewards.map((r) => {
      let actions = "";
      if (r.kind === "lantern" && r.equipped) {
        actions = `<label>이동할 등불<select id="rewardLamp-${r.id}">${E.nodes(state).filter((n) => n.lamp).map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join("")}</select></label><button data-reward-use="${r.id}" data-reward-kind="lantern" ${r.usable && !pending ? "" : "disabled"}>등불 사용</button>`;
      } else if (r.kind === "rune-eye" && r.equipped) {
        const cards = (list) => list.map((c) => `<option value="${c.id}">${esc(E.card(c).name)} · ${esc(c.id)}</option>`).join("");
        actions = `<label>버릴 손패<select id="rewardDiscard-${r.id}">${cards(h.hand)}</select></label><label>가져올 버림 카드<select id="rewardTake-${r.id}">${cards(h.discard)}</select></label><button data-reward-use="${r.id}" data-reward-kind="rune-eye" ${r.usable && h.hand.length && h.discard.length && !pending ? "" : "disabled"}>선택한 카드 교환</button>`;
      } else if (r.kind === "rune-rapture" && r.equipped) {
        actions = button("피의 기쁨 · 카드 1장, 치유 1", "USE_REWARD", { rewardId: r.id }, !r.usable || pending);
        if (r.usable) actions = '<p class="muted">지금 사용하거나 다른 행동을 하면 이 처치의 사용 기회가 끝납니다.</p>' + actions;
      }
      if (r.triggerSelectable)
        actions += button(r.triggerArmed ? "다음 죽음에 사용 선택 해제" : "다음 죽음에 달 문자 사용", "SET_REWARD_TRIGGER", { rewardId: r.id, enabled: !r.triggerArmed }, pending);
      if (r.reassignable && !pending)
        actions += `<p class="muted">변형 직후 · 혈석을 옮길 수 있습니다.</p><div class="actions">${E.slots(state).map((sl, slot) => button(`${slot + 1}번으로 옮기기`, "REASSIGN_REWARD", { rewardId: r.id, slot }, slot === r.slot)).join("")}</div>`;
      if (r.attackSelectable && !pending)
        actions += `<label class="checkrow"><input type="checkbox" data-reward-attack="${r.id}" ${selectedReward === r.id ? "checked" : ""}>다음 공격의 스탯 효과를 +1피해·방해로 대체</label>`;
      const status = !r.equipped ? "보관 중" : r.persistent ? `${r.slot + 1}번 공격 슬롯 · 지속 효과` : r.ready ? "장착 · 준비됨" : "장착 · 소진됨";
      return `<article class="reward-card"><p class="eyebrow">${r.subtype === "rune" ? "카릴 문자" : "사냥 도구"}</p><h3>${esc(r.name)}</h3><p class="reward-state ${!r.ready ? "spent" : ""}">${status}${r.triggerArmed ? " · 다음 죽음에 사용 선택됨" : ""}</p><p>${esc(r.rules)}</p>${actions ? `<div class="reward-actions">${actions}</div>` : ""}${r.photos?.length ? `<details><summary>보상 원본 사진</summary>${r.photos.map((p) => `<a href="${esc(p.path)}" target="_blank"><img src="${esc(p.path)}" loading="lazy" alt="${esc(r.name)} 원본 사진"></a>`).join("")}</details>` : ""}</article>`;
    }).join("") || '<p class="muted">보상은 임무를 완료하면 획득합니다.</p>';
    const owned = view.firearms.filter((g) => !g.equipped);
    if (owned.length) $("rewards").innerHTML += `<article class="reward-card"><p class="eyebrow">보관한 화기</p>${owned.map((g) => `<p>${esc(g.name)}</p>`).join("")}<p class="muted">화기는 획득할 때 또는 챕터 사이에 교체합니다.</p></article>`;
    bind($("rewards"));
    bindRewardAttack($("rewards"));
    $("rewards").querySelectorAll("[data-reward-use]").forEach((b) => b.onclick = () => {
      const id = b.dataset.rewardUse;
      send("USE_REWARD", b.dataset.rewardKind === "lantern"
        ? { rewardId: id, node: $("rewardLamp-" + id).value }
        : { rewardId: id, discardId: $("rewardDiscard-" + id).value, takeId: $("rewardTake-" + id).value });
    });
  }
  function bindRewardAttack(box) {
    box.querySelectorAll("[data-reward-attack]").forEach((b) => b.onchange = () => {
      selectedReward = b.checked ? b.dataset.rewardAttack : null;
      renderRewards();
      renderDecisions();
    });
  }
  function rewardChoiceHTML(view) {
    const choice = view.choices[0];
    if (choice.firearmId) {
      const g = view.firearms.find((g) => g.id === choice.firearmId);
      return `<div class="reward-pending"><h3>${esc(g?.name || choice.firearmId)} 획득</h3><p>지금 장착하거나 이후를 위해 보관하세요.</p><div class="actions">${button("화기 장착", "EQUIP_FIREARM", { firearmId: choice.firearmId }, false, "primary")}${button("화기 보관", "KEEP_FIREARM", { firearmId: choice.firearmId })}</div></div>`;
    }
    const r = view.rewards.find((r) => r.id === choice.rewardId);
    if (!r) return "";
    const current = view.rewards.filter((x) => x.equipped && x.subtype === r.subtype),
      replace = current.length >= 2 ? current : [null];
    const opts = replace.flatMap((old) => (r.persistent ? [0, 1, 2] : [null]).map((slot) => {
      const args = { rewardId: r.id };
      if (old) args.replaceId = old.id;
      if (slot !== null) args.slot = slot;
      return button(`${old ? esc(old.name) + "을 보관하고 " : ""}${slot !== null ? (slot + 1) + "번 슬롯에 " : ""}장착`, "EQUIP_REWARD", args, false, "primary");
    })).join("");
    return `<div class="reward-pending"><h3>${esc(r.name)} 획득</h3><p>${esc(r.rules)}</p><p class="muted">사냥 도구와 카릴 문자는 각각 2장까지 장착합니다. 보관한 카드는 챕터 사이에 교체할 수 있습니다.</p><div class="choice-grid">${opts}${button("이 보상 보관", "KEEP_REWARD", { rewardId: r.id })}</div></div>`;
  }
  function renderHand() {
    const h = E.hunter(state);
    $("handCount").textContent = `${h.hand.length}장`;
    $("hand").innerHTML =
      h.hand
        .map((c) => {
          const d = E.card(c);
          return `<button class="stat-card ${d.type} ${selectedCard === c.id ? "selected" : ""}" data-card="${c.id}" aria-pressed="${selectedCard === c.id}"><small>${esc(c.id)} · ${d.type === "strength" ? "근력" : d.type === "skill" ? "기술" : d.type === "endurance" ? "지구력" : "활력"}</small><b>${esc(d.name)}</b><span>${esc(d.text)}</span></button>`;
        })
        .join("") ||
      '<p class="muted">손패가 비었습니다. 차례를 마쳐 보충하세요.</p>';
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
    $("weaponFace").textContent = h.face ? "뒷면" : "앞면";
    $("weaponAbility").textContent = h.face
      ? "공격 전에 2칸 이내의 적을 원하는 만큼 자기 칸으로 이동시킬 수 있습니다."
      : "공격 속도로 1칸 이내의 다른 모든 적에게 피해 1.";
    $("slots").innerHTML = E.slots(state)
      .map(
        (sl, i) =>
          `<button class="hunt-slot ${selectedSlot === i ? "selected" : ""} ${h.slots[i] ? "occupied" : ""}" data-slot="${i}" aria-pressed="${selectedSlot === i}"><small>${i + 1}번 슬롯 · ${h.slots[i] ? "점유" : "비어 있음"}</small><b>${esc(sl.name)}</b><span>속도 ${sl.speed} · 피해 ${sl.damage}</span><small>${h.slots[i] ? esc(E.card(h.slots[i]).name) : "선택하여 공격 / 회피"}</small></button>`,
      )
      .join("");
    $("slots")
      .querySelectorAll("[data-slot]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedSlot = +b.dataset.slot;
            renderHand();
            renderDecisions();
          }),
      );
  }
  function renderDecisions() {
    const h = E.hunter(state),
      p = state.phase,
      c = state.combat,
      chosen = h.hand.find((x) => x.id === selectedCard),
      slot = E.slots(state)[selectedSlot],
      empty = !!slot && !h.slots[selectedSlot],
      canCommit = !!chosen && empty;
    const names = {
      hunter: "사냥꾼의 차례",
      move: "이동과 탐험",
      tile_place: "새 타일 배치",
      spawn_choice: "피규어 재배치",
      enemy_path: "적 이동 경로",
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
      mission_survivor: "구조한 생존자 이동",
      mission_choice: "임무의 선택",
      mission_death: "죽음 뒤의 회피",
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
      rewardIds: selectedReward ? [selectedReward] : [],
    };
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
      html = `<p class="muted">${esc(selectHint)}</p><div class="actions">${button("이동", "MOVE", { cardId: selectedCard }, !chosen)}${button("무기 변형", "TRANSFORM", { cardId: selectedCard }, !chosen)}${button("꿈으로 이동", "DREAM", { cardId: selectedCard }, !chosen)}${button("화기 다시 준비", "RELOAD", { cardId: selectedCard }, !chosen || h.firearmReady)}</div>`;
      const target = state.enemies.find((e) => e.id === selectedEnemy);
      html += checkPulls();
      if (target) {
        html += `<p>공격 대상 · ${esc(E.enemyDef(state, target).name)} #${target.figure} · 체력 ${target.hp}</p>`;
        const same = target.node === h.position || pulls.has(target.id),
          paths =
            chosen && E.card(chosen).leap && !selectedReward
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
      if (o.missionRescue)
        html += button("생존자 구조 · 상호작용", "INTERACT", { cardId: selectedCard, mission: "rescue" }, !chosen, "primary");
      if (o.loot || o.heal || o.teleport || o.provisionalNpc) {
        html += `<details><summary>상호작용 · 카드 1장</summary><p class="muted">같은 칸의 적들이 먼저 행동합니다. 이때 맞서 공격하거나 회피할 수 없습니다.</p>${o.provisionalNpc ? button("임시 NPC · 카드 1장을 버려 치유 2", "INTERACT", { cardId: selectedCard, provisionalNpc: true }, !chosen) : ""}${o.loot ? `<label>획득할 소모품 토큰<select id="lootCount">${Array.from({ length: o.loot + 1 }, (_, i) => `<option value="${i}" ${i === o.loot ? "selected" : ""}>${i}개</option>`).join("")}</select></label>` : ""}${o.heal ? '<label class="checkrow"><input id="tileHeal" type="checkbox" checked>대성당 · 치유 2</label>' : ""}${
          o.teleport
            ? `<label>중앙 등불 순간이동<select id="tileLamp"><option value="">사용하지 않음</option>${E.nodes(
                state,
              )
                .filter((n) => n.lamp)
                .map((n) => `<option value="${n.id}">${esc(n.name)}</option>`)
                .join("")}</select></label>`
            : ""
        }${o.loot || o.heal || o.teleport ? `<button id="interact" ${chosen ? "" : "disabled"}>상호작용 실행</button>` : ""}</details>`;
      }
      if (E.node(state, h.position).tile === "tile-20")
        html += button(
          "진료소 · 피해 1, 카드 1장",
          "CLINIC",
          {},
          state.clinicUsed,
        );
      html += button("사냥꾼 차례 마치기", "END_TURN");
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
      html = `<h3>${esc(t.displayName)}</h3><div class="rotation-preview"><img src="${photo(t.image)}" style="transform:rotate(${rotation * 90}deg)" alt="새 타일 방향"></div><div class="actions">${[0, 1, 2, 3].map((r) => `<button data-rotation="${r}" class="${rotation === r ? "primary" : ""}" ${opts.includes(r) ? "" : "disabled"}>${r * 90}°</button>`).join("")}</div>${button("이 방향으로 배치하고 진입", "PLACE_TILE", { rotation }, false, "primary")}`;
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
    } else if (p === "enemy_path") {
      help =
        "같은 조건의 경로가 여러 개입니다. 사냥꾼에게 가장 불리한 결과가 되도록 선택하세요.";
      html = E.moveOptions(state)
        .map((n) =>
          button(esc(E.node(state, n).name), "ENEMY_STEP", { node: n }),
        )
        .join("");
    } else if (p === "combat_choose") {
      help =
        "적 행동을 공개하기 전에 맞서 공격할 카드·슬롯과 공격용 소모품을 선택하세요.";
      html = `<p>${esc(selectHint)}</p>${checkPulls()}${button("맞서 공격", "COUNTER", actionArgs, !canCommit, "primary")}${button("공격하지 않고 행동 공개", "NO_ATTACK")}`;
    } else if (p === "combat_react" || p === "combat_extra") {
      const extra = p === "combat_extra";
      help = extra
        ? "첫 공격을 피했거나 방해했어도 별도의 속도 2 회피가 필요합니다."
        : "회피할 경우 손패의 회피 카드와 충분한 속도의 빈 슬롯을 선택하세요.";
      html = `<p>${esc(selectHint)}</p>${button(extra ? "추가 타격 회피" : "회피", extra ? "EXTRA_DODGE" : "DODGE", { cardId: selectedCard, slot: selectedSlot }, !E.canDodge(state, selectedCard, selectedSlot, extra))}`;
      if (!extra)
        html += button(
          "화기 사용 · 기본 공격 방해",
          "FIREARM",
          {},
          !E.canFirearm(state),
        );
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
      help = "현재 활성화 순위의 적들 중 먼저 행동할 피규어를 선택하세요.";
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
        `<label>무기 형태<select id="returnFace"><option value="0">앞면</option><option value="1">뒷면</option></select></label>` +
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
            `${esc(D.consumables[x.kind].name)}<small>${esc(D.consumables[x.kind].rules)}</small>`,
            "LOOT_CHOICE",
            { itemId: x.id },
          ),
        )
        .join("");
    } else if (["mission_survivor", "mission_choice", "mission_death"].includes(p)) {
      const pending = missionView()?.pending;
      help = pending ? pending.title + (pending.type === "survivor-move" ? ` · 남은 이동력 ${pending.remaining}` : "") : "임무의 다음 선택을 진행하세요.";
      html = (pending?.options || (E.missionActions ? E.missionActions(state) : [])).map((a) => commandButton(a, "primary")).join("");
    } else if (p === "over") {
      const won = state.result === "chapter-win" || missionView()?.won,
        trialWon = state.result === "provisional-win";
      help = trialWon
        ? "임시 적 시험을 완료했습니다. 이 결과는 기나긴 사냥의 정식 챕터 완료와 별개입니다. 시험 기록을 저장하거나 새 사냥에서 다음 모드를 선택하세요."
        : won
        ? "기나긴 사냥 챕터 1을 완수했습니다. 기록과 보상을 저장으로 내보내세요. 챕터 2~3 전환은 다음 구현 단계입니다."
        : "사냥이 종료되었습니다. 상단의 새 사냥으로 다시 시작할 수 있습니다.";
      if (won || trialWon) {
        $("phaseTitle").textContent = trialWon ? "임시 적 시험 완료" : "챕터 1 완수";
        html = `<button id="exportChapterSave" class="primary">${trialWon ? "시험 결과" : "완료한 사냥"} 저장 내보내기</button>`;
      }
    }
    if (["hunter", "combat_choose"].includes(p) && inventory.names().length)
      html += `<p class="muted">공격에 함께 사용: ${inventory.names().map(esc).join(", ")}</p>`;
    const rewards = E.rewardsView ? E.rewardsView(state) : null;
    if (["hunter", "combat_choose"].includes(p) && rewards)
      html += rewards.rewards.filter((r) => r.attackSelectable).map((r) => `<label class="checkrow"><input type="checkbox" data-reward-attack="${r.id}" ${selectedReward === r.id ? "checked" : ""}>${esc(r.name)} · 스탯 효과를 +1피해·방해로 대체</label>`).join("");
    if (rewards?.choices.length) {
      $("phaseTitle").textContent = "획득한 보상 선택";
      help = "다음 행동 전에 보상의 장착·슬롯·보관을 결정하세요.";
      html = rewardChoiceHTML(rewards);
    }
    $("phaseHelp").textContent = help;
    $("decisions").innerHTML = html;
    bind($("decisions"));
    bindRewardAttack($("decisions"));
    if ($("exportChapterSave")) $("exportChapterSave").onclick = () => $("save").click();
    $("combatInfo").innerHTML = c
      ? `<div class="combat-card"><b>${esc(state.enemies.some((e) => e.id === c.enemyId) ? E.enemyDef(state, state.enemies.find((e) => e.id === c.enemyId)).name : "처치된 적")}</b><p>${c.action ? `${esc(ED.labels[c.action.kind])} · ${esc(c.action.name)}${c.action.speed !== null ? " · 속도 " + c.action.speed : ""}${c.action.damage !== undefined ? " · 피해 " + c.action.damage : ""}` : "적 행동 공개 전"}</p>${c.action?.rules?.length ? `<p>${c.action.rules.map(esc).join("<br>")}</p>` : ""}<small>${c.attack ? `사냥꾼 공격 · 속도 ${c.attack.speed} / 피해 ${c.attack.damage}` : "사냥꾼 공격 없음"} · 방어 ${c.defense}${c.dodged ? " · 회피 선택됨" : ""}${c.cancelEnemy ? " · 적 공격 방해됨" : ""}${c.noDodge ? " · 회피 불가" : ""}</small></div>`
      : "";
    $("deckStatus").innerHTML =
      `<p>공용 적 행동 덱 ${state.enemyDeck.length}장 · 버림 ${state.enemyDiscard.length}장<br>마지막 공개: ${ED.labels[state.enemyDiscard.at(-1)] || "없음"}</p>`;
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
    if ($("interact"))
      $("interact").onclick = () =>
        send("INTERACT", {
          cardId: selectedCard,
          lootCount: +($("lootCount")?.value || 0),
          heal: !!$("tileHeal")?.checked,
          lamp: $("tileLamp")?.value || null,
        });
  }
  function renderEnemies() {
    $("setupInfo").textContent =
      `시드 ${state.initialSeed} · 새 사냥마다 배정 · 초기화 시 유지`;
    const attack = (a) =>
      `${esc(a.name)} · 속도 ${a.speed} / 피해 ${a.damage}${a.keywords.length ? " · " + a.keywords.map(esc).join(" · ") : ""}${a.rules.length ? "<br>" + a.rules.map(esc).join("<br>") : ""}`;
    $("chapterEnemies").innerHTML = state.world.assignments
      .map((a) => {
        const d = E.enemyDef(state, a.enemyId),
          f = d.face;
        return `<article class="assignment" style="--marker:${colors[a.marker]}"><span class="marker">${a.slot}순위 · ${a.marker === "gold" ? "금색" : a.marker === "red" ? "적갈색" : "보라색"} 마커</span><h3>${esc(d.name)} ${f.label}</h3><p>체력 ${d.health} · 지도 위 ${state.enemies.filter((e) => e.kind === a.enemyId).length} / 4개 · 이동 ${d.move}</p><dl><dt>기본 공격</dt><dd>${attack(f.basicAttack)}</dd><dt>특수 공격</dt><dd>${attack(f.specialAttack)}</dd><dt>전용 능력 · ${esc(f.ability.name)}</dt><dd>${f.ability.rules.map(esc).join("<br>")}</dd></dl><details><summary>원본 사진</summary><a href="${photo(f.image)}" target="_blank"><img src="${photo(f.image)}" loading="lazy" alt="${esc(d.name)} ${f.label}"></a></details></article>`;
      })
      .join("");
  }
  const coords = {
    left: [20, 50],
    center: [50, 50],
    right: [80, 50],
    top: [50, 20],
    middle: [50, 50],
    bottom: [50, 80],
    "upper-left": [28, 25],
    "upper-right": [73, 25],
    "lower-left": [28, 75],
    "lower-right": [73, 75],
    "middle-left": [26, 50],
    "middle-right": [74, 50],
    room: [50, 23],
    entry: [50, 78],
    street: [50, 23],
    house: [50, 78],
  };
  function point(id, r) {
    let [x, y] = coords[id] || [50, 50];
    for (let i = 0; i < r; i++) [x, y] = [100 - y, x];
    return [x, y];
  }
  function tileHTML(p, ghost = false) {
    const def = M.tile(p.tileId),
      reachable = E.neighbors(state, E.hunter(state).position),
      mission = missionView(),
      currentTile = E.node(state, E.hunter(state).position)?.tile,
      currentFog = !!mission?.fog.includes(currentTile),
      fog = !ghost && !!mission?.fog.includes(p.tileId);
    const lines = def.adjacency
      .map(([a, b]) => {
        const [x, y] = point(a, p.rotation),
          [xx, yy] = point(b, p.rotation);
        return `<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}"/>`;
      })
      .join("");
    return `<div class="tile-cell ${ghost ? "ghost" : ""} ${fog ? "fog-tile" : ""}" data-tile="${p.tileId}"><img class="tile-photo" src="${photo(def.image)}" alt="" style="transform:rotate(${p.rotation * 90}deg)"><div class="tile-name"><a href="${photo(def.image)}" target="_blank">${esc(def.displayName)} ↗</a><span>${ghost ? "미리보기" : fog ? "안개" : p.rotation * 90 + "°"}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${def.spaces
      .map((n) => {
        const id = `${p.tileId}:${n.id}`,
          [x, y] = point(n.id, p.rotation),
          here = id === E.hunter(state).position,
          reach = !ghost && state.phase === "move" && reachable.includes(id) && (!currentFog || p.tileId === currentTile),
          loot = state.loot.filter((l) => l === id).length,
          figures = state.enemies.filter((f) => f.node === id),
          tokens = !ghost ? (mission?.tokens || []).filter((t) => t.node === id || (t.carrierId === state.activeHunterId && here)) : [];
        const icons = n.icons.filter((i) => i.kind === "lamp").length
          ? "✦ "
          : "";
        return `<button class="space ${here ? "here" : ""} ${reach ? "reachable" : ""} ${ghost ? "ghost-space" : ""}" style="left:${x}%;top:${26 + y * 2.38}px" data-command="STEP" data-args="${esc(JSON.stringify({ node: id }))}" ${reach ? "" : "disabled"} title="${esc(n.placeName || n.label)}${ghost ? " · 배치 예정" : ""}">${here ? "● 사냥꾼<br>" : ""}${icons}${esc(n.placeName || n.label)}${loot ? "<small>◇ × " + loot + "</small>" : ""}${tokens.map((t) => `<small class="map-mission-token">◆ ${esc(t.name)}</small>`).join("")}${figures
          .map((f) => {
            const a = state.world.assignments.find((a) => a.enemyId === f.kind);
            return `<span class="token" style="--marker:${colors[a?.marker] || colors.gold}" title="${esc(E.enemyDef(state, f).name)} #${f.figure}">${f.missionId || f.provisionalKind || !a ? "★" : ["①", "②", "③"][a.slot - 1]} #${f.figure}</span>`;
          })
          .join("")}</button>`;
      })
      .join("")}${M.exits(p)
      .map(
        (e) =>
          `<span class="exit-tick exit-${e.edge}" title="${directionNames[e.edge]} 출입구">${{ N: "↑", S: "↓", W: "←", E: "→" }[e.edge]}</span>`,
      )
      .join("")}</div>`;
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
    $("chapterMap").style.gridTemplateColumns =
      `repeat(${maxX - minX + 1},290px)`;
    $("chapterMap").innerHTML = html;
    bind($("chapterMap"));
    $("tileCount").textContent =
      `공개 ${state.world.tiles.length + (state.world.pending ? 1 : 0)} / 7 · 더미 ${state.world.tileDeck.length}`;
    const n = E.nodes(state).find((n) => n.id === E.hunter(state).position),
      def = n ? M.tile(n.tileId) : null;
    $("locationText").innerHTML = n
      ? `<b>현재 위치 · ${esc(n.name)}</b>${def.rules.length ? '<p class="muted">' + def.rules.map(esc).join(" ") + "</p>" : ""}${def.id === "tile-07" ? '<p class="muted">이 타일의 소모품 교환 효과는 아직 미처리입니다.</p>' : ""}`
      : "<b>현재 위치 · 사냥꾼의 꿈</b>";
    $("nearEnemies").innerHTML = state.enemies
      .map(
        (e) =>
          `<div class="hunt-enemy ${selectedEnemy === e.id ? "selected" : ""}"><span>${esc(E.enemyDef(state, e).name)} #${e.figure} · ${esc(E.node(state, e.node).name)}<br>체력 ${e.hp} / ${E.enemyDef(state, e).maxHp} · ${E.hunter(state).inDream ? "" : E.distance(state, E.hunter(state).position, e.node) + "칸 거리"}</span><button data-enemy="${e.id}">대상 선택</button></div>`,
      )
      .join("");
    $("nearEnemies")
      .querySelectorAll("[data-enemy]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedEnemy = b.dataset.enemy;
            renderMap();
            renderDecisions();
          }),
      );
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
    const focus = $("chapterMap").querySelector(
        ghost ? ".ghost" : ".space.here",
      ),
      viewport = $("mapViewport");
    if (focus) {
      const r = focus.getBoundingClientRect(),
        v = viewport.getBoundingClientRect();
      if (r.left < v.left + 12 || r.right > v.right - 12)
        viewport.scrollLeft += (r.left + r.right - v.left - v.right) / 2;
      if (r.top < v.top + 12 || r.bottom > v.bottom - 12)
        viewport.scrollTop += (r.top + r.bottom - v.top - v.bottom) / 2;
    }
  }

  $("save").onclick = () => {
    const blob = new Blob([E.exportSave(state)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    const provisional = E.provisionalView ? E.provisionalView(state) : null;
    a.download = `bloodborne-v06-${missionView() ? "campaign-ch1" : provisional ? "trial-" + provisional.componentId : "practice"}-${state.initialSeed}-r${state.round}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("load").onclick = () => $("file").click();
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      state = E.importSave(await f.text());
      selectedCard = null;
      selectedReward = null;
      pulls.clear();
      inventory.clear();
      save();
      render();
      $("error").textContent = "";
    } catch (x) {
      $("error").textContent = x.message;
    }
    e.target.value = "";
  };
  $("gun").innerHTML = Object.entries(D.firearms)
    .map(
      ([id, g]) =>
        `<option value="${id}">${esc(g.name)}${id === "hunter-pistol" ? "" : " · 임시 단총 능력"}</option>`,
    )
    .join("");
  try { $("restoreV05").hidden = !localStorage.getItem(oldKey); } catch { /* File save remains available. */ }
  $("restoreV05").onclick = () => {
    try {
      const saved = localStorage.getItem(oldKey);
      if (!saved) throw new Error("이 브라우저에 v0.5 자동 저장이 없습니다.");
      state = E.importSave(saved);
      selectedCard = null;
      selectedSlot = 0;
      selectedReward = null;
      selectedEnemy = null;
      pulls.clear();
      inventory.clear();
      save();
      render();
      $("error").textContent = "";
    } catch (e) { $("error").textContent = e.message; }
  };
  $("startingItem").innerHTML += Object.values(D.consumables)
    .filter((x) => x.runtime === "playable")
    .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
    .join("");
  $("new").onclick = () => {
    $("seed").value = Date.now() % 4294967295;
    $("setupError").textContent = "";
    $("setupDialog").showModal();
  };
  $("cancelSetup").onclick = () => $("setupDialog").close();
  $("confirmSetup").onclick = () => {
    try {
      state = E.create(
        +$("seed").value,
        "burial",
        +$("face").value,
        $("startingItem").value || null,
        $("gun").value,
        $("start").value,
        { campaign: $("playMode").value === "campaign",
          ...(!["campaign", "practice"].includes($("playMode").value) ? { provisional: $("playMode").value } : {}) },
      );
      selectedCard = null;
      selectedSlot = 0;
      selectedReward = null;
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
  render();
  if (startupError) $("error").textContent = startupError;
  else save();
})();
