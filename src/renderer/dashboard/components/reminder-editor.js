/**
 * @file The dialog for creating and editing a reminder: pick a template, an animation
 * and a sound, and set how often and for how long it appears.
 */

import {
  DEFAULT_REMINDER_ICON, PRESETS, REMINDER_ICONS, SCENES, maxDurationFor, reminderFromPreset,
} from '../../../shared/catalog.js';
import { Limits, SceneId, Send } from '../../../shared/constants.js';
import { INTERVAL_UNITS, splitInterval } from '../../../shared/format.js';
import { api } from '../../shared/bridge.js';
import { $, h } from '../../shared/dom.js';
import { SOUND_OPTIONS } from '../copy.js';
import { createChoiceGroup } from './controls.js';

const PREVIEW_ID = 'preview';

/** Dialog for creating and editing reminders. */
export class ReminderEditor {
  /**
   * @param {import('../store.js').Store} store - Dashboard store.
   */
  constructor(store) {
    this.store = store;
    /** @type {import('../../../shared/types.js').Reminder | null} The reminder being edited, or null when creating. */
    this.editing = null;
    this.scene = SCENES[0].id;
    this.icon = DEFAULT_REMINDER_ICON;

    this.dialog = /** @type {HTMLDialogElement} */ ($('#editor'));
    this.form = /** @type {HTMLFormElement} */ ($('#editor-form'));
    this.title = $('#editor-title');
    this.templateField = $('#template-field');
    this.templates = $('#templates');
    this.name = /** @type {HTMLInputElement} */ ($('#reminder-name'));
    this.message = /** @type {HTMLInputElement} */ ($('#reminder-message'));
    this.iconField = $('#icon-field');
    this.intervalValue = /** @type {HTMLInputElement} */ ($('#interval-value'));
    this.intervalUnit = /** @type {HTMLSelectElement} */ ($('#interval-unit'));
    this.duration = /** @type {HTMLInputElement} */ ($('#reminder-duration'));
    this.sound = /** @type {HTMLSelectElement} */ ($('#reminder-sound'));
    this.error = $('#editor-error');
    this.saveButton = /** @type {HTMLButtonElement} */ ($('#editor-save'));

    this.buildChoices();
    this.bindEvents();
  }

  /**
   * Opens the dialog.
   * @param {import('../../../shared/types.js').Reminder | null} [reminder] - Reminder to edit; omit to create one.
   * @returns {void}
   */
  open(reminder = null) {
    this.editing = reminder;
    this.title.textContent = reminder ? 'Edit reminder' : 'New reminder';
    this.saveButton.textContent = reminder ? 'Save' : 'Add reminder';
    this.templateField.hidden = Boolean(reminder);
    this.fill(reminder ?? reminderFromPreset(PRESETS[PRESETS.length - 1], { id: PREVIEW_ID }), { keepName: Boolean(reminder) });
    this.markTemplate(reminder ? null : PRESETS[PRESETS.length - 1].id);
    this.showError('');
    this.dialog.showModal();
    this.name.focus();
  }

  /**
   * Creates the option lists that never change.
   * @returns {void}
   */
  buildChoices() {
    this.templateButtons = PRESETS.map((preset) => h('button', {
      className: 'chip',
      text: preset.name,
      attrs: { type: 'button', 'aria-pressed': 'false' },
      dataset: { id: preset.id },
      on: {
        click: () => {
          this.fill(reminderFromPreset(preset, { id: PREVIEW_ID }), { keepName: false });
          this.markTemplate(preset.id);
          this.name.focus();
        },
      },
    }));
    this.templates.replaceChildren(...this.templateButtons);

    this.selectScene = createChoiceGroup($('#scene-grid'), SCENES.map((s) => ({ value: s.id, label: s.name, icon: s.icon })), {
      className: 'option',
      onSelect: (value) => this.setScene(value),
    });
    this.selectIcon = createChoiceGroup($('#icon-grid'), REMINDER_ICONS.map((name) => ({ value: name, label: name.replace(/-/g, ' '), icon: name, iconOnly: true })), {
      className: 'icon-choice',
      iconSize: 20,
      onSelect: (value) => this.setIcon(value),
    });
    this.intervalUnit.replaceChildren(...INTERVAL_UNITS.map((u) => h('option', { text: u.label, attrs: { value: u.id } })));
    this.sound.replaceChildren(...SOUND_OPTIONS.map((o) => h('option', { text: o.label, attrs: { value: o.value } })));
  }

  /**
   * @returns {void}
   */
  bindEvents() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.save();
    });
    this.form.addEventListener('input', () => this.validate());
    $('#editor-preview').addEventListener('click', () => this.preview());
    for (const button of this.dialog.querySelectorAll('[data-close]')) button.addEventListener('click', () => this.dialog.close());
    // A click on the backdrop (the dialog element itself) dismisses the dialog.
    this.dialog.addEventListener('mousedown', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
  }

  /**
   * Loads a reminder's values into the form.
   * @param {import('../../../shared/types.js').Reminder} reminder - Values to show.
   * @param {object} options
   * @param {boolean} options.keepName - Keep the reminder's own name; otherwise a template's name is used (blank for Custom).
   * @returns {void}
   */
  fill(reminder, { keepName }) {
    const isBlankTemplate = !keepName && reminder.scene === SceneId.ICON && !reminder.message;
    this.name.value = isBlankTemplate ? '' : reminder.name;
    this.message.value = reminder.message;
    const { value, unit } = splitInterval(reminder.intervalSec);
    this.intervalValue.value = String(value);
    this.intervalUnit.value = unit;
    this.duration.value = String(reminder.durationSec);
    this.sound.value = reminder.sound;
    this.setScene(reminder.scene);
    this.setIcon(reminder.icon);
    this.validate({ quiet: true });
  }

  /**
   * @param {string} id - Template to highlight, or null for none.
   * @returns {void}
   */
  markTemplate(id) {
    for (const button of this.templateButtons) button.setAttribute('aria-pressed', String(button.dataset.id === id));
  }

  /**
   * @param {string} scene - One of SceneId.
   * @returns {void}
   */
  setScene(scene) {
    this.scene = scene;
    this.selectScene(scene);
    this.iconField.hidden = scene !== SceneId.ICON;
  }

  /**
   * @param {string} icon - Icon name.
   * @returns {void}
   */
  setIcon(icon) {
    this.icon = icon;
    this.selectIcon(icon);
  }

  /**
   * Reads and checks the form.
   * @returns {{ reminder: import('../../../shared/types.js').Reminder } | { error: string }} The reminder, or what is wrong.
   */
  read() {
    const name = this.name.value.trim();
    if (!name) return { error: 'Give the reminder a name.' };

    const amount = Number(this.intervalValue.value);
    const unit = INTERVAL_UNITS.find((u) => u.id === this.intervalUnit.value);
    const intervalSec = amount * unit.seconds;
    if (!Number.isInteger(amount) || amount < 1 || intervalSec < Limits.INTERVAL_MIN_SEC || intervalSec > Limits.INTERVAL_MAX_SEC) {
      return { error: `Choose an interval between ${Limits.INTERVAL_MIN_SEC} seconds and 24 hours.` };
    }
    const durationSec = Number(this.duration.value);
    const longest = maxDurationFor(intervalSec);
    if (!Number.isInteger(durationSec) || durationSec < Limits.DURATION_MIN_SEC || durationSec > longest) {
      return { error: `It can stay on screen for 1 to ${longest} seconds at this interval.` };
    }

    return {
      reminder: {
        id: this.editing?.id ?? PREVIEW_ID,
        name,
        message: this.message.value.trim(),
        scene: this.scene,
        icon: this.icon,
        intervalSec,
        durationSec,
        sound: this.sound.value,
        enabled: this.editing?.enabled ?? true,
      },
    };
  }

  /**
   * Shows what is wrong with the form, and disables saving until it is fixed.
   * @param {object} [options]
   * @param {boolean} [options.quiet=false] - Disable saving without showing the message (used when the form first opens).
   * @returns {boolean} True when the form is valid.
   */
  validate({ quiet = false } = {}) {
    const result = this.read();
    this.saveButton.disabled = 'error' in result;
    this.showError('error' in result && !quiet ? result.error : '');
    return !('error' in result);
  }

  /**
   * @param {string} text - Message to show, or '' to hide it.
   * @returns {void}
   */
  showError(text) {
    this.error.textContent = text;
    this.error.hidden = !text;
  }

  /**
   * Shows the reminder as currently filled in, without saving it.
   * @returns {void}
   */
  preview() {
    const result = this.read();
    if ('error' in result) this.showError(result.error);
    else api.send(Send.PREVIEW, result.reminder);
  }

  /**
   * Saves the reminder and closes the dialog.
   * @returns {Promise<void>}
   */
  async save() {
    const result = this.read();
    if ('error' in result) {
      this.showError(result.error);
      return;
    }
    const { reminders } = this.store.state.settings;
    if (!this.editing && reminders.length >= Limits.MAX_REMINDERS) {
      this.showError(`You can have up to ${Limits.MAX_REMINDERS} reminders.`);
      return;
    }
    const reminder = { ...result.reminder, id: this.editing?.id ?? crypto.randomUUID() };
    const next = this.editing
      ? reminders.map((r) => (r.id === reminder.id ? reminder : r))
      : [...reminders, reminder];
    if (await this.store.saveSettings({ reminders: next })) this.dialog.close();
  }
}
