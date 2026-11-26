/**
 * Weather: what the API says, and what the scene should show.
 * Shared by the server route (which fetches it) and the client (which draws it).
 */

export type WeatherMode = 'live' | 'clear' | 'rain' | 'snow';

/** What the scene draws. Each value 0..1; they ease toward these over a few seconds. */
export type WeatherLook = { cloud: number; rain: number; snow: number };

/** Live conditions at the studio, as served by /api/weather. */
export type LiveWeather = {
    temperature: number; // °C
    /** Short description for the HUD, e.g. "light rain". */
    summary: string;
    look: WeatherLook;
};

export const PRESET_LOOK: Record<Exclude<WeatherMode, 'live'>, WeatherLook> = {
    clear: { cloud: 0.05, rain: 0, snow: 0 },
    rain: { cloud: 0.9, rain: 0.85, snow: 0 },
    snow: { cloud: 0.8, rain: 0, snow: 0.8 },
};

/**
 * Turns Open-Meteo's "current" block into our look. Weather is reported as a
 * WMO code (a standard used by weather services worldwide): ranges of numbers
 * mean drizzle, rain, snow, showers or thunderstorms, getting heavier within
 * each range.
 */
export function fromOpenMeteo(current: {
    temperature_2m: number;
    weather_code: number;
    cloud_cover: number;
}): LiveWeather {
    const code = current.weather_code;
    const cloud = Math.min(1, Math.max(0, current.cloud_cover / 100));
    const pick = (summary: string, rain: number, snow: number) => ({
        temperature: Math.round(current.temperature_2m),
        summary,
        look: { cloud: Math.max(cloud, rain || snow ? 0.75 : 0), rain, snow },
    });

    if (code >= 95) return pick('thunderstorm', 1, 0);
    if (code === 85 || code === 86) return pick('snow showers', 0, code === 86 ? 1 : 0.6);
    if (code >= 80 && code <= 82) return pick('rain showers', [0.5, 0.75, 1][code - 80], 0);
    if (code >= 71 && code <= 77) return pick('snow', 0, code >= 75 ? 1 : code === 73 ? 0.7 : 0.4);
    if (code >= 61 && code <= 67) return pick('rain', code >= 65 ? 1 : code === 63 ? 0.7 : 0.4, 0);
    if (code >= 51 && code <= 57) return pick('drizzle', 0.25, 0);
    if (code === 45 || code === 48) return pick('fog', 0, 0);
    if (code === 3) return pick('overcast', 0, 0);
    if (code === 1 || code === 2) return pick('partly cloudy', 0, 0);
    return pick('clear', 0, 0);
}
