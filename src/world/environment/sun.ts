/**
 * Where the sun is, from real astronomy: latitude, date and clock time.
 * Pure functions, no three.js, so they're easy to reason about and test.
 *
 * World directions: +x east, +y up, -z north, so +z is south (the lobby's
 * windows face it). In the northern hemisphere the sun crosses the southern
 * sky, which is what makes south-facing windows sunny.
 */

const RAD = Math.PI / 180;
const deg = (d: number) => d * RAD;

export function clamp(x: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, x));
}

/** 0 below `a`, 1 above `b`, with an S-curve in between (same as GLSL's smoothstep). */
export function smoothstep(a: number, b: number, x: number) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

export type SolarInput = {
    /** Local clock time, hours 0..24. */
    hours: number;
    /** Day of the year, 1..366. */
    dayOfYear: number;
    /** Local clock's offset from UTC in hours (e.g. +1 in winter, +2 in summer for Serbia). */
    utcOffset: number;
    lat: number;
    lon: number;
};

export type SunState = {
    /** Angle above the horizon in radians; negative at night. */
    elevation: number;
    /** Unit vector pointing *toward* the sun, in world axes. */
    direction: [number, number, number];
};

/**
 * Solar position with the standard textbook approximations (accurate to
 * well under a degree, plenty for lighting):
 *
 * 1. Declination: how far north/south of the equator the sun is today.
 *    It swings ±23.44° over the year because Earth's axis is tilted; that
 *    tilt is the whole reason seasons exist.
 * 2. Solar noon: when the sun is highest. It's not 12:00 on the clock:
 *    time zones are wide (longitude), clocks shift for summer time (UTC
 *    offset), and Earth's elliptical orbit nudges it a few minutes (the
 *    "equation of time").
 * 3. Hour angle: how far the sun has turned past solar noon, 15° per hour.
 * 4. Convert declination + hour angle + latitude into east/north/up.
 */
export function sunAt({ hours, dayOfYear, utcOffset, lat, lon }: SolarInput): SunState {
    const declination = deg(23.44) * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);

    const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
    const equationOfTimeMinutes = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    const solarNoon = 12 + utcOffset - lon / 15 - equationOfTimeMinutes / 60;

    const hourAngle = deg(15 * (hours - solarNoon));
    const phi = deg(lat);

    const east = -Math.cos(declination) * Math.sin(hourAngle);
    const north =
        Math.cos(phi) * Math.sin(declination) -
        Math.sin(phi) * Math.cos(declination) * Math.cos(hourAngle);
    const up =
        Math.sin(phi) * Math.sin(declination) +
        Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);

    return {
        elevation: Math.asin(clamp(up, -1, 1)),
        direction: [east, up, -north], // world z points south, so north is -z
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
