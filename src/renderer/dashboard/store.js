/**
 * @file Dashboard state container. Pages subscribe to the slices they render, and
 * settings changes go through `saveSettings` so every page stays in sync.
 */

import { Invoke } from '../../shared/constants.js';
import { api } from '../shared/bridge.js';
import { showError } from './ui/toast.js';

/**
 * @typedef {object} DashboardState
 * @property {import('../../shared/types.js').Settings | null} settings
 * @property {import('../../shared/types.js').RuntimeState | null} runtime
 * @property {{ version: string, platform: string, icon: string, settingsPath: string, fullscreenSupported: boolean } | null} info
 */

/** @typedef {keyof DashboardState} StateKey */

/** Holds dashboard state and notifies the pages that render each part of it. */
export class Store {
  constructor() {
    /** @type {DashboardState} */
    this.state = { settings: null, runtime: null, info: null };
    /** @type {{ keys: StateKey[], listener: (state: DashboardState) => void }[]} */
    this.subscribers = [];
  }

  /**
   * Merges new values and notifies subscribers of the changed keys.
   * @param {Partial<DashboardState>} patch - New values.
   * @returns {void}
   */
  set(patch) {
    this.state = { ...this.state, ...patch };
    const changed = Object.keys(patch);
    for (const { keys, listener } of this.subscribers) {
      if (keys.some((k) => changed.includes(k))) listener(this.state);
    }
  }

  /**
   * Calls `listener` now and whenever any of `keys` changes.
   * @param {StateKey[]} keys - State slices the listener depends on.
   * @param {(state: DashboardState) => void} listener - Render function.
   * @returns {void}
   */
  subscribe(keys, listener) {
    this.subscribers.push({ keys, listener });
    listener(this.state);
  }

  /**
   * Saves a settings change. The UI updates immediately; on failure it rolls back
   * and explains what went wrong.
   * @param {Partial<import('../../shared/types.js').Settings>} patch - Values to change.
   * @returns {Promise<boolean>} True when the change was saved.
   */
  async saveSettings(patch) {
    const previous = this.state.settings;
    this.set({ settings: { ...previous, ...patch } });
    try {
      this.set({ settings: await api.invoke(Invoke.SETTINGS_SET, patch) });
      return true;
    } catch (err) {
      this.set({ settings: previous });
      showError("Couldn't save that change", err);
      return false;
    }
  }

  /**
   * Pauses reminders, or resumes them.
   * @param {string | null} optionId - One of PAUSE_OPTIONS, or null to resume.
   * @returns {Promise<void>}
   */
  async pause(optionId) {
    try {
      this.set({ runtime: await api.invoke(Invoke.PAUSE, optionId) });
    } catch (err) {
      showError(optionId === null ? "Couldn't resume reminders" : "Couldn't pause reminders", err);
    }
  }

  /**
   * Re-reads the schedule state from the main process.
   * @returns {Promise<void>}
   */
  async refreshRuntime() {
    try {
      this.set({ runtime: await api.invoke(Invoke.RUNTIME_GET) });
    } catch {
      // The next push brings the state up to date.
    }
  }
}
