"use strict";
// Draw original vector environments from the photographed tile references.
// Playable polygons, entrances and printed marker coordinates are unchanged.
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
  return `<g data-space-id="${esc(m.spaceId)}" data-icon-kind="${m.kind}" data-icon-marker="${esc(m.markerId || "")}" data-icon-count="${m.count}" data-x="${m.point[0]}" data-y="${m.point[1]}" transform="translate(${x} ${y})" color="${colors[kind]}"><title>${title} ${m.count}개</title><circle r="47" fill="#171819" fill-opacity=".62" stroke="currentColor" stroke-width="5" stroke-opacity=".65"/><circle r="39" fill="none" stroke="currentColor" stroke-width="2" opacity=".35"/><use opacity=".68" href="#icon-${kind === "consumable" ? "chest" : kind}"/></g>`;
}

// Native vector environment art. Every layout is drawn from the supplied tile
// reference; the geometry module remains the authority for cells and markers.
function seeded(seed) { let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}; }
function artDefinitions(){
 const random=seeded(73019),stones=[];
 for(let row=0;row<4;row++)for(let col=-1;col<5;col++){
  const x=col*35+(row%2)*17.5+2+random()*2,y=row*27+2+random()*2,w=30+random()*3,h=21+random()*3;
  const c=['#6b7880','#58666e','#7d898d','#5f736f','#4a5c64','#849395'][Math.floor(random()*6)];
  stones.push(`<path d="M${x+3} ${y}L${x+w-2} ${y+random()*2}L${x+w} ${y+h-4}L${x+w-4} ${y+h}L${x+1} ${y+h-2}L${x} ${y+4}Z" fill="${c}" stroke="#171e21" stroke-width="2.4"/><path d="M${x+4} ${y+2}H${x+w-4}M${x+2} ${y+5}V${y+h-6}" fill="none" stroke="#a0abb0" stroke-opacity=".27" stroke-width="1.3"/>`);
  if(random()>.5)stones.push(`<path d="M${x+6} ${y+h*.65}l8 -3l4 5" stroke="#1c282b" stroke-opacity=".55" fill="none" stroke-width="1"/>`);
 }
 return `<defs>
 <pattern id="stone-cobbles" width="140" height="108" patternUnits="userSpaceOnUse"><rect width="140" height="108" fill="#232e31"/>${stones.join('')}</pattern>
 <pattern id="stone-bricks" width="92" height="60" patternUnits="userSpaceOnUse"><rect width="92" height="60" fill="#242c2d"/><path d="M2 2H88V27H2ZM-42 32H42V57H-42ZM48 32H132V57H48Z" fill="#545950" stroke="#171c1a" stroke-width="3"/><path d="M5 5H84M51 35H128M-37 35H38" stroke="#8a8c7a" stroke-opacity=".45" stroke-width="2"/></pattern>
 <pattern id="floor-flags" width="154" height="154" patternUnits="userSpaceOnUse"><rect width="154" height="154" fill="#24282a"/><path d="M3 3H74V74H3Z" fill="#626668"/><path d="M80 3H151V74H80Z" fill="#474f51"/><path d="M3 80H74V151H3Z" fill="#4f595a"/><path d="M80 80H151V151H80Z" fill="#6d6d67"/><path d="M5 6H72M82 6H149M5 83H72M82 83H149" stroke="#b7b6a1" stroke-opacity=".3" stroke-width="2"/><path d="M14 54L33 45L40 63L59 72M86 119L108 102L126 113" fill="none" stroke="#292f30" stroke-width="2"/></pattern>
 <pattern id="floor-diamond" width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" fill="#263336"/><path d="M90 1L179 90L90 179L1 90Z" fill="#6c7470" stroke="#202d2e" stroke-width="4"/><path d="M90 6L174 90M4 90L90 176" stroke="#acb2a2" stroke-opacity=".3" stroke-width="3"/><path d="M72 30L90 45L88 62L104 73M27 101L41 114L45 138" stroke="#34403e" fill="none" stroke-width="3"/></pattern>
 <pattern id="wood-planks" width="160" height="128" patternUnits="userSpaceOnUse"><rect width="160" height="128" fill="#3e4137"/><path d="M2 3H157V29H2ZM2 35H157V61H2ZM2 67H157V93H2ZM2 99H157V125H2Z" fill="#5b5b48" stroke="#252b25" stroke-width="2"/><path d="M10 9H151M6 41H147M7 73H153M12 105H146" stroke="#999178" stroke-opacity=".25" stroke-width="2"/><path d="M4 19Q36 15 69 21T153 18M10 50Q54 45 86 50T144 52M8 87Q33 81 88 83T154 89M3 116Q40 113 70 118T152 113" stroke="#242e28" fill="none" stroke-opacity=".5"/><path d="M38 3V29M113 35V61M66 67V93M138 99V125" stroke="#242824" stroke-width="3"/></pattern>
 <pattern id="roof-slates" width="66" height="60" patternUnits="userSpaceOnUse"><rect width="66" height="60" fill="#182327"/><path d="M2 2H63V26H2ZM-31 32H31V56H-31ZM36 32H98V56H36Z" fill="#45575c" stroke="#1c282c" stroke-width="3"/><path d="M4 4H60M-29 34H27M38 34H94" stroke="#8e9c97" stroke-opacity=".45" stroke-width="2"/></pattern>
 <pattern id="water-ripples" width="200" height="170" patternUnits="userSpaceOnUse"><rect width="200" height="170" fill="#14272e"/><path d="M0 14Q25 1 48 15T99 14T152 18T210 10M-30 62Q5 47 41 65T116 62T202 57M5 114Q25 107 52 115T125 110T201 117M-12 147Q31 140 60 151T140 149T203 144" stroke="#66838a" stroke-opacity=".28" fill="none" stroke-width="3"/><path d="M26 37H77M125 92H172M49 132H101" stroke="#c5dad5" stroke-opacity=".16" stroke-width="2"/></pattern>
 <radialGradient id="light-moon"><stop stop-color="#9cbdc8" stop-opacity=".34"/><stop offset="1" stop-color="#82aab5" stop-opacity="0"/></radialGradient>
 <radialGradient id="light-warm"><stop stop-color="#eeca7c" stop-opacity=".72"/><stop offset=".35" stop-color="#ad975f" stop-opacity=".33"/><stop offset="1" stop-color="#857249" stop-opacity="0"/></radialGradient>
 <radialGradient id="light-edge"><stop offset=".35" stop-color="#070e10" stop-opacity="0"/><stop offset="1" stop-color="#050b0d" stop-opacity=".63"/></radialGradient>
 <linearGradient id="wet-stone" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d3e6d9" stop-opacity=".38"/><stop offset=".25" stop-color="#b4d3e0" stop-opacity=".15"/><stop offset="1" stop-color="#476f88" stop-opacity=".10"/></linearGradient>
 <linearGradient id="roof-depth" x1="0" x2="1"><stop stop-color="#0d1416" stop-opacity=".9"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#a2a695" stop-opacity=".17"/></linearGradient>
 <linearGradient id="wall-depth" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#a39c7f"/><stop offset=".35" stop-color="#656b5c"/><stop offset="1" stop-color="#343d39"/></linearGradient>
 <clipPath id="environment-clip"><rect x="13" y="13" width="974" height="974"/></clipPath>
 </defs>`;
}
function box(x,y,w,h,fill,stroke='#141c1e',sw=3){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;}
function property(x,y,type='crate',scale=1,rotation=0){
 let shape='';
 if(type==='crate')shape=`<path d="M-33-27H25L37-15V31H-33Z" fill="#635b43" stroke="#171f1f" stroke-width="4"/><path d="M-32-27L-19-16H37M-19-16V30M-28-20L23 23M24-24L-13 26" fill="none" stroke="#b2a079" stroke-width="4"/><path d="M-31 30V-27H25L37-15V31Z" fill="none" stroke="#252925" stroke-width="3"/>`;
 if(type==='barrel')shape=`<ellipse rx="27" ry="38" fill="#574f36" stroke="#162123" stroke-width="4"/><ellipse cy="-16" rx="25" ry="18" fill="#7a6d48" stroke="#ada07b" stroke-width="3"/><path d="M-23 5Q0 24 23 5M-23 20Q0 39 23 20M-8-31V38M8-31V38" fill="none" stroke="#1b2628" stroke-width="4"/><ellipse cy="-16" rx="18" ry="11" fill="none" stroke="#4f4934" stroke-width="2"/>`;
 if(type==='coffin')shape=`<path d="M-22-49H22L36-30L23 49H-23L-36-30Z" fill="#464c47" stroke="#92988a" stroke-width="5"/><path d="M-17-40H17L25-25L17 39H-17L-25-25Z" fill="#323d3c" stroke="#626f68" stroke-width="3"/><path d="M0-25V20M-12-13H12" fill="none" stroke="#878d7b" stroke-width="3"/>`;
 if(type==='plank')shape=`<path d="M-70-10H70V10H-70Z" fill="#777356" stroke="#2e3830" stroke-width="3"/><path d="M-64-4H61M-51 5H67" stroke="#383e30" stroke-width="2"/>`;
 if(type==='rubble')shape=`<path d="M-44 14L-32-14L-8-21L11 2L34-26L48-2L29 22L-7 10L-20 28Z" fill="#636961" stroke="#2b3534" stroke-width="4"/><path d="M-32-14L-10 2L-7 10M11 2L29 22M34-26L32-7L48-2" stroke="#a3aaa0" stroke-opacity=".4" fill="none" stroke-width="2"/>`;
 return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><ellipse cy="27" rx="47" ry="19" fill="#061316" opacity=".4"/>${shape}</g>`;
}
function torch(x,y,rotation=0){return `<g transform="translate(${x} ${y}) rotate(${rotation})"><circle r="138" fill="url(#light-warm)"/><path d="M-13 19H13L17-5H-17Z" fill="#5f604a" stroke="#202623" stroke-width="4"/><path d="M0 30V-19M-14-9L0-16L14-9" stroke="#323b35" stroke-width="6" fill="none"/><path d="M0-37Q12-21 3-11Q-13-16 0-37" fill="#e8d59b"/><path d="M0-28Q4-19 1-15" stroke="#fff1c2" stroke-width="4"/></g>`;}
function rail(x,y,length,rotation=0){
 const posts=[];for(let n=0;n<=length;n+=55)posts.push(`<path d="M${n} 0V-53M${n-5}-47L${n}-61L${n+5}-47" fill="#121d21" stroke="#26363a" stroke-width="4"/>`);
 const columns=[];for(let n=0;n<=length;n+=165)columns.push(`<rect x="${n-14}" y="-31" width="28" height="40" fill="url(#wall-depth)" stroke="#273333" stroke-width="4"/><ellipse cx="${n}" cy="-33" rx="17" ry="11" fill="#9c9e86" stroke="#394b46" stroke-width="4"/>`);
 return `<g transform="translate(${x} ${y}) rotate(${rotation})"><path d="M0 16H${length}" stroke="#071a20" stroke-width="30" opacity=".35"/><path d="M0-27H${length}M0-9H${length}" stroke="#17262b" stroke-width="6"/>${posts.join('')}${columns.join('')}</g>`;
}
function house(x,y,w,h,rotation=0,kind='gable'){
 const windows=[];for(let n=24;n<w-22;n+=54)windows.push(`<path d="M${n} ${h-34}V${h-75}Q${n+12} ${h-101} ${n+24} ${h-75}V${h-34}Z" fill="#111c1d" stroke="#888a70" stroke-width="4"/><path d="M${n+12} ${h-81}V${h-39}M${n+3} ${h-63}H${n+21}" stroke="#3f4c43" stroke-width="3"/>`);
 const gables=[];for(let n=35;n<w-25;n+=98)gables.push(`<path d="M${n-27} ${h-91}L${n} ${h-127}L${n+27} ${h-91}Z" fill="#657269" stroke="#c0b996" stroke-opacity=".5" stroke-width="4"/><path d="M${n-13} ${h-90}L${n} ${h-109}L${n+13} ${h-90}Z" fill="#162426"/>`);
 return `<g transform="translate(${x} ${y}) rotate(${rotation})"><path d="M10 13H${w+18}V${h+25}H10Z" fill="#061214" opacity=".55"/><rect width="${w}" height="${h}" fill="url(#stone-bricks)" stroke="#1b2a2d" stroke-width="6"/><rect width="${w}" height="${Math.max(40,h-62)}" fill="url(#roof-slates)"/><rect width="${w}" height="${Math.max(40,h-62)}" fill="url(#roof-depth)"/><path d="M0 12H${w}M0 ${h-61}H${w}M9 0V${h}M${w-9} 0V${h}" stroke="#b1aa88" stroke-opacity=".5" stroke-width="6"/>${kind==='gable'?gables.join(''):''}${windows.join('')}<path d="M0 ${h}H${w}" stroke="#a99c75" stroke-width="8"/><path d="M-7 ${h+9}H${w+7}" stroke="#263935" stroke-width="9"/></g>`;
}
function steps(x,y,w,h,n=9,rotation=0){
 const lines=[];for(let i=0;i<n;i++){const yy=i*h/n;lines.push(`<path d="M0 ${yy}H${w}" stroke="#afb29c" stroke-opacity=".45" stroke-width="3"/><path d="M0 ${yy+5}H${w}" stroke="#141e21" stroke-width="4"/>`);}
 return `<g transform="translate(${x} ${y}) rotate(${rotation})"><rect width="${w}" height="${h}" fill="#5d6764" stroke="#1c2729" stroke-width="5"/>${lines.join('')}<path d="M0 0V${h}M${w} 0V${h}" stroke="#8c9687" stroke-width="9"/></g>`;
}
function grave(x,y,w=50,h=90,rotation=0){return `<g transform="translate(${x} ${y}) rotate(${rotation})"><path d="M-4 19H${w+20}V${h+13}H-4Z" fill="#041318" opacity=".48"/><path d="M0 ${h}V18Q${w/2} -19 ${w} 18V${h}Z" fill="#687568" stroke="#17272b" stroke-width="4"/><path d="M8 ${h-10}V23Q${w/2} 0 ${w-8} 23V${h-10}Z" fill="#3d504b" stroke="#9b9d85" stroke-width="3"/><path d="M${w/2} 23V57M${w/2-10} 35H${w/2+10}" stroke="#88917b" stroke-width="4"/><path d="M-8 ${h+5}H${w+8}" stroke="#9d9c82" stroke-width="8"/></g>`;}
function tree(x,y,scale=1){
 const r=seeded(141),branches=[];for(let i=0;i<18;i++){const a=r()*Math.PI*2,l=60+r()*110,x1=Math.cos(a)*l*.5,y1=Math.sin(a)*l*.5,x2=Math.cos(a)*l,y2=Math.sin(a)*l;branches.push(`<path d="M0 0L${x1} ${y1}L${x2} ${y2}m${-(x2-x1)*.15} ${-(y2-y1)*.15}l${Math.cos(a+.9)*34} ${Math.sin(a+.9)*34}" stroke-width="${2+r()*4}"/>`);}
 return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse rx="145" ry="104" fill="#071417" opacity=".32"/><g fill="none" stroke="#232f2c" stroke-linecap="round">${branches.join('')}</g><g fill="none" stroke="#879186" stroke-opacity=".4" stroke-linecap="round" transform="translate(-2 -3)">${branches.join('')}</g><circle r="14" fill="#4c5446" stroke="#172526" stroke-width="4"/></g>`;
}
function pavingCircle(x,y,r,stone=true){
 let out=`<g transform="translate(${x} ${y})"><circle r="${r}" fill="${stone?'url(#stone-cobbles)':'#3b4848'}" stroke="#182a2d" stroke-width="12"/><circle r="${r-13}" fill="none" stroke="#9a9e85" stroke-opacity=".6" stroke-width="5"/>`;
 for(let ring=1;ring<=3;ring++){const rr=r-ring*28;if(rr<12)continue;out+=`<circle r="${rr}" fill="none" stroke="#17292b" stroke-width="6"/>`;const count=Math.round(rr/7);for(let i=0;i<count;i++){const a=i*Math.PI*2/count;out+=`<path d="M${Math.cos(a)*(rr+25)} ${Math.sin(a)*(rr+25)}L${Math.cos(a)*rr} ${Math.sin(a)*rr}" stroke="#1d2d2f" stroke-width="4"/>`;}}
 return out+'</g>';
}
function furniture(x,y,type,w=130,h=65,rotation=0){
 let out=box(-w/2+7,-h/2+8,w+10,h+12,'#081719','none');
 if(type==='table'){out+=box(-w/2,-h/2,w,h,'#777154','#323a2b',5);out+=`<path d="M${-w/2+8} ${-h/2+8}H${w/2-8}V${h/2-8}H${-w/2+8}Z" fill="#555b45" stroke="#a89c74" stroke-width="3"/><ellipse cx="${w*.25}" cy="-8" rx="19" ry="14" fill="#89917b" stroke="#424d3f" stroke-width="3"/>`;}
 if(type==='shelf'){out+=box(-w/2,-h/2,w,h,'#353d31','#807657',5);for(let i=0;i<5;i++)out+=`<rect x="${-w/2+8+i*(w-16)/5}" y="${-h/2+8}" width="${(w-26)/5}" height="${h-16}" fill="${['#56694c','#6e5c44','#394d4e','#686451','#475b48'][i]}" stroke="#1c2b28" stroke-width="2"/>`;}
 if(type==='bed'){out+=`<path d="M${-w/2} ${-h/2}H${w/2}V${h/2}H${-w/2}Z" fill="#605a42" stroke="#c2b893" stroke-width="5"/><rect x="${-w/2+8}" y="${-h/2+10}" width="${w-16}" height="${h-20}" rx="7" fill="#adb298"/><path d="M${-w/2+12} ${-h*.1}H${w/2-12}" stroke="#7d8270" stroke-width="4"/><rect x="${-w/2+15}" y="${-h/2+13}" width="${w-30}" height="${h*.18}" rx="7" fill="#d5cfaf"/>`;}
 return `<g transform="translate(${x} ${y}) rotate(${rotation})">${out}</g>`;
}
function indoorWalls(chapel=false){
 let out='';const rows=chapel?[165,385,660,870]:[190,480,740];
 for(const x of [80,920])for(const y of rows){out+=`<g transform="translate(${x} ${y}) rotate(${x>500?180:0})"><path d="M-35-72H35L64-49V49L35 72H-35Z" fill="url(#stone-bricks)" stroke="#111f23" stroke-width="7"/><path d="M-28-60H23Q70 0 23 60H-28Z" fill="#202e30" stroke="#a1a186" stroke-width="6"/><path d="M-26-43H10Q48 0 10 43H-26Z" fill="#101d21" stroke="#515f58" stroke-width="4"/><path d="M-10-37V38M8-30V30M-29 0H33" stroke="#384b46" stroke-width="3"/><circle cx="49" cy="-67" r="16" fill="#9a9d82" stroke="#3f554f" stroke-width="4"/><circle cx="49" cy="67" r="16" fill="#9a9d82" stroke="#3f554f" stroke-width="4"/></g>`;}
 return out;
}
function rosette(x,y,r=150){let out=`<g transform="translate(${x} ${y})"><circle r="${r}" fill="#3e4b4b" stroke="#a3a68e" stroke-width="8"/><circle r="${r-18}" fill="none" stroke="#182c2e" stroke-width="5"/>`;for(let i=0;i<8;i++){const a=i*Math.PI/4;out+=`<circle cx="${Math.cos(a)*r*.52}" cy="${Math.sin(a)*r*.52}" r="${r*.22}" fill="#465856" stroke="#92a498" stroke-opacity=".5" stroke-width="4"/>`;}return out+`<circle r="${r*.22}" fill="#394d4e" stroke="#798d80" stroke-width="4"/></g>`;}
function altar(x,y,w=290){return `<g transform="translate(${x} ${y})"><path d="M${-w/2-34} 53H${w/2+34}V101H${-w/2-34}Z" fill="#283c3d" stroke="#8c9c87" stroke-width="6"/><path d="M${-w/2} -54H${w/2}V56H${-w/2}Z" fill="#97947a" stroke="#333f36" stroke-width="8"/><path d="M${-w/2+11} -39H${w/2-11}V44H${-w/2+11}Z" fill="#c2b28a" stroke="#777555" stroke-width="4"/><path d="M-35-48L-15-90Q-1-127 16-90L36-48V25H-36Z" fill="#718475" stroke="#374f49" stroke-width="4"/><circle cy="-108" r="18" fill="#9fafa0" stroke="#50655c" stroke-width="4"/><path d="M-13-75L-46-28M13-75L45-28M-12-77L-21 11M12-77L21 11" fill="none" stroke="#bec5af" stroke-width="7"/>${[-110,-75,75,110].map(n=>`<path d="M${n} -29V8" stroke="#ead7a8" stroke-width="7"/><circle cx="${n}" cy="-36" r="7" fill="#ffebbc"/>`).join('')}</g>`;}
function weatheredGround(id,interior,r){
 let out='<g data-art-detail="weathered-floor">';
 // Draw irregular damp patches, hairline cracks and flaked mortar, independently
 // of the marker and cell coordinates. These are scenery, never new barriers.
 const patches=interior?7:14;
 for(let i=0;i<patches;i++){
  const x=94+r()*804,y=73+r()*870,rx=26+r()*92,ry=19+r()*42,angle=r()*180;
  out+=`<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M${-rx} 0Q${-rx*.8} ${-ry} ${-rx*.2} ${-ry*.6}Q${rx*.6} ${-ry*1.1} ${rx} 0Q${rx*.5} ${ry} ${-rx*.3} ${ry*.7}Q${-rx} ${ry*.5} ${-rx} 0Z" fill="${interior?'#143030':'url(#wet-stone)'}" opacity="${interior?'.11':'.43'}"/><path d="M${-rx*.7} ${-ry*.16}Q0 ${-ry*.55} ${rx*.7} ${-ry*.1}" stroke="#afc3be" stroke-opacity=".16" fill="none" stroke-width="3"/></g>`;
 }
 for(let i=0;i<(interior?14:21);i++){
  const x=45+r()*909,y=48+r()*904,dx=15+r()*37,dy=18+r()*41;
  out+=`<path d="M${x} ${y}l${dx*.25} ${dy*.31}l${-dx*.12} ${dy*.2}l${dx*.45} ${dy*.11}l${dx*.42} ${dy*.38}m${-dx*.42} ${-dy*.38}l${-dx*.46} ${dy*.3}" fill="none" stroke="#132b2e" stroke-opacity=".48" stroke-width="${interior?3:2}"/>`;
 }
 if(!interior)for(let i=0;i<32;i++){
  const edge=i%4,a=54+r()*890,b=35+r()*118,x=edge===0?b:edge===1?1000-b:a,y=edge===2?b:edge===3?1000-b:a;
  out+=`<g transform="translate(${x} ${y})"><path d="M-9 5Q-17-17-23-20M-7 2Q-2-19 3-22M-2 8Q14-12 21-14M-5 12Q-3 0 9-2" fill="none" stroke="#516854" stroke-opacity=".52" stroke-width="4"/><path d="M-18 14L-4 7L11 17L3 24L-19 21Z" fill="#344638" opacity=".35"/></g>`;
 }
 return out+'</g>';
}
function environment(t){
 const id=Number(t.id.slice(-2)),r=seeded(id*9187+81),interior=[3,7,12,17,20].includes(id),floor=id===17?'floor-diamond':[7,12].includes(id)?'floor-flags':[3,20].includes(id)?'wood-planks':'stone-cobbles';
 let out=`<g data-art-layer="environment" data-environment="${interior?'interior':id===18?'bridge':id===13||id===19?'graveyard':'street'}" clip-path="url(#environment-clip)"><rect width="1000" height="1000" fill="url(#${floor})"/>`;
 if(id===20)out+=`<rect y="670" width="1000" height="330" fill="url(#stone-cobbles)"/>`;
 if(id===3)out+=`<rect y="690" width="1000" height="310" fill="url(#stone-cobbles)"/><rect x="361" y="690" width="280" height="310" fill="url(#wood-planks)"/>`;
 if(!interior){out+=`<path d="M466 0Q396 275 525 515T505 1000" stroke="#9cb1b2" stroke-opacity=".16" stroke-width="124" fill="none"/>`;out+=rail(25,48,950)+rail(32,980,925,270)+rail(973,26,944,90);}
 out+=weatheredGround(id,interior,r);
 // Small scattered chipped stones and dirt make each photographed location distinct.
 for(let i=0;i<42;i++){const x=40+r()*920,y=55+r()*880,s=6+r()*13;out+=`<path d="M${x-s} ${y}l${s*.6} ${-s*.8}l${s*1.3} ${s*.2}l${s*.3} ${s*.9}l${-s} ${s*.4}Z" fill="${i%3?'#949c8b':'#263e38'}" opacity="${.14+r()*.22}"/>`;}
 const props=(items)=>items.map(([x,y,type,sc=1,rot=0])=>property(x,y,type,sc,rot)).join('');
 const stains=(items)=>items.map(([x,y,sc=1])=>`<path transform="translate(${x} ${y}) scale(${sc})" d="M-35-17Q-5-36 7-17Q38-33 36-7Q52 8 21 25Q-1 10-19 28Q-43 15-35-17Z" fill="#5f3129" opacity=".47"/>`).join('');
 switch(id){
 case 1:out+=house(6,625,235,375,0)+house(824,55,178,358,0,'flat')+props([[769,160,'coffin',1.05,-21],[695,146,'crate',.8,-18],[255,552,'barrel',.85],[281,862,'crate',.8,8],[204,714,'plank',1,36]])+tree(848,805,.8)+pavingCircle(836,825,141)+torch(233,638)+torch(856,352)+stains([[359,806],[198,195]]);break;
 case 2:out+=house(3,0,520,150)+house(698,13,305,144)+house(808,741,194,263)+props([[514,181,'coffin',1.2,-18],[689,153,'coffin',1,-30],[856,806,'barrel',1.2],[180,881,'plank',1.1,21]])+torch(151,179)+torch(815,183)+torch(782,813)+stains([[107,242],[573,229],[704,690]]);break;
 case 3:out+=indoorWalls()+furniture(210,56,'shelf',280,82)+furniture(792,57,'shelf',255,80)+furniture(503,86,'table',153,76)+furniture(903,646,'bed',108,191,-17)+steps(437,480,126,516,10)+props([[269,318,'plank',1.2,-21],[680,473,'plank',1.1,16],[411,571,'plank',1.3,-55],[579,684,'plank',1.25,-70],[624,313,'rubble',.6]])+tree(180,831,1.2)+tree(836,836,1.2)+torch(351,236)+torch(856,298)+torch(395,586)+torch(595,584);break;
 case 4:case 16:out+=house(1,10,291,235)+house(801,13,199,344)+house(4,788,282,211)+house(795,792,204,208)+tree(841,730,.9)+props([[167,651,'crate',.8,14],[242,646,'barrel',.85],[732,889,'plank',1,-30]])+torch(269,681)+torch(750,339)+torch(785,734)+stains([[693,309],[216,744],[656,846]]);break;
 case 5:out+=house(437,0,124,268,0,'flat')+house(4,728,223,272)+house(808,699,192,301)+tree(237,933,.9)+torch(501,329)+torch(204,699)+torch(835,698)+props([[766,896,'crate',.75],[171,741,'plank',1.1,37],[883,622,'barrel',.7]])+stains([[792,530],[223,568]]);break;
 case 6:out+=pavingCircle(500,134,184)+house(0,667,199,333)+house(843,672,159,331,0,'flat')+torch(500,153)+torch(198,652)+torch(838,658)+props([[307,102,'crate',1,-21],[683,83,'coffin',.85,14],[718,855,'crate',.9,16],[652,866,'barrel',.75],[250,683,'barrel',.8]])+stains([[837,287],[268,559]]);break;
 case 7:out+=`<path d="M140 991Q212 841 146 714Q86 550 140 369Q107 189 233 94Q505-47 765 95Q890 195 855 369Q914 550 850 714Q787 840 862 991" fill="none" stroke="#17262c" stroke-width="48"/><path d="M140 991Q212 841 146 714Q86 550 140 369Q107 189 233 94Q505-47 765 95Q890 195 855 369Q914 550 850 714Q787 840 862 991" fill="none" stroke="#8a9381" stroke-width="19"/><path d="M142 987Q215 841 148 714Q89 550 143 369Q111 189 236 97Q505-43 761 97Q887 195 852 369Q911 550 847 714Q784 840 859 987" fill="none" stroke="#c0baa0" stroke-opacity=".36" stroke-width="5"/>`+altar(500,208,245)+steps(355,774,288,230,13)+tree(207,857,.75)+torch(208,420)+torch(783,420)+torch(231,721)+torch(768,721);break;
 case 8:out+=house(17,343,179,197)+house(797,336,182,207)+`<path d="M32 484H392M608 484H968" stroke="#222e2d" stroke-width="47"/><path d="M32 475H392M608 475H968" stroke="#a1a187" stroke-width="25"/><path d="M41 468H388M612 468H959" stroke="#c1bc9d" stroke-width="5"/>`+torch(369,487)+torch(630,487)+torch(153,150)+torch(853,171)+props([[346,182,'crate',1,-16],[739,441,'coffin',.9,-39],[188,855,'crate',.7,20],[301,897,'barrel',.8]])+stains([[520,897],[276,332]]);break;
 case 9:out+=house(3,91,139,487)+house(8,730,226,270)+house(817,680,183,320)+tree(170,900,.85)+torch(163,234)+torch(863,668)+torch(243,858)+props([[169,206,'barrel',1],[204,258,'barrel',.8],[744,764,'crate',.65,11],[777,106,'rubble',.65]])+stains([[191,514],[842,787]]);break;
 case 10:out+=pavingCircle(533,525,232)+house(420,370,230,310,0,'flat')+props([[785,124,'crate',.9,17],[672,157,'crate',.75,-10],[224,635,'barrel',.95],[327,627,'crate',.85,29]])+tree(116,903,1.1)+tree(291,439,.8)+torch(393,416)+torch(683,406)+torch(703,676)+torch(857,107)+stains([[601,788],[846,784],[215,888]]);break;
 case 11:out+=house(11,0,395,145)+house(691,1,310,199)+torch(147,161)+torch(831,235)+`<path d="M22 668H980V1000H22Z" fill="url(#stone-bricks)" stroke="#293e3b" stroke-width="9"/>`+steps(58,894,884,98,9)+furniture(503,771,'table',130,109)+steps(446,691,108,108,8)+props([[153,733,'coffin',1,10],[228,806,'crate',1,-10],[745,685,'rubble',1.1],[782,802,'rubble',1]])+tree(841,732,1.1)+torch(367,780)+torch(629,786);break;
 case 12:out+=indoorWalls(true)+altar(500,198,350)+rosette(322,510,155)+rosette(710,510,155)+rosette(510,516,150)+rosette(501,774,129)+steps(409,903,184,98,5)+torch(155,330)+torch(839,328)+torch(159,650)+torch(840,651);break;
 case 13:case 19:{out+=`<path d="M0 0H353L407 348L347 659L319 1000H0ZM688 0H1000V1000H715L650 620L716 303Z" fill="#35463b" fill-opacity=".48"/>`;const graves=[[71,117,54,91,-22],[140,55,68,108,0],[282,68,58,89,11],[673,73,62,100,-18],[790,140,54,92,16],[898,74,57,98,-14],[81,406,51,87,8],[190,514,68,103,-28],[791,384,62,105,-17],[898,511,58,93,31],[205,788,57,88,-21],[78,835,62,100,20],[683,821,62,106,-22],[893,861,55,85,14],[810,935,47,80,-20]];out+=graves.map(a=>grave(...a)).join('')+tree(id===13?500:187,id===13?497:750,1.3)+props([[730,660,'coffin',1.1,53],[157,701,'coffin',.95,-20],[329,886,'rubble',.9],[826,310,'rubble',.8]])+torch(161,280)+torch(818,223)+torch(670,801)+stains([[725,533],[282,339]]);if(id===19)out+=house(223,287,311,277,0,'flat')+rail(242,332,275)+torch(527,284);break;}
 case 14:out+=pavingCircle(512,512,276)+props([[185,261,'barrel',1.3],[755,109,'crate',.9,19],[304,871,'coffin',.9,-38],[216,877,'barrel',.8]])+tree(854,831,1.05)+torch(386,208)+torch(744,316)+torch(337,754)+stains([[218,549],[841,584]]);break;
 case 15:out+=house(1,0,433,139)+house(701,0,299,235)+house(1,848,418,154)+house(773,870,228,132)+steps(421,868,318,133,13)+props([[790,749,'barrel',.8],[185,768,'crate',.85,9],[833,826,'coffin',.8,21]])+torch(174,167)+torch(810,246)+torch(385,820)+stains([[841,319],[332,816],[799,829]]);break;
 case 17:out+=indoorWalls(true)+`<path d="M733 12Q769 137 833 183L895 219L938 163Q858 87 891 12Z" fill="#6d3932" stroke="#402d2a" stroke-width="5"/><path d="M788 24Q769 126 881 174M812 18Q804 109 903 146" fill="none" stroke="#a7785d" stroke-opacity=".45" stroke-width="5"/>`+furniture(515,875,'table',190,128)+props([[218,721,'crate',.8,-17],[768,792,'crate',.7,18],[174,925,'plank',1,-35]])+torch(199,260)+torch(813,280)+torch(228,695)+torch(802,697)+torch(370,887);break;
 case 18:out+=`<path d="M0 0H277V1000H0ZM723 0H1000V1000H723Z" fill="url(#water-ripples)"/><path d="M283 0V1000M717 0V1000" stroke="#111f24" stroke-width="28"/><path d="M297 0V1000M703 0V1000" stroke="#9d9d82" stroke-width="16"/><path d="M306 0V1000M694 0V1000" stroke="#4a615b" stroke-width="6"/>`+steps(432,0,136,143,6)+steps(432,885,136,118,6)+house(241,16,157,126,0,'flat')+house(595,14,160,128,0,'flat')+house(231,849,166,154,0,'flat')+house(592,849,170,154,0,'flat')+props([[374,344,'barrel',1],[648,348,'crate',1,17],[391,662,'crate',1.1,34],[626,706,'rubble',.8]])+torch(301,265)+torch(699,265)+torch(301,674)+torch(699,674)+stains([[479,692],[539,818]])+rail(304,30,921,90)+rail(696,953,921,270);break;
 case 20:out+=indoorWalls()+furniture(510,56,'shelf',330,85)+furniture(143,588,'bed',98,244)+furniture(822,115,'bed',114,154,30)+furniture(810,498,'table',117,149,19)+furniture(904,346,'shelf',164,75,90)+furniture(217,276,'table',130,102,-9)+steps(395,665,210,108,7)+props([[246,429,'crate',.7],[256,718,'plank',.8,20],[795,616,'barrel',.7],[391,170,'plank',.7,29],[906,683,'rubble',.65]])+torch(270,617)+torch(820,606)+torch(768,291)+stains([[141,574,.9],[716,449,.5]]);break;
 }
 // Final non-interactive lighting and edge shade keep the playable cells legible.
 out+=`<ellipse cx="510" cy="528" rx="490" ry="665" fill="url(#light-moon)"/><rect width="1000" height="1000" fill="url(#light-edge)"/><path d="M28 27H972V973H28Z" fill="none" stroke="#899487" stroke-opacity=".25" stroke-width="5"/></g>`;
 return out;
}

function render(t) {
  const g = G.definition(t.id);
  validate(t, g);
  const name = t.name || `구역 ${t.id.slice(-2)}`;
  const title = `${name}: ${t.spaces.length}칸, 출입구 ${g.exits.map((e) => e.edge).join("/")}`;
  const fills = ["#2a2a2a", "#30302e", "#282c2e", "#31302a"];
  const cells = Object.entries(g.spaces).map(([id, s], i) => `<polygon data-space-id="${esc(id)}" points="${points(s.polygon)}" fill="${fills[i % fills.length]}" fill-opacity=".10"/>`).join("\n");
  const blocked = (g.blocked || []).map((p) => `<polygon data-blocked="true" points="${points(p)}" fill="#181819" fill-opacity=".13" stroke="#8c8171" stroke-width="5"/><text x="535" y="535" text-anchor="middle" fill="#9b9184" font-size="29">건물</text>`).join("");
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
${artDefinitions()}
<rect width="1000" height="1000" fill="#171819"/>
${environment(t)}
${cells}
${blocked}
<g fill="none" stroke="#e4dece" stroke-width="9" stroke-linecap="butt">${dividers}</g>
<g fill="none" stroke="#817461" stroke-width="24">${walls(g.exits)}</g>
${g.exits.map(gate).join("\n")}
${g.markers.map(marker).join("\n")}
<g font-family="Malgun Gothic,Apple SD Gothic Neo,Arial,sans-serif">${labels}</g>

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
