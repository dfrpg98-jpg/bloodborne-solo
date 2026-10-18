"use strict";
// Separate sandboxed installed Chrome. Public E.create/dispatch recipes generate
// strict saves, which enter through the real file chooser. No browser injection.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright"), root = path.resolve(__dirname, "../../.."),
  E = require(path.join(root, "src/hunt-engine")), Auto = require(path.join(root, "src/hunt-automatic-combat")), Death = require(path.join(root, "src/hunt-death-feedback"));
const origin = "http://127.0.0.1:8860", out = path.join(root, "test-results/scourge-followup-dev37/browser");
fs.mkdirSync(out, { recursive: true });
const report = { schema: "scourge-followup-real-browser-v1", version: "0.8.13-dev.37", allowedOrigin: origin,
  browserMode: "separate temporary headless Chrome context, Chromium sandbox enabled", userBrowserAttached: false,
  userSaveModified: false, pageStateInjection: false, fixtures: [], checks: [], downloads: [], screenshots: [], pageErrors: [] };
const sourceFiles = ["hunt.html", "src/hunt-app.js", "src/hunt-automatic-combat.js", "src/hunt-engine.js", "src/hunt-death-feedback.js"],
  hashes = () => Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
let browser, currentPage, downloadNumber = 0;
function check(name, condition, details) { assert(condition, name + (details ? ": " + JSON.stringify(details) : "")); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
function createFixture(recipe) {
  const setup = recipe.setup;
  let state = E.create(recipe.seed, setup.weaponId, setup.face, setup.startingConsumable, setup.firearmId, setup.startSpace, setup);
  for (const command of recipe.commands) state = E.dispatch(state, command);
  const text = E.exportSave(state); assert.equal(E.exportSave(E.importSave(text)), text);
  const sha256 = crypto.createHash("sha256").update(text).digest("hex");
  if (recipe.sha256) assert.equal(sha256, recipe.sha256, "public recipe reconstructs independently supplied strict fixture " + recipe.id);
  const file = path.join(out, recipe.id + "-input.json"); fs.writeFileSync(file, text);
  report.fixtures.push({ id: recipe.id, source: recipe.source, mode: recipe.mode, seed: recipe.seed, qa: !!setup.qa,
    initialHP: E.hunter(state).hp, enemyHP: state.enemies.find(enemy => enemy.id === state.combat?.enemyId)?.hp,
    commands: state.commands.length, sha256 });
  return { ...recipe, state, file };
}
function adopted(state) {
  for (const name of ["applyChapelRuling", "applyCombatReactionRuling", "applyTileSpeedRuling", "applyLeapMoveRuling"]) if (E[name]) state = E[name](state);
  return state;
}
function commitReference(state, command) {
  state = E.dispatch(state, command);
  for (let count = 0; count < 12; count++) { const next = Auto.nextCommand(state, E); if (!next) break; state = E.dispatch(state, next); }
  if (E.applyTileSpeedRuling) state = E.applyTileSpeedRuling(state);
  if (E.applyLeapMoveRuling) state = E.applyLeapMoveRuling(state);
  return state;
}
const realCommands = state => state.commands.filter(command => !command.type.startsWith("APPLY_"));
async function screenshot(page, name) { await page.screenshot({ path: path.join(out, name), animations: "disabled" }); report.screenshots.push(name); }
async function pageFor(fixture, branch, phase = "combat_react") {
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, acceptDownloads: true, serviceWorkers: "block" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.origin === origin || ["data:", "blob:"].includes(u.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(12000);
  page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.37", { waitUntil: "networkidle" });
  await page.locator("#loadSetup").waitFor({ state: "visible" });
  check(branch + " serves the dev37 automatic combat module", await page.locator('script[src*="hunt-automatic-combat.js?v=0.8.13-dev.37"]').count() === 1);
  const chooser = page.waitForEvent("filechooser"); await page.locator("#loadSetup").click(); await (await chooser).setFiles(fixture.file);
  await page.waitForFunction(expected => document.documentElement.dataset.phase === expected && !document.querySelector("#setupDialog").open, phase);
  check(branch + " official import is accepted", (await page.locator("#error").textContent()) === "");
  return page;
}
async function download(page, label) {
  await page.locator('.top-actions [data-panel="help"]').click(); const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const name = String(++downloadNumber).padStart(2, "0") + "-" + label + ".json", file = path.join(out, name);
  await (await pending).saveAs(file); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(file, "utf8"), state = E.importSave(text); assert.equal(E.exportSave(state), text);
  report.downloads.push(name); return { text, state };
}
async function feedback(page, label) {
  let mission = false, death = false;
  for (let count = 0; count < 5; count++) {
    if (await page.locator("#deathContinue").isVisible()) {
      death = true; await screenshot(page, label + "-death.png"); await page.locator("#deathContinue").click();
    } else if (await page.locator("#missionUpdateContinue").isVisible()) {
      mission = true; await screenshot(page, label + "-mission.png"); await page.locator("#missionUpdateContinue").click();
    } else break;
  }
  return { mission, death };
}
function availableDodge(state) {
  for (const card of E.hunter(state).hand) for (let slot = 0; slot < E.slots(state).length; slot++)
    if (E.canDodge(state, card.id, slot, true)) return { type: "EXTRA_DODGE", cardId: card.id, slot };
  return null;
}
async function resolveIntoContinuation(page, fixture, label) {
  const before = await download(page, label + "-before"), enemy = before.state.enemies.find(enemy => enemy.id === before.state.combat.enemyId), h = E.hunter(before.state);
  check(label + " baseline is a real pending Scourge Beast double slash", before.state.phase === "combat_react" && enemy?.kind === "scourge-beast" && before.state.combat.action.followup === true,
    { hp: h.hp, enemyHP: enemy?.hp, hunterAttack: before.state.combat.attack && { speed: before.state.combat.attack.speed, damage: before.state.combat.attack.damage }, enemyAttack: before.state.combat.action });
  check(label + " loaded save matches independent adopted public recipe", before.text === E.exportSave(adopted(fixture.state)));
  await screenshot(page, label + "-before-resolve.png");
  const expected = commitReference(before.state, { type: "RESOLVE" }); await page.locator('[data-command="RESOLVE"]').click();
  const notices = await feedback(page, label + "-resolve"), actual = await download(page, label + "-resolved");
  check(label + " actual RESOLVE and automatic commands match reducer reference byte-exact", actual.text === E.exportSave(expected), { commands: realCommands(actual.state).slice(-4), hp: E.hunter(actual.state).hp, phase: actual.state.phase });
  if (fixture.mode === "mutual-lethal") {
    check(label + " simultaneous lethal damage ends combat before any extra window", h.hp === 1 && enemy.hp === 1 && E.hunter(actual.state).inDream && actual.state.combat === null && actual.state.phase !== "combat_extra",
      { resetCanRespawnKilledFigure: actual.state.enemies.some(value => value.id === enemy.id), finalPhase: actual.state.phase });
    check(label + " the final event batch records the beast kill and exactly one hunter death", actual.state.events.slice(-12).some(event => /재앙의 야수 처치/.test(event.text)) && actual.state.events.slice(-12).filter(event => /처치당했습니다/.test(event.text)).length === 1);
    check(label + " simultaneous death adds no EXTRA_TAKE or EXTRA_DODGE", realCommands(actual.state).length === realCommands(before.state).length + 1 && realCommands(actual.state).at(-1).type === "RESOLVE");
    return actual;
  }
  if (actual.state.rewardChoices?.length) {
    check(label + " mission reward choice appears before the required extra hit", actual.state.phase === "combat_extra" && !actual.state.enemies.some(value => value.id === enemy.id) && notices.mission && Auto.nextCommand(actual.state, E) === null,
      { hp: E.hunter(actual.state).hp, rewards: actual.state.rewardChoices, notices });
    check(label + " mission completion has not silently taken the extra damage", !realCommands(actual.state).slice(realCommands(before.state).length).some(command => command.type === "EXTRA_TAKE"));
    await screenshot(page, label + "-reward-before-extra.png");
    const reward = page.locator('#decisions [data-command="KEEP_REWARD"]:enabled').first(); await reward.waitFor({ state: "visible" });
    const command = { type: await reward.getAttribute("data-command"), ...JSON.parse(await reward.getAttribute("data-args")) };
    const afterChoice = commitReference(actual.state, command); await reward.click(); await feedback(page, label + "-reward");
    const continued = await download(page, label + "-reward-completed");
    check(label + " reward selection and required continuation match reference byte-exact", continued.text === E.exportSave(afterChoice), { commands: realCommands(continued.state).slice(-3), hp: E.hunter(continued.state).hp, phase: continued.state.phase });
    return { ...continued, before, first: actual };
  }
  return { ...actual, before };
}
async function forcedCase(fixture) {
  const label = fixture.id, page = await pageFor(fixture, label), result = await resolveIntoContinuation(page, fixture, label), state = result.state;
  check(label + " no-choice posthumous extra damage automatically records EXTRA_TAKE", realCommands(state).at(-1).type === "EXTRA_TAKE" && state.phase !== "combat_extra");
  check(label + " forced extra retains canonical lethal damage and dream recovery", E.hunter(state).inDream && E.hunter(state).hp === 6 && state.events.some(event => /다단 가르기 추가 피해/.test(event.text)), { phase: state.phase, hp: E.hunter(state).hp });
  check(label + " forced branch leaves no redundant extra confirmation", await page.locator('[data-command="EXTRA_TAKE"]').count() === 0 && await page.locator('[data-command="EXTRA_DODGE"]').count() === 0);
  await screenshot(page, label + "-completed.png");
  await reloadProof(page, result, label);
  await page.context().close();
}
async function reloadProof(page, result, label) {
  const extraCount = realCommands(result.state).filter(command => command.type === "EXTRA_TAKE").length;
  await page.reload({ waitUntil: "networkidle" }); await feedback(page, label + "-reload");
  const actual = await download(page, label + "-reloaded");
  check(label + " reload preserves the completed official save byte-exact", actual.text === result.text);
  check(label + " reload cannot duplicate the automatic extra-hit command", realCommands(actual.state).filter(command => command.type === "EXTRA_TAKE").length === extraCount);
}
async function pendingImportCase(fixture) {
  let pending = E.dispatch(fixture.state, { type: "RESOLVE" });
  const reward = pending.rewardChoices[0]; assert(reward);
  pending = E.dispatch(pending, { type: "KEEP_REWARD", rewardId: reward.rewardId });
  assert.equal(pending.phase, "combat_extra"); assert.deepEqual(Auto.nextCommand(pending, E), { type: "EXTRA_TAKE" });
  const label = fixture.id + "-pending-import", text = E.exportSave(pending), file = path.join(out, label + ".json");
  assert.equal(E.exportSave(E.importSave(text)), text); fs.writeFileSync(file, text);
  report.fixtures.push({ id: label, source: fixture.id + " public RESOLVE + KEEP_REWARD, intentionally saved before the UI convenience continuation",
    mode: "pending-extra-import", qa: !!pending.setup.qa, commands: pending.commands.length, sha256: crypto.createHash("sha256").update(text).digest("hex") });
  const adoptedPending = adopted(pending), expected = commitReference(adoptedPending, { type: "EXTRA_TAKE" }),
    page = await pageFor({ ...fixture, file }, label, expected.phase);
  await feedback(page, label); const actual = await download(page, label + "-completed");
  check(label + " official import immediately performs the canonical required extra hit", actual.text === E.exportSave(expected));
  check(label + " import records exactly one automatic EXTRA_TAKE", realCommands(actual.state).length === realCommands(pending).length + 1 && realCommands(actual.state).at(-1).type === "EXTRA_TAKE");
  check(label + " import leaves no redundant extra-hit confirmation", actual.state.phase !== "combat_extra" && await page.locator('[data-command="EXTRA_TAKE"]').count() === 0);
  await screenshot(page, label + "-completed.png"); await reloadProof(page, actual, label); await page.context().close();
}
async function optionalCase(fixture, dodge) {
  const label = fixture.id + (dodge ? "-dodge" : "-take"), page = await pageFor(fixture, label), result = await resolveIntoContinuation(page, fixture, label), state = result.state, option = availableDodge(state);
  check(label + " a real available dodge keeps the posthumous extra window open", state.phase === "combat_extra" && !state.enemies.some(enemy => enemy.id === state.combat.enemyId) && !!option && Auto.nextCommand(state, E) === null);
  check(label + " taking the extra hit remains an explicit available choice", await page.locator('[data-command="EXTRA_TAKE"]').isEnabled());
  if (dodge) {
    await page.locator('#hand [data-card="' + option.cardId + '"]').click(); await page.locator('#slots [data-slot="' + option.slot + '"]').click();
    check(label + " selecting a legal card and empty slot enables extra dodge", await page.locator('[data-command="EXTRA_DODGE"]').isEnabled());
    check(label + " preparing extra dodge spends nothing", (await download(page, label + "-prepared")).text === result.text);
    await screenshot(page, label + "-available-choice.png"); await page.locator('[data-command="EXTRA_DODGE"]').click();
  } else { await screenshot(page, label + "-available-choice.png"); await page.locator('[data-command="EXTRA_TAKE"]').click(); }
  await feedback(page, label + "-final"); const actual = await download(page, label + "-completed"), command = dodge ? option : { type: "EXTRA_TAKE" };
  check(label + " explicit continuation matches canonical damage/cost/state byte-exact", actual.text === E.exportSave(commitReference(state, command)));
  check(label + " records exactly the chosen extra response", realCommands(actual.state).length === realCommands(state).length + 1 && realCommands(actual.state).at(-1).type === command.type);
  if (dodge) check(label + " successful extra dodge causes no death while allowing campaign dream recovery", Death.describe(state, actual.state) === null && E.hunter(actual.state).hp >= E.hunter(state).hp,
    { beforeHP: E.hunter(state).hp, finalHP: E.hunter(actual.state).hp, campaignDream: E.hunter(actual.state).inDream });
  await page.context().close();
}
async function optionalRewardCase(fixture) {
  const label = fixture.id, page = await pageFor(fixture, label), result = await resolveIntoContinuation(page, fixture, label), state = result.state,
    reward = E.rewardsView(state).rewards.find(reward => reward.usable && reward.kind === "rune-rapture");
  check(label + " usable kill reward preserves the continuation instead of being skipped", state.phase === "combat_extra" && !!reward && Auto.nextCommand(state, E) === null);
  check(label + " explicit extra response remains available while the reward can be chosen", await page.locator('[data-command="EXTRA_TAKE"]').isEnabled());
  await screenshot(page, label + "-optional-reward-preserved.png");
  await page.locator("#workspaceRewardsTab").click();
  const use = page.locator('#rewards [data-command="USE_REWARD"]').filter({ hasText: "피의 기쁨" });
  check(label + " the optional kill reward is actionable in the equipment tab", await use.isEnabled());
  const command = { type: await use.getAttribute("data-command"), ...JSON.parse(await use.getAttribute("data-args")) }; assert.equal(command.rewardId, reward.id);
  await use.click(); await feedback(page, label + "-after-reward");
  const actual = await download(page, label + "-used-and-continued");
  check(label + " explicit reward use and the now-forced extra hit match reference byte-exact", actual.text === E.exportSave(commitReference(state, command)));
  check(label + " only using the reward unlocks the automatic extra hit", realCommands(actual.state).slice(-2).map(command => command.type).join(",") === "USE_REWARD,EXTRA_TAKE");
  await screenshot(page, label + "-completed.png"); await page.context().close();
}
async function mutualCase(fixture) {
  const page = await pageFor(fixture, fixture.id); await resolveIntoContinuation(page, fixture, fixture.id); await screenshot(page, fixture.id + "-completed.png"); await page.context().close();
}
(async () => {
  try {
    const recipes = JSON.parse(fs.readFileSync(path.join(__dirname, "public-recipes.json"), "utf8"));
    const fixtures = recipes.cases.map(createFixture); report.sourceSha256Before = hashes();
    browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
    for (const fixture of fixtures) {
      if (fixture.mode === "mutual-lethal") await mutualCase(fixture);
      else if (fixture.mode === "optional-reward") await optionalRewardCase(fixture);
      else if (fixture.mode === "optional-dodge") { await optionalCase(fixture, true); await optionalCase(fixture, false); }
      else await forcedCase(fixture);
    }
    await pendingImportCase(fixtures.find(fixture => fixture.mode === "forced"));
    report.sourceSha256After = hashes(); check("verified product source stayed stable", JSON.stringify(report.sourceSha256Before) === JSON.stringify(report.sourceSha256After));
    check("no unhandled browser exceptions", report.pageErrors.length === 0, report.pageErrors); report.status = "passed";
  } catch (error) { report.status = "failed"; report.failure = error.stack; console.error(error); if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, "failure.png").catch(() => {}); process.exitCode = 1; }
  finally { await browser?.close(); fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure })); }
})();
