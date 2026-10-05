/**
 * @file The on-screen reminder: one small transparent, click-through, always-on-top
 * window that is created when a reminder needs it and destroyed again after a quiet
 * spell, so it holds no memory while nothing is happening. Reminders that fall due
 * together are shown one after another.
 */

import { screen } from 'electron';
import { Push } from '../../shared/constants.js';
import { MAX_QUEUED_REMINDERS, Paths, Timing } from '../constants.js';
import { overlayBounds } from '../core/placement.js';
import { createWindow, WindowRole } from './window-factory.js';

/**
 * @typedef {object} Placement
 * @property {string} position - One of OverlayPosition.
 * @property {number} scale - Size multiplier.
 */

/** Shows reminders in a transient overlay window. */
export class OverlayWindow {
  constructor() {
    /** @type {Electron.BrowserWindow | null} */
    this.win = null;
    /** @type {Promise<Electron.BrowserWindow | null> | null} Resolves when the window has loaded (null if loading failed). */
    this.ready = null;
    /** @type {import('../../shared/types.js').ShowRequest | null} The reminder on screen. */
    this.current = null;
    /** @type {{ request: import('../../shared/types.js').ShowRequest, placement: Placement }[]} */
    this.queue = [];
    this.sceneTimer = null;
    this.idleTimer = null;
  }

  /**
   * Shows a reminder now, or after the ones already waiting.
   * @param {import('../../shared/types.js').ShowRequest} request - What to show.
   * @param {Placement} placement - Where and how large.
   * @returns {void}
   */
  show(request, placement) {
    if (!this.current) {
      this.play(request, placement);
    } else if (this.queue.length < MAX_QUEUED_REMINDERS) {
      this.queue.push({ request, placement });
    }
  }

  /**
   * Removes the window and forgets anything still waiting.
   * @returns {void}
   */
  destroy() {
    clearTimeout(this.sceneTimer);
    clearTimeout(this.idleTimer);
    this.queue = [];
    this.current = null;
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
    this.ready = null;
  }

  /**
   * @param {import('../../shared/types.js').ShowRequest} request - What to show.
   * @param {Placement} placement - Where and how large.
   * @returns {Promise<void>}
   */
  async play(request, placement) {
    this.current = request;
    clearTimeout(this.idleTimer);
    const win = await this.ensureWindow();
    // The window may have been destroyed (quit, crash) while it was loading.
    if (!win || win.isDestroyed() || this.current !== request) {
      this.finish(request);
      return;
    }
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    win.setBounds(overlayBounds(display.workArea, placement.position, placement.scale));
    win.showInactive();
    // Sent directly: `ready` resolves on load, while `isLoading()` stays true a moment longer.
    win.webContents.send(Push.SHOW, request);
    this.sceneTimer = setTimeout(() => this.finish(request), request.durationMs + Timing.OVERLAY_EXIT_MS);
  }

  /**
   * Ends the reminder on screen and moves on to the next one, or starts the idle countdown.
   * @param {import('../../shared/types.js').ShowRequest} request - The reminder that ended.
   * @returns {void}
   */
  finish(request) {
    if (this.current !== request) return;
    clearTimeout(this.sceneTimer);
    this.current = null;
    if (this.win && !this.win.isDestroyed()) this.win.hide();
    const next = this.queue.shift();
    if (next) this.play(next.request, next.placement);
    else this.idleTimer = setTimeout(() => this.destroy(), Timing.OVERLAY_IDLE_DESTROY_MS);
  }

  /**
   * @returns {Promise<Electron.BrowserWindow | null>} The loaded window, created on first use.
   */
  ensureWindow() {
    if (this.win && !this.win.isDestroyed() && this.ready) return this.ready;
    const win = createWindow({
      width: 1,
      height: 1,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
    }, { label: 'overlay', role: WindowRole.OVERLAY });
    win.setIgnoreMouseEvents(true);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true });
    win.on('closed', () => {
      if (this.win === win) this.destroy();
    });
    // A crashed renderer is dropped so the next reminder starts a fresh one.
    win.webContents.on('render-process-gone', () => {
      if (this.win === win) this.destroy();
    });

    this.win = win;
    this.ready = new Promise((resolve) => {
      win.webContents.once('did-finish-load', () => resolve(win));
      win.webContents.once('did-fail-load', () => resolve(null));
    });
    win.loadFile(Paths.OVERLAY_HTML);
    return this.ready;
  }
}
