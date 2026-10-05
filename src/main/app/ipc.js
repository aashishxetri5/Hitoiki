/**
 * @file IPC handlers for the dashboard window.
 */

import { app, ipcMain } from 'electron';
import { Invoke, Send } from '../../shared/constants.js';
import { Paths } from '../constants.js';
import { normalizeReminder } from '../core/reminder.js';
import { appIcon } from '../windows/app-icons.js';

/**
 * Only the app's own pages may call into the main process.
 * @param {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} event - IPC event.
 * @returns {boolean} True for frames loaded from the app bundle.
 */
const isTrustedSender = (event) => Boolean(event.senderFrame?.url.startsWith('file://'));

/**
 * Registers an invoke handler with sender validation and error logging.
 * @param {string} channel - Invoke channel.
 * @param {(...args: any[]) => unknown} handler - Implementation.
 * @returns {void}
 */
function handle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender');
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`${channel} failed:`, err);
      throw err;
    }
  });
}

/**
 * Registers a fire-and-forget handler with sender validation.
 * @param {string} channel - Send channel.
 * @param {(payload: any) => void} handler - Implementation.
 * @returns {void}
 */
function on(channel, handler) {
  ipcMain.on(channel, (event, payload) => {
    if (isTrustedSender(event)) handler(payload);
  });
}

/**
 * Registers every IPC handler the dashboard uses.
 * @param {object} deps
 * @param {import('../settings/settings-service.js').SettingsService} deps.settings
 * @param {import('./reminder-controller.js').ReminderController} deps.controller
 * @param {boolean} deps.fullscreenSupported - Whether full-screen detection works on this system.
 * @returns {void}
 */
export function registerIpc({ settings, controller, fullscreenSupported }) {
  handle(Invoke.SETTINGS_GET, () => settings.get());
  handle(Invoke.SETTINGS_SET, (patch) => {
    settings.update(patch);
    return settings.get();
  });
  handle(Invoke.RUNTIME_GET, () => controller.state());
  handle(Invoke.APP_INFO, () => ({
    version: app.getVersion(),
    platform: process.platform,
    icon: appIcon().toDataURL(),
    dataFolder: app.getPath('userData'),
    settingsFile: Paths.SETTINGS_FILE,
    fullscreenSupported,
  }));
  handle(Invoke.PAUSE, (optionId) => {
    if (optionId === null) controller.resume();
    else if (!controller.pause(optionId)) throw new Error('Unknown pause length');
    return controller.state();
  });

  on(Send.PREVIEW, (draft) => {
    const reminder = normalizeReminder(draft);
    if (reminder) controller.preview(reminder);
  });
}
