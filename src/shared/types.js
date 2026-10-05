/**
 * @file Type definitions shared across processes (JSDoc only, no runtime code).
 */

/**
 * @typedef {object} Reminder
 * @property {string} id - Unique, stable identifier.
 * @property {string} name - Short title, e.g. "Drink water".
 * @property {string} message - Optional sentence shown under the animation.
 * @property {string} scene - One of SceneId.
 * @property {string} icon - Icon name, used by the generic icon scene and on cards.
 * @property {number} intervalSec - Seconds between reminders.
 * @property {number} durationSec - Seconds the reminder stays on screen.
 * @property {string} sound - One of SoundId.
 * @property {boolean} enabled - Whether the reminder is switched on.
 */

/**
 * @typedef {object} ActiveHours
 * @property {boolean} enabled - Whether reminders are limited to the window below.
 * @property {string} start - Window start, `HH:MM` (24-hour).
 * @property {string} end - Window end, `HH:MM`; earlier than `start` means it ends the next day.
 * @property {number[]} days - Days the window starts on (0 = Sunday … 6 = Saturday).
 */

/**
 * @typedef {object} Settings
 * @property {boolean} enabled - Master switch.
 * @property {number} pausedUntil - Epoch milliseconds the pause ends at, or 0 when not paused.
 * @property {Reminder[]} reminders
 * @property {ActiveHours} activeHours
 * @property {boolean} pauseWhenIdle - Skip reminders while the user is away from the computer.
 * @property {number} idleMinutes - Minutes without input that count as away.
 * @property {boolean} pauseInFullscreen - Skip reminders during full-screen apps and presentations.
 * @property {string} overlayPosition - One of OverlayPosition.
 * @property {number} overlaySize - Scale of the on-screen reminder.
 * @property {number} volume - Reminder sound volume, 0–1.
 * @property {boolean} launchAtLogin
 * @property {boolean} hasShownTrayHint
 */

/**
 * @typedef {object} RuntimeState
 * @property {string} status - One of ScheduleStatus.
 * @property {number} pausedUntil - Epoch milliseconds the pause ends at, or 0.
 * @property {number} resumeAt - Epoch milliseconds reminders resume at while suspended, or 0 when unknown.
 * @property {Record<string, number>} nextDue - Epoch milliseconds of each reminder's next occurrence.
 */

/**
 * @typedef {object} ShowRequest
 * @property {string} id - Reminder id.
 * @property {string} name
 * @property {string} message
 * @property {string} scene - One of SceneId.
 * @property {string} icon
 * @property {string} accent - Scene accent colour.
 * @property {number} durationMs - How long the reminder stays on screen.
 * @property {string} sound - One of SoundId.
 * @property {number} volume - 0–1.
 */

export {};
