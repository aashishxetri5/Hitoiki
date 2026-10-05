/**
 * @file The illustrated scenes shown in the reminder overlay. Each scene is inline SVG
 * (viewBox 200×200) styled and animated by overlay.css. Markup here contains only
 * fixed shapes and class names; reminder text is never inserted as HTML.
 */

import { SceneId } from '../../shared/constants.js';
import { iconPaths } from '../shared/icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Almond-shaped outline of the open eye. */
const EYE_OUTLINE = 'M12 100 C50 50 150 50 188 100 C150 150 50 150 12 100 Z';
/** Glass outline, wide at the rim and narrower at the base. */
const GLASS_OUTLINE = 'M62 52 H138 L128 164 Q127 172 119 172 H81 Q73 172 72 164 Z';
/** Two full wave periods (100 units each) so the loop can slide by one period without a seam. */
const WAVE = 'q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V220 H-100 Z';

/** @type {Readonly<Record<string, () => string>>} Scene id → SVG inner markup. */
const MARKUP = Object.freeze({
  [SceneId.BLINK]: () => `
    <defs>
      <clipPath id="eye-clip"><path d="${EYE_OUTLINE}"/></clipPath>
      <radialGradient id="eye-sclera" cx="50%" cy="50%" r="62%"><stop offset="55%" class="sclera-a"/><stop offset="100%" class="sclera-b"/></radialGradient>
      <radialGradient id="eye-iris" cx="50%" cy="38%" r="68%"><stop offset="0%" class="iris-a"/><stop offset="100%" class="iris-b"/></radialGradient>
    </defs>
    <g clip-path="url(#eye-clip)">
      <rect x="0" y="40" width="200" height="120" fill="url(#eye-sclera)"/>
      <g class="eye-look">
        <circle cx="100" cy="100" r="37" fill="url(#eye-iris)"/>
        <circle cx="100" cy="100" r="37" class="iris-ring"/>
        <circle cx="100" cy="100" r="16" class="pupil"/>
        <circle cx="87" cy="86" r="7" class="glint"/>
        <circle cx="110" cy="112" r="3" class="glint glint-soft"/>
      </g>
      <g class="eye-lid">
        <path class="lid-fill" d="M-10 -80 H210 V100 H188 C150 150 50 150 12 100 H-10 Z"/>
        <path class="lid-edge" d="M12 100 C50 150 150 150 188 100"/>
      </g>
    </g>
    <path class="eye-outline" d="${EYE_OUTLINE}"/>`,

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
    <circle class="ring ring-outer" cx="100" cy="100" r="88"/>
    <circle class="ring ring-mid" cx="100" cy="100" r="68"/>
    <circle class="core" cx="100" cy="100" r="48"/>
    <text class="word word-in" x="100" y="105" text-anchor="middle">Breathe in</text>
    <text class="word word-out" x="100" y="105" text-anchor="middle">Breathe out</text>`,

  [SceneId.FOCUS]: () => `
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
    <circle class="pulse pulse-1" cx="100" cy="100" r="70"/>
    <circle class="pulse pulse-2" cx="100" cy="100" r="70"/>`,

  [SceneId.ICON]: ({ icon }) => `
    <circle class="pulse pulse-1" cx="100" cy="100" r="54"/>
    <circle class="pulse pulse-2" cx="100" cy="100" r="54"/>
    <circle class="badge" cx="100" cy="100" r="54"/>
    <g class="glyph-bob"><g class="glyph" transform="translate(64 64) scale(3)">${iconPaths(icon).map((d) => `<path d="${d}"/>`).join('')}</g></g>`,
});

/**
 * Builds the SVG for a scene.
 * @param {import('../../shared/types.js').ShowRequest} request - The reminder being shown.
 * @returns {SVGSVGElement} The scene artwork.
 */
export function buildScene(request) {
  const markup = MARKUP[request.scene] ?? MARKUP[SceneId.ICON];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', `art art-${MARKUP[request.scene] ? request.scene : SceneId.ICON}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = markup(request);
  return svg;
}
