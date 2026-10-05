/**
 * @file Renders the application icon as PNG: an open eye on a gradient tile, or a
 * closed eye when reminders are inactive. Drawn from signed distance fields so it stays
 * crisp at every size, from 16 px tray icons to the 1024 px installer artwork.
 * Pure Node so that both the app and the build scripts can use it.
 */

import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Colours as [r, g, b] in 0–255. */
const PALETTE = {
  active: {
    tileTop: [86, 204, 250],
    tileBottom: [37, 99, 235],
    sclera: [255, 255, 255],
    scleraEdge: [208, 232, 255],
    iris: [30, 64, 175],
    pupil: [8, 14, 36],
    lid: [255, 255, 255],
  },
  inactive: {
    tileTop: [150, 158, 172],
    tileBottom: [88, 96, 112],
    sclera: [255, 255, 255],
    scleraEdge: [226, 230, 238],
    iris: [88, 96, 112],
    pupil: [40, 46, 60],
    lid: [255, 255, 255],
  },
};

/** Layout in unit coordinates (0–1, origin top-left). */
const LAYOUT = {
  tile: { cx: 0.5, cy: 0.5, hw: 0.47, hh: 0.47, r: 0.22 },
  /** Half-width and half-height of the almond-shaped eye opening. */
  eye: { cx: 0.5, cy: 0.5, a: 0.35, b: 0.2 },
  iris: { cx: 0.5, cy: 0.5, r: 0.155 },
  pupil: { cx: 0.5, cy: 0.5, r: 0.075 },
  glint: { cx: 0.46, cy: 0.455, r: 0.034 },
  lidWidth: 0.058,
  /** Horizontal positions of the closed-eye lashes, relative to the eye centre. */
  lashOffsets: [-0.2, 0, 0.2],
  lashLength: 0.085,
};

// Both arcs of the almond are circles whose centres sit above and below the eye, so
// the opening is the overlap of two discs.
const ARC_OFFSET = (LAYOUT.eye.a ** 2 - LAYOUT.eye.b ** 2) / (2 * LAYOUT.eye.b);
const ARC_RADIUS = ARC_OFFSET + LAYOUT.eye.b;

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
 * Encodes square RGBA pixels as a PNG file.
 * @param {number} size - Width and height in pixels.
 * @param {Buffer} rgba - Non-premultiplied RGBA pixels, row by row.
 * @returns {Buffer} PNG file contents.
 */
function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
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
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {{ cx: number, cy: number, r: number }} disc - Disc.
 * @returns {number} Signed distance.
 */
const disc = (px, py, { cx, cy, r }) => Math.hypot(px - cx, py - cy) - r;

/**
 * Signed distance to the almond-shaped eye opening.
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @returns {number} Signed distance.
 */
function eyeOpening(px, py) {
  const { cx, cy } = LAYOUT.eye;
  return Math.max(
    Math.hypot(px - cx, py - (cy + ARC_OFFSET)) - ARC_RADIUS,
    Math.hypot(px - cx, py - (cy - ARC_OFFSET)) - ARC_RADIUS,
  );
}

/**
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @param {number[]} segment - Segment as [x1, y1, x2, y2].
 * @param {number} halfWidth - Half the stroke width.
 * @returns {number} Signed distance to the stroked segment.
 */
function strokedSegment(px, py, [x1, y1, x2, y2], halfWidth) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) - halfWidth;
}

/** Closed-eye lashes: short strokes pointing away from the centre of the lower arc. */
const LASHES = LAYOUT.lashOffsets.map((offset) => {
  const { cx, cy } = LAYOUT.eye;
  const x = cx + offset;
  const y = cy - ARC_OFFSET + Math.sqrt(ARC_RADIUS ** 2 - offset ** 2);
  const length = Math.hypot(offset, y - (cy - ARC_OFFSET));
  const ux = offset / length;
  const uy = (y - (cy - ARC_OFFSET)) / length;
  return [x, y, x + ux * LAYOUT.lashLength, y + uy * LAYOUT.lashLength];
});

/**
 * Signed distance to the closed lid: the lower edge of the eye as a stroked curve with lashes.
 * @param {number} px - Point x.
 * @param {number} py - Point y.
 * @returns {number} Signed distance.
 */
function closedLid(px, py) {
  const { cx, cy, a } = LAYOUT.eye;
  const curve = Math.abs(Math.hypot(px - cx, py - (cy - ARC_OFFSET)) - ARC_RADIUS) - LAYOUT.lidWidth / 2;
  // Keep only the lower arc, between the corners of the eye.
  const arc = Math.max(curve, Math.abs(px - cx) - a, cy - 0.03 - py);
  return Math.min(arc, ...LASHES.map((lash) => strokedSegment(px, py, lash, LAYOUT.lidWidth * 0.4)));
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
 * @param {boolean} inactive - Whether to draw the closed eye.
 * @returns {[number[], number][]} Layers as [rgb, alpha].
 */
function layersAt(u, v, coverage, colors, inactive) {
  const { tile, eye } = LAYOUT;
  const tileT = (v - (tile.cy - tile.hh)) / (2 * tile.hh);
  // Soft highlight in the upper third of the tile.
  const sheen = 0.16 * (1 - smoothstep(0.05, 0.45, v)) * (1 - smoothstep(0.2, 0.9, Math.abs(u - 0.5) * 2));
  const tileColor = mix(mix(colors.tileTop, colors.tileBottom, tileT), [255, 255, 255], sheen);
  const tileCover = coverage(roundRect(u, v, tile));
  const layers = [[tileColor, tileCover]];

  if (inactive) {
    layers.push([colors.lid, coverage(closedLid(u, v))]);
    return layers;
  }

  // The eye shades slightly toward its edges so it reads as rounded.
  const edge = smoothstep(0.35, 1, Math.abs(u - eye.cx) / eye.a);
  const sclera = mix(colors.sclera, colors.scleraEdge, edge);
  const opening = coverage(eyeOpening(u, v));
  layers.push(
    [[0, 0, 0], 0.22 * (1 - smoothstep(0, 0.05, eyeOpening(u, v - 0.02))) * tileCover],
    [sclera, opening],
    [colors.iris, coverage(Math.max(disc(u, v, LAYOUT.iris), eyeOpening(u, v))) * opening],
    [colors.pupil, coverage(disc(u, v, LAYOUT.pupil))],
    [[255, 255, 255], 0.95 * coverage(disc(u, v, LAYOUT.glint))],
  );
  return layers;
}

/**
 * Draws the app icon.
 * @param {number} size - Edge length in pixels.
 * @param {boolean} [inactive=false] - Grey variant with a closed eye, shown while reminders are not running.
 * @returns {Buffer} PNG file contents.
 */
export function drawIcon(size, inactive = false) {
  const colors = inactive ? PALETTE.inactive : PALETTE.active;
  // Small icons are supersampled so thin strokes keep their shape.
  const samples = size <= 64 ? 4 : size <= 256 ? 2 : 1;
  const aa = 1.2 / (size * samples);
  const coverage = (d) => Math.min(1, Math.max(0, 0.5 - d / aa));
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;
          // Composite with "over" in premultiplied space.
          let pr = 0;
          let pg = 0;
          let pb = 0;
          let pa = 0;
          for (const [[lr, lg, lb], la] of layersAt(u, v, coverage, colors, inactive)) {
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
      const i = (y * size + x) * 4;
      const n = samples * samples;
      // Convert the averaged premultiplied colour back to straight alpha.
      rgba[i] = a > 0 ? Math.round(r / a) : 0;
      rgba[i + 1] = a > 0 ? Math.round(g / a) : 0;
      rgba[i + 2] = a > 0 ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, rgba);
}
