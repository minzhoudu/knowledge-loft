/**
 * A simple model of the sun's path through the day. Pure functions, no three.js,
 * so they're easy to reason about and test.
 *
 * World directions: +z is south (the lobby's windows face it), -z north,
 * +x east, -x west. In the northern hemisphere the sun rises in the east,
 * swings through the south at noon, and sets in the west, which is exactly
 * what makes south-facing windows sunny.
 */

const deg = (d: number) => (d * Math.PI) / 180;

/** Sunrise/sunset in local hours. Fixed for now; the seasons feature can move them. */
export const SUNRISE = 6.5;
export const SUNSET = 19.5;
const MAX_ELEVATION = deg(58); // the sun's height at noon
const NIGHT_DEPTH = deg(28); // how far below the horizon it gets at midnight

export function clamp(x: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, x));
}

/** 0 below `a`, 1 above `b`, with an S-curve in between (same as GLSL's smoothstep). */
export function smoothstep(a: number, b: number, x: number) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

export type SunState = {
    /** Angle above the horizon in radians; negative at night. */
    elevation: number;
    /** Unit vector pointing *toward* the sun. */
    direction: [number, number, number];
};

/** Where the sun is at a given local time (hours, 0..24). */
export function sunAt(hours: number): SunState {
    const dayLength = SUNSET - SUNRISE;
    const p = (hours - SUNRISE) / dayLength; // 0 at sunrise, 1 at sunset

    let elevation: number;
    if (p >= 0 && p <= 1) {
        // Daytime: half a sine wave, highest at solar noon.
        elevation = Math.sin(Math.PI * p) * MAX_ELEVATION;
    } else {
        // Night: a mirrored dip below the horizon, deepest around midnight.
        const q = (((hours - SUNSET + 24) % 24) / (24 - dayLength)) % 1;
        elevation = -Math.sin(Math.PI * q) * NIGHT_DEPTH;
    }

    // Azimuth (compass angle from south): +100° (east-ish) at sunrise,
    // 0 at noon (due south), -100° (west-ish) at sunset.
    const azimuth = (0.5 - clamp(p, 0, 1)) * deg(200);

    const c = Math.cos(elevation);
    return {
        elevation,
        direction: [c * Math.sin(azimuth), Math.sin(elevation), c * Math.cos(azimuth)],
    };
}

/**
 * How much daylight there is, 0 (night) .. 1 (day). Ramps through twilight:
 * from 6° below the horizon (end of civil twilight) to 8° above it.
 */
export function daylight(elevation: number) {
    return smoothstep(deg(-6), deg(8), elevation);
}

/** How "golden hour" it is: high when the sun is low but still up. */
export function goldenHour(elevation: number) {
    return (1 - smoothstep(deg(2), deg(22), elevation)) * smoothstep(deg(-5), deg(1), elevation);
}

/** Hours as "HH:MM". */
export function formatHours(hours: number) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
