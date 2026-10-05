import assert from 'node:assert/strict';
import test from 'node:test';
import { Scheduler } from '../src/main/core/scheduler.js';
import { ScheduleStatus } from '../src/shared/constants.js';

/** A manual clock and timer so tests control time exactly. */
function createHarness(initialGate = { open: true }) {
  const state = { now: 1_000_000, gate: initialGate, timer: null };
  const scheduler = new Scheduler({
    getGate: () => state.gate,
    now: () => state.now,
    setTimer: (fn, ms) => {
      state.timer = { fn, at: state.now + ms };
      return state.timer;
    },
    clearTimer: (handle) => {
      if (state.timer === handle) state.timer = null;
    },
  });
  const fired = [];
  scheduler.on('due', (reminder) => fired.push(reminder.id));
  /** Moves time forward and runs the pending timer if it is due. */
  const advance = (ms) => {
    state.now += ms;
    if (state.timer && state.timer.at <= state.now) {
      const { fn } = state.timer;
      state.timer = null;
      fn();
    }
  };
  return { state, scheduler, fired, advance };
}

const reminder = (id, intervalSec, enabled = true) => ({ id, name: id, message: '', scene: 'blink', icon: 'eye', intervalSec, durationSec: 1, sound: 'off', enabled });

test('a reminder fires after its interval and then repeats', () => {
  const { scheduler, fired, advance } = createHarness();
  scheduler.setReminders([reminder('a', 4)]);
  advance(3999);
  assert.deepEqual(fired, []);
  advance(1);
  assert.deepEqual(fired, ['a']);
  advance(4000);
  assert.deepEqual(fired, ['a', 'a']);
});

test('a single timer always points at the earliest reminder', () => {
  const { state, scheduler, advance } = createHarness();
  scheduler.setReminders([reminder('slow', 60), reminder('fast', 5)]);
  assert.equal(state.timer.at, state.now + 5000);
  advance(5000);
  assert.equal(state.timer.at, state.now + 5000);
});

test('switched-off reminders are not scheduled', () => {
  const { state, scheduler } = createHarness();
  scheduler.setReminders([reminder('off', 5, false)]);
  assert.equal(state.timer, null);
  assert.deepEqual(scheduler.nextDue(), {});
});

test('editing a reminder keeps its countdown unless the interval changes', () => {
  const { state, scheduler, fired, advance } = createHarness();
  scheduler.setReminders([reminder('a', 10)]);
  advance(6000);
  scheduler.setReminders([{ ...reminder('a', 10), name: 'Renamed' }]);
  advance(4000);
  assert.deepEqual(fired, ['a']);

  scheduler.setReminders([reminder('a', 30)]);
  assert.equal(scheduler.nextDue().a, state.now + 30_000);
});

test('late timers do not cause a burst of catch-up reminders', () => {
  const { scheduler, fired, advance } = createHarness();
  scheduler.setReminders([reminder('a', 4)]);
  advance(60_000);
  assert.deepEqual(fired, ['a']);
});

test('a closed gate keeps reminders silent and countdowns restart when it reopens', () => {
  const { state, scheduler, fired, advance } = createHarness();
  scheduler.setReminders([reminder('a', 10)]);
  const states = [];
  scheduler.on('state', (status) => states.push(status));

  state.gate = { open: false, reason: ScheduleStatus.PAUSED, resumeAt: state.now + 60_000 };
  scheduler.refresh();
  assert.equal(state.timer.at, state.now + 60_000);
  advance(60_000);
  assert.deepEqual(fired, []);

  state.gate = { open: true };
  scheduler.refresh();
  assert.equal(scheduler.nextDue().a, state.now + 10_000);
  assert.deepEqual(states, [ScheduleStatus.PAUSED, ScheduleStatus.ACTIVE]);
});

test('an unbounded closed gate sets no timer', () => {
  const { state, scheduler } = createHarness({ open: false, reason: ScheduleStatus.OFF, resumeAt: Infinity });
  scheduler.setReminders([reminder('a', 5)]);
  assert.equal(state.timer, null);
});

test('the timer wakes when the active hours end', () => {
  const { state, scheduler, advance } = createHarness();
  state.gate = { open: true, closesAt: state.now + 3000 };
  scheduler.setReminders([reminder('a', 60)]);
  assert.equal(state.timer.at, state.now + 3000);
  state.gate = { open: false, reason: ScheduleStatus.OUTSIDE_HOURS, resumeAt: state.now + 50_000 };
  advance(3000);
  assert.equal(scheduler.status, ScheduleStatus.OUTSIDE_HOURS);
});

test('restart pushes every countdown a full interval ahead', () => {
  const { state, scheduler, advance } = createHarness();
  scheduler.setReminders([reminder('a', 10)]);
  advance(9000);
  scheduler.restart();
  assert.equal(scheduler.nextDue().a, state.now + 10_000);
});

test('a failing listener does not stop the schedule', () => {
  const { scheduler, fired, advance } = createHarness();
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    scheduler.prependListener('due', () => {
      throw new Error('boom');
    });
    scheduler.setReminders([reminder('a', 2)]);
    advance(2000);
    advance(2000);
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 2);
  assert.equal(fired.length, 0, 'later listeners do not run after a throw, but the schedule continues');
});
