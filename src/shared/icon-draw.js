/**
 * @file Renders the application icon as PNG or Windows .ico: concentric progress rings, in the
 * colours of the reminders, on a dark tile; the same rings in grey when reminders are not
 * running. Drawn from signed distance fields so it stays crisp at every size, from 16 px tray
 * icons to the 1024 px installer artwork. Pure Node so that both the app and the build scripts
 * can use it.
 */

import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TWO_PI = Math.PI * 2;

/** Sizes in the Windows .ico file; the shell picks the closest one for each view and display scale. */
export const ICO_SIZES = Object.freeze([16, 20, 24, 32, 40, 48, 64, 256]);
/** The largest image an .ico directory entry can describe. */
const ICO_MAX_SIZE = 256;
const BITMAP_HEADER_BYTES = 40;

/** Colours as [r, g, b] in 0–255. */
const PALETTE = {
  active: {
    tileTop: [48, 43, 78],
    tileBottom: [20, 18, 32],
    rings: [[91, 141, 239], [34, 195, 214], [255, 138, 91]],
    trackAlpha: 0.14,
  },
  inactive: {
    tileTop: [150, 158, 172],
    tileBottom: [88, 96, 112],
    rings: [[255, 255, 255], [255, 255, 255], [255, 255, 255]],
    trackAlpha: 0.22,
  },
};

/** Layout in unit coordinates (0–1, origin top-left). */
const TILE = { cx: 0.5, cy: 0.5, hw: 0.47, hh: 0.47, r: 0.22 };
const CENTER = 0.5;
/**
 * The rings, outermost first: radius, thickness, and how much of the circle is filled
 * (clockwise from the top). Small icons get fewer, thicker rings so they stay legible.
 */
const RINGS_DETAILED = [
  { radius: 0.335, width: 0.07, filled: 0.8 },
  { radius: 0.235, width: 0.07, filled: 0.62 },
  { radius: 0.135, width: 0.07, filled: 0.42 },
];
const RINGS_SMALL = [
  { radius: 0.31, width: 0.14, filled: 0.78 },
  { radius: 0.15, width: 0.14, filled: 0.52 },
];
/** Icons up to this many pixels use the small layout. */
const SMALL_ICON_PX = 40;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/**
 * Computes the CRC-32 used by PNG chunks.
 * @param {Buffer} buf - Bytes to checksum.
 * @returns {number} Unsigned CRC-32.
 */
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Builds one PNG chunk.
 * @param {string} type - Four-letter chunk type.
 * @param {Buffer} data - Chunk payload.
 * @returns {Buffer} Encoded chunk.
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * Encodes RGBA pixels as a PNG file.
 * @param {number} width - Width in pixels.
 * @param {number} height - Height in pixels.
 * @param {Buffer} rgba - Non-premultiplied RGBA pixels, row by row.
 * @returns {Buffer} PNG file contents.
 */
function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Geometry (signed distances: negative inside) ----------

/**
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {{ cx: number, cy: number, hw: number, hh: number, r: number }} box - Rounded rectangle.
 * @returns {number} Signed distance.
 */
function roundRect(px, py, { cx, cy, hw, hh, r }) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Signed distance to a full ring.
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {number} radius - Radius of the ring's centre line.
 * @param {number} width - Thickness.
 * @returns {number} Signed distance.
 */
const ring = (px, py, radius, width) => Math.abs(Math.hypot(px - CENTER, py - CENTER) - radius) - width / 2;

/**
 * Signed distance to a partial ring with round ends, filling clockwise from the top.
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {number} radius - Radius of the ring's centre line.
 * @param {number} width - Thickness.
 * @param {number} filled - Fraction of the circle covered, 0–1.
 * @returns {number} Signed distance.
 */
function arc(px, py, radius, width, filled) {
  const dx = px - CENTER;
  const dy = py - CENTER;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += TWO_PI;
  const sweep = filled * TWO_PI;
  if (angle <= sweep) return Math.abs(Math.hypot(dx, dy) - radius) - width / 2;
  // Past the end of the arc, the nearest point is one of its two rounded ends.
  const start = Math.hypot(dx, dy + radius);
  const end = Math.hypot(dx - radius * Math.sin(sweep), dy + radius * Math.cos(sweep));
  return Math.min(start, end) - width / 2;
}

// ---------- Shading ----------

/**
 * @param {number[]} a - Start colour.
 * @param {number[]} b - End colour.
 * @param {number} t - 0–1.
 * @returns {number[]} Interpolated colour.
 */
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * @param {number} edge0 - Lower edge.
 * @param {number} edge1 - Upper edge.
 * @param {number} x - Value.
 * @returns {number} Hermite-smoothed 0–1.
 */
function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Colour and opacity of every layer at one point, bottom layer first.
 * @param {number} u - x in unit coordinates.
 * @param {number} v - y in unit coordinates.
 * @param {(d: number) => number} coverage - Anti-aliased coverage for a signed distance.
 * @param {typeof PALETTE.active} colors - Palette.
 * @param {typeof RINGS_DETAILED} rings - Ring layout.
 * @returns {[number[], number][]} Layers as [rgb, alpha].
 */
function layersAt(u, v, coverage, colors, rings) {
  const tileT = (v - (TILE.cy - TILE.hh)) / (2 * TILE.hh);
  // Soft highlight in the upper third of the tile.
  const sheen = 0.1 * (1 - smoothstep(0.05, 0.5, v)) * (1 - smoothstep(0.2, 0.9, Math.abs(u - 0.5) * 2));
  const tileColor = mix(mix(colors.tileTop, colors.tileBottom, tileT), [255, 255, 255], sheen);
  const tileCover = coverage(roundRect(u, v, TILE));
  const layers = [[tileColor, tileCover]];
  rings.forEach(({ radius, width, filled }, i) => {
    const color = colors.rings[i];
    layers.push([color, colors.trackAlpha * coverage(ring(u, v, radius, width))]);
    layers.push([color, coverage(arc(u, v, radius, width, filled))]);
  });
  return layers;
}

/**
 * Draws the app icon.
 * @param {number} size - Edge length in pixels.
 * @param {boolean} [inactive=false] - Grey variant, shown while reminders are not running.
 * @returns {Buffer} PNG file contents.
 */
export function drawIcon(size, inactive = false) {
  return drawIconOnCanvas(size, size, size, inactive);
}

/**
 * Draws the app icon centred on a transparent canvas, such as a wide Start-menu tile.
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @param {number} iconSize - Edge length of the icon in pixels, at most the canvas's shorter side.
 * @param {boolean} [inactive=false] - Grey variant, shown while reminders are not running.
 * @returns {Buffer} PNG file contents.
 */
export function drawIconOnCanvas(width, height, iconSize, inactive = false) {
  return encodePng(width, height, renderIcon(width, height, iconSize, inactive));
}

/**
 * Draws the app icon as a Windows .ico file. Images below 256 px are stored as 32-bit bitmaps,
 * the form every tool reads (the installer builder included); the 256 px image is stored as
 * PNG, as Windows expects.
 * @param {readonly number[]} [sizes=ICO_SIZES] - Edge lengths in pixels, at most 256.
 * @returns {Buffer} .ico file contents.
 */
export function drawIco(sizes = ICO_SIZES) {
  const images = sizes.map((size) => {
    const rgba = renderIcon(size, size, size, false);
    return size >= ICO_MAX_SIZE ? encodePng(size, size, rgba) : encodeIcoBitmap(size, rgba);
  });
  const directory = Buffer.alloc(6 + 16 * sizes.length);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    // A width or height of 0 means 256.
    directory[entry] = size % ICO_MAX_SIZE;
    directory[entry + 1] = size % ICO_MAX_SIZE;
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(images[i].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([directory, ...images]);
}

/**
 * Encodes square pixels as an .ico bitmap: a BITMAPINFOHEADER, BGRA rows from the bottom up,
 * then an all-clear AND mask, since the alpha channel already carries the transparency.
 * @param {number} size - Width and height in pixels.
 * @param {Buffer} rgba - Non-premultiplied RGBA pixels, row by row.
 * @returns {Buffer} The bitmap as stored in the .ico file.
 */
function encodeIcoBitmap(size, rgba) {
  const pixelBytes = size * size * 4;
  const maskBytes = Math.ceil(size / 32) * 4 * size;
  const out = Buffer.alloc(BITMAP_HEADER_BYTES + pixelBytes + maskBytes);
  out.writeUInt32LE(BITMAP_HEADER_BYTES, 0);
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8); // the colour rows and the mask rows together
  out.writeUInt16LE(1, 12); // colour planes
  out.writeUInt16LE(32, 14); // bits per pixel
  out.writeUInt32LE(pixelBytes, 20);
  for (let y = 0; y < size; y++) {
    const row = BITMAP_HEADER_BYTES + (size - 1 - y) * size * 4;
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = row + x * 4;
      out[to] = rgba[from + 2];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from];
      out[to + 3] = rgba[from + 3];
    }
  }
  return out;
}

/**
 * Renders the app icon centred on a transparent canvas.
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @param {number} iconSize - Edge length of the icon in pixels.
 * @param {boolean} inactive - Grey variant, shown while reminders are not running.
 * @returns {Buffer} Non-premultiplied RGBA pixels, row by row.
 */
function renderIcon(width, height, iconSize, inactive) {
  const colors = inactive ? PALETTE.inactive : PALETTE.active;
  const rings = iconSize <= SMALL_ICON_PX ? RINGS_SMALL : RINGS_DETAILED;
  // Small icons are supersampled so thin strokes keep their shape.
  const samples = iconSize <= 64 ? 4 : iconSize <= 256 ? 2 : 1;
  const aa = 1.2 / (iconSize * samples);
  const coverage = (d) => Math.min(1, Math.max(0, 0.5 - d / aa));
  const left = (width - iconSize) / 2;
  const top = (height - iconSize) / 2;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x - left + (sx + 0.5) / samples) / iconSize;
          const v = (y - top + (sy + 0.5) / samples) / iconSize;
          // Composite with "over" in premultiplied space.
          let pr = 0;
          let pg = 0;
          let pb = 0;
          let pa = 0;
          for (const [[lr, lg, lb], la] of layersAt(u, v, coverage, colors, rings)) {
            pr = lr * la + pr * (1 - la);
            pg = lg * la + pg * (1 - la);
            pb = lb * la + pb * (1 - la);
            pa = la + pa * (1 - la);
          }
          r += pr;
          g += pg;
          b += pb;
          a += pa;
        }
      }
      const i = (y * width + x) * 4;
      const n = samples * samples;
      // Convert the averaged premultiplied colour back to straight alpha.
      rgba[i] = a > 0 ? Math.round(r / a) : 0;
      rgba[i + 1] = a > 0 ? Math.round(g / a) : 0;
      rgba[i + 2] = a > 0 ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return rgba;
}
