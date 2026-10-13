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
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire("close"); }
  focus() { this.document.activeElement = this; }
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
    interactionEnemies: () => options.interactionEnemies || [],
    provisionalView: () => null,
    dispatch: (s, command) => { commands.push(command); return structuredClone(s); },
    ...options.engine,
  };
  const window = { BBHunt: engine, BBChapter: M, BBLongHunt: C, BBEnemyDeck: ED, BBTileGeometry: G,
    BBActualComponents: require("../actual-components"),
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

function storyButton(ui, container, key) {
  return ui.el(container).querySelectorAll("[data-story-key]").find((button) => button.dataset.storyKey === key);
}
test("campaign setup offers the supplied introduction and hides it in practice and temporary trials", () => {
  const ui = boot(baseState(), mission(), rewards(), { storage: {} });
  assert.equal(ui.el("setupDialog").open, true);
  assert.equal(ui.el("setupStory").hidden, false);
  assert.equal(ui.el("setupStoryText").textContent, C.preface[0].narrative);
  assert.equal(ui.el("storyPanel").hidden, true);
  for (const mode of ["practice", "cleric-beast", "female-patient-a", "iosefka"]) {
    ui.el("playMode").value = mode; ui.el("playMode").fire("change");
    assert.equal(ui.el("setupStory").hidden, true);
  }
  ui.el("playMode").value = "campaign"; ui.el("playMode").fire("change");
  assert.equal(ui.el("setupStory").hidden, false);
  assert.deepEqual(ui.commands, []);
});
test("reading the introduction and enlarged public cards changes no game save or commands", () => {
  const s = baseState(), initial = JSON.stringify(s), ui = boot(s, mission(1, { revealed: [1, 5, 6] })),
    saved = ui.storage.get("bloodborne-hunt-v07");
  storyButton(ui, "storyIntro", "intro").click();
  assert.equal(ui.el("storyDialog").open, true);
  assert.match(ui.el("storyText").innerHTML, new RegExp(C.preface[0].narrative.slice(0, 15)));
  assert.equal(ui.el("previousStory").disabled, true);
  ui.el("nextStory").click();
  assert.match(ui.el("storyMeta").textContent, /카드 1/);
  assert.match(ui.el("storyDescription").textContent, /원문 이미지/);
  assert.match(ui.el("storyPhoto").innerHTML, /card-01.jpg/);
  assert(!ui.el("storyPhoto").innerHTML.includes("card-02.jpg"));
  assert.equal(ui.el("storyText").hidden, true);
  ui.el("storyZoom").value = "175"; ui.el("storyZoom").fire("input");
  assert.equal(ui.el("storyImage").style.width, "175%");
  assert.equal(ui.el("storyZoomValue").textContent, "175%");
  ui.el("nextStory").click(); ui.el("nextStory").click();
  assert.match(ui.el("storyMeta").textContent, /카드 6/);
  assert.equal(ui.el("nextStory").disabled, true);
  ui.el("closeStory").click();
  assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.el("storyPhoto").innerHTML, "");
  assert.deepEqual(ui.commands, []);
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), saved);
  assert.equal(JSON.stringify(s), initial);
});
test("an altered story button cannot open an unrevealed source card", () => {
  const ui = boot(baseState(), mission());
  const button = storyButton(ui, "storyList", "1:1");
  button.dataset.storyKey = "1:60"; button.click();
  assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.el("storyPhoto").innerHTML, "");
  assert(!ui.el("storyList").innerHTML.includes(C.cards[59].title));
  assert(!ui.el("storyList").innerHTML.includes("1:60"));
});
test("past chapter story access is limited to its actual reveal history", () => {
  const ui = boot(baseState(), mission(2, { revealed: [17, 18],
    history: [{ chapter: 1, completed: [4], revealed: [1, 2, 3, 4] }] }));
  assert.match(ui.el("pastChapters").innerHTML, /1:4/);
  assert(!ui.el("pastChapters").innerHTML.includes("1:5"));
  assert(!ui.el("storyList").innerHTML.includes("2:19"));
  storyButton(ui, "pastChapters", "1:4").click();
  assert.match(ui.el("storyMeta").textContent, /챕터 1.*카드 4/);
  assert.match(ui.el("storyPhoto").innerHTML, /card-04.jpg/);
  ui.el("nextStory").click();
  assert.match(ui.el("storyMeta").textContent, /챕터 2.*카드 17/);
  assert.deepEqual(ui.commands, []);
});
test("a later reveal is highlighted after read marks without adding story data to a resumed old save", () => {
  const s = baseState(), view = mission(), ui = boot(s, view, rewards(), {
    storage: { "bloodborne-hunt-v06": "old-save" },
  });
  storyButton(ui, "storyList", "1:1").click(); ui.el("closeStory").click();
  assert.match(ui.el("storyNotice").innerHTML, /모두 읽었습니다/);
  view.revealed.push(5, 6);
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  option(ui, "decisions", "MOVE").click();
  assert.match(ui.el("storyNotice").innerHTML, /아직 읽지 않은 이야기 2장/);
  assert.match(ui.el("storyNotice").innerHTML, /카드 5, 6/);
  assert.equal(ui.storage.get("bloodborne-hunt-v06"), "old-save");
  assert(!ui.storage.get("bloodborne-hunt-v07").includes("readStories"));
  assert.equal(ui.commands.length, 1);
});
test("practice has no campaign story panel or available story opener", () => {
  const ui = boot(baseState(), null);
  assert.equal(ui.el("storyPanel").hidden, true);
  assert.equal(ui.el("storyList").innerHTML, "");
  assert.equal(ui.el("storyIntro").innerHTML, "");
  assert.equal(ui.el("storyDialog").open, false);
});
test("activation order explains the rule to choose the most adverse result", () => {
  const s = baseState(); s.phase = "activation";
  const ui = boot(s);
  assert.match(ui.el("phaseHelp").textContent, /사냥꾼에게 가장 불리한 결과/);
});
test("interaction retaliation offers each pending enemy and sends the selected figure identity", () => {
  const s = baseState(); s.phase = "interaction_order";
  const enemies = [
    { id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 3, node: E.hunter(s).position },
    { id: "huntsmans-minion-1", kind: "huntsmans-minion", figure: 1, hp: 4, node: E.hunter(s).position },
  ];
  s.enemies = enemies;
  const ui = boot(s, mission(), rewards(), { interactionEnemies: enemies });
  assert.match(ui.el("phaseTitle").textContent, /적의 반격 순서/);
  assert.match(ui.el("phaseHelp").textContent, /사냥꾼에게 가장 불리한 결과/);
  assert.match(ui.el("phaseHelp").textContent, /맞서 공격하거나 회피할 수 없습니다/);
  const buttons = ui.buttons("decisions");
  assert.deepEqual(buttons.map((button) => JSON.parse(button.dataset.args).enemyId), enemies.map((enemy) => enemy.id));
  buttons[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "INTERACTION_ENEMY", enemyId: enemies[1].id });
});
test("the source archive retains its spoiler gate and displays the supplied introduction text", () => {
  const document = new Document(fs.readFileSync(path.join(root, "campaign.html"), "utf8"));
  const context = vm.createContext({ window: { BBLongHunt: C, BBTileGeometry: G }, document, console });
  vm.runInContext(fs.readFileSync(path.join(root, "campaign.js"), "utf8"), context);
  assert.equal(document.getElementById("archive").hidden, true);
  assert.equal(document.getElementById("cardDetail").children.length, 0);
  document.getElementById("openArchive").click();
  assert.equal(document.getElementById("gate").hidden, true);
  assert.equal(document.getElementById("archive").hidden, false);
  const texts = (element) => [element.textContent, ...element.children.flatMap(texts)];
  assert(texts(document.getElementById("cardDetail")).includes(C.preface[0].narrative));
});

function suppliedGun(id, overrides = {}) {
  return { id, name: id === "flamesprayer" ? "화염방사기" : id === "ludwig-rifle" ? "루드비히 장총" : "교단 연발총",
    actual: true, temporary: false, prepareCost: id === "repeating-pistol" ? 1 : 2,
    trigger: id === "flamesprayer" ? "hunter-turn" : id === "ludwig-rifle" ? "enemy-enters" : "enemy-basic",
    prepareOnTransform: id === "repeating-pistol", ...overrides };
}
test("actual firearms display their own triggers and preparation costs instead of the legacy replacement", () => {
  for (const id of ["ludwig-rifle", "repeating-pistol", "flamesprayer"]) {
    const ui = boot(baseState(), mission(), rewards(), { engine: { firearm: () => suppliedGun(id), canFirearm: () => false } });
    assert.match(ui.el("firearm").innerHTML, /제공된 실물 카드/);
    assert(!ui.el("firearm").innerHTML.includes("임시 동작"));
    assert.match(ui.el("firearm").innerHTML, new RegExp(`카드 ${id === "repeating-pistol" ? 1 : 2}장`));
    if (id === "ludwig-rifle") assert.match(ui.el("firearm").innerHTML, /이동해 들어올 때/);
    if (id === "repeating-pistol") assert.match(ui.el("firearm").innerHTML, /변형할 때도 준비/);
    if (id === "flamesprayer") assert.match(ui.el("firearm").innerHTML, /속도 2 · 피해 2 · 방해/);
  }
  const legacyState = baseState(); E.hunter(legacyState).firearmId = "ludwig-rifle";
  const legacy = boot(legacyState, mission(), rewards(), { engine: {
    firearm: () => ({ name: "루드비히 장총", actual: false, temporary: true }), canFirearm: () => false,
  } });
  // An acquired old gun is deliberately still the approved pistol replacement.
  assert.match(legacy.el("firearm").innerHTML, /기본 공격을 자동으로 방해/);
  assert.match(legacy.el("firearm").innerHTML, /단총과 같은 능력으로 임시 동작/);
  assert(!legacy.el("firearm").innerHTML.includes("제공된 실물 카드"));
});
test("fresh campaign gun choices distinguish supplied effects from the existing temporary trial effects", () => {
  const ui = boot(baseState(), mission(), rewards(), { storage: {} });
  assert.match(ui.el("gun").innerHTML, /실물 고유 효과/);
  ui.el("gun").value = "ludwig-rifle";
  ui.el("playMode").value = "practice"; ui.el("playMode").fire("change");
  assert.match(ui.el("gun").innerHTML, /실물 고유 효과/);
  assert.equal(ui.el("gun").value, "ludwig-rifle");
  ui.el("playMode").value = "cleric-beast"; ui.el("playMode").fire("change");
  assert.match(ui.el("gun").innerHTML, /임시 단총 능력/);
  assert(!ui.el("gun").innerHTML.includes("실물 고유 효과"));
  assert.equal(ui.el("gun").value, "ludwig-rifle");
  ui.el("playMode").value = "campaign"; ui.el("playMode").fire("change");
  assert.match(ui.el("gun").innerHTML, /실물 고유 효과/);
  assert.equal(ui.el("gun").value, "ludwig-rifle");
});
test("two-card firearm preparation waits for distinct hand cards and sends both identities", () => {
  const s = baseState(), h = E.hunter(s); h.firearmReady = false;
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => suppliedGun("ludwig-rifle"), canFirearm: () => false } });
  assert.equal(option(ui, "decisions", "RELOAD").disabled, true);
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  assert.equal(option(ui, "decisions", "RELOAD").disabled, true);
  assert(!ui.el("reloadSecondCard").innerHTML.includes(`value="${h.hand[0].id}"`));
  ui.el("reloadSecondCard").value = h.hand[1].id; ui.el("reloadSecondCard").fire("change");
  const reload = option(ui, "decisions", "RELOAD"); assert.equal(reload.disabled, false); reload.click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "RELOAD", cardIds: [h.hand[0].id, h.hand[1].id] });
});
test("the repeating pistol prepares with one chosen card while an older save keeps cardId", () => {
  for (const actual of [true, false]) {
    const s = baseState(); E.hunter(s).firearmReady = false;
    const ui = boot(s, mission(), rewards(), { engine: {
      firearm: () => suppliedGun("repeating-pistol", { actual, temporary: !actual }), canFirearm: () => false,
    } });
    ui.el("hand").querySelectorAll("[data-card]")[0].click(); option(ui, "decisions", "RELOAD").click();
    assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), actual
      ? { type: "RELOAD", cardIds: [E.hunter(s).hand[0].id] }
      : { type: "RELOAD", cardId: E.hunter(s).hand[0].id });
  }
});
test("the flamesprayer targets the selected colocated enemy without selecting a stat card", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => suppliedGun("flamesprayer"), canFirearm: () => true } });
  option(ui, "firearm", "FIREARM").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "FIREARM", enemyId: "huntsman-mob-1" });
});
test("the flamesprayer can replace a counterattack before the enemy action is revealed", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  s.phase = "combat_choose"; s.combat = { enemyId: "huntsman-mob-1", origin: "enemy" };
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => suppliedGun("flamesprayer"), canFirearm: () => true } });
  option(ui, "decisions", "FIREARM").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "FIREARM", enemyId: "huntsman-mob-1" });
  assert.match(ui.el("decisions").innerHTML, /화염방사기로 맞서 공격/);
});
test("the flamesprayer is hidden after an enemy action has been revealed", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  s.phase = "combat_react"; s.combat = { enemyId: "huntsman-mob-1", origin: "enemy" };
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => suppliedGun("flamesprayer"), canFirearm: () => true } });
  assert.equal(ui.buttons("decisions").filter(b => b.dataset.command === "FIREARM").length, 0);
  assert.equal(ui.buttons("firearm").filter(b => b.dataset.command === "FIREARM").length, 0);
});
test("combat information shows a declared standalone flamesprayer attack without a stat attack", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  s.phase = "combat_react"; s.combat = {
    enemyId: "huntsman-mob-1", origin: "firearm", attack: null, defense: 0,
    action: { kind: "basic", name: "도끼 휘두르기", speed: 2, damage: 2 },
    flame: { speed: 2, damage: 2, interrupt: true, splash: 1 },
  };
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => suppliedGun("flamesprayer"), canFirearm: () => false } });
  assert.match(ui.el("combatInfo").innerHTML, /화염방사기 공격 · 속도 2 \/ 피해 2 · 방해 · 같은 칸의 다른 적에게 피해 1/);
  assert(!ui.el("combatInfo").innerHTML.includes("사냥꾼 공격 없음"));
});
test("the long-rifle entry reaction offers use and skip without showing a later enemy action", () => {
  const s = baseState(); s.phase = "firearm_react";
  const ui = boot(s, mission(), rewards(), { engine: {
    firearm: () => suppliedGun("ludwig-rifle"), canFirearm: () => false,
    firearmEntryView: () => ({ enemyName: "재앙의 야수", damage: 2 }),
  } });
  assert.match(ui.el("phaseTitle").textContent, /진입한 적 대응/);
  assert.match(ui.el("decisions").innerHTML, /재앙의 야수/);
  assert.equal(ui.el("combatInfo").innerHTML, "");
  const choices = ui.buttons("decisions").filter((b) => b.dataset.command === "FIREARM_ENTRY");
  assert.equal(choices.length, 2); choices[0].click(); choices[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands)), [
    { type: "FIREARM_ENTRY", accept: true }, { type: "FIREARM_ENTRY", accept: false },
  ]);
});
test("a boss or printed enemy ability reaction uses its indicated dodge speed and damage", () => {
  const s = baseState(); s.phase = "boss_react";
  const ui = boot(s, mission(), rewards(), { engine: {
    combatReaction: () => ({ title: "뛰어 내려찍기", dodgeSpeed: 1, damage: 2, effects: ["기절"] }),
    canDodge: (_state, cardId) => !!cardId,
  } });
  assert.equal(ui.el("phaseTitle").textContent, "뛰어 내려찍기");
  assert.match(ui.el("phaseHelp").textContent, /속도 1.*기절/);
  assert.equal(option(ui, "decisions", "DODGE").disabled, true);
  ui.el("hand").querySelectorAll("[data-card]")[0].click(); option(ui, "decisions", "DODGE").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "DODGE", cardId: E.hunter(s).hand[0].id, slot: 0 });
  option(ui, "decisions", "RESOLVE").click(); assert.equal(ui.commands[1].type, "RESOLVE");
});
test("boss and forced hunter movements expose legal destinations with the BOSS_STEP contract", () => {
  const s = baseState(); s.phase = "boss_move";
  const ui = boot(s, mission(), rewards(), { engine: { bossMoveOptions: () => ["tile-14:left", "tile-14:right"] } });
  const moves = ui.buttons("decisions").filter((b) => b.dataset.command === "BOSS_STEP");
  assert.equal(moves.length, 2); moves[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "BOSS_STEP", node: "tile-14:right" });
});
test("actual special components show source, insight tokens and project-relative images without invented prefixes", () => {
  const s = baseState(), h = E.hunter(s);
  const boss = { id: "mission-boss", kind: "scourge-beast", figure: 1, componentId: "cleric-beast",
    componentPhase: 1, hp: 10, insightTokens: 2, node: h.position };
  const npc = { id: "mission-npc", kind: "huntsmans-minion", figure: 1, componentId: "iosefka", hp: 10, node: h.position };
  s.enemies = [boss, npc];
  const defs = {
    [boss.id]: { name: "성직자 야수", maxHp: 10, boss: true, actual: true, temporary: false,
      source: { title: "실물 원문" }, sourceLabel: "실물 원문", face: {},
      slam: { name: "내려찍기", type: "attack", speed: 2, damage: 4, rules: [] } },
    [npc.id]: { name: "이오세프카", maxHp: 10, actual: true, temporary: false,
      source: { title: "실물 원문" }, sourceLabel: "실물 원문", face: { image: "참고자료/제공 구성품.jpg", imageBase: "project" } },
  };
  const ui = boot(s, mission(), rewards(), { engine: { canBossInsight: () => true,
    enemyDef: (state, enemy) => typeof enemy === "object" && defs[enemy.id] ? defs[enemy.id] : E.enemyDef(state, enemy),
  } });
  assert.equal(ui.el("componentsPanel").hidden, false);
  const html = ui.el("componentCards").innerHTML;
  assert.match(html, /시트의 계몽 토큰 2개/); assert.match(html, /실제 구성품/);
  assert.match(html, /현재 페이즈의 행동 카드/); assert.match(html, /내려찍기/);
  assert.match(html, /src="참고자료\/제공 구성품.jpg"/);
  assert(!html.includes("campaigns/long-hunt/참고자료")); assert(!html.includes("[object Object]"));
  option(ui, "componentCards", "BOSS_INSIGHT").click(); assert.equal(ui.commands[0].type, "BOSS_INSIGHT");
});
