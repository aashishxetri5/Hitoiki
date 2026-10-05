import assert from 'node:assert/strict';
import test from 'node:test';
import { PAUSE_OPTIONS } from '../src/shared/catalog.js';
import { ScheduleStatus } from '../src/shared/constants.js';
import {
  getGate, isClock, isWithinHours, nextWindowStart, pauseEnd,
} from '../src/main/core/schedule.js';

/** Local time helper: month is 1-based. */
const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm, 0, 0).getTime();

// 2026-10-05 is a Monday.
const WEEKDAYS = { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
const OVERNIGHT = { enabled: true, start: '22:00', end: '06:00', days: [5] };

const settings = (overrides = {}) => ({
  enabled: true, pausedUntil: 0, activeHours: { ...WEEKDAYS, enabled: false }, ...overrides,
});

test('clock strings are validated', () => {
  assert.equal(isClock('09:30'), true);
  assert.equal(isClock('24:00'), false);
  assert.equal(isClock('9:30'), false);
  assert.equal(isClock(930), false);
});

test('the window covers weekday working hours only', () => {
  assert.equal(isWithinHours(at(2026, 10, 5, 9, 0), WEEKDAYS), true);
  assert.equal(isWithinHours(at(2026, 10, 5, 17, 59), WEEKDAYS), true);
  assert.equal(isWithinHours(at(2026, 10, 5, 18, 0), WEEKDAYS), false);
  assert.equal(isWithinHours(at(2026, 10, 5, 8, 59), WEEKDAYS), false);
  assert.equal(isWithinHours(at(2026, 10, 3, 12, 0), WEEKDAYS), false, 'Saturday');
});

test('a window that runs past midnight belongs to the day it starts on', () => {
  assert.equal(isWithinHours(at(2026, 10, 9, 23, 0), OVERNIGHT), true, 'Friday night');
  assert.equal(isWithinHours(at(2026, 10, 10, 5, 59), OVERNIGHT), true, 'early Saturday');
  assert.equal(isWithinHours(at(2026, 10, 10, 6, 0), OVERNIGHT), false);
  assert.equal(isWithinHours(at(2026, 10, 10, 23, 0), OVERNIGHT), false, 'Saturday night is not selected');
  assert.equal(isWithinHours(at(2026, 10, 9, 5, 0), OVERNIGHT), false, 'early Friday follows Thursday');
});

test('the next window start skips unselected days', () => {
  assert.equal(nextWindowStart(at(2026, 10, 5, 19, 0), WEEKDAYS), at(2026, 10, 6, 9, 0));
  assert.equal(nextWindowStart(at(2026, 10, 9, 19, 0), WEEKDAYS), at(2026, 10, 12, 9, 0), 'Friday evening → Monday');
  assert.equal(nextWindowStart(at(2026, 10, 5, 7, 0), WEEKDAYS), at(2026, 10, 5, 9, 0), 'same day, before opening');
  assert.equal(nextWindowStart(at(2026, 10, 5, 12, 0), { ...WEEKDAYS, days: [] }), Infinity);
});

test('the gate reports the master switch first, then pauses, then hours', () => {
  const now = at(2026, 10, 5, 12, 0);
  assert.deepEqual(getGate(settings({ enabled: false }), now), { open: false, reason: ScheduleStatus.OFF, resumeAt: Infinity });
  assert.deepEqual(getGate(settings({ pausedUntil: now + 60_000 }), now), { open: false, reason: ScheduleStatus.PAUSED, resumeAt: now + 60_000 });
  assert.deepEqual(getGate(settings(), now), { open: true });
  assert.deepEqual(getGate(settings({ pausedUntil: now - 1 }), now), { open: true }, 'an expired pause is ignored');
});

test('inside active hours the gate knows when it closes', () => {
  const now = at(2026, 10, 5, 12, 0);
  const gate = getGate(settings({ activeHours: WEEKDAYS }), now);
  assert.deepEqual(gate, { open: true, closesAt: at(2026, 10, 5, 18, 0) });

  const night = getGate(settings({ activeHours: OVERNIGHT }), at(2026, 10, 9, 23, 0));
  assert.deepEqual(night, { open: true, closesAt: at(2026, 10, 10, 6, 0) });
  const earlyMorning = getGate(settings({ activeHours: OVERNIGHT }), at(2026, 10, 10, 2, 0));
  assert.deepEqual(earlyMorning, { open: true, closesAt: at(2026, 10, 10, 6, 0) });
});

test('outside active hours the gate points at the next opening', () => {
  const now = at(2026, 10, 5, 20, 0);
  assert.deepEqual(getGate(settings({ activeHours: WEEKDAYS }), now), {
    open: false, reason: ScheduleStatus.OUTSIDE_HOURS, resumeAt: at(2026, 10, 6, 9, 0),
  });
});

test('pausing for a number of minutes or until the next midnight', () => {
  const now = at(2026, 10, 5, 15, 30);
  const byId = (id) => PAUSE_OPTIONS.find((o) => o.id === id);
  assert.equal(pauseEnd(byId('15m'), now), now + 15 * 60_000);
  assert.equal(pauseEnd(byId('1h'), now), now + 60 * 60_000);
  assert.equal(pauseEnd(byId('today'), now), at(2026, 10, 6, 0, 0));
});
