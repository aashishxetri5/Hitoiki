import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { ICO_SIZES, drawIco, drawIcon, drawIconOnCanvas } from '../src/shared/icon-draw.js';

/**
 * Decodes the PNGs drawIcon writes (8-bit RGBA, one IDAT chunk, no row filters).
 * @param {Buffer} png - PNG file contents.
 * @returns {{ width: number, height: number, rgba: (x: number, y: number) => number[], alpha: (x: number, y: number) => number }} Size and pixel lookups.
 */
function decode(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const idatLength = png.readUInt32BE(33);
  const raw = zlib.inflateSync(png.subarray(41, 41 + idatLength));
  const rgba = (x, y) => [...raw.subarray(y * (width * 4 + 1) + 1 + x * 4, y * (width * 4 + 1) + 1 + x * 4 + 4)];
  return { width, height, rgba, alpha: (x, y) => rgba(x, y)[3] };
}

test('icons are square PNGs with an opaque centre and transparent corners', () => {
  const icon = decode(drawIcon(32));
  assert.deepEqual([icon.width, icon.height], [32, 32]);
  assert.equal(icon.alpha(16, 16), 255);
  assert.equal(icon.alpha(0, 0), 0);
});

test('the .ico file lists every size, with bitmaps below 256 px and a PNG at 256 px', () => {
  const ico = drawIco();
  assert.equal(ico.readUInt16LE(2), 1, 'type is icon');
  assert.equal(ico.readUInt16LE(4), ICO_SIZES.length);
  ICO_SIZES.forEach((size, i) => {
    const entry = 6 + 16 * i;
    assert.equal(ico[entry] || 256, size, `entry ${i} width`);
    assert.equal(ico.readUInt16LE(entry + 6), 32, 'bits per pixel');
    const offset = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    assert.ok(offset + length <= ico.length, `entry ${i} lies inside the file`);
    if (size === 256) {
      assert.equal(ico.subarray(offset, offset + 4).toString('latin1'), '\x89PNG');
    } else {
      assert.equal(ico.readUInt32LE(offset), 40, 'BITMAPINFOHEADER');
      assert.equal(ico.readInt32LE(offset + 8), size * 2, 'colour and mask rows');
    }
  });
});

test('.ico bitmaps hold the same pixels as the PNG, stored bottom-up as BGRA', () => {
  const size = 32;
  const png = decode(drawIcon(size));
  const ico = drawIco([size]);
  const pixels = ico.readUInt32LE(6 + 12) + 40;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = pixels + ((size - 1 - y) * size + x) * 4;
      assert.deepEqual([ico[at + 2], ico[at + 1], ico[at], ico[at + 3]], png.rgba(x, y), `pixel ${x},${y}`);
    }
  }
});

test('a wide canvas centres the icon and leaves the sides transparent', () => {
  const tile = decode(drawIconOnCanvas(310, 150, 96));
  assert.deepEqual([tile.width, tile.height], [310, 150]);
  assert.equal(tile.alpha(155, 75), 255, 'the icon sits in the middle');
  assert.equal(tile.alpha(20, 75), 0, 'left margin');
  assert.equal(tile.alpha(290, 75), 0, 'right margin');
  assert.equal(tile.alpha(155, 5), 0, 'top margin');
});
