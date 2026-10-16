(function (root) {
  "use strict";
  root.BBInventory = function ({ E, getState, send, refresh }) {
    const D = E.data,
      $ = (id) => document.getElementById(id);
    const enemyDef = (e) => E.enemyDef ? E.enemyDef(e) : D.enemies[e.kind];
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
    let selected = null,
      attackIds = new Set();
    function clear() {
      selected = null;
      attackIds.clear();
    }
    function render() {
      const s = getState(),
        p = E.hunter(s),
        held = p.consumables;
      const canCommit = ["hunter", "combat_choose"].includes(s.phase);
      if (!held.some((x) => x.id === selected)) selected = held[0]?.id || null;
      attackIds = new Set(
        [...attackIds].filter((id) => held.some((x) => x.id === id)),
      );
      $("itemCount").textContent =
        `${held.length}장 · 덱 ${s.consumableDeck.length} · 버림 ${s.consumableDiscard.length}`;
      $("inventory").innerHTML =
        held
          .map((item) => {
            const d = D.consumables[item.kind];
            return `<button class="inventory-card ${selected === item.id ? "selected" : ""}" data-item="${esc(item.id)}" aria-pressed="${selected === item.id}"><small>${esc(d.timing)}</small><b>${esc(d.name)}</b><span>${attackIds.has(item.id) ? "✓ 이번 공격에 사용" : d.runtime === "playable" ? "보유 중" : "현재 사용 불가"}</span></button>`;
          })
          .join("") ||
        '<p class="muted">보유한 소모품이 없습니다. ◇ 칸에서 상호작용하면 획득합니다.</p>';
      $("inventory")
        .querySelectorAll("[data-item]")
        .forEach(
          (b) =>
            (b.onclick = () => {
              selected = b.dataset.item;
              render();
            }),
        );
      const item = held.find((x) => x.id === selected),
        detail = $("itemDetail");
      if (!item) {
        detail.innerHTML = "";
        return;
      }
      const d = D.consumables[item.kind],
        f = d.effects;
      let controls = "",
        hint = "",
        enabled = s.phase === "hunter";
      if (d.runtime !== "playable") {
        hint = d.runtimeNote;
        enabled = false;
      } else if (d.timing === "공격할 때") {
        controls = `<button id="toggleAttackItem" ${canCommit ? "" : "disabled"}>${attackIds.has(item.id) ? "이번 공격에서 제외" : "이번 공격에 함께 사용"}</button>`;
        hint =
          "공격 또는 맞서 공격을 확정할 때 소비합니다. 선택만으로는 소비하지 않습니다. 적 행동 공개 후에는 추가할 수 없습니다.";
      } else {
        if (f.readyReward) {
          const view = E.rewardsView ? E.rewardsView(s) : null,
            rewards = view ? view.rewards.filter((r) => r.equipped && !r.ready && !r.persistent) : [];
          controls += `<label>준비할 소진된 보상<select id="itemReward">${rewards.length ? rewards.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("") : '<option value="">준비할 보상 없음</option>'}</select></label>`;
          enabled &&= rewards.length > 0 && !view?.choices.length;
          if (!rewards.length) hint = "소진된 장착 보상이 없습니다. 골수 가루는 소비하지 않습니다.";
          else if (view.choices.length) hint = "먼저 획득한 보상의 장착·보관 선택을 마치세요.";
        } else if (f.target === "enemy" || f.target === "enemy-destination") {
          const targets = p.inDream
            ? []
            : s.enemies.filter(
                (e) =>
                  E.distance(p.position, e.node) <= f.range &&
                  (!f.nonBoss || !enemyDef(e).boss),
              );
          controls += `<label>대상 적<select id="itemEnemy">${targets.map((e) => `<option value="${esc(e.id)}">${esc(enemyDef(e).name)} · ${esc(E.node(e.node).name)} · 체력 ${e.hp}</option>`).join("")}</select></label>`;
          enabled &&= targets.length > 0;
          if (!targets.length)
            hint = `범위 ${f.range}칸 안에 대상 적이 없습니다.`;
          if (f.target === "enemy-destination")
            controls +=
              '<label>적의 이동 목적지<select id="itemNode"></select></label>';
        } else if (f.target === "lamp") {
          const lamps = D.nodes.filter((n) => n.lamp && (!E.canTeleport || E.canTeleport(n.id)));
          controls += `<label>등불 목적지<select id="itemNode">${lamps
            .map((n) => `<option value="${esc(n.id)}">${esc(n.name)}</option>`)
            .join("")}</select></label>`;
          enabled &&= lamps.length > 0 && !p.inDream;
          if (!lamps.length) hint = "현재 이동할 수 있는 정상 등불이 없습니다. 안개 안에서는 순간이동으로 탈출할 수 없습니다.";
        } else if (f.target === "slot") {
          const occupied = p.slots
            .map((c, i) => (c ? i : -1))
            .filter((i) => i >= 0);
          controls += `<label>비울 공격 슬롯<select id="itemSlot">${occupied.map((i) => `<option value="${i}">${i + 1}번 · ${esc(E.card(p.slots[i]).name)}</option>`).join("")}</select></label>`;
          enabled &&= occupied.length > 0;
          if (!occupied.length) hint = "모든 공격 슬롯이 이미 비어 있습니다.";
        }
        controls += `<button id="useItem" class="primary" ${enabled ? "" : "disabled"}>${esc(d.name)} 사용</button>`;
        if (s.phase !== "hunter")
          hint = "자신의 사냥꾼 차례에 행동 전후로 사용할 수 있습니다.";
        if (!hint)
          hint = "스탯 카드 비용 없이 사용하며, 사용한 소모품은 버립니다.";
      }
      detail.innerHTML = `<h3>${esc(d.name)}</h3><p>${esc(d.rules)}</p><div class="item-controls">${controls}</div><p class="muted">${esc(hint)}</p>`;
      if ($("itemEnemy") && f.target === "enemy-destination") {
        const destinations = () => {
          const e = s.enemies.find((x) => x.id === $("itemEnemy").value);
          $("itemNode").innerHTML = (
            e
              ? D.nodes.filter((n) => E.distance(e.node, n.id) <= f.moveEnemy &&
                  (!E.path || E.path(e.node, n.id).every((at, i, route) => !i ||
                    E.node(route[i - 1]).tile === E.node(at).tile ||
                    !s.mission?.fog.includes(E.node(route[i - 1]).tile) && !s.mission?.fog.includes(E.node(at).tile))))
              : []
          )
            .map(
              (n) =>
                `<option value="${esc(n.id)}">${esc(n.name)} (${E.distance(e.node, n.id)}칸)</option>`,
            )
            .join("");
        };
        $("itemEnemy").onchange = destinations;
        destinations();
      }
      if ($("useItem"))
        $("useItem").onclick = () =>
          send("USE_CONSUMABLE", {
            itemId: item.id,
            ...($("itemEnemy") ? { enemyId: $("itemEnemy").value } : {}),
            ...($("itemNode") ? { node: $("itemNode").value } : {}),
            ...($("itemSlot") ? { slot: +$("itemSlot").value } : {}),
            ...($("itemReward") ? { rewardId: $("itemReward").value } : {}),
          });
      if ($("toggleAttackItem"))
        $("toggleAttackItem").onclick = () => {
          attackIds.has(item.id)
            ? attackIds.delete(item.id)
            : attackIds.add(item.id);
          render();
          refresh();
        };
    }
    function names() {
      const s = getState(),
        held = E.hunter(s).consumables;
      return [...attackIds].map(
        (id) => D.consumables[held.find((x) => x.id === id).kind].name,
      );
    }
    return { render, clear, ids: () => [...attackIds], names };
  };
})(window);
