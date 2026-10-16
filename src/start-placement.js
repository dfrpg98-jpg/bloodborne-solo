(function (root) {
  "use strict";
  function mount(container, select, confirm) {
    const G = root.BBTileGeometry, tile = root.BBLongHunt.tiles.find((t) => t.id === "tile-14");
    function update() {
      container.innerHTML = `<div class="start-tile"><img src="${G.image(tile.id)}" alt="중앙 등불 타일의 세 칸과 출입구">${tile.spaces.map((s) => {
        const [x] = G.point(tile.id, s.id), chosen = select.value === s.id;
        const polygon = G.polygon(tile.id, s.id).map(([x, y]) => `${x}% ${y}%`).join(",");
        return `<button type="button" class="start-space ${chosen ? "selected" : ""}" style="clip-path:polygon(${polygon})" data-start-space="${s.id}" aria-label="${s.label}에서 시작" aria-pressed="${chosen}"><span style="left:${x}%;top:30%">${chosen ? "● 사냥꾼" : "여기서 시작"}</span></button>`;
      }).join("")}</div>`;
      container.querySelectorAll("[data-start-space]").forEach((b) => {
        b.onclick = () => { select.value = b.dataset.startSpace; update(); };
      });
      confirm.disabled = !select.value;
    }
    select.addEventListener("change", update);
    update();
    return { update };
  }
  root.BBStartPlacement = { mount };
})(typeof globalThis !== "undefined" ? globalThis : this);
