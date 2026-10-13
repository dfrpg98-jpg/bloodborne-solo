"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const E = require("../hunt-engine"), M = require("../chapter-engine"), ED = require("../enemy-deck"), G = require("../tile-geometry");
const C = require("../campaigns/long-hunt/data.json"), cards = require("../components/cards.json");
const { boot, Document } = require("./helpers/ui-harness.cjs");
const root = path.join(__dirname, "..");
const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1";
const realEngine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave,
  dispatch: E.dispatch, missionView: E.missionView, rewardsView: E.rewardsView,
  missionActions: E.missionActions, interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView,
  applyChapelRuling: E.applyChapelRuling };
function renderedElements(document) {
  const all = new Set();
  function visit(element) { if (!element || all.has(element)) return; all.add(element); for (const child of element.children || []) visit(child); }
  for (const element of document.ids.values()) visit(element);
  return [...all];
}
function noSourcePhotos(document, label = "rendered UI") {
  for (const element of renderedElements(document)) for (const attribute of ["src", "href"]) {
    const value = element[attribute] || element.attributes[attribute] || "";
    assert.doesNotMatch(value, /(?:campaigns\/long-hunt\/images|components\/images|참고자료|\.(?:jpe?g|png)(?:[?#]|$))/i,
      `${label}: ${element.tagName} ${attribute}=${value}`);
  }
}
function realBoot(state, options = {}) {
  const key = state.setup.qa ? qaKey : normalKey;
  return boot(state, E.missionView(state), E.rewardsView(state), { realInventory: true,
    storage: { [key]: E.exportSave(state), "bloodborne-hunt-active-mode": state.setup.qa ? "qa" : "normal" },
    engine: realEngine, ...options });
}
function storyButton(ui, container, key) {
  return ui.el(container)?.querySelectorAll("[data-story-key]").find(button => button.dataset.storyKey === key);
}
function treeText(element) {
  if (!element) return "";
  return element.textContent + (element.children || []).map(treeText).join(" ");
}
function secondary(html, script, window) {
  const document = new Document(fs.readFileSync(path.join(root, html), "utf8")), storage = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(root, script), "utf8"), { window, document,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    Blob, URL, setTimeout() {}, console });
  return { document, storage, el: id => document.getElementById(id) };
}

test("normal hunt setup and revealed story use text while the independently drawn map remains visible", () => {
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }), ui = realBoot(state);
  noSourcePhotos(ui.document);
  assert.match(ui.el("chapterMap").innerHTML, /assets\/tiles\/tile-14\.svg/);
  const before = ui.storage.get(normalKey);
  storyButton(ui, "storyIntro", "intro").click();
  assert.equal(ui.el("storyDialog").open, true);
  assert.match(ui.el("storyText").textContent, /재앙의 야수/);
  assert.equal(ui.el("storyText").hidden, false);
  noSourcePhotos(ui.document, "intro");
  ui.el("closeStory").click();
  storyButton(ui, "storyList", "1:1").click();
  assert.equal(ui.el("storyDialog").open, true);
  assert(ui.el("storyText").textContent.trim(), "revealed card has readable story content");
  assert.equal(ui.el("storyText").hidden, false);
  noSourcePhotos(ui.document, "card 1");
  assert.equal(ui.storage.get(normalKey), before, "reading story never alters the exact gameplay replay");
  ui.el("new").click(); noSourcePhotos(ui.document, "normal setup");
});

test("QA starting rewards and consumables render without their supplied source photographs", () => {
  const state = E.create(90, "qa-test-weapon", 0, null, "hunter-pistol", "center", { campaign: true, qa: { preset: "fast" } }),
    ui = realBoot(state);
  assert.equal(ui.el("qaModeBadge").hidden, false);
  assert.match(ui.el("inventory").innerHTML, /검증용 회복약/);
  assert.match(ui.el("rewards").innerHTML, /고대 사냥꾼의 유골/);
  noSourcePhotos(ui.document, "QA inventory");
  ui.el("new").click(); noSourcePhotos(ui.document, "QA setup");
});

test("a changed story key cannot expose an unrevealed story or any future outcome", () => {
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }), ui = realBoot(state),
    button = storyButton(ui, "storyList", "1:1");
  assert(button);
  assert.equal(storyButton(ui, "storyList", "1:60"), undefined);
  assert(!ui.el("storyList").innerHTML.includes(C.cards[59].title));
  button.dataset.storyKey = "1:60"; button.click();
  assert.equal(ui.el("storyDialog").open, false);
  assert.equal(ui.el("storyText").innerHTML, "");
  noSourcePhotos(ui.document, "unrevealed attempt");
});

test("normal public play across all three chapters keeps revealed history readable and all photo URLs absent", () => {
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true }), snapshots = 0;
  const chapters = new Set(), kinds = new Set(), phases = new Set();
  let previousKey = "";
  for (const command of [{ type: "initial" }, ...commands]) {
    if (command.type !== "initial") state = E.dispatch(state, command);
    const key = JSON.stringify([state.mission.chapter, E.missionView(state).revealed, state.enemies.filter(e => e.componentId).map(e => e.componentId)]),
      newPhase = !phases.has(state.phase);
    phases.add(state.phase);
    if (key === previousKey && !newPhase && !state.result) continue;
    previousKey = key;
    const ui = realBoot(state), view = E.missionView(state);
    noSourcePhotos(ui.document, `chapter ${view.chapter} ${state.phase}`); snapshots++;
    chapters.add(view.chapter); for (const enemy of state.enemies) if (enemy.componentId) kinds.add(enemy.componentId);
    const listed = ui.el("storyList").querySelectorAll("[data-story-key]");
    for (const button of listed) {
      assert(view.revealed.includes(Number(button.dataset.storyKey.split(":")[1])), "only actually revealed current stories are listed");
      button.click(); assert.equal(ui.el("storyDialog").open, true);
      assert((ui.el("storyText").textContent + ui.el("storyRules").textContent).trim(), `${button.dataset.storyKey} is readable`);
      noSourcePhotos(ui.document, button.dataset.storyKey);
      ui.el("closeStory").click();
    }
    for (const button of ui.el("pastChapters").querySelectorAll("[data-story-key]")) {
      const [chapter, number] = button.dataset.storyKey.split(":").map(Number), history = view.history.find(item => item.chapter === chapter);
      assert(history?.revealed.includes(number), "past story access comes from its actual reveal history");
      button.click(); assert.equal(ui.el("storyDialog").open, true); noSourcePhotos(ui.document, "past story"); ui.el("closeStory").click();
    }
    assert.equal(ui.el("error").textContent, "");
  }
  assert.equal(state.result, "campaign-win");
  assert.deepEqual([...chapters], [1, 2, 3]); assert(snapshots >= 10);
  assert(kinds.has("cleric-beast"), "the actual boss encounter is included");
});

test("an existing legacy save still loads its actual inventory and public UI without source photo links", () => {
  const saved = fs.readFileSync(path.join(__dirname, "fixtures/v061-owned-bone-ash-save.json"), "utf8"), state = E.importSave(saved),
    ui = realBoot(state, { storage: { [normalKey]: saved } });
  assert.equal(ui.el("error").textContent, "");
  assert.match(ui.el("inventory").innerHTML, /bone-ash/);
  const loaded = E.importSave(ui.storage.get(normalKey));
  assert.deepEqual(loaded.hunters, state.hunters, "existing owned inventory and hunter state are preserved");
  assert.deepEqual(loaded.world, state.world, "existing explored map is preserved");
  assert.equal(loaded.phase, state.phase);
  assert.equal(loaded.chapelRuling, "escort-first", "the existing supported chapel migration still runs");
  noSourcePhotos(ui.document, "legacy save");
});

test("the former full campaign archive now shows only the introduction and playable entry point", () => {
  const ui = secondary("campaign.html", "campaign.js", { BBLongHunt: C });
  assert.match(treeText(ui.el("campaignIntro")), /재앙의 야수/);
  assert.equal(ui.el("cardList"), null); assert.equal(ui.el("openArchive"), null);
  noSourcePhotos(ui.document, "campaign introduction");
  const html = fs.readFileSync(path.join(root, "campaign.html"), "utf8");
  assert.match(html, /href="hunt\.html"/);
  assert.doesNotMatch(html, /data\.json|download|card-\d+\.jpg|원본 자료|이후 카드|후속 카드/);
});

test("the public component catalogue retains basic effects without revealing future quest rewards or source metadata", () => {
  const ui = secondary("components.html", "components.js", { BBComponents: cards }), list = ui.el("cards");
  assert(list.children.some(article => article.dataset.id === "strength"));
  assert(list.children.some(article => article.dataset.id === "antidote"));
  assert.equal(list.children.some(article => cards.cards.find(card => card.id === article.dataset.id)?.group === "reward"), false);
  noSourcePhotos(ui.document, "component catalogue");
  assert.doesNotMatch(treeText(list), /20261011_|\.jpg|입력 원문|사용자 확인|사진 출처/);
  ui.el("query").value = "music-box"; ui.el("query").fire("input");
  assert.equal(ui.el("resultCount").textContent, "0종");
  ui.el("query").value = ""; ui.el("query").fire("input");
  ui.el("group").value = "reward"; ui.el("group").fire("change");
  assert.equal(ui.el("resultCount").textContent, "0종", "altered public filter cannot recover hidden rewards");
});

test("legacy map exploration keeps enemy attack rules and code-drawn tiles while removing original enemy pictures", () => {
  const ui = secondary("chapter.html", "chapter-app.js", { BBChapter: M, BBEnemyDeck: ED, BBTileGeometry: G,
    BBStartPlacement: { mount: () => ({ update() {} }) } });
  assert.match(ui.el("chapterEnemies").innerHTML, /기본 공격/);
  assert.match(ui.el("chapterEnemies").innerHTML, /전용 능력/);
  assert.match(ui.el("chapterMap").innerHTML, /assets\/tiles\/tile-14\.svg/);
  noSourcePhotos(ui.document, "chapter map");
  ui.el("drawBehavior").click();
  assert.equal(ui.el("chapterError").textContent, "");
  assert(ui.el("behaviorResult").innerHTML.trim()); noSourcePhotos(ui.document, "enemy behavior");
});
