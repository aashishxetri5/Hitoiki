/**
 * @file The settings sheet: active hours, staying out of the way, where reminders appear,
 * sound, start at login, and a note on privacy.
 */

import { PRESETS, reminderFromPreset } from '../../../shared/catalog.js';
import { Send } from '../../../shared/constants.js';
import { formatPercent } from '../../../shared/format.js';
import { api } from '../../shared/bridge.js';
import { $, h } from '../../shared/dom.js';
import { POSITION_OPTIONS, WEEK_DAYS, describeHours } from '../copy.js';
import { showToast } from '../ui/toast.js';
import { bindRange, createChoiceGroup, setDisabled } from './controls.js';
import { createSheet } from './sheet.js';

/**
 * Wires up the settings sheet.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {import('./sheet.js').Sheet} Controls for the sheet.
 */
export function mountSettingsSheet(store) {
  const sheet = createSheet(/** @type {HTMLDialogElement} */ ($('#settings-sheet')));
  mountActiveHours(store);
  mountAway(store);
  mountOnScreen(store);

  bindRange(store, /** @type {HTMLInputElement} */ ($('#volume')), /** @type {HTMLOutputElement} */ ($('#volume-value')), 'volume', {
    toSetting: (v) => v / 100,
    toSlider: (v) => Math.round(v * 100),
    format: formatPercent,
  });
  store.subscribe(['info'], ({ info }) => {
    if (!info) return;
    $('#about').textContent = `Blink ${info.version}`;
    $('#data-path').textContent = `Settings file: ${info.settingsPath}`;
  });
  return sheet;
}

/**
 * The weekly window reminders are limited to.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
function mountActiveHours(store) {
  const enabled = /** @type {HTMLInputElement} */ ($('#hours-enabled'));
  const start = /** @type {HTMLInputElement} */ ($('#hours-start'));
  const end = /** @type {HTMLInputElement} */ ($('#hours-end'));
  const fields = $('#hours-fields');

  /**
   * @param {Partial<import('../../../shared/types.js').ActiveHours>} change - Fields to change.
   * @returns {void}
   */
  const saveHours = (change) => store.saveSettings({ activeHours: { ...store.state.settings.activeHours, ...change } });

  enabled.addEventListener('change', () => saveHours({ enabled: enabled.checked }));
  for (const [input, key] of /** @type {const} */ ([[start, 'start'], [end, 'end']])) {
    input.addEventListener('change', () => {
      const hours = store.state.settings.activeHours;
      const other = key === 'start' ? hours.end : hours.start;
      if (!input.value || input.value === other) {
        // Revert to the saved value rather than keep an unusable one.
        input.value = hours[key];
        showToast({ title: 'Choose two different times', message: 'The start and end of the active hours cannot be the same.' });
        return;
      }
      saveHours({ [key]: input.value });
    });
  }

  const dayButtons = WEEK_DAYS.map(({ day, short, long }) => h('button', {
    className: 'day',
    text: short,
    attrs: { type: 'button', 'aria-pressed': 'false', 'aria-label': long },
    dataset: { day: String(day) },
    on: {
      click: () => {
        const { days } = store.state.settings.activeHours;
        const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
        if (next.length === 0) showToast({ title: 'Pick at least one day' });
        else saveHours({ days: next });
      },
    },
  }));
  $('#days').replaceChildren(...dayButtons);

  store.subscribe(['settings'], ({ settings }) => {
    if (!settings) return;
    const hours = settings.activeHours;
    enabled.checked = hours.enabled;
    if (document.activeElement !== start) start.value = hours.start;
    if (document.activeElement !== end) end.value = hours.end;
    for (const button of dayButtons) button.setAttribute('aria-pressed', String(hours.days.includes(Number(button.dataset.day))));
    $('#hours-summary').textContent = describeHours(hours);
    setDisabled(fields, !hours.enabled);
  });
}

/**
 * Skipping reminders while the user is away or in a full-screen app.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
function mountAway(store) {
  bindRange(store, /** @type {HTMLInputElement} */ ($('#idle-minutes')), /** @type {HTMLOutputElement} */ ($('#idle-minutes-value')), 'idleMinutes', {
    toSetting: (v) => v,
    toSlider: (v) => v,
    format: (v) => `${v} min`,
  });
  store.subscribe(['settings'], ({ settings }) => {
    if (settings) setDisabled($('#idle-block'), !settings.pauseWhenIdle);
  });
  store.subscribe(['info'], ({ info }) => {
    if (!info || info.fullscreenSupported) return;
    setDisabled($('#row-fullscreen'), true);
    $('#fullscreen-note').textContent = 'Not available on this system. Full-screen detection works on Windows.';
  });
}

/**
 * Where reminders appear on the display, and how large.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
function mountOnScreen(store) {
  const selectPosition = createChoiceGroup(
    $('#position'),
    POSITION_OPTIONS.map(({ value, label }) => ({ value, label, iconOnly: true })),
    { className: 'position-cell', onSelect: (value) => store.saveSettings({ overlayPosition: value }) },
  );
  store.subscribe(['settings'], ({ settings }) => {
    if (settings) selectPosition(settings.overlayPosition);
  });

  bindRange(store, /** @type {HTMLInputElement} */ ($('#overlay-size')), /** @type {HTMLOutputElement} */ ($('#overlay-size-value')), 'overlaySize', {
    toSetting: (v) => v / 100,
    toSlider: (v) => Math.round(v * 100),
    format: formatPercent,
  });

  // Shows the first reminder that is switched on, so the test matches what the user will see.
  $('#test-overlay').addEventListener('click', () => {
    const { reminders } = store.state.settings;
    api.send(Send.PREVIEW, reminders.find((r) => r.enabled) ?? reminders[0] ?? reminderFromPreset(PRESETS[0]));
  });
}
