/**
 * @file Decides whether the user is around to see a reminder. Checked only at the
 * moment a reminder falls due, so it costs nothing in between.
 */

import { AwayReason } from '../../shared/constants.js';

const SECONDS_PER_MINUTE = 60;

/** Combines the system's idle time and desktop state into a single "is anyone there" answer. */
export class Presence {
  /**
   * @param {object} sources
   * @param {() => number} sources.getIdleSeconds - Seconds since the last keyboard or mouse input.
   * @param {() => string | null} sources.getUserState - AwayReason.LOCKED, AwayReason.FULLSCREEN or null.
   */
  constructor({ getIdleSeconds, getUserState }) {
    this.getIdleSeconds = getIdleSeconds;
    this.getUserState = getUserState;
  }

  /**
   * @param {import('../../shared/types.js').Settings} settings - Current settings.
   * @returns {string | null} The AwayReason that should suppress a reminder now, or null to show it.
   */
  awayReason(settings) {
    const state = this.getUserState();
    // A locked screen shows nothing, whatever the settings say.
    if (state === AwayReason.LOCKED) return AwayReason.LOCKED;
    if (state === AwayReason.FULLSCREEN && settings.pauseInFullscreen) return AwayReason.FULLSCREEN;
    if (settings.pauseWhenIdle && this.getIdleSeconds() >= settings.idleMinutes * SECONDS_PER_MINUTE) return AwayReason.IDLE;
    return null;
  }
}
