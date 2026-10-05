/**
 * @file Bindings between form controls and settings, so pages only declare which
 * control maps to which setting.
 */

import { $$, h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

/** @typedef {import('../store.js').Store} Store */

/**
 * @typedef {object} Choice
 * @property {string} value - Value reported on selection.
 * @property {string} label - Accessible name (and visible text unless `iconOnly`).
 * @property {string} [icon] - Icon shown before the label.
 * @property {boolean} [iconOnly] - Show only the icon (the label stays as its accessible name).
 */

/**
 * Builds a single-choice button group (`role="radiogroup"`) with arrow-key navigation.
 * @param {HTMLElement} container - Element that becomes the group.
 * @param {Choice[]} choices - Options in order.
 * @param {object} config
 * @param {string} config.className - Class for each button.
 * @param {(value: string) => void} config.onSelect - Called when the user picks an option.
 * @param {number} [config.iconSize=16] - Icon size in pixels.
 * @returns {(value: string) => void} Marks a value as the selected one.
 */
export function createChoiceGroup(container, choices, { className, onSelect, iconSize = 16 }) {
  const buttons = choices.map((choice) => h('button', {
    className,
    attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': choice.iconOnly ? choice.label : null, title: choice.iconOnly ? choice.label : null, tabindex: -1 },
    dataset: { value: choice.value },
    on: { click: () => onSelect(choice.value) },
  }, [choice.icon ? icon(choice.icon, { size: iconSize }) : null, choice.iconOnly ? null : choice.label]));
  container.replaceChildren(...buttons);

  container.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const current = buttons.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (!step || current < 0) return;
    event.preventDefault();
    const next = buttons[(current + step + buttons.length) % buttons.length];
    next.focus();
    onSelect(next.dataset.value);
  });

  return (value) => {
    const selected = buttons.find((b) => b.dataset.value === value);
    for (const b of buttons) {
      b.setAttribute('aria-checked', String(b === selected));
      // Only one button is in the tab order, as for native radio groups.
      b.tabIndex = b === (selected ?? buttons[0]) ? 0 : -1;
    }
  };
}

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
