import { MARKERS } from '@/world/rooms/lobby/layout';
import { constellation } from './layout';

/**
 * The two shapes of the constellation, and how far between them it is.
 *
 * Outside (walking around the lobby): a small cloud floating over the
 * projector, as laid out by layout.ts.
 *
 * Inside: the same stars pushed out onto a thick shell around you at eye
 * height. Each star keeps its compass direction from the centre, so the sky
 * you see from inside has the same regions and neighbours as the cloud you
 * saw from outside, just wrapped around you. Angles above and below the
 * horizon are compressed, so nothing ends up under the floor or straight
 * overhead, where you'd crane your neck.
 *
 * Between the two, every position is a blend: blend.t goes 0 → 1 while you
 * step in, and back while you step out (ConstellationCamera drives it).
 */

type Vec3 = [number, number, number];

const [CX, , CZ] = MARKERS.constellation.position;

/** Outside: the middle of the cloud, a little above eye height, and its size. */
export const OUTSIDE = { centre: [CX, 2.15, CZ] as Vec3, radius: 1.35 };
/** Inside: your eye, the shell around it, and how flat it is. */
export const INSIDE = {
    centre: [CX, 1.65, CZ] as Vec3,
    radius: 3.1,
    /**
     * How much of each star's angle above / below the horizon it keeps:
     * up to ~54° up (no craning your neck), ~30° down (nothing under the floor).
     */
    up: 0.6,
    down: 0.35,
    /** Stars far away look small; inside, everything is drawn this much bigger. */
    grow: 1.8,
};

const { stars } = constellation;

export const outsidePositions: Vec3[] = stars.map(
    (s) => s.position.map((v) => v * OUTSIDE.radius) as Vec3,
);

export const insidePositions: Vec3[] = stars.map((s, i) => {
    const [x, y, z] = s.position;
    let length = Math.hypot(x, y, z);
    let dir: Vec3 = [x, y, z];
    if (length < 0.05) {
        // A star at the very centre has no direction of its own: give it one.
        const a = i * 2.39996; // the golden angle, so such stars spread out
        dir = [Math.cos(a), 0, Math.sin(a)];
        length = 0;
    } else {
        dir = [x / length, y / length, z / length];
    }
    // Inner stars sit a bit closer than outer ones, so the sky has depth.
    const r = INSIDE.radius * (0.78 + 0.22 * Math.min(1, length));
    // Same compass direction, but a lower angle above or below the horizon,
    // at the same distance: nothing ends up straight overhead or under the
    // floor, and nothing comes closer than r.
    const azimuth = Math.atan2(dir[2], dir[0]);
    const elevation = Math.asin(Math.max(-1, Math.min(1, dir[1])));
    const e = elevation * (elevation > 0 ? INSIDE.up : INSIDE.down);
    return [
        Math.cos(azimuth) * Math.cos(e) * r,
        Math.sin(e) * r,
        Math.sin(azimuth) * Math.cos(e) * r,
    ];
});

/** 0 = the cloud over the projector, 1 = all around you. */
export const blend = { t: 0 };

export const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
