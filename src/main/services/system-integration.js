/**
 * @file Operating-system integration: start at login and permissions.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, session } from 'electron';
import { APP_NAME } from '../../shared/constants.js';
import { IS_LINUX } from '../constants.js';

/** Command-line flag that starts the app straight into the tray. */
const HIDDEN_FLAG = '--hidden';
const AUTOSTART_FILE = 'blink.desktop';

/**
 * @returns {string[]} Arguments for the login item. In development Electron needs the app folder first.
 */
const loginArguments = () => (app.isPackaged ? [HIDDEN_FLAG] : [app.getAppPath(), HIDDEN_FLAG]);

/**
 * Linux has no login-item API in Electron, so the freedesktop autostart entry is written directly.
 * @param {boolean} enabled - Whether to start with the session.
 * @returns {void}
 */
function applyLinuxAutostart(enabled) {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const file = path.join(configHome, 'autostart', AUTOSTART_FILE);
  try {
    if (!enabled) {
      fs.rmSync(file, { force: true });
      return;
    }
    // An AppImage runs from a temporary mount, so its own path is the one to launch.
    const command = [process.env.APPIMAGE || process.execPath, ...loginArguments()].map((part) => `"${part}"`).join(' ');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=${APP_NAME}\nExec=${command}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`);
  } catch (err) {
    console.error('Could not update the autostart entry:', err);
  }
}

/**
 * Registers or removes the app as a login item.
 * @param {boolean} enabled - Whether to start with the OS.
 * @returns {void}
 */
export function applyLoginItem(enabled) {
  if (IS_LINUX) {
    applyLinuxAutostart(enabled);
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: loginArguments() });
}

/** @returns {boolean} True when the app was launched to run in the background. */
export function wasStartedHidden() {
  return process.argv.includes(HIDDEN_FLAG) || Boolean(app.getLoginItemSettings().wasOpenedAsHidden);
}

/**
 * Blink needs no device or notification permissions, so every request is refused.
 * @returns {void}
 */
export function denyAllPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}
