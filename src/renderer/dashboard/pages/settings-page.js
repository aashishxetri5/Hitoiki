/**
 * @file Settings page: where and how large reminders appear, sound volume, start at
 * login, and a note on privacy.
 */

import { PRESETS, reminderFromPreset } from '../../../shared/catalog.js';
import { Send } from '../../../shared/constants.js';
import { formatPercent } from '../../../shared/format.js';
import { api } from '../../shared/bridge.js';
import { $ } from '../../shared/dom.js';
import { bindRange, createChoiceGroup } from '../components/controls.js';
import { POSITION_OPTIONS } from '../copy.js';

/**
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
export function mountSettingsPage(store) {
  const selectPosition = createChoiceGroup(
    $('#position'),
    POSITION_OPTIONS.map(({ value, label }) => ({ value, label, iconOnly: true })),
    { className: 'position-cell', onSelect: (value) => store.saveSettings({ overlayPosition: value }) },
  );
  store.subscribe(['settings'], ({ settings }) => {
    if (settings) selectPosition(settings.overlayPosition);
  });

  const percent = {
    toSetting: (v) => v / 100,
    toSlider: (v) => Math.round(v * 100),
    format: formatPercent,
  };
  bindRange(store, /** @type {HTMLInputElement} */ ($('#overlay-size')), /** @type {HTMLOutputElement} */ ($('#overlay-size-value')), 'overlaySize', percent);
  bindRange(store, /** @type {HTMLInputElement} */ ($('#volume')), /** @type {HTMLOutputElement} */ ($('#volume-value')), 'volume', percent);

  // Shows the first reminder that is switched on, so the test matches what the user will see.
  $('#test-overlay').addEventListener('click', () => {
    const { reminders } = store.state.settings;
    api.send(Send.PREVIEW, reminders.find((r) => r.enabled) ?? reminders[0] ?? reminderFromPreset(PRESETS[0]));
  });

  store.subscribe(['info'], ({ info }) => {
    if (!info) return;
    $('#about').textContent = `Blink ${info.version}`;
    $('#data-path').textContent = `Settings file: ${info.settingsPath}`;
  });
}
