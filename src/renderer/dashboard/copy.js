/**
 * @file User-facing labels and descriptions for the dashboard.
 */

import { OverlayPosition, SoundId } from '../../shared/constants.js';

export const SOUND_OPTIONS = Object.freeze([
  { value: SoundId.OFF, label: 'Silent' },
  { value: SoundId.TICK, label: 'Tick' },
  { value: SoundId.CHIME, label: 'Chime' },
  { value: SoundId.DROPLET, label: 'Droplet' },
  { value: SoundId.BELL, label: 'Bell' },
]);

/** Quick picks beside the interval stepper. */
export const INTERVAL_PRESETS = Object.freeze([
  { seconds: 10, label: '10 sec' },
  { seconds: 20, label: '20 sec' },
  { seconds: 60, label: '1 min' },
  { seconds: 5 * 60, label: '5 min' },
  { seconds: 20 * 60, label: '20 min' },
  { seconds: 30 * 60, label: '30 min' },
  { seconds: 60 * 60, label: '1 hour' },
]);

/** Positions in the order of the 3×3 picker, row by row. */
export const POSITION_OPTIONS = Object.freeze([
  { value: OverlayPosition.TOP_LEFT, label: 'Top left' },
  { value: OverlayPosition.TOP, label: 'Top' },
  { value: OverlayPosition.TOP_RIGHT, label: 'Top right' },
  { value: OverlayPosition.LEFT, label: 'Left' },
  { value: OverlayPosition.CENTER, label: 'Center' },
  { value: OverlayPosition.RIGHT, label: 'Right' },
  { value: OverlayPosition.BOTTOM_LEFT, label: 'Bottom left' },
  { value: OverlayPosition.BOTTOM, label: 'Bottom' },
  { value: OverlayPosition.BOTTOM_RIGHT, label: 'Bottom right' },
]);

/** Days in display order (Monday first) with their `Date#getDay` numbers. */
export const WEEK_DAYS = Object.freeze([
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 0, short: 'Sun', long: 'Sunday' },
]);

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * @param {number[]} days - Selected days (0 = Sunday).
 * @returns {string} Short description such as `weekdays` or `Mon, Wed, Fri`.
 */
function describeDays(days) {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === EVERY_DAY.length) return 'every day';
  if (sorted.join() === WEEKDAYS.join()) return 'weekdays';
  return WEEK_DAYS.filter(({ day }) => days.includes(day)).map(({ short }) => short).join(', ');
}

/**
 * @param {import('../../shared/types.js').ActiveHours} hours - Active hours.
 * @returns {string} Plain-language summary of the window.
 */
export function describeHours(hours) {
  const overnight = hours.start > hours.end;
  const range = `${hours.start} to ${hours.end}${overnight ? ' the next day' : ''}`;
  return `Reminders run from ${range} on ${describeDays(hours.days)}.`;
}
