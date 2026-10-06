import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { ReminderController } from '../src/main/app/reminder-controller.js';
import { DEFAULT_SETTINGS } from '../src/main/settings/schema.js';
import { AwayReason, ScheduleStatus } from '../src/shared/constants.js';

/** Settings stand-in with the same get/set/change contract as SettingsService. */
class FakeSettings extends EventEmitter {
  constructor(overrides = {}) {
    super();
    this.data = { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
  }

  get() {
    return this.data;
  }

  set(patch) {
    const changed = Object.keys(patch).filter((k) => JSON.stringify(this.data[k]) !== JSON.stringify(patch[k]));
    this.data = { ...this.data, ...patch };
    if (changed.length) this.emit('change', changed);
    return changed;
  }
}

/** Builds a controller whose timers are stopped when the test ends. */
function setup(t, { away = null, overrides } = {}) {
  const settings = new FakeSettings(overrides);
  const shown = [];
  const overlay = { show: (request, placement) => shown.push({ request, placement }) };
  const presence = { awayReason: () => away };
  const controller = new ReminderController({ settings, presence, overlay });
  controller.start();
  t.after(() => controller.stop());
  return { settings, shown, controller };
}

const blink = (settings) => settings.get().reminders.find((r) => r.id === 'blink');

test('a reminder that falls due is shown with the settings that apply to it', (t) => {
  const { settings, shown, controller } = setup(t, { overrides: { volume: 0.3, overlayPosition: 'top-right', overlaySize: 1.2 } });
  controller.onDue(blink(settings));
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].placement, { position: 'top-right', scale: 1.2 });
  assert.equal(shown[0].request.id, 'blink');
  assert.equal(shown[0].request.volume, 0.3);
  assert.equal(shown[0].request.durationMs, blink(settings).durationSec * 1000);
});

test('a reminder is skipped while the user is away', (t) => {
  for (const reason of Object.values(AwayReason)) {
    const { settings, shown, controller } = setup(t, { away: reason });
    controller.onDue(blink(settings));
    assert.equal(shown.length, 0, `shown despite ${reason}`);
  }
});

test('a preview ignores the schedule and the user being away', (t) => {
  const { settings, shown, controller } = setup(t, { away: AwayReason.LOCKED, overrides: { enabled: false } });
  controller.preview(blink(settings));
  assert.equal(shown.length, 1);
});

test('only switched-on reminders are scheduled', (t) => {
  const { controller } = setup(t);
  assert.deepEqual(Object.keys(controller.state().nextDue).sort(), ['blink', 'focus', 'water']);
});

test('pausing stops the schedule and resuming restarts it', (t) => {
  const { settings, controller } = setup(t);
  const statuses = [];
  controller.on('status', () => statuses.push(controller.state().status));

  assert.equal(controller.pause('15m'), true);
  let state = controller.state();
  assert.equal(state.status, ScheduleStatus.PAUSED);
  assert.ok(state.pausedUntil > Date.now() && state.pausedUntil <= Date.now() + 15 * 60_000);
  assert.deepEqual(state.nextDue, {});

  controller.resume();
  state = controller.state();
  assert.equal(state.status, ScheduleStatus.ACTIVE);
  assert.equal(state.pausedUntil, 0);
  assert.equal(Object.keys(state.nextDue).length, 3);
  assert.deepEqual(statuses, [ScheduleStatus.PAUSED, ScheduleStatus.ACTIVE]);
  assert.equal(settings.get().pausedUntil, 0);
});

test('an unknown pause length is refused', (t) => {
  const { controller } = setup(t);
  assert.equal(controller.pause('forever'), false);
  assert.equal(controller.state().status, ScheduleStatus.ACTIVE);
});

test('switching the master switch off silences everything', (t) => {
  const { settings, controller } = setup(t);
  settings.set({ enabled: false });
  assert.equal(controller.state().status, ScheduleStatus.OFF);
  assert.deepEqual(controller.state().nextDue, {});
});

test('editing the reminders reschedules them', (t) => {
  const { settings, controller } = setup(t);
  const reminders = settings.get().reminders.map((r) => (r.id === 'stretch' ? { ...r, enabled: true } : r));
  settings.set({ reminders });
  assert.ok('stretch' in controller.state().nextDue);
});
