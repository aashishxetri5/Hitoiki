/**
 * @file Overlay window: plays one reminder scene at a time. The main process decides
 * what to show and for how long and hides the window afterwards; this page only draws
 * the scene, plays its sound and fades it out.
 */

import { Push } from '../../shared/constants.js';
import { api } from '../shared/bridge.js';
import { $, h } from '../shared/dom.js';
import { playSound } from './chimes.js';
import { buildScene } from './scenes.js';

/** Length of the fade-out; matches `scene-out` in overlay.css. */
const EXIT_MS = 250;

const stage = $('#stage');
let leaveTimer = 0;
let removeTimer = 0;

/**
 * Shows a reminder, replacing any scene still on screen.
 * @param {import('../../shared/types.js').ShowRequest} request - What to show.
 * @returns {void}
 */
function show(request) {
  clearTimeout(leaveTimer);
  clearTimeout(removeTimer);

  const scene = h('div', { className: 'scene' }, [
    h('div', { className: 'disc' }, buildScene(request)),
    h('div', { className: 'caption' }, [
      h('div', { className: 'caption-name', text: request.name }),
      request.message ? h('div', { className: 'caption-message', text: request.message }) : null,
    ]),
  ]);
  scene.style.setProperty('--accent', request.accent);
  stage.replaceChildren(scene);
  playSound(request.sound, request.volume);

  leaveTimer = window.setTimeout(() => {
    scene.classList.add('leaving');
    removeTimer = window.setTimeout(() => scene.remove(), EXIT_MS);
  }, Math.max(0, request.durationMs - EXIT_MS));
}

api.on(Push.SHOW, show);
