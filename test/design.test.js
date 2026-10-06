import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DashboardTheme } from '../src/main/constants.js';
import { PRESETS, lookOf } from '../src/shared/catalog.js';
import { daypartFor } from '../src/renderer/dashboard/components/aura.js';
import { stepValue } from '../src/renderer/dashboard/components/controls.js';
import { describeHero, progressOf } from '../src/renderer/dashboard/components/hero.js';
import { MAX_RINGS, ringGeometry } from '../src/renderer/dashboard/components/rings.js';
import { describeRowTime } from '../src/renderer/dashboard/components/reminder-row.js';
import { ScheduleStatus, SceneId } from '../src/shared/constants.js';
import { reminderFromPreset } from '../src/shared/catalog.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

/** Reads `--name: light-dark(#aaa, #bbb)` from the design tokens. */
function token(name) {
  const match = new RegExp(`--${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`, 'i').exec(read('src/renderer/shared/tokens.css'));
  assert.ok(match, `token --${name} not found`);
  return { light: match[1].toLowerCase(), dark: match[2].toLowerCase() };
}

test('the window frame colours match the design tokens', () => {
  assert.equal(DashboardTheme.light.background, token('bg').light);
  assert.equal(DashboardTheme.dark.background, token('bg').dark);
  assert.equal(DashboardTheme.light.symbol, token('ink').light);
  assert.equal(DashboardTheme.dark.symbol, token('ink').dark);
});

test('the time of day picks the glow', () => {
  assert.equal(daypartFor(4), 'night');
  assert.equal(daypartFor(5), 'dawn');
  assert.equal(daypartFor(9), 'day');
  assert.equal(daypartFor(16), 'day');
  assert.equal(daypartFor(17), 'dusk');
  assert.equal(daypartFor(21), 'night');
  assert.equal(daypartFor(0), 'night');
});

test('every scene has its own colour', () => {
  const colours = Object.values(SceneId).map((scene) => lookOf({ scene, icon: 'bell' }).accent);
  assert.equal(new Set(colours).size, colours.length);
});

test('ring sizes always fit between the outer edge and the clear middle', () => {
  for (let count = 1; count <= MAX_RINGS; count++) {
    const rings = ringGeometry(count);
    assert.equal(rings.length, count);
    const innermost = rings[count - 1];
    assert.ok(innermost.radius - innermost.stroke / 2 >= 83, `${count} rings crowd the middle`);
    assert.ok(rings[0].radius + rings[0].stroke / 2 <= 160, `${count} rings leave the drawing`);
    for (let i = 1; i < count; i++) assert.ok(rings[i].radius < rings[i - 1].radius, 'rings must nest');
  }
});

test('a single ring is drawn thick, and many rings thin', () => {
  assert.ok(ringGeometry(1)[0].stroke > ringGeometry(MAX_RINGS)[0].stroke);
});

test('the stepper moves by one while small and by five after that', () => {
  assert.equal(stepValue(1, 1), 2);
  assert.equal(stepValue(8, 1), 9);
  assert.equal(stepValue(9, 1), 10);
  assert.equal(stepValue(10, 1), 15);
  assert.equal(stepValue(12, 1), 15);
  assert.equal(stepValue(15, -1), 10);
  assert.equal(stepValue(11, -1), 10);
  assert.equal(stepValue(10, -1), 9);
  assert.equal(stepValue(1, -1), 1, 'never below one');
});

const settingsWith = (ids) => ({ reminders: ids.map((id) => reminderFromPreset(PRESETS.find((p) => p.id === id))) });
const runtime = (status, nextDue = {}, extra = {}) => ({ status, pausedUntil: 0, resumeAt: 0, nextDue, ...extra });

test('the hero names the reminder due soonest', () => {
  const state = describeHero(settingsWith(['water', 'blink', 'focus']), runtime(ScheduleStatus.ACTIVE, { water: 5000, blink: 2000, focus: 9000 }));
  assert.equal(state.kind, 'next');
  assert.equal(state.title, 'Blink');
  assert.equal(state.dueAt, 2000);
  assert.equal(state.key, 'next:blink');
});

test('the hero ignores reminders that are switched off or unscheduled', () => {
  const settings = settingsWith(['water', 'blink']);
  settings.reminders[1].enabled = false;
  assert.equal(describeHero(settings, runtime(ScheduleStatus.ACTIVE, { water: 5000, blink: 1000 })).title, 'Drink water');
  assert.equal(describeHero(settings, runtime(ScheduleStatus.ACTIVE, {})).kind, 'empty');
});

test('the hero explains every reason reminders are not running', () => {
  const settings = settingsWith(['water']);
  const paused = describeHero(settings, runtime(ScheduleStatus.PAUSED, {}, { pausedUntil: 123456 }));
  assert.equal(paused.kind, 'paused');
  assert.equal(paused.dueAt, 123456);
  assert.equal(describeHero(settings, runtime(ScheduleStatus.OUTSIDE_HOURS, {}, { resumeAt: 99 })).kind, 'hours');
  assert.equal(describeHero(settings, runtime(ScheduleStatus.OFF)).kind, 'off');
});

test('ring progress is how far through the interval a reminder is', () => {
  const reminders = [{ id: 'a', intervalSec: 10 }, { id: 'b', intervalSec: 100 }, { id: 'c', intervalSec: 10 }];
  const progress = progressOf(reminders, { a: 6000, b: 100_000, c: -5 }, 0);
  assert.equal(progress.a, 0.4);
  assert.equal(progress.b, 0);
  assert.equal(progress.c, 1, 'overdue reminders are full, never beyond');
  assert.equal('d' in progressOf([{ id: 'd', intervalSec: 5 }], {}, 0), false, 'unscheduled reminders have no progress');
});

test('rows say how long is left, or why there is no time', () => {
  const reminder = { id: 'a', enabled: true };
  assert.equal(describeRowTime(reminder, runtime(ScheduleStatus.ACTIVE, { a: 45_000 }), 0), '45s');
  assert.equal(describeRowTime(reminder, runtime(ScheduleStatus.PAUSED), 0), 'Resting');
  assert.equal(describeRowTime(reminder, runtime(ScheduleStatus.OUTSIDE_HOURS), 0), 'Off duty');
  assert.equal(describeRowTime({ ...reminder, enabled: false }, runtime(ScheduleStatus.ACTIVE, { a: 45_000 }), 0), '');
  assert.equal(describeRowTime(reminder, null, 0), '');
});
