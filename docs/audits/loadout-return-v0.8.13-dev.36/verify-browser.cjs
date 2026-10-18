"use strict";
// Supply an installed Playwright module path as argv[2]. This isolated browser
// uses ordinary UI imports/downloads and never attaches to a player profile.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine")), out = path.join(root, "test-results/loadout-dev36");
fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:8860", report = { schema: "loadout-return-browser-v1", version: "0.8.13-dev.36",
  origin, isolatedTemporaryProfile: true, userBrowserAttached: false, pageStateInjection: false,
  fixture: "normal E.create(90, kirkhammer, campaign), public DREAM and REFILL commands, loaded through the official file chooser",
  checks: [], screenshots: [], pageErrors: [] };
let browser;
function check(name, condition, details) { assert(condition, name + ": " + JSON.stringify(details)); report.checks.push({ name, passed: true, details }); }
async function exportSave(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const file = path.join(out, name + ".json"); await (await pending).saveAs(file);
  await page.locator("#closeInfo").click(); const text = fs.readFileSync(file, "utf8");
  assert.equal(E.exportSave(E.importSave(text)), text); return text;
}
async function run() {
  let state = E.create(90, "kirkhammer", 0, null, "hunter-pistol", "center", { campaign: true });
  state = E.dispatch(state, { type: "DREAM", cardId: E.hunter(state).hand[0].id });
  state = E.dispatch(state, { type: "REFILL", discardIds: [] }); assert.equal(state.phase, "return");
  const fixture = path.join(out, "normal-dream-return.json"); fs.writeFileSync(fixture, E.exportSave(state));
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true });
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, acceptDownloads: true, serviceWorkers: "block" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.origin === origin || ["blob:", "data:"].includes(u.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.goto(origin + "/hunt.html?v=loadout-dev36", { waitUntil: "networkidle" });
  const pending = page.waitForEvent("filechooser"); await page.locator("#loadSetup").click(); await (await pending).setFiles(fixture);
  await page.waitForFunction(() => document.documentElement.dataset.phase === "return" && !document.querySelector("#setupDialog").open);
  const before = await exportSave(page, "before-preview");
  for (const viewport of [{ width: 2035, height: 1252 }, { width: 1714, height: 1252 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    const facts = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      return { gunCount: document.querySelectorAll("#firearm").length, gun: rect("#firearm"), bank: rect("#weaponSlotBank"), weapon: rect(".weapon-panel"), third: rect('#slots [data-slot="2"]'),
        gunButton: rect('#firearm > button'), deck: rect("#deckStatus"), workspace: rect("#workspaceProgress"), viewport: { width: innerWidth, height: innerHeight }, first: rect('#slots [data-slot="0"]') };
    });
    check("one firearm inside weapon panel at " + viewport.width, facts.gunCount === 1 && facts.gun.x >= facts.weapon.x && facts.gun.right <= facts.weapon.right + 1, facts);
    check("firearm is above slot three at " + viewport.width, Math.abs(facts.gun.x - facts.third.x) <= 1 && facts.gun.bottom <= facts.third.y + 1 && facts.first.right <= facts.gun.x, facts);
    check("firearm and slot three visible at " + viewport.width, facts.third.bottom <= facts.viewport.height && facts.gun.y >= 0 && facts.third.bottom <= facts.bank.bottom + 1, facts);
    check("firearm action button fits inside its panel at " + viewport.width, facts.gunButton.bottom <= facts.gun.bottom + 1 && facts.gunButton.y >= facts.gun.y, facts);
    check("deck receives at least ninety pixels at " + viewport.width, facts.deck.height >= 90 && facts.deck.bottom <= facts.workspace.bottom + 1, facts);
    const screenshot = "layout-" + viewport.width + ".png"; await page.screenshot({ path: path.join(out, screenshot), animations: "disabled" }); report.screenshots.push(screenshot);
  }
  await page.setViewportSize({ width: 2035, height: 1252 });
  await page.locator("#returnFace").selectOption("1");
  check("return picklist changes lower face immediately", (await page.locator("#weaponFace").textContent()) === E.weapon(state).faces[1].name);
  check("return preview shows only two current slots", await page.locator("#slots [data-slot]").count() === 2);
  check("return preview displays actual weapon effect", (await page.locator("#weaponAbility").textContent()) === E.weapon(state).faces[1].text);
  check("return preview does not change save", await exportSave(page, "after-preview") === before);
  await page.screenshot({ path: path.join(out, "return-preview.png"), animations: "disabled" }); report.screenshots.push("return-preview.png");
  await page.locator("#returnFace").selectOption("0");
  check("return preview reverts without cost", (await page.locator("#weaponFace").textContent()) === E.weapon(state).faces[0].name && await exportSave(page, "reverted-preview") === before);
  check("no page exceptions", report.pageErrors.length === 0, report.pageErrors);
}
run().then(() => { fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.checks.length, screenshots: report.screenshots, pageErrors: report.pageErrors })); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
