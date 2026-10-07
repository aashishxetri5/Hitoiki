/**
 * @file Renders the app icon to build/icon.png (used for Linux), build/icon.ico (the Windows
 * installer and executable) and the Microsoft Store package's images in build/appx. Run by
 * `npm run assets`, which `npm run dist` and `npm run dist:store` call first.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawIco, drawIcon, drawIconOnCanvas } from '../src/shared/icon-draw.js';

const ICON_SIZE = 1024;
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
const APPX_DIR = path.join(OUT_DIR, 'appx');

/**
 * Images for the Store package as [file name, width, height, icon size]. The scale-* files
 * are the Start-menu tiles and Store logo at 100% and 200% display scaling; the
 * targetsize-* files are what the taskbar and the Start app list show. Tiles keep a margin
 * around the icon, while the small images fill their whole square.
 * @type {readonly [string, number, number, number][]}
 */
const APPX_IMAGES = Object.freeze([
  ['StoreLogo.scale-100.png', 50, 50, 50],
  ['StoreLogo.scale-200.png', 100, 100, 100],
  ['Square44x44Logo.scale-100.png', 44, 44, 44],
  ['Square44x44Logo.scale-200.png', 88, 88, 88],
  ['Square150x150Logo.scale-100.png', 150, 150, 96],
  ['Square150x150Logo.scale-200.png', 300, 300, 192],
  ['Wide310x150Logo.scale-100.png', 310, 150, 96],
  ['Wide310x150Logo.scale-200.png', 620, 300, 192],
  ...[16, 24, 32, 48, 256].map((size) => [`Square44x44Logo.targetsize-${size}_altform-unplated.png`, size, size, size]),
]);

/**
 * Writes one file and reports it.
 * @param {string} file - Destination path.
 * @param {Buffer} contents - File contents.
 * @returns {void}
 */
function write(file, contents) {
  fs.writeFileSync(file, contents);
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}

fs.mkdirSync(APPX_DIR, { recursive: true });
write(path.join(OUT_DIR, 'icon.png'), drawIcon(ICON_SIZE));
// Drawn size by size so small icons get the bolder artwork; electron-builder uses this file as is.
write(path.join(OUT_DIR, 'icon.ico'), drawIco());
for (const [name, width, height, iconSize] of APPX_IMAGES) {
  write(path.join(APPX_DIR, name), drawIconOnCanvas(width, height, iconSize));
}
