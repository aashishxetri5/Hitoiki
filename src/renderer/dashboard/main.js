/**
 * @file Dashboard entry point: loads initial data, mounts the home screen and its sheets,
 * and subscribes to updates from the main process.
 */

import { Invoke, Push, ToastKind } from '../../shared/constants.js';
import { api } from '../shared/bridge.js';
import { $ } from '../shared/dom.js';
import { hydrateIcons } from '../shared/icons.js';
import { mountAura } from './components/aura.js';
import { bindSwitches } from './components/controls.js';
import { ReminderSheet } from './components/reminder-sheet.js';
import { mountSettingsSheet } from './components/settings-sheet.js';
import { mountHome } from './home.js';
import { Store } from './store.js';
import { showError, showToast } from './ui/toast.js';

// The header leaves room for the window buttons, which sit on the left on macOS.
if (/Mac/i.test(navigator.platform)) document.documentElement.dataset.platform = 'mac';

/**
 * Header: the logo, the on/off switch and the settings button.
 * @param {import('./store.js').Store} store - Dashboard store.
 * @param {() => void} openSettings - Opens the settings sheet.
 * @returns {void}
 */
function mountHeader(store, openSettings) {
  const enabled = /** @type {HTMLInputElement} */ ($('#enabled'));
  enabled.addEventListener('change', () => store.saveSettings({ enabled: enabled.checked }));
  $('#open-settings').addEventListener('click', openSettings);

  store.subscribe(['info'], ({ info }) => {
    if (info) /** @type {HTMLImageElement} */ ($('#app-logo')).src = info.icon;
  });
  store.subscribe(['settings'], ({ settings }) => {
    if (!settings) return;
    enabled.checked = settings.enabled;
    $('#enabled-label').textContent = settings.enabled ? 'On' : 'Off';
  });
}

/**
 * Starts the dashboard.
 * @returns {Promise<void>}
 */
async function start() {
  hydrateIcons();
  mountAura();

  const store = new Store();
  const settingsSheet = mountSettingsSheet(store);
  const reminderSheet = new ReminderSheet(store);

  mountHeader(store, () => settingsSheet.open());
  bindSwitches(store, document);
  mountHome(store, { reminderSheet, settingsSheet });

  api.on(Push.SETTINGS, (settings) => store.set({ settings }));
  api.on(Push.RUNTIME, (runtime) => store.set({ runtime }));
  // Updates are only pushed while the window is visible, so catch up on return.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) store.refreshRuntime();
  });

  try {
    const [settings, runtime, info] = await Promise.all([
      api.invoke(Invoke.SETTINGS_GET),
      api.invoke(Invoke.RUNTIME_GET),
      api.invoke(Invoke.APP_INFO),
    ]);
    store.set({ settings, runtime, info });
    document.body.classList.remove('is-loading');
  } catch (err) {
    showError("Couldn't load your settings", err);
    showToast({ kind: ToastKind.INFO, title: 'Try closing and reopening the window.' });
  }
}

start();
