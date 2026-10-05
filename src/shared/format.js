/**
 * @file Pure formatting helpers for intervals, countdowns, clock times and the
 * schedule status line.
 */

import { ScheduleStatus } from './constants.js';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Units an interval can be entered in, largest first. */
export const INTERVAL_UNITS = Object.freeze([
  { id: 'hours', label: 'hours', seconds: SECONDS_PER_HOUR },
  { id: 'minutes', label: 'minutes', seconds: SECONDS_PER_MINUTE },
  { id: 'seconds', label: 'seconds', seconds: 1 },
]);

/**
 * Splits seconds into the largest unit that divides them evenly, so 1800 reads as
 * "30 minutes" and 90 as "90 seconds".
 * @param {number} seconds - Interval length.
 * @returns {{ value: number, unit: string }} Amount and unit id (see INTERVAL_UNITS).
 */
export function splitInterval(seconds) {
  const unit = INTERVAL_UNITS.find((u) => seconds % u.seconds === 0) ?? INTERVAL_UNITS[INTERVAL_UNITS.length - 1];
  return { value: seconds / unit.seconds, unit: unit.id };
}

/**
 * @param {number} seconds - Interval length.
 * @returns {string} Human description, e.g. `Every 30 minutes` or `Every second`.
 */
export function formatInterval(seconds) {
  const { value, unit } = splitInterval(seconds);
  const singular = INTERVAL_UNITS.find((u) => u.id === unit).label.slice(0, -1);
  return value === 1 ? `Every ${singular}` : `Every ${value} ${singular}s`;
}

/**
 * @param {number} ms - Time remaining.
 * @returns {string} Compact countdown such as `45s`, `4m 05s` or `1h 02m`.
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/**
 * @param {number} fraction - Value from 0 to 1 (or beyond).
 * @returns {string} The value as a whole percentage, e.g. `70%`.
 */
export function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * @param {number} timestamp - Milliseconds since the epoch.
 * @returns {string} Local time of day, e.g. `3:40 PM`.
 */
export function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * @param {import('./types.js').RuntimeState} runtime - What the schedule is doing.
 * @returns {string} One-line description, e.g. `Paused until 3:40 PM`.
 */
export function describeSchedule(runtime) {
  switch (runtime.status) {
    case ScheduleStatus.PAUSED:
      return `Paused until ${formatClock(runtime.pausedUntil)}`;
    case ScheduleStatus.OUTSIDE_HOURS:
      return runtime.resumeAt ? `Outside active hours, resumes ${formatClock(runtime.resumeAt)}` : 'Outside active hours';
    case ScheduleStatus.OFF:
      return 'Reminders are off';
    default:
      return 'Reminders are on';
  }
}
