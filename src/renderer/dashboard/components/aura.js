/**
 * @file The soft glow behind the home screen, which follows the time of day: peach at dawn,
 * sky blue by day, rose at dusk and indigo at night. Only the local clock is used.
 */

const REFRESH_MS = 10 * 60 * 1000;

/**
 * @param {number} hour - Local hour, 0–23.
 * @returns {'dawn' | 'day' | 'dusk' | 'night'} The part of the day.
 */
export function daypartFor(hour) {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

/**
 * Tints the page for the current time of day and keeps it up to date.
 * @returns {void}
 */
export function mountAura() {
  const apply = () => {
    document.body.dataset.daypart = daypartFor(new Date().getHours());
  };
  apply();
  setInterval(apply, REFRESH_MS);
  document.addEventListener('visibilitychange', apply);
}
