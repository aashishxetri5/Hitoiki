/**
 * @file Where the on-screen reminder window goes.
 */

import { OverlayPosition } from '../../shared/constants.js';

/** Size of the reminder window at 100%, in device-independent pixels. */
export const OVERLAY_BASE_SIZE = Object.freeze({ width: 520, height: 480 });
/** Gap kept between the reminder and the screen edge. */
const EDGE_MARGIN = 24;

/** Horizontal and vertical anchor of each position. */
const ANCHORS = Object.freeze({
  [OverlayPosition.CENTER]: ['center', 'center'],
  [OverlayPosition.TOP]: ['center', 'start'],
  [OverlayPosition.BOTTOM]: ['center', 'end'],
  [OverlayPosition.TOP_LEFT]: ['start', 'start'],
  [OverlayPosition.TOP_RIGHT]: ['end', 'start'],
  [OverlayPosition.BOTTOM_LEFT]: ['start', 'end'],
  [OverlayPosition.BOTTOM_RIGHT]: ['end', 'end'],
});

/**
 * @param {number} origin - Start of the available space.
 * @param {number} space - Length of the available space.
 * @param {number} length - Length to place.
 * @param {string} anchor - `start`, `center` or `end`.
 * @returns {number} Where the placed item starts.
 */
function align(origin, space, length, anchor) {
  if (anchor === 'start') return origin + EDGE_MARGIN;
  if (anchor === 'end') return origin + space - length - EDGE_MARGIN;
  return origin + Math.round((space - length) / 2);
}

/**
 * Places the reminder window inside a display's usable area.
 * @param {Electron.Rectangle} workArea - Display area not covered by the taskbar or dock.
 * @param {string} position - One of OverlayPosition.
 * @param {number} scale - Size multiplier.
 * @returns {Electron.Rectangle} Bounds for the window.
 */
export function overlayBounds(workArea, position, scale) {
  const width = Math.min(workArea.width, Math.round(OVERLAY_BASE_SIZE.width * scale));
  const height = Math.min(workArea.height, Math.round(OVERLAY_BASE_SIZE.height * scale));
  const [horizontal, vertical] = ANCHORS[position] ?? ANCHORS[OverlayPosition.CENTER];
  return {
    x: align(workArea.x, workArea.width, width, horizontal),
    y: align(workArea.y, workArea.height, height, vertical),
    width,
    height,
  };
}
