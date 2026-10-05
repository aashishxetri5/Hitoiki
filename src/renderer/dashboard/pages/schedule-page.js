/**
 * @file Schedule page: active hours and the smart-pause options.
 */

import { $, h } from '../../shared/dom.js';
import { bindRange, setDisabled } from '../components/controls.js';
import { WEEK_DAYS, describeHours } from '../copy.js';
import { showToast } from '../ui/toast.js';

/**
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
export function mountSchedulePage(store) {
  const enabled = /** @type {HTMLInputElement} */ ($('#hours-enabled'));
  const start = /** @type {HTMLInputElement} */ ($('#hours-start'));
  const end = /** @type {HTMLInputElement} */ ($('#hours-end'));
  const fields = $('#hours-fields');
  const summary = $('#hours-summary');

  /**
   * Saves a change to the active hours.
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
        if (next.length === 0) {
          showToast({ title: 'Pick at least one day' });
          return;
        }
        saveHours({ days: next });
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
    summary.textContent = describeHours(hours);
    setDisabled(fields, !hours.enabled);
    setDisabled($('#idle-block'), !settings.pauseWhenIdle);
  });

  bindRange(store, /** @type {HTMLInputElement} */ ($('#idle-minutes')), /** @type {HTMLOutputElement} */ ($('#idle-minutes-value')), 'idleMinutes', {
    toSetting: (v) => v,
    toSlider: (v) => v,
    format: (v) => `${v} min`,
  });

  store.subscribe(['info'], ({ info }) => {
    if (!info || info.fullscreenSupported) return;
    setDisabled($('#row-fullscreen'), true);
    $('#fullscreen-note').textContent = 'Not available on this system. Full-screen detection works on Windows.';
  });
}
