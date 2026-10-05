/**
 * @file Whether the user is locked out of the desktop or looking at a full-screen app.
 * On Windows this asks the shell (`SHQueryUserNotificationState`) through koffi. Other
 * platforms have no equivalent in Electron, so they report nothing and callers carry on.
 */

import { AwayReason } from '../../shared/constants.js';
import { IS_WINDOWS } from '../constants.js';

/** Values of Windows' QUERY_USER_NOTIFICATION_STATE. */
const NotificationState = Object.freeze({
  NOT_PRESENT: 1,
  BUSY: 2,
  RUNNING_D3D_FULL_SCREEN: 3,
  PRESENTATION_MODE: 4,
});

/** @type {(() => number | null) | null | false} null = not loaded yet, false = unavailable. */
let queryState = null;

/**
 * Binds the Win32 call on first use. Call once at startup so later queries are synchronous.
 * @returns {Promise<boolean>} True when full-screen detection is supported on this system.
 */
export async function initUserState() {
  if (queryState !== null) return Boolean(queryState);
  if (!IS_WINDOWS) {
    queryState = false;
    return false;
  }
  try {
    const { default: koffi } = await import('koffi');
    const shell32 = koffi.load('shell32.dll');
    const SHQueryUserNotificationState = shell32.func('int32 __stdcall SHQueryUserNotificationState(_Out_ int32 *state)');
    queryState = () => {
      const out = [0];
      return SHQueryUserNotificationState(out) === 0 ? out[0] : null;
    };
  } catch (err) {
    console.warn('Full-screen detection is unavailable:', err.message);
    queryState = false;
  }
  return Boolean(queryState);
}

/**
 * @returns {string | null} AwayReason.LOCKED when the session is locked or a screen saver runs,
 *   AwayReason.FULLSCREEN for a full-screen app or presentation, otherwise null (also when unknown).
 */
export function getUserState() {
  if (!queryState) return null;
  try {
    switch (queryState()) {
      case NotificationState.NOT_PRESENT:
        return AwayReason.LOCKED;
      case NotificationState.BUSY:
      case NotificationState.RUNNING_D3D_FULL_SCREEN:
      case NotificationState.PRESENTATION_MODE:
        return AwayReason.FULLSCREEN;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
