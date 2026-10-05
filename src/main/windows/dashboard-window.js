/**
 * @file The settings window. Closing it destroys it, which frees its memory; the app
 * keeps running in the tray and the window is rebuilt from the main process's state
 * the next time it is opened.
 */

import { app } from 'electron';
import { APP_NAME } from '../../shared/constants.js';
import { DashboardWindowSize, Paths } from '../constants.js';
import { appIcon } from './app-icons.js';
import { createWindow, sendTo, WindowRole } from './window-factory.js';

/** The settings window, created on demand. */
export class DashboardWindow {
  /**
   * @param {object} options
   * @param {() => void} options.onClose - Called when the user closes the window.
   */
  constructor({ onClose }) {
    this.onClose = onClose;
    /** @type {Electron.BrowserWindow | null} */
    this.win = null;
  }

  /**
   * Shows the dashboard, creating it on first use.
   * @returns {void}
   */
  show() {
    app.dock?.show();
    if (!this.win || this.win.isDestroyed()) {
      this.create();
      return;
    }
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  /** @returns {boolean} True when the window is on screen. */
  isVisible() {
    return Boolean(this.win && !this.win.isDestroyed() && this.win.isVisible());
  }

  /**
   * Sends a message to the window if it is open.
   * @param {string} channel - Push channel.
   * @param {unknown} payload - Message body.
   * @returns {void}
   */
  send(channel, payload) {
    sendTo(this.win, channel, payload);
  }

  /**
   * Closes the window for good (used when the app quits).
   * @returns {void}
   */
  destroy() {
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }

  /**
   * @returns {void}
   */
  create() {
    const win = createWindow({
      width: DashboardWindowSize.WIDTH,
      height: DashboardWindowSize.HEIGHT,
      minWidth: DashboardWindowSize.MIN_WIDTH,
      minHeight: DashboardWindowSize.MIN_HEIGHT,
      title: APP_NAME,
      icon: appIcon(),
      backgroundColor: DashboardWindowSize.BACKGROUND,
      autoHideMenuBar: true,
      show: false,
    }, { label: 'dashboard', role: WindowRole.DASHBOARD });
    win.removeMenu();
    win.loadFile(Paths.DASHBOARD_HTML);
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => {
      if (this.win === win) this.win = null;
      app.dock?.hide();
      this.onClose();
    });
    this.win = win;
  }
}
