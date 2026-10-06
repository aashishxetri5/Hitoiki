/**
 * @file Changes to the reminder list that more than one part of the window can make.
 */

import { showToast } from '../ui/toast.js';

/**
 * Switches one reminder on or off.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @param {string} id - Reminder id.
 * @param {boolean} enabled - Whether it should run.
 * @returns {Promise<boolean>} True when saved.
 */
export function setReminderEnabled(store, id, enabled) {
  return store.saveSettings({ reminders: store.state.settings.reminders.map((r) => (r.id === id ? { ...r, enabled } : r)) });
}

/**
 * Puts a deleted reminder back where it was.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @param {import('../../../shared/types.js').Reminder} reminder - Reminder to restore.
 * @param {number} index - Its former position.
 * @returns {void}
 */
function restoreReminder(store, reminder, index) {
  const current = store.state.settings.reminders;
  if (current.some((r) => r.id === reminder.id)) return;
  const next = [...current];
  next.splice(Math.min(index, next.length), 0, reminder);
  store.saveSettings({ reminders: next });
}

/**
 * Deletes a reminder and offers to bring it back.
 * @param {import('../store.js').Store} store - Dashboard store.
 * @param {import('../../../shared/types.js').Reminder} reminder - Reminder to delete.
 * @returns {Promise<void>}
 */
export async function removeReminder(store, reminder) {
  const { reminders } = store.state.settings;
  const index = reminders.findIndex((r) => r.id === reminder.id);
  if (!(await store.saveSettings({ reminders: reminders.filter((r) => r.id !== reminder.id) }))) return;
  showToast({
    title: `Deleted “${reminder.name}”`,
    action: { label: 'Undo', onClick: () => restoreReminder(store, reminder, index) },
  });
}
