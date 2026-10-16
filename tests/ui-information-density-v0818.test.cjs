"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Entry = require("../src/hunt-entry"), Help = require("../src/game-help");
const { boot, Document } = require("./helpers/ui-harness.cjs");
const normalKey = "bloodborne-hunt-v07";
function launchNew() {
  const initial = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }), calls = [];
  const location = { href: "http://offline.test/hunt.html?entry=new", search: "?entry=new" };
  const ui = boot(initial, E.missionView(initial), E.rewardsView(initial), { storage: {}, realInventory: true,
    engine: { ...E, create(...args) { calls.push(args); return E.create(...args); } },
    window: { BBHuntEntry: Entry, BBGameHelp: Help, location, history: { replaceState() {} } } });
  return { ui, calls };
}
function change(ui, id, value) { const input = ui.el(id); input.value = String(value); input.fire("change"); }

test("the compact first lesson retains actionable move, explore, attack and committed dodge instructions", () => {
  const html = Help.renderHTML(), document = new Document(html), brief = html.match(/<section class="game-help-first">([\s\S]*?)<\/section>/)?.[1];
  assert(brief, "the normal first lesson remains visible before optional reference sections");
  assert.equal((brief.match(/<li>/g) || []).length, 3);
  for (const instruction of ["손패 1장", "이동 시작 · 손패 1장", "최대 2칸", "이동 마치기", "현재 칸의 출입구", "이 출입구로 탐험", "이 방향으로 배치하고 진입", "같은 칸의 적", "빈 슬롯", "이 적 공격", "‘회피’를 눌러 확정", "전투 처리"])
    assert(brief.includes(instruction), `a beginner can still follow ${instruction}`);
  assert(!brief.includes("검증"));
  for (const detail of document.querySelectorAll("details")) assert.equal(detail.hasAttribute("open"), false);
  for (const instruction of ["선택만으로는 회피하지 않습니다", "적 행동 공개 뒤에 일반 맞서 공격 카드를 새로 고르지는 않습니다", "망가진 등불에는 귀환할 수 없습니다", "취소하면 이동과 비용 지불을 하지 않습니다", "메뉴’ → ‘불러오기", "검증용 장치무기"])
    assert(html.includes(instruction), `folding the reference must preserve ${instruction}`);
});

for (const advancedSeed of [false, true]) test(`${advancedSeed ? "an explicitly chosen" : "the automatically prepared"} seed still starts a normal hunt through the existing controls`, () => {
  const { ui, calls } = launchNew(), advanced = ui.el("setupAdvanced");
  assert.equal(ui.el("setupDialog").open, true); assert.equal(advanced.hasAttribute("open"), false);
  assert.equal(ui.el("confirmSetup").disabled, true, "the required visible starting-space choice is not bypassed");
  if (advancedSeed) { advanced.open = true; change(ui, "seed", 153); }
  const seed = Number(ui.el("seed").value);
  for (const [id, value] of [["playMode", "campaign"], ["weapon", "burial"], ["face", 0], ["gun", "hunter-pistol"], ["start", "left"]]) change(ui, id, value);
  assert.equal(ui.el("confirmSetup").disabled, false); ui.el("confirmSetup").click();
  assert.equal(ui.el("setupDialog").open, false); assert.equal(ui.el("setupError").textContent, "");
  assert.equal(calls.at(-1)[0], seed); assert.equal(calls.at(-1)[5], "left");
  const state = E.importSave(ui.storage.get(normalKey)), expected = E.create(seed, "burial", 0, null, "hunter-pistol", "left", { campaign: true });
  assert.equal(state.initialSeed, seed); assert.equal(E.hunter(state).position, E.hunter(expected).position);
  assert.equal(state.phase, "hunter"); assert.equal(E.hunter(state).hand.length, 3);
  const help = ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "guide");
  const before = ui.storage.get(normalKey); help.click(); assert.equal(ui.el("infoDialog").open, true);
  assert.equal(ui.el("gameHelpContent").innerHTML, Help.renderHTML()); ui.el("closeInfo").click();
  assert.equal(ui.storage.get(normalKey), before, "reading either the brief or complete reference never costs an action or rewrites the save");
});
