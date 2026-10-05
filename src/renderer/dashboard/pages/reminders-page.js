/**
 * @file Reminders page: the list of reminder cards, with live countdowns, plus the
 * create, edit, delete (with undo) and preview actions.
 */

import { Send } from '../../../shared/constants.js';
import { api } from '../../shared/bridge.js';
import { $ } from '../../shared/dom.js';
import { ReminderCard } from '../components/reminder-card.js';
import { showToast } from '../ui/toast.js';

const COUNTDOWN_TICK_MS = 1000;

/**
 * @param {import('../store.js').Store} store - Dashboard store.
 * @param {import('../components/reminder-editor.js').ReminderEditor} editor - Dialog used for creating and editing.
 * @returns {void}
 */
export function mountRemindersPage(store, editor) {
  const list = $('#reminder-list');
  const empty = $('#reminders-empty');
  /** @type {Map<string, ReminderCard>} */
  const cards = new Map();

  /**
   * @param {import('../../../shared/types.js').Reminder[]} reminders - The full, updated list.
   * @returns {Promise<boolean>} True when saved.
   */
  const save = (reminders) => store.saveSettings({ reminders });

  /**
   * Removes a reminder, offering to bring it back.
   * @param {import('../../../shared/types.js').Reminder} reminder - Reminder to delete.
   * @returns {Promise<void>}
   */
  async function remove(reminder) {
    const { reminders } = store.state.settings;
    const index = reminders.findIndex((r) => r.id === reminder.id);
    if (!(await save(reminders.filter((r) => r.id !== reminder.id)))) return;
    showToast({
      title: `Deleted “${reminder.name}”`,
      action: { label: 'Undo', onClick: () => restore(reminder, index) },
    });
  }

  /**
   * @param {import('../../../shared/types.js').Reminder} reminder - Reminder to bring back.
   * @param {number} index - Where it was in the list.
   * @returns {void}
   */
  function restore(reminder, index) {
    const current = store.state.settings.reminders;
    if (current.some((r) => r.id === reminder.id)) return;
    const next = [...current];
    next.splice(Math.min(index, next.length), 0, reminder);
    save(next);
  }

  const handlers = {
    onToggle: (reminder, enabled) => save(store.state.settings.reminders.map((r) => (r.id === reminder.id ? { ...r, enabled } : r))),
    onEdit: (reminder) => editor.open(reminder),
    onDelete: remove,
    onPreview: (reminder) => api.send(Send.PREVIEW, reminder),
  };

  /**
   * Refreshes every card's countdown from the schedule state.
   * @returns {void}
   */
  function paintStatuses() {
    const { runtime } = store.state;
    const now = Date.now();
    for (const card of cards.values()) card.setRuntime(runtime, now);
  }

  /**
   * Brings the cards in line with the reminders, reusing existing cards so focus stays put.
   * @param {import('../../../shared/types.js').Reminder[]} reminders - Reminders in order.
   * @returns {void}
   */
  function render(reminders) {
    const wanted = new Set(reminders.map((r) => r.id));
    for (const id of cards.keys()) if (!wanted.has(id)) cards.delete(id);

    const elements = reminders.map((reminder) => {
      let card = cards.get(reminder.id);
      if (card) card.update(reminder);
      else {
        card = new ReminderCard(reminder, handlers);
        cards.set(reminder.id, card);
      }
      return card.element;
    });
    const unchanged = elements.length === list.children.length && elements.every((el, i) => list.children[i] === el);
    if (!unchanged) list.replaceChildren(...elements);

    list.hidden = reminders.length === 0;
    empty.hidden = reminders.length > 0;
    list.setAttribute('aria-busy', 'false');
    paintStatuses();
  }

  $('#new-reminder').addEventListener('click', () => editor.open());
  $('#empty-new').addEventListener('click', () => editor.open());
  store.subscribe(['settings'], ({ settings }) => {
    if (settings) render(settings.reminders);
  });
  store.subscribe(['runtime'], paintStatuses);
  // Countdowns are absolute timestamps, so a once-a-second repaint never drifts.
  setInterval(() => {
    if (!document.hidden) paintStatuses();
  }, COUNTDOWN_TICK_MS);
}
