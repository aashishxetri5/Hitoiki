import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayBounds } from '../src/main/core/placement.js';
import {
  formatCountdown, formatInterval, formatTimer, splitInterval,
} from '../src/shared/format.js';

test('intervals use the largest unit that divides evenly', () => {
  assert.deepEqual(splitInterval(4), { value: 4, unit: 'seconds' });
  assert.deepEqual(splitInterval(1800), { value: 30, unit: 'minutes' });
  assert.deepEqual(splitInterval(7200), { value: 2, unit: 'hours' });
  assert.deepEqual(splitInterval(90), { value: 90, unit: 'seconds' });
  assert.deepEqual(splitInterval(5400), { value: 90, unit: 'minutes' });
});

test('intervals read naturally', () => {
  assert.equal(formatInterval(4), 'Every 4 seconds');
  assert.equal(formatInterval(1), 'Every second');
  assert.equal(formatInterval(60), 'Every minute');
  assert.equal(formatInterval(1800), 'Every 30 minutes');
  assert.equal(formatInterval(3600), 'Every hour');
});

test('countdowns are compact', () => {
  assert.equal(formatCountdown(0), '0s');
  assert.equal(formatCountdown(45_000), '45s');
  assert.equal(formatCountdown(245_000), '4m 05s');
  assert.equal(formatCountdown(3_720_000), '1h 02m');
  assert.equal(formatCountdown(1), '1s', 'partial seconds round up');
  assert.equal(formatCountdown(-5), '0s');
});

test('timers read like a clock', () => {
  assert.equal(formatTimer(0), '0:00');
  assert.equal(formatTimer(4_000), '0:04');
  assert.equal(formatTimer(724_000), '12:04');
  assert.equal(formatTimer(3_729_000), '1:02:09');
  assert.equal(formatTimer(1_001), '0:02', 'partial seconds round up');
  assert.equal(formatTimer(-1), '0:00');
});

const AREA = { x: 100, y: 50, width: 1920, height: 1030 };

test('the reminder is centred or pinned to an edge with a margin', () => {
  const center = overlayBounds(AREA, 'center', 1);
  assert.deepEqual(center, { x: 100 + (1920 - 520) / 2, y: 50 + (1030 - 480) / 2, width: 520, height: 480 });
  assert.equal(overlayBounds(AREA, 'top-left', 1).x, 124);
  assert.equal(overlayBounds(AREA, 'top-left', 1).y, 74);
  assert.equal(overlayBounds(AREA, 'bottom-right', 1).x, 100 + 1920 - 520 - 24);
  assert.equal(overlayBounds(AREA, 'bottom-right', 1).y, 50 + 1030 - 480 - 24);
  assert.equal(overlayBounds(AREA, 'top', 1).x, center.x);
});

test('size scales the window and never exceeds the display', () => {
  assert.equal(overlayBounds(AREA, 'center', 1.5).width, 780);
  const tiny = overlayBounds({ x: 0, y: 0, width: 400, height: 300 }, 'center', 1.6);
  assert.deepEqual([tiny.width, tiny.height], [400, 300]);
  assert.equal(overlayBounds(AREA, 'nonsense', 1).x, center(AREA).x);
});

/** @returns {{ x: number }} Expected centred x for the default size. */
function center(area) {
  return { x: area.x + Math.round((area.width - 520) / 2) };
}
