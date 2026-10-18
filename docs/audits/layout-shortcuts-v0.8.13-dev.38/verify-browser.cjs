"use strict";
// Isolated installed Chrome, real keyboard events and official save imports /
// downloads. Page evaluation only reads rendered DOM geometry and styles.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright"), root = path.resolve(__dirname, "../../.."),
  E = require(path.join(root, "src/hunt-engine")), Auto = require(path.join(root, "src/hunt-automatic-combat"));
const origin = "http://127.0.0.1:8860", out = path.join(root, "test-results/layout-shortcuts-dev38");
fs.mkdirSync(out, { recursive: true });
const sources = ["hunt.html", "src/hunt-app.js", "src/hunt-keyboard-controls.js", "src/inventory.js", "styles/hunt.css", "styles/hunt-workspace-layout.css", "styles/hunt-workspace-tabs.css"],
  hashes = () => Object.fromEntries(sources.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
const report = { schema: "layout-shortcuts-real-browser-v1", version: "0.8.13-dev.38", origin, sourceHashes: hashes(),
  browserMode: "separate installed headless Chrome, temporary contexts, Chromium sandbox enabled", userBrowserAttached: false,
  userSaveModified: false, pageStateInjection: false, checks: [], fixtures: [], downloads: [], screenshots: [], pageErrors: [] };
let browser, currentPage, serial = 0;
function check(name, condition, details) { assert(condition, name + ": " + JSON.stringify(details)); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
function adopted(state) {
  for (const name of ["applyChapelRuling", "applyCombatReactionRuling", "applyTileSpeedRuling", "applyLeapMoveRuling"]) state = E[name]?.(state) || state;
  return state;
}
function reference(state, command) {
  if (command.type === "MOVE") state = E.applyMovementDeclarationRuling(state);
  state = E.dispatch(state, command);
  for (let index = 0; index < 12; index++) { const next = Auto.nextCommand(state, E); if (!next) break; state = E.dispatch(state, next); }
  return E.applyLeapMoveRuling(E.applyTileSpeedRuling(state));
}
const initial = () => E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
const trace = require(path.join(root, "tests/fixtures/weapon-campaign-completion/beast-claw-0.json"));
const checkpoint = count => trace.slice(0, count).reduce((state, command) => E.dispatch(state, command), initial());
const intent = (page, type) => page.locator('#hunterActionBar [data-hunter-intent="' + type + '"]');
const commandFor = async button => ({ type: await button.getAttribute("data-command"), ...JSON.parse(await button.getAttribute("data-args") || "{}") });
async function shot(page, name) { await page.screenshot({ path: path.join(out, name + ".png"), animations: "disabled" }); report.screenshots.push(name + ".png"); }
async function feedback(page) {
  for (let index = 0; index < 8; index++) {
    if (await page.locator("#missionUpdateContinue").isVisible()) await page.locator("#missionUpdateContinue").click();
    else if (await page.locator("#deathContinue").isVisible()) await page.locator("#deathContinue").click(); else break;
  }
}
async function pageFor(name, state) {
  const fixture = path.join(out, name + "-input.json"), text = E.exportSave(state);
  assert.equal(E.exportSave(E.importSave(text)), text); fs.writeFileSync(fixture, text);
  report.fixtures.push({ name, qa: !!state.setup.qa, campaign: !!state.setup.campaign, seed: state.seed, commands: state.commands.length,
    phase: state.phase, sha256: crypto.createHash("sha256").update(text).digest("hex") });
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, acceptDownloads: true, serviceWorkers: "block" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.origin === origin || ["data:", "blob:"].includes(u.protocol) ? route.continue() : route.abort(); });
  const page = await context.newPage(); currentPage = page; page.setDefaultTimeout(30000);
  page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.38", { waitUntil: "networkidle" });
  const chooser = page.waitForEvent("filechooser"); chooser.catch(() => {}); await page.locator("#loadSetup").click(); await (await chooser).setFiles(fixture);
  await page.waitForFunction(phase => document.documentElement.dataset.phase === phase && !document.querySelector("#setupDialog").open, state.phase);
  await feedback(page); const before = await downloaded(page, name + "-baseline");
  check(name + " official import matches strict adopted public recipe", before.text === E.exportSave(adopted(state)));
  return { page, state: before.state, text: before.text };
}
async function downloaded(page, name) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const pending = page.waitForEvent("download"); await page.locator("#save").click();
  const file = String(++serial).padStart(3, "0") + "-" + name + ".json"; await (await pending).saveAs(path.join(out, file)); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(path.join(out, file), "utf8"), state = E.importSave(text); assert.equal(E.exportSave(state), text); report.downloads.push(file); return { state, text };
}
async function matches(page, name, expected) {
  await feedback(page); const actual = await downloaded(page, name);
  check(name + " matches clicked reducer command byte-exact", actual.text === E.exportSave(expected), { phase: actual.state.phase, last: actual.state.commands.slice(-3) }); return actual;
}
async function hint(page, selector, keys, label) {
  await page.locator(selector + ' [data-action-shortcut]:not([hidden]),' + selector + ' [data-refill-shortcut]:not([hidden])').first().waitFor({ state: "visible" });
  const facts = await page.locator(selector).evaluate(button => {
    const kbd = [...button.querySelectorAll("kbd")].find(element => !element.hidden), r = kbd.getBoundingClientRect(), b = button.getBoundingClientRect(), s = getComputedStyle(kbd),
      node = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()), range = document.createRange();
    if (node) range.selectNode(node); const text = node && range.getBoundingClientRect();
    return { label: kbd.textContent, keys: button.getAttribute("aria-keyshortcuts"), display: s.display, font: s.fontSize,
      border: s.borderTopWidth, y: r.y, textBottom: text?.bottom, bottom: r.bottom, buttonBottom: b.bottom, width: r.width, buttonWidth: b.width };
  });
  check(label + " has small shortcut below main label", facts.keys === keys && facts.display === "block" && parseFloat(facts.font) <= 10 && parseFloat(facts.border) === 0 && facts.y >= facts.textBottom && facts.bottom <= facts.buttonBottom, facts);
}
async function stagedActions() {
  for (const type of ["MOVE", "TRANSFORM", "DREAM", "ATTACK"]) {
    const state = type === "ATTACK" ? E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: false, rulesVersion: 14, practiceTarget: "male-beast-patient", practiceSide: "b" }) : initial(),
      f = await pageFor("staged-" + type, state), page = f.page;
    if (type === "ATTACK") await page.locator('#chapterMap [data-enemy="' + state.enemies[0].id + '"]').first().click();
    await intent(page, type).click(); check(type + " pending confirm starts disabled", await page.locator("#confirmHunterAction").isDisabled());
    await hint(page, "#confirmHunterAction", "Space", type + " disabled confirm");
    await hint(page, "#cancelHunterAction", "Escape Backspace", type + " cancel");
    await page.keyboard.press("Space"); check(type + " disabled Space cannot fall through or spend a card", (await downloaded(page, type + "-disabled-space")).text === f.text);
    await page.keyboard.press("1"); check(type + " top-row card enables confirmation", await page.locator("#confirmHunterAction").isEnabled());
    const command = await commandFor(page.locator("#confirmHunterAction")), expected = reference(f.state, command);
    await page.locator("#confirmHunterAction").focus(); await shot(page, type + "-space-hint");
    await page.keyboard.down("Space"); await page.keyboard.down("Space"); await page.keyboard.up("Space");
    await matches(page, type + "-space-one-command", expected); await page.context().close();
  }
}
async function cancellations() {
  for (const key of ["Escape", "Backspace"]) {
    const f = await pageFor("cancel-" + key, initial()), page = f.page, card = E.hunter(f.state).hand[1].id;
    await page.keyboard.press("2"); await intent(page, "TRANSFORM").click(); await page.keyboard.press("1"); await page.keyboard.press(key);
    check(key + " cancels intent and restores original selected card", await page.locator("#confirmHunterAction").count() === 0 && await page.locator('#hand [data-card="' + card + '"]').getAttribute("aria-pressed") === "true");
    check(key + " cancellation leaves exact persistent save", (await downloaded(page, "cancel-" + key)).text === f.text);
    await page.context().close();
  }
}
async function phaseActions() {
  const map = require(path.join(root, "tests/fixtures/map-preview-dev38-recipes.json")).cases.find(value => value.id === "tile-07"), setup = map.setup;
  let placing = E.create(setup.seed, setup.weaponId, setup.face, setup.startingConsumable, setup.firearmId, setup.startSpace, setup.options);
  for (const command of map.commands) placing = E.dispatch(placing, command);
  for (const [name, state, selector] of [["end-turn", initial(), '#decisionActions [data-command="END_TURN"]'],
    ["stop-move", checkpoint(3), '#decisionActions [data-command="STOP_MOVE"]'], ["refill", checkpoint(7), "#refill"],
    ["place-tile", placing, '#decisions [data-command="PLACE_TILE"]']]) {
    const f = await pageFor(name, state), page = f.page, button = page.locator(selector + ":enabled").first(), command = name === "refill" ? { type: "REFILL", discardIds: [] } : await commandFor(button);
    await hint(page, selector, "Space", name); await shot(page, name + "-hint");
    // The second real keydown is a held-key repeat. Keyup must not natively
    // activate the next phase's newly rendered control either.
    await button.focus(); await page.keyboard.down("Space"); await page.keyboard.down("Space"); await page.keyboard.up("Space");
    await matches(page, name + "-held-space-one-action", reference(f.state, command)); await page.context().close();
  }
  const declared = E.dispatch(E.applyMovementDeclarationRuling(initial()), { type: "MOVE", cardId: E.hunter(initial()).hand[0].id }), f = await pageFor("cancel-unspent-move", declared);
  await f.page.keyboard.press("Space"); check("unspent declaration Space cannot skip the required first step", (await downloaded(f.page, "unspent-space")).text === f.text);
  await f.page.keyboard.press("Backspace"); await matches(f.page, "unspent-backspace", reference(f.state, { type: "CANCEL_MOVE" })); await f.page.context().close();
}
async function guards() {
  let f = await pageFor("window-guards", initial()), page = f.page;
  await intent(page, "TRANSFORM").click(); await page.keyboard.press("1");
  await page.locator('.top-actions [data-panel="help"]').click(); await page.locator('#infoDialog .info-tabs [data-panel="guide"]').focus(); await page.keyboard.press("Space");
  check("open info window leaves pending background action intact", await page.locator("#infoDialog").isVisible() && await page.locator("#confirmHunterAction").count() === 1);
  await page.keyboard.press("Escape"); check("Escape keeps original window minimization behavior", await page.locator("#infoDialog").getAttribute("data-window-minimized") === "true");
  await page.locator("#confirmHunterAction").focus(); await page.keyboard.press("Space"); await page.keyboard.press("Backspace"); await page.keyboard.press("Escape");
  check("minimized window blocks confirm and both cancellation shortcuts", await page.locator("#confirmHunterAction").count() === 1 && await page.locator("#infoDialog").getAttribute("data-window-minimized") === "true");
  check("open and minimized window guards preserve exact save", (await downloaded(page, "window-guards")).text === f.text); await page.context().close();
  f = await pageFor("editing-guard", checkpoint(7)); page = f.page;
  const input = page.locator('#decisions input[data-refill]').first(); await input.focus(); const checked = await input.isChecked(); await page.keyboard.press("Space");
  check("Space on editable refill checkbox keeps native editing", await input.isChecked() !== checked && await page.locator("#refill").isVisible());
  check("editing checkbox does not run REFILL", (await downloaded(page, "editing-space")).text === f.text); await page.context().close();
}
async function combat() {
  const f = await pageFor("combat-response", checkpoint(6)), page = f.page;
  await page.keyboard.press("Space"); check("Space cannot skip an unselected combat response", (await downloaded(page, "combat-unselected-space")).text === f.text);
  const card = E.hunter(f.state).hand.find(card => E.canDodge(f.state, card.id, 0)); assert(card);
  await page.locator('#hand [data-card="' + card.id + '"]').click(); await page.locator('#slots [data-slot="0"]').click();
  const dodge = page.locator('#decisionActions [data-command="DODGE"]'); check("legal selected card and slot enable dodge", await dodge.isEnabled());
  await hint(page, '#decisionActions [data-command="DODGE"]', "Space", "selected combat dodge");
  const command = await commandFor(dodge), expected = reference(f.state, command); await page.keyboard.down("Space"); await page.keyboard.down("Space"); await page.keyboard.up("Space");
  await matches(page, "combat-selected-dodge-once", expected);
  const resolve = page.locator('#decisionActions [data-command="RESOLVE"]'); await resolve.focus(); await hint(page, '#decisionActions [data-command="RESOLVE"]', "Space", "focused combat resolution");
  await shot(page, "combat-focused-response"); await page.keyboard.press("Space"); await matches(page, "combat-focused-resolve", reference(expected, { type: "RESOLVE" })); await page.context().close();
}
async function nativeFallbacks() {
  let f = await pageFor("native-combat-guards", checkpoint(6)), page = f.page;
  const selection = () => page.locator("#hand [data-card],#slots [data-slot]").evaluateAll(elements => elements.map(element => ({
    card: element.dataset.card, slot: element.dataset.slot, pressed: element.getAttribute("aria-pressed"), selected: element.classList.contains("selected") })));
  await page.locator("#phaseTitle").click(); const untouched = await selection(); await page.keyboard.press("Space");
  check("body-focused unselected combat Space preserves all selection state", JSON.stringify(await selection()) === JSON.stringify(untouched));
  const card = page.locator('#hand [data-card="card-1"]'); await card.focus();
  await page.keyboard.down("Space"); check("focused unselected hand Space keydown preserves selection", JSON.stringify(await selection()) === JSON.stringify(untouched));
  await page.keyboard.up("Space"); check("focused unselected hand Space keyup cannot natively choose a card", JSON.stringify(await selection()) === JSON.stringify(untouched));
  await card.click(); const selected = await selection(); await card.focus(); await page.keyboard.press("Space");
  check("focused selected hand Space cannot natively deselect it while no slot is selected", JSON.stringify(await selection()) === JSON.stringify(selected));
  check("native combat guard records no game command", (await downloaded(page, "native-combat-guards")).text === f.text); await page.context().close();
  f = await pageFor("native-modifier-guards", initial()); page = f.page;
  await intent(page, "TRANSFORM").click(); await page.keyboard.press("1"); await page.locator("#confirmHunterAction").focus(); await page.keyboard.press("Shift+Space");
  check("Shift+Space cannot natively confirm a focused pending action", await page.locator("#confirmHunterAction").count() === 1 && (await downloaded(page, "shift-pending-confirm")).text === f.text);
  await page.keyboard.press("Escape"); await page.locator('#decisionActions [data-command="END_TURN"]').focus(); await page.keyboard.press("Shift+Space");
  check("Shift+Space cannot natively end a turn from its focused button", await page.locator("html").getAttribute("data-phase") === "hunter" && (await downloaded(page, "shift-end-turn")).text === f.text);
  await page.context().close();
}
async function inventoryAndTrack() {
  const state = E.create(90, "burial", 0, "antidote", "hunter-pistol", "center", { campaign: true, rulesVersion: 14 }), f = await pageFor("inventory-track", state), page = f.page;
  for (const viewport of [{ width: 2035, height: 1252 }, { width: 1714, height: 1252 }, { width: 1280, height: 720 }, { width: 1231, height: 1252 }]) {
    await page.setViewportSize(viewport); await page.locator("#workspaceInventoryTab").click();
    const inventory = await page.locator("#workspaceInventory").evaluate(element => {
      const r = element.getBoundingClientRect(), heading = element.querySelector(".panel-heading").getBoundingClientRect(), style = getComputedStyle(element);
      return { y: r.y, headingY: heading.y, margin: style.marginTop, count: document.querySelector("#itemCount").textContent };
    });
    await shot(page, "inventory-" + viewport.width); await page.locator("#workspaceRewardsTab").click();
    const rewards = await page.locator("#rewardsPanel").evaluate(element => ({ y: element.getBoundingClientRect().y, headingY: element.querySelector(".panel-heading").getBoundingClientRect().y }));
    check(viewport.width + " inventory starts at same height as rewards", Math.abs(inventory.y-rewards.y) <= 1 && Math.abs(inventory.headingY-rewards.headingY) <= 1 && parseFloat(inventory.margin) === 0, { inventory, rewards });
    check(viewport.width + " inventory count only shows held card count", inventory.count === "1장", inventory);
    const track = await page.locator(".track-caption").evaluate(element => { const r = element.getBoundingClientRect(), label = element.querySelector("span"), lr = label.getBoundingClientRect(), style = getComputedStyle(element);
      return { font: style.fontSize, padding: style.paddingRight, title: label.title, labelRight: lr.right, right: r.right, visible: r.height > 0, width: r.width }; });
    check(viewport.width + " track reset explanation fits with larger text and right inset", track.visible && parseFloat(track.font) === 11 && parseFloat(track.padding) === 12 && track.right-track.labelRight >= 11 && /지도 초기화 시 적과 소모품을 복원/.test(track.title), track);
    await page.locator("#workspaceProgressTab").click();
  }
  check("inventory and track inspections spend nothing", (await downloaded(page, "inventory-track-completed")).text === f.text); await page.context().close();
}
async function run() {
  browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  const selected = new Set(process.argv.slice(3));
  for (const [name, run] of Object.entries({ staged: stagedActions, cancel: cancellations, phases: phaseActions, guards, combat, native: nativeFallbacks, inventory: inventoryAndTrack }))
    if (!selected.size || selected.has(name)) await run();
  check("no page exceptions", report.pageErrors.length === 0, report.pageErrors); report.endingSourceHashes = hashes();
  check("source freeze unchanged throughout actual browser run", JSON.stringify(report.sourceHashes) === JSON.stringify(report.endingSourceHashes));
}
run().then(() => console.log(JSON.stringify({ passed: report.checks.length, screenshots: report.screenshots.length, fixtures: report.fixtures.length, pageErrors: report.pageErrors, hashes: report.endingSourceHashes })))
  .catch(async error => { report.error = error.stack; console.error(error); if (currentPage && !currentPage.isClosed()) await shot(currentPage, "failure").catch(() => {}); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2)); });
