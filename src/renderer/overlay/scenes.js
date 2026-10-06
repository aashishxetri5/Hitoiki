/**
 * @file The illustrated scenes shown in the reminder overlay. Each scene is inline SVG
 * (viewBox 200×200) styled and animated by overlay.css. Markup here contains only
 * fixed shapes and class names; reminder text is never inserted as HTML.
 */

import { SceneId } from '../../shared/constants.js';
import { iconPaths } from '../shared/icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Glass outline, wide at the rim and narrower at the base. */
const GLASS_OUTLINE = 'M62 52 H138 L128 164 Q127 172 119 172 H81 Q73 172 72 164 Z';
/** Two full wave periods (100 units each) so the loop can slide by one period without a seam. */
const WAVE = 'q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V220 H-100 Z';

/** @type {Readonly<Record<string, () => string>>} Scene id → SVG inner markup. */
const MARKUP = Object.freeze({
  // Two round, friendly eyes and a small smile. Each eye is a nested group because the outer
  // one positions it with an attribute and the inner one is animated with CSS.
  [SceneId.BLINK]: () => `
    <g transform="translate(100 98) scale(1.3) translate(-100 -105)">
      ${[66, 134].map((x) => `
      <g transform="translate(${x} 90)">
        <g class="eye">
          <ellipse class="sclera" rx="27" ry="33"/>
          <g class="gaze">
            <circle class="iris" r="18"/>
            <circle class="pupil" r="10.5"/>
            <circle class="glint" cx="-6" cy="-7" r="5.5"/>
            <circle class="glint glint-small" cx="6" cy="7" r="2.4"/>
          </g>
        </g>
      </g>`).join('')}
      <path class="smile" d="M82 142 Q100 158 118 142"/>
    </g>`,

  [SceneId.WATER]: () => `
    <defs><clipPath id="glass-clip"><path d="${GLASS_OUTLINE}"/></clipPath></defs>
    <g clip-path="url(#glass-clip)">
      <g class="water-level">
        <g class="wave wave-back"><path class="water-back" d="M-100 70 ${WAVE}"/></g>
        <g class="wave wave-front"><path class="water-front" d="M-100 74 ${WAVE.replace('q25 -10', 'q25 10')}"/></g>
      </g>
      <circle class="bubble bubble-1" cx="92" cy="156" r="3"/>
      <circle class="bubble bubble-2" cx="109" cy="150" r="2.2"/>
      <circle class="bubble bubble-3" cx="100" cy="162" r="2.6"/>
    </g>
    <path class="glass-outline" d="${GLASS_OUTLINE}"/>
    <path class="glass-shine" d="M72 68 L76.5 148"/>
    <path class="drop" d="M100 8 C100 8 92 20 92 26 a8 8 0 0 0 16 0 C108 20 100 8 100 8 Z"/>`,

  [SceneId.POSTURE]: () => `
    <path class="floor" d="M52 186 H148"/>
    <path class="stroke-white" d="M100 146 L138 150 L138 186"/>
    <path class="seat" d="M74 150 H112"/>
    <path class="spine" d="M100 70 Q100 106 100 146"/>
    <circle class="head" cx="100" cy="46" r="16"/>
    <g class="lift">
      <path class="stroke-accent" d="M162 124 V78"/>
      <path class="stroke-accent" d="M148 92 L162 78 L176 92"/>
    </g>`,

  [SceneId.STRETCH]: () => `
    <g class="stretcher">
      <circle class="head" cx="100" cy="42" r="14"/>
      <path class="stroke-white" d="M100 60 V122"/>
      <path class="stroke-white" d="M100 122 L82 178"/>
      <path class="stroke-white" d="M100 122 L118 178"/>
      <path class="arm arm-left" d="M100 76 V126"/>
      <path class="arm arm-right" d="M100 76 V126"/>
    </g>
    <path class="floor" d="M56 184 H144"/>`,

  [SceneId.BREATHE]: () => `
    <div class="ring ring-outer"></div>
    <div class="ring ring-mid"></div>
    <div class="core"></div>
    <span class="word word-in">Breathe in</span>
    <span class="word word-out">Breathe out</span>`,

  [SceneId.FOCUS]: () => `
    <svg class="view" viewBox="0 0 200 200">
      <defs>
        <clipPath id="view-clip"><circle cx="100" cy="100" r="70"/></clipPath>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="sky-a"/><stop offset="100%" class="sky-b"/></linearGradient>
      </defs>
      <g clip-path="url(#view-clip)">
        <rect x="20" y="20" width="160" height="160" fill="url(#sky)"/>
        <circle class="sun" cx="134" cy="76" r="13"/>
        <g class="far-range"><path class="mountain-far" d="M10 132 L58 80 L90 112 L124 68 L190 132 V190 H10 Z"/></g>
        <path class="mountain-near" d="M10 152 L66 104 L110 148 L140 122 L190 156 V190 H10 Z"/>
      </g>
      <circle class="view-ring" cx="100" cy="100" r="70"/>
    </svg>
    <div class="pulse pulse-1"></div>
    <div class="pulse pulse-2"></div>`,

  [SceneId.ICON]: ({ icon }) => `
    <div class="pulse pulse-1"></div>
    <div class="pulse pulse-2"></div>
    <div class="badge"><svg class="glyph" viewBox="0 0 24 24">${iconPaths(icon).map((d) => `<path d="${d}"/>`).join('')}</svg></div>`,
});

/**
 * Scenes whose moving parts are HTML elements instead of SVG shapes. The browser can
 * animate a separate element's transform and opacity without redrawing anything, which
 * keeps endless loops (breathing, pulses) almost free; motion inside one SVG redraws
 * the whole drawing every frame.
 */
const HTML_SCENES = new Set([SceneId.BREATHE, SceneId.FOCUS, SceneId.ICON]);

/**
 * Builds the artwork for a scene.
 * @param {import('../../shared/types.js').ShowRequest} request - The reminder being shown.
 * @returns {Element} The scene artwork.
 */
export function buildScene(request) {
  const scene = MARKUP[request.scene] ? request.scene : SceneId.ICON;
  const isHtml = HTML_SCENES.has(scene);
  const root = isHtml ? document.createElement('div') : document.createElementNS(SVG_NS, 'svg');
  if (!isHtml) root.setAttribute('viewBox', '0 0 200 200');
  root.setAttribute('class', `art art-${scene}${isHtml ? ' art-html' : ''}`);
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = MARKUP[scene](request);
  return root;
}
