import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeReminder } from '../src/main/core/reminder.js';
import { DEFAULT_SETTINGS } from '../src/main/settings/schema.js';
import {
  PAUSE_OPTIONS, PRESETS, REMINDER_ICONS, SCENES, maxDurationFor, reminderFromPreset, sceneById,
} from '../src/shared/catalog.js';
import { OverlayPosition, SceneId, SoundId } from '../src/shared/constants.js';
import { ICONS } from '../src/shared/icons.js';
import { POSITION_OPTIONS, SOUND_OPTIONS } from '../src/renderer/dashboard/copy.js';
import { RECIPES } from '../src/renderer/overlay/chimes.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('every template makes a valid reminder that survives normalisation unchanged', () => {
  for (const preset of PRESETS) {
    const reminder = reminderFromPreset(preset);
    assert.deepEqual(normalizeReminder(reminder), reminder, `${preset.id} is not valid as written`);
    assert.ok(reminder.durationSec <= maxDurationFor(reminder.intervalSec), `${preset.id} stays on screen longer than its interval`);
  }
});

test('template ids are unique', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  assert.equal(new Set(PAUSE_OPTIONS.map((o) => o.id)).size, PAUSE_OPTIONS.length);
});

test('every scene and picker icon exists in the vendored icon set', () => {
  for (const scene of SCENES) assert.ok(Object.hasOwn(ICONS, scene.icon), `missing icon ${scene.icon}`);
  for (const name of REMINDER_ICONS) assert.ok(Object.hasOwn(ICONS, name), `missing icon ${name}`);
  for (const preset of PRESETS) assert.ok(Object.hasOwn(ICONS, preset.icon), `missing icon ${preset.icon}`);
});

test('every scene id has a catalog entry, and templates only use known scenes', () => {
  for (const id of Object.values(SceneId)) assert.equal(sceneById(id).id, id);
  assert.equal(SCENES.length, Object.values(SceneId).length);
  for (const preset of PRESETS) assert.ok(Object.values(SceneId).includes(preset.scene));
  assert.equal(sceneById('nonsense').id, SceneId.ICON, 'unknown scenes fall back to the generic icon');
});

test('the overlay can draw and style every scene', () => {
  const scenes = read('src/renderer/overlay/scenes.js');
  const css = read('src/renderer/overlay/overlay.css');
  for (const [key, id] of Object.entries(SceneId)) {
    assert.ok(scenes.includes(`[SceneId.${key}]:`), `scenes.js has no artwork for ${key}`);
    assert.ok(css.includes(`.art-${id}`), `overlay.css has no styles for ${id}`);
  }
});

test('every sound has a recipe and a label, and every position has a label', () => {
  for (const sound of Object.values(SoundId)) {
    if (sound !== SoundId.OFF) assert.ok(RECIPES[sound]?.length, `no recipe for ${sound}`);
    assert.ok(SOUND_OPTIONS.some((o) => o.value === sound), `no label for ${sound}`);
  }
  for (const position of Object.values(OverlayPosition)) {
    assert.ok(POSITION_OPTIONS.some((o) => o.value === position), `no label for ${position}`);
  }
});

test('the built-in reminders are valid', () => {
  for (const reminder of DEFAULT_SETTINGS.reminders) assert.deepEqual(normalizeReminder(reminder), reminder);
});
