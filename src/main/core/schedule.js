/**
 * @file Decides whether reminders may run at a given moment: the master switch, a
 * pause, and the weekly active hours. Pure functions of settings and time, so they
 * are easy to test and the scheduler never has to poll.
 */

import { ScheduleStatus } from '../../shared/constants.js';

const MS_PER_MINUTE = 60_000;
const DAYS_PER_WEEK = 7;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * @typedef {object} OpenGate
 * @property {true} open
 * @property {number} [closesAt] - When the gate next closes on its own (end of the active hours).
 */

/**
 * @typedef {object} ClosedGate
 * @property {false} open
 * @property {string} reason - One of ScheduleStatus (never ACTIVE).
 * @property {number} resumeAt - When the gate reopens on its own; `Infinity` when only a settings change can.
 */

/** @typedef {OpenGate | ClosedGate} Gate */

/**
 * @param {string} value - Candidate `HH:MM` string.
 * @returns {boolean} True for a valid 24-hour clock time.
 */
export const isClock = (value) => typeof value === 'string' && CLOCK_PATTERN.test(value);

/**
 * @param {string} clock - Valid `HH:MM` string.
 * @returns {{ hours: number, minutes: number, total: number }} The time split and as minutes after midnight.
 */
function parseClock(clock) {
  const [, h, m] = /** @type {RegExpMatchArray} */ (CLOCK_PATTERN.exec(clock));
  return { hours: Number(h), minutes: Number(m), total: Number(h) * 60 + Number(m) };
}

/**
 * @param {Date} base - Reference day.
 * @param {number} dayOffset - Days after the reference day.
 * @param {string} clock - `HH:MM` time of day.
 * @returns {number} Epoch milliseconds of that local time (daylight-saving safe).
 */
function localTime(base, dayOffset, clock) {
  const { hours, minutes } = parseClock(clock);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hours, minutes, 0, 0).getTime();
}

/**
 * @param {number} now - Epoch milliseconds.
 * @param {import('../../shared/types.js').ActiveHours} hours - Active hours.
 * @returns {boolean} True when `now` falls inside the weekly window.
 */
export function isWithinHours(now, hours) {
  const date = new Date(now);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = parseClock(hours.start).total;
  const end = parseClock(hours.end).total;
  const today = hours.days.includes(date.getDay());
  if (start < end) return today && minutes >= start && minutes < end;
  if (start === end) return today;
  // The window runs past midnight, so the early hours belong to the previous day's window.
  const yesterday = hours.days.includes((date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK);
  return (today && minutes >= start) || (yesterday && minutes < end);
}

/**
 * @param {number} from - Epoch milliseconds to search after.
 * @param {import('../../shared/types.js').ActiveHours} hours - Active hours.
 * @returns {number} When the next window opens, or `Infinity` when no day is selected.
 */
export function nextWindowStart(from, hours) {
  const base = new Date(from);
  for (let offset = 0; offset <= DAYS_PER_WEEK; offset++) {
    const start = localTime(base, offset, hours.start);
    if (start > from && hours.days.includes(new Date(start).getDay())) return start;
  }
  return Infinity;
}

/**
 * @param {number} now - A moment inside the window.
 * @param {import('../../shared/types.js').ActiveHours} hours - Active hours.
 * @returns {number | undefined} When the current window ends, or undefined for an all-day window.
 */
function windowEnd(now, hours) {
  const date = new Date(now);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = parseClock(hours.start).total;
  const end = parseClock(hours.end).total;
  if (start === end) return undefined;
  if (start < end) return localTime(date, 0, hours.end);
  return localTime(date, minutes >= start ? 1 : 0, hours.end);
}

/**
 * @param {import('../../shared/types.js').Settings} settings - Current settings.
 * @param {number} now - Epoch milliseconds.
 * @returns {Gate} Whether reminders may run, and when that next changes.
 */
export function getGate(settings, now) {
  if (!settings.enabled) return { open: false, reason: ScheduleStatus.OFF, resumeAt: Infinity };
  if (settings.pausedUntil > now) return { open: false, reason: ScheduleStatus.PAUSED, resumeAt: settings.pausedUntil };
  const hours = settings.activeHours;
  if (!hours.enabled) return { open: true };
  if (!isWithinHours(now, hours)) {
    return { open: false, reason: ScheduleStatus.OUTSIDE_HOURS, resumeAt: nextWindowStart(now, hours) };
  }
  return { open: true, closesAt: windowEnd(now, hours) };
}

/**
 * @param {import('../../shared/catalog.js').PauseOption} option - Chosen pause length.
 * @param {number} now - Epoch milliseconds.
 * @returns {number} When the pause ends: after the chosen minutes, or at the next local midnight.
 */
export function pauseEnd(option, now) {
  if (option.minutes !== null) return now + option.minutes * MS_PER_MINUTE;
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}
