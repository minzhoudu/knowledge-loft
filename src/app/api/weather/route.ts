import { cacheLife } from 'next/cache';
import { about } from '@/content';
import { fromOpenMeteo, type LiveWeather } from '@/world/environment/weather';

/**
 * GET /api/weather: current weather at the studio.
 *
 * Why a server route instead of calling the weather service from the
 * browser? One cached request serves every visitor: with the cache below,
 * the service is asked at most about every 15 minutes, no matter how many
 * people are walking around. It also keeps the provider swappable without
 * touching client code.
 *
 * Data comes from Open-Meteo (free, no API key). Only the studio's public
 * city coordinates are sent; nothing about the visitor.
 */
export async function GET() {
    return Response.json(await getWeather());
}

async function getWeather(): Promise<LiveWeather | null> {
    'use cache';
    // Serve cached weather for up to 15 min, then refresh in the background.
    cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

    const c = about.coordinates;
    if (!c) return null;
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
        `&current=temperature_2m,weather_code,cloud_cover`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const json = (await res.json()) as { current?: Parameters<typeof fromOpenMeteo>[0] };
        return json.current ? fromOpenMeteo(json.current) : null;
    } catch {
        // Offline, slow or down: the scene just shows clear weather.
        return null;
    }
}
