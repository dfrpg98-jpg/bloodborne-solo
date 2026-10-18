"use strict";
// Launches a separate temporary Chrome context. All gameplay uses visible UI,
// actual keyboard input, official file loading and downloaded save exports.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine")), U = require(path.join(root, "src/hunt-map-controls"));
const origin = "http://127.0.0.1:8860", out = path.join(root, "test-results/space-diagonal-dev34");
fs.mkdirSync(out, { recursive: true });
const report = { version: "0.8.13-dev.34", date: "2026-10-18", method: "separate headless sandboxed Chrome temporary contexts",
  userBrowserAttached: false, userSaveModified: false, pageStateInjection: false, checks: [], screenshots: [], pageExceptions: [] };
let browser, currentPage;
function check(name, condition, details) { assert(condition, name + (details ? ": " + JSON.stringify(details) : "")); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, serviceWorkers: "block", acceptDownloads: true });
  await context.route("**/*", route => { const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.pageExceptions.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.34", { waitUntil: "networkidle" });
  check("latest served controller", await page.locator('script[src*="hunt-app.js?v=0.8.13-dev.34"]').count() === 1);
  return page;
}
async function shot(page, name) { await page.screenshot({ path: path.join(out, name), animations: "disabled" }); report.screenshots.push("test-results/space-diagonal-dev34/" + name); }
async function load(page, file, phase) {
  const setup = await page.locator("#setupDialog").getAttribute("open") !== null;
  if (!setup) await page.locator('.top-actions [data-panel="help"]').click();
  const chooser = page.waitForEvent("filechooser"); await page.locator(setup ? "#loadSetup" : "#load").click();
  await (await chooser).setFiles(file);
  await page.waitForFunction(p => document.documentElement.dataset.phase === p && !document.querySelector("#setupDialog").open, phase);
  assert.equal(await page.locator("#error").textContent(), "");
}
async function save(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click(); const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const target = path.join(out, name + ".json"); await (await pending).saveAs(target); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(target, "utf8"); assert.equal(E.exportSave(E.importSave(text)), text); return text;
}
async function selected(page) { return page.locator('#hand [data-card][aria-pressed="true"]').evaluateAll(nodes => nodes.map(n => n.dataset.card)); }
async function badges(page) {
  return page.locator("#hand [data-card]").evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(), badge = n.querySelector("[data-hand-shortcut]"), b = badge?.getBoundingClientRect();
    return { id: n.dataset.card, top: r.top, left: r.left, shortcut: n.getAttribute("aria-keyshortcuts"),
      badge: badge && !badge.hidden ? badge.textContent : null,
      inside: !badge || badge.hidden || (b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom) }; }).sort((a, b) => a.top - b.top || a.left - b.left));
}
async function handBadges() {
  const page = await newPage();
  await load(page, path.join(root, "test-results/hand-focus-dev33/real-browser/fresh-normal-before.json"), "hunter");
  const baseline = await save(page, "hand-before"), cards = await badges(page);
  check("normal hand has visible number badges in screen order", cards.length === 3 && cards.every((c, i) => c.badge === String(i + 1) && c.shortcut === String(i + 1) && c.inside), cards);
  await page.keyboard.press("2"); check("visible badge 2 selects its card", JSON.stringify(await selected(page)) === JSON.stringify([cards[1].id]));
  await shot(page, "01-hand-shortcut-badges.png");
  await page.keyboard.press("Space");
  check("Space outside refill creates no game command", await save(page, "hand-selection") === baseline);
  await page.keyboard.press("1"); await page.keyboard.press("m"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("m");
  const moved = E.importSave(await save(page, "hand-moved")), remaining = await badges(page);
  check("first cardinal step still spends exactly one card", E.hunter(moved).hand.length === 2 && moved.commands.slice(-3).map(c => c.type).join(",") === "MOVE,STEP,STOP_MOVE");
  check("number badges update after consumption", remaining.every((c, i) => c.badge === String(i + 1) && c.inside));
  for (const viewport of [{ width: 1714, height: 1252 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport); const current = await badges(page);
    const heading = await page.locator(".hand-panel > .panel-heading").evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    check("number badges fit at " + viewport.width, current.every((c, i) => c.badge === String(i + 1) && c.inside) && heading.scroll <= heading.width + 1);
    await shot(page, "hand-" + viewport.width + ".png");
  }
  await page.setViewportSize({ width: 2035, height: 1252 });
  await load(page, path.join(root, "test-results/hand-focus-dev33/real-browser/qa-12-card-hand.json"), "hunter");
  const qaBefore = await save(page, "qa-hand-before"), large = await badges(page);
  check("QA hand marks only cards 1 through 9", large.length === 12 && large.every((c, i) => i < 9 ? c.badge === String(i + 1) && c.inside : c.badge === null && c.shortcut === null));
  await page.keyboard.press("9"); check("QA badge 9 selects its matching card", JSON.stringify(await selected(page)) === JSON.stringify([large[8].id]));
  check("QA badge selection preserves the save", await save(page, "qa-hand-selected") === qaBefore);
  await shot(page, "02-qa-nine-number-badges.png"); await page.context().close();
}
async function refillShortcut(fixture) {
  const page = await newPage(); await load(page, fixture, "refill");
  const before = await save(page, "refill-before"), initial = E.importSave(before);
  check("refill fixture is normal gameplay", !initial.setup.qa);
  check("refill advertises Space on the button", await page.locator("#refill").getAttribute("aria-keyshortcuts") === "Space" && await page.locator("#refill [data-refill-shortcut]").isVisible());
  await shot(page, "03-space-refill.png");
  await page.locator('.top-actions [data-panel="objectives"]').click(); await page.locator("#infoDialog .hunt-window-handle").focus(); await page.keyboard.press("Space");
  check("information window blocks refill Space", await page.locator("html").getAttribute("data-phase") === "refill");
  await page.locator("#infoDialog .hunt-window-minimize").click(); await page.locator("#infoDialog .hunt-window-handle").focus(); await page.keyboard.press("Space");
  check("minimized window blocks refill Space", await page.locator("html").getAttribute("data-phase") === "refill");
  await page.locator("#closeInfo").click();
  const discard = page.locator("[data-refill]"); if (await discard.count()) await discard.first().check();
  const discardIds = await discard.evaluateAll(nodes => nodes.filter(n => n.checked).map(n => n.dataset.refill));
  await page.locator('.top-actions [data-panel="objectives"]').focus();
  await page.keyboard.down("Space"); await page.keyboard.down("Space"); await page.keyboard.up("Space");
  check("Space does not activate a different focused button", await page.locator("dialog[open]").count() === 0);
  const after = await save(page, "refill-after"), expected = E.exportSave(E.dispatch(initial, { type: "REFILL", discardIds }));
  check("Space performs exactly one canonical refill with checked discards", after === expected);
  check("Space retains normal three-card refill result", E.hunter(E.importSave(after)).hand.length === 3);
  await page.context().close();
}
async function diagonals(fixtures) {
  const seen = new Set();
  for (const fixture of fixtures) {
    const page = await newPage(); await load(page, fixture, "move");
    const before = await save(page, "diagonal-" + path.basename(fixture, ".json") + "-before"), state = E.importSave(before), view = U.movement(state);
    check("diagonal fixture is normal gameplay", !state.setup.qa);
    const live = view.directions.filter(d => d.edge.length === 2 && d.options.some(o => o.enabled));
    check("moving pad exposes four corners and eight direction buttons", await page.locator("[data-move-direction]").count() === 8 && live.length > 0);
    const controls = await page.locator("[data-move-direction]").evaluateAll(nodes => nodes.map(n => ({ edge: n.dataset.moveDirection, disabled: n.disabled, shortcut: n.getAttribute("aria-keyshortcuts") })));
    check("only legal diagonal buttons are active; all cardinal buttons disabled", controls.every(b => b.edge.length === 1 ? b.disabled : b.disabled === !live.some(d => d.edge === b.edge)), controls);
    check("no diagonal has a keyboard shortcut", controls.filter(b => b.edge.length === 2).every(b => b.shortcut === null));
    for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "w", "d", "s", "a"]) await page.keyboard.press(key);
    check("disabled cardinal keys preserve exact state", await save(page, "diagonal-" + path.basename(fixture, ".json") + "-keys") === before);
    await shot(page, "diagonal-" + path.basename(fixture, ".json") + ".png");
    const rotation = path.basename(fixture).match(/top-r([0-3])/), target = rotation ? ["SW", "NW", "NE", "SE"][Number(rotation[1])] : "NE";
    const chosen = live.find(d => d.edge === target); assert(chosen, "expected rotated diagonal is enabled"); seen.add(chosen.edge);
    const option = chosen.options.find(o => o.enabled); await page.locator('[data-move-direction="' + chosen.edge + '"]').click();
    if (chosen.options.filter(o => o.enabled).length > 1) await page.locator('[data-move-option="' + chosen.options.indexOf(option) + '"]').click();
    const actual = await save(page, "diagonal-" + path.basename(fixture, ".json") + "-after");
    check("diagonal click executes exactly the original STEP and cost", actual === E.exportSave(E.dispatch(state, option.command)));
    await page.context().close();
  }
  check("actual clicked diagonal coverage", seen.size === 4, { directions: [...seen] });
}
async function cardinalRecovery(fixture) {
  const page = await newPage(); await load(page, fixture, "move");
  const before = E.importSave(await save(page, "cardinal-before")), view = U.movement(before);
  check("cardinal mode resumes when no diagonal is available", !view.diagonalMode && await page.locator('[data-move-direction="N"]').isEnabled() && await page.locator('[data-move-direction="S"]').isEnabled());
  check("all unavailable diagonal buttons remain disabled", await page.locator('[data-move-direction="NE"], [data-move-direction="SE"], [data-move-direction="SW"], [data-move-direction="NW"]').evaluateAll(nodes => nodes.length === 4 && nodes.every(n => n.disabled)));
  await page.keyboard.press("ArrowUp");
  const command = view.directions.find(d => d.edge === "N").options.find(o => o.enabled).command;
  check("enabled cardinal key still executes the original STEP", await save(page, "cardinal-after") === E.exportSave(E.dispatch(before, command)));
  await page.context().close();
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  try {
    const fixtureList = JSON.parse(fs.readFileSync(path.join(out, "browser-fixtures.json"), "utf8").replace(/^\uFEFF/, ""));
    await handBadges(); await refillShortcut(path.join(out, fixtureList.refill)); await diagonals(fixtureList.diagonals.map(f => path.join(out, f))); await cardinalRecovery(path.join(out, fixtureList.cardinal));
    check("no page exceptions", report.pageExceptions.length === 0);
    report.status = "passed"; report.sourceSha256 = Object.fromEntries(["src/hunt-app.js", "src/hunt-keyboard-controls.js", "src/hunt-map-controls.js", "styles/hunt.css", "styles/hunt-map-controls.css"].map(f => [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex")]));
  } catch (error) { report.status = "failed"; report.failure = error.message;
    if (currentPage && !currentPage.isClosed()) await shot(currentPage, "failure.png").catch(() => {}); throw error;
  } finally { await browser.close(); fs.writeFileSync(path.join(out, "real-browser.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ status: report.status, checksPassed: report.checks.length, failure: report.failure })); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
