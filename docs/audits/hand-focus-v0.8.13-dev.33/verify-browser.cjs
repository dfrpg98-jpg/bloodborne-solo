"use strict";
// Run with an installed Playwright module path. This launches its own temporary
// browser; it never attaches to the user's browser or injects a stored state.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine"));
const origin = "http://127.0.0.1:8860", out = path.join(root, "test-results/hand-focus-dev33/real-browser");
fs.mkdirSync(out, { recursive: true });
const report = { schema: "hand-focus-real-browser-v1", version: "0.8.13-dev.33", date: "2026-10-18",
  browserMode: "separate headless Chrome with a temporary context and Chromium sandbox enabled",
  allowedOrigin: origin, userBrowserAttached: false, userSaveModified: false, pageStateInjection: false,
  normalCombatSource: "actual chapter3-start browser export, followed by three public UI commands",
  qaScope: "12-card keyboard boundary only; not normal campaign completion", checks: [], screenshots: [], errors: [] };
let browser, currentPage;
function check(name, condition, details) { assert(condition, name + (details ? ": " + JSON.stringify(details) : "")); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
async function newPage(viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block", acceptDownloads: true });
  await context.route("**/*", route => { const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); currentPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.33", { waitUntil: "networkidle" });
  check("latest served controller", await page.locator('script[src*="hunt-app.js?v=0.8.13-dev.33"]').count() === 1);
  return page;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name), animations: "disabled" });
  report.screenshots.push("test-results/hand-focus-dev33/real-browser/" + name);
}
async function exportSave(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const download = await pending, target = path.join(out, name + ".json"); await download.saveAs(target);
  await page.locator("#closeInfo").click(); const text = fs.readFileSync(target, "utf8");
  assert.equal(E.exportSave(E.importSave(text)), text, "actual UI export strictly replays byte-exact");
  return text;
}
async function loadSave(page, file, phase) {
  const setup = await page.locator("#setupDialog").getAttribute("open") !== null;
  if (!setup) await page.locator('.top-actions [data-panel="help"]').click();
  const chooser = page.waitForEvent("filechooser"); await page.locator(setup ? "#loadSetup" : "#load").click();
  await (await chooser).setFiles(file); await page.waitForFunction(p => document.documentElement.dataset.phase === p && !document.querySelector("#setupDialog").open, phase);
  assert.equal(await page.locator("#error").textContent(), "");
}
async function pressed(page) { return page.locator('#hand [data-card][aria-pressed="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.card)); }
async function outline(page, selector) {
  return page.locator(selector).evaluate(element => { const style = getComputedStyle(element), r = element.getBoundingClientRect();
    return { active: document.activeElement === element, style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height } }; });
}
async function normalStart() {
  const page = await newPage({ width: 2035, height: 1252 });
  await page.locator("#setupAdvanced > summary").click(); await page.locator("#seed").fill("90");
  await page.locator("#start").selectOption("center"); await page.locator("#gun").selectOption("hunter-pistol");
  await page.locator("#confirmSetup").click();
  for (let i = 0; i < 3 && await page.locator("#missionUpdateContinue").isVisible(); i++) await page.locator("#missionUpdateContinue").click();
  await page.waitForFunction(() => document.documentElement.dataset.phase === "hunter" && !document.querySelector("dialog[open]"));
  const baseline = await exportSave(page, "fresh-normal-before"), state = E.importSave(baseline), cards = E.hunter(state).hand.map(card => card.id);
  check("fresh normal setup has no QA items", !state.setup.qa && !state.setup.startingConsumable && cards.length === 3);
  await page.locator(".decision-content").click({ position: { x: 6, y: 250 } }); await page.keyboard.press("m");
  let facts = await outline(page, ".decision-content");
  check("M without a hand card leaves the reading pane without a native box", facts.active && facts.style === "none", facts);
  check("M without a hand card does not declare movement", await page.locator("html").getAttribute("data-phase") === "hunter" && (await pressed(page)).length === 0);
  await screenshot(page, "01-no-hand-m.png");
  await page.locator("#mapViewport").click({ position: { x: 8, y: 8 } }); await page.keyboard.press("m");
  facts = await outline(page, "#mapViewport"); check("map click and M keep the map focused without a native box", facts.active && facts.style === "none", facts);
  for (const selector of ["#status", "#tileInfoPanel", "#phaseTitle"]) {
    await page.locator(selector).focus(); const value = await outline(page, selector);
    check("reading focus has no native box: " + selector, value.active && value.style === "none", value);
  }
  await page.locator('#hand [data-card]').first().focus(); await page.keyboard.press("Tab");
  const actionFocus = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e);
    return { card: e.dataset.card, style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }; });
  check("keyboard action focus still uses the gold ring", actionFocus.card === cards[1] && actionFocus.style === "solid" && actionFocus.color === "rgb(240, 214, 149)", actionFocus);
  await page.keyboard.press("1"); check("1 selects the first displayed hand card", JSON.stringify(await pressed(page)) === JSON.stringify([cards[0]]));
  await page.keyboard.press("1"); check("the same number deselects", (await pressed(page)).length === 0);
  await page.keyboard.press("2"); check("2 selects the second displayed hand card", JSON.stringify(await pressed(page)) === JSON.stringify([cards[1]]));
  await page.keyboard.press("3"); check("3 selects the third displayed hand card", JSON.stringify(await pressed(page)) === JSON.stringify([cards[2]]));
  check("the existing hint line is concise", await page.locator("#cardHint").textContent() === "1–9 손패 선택");
  check("selection and no-op M preserve exact save bytes", await exportSave(page, "fresh-normal-selection") === baseline);
  await page.keyboard.press("1"); await screenshot(page, "02-number-selected.png");
  for (const viewport of [{ width: 1714, height: 1252 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    const heading = await page.locator(".hand-panel > .panel-heading").evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
    check("hand heading does not gain horizontal overflow at " + viewport.width, heading.scroll <= heading.width + 1, heading);
    await screenshot(page, "normal-" + viewport.width + ".png");
  }
  await page.setViewportSize({ width: 2035, height: 1252 });
  await page.locator('.top-actions [data-panel="objectives"]').click();
  const selection = await pressed(page); await page.keyboard.press("2");
  check("an open information window blocks number selection", JSON.stringify(await pressed(page)) === JSON.stringify(selection));
  await page.locator("#infoDialog .hunt-window-minimize").click(); await page.keyboard.press("2"); await page.keyboard.press("m");
  check("a minimized window blocks number and movement actions", JSON.stringify(await pressed(page)) === JSON.stringify(selection) && await page.locator("html").getAttribute("data-phase") === "hunter");
  await page.locator("#closeInfo").click(); await page.locator("#new").click();
  if (await page.locator("#setupAdvanced").getAttribute("open") === null) await page.locator("#setupAdvanced > summary").click();
  await page.locator("#seed").fill("90"); await page.keyboard.press("1");
  check("typing a number remains in the input", await page.locator("#seed").inputValue() === "901" && JSON.stringify(await pressed(page)) === JSON.stringify(selection));
  await page.locator("#cancelSetup").click();
  await page.keyboard.press("m"); check("movement declaration keeps all hand cards", await page.locator("html").getAttribute("data-phase") === "move" && await page.locator("#hand [data-card]").count() === 3);
  await page.keyboard.press("ArrowRight"); check("the first step spends one selected card", await page.locator("#hand [data-card]").count() === 2);
  await page.keyboard.press("m");
  const moved = E.importSave(await exportSave(page, "fresh-normal-moved"));
  check("M, direction, M uses the selected hand through normal commands", moved.phase === "hunter" && moved.commands.slice(-3).map(c => c.type).join(",") === "MOVE,STEP,STOP_MOVE" && moved.commands.at(-3).cardId === cards[0]);
  await page.keyboard.press("1"); const remaining = E.hunter(moved).hand[0].id;
  check("after consumption 1 selects the new first hand card", JSON.stringify(await pressed(page)) === JSON.stringify([remaining]));
  assert.equal(await page.locator("#error").textContent(), ""); await page.context().close();
}
async function normalCombat() {
  const page = await newPage({ width: 2035, height: 1252 });
  await loadSave(page, path.join(root, "test-results/normal-completion-dev31/exports/chapter3-start.json"), "hunter");
  await page.locator('[data-command="END_TURN"]').click(); await page.locator('[data-command="ACTIVATE"][data-args*="huntsman-mob-1"]').click();
  await page.locator('#hand [data-card="card-25"]').click(); await page.locator('#slots [data-slot="1"]').click();
  await page.locator('[data-command="COUNTER"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.phase === "combat_react");
  const baseline = await exportSave(page, "normal-combat-before"), expected = fs.readFileSync(path.join(out, "normal-combat-prefix289.json"), "utf8");
  check("three real UI actions reach the original normal command prefix", baseline === expected);
  check("ordinary combat tutorial and empty spacing are absent", await page.locator("#phaseHelp").textContent() === "" && await page.locator("#phaseHelp").evaluate(e => getComputedStyle(e).display) === "none");
  await page.keyboard.press("1"); await page.locator('#slots [data-slot="0"]').click();
  const formula = (await page.locator("#combatSelection").innerText()).replace(/\s+/g, " ");
  check("real dodge calculation remains visible", formula.includes("슬롯 속도 2 + 카드 0 = 회피 속도 2"), { formula });
  check("a sufficient empty slot enables dodge", await page.locator('[data-command="DODGE"]').isEnabled());
  await screenshot(page, "03-normal-combat.png");
  await page.locator('#slots [data-slot="2"]').click();
  check("a slower slot cannot confirm dodge", await page.locator('[data-command="DODGE"]').isDisabled());
  await page.locator('#slots [data-slot="0"]').click(); check("combat selection preserves exact save bytes", await exportSave(page, "normal-combat-selected") === baseline);
  await page.locator('[data-command="DODGE"]').click(); check("confirmed dodge has no repeated tutorial", (await page.locator('[data-command="DODGE"]').innerText()).includes("회피 선택됨") && await page.locator("#phaseHelp").textContent() === "");
  const saved = E.importSave(await exportSave(page, "normal-combat-dodged")); check("real dodge records the normal engine command", saved.combat.dodged && saved.commands.at(-1).type === "DODGE");
  await page.locator('.top-actions [data-panel="guide"]').click();
  await page.locator("#gameHelpContent summary").filter({ hasText: "4. 회피·방해·화기" }).click();
  check("the complete dodge sequence remains in help", (await page.locator("#gameHelpContent").innerText()).includes("카드·슬롯 선택만으로 회피가 적용되지 않습니다"));
  await page.locator("#closeInfo").click(); await page.context().close();
}
async function qaBoundary() {
  const page = await newPage({ width: 2035, height: 1252 });
  await loadSave(page, path.join(out, "qa-12-card-hand.json"), "hunter");
  const before = await exportSave(page, "qa-hand-before"), state = E.importSave(before);
  check("the large-hand case is explicitly QA", !!state.setup.qa && E.hunter(state).hand.length === 12 && await page.locator("#qaModeBadge").isVisible());
  const order = await page.locator("#hand [data-card]").evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { id: n.dataset.card, top: r.top, left: r.left }; }).sort((a, b) => a.top - b.top || a.left - b.left));
  for (let n = 1; n <= 9; n++) { await page.keyboard.press(String(n)); check("QA visual order shortcut " + n, JSON.stringify(await pressed(page)) === JSON.stringify([order[n - 1].id])); }
  const hints = await page.locator("#hand [data-card]").evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.card, shortcut: n.getAttribute("aria-keyshortcuts") })));
  check("cards ten through twelve have no assigned shortcut", order.slice(9).every(card => hints.find(hint => hint.id === card.id).shortcut === null));
  await page.locator("#zoomIn").click(); await page.locator("#zoomIn").click(); await page.locator("#mapViewport").focus(); await page.keyboard.press("0");
  check("0 still resets map zoom without selecting card ten", (await page.locator("#zoomLabel").innerText()) === "100%" && JSON.stringify(await pressed(page)) === JSON.stringify([order[8].id]));
  check("all number choices preserve the QA save bytes", await exportSave(page, "qa-hand-selected") === before);
  await screenshot(page, "04-qa-12-card-boundary.png"); await page.context().close();
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  try {
    await normalStart(); await normalCombat(); await qaBoundary();
    check("no browser page exceptions", report.errors.length === 0, { errors: report.errors });
    report.status = "passed"; report.sourceSha256 = Object.fromEntries(["src/hunt-app.js", "src/hunt-keyboard-controls.js", "styles/hunt.css"].map(f => [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex")]));
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, "failure.png").catch(() => {});
    throw error;
  } finally {
    await browser.close(); fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ status: report.status, checksPassed: report.checks.length, browserVersion: report.browserVersion, failure: report.failure?.message }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
