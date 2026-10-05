/**
 * @file The header's pause button: a menu of pause lengths, which turns into a
 * Resume button while reminders are paused.
 */

import { PAUSE_OPTIONS } from '../../../shared/catalog.js';
import { ScheduleStatus } from '../../../shared/constants.js';
import { $, h } from '../../shared/dom.js';

/**
 * @param {import('../store.js').Store} store - Dashboard store.
 * @returns {void}
 */
export function mountPauseControl(store) {
  const button = /** @type {HTMLButtonElement} */ ($('#pause-button'));
  const label = $('#pause-label');
  const caret = $('.pause-caret');
  const menu = $('#pause-menu');
  let paused = false;

  const items = PAUSE_OPTIONS.map((option) => h('button', {
    className: 'menu-item',
    text: option.label,
    attrs: { type: 'button', role: 'menuitem' },
    on: {
      click: () => {
        close();
        store.pause(option.id);
      },
    },
  }));
  menu.replaceChildren(...items);

  /**
   * @param {boolean} open - Whether the menu is shown.
   * @returns {void}
   */
  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }
  /** @returns {void} */
  function close() {
    setOpen(false);
  }

  button.addEventListener('click', () => {
    if (paused) store.pause(null);
    else {
      setOpen(menu.hidden);
      if (!menu.hidden) items[0].focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    const current = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (event.key === 'Escape') {
      close();
      button.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length].focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !(event.target instanceof Node && (menu.contains(event.target) || button.contains(event.target)))) close();
  });

  store.subscribe(['runtime', 'settings'], ({ runtime, settings }) => {
    if (!runtime || !settings) return;
    paused = runtime.status === ScheduleStatus.PAUSED;
    label.textContent = paused ? 'Resume' : 'Pause';
    caret.hidden = paused;
    button.classList.toggle('btn-primary', paused);
    button.disabled = !settings.enabled;
    if (paused) close();
  });
}
