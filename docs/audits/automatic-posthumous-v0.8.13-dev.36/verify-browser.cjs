"use strict";
// Own temporary sandboxed Chrome profile. Loads public component-practice saves
// through the official file chooser and compares actual UI downloads byte-exact.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright"), root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine"));
const origin = "http://127.0.0.1:8860", fixtures = path.join(root, "test-results/hunt-actions-dev36/posthumous"),
  artifactDirectory = "test-results/hunt-actions-dev36/posthumous-browser", out = path.join(root, artifactDirectory);
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(fixtures, { recursive: true });
const report = { schema: "automatic-posthumous-real-browser-v1", date: "2026-10-18", version: "0.8.13-dev.36",
  scope: "Public component practice fixtures, not normal campaign completion", browserMode: "separate headless Chrome, temporary context, Chromium sandbox enabled",
  allowedOrigin: origin, userBrowserAttached: false, userSaveModified: false, pageStateInjection: false,
  artifactDirectory, fixtureConstruction: "E.create seed1 public male-beast-patient sideb component practice, ATTACK strength card7 slot1, canonical RESOLVE commands; optional variant starts with practice rune-rapture reward. No direct state changes.",
  checks: [], pageExceptions: [], screenshots: [], downloads: [], fixtureInputs: [] };
const sourceFiles = ["src/hunt-app.js", "src/hunt-automatic-combat.js", "hunt.html"], hashes = () => Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
let browser, currentPage;
function generateFixtures() {
  const create = rewards => E.create(1, "burial", 0, null, "hunter-pistol", "center", { campaign: false,
    rulesVersion: 14, practiceTarget: "male-beast-patient", practiceSide: "b", ...(rewards ? { practiceRewards: rewards } : {}) });
  const attack = { type: "ATTACK", enemyId: "practice-target", cardId: "card-7", slot: 1 }, start = create(),
    declared = E.dispatch(start, attack), echo = E.dispatch(declared, { type: "RESOLVE" }),
    after = E.dispatch(echo, { type: "RESOLVE" }), optional = E.dispatch(E.dispatch(create(["rune-rapture"]), attack), { type: "RESOLVE" });
  for (const [file, state] of [["practice-start.json", start], ["practice-declared.json", declared],
    ["practice-death-echo.json", echo], ["practice-after-auto-resolve.json", after], ["practice-optional-kill-reaction.json", optional]]) {
    const text = E.exportSave(state), target = path.join(fixtures, file);
    if (fs.existsSync(target)) assert.equal(fs.readFileSync(target, "utf8"), text, "independent public-command construction matches original fixture " + file);
    else fs.writeFileSync(target, text);
    report.fixtureInputs.push({ file: path.relative(root, target).replaceAll("\\", "/"), sha256: crypto.createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text), phase: state.phase, qa: !!state.setup.qa, commands: state.commands });
  }
}
function adoptedReference(file) {
  let state = E.importSave(fs.readFileSync(path.join(fixtures, file), "utf8"));
  for (const name of ["applyChapelRuling", "applyCombatReactionRuling", "applyTileSpeedRuling", "applyLeapMoveRuling"])
    if (E[name]) state = E[name](state);
  return E.exportSave(state);
}
const combatCommands = state => state.commands.filter(command => command.type !== "APPLY_TILE_SPEED_RULING");
function check(name, condition, details) { assert(condition, name + (details ? ": " + JSON.stringify(details) : "")); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
async function pageFor(file, phase) {
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, serviceWorkers: "block", acceptDownloads: true });
  await context.route("**/*", route => { const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(12000);
  page.on("pageerror", error => report.pageExceptions.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.36", { waitUntil: "networkidle" });
  check("automatic combat module served: " + file, await page.locator('script[src*="hunt-automatic-combat.js"]').count() === 1);
  const chooser = page.waitForEvent("filechooser"); await page.locator("#loadSetup").click();
  await (await chooser).setFiles(path.join(fixtures, file));
  await page.waitForFunction(expected => document.documentElement.dataset.phase === expected && !document.querySelector("#setupDialog").open, phase);
  check("official load has no displayed error: " + file, await page.locator("#error").textContent() === "");
  return page;
}
async function download(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const target = path.join(out, name + ".json"); await (await pending).saveAs(target);
  await page.locator("#closeInfo").click(); const text = fs.readFileSync(target, "utf8");
  assert.equal(E.exportSave(E.importSave(text)), text); report.downloads.push(path.basename(target)); return text;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name), animations: "disabled" }); report.screenshots.push(name);
}
async function loadContinuation() {
  const page = await pageFor("practice-death-echo.json", "hunter"), actual = await download(page, "loaded-echo-after-auto"),
    expected = adoptedReference("practice-after-auto-resolve.json"), state = E.importSave(actual);
  check("loading mandatory death echo automatically records exactly one canonical RESOLVE", combatCommands(state).map(command => command.type).join(",") === "ATTACK,RESOLVE,RESOLVE",
    { commands: state.commands, policyAdoption: "existing APPLY_TILE_SPEED_RULING becomes legal after combat; included in independent reference" });
  check("loaded death echo final save matches independent reducer reference byte-exact", actual === expected);
  check("automatic death echo leaves no extra combat confirmation", await page.locator('[data-command="RESOLVE"]').count() === 0 && !/사후|죽음의 메아리/.test(await page.locator("#combatInfo").innerText()));
  await screenshot(page, "01-loaded-echo-completed.png"); await page.context().close();
}
async function resolveDeclaration() {
  const page = await pageFor("practice-declared.json", "combat_react"), before = E.importSave(await download(page, "declared-before-resolve"));
  check("declared attack still offers the normal combat response", before.phase === "combat_react" && await page.locator('[data-command="RESOLVE"]').isVisible());
  await page.locator('[data-command="RESOLVE"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.phase === "hunter");
  const actual = await download(page, "declared-after-auto"), expected = adoptedReference("practice-after-auto-resolve.json"), state = E.importSave(actual);
  check("one player combat confirmation adds normal and automatic RESOLVE commands", combatCommands(state).length === combatCommands(before).length + 2 && combatCommands(state).slice(-2).every(command => command.type === "RESOLVE"));
  check("declared attack final save matches independent reducer reference byte-exact", actual === expected);
  check("death echo damage remains canonical", E.hunter(state).hp === E.hunter(E.importSave(expected)).hp, { hp: E.hunter(state).hp });
  await screenshot(page, "02-declared-attack-completed.png"); await page.context().close();
}
async function optionalReaction() {
  const file = "practice-optional-kill-reaction.json", page = await pageFor(file, "kill_react"), actual = await download(page, "optional-reaction-preserved"),
    expected = fs.readFileSync(path.join(fixtures, file), "utf8"), state = E.importSave(actual), controls = await page.locator('#decisions [data-command], #decisionActions [data-command]').evaluateAll(elements => elements.map(element => ({ command: element.dataset.command, text: element.textContent.trim(), disabled: element.disabled })));
  check("optional kill reward choice remains open", state.phase === "kill_react" && controls.length > 0, { controls });
  check("optional kill reaction load records no automatic command", actual === expected && state.commands.length === 2);
  check("optional reward remains usable", E.rewardsView(state).rewards.some(reward => reward.usable));
  await screenshot(page, "03-optional-reaction-preserved.png"); await page.context().close();
}
(async () => {
  generateFixtures(); report.sourceSha256Before = hashes(); browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  try {
    await loadContinuation(); await resolveDeclaration(); await optionalReaction();
    check("no unhandled browser page exceptions", report.pageExceptions.length === 0, { errors: report.pageExceptions });
    report.sourceSha256After = hashes(); check("verified source files stayed unchanged during browser checks", JSON.stringify(report.sourceSha256Before) === JSON.stringify(report.sourceSha256After));
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, "failure.png").catch(() => {}); process.exitCode = 1;
  } finally {
    await browser.close(); fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ status: report.status, checksPassed: report.checks.length, browserVersion: report.browserVersion, failure: report.failure?.message }));
  }
})();
