'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const manifest = require('../assets/characters/manifest.json');
const originalHashes = {
  hunter: '73baa453857a91bc2ac19298f842f3d6bd2a8a3f5def6ed8c6f3f2c06a118a09',
  mob: '3c5e3057786e0b9257dce296fd35bded2fba2a5cdabbf901845e531127fdd779',
  beast: '553cb7f423987034ec9a1853a416935090f11cc8d96ff4986ac06f95049f5d61',
  boss: '3098fff6158fbaf9dd5eeecdc2ad63e58353fcf46d5cc7a05c13cd103e95941a',
  female: '193f1e483b3f35d3c9192704553feb6b11a45eb61546db96e03d9543a810fd90',
};
// Original crop-to-logical-canvas translations: extending a crop must expose
// the weapon/claw without moving the actor's existing body or death pose.
const originalTranslations = {
  hunter: {10: [-528, -480], 11: [-841, -480], 14: [-528, -794], 15: [-841, -794]},
  mob: {10: [-528, -475], 11: [-841, -473]},
  beast: {10: [-528, -480], 11: [-841, -480]},
  boss: {10: [-528, -480], 11: [-841, -475]},
  female: {10: [-528, -480], 11: [-841, -480]},
};

function readPngAlpha(raw) {
  const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
  assert.equal(raw[24], 8); assert.equal(raw[25], 6); assert.equal(raw[28], 0);
  const chunks = [];
  for (let offset = 8; offset < raw.length;) {
    const size = raw.readUInt32BE(offset);
    if (raw.subarray(offset + 4, offset + 8).toString('ascii') === 'IDAT')
      chunks.push(raw.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const filtered = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4 + 1;
  assert.equal(filtered.length, stride * height);
  const alpha = new Uint8Array(width * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const kind = filtered[y * stride]; assert.ok(kind >= 0 && kind <= 4);
    for (let x = 0; x < width; x++) {
      const index = y * width + x, value = filtered[y * stride + 1 + x * 4 + 3];
      const left = x ? alpha[index - 1] : 0, up = y ? alpha[index - width] : 0;
      const upperLeft = x && y ? alpha[index - width - 1] : 0;
      const predictor = kind === 0 ? 0 : kind === 1 ? left : kind === 2 ? up :
        kind === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
      alpha[index] = (value + predictor) & 255;
    }
  }
  return {width, height, alpha};
}

function majorPoses({width, alpha}, top, bottom) {
  const h = bottom - top, seen = new Uint8Array(width * h), queue = new Int32Array(width * h);
  const components = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || alpha[top * width + start] < 32) continue;
    let read = 0, written = 1, sumX = 0; queue[0] = start; seen[start] = 1;
    const points = [];
    while (read < written) {
      const index = queue[read++], y = Math.floor(index / width), x = index % width;
      points.push(index); sumX += x;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= h || xx < 0 || xx >= width) continue;
        const neighbor = yy * width + xx;
        if (!seen[neighbor] && alpha[top * width + neighbor] >= 32) {
          seen[neighbor] = 1; queue[written++] = neighbor;
        }
      }
    }
    components.push({points, centerX: sumX / points.length});
  }
  return components.sort((a, b) => b.points.length - a.points.length).slice(0, 4)
    .sort((a, b) => a.centerX - b.centerX);
}

function inclusion(pose, width, height) {
  const f = pose.frame, s = pose.spriteSourceSize, result = new Uint8Array(width * height);
  const rects = pose.clipRects || [{x: s.x, y: s.y, w: f.w, h: f.h}];
  for (const r of rects) {
    assert.ok(r.x >= s.x && r.y >= s.y && r.w > 0 && r.h > 0);
    assert.ok(r.x + r.w <= s.x + f.w && r.y + r.h <= s.y + f.h);
    const x = f.x + r.x - s.x, y = f.y + r.y - s.y;
    for (let yy = y; yy < y + r.h; yy++) result.fill(1, yy * width + x, yy * width + x + r.w);
  }
  return result;
}

function halo(points, width, height) {
  const result = new Uint8Array(width * height);
  for (const index of points) {
    const x = index % width, y = Math.floor(index / width);
    for (let dy = -3; dy <= 3; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < height) result.fill(1, yy * width + Math.max(0, x - 3), yy * width + Math.min(width, x + 4));
    }
  }
  return result;
}

test('generic actor source PNGs remain byte-identical and repaired crops preserve pose placement', () => {
  let repaired = 0;
  for (const [skin, asset] of Object.entries(manifest)) {
    const raw = fs.readFileSync(path.join(root, asset.path));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), originalHashes[skin], skin);
    assert.equal(asset.sha256, originalHashes[skin]);
    assert.equal(asset.originY, (skin === 'beast' ? 432 : 460) / 512);
    assert.equal(asset.frameWidth, 512); assert.equal(asset.frameHeight, 512);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, asset.atlasPath), 'utf8')), asset.atlasData);
    for (const [index, expected] of Object.entries(originalTranslations[skin])) {
      const pose = asset.atlasData.frames[index], f = pose.frame, s = pose.spriteSourceSize;
      assert.deepEqual([s.x - f.x, s.y - f.y], expected, `${skin}/${index}: keep the existing body location`);
      assert.ok(pose.clipRects?.length > 0 && pose.clipRects.length <= 2048); repaired++;
    }
  }
  assert.equal(repaired, 12);
});

test('actual beast idle paws meet the ground without changing the relative movement of its sixteen poses', t => {
  const asset = manifest.beast, png = readPngAlpha(fs.readFileSync(path.join(root, asset.path)));
  // This is the repaired frame geometry before the ground-anchor correction.
  // Its hash protects all crop, trim and clip rectangles from a pose-by-pose
  // shift that could erase intended recoil, lunging or collapse movements.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(asset.atlasData)).digest('hex'),
    '244e03e87225776d774e49771d5c7f8505f3698a1c74ee5eed4eb38abfe7dbce');
  const oldOrigin = 460, origin = asset.originY * asset.frameHeight;
  const expectedGroundPixels = [432, 432, 432, 432, 421, 421, 421, 422,
    423, 420, 421, 422, 414, 405, 395, 404];
  const groundPixels = [], displayedOffsets = [], previousOffsets = [];
  for (let index = 0; index < 16; index++) {
    const pose = asset.atlasData.frames[index], f = pose.frame, s = pose.spriteSourceSize;
    const mask = inclusion(pose, png.width, png.height);
    let ground = -1, substantialPawPixels = 0;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      const point = y * png.width + x;
      if (mask[point] && png.alpha[point] > 16) ground = Math.max(ground, y - f.y + s.y);
    }
    assert.equal(ground, expectedGroundPixels[index], `pose ${index}: read actual unchanged source pixels`);
    if (index < 4) {
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
        const point = y * png.width + x, virtualY = y - f.y + s.y;
        if (mask[point] && png.alpha[point] >= 64 && virtualY >= ground - 9) substantialPawPixels++;
      }
      assert.ok(substantialPawPixels > 300, 'the lowest band contains substantial paws, not isolated alpha noise');
      assert.equal(ground - origin, 0, 'standing paws reach the explicit ground anchor');
      assert.equal((oldOrigin - ground) * asset.displayHeight / asset.frameHeight, 7,
        'the old anchor reproduces the visible seven-pixel standing gap');
    }
    groundPixels.push(ground);
    displayedOffsets.push((ground - origin) * asset.displayHeight / asset.frameHeight);
    previousOffsets.push((ground - oldOrigin) * asset.displayHeight / asset.frameHeight);
  }
  for (let index = 1; index < 16; index++) {
    assert.equal(displayedOffsets[index] - displayedOffsets[0], previousOffsets[index] - previousOffsets[0],
      `pose ${index}: preserve the original idle-to-motion height difference`);
  }
  assert.ok(groundPixels.every(ground => ground <= origin), 'the constant correction places no pose below the ground');
  t.diagnostic('Actual source-pixel lowest paw/body Y values: ' + JSON.stringify(groundPixels));
});

for (const [skin, asset] of Object.entries(manifest)) {
  test(`${skin}: actual PNG pixels retain all sixteen poses without neighbor fragments or clipped weapons`, () => {
    const png = readPngAlpha(fs.readFileSync(path.join(root, asset.path)));
    const ranges = [[0, 313], [313, 627], [624, 940], [940, 1254]];
    let checked = 0, translucent = 0;
    for (let row = 0; row < ranges.length; row++) {
      const [top, bottom] = ranges[row], poses = majorPoses(png, top, bottom);
      assert.equal(poses.length, 4);
      for (let col = 0; col < 4; col++) {
        const index = row * 4 + col, pose = asset.atlasData.frames[index];
        const mask = inclusion(pose, png.width, png.height);
        for (let other = 0; other < poses.length; other++) {
          for (const point of poses[other].points) {
            const selected = mask[top * png.width + point] === 1;
            assert.equal(selected, other === col,
              `${skin}/${index}: raw pose ${row * 4 + other} pixel at ${point % png.width},${Math.floor(point / png.width) + top}`);
          }
        }
        if (pose.clipRects) {
          const ownHalo = halo(poses[col].points, png.width, bottom - top);
          const otherHalo = halo(poses.flatMap((v, i) => i === col ? [] : v.points), png.width, bottom - top);
          let count = 0;
          // Shared low-alpha pixels close to both cores are ambiguous in the
          // flat source image. Every uniquely near own-core feather survives.
          for (let point = 0; point < ownHalo.length; point++) {
            const alpha = png.alpha[top * png.width + point];
            if (ownHalo[point] && !otherHalo[point] && alpha > 0 && alpha < 32) {
              assert.equal(mask[top * png.width + point], 1, `${skin}/${index}: preserve translucent edge ${point}`);
              count++;
            }
          }
          assert.ok(count > 2000, `${skin}/${index}: vector clips preserve soft original edges`);
          translucent += count;
        }
        checked++;
      }
    }
    assert.equal(checked, 16); assert.ok(translucent > 8000);
  });
}
