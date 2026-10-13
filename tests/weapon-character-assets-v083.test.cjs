'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const zlib = require('node:zlib');

const base = path.resolve(__dirname, '..');
const dir = path.join(base, 'assets', 'characters');
const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'weapon-manifest.json'), 'utf8'));
const ids = ['threaded-cane', 'hunter-axe', 'rifle-spear', 'saw-spear',
  'uncanny-ludwigs-holy-blade', 'tonitrus', 'blade-of-mercy',
  'ludwigs-holy-blade', 'logarius-wheel', 'kirkhammer', 'stake-driver',
  'chikage', 'beast-claw', 'reiterpallasch', 'burial'];
const frames = {
  idle: [0, 1], walk: [2, 3, 4, 5], 'attack-0': [6, 7, 8, 9],
  'attack-1': [10, 11, 12, 13], 'attack-2': [14, 15, 16, 17],
  hit: [18, 19], death: [20, 21], transform: [22, 23],
};
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const entries = () => Object.entries(metadata);

function readPngAlpha(raw) {
  const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
  assert.equal(raw[24], 8, 'RGBA8 bit depth');
  assert.equal(raw[25], 6, 'RGBA colour type');
  assert.equal(raw[28], 0, 'non-interlaced generated PNG');
  const chunks = [];
  for (let offset = 8; offset < raw.length;) {
    const size = raw.readUInt32BE(offset);
    const type = raw.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') chunks.push(raw.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const filtered = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4 + 1;
  assert.equal(filtered.length, stride * height);
  // PNG channel predictors are independent. Decode only the alpha channel;
  // this reads source pixels and never writes a raster file or edits artwork.
  const alpha = new Uint8Array(width * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const kind = filtered[y * stride];
    assert.ok(kind >= 0 && kind <= 4, 'valid PNG filter');
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const value = filtered[y * stride + 1 + x * 4 + 3];
      const left = x ? alpha[index - 1] : 0;
      const up = y ? alpha[index - width] : 0;
      const upperLeft = x && y ? alpha[index - width - 1] : 0;
      const predictor = kind === 0 ? 0 : kind === 1 ? left : kind === 2 ? up :
        kind === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      alpha[index] = (value + predictor) & 255;
    }
  }
  return {width, height, alpha};
}

test('all fifteen weapons own both form-specific sheets with reciprocal pairing', () => {
  assert.equal(entries().length, 30, 'partial generation is not a complete release');
  for (const id of ids) for (const [face, suffix] of [[0, 'a'], [1, 'b']]) {
    const key = `w-${id}-${suffix}`;
    const m = metadata[key];
    assert.ok(m, key);
    assert.equal(m.weaponId, id);
    assert.equal(m.face, face);
    const related = `w-${id}-${face ? 'a' : 'b'}`;
    assert.deepEqual(m.relatedSkins, [related]);
    assert.deepEqual(metadata[related]?.relatedSkins, [key]);
    assert.ok(m.weaponName && m.formName);
  }
  assert.equal(new Set(entries().map(([, m]) => m.sha256)).size, 30,
    'different forms cannot reuse the same generated sheet');
});

test('generated PNG signatures, RGBA headers, dimensions and source hashes match deployed bytes', () => {
  for (const [key, m] of entries()) {
    assert.match(m.path, /^assets\/characters\/w-[a-z-]+\.png$/);
    assert.match(m.atlasPath, /^assets\/characters\/w-[a-z-]+\.atlas\.json$/);
    const raw = fs.readFileSync(path.join(base, m.path));
    assert.deepEqual([...raw.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], key);
    assert.equal(raw.subarray(12, 16).toString('ascii'), 'IHDR', key);
    assert.equal(raw[25], 6, `${key}: RGBA colour type`);
    assert.deepEqual([raw.readUInt32BE(16), raw.readUInt32BE(20)], m.dimensions, key);
    assert.equal(hash(raw), m.sha256, key);
    assert.equal(m.provenance.sourceSha256, m.sha256, key);
    assert.match(m.provenance.sourceFilename, /^exec-[a-f\d-]+\.png$/, key);
    assert.match(m.provenance.promptSha256, /^[a-f\d]{64}$/, key);
    assert.ok(raw.length > 50000, `${key}: substantive original sheet`);
  }
});

test('every atlas owns 24 isolated poses within the raw sheet and common foot baseline', () => {
  for (const [key, m] of entries()) {
    assert.equal(m.frames, 24, key);
    assert.equal(m.frameCount, 24, key);
    assert.equal(m.frameWidth, 512);
    assert.equal(m.frameHeight, 512);
    assert.equal(m.originY, 460 / 512);
    assert.ok(m.displayHeight >= 64 && m.displayHeight <= 256);
    assert.equal(m.bodyNormalization.displayHeight, m.displayHeight);
    assert.equal(m.bodyNormalization.targetVisibleHeight, 75);
    assert.ok(m.bodyNormalization.measuredBodyHeight >= 60);
    assert.equal(m.bodyNormalization.idleMeasurements.length, 2);
    const measured = m.displayHeight * m.bodyNormalization.measuredBodyHeight / 512;
    assert.ok(Math.abs(measured - m.bodyNormalization.estimatedVisibleHeight) < 0.01);
    if (!m.bodyNormalization.clamped) assert.ok(Math.abs(measured - 75) < 0.01);
    const atlas = m.atlasData;
    assert.equal(atlas.meta.analysis.foregroundPoseCount, 24);
    assert.equal(atlas.meta.analysis.foreignPosePixels, 0);
    assert.deepEqual(atlas.meta.size, {w: m.dimensions[0], h: m.dimensions[1]});
    assert.deepEqual(Object.keys(atlas.frames).sort((a, b) => +a - +b),
      Array.from({length: 24}, (_, i) => String(i)), key);
    const poses = Object.values(atlas.frames);
    for (const [i, pose] of poses.entries()) {
      const f = pose.frame, s = pose.spriteSourceSize;
      for (const n of [f.x, f.y, f.w, f.h, s.x, s.y, s.w, s.h]) {
        assert.ok(Number.isInteger(n) && n >= 0, `${key}/${i}: integer bounds`);
      }
      assert.ok(f.w > 10 && f.h > 10, `${key}/${i}: complete pose`);
      assert.ok(f.x + f.w <= m.dimensions[0] && f.y + f.h <= m.dimensions[1]);
      assert.deepEqual(pose.sourceSize, {w: 512, h: 512});
      assert.equal(pose.rotated, false);
      assert.equal(pose.trimmed, true);
      assert.deepEqual([s.w, s.h], [f.w, f.h]);
      assert.equal(s.y + s.h, 460, `${key}/${i}: stable ground`);
      assert.ok(s.x + s.w <= 512 && s.y + s.h <= 512);
      if (pose.clipRects) {
        assert.ok(Array.isArray(pose.clipRects) && pose.clipRects.length > 0 && pose.clipRects.length <= 2048);
        for (const r of pose.clipRects) {
          assert.deepEqual(Object.keys(r).sort(), ['x', 'y', 'w', 'h'].sort());
          assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger));
          assert.ok(r.x >= s.x && r.y >= s.y && r.w > 0 && r.h > 0);
          assert.ok(r.x + r.w <= s.x + s.w && r.y + r.h <= s.y + s.h);
        }
      }
    }
    const external = JSON.parse(fs.readFileSync(path.join(base, m.atlasPath), 'utf8'));
    assert.deepEqual(external, atlas, `${key}: inline and standalone atlas`);
  }
});

test('actual PNG foreground belongs to exactly one rendered pose after vector clip geometry', () => {
  let totalMasked = 0;
  for (const [key, m] of entries()) {
    const {width, height, alpha} = readPngAlpha(fs.readFileSync(path.join(base, m.path)));
    const ownership = new Uint8Array(width * height);
    let masked = 0;
    for (const [index, pose] of Object.entries(m.atlasData.frames)) {
      const f = pose.frame, s = pose.spriteSourceSize;
      let inclusion = null;
      if (pose.clipRects) {
        masked++;
        inclusion = new Uint8Array(f.w * f.h);
        for (const r of pose.clipRects) {
          const left = r.x - s.x, top = r.y - s.y;
          for (let y = top; y < top + r.h; y++) {
            inclusion.fill(1, y * f.w + left, y * f.w + left + r.w);
          }
        }
      }
      let ownedCore = 0;
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const source = (f.y + y) * width + f.x + x;
        if (alpha[source] > 16 && (!inclusion || inclusion[y * f.w + x])) {
          ownership[source]++;
          ownedCore++;
        }
      }
      assert.ok(ownedCore >= 2000, `${key}/${index}: complete human pose retains foreground`);
    }
    let missing = 0, duplicate = 0;
    for (let i = 0; i < alpha.length; i++) if (alpha[i] > 16) {
      if (ownership[i] === 0) missing++;
      if (ownership[i] > 1) duplicate++;
    }
    assert.equal(missing, 0, `${key}: no own foreground clipped away`);
    assert.equal(duplicate, 0, `${key}: no other pose foreground bleeds into the frame`);
    assert.equal(masked, m.atlasData.meta.analysis.geometryMaskedFrames);
    totalMasked += masked;
  }
  assert.ok(totalMasked > 0, 'the real contaminated sheets exercise vector ownership masks');
});

test('idle, walk, three attacks, hurt, defeat and transformation occupy distinct frame sequences', () => {
  const weapons = JSON.parse(fs.readFileSync(path.join(base, 'components', 'extended-weapons.json'), 'utf8'));
  const speeds = Object.fromEntries(weapons.weapons.map(w => [w.id, w.faces.map(f => f.slots.map(s => s.speed))]));
  speeds.burial = [[3, 2, 2], [2, 1, 1]];
  for (const [key, m] of entries()) {
    assert.deepEqual(Object.keys(m.animations).sort(), Object.keys(frames).sort(), key);
    const used = [];
    for (const [name, expected] of Object.entries(frames)) {
      const a = m.animations[name];
      assert.deepEqual(a.frames, expected, `${key}/${name}`);
      assert.ok(Number.isFinite(a.frameRate) && a.frameRate > 0 && a.frameRate <= 30);
      assert.equal(a.repeat, name === 'idle' || name === 'walk' ? -1 : 0);
      if (name.startsWith('attack-')) {
        const slot = +name.slice(-1);
        const speed = speeds[m.weaponId][m.face][slot];
        assert.equal(a.frameRate, speed ? {3: 16, 2: 12, 1: 9}[speed] : 12,
          `${key}/${name}: visual rhythm follows printed slot speed`);
      } else {
        assert.equal(a.frameRate, {idle: 3, walk: 10, hit: 8, death: 5, transform: 8}[name]);
      }
      used.push(...a.frames);
    }
    assert.equal(new Set(used).size, 24, `${key}: every state owns its own poses`);
  }
});

test('weapon metadata adds a separate global and keeps the five existing actor skins available', () => {
  const existing = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(existing).sort(), ['hunter', 'mob', 'beast', 'boss', 'female'].sort());
  const script = fs.readFileSync(path.join(dir, 'weapon-manifest.js'), 'utf8');
  const previous = Object.freeze({keep: true});
  const context = {window: {BBCharacterAssets: previous}};
  vm.runInNewContext(script, context);
  assert.equal(context.window.BBCharacterAssets, previous);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.BBWeaponCharacterAssets)), metadata);
  assert.ok(!script.includes('document') && !script.includes('localStorage'));
});

test('runtime asset paths reference only new artwork and source photos are provenance names only', () => {
  for (const [key, m] of entries()) {
    for (const filename of [m.path, m.atlasPath, m.atlasData.meta.image]) {
      assert.ok(!filename.includes('참고자료') && !filename.includes('components/images'), key);
      assert.ok(!/\.jpe?g(?:$|[?#])/i.test(filename), key);
      assert.ok(!/^(?:https?:|file:|[A-Z]:)/i.test(filename), key);
    }
    assert.equal(typeof m.provenance.userCardReferenceMissing, 'boolean');
    // A missing local board card can still have researched gameplay footage
    // frames as visual references. Neither source is a runtime image URL.
    if (!m.provenance.userCardReferenceMissing) {
      assert.ok(m.provenance.references.length >= 1);
    }
    for (const r of m.provenance.references) {
      assert.equal(path.basename(r.filename), r.filename);
      assert.match(r.sha256, /^[a-f\d]{64}$/);
      assert.deepEqual(Object.keys(r).sort(), ['filename', 'sha256']);
    }
  }
});
