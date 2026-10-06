/**
 * @file The sheet for creating and editing a reminder. It opens with a live preview of the
 * real animation, and sets how often the reminder appears, for how long, and with what sound.
 */

import {
  DEFAULT_REMINDER_ICON, PRESETS, REMINDER_ICONS, SCENES, lookOf, maxDurationFor, reminderFromPreset,
} from '../../../shared/catalog.js';
import { Limits, SceneId, Send } from '../../../shared/constants.js';
import { INTERVAL_UNITS, splitInterval } from '../../../shared/format.js';
import { api } from '../../shared/bridge.js';
import { $, h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { playSound } from '../../overlay/chimes.js';
import { buildScene } from '../../overlay/scenes.js';
import { INTERVAL_PRESETS, SOUND_OPTIONS } from '../copy.js';
import { createChoiceGroup, paintRange, stepValue } from './controls.js';
import { removeReminder } from './reminder-actions.js';
import { createSheet } from './sheet.js';

const PREVIEW_ID = 'preview';
const BLANK_TEMPLATE = PRESETS[PRESETS.length - 1];

/** Sheet for creating and editing reminders. */
export class ReminderSheet {
  /**
   * @param {import('../store.js').Store} store - Dashboard store.
   */
  constructor(store) {
    this.store = store;
    /** @type {import('../../../shared/types.js').Reminder | null} The reminder being edited, or null when creating. */
    this.editing = null;
    this.scene = SceneId.BLINK;
    this.icon = DEFAULT_REMINDER_ICON;
    this.unit = INTERVAL_UNITS[1].id;
    this.sound = SOUND_OPTIONS[0].value;

    this.sheet = createSheet(/** @type {HTMLDialogElement} */ ($('#reminder-sheet')));
    this.form = /** @type {HTMLFormElement} */ ($('#reminder-form'));
    this.title = $('#sheet-title');
    this.templateField = $('#template-field');
    this.name = /** @type {HTMLInputElement} */ ($('#reminder-name'));
    this.message = /** @type {HTMLInputElement} */ ($('#reminder-message'));
    this.iconField = $('#icon-field');
    this.intervalValue = /** @type {HTMLInputElement} */ ($('#interval-value'));
    this.duration = /** @type {HTMLInputElement} */ ($('#reminder-duration'));
    this.durationValue = /** @type {HTMLOutputElement} */ ($('#reminder-duration-value'));
    this.error = $('#reminder-error');
    this.save = /** @type {HTMLButtonElement} */ ($('#reminder-save'));
    this.remove = $('#reminder-delete');
    this.preview = $('#preview');
    this.previewStage = $('#preview-stage');

    this.buildChoices();
    this.bindEvents();
  }

  /**
   * Opens the sheet.
   * @param {import('../../../shared/types.js').Reminder | null} [reminder] - Reminder to edit; omit to create one.
   * @returns {void}
   */
  open(reminder = null) {
    this.editing = reminder;
    this.title.textContent = reminder ? 'Edit reminder' : 'New reminder';
    this.save.textContent = reminder ? 'Save' : 'Add reminder';
    this.templateField.hidden = Boolean(reminder);
    this.remove.hidden = !reminder;
    this.fill(reminder ?? reminderFromPreset(BLANK_TEMPLATE, { id: PREVIEW_ID }), { keepName: Boolean(reminder) });
    this.markTemplate(reminder ? null : BLANK_TEMPLATE.id);
    this.showError('');
    this.sheet.open();
    // Without preventScroll the sheet scrolls the name into view and hides the preview.
    this.name.focus({ preventScroll: true });
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
          this.name.focus({ preventScroll: true });
        },
      },
    }));
    $('#templates').replaceChildren(...this.templateButtons);

    this.selectScene = createChoiceGroup($('#scene-grid'), SCENES.map((s) => ({
      value: s.id, label: s.name, icon: s.icon, accent: s.accent,
    })), {
      className: 'tile',
      render: (choice) => [h('span', { className: 'tile-dot' }, icon(choice.icon, { size: 16 })), choice.label],
      onSelect: (value) => this.setScene(value),
    });
    this.selectIcon = createChoiceGroup($('#icon-grid'), REMINDER_ICONS.map((name) => ({
      value: name, label: name.replace(/-/g, ' '), icon: name, iconOnly: true,
    })), {
      className: 'icon-choice',
      iconSize: 20,
      onSelect: (value) => this.setIcon(value),
    });
    this.selectUnit = createChoiceGroup($('#interval-unit'), INTERVAL_UNITS.map((u) => ({ value: u.id, label: u.label })), {
      className: 'seg',
      onSelect: (value) => this.setUnit(value),
    });
    this.selectSound = createChoiceGroup($('#sound-chips'), SOUND_OPTIONS.map((o) => ({ value: o.value, label: o.label })), {
      className: 'chip',
      onSelect: (value) => this.setSound(value, { audition: true }),
    });

    this.presetButtons = INTERVAL_PRESETS.map((preset) => h('button', {
      className: 'chip',
      text: preset.label,
      attrs: { type: 'button', 'aria-pressed': 'false' },
      dataset: { seconds: String(preset.seconds) },
      on: { click: () => this.setInterval(preset.seconds) },
    }));
    $('#interval-presets').replaceChildren(...this.presetButtons);
  }

  /**
   * @returns {void}
   */
  bindEvents() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.form.addEventListener('input', () => this.validate());
    this.intervalValue.addEventListener('input', () => this.onIntervalChanged());
    this.duration.addEventListener('input', () => this.paintDuration());
    $('#interval-down').addEventListener('click', () => this.step(-1));
    $('#interval-up').addEventListener('click', () => this.step(1));
    $('#preview-replay').addEventListener('click', () => this.renderPreview());
    $('#reminder-play').addEventListener('click', () => this.playOnScreen());
    this.remove.addEventListener('click', () => {
      const reminder = this.editing;
      this.sheet.close();
      if (reminder) removeReminder(this.store, reminder);
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
    this.setIcon(reminder.icon, { render: false });
    this.setScene(reminder.scene, { render: false });
    this.setSound(reminder.sound, { audition: false });
    // Setting the interval also sets the longest duration the slider allows.
    this.setInterval(reminder.intervalSec);
    this.duration.value = String(Math.min(reminder.durationSec, Number(this.duration.max)));
    this.paintDuration();
    this.renderPreview();
    this.validate({ quiet: true });
  }

  /**
   * @param {string | null} id - Template to highlight, or null for none.
   * @returns {void}
   */
  markTemplate(id) {
    for (const button of this.templateButtons) button.setAttribute('aria-pressed', String(button.dataset.id === id));
  }

  /**
   * @param {string} scene - One of SceneId.
   * @param {object} [options]
   * @param {boolean} [options.render=true] - Replay the preview.
   * @returns {void}
   */
  setScene(scene, { render = true } = {}) {
    this.scene = scene;
    this.selectScene(scene);
    this.iconField.hidden = scene !== SceneId.ICON;
    if (render) this.renderPreview();
  }

  /**
   * @param {string} name - Icon name.
   * @param {object} [options]
   * @param {boolean} [options.render=true] - Replay the preview.
   * @returns {void}
   */
  setIcon(name, { render = true } = {}) {
    this.icon = name;
    this.selectIcon(name);
    if (render && this.scene === SceneId.ICON) this.renderPreview();
  }

  /**
   * @param {string} sound - One of SoundId.
   * @param {object} options
   * @param {boolean} options.audition - Play the sound so the user can hear it.
   * @returns {void}
   */
  setSound(sound, { audition }) {
    this.sound = sound;
    this.selectSound(sound);
    if (audition) playSound(sound, this.store.state.settings.volume);
  }

  /**
   * @param {string} unit - Unit id (see INTERVAL_UNITS).
   * @returns {void}
   */
  setUnit(unit) {
    this.unit = unit;
    this.selectUnit(unit);
    this.onIntervalChanged();
  }

  /**
   * Sets the interval from a number of seconds, shown in the largest unit that fits.
   * @param {number} seconds - Interval length.
   * @returns {void}
   */
  setInterval(seconds) {
    const { value, unit } = splitInterval(seconds);
    this.intervalValue.value = String(value);
    this.unit = unit;
    this.selectUnit(unit);
    this.onIntervalChanged();
  }

  /**
   * @param {1 | -1} direction - Which way to step the interval.
   * @returns {void}
   */
  step(direction) {
    this.intervalValue.value = String(stepValue(Number(this.intervalValue.value) || 1, direction));
    this.onIntervalChanged();
    this.validate();
  }

  /**
   * @returns {number} The interval in seconds as currently entered (NaN when it is not a number).
   */
  intervalSeconds() {
    return Number(this.intervalValue.value) * INTERVAL_UNITS.find((u) => u.id === this.unit).seconds;
  }

  /**
   * Keeps everything that depends on the interval in step with it: the longest time the
   * reminder may stay on screen, and which quick pick is highlighted.
   * @returns {void}
   */
  onIntervalChanged() {
    const seconds = this.intervalSeconds();
    const valid = Number.isInteger(Number(this.intervalValue.value)) && seconds >= Limits.INTERVAL_MIN_SEC && seconds <= Limits.INTERVAL_MAX_SEC;
    if (valid) {
      const longest = maxDurationFor(seconds);
      this.duration.max = String(longest);
      if (Number(this.duration.value) > longest) this.duration.value = String(longest);
      this.paintDuration();
    }
    for (const button of this.presetButtons) button.setAttribute('aria-pressed', String(valid && Number(button.dataset.seconds) === seconds));
  }

  /**
   * @returns {void}
   */
  paintDuration() {
    paintRange(this.duration, this.durationValue, `${this.duration.value} s`);
  }

  /**
   * Redraws the live preview, which also replays its animation.
   * @returns {void}
   */
  renderPreview() {
    this.preview.style.setProperty('--accent', lookOf({ scene: this.scene, icon: this.icon }).accent);
    this.previewStage.replaceChildren(h('div', { className: 'disc' }, buildScene(/** @type {any} */ ({ scene: this.scene, icon: this.icon }))));
  }

  /**
   * Reads and checks the form.
   * @returns {{ reminder: import('../../../shared/types.js').Reminder } | { error: string }} The reminder, or what is wrong.
   */
  read() {
    const name = this.name.value.trim();
    if (!name) return { error: 'Give the reminder a name.' };

    const intervalSec = this.intervalSeconds();
    if (!Number.isInteger(Number(this.intervalValue.value)) || intervalSec < Limits.INTERVAL_MIN_SEC || intervalSec > Limits.INTERVAL_MAX_SEC) {
      return { error: `Choose an interval between ${Limits.INTERVAL_MIN_SEC} seconds and 24 hours.` };
    }
    return {
      reminder: {
        id: this.editing?.id ?? PREVIEW_ID,
        name,
        message: this.message.value.trim(),
        scene: this.scene,
        icon: this.icon,
        intervalSec,
        durationSec: Number(this.duration.value),
        sound: this.sound,
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
    this.save.disabled = 'error' in result;
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
   * Shows the reminder as currently filled in on the screen itself, without saving it.
   * @returns {void}
   */
  playOnScreen() {
    const result = this.read();
    if ('error' in result) this.showError(result.error);
    else api.send(Send.PREVIEW, result.reminder);
  }

  /**
   * Saves the reminder and closes the sheet.
   * @returns {Promise<void>}
   */
  async submit() {
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
    if (await this.store.saveSettings({ reminders: next })) this.sheet.close();
  }
}
