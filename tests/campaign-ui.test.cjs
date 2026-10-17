const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const E = require("../src/hunt-engine"), M = require("../src/chapter-engine");
const C = require("../campaigns/long-hunt/data.json"), ED = require("../src/enemy-deck");
const N = require("../campaigns/long-hunt/narrative-text");
const G = require("../src/tile-geometry");
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
    // DOMTokenList.contains reads the current class attribute, including parsed tiles.
    this.classList = { contains: token => String(this.attributes.class || "").split(/[\t\n\f\r ]+/).filter(Boolean).includes(String(token)) };
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
  const commands = [], imports = [], creates = [];
  // Historical presentation fixtures keep their original policy; migration has dedicated tests.
  const engine = { ...E, applyTileSpeedRuling: state => state, create: (...args) => { creates.push(args); return structuredClone(state); },
    importSave: (text) => { imports.push(text); return structuredClone(state); },
    exportSave: (s) => JSON.stringify(s), missionView: () => view,
    rewardsView: () => rewardView, missionActions: () => options.actions || [],
    interactionEnemies: () => options.interactionEnemies || [],
    provisionalView: () => null,
    dispatch: (s, command) => { commands.push(command); return structuredClone(s); },
    ...options.engine,
  };
  const window = { BBHunt: engine, BBChapter: M, BBLongHunt: C, BBNarrativeText: N, BBEnemyDeck: ED, BBTileGeometry: G, BBMapRenderLayout: require("../src/map-render-layout"),
    BBHuntPublicText: require("../src/hunt-public-text"), BBEnemyActionHistory: require("../src/enemy-action-history"),
    BBActualComponents: require("../src/actual-components"),
    BBExtendedEnemies: require("../src/extended-enemies"),
    BBExtendedFirearms: require("../src/extended-firearms"),
    BBRewards: options.rewardDefinitions ? { definitions: options.rewardDefinitions } : require("../src/rewards-engine"),
    BBInventory: () => ({ render() {}, clear() {}, ids: () => [], names: () => [] }),
    BBStartPlacement: { mount: (container, select, confirm) => {
      const update = () => { confirm.disabled = !select.value; };
      select.addEventListener("change", update); update(); return { update };
    } },
  };
  const context = vm.createContext({ window, document, localStorage: {
    getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
  }, Blob, URL, setTimeout() {}, console });
  vm.runInContext(fs.readFileSync(path.join(root, "src/hunt-app.js"), "utf8"), context);
  return { document, commands, storage, imports, creates,
    el: (id) => document.getElementById(id),
    buttons: (id) => document.getElementById(id).querySelectorAll("[data-command]"),
  };
}
function option(ui, id, type) { return ui.buttons(id).find((b) => b.dataset.command === type); }

test("mandatory reward equipment stays actionable while a weapon continuation is waiting", () => {
  const s=E.create(90,"burial",0,null,"hunter-pistol","center",{
    campaign:false,practiceRewards:["bloodstone-chunk"],
  });
  s.phase="weapon_choice";
  const ui=boot(s,null,E.rewardsView(s),{engine:{
    weaponChoices:()=>[{label:"다음 무기 효과",command:{type:"WEAPON_CHOICE",enemyId:"scourge-beast-1"}}],
  }});
  assert.equal(ui.el("phaseTitle").textContent,"획득한 보상 선택");
  assert(option(ui,"decisions","EQUIP_REWARD"));
  assert(option(ui,"decisions","KEEP_REWARD"));
  assert.equal(option(ui,"decisions","WEAPON_CHOICE"),undefined);
  option(ui,"decisions","KEEP_REWARD").click();
  assert.equal(ui.commands[0].type,"KEEP_REWARD");
});

test("public fog checkpoint explains why the lantern is disabled and hides forbidden lamps", () => {
  let s=E.create(90,"rifle-spear",1,null,"hunter-pistol","center",{campaign:true,rulesVersion:11});
  for(const command of require("./fixtures/v074-lantern-fog-commands.json"))s=E.dispatch(s,command);
  const view=E.rewardsView(s), lantern=view.rewards.find(r=>r.kind==="lantern");
  const ui=boot(s,E.missionView(s),view);
  assert.equal(ui.el("rewardLamp-"+lantern.id).disabled,true);
  assert.equal(ui.el("rewardLamp-"+lantern.id).innerHTML,"");
  const use=ui.el("rewards").querySelectorAll("[data-reward-use]").find(b=>b.dataset.rewardUse===lantern.id);
  assert(use.disabled);
  assert.match(ui.el("rewards").innerHTML,/안개/);
});

test("practice reward quantities use printed supply and never become campaign starting rewards", () => {
  const definitions = Object.fromEntries(E.data.components.cards.filter((card) => card.group === "reward")
    .map((card) => [card.id, { ...card, subtype: ["music-box", "ritual-material"].includes(card.id) ? "quest" : card.id.startsWith("rune-") ? "rune" : "tool" }]));
  const ui = boot(baseState(), null, rewards(), { storage: {}, rewardDefinitions: definitions });
  ui.el("playMode").value = "practice"; ui.el("playMode").fire("change");
  const selections = ui.el("practiceRewards").querySelectorAll("[data-practice-reward]");
  assert.equal(selections.length, 32);
  const chunk = selections.find((select) => select.dataset.practiceReward === "bloodstone-chunk");
  assert.match(ui.el("practiceRewards").innerHTML, /정규|사용 효과가 없는 임무 물품/);
  chunk.value = "1"; chunk.fire("change");
  const materials = selections.find((select) => select.dataset.practiceReward === "ritual-material");
  materials.value = "2"; materials.fire("change");
  assert.match(ui.el("practiceRewardsNotice").textContent, /3장/);
  ui.el("start").value = "left"; ui.el("start").fire("change"); ui.el("confirmSetup").click();
  assert.deepEqual([...ui.creates.at(-1)[6].practiceRewards], ["bloodstone-chunk", "ritual-material", "ritual-material"]);
  ui.el("playMode").value = "campaign"; ui.el("playMode").fire("change");
  assert.equal(ui.el("practiceSetup").hidden, true);
  ui.el("confirmSetup").click();
  assert.equal(Object.hasOwn(ui.creates.at(-1)[6], "practiceRewards"), false);
});

test("Adella optional echo payment and Guidance occupied slot choices reach the reward command", () => {
  const items = [
    { id: "adella", kind: "adella-blood", name: "아데라의 피", equipped: true, ready: true, usable: true, subtype: "tool", controls: { type: "echo-option", available: true } },
    { id: "guidance", kind: "rune-guidance", name: "카릴 문자:인도", equipped: true, ready: true, usable: true, subtype: "rune", controls: { type: "slot", slots: [{ slot: 0, name: "빈 칸", occupied: false }, { slot: 1, name: "점유 슬롯", occupied: true }] } },
  ];
  const ui = boot(baseState(), null, rewards(items));
  assert.match(ui.el("rewards").innerHTML, /추가 치유 2/);
  assert.equal(ui.el("rewardEcho-adella").checked, false);
  ui.el("rewardEcho-adella").checked = true;
  ui.el("rewards").querySelectorAll("[data-reward-use]").find((b) => b.dataset.rewardUse === "adella").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "USE_REWARD", rewardId: "adella", payEcho: true });
  assert(ui.el("rewardSlot-guidance").innerHTML.includes('value="0"'));
  assert.match(ui.el("rewardSlot-guidance").innerHTML, /비어 있음/);
  ui.el("rewardSlot-guidance").value = "1";
  ui.el("rewards").querySelectorAll("[data-reward-use]").find((b) => b.dataset.rewardUse === "guidance").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[1])), { type: "USE_REWARD", rewardId: "guidance", slot: 1 });
  ui.el("rewardSlot-guidance").value = "0";
  ui.el("rewards").querySelectorAll("[data-reward-use]").find((b) => b.dataset.rewardUse === "guidance").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[2])), { type: "USE_REWARD", rewardId: "guidance", slot: 0 });
});

test("new direct rewards expose available commands while unavailable quest and solo targets explain their limits", () => {
  const direct = ["arianna-blood", "call-beyond", "queen-flesh", "ring", "rune-communion", "rune-radiance"];
  const items = direct.map((kind) => ({ id: kind, kind, name: kind, equipped: true, ready: true, usable: true, subtype: kind.startsWith("rune-") ? "rune" : "tool" }));
  items.push({ id: "music", kind: "music-box", name: "작은 오르골", ready: true, equipped: false, subtype: "quest", usable: false, disabledReason: "원문 사용불가" });
  items.push({ id: "corruption", kind: "rune-corruption", name: "카릴 문자:타락", ready: true, equipped: true, subtype: "rune", triggerSelectable: true, limitUsed: true });
  const ui = boot(baseState(), null, rewards(items));
  assert.equal(ui.buttons("rewards").filter((b) => b.dataset.command === "USE_REWARD").length, 6);
  assert.match(ui.el("rewards").innerHTML, /임무 물품 · 사용 효과 없음/);
  assert.match(ui.el("rewards").innerHTML, /원문 사용불가/);
  assert.match(ui.el("rewards").innerHTML, /이번 챕터 사용 완료/);
  assert.match(ui.el("rewards").innerHTML, /다음 죽음에 카릴 문자:타락 사용/);
  option(ui, "rewards", "SET_REWARD_TRIGGER").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "SET_REWARD_TRIGGER", rewardId: "corruption", enabled: true });
});

test("a torch entry decision sends accept or skip before revealing a combat action", () => {
  const s = baseState(); s.phase = "reward_entry";
  const ui = boot(s, null, rewards([], { entry: { rewardId: "torch", title: "야수 사냥의 횃불", enemyId: "entering", enemyName: "교단 거인", damage: 1 } }));
  assert.match(ui.el("phaseTitle").textContent, /횃불/);
  assert.match(ui.el("phaseHelp").textContent, /교단 거인/);
  assert.equal(ui.buttons("decisions").filter((b) => b.dataset.command === "ENTRY_REWARD").length, 2);
  ui.buttons("decisions").find((b) => JSON.parse(b.dataset.args).accept === true).click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "ENTRY_REWARD", accept: true });
  ui.buttons("decisions").find((b) => JSON.parse(b.dataset.args).accept === false).click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[1])), { type: "ENTRY_REWARD", accept: false });
});

test("standalone firearm attacks pass broad reward choices and explain the stat-only Clawmark restriction", () => {
  const s = baseState(); s.setup.rulesVersion = 11; const h = E.hunter(s);
  s.enemies = [{ id: "target", kind: "huntsman-mob", node: h.position, hp: 8, figure: 1 }];
  h.rewards = [{ id: "shell", kind: "empty-shell", equipped: true, ready: true }, { id: "claw", kind: "rune-clawmark", equipped: true, ready: true }];
  const items = h.rewards.map((r) => ({ ...r, name: r.kind, rules: "공격할 때", subtype: r.kind === "empty-shell" ? "tool" : "rune", attackSelectable: true }));
  const ui = boot(s, null, rewards(items), { engine: { firearm: () => require("../src/extended-firearms").firearm("cannon"), canFirearm: () => true } });
  let choice = ui.el("rewards").querySelectorAll("[data-reward-attack]").find((input) => input.dataset.rewardAttack === "shell");
  choice.checked = true; choice.fire("change");
  let gunButton = option(ui, "firearm", "FIREARM");
  assert.deepEqual([...JSON.parse(gunButton.dataset.args).rewardIds], ["shell"]);
  assert.equal(gunButton.disabled, false);
  choice = ui.el("rewards").querySelectorAll("[data-reward-attack]").find((input) => input.dataset.rewardAttack === "claw");
  choice.checked = true; choice.fire("change");
  gunButton = option(ui, "firearm", "FIREARM");
  assert.equal(gunButton.disabled, true);
  assert.match(ui.el("firearm").innerHTML, /손톱자국은 스탯 카드 공격에만/);
  choice = ui.el("rewards").querySelectorAll("[data-reward-attack]").find((input) => input.dataset.rewardAttack === "claw");
  choice.checked = false; choice.fire("change");
  option(ui, "firearm", "FIREARM").click();
  assert.deepEqual([...ui.commands[0].rewardIds], ["shell"]);
});

test("a torch reacting to a longer entry lets the hunter select a legal one-space stopping point", () => {
  const s = baseState(); s.phase = "reward_entry";
  const ui = boot(s, null, rewards([], { entry: { rewardId: "torch", enemyId: "entering", enemyName: "적", damage: 1,
    stops: [{ node: "left", name: "왼쪽 칸" }, { node: "right", name: "오른쪽 칸" }] } }));
  const uses = ui.buttons("decisions").filter((b) => JSON.parse(b.dataset.args).accept === true);
  assert.equal(uses.length, 2);
  assert.match(uses[1].innerHTML + ui.el("decisions").innerHTML, /오른쪽 칸/);
  uses[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "ENTRY_REWARD", accept: true, node: "right" });
});

test("changing the selected enemy refreshes the standalone firearm target before it is used", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = ["first", "second"].map((id, index) => ({ id, kind: "huntsman-mob", node: h.position, hp: 6, figure: index + 1 }));
  const ui = boot(s, null, rewards(), { engine: { firearm: () => require("../src/extended-firearms").firearm("cannon"), canFirearm: () => true } });
  ui.el("nearEnemies").querySelectorAll("[data-enemy]").find((b) => b.dataset.enemy === "second").click();
  option(ui, "firearm", "FIREARM").click();
  assert.equal(ui.commands[0].enemyId, "second");
});

test("the public component catalog keeps ordinary effects and hides undiscovered rewards without changing source data", () => {
  const source = require("../components/cards.json"), before = JSON.stringify(source);
  const document = new Document(fs.readFileSync(path.join(root, "pages/components.html"), "utf8"));
  document.getElementById("query").value = "";
  document.getElementById("group").value = "reward";
  const context = vm.createContext({ window: { BBComponents: source }, document });
  vm.runInContext(fs.readFileSync(path.join(root, "src/components.js"), "utf8"), context);
  assert.equal(document.getElementById("resultCount").textContent, "0종");
  assert(document.getElementById("cards").children.every((c) => !c.dataset.id));
  document.getElementById("group").value = "consumable"; document.getElementById("group").fire("change");
  const texts = (element) => [element.textContent, ...element.children.flatMap(texts)];
  assert(texts(document.getElementById("cards")).includes("골수 가루"));
  assert(!texts(document.getElementById("cards")).includes("음악 상자"));
  assert.equal(JSON.stringify(source), before);
  assert(!fs.readFileSync(path.join(root, "pages/components.html"), "utf8").includes("자료 등록\n        단계"));
});

test("pending reward equipment choices disable independent firearm attacks and effects in the firearm panel", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "target", kind: "huntsman-mob", node: h.position, hp: 6, figure: 1 }];
  const reward = { id: "gem", kind: "tear-gem", name: "눈물의 혈정석", rules: "부착", persistent: true, equipped: false, ready: true, subtype: "tool" };
  for (const id of ["cannon", "hunter-blunderbuss"]) {
    const ui = boot(s, null, rewards([reward], { choices: [{ rewardId: reward.id }] }), {
      engine: { firearm: () => require("../src/extended-firearms").firearm(id), canFirearm: () => true },
    });
    const gun = option(ui, "firearm", "FIREARM");
    assert.equal(gun.disabled, true);
    gun.click();
    assert.equal(ui.commands.length, 0);
    assert.equal(ui.el("phaseTitle").textContent, "획득한 보상 선택");
  }
});

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
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "START_NEXT_CHAPTER", startSpace: "right", face: 1, reassignAttachments: true });
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
  ui.el("slots").querySelectorAll("[data-slot]")[0].click();
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

test("the new-hunt weapon menu exposes all supplied weapons and previews their real slot counts", () => {
  const ui = boot(baseState(), mission(), rewards(), { storage: {} });
  assert.equal((ui.el("weapon").innerHTML.match(/<option /g) || []).length, 15);
  assert(!ui.el("weapon").innerHTML.includes('value="training"'));
  ui.el("weapon").value = "stake-driver"; ui.el("weapon").fire("change");
  assert.equal(ui.el("gun").value, "repeating-pistol");
  ui.el("face").value = "1"; ui.el("face").fire("change");
  assert.match(ui.el("setupWeaponPreview").innerHTML, /폭파/);
  assert.equal((ui.el("setupWeaponPreview").innerHTML.match(/<span>/g) || []).length, 1);
  assert.match(ui.el("setupWeaponPreview").innerHTML, /다른 모든 적에게 2피해/);
  ui.el("playMode").value = "cleric-beast"; ui.el("playMode").fire("change");
  assert.equal(ui.el("weapon").value, "burial");
  assert.equal(ui.el("weapon").disabled, true);
  assert.equal((ui.el("weapon").innerHTML.match(/<option /g) || []).length, 1);
});
test("an unavailable default firearm requires an explicitly chosen and recorded practice substitute", () => {
  const ui = boot(baseState(), mission(), rewards(), { storage: {}, engine: {
    data: { ...E.data, firearms: Object.fromEntries(Object.entries(E.data.firearms).filter(([id]) => id !== "evelyn")) },
  } });
  ui.el("weapon").value = "ludwigs-holy-blade"; ui.el("weapon").fire("change");
  assert.match(ui.el("defaultGunNotice").textContent, /에블린.*자료 확인/);
  assert.equal(ui.el("gun").value, "");
  ui.el("start").value = "center"; ui.el("start").fire("change");
  assert.equal(ui.el("confirmSetup").disabled, true);
  ui.el("gun").value = "hunter-pistol"; ui.el("gun").fire("change");
  assert.equal(ui.el("confirmSetup").disabled, true);
  ui.el("firearmOverride").checked = true; ui.el("firearmOverride").fire("change");
  assert.equal(ui.el("confirmSetup").disabled, false);
  ui.el("confirmSetup").click();
  const args = ui.creates.at(-1);
  assert.equal(args[1], "ludwigs-holy-blade");
  assert.equal(args[4], "hunter-pistol");
  assert.equal(args[6].firearmOverride, true);
});
test("weapon panels render only their current slots and offer only legal persistent-reward slots", () => {
  const s = baseState(), h = E.hunter(s); h.weaponId = "stake-driver"; h.face = 1; s.phase = "between_chapters";
  const ui = boot(s, mission(), rewards([{ id: "shard", kind: "bloodstone-shard", name: "혈석", rules: "강화", equipped: false, ready: true, persistent: true, subtype: "tool" }]));
  assert.equal(ui.el("weaponName").textContent, "말뚝박이");
  assert.match(ui.el("weaponAbility").textContent, /모든 적을 최대 2칸/);
  assert.equal(ui.el("slots").querySelectorAll("[data-slot]").length, 1);
  assert.equal(ui.el("slots").style.gridTemplateColumns, "repeat(1, minmax(0, 1fr))");
  assert.equal(ui.buttons("rewards").filter((button) => button.dataset.command === "EQUIP_REWARD").length, 1);
  assert.equal(JSON.parse(ui.buttons("rewards")[0].dataset.args).slot, 0);
});
test("a two-slot weapon keeps its own effect and resets an out-of-range selection after transformation", () => {
  const s = baseState(), h = E.hunter(s); h.weaponId = "kirkhammer"; h.face = 0;
  const ui = boot(s, mission(), rewards(), { engine: { dispatch: (state, command) => {
    const next = structuredClone(state); E.hunter(next).face = 1; return next;
  } } });
  ui.el("slots").querySelectorAll("[data-slot]")[2].click();
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  option(ui, "decisions", "TRANSFORM").click();
  assert.equal(ui.el("slots").querySelectorAll("[data-slot]").length, 2);
  assert.match(ui.el("weaponAbility").textContent, /방해받을 수 없지만/);
  assert(ui.el("slots").querySelectorAll("[data-slot]").every(slot => slot.attributes["aria-pressed"] === "false"));
});
test("the new practice target menu distinguishes general variants from hunter-count NPC faces", () => {
  const ui = boot(baseState(), null, rewards(), { storage: {} });
  ui.el("playMode").value = "practice"; ui.el("playMode").fire("change");
  assert.equal(ui.el("practiceSetup").hidden, false);
  assert.match(ui.el("practiceTarget").innerHTML, /church-servant/);
  assert.match(ui.el("practiceTarget").innerHTML, /henryk/);
  ui.el("practiceTarget").value = "church-servant"; ui.el("practiceTarget").fire("change");
  assert.equal(ui.el("practiceSideLabel").hidden, false);
  ui.el("practiceSide").value = "b";
  ui.el("start").value = "center"; ui.el("start").fire("change");
  ui.el("confirmSetup").click();
  assert.equal(ui.creates.at(-1)[6].practiceTarget, "church-servant");
  assert.equal(ui.creates.at(-1)[6].practiceSide, "b");
  ui.el("practiceTarget").value = "henryk"; ui.el("practiceTarget").fire("change");
  assert.equal(ui.el("practiceSideLabel").hidden, true);
  assert.equal(ui.el("practiceSide").value, "a");
  assert.match(ui.el("practiceTargetNotice").textContent, /혼자 사냥할 때의 능력/);
});
test("weapon effect decisions pass the engine-provided command without inventing a target", () => {
  const s = baseState(); s.phase = "weapon_choice";
  const ui = boot(s, mission(), rewards(), { engine: { weaponChoices: () => [
    { label: "선택한 적에게 피해", command: { type: "WEAPON_CHOICE", enemyId: "specific-enemy" } },
    { label: "사용하지 않음", command: { type: "WEAPON_CHOICE", accept: false } },
  ] } });
  assert.match(ui.el("phaseTitle").textContent, /무기 효과 선택/);
  option(ui, "decisions", "WEAPON_CHOICE").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "WEAPON_CHOICE", enemyId: "specific-enemy" });
});
test("the chosen optional wheel sacrifice reaches the attack command and leaves the default at zero", () => {
  const s = baseState(), h = E.hunter(s); h.weaponId = "logarius-wheel"; h.face = 1;
  s.setup.rulesVersion = 10;
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 3, node: h.position }];
  const ui = boot(s, mission(), rewards());
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.el("slots").querySelectorAll("[data-slot]")[0].click();
  assert.equal(JSON.parse(option(ui, "decisions", "ATTACK").dataset.args).weaponBoost, 0);
  ui.el("weaponBoost").value = "2"; ui.el("weaponBoost").fire("change");
  option(ui, "decisions", "ATTACK").click();
  assert.equal(ui.commands[0].weaponBoost, 2);
});
test("a cannon counterattack uses its own name and damage without a flamesprayer label", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  s.phase = "combat_choose"; s.combat = { enemyId: "huntsman-mob-1", origin: "enemy" };
  const firearm = require("../src/extended-firearms").firearm("cannon");
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => firearm, canFirearm: () => true } });
  assert.match(ui.el("decisions").innerHTML, /대포로 맞서 공격/);
  assert(!ui.el("decisions").innerHTML.includes("화염방사기로"));
  option(ui, "decisions", "FIREARM").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "FIREARM", enemyId: "huntsman-mob-1" });
  s.phase = "combat_react"; s.combat.flame = { speed: 1, damage: 3, interrupt: false, splash: 0 };
  const combat = boot(s, mission(), rewards(), { engine: { firearm: () => firearm, canFirearm: () => false } });
  assert.match(combat.el("combatInfo").innerHTML, /대포 공격 · 속도 1 \/ 피해 3/);
  assert(!combat.el("combatInfo").innerHTML.includes("화염방사기"));
});
test("optional weapon sacrifices reach standalone firearm attacks and firearm counterattacks", () => {
  for (const [weapon, face, gun, phase, boost] of [
    ["logarius-wheel", 1, "cannon", "hunter", 2],
    ["chikage", 0, "flamesprayer", "combat_choose", "speed"],
  ]) {
    const s = baseState(), h = E.hunter(s); h.weaponId = weapon; h.face = face;
    s.setup.rulesVersion = 10; s.phase = phase;
    s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
    if (phase === "combat_choose") s.combat = { enemyId: "huntsman-mob-1", origin: "activation" };
    const ui = boot(s, mission(), rewards(), { engine: {
      firearm: () => require("../src/extended-firearms").firearm(gun), canFirearm: () => true,
    } });
    ui.el("weaponBoost").value = String(boost); ui.el("weaponBoost").fire("change");
    option(ui, phase === "hunter" ? "firearm" : "decisions", "FIREARM").click();
    assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), {
      type: "FIREARM", enemyId: "huntsman-mob-1", weaponBoost: boost,
    });
  }
});
test("arcane barrage describes defense per dodge speed instead of a zero-speed threshold", () => {
  const s = baseState(); s.phase = "boss_react";
  s.combat = { immediate: { name: "비전 탄막", damage: 6, dodgeSpeed: 0, dodgeBlockPerSpeed: 2 } };
  const ui = boot(s, mission(), rewards(), { engine: { canDodge: () => true } });
  assert.match(ui.el("phaseHelp").textContent, /회피 속도마다 2피해를 방어/);
  assert.match(ui.el("phaseHelp").textContent, /‘이 효과 회피’를 눌러 확정/);
  assert(!ui.el("phaseHelp").textContent.includes("속도 0 이상"));
});
test("face-down weapon slots hide the printed stat card face and describe the dormant effects", () => {
  const s = baseState(), h = E.hunter(s), placed = h.hand.shift();
  h.slots[0] = { ...placed, faceDown: true };
  const ui = boot(s, mission(), rewards());
  const slot = ui.el("slots").querySelectorAll("[data-slot]").find((e) => e.dataset.slot === "0");
  assert.match(slot.attributes.title || ui.el("slots").innerHTML, /효과 없이 사용한 기술/);
  assert.match(ui.el("slots").innerHTML, /스탯 효과 미적용/);
  assert(!ui.el("slots").innerHTML.includes(E.card(placed).name));
});
test("Evelyn can prepare with one echo without choosing a hand card", () => {
  const s = baseState(), h = E.hunter(s); h.echoes = 1; h.firearmReady = false;
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => require("../src/extended-firearms").firearm("evelyn"), canFirearm: () => false } });
  const echo = ui.buttons("firearm").find((button) => button.dataset.command === "RELOAD" && JSON.parse(button.dataset.args).payEcho);
  assert.equal(echo.disabled, false);
  echo.click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "RELOAD", payEcho: true, cardIds: [] });
  assert.match(ui.el("firearm").innerHTML, /피의 유지 1개/);
});
test("the blunderbuss effect selects a colocated non-boss enemy during the hunter turn", () => {
  const s = baseState(), h = E.hunter(s);
  s.enemies = [{ id: "huntsman-mob-1", kind: "huntsman-mob", figure: 1, hp: 4, node: h.position }];
  const firearm = require("../src/extended-firearms").firearm("hunter-blunderbuss");
  const ui = boot(s, mission(), rewards(), { engine: { firearm: () => firearm, canFirearm: () => true } });
  option(ui, "firearm", "FIREARM").click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "FIREARM", enemyId: "huntsman-mob-1" });
  const boss = boot(s, mission(), rewards(), { engine: { firearm: () => firearm, canFirearm: () => true,
    enemyDef: (state, enemy) => ({ ...E.enemyDef(state, enemy), boss: true }) } });
  assert.equal(option(boss, "firearm", "FIREARM").disabled, true);
  s.phase = "combat_react"; s.combat = { enemyId: "huntsman-mob-1" };
  const combat = boot(s, mission(), rewards(), { engine: { firearm: () => firearm, canFirearm: () => true } });
  assert.equal(option(combat, "firearm", "FIREARM"), undefined);
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
test("reading the introduction and readable public records changes no game save or commands", () => {
  const s = baseState(), initial = JSON.stringify(s), ui = boot(s, mission(1, { revealed: [1, 5, 6] })),
    saved = ui.storage.get("bloodborne-hunt-v07");
  storyButton(ui, "storyIntro", "intro").click();
  assert.equal(ui.el("storyDialog").open, true);
  assert.match(ui.el("storyText").innerHTML, new RegExp(C.preface[0].narrative.slice(0, 15)));
  assert.equal(ui.el("previousStory").disabled, true);
  ui.el("nextStory").click();
  assert.match(ui.el("storyMeta").textContent, /챕터 1.*사냥 임무/);
  assert.equal(ui.el("storyTitle").textContent, C.cards.find(card => card.number === 1).title);
  assert.match(ui.el("storyDescription").textContent, /밝혀진 이야기/);
  assert(ui.el("storyText").textContent.includes(N.cards[1].paragraphs[0]));
  assert(!ui.el("storyText").textContent.includes(N.cards[2].paragraphs[0]));
  assert.equal(ui.el("storyText").hidden, false);
  assert.equal(ui.el("storyPhoto"), null);
  assert.equal(ui.el("storyOriginal"), null);
  ui.el("storyZoom").value = "150"; ui.el("storyZoom").fire("input");
  assert.equal(ui.el("storyText").style.fontSize, "1.5em");
  assert.equal(ui.el("storyRules").style.fontSize, "1.5em");
  assert.equal(ui.el("storyZoomValue").textContent, "150%");
  ui.el("nextStory").click(); ui.el("nextStory").click();
  assert.equal(ui.el("storyTitle").textContent, C.cards.find(card => card.number === 6).title);
  assert(!ui.el("storyMeta").textContent.includes("카드"));
  assert.equal(ui.el("nextStory").disabled, true);
  ui.el("closeStory").click();
  assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.el("storyText").innerHTML, "");
  assert.equal(ui.el("storyRules").innerHTML, "");
  assert.deepEqual(ui.commands, []);
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), saved);
  assert.equal(JSON.stringify(s), initial);
});
test("an altered story button cannot open an unrevealed source card", () => {
  const ui = boot(baseState(), mission());
  const button = storyButton(ui, "storyList", "1:1");
  button.dataset.storyKey = "1:60"; button.click();
  assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.el("storyText").innerHTML, "");
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
  assert.match(ui.el("storyMeta").textContent, /챕터 1.*보상/);
  assert.equal(ui.el("storyTitle").textContent, C.cards.find(card => card.number === 4).title);
  assert(ui.el("storyText").textContent.includes(N.cards[4].paragraphs[0]));
  ui.el("nextStory").click();
  assert.match(ui.el("storyMeta").textContent, /챕터 2/);
  assert.equal(ui.el("storyTitle").textContent, C.cards.find(card => card.number === 17).title);
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
  assert.match(ui.el("storyNotice").innerHTML, /아직 읽지 않은 이야기 2개/);
  assert.match(ui.el("storyNotice").innerHTML, /지금 밝혀진 이야기/);
  assert(!ui.el("storyNotice").innerHTML.includes("카드"));
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
test("the campaign introduction preserves its story without providing an unrevealed source archive", () => {
  const document = new Document(fs.readFileSync(path.join(root, "pages/campaign.html"), "utf8"));
  const context = vm.createContext({ window: { BBLongHunt: C, BBTileGeometry: G }, document, console });
  vm.runInContext(fs.readFileSync(path.join(root, "src/campaign.js"), "utf8"), context);
  assert.equal(document.getElementById("archive"), null);
  assert.equal(document.getElementById("openArchive"), null);
  assert.equal(document.getElementById("cardDetail"), null);
  const texts = (element) => [element.textContent, ...element.children.flatMap(texts)];
  assert(texts(document.getElementById("campaignIntro")).includes(C.preface[0].narrative));
  assert(!texts(document.getElementById("campaignIntro")).includes(C.cards[59].title));
});

function suppliedGun(id, overrides = {}) {
  return { id, name: id === "flamesprayer" ? "화염방사기" : id === "ludwig-rifle" ? "루드비히 장총" : "교단 연발총",
    actual: true, temporary: false, prepareCost: id === "repeating-pistol" ? 1 : 2,
    trigger: id === "flamesprayer" ? "hunter-turn" : id === "ludwig-rifle" ? "enemy-enters" : "enemy-basic",
    prepareOnTransform: id === "repeating-pistol", ...overrides };
}
test("actual firearms display their own triggers and preparation costs instead of the legacy replacement", () => {
  for (const id of ["ludwig-rifle", "repeating-pistol", "flamesprayer"]) {
    const state = baseState(); E.hunter(state).firearmReady = false;
    const ui = boot(state, mission(), rewards(), { engine: { firearm: () => suppliedGun(id), canFirearm: () => false } });
    assert.match(ui.el("firearm").innerHTML, /장착 화기/);
    assert(!ui.el("firearm").innerHTML.includes("제공된 실물 카드"));
    assert(!ui.el("firearm").innerHTML.includes("임시 동작"));
    assert.match(ui.el("firearm").innerHTML, new RegExp(`플레이어의 차례에 손패 ${id === "repeating-pistol" ? 1 : 2}장을 버려 준비`));
    if (id === "ludwig-rifle") assert.match(ui.el("firearm").innerHTML, /이동해 들어올 때/);
    if (id === "repeating-pistol") assert.match(ui.el("firearm").innerHTML, /변형할 때도 준비/);
    if (id === "flamesprayer") assert.match(ui.el("firearm").innerHTML, /속도 2 · 피해 2 · 방해/);
  }
  const legacyState = baseState(); E.hunter(legacyState).firearmId = "ludwig-rifle"; E.hunter(legacyState).firearmReady = false;
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
  assert.equal(option(ui, "firearm", "RELOAD").disabled, true);
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  assert.equal(option(ui, "firearm", "RELOAD").disabled, true);
  assert(!ui.el("firearmReloadSecond").innerHTML.includes(`value="${h.hand[0].id}"`));
  ui.el("firearmReloadSecond").value = h.hand[1].id; ui.el("firearmReloadSecond").fire("change");
  const reload = option(ui, "firearm", "RELOAD"); assert.equal(reload.disabled, false); reload.click();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.commands[0])), { type: "RELOAD", cardIds: [h.hand[0].id, h.hand[1].id] });
});
test("the repeating pistol prepares with one chosen card while an older save keeps cardId", () => {
  for (const actual of [true, false]) {
    const s = baseState(); E.hunter(s).firearmReady = false;
    const ui = boot(s, mission(), rewards(), { engine: {
      firearm: () => suppliedGun("repeating-pistol", { actual, temporary: !actual }), canFirearm: () => false,
    } });
    ui.el("hand").querySelectorAll("[data-card]")[0].click(); option(ui, "firearm", "RELOAD").click();
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
  s.combat = { immediate: { name: "뛰어 내려찍기", dodgeSpeed: 1, damage: 2, effects: ["기절"] } };
  const ui = boot(s, mission(), rewards(), { engine: {
    combatReaction: () => ({ title: "뛰어 내려찍기", dodgeSpeed: 1, damage: 2, effects: ["기절"] }),
    canDodge: (_state, cardId) => !!cardId,
  } });
  assert.equal(ui.el("phaseTitle").textContent, "뛰어 내려찍기");
  assert.match(ui.el("phaseHelp").textContent, /속도 1.*기절/);
  assert.equal(option(ui, "decisions", "DODGE").disabled, true);
  ui.el("hand").querySelectorAll("[data-card]")[0].click();
  ui.el("slots").querySelectorAll("[data-slot]")[0].click();
  option(ui, "decisions", "DODGE").click();
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
test("actual special components hide unrevealed boss actions while retaining insight and printed NPC rules", () => {
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
  assert.match(html, /계몽 토큰 2개/);
  assert.match(html, /<p class="eyebrow">보스 · 1페이즈<\/p>/);
  assert.match(html, /<p class="eyebrow">특수 적<\/p>/);
  assert.match(html, /체력 10 \/ 10/);
  assert.match(html, /보스에게 계몽 토큰 \+1/);
  assert.doesNotMatch(html, /실제 구성품|임시 구성품|시트의|보스 시트에|2페이즈/,
    "public actor labels do not expose implementation terms or a future phase");
  assert.doesNotMatch(html, /현재 페이즈의 행동 카드|내려찍기/);
  assert(!html.includes("참고자료/제공 구성품.jpg"));
  assert(!html.includes("실물 원문"));
  assert.doesNotMatch(html, /<img\b|href=/);
  assert(!html.includes("[object Object]"));
  option(ui, "componentCards", "BOSS_INSIGHT").click(); assert.equal(ui.commands[0].type, "BOSS_INSIGHT");
  s.combat = { enemyId: boss.id, action: defs[boss.id].slam };
  const revealed = boot(s, mission(), rewards(), { engine: { canBossInsight: () => true,
    enemyDef: (state, enemy) => typeof enemy === "object" && defs[enemy.id] ? defs[enemy.id] : E.enemyDef(state, enemy),
  } });
  assert.match(revealed.el("componentCards").innerHTML, /내려찍기/);
  assert.doesNotMatch(revealed.el("componentCards").innerHTML, /참고자료\/|<img\b|href=/);
});
