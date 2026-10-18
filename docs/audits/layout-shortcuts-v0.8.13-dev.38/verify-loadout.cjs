"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine")), D = require(path.join(root, "src/hunt-data"));
const out = path.join(root, "test-results/loadout-dev38"), origin = "http://127.0.0.1:8860";
const sources = ["hunt.html", "styles/hunt-workspace-layout.css", "src/hunt-app.js"];
const hashes = () => Object.fromEntries(sources.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
const report = { version: "0.8.13-dev.38", browser: "installed sandboxed Chrome", origin, isolatedTemporaryProfile: true,
  pageStateInjection: false, userBrowserAttached: false, fixture: "strict normal-campaign E.create and public DREAM/REFILL commands, imported through the official file chooser",
  startedAt: new Date().toISOString(), sourceHashes: hashes(), checks: [], screenshots: [], geometry: [], pageErrors: [] };
let browser;
function check(name, condition, details) {
  assert(condition, name + ": " + JSON.stringify(details));
  // Keep each measured layout once; its checks reference that exact record.
  report.checks.push({ name, passed: true, ...(details?.header && details?.slots ?
    { geometry: report.geometry.at(-1).label } : details === undefined ? {} : { details }) });
}
async function freshPage(fixture) {
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, acceptDownloads: true, serviceWorkers: "block" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.origin === origin || ["blob:", "data:"].includes(u.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.goto(origin + "/hunt.html?v=loadout-dev38", { waitUntil: "networkidle" });
  const pending = page.waitForEvent("filechooser"); await page.locator("#loadSetup").click(); await (await pending).setFiles(fixture);
  await page.waitForFunction(() => document.documentElement.dataset.phase && !document.querySelector("#setupDialog").open);
  return { page, context };
}
async function exported(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const file = path.join(out, name + ".json"); await (await pending).saveAs(file); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(file, "utf8"); assert.equal(E.exportSave(E.importSave(text)), text); return text;
}
async function geometry(page, name, viewport, count) {
  await page.setViewportSize(viewport);
  if (await page.locator("#inspectCurrentTile").isEnabled()) await page.locator("#inspectCurrentTile").click();
  const facts = await page.evaluate(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const one = selector => rect(document.querySelector(selector));
    return { header: one(".weapon-panel-header"), summary: one(".weapon-header-summary"), gun: one("#firearm"), bank: one("#weaponSlotBank"), weapon: one(".weapon-panel"),
      gunButtons: [...document.querySelectorAll("#firearm > button")].map(rect), gunCount: document.querySelectorAll("#firearm").length,
      slots: [...document.querySelectorAll("#slots [data-slot]")].map(rect), totalSlots: document.querySelectorAll("[data-slot]").length,
      gunInHeader: !!document.querySelector(".weapon-panel-header > #firearm"), bankHasGun: !!document.querySelector("#weaponSlotBank #firearm"),
      viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } };
  });
  const label = `${name}-${viewport.width}x${viewport.height}`, first = facts.slots[0]; report.geometry.push({ label, ...facts });
  check(label + " one firearm in title row", facts.gunCount === 1 && facts.gunInHeader && !facts.bankHasGun, facts);
  check(label + " title and firearm do not overlap", facts.summary.right <= facts.gun.x && facts.gun.right <= facts.weapon.right && Math.abs(facts.header.y - facts.gun.y) <= 1, facts);
  check(label + " all slots retain selection ancestor", facts.slots.length === count && facts.totalSlots === count, facts);
  check(label + " all slots have equal y, width and height", facts.slots.every(slot => Math.abs(slot.y-first.y) <= 1 && Math.abs(slot.width-first.width) <= 1 && Math.abs(slot.height-first.height) <= 1), facts);
  check(label + " title row is above all full-size slots", facts.gun.bottom <= first.y + 1 && facts.slots.every(slot => slot.height >= 96 && slot.bottom <= facts.bank.bottom+1), facts);
  check(label + " action fits in gun", facts.gunButtons.length === 1 && facts.gunButtons.every(button => button.bottom <= facts.gun.bottom+1 && button.right <= facts.gun.right+1 && button.x >= facts.gun.x && button.y >= facts.gun.y), facts);
  check(label + " loadout fits viewport", facts.weapon.bottom <= viewport.height && facts.slots.every(slot => slot.bottom <= viewport.height) && facts.document.width <= viewport.width, facts);
  if (count === 3) check(label + " gun aligns with third slot", Math.abs(facts.gun.x-facts.slots[2].x) <= 1 && Math.abs(facts.gun.width-facts.slots[2].width) <= 1, facts);
  const screenshot = label + ".png"; await page.screenshot({ path: path.join(out, screenshot), animations: "disabled" }); report.screenshots.push(screenshot);
}
async function run() {
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  for (const [weapon, face, count] of [["burial", 0, 3], ["kirkhammer", 1, 2], ["stake-driver", 1, 1]]) {
    const state = E.create(90, weapon, face, null, D.weapons[weapon].defaultFirearm, "center", { campaign: true, rulesVersion: 14 }),
      fixture = path.join(out, weapon + "-initial.json");
    fs.writeFileSync(fixture, E.exportSave(state)); const { page, context } = await freshPage(fixture);
    for (const viewport of [{ width: 2035, height: 1252 }, { width: 1714, height: 1252 }, { width: 1280, height: 720 }, { width: 1231, height: 1252 }]) await geometry(page, weapon, viewport, count);
    await context.close();
  }
  for (const [weapon, count] of [["kirkhammer", 2], ["stake-driver", 1]]) {
    let state = E.create(90, weapon, 0, null, D.weapons[weapon].defaultFirearm, "center", { campaign: true, rulesVersion: 14 });
    state = E.dispatch(state, { type: "DREAM", cardId: E.hunter(state).hand[0].id });
    state = E.dispatch(state, { type: "REFILL", discardIds: [] });
    const fixture = path.join(out, weapon + "-return.json"); fs.writeFileSync(fixture, E.exportSave(state));
    const { page, context } = await freshPage(fixture), before = await exported(page, weapon + "-before-preview");
    await page.locator("#returnFace").selectOption("1");
    check(weapon + " preview reflects selected face", (await page.locator("#weaponFace").textContent()) === E.weapon(state).faces[1].name && await page.locator("#slots [data-slot]").count() === count);
    check(weapon + " preview does not spend resources", await exported(page, weapon + "-after-preview") === before);
    await geometry(page, weapon + "-preview", { width: 2035, height: 1252 }, count);
    await page.locator("#returnFace").selectOption("0");
    check(weapon + " preview reverts with exact save", await page.locator("#slots [data-slot]").count() === 3 && await exported(page, weapon + "-reverted-preview") === before);
    await context.close();
  }
  check("no page exceptions", report.pageErrors.length === 0, report.pageErrors);
  report.endingSourceHashes = hashes(); check("source freeze is unchanged", JSON.stringify(report.sourceHashes) === JSON.stringify(report.endingSourceHashes)); report.completedAt = new Date().toISOString();
}
run().then(() => console.log(JSON.stringify({ passed: report.checks.length, screenshots: report.screenshots.length, pageErrors: report.pageErrors, hashes: report.endingSourceHashes })))
  .catch(error => { report.error = error.stack; console.error(error); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2)); });
