/**
 * @file Bindings between form controls and settings, so pages only declare which
 * control maps to which setting.
 */

import { $$ } from '../../shared/dom.js';

/** @typedef {import('../store.js').Store} Store */

/**
 * Connects every `input.switch[data-setting]` under a root to its boolean setting.
 * @param {Store} store - Dashboard store.
 * @param {ParentNode} root - Where to look for switches.
 * @returns {void}
 */
export function bindSwitches(store, root) {
  const inputs = /** @type {HTMLInputElement[]} */ ($$('input.switch[data-setting]', root));
  for (const input of inputs) {
    input.addEventListener('change', () => store.saveSettings({ [input.dataset.setting]: input.checked }));
  }
  store.subscribe(['settings'], ({ settings }) => {
    if (!settings) return;
    for (const input of inputs) input.checked = Boolean(settings[input.dataset.setting]);
  });
}

/**
 * Binds a range input to a numeric setting, saving at most once per animation frame.
 * @param {Store} store - Dashboard store.
 * @param {HTMLInputElement} input - Range input.
 * @param {HTMLOutputElement} output - Value readout.
 * @param {string} key - Setting name.
 * @param {object} scale
 * @param {(slider: number) => number} scale.toSetting - Slider value → setting value.
 * @param {(setting: number) => number} scale.toSlider - Setting value → slider value.
 * @param {(setting: number) => string} scale.format - Readout text.
 * @returns {void}
 */
export function bindRange(store, input, output, key, { toSetting, toSlider, format }) {
  const min = Number(input.min);
  const max = Number(input.max);
  const paint = (sliderValue) => {
    input.style.setProperty('--fill', `${((sliderValue - min) / (max - min)) * 100}%`);
    output.textContent = format(toSetting(sliderValue));
  };
  let frame = 0;
  input.addEventListener('input', () => {
    paint(Number(input.value));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => store.saveSettings({ [key]: toSetting(Number(input.value)) }));
  });
  store.subscribe(['settings'], ({ settings }) => {
    if (!settings || document.activeElement === input) return;
    input.value = String(toSlider(settings[key]));
    paint(Number(input.value));
  });
}

/**
 * Greys out and disables a group of controls.
 * @param {HTMLElement} container - Element that holds the controls.
 * @param {boolean} disabled - Whether the controls are unavailable.
 * @returns {void}
 */
export function setDisabled(container, disabled) {
  container.classList.toggle('disabled', disabled);
  for (const control of container.querySelectorAll('input, select, button')) {
    /** @type {HTMLInputElement} */ (control).disabled = disabled;
  }
}
