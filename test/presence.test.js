import assert from 'node:assert/strict';
import test from 'node:test';
import { Presence } from '../src/main/services/presence.js';
import { AwayReason } from '../src/shared/constants.js';

const settings = (overrides = {}) => ({ pauseWhenIdle: true, idleMinutes: 5, pauseInFullscreen: true, ...overrides });
const presence = ({ idle = 0, state = null } = {}) => new Presence({ getIdleSeconds: () => idle, getUserState: () => state });

test('an active user sees reminders', () => {
  assert.equal(presence({ idle: 30 }).awayReason(settings()), null);
});

test('being idle for long enough suppresses reminders', () => {
  assert.equal(presence({ idle: 299 }).awayReason(settings()), null);
  assert.equal(presence({ idle: 300 }).awayReason(settings()), AwayReason.IDLE);
});

test('the idle threshold follows the setting, and can be switched off', () => {
  assert.equal(presence({ idle: 120 }).awayReason(settings({ idleMinutes: 2 })), AwayReason.IDLE);
  assert.equal(presence({ idle: 9999 }).awayReason(settings({ pauseWhenIdle: false })), null);
});

test('full-screen apps suppress reminders only when the setting is on', () => {
  assert.equal(presence({ state: AwayReason.FULLSCREEN }).awayReason(settings()), AwayReason.FULLSCREEN);
  assert.equal(presence({ state: AwayReason.FULLSCREEN }).awayReason(settings({ pauseInFullscreen: false })), null);
});

test('a locked screen always suppresses reminders', () => {
  const locked = presence({ state: AwayReason.LOCKED });
  assert.equal(locked.awayReason(settings()), AwayReason.LOCKED);
  assert.equal(locked.awayReason(settings({ pauseInFullscreen: false, pauseWhenIdle: false })), AwayReason.LOCKED);
});
