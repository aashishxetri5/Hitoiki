/**
 * @file The home screen: the progress rings and hero, and the list of reminders with their
 * live countdowns.
 */

import { Send } from '../../shared/constants.js';
import { api } from '../shared/bridge.js';
import { $ } from '../shared/dom.js';
import { Hero } from './components/hero.js';
import { setReminderEnabled } from './components/reminder-actions.js';
import { ReminderRow } from './components/reminder-row.js';
import { Rings } from './components/rings.js';

const COUNTDOWN_TICK_MS = 1000;

/**
 * @param {import('./store.js').Store} store - Dashboard store.
 * @param {object} sheets
 * @param {import('./components/reminder-sheet.js').ReminderSheet} sheets.reminderSheet - Editor for creating and editing.
 * @param {import('./components/sheet.js').Sheet} sheets.settingsSheet - The settings sheet.
 * @returns {void}
 */
export function mountHome(store, { reminderSheet, settingsSheet }) {
  const list = $('#reminder-list');
  const empty = $('#reminders-empty');
  const rings = new Rings(/** @type {any} */ ($('#rings')));
  const hero = new Hero({ store, rings, openSettings: () => settingsSheet.open() });
  /** @type {Map<string, ReminderRow>} */
  const rows = new Map();

  const handlers = {
    onToggle: (reminder, enabled) => setReminderEnabled(store, reminder.id, enabled),
    onEdit: (reminder) => reminderSheet.open(reminder),
    onPreview: (reminder) => api.send(Send.PREVIEW, reminder),
    onHover: (reminder) => rings.focus(reminder?.id ?? null),
  };

  /**
   * Refreshes every row's time-left label.
   * @returns {void}
   */
  function paintRows() {
    const { runtime } = store.state;
    const now = Date.now();
    for (const row of rows.values()) row.setRuntime(runtime, now);
  }

  /**
   * Brings the rows in line with the reminders, reusing existing rows so focus stays put.
   * @param {import('../../shared/types.js').Reminder[]} reminders - Reminders in order.
   * @returns {void}
   */
  function renderList(reminders) {
    const wanted = new Set(reminders.map((r) => r.id));
    for (const id of rows.keys()) if (!wanted.has(id)) rows.delete(id);

    const elements = reminders.map((reminder) => {
      let row = rows.get(reminder.id);
      if (row) row.update(reminder);
      else {
        row = new ReminderRow(reminder, handlers);
        rows.set(reminder.id, row);
      }
      return row.element;
    });
    const unchanged = elements.length === list.children.length && elements.every((el, i) => list.children[i] === el);
    if (!unchanged) list.replaceChildren(...elements);

    list.hidden = reminders.length === 0;
    empty.hidden = reminders.length > 0;
    list.setAttribute('aria-busy', 'false');
    paintRows();
  }

  $('#new-reminder').addEventListener('click', () => reminderSheet.open());
  $('#empty-new').addEventListener('click', () => reminderSheet.open());

  store.subscribe(['settings'], ({ settings }) => {
    if (!settings) return;
    renderList(settings.reminders);
    hero.render();
  });
  store.subscribe(['runtime'], () => {
    hero.render();
    paintRows();
  });

  // Countdowns are absolute timestamps, so a once-a-second repaint never drifts. Nothing
  // runs while the window is hidden.
  setInterval(() => {
    if (document.hidden) return;
    hero.tick();
    paintRows();
  }, COUNTDOWN_TICK_MS);
}
