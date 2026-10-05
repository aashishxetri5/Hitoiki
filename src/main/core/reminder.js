/**
 * @file Validation and normalisation of reminders. Reminders arrive from the dashboard
 * (untrusted) and from the settings file (possibly written by an older version), so
 * every one is rebuilt from scratch rather than trusted as-is.
 */

import { DEFAULT_REMINDER_ICON, maxDurationFor, sceneById } from '../../shared/catalog.js';
import { Limits, SceneId, SoundId } from '../../shared/constants.js';
import { ICONS } from '../../shared/icons.js';

const SCENE_IDS = new Set(Object.values(SceneId));
const SOUND_IDS = new Set(Object.values(SoundId));

/**
 * @param {unknown} value - Candidate number.
 * @param {number} min - Lowest allowed value.
 * @param {number} max - Highest allowed value.
 * @returns {number} The value rounded to a whole number inside the range.
 */
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.round(/** @type {number} */ (value))));

/**
 * @param {unknown} value - Candidate text.
 * @param {number} maxLength - Longest allowed length.
 * @returns {string} The text with collapsed whitespace, cut to length ('' when not a string).
 */
const cleanText = (value, maxLength) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '');

/**
 * Rebuilds one reminder from untrusted input.
 * @param {unknown} raw - Candidate reminder.
 * @returns {import('../../shared/types.js').Reminder | null} A valid reminder, or null when the
 *   input is unusable (wrong shape, no id, empty name, unknown scene or non-numeric timing).
 */
export function normalizeReminder(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, any>} */ (raw);
  const hasId = typeof r.id === 'string' && r.id.length > 0 && r.id.length <= Limits.MAX_ID_LENGTH;
  const name = cleanText(r.name, Limits.NAME_LENGTH);
  if (!hasId || !name || !SCENE_IDS.has(r.scene)) return null;
  if (!Number.isFinite(r.intervalSec) || !Number.isFinite(r.durationSec)) return null;

  const intervalSec = clampInt(r.intervalSec, Limits.INTERVAL_MIN_SEC, Limits.INTERVAL_MAX_SEC);
  return {
    id: r.id,
    name,
    message: cleanText(r.message, Limits.MESSAGE_LENGTH),
    scene: r.scene,
    icon: typeof r.icon === 'string' && Object.hasOwn(ICONS, r.icon) ? r.icon : DEFAULT_REMINDER_ICON,
    intervalSec,
    durationSec: clampInt(r.durationSec, Limits.DURATION_MIN_SEC, maxDurationFor(intervalSec)),
    sound: SOUND_IDS.has(r.sound) ? r.sound : SoundId.OFF,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
  };
}

/**
 * Describes a reminder for the overlay window.
 * @param {import('../../shared/types.js').Reminder} reminder - Reminder to show.
 * @param {number} volume - Sound volume, 0–1.
 * @returns {import('../../shared/types.js').ShowRequest} What the overlay needs to play the reminder.
 */
export function buildShowRequest(reminder, volume) {
  return {
    id: reminder.id,
    name: reminder.name,
    message: reminder.message,
    scene: reminder.scene,
    icon: reminder.icon,
    accent: sceneById(reminder.scene).accent,
    durationMs: reminder.durationSec * 1000,
    sound: reminder.sound,
    volume,
  };
}

/**
 * Normalises a list of reminders, dropping unusable entries, duplicate ids and any
 * beyond the maximum count.
 * @param {unknown} list - Candidate reminders.
 * @returns {{ valid: import('../../shared/types.js').Reminder[], rejected: number }}
 *   The usable reminders in order, and how many entries were dropped.
 */
export function normalizeReminders(list) {
  if (!Array.isArray(list)) return { valid: [], rejected: 1 };
  const seen = new Set();
  const valid = [];
  for (const raw of list) {
    const reminder = normalizeReminder(raw);
    if (reminder && !seen.has(reminder.id) && valid.length < Limits.MAX_REMINDERS) {
      seen.add(reminder.id);
      valid.push(reminder);
    }
  }
  return { valid, rejected: list.length - valid.length };
}
