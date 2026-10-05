/**
 * @file Runs reminders on their intervals using a single timer that always points at
 * the next thing that needs to happen (the earliest reminder, or the moment the
 * schedule opens or closes). When nothing is due the process is simply asleep.
 */

import { EventEmitter } from 'node:events';
import { ScheduleStatus } from '../../shared/constants.js';

/** The longest delay `setTimeout` accepts. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Timers can fire a hair early; anything due within this window counts as due. */
const SLACK_MS = 5;

/**
 * @typedef {object} Entry
 * @property {import('../../shared/types.js').Reminder} reminder
 * @property {number} dueAt - Epoch milliseconds of the next occurrence.
 */

/**
 * Emits:
 * - `due` with a reminder whenever it is time to show it;
 * - `state` with a ScheduleStatus when the schedule opens or closes;
 * - `schedule` after any change to upcoming times.
 */
export class Scheduler extends EventEmitter {
  /**
   * @param {object} options
   * @param {(now: number) => import('./schedule.js').Gate} options.getGate - Tells whether reminders may run.
   * @param {() => number} [options.now] - Clock, replaceable in tests.
   * @param {(fn: () => void, ms: number) => any} [options.setTimer] - Timer start, replaceable in tests.
   * @param {(handle: any) => void} [options.clearTimer] - Timer cancel, replaceable in tests.
   */
  constructor({ getGate, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    super();
    this.getGate = getGate;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    /** @type {Map<string, Entry>} */
    this.entries = new Map();
    this.timer = null;
    this.suspended = false;
    /** @type {string | null} */
    this.status = null;
  }

  /**
   * Replaces the set of reminders. Switched-off reminders are not scheduled, and a
   * reminder whose interval is unchanged keeps its place in the countdown.
   * @param {import('../../shared/types.js').Reminder[]} reminders - All reminders.
   * @returns {void}
   */
  setReminders(reminders) {
    const now = this.now();
    const next = new Map();
    for (const reminder of reminders) {
      if (!reminder.enabled) continue;
      const previous = this.entries.get(reminder.id);
      const keepsPlace = previous && previous.reminder.intervalSec === reminder.intervalSec;
      next.set(reminder.id, { reminder, dueAt: keepsPlace ? previous.dueAt : now + reminder.intervalSec * 1000 });
    }
    this.entries = next;
    this.refresh();
  }

  /**
   * Re-evaluates the gate and the timer. Call after any change to settings that
   * affect the gate (master switch, pause, active hours).
   * @returns {void}
   */
  refresh() {
    this.arm();
    this.emit('schedule');
  }

  /**
   * Restarts every countdown from now, for example after the computer wakes up, so
   * reminders that fell due while it slept do not all appear at once.
   * @returns {void}
   */
  restart() {
    this.resetCountdowns(this.now());
    this.refresh();
  }

  /**
   * Cancels the timer. The scheduler can be started again with `refresh()`.
   * @returns {void}
   */
  stop() {
    this.clearTimer(this.timer);
    this.timer = null;
  }

  /** @returns {Record<string, number>} Next occurrence of each scheduled reminder (empty while suspended). */
  nextDue() {
    if (this.suspended) return {};
    return Object.fromEntries([...this.entries].map(([id, entry]) => [id, entry.dueAt]));
  }

  /**
   * @param {number} now - Epoch milliseconds.
   * @returns {void}
   */
  resetCountdowns(now) {
    for (const entry of this.entries.values()) entry.dueAt = now + entry.reminder.intervalSec * 1000;
  }

  /** @returns {number} Earliest next occurrence, or `Infinity` when nothing is scheduled. */
  earliestDue() {
    let earliest = Infinity;
    for (const { dueAt } of this.entries.values()) earliest = Math.min(earliest, dueAt);
    return earliest;
  }

  /**
   * Points the single timer at whatever happens next.
   * @returns {void}
   */
  arm() {
    this.stop();
    const now = this.now();
    const gate = this.getGate(now);

    // Coming back from any suspension restarts every countdown.
    if (gate.open && this.suspended) this.resetCountdowns(now);
    this.suspended = !gate.open;
    this.setStatus(gate.open ? ScheduleStatus.ACTIVE : gate.reason);

    const wakeAt = gate.open ? Math.min(this.earliestDue(), gate.closesAt ?? Infinity) : gate.resumeAt;
    if (!Number.isFinite(wakeAt)) return;
    this.timer = this.setTimer(() => this.onTimer(), Math.min(MAX_TIMEOUT_MS, Math.max(0, wakeAt - now)));
  }

  /**
   * @param {string} status - One of ScheduleStatus.
   * @returns {void}
   */
  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    this.emit('state', status);
  }

  /**
   * Fires everything that is due, then schedules the next wake-up.
   * @returns {void}
   */
  onTimer() {
    this.timer = null;
    const now = this.now();
    if (this.getGate(now).open) {
      const due = [...this.entries.values()].filter((entry) => entry.dueAt <= now + SLACK_MS).sort((a, b) => a.dueAt - b.dueAt);
      for (const entry of due) {
        // The next occurrence counts from now, so a late timer never causes a catch-up burst.
        entry.dueAt = now + entry.reminder.intervalSec * 1000;
        this.emitDue(entry.reminder);
      }
    }
    this.refresh();
  }

  /**
   * Notifies listeners without letting one failure stop the schedule.
   * @param {import('../../shared/types.js').Reminder} reminder - Reminder that is due.
   * @returns {void}
   */
  emitDue(reminder) {
    try {
      this.emit('due', reminder);
    } catch (err) {
      console.error(`Reminder "${reminder.name}" failed:`, err);
    }
  }
}
