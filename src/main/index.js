/**
 * @file Application entry point: single-instance handling, startup wiring and shutdown.
 */

import path from 'node:path';
import { app, Notification, powerMonitor } from 'electron';
import { APP_ID, APP_NAME, Push } from '../shared/constants.js';
import { ReminderController } from './app/reminder-controller.js';
import { registerIpc } from './app/ipc.js';
import { IS_WINDOWS, Paths } from './constants.js';
import { SettingsService } from './settings/settings-service.js';
import { Presence } from './services/presence.js';
import { applyLoginItem, denyAllPermissions, wasStartedHidden } from './services/system-integration.js';
import { getUserState, initUserState } from './services/user-state.js';
import { DashboardWindow } from './windows/dashboard-window.js';
import { OverlayWindow } from './windows/overlay-window.js';
import { TrayController } from './windows/tray.js';

// Blink draws a few small shapes and only loads its own local files, so software rendering is
// enough, and running the GPU and network services inside this process (instead of as
// separate ones) saves about a fifth of the memory.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess2');
// The overlay plays sounds without a user gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/**
 * Creates and connects every service, then starts the app.
 * @returns {Promise<{ showDashboard: () => void, shutdown: () => void }>} Handles used by the lifecycle events.
 */
async function startApp() {
  app.setAppUserModelId(APP_ID);
  const fullscreenSupported = await initUserState();

  const settings = new SettingsService(path.join(app.getPath('userData'), Paths.SETTINGS_FILE));
  const presence = new Presence({ getIdleSeconds: () => powerMonitor.getSystemIdleTime(), getUserState });
  const overlay = new OverlayWindow();
  const controller = new ReminderController({ settings, presence, overlay });
  const dashboard = new DashboardWindow({ onClose: () => showTrayHintOnce() });

  const showDashboard = () => dashboard.show();
  const tray = new TrayController({
    openDashboard: showDashboard,
    setEnabled: (enabled) => settings.update({ enabled }),
    setReminderEnabled: (id, enabled) => settings.update({
      reminders: settings.get().reminders.map((r) => (r.id === id ? { ...r, enabled } : r)),
    }),
    pause: (optionId) => controller.pause(optionId),
    resume: () => controller.resume(),
    quit: () => app.quit(),
  });

  /**
   * Refreshes the tray icon, tooltip and menu.
   * @returns {void}
   */
  const updateTray = () => tray.update({ settings: settings.get(), runtime: controller.state() });

  /**
   * The first time the dashboard is closed, explains that the app keeps running in the tray.
   * @returns {void}
   */
  function showTrayHintOnce() {
    if (settings.get().hasShownTrayHint) return;
    settings.set({ hasShownTrayHint: true });
    const title = `${APP_NAME} is still running`;
    const body = 'Your reminders keep working in the background. Use the tray icon to pause or quit.';
    if (IS_WINDOWS) tray.balloon(title, body);
    else if (Notification.isSupported()) new Notification({ title, body }).show();
  }

  settings.on('change', (keys) => {
    const s = settings.get();
    dashboard.send(Push.SETTINGS, s);
    if (keys.includes('launchAtLogin')) applyLoginItem(s.launchAtLogin);
    updateTray();
  });
  controller.on('status', updateTray);
  controller.on('change', () => {
    if (dashboard.isVisible()) dashboard.send(Push.RUNTIME, controller.state());
  });
  // Countdowns restart after sleep or a lock, so a long absence never causes a burst of reminders.
  powerMonitor.on('resume', () => controller.wake());
  powerMonitor.on('unlock-screen', () => controller.wake());

  registerIpc({ settings, controller, fullscreenSupported });
  denyAllPermissions();
  controller.start();
  updateTray();
  if (settings.get().launchAtLogin) applyLoginItem(true);

  return {
    showDashboard,
    shutdown() {
      controller.stop();
      overlay.destroy();
      dashboard.destroy();
      settings.flush();
    },
  };
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  /** @type {Awaited<ReturnType<typeof startApp>> | null} */
  let instance = null;

  app.on('second-instance', () => instance?.showDashboard());
  // Clicking the dock icon on macOS reopens the window.
  app.on('activate', () => instance?.showDashboard());

  app.whenReady().then(async () => {
    instance = await startApp();
    if (wasStartedHidden()) app.dock?.hide();
    else instance.showDashboard();
  });

  // Keep running in the tray when every window is closed.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => instance?.shutdown());
}
