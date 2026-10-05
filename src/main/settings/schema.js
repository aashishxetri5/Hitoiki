/**
 * @file Settings defaults, validation of renderer-supplied changes, and recovery of
 * settings files that are missing, damaged or written by another version.
 */

import { PRESETS, reminderFromPreset } from '../../shared/catalog.js';
import { Limits, OverlayPosition } from '../../shared/constants.js';
import { isClock } from '../core/schedule.js';
import { normalizeReminders } from '../core/reminder.js';

const DAYS_PER_WEEK = 7;

/** Reminders created on first run, with whether each starts switched on. */
const STARTER_REMINDERS = Object.freeze([
  ['blink', true], ['water', true], ['focus', true], ['posture', false], ['stretch', false],
]);

/** @type {Readonly<import('../../shared/types.js').Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  pausedUntil: 0,
  reminders: Object.freeze(STARTER_REMINDERS.map(([id, enabled]) => reminderFromPreset(PRESETS.find((p) => p.id === id), { enabled }))),
  activeHours: Object.freeze({ enabled: false, start: '09:00', end: '18:00', days: Object.freeze([1, 2, 3, 4, 5]) }),
  pauseWhenIdle: true,
  idleMinutes: 5,
  pauseInFullscreen: true,
  overlayPosition: OverlayPosition.CENTER,
  overlaySize: 1,
  volume: 0.5,
  launchAtLogin: false,
  hasShownTrayHint: false,
});

/*
 * Parsers: each takes an untrusted value and returns the cleaned value, or
 * `undefined` when the value must be rejected.
 */

/** @param {unknown} v - Value. @returns {boolean | undefined} The value when it is a boolean. */
const parseBoolean = (v) => (typeof v === 'boolean' ? v : undefined);

/**
 * @param {number} min - Lowest allowed value.
 * @param {number} max - Highest allowed value.
 * @returns {(v: unknown) => number | undefined} Parser for finite numbers in the range.
 */
const parseNumberIn = (min, max) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

/**
 * @param {number} min - Lowest allowed value.
 * @param {number} max - Highest allowed value.
 * @returns {(v: unknown) => number | undefined} Parser for whole numbers in the range.
 */
const parseIntegerIn = (min, max) => (v) => (Number.isInteger(v) && /** @type {number} */ (v) >= min && /** @type {number} */ (v) <= max ? v : undefined);

/**
 * @param {Record<string, string>} values - Enum object.
 * @returns {(v: unknown) => string | undefined} Parser for the enum's values.
 */
const parseOneOf = (values) => {
  const allowed = new Set(Object.values(values));
  return (v) => (allowed.has(/** @type {string} */ (v)) ? /** @type {string} */ (v) : undefined);
};

/**
 * Accepts the reminder list only when every entry is usable, so a buggy caller can
 * never silently lose reminders.
 * @param {unknown} v - Candidate reminders.
 * @returns {import('../../shared/types.js').Reminder[] | undefined} Normalised reminders.
 */
function parseReminders(v) {
  const { valid, rejected } = normalizeReminders(v);
  return rejected === 0 ? valid : undefined;
}

/**
 * @param {unknown} v - Candidate active hours.
 * @returns {import('../../shared/types.js').ActiveHours | undefined} Normalised hours.
 */
function parseActiveHours(v) {
  if (!v || typeof v !== 'object') return undefined;
  const { enabled, start, end, days } = /** @type {Record<string, any>} */ (v);
  const validDays = Array.isArray(days) && days.length > 0 && days.length <= DAYS_PER_WEEK
    && days.every((d) => Number.isInteger(d) && d >= 0 && d < DAYS_PER_WEEK);
  if (typeof enabled !== 'boolean' || !isClock(start) || !isClock(end) || start === end || !validDays) return undefined;
  return { enabled, start, end, days: [...new Set(/** @type {number[]} */ (days))].sort((a, b) => a - b) };
}

/**
 * Parsers for every setting the dashboard may change. Keys not listed here are
 * owned by the main process.
 * @type {Readonly<Record<string, (value: unknown) => unknown>>}
 */
const USER_SETTABLE = Object.freeze({
  enabled: parseBoolean,
  reminders: parseReminders,
  activeHours: parseActiveHours,
  pauseWhenIdle: parseBoolean,
  idleMinutes: parseIntegerIn(Limits.IDLE_MIN_MINUTES, Limits.IDLE_MAX_MINUTES),
  pauseInFullscreen: parseBoolean,
  overlayPosition: parseOneOf(OverlayPosition),
  overlaySize: parseNumberIn(Limits.OVERLAY_SIZE_MIN, Limits.OVERLAY_SIZE_MAX),
  volume: parseNumberIn(Limits.VOLUME_MIN, Limits.VOLUME_MAX),
  launchAtLogin: parseBoolean,
});

/**
 * Filters a renderer-supplied patch down to valid, user-settable values.
 * @param {Record<string, unknown>} patch - Untrusted partial settings.
 * @returns {Partial<import('../../shared/types.js').Settings>} Accepted, cleaned values only.
 */
export function sanitizePatch(patch) {
  const accepted = {};
  for (const [key, value] of Object.entries(patch || {})) {
    const parsed = USER_SETTABLE[key]?.(value);
    if (parsed !== undefined) accepted[key] = parsed;
  }
  return accepted;
}

/**
 * Builds complete settings from whatever was read from disk. Valid saved values are
 * kept, everything else falls back to the defaults, and settings from other versions
 * that no longer exist are dropped.
 * @param {unknown} raw - Parsed file contents (null when the file is missing or unreadable).
 * @returns {import('../../shared/types.js').Settings} Complete settings.
 */
export function migrateSettings(raw) {
  const saved = /** @type {Record<string, any>} */ (raw && typeof raw === 'object' ? raw : {});
  const settings = { ...structuredClone(DEFAULT_SETTINGS), ...sanitizePatch(saved) };
  // A damaged entry should cost only itself, not every other reminder.
  if (Array.isArray(saved.reminders)) settings.reminders = normalizeReminders(saved.reminders).valid;
  if (Number.isFinite(saved.pausedUntil) && saved.pausedUntil > 0) settings.pausedUntil = saved.pausedUntil;
  if (typeof saved.hasShownTrayHint === 'boolean') settings.hasShownTrayHint = saved.hasShownTrayHint;
  return settings;
}
