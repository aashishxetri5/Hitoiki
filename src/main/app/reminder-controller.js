/**
 * @file Connects the scheduler to the rest of the app: when a reminder falls due it
 * checks the user is around and asks the overlay to show it. Also owns pausing.
 */

import { EventEmitter } from 'node:events';
import { PAUSE_OPTIONS } from '../../shared/catalog.js';
import { ScheduleStatus } from '../../shared/constants.js';
import { buildShowRequest } from '../core/reminder.js';
import { getGate, pauseEnd } from '../core/schedule.js';
import { Scheduler } from '../core/scheduler.js';

/** Settings that decide whether the schedule runs at all. */
const GATE_SETTINGS = ['enabled', 'pausedUntil', 'activeHours'];

/**
 * Emits:
 * - `status` when the schedule starts or stops (paused, outside hours, switched off…);
 * - `change` whenever the upcoming times change.
 */
export class ReminderController extends EventEmitter {
  /**
   * @param {object} deps
   * @param {import('../settings/settings-service.js').SettingsService} deps.settings
   * @param {import('../services/presence.js').Presence} deps.presence - Tells whether the user is around.
   * @param {import('../windows/overlay-window.js').OverlayWindow} deps.overlay - Shows reminders on screen.
   */
  constructor({ settings, presence, overlay }) {
    super();
    this.settings = settings;
    this.presence = presence;
    this.overlay = overlay;
    this.scheduler = new Scheduler({ getGate: (now) => getGate(this.settings.get(), now) });
    this.scheduler.on('due', (reminder) => this.onDue(reminder));
    this.scheduler.on('state', () => this.emit('status'));
    this.scheduler.on('schedule', () => this.emit('change'));
    this.settings.on('change', (keys) => this.onSettingsChange(keys));
  }

  /**
   * Starts the schedule from the saved reminders.
   * @returns {void}
   */
  start() {
    this.scheduler.setReminders(this.settings.get().reminders);
  }

  /**
   * Stops the schedule.
   * @returns {void}
   */
  stop() {
    this.scheduler.stop();
  }

  /**
   * Restarts every countdown, for when the computer wakes or unlocks.
   * @returns {void}
   */
  wake() {
    this.scheduler.restart();
  }

  /** @returns {import('../../shared/types.js').RuntimeState} What the schedule is doing right now. */
  state() {
    const now = Date.now();
    const { pausedUntil } = this.settings.get();
    const gate = getGate(this.settings.get(), now);
    return {
      status: gate.open ? ScheduleStatus.ACTIVE : gate.reason,
      pausedUntil: pausedUntil > now ? pausedUntil : 0,
      resumeAt: !gate.open && Number.isFinite(gate.resumeAt) ? gate.resumeAt : 0,
      nextDue: this.scheduler.nextDue(),
    };
  }

  /**
   * Pauses all reminders.
   * @param {string} optionId - Id of one of PAUSE_OPTIONS.
   * @returns {boolean} False when the option is unknown.
   */
  pause(optionId) {
    const option = PAUSE_OPTIONS.find((o) => o.id === optionId);
    if (!option) return false;
    this.settings.set({ pausedUntil: pauseEnd(option, Date.now()) });
    return true;
  }

  /**
   * Ends a pause early.
   * @returns {void}
   */
  resume() {
    this.settings.set({ pausedUntil: 0 });
  }

  /**
   * Shows a reminder right now, ignoring the schedule and whether the user is around.
   * @param {import('../../shared/types.js').Reminder} reminder - Reminder to show.
   * @returns {void}
   */
  preview(reminder) {
    this.show(reminder);
  }

  /**
   * @param {string[]} keys - Settings that changed.
   * @returns {void}
   */
  onSettingsChange(keys) {
    if (keys.includes('reminders')) this.scheduler.setReminders(this.settings.get().reminders);
    else if (keys.some((key) => GATE_SETTINGS.includes(key))) this.scheduler.refresh();
  }

  /**
   * @param {import('../../shared/types.js').Reminder} reminder - Reminder that fell due.
   * @returns {void}
   */
  onDue(reminder) {
    if (this.presence.awayReason(this.settings.get())) return;
    this.show(reminder);
  }

  /**
   * @param {import('../../shared/types.js').Reminder} reminder - Reminder to display.
   * @returns {void}
   */
  show(reminder) {
    const { volume, overlayPosition, overlaySize } = this.settings.get();
    this.overlay.show(buildShowRequest(reminder, volume), { position: overlayPosition, scale: overlaySize });
  }
}
