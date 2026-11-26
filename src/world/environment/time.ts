import { about } from '@/content';

/**
 * Time of day for the studio.
 *
 * "Live" follows the real clock in the studio's time zone (from content), so
 * visiting at midnight Novi Sad time shows a dark studio, whatever time it is
 * for the visitor. Without a time zone in content, it falls back to the
 * visitor's own clock.
 */

export type LightingMode = 'live' | 'day' | 'night';

/** Fixed times used by the Day and Night buttons. */
export const PRESET_HOURS: Record<Exclude<LightingMode, 'live'>, number> = {
    day: 13.5,
    night: 22.5,
};

const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    timeZone: about.timeZone, // undefined = the visitor's own time zone
});

/** Current local hours (0..24, fractional) in the studio's time zone. */
export function liveHours(now = new Date()) {
    const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
    return Number(parts.hour) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
}

/**
 * liveHours() for the render loop. Time-zone formatting is relatively slow
 * and the answer barely changes between frames, so recompute at most once a second.
 */
let cache = { at: 0, hours: 12 };
export function liveHoursCached() {
    const now = Date.now();
    if (now - cache.at > 1000) cache = { at: now, hours: liveHours(new Date(now)) };
    return cache.hours;
}

/** City name for the HUD clock, e.g. "Novi Sad" from "Novi Sad, Serbia". */
export const studioCity = about.timeZone ? about.location?.split(',')[0]?.trim() : undefined;

/**
 * Values the render loop shares each frame. Mutable on purpose: written by
 * DayNight 60 times a second and read by lamps, with no React re-renders.
 */
export const environment = {
    /** Hours currently shown (eases toward the target when the mode changes). */
    hours: 12,
    /** 0 = full night, 1 = full day. */
    daylight: 1,
};
