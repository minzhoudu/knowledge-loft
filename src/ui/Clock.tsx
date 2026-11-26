'use client';

import { useEffect, useState } from 'react';
import { useWorld } from '@/store/world';
import { formatHours } from '@/world/environment/sun';
import {
    liveClock,
    studioCity,
    type LightingMode,
    type SeasonMode,
} from '@/world/environment/time';
import type { LiveWeather, WeatherMode } from '@/world/environment/weather';

const WEATHER_REFRESH_MS = 15 * 60 * 1000; // matches the server cache: no point asking more often

/** Re-render every `ms` with the current live time. */
function useLiveHours(ms = 15_000) {
    const [hours, setHours] = useState(() => liveClock().hours);
    useEffect(() => {
        const id = setInterval(() => setHours(liveClock().hours), ms);
        return () => clearInterval(id);
    }, [ms]);
    return hours;
}

/** Keeps the store's live weather fresh. Mount once (in the HUD). */
export function useWeatherFeed() {
    const setLiveWeather = useWorld((s) => s.setLiveWeather);
    useEffect(() => {
        let alive = true;
        const load = () =>
            fetch('/api/weather')
                .then((r) => (r.ok ? (r.json() as Promise<LiveWeather | null>) : null))
                .then((w) => alive && setLiveWeather(w))
                .catch(() => {}); // offline: keep whatever we had
        load();
        const id = setInterval(load, WEATHER_REFRESH_MS);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [setLiveWeather]);
}

/** "21:40 · Novi Sad · 6°C, light rain" while live; "Night preview" etc. otherwise. */
export function Clock({ className = '' }: { className?: string }) {
    const lighting = useWorld((s) => s.lighting);
    const weather = useWorld((s) => s.weather);
    const live = useWorld((s) => s.liveWeather);
    const hours = useLiveHours();

    const parts =
        lighting === 'live'
            ? [formatHours(hours), studioCity]
            : [`${lighting === 'day' ? 'Day' : 'Night'} preview`];
    if (weather === 'live' && live) parts.push(`${live.temperature}°C, ${live.summary}`);
    else if (weather !== 'live') parts.push(weather);

    return (
        <p className={`font-mono text-xs uppercase tracking-widest ${className}`}>
            {parts.filter(Boolean).join(' · ')}
        </p>
    );
}

/** One row of options: a label and a group of toggle buttons. */
function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={value === o.value}
                        onClick={() => onChange(o.value)}
                        className="rounded-md border border-line px-2.5 py-1 text-sm aria-pressed:border-accent aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const LIGHT: { value: LightingMode; label: string }[] = [
    { value: 'live', label: 'Live' },
    { value: 'day', label: 'Day' },
    { value: 'night', label: 'Night' },
];
const SEASON: { value: SeasonMode; label: string }[] = [
    { value: 'live', label: 'Live' },
    { value: 'spring', label: 'Spring' },
    { value: 'summer', label: 'Summer' },
    { value: 'autumn', label: 'Autumn' },
    { value: 'winter', label: 'Winter' },
];
const WEATHER: { value: WeatherMode; label: string }[] = [
    { value: 'live', label: 'Live' },
    { value: 'clear', label: 'Clear' },
    { value: 'rain', label: 'Rain' },
    { value: 'snow', label: 'Snow' },
];

/** "Live" follows the real studio; the rest are previews. */
export function EnvironmentControls() {
    const s = useWorld();
    return (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Segmented label="Light" value={s.lighting} options={LIGHT} onChange={s.setLighting} />
            <Segmented label="Season" value={s.season} options={SEASON} onChange={s.setSeason} />
            <Segmented
                label="Weather"
                value={s.weather}
                options={WEATHER}
                onChange={s.setWeather}
            />
        </div>
    );
}
