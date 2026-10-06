/**
 * @file The centre of the home screen: what is next, or why nothing is, with the actions
 * that make sense in that state (take a break, resume, turn on).
 */

import { PAUSE_OPTIONS, lookOf } from '../../../shared/catalog.js';
import { ScheduleStatus } from '../../../shared/constants.js';
import { describeSchedule, formatClock, formatTimer } from '../../../shared/format.js';
import { $, h } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

const ACCENT_NEUTRAL = '#9aa0ac';
const ACCENT_PAUSED = '#f5a524';
const ACCENT_OFF_DUTY = '#a78bfa';
/** Timer text longer than this (`1:02:09`) is set smaller to fit inside the rings. */
const LONG_TIMER_CHARS = 5;

/**
 * @typedef {object} HeroState
 * @property {string} key - Changes whenever the centre needs rebuilding.
 * @property {'next' | 'empty' | 'paused' | 'hours' | 'off'} kind
 * @property {string} icon
 * @property {string} accent
 * @property {string} eyebrow - Small label above the title.
 * @property {string} title
 * @property {string} [sub] - Muted line under the title.
 * @property {number} [dueAt] - When to count down to (epoch milliseconds), if the state has a countdown.
 */

/**
 * Works out what the home screen should say.
 * @param {import('../../../shared/types.js').Settings} settings - Current settings.
 * @param {import('../../../shared/types.js').RuntimeState} runtime - What the schedule is doing.
 * @returns {HeroState} What to show.
 */
export function describeHero(settings, runtime) {
  switch (runtime.status) {
    case ScheduleStatus.PAUSED:
      return {
        key: 'paused', kind: 'paused', icon: 'moon', accent: ACCENT_PAUSED, eyebrow: 'Resting',
        title: `Back at ${formatClock(runtime.pausedUntil)}`, sub: 'Reminders return by themselves', dueAt: runtime.pausedUntil,
      };
    case ScheduleStatus.OUTSIDE_HOURS:
      return {
        key: 'hours', kind: 'hours', icon: 'moon', accent: ACCENT_OFF_DUTY, eyebrow: 'Off duty',
        title: runtime.resumeAt ? `Back at ${formatClock(runtime.resumeAt)}` : 'Outside active hours', sub: 'Reminders resume by themselves',
      };
    case ScheduleStatus.OFF:
      return {
        key: 'off', kind: 'off', icon: 'power', accent: ACCENT_NEUTRAL, eyebrow: 'Switched off',
        title: 'Reminders are off', sub: 'Turn them on whenever you like.',
      };
    default: {
      const next = settings.reminders
        .filter((r) => r.enabled && runtime.nextDue[r.id])
        .sort((a, b) => runtime.nextDue[a.id] - runtime.nextDue[b.id])[0];
      if (!next) {
        return {
          key: 'empty', kind: 'empty', icon: 'bell-off', accent: ACCENT_NEUTRAL, eyebrow: 'All quiet',
          title: 'Nothing scheduled', sub: 'Switch a reminder on, or add a new one.',
        };
      }
      const look = lookOf(next);
      return {
        key: `next:${next.id}`, kind: 'next', icon: look.icon, accent: look.accent, eyebrow: 'Next up',
        title: next.name, dueAt: runtime.nextDue[next.id],
      };
    }
  }
}

/**
 * How far each enabled reminder is through its current interval.
 * @param {import('../../../shared/types.js').Reminder[]} reminders - All reminders.
 * @param {Record<string, number>} nextDue - Next occurrence of each scheduled reminder.
 * @param {number} now - Epoch milliseconds.
 * @returns {Record<string, number>} Progress from 0 to 1 per reminder id.
 */
export function progressOf(reminders, nextDue, now) {
  const progress = {};
  for (const reminder of reminders) {
    if (!nextDue[reminder.id]) continue;
    progress[reminder.id] = Math.min(1, Math.max(0, 1 - (nextDue[reminder.id] - now) / (reminder.intervalSec * 1000)));
  }
  return progress;
}

/** The home screen's hero: the rings, what is next, and the actions that fit the moment. */
export class Hero {
  /**
   * @param {object} deps
   * @param {import('../store.js').Store} deps.store - Dashboard store.
   * @param {import('./rings.js').Rings} deps.rings - The progress rings.
   * @param {() => void} deps.openSettings - Opens the settings sheet.
   */
  constructor({ store, rings, openSettings }) {
    this.store = store;
    this.rings = rings;
    this.openSettings = openSettings;
    this.center = $('#hero-center');
    this.actions = $('#hero-actions');
    this.announcer = $('#hero-status');
    /** @type {HeroState | null} */
    this.state = null;
    /** @type {HTMLElement | null} */
    this.time = null;
  }

  /**
   * Redraws for the current settings and schedule. The centre is only rebuilt when what it
   * says changes, so the once-a-second countdown never makes it flicker.
   * @returns {void}
   */
  render() {
    const { settings, runtime } = this.store.state;
    if (!settings || !runtime) return;
    const state = describeHero(settings, runtime);
    document.body.dataset.state = runtime.status;
    this.rings.setRings(settings.reminders.filter((r) => r.enabled).map((r) => ({ id: r.id, accent: lookOf(r).accent })));

    if (state.key !== this.state?.key) {
      this.buildCenter(state);
      this.buildActions(state);
      this.announcer.textContent = describeSchedule(runtime);
    }
    this.state = state;
    this.tick();
  }

  /**
   * Updates the countdown and the rings. Called every second while the window is visible.
   * @param {number} [now] - Epoch milliseconds.
   * @returns {void}
   */
  tick(now = Date.now()) {
    const { settings, runtime } = this.store.state;
    if (!settings || !runtime || !this.state) return;
    if (this.time && this.state.dueAt) {
      const text = formatTimer(this.state.dueAt - now);
      if (this.time.textContent !== text) this.time.textContent = text;
      this.time.classList.toggle('is-long', text.length > LONG_TIMER_CHARS);
    }
    this.rings.update(progressOf(settings.reminders, runtime.nextDue, now), runtime.status === ScheduleStatus.ACTIVE);
  }

  /**
   * @param {HeroState} state - What to show.
   * @returns {void}
   */
  buildCenter(state) {
    this.time = state.dueAt ? h('p', { className: 'hero-time' }) : null;
    this.center.style.setProperty('--c', state.accent);
    this.center.replaceChildren(...[
      h('div', { className: 'hero-icon' }, icon(state.icon, { size: 28 })),
      h('p', { className: 'eyebrow', text: state.eyebrow }),
      h('p', { className: 'hero-title', text: state.title }),
      this.time,
      state.sub ? h('p', { className: 'hero-sub', text: state.sub }) : null,
    ].filter(Boolean));
    // Replay the entrance each time the centre changes.
    this.center.classList.remove('enter');
    void this.center.offsetWidth;
    this.center.classList.add('enter');
  }

  /**
   * @param {HeroState} state - What to show.
   * @returns {void}
   */
  buildActions(state) {
    const { store } = this;
    const button = (className, label, onClick, iconName) => h('button', {
      className: `btn ${className}`, attrs: { type: 'button' }, on: { click: onClick },
    }, [iconName ? icon(iconName, { size: 16 }) : null, label]);

    if (state.kind === 'paused') {
      this.actions.replaceChildren(button('btn-primary', 'Resume now', () => store.pause(null), 'play'));
    } else if (state.kind === 'hours') {
      this.actions.replaceChildren(button('btn-secondary', 'Change active hours', () => this.openSettings(), 'settings'));
    } else if (state.kind === 'off') {
      this.actions.replaceChildren(button('btn-primary', 'Turn reminders on', () => store.saveSettings({ enabled: true }), 'power'));
    } else if (state.kind === 'empty') {
      // With nothing scheduled there is nothing to take a break from; the list below has the way forward.
      this.actions.replaceChildren();
    } else {
      this.actions.replaceChildren(
        h('p', { className: 'eyebrow', text: 'Take a break' }),
        h('div', { className: 'chips' }, PAUSE_OPTIONS.map((option) => h('button', {
          className: 'chip', text: option.shortLabel, attrs: { type: 'button', title: option.label }, on: { click: () => store.pause(option.id) },
        }))),
      );
    }
  }
}
