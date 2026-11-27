'use client';

import { useProgress } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useWorld } from '@/store/world';
import { LoadingScreen } from '@/ui/LoadingScreen';

/**
 * Knowing when the world is ready to be seen.
 *
 * Three things load in the background, and the loading screen waits for all
 * of them:
 *
 * 1. The physics engine (Rapier, compiled to WebAssembly). The rooms are
 *    inside <Physics>, so they don't even start to load until it's there.
 * 2. Files: furniture models and wall textures. They all go through
 *    three.js' shared loading manager, which counts requests started and
 *    finished; drei's useProgress listens to it.
 * 3. The first frames. The GPU compiles each material's shader the first
 *    time it's drawn, which stutters; drawing a few frames under the cover
 *    gets that done before anyone sees it.
 *
 * The manager's count can read "all done" too early: the street outside
 * loads first, before the rooms have even asked for their files. So "ready"
 * means: physics is up, nothing is loading, and it has stayed that way for
 * a moment.
 */

const physics = { ready: false };
/** Shared with the loading screen: are we in the final settle (nothing left to download)? */
const watch = { settling: false };
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    Object.assign(window, { __progress: useProgress, __loading: { physics, watch } }); // poke at them from the console
}
/** Frames in a row with nothing loading before we call it done. */
const SETTLE_FRAMES = 20;
/** Never keep anyone staring at a loading screen forever (a stuck request, a slow phone). */
const GIVE_UP_MS = 30_000;

/** Mount inside <Physics>: it only renders once the physics engine has loaded. */
export function PhysicsReady() {
    useEffect(() => {
        physics.ready = true;
    }, []);
    return null;
}

/** Inside the Canvas: watches loading and marks the world ready (see above). */
export function ReadyWatcher() {
    const quiet = useRef(0);
    const started = useRef(0);

    useFrame(() => {
        const world = useWorld.getState();
        if (world.ready) return;
        started.current ||= performance.now();
        const { active, loaded, total } = useProgress.getState();
        const idle = physics.ready && !active && loaded >= total;
        watch.settling = idle;
        quiet.current = idle ? quiet.current + 1 : 0;
        if (quiet.current >= SETTLE_FRAMES || performance.now() - started.current > GIVE_UP_MS) {
            world.setReady();
        }
    });

    return null;
}

type Stage = 'physics' | 'files' | 'settling' | 'ready';
const STATUS: Record<Stage, string> = {
    physics: 'Starting the physics…',
    files: 'Furnishing the loft…',
    settling: 'Switching on the lights…',
    ready: 'Ready',
};

/**
 * The loading screen over the canvas while the world loads, fading out
 * once it's ready.
 *
 * The bar is part measured, part paced. The file count can't be trusted on
 * its own: the total grows as each room asks for its files (so the ratio
 * jumps around), and the last stretch, compiling shaders, has no count at
 * all. So each stage has a target (physics 25%, files 25–90%, settling up
 * to 97%), a time-based ceiling keeps it from racing ahead early, and the
 * bar eases toward the target and never moves backwards. It's written
 * straight to the element's style every animation frame, not through React
 * state, so it costs no re-renders.
 */
export function LoadingCover() {
    const ready = useWorld((s) => s.ready);
    const [stage, setStage] = useState<Stage>('physics');
    const [gone, setGone] = useState(false);
    const bar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;
        let shown = 0;
        let last = performance.now();
        const start = last;
        const tick = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const { loaded, total } = useProgress.getState();
            const done = useWorld.getState().ready;
            const next: Stage = done
                ? 'ready'
                : !physics.ready
                  ? 'physics'
                  : watch.settling
                    ? 'settling'
                    : 'files';
            setStage(next); // React skips the re-render when the stage hasn't changed

            const files = total > 0 ? loaded / total : 0;
            const target = { physics: 0.25, files: 0.25 + 0.65 * files, settling: 0.97, ready: 1 }[
                next
            ];
            const ceiling = done ? 1 : 0.97 * (1 - Math.exp(-(now - start) / 2500));
            const goal = Math.min(target, ceiling);
            shown = Math.max(shown, shown + (goal - shown) * (1 - Math.exp(-dt * (done ? 12 : 3))));
            if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
            if (!done || shown < 0.999) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!ready) return;
        const t = setTimeout(() => setGone(true), 900); // after the bar fills and the fade ends
        return () => clearTimeout(t);
    }, [ready]);

    if (gone) return null;
    return <LoadingScreen barRef={bar} status={STATUS[stage]} leaving={ready} />;
}
