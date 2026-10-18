"use strict";
// Installed Chrome in a new temporary browser context. All game states enter
// through the official file chooser; all changes use public UI controls.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { chromium } = require(process.argv[2] || "playwright");
const root = path.resolve(__dirname, "../../.."), E = require(path.join(root, "src/hunt-engine")),
  C = require(path.join(root, "src/hunt-context")), Menu = require(path.join(root, "src/hunt-action-menu")),
  U = require(path.join(root, "src/hunt-map-controls")), M = require(path.join(root, "src/chapter-engine")), G = require(path.join(root, "src/tile-geometry"));
const out = path.join(root, "test-results/hunt-actions-map-dev36"), origin = "http://127.0.0.1:8860";
fs.mkdirSync(out, { recursive: true });
const report = { schema: "hunt-actions-map-browser-v1", version: "0.8.13-dev.36", allowedOrigin: origin,
  browserMode: "installed sandboxed headless Chrome in an isolated temporary profile", userBrowserAttached: false,
  pageStateInjection: false, fixtures: [], checks: [], screenshots: [], pageErrors: [] };
const sourceFiles = ["hunt.html", "src/hunt-app.js", "src/hunt-action-menu.js", "src/hunt-automatic-combat.js", "src/hunt-camera.js", "src/hunt-presentation.js", "src/hunt-map-controls.js", "src/tile-geometry.js", "styles/hunt-action-menu.css", "styles/hunt-map-interaction.css", "styles/hunt-workspace-layout.css"];
report.sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]));
let browser, page, saveIndex = 0;
function check(name, condition, details) { assert(condition, name + (details ? ": " + JSON.stringify(details) : "")); report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); }
async function screenshot(name) { await page.screenshot({ path: path.join(out, name), animations: "disabled" }); report.screenshots.push(name); }
function fixture(name, state, source) {
  const text = E.exportSave(state), file = path.join(out, name + ".json");
  assert.equal(E.exportSave(E.importSave(text)), text); fs.writeFileSync(file, text);
  report.fixtures.push({ name, source, qa: !!state.setup.qa, commands: state.commands.length,
    sha256: crypto.createHash("sha256").update(text).digest("hex") }); return { file, state };
}
function fixtures() {
  const result = { fresh: fixture("normal-fresh", E.create(90, "burial", 0, null, "hunter-pistol", "center", { campaign: true }), "public normal E.create") };
  const source = "tests/fixtures/weapon-campaign-completion/beast-claw-0.json", commands = require(path.join(root, source));
  let state = E.create(90, "beast-claw", 0, null, "hunter-pistol", "center", { campaign: true, rulesVersion: 13 });
  for (let i = 0; i <= 134; i++) {
    if ([4, 17, 134].includes(i)) result[{ 4: "attack", 17: "rotated", 134: "overlap" }[i]] = fixture("normal-prefix-" + i, state, source + " first " + i + " exact public commands");
    if (i < 134) state = E.dispatch(state, commands[i]);
  }
  return result;
}
async function load(f) {
  const setup = await page.locator("#setupDialog").getAttribute("open") !== null;
  if (!setup) await page.locator('.top-actions [data-panel="help"]').click();
  const chooser = page.waitForEvent("filechooser"); await page.locator(setup ? "#loadSetup" : "#load").click();
  await (await chooser).setFiles(f.file);
  await page.waitForFunction(phase => document.documentElement.dataset.phase === phase && !document.querySelector("#setupDialog").open && !document.querySelector("#infoDialog").open, f.state.phase);
  for (let i = 0; i < 3 && await page.locator("#missionUpdateContinue").isVisible(); i++) await page.locator("#missionUpdateContinue").click();
  check("official import accepted " + path.basename(f.file), (await page.locator("#error").textContent()) === "");
}
async function save(label) {
  await page.locator('.top-actions [data-panel="help"]').click(); const pending = page.waitForEvent("download");
  await page.locator("#save").click(); const file = path.join(out, String(++saveIndex).padStart(2, "0") + "-" + label + ".json");
  await (await pending).saveAs(file); await page.locator("#closeInfo").click();
  const text = fs.readFileSync(file, "utf8"), state = E.importSave(text); assert.equal(E.exportSave(state), text); return { text, state };
}
const intent = type => page.locator('#hunterActionBar [data-hunter-intent="' + type + '"]');
async function selected() { return page.locator('#hand [data-card][aria-pressed="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.card)); }
async function chooseEnemy(id) {
  const body = page.locator('#enemyHitLayer [data-enemy="' + id + '"]'); await body.waitFor({ state: "visible" });
  const marker = await page.locator('#chapterMap [data-enemy="' + id + '"]').boundingBox(), hit = await body.boundingBox();
  const bounds = await page.locator("#mapViewport").boundingBox();
  const x = Math.min(bounds.x + bounds.width - 8, Math.max(bounds.x + 8, hit.x + hit.width / 2)),
    y = Math.max(bounds.y + 8, hit.y + Math.min(hit.height * .25, marker.y - hit.y - 5));
  check("sprite head hit extends above the foot marker", y < marker.y && x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height, { marker, hit, x, y });
  await page.mouse.click(x, y); await page.waitForFunction(enemyId => document.querySelector('#enemyHitLayer [data-enemy="' + enemyId + '"]')?.getAttribute("aria-pressed") === "true", id);
  check("clicking the visible sprite body selects its enemy", (await page.locator('#enemyHitLayer [data-enemy="' + id + '"]').getAttribute("aria-pressed")) === "true");
}
async function startingHover() {
  const tile = page.locator("#startPlacement .start-tile");
  const target = await tile.count() ? tile : page.locator(".start-tile").first(), r = await target.boundingBox();
  for (const id of ["left", "center", "right"]) {
    const [x, y] = G.point("tile-14", id); await page.mouse.move(r.x + r.width * x / 100, r.y + r.height * y / 100);
    const style = await page.locator('.start-space[data-start-space="' + id + '"]').evaluate(element => {
      const s = getComputedStyle(element); return { hover: element.matches(":hover"), filter: s.filter, backdrop: s.backdropFilter, opacity: s.opacity, background: s.backgroundColor }; });
    check("starting space hover stays transparent without blur: " + id, style.hover && style.filter === "none" && style.backdrop === "none" && style.opacity === "1" && /^rgba\(/.test(style.background), style);
  }
  await screenshot("01-start-space-hover.png");
}
async function captionLayout(label) {
  const facts = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; },
      intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
      tiles = [...document.querySelectorAll("#chapterMap .tile-cell")], gates = [...document.querySelectorAll("#chapterMap .map-gate")].map(rect);
    return tiles.map(tile => { const art = rect(tile), legend = rect(tile.querySelector(".tile-space-labels"));
      return { tile: tile.dataset.tile, art, legend, labelCount: tile.querySelectorAll("[data-space-label-node]").length,
        touchesGate: gates.some(gate => intersects(legend, gate)), touchesTile: tiles.some(other => intersects(legend, rect(other))) }; });
  });
  check(label + " captions lie completely below the square artwork", facts.length > 0 && facts.every(f => f.labelCount > 0 && f.legend.top >= f.art.bottom + 1), facts);
  check(label + " captions do not overlap a map tile or an entrance button", facts.every(f => !f.touchesGate && !f.touchesTile), facts);
}
async function actionCancellation(f) {
  await load(f); const baseline = await save("cancel-baseline"), enemyId = baseline.state.enemies[0].id;
  check("four action controls are always present", await page.locator("#hunterActionBar [data-hunter-intent]").count() === 4);
  check("attack requires an explicitly selected enemy", await intent("ATTACK").isDisabled());
  check("three ordinary actions accept intent before choosing a hand card", await intent("MOVE").isEnabled() && await intent("DREAM").isEnabled() && await intent("TRANSFORM").isEnabled());
  await chooseEnemy(enemyId);
  check("eligible selected enemy enables attack", await intent("ATTACK").isEnabled());
  check("attack names its selected enemy below the action label", /선택한 적:/.test(await intent("ATTACK").innerText()));
  check("selected enemy exposes its own attack entry", await page.locator('#mapContext [data-hunter-intent="ATTACK"]').isVisible());
  check("attack entry omits the repeated card-and-slot instruction", !/손패|슬롯/.test(await page.locator('#mapContext [data-hunter-intent="ATTACK"]').innerText()));
  const previous = E.hunter(baseline.state).hand[1].id; await page.locator('#hand [data-card="' + previous + '"]').click(); await page.locator('#slots [data-slot="2"]').click();
  for (const type of ["MOVE", "DREAM", "TRANSFORM", "ATTACK"]) {
    await intent(type).click();
    check(type + " opens the action confirmation screen", (await page.locator("#phaseTitle").textContent()) === "행동하기" && (await page.locator("#phaseHelp").textContent()) === "행동하기 위해 소모할 패를 선택해주세요");
    check(type + " cannot commit until a card is selected", await page.locator("#confirmHunterAction").isDisabled() && (await selected()).length === 0);
    const chosen = E.hunter(baseline.state).hand.find(card => Menu.view(baseline.state, E, C, { type, enemyId, cardId: card.id, slot: 2 }).enabled);
    assert(chosen, type + " has a legal card"); await page.locator('#hand [data-card="' + chosen.id + '"]').click();
    check(type + " enables commit after a legal card is selected", await page.locator("#confirmHunterAction").isEnabled());
    if (type === "ATTACK") {
      await page.locator('#slots [data-slot="2"]').click();
      await page.locator('#slots [data-slot="2"]').click();
      check("repeatedly clicking the current attack slot keeps it visibly selected", await page.locator('#slots [data-slot="2"]').getAttribute("aria-pressed") === "true");
      check("repeated slot clicks keep the displayed and committed attack slot aligned", JSON.parse(await page.locator("#confirmHunterAction").getAttribute("data-args")).slot === 2 && await page.locator("#confirmHunterAction").isEnabled());
    }
    if (type === "MOVE") await screenshot("02a-action-confirmation.png");
    await page.locator("#cancelHunterAction").click();
    check(type + " cancellation restores the original selection", JSON.stringify(await selected()) === JSON.stringify([previous]) && await page.locator('#slots [data-slot="2"]').getAttribute("aria-pressed") === "true");
    check(type + " cancellation preserves exact exported save", (await save("cancel-" + type.toLowerCase())).text === baseline.text);
  }
  await page.locator('.top-actions [data-panel="objectives"]').click();
  await page.locator("#infoDialog .hunt-window-minimize").click();
  check("information window is minimized before the action guard check", await page.locator("#infoDialog").getAttribute("data-window-minimized") === "true");
  await intent("MOVE").click();
  check("a minimized information window blocks opening a new action intent", await page.locator("#confirmHunterAction").count() === 0 && (await page.locator("#phaseTitle").textContent()) === "플레이어의 차례");
  await page.locator("#closeInfo").click();
  check("blocked action intent under a minimized window preserves exact save", (await save("minimized-window-intent-blocked")).text === baseline.text);
  await screenshot("02-persistent-actions-selected-enemy.png");
}
async function actionCommit(type, f) {
  await load(f); const before = await save("commit-before-" + type.toLowerCase()), enemyId = before.state.enemies[0]?.id;
  if (type === "ATTACK") await chooseEnemy(enemyId);
  if (type === "MOVE") await captionLayout("central starting lamp");
  await intent(type).click();
  const chosen = E.hunter(before.state).hand.find(card => Menu.view(before.state, E, C, { type, enemyId, cardId: card.id }).enabled);
  assert(chosen); await page.locator('#hand [data-card="' + chosen.id + '"]').click();
  const control = page.locator("#confirmHunterAction"), command = { type: await control.getAttribute("data-command"), ...JSON.parse(await control.getAttribute("data-args")) };
  assert.equal(command.type, type); await control.click();
  const after = await save("commit-after-" + type.toLowerCase()), source = type === "MOVE" ? E.applyMovementDeclarationRuling(before.state) : before.state;
  check(type + " commits the exact canonical public command", after.text === E.exportSave(E.dispatch(source, command)), { command, phase: after.state.phase });
  if (type === "MOVE") {
    check("movement declaration keeps its card until the first step", E.hunter(after.state).hand.some(card => card.id === chosen.id));
    const step = U.movement(after.state).directions.flatMap(direction => direction.options).find(option => option.enabled && option.command?.type === "STEP"); assert(step);
    const target = step.command.node, node = E.node(after.state, target), placed = after.state.world.tiles.find(tile => tile.tileId === node.tile), [x, y] = G.point(node.tile, node.spaceId, placed.rotation),
      bounds = await page.locator('.tile-cell[data-tile="' + node.tile + '"]').boundingBox();
    await page.mouse.click(bounds.x + bounds.width * x / 100, bounds.y + bounds.height * y / 100);
    const moved = await save("map-cell-step");
    check("clicking a legal map space performs exactly STEP", moved.text === E.exportSave(E.dispatch(after.state, step.command)), { target });
    check("the first map step spends exactly the declared card", E.hunter(moved.state).hand.length === E.hunter(before.state).hand.length - 1 && !E.hunter(moved.state).hand.some(card => card.id === chosen.id));
  }
}
async function mapBaselineAndLabels(f) {
  await load(f); const before = await save("map-label-baseline");
  await page.locator("#zoomReset").click();
  const baseline = await page.locator("#chapterMap").evaluate(e => ({ transform: getComputedStyle(e).transform, zoom: getComputedStyle(document.documentElement).zoom }));
  check("100 percent represents map-only 1.44 scale", (await page.locator("#zoomLabel").textContent()) === "100%" && /^matrix\(1\.44,/.test(baseline.transform) && baseline.zoom === "1", baseline);
  await page.locator("#zoomIn").click(); await page.locator("#zoomReset").click();
  check("reset returns to the new map baseline", /^matrix\(1\.44,/.test(await page.locator("#chapterMap").evaluate(e => getComputedStyle(e).transform)));
  const placed = f.state.world.tiles.find(tile => tile.rotation === 2), tile = M.tile(placed.tileId);
  await page.locator('#chapterMap [data-tile-info="' + placed.tileId + '"]').click();
  for (const space of tile.spaces) {
    const selector = '[data-space-label-node="' + placed.tileId + ":" + space.id + '"]', expected = G.spaceLabel(tile, space, placed.rotation);
    const data = await page.locator(selector).evaluate(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(), art = e.closest(".tile-cell").getBoundingClientRect(); return { text: e.textContent, transform: s.transform, top: r.top, bottom: r.bottom, tileTop: art.top, tileBottom: art.bottom }; });
    check("rotated tile legend is upright, below the tile, and screen-relative: " + space.id, data.text === expected && data.transform === "none" && data.top >= data.tileBottom + 1, { expected, ...data });
    await page.locator(selector).click(); check("map and tile information use the same rotated space name: " + space.id, (await page.locator("#tileInfo").innerText()).includes(expected));
  }
  await captionLayout("rotated multi-tile map");
  await page.locator("#inspectCurrentTile").click();
  check("current-location button remains in tile information", await page.locator("#tileInfoPanel #inspectCurrentTile").count() === 1 && await page.locator("#centerMap").count() === 0);
  check("map-only inspection and zoom keep the exact save", (await save("map-label-after")).text === before.text);
  await screenshot("03-map-scale-rotated-labels.png");
}
async function spritePriority(f, dense) {
  await load(f); const before = await save("sprite-before");
  const enemyId = before.state.enemies.find(enemy => E.node(before.state, enemy.node)?.lamp).id;
  await chooseEnemy(enemyId); await page.locator("#clearMapTarget").click();
  check("sprite body inspection preserves exact save", (await save("sprite-body-after")).text === before.text);
  await load(dense); const denseBefore = await save("sprite-dense-before");
  let facts;
  for (const enemy of denseBefore.state.enemies) {
    await page.locator('#chapterMap [data-enemy="' + enemy.id + '"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(id => {
      const marker = document.querySelector('#chapterMap [data-enemy="' + id + '"]')?.getBoundingClientRect(), body = document.querySelector('#enemyHitLayer [data-enemy="' + id + '"]')?.getBoundingClientRect();
      return marker && body && Math.abs((body.x + body.width / 2) - (marker.x + marker.width / 2)) < 100;
    }, enemy.id);
    facts = await page.evaluate(() => {
    const viewport = document.querySelector("#mapViewport").getBoundingClientRect(), objects = [];
    for (const hit of document.querySelectorAll("#enemyHitLayer [data-enemy]")) {
      const h = hit.getBoundingClientRect();
      for (const e of document.querySelectorAll("#chapterMap [data-map-object]")) {
        const r = e.getBoundingClientRect(), overlap = { enemyId: hit.dataset.enemy, kind: e.dataset.mapObject, x: Math.max(h.x, r.x, viewport.x + 2), y: Math.max(h.y, r.y, viewport.y + 2), right: Math.min(h.right, r.right, viewport.right - 2), bottom: Math.min(h.bottom, r.bottom, viewport.bottom - 2) };
        if (overlap.right - overlap.x > 2 && overlap.bottom - overlap.y > 2) objects.push(overlap);
      }
    }
    const overlap = objects[0]; if (overlap) { overlap.x = (overlap.x + overlap.right) / 2; overlap.y = (overlap.y + overlap.bottom) / 2; overlap.topEnemy = document.elementFromPoint(overlap.x, overlap.y)?.closest("[data-enemy]")?.dataset.enemy; }
    return { overlap, objects, layerZ: getComputedStyle(document.querySelector("#enemyHitLayer")).zIndex };
    });
    if (facts.overlap) break;
  }
  check("a real visible sprite overlaps a public map object", !!facts.overlap, facts);
  check("the enemy wins hit testing at the object overlap", facts.overlap.topEnemy === facts.overlap.enemyId, facts);
  await page.mouse.click(facts.overlap.x, facts.overlap.y);
  check("clicking the overlap selects the enemy instead of the object", await page.locator('#enemyHitLayer [data-enemy="' + facts.overlap.enemyId + '"]').getAttribute("aria-pressed") === "true");
  check("sprite and overlap selection preserve exact save", (await save("sprite-after")).text === denseBefore.text);
  await screenshot("04-enemy-sprite-priority.png");
}
async function run() {
  const f = fixtures(); browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true }); report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, acceptDownloads: true, serviceWorkers: "block" });
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.origin === origin || ["data:", "blob:"].includes(u.protocol) ? route.continue() : route.abort(); });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on("pageerror", error => report.pageErrors.push(error.message));
  await page.goto(origin + "/hunt.html?v=0.8.13-dev.36", { waitUntil: "networkidle" });
  check("staged action module is served", await page.locator('script[src*="hunt-action-menu.js"]').count() === 1);
  await startingHover(); await actionCancellation(f.attack);
  for (const type of ["MOVE", "TRANSFORM", "DREAM", "ATTACK"]) await actionCommit(type, type === "ATTACK" ? f.attack : f.fresh);
  await mapBaselineAndLabels(f.rotated); await spritePriority(f.overlap, f.attack);
  check("product source hashes stayed stable during the browser run", sourceFiles.every(file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") === report.sourceHashes[file]));
  check("no unhandled page exceptions", report.pageErrors.length === 0, report.pageErrors);
}
run().then(() => { report.status = "passed"; console.log(JSON.stringify({ status: report.status, checks: report.checks.length, screenshots: report.screenshots })); })
  .catch(async error => { report.status = "failed"; report.failure = error.stack; console.error(error); if (page) await screenshot("failure.png").catch(() => {}); process.exitCode = 1; })
  .finally(async () => { fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2)); await browser?.close(); });
