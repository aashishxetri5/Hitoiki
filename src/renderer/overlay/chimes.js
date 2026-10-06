/**
 * @file Short synthesized sounds for reminders, built with Web Audio so the app ships
 * no audio files. A fresh audio context is created per sound and closed afterwards, so
 * nothing holds the audio device open between reminders.
 */

import { SoundId } from '../../shared/constants.js';

/** Scales every sound down so full volume is comfortable. */
const HEADROOM = 0.35;
const DEFAULT_ATTACK_SECONDS = 0.012;
/** Extra time before the context is closed so the tail is never cut. */
const CLOSE_MARGIN_SECONDS = 0.3;
const SILENT = 0.0001;

/**
 * @typedef {object} Note
 * @property {number} at - Start, in seconds after the sound begins.
 * @property {number} freq - Pitch in Hz.
 * @property {number} duration - Length in seconds.
 * @property {number} [glideTo] - Pitch in Hz the note slides to over its first half.
 * @property {number} [attack] - Fade-in in seconds.
 * @property {[number, number][]} [partials] - Overtones as [frequency ratio, level].
 */

/** @type {Readonly<Record<string, readonly Note[]>>} Sound id → the notes that make it up (exported for tests). */
export const RECIPES = Object.freeze({
  [SoundId.TICK]: [{ at: 0, freq: 1500, duration: 0.07, attack: 0.003 }],
  [SoundId.CHIME]: [
    { at: 0, freq: 784, duration: 0.9, partials: [[1, 1], [2, 0.25]] },
    { at: 0.16, freq: 1175, duration: 1.1, partials: [[1, 1], [2, 0.2]] },
  ],
  [SoundId.DROPLET]: [{ at: 0, freq: 640, glideTo: 1500, duration: 0.24, attack: 0.008 }],
  [SoundId.BELL]: [{ at: 0, freq: 523, duration: 1.8, partials: [[1, 1], [2.4, 0.4], [3.9, 0.2]] }],
});

/**
 * Schedules one note, with its overtones, on the context.
 * @param {AudioContext} context - Where to play.
 * @param {AudioNode} output - Node to connect to.
 * @param {Note} note - Note to play.
 * @returns {void}
 */
function scheduleNote(context, output, { at, freq, duration, glideTo, attack = DEFAULT_ATTACK_SECONDS, partials = [[1, 1]] }) {
  const start = context.currentTime + at;
  for (const [ratio, level] of partials) {
    const oscillator = context.createOscillator();
    const amp = context.createGain();
    oscillator.frequency.setValueAtTime(freq * ratio, start);
    if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo * ratio, start + duration / 2);
    amp.gain.setValueAtTime(SILENT, start);
    amp.gain.exponentialRampToValueAtTime(level, start + attack);
    amp.gain.exponentialRampToValueAtTime(SILENT, start + duration);
    oscillator.connect(amp).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }
}

/**
 * Plays a reminder sound.
 * @param {string} soundId - One of SoundId; silent and unknown ids play nothing.
 * @param {number} volume - 0–1.
 * @returns {void}
 */
export function playSound(soundId, volume) {
  const notes = RECIPES[soundId];
  if (!notes || volume <= 0) return;
  const context = new AudioContext();
  context.resume();
  const master = context.createGain();
  master.gain.value = volume * HEADROOM;
  master.connect(context.destination);

  let length = 0;
  for (const note of notes) {
    scheduleNote(context, master, note);
    length = Math.max(length, note.at + note.duration);
  }
  setTimeout(() => context.close(), (length + CLOSE_MARGIN_SECONDS) * 1000);
}
