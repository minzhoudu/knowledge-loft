import { about } from '@/content';

/**
 * Time, date and season for the studio.
 *
 * "Live" follows the real clock and calendar in the studio's time zone (from
 * content), so visiting at midnight Novi Sad time shows a dark studio, and in
 * January a low winter sun, whatever the visitor's own time is. Without a
 * time zone in content, it falls back to the visitor's clock.
 */

export type LightingMode = 'live' | 'day' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonMode = 'live' | Season;

/** Fixed times used by the Day and Night buttons. */
export const PRESET_HOURS: Record<Exclude<LightingMode, 'live'>, number> = {
    day: 12.5,
    night: 22.5,
};

/** A representative day of the year for each season preview (mid-season). */
export const SEASON_DAY: Record<Season, number> = {
    spring: 110, // 20 April
    summer: 196, // 15 July
    autumn: 293, // 20 October
    winter: 15, // 15 January
};

/** Where the sun maths happens if content has no coordinates. */
export const COORDS = about.coordinates ?? { lat: 45, lon: 15 };

const formatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset', // e.g. "GMT+1", "GMT+5:30", "GMT"
    timeZone: about.timeZone, // undefined = the visitor's own time zone
});

export type Clock = {
    /** Local hours, 0..24 (fractional). */
    hours: number;
    /** 1..366 */
    dayOfYear: number;
    /** 1..12 */
    month: number;
    /** Offset from UTC in hours, including summer time. */
    utcOffset: number;
};

/** The current local date and time in the studio's time zone. */
export function liveClock(now = new Date()): Clock {
    const p = Object.fromEntries(formatter.formatToParts(now).map((x) => [x.type, x.value]));
    const year = Number(p.year);
    const month = Number(p.month);
    const day = Number(p.day);
    const dayOfYear = Math.round(
        (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000,
    );
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(p.timeZoneName ?? '');
    const utcOffset = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3] ?? 0) / 60) : 0;
    return {
        hours: Number(p.hour) + Number(p.minute) / 60 + Number(p.second) / 3600,
        dayOfYear,
        month,
        utcOffset,
    };
}

/**
 * liveClock() for the render loop. Time-zone formatting is relatively slow
 * and the answer barely changes between frames, so recompute at most once a second.
 */
let cache: { at: number; clock: Clock } | null = null;
export function liveClockCached() {
    const now = Date.now();
    if (!cache || now - cache.at > 1000) cache = { at: now, clock: liveClock(new Date(now)) };
    return cache.clock;
}

/** Meteorological seasons (northern hemisphere): whole months, which is how people talk about them. */
export function seasonOf(month: number): Season {
    if (month === 12 || month <= 2) return 'winter';
    if (month <= 5) return 'spring';
    if (month <= 8) return 'summer';
    return 'autumn';
}

/** City name for the HUD clock, e.g. "Novi Sad" from "Novi Sad, Serbia". */
export const studioCity = about.timeZone ? about.location?.split(',')[0]?.trim() : undefined;

/**
 * Values the render loop shares each frame. Mutable on purpose: written by
 * the lighting and weather systems 60 times a second and read by lamps and
 * particles, with no React re-renders.
 */
export const environment = {
    /** Hours currently shown (eases toward the target when the mode changes). */
    hours: 12,
    /** 0 = full night, 1 = full day. */
    daylight: 1,
    /** Current (eased) weather, each 0..1. */
    cloud: 0,
    rain: 0,
    snow: 0,
    /** Season currently shown (live or previewed). */
    season: 'winter' as Season,
};
