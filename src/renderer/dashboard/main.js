/**
 * @file Dashboard entry point: loads initial data, builds navigation and the header,
 * mounts every page and subscribes to updates from the main process.
 */

import { Invoke, Push, ScheduleStatus, ToastKind } from '../../shared/constants.js';
import { describeSchedule } from '../../shared/format.js';
import { api } from '../shared/bridge.js';
import { $, $$, h } from '../shared/dom.js';
import { hydrateIcons, icon } from '../shared/icons.js';
import { readPreference, writePreference } from '../shared/storage.js';
import { bindSwitches } from './components/controls.js';
import { mountPauseControl } from './components/pause-control.js';
import { ReminderEditor } from './components/reminder-editor.js';
import { DEFAULT_PAGE, PAGES } from './copy.js';
import { mountRemindersPage } from './pages/reminders-page.js';
import { mountSchedulePage } from './pages/schedule-page.js';
import { mountSettingsPage } from './pages/settings-page.js';
import { Store } from './store.js';
import { showError, showToast } from './ui/toast.js';

const PAGE_PREFERENCE = 'page';

/**
 * Builds the sidebar and switches pages.
 * @returns {void}
 */
function mountNavigation() {
  let current = readPreference(PAGE_PREFERENCE);
  if (!PAGES.some((p) => p.id === current)) current = DEFAULT_PAGE;

  const buttons = PAGES.map((page) => h('button', {
    className: 'nav-item',
    attrs: { type: 'button' },
    dataset: { page: page.id },
    on: { click: () => show(page.id) },
  }, [icon(page.icon, { size: 18 }), page.label]));
  $('#nav').replaceChildren(...buttons, h('div', { className: 'sidebar-foot' }, [
    icon('lock', { size: 14 }),
    'Everything stays on this device.',
  ]));

  /**
   * @param {string} pageId - Page to show.
   * @returns {void}
   */
  function show(pageId) {
    writePreference(PAGE_PREFERENCE, pageId);
    for (const button of buttons) {
      if (button.dataset.page === pageId) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const page of $$('.page')) page.hidden = page.id !== `page-${pageId}`;
    window.scrollTo(0, 0);
  }

  show(current);
}

/**
 * Header: app icon, status line and the on/off switch.
 * @param {import('./store.js').Store} store - Dashboard store.
 * @returns {void}
 */
function mountHeader(store) {
  const status = $('#status');
  const enabled = /** @type {HTMLInputElement} */ ($('#enabled'));

  enabled.addEventListener('change', () => store.saveSettings({ enabled: enabled.checked }));

  store.subscribe(['info'], ({ info }) => {
    if (info) /** @type {HTMLImageElement} */ ($('#app-logo')).src = info.icon;
  });
  store.subscribe(['settings', 'runtime'], ({ settings, runtime }) => {
    if (!settings || !runtime) return;
    enabled.checked = settings.enabled;
    $('#enabled-label').textContent = settings.enabled ? 'On' : 'Off';
    $('#status-text').textContent = describeSchedule(runtime);
    status.classList.remove('loading');
    status.dataset.state = runtime.status;
    status.classList.toggle('muted-state', runtime.status === ScheduleStatus.OFF || runtime.status === ScheduleStatus.OUTSIDE_HOURS);
  });
}

/**
 * Starts the dashboard.
 * @returns {Promise<void>}
 */
async function start() {
  hydrateIcons();
  $('#status').classList.add('loading');

  const store = new Store();
  const editor = new ReminderEditor(store);

  mountNavigation();
  mountHeader(store);
  mountPauseControl(store);
  bindSwitches(store, document);
  mountRemindersPage(store, editor);
  mountSchedulePage(store);
  mountSettingsPage(store);

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
