/**
 * @file The concentric progress rings on the home screen: one ring per reminder, each
 * filling toward that reminder's next appearance in the reminder's own colour.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_SIZE = 320;
const CENTER = VIEW_SIZE / 2;
/** Radius of the outer edge of the outermost ring. */
const OUTER_RADIUS = 156;
/** Radius left clear in the middle for the countdown text. */
const CLEAR_RADIUS = 84;
const RING_GAP = 6;
const MIN_STROKE = 6;
const MAX_STROKE = 16;
/** More reminders than this still run; only this many get a ring. */
export const MAX_RINGS = 6;
/** A drop in progress larger than this means the reminder just fired and the ring starts over. */
const RESTART_DROP = 0.2;

/**
 * Sizes the rings so they always fit between the outer edge and the clear middle.
 * @param {number} count - How many rings.
 * @returns {{ radius: number, stroke: number }[]} Centre-line radius and thickness of each ring, outermost first.
 */
export function ringGeometry(count) {
  const stroke = Math.min(MAX_STROKE, Math.max(MIN_STROKE, (OUTER_RADIUS - CLEAR_RADIUS) / Math.max(count, 1) - RING_GAP));
  return Array.from({ length: count }, (_, i) => ({ radius: OUTER_RADIUS - stroke / 2 - i * (stroke + RING_GAP), stroke }));
}

/**
 * @param {string} tag - SVG element name.
 * @param {Record<string, string | number>} attrs - Attributes.
 * @returns {SVGElement} The element.
 */
function svgElement(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** Draws the rings and keeps their progress up to date. */
export class Rings {
  /**
   * @param {SVGSVGElement} svg - Element to draw into.
   */
  constructor(svg) {
    this.svg = svg;
    /** @type {Map<string, { arc: SVGElement, group: SVGElement, circumference: number, progress: number }>} */
    this.rings = new Map();
    this.signature = '';
  }

  /**
   * Draws a ring for each reminder, unless the set is unchanged.
   * @param {{ id: string, accent: string }[]} reminders - Reminders in order, outermost ring first.
   * @returns {void}
   */
  setRings(reminders) {
    const shown = reminders.slice(0, MAX_RINGS);
    const signature = shown.map((r) => `${r.id}:${r.accent}`).join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.rings.clear();

    const geometry = ringGeometry(shown.length);
    const groups = shown.map((reminder, i) => {
      const { radius, stroke } = geometry[i];
      const circumference = 2 * Math.PI * radius;
      const common = { cx: CENTER, cy: CENTER, r: radius, 'stroke-width': stroke };
      const arc = svgElement('circle', {
        ...common,
        class: 'ring-arc',
        'stroke-dasharray': circumference,
        transform: `rotate(-90 ${CENTER} ${CENTER})`,
      });
      arc.style.strokeDashoffset = String(circumference);
      const group = svgElement('g', { class: 'ring', 'data-id': reminder.id });
      group.style.setProperty('--c', reminder.accent);
      group.append(svgElement('circle', { ...common, class: 'ring-track' }), arc);
      this.rings.set(reminder.id, { arc, group, circumference, progress: 0 });
      return group;
    });
    this.svg.replaceChildren(...groups);
  }

  /**
   * Fills each ring to its progress.
   * @param {Record<string, number>} progressById - Progress from 0 to 1 per reminder id.
   * @param {boolean} active - False while reminders are not running; the rings then show only their tracks.
   * @returns {void}
   */
  update(progressById, active) {
    this.svg.classList.toggle('is-quiet', !active);
    for (const [id, ring] of this.rings) {
      const progress = Math.min(1, Math.max(0, progressById[id] ?? 0));
      const restarted = progress < ring.progress - RESTART_DROP;
      ring.progress = progress;
      if (restarted) {
        // Jump back to empty instead of animating the ring unwinding.
        ring.arc.style.transition = 'none';
        ring.arc.style.strokeDashoffset = String(ring.circumference);
        void ring.arc.getBoundingClientRect();
        ring.arc.style.transition = '';
      }
      ring.arc.style.strokeDashoffset = String(ring.circumference * (1 - progress));
    }
  }

  /**
   * Brings one ring forward and dims the rest.
   * @param {string | null} id - Reminder to highlight, or null for none.
   * @returns {void}
   */
  focus(id) {
    if (id && this.rings.has(id)) this.svg.dataset.focus = 'true';
    else delete this.svg.dataset.focus;
    for (const [ringId, { group }] of this.rings) {
      if (ringId === id) group.dataset.focused = 'true';
      else delete group.dataset.focused;
    }
  }
}
