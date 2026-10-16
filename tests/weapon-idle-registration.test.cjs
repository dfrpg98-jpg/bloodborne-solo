'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const skins = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/weapon-manifest.json'), 'utf8'));
const pixels = new Map();

// Recorded before the fix. Restore only the old placement in memory, keeping
// the exact source PNG and crop, so the regression reproduces the visible bug.
const originalSourceX = {
  'w-threaded-cane-a': 211, 'w-hunter-axe-a': 184,
  'w-rifle-spear-a': 166, 'w-rifle-spear-b': 171,
  'w-saw-spear-a': 206, 'w-ludwigs-holy-blade-b': 194,
  'w-logarius-wheel-a': 166, 'w-kirkhammer-b': 201,
  'w-stake-driver-a': 210, 'w-chikage-a': 141,
  'w-beast-claw-a': 187, 'w-beast-claw-b': 179,
  'w-reiterpallasch-a': 174, 'w-reiterpallasch-b': 190,
  'w-burial-a': 234,
};

function pngAlpha(filename) {
  if (pixels.has(filename)) return pixels.get(filename);
  const raw = fs.readFileSync(path.join(root, filename));
  const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
  assert.equal(raw[24], 8, 'RGBA8 bit depth');
  assert.equal(raw[25], 6, 'RGBA colour type');
  assert.equal(raw[28], 0, 'non-interlaced source PNG');
  const chunks = [];
  for (let offset = 8; offset < raw.length;) {
    const size = raw.readUInt32BE(offset);
    if (raw.subarray(offset + 4, offset + 8).toString('ascii') === 'IDAT') {
      chunks.push(raw.subarray(offset + 8, offset + 8 + size));
    }
    offset += size + 12;
  }
  const filtered = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4 + 1, alpha = new Uint8Array(width * height);
  assert.equal(filtered.length, stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * stride];
    assert.ok(filter <= 4, 'valid PNG filter');
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const left = x ? alpha[index - 1] : 0, up = y ? alpha[index - width] : 0;
      const upperLeft = x && y ? alpha[index - width - 1] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      alpha[index] = (filtered[y * stride + 1 + x * 4 + 3] + predictor) & 255;
    }
  }
  const result = { width, alpha };
  pixels.set(filename, result);
  return result;
}

function anchors(skin, index, sourceX) {
  const { width, alpha } = pngAlpha(skin.path);
  const pose = skin.atlasData.frames[String(index)], crop = pose.frame, trim = pose.spriteSourceSize;
  const xOrigin = sourceX ?? trim.x, points = [], columns = new Uint16Array(crop.w);
  const ground = skin.frameHeight * skin.originY;
  for (let y = 0; y < crop.h; y++) for (let x = 0; x < crop.w; x++) {
    if (alpha[(crop.y + y) * width + crop.x + x] <= 16) continue;
    // Clip rectangles use virtual source coordinates. Test the original
    // inclusion before translating the placement to avoid changing ownership.
    if (pose.clipRects && !pose.clipRects.some(r =>
      x + trim.x >= r.x && x + trim.x < r.x + r.w &&
      y + trim.y >= r.y && y + trim.y < r.y + r.h)) continue;
    const vx = xOrigin + x, vy = trim.y + y;
    points.push([vx, vy]);
    if (vy >= ground - 15 && vy < ground) columns[x]++;
  }

  // Two substantial bottom-band components identify the two boots. A lowered
  // sword tip is smaller and must not move the footprint's bounding box.
  const components = [];
  for (let x = 0; x < columns.length;) {
    if (columns[x] < 2) { x++; continue; }
    const first = x;
    let area = 0;
    while (x < columns.length && columns[x] >= 2) area += columns[x++];
    if (area >= 20) components.push({ area, center: xOrigin + (first + x - 1) / 2 });
  }
  components.sort((a, b) => b.area - a.area);
  const boots = components.slice(0, 2);
  assert.ok(boots.length, 'the inspected idle pose has a substantial foot or hem component');
  const feet = boots.reduce((sum, component) => sum + component.center, 0) / boots.length;
  const h = skin.bodyNormalization.measuredBodyHeight;
  const core = (top, bottom) => {
    const sample = points.filter(([x, y]) => y > ground - h * top && y < ground - h * bottom &&
      x > feet - h * .18 && x < feet + h * .18);
    assert.ok(sample.length > 50, 'substantial anatomical foreground in the inspected core band');
    return sample.reduce((sum, [x]) => sum + x, 0) / sample.length;
  };
  return { feet, head: core(.99, .79), torso: core(.74, .44) };
}

function movement(skin, oldX) {
  const first = anchors(skin, 0, oldX), second = anchors(skin, 1);
  const scale = skin.displayHeight / skin.frameHeight;
  return Object.fromEntries(Object.keys(first).map(part => [part, Math.abs(second[part] - first[part]) * scale]));
}

test('all 30 weapon forms keep actual idle feet, torso and head within 2 displayed pixels', t => {
  assert.equal(Object.keys(skins).length, 30);
  const maximum = { feet: 0, torso: 0, head: 0 };
  for (const [key, skin] of Object.entries(skins)) {
    for (const [part, shift] of Object.entries(movement(skin))) {
      maximum[part] = Math.max(maximum[part], shift);
      assert.ok(shift <= 2, `${key}: ${part} shifts ${shift.toFixed(3)} displayed pixels while standing`);
    }
  }
  t.diagnostic('Actual PNG idle pair maximum drift: ' + JSON.stringify(maximum));
});

test('restoring the 15 original placements reproduces standing jumps using unchanged source pixels', t => {
  assert.equal(Object.keys(originalSourceX).length, 15);
  const restored = {};
  for (const [key, sourceX] of Object.entries(originalSourceX)) {
    const before = movement(skins[key], sourceX), after = movement(skins[key]);
    assert.ok(Object.values(before).some(shift => shift > 2), `${key}: old placement reproduces the standing jump`);
    assert.ok(Object.values(after).every(shift => shift <= 2), `${key}: deployed placement fixes it`);
    restored[key] = { before, after };
  }
  assert.ok(restored['w-burial-a'].before.feet > 10, 'Burial Blade reproduces the reported approximately 11-pixel teleport');
  assert.ok(restored['w-burial-a'].after.feet < .1, 'Burial Blade boots remain planted after registration');
  t.diagnostic('Reproduced and corrected source-pixel cases: ' + JSON.stringify(restored));
});
