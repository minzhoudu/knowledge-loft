'use client';

import { useEffect, useState } from 'react';
import { useWorld } from '@/store/world';
import { formatHours } from '@/world/environment/sun';
import { liveHours, studioCity, type LightingMode } from '@/world/environment/time';

/** Re-render every `ms` with the current live time. */
function useLiveHours(ms = 15_000) {
    const [hours, setHours] = useState(liveHours);
    useEffect(() => {
        const id = setInterval(() => setHours(liveHours()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return hours;
}

/** "21:40 · Novi Sad" while live; "Night preview" when a preset is on. */
export function Clock({ className = '' }: { className?: string }) {
    const lighting = useWorld((s) => s.lighting);
    const hours = useLiveHours();
    const text =
        lighting === 'live'
            ? `${formatHours(hours)}${studioCity ? ` · ${studioCity}` : ''}`
            : `${lighting === 'day' ? 'Day' : 'Night'} preview`;
    return <p className={`font-mono text-xs uppercase tracking-widest ${className}`}>{text}</p>;
}

const OPTIONS: { value: LightingMode; label: string }[] = [
    { value: 'live', label: 'Live' },
    { value: 'day', label: 'Day' },
    { value: 'night', label: 'Night' },
];

/** Segmented control: follow the real clock, or preview day/night. */
export function LightingToggle() {
    const lighting = useWorld((s) => s.lighting);
    const setLighting = useWorld((s) => s.setLighting);
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">Light</span>
            <div className="flex gap-1.5" role="group" aria-label="Lighting">
                {OPTIONS.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={lighting === o.value}
                        onClick={() => setLighting(o.value)}
                        className="rounded-md border border-line px-3 py-1 text-sm aria-pressed:border-accent aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
