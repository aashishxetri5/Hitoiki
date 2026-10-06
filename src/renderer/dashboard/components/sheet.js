/**
 * @file Slide-over sheets built on the native `<dialog>`: focus is trapped while open and
 * returned afterwards, and Escape or a click outside closes the sheet with a short exit
 * animation.
 */

/** Closes the sheet anyway if its exit animation never reports finishing. */
const CLOSE_FALLBACK_MS = 400;

/**
 * @typedef {object} Sheet
 * @property {() => void} open - Shows the sheet.
 * @property {() => void} close - Hides the sheet with its exit animation.
 * @property {HTMLDialogElement} element - The dialog.
 */

/**
 * Makes a dialog behave as a sheet.
 * @param {HTMLDialogElement} dialog - The dialog element.
 * @returns {Sheet} Controls for the sheet.
 */
export function createSheet(dialog) {
  let closing = false;

  const finish = () => {
    if (!closing) return;
    closing = false;
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
  };
  const close = () => {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add('is-closing');
    setTimeout(finish, CLOSE_FALLBACK_MS);
  };

  // Animations inside the sheet bubble up here too, so only the sheet's own counts.
  dialog.addEventListener('animationend', (event) => {
    if (event.target === dialog) finish();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  // A press on the backdrop (which reports the dialog itself as its target) dismisses the sheet.
  dialog.addEventListener('mousedown', (event) => {
    if (event.target === dialog) close();
  });
  for (const button of dialog.querySelectorAll('[data-close]')) button.addEventListener('click', close);

  const open = () => {
    dialog.showModal();
    // A sheet always opens at the top, whatever it showed last time.
    dialog.querySelector('.sheet-body')?.scrollTo(0, 0);
  };

  return { open, close, element: dialog };
}
