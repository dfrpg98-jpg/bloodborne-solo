"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine"));
const origin = "http://127.0.0.1:8860", out = path.join(root, "test-results/numpad-dev35"); fs.mkdirSync(out, { recursive: true });
const report = { version: "0.8.13-dev.35", date: "2026-10-18", method: "isolated sandboxed temporary Chrome context; public Playwright keyboard and CDP input",
  userBrowserAttached: false, userSaveModified: false, pageStateInjection: false, numLockOnBrowserVerified: false,
  numLockOnScope: "DOM controller tests only; Chrome input protocol cannot set the NumLock modifier", checks: [], screenshots: [], pageExceptions: [] };
let browser, page;
function check(name, condition, details) { assert(condition, name); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
async function screenshot(name) { await page.screenshot({ path: path.join(out, name), animations: "disabled" }); report.screenshots.push("test-results/numpad-dev35/" + name); }
async function load(file, phase) {
  const setup = await page.locator("#setupDialog").getAttribute("open") !== null;
  if (!setup) await page.locator('.top-actions [data-panel="help"]').click();
  const chooser = page.waitForEvent("filechooser"); await page.locator(setup ? "#loadSetup" : "#load").click(); await (await chooser).setFiles(path.join(root, file));
  await page.waitForFunction(p => document.documentElement.dataset.phase === p && !document.querySelector("#setupDialog").open, phase);
}
async function save(name) {
  await page.locator('.top-actions [data-panel="help"]').click(); const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const target = path.join(out, name + ".json"); await (await pending).saveAs(target); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(target, "utf8"); assert.equal(E.exportSave(E.importSave(text)), text); return text;
}
async function selected() { return page.locator('#hand [data-card][aria-pressed="true"]').evaluateAll(nodes => nodes.map(n => n.dataset.card)); }
async function offDigit(cdp, digit) {
  // Browser-trusted numeric/keypad input with NumLock OFF. This intentionally
  // cannot stand in for hardware NumLock ON, which CDP does not expose.
  const event = { key: String(digit), code: "Numpad" + digit, windowsVirtualKeyCode: 96 + digit, nativeVirtualKeyCode: 96 + digit, location: 3, isKeypad: true, modifiers: 0 };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...event }); await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  try {
    const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, serviceWorkers: "block", acceptDownloads: true });
    await context.route("**/*", route => { const url = new URL(route.request().url()); return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? route.continue() : route.abort(); });
    page = await context.newPage(); page.setDefaultTimeout(10000); page.on("pageerror", e => report.pageExceptions.push(e.message));
    const cdp = await context.newCDPSession(page);
    await page.goto(origin + "/hunt.html?v=0.8.13-dev.35", { waitUntil: "networkidle" });
    check("latest keyboard controller is served", await page.locator('script[src*="hunt-keyboard-controls.js?v=0.8.13-dev.35"]').count() === 1);
    await load("test-results/hand-focus-dev33/real-browser/fresh-normal-before.json", "hunter");
    const before = await save("hunter-before"), initial = E.importSave(before), cards = E.hunter(initial).hand;
    await page.keyboard.press("2"); check("top-row 2 selects the second hand card", JSON.stringify(await selected()) === JSON.stringify([cards[1].id]));
    for (let digit = 1; digit <= 9; digit++) {
      await page.keyboard.press("Numpad" + digit);
      check("NumLock-off navigation keypad never selects hand " + digit, JSON.stringify(await selected()) === JSON.stringify([cards[1].id]));
      await offDigit(cdp, digit);
      check("NumLock-off numeric keypad never selects hand or declares movement " + digit, JSON.stringify(await selected()) === JSON.stringify([cards[1].id]) && await page.locator("html").getAttribute("data-phase") === "hunter");
    }
    check("all blocked keypad input preserves exact hunter save", await save("hunter-off-keypad") === before);
    check("movement hint uses arrows and number pad without WASD", (await page.locator(".movement-shortcuts").innerText()) === "M 이동·마치기 · 방향키/숫자패드");
    await page.keyboard.press("1"); check("top-row 1 still independently selects its hand card", JSON.stringify(await selected()) === JSON.stringify([cards[0].id]));
    await screenshot("01-number-row-and-pad-hint.png");
    for (const viewport of [{ width: 1714, height: 1252 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.locator(".movement-shortcuts").evaluate(e => { const panel = e.closest(".movement-panel"), r = e.getBoundingClientRect(), p = panel.getBoundingClientRect();
        return { width: e.clientWidth, scroll: e.scrollWidth, inside: r.bottom <= p.bottom && r.left >= p.left && r.right <= p.right }; });
      check("movement hint fits the panel at " + viewport.width, layout.scroll <= layout.width + 1 && layout.inside, layout);
      await screenshot("hint-" + viewport.width + ".png");
    }
    await page.setViewportSize({ width: 2035, height: 1252 });
    await page.keyboard.press("m"); const movingText = await save("cardinal-before"), moving = E.importSave(movingText);
    for (const key of ["w", "A", "s", "D", "Numpad8", "Numpad6", "Numpad2", "Numpad4"]) await page.keyboard.press(key);
    for (let digit = 1; digit <= 9; digit++) await offDigit(cdp, digit);
    check("WASD and NumLock-off keypad cannot move or finish", await save("cardinal-blocked-keys") === movingText);
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("m");
    const expected = E.dispatch(E.dispatch(moving, { type: "STEP", node: "tile-14:right" }), { type: "STOP_MOVE" });
    check("enabled arrow movement and M finish retain exact command results", await save("cardinal-after") === E.exportSave(expected));
    await load("test-results/space-diagonal-dev34/normal-tile17-top-r0.json", "move");
    const diagonalText = await save("diagonal-before"), diagonalState = E.importSave(diagonalText);
    const mapping = { N: "ArrowUp Numpad8", E: "ArrowRight Numpad6", S: "ArrowDown Numpad2", W: "ArrowLeft Numpad4", NW: "Numpad7", NE: "Numpad9", SW: "Numpad1", SE: "Numpad3" };
    for (const [edge, keys] of Object.entries(mapping)) check("pad shortcut metadata " + edge, await page.locator('[data-move-direction="' + edge + '"]').getAttribute("aria-keyshortcuts") === keys);
    for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "w", "a", "s", "d"]) await page.keyboard.press(key);
    await offDigit(cdp, 1); await offDigit(cdp, 3);
    check("disabled arrows, removed WASD and NumLock-off diagonal keys preserve state", await save("diagonal-blocked-keys") === diagonalText);
    await screenshot("02-diagonal-keypad-hints.png");
    await page.locator('[data-move-direction="SW"]').click();
    check("diagonal mouse button still uses original STEP", await save("diagonal-after") === E.exportSave(E.dispatch(diagonalState, { type: "STEP", node: "tile-17:lower-left" })));
    await page.locator('.top-actions [data-panel="guide"]').click();
    await page.locator("#gameHelpContent summary").filter({ hasText: "2. 이동과 탐험" }).click();
    const help = await page.locator("#gameHelpContent").innerText();
    check("visible help explains NumLock layout and 5 declaration only", help.includes("7·8·9는 ↖·↑·↗, 4·6은 ←·→, 1·2·3은 ↙·↓·↘") && help.includes("숫자패드 5는 이동 선언에만 쓰며 이동을 마치지 않습니다"));
    check("visible help separates hand selection and removes WASD", help.includes("오른쪽 숫자패드는 손패 선택에 쓰지 않습니다") && !help.includes("WASD"));
    await screenshot("03-keypad-help.png"); await page.locator("#closeInfo").click();
    await load("test-results/space-diagonal-dev34/normal-refill.json", "refill");
    const refill = E.importSave(await save("refill-before")); await page.locator("#phaseTitle").focus(); await page.keyboard.press("Space");
    check("Space refill remains correct after keyboard separation", await save("refill-after") === E.exportSave(E.dispatch(refill, { type: "REFILL", discardIds: [] })));
    check("no page exceptions", report.pageExceptions.length === 0);
    report.status = "passed"; report.sourceSha256 = Object.fromEntries(["src/hunt-keyboard-controls.js", "src/game-help.js", "hunt.html"].map(f => [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex")]));
  } catch (error) { report.status = "failed"; report.failure = error.message; if (page && !page.isClosed()) await screenshot("failure.png").catch(() => {}); throw error;
  } finally { await browser.close(); fs.writeFileSync(path.join(out, "real-browser.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ status: report.status, checksPassed: report.checks.length, numLockOnBrowserVerified: false, failure: report.failure })); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
