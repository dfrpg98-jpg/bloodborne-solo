"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const E = require("../src/hunt-engine"), B = require("../src/boss-components"), ED = require("../src/enemy-deck"), history = require("../src/enemy-action-history");
const C = require("../campaigns/long-hunt/data.json"), { boot } = require("./helpers/ui-harness.cjs");
const normalKey = "bloodborne-hunt-v07", qaKey = "bloodborne-hunt-qa-v1";
const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  interactionEnemies: E.interactionEnemies, provisionalView: E.provisionalView, applyChapelRuling: state => state };
const checkpoints = new Map();
let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
checkpoints.set(0, state);
for (let i = 0; i < 218; i++) {
  state = E.dispatch(state, commands[i]);
  if ([35, 211, 218].includes(i + 1)) checkpoints.set(i + 1, state);
}
function launch(state) {
  const key = state.setup.qa ? qaKey : normalKey, saved = E.exportSave(state);
  const ui = boot(state, E.missionView(state), E.rewardsView(state), { engine, realInventory: true,
    storage: { [key]: saved, "bloodborne-hunt-active-mode": state.setup.qa ? "qa" : "normal" } });
  return { state, ui, key, saved };
}
function unchanged(f) {
  assert.equal(f.ui.storage.get(f.key), f.saved, "reading and choosing UI options preserve exact replay bytes");
  assert.equal(f.ui.el("error").textContent, "");
}
function clean(f, text) { return f.ui.window.BBHuntPublicText.clean(text, "skill"); }
function detail(f, id, special = false) {
  const selector = special ? "[data-special-info]" : "[data-enemy-info]", field = special ? "specialInfo" : "enemyInfo";
  const opener = f.ui.el("enemyRoster").querySelectorAll(selector).find(button => button.dataset[field] === id);
  assert(opener, `the visible roster contains ${id}`); opener.focus(); opener.click();
  assert.equal(f.ui.el("enemyDetailDialog").open, true);
  assert.equal(f.ui.el("infoDialog").open, false, "a roster click opens the independent detail dialog");
  assert.equal(f.ui.document.activeElement, f.ui.el("closeEnemyDetail"));
  return opener;
}
function closeDetail(f, opener, escape = false) {
  if (escape) assert.equal(f.ui.el("enemyDetailDialog").fire("cancel").defaultPrevented, true);
  else f.ui.el("closeEnemyDetail").click();
  assert.equal(f.ui.el("enemyDetailDialog").open, false);
  assert.equal(f.ui.document.activeElement, opener); unchanged(f);
}
function hiddenSources(text) {
  assert.doesNotMatch(text, /bossDecks|enemyDeck|campaigns\/long-hunt\/images|components\/images|\.jpe?g(?:["?#]|$)|[A-Z]:\\Users\\/i);
}
function futureMissions(f, text) {
  for (const number of [58, 59, 60]) if (!f.state.mission.revealed.includes(number))
    assert(!text.includes(C.cards.find(card => card.number === number).title), `future mission ${number} stays hidden`);
}

test("only the discard control opens the independent history dialog; the last reveal is a static span", () => {
  const f = launch(checkpoints.get(218)), triggers = f.ui.document.querySelectorAll("[data-enemy-history]");
  assert.equal(triggers.length, 1); assert.equal(triggers[0].tagName.toLowerCase(), "button");
  assert.equal(triggers[0].getAttribute("aria-controls"), "enemyHistoryDialog");
  assert.equal(f.ui.document.querySelectorAll("[data-panel]").filter(button => button.dataset.panel === "actions").length, 0);
  assert.equal(f.ui.document.querySelectorAll("[data-info-panel]").filter(panel => panel.dataset.infoPanel === "actions").length, 0);
  const last = f.ui.el("deckStatus").querySelectorAll(".last-enemy-action"); assert.equal(last.length, 1);
  assert.equal(last[0].tagName.toLowerCase(), "span");
  for (const attribute of ["data-enemy-history", "data-panel", "tabindex", "role"]) assert.equal(last[0].hasAttribute(attribute), false);
  assert.equal(last[0].onclick, undefined); last[0].click();
  assert.equal(f.ui.el("enemyHistoryDialog").open, false); unchanged(f);
  triggers[0].focus(); triggers[0].click();
  assert.equal(f.ui.el("enemyHistoryDialog").open, true); assert.equal(f.ui.el("infoDialog").open, false);
  assert.equal(f.ui.document.activeElement, f.ui.el("closeEnemyHistory")); unchanged(f);
  f.ui.el("closeEnemyHistory").click(); assert.equal(f.ui.el("enemyHistoryDialog").open, false);
  assert.equal(f.ui.document.activeElement, triggers[0]); unchanged(f);
  triggers[0].click(); const event = f.ui.el("enemyHistoryDialog").fire("cancel");
  assert.equal(event.defaultPrevented, true); assert.equal(f.ui.el("enemyHistoryDialog").open, false);
  assert.equal(f.ui.document.activeElement, triggers[0]); unchanged(f);
});

test("the history dialog shows exactly the current public shared discard order without boss or future actions", () => {
  const f = launch(checkpoints.get(218)), tracker = history({ E, labels: ED.labels }); tracker.reset(f.state);
  const publicHistory = tracker.view(); f.ui.el("deckStatus").querySelector("[data-enemy-history]").click();
  const html = f.ui.el("enemyActionHistory").innerHTML;
  const labels = [...html.matchAll(/<strong>([^<]*)<\/strong>/g)].map(match => match[1]);
  assert.deepEqual(labels, publicHistory.records.map(record => ED.labels[record.kind]));
  assert.equal(labels.length, f.state.enemyDiscard.length);
  const boss = f.state.enemies.find(enemy => enemy.componentId === "cleric-beast"); assert(boss);
  for (const action of Object.values(E.enemyDef(f.state, boss)).filter(value => value?.type && value.name))
    assert(!html.includes(action.name), `boss-owned action ${action.name} is outside the shared history`);
  hiddenSources(html); futureMissions(f, html); unchanged(f);
});

test("the independent history dialog starts empty before any shared enemy action has been revealed", () => {
  const f = launch(checkpoints.get(0)); assert.deepEqual(f.state.enemyDiscard, []);
  f.ui.el("deckStatus").querySelector("[data-enemy-history]").click();
  assert.equal(f.ui.el("enemyHistoryDialog").open, true);
  assert.equal(f.ui.el("enemyActionHistory").querySelectorAll("strong").length, 0);
  assert.match(f.ui.el("enemyActionHistory").textContent, /아직 공개된 적 행동이 없습니다/);
  assert.match(f.ui.el("deckStatus").textContent, /마지막 공개: 없음/); unchanged(f);
});

test("each general roster entry opens only its own public face and restores focus without changing the hunt", () => {
  const f = launch(checkpoints.get(0));
  for (const assignment of f.state.world.assignments) {
    const definition = E.enemyDef(f.state, assignment.enemyId), opener = detail(f, assignment.enemyId), text = f.ui.el("enemyDetailContent").textContent;
    assert(f.ui.el("enemyDetailTitle").textContent.includes(definition.name));
    for (const action of [definition.face.basicAttack, definition.face.specialAttack, definition.face.ability]) {
      assert(text.includes(clean(f, action.name)), `${assignment.enemyId}: its printed ${action.name} is visible`);
      for (const rule of action.rules) assert(text.includes(clean(f, rule)), "the original public effect remains visible");
    }
    for (const other of f.state.world.assignments.filter(other => other.enemyId !== assignment.enemyId))
      assert(!text.includes(E.enemyDef(f.state, other.enemyId).name), "other species are outside this detail");
    hiddenSources(text); futureMissions(f, text); unchanged(f); closeDetail(f, opener, true);
  }
});

for (const [spec, file, count] of [
  ["female-patient-a", "v074-patient-natural-commands.json", 187],
  ["iosefka-hostile", "v074-attack-iosefka-natural-commands.json", 297],
]) test(`${spec} roster detail contains its actual public abilities without another enemy or future mission`, () => {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true });
  for (const command of require("./fixtures/" + file).slice(0, count)) state = E.dispatch(state, command);
  const enemy = state.enemies.find(enemy => enemy.componentSpec === spec); assert(enemy);
  const f = launch(state), definition = E.enemyDef(state, enemy), opener = detail(f, enemy.id, true), text = f.ui.el("enemyDetailContent").textContent;
  assert(f.ui.el("enemyDetailTitle").textContent.includes(definition.name));
  for (const action of [definition.basic, definition.special, definition.ability].filter(Boolean)) {
    assert(text.includes(clean(f, action.name)));
    for (const rule of action.rules || []) assert(text.includes(clean(f, rule)));
  }
  for (const other of state.enemies.filter(other => E.enemyDef(state, other).name !== definition.name))
    assert(!text.includes(E.enemyDef(state, other).name), "another enemy's card is not copied into this detail");
  hiddenSources(text); futureMissions(f, text); unchanged(f); closeDetail(f, opener);
});

for (const count of [211, 218]) test(`actual boss detail at public checkpoint ${count} reveals only its own currently drawn action`, () => {
  const f = launch(checkpoints.get(count)), boss = f.state.enemies.find(enemy => enemy.componentId === "cleric-beast"); assert(boss);
  const definition = E.enemyDef(f.state, boss), shown = f.state.combat?.enemyId === boss.id ? f.state.combat.action?.name : null;
  const opener = detail(f, boss.id, true), text = f.ui.el("enemyDetailContent").textContent;
  assert(f.ui.el("enemyDetailTitle").textContent.includes(definition.name));
  if (shown) assert(text.includes(shown), "the currently public boss action stays readable");
  for (const action of [...Object.values(definition), ...Object.values(B.definition("cleric-beast", 2))]
    .filter(value => value?.type && value.name && value.name !== shown))
    assert(!text.includes(action.name), `undrawn boss action ${action.name} stays hidden`);
  for (const assignment of f.state.world.assignments) assert(!text.includes(E.enemyDef(f.state, assignment.enemyId).name));
  hiddenSources(text); futureMissions(f, text); unchanged(f); closeDetail(f, opener);
});

test("clicking a general enemy during a boss combat cannot copy the boss's public action into that enemy detail", () => {
  const f = launch(checkpoints.get(218)), assignment = f.state.world.assignments[0], opener = detail(f, assignment.enemyId);
  const text = f.ui.el("enemyDetailContent").textContent, shown = f.state.combat.action.name;
  assert(!text.includes(shown)); assert(!text.includes("성직자 야수")); unchanged(f); closeDetail(f, opener);
});

test("the temporary boss trial also withholds its undrawn boss-deck actions in the independent detail", () => {
  const state = E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: false, provisional: "cleric-beast" });
  const boss = state.enemies.find(enemy => enemy.provisionalKind === "cleric-beast"); assert(boss);
  const f = launch(state), opener = detail(f, boss.id, true), text = f.ui.el("enemyDetailContent").textContent;
  for (const action of Object.values(E.enemyDef(state, boss)).filter(value => value?.type && value.name)) assert(!text.includes(action.name));
  assert.match(text, /아직 공개된 행동이 없습니다/); hiddenSources(text); unchanged(f); closeDetail(f, opener);
});

const naturalBoss = new Map();
function naturalBossCheckpoint(count) {
  if (!naturalBoss.size) {
    let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 10 });
    const trace = require("./fixtures/full-campaign-actual-v10-commands.json");
    for (let index = 0; index < 264; index++) {
      state = E.dispatch(state, trace[index]);
      if ([242, 260, 264].includes(index + 1)) naturalBoss.set(index + 1, state);
    }
  }
  return naturalBoss.get(count);
}
for (const [count, id] of [[242, "dash-sweep"], [260, "leap-slam"], [264, "destructive-slam"]])
  test(`restored natural boss action ${id} retains every public rule and printed effect without exposing another action`, () => {
    const f = launch(naturalBossCheckpoint(count)), action = f.state.combat.action;
    assert.equal(action.id, id); assert.deepEqual(E.importSave(f.saved), f.state);
    const boss = f.state.enemies.find(enemy => enemy.id === f.state.combat.enemyId); assert(boss);
    const opener = detail(f, boss.id, true), text = f.ui.el("enemyDetailContent").textContent, html = f.ui.el("enemyDetailContent").innerHTML;
    const visibleNames = [...html.matchAll(/<strong>([^<]*)<\/strong>/g)].map(match => decode(match[1]));
    const publicNames = [...new Set([f.state.combat.action, f.state.combat.immediate, f.state.combat.extra].filter(Boolean).map(action => action.name))];
    assert.deepEqual(visibleNames, publicNames, "only these already-public combat objects are described");
    for (const rule of action.rules) assert(text.includes(clean(f, rule)), `${id}: the original public rule survives same-name immediate effects`);
    if (action.damage > 0) assert(text.includes(`피해 ${action.damage}`));
    if (action.dodgeSpeed) assert(text.includes(`회피 속도 ${action.dodgeSpeed}`));
    if (action.afterAttackMove) assert(text.includes(`공격 후 이 적을 ${action.afterAttackMove}칸 멀리 이동합니다.`));
    if (action.afterDodgeDamageBonus) assert(text.includes(`회피하면 사냥꾼의 공격 피해 +${action.afterDodgeDamageBonus}`));
    if (action.otherHunters) assert(text.includes(`이 칸의 다른 사냥꾼은 회피(속도 ${action.otherHunters.dodgeSpeed})하거나 피해 ${action.otherHunters.damage}를 받습니다.`));
    if (action.allHunters) assert(text.includes("이 칸의 모든 사냥꾼을 대상으로 합니다."));
    if (action.bossInsight) assert(text.includes("공격 전에 화기를 소진하여 보스에게 계몽 토큰 1개를 놓을 수 있습니다."));
    if (action.bossInsightReduction) assert(text.includes("계몽 토큰마다 피해 -1"));
    hiddenSources(html); futureMissions(f, text); unchanged(f); closeDetail(f, opener);
  });

function card(f, id) { const control = f.ui.el("hand").querySelectorAll("[data-card]").find(button => button.dataset.card === id); assert(control); control.click(); }
test("combined interaction explains the single-hand-card cost and defaults rescue on while respecting manual deselection through re-renders", () => {
  const f = launch(checkpoints.get(35)); assert.equal(E.interactionOptions(f.state).missionRescue, true);
  assert.equal(f.ui.el("tileRescue").checked, true);
  assert(f.ui.el("decisions").textContent.includes("같은 칸의 여러 대상을 손패 1장으로 동시에 상호작용할 수 있습니다. 적들이 먼저 행동하며, 이때 맞서 공격하거나 회피할 수 없습니다."));
  const rescue = f.ui.el("tileRescue"); rescue.checked = false; rescue.fire("change");
  card(f, E.hunter(f.state).hand[0].id); assert.equal(f.ui.el("tileRescue").checked, false);
  f.ui.el("slots").querySelectorAll("[data-slot]")[0].click(); assert.equal(f.ui.el("tileRescue").checked, false);
  card(f, E.hunter(f.state).hand[1].id); assert.equal(f.ui.el("tileRescue").checked, false); unchanged(f);
});

for (const selected of [true, false]) test(`combined interaction preserves the original command, loot and ${selected ? "included" : "excluded"} rescue choice`, () => {
  const f = launch(checkpoints.get(35)), cardId = E.hunter(f.state).hand[0].id;
  card(f, cardId); const rescue = f.ui.el("tileRescue"); assert.equal(rescue.checked, true);
  if (!selected) { rescue.checked = false; rescue.fire("change"); }
  const loot = f.ui.el("lootCount"); loot.value = "2"; loot.fire("change");
  unchanged(f); assert.equal(f.ui.el("interact").disabled, false); f.ui.el("interact").click();
  const reference = { type: "INTERACT", cardId, lootCount: 2, ...(selected ? { mission: "rescue" } : {}) };
  const actual = E.importSave(f.ui.storage.get(f.key)), expected = E.dispatch(f.state, reference);
  const behavior = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
  assert.deepEqual(behavior(actual), behavior(expected), "the controller retains the engine's single-card combined interaction and retaliation");
  for (const [key, value] of Object.entries(reference)) assert.deepEqual(actual.commands.at(-1)[key], value);
  assert.equal(actual.commands.at(-1).mission, selected ? "rescue" : undefined);
  assert.equal(actual.phase, "interaction_order");
  for (const type of ["COUNTER", "DODGE", "EXTRA_DODGE"])
    assert.equal(f.ui.el("decisions").querySelectorAll("[data-command]").filter(button => button.dataset.command === type).length, 0);
  assert.deepEqual(E.importSave(E.exportSave(actual)), actual); assert.equal(f.ui.el("error").textContent, "");
});

test("the shared public-command helper explicitly deselects default rescue when replaying a loot-only interaction", () => {
  const state = checkpoints.get(35), command = { type: "INTERACT", cardId: E.hunter(state).hand[0].id, lootCount: 2 };
  const actual = require("./helpers/public-command-ui.cjs").clickCommand(state, command);
  const expected = E.dispatch(state, command), behavior = value => { const copy = structuredClone(value); delete copy.commands; return copy; };
  assert.deepEqual(behavior(actual), behavior(expected));
  assert.equal(actual.commands.at(-1).mission, undefined);
});

const decode = text => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
test("attack reward checkboxes in both locations expose their public effects as hover and accessible tooltip text", () => {
  const state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true,
    qa: { preset: "custom", startRewards: ["rune-hunter", "rune-writhe"], startConsumables: [] } });
  const f = launch(state), rewards = E.rewardsView(state).rewards.filter(reward => reward.attackSelectable); assert.equal(rewards.length, 2);
  for (const container of ["rewards", "decisions"]) for (const reward of rewards) {
    const box = f.ui.el(container), expected = clean(f, reward.rules);
    const input = box.querySelectorAll("[data-reward-attack]").find(input => input.dataset.rewardAttack === reward.id); assert(input);
    assert(box.querySelectorAll(".reward-attack-option").some(label => label.getAttribute("title") === expected));
    const tooltipId = input.getAttribute("aria-describedby"), tooltip = f.ui.el(tooltipId); assert(tooltip);
    assert.equal(tooltip.getAttribute("role"), "tooltip");
    const escapedId = tooltipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tooltipText = box.innerHTML.match(new RegExp(`<span\\b[^>]*id="${escapedId}"[^>]*>([^<]*)<\\/span>`)); assert(tooltipText);
    assert.equal(decode(tooltipText[1]), expected); hiddenSources(expected);
  }
  const choice = f.ui.el("decisions").querySelectorAll("[data-reward-attack]")[0]; choice.checked = true; choice.fire("change");
  for (const container of ["rewards", "decisions"])
    assert.equal(f.ui.el(container).querySelectorAll("[data-reward-attack]").find(input => input.dataset.rewardAttack === choice.dataset.rewardAttack).checked, true);
  unchanged(f);
});

test("the menu retains actual save and load controls while removing the old legacy help contents", () => {
  const f = launch(checkpoints.get(0)), html = fs.readFileSync(path.join(__dirname, "../hunt.html"), "utf8");
  const menu = f.ui.document.querySelectorAll("[data-panel]").find(button => button.dataset.panel === "help"); assert(menu); menu.click();
  assert.equal(f.ui.el("infoDialog").open, true);
  for (const id of ["save", "load", "file", "resumeNormal", "resumeQa"]) assert(f.ui.el(id), `${id} is retained`);
  assert.doesNotMatch(html, /href="(?:guide|chapter)\.html"/);
  assert(!html.includes("지도에서 탐험·추격·적의 행동·전투를 진행하고 꿈에서 성장합니다."));
  f.ui.el("save").click(); f.ui.el("load").click(); unchanged(f);
});
