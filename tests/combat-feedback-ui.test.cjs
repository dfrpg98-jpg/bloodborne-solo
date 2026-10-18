"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const E = require("../src/hunt-engine"), Feedback = require("../src/hunt-combat-feedback"),
  MissionEffects = require("../src/hunt-enemy-mission-effects"), { boot } = require("./helpers/ui-harness.cjs"),
  ExtendedGuns = require("../src/extended-firearms"), Supplied = require("../src/actual-components");
const key = "bloodborne-hunt-qa-v1", records = new Map(); let firearmState, abilityBuffState;
for (const [file, wanted] of [["full-campaign-actual-v10-commands.json", 3], ["v074-shelter-natural-commands.json", 10],
  ["v074-patient-natural-commands.json", 31], ["v074-ch2-bridge-natural-commands.json", 36]]) {
  let state = E.create(90, "burial", 1, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "custom", startRewards: [], startConsumables: [] } });
  for (const command of require("./fixtures/" + file)) {
    const usingReaction = () => command.type === "USE_REWARD" && E.killReactionActions(state).some(action =>
      !action.disabled && action.command.type === "USE_REWARD" && action.command.rewardId === command.rewardId && action.command.enemyId === command.enemyId);
    while (state.phase === "kill_react" && !state.rewardChoices.length && !usingReaction()) state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
    state = E.dispatch(state, command);
    if (!abilityBuffState && state.phase === "combat_react" && state.combat?.action?.type === "attack" &&
      (state.combat.buff?.speed > 0 || state.combat.buff?.damage > 0)) abilityBuffState = state;
    if (!firearmState && state.rewardChoices.some(choice => choice.firearmId)) firearmState = state;
    const effect = MissionEffects.describe(state, E).find(effect => effect.card === wanted);
    if (effect) { records.set(wanted, { state, effect }); break; }
  }
}
const engine = { create: E.create, importSave: E.importSave, exportSave: E.exportSave, dispatch: E.dispatch,
  missionView: E.missionView, rewardsView: E.rewardsView, missionActions: E.missionActions,
  applyChapelRuling: state => state, applyCombatReactionRuling: state => state };
function launch(state) {
  const saved = E.exportSave(state), ui = boot(state, E.missionView(state), E.rewardsView(state), {
    engine, realInventory: true, storage: { [key]: saved, "bloodborne-hunt-active-mode": "qa" } });
  return { ui, saved };
}

test("a naturally acquired firearm exposes its actual ability and preparation on the reward name before choosing it", () => {
  assert(firearmState); const { ui, saved } = launch(firearmState), choice = firearmState.rewardChoices.find(choice => choice.firearmId),
    gun = E.rewardsView(firearmState).firearms.find(gun => gun.id === choice.firearmId),
    name = ui.el("decisions").querySelectorAll("[data-firearm-info]").find(element => element.dataset.firearmInfo === gun.id);
  assert.equal(gun.actual, true); assert(name); assert.equal(name.getAttribute("tabindex"), "0");
  assert.match(name.getAttribute("title"), /이동해 들어올 때/);
  assert.match(name.getAttribute("title"), /2 피해|피해 2/);
  assert.match(name.getAttribute("title"), /플레이어의 차례.*손패 2장/);
  assert.match(ui.el("decisions").innerHTML, /role="tooltip"/);
  assert(ui.el(name.getAttribute("aria-describedby")), "the focused name points to a real accessible description");
  name.focus(); assert.equal(ui.commands.length, 0); assert.equal(ui.storage.get(key), saved);
  const equip = ui.buttons("decisions").find(button => button.dataset.command === "EQUIP_FIREARM");
  assert(equip && !equip.disabled); equip.click();
  const actual = E.importSave(ui.storage.get(key));
  assert.deepEqual(actual, E.dispatch(firearmState, { type: "EQUIP_FIREARM", firearmId: gun.id }), "inspecting a tooltip does not change the equip command, costs or replay");
  const equipped = ui.el("firearm").querySelector("[data-firearm-info]");
  assert.equal(equipped.dataset.firearmInfo, gun.id); assert.match(equipped.getAttribute("title"), /손패 2장/);
  assert.equal(ui.el("firearm").querySelectorAll("[data-firearm-preparation]").length, 0, "a ready gun has its preparation instructions in the tooltip only");
});

test("every supplied firearm tooltip preserves its own printed effect instead of a generic pistol ability", () => {
  const guns = { ...Supplied.firearms, ...ExtendedGuns.firearms };
  for (const gun of Object.values(guns)) {
    const text = Feedback.firearmRules(gun).join("\n"), html = Feedback.firearmNameHTML(gun, "acquired");
    assert(text.length > 20); assert.match(html, /tabindex="0"/); assert.match(html, /role="tooltip"/);
    assert(text.includes(gun.rules[0].replace(/(?:자신의\s*)?사냥꾼\s*차례/g, "플레이어의 차례").replace(/(?:손의\s*)?카드\s*(\d+)\s*장/g, "손패 $1장")));
    assert.match(text, /손패 [12]장/);
  }
  assert.match(Feedback.firearmRules(guns.rosmarinus).join(" "), /보스가 아닌.*-1속도.*모든 효과/);
  assert.match(Feedback.firearmRules(guns.evelyn).join(" "), /피의 유지 1개/);
  assert.match(Feedback.firearmRules(guns["repeating-pistol"]).join(" "), /무기를 변형할 때 무료/);
  assert.match(Feedback.firearmRules(guns.flamesprayer).join(" "), /속도 2, 피해 2, 방해.*다른 모든 적/);
});

test("a natural current combat shows both resolved attacks, their exact numbers, effects and speed order without a new command", () => {
  const commands = require("./fixtures/weapon-campaign-completion/beast-claw-0.json");
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true });
  for (const command of commands.slice(0, 10)) state = E.dispatch(state, command);
  assert.equal(state.phase, "combat_react"); const saved = E.exportSave(state),
    ui = boot(state, E.missionView(state), E.rewardsView(state), { engine, storage: { "bloodborne-hunt-v07": saved } }),
    html = ui.el("combatInfo").innerHTML, combat = state.combat;
  assert.match(html, /aria-label="현재 전투의 공격 비교"/);
  assert.match(html, /combat-side-hunter/); assert.match(html, /combat-side-enemy/);
  assert(html.includes(combat.attack.name)); assert(html.includes(combat.action.name));
  const hunterPart = html.split('class="combat-side combat-side-hunter"')[1].split('class="combat-side combat-side-enemy"')[0],
    enemyPart = html.split('class="combat-side combat-side-enemy"')[1];
  assert(hunterPart.includes(`속도 <b>${combat.attack.speed}</b>`)); assert(hunterPart.includes(`피해 <b>${combat.attack.damage}</b>`));
  assert(enemyPart.includes(`속도 <b>${combat.action.speed}</b>`)); assert(enemyPart.includes(`피해 <b>${combat.action.damage}</b>`));
  for (const effect of Feedback.effects(combat.action)) assert(enemyPart.includes(effect.label) && enemyPart.includes(effect.text));
  assert.equal(ui.storage.get("bloodborne-hunt-v07"), saved); assert.equal(ui.commands.length, 0);
});

test("attack keywords describe their consequences and removed effects cannot return from stale printed keywords", () => {
  const enemy = { name: "공개된 공격", type: "attack", speed: 3, damage: 4, stun: true, interrupt: true,
    poison: true, frenzy: true, undodgeable: true, uninterruptible: true, followup: true };
  const html = Feedback.combatHTML({ phase: "combat_react", enemyName: "현재 적", combat: {
    action: enemy, attack: { name: "느린 공격", speed: 1, damage: 3 }, defense: 2 } });
  assert.match(html, /적의 공격이 먼저/); assert.match(html, /손패 1장을 버립니다/);
  assert.match(html, /차례 종료 시 피해 1/); assert.match(html, /공격으로 받는 피해가 1 증가/);
  assert.match(html, /회피할 수 없습니다/); assert.match(html, /방해로 취소할 수 없습니다/);
  assert.match(html, /추가 타격.*회피 속도 2/s); assert.match(html, /플레이어 방어 2/);
  const stripped = { name: enemy.name, type: "attack", speed: 2, damage: 4,
    keywords: ["독", "방해"], rules: ["원래 공격은 독과 방해를 부여합니다."] },
    removed = Feedback.combatHTML({ phase: "combat_react", combat: { action: stripped, removeEnemyAttackEffects: true } });
  assert.match(removed, /적 공격의 모든 부가 효과 제거됨/);
  assert.match(removed, /원래 행동 설명 · 현재 공격의 부가 효과 제거됨/);
  assert.doesNotMatch(removed, /독 상태 이상을 받습니다|더 느린 플레이어의 공격을 취소합니다/);
});

test("unrevealed actions stay hidden and an ability reaction displays its actual dodge and damage instead of attack speed", () => {
  const combat = { attack: { name: "선택한 공격", speed: 3, damage: 2 } };
  Object.defineProperty(combat, "futureActionDeck", { get() { throw Error("hidden deck must not be read"); } });
  const hidden = Feedback.combatHTML({ combat, phase: "combat_choose" });
  assert.match(hidden, /아직 행동을 공개하지 않았습니다/);
  const reaction = Feedback.combatHTML({ phase: "boss_react", combat: { ...combat,
    action: { name: "뛰어 내려찍기", type: "ability", rules: ["다른 보스 행동을 공개합니다."] },
    immediate: { name: "뛰어 내려찍기", dodgeSpeed: 1, damage: 2, stun: true } } });
  assert.match(reaction, /회피 속도 <b>1<\/b>/); assert.match(reaction, /피해 <b>2<\/b>/);
  assert.match(reaction, /기절/); assert.match(reaction, /다른 보스 행동을 공개합니다/);
  const enemyPart = reaction.split('class="combat-side combat-side-enemy"')[1];
  assert.doesNotMatch(enemyPart, /class="enemy-action-stats">속도 /);
});

test("a separately pending followup cannot be mislabeled as canceled or dodged along with the first attack", () => {
  const html = Feedback.combatHTML({ phase: "combat_extra", combat: {
    attack: { name: "처리한 공격", speed: 3, damage: 3 }, attackResolved: true,
    action: { name: "다단 가르기", type: "attack", speed: 2, damage: 2, followup: true },
    extra: { damage: 2, dodgeSpeed: 2 }, cancelEnemy: true, dodged: true } });
  assert.match(html, /첫 공격과 별개로 추가 타격에 대응하세요/);
  assert.match(html, /회피 속도 <b>2<\/b>/); assert.match(html, /피해 <b>2<\/b>/);
  assert.match(html, /첫 공격 취소됨/); assert.match(html, /플레이어 공격 처리 완료/);
  assert.doesNotMatch(html, /현재 적 공격이 취소되었습니다|현재 적 공격에 회피를 선택했습니다/);
});

for (const number of [3, 10, 31, 36]) test(`공개된 임무 ${number}의 유효 공격은 지도 대상과 개체 정보에 같은 효과를 표시합니다`, () => {
  const record = records.get(number); assert(record); const { state, effect } = record, { ui, saved } = launch(state),
    enemy = state.enemies.find(enemy => enemy.id === effect.enemyId), definition = E.enemyDef(state, enemy),
    expected = number === 3 ? definition.ability : definition.special;
  const target = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(element => element.dataset.enemy === enemy.id);
  assert(target); target.click(); const context = ui.el("mapContext").textContent;
  assert(context.includes(expected.name)); assert(context.includes(effect.description));
  if (number === 10) assert.match(context, /가득.*피해 2.*피해를 입은.*피해 4/);
  if (number === 31) assert.match(context, /속도 감소를 받지/);
  const detail = ui.el("enemyRoster").querySelectorAll("button").find(button => enemy.componentId
    ? button.dataset.specialInfo === enemy.id : button.dataset.enemyInfo === enemy.kind);
  assert(detail); detail.click();
  const individual = ui.el("mapContext").querySelectorAll("[data-inspect-target]").find(button => button.dataset.inspectTarget === enemy.id);
  if (individual) individual.click();
  assert.equal(ui.el("mapContext").hidden, false); assert.equal(ui.el("infoDialog").open, false);
  assert(ui.el("enemyInspectionContent"));
  const text = ui.el("mapContext").textContent;
  assert(text.includes(effect.description)); assert(text.includes(expected.name));
  for (const line of effect.effects) assert(text.includes(line));
  assert.equal(ui.storage.get(key), saved, "target inspection and ability details preserve the exact original save");
  assert.equal(ui.commands.length, 0);
});

test("an ordinary ability stays free of an attack-speed badge and injected public strings are escaped", () => {
  const html = Feedback.actionDetailsHTML({ name: "<img src=x>", type: "ability", speed: 1,
    rules: ['[속도 1]로 이동합니다.', '<script>hidden()</script>'] }, { showStats: false });
  assert.doesNotMatch(html, /<img|<script|enemy-action-stats/); assert.match(html, /&lt;img/);
  assert.match(html, /\[속도 1\]로 이동합니다/);
});

test("a speed-one attack on Oedon Chapel is presented at speed zero without changing its printed source", () => {
  const base = { name: "달려들어 뜯기", kind: "special", type: "attack", speed: 1, damage: 2 }, before = JSON.stringify(base),
    prepared = Feedback.contextualAction(base, { tileId: "tile-17", tileName: "오에돈 예배당" });
  assert.equal(prepared.action.speed, 0); assert.equal(JSON.stringify(base), before);
  assert.deepEqual(prepared.modifiers, ["오에돈 예배당 · 속도 -1", "속도 1 → 0 · 피해 2 → 2"]);
  const html = Feedback.actionDetailsHTML(prepared.action, { modifiers: prepared.modifiers });
  assert.match(html, /속도 <b>0<\/b>/); assert.match(html, /속도 1 → 0/);
  const resolved = Feedback.contextualAction(base, { tileId: "tile-17", tileName: "오에돈 예배당", resolvedAction: { ...base, speed: 0 } });
  assert.equal(resolved.action.speed, 0, "an already disclosed zero is authoritative, never reduced a second time");
  assert.equal(Feedback.contextualAction(base, { tileId: "tile-07" }).action.speed, 1, "the Chalice Church does not have Oedon Chapel's slow effect");
});

test("legacy engine mission exceptions and abilities retain their speeds and disclose why the tile penalty is absent", () => {
  const attack = { name: "임무 공격", kind: "special", type: "attack", speed: 3, damage: 3 };
  for (const exception of [{ ignoreTileSpeed: true }, { missionId: "shelter" }]) {
    const prepared = Feedback.contextualAction(attack, { tileId: "tile-17", ...exception });
    assert.equal(prepared.action.speed, 3); assert.match(prepared.modifiers.join(" "), /속도 감소 미적용/);
  }
  const ability = Feedback.contextualAction({ type: "ability", speed: 1, damage: 0 }, { tileId: "tile-17" });
  assert.equal(ability.action.speed, 1); assert.deepEqual(ability.modifiers, [], "ability timing is not an attack-speed modifier");
});

test("a naturally revealed ability buff keeps the engine's final numbers and identifies its public source in combat and enemy detail", () => {
  assert(abilityBuffState); const { ui, saved } = launch(abilityBuffState), combat = abilityBuffState.combat,
    text = ui.el("combatInfo").textContent;
  assert.match(text, /발광한 무리.*속도 \+1.*발광한 무리.*피해 \+1/);
  assert(ui.el("combatInfo").innerHTML.includes(`속도 <b>${combat.action.speed}</b>`));
  assert(ui.el("combatInfo").innerHTML.includes(`피해 <b>${combat.action.damage}</b>`));
  const target = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(element => element.dataset.enemy === combat.enemyId);
  assert(target); target.click(); assert.match(ui.el("mapContext").textContent, /발광한 무리.*속도 \+1/);
  assert.equal(ui.storage.get(key), saved); assert.equal(ui.commands.length, 0);
});

test("a natural normal beast on Oedon Chapel displays the same slowed speed in combat and selected-enemy detail", () => {
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", {
    campaign: true, rulesVersion: 14, qa: { preset: "custom", startRewards: [], startConsumables: [] } });
  let found = false;
  for (const command of require("./fixtures/weapon-campaign-completion/beast-claw-0.json")) {
    const use = () => command.type === "USE_REWARD" && E.killReactionActions(state).some(option => !option.disabled &&
      option.command.type === "USE_REWARD" && option.command.rewardId === command.rewardId && option.command.enemyId === command.enemyId);
    while (state.phase === "kill_react" && !state.rewardChoices.length && !use()) state = E.dispatch(state, { type: "PASS_KILL_REACTION" });
    state = E.dispatch(state, command); const enemy = state.combat && state.enemies.find(enemy => enemy.id === state.combat.enemyId);
    if (state.phase === "combat_react" && enemy?.kind === "scourge-beast" && enemy.missionId !== "shelter" &&
      E.node(state, enemy.node)?.tile === "tile-17" && state.combat.action?.kind === "special") { found = true; break; }
  }
  assert(found); const { ui, saved } = launch(state), enemy = state.enemies.find(enemy => enemy.id === state.combat.enemyId),
    original = E.enemyDef(state, enemy).special, action = state.combat.action;
  assert.equal(action.speed, Math.max(0, original.speed - 1));
  assert(ui.el("combatInfo").innerHTML.includes(`속도 <b>${action.speed}</b>`));
  assert.match(ui.el("combatInfo").textContent, /오에돈 예배당 · 속도 -1/);
  const target = ui.el("chapterMap").querySelectorAll("[data-enemy]").find(element => element.dataset.enemy === enemy.id);
  assert(target); target.click(); const html = ui.el("mapContext").innerHTML;
  const attack = html.split(action.name)[1]; assert(attack.includes(`속도 <b>${action.speed}</b>`));
  assert.match(ui.el("mapContext").textContent, /오에돈 예배당 · 속도 -1/);
  assert.equal(ui.storage.get(key), saved); assert.equal(ui.commands.length, 0);
});
