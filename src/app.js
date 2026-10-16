(function () {
  "use strict";
  const E = window.BBEngine,
    D = E.data,
    $ = (id) => document.getElementById(id),
    key = "bloodborne-solo-consumables-v03";
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
  const symbols = { endurance: "◈", skill: "✧", strength: "◆", vitality: "♡" },
    speed = (n) => (n >= 3 ? "빠름" : n === 2 ? "보통" : "느림");
  let state = E.create(),
    selectedCard = null,
    selectedSlot = null,
    selectedEnemy = null,
    discards = new Set(),
    selectedPull = new Set(),
    startupError = "";
  try {
    const saved = localStorage.getItem(key);
    if (saved) state = E.importSave(saved);
  } catch {
    startupError =
      "이전 자동 저장을 읽지 못했습니다. 새 훈련으로 열었습니다. 내보낸 저장 파일이 있다면 불러오세요.";
  }
  function send(type, extra = {}) {
    try {
      state = E.dispatch(state, {
        type,
        hunterId: state.activeHunterId,
        ...extra,
      });
      selectedCard = null;
      selectedSlot = null;
      discards.clear();
      selectedPull.clear();
      inventory.clear();
      saveLocal();
      render();
    } catch (e) {
      $("error").textContent = e.message;
    }
  }
  function saveLocal() {
    try {
      localStorage.setItem(key, E.exportSave(state));
      $("saveStatus").textContent = "현재 브라우저에 자동 저장됨";
    } catch {
      $("saveStatus").textContent =
        "자동 저장 불가 · 저장 내보내기를 이용하세요";
    }
  }
  const h = () => E.hunter(state);
  const inventory = window.BBInventory({
    E,
    getState: () => state,
    send,
    refresh: renderDecisions,
  });
  function button(label, type, extra = {}, disabled = false, cls = "") {
    return `<button data-command="${type}" data-extra="${esc(JSON.stringify(extra))}" ${disabled ? "disabled" : ""} class="${cls}">${label}</button>`;
  }
  function bindCommands(container) {
    container
      .querySelectorAll("[data-command]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            send(b.dataset.command, JSON.parse(b.dataset.extra))),
      );
  }
  function selectedArgs() {
    return {
      cardId: selectedCard,
      slot: selectedSlot,
      enemyId: selectedEnemy,
      pullIds: [...selectedPull],
      itemIds: inventory.ids(),
    };
  }
  function firearmAvailability() {
    const p = h(),
      c = state.combat;
    const chosen = p.hand.find((card) => card.id === selectedCard);
    const canFire = E.canFirearm(state);
    const canReload = !p.firearmReady && state.phase === "hunter" && !!chosen;
    let hint;
    if (state.phase === "over") hint = "훈련이 종료되었습니다.";
    else if (!p.firearmReady) {
      if (state.phase !== "hunter")
        hint =
          "현재는 소진 상태입니다. 자신의 사냥꾼 차례에 다시 준비할 수 있습니다.";
      else if (!p.hand.length)
        hint =
          "다시 준비하려면 손의 카드 1장이 필요합니다. 현재 손패가 없습니다.";
      else if (!chosen) hint = "아래 손패에서 버릴 카드 1장을 선택하세요.";
      else
        hint = `‘${E.card(chosen).name}’ 1장을 버리고 준비합니다. 카드 효과는 적용되지 않습니다.`;
    } else if (canFire)
      hint =
        "지금 사용하면 공개된 적의 기본 공격을 방해하고 화기가 소진됩니다.";
    else if (state.phase === "combat_react" && c?.cancelEnemy)
      hint = "적의 공격이 이미 취소되어 사용할 필요가 없습니다.";
    else if (state.phase === "combat_react" && c?.action?.kind === "special")
      hint = "지금 공개된 특수 공격에는 사용할 수 없습니다.";
    else if (state.phase === "combat_react" && c?.action?.kind === "ability")
      hint = "지금 공개된 전용 능력에는 사용할 수 없습니다.";
    else
      hint = "준비되어 있습니다. 적의 기본 공격이 공개되면 사용할 수 있습니다.";
    const fireLabel = canFire
      ? "화기 사용 · 기본 공격 방해"
      : c?.shot
        ? "화기 사용 완료"
        : c?.action?.kind === "special"
          ? "사용 불가 · 특수 공격"
          : c?.action?.kind === "ability"
            ? "사용 불가 · 전용 능력"
            : "화기 대기 · 기본 공격 전용";
    return { canFire, canReload, hint, fireLabel };
  }
  function renderFirearm() {
    const p = h(),
      f = E.firearm(state),
      availability = firearmAvailability();
    $("firearmTitle").textContent =
      f.name + (f.temporary ? " · 단총 능력 임시 적용" : "");
    $("firearmState").textContent = p.firearmReady ? "준비됨" : "소진됨";
    $("firearmState").dataset.state = p.firearmReady ? "ready" : "spent";
    $("firearmPanel").dataset.state = p.firearmReady ? "ready" : "spent";
    $("firearmAbility").textContent = f.ability;
    $("firearmUseNote").textContent = f.useNote;
    $("firearmReadyRule").textContent = f.readyRule;
    $("firearmDreamRule").textContent = f.dreamRule;
    $("firearmHint").textContent = availability.hint;
    $("firearmActions").innerHTML = p.firearmReady
      ? button(
          availability.fireLabel,
          "FIREARM",
          {},
          !availability.canFire,
          "primary",
        )
      : button(
          "카드 1장 버리고 화기 준비",
          "RELOAD",
          { cardId: selectedCard },
          !availability.canReload,
          "primary",
        );
    $("firearmActions")
      .querySelector("button")
      .setAttribute("aria-describedby", "firearmHint");
    bindCommands($("firearmActions"));
  }
  function render() {
    const p = h(),
      phase = state.phase,
      local = state.enemies.filter(
        (e) => e.node === p.position || selectedPull.has(e.id),
      );
    if (!local.some((e) => e.id === selectedEnemy))
      selectedEnemy = local[0]?.id || null;
    if (!p.hand.some((c) => c.id === selectedCard)) selectedCard = null;
    if (selectedSlot !== null && p.slots[selectedSlot]) selectedSlot = null;
    $("error").textContent = "";
    $("roundLabel").textContent =
      `라운드 ${state.round} · ${state.track} / ${D.track.length}`;
    $("track").innerHTML = Array.from(
      { length: D.track.length },
      (_, i) =>
        `<div class="tick ${D.track.resets.includes(i + 1) ? "reset" : ""} ${i + 1 < state.track ? "past" : ""} ${i + 1 === state.track ? "current" : ""}" title="${D.track.resets.includes(i + 1) ? "지도 초기화" : "사냥 트랙"} ${i + 1}">${i + 1 === state.track ? "✦ " : ""}${i + 1}</div>`,
    ).join("");
    $("lastRound").textContent = state.lastRound
      ? "마지막 라운드 · 차례 종료 전 목표 달성"
      : state.track === D.track.length
        ? "다음 라운드가 마지막 라운드입니다."
        : "꿈 입장과 새 라운드마다 1칸 전진";
    $("positionBadge").textContent = p.inDream
      ? "사냥꾼의 꿈"
      : E.node(p.position).name;
    const svg = D.edges
      .map(([a, b]) => {
        const x = E.node(a),
          y = E.node(b);
        return `<line x1="${x.x}" y1="${x.y}" x2="${y.x}" y2="${y.y}"/>`;
      })
      .join("");
    $("map").innerHTML =
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg><span class="tile-label" style="left:9%;top:26%">중앙 구역</span><span class="tile-label" style="left:43%;top:0%">마당 구역</span><span class="tile-label" style="left:65%;top:92%">봉인 구역</span>` +
      D.nodes
        .map((n) => {
          const reach =
              phase === "move" && E.neighbors(p.position).includes(n.id),
            enemyHere = state.enemies.filter((e) => e.node === n.id);
          return `<button class="map-node ${n.id === p.position ? "here" : ""} ${reach ? "reachable" : ""}" style="left:${n.x}%;top:${n.y}%" data-node="${n.id}" ${reach ? "" : 'aria-disabled="true"'} title="${esc(n.name)} / ${n.tile}">${n.lamp ? "✦ " : ""}${esc(n.name)}<div class="node-icons">${n.id === p.position ? '<span class="h-token">● 사냥꾼</span>' : ""}${enemyHere.map((e) => `<span class="e-token">◆ ${e.hp}</span>`).join("")}${state.loot.includes(n.id) ? "<span>◇</span>" : ""}</div></button>`;
        })
        .join("");
    $("map")
      .querySelectorAll("[data-node]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (phase === "move") send("STEP", { node: b.dataset.node });
          }),
      );
    $("enemies").innerHTML =
      state.enemies
        .map((e) => {
          const d = D.enemies[e.kind];
          return `<button class="enemy-card ${selectedEnemy === e.id ? "selected" : ""}" data-enemy="${e.id}" title="같은 칸의 적을 공격 대상으로 선택"><div class="row"><b>${esc(d.name)}</b><span>체력 ${e.hp}/${d.maxHp}</span></div><div class="attacks">${esc(E.node(e.node).name)} · 활성화 순서 ${d.order}<br>기본 ${speed(d.basic.speed)} / 피해 ${d.basic.damage} · 특수 ${speed(d.special.speed)} / 피해 ${d.special.damage}<br>특수 효과: ${d.special.poison ? "독" : "기절"} · 전용 능력: ${esc(d.ability.name)}</div></button>`;
        })
        .join("") || '<p class="muted">사냥터에 남아 있는 적이 없습니다.</p>';
    $("enemies")
      .querySelectorAll("[data-enemy]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedEnemy = b.dataset.enemy;
            render();
          }),
      );
    $("mission").innerHTML = [
      ["훈련 파수꾼 처치", state.mission.guardDown],
      ["봉인 제단에서 상호작용", state.mission.seal],
      ["시작 등불에서 상호작용", state.result === "win"],
    ]
      .map(
        ([t, done]) =>
          `<li class="${done ? "done" : ""}">${done ? "✓ " : ""}${t}</li>`,
      )
      .join("");
    $("status").innerHTML =
      `<p class="eyebrow">HUNTER STATUS</p><div class="status-grid"><div><small>체력</small><strong class="hp">${p.hp} <small>/ 6</small></strong></div><div><small>피의 유지</small><strong>${p.echoes} <small>/ 3</small></strong></div><div><small>${esc(E.firearm(state).name)}</small><strong style="font-size:14px">${p.firearmReady ? "준비됨" : "소진됨"}</strong></div><div><small>보유 소모품</small><strong style="font-size:14px">${p.consumables.length}장</strong></div></div><div class="status-line">${p.status.poison ? '<span class="badge">독 · 차례 종료 피해 1</span>' : ""}${p.status.frenzy ? '<span class="badge">발광 · 받는 공격 피해 +1</span>' : ""}${!p.status.poison && !p.status.frenzy ? '<span class="badge">상태 이상 없음</span>' : ""}</div>`;
    $("handCount").textContent = `${p.hand.length}`;
    $("deckCount").textContent =
      `덱 ${p.deck.length} · 버림 ${p.discard.length} · 슬롯 ${p.slots.filter(Boolean).length}`;
    $("handHelp").textContent =
      phase === "refill"
        ? "버리고 싶은 카드를 여러 장 선택한 뒤 손패를 보충하세요. 모두 유지해도 됩니다."
        : phase === "stun"
          ? "기절로 버릴 카드 1장을 선택하세요."
          : "행동에 사용할 카드를 먼저 선택하세요. 카드 효과는 공격·회피 슬롯에 놓을 때만 적용됩니다.";
    $("hand").innerHTML =
      p.hand
        .map((c) => {
          const def = E.card(c),
            chosen =
              phase === "refill" ? discards.has(c.id) : selectedCard === c.id;
          return `<button class="stat-card ${def.type} ${chosen ? "selected" : ""}" data-card="${esc(c.id)}" aria-pressed="${chosen}"><span class="symbol">${symbols[def.type]}</span><b>${esc(def.name)}</b><p>${esc(def.text)}</p><small>${chosen ? (phase === "refill" ? "버릴 카드" : "선택됨") : "STAT CARD"}</small></button>`;
        })
        .join("") ||
      '<p class="muted">손패가 없습니다. 차례를 마치거나 진행 중인 단계를 해결하세요.</p>';
    $("hand")
      .querySelectorAll("[data-card]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            if (phase === "refill") {
              discards.has(b.dataset.card)
                ? discards.delete(b.dataset.card)
                : discards.add(b.dataset.card);
            } else
              selectedCard =
                selectedCard === b.dataset.card ? null : b.dataset.card;
            render();
          }),
      );
    $("weaponTitle").textContent =
      `${E.weapon(state).name} · ${E.weaponFace(state).name}`;
    $("weaponAbility").textContent =
      E.weaponFace(state).text || "능력 없는 테스트용 무기입니다.";
    $("slots").innerHTML = E.slots(state)
      .map(
        (s, i) =>
          `<button class="slot ${p.slots[i] ? "occupied" : ""} ${selectedSlot === i ? "selected" : ""}" data-slot="${i}" ${p.slots[i] ? "disabled" : ""}><span class="speed">${"›".repeat(s.speed)} ${speed(s.speed)}</span><b>${s.name}</b><p>피해 <em>${s.damage}</em></p><div class="occupant">${p.slots[i] ? esc(E.card(p.slots[i]).name) : selectedSlot === i ? "✓ 선택한 슬롯" : "빈 슬롯"}</div></button>`,
      )
      .join("");
    $("slots")
      .querySelectorAll("[data-slot]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selectedSlot =
              selectedSlot === +b.dataset.slot ? null : +b.dataset.slot;
            render();
          }),
      );
    renderFirearm();
    const ED = window.BBEnemyDeck,
      used = ED.counts(state.enemyDiscard);
    $("enemyDeckStatus").innerHTML =
      `<h3>공용 적 행동 덱 · 남은 ${state.enemyDeck.length}장</h3><p>기본 3장 · 특수 2장 · 전용 능력 1장</p><div class="deck-kinds">${Object.entries(
        ED.composition,
      )
        .map(
          ([kind, total]) =>
            `<span>${ED.labels[kind]}<b>사용 ${used[kind]} / ${total}</b></span>`,
        )
        .join(
          "",
        )}</div><p class="muted">공개 순서: ${state.enemyDiscard.map((kind) => ED.labels[kind]).join(" → ") || "아직 없음"}</p><small>덱이 비고 다음 카드를 뽑을 때 버린 6장을 섞습니다. 지도 초기화로는 섞지 않습니다.</small>`;
    inventory.render();
    renderDecisions();
    $("log").innerHTML = state.events
      .map((e) => `<p><span>ROUND ${e.round}</span>${esc(e.text)}</p>`)
      .reverse()
      .join("");
  }
  function renderDecisions() {
    const p = h(),
      phase = state.phase,
      c = state.combat,
      args = selectedArgs(),
      hasCard = !!selectedCard,
      hasSlot = selectedSlot !== null;
    let title = "",
      hint = "",
      controls = "",
      combat = "",
      kicker = "YOUR CHOICE",
      cost = "";
    if (phase === "hunter") {
      title = "사냥꾼의 차례";
      hint =
        "① 아래에서 스탯 카드 선택 → ② 행동 선택. 공격은 같은 칸의 적과 빈 무기 슬롯도 선택하세요.";
      cost = "행동당 스탯 카드 1장";
      controls =
        button("이동 · 최대 2칸", "MOVE", args, !hasCard, "primary") +
        button(
          selectedPull.size ? "선택한 적을 끌어온 뒤 공격" : "공격",
          "ATTACK",
          args,
          !hasCard || !hasSlot || !selectedEnemy,
        ) +
        button(
          "상호작용",
          "INTERACT",
          args,
          !hasCard ||
            !(
              state.loot.includes(p.position) ||
              (p.position === "e1" &&
                state.mission.guardDown &&
                !state.mission.seal) ||
              (p.position === "c0" && state.mission.seal)
            ),
        ) +
        button("무기 변형", "TRANSFORM", args, !hasCard) +
        button(
          "화기 준비 · 카드 1장",
          "RELOAD",
          args,
          !firearmAvailability().canReload,
        ) +
        button("꿈에 입장", "DREAM", args, !hasCard) +
        button("차례 종료", "END_TURN", {}, false, "danger");
    } else if (phase === "move") {
      title = `이동 중 · ${state.move.remaining}칸 남음`;
      hint =
        "사냥터에서 밝게 표시된 인접 칸을 누르세요. 이동을 끝내면 조건에 해당하는 적이 1칸 추격합니다.";
      controls = button("여기서 이동 종료", "STOP_MOVE", {}, false, "primary");
      cost = "스탯 카드 지불 완료";
    } else if (phase === "combat_choose") {
      title = "적이 공격해 옵니다";
      hint =
        "적 행동을 보기 전에 공격 카드와 빈 슬롯을 선택하세요. 공격하지 않고 회피 기회만 기다릴 수도 있습니다.";
      controls =
        button(
          "선택한 카드로 맞서 공격",
          "COUNTER",
          args,
          !hasCard || !hasSlot,
          "primary",
        ) + button("공격하지 않고 적 행동 공개", "NO_ATTACK");
    } else if (phase === "combat_react") {
      title =
        c.origin === "interaction"
          ? "상호작용 전 · 적의 공격"
          : "적 행동 공개 · 대응 선택";
      hint =
        c.origin === "interaction"
          ? "상호작용 도중에는 공격·회피할 수 없습니다. 조건이 맞으면 화기를 사용할 수 있습니다."
          : c.action.kind === "ability"
            ? "전용 능력의 즉시 효과가 적용되었습니다. 이번 전용 능력은 회피·방해할 수 없습니다."
            : "회피 카드를 적 공격 이상의 속도를 가진 빈 슬롯에 놓을 수 있습니다. 화기는 기본 공격을 자동으로 방해합니다.";
      const chosen = p.hand.find((x) => x.id === selectedCard),
        canDodge =
          c.origin !== "interaction" &&
          c.action.kind !== "ability" &&
          !c.cancelEnemy &&
          !c.dodged &&
          chosen &&
          E.card(chosen).dodge &&
          hasSlot &&
          E.slots(state)[selectedSlot].speed >= c.action.speed;
      controls =
        button(
          c.dodged ? "회피 완료" : "선택한 카드·슬롯으로 회피",
          "DODGE",
          args,
          !canDodge,
        ) +
        button(
          firearmAvailability().fireLabel,
          "FIREARM",
          {},
          !firearmAvailability().canFire,
        ) +
        button("전투 해결", "RESOLVE", {}, false, "primary");
    } else if (phase === "stun") {
      title = "기절 · 버릴 카드를 선택하세요";
      hint = "기절 효과를 먼저 해결한 뒤, 남은 속도의 공격을 계속 처리합니다.";
      controls = button(
        "선택한 카드 버리기",
        "STUN_DISCARD",
        args,
        !hasCard,
        "primary",
      );
    } else if (phase === "activation") {
      title = "적 활성화";
      hint =
        "표시된 순서의 적을 선택하세요. 이동과 전투 개시는 자동으로 처리됩니다.";
      controls = E.eligible(state)
        .map((e) =>
          button(
            `${D.enemies[e.kind].order} · ${esc(D.enemies[e.kind].name)} 활성화`,
            "ACTIVATE",
            { enemyId: e.id },
            false,
            "primary",
          ),
        )
        .join("");
      cost = "스탯 카드 비용 없음";
    } else if (phase === "refill") {
      title = `라운드 ${state.round} · 손패 보충`;
      hint =
        "손에서 원하는 만큼 카드를 버릴 수 있습니다. 보충 버튼을 누르면 손패가 3장이 될 때까지 뽑습니다. 무기 슬롯은 유지됩니다.";
      controls = button(
        discards.size ? `${discards.size}장 버리고 보충` : "모두 유지하고 보충",
        "REFILL",
        { discardIds: [...discards] },
        false,
        "primary",
      );
      cost = "사냥 트랙 전진 완료";
    } else if (phase === "return") {
      title = "사냥꾼의 꿈에서 귀환";
      hint =
        "이번 버전의 등불은 시작 등불 한 곳입니다. 귀환 시 사용할 무기 형태를 선택하세요.";
      controls = E.weapon(state)
        .faces.map((f, i) =>
          button(
            `${f.name}으로 귀환`,
            "RETURN",
            { node: "c0", face: i },
            false,
            i === 0 ? "primary" : "",
          ),
        )
        .join("");
    } else if (phase === "upgrade_pick") {
      title = `꿈 · 업그레이드 선택 (${state.dream.credit}장 남음)`;
      hint =
        "피의 유지를 모두 소비합니다. 매 선택 직후 시장이 보충됩니다. 이 업그레이드 카드는 테스트용입니다.";
      controls =
        '<div class="upgrade-options">' +
        state.market
          .map((kind, i) =>
            kind
              ? button(
                  `<b>${esc(D.cards[kind].name)}</b><p>${esc(D.cards[kind].text)}</p>`,
                  "PICK_UPGRADE",
                  { index: i },
                )
              : "",
          )
          .join("") +
        "</div>";
    } else if (phase === "upgrade_replace") {
      const up = state.dream.purchased[0];
      title = "꿈 · 12장 덱 구성";
      hint = `${E.card(up).name}: ${E.card(up).text} 기존 카드 1장을 교체하거나 이번 업그레이드를 버리세요.`;
      controls =
        `<select class="card-select" id="replaceSelect">${p.deck.map((x) => `<option value="${esc(x.id)}">${esc(E.card(x).name)} (${esc(x.id)})</option>`).join("")}</select><button id="replaceConfirm" class="primary">선택한 기존 카드 교체</button>` +
        button("업그레이드 버리기", "REPLACE_UPGRADE", {});
    } else if (phase === "over") {
      title =
        state.result === "win"
          ? "사냥 성공 · 등불로 돌아왔습니다"
          : "사냥 실패 · 밤이 끝났습니다";
      hint =
        state.result === "win"
          ? "훈련 시나리오를 완료했습니다. 저장 파일에는 진행 상태와 명령 기록이 포함됩니다."
          : "사냥 트랙의 마지막 라운드가 끝났습니다. 상단의 새 훈련으로 다시 시작할 수 있습니다.";
      kicker = state.result === "win" ? "PREY SLAUGHTERED" : "HUNT ENDED";
      controls = '<button id="restartInline" class="primary">새 훈련</button>';
    }
    if (["hunter", "combat_choose"].includes(phase) && inventory.ids().length) {
      hint += " 함께 사용할 소모품: " + inventory.names().join(", ") + ".";
    }
    if (c) {
      const e = state.enemies.find((x) => x.id === c.enemyId),
        name = e ? D.enemies[e.kind].name : "처치한 적";
      combat = `<div class="combat-box"><div><small>HUNTER</small><h3>${c.attack ? esc(c.attack.name) : "공격하지 않음"}</h3><p>${c.attack ? `속도 ${c.attack.speed} (${speed(c.attack.speed)}) · 피해 ${c.attack.damage}${c.attack.interrupt ? " · 방해" : ""}` : "적의 공격에 대응할 수 있습니다."}${c.defense ? ` · 방어 ${c.defense}` : ""}${c.cancelHunter ? " · 취소됨" : ""}</p></div><div><small>${esc(name)}${c.action ? " · " + window.BBEnemyDeck.labels[c.action.kind] : ""}</small><h3>${c.action ? esc(c.action.name) : "적 행동 비공개"}</h3><p>${c.action ? (c.action.kind === "ability" ? esc(c.action.text) : `${speed(c.action.speed)} · 피해 ${c.action.damage}${p.status.frenzy ? " (+발광 1)" : ""}${c.action.stun ? " · 기절" : ""}${c.action.poison ? " · 독" : ""}${c.action.interrupt ? " · 방해" : ""}`) : "사냥꾼의 공격 선택 후 공개합니다."}${c.cancelEnemy ? " · 방해로 취소됨" : c.dodged ? " · 회피 완료" : ""}</p></div></div>`;
    }
    $("phaseTitle").textContent = title;
    $("phaseKicker").textContent = kicker;
    $("phaseHelp").textContent = hint;
    $("costHint").textContent = cost || "플레이어 선택 대기";
    $("actions").innerHTML = controls;
    $("combat").innerHTML = combat;
    renderWeaponOptions();
    bindCommands($("actions"));
    if ($("replaceConfirm"))
      $("replaceConfirm").onclick = () =>
        send("REPLACE_UPGRADE", { replaceId: $("replaceSelect").value });
    if ($("restartInline"))
      $("restartInline").onclick = () => $("newDialog").showModal();
  }
  function renderWeaponOptions() {
    const p = h(),
      phase = state.phase;
    const active =
      ["hunter", "combat_choose"].includes(phase) &&
      E.weaponFace(state).pullRange;
    const box = $("weaponOptions");
    if (!active) {
      box.innerHTML = "";
      return;
    }
    const candidates = E.pullCandidates(state);
    const targets = state.enemies.filter(
      (e) => e.node === p.position || selectedPull.has(e.id),
    );
    box.innerHTML = `<div class="weapon-options"><b>장송의 칼날 · 공격 전 끌어오기 (선택)</b><p class="muted">2칸 이내의 적을 원하는 만큼 선택하세요. 공격을 확정할 때 이동합니다. 아무것도 선택하지 않아도 됩니다.</p><div class="pull-choices">${candidates.map((e) => `<label><input type="checkbox" data-pull="${e.id}" ${selectedPull.has(e.id) ? "checked" : ""}> ${esc(D.enemies[e.kind].name)} · ${E.distance(p.position, e.node)}칸</label>`).join("") || '<span class="muted">지금 끌어올 수 있는 적이 없습니다.</span>'}</div>${phase === "hunter" ? `<label class="target-label">직접 공격할 적 <select id="attackTarget" class="card-select"><option value="">대상 선택</option>${targets.map((e) => `<option value="${e.id}" ${e.id === selectedEnemy ? "selected" : ""}>${esc(D.enemies[e.kind].name)}${selectedPull.has(e.id) ? " (끌어올 적)" : ""}</option>`).join("")}</select></label>` : '<p class="muted">맞서 공격할 대상은 현재 공격해 오는 적입니다. 끌어온 다른 적과 즉시 별도 전투를 하지는 않습니다.</p>'}</div>`;
    box.querySelectorAll("[data-pull]").forEach(
      (input) =>
        (input.onchange = () => {
          if (input.checked) selectedPull.add(input.dataset.pull);
          else selectedPull.delete(input.dataset.pull);
          render();
        }),
    );
    if ($("attackTarget"))
      $("attackTarget").onchange = () => {
        selectedEnemy = $("attackTarget").value || null;
        render();
      };
  }
  $("save").onclick = () => {
    const b = new Blob([E.exportSave(state)], { type: "application/json" }),
      u = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = u;
    a.download = `bloodborne-training-round-${state.round}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  $("load").onclick = () => $("file").click();
  $("file").onchange = async () => {
    const f = $("file").files[0];
    if (!f) return;
    try {
      if (f.size > 2000000) throw Error("저장 파일은 2MB 이하여야 합니다.");
      const loaded = E.importSave(await f.text());
      state = loaded;
      inventory.clear();
      selectedCard = null;
      selectedSlot = null;
      selectedEnemy = null;
      discards.clear();
      selectedPull.clear();
      saveLocal();
      render();
    } catch (e) {
      $("error").textContent = `불러오기 실패: ${e.message}`;
    }
    $("file").value = "";
  };
  $("new").onclick = () => $("newDialog").showModal();
  $("cancelNew").onclick = () => $("newDialog").close();
  $("confirmNew").onclick = () => {
    state = E.create(
      Date.now() >>> 0 || 1,
      $("startWeapon").value,
      +$("startFace").value,
      $("startConsumable").value || null,
      $("startFirearm").value === "hunter-pistol"
        ? undefined
        : $("startFirearm").value,
    );
    selectedCard = null;
    selectedSlot = null;
    selectedEnemy = null;
    discards.clear();
    selectedPull.clear();
    $("newDialog").close();
    inventory.clear();
    saveLocal();
    render();
  };
  $("startFirearm").innerHTML = Object.values(D.firearms)
    .map(
      (f) =>
        `<option value="${esc(f.id)}">${esc(f.name)}${f.temporary ? " (단총 능력 임시 적용)" : ""}</option>`,
    )
    .join("");
  $("startConsumable").innerHTML =
    '<option value="">소모품 없이 시작</option>' +
    Object.values(D.consumables)
      .filter((d) => d.runtime === "playable")
      .map(
        (d) =>
          `<option value="${esc(d.id)}" ${d.id === "blood-vial" ? "selected" : ""}>${esc(d.name)} 1장</option>`,
      )
      .join("");
  render();
  if (startupError) $("error").textContent = startupError;
})();
