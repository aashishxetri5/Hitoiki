/**
 * @file System tray icon and menu.
 */

import { Menu, Tray } from 'electron';
import { PAUSE_OPTIONS } from '../../shared/catalog.js';
import { APP_NAME, ScheduleStatus } from '../../shared/constants.js';
import { describeSchedule, formatInterval } from '../../shared/format.js';
import { IS_MAC } from '../constants.js';
import { trayIcon } from './app-icons.js';

/**
 * @typedef {object} TrayActions
 * @property {() => void} openDashboard
 * @property {(enabled: boolean) => void} setEnabled - Master switch.
 * @property {(id: string, enabled: boolean) => void} setReminderEnabled - Switches one reminder.
 * @property {(optionId: string) => void} pause - Pauses for one of PAUSE_OPTIONS.
 * @property {() => void} resume
 * @property {() => void} quit
 */

/** The tray icon, its tooltip and its menu. */
export class TrayController {
  /**
   * @param {TrayActions} actions - Menu callbacks.
   */
  constructor(actions) {
    this.actions = actions;
    this.tray = new Tray(trayIcon());
    // On macOS a click opens the menu instead.
    if (!IS_MAC) this.tray.on('click', actions.openDashboard);
  }

  /**
   * Rebuilds the icon, tooltip and menu.
   * @param {object} state
   * @param {import('../../shared/types.js').Settings} state.settings - Current settings.
   * @param {import('../../shared/types.js').RuntimeState} state.runtime - What the schedule is doing.
   * @returns {void}
   */
  update({ settings, runtime }) {
    const { actions } = this;
    const status = describeSchedule(runtime);
    const paused = runtime.status === ScheduleStatus.PAUSED;
    this.tray.setImage(trayIcon(runtime.status !== ScheduleStatus.ACTIVE));
    this.tray.setToolTip(`${APP_NAME}: ${status}`);

    const reminderItems = settings.reminders.length
      ? settings.reminders.map((r) => ({
        label: `${r.name}  ·  ${formatInterval(r.intervalSec)}`,
        type: 'checkbox',
        checked: r.enabled,
        click: () => actions.setReminderEnabled(r.id, !r.enabled),
      }))
      : [{ label: 'No reminders yet', enabled: false }];

    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: status, enabled: false },
      { type: 'separator' },
      { label: `Open ${APP_NAME}`, click: actions.openDashboard },
      { label: 'Reminders On', type: 'checkbox', checked: settings.enabled, click: () => actions.setEnabled(!settings.enabled) },
      paused
        ? { label: 'Resume Now', click: actions.resume }
        : { label: 'Pause For', submenu: PAUSE_OPTIONS.map((o) => ({ label: o.label, click: () => actions.pause(o.id) })) },
      { label: 'Reminders', submenu: reminderItems },
      { type: 'separator' },
      { label: `Quit ${APP_NAME}`, click: actions.quit },
    ]));
  }

  /**
   * Shows a one-off balloon (Windows only).
   * @param {string} title - Balloon title.
   * @param {string} content - Balloon text.
   * @returns {void}
   */
  balloon(title, content) {
    this.tray.displayBalloon({ iconType: 'info', title, content });
  }
}
