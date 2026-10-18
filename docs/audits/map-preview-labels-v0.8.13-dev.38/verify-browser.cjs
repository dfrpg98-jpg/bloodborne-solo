"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"),
  crypto = require("node:crypto"), { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../.."), out = path.join(root, "test-results/map-preview-dev38/browser"),
  origin = process.env.BB_PREVIEW_ORIGIN || "http://127.0.0.1:8860",
  { chromium } = require(process.env.BB_PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")),
  E = require(path.join(root, "src/hunt-engine")), M = require(path.join(root, "src/chapter-engine")),
  G = require(path.join(root, "src/tile-geometry")),
  recipes = require(path.join(root, "tests/fixtures/map-preview-dev38-recipes.json"));
const trackedReport = path.join(__dirname, "verification.json"),
  sourceFiles = ["hunt.html", "src/hunt-app.js", "src/tile-geometry.js", "styles/chapter.css", "styles/hunt.css",
    "styles/hunt-map-interaction.css", "styles/hunt-workspace-layout.css"],
  report = { schema: 1, timestamp: new Date().toISOString(), browserVersion: null,
    server: { origin, managedOutsideRunner: true }, httpImages: [], fileImages: [],
    normalPreviews: [], labelComponents: [], errors: [] };
const sha = text => crypto.createHash("sha256").update(text).digest("hex"),
  hashes = () => Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
function reached(recipe) {
  const p = recipe.setup;
  let state = E.create(p.seed, p.weaponId, p.face, p.startingConsumable, p.firearmId, p.startSpace, p.options);
  for (const command of recipe.commands) state = E.dispatch(state, command);
  assert.equal(state.world.pending.tileId, recipe.id); assert.equal(state.setup.qa, undefined);
  assert.deepEqual(E.importSave(E.exportSave(state)), state); return state;
}
function contains(polygon, x, y) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index], [xj, yj] = polygon[previous];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function gallery(size) {
  const cells = Object.keys(G.tiles).flatMap(tileId => [0, 1, 2, 3].map(rotation => {
    const labels = M.tile(tileId).spaces.map(space => {
      const p = G.labelPlacement(tileId, space.id, rotation),
        top = p.gateClearance ? `min(${p.y}%, calc(95% - ${p.gateClearance}px))` : `${p.y}%`,
        left = p.horizontalOffset ? `calc(${p.x}% ${p.horizontalOffset > 0 ? "+" : "-"} ${Math.abs(p.horizontalOffset)}px)` : `${p.x}%`,
        width = p.widthClearance ? `calc(${p.width}% - ${p.widthClearance}px)` : `${p.width}%`;
      return `<button type="button" data-label-space="${space.id}" style="left:${left};top:${top};max-width:${width}">${escape(G.spaceLabel(M.tile(tileId), space, rotation))}</button>`;
    }).join(""), gates = G.definition(tileId).exits.map(gate => {
      const [x, y] = G.rotatePoint(gate.point, rotation);
      return `<button type="button" class="map-gate" data-gate-space="${gate.spaceId}" style="left:${Math.max(5, Math.min(95, x))}%;top:${Math.max(5, Math.min(95, y))}%">↑</button>`;
    }).join("");
    return `<div class="tile-cell" data-gallery-tile="${tileId}" data-rotation="${rotation}"><img class="tile-diagram" src="${G.mapImage(tileId)}" style="transform:rotate(${rotation * 90}deg)" alt=""><div class="tile-space-labels">${labels}</div>${gates}</div>`;
  })).join("");
  return `<!doctype html><html><head><base href="${origin}/"><meta charset="utf-8"><link rel="stylesheet" href="styles/style.css"><link rel="stylesheet" href="styles/chapter.css"><link rel="stylesheet" href="styles/hunt.css"><link rel="stylesheet" href="styles/hunt-map-interaction.css"><style>body{display:block}.hunt-main .chapter-map{position:relative;grid-template-columns:repeat(4,${size}px);--map-tile-size:${size}px;transform:scale(1.44);transform-origin:0 0}</style></head><body class="hunt-screen"><main class="hunt-main"><div class="chapter-map">${cells}</div></main></body></html>`;
}
async function labels(page, size) {
  await page.setContent(gallery(size)); await page.locator(".tile-space-labels button").last().waitFor();
  await page.locator("img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const result = await page.locator("[data-gallery-tile]").evaluateAll(tiles => tiles.map(tile => {
    const t = tile.getBoundingClientRect(), scale = t.width / tile.offsetWidth,
      x = t.left + tile.clientLeft * scale, y = t.top + tile.clientTop * scale,
      width = tile.clientWidth * scale, height = tile.clientHeight * scale,
      box = element => { const b = element.getBoundingClientRect(); return {
        left: (b.left - x) / width * 100, right: (b.right - x) / width * 100,
        top: (b.top - y) / height * 100, bottom: (b.bottom - y) / height * 100 }; };
    return { tileId: tile.dataset.galleryTile, rotation: Number(tile.dataset.rotation),
      captions: [...tile.querySelectorAll("[data-label-space]")].map(label => ({ space: label.dataset.labelSpace,
        text: label.textContent, transform: getComputedStyle(label).transform, ...box(label) })),
      gates: [...tile.querySelectorAll("[data-gate-space]")].map(gate => ({ space: gate.dataset.gateSpace, ...box(gate) })) };
  }));
  let captionCount = 0;
  for (const tile of result) for (const label of tile.captions) {
    const polygon = G.polygon(tile.tileId, label.space, tile.rotation),
      corners = [[label.left, label.top], [label.right, label.top], [label.left, label.bottom], [label.right, label.bottom]];
    assert(corners.every(([x, y]) => contains(polygon, x, y)), `caption outside own space: ${tile.tileId}/${tile.rotation}/${label.space}/${size}`);
    assert.match(label.transform, /^matrix\(1, 0, 0, 1,/, "caption text stays upright");
    for (const gate of tile.gates) assert(!(label.left < gate.right && label.right > gate.left && label.top < gate.bottom && label.bottom > gate.top),
      `caption overlaps entrance: ${tile.tileId}/${tile.rotation}/${label.space}/${size}`);
    captionCount++;
  }
  return { tileSize: size, zoom: 1.44, combinations: result.length, captionCount, boundsAndEntrances: "passed", uprightText: "passed" };
}
async function downloadState(page) {
  await page.locator('.top-actions [data-panel="help"]').click();
  const [downloaded] = await Promise.all([page.waitForEvent("download"), page.locator("#save").click()]),
    file = path.join(out, "last-public-export.json");
  await downloaded.saveAs(file); await page.locator("#closeInfo").click();
  return E.importSave(fs.readFileSync(file, "utf8"));
}
async function actualLabels(page, tileId, rotation, ghost) {
  const rows = await page.locator(`.tile-cell${ghost ? ".ghost" : ""}[data-tile="${tileId}"]`).evaluate(tile => {
    const t = tile.getBoundingClientRect(), scale = t.width / tile.offsetWidth,
      x = t.left + tile.clientLeft * scale, y = t.top + tile.clientTop * scale,
      width = tile.clientWidth * scale, height = tile.clientHeight * scale;
    return [...tile.querySelectorAll(".tile-space-labels > span, .tile-space-labels > button")].map(label => {
      const b = label.getBoundingClientRect();
      return { text: label.textContent, transform: getComputedStyle(label).transform,
        left: (b.left - x) / width * 100, right: (b.right - x) / width * 100,
        top: (b.top - y) / height * 100, bottom: (b.bottom - y) / height * 100 };
    });
  });
  for (const [index, row] of rows.entries()) {
    const space = M.tile(tileId).spaces[index], polygon = G.polygon(tileId, space.id, rotation);
    assert.equal(row.text, G.spaceLabel(M.tile(tileId), space, rotation));
    assert.match(row.transform, /^matrix\(1, 0, 0, 1,/);
    assert([[row.left, row.top], [row.right, row.top], [row.left, row.bottom], [row.right, row.bottom]]
      .every(([x, y]) => contains(polygon, x, y)), `actual caption outside its own space ${tileId}/${rotation}/${space.id}`);
  }
  return rows.length;
}
(async () => {
  fs.mkdirSync(out, { recursive: true }); report.sourceSha256Before = hashes();
  const browser = await chromium.launch({ channel: "chrome", headless: true, chromiumSandbox: true });
  try {
    report.browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: 2035, height: 1252 }, serviceWorkers: "block", acceptDownloads: true });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin || /^(data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(origin + "/hunt.html?v=map-preview-dev38");
    for (const tileId of Object.keys(G.tiles)) {
      const url = origin + "/" + G.mapImage(tileId), response = await context.request.get(url),
        decoded = await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, url);
      assert.equal(response.status(), 200); assert.match(response.headers()["content-type"], /image\/svg\+xml/);
      assert.equal(decoded.width, 1000); assert.equal(decoded.height, 1000);
      report.httpImages.push({ tileId, status: response.status(), contentType: response.headers()["content-type"], ...decoded });
    }
    for (const recipe of recipes.cases) {
      const original = reached(recipe), filename = path.join(out, recipe.id + "-public-preview.json");
      fs.writeFileSync(filename, E.exportSave(original));
      await page.locator("#file").setInputFiles(filename); await page.locator(`.tile-cell.ghost[data-tile="${recipe.id}"]`).waitFor();
      const images = await page.locator(".tile-cell .tile-diagram").evaluateAll(images => Promise.all(images.map(async image => { await image.decode(); return { src: image.getAttribute("src"), width: image.naturalWidth, height: image.naturalHeight }; })));
      assert(images.every(image => image.width === 1000 && image.height === 1000));
      const preview = { tileId: recipe.id, normalCampaign: true, commandCount: original.commands.length,
        strictSaveReplay: "passed", imageCount: images.length, legalRotations: [] };
      for (const rotation of E.placementOptions(original)) {
        await page.locator(`[data-rotation="${rotation}"]`).click();
        const image = page.locator(`.tile-cell.ghost[data-tile="${recipe.id}"] .tile-diagram`);
        assert.equal(await image.getAttribute("data-tile-rotation"), String(rotation));
        await image.evaluate(image => image.decode()); await actualLabels(page, recipe.id, rotation, true);
        preview.legalRotations.push(rotation);
      }
      await page.screenshot({ path: path.join(out, recipe.id + "-preview.png") });
      const rotation = preview.legalRotations.at(-1), before = await downloadState(page),
        place = page.locator('[data-command="PLACE_TILE"]');
      await place.click();
      assert.equal(await page.locator(".tile-cell.ghost").count(), 0);
      const after = await downloadState(page);
      let expected = E.dispatch(before, { type: "PLACE_TILE", rotation });
      expected = E.applyLeapMoveRuling(E.applyTileSpeedRuling(expected));
      assert.deepEqual(after, expected);
      await page.locator(`.tile-cell[data-tile="${recipe.id}"] .tile-diagram`).evaluate(image => image.decode());
      await actualLabels(page, recipe.id, rotation, false);
      preview.actualCaptionBoundsAndNames = "passed"; preview.placedImageDecode = "passed";
      preview.canonicalPlaceTile = "passed"; report.normalPreviews.push(preview);
    }
    const galleryPage = await context.newPage();
    for (const size of [290, 170]) report.labelComponents.push(await labels(galleryPage, size));
    const offline = await browser.newContext({ serviceWorkers: "block" }), filePage = await offline.newPage();
    await filePage.goto(pathToFileURL(path.join(root, "hunt.html")).href);
    for (const tileId of Object.keys(G.tiles)) {
      const decoded = await filePage.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; },
        pathToFileURL(path.join(root, G.mapImage(tileId))).href);
      assert.equal(decoded.width, 1000); assert.equal(decoded.height, 1000); report.fileImages.push({ tileId, ...decoded });
    }
    await offline.close();
    const finalResponse = await context.request.get(origin + "/assets/tiles/map/tile-17.svg");
    assert.equal(finalResponse.status(), 200); report.server.finalProbe = { status: finalResponse.status(), contentType: finalResponse.headers()["content-type"] };
    report.sourceSha256After = hashes(); assert.deepEqual(report.sourceSha256After, report.sourceSha256Before);
    assert.deepEqual(report.errors, []); report.status = "passed";
  } catch (error) { report.status = "failed"; report.failure = error.message; throw error; }
  finally { await browser.close(); fs.writeFileSync(trackedReport, JSON.stringify(report, null, 2) + "\n"); }
})().catch(error => { console.error(error); process.exitCode = 1; });
