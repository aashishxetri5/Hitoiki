import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReminder, normalizeReminders } from '../src/main/core/reminder.js';
import { DEFAULT_SETTINGS, migrateSettings, sanitizePatch } from '../src/main/settings/schema.js';
import { Limits } from '../src/shared/constants.js';

const valid = (overrides = {}) => ({
  id: 'r1', name: 'Stand up', message: 'Move', scene: 'stretch', icon: 'bell', intervalSec: 600, durationSec: 5, sound: 'chime', enabled: true, ...overrides,
});

test('a valid reminder is kept as is', () => {
  assert.deepEqual(normalizeReminder(valid()), valid());
});

test('text is trimmed, collapsed and cut to length', () => {
  const r = normalizeReminder(valid({ name: `  ${'x'.repeat(100)}  `, message: 'a   b\n c' }));
  assert.equal(r.name.length, Limits.NAME_LENGTH);
  assert.equal(r.message, 'a b c');
});

test('numbers are clamped and the duration never exceeds the interval', () => {
  assert.equal(normalizeReminder(valid({ intervalSec: 0.2 })).intervalSec, Limits.INTERVAL_MIN_SEC);
  assert.equal(normalizeReminder(valid({ intervalSec: 10 ** 9 })).intervalSec, Limits.INTERVAL_MAX_SEC);
  assert.equal(normalizeReminder(valid({ intervalSec: 4, durationSec: 20 })).durationSec, 3);
  assert.equal(normalizeReminder(valid({ intervalSec: 600, durationSec: 999 })).durationSec, Limits.DURATION_MAX_SEC);
});

test('unknown sounds and icons fall back to safe defaults', () => {
  const r = normalizeReminder(valid({ sound: 'airhorn', icon: '../../etc/passwd', enabled: 'yes' }));
  assert.equal(r.sound, 'off');
  assert.equal(r.icon, 'bell');
  assert.equal(r.enabled, true);
});

test('unusable reminders are rejected', () => {
  for (const bad of [null, 'x', {}, valid({ id: '' }), valid({ name: '   ' }), valid({ scene: 'fireworks' }), valid({ intervalSec: 'soon' }), valid({ durationSec: NaN })]) {
    assert.equal(normalizeReminder(bad), null);
  }
});

test('lists drop duplicates and entries beyond the maximum', () => {
  const { valid: list, rejected } = normalizeReminders([valid(), valid(), valid({ id: 'r2' }), null]);
  assert.deepEqual(list.map((r) => r.id), ['r1', 'r2']);
  assert.equal(rejected, 2);

  const many = Array.from({ length: Limits.MAX_REMINDERS + 5 }, (_, i) => valid({ id: `r${i}` }));
  assert.equal(normalizeReminders(many).valid.length, Limits.MAX_REMINDERS);
});

test('valid user changes are accepted', () => {
  assert.deepEqual(sanitizePatch({ volume: 0.4, enabled: false, overlayPosition: 'top-left' }), { volume: 0.4, enabled: false, overlayPosition: 'top-left' });
  assert.deepEqual(sanitizePatch({ reminders: [valid()] }), { reminders: [valid()] });
  assert.deepEqual(sanitizePatch({ idleMinutes: 10, pauseWhenIdle: false }), { idleMinutes: 10, pauseWhenIdle: false });
});

test('invalid values and main-process-only keys are dropped', () => {
  const patch = sanitizePatch({
    volume: 3,
    overlaySize: Number.NaN,
    overlayPosition: 'middle',
    idleMinutes: 2.5,
    pausedUntil: 5,
    hasShownTrayHint: true,
    reminders: [valid(), { nope: true }],
    activeHours: { enabled: true, start: '25:00', end: '18:00', days: [1] },
    unknown: 1,
  });
  assert.deepEqual(patch, {});
});

test('active hours are validated and normalised', () => {
  const hours = { enabled: true, start: '08:30', end: '17:00', days: [5, 1, 1, 3] };
  assert.deepEqual(sanitizePatch({ activeHours: hours }).activeHours.days, [1, 3, 5]);
  assert.deepEqual(sanitizePatch({ activeHours: { ...hours, days: [] } }), {});
  assert.deepEqual(sanitizePatch({ activeHours: { ...hours, days: [7] } }), {});
  assert.deepEqual(sanitizePatch({ activeHours: { ...hours, end: '08:30' } }), {}, 'an empty window is rejected');
});

test('a missing or damaged file yields the defaults', () => {
  assert.deepEqual(migrateSettings(null), structuredClone(DEFAULT_SETTINGS));
  assert.deepEqual(migrateSettings('garbage'), structuredClone(DEFAULT_SETTINGS));
});

test('first run starts with the built-in reminders', () => {
  const { reminders } = migrateSettings(null);
  assert.deepEqual(reminders.map((r) => r.id), ['blink', 'water', 'focus', 'posture', 'stretch']);
  assert.deepEqual(reminders.map((r) => r.enabled), [true, true, true, false, false]);
});

test('saved values are kept, bad ones fall back and unknown keys are dropped', () => {
  const settings = migrateSettings({ volume: 0.2, overlaySize: 99, retiredSetting: true, pausedUntil: 1234, hasShownTrayHint: true });
  assert.equal(settings.volume, 0.2);
  assert.equal(settings.overlaySize, DEFAULT_SETTINGS.overlaySize);
  assert.equal('retiredSetting' in settings, false);
  assert.equal(settings.pausedUntil, 1234);
  assert.equal(settings.hasShownTrayHint, true);
});

test('one damaged reminder on disk does not cost the others', () => {
  const settings = migrateSettings({ reminders: [valid(), { id: 'bad' }, valid({ id: 'r2' })] });
  assert.deepEqual(settings.reminders.map((r) => r.id), ['r1', 'r2']);
});

test('deleting every reminder is remembered', () => {
  assert.deepEqual(migrateSettings({ reminders: [] }).reminders, []);
});
