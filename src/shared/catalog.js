/**
 * @file Static catalogs: the animated scenes, reminder templates, pause choices and
 * icons a reminder can use. Shared so the dashboard, tray and overlay agree on them.
 */

import { Limits, SceneId, SoundId } from './constants.js';

/**
 * @typedef {object} Scene
 * @property {string} id - One of SceneId.
 * @property {string} name - Label shown in the editor.
 * @property {string} icon - Icon (name from icons.js) used on cards and in the tray menu.
 * @property {string} accent - Colour of the scene's glow and highlights.
 */

/** @type {readonly Scene[]} */
export const SCENES = Object.freeze([
  { id: SceneId.BLINK, name: 'Blinking eye', icon: 'eye', accent: '#38bdf8' },
  { id: SceneId.WATER, name: 'Water glass', icon: 'glass-water', accent: '#3b9cff' },
  { id: SceneId.POSTURE, name: 'Sit tall', icon: 'accessibility', accent: '#f5a524' },
  { id: SceneId.STRETCH, name: 'Stretch', icon: 'person-standing', accent: '#a78bfa' },
  { id: SceneId.BREATHE, name: 'Breathe', icon: 'wind', accent: '#2dd4bf' },
  { id: SceneId.FOCUS, name: 'Look far away', icon: 'mountain', accent: '#4ade80' },
  { id: SceneId.ICON, name: 'Icon', icon: 'bell', accent: '#f472b6' },
]);

/**
 * @param {string} id - Scene id.
 * @returns {Scene} The scene, or the generic icon scene for an unknown id.
 */
export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[SCENES.length - 1];
}

/** Icons a user can pick for a reminder that uses the generic icon scene. */
export const REMINDER_ICONS = Object.freeze([
  'bell', 'heart', 'star', 'coffee', 'apple', 'dumbbell', 'pill', 'sun',
  'moon', 'footprints', 'leaf', 'brain', 'book-open', 'phone-off', 'monitor', 'sparkles',
]);
export const DEFAULT_REMINDER_ICON = 'bell';

/**
 * @typedef {object} Preset
 * @property {string} id
 * @property {string} name
 * @property {string} message
 * @property {string} scene
 * @property {string} icon
 * @property {number} intervalSec
 * @property {number} durationSec
 * @property {string} sound
 */

/** @type {readonly Preset[]} Templates offered when creating a reminder. */
export const PRESETS = Object.freeze([
  {
    id: 'blink', name: 'Blink', message: 'Blink your eyes', scene: SceneId.BLINK, icon: 'eye',
    intervalSec: 20, durationSec: 2, sound: SoundId.OFF,
  },
  {
    id: 'water', name: 'Drink water', message: 'Time for a glass of water', scene: SceneId.WATER, icon: 'glass-water',
    intervalSec: 30 * 60, durationSec: 4, sound: SoundId.DROPLET,
  },
  {
    id: 'focus', name: 'Rest your eyes', message: 'Look at something 20 feet away for 20 seconds', scene: SceneId.FOCUS, icon: 'mountain',
    intervalSec: 20 * 60, durationSec: 8, sound: SoundId.CHIME,
  },
  {
    id: 'posture', name: 'Check your posture', message: 'Sit tall and relax your shoulders', scene: SceneId.POSTURE, icon: 'accessibility',
    intervalSec: 45 * 60, durationSec: 4, sound: SoundId.CHIME,
  },
  {
    id: 'stretch', name: 'Stretch', message: 'Stand up and stretch your arms and back', scene: SceneId.STRETCH, icon: 'person-standing',
    intervalSec: 60 * 60, durationSec: 6, sound: SoundId.BELL,
  },
  {
    id: 'breathe', name: 'Breathe', message: 'Take a slow, deep breath', scene: SceneId.BREATHE, icon: 'wind',
    intervalSec: 2 * 60 * 60, durationSec: 8, sound: SoundId.BELL,
  },
  {
    id: 'custom', name: 'Custom', message: '', scene: SceneId.ICON, icon: DEFAULT_REMINDER_ICON,
    intervalSec: 30 * 60, durationSec: 4, sound: SoundId.CHIME,
  },
]);

/**
 * Builds a reminder from a template.
 * @param {Preset} preset - Template to copy.
 * @param {object} [overrides]
 * @param {string} [overrides.id] - Reminder id (defaults to the template id).
 * @param {boolean} [overrides.enabled=true] - Whether the reminder is switched on.
 * @returns {import('./types.js').Reminder} A complete reminder.
 */
export function reminderFromPreset(preset, { id = preset.id, enabled = true } = {}) {
  const { name, message, scene, icon, intervalSec, durationSec, sound } = preset;
  return { id, name, message, scene, icon, intervalSec, durationSec, sound, enabled };
}

/**
 * @typedef {object} PauseOption
 * @property {string} id
 * @property {string} label
 * @property {number | null} minutes - Length of the pause, or null for "until midnight".
 */

/** @type {readonly PauseOption[]} */
export const PAUSE_OPTIONS = Object.freeze([
  { id: '15m', label: '15 minutes', minutes: 15 },
  { id: '30m', label: '30 minutes', minutes: 30 },
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: 'today', label: 'For the rest of today', minutes: null },
]);

/**
 * Longest a reminder may stay on screen for a given interval, so a reminder never
 * overlaps its own next occurrence.
 * @param {number} intervalSec - Seconds between occurrences.
 * @returns {number} Longest allowed display time in seconds.
 */
export function maxDurationFor(intervalSec) {
  return Math.min(Limits.DURATION_MAX_SEC, Math.max(Limits.DURATION_MIN_SEC, intervalSec - 1));
}
