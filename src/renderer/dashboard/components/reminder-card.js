/**
 * @file A card in the reminder list: icon, name, interval, a live countdown to the
 * next occurrence, an on/off switch and actions.
 */

import { sceneById } from '../../../shared/catalog.js';
import { ScheduleStatus, SceneId } from '../../../shared/constants.js';
import { formatCountdown, formatInterval } from '../../../shared/format.js';
import { h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

/**
 * @typedef {object} CardHandlers
 * @property {(reminder: import('../../../shared/types.js').Reminder, enabled: boolean) => void} onToggle
 * @property {(reminder: import('../../../shared/types.js').Reminder) => void} onEdit
 * @property {(reminder: import('../../../shared/types.js').Reminder) => void} onDelete
 * @property {(reminder: import('../../../shared/types.js').Reminder) => void} onPreview
 */

/**
 * @param {import('../../../shared/types.js').Reminder} reminder - The reminder.
 * @param {import('../../../shared/types.js').RuntimeState | null} runtime - What the schedule is doing.
 * @param {number} now - Epoch milliseconds.
 * @returns {{ text: string, live: boolean }} Text for the status pill and whether it is a running countdown.
 */
export function describeCardStatus(reminder, runtime, now) {
  if (!reminder.enabled) return { text: 'Off', live: false };
  if (!runtime) return { text: '', live: false };
  if (runtime.status === ScheduleStatus.PAUSED) return { text: 'Paused', live: false };
  if (runtime.status === ScheduleStatus.OUTSIDE_HOURS) return { text: 'Outside hours', live: false };
  if (runtime.status === ScheduleStatus.OFF) return { text: 'Off', live: false };
  const dueAt = runtime.nextDue[reminder.id];
  return dueAt ? { text: `Next in ${formatCountdown(dueAt - now)}`, live: true } : { text: '', live: false };
}

/** One reminder in the list. Created once and updated in place so focus is never lost. */
export class ReminderCard {
  /**
   * @param {import('../../../shared/types.js').Reminder} reminder - The reminder to show.
   * @param {CardHandlers} handlers - Callbacks for the card's controls.
   */
  constructor(reminder, handlers) {
    this.reminder = reminder;
    this.tile = h('span', { className: 'card-icon' });
    this.name = h('h3', { className: 'card-name' });
    this.interval = h('p', { className: 'card-interval' });
    this.message = h('p', { className: 'card-message' });
    this.status = h('span', { className: 'status-pill' });
    this.toggle = /** @type {HTMLInputElement} */ (h('input', {
      className: 'switch',
      attrs: { type: 'checkbox' },
      on: { change: () => handlers.onToggle(this.reminder, this.toggle.checked) },
    }));

    const action = (name, label, onClick) => h('button', {
      className: 'icon-button small',
      attrs: { type: 'button', 'aria-label': label, title: label },
      on: { click: onClick },
    }, icon(name, { size: 16 }));

    this.element = h('article', { className: 'card reminder' }, [
      h('div', { className: 'card-top' }, [
        this.tile,
        h('div', { className: 'card-title' }, [this.name, this.interval]),
        this.toggle,
      ]),
      this.message,
      h('div', { className: 'card-foot' }, [
        this.status,
        h('div', { className: 'card-actions' }, [
          action('play', 'Preview', () => handlers.onPreview(this.reminder)),
          action('square-pen', 'Edit', () => handlers.onEdit(this.reminder)),
          action('trash', 'Delete', () => handlers.onDelete(this.reminder)),
        ]),
      ]),
    ]);
    this.update(reminder);
  }

  /**
   * Shows new reminder details.
   * @param {import('../../../shared/types.js').Reminder} reminder - The updated reminder.
   * @returns {void}
   */
  update(reminder) {
    this.reminder = reminder;
    const scene = sceneById(reminder.scene);
    this.element.style.setProperty('--card-accent', scene.accent);
    this.element.classList.toggle('is-off', !reminder.enabled);
    this.tile.replaceChildren(icon(reminder.scene === SceneId.ICON ? reminder.icon : scene.icon, { size: 22 }));
    this.name.textContent = reminder.name;
    this.interval.textContent = formatInterval(reminder.intervalSec);
    this.message.textContent = reminder.message;
    this.message.hidden = !reminder.message;
    this.toggle.checked = reminder.enabled;
    this.toggle.setAttribute('aria-label', `${reminder.name} on`);
  }

  /**
   * Refreshes the status pill.
   * @param {import('../../../shared/types.js').RuntimeState | null} runtime - What the schedule is doing.
   * @param {number} now - Epoch milliseconds.
   * @returns {void}
   */
  setRuntime(runtime, now) {
    const { text, live } = describeCardStatus(this.reminder, runtime, now);
    if (this.status.textContent !== text) this.status.textContent = text;
    this.status.classList.toggle('live', live);
    this.status.hidden = !text;
  }
}
