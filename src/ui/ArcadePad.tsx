'use client';

import { useEffect, type PointerEvent } from 'react';
import { machine, pad } from '@/world/arcade/machine';

/**
 * Controls for the arcade cabinet, over the canvas while you're at it.
 *
 * On a phone: a steering button under each thumb, held to steer, and a
 * start button. Each one captures its pointer, so a thumb sliding off the
 * button still lets go of it when lifted. On a computer: just a reminder of
 * the keys (steering reads the same arrow/A-D keys as walking).
 */
export function ArcadePad({ touch }: { touch: boolean }) {
    // Unmounting (stepping back) must never leave the car steering.
    useEffect(
        () => () => {
            pad.left = pad.right = false;
        },
        [],
    );

    if (!touch) {
        return (
            <p className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-panel px-3 py-1.5 text-xs text-muted backdrop-blur">
                <Key>← →</Key> or <Key>A D</Key> steer · <Key>Enter</Key> start
            </p>
        );
    }

    const hold = (side: 'left' | 'right') => ({
        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pad[side] = true;
        },
        onPointerUp: () => (pad[side] = false),
        onPointerCancel: () => (pad[side] = false),
        onLostPointerCapture: () => (pad[side] = false),
    });
    const steer =
        'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] z-30 grid size-20 touch-none select-none place-items-center rounded-full border border-white/30 bg-black/30 text-3xl text-white backdrop-blur active:bg-accent active:text-black';

    return (
        <>
            <button
                type="button"
                aria-label="Steer left"
                className={`${steer} left-[max(20px,env(safe-area-inset-left,0px))]`}
                {...hold('left')}
            >
                ◀
            </button>
            <button
                type="button"
                aria-label="Steer right"
                className={`${steer} right-[max(20px,env(safe-area-inset-right,0px))]`}
                {...hold('right')}
            >
                ▶
            </button>
            <button
                type="button"
                onClick={() => machine.press()}
                className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] left-1/2 z-30 -translate-x-1/2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black shadow-lg"
            >
                Start
            </button>
        </>
    );
}

function Key({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-fg">{children}</kbd>
    );
}
