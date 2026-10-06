/**
 * @file The settings window. Closing it destroys it, which frees its memory; the app
 * keeps running in the tray and the window is rebuilt from the main process's state
 * the next time it is opened.
 *
 * The native title bar is hidden so the page can draw its own header; the system still
 * draws the window buttons, tinted to match the page and the system theme.
 */

import { app, nativeTheme } from 'electron';
import { APP_NAME } from '../../shared/constants.js';
import {
  DashboardTheme, DashboardWindowSize, IS_MAC, Paths,
} from '../constants.js';
import { appIcon } from './app-icons.js';
import { createWindow, sendTo, WindowRole } from './window-factory.js';

/** @returns {{ background: string, symbol: string }} Frame colours for the current system theme. */
const currentTheme = () => DashboardTheme[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'];

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
    const { win } = this;
    // Forgetting the window first tells the `closed` handler this was not the user.
    this.win = null;
    if (win && !win.isDestroyed()) win.destroy();
  }

  /**
   * @returns {void}
   */
  create() {
    const theme = currentTheme();
    const win = createWindow({
      width: DashboardWindowSize.WIDTH,
      height: DashboardWindowSize.HEIGHT,
      minWidth: DashboardWindowSize.MIN_WIDTH,
      minHeight: DashboardWindowSize.MIN_HEIGHT,
      title: APP_NAME,
      icon: appIcon(),
      backgroundColor: theme.background,
      autoHideMenuBar: true,
      show: false,
      titleBarStyle: 'hidden',
      ...(IS_MAC
        ? { trafficLightPosition: { x: 22, y: (DashboardWindowSize.TITLE_BAR_HEIGHT - 14) / 2 } }
        : { titleBarOverlay: { color: theme.background, symbolColor: theme.symbol, height: DashboardWindowSize.TITLE_BAR_HEIGHT } }),
    }, { label: 'dashboard', role: WindowRole.DASHBOARD });
    win.removeMenu();
    win.loadFile(Paths.DASHBOARD_HTML);
    win.once('ready-to-show', () => win.show());

    // Keep the frame in step with the system theme while the window is open.
    const applyTheme = () => {
      if (win.isDestroyed()) return;
      const next = currentTheme();
      win.setBackgroundColor(next.background);
      if (!IS_MAC) win.setTitleBarOverlay({ color: next.background, symbolColor: next.symbol });
    };
    nativeTheme.on('updated', applyTheme);

    win.on('closed', () => {
      nativeTheme.off('updated', applyTheme);
      if (this.win !== win) return;
      this.win = null;
      app.dock?.hide();
      this.onClose();
    });
    this.win = win;
  }
}
