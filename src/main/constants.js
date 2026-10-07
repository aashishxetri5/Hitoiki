/**
 * @file Main-process constants: paths, timings and window sizes.
 * Must not import Electron so that pure modules (and their tests) can use it.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(MAIN_DIR, '..');

export const IS_MAC = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';
/** True when running from the Microsoft Store package (MSIX), which Windows installs and starts. */
export const IS_STORE_BUILD = Boolean(process.windowsStore);

export const Paths = Object.freeze({
  PRELOAD: path.join(SRC_DIR, 'preload.cjs'),
  DASHBOARD_HTML: path.join(SRC_DIR, 'renderer', 'dashboard', 'index.html'),
  OVERLAY_HTML: path.join(SRC_DIR, 'renderer', 'overlay', 'overlay.html'),
  SETTINGS_FILE: 'settings.json',
});

export const Timing = Object.freeze({
  SETTINGS_SAVE_DEBOUNCE_MS: 500,
  /** The reminder window is destroyed after this long without a reminder, freeing its memory. */
  OVERLAY_IDLE_DESTROY_MS: 30_000,
  /** How long the window stays after a reminder's duration so its exit animation can finish. */
  OVERLAY_EXIT_MS: 450,
});

/** Reminders that fall due together are shown one after another, up to this many. */
export const MAX_QUEUED_REMINDERS = 3;

export const DashboardWindowSize = Object.freeze({
  WIDTH: 1020,
  HEIGHT: 720,
  MIN_WIDTH: 360,
  MIN_HEIGHT: 560,
  /** Height of the title bar; matches --header-h in src/renderer/dashboard/dashboard.css. */
  TITLE_BAR_HEIGHT: 56,
});

/**
 * Colours for the window frame: painted before the page loads, and used for the system's
 * window buttons. They must match --bg and --ink in src/renderer/shared/tokens.css.
 */
export const DashboardTheme = Object.freeze({
  light: Object.freeze({ background: '#f6f1ea', symbol: '#1f2430' }),
  dark: Object.freeze({ background: '#15131a', symbol: '#f4efe8' }),
});
