'use client';

import { useEffect, useRef } from 'react';
import { joystick } from '@/world/player/input';

const RADIUS = 56; // px the knob can travel from the centre
const DEAD_ZONE = 0.12; // ignore tiny accidental thumb movements

/**
 * A "floating" virtual joystick: it appears wherever your thumb lands inside
 * the lower-left zone, so you never have to find a fixed spot on the glass.
 *
 * It tracks a single pointer by id, so a second finger looking around on the
 * right side of the screen doesn't interfere. The knob is moved by writing
 * styles through refs instead of React state: pointer moves fire faster than
 * frames, and re-rendering React for each one would be wasted work.
 */
export function Joystick() {
    const zone = useRef<HTMLDivElement>(null);
    const base = useRef<HTMLDivElement>(null);
    const knob = useRef<HTMLDivElement>(null);
    const active = useRef<{ id: number; x: number; y: number } | null>(null);

    useEffect(() => {
        // Leaving the component (pause, panel) must never leave the player walking.
        return () => {
            joystick.x = 0;
            joystick.y = 0;
        };
    }, []);

    function show(x: number, y: number) {
        const b = base.current;
        if (!b) return;
        b.style.left = `${x}px`;
        b.style.top = `${y}px`;
        b.style.opacity = '1';
    }

    function moveKnob(dx: number, dy: number) {
        if (knob.current)
            knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    function release() {
        active.current = null;
        joystick.x = 0;
        joystick.y = 0;
        moveKnob(0, 0);
        if (base.current) base.current.style.opacity = '0';
    }

    return (
        <div
            ref={zone}
            aria-label="Movement joystick"
            className="fixed bottom-0 left-0 h-[55%] w-1/2 touch-none select-none"
            onPointerDown={(e) => {
                if (active.current) return;
                const rect = zone.current!.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                active.current = { id: e.pointerId, x, y };
                show(x, y);
                // Keep receiving this finger's moves even if it slides out of the zone.
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
                const a = active.current;
                if (!a || e.pointerId !== a.id) return;
                const rect = zone.current!.getBoundingClientRect();
                let dx = e.clientX - rect.left - a.x;
                let dy = e.clientY - rect.top - a.y;
                const len = Math.hypot(dx, dy);
                if (len > RADIUS) {
                    dx *= RADIUS / len;
                    dy *= RADIUS / len;
                }
                moveKnob(dx, dy);
                const mag = Math.min(len, RADIUS) / RADIUS;
                // Rescale past the dead zone so output still ramps smoothly from 0 to 1.
                const k = mag < DEAD_ZONE ? 0 : (mag - DEAD_ZONE) / (1 - DEAD_ZONE) / mag;
                joystick.x = (dx / RADIUS) * k;
                joystick.y = (dy / RADIUS) * k;
            }}
            onPointerUp={(e) => e.pointerId === active.current?.id && release()}
            onPointerCancel={(e) => e.pointerId === active.current?.id && release()}
        >
            {/* resting hint, so people know where the stick lives */}
            <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+48px)] left-[max(40px,env(safe-area-inset-left,0px))] grid size-28 place-items-center rounded-full border border-white/25 font-mono text-[10px] uppercase tracking-widest text-white/60">
                Move
            </div>
            <div
                ref={base}
                className="pointer-events-none absolute size-28 -translate-1/2 rounded-full border border-white/40 bg-black/20 opacity-0 transition-opacity duration-100"
            >
                <div
                    ref={knob}
                    className="absolute left-1/2 top-1/2 size-12 -translate-1/2 rounded-full bg-white/80 shadow-lg"
                />
            </div>
        </div>
    );
}
