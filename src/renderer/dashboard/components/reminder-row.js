/**
 * @file A row in the reminder list: its colour and icon, name, interval, time left, and an
 * on/off switch. Clicking the row opens it for editing.
 */

import { lookOf } from '../../../shared/catalog.js';
import { ScheduleStatus } from '../../../shared/constants.js';
import { formatCountdown, formatInterval } from '../../../shared/format.js';
import { h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { SOUND_OPTIONS } from '../copy.js';

/**
 * @typedef {object} RowHandlers
 * @property {(reminder: import('../../../shared/types.js').Reminder, enabled: boolean) => void} onToggle
 * @property {(reminder: import('../../../shared/types.js').Reminder) => void} onEdit
 * @property {(reminder: import('../../../shared/types.js').Reminder) => void} onPreview
 * @property {(reminder: import('../../../shared/types.js').Reminder | null) => void} onHover - Called with the reminder under the pointer or focus, or null.
 */

/**
 * @param {import('../../../shared/types.js').Reminder} reminder - The reminder.
 * @param {import('../../../shared/types.js').RuntimeState | null} runtime - What the schedule is doing.
 * @param {number} now - Epoch milliseconds.
 * @returns {string} Time left until it appears, or a word explaining why there is none.
 */
export function describeRowTime(reminder, runtime, now) {
  if (!reminder.enabled || !runtime) return '';
  if (runtime.status === ScheduleStatus.PAUSED) return 'Resting';
  if (runtime.status === ScheduleStatus.OUTSIDE_HOURS) return 'Off duty';
  const dueAt = runtime.nextDue[reminder.id];
  return runtime.status === ScheduleStatus.ACTIVE && dueAt ? formatCountdown(dueAt - now) : '';
}

/** One reminder in the list. Created once and updated in place so focus is never lost. */
export class ReminderRow {
  /**
   * @param {import('../../../shared/types.js').Reminder} reminder - The reminder to show.
   * @param {RowHandlers} handlers - Callbacks for the row's controls.
   */
  constructor(reminder, handlers) {
    this.reminder = reminder;
    this.tile = h('span', { className: 'row-tile' });
    this.name = h('span', { className: 'row-name' });
    this.meta = h('span', { className: 'row-meta' });
    this.time = h('span', { className: 'row-time' });
    this.toggle = /** @type {HTMLInputElement} */ (h('input', {
      className: 'switch',
      attrs: { type: 'checkbox' },
      on: { change: () => handlers.onToggle(this.reminder, this.toggle.checked) },
    }));
    this.main = h('button', {
      className: 'row-main',
      attrs: { type: 'button' },
      on: { click: () => handlers.onEdit(this.reminder) },
    }, [this.tile, h('span', { className: 'row-copy' }, [this.name, this.meta])]);
    this.play = h('button', {
      className: 'icon-button row-play',
      attrs: { type: 'button' },
      on: { click: () => handlers.onPreview(this.reminder) },
    }, icon('play', { size: 16 }));

    this.element = h('li', {
      className: 'row-item',
      on: {
        mouseenter: () => handlers.onHover(this.reminder),
        mouseleave: () => handlers.onHover(null),
        focusin: () => handlers.onHover(this.reminder),
        focusout: () => handlers.onHover(null),
      },
    }, [this.main, this.time, this.play, this.toggle]);
    this.update(reminder);
  }

  /**
   * Shows new reminder details.
   * @param {import('../../../shared/types.js').Reminder} reminder - The updated reminder.
   * @returns {void}
   */
  update(reminder) {
    this.reminder = reminder;
    const look = lookOf(reminder);
    const sound = SOUND_OPTIONS.find((o) => o.value === reminder.sound);
    this.element.style.setProperty('--c', look.accent);
    this.element.classList.toggle('is-off', !reminder.enabled);
    this.tile.replaceChildren(icon(look.icon, { size: 22 }));
    this.name.textContent = reminder.name;
    this.meta.textContent = `${formatInterval(reminder.intervalSec)}${sound && reminder.sound !== 'off' ? ` · ${sound.label}` : ''}`;
    this.main.setAttribute('aria-label', `Edit ${reminder.name}`);
    this.play.setAttribute('aria-label', `Show ${reminder.name} on screen`);
    this.play.title = 'Show on screen';
    this.toggle.checked = reminder.enabled;
    this.toggle.setAttribute('aria-label', `${reminder.name} on`);
  }

  /**
   * Refreshes the time-left label.
   * @param {import('../../../shared/types.js').RuntimeState | null} runtime - What the schedule is doing.
   * @param {number} now - Epoch milliseconds.
   * @returns {void}
   */
  setRuntime(runtime, now) {
    const text = describeRowTime(this.reminder, runtime, now);
    if (this.time.textContent !== text) this.time.textContent = text;
  }
}
