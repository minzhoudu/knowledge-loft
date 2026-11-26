import type { Camera, Vector3 } from 'three';

/** Smallest comfortable reading size on the visitor's display, in CSS px. */
const MIN_TEXT_PX = 15;

/**
 * How much to zoom an HTML page placed in 3D (drei <Html transform>) so its
 * text stays readable.
 *
 * `left` and `right` are the page's edges in world space. Projected through
 * the camera they give the page's width on the visitor's display; divided
 * by the width it was laid out at, that's how much the browser will scale
 * it. Body text is 16 px in the layout, so if that comes out smaller than
 * MIN_TEXT_PX (a phone, a small window), zoom the content back up: lines
 * get shorter and you scroll more instead of squinting.
 *
 * Note: `project` overwrites the vectors passed in.
 */
export function readableZoom(
    camera: Camera,
    viewportWidth: number,
    left: Vector3,
    right: Vector3,
    layoutWidth: number,
) {
    left.project(camera);
    right.project(camera);
    // Projected x runs -1..1 across the viewport.
    const onScreenPx = (Math.abs(right.x - left.x) / 2) * viewportWidth;
    const scale = onScreenPx / layoutWidth;
    return Math.min(2.5, Math.max(1, MIN_TEXT_PX / (16 * scale)));
}
