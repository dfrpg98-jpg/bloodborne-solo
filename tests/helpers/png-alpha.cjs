'use strict';
const assert = require('node:assert/strict'), zlib = require('node:zlib');

// Decode the alpha byte of 8-bit non-interlaced RGBA PNGs without an image
// library. PNG row predictors refer to the same channel of adjacent pixels.
function readPngAlpha(raw) {
  assert.equal(raw.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = raw.readUInt32BE(16), height = raw.readUInt32BE(20);
  assert(width > 0 && width <= 8192 && height > 0 && height <= 8192);
  assert.equal(raw[24], 8); assert.equal(raw[25], 6); assert.equal(raw[26], 0);
  assert.equal(raw[27], 0); assert.equal(raw[28], 0);
  const chunks = [];
  for (let offset = 8; offset < raw.length;) {
    const size = raw.readUInt32BE(offset); assert(offset + size + 12 <= raw.length);
    if (raw.subarray(offset + 4, offset + 8).toString('ascii') === 'IDAT')
      chunks.push(raw.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const rows = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4 + 1;
  assert.equal(rows.length, stride * height);
  const alpha = new Uint8Array(width * height);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = rows[y * stride]; assert(filter >= 0 && filter <= 4);
    for (let x = 0; x < width; x++) {
      const index = y * width + x, left = x ? alpha[index - 1] : 0,
        up = y ? alpha[index - width] : 0, diagonal = x && y ? alpha[index - width - 1] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up :
        filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, diagonal);
      alpha[index] = (rows[y * stride + 1 + x * 4 + 3] + predictor) & 255;
    }
  }
  return { width, height, alpha };
}

function atlasFrameBounds(png, frame, threshold = 32) {
  const rect = frame.frame, trim = frame.spriteSourceSize, clips = frame.clipRects;
  assert(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0 &&
    rect.x + rect.w <= png.width && rect.y + rect.h <= png.height);
  assert(trim.w === rect.w && trim.h === rect.h && trim.x >= 0 && trim.y >= 0);
  if (clips) assert(Array.isArray(clips) && clips.length > 0 && clips.every(clip =>
    clip.x >= 0 && clip.y >= 0 && clip.w > 0 && clip.h > 0));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pixels = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
    if (png.alpha[y * png.width + x] < threshold) continue;
    const virtualX = x - rect.x + trim.x, virtualY = y - rect.y + trim.y;
    if (clips && !clips.some(clip => virtualX >= clip.x && virtualX < clip.x + clip.w &&
      virtualY >= clip.y && virtualY < clip.y + clip.h)) continue;
    minX = Math.min(minX, virtualX); minY = Math.min(minY, virtualY);
    maxX = Math.max(maxX, virtualX + 1); maxY = Math.max(maxY, virtualY + 1); pixels++;
  }
  assert(pixels > 0, 'a visible atlas frame contains actual foreground pixels');
  return { minX, minY, maxX, maxY, pixels };
}
module.exports = { readPngAlpha, atlasFrameBounds };
