/**
 * @file Copies the display font (Fraunces, SIL Open Font License 1.1) into
 * src/renderer/shared/fonts/ so the app ships it and never fetches fonts at run time.
 * Run with `npm run fonts:vendor` after updating @fontsource-variable/fraunces.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'node_modules', '@fontsource-variable', 'fraunces');
const OUT_DIR = path.join(ROOT, 'src', 'renderer', 'shared', 'fonts');

/** Latin subset of the variable font (weight axis only), which covers the whole UI. */
const FONT_FILE = 'fraunces-latin-wght-normal.woff2';

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(path.join(SOURCE_DIR, 'files', FONT_FILE), path.join(OUT_DIR, FONT_FILE));
fs.copyFileSync(path.join(SOURCE_DIR, 'LICENSE'), path.join(OUT_DIR, 'OFL.txt'));
console.log(`Copied ${FONT_FILE} and its license to ${path.relative(ROOT, OUT_DIR)}`);
