/**
 * @file Constants shared by the main process, the preload bridge and every renderer.
 * Anything that more than one process needs to agree on lives here.
 */

export const APP_NAME = 'Blink';
export const APP_ID = 'com.blink.app';

/** Animated scenes the overlay can play. */
export const SceneId = Object.freeze({
  BLINK: 'blink',
  WATER: 'water',
  POSTURE: 'posture',
  STRETCH: 'stretch',
  BREATHE: 'breathe',
  FOCUS: 'focus',
  ICON: 'icon',
});

/** Synthesized sounds a reminder can play. */
export const SoundId = Object.freeze({
  OFF: 'off',
  TICK: 'tick',
  CHIME: 'chime',
  DROPLET: 'droplet',
  BELL: 'bell',
});

/** Where on the display a reminder appears. */
export const OverlayPosition = Object.freeze({
  TOP_LEFT: 'top-left',
  TOP: 'top',
  TOP_RIGHT: 'top-right',
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM: 'bottom',
  BOTTOM_RIGHT: 'bottom-right',
});

/** Why reminders are (or are not) being scheduled right now. */
export const ScheduleStatus = Object.freeze({
  ACTIVE: 'active',
  OFF: 'off',
  PAUSED: 'paused',
  OUTSIDE_HOURS: 'hours',
});

/** Why a single reminder was skipped even though the schedule is active. */
export const AwayReason = Object.freeze({
  IDLE: 'idle',
  FULLSCREEN: 'fullscreen',
  LOCKED: 'locked',
});

export const Limits = Object.freeze({
  MAX_REMINDERS: 30,
  MAX_ID_LENGTH: 64,
  NAME_LENGTH: 40,
  MESSAGE_LENGTH: 80,
  INTERVAL_MIN_SEC: 2,
  INTERVAL_MAX_SEC: 24 * 60 * 60,
  DURATION_MIN_SEC: 1,
  DURATION_MAX_SEC: 30,
  VOLUME_MIN: 0,
  VOLUME_MAX: 1,
  OVERLAY_SIZE_MIN: 0.6,
  OVERLAY_SIZE_MAX: 1.6,
  IDLE_MIN_MINUTES: 1,
  IDLE_MAX_MINUTES: 60,
});

export const ToastKind = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
});

/** Request/response channels (renderer → main, `ipcRenderer.invoke`). */
export const Invoke = Object.freeze({
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  RUNTIME_GET: 'runtime:get',
  APP_INFO: 'app:info',
  PAUSE: 'schedule:pause',
});

/** Fire-and-forget channels (renderer → main, `ipcRenderer.send`). */
export const Send = Object.freeze({
  PREVIEW: 'reminder:preview',
});

/** Push channels (main → renderer). */
export const Push = Object.freeze({
  SETTINGS: 'push:settings',
  RUNTIME: 'push:runtime',
  SHOW: 'push:show',
});
