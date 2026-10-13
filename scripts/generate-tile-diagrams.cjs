"use strict";
// Reproduce all map art from editable vector geometry, without opening photos.
const fs = require("node:fs");
const path = require("node:path");
const G = require("../tile-geometry.js");
const C = require("../campaigns/long-hunt/data.json");
const out = path.resolve(__dirname, "../assets/tiles");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const points = (ps) => ps.map(([x, y]) => `${x * 10},${y * 10}`).join(" ");
const line = (ps) => ps.map(([x, y], i) => `${i ? "L" : "M"}${x * 10} ${y * 10}`).join(" ");
const colors = { red: "#ce786f", gold: "#c9ae75", purple: "#b29ac8", lamp: "#9ccbdc", consumable: "#a8c098" };
const defs = `<defs>
  <pattern id="blocked-hatch" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M-9 9L9-9M0 36L36 0M27 45L45 27" stroke="#514a45" stroke-width="3"/></pattern>
  <g id="icon-lamp" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M-8-21V-28Q0-40 8-28V-21M-15-18H15L20 18H-20ZM-17 22H17M-12-18L-9 18M12-18L9 18"/><path d="M0-11Q10-2 0 12Q-10-2 0-11" fill="currentColor" stroke="none"/></g>
  <g id="icon-chest" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M-24-3Q-24-22-8-22H8Q24-22 24-3V21H-24ZM-24-3H24M-12-21V-4M12-21V-4"/><path d="M-5-7H5V6H-5Z" fill="currentColor"/></g>
  <g id="icon-red" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M0-29V29M-22-17L0-8L22-17M-22-3L0 7L22-3M-17 14L0 23L17 14"/></g>
  <g id="icon-gold" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M-11 25L8-18L20-29L17-12L-2 30ZM-21 15L7 28M-17 30L-9 34"/></g>
  <g id="icon-purple" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M-23 24L-15-18M-8 26L1-29M8 24L17-24M20 17L28-8"/><path d="M-23 24Q0 35 20 17"/></g>
</defs>`;

function validate(t, g) {
  const expected = t.spaces.map((s) => s.id).sort().join("|");
  if (expected !== Object.keys(g.spaces).sort().join("|")) throw new Error(`${t.id}: space ids differ`);
  const exits = (es) => es.map((e) => `${e.edge}:${e.spaceId}`).sort().join("|");
  if (exits(t.exits) !== exits(g.exits)) throw new Error(`${t.id}: exits differ`);
  const expectedIcons = t.spaces.flatMap((s) => s.icons.map((i) => [s.id, i.kind, i.markerId || "", i.count]));
  const actual = new Map();
  for (const m of g.markers) {
    const key = `${m.spaceId}:${m.kind}:${m.markerId || ""}`;
    actual.set(key, (actual.get(key) || 0) + m.count);
  }
  for (const [spaceId, kind, marker, count] of expectedIcons) {
    const key = `${spaceId}:${kind}:${marker}`;
    if (actual.get(key) !== count) throw new Error(`${t.id}: icon differs: ${key}`);
    actual.delete(key);
  }
  if (actual.size) throw new Error(`${t.id}: unexpected icons`);
}

function walls(exits) {
  return ["N", "E", "S", "W"].map((edge, r) => {
    const segments = exits.some((e) => e.edge === edge) ? [[0, 44], [56, 100]] : [[0, 100]];
    return segments.map(([a, b]) => `<path d="${line([[a, 0], [b, 0]].map((p) => G.rotatePoint(p, r)))}"/>`).join("");
  }).join("");
}

function gate(e) {
  const r = ["N", "E", "S", "W"].indexOf(e.edge);
  return `<g data-exit-edge="${e.edge}" data-space-id="${esc(e.spaceId)}" data-x="${e.point[0]}" data-y="${e.point[1]}" transform="rotate(${r * 90} 500 500)">
    <path d="M440 0V68H560V0" fill="#c8b38c" fill-opacity=".2" stroke="#d8c6a1" stroke-width="7"/>
    <path d="M476 46L500 22L524 46M476 72L500 96L524 72" fill="none" stroke="#eddec0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function marker(m) {
  const kind = m.kind === "spawn" ? m.markerId : m.kind;
  const title = { red: "빨강 적 출현", gold: "황갈색 적 출현", purple: "자주 적 출현", lamp: "등불", consumable: "소모품" }[kind];
  const [x, y] = m.point.map((p) => p * 10);
  return `<g data-space-id="${esc(m.spaceId)}" data-icon-kind="${m.kind}" data-icon-marker="${esc(m.markerId || "")}" data-icon-count="${m.count}" data-x="${m.point[0]}" data-y="${m.point[1]}" transform="translate(${x} ${y})" color="${colors[kind]}"><title>${title} ${m.count}개</title><circle r="47" fill="#171819" stroke="currentColor" stroke-width="6"/><circle r="39" fill="none" stroke="currentColor" stroke-width="2" opacity=".55"/><use href="#icon-${kind === "consumable" ? "chest" : kind}"/></g>`;
}

function render(t) {
  const g = G.definition(t.id);
  validate(t, g);
  const name = t.name || `구역 ${t.id.slice(-2)}`;
  const title = `${name}: ${t.spaces.length}칸, 출입구 ${g.exits.map((e) => e.edge).join("/")}`;
  const fills = ["#2a2a2a", "#30302e", "#282c2e", "#31302a"];
  const cells = Object.entries(g.spaces).map(([id, s], i) => `<polygon data-space-id="${esc(id)}" points="${points(s.polygon)}" fill="${fills[i % fills.length]}"/>`).join("\n");
  const blocked = (g.blocked || []).map((p) => `<polygon data-blocked="true" points="${points(p)}" fill="#181819" stroke="#8c8171" stroke-width="5"/><polygon points="${points(p)}" fill="url(#blocked-hatch)"/><text x="535" y="535" text-anchor="middle" fill="#9b9184" font-size="29">건물</text>`).join("");
  const dividers = g.boundaries.map((p) => `<path d="${line(p)}"/>`).join("");
  const labels = t.spaces.map((s) => {
    const [x, y] = g.spaces[s.id].labelPoint;
    let label = s.placeName || s.label;
    if (t.id === "tile-10") label = s.id === "left" ? "왼쪽 칸" : "오른쪽 칸";
    if (s.id === "center" && t.id === "tile-15") label = t.name;
    if (s.id === "top" && ["tile-07", "tile-12", "tile-18", "tile-19"].includes(t.id)) label = t.name;
    const font = label.length > 10 ? 31 : 35;
    return `<text data-space-label="${esc(s.id)}" x="${x * 10}" y="${y * 10}" text-anchor="middle" dominant-baseline="middle" fill="#e4dfd2" font-size="${font}" font-weight="600" paint-order="stroke" stroke="#252524" stroke-width="5">${esc(label)}</text>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-labelledby="tile-title tile-description">
<title id="tile-title">${esc(title)}</title>
<desc id="tile-description">직접 그린 평면 도식. 흰 선은 칸 경계, 가장자리의 금색 틈은 출입구입니다. 파랑 등불과 초록 보물상자는 등불 및 소모품 기호이며 적 출현은 빨강·황갈색·자주색입니다.</desc>
${defs}
<rect width="1000" height="1000" fill="#171819"/>
${cells}
${blocked}
<g fill="none" stroke="#e4dece" stroke-width="9" stroke-linecap="butt">${dividers}</g>
<g fill="none" stroke="#817461" stroke-width="24">${walls(g.exits)}</g>
${g.exits.map(gate).join("\n")}
${g.markers.map(marker).join("\n")}
<g font-family="Malgun Gothic,Apple SD Gothic Neo,Arial,sans-serif">${labels}</g>
<text x="26" y="973" fill="#948979" font-family="Arial,sans-serif" font-size="22">${esc(t.id.toUpperCase())}</text>
</svg>\n`;
}

function legend() {
  const mark = (spaceId, kind, point, markerId) => ({ spaceId, kind, point, count: 1, markerId });
  const ms = [mark("legend", "lamp", [10, 40]), mark("legend", "consumable", [30, 40]), mark("legend", "spawn", [50, 40], "red"), mark("legend", "spawn", [70, 40], "gold"), mark("legend", "spawn", [90, 40], "purple")];
  const names = ["등불", "소모품", "빨강 출현", "황갈색 출현", "자주 출현"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 550" width="1000" height="550" role="img" aria-label="타일 도식 범례">${defs}<rect width="1000" height="550" fill="#202122"/>${ms.map(marker).join("")}<g fill="#e4dfd2" text-anchor="middle" font-size="29" font-family="Malgun Gothic,Arial,sans-serif">${ms.map((m, i) => `<text x="${m.point[0] * 10}" y="510">${names[i]}</text>`).join("")}</g><g fill="#e4dfd2" font-size="32" font-family="Malgun Gothic,Arial,sans-serif"><path d="M70 80H210" stroke="#e4dece" stroke-width="9"/><text x="245" y="91">칸 경계 · 맞닿은 칸으로 이동</text><path d="M70 145V205H210V145" fill="none" stroke="#d8c6a1" stroke-width="7"/><text x="245" y="184">출입구 · 인접 타일과 연결</text><text x="70" y="285">기호가 두 개면 해당 소모품·적도 두 개</text></g></svg>\n`;
}

function atlas() {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>맵 타일 도식 20종</title><style>body{margin:0;background:#171819;color:#e4dfd2;font:16px/1.5 'Malgun Gothic',sans-serif;padding:28px}h1{font-size:26px;margin:0 0 6px}p{margin:0 0 20px;color:#b7ae9e}.legend{display:block;width:min(660px,100%);margin:16px 0 28px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}figure{margin:0}figure img{width:100%;display:block}figcaption{padding:8px 0;font-size:14px}figcaption span{display:block;color:#a99f91;font-size:12px}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:16px}}</style><h1>맵 타일 도식 20종</h1><p>사진의 배경과 픽셀을 사용하지 않고 칸 경계·출입구·기호를 직접 그렸습니다. 0° 기준입니다.</p><img class="legend" src="legend.svg" alt="칸 경계, 출입구, 등불, 소모품, 적 출현 기호 범례"><div class="grid">${C.tiles.map((t) => `<figure><img src="${t.id}.svg" alt="${esc(t.displayName)} 타일 도식"><figcaption>${esc(t.id)} · ${esc(t.displayName)}<span>${t.spaces.length}칸 / 출입구 ${t.exits.map((e) => e.edge).join(" · ")}</span></figcaption></figure>`).join("\n")}</div></html>\n`;
}

function generate() {
  fs.mkdirSync(out, { recursive: true });
  for (const t of C.tiles) fs.writeFileSync(path.join(out, `${t.id}.svg`), render(t), "utf8");
  fs.writeFileSync(path.join(out, "legend.svg"), legend(), "utf8");
  fs.writeFileSync(path.join(out, "index.html"), atlas(), "utf8");
  return C.tiles.length;
}
if (require.main === module) console.log(`Generated ${generate()} map SVG diagrams, legend and atlas.`);
module.exports = { render, legend, atlas, generate };
