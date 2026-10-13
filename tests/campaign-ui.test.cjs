const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const E = require("../hunt-engine"), M = require("../chapter-engine");
const C = require("../campaigns/long-hunt/data.json"), ED = require("../enemy-deck");
const G = require("../tile-geometry");
const root = path.join(__dirname, "..");
const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Only the DOM operations used by the offline controller are implemented. This
// runs its actual click handlers without a browser dependency or engine replay.
class Element {
  constructor(document, tag = "div", attributes = {}) {
    this.document = document; this.tagName = tag; this.attributes = attributes;
    this.dataset = {}; this.style = {}; this.children = []; this.listeners = {};
    this.value = attributes.value || ""; this.checked = "checked" in attributes;
    this.disabled = "disabled" in attributes; this.hidden = "hidden" in attributes;
    this.open = false; this._html = ""; this._text = null;
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith("data-"))
      this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  set innerHTML(html) {
    for (const child of this.children) if (child.attributes.id && this.document.ids.get(child.attributes.id) === child)
      this.document.ids.delete(child.attributes.id);
    this._html = html; this._text = null; this.children = this.document.parse(html);
  }
  get innerHTML() { return this._html; }
  set textContent(text) { this._text = String(text); }
  get textContent() { return this._text ?? decode(this._html.replace(/<[^>]+>/g, "")); }
  querySelectorAll(selector) {
    const attribute = selector.match(/^\[([^\]]+)\](:checked)?$/);
    if (attribute) return this.children.filter((e) => attribute[1] in e.attributes && (!attribute[2] || e.checked));
    if (selector.startsWith(".")) return this.children.filter((e) => selector.slice(1).split(".").every((c) => (e.attributes.class || "").split(" ").includes(c)));
    return [];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  fire(type) { this["on" + type]?.({ target: this }); for (const handler of this.listeners[type] || []) handler({ target: this }); }
  click() { if (!this.disabled) this.fire("click"); }
  getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
class Document {
  constructor(html) { this.ids = new Map(); this.parse(html); }
  parse(html) {
    const elements = [];
    for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
      const attributes = {};
      for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[a[1]] = decode(a[2] || "");
      const element = new Element(this, match[1], attributes); elements.push(element);
      if (attributes.id) this.ids.set(attributes.id, element);
    }
    for (const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
      const element = this.ids.get(match[1]); element._html = match[2];
      const options = [...match[2].matchAll(/<option\b([^>]*)>/g)];
      const chosen = options.find((m) => /\bselected\b/.test(m[1])) || options[0];
      element.value = decode(chosen?.[1].match(/value="([^"]*)"/)?.[1] || "");
    }
    return elements;
  }
  getElementById(id) { return this.ids.get(id) || null; }
  createElement(tag) { return new Element(this, tag); }
}
function baseState() { return E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }); }
function mission(chapter = 1, overrides = {}) {
  return { chapter, insight: 0, won: false, revealed: [1], completed: [],
    fog: [], tokens: [], targets: [], objectives: [], pending: null, ...overrides };
}
function rewards(items = [], overrides = {}) {
  return { rewards: items, choices: [], firearms: [], ...overrides };
}
function boot(state, view = mission(), rewardView = rewards(), options = {}) {
  const document = new Document(fs.readFileSync(path.join(root, "hunt.html"), "utf8"));
  const storage = new Map(Object.entries(options.storage || { "bloodborne-hunt-v07": "fixture" }));
  const commands = [], imports = [];
  const engine = { ...E, create: () => structuredClone(state),
    importSave: (text) => { imports.push(text); return structuredClone(state); },
    exportSave: (s) => JSON.stringify(s), missionView: () => view,
    rewardsView: () => rewardView, missionActions: () => options.actions || [],
    provisionalView: () => null,
    dispatch: (s, command) => { commands.push(command); return structuredClone(s); },
  };
  const window = { BBHunt: engine, BBChapter: M, BBLongHunt: C, BBEnemyDeck: ED, BBTileGeometry: G,
    BBInventory: () => ({ render() {}, clear() {}, ids: () => [], names: () => [] }),
    BBStartPlacement: { mount: (container, select, confirm) => {
      const update = () => { confirm.disabled = !select.value; };
      select.addEventListener("change", update); update(); return { update };
    } },
  };
  const context = vm.createContext({ window, document, localStorage: {
    getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
  }, Blob, URL, setTimeout() {}, console });
  vm.runInContext(fs.readFileSync(path.join(root, "hunt-app.js"), "utf8"), context);
  return { document, commands, storage, imports,
    el: (id) => document.getElementById(id),
    buttons: (id) => document.getElementById(id).querySelectorAll("[data-command]"),
  };
}
function option(ui, id, type) { return ui.buttons(id).find((b) => b.dataset.command === type); }

test("the second chapter shows current evidence, nine tiles and temporary notices without undiscovered objectives", () => {
  const s = baseState(); s.world.tilePool = Array.from({ length: 9 }, (_, i) => "tile-" + i);
  const ui = boot(s, mission(2, { revealed: [18], notices: ["등장한 임시 NPC 규칙"],
    objectives: [{ id: "shown", title: "현재 목표", status: "진행 중", description: "공개된 설명" },
      { id: "hidden", title: "미공개 임무 이름", status: "미발견", description: "숨길 뒷이야기" }] }));
  assert.match(ui.el("modeLabel").textContent, /챕터 2/);
  assert.match(ui.el("tileCount").textContent, /\/ 9/);
  assert.match(ui.el("missionNotices").innerHTML, /임시 NPC/);
  assert(!ui.el("missionObjectives").innerHTML.includes("미공개 임무 이름"));
  assert(!ui.el("revealedCards").innerHTML.includes("card-60.jpg"));
});
test("a valid v0.6 automatic save resumes into v0.7 without replacing its older key", () => {
  const ui = boot(baseState(), mission(), rewards(), { storage: { "bloodborne-hunt-v06": "old-save" } });
  assert.deepEqual(ui.imports, ["old-save"]);
  assert.equal(ui.storage.get("bloodborne-hunt-v06"), "old-save");
  assert(ui.storage.has("bloodborne-hunt-v07"));
  assert.match(ui.el("saveStatus").textContent, /v0.6에서 이어온/);
});
test("chapter completion offers equipment preparation and chapter three has a campaign ending", () => {
  const s = baseState(); s.phase = "over"; s.result = "chapter-win";
  const ui = boot(s, mission(2, { won: true }));
  option(ui, "decisions", "ENTER_BETWEEN_CHAPTERS").click();
  assert.equal(ui.commands[0].type, "ENTER_BETWEEN_CHAPTERS");
  const ending = boot(s, mission(3, { won: true }));
  assert.match(ending.el("phaseTitle").textContent, /캠페인 완수/);
  assert.equal(option(ending, "decisions", "ENTER_BETWEEN_CHAPTERS"), undefined);
});
test("the next chapter requires an explicit start space and sends the selected weapon face", () => {
  const s = baseState(); s.phase = "between_chapters";
  const ui = boot(s, mission(1, { won: true }));
  assert.equal(ui.el("startNextChapter").disabled, true);
  ui.el("nextChapterStart").value = "right"; ui.el("nextChapterStart").fire("change");
  ui.el("nextChapterFace").value = "1"; ui.el("nextChapterFace").fire("change");
  ui.el("startNextChapter").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "START_NEXT_CHAPTER", startSpace: "right", face: 1 });
});
test("all roar targets get their own destination and every selected move is sent", () => {
  const control = { type: "enemies-destinations", targets: [
    { enemyId: "enemy-a", name: "A", destinations: [{ node: "a:room", name: "원래 칸" }, { node: "a:next", name: "다음 칸" }] },
    { enemyId: "enemy-b", name: "B", destinations: [{ node: "b:room", name: "원래 칸" }] },
  ] };
  const ui = boot(baseState(), mission(), rewards([{ id: "reward-1", kind: "beast-roar", name: "야수의 포효", rules: "이동", equipped: true, ready: true, usable: true, subtype: "tool", controls: control }]));
  ui.el("rewardMove-reward-1-enemy-a").value = "a:next";
  ui.el("rewards").querySelectorAll("[data-reward-use]")[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "USE_REWARD", rewardId: "reward-1",
    moves: [{ enemyId: "enemy-a", node: "a:next" }, { enemyId: "enemy-b", node: "b:room" }] });
});
test("two independently selected attack rewards are passed together with the chosen stat card", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 3, node: h.position }];
  const items = ["rune-hunter", "rune-writhe"].map((kind, i) => ({ id: "reward-" + i, kind, name: kind,
    rules: "공격 효과", equipped: true, ready: true, subtype: "rune", attackSelectable: true }));
  const ui = boot(s, mission(), rewards(items));
  for (const item of items) {
    const choice = ui.el("rewards").querySelectorAll("[data-reward-attack]").find((b) => b.dataset.rewardAttack === item.id);
    choice.checked = true; choice.fire("change");
  }
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  option(ui, "decisions", "ATTACK").click();
  assert.deepEqual([...ui.commands[0].rewardIds].sort(), ["reward-0", "reward-1"]);
  assert.equal(ui.commands[0].cardId, h.hand[0].id);
});
test("generic mission actions preserve their provided consumable identity", () => {
  const ui = boot(baseState(), mission(3), rewards(), { actions: [{ label: "소모품 기부", command: { type: "MISSION_DONATE", itemId: "consumable-42" } }] });
  option(ui, "missionActions", "MISSION_DONATE").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "MISSION_DONATE", itemId: "consumable-42" });
});
test("changing an augur target updates its destinations before sending the selected enemy and space", () => {
  const control = { type: "enemy-destination", targets: [
    { enemyId: "enemy-a", name: "A", destinations: [{ node: "a:room", name: "A 공간" }] },
    { enemyId: "enemy-b", name: "B", destinations: [{ node: "b:next", name: "B 이동 칸" }] },
  ] };
  const ui = boot(baseState(), mission(), rewards([{ id: "reward-2", kind: "augur", name: "전조", rules: "이동", equipped: true, ready: true, usable: true, subtype: "tool", controls: control }]));
  ui.el("rewardEnemy-reward-2").value = "enemy-b"; ui.el("rewardEnemy-reward-2").fire("change");
  assert.match(ui.el("rewardNode-reward-2").innerHTML, /b:next/);
  assert(!ui.el("rewardNode-reward-2").innerHTML.includes("a:room"));
  ui.el("rewardNode-reward-2").value = "b:next";
  ui.el("rewards").querySelectorAll("[data-reward-use]")[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "USE_REWARD", rewardId: "reward-2", enemyId: "enemy-b", node: "b:next" });
});
test("a stored shard offers legal replacement and slot choices between chapters", () => {
  const s = baseState(); s.phase = "between_chapters";
  const items = [
    { id: "tool-a", kind: "lantern", name: "등불", rules: "이동", equipped: true, ready: true, subtype: "tool" },
    { id: "tool-b", kind: "beast-roar", name: "포효", rules: "이동", equipped: true, ready: true, subtype: "tool" },
    { id: "shard", kind: "bloodstone-shard", name: "혈석의 파편", rules: "슬롯 강화", equipped: false, ready: true, persistent: true, subtype: "tool" },
  ];
  const ui = boot(s, mission(1, { won: true }), rewards(items));
  const equip = ui.buttons("rewards").filter((b) => b.dataset.command === "EQUIP_REWARD");
  assert.equal(equip.length, 6);
  const chosen = equip.find((b) => {
    const args = JSON.parse(b.dataset.args); return args.replaceId === "tool-a" && args.slot === 2;
  });
  chosen.click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "EQUIP_REWARD", rewardId: "shard", replaceId: "tool-a", slot: 2 });
});
