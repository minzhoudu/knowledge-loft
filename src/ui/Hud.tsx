'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { performAction, useWorld, type FocusTarget } from '@/store/world';
import { enterWorld, isTouchDevice } from '@/world/player/input';
import { Clock, EnvironmentControls, useWeatherFeed } from './Clock';
import { Joystick } from './Joystick';
import { PanelBody, panelTitle } from './sections';

/** Resume walking with whichever look style is already in use. */
function resume() {
    enterWorld({ preferDrag: useWorld.getState().look === 'drag' });
}

/**
 * Everything 2D drawn over the canvas: start/pause screen, crosshair,
 * inspect prompt, touch controls and content panels. It's plain DOM on
 * purpose: text stays crisp, selectable and accessible, which 3D text never is.
 */
export function Hud() {
    const mode = useWorld((s) => s.mode);
    const touch = useWorld((s) => s.touch);
    const lockFailed = useWorld((s) => s.lockFailed);
    const focused = useWorld((s) => s.focused);
    const openPanel = useWorld((s) => s.openPanel);
    // Only re-render for the focused door's state, not every door in the world.
    const focusedDoorOpen = useWorld((s) =>
        s.focused?.action.kind === 'door' ? !!s.doors[s.focused.action.door] : false,
    );
    const verb = focused ? actionVerb(focused, focusedDoorOpen) : '';
    useWeatherFeed();
    // Decides which controls to describe before the visitor has entered.
    const [touchDevice] = useState(isTouchDevice);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const s = useWorld.getState();
            if (e.code === 'KeyE' && s.mode === 'exploring' && s.focused) {
                performAction(s.focused.action);
            } else if (e.code === 'Escape' && s.mode === 'reading') {
                s.close();
            } else if (e.code === 'Escape' && s.mode === 'exploring' && s.look === 'drag') {
                // Pointer lock releases on Esc by itself; drag mode needs to be told.
                s.setMode('paused');
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <>
            {mode === 'exploring' && (
                <>
                    <div
                        aria-hidden
                        className="pointer-events-none fixed left-1/2 top-1/2 size-1.5 -translate-1/2 rounded-full bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    />
                    <Clock className="pointer-events-none fixed left-[max(16px,env(safe-area-inset-left,0px))] top-[calc(env(safe-area-inset-top,0px)+20px)] rounded-full bg-panel px-3 py-1.5 text-fg backdrop-blur" />

                    {focused && !touch && (
                        <div className="pointer-events-none fixed left-1/2 top-[58%] -translate-x-1/2 rounded-lg bg-panel px-3 py-2 text-sm text-fg backdrop-blur">
                            <kbd className="mr-2 rounded border border-line px-1.5 py-0.5 font-mono text-xs">
                                E
                            </kbd>
                            {verb} · {focused.label}
                        </div>
                    )}

                    {touch && (
                        <>
                            <Joystick />
                            <button
                                type="button"
                                onClick={() => useWorld.getState().setMode('paused')}
                                className="fixed right-[max(16px,env(safe-area-inset-right,0px))] top-[calc(env(safe-area-inset-top,0px)+16px)] rounded-full bg-panel px-4 py-2 text-sm font-semibold text-fg backdrop-blur"
                            >
                                Pause
                            </button>
                            {focused && (
                                <button
                                    type="button"
                                    onClick={() => performAction(focused.action)}
                                    className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+48px)] right-[max(24px,env(safe-area-inset-right,0px))] max-w-[45vw] rounded-2xl bg-accent px-5 py-3 text-left text-sm font-semibold text-black shadow-lg"
                                >
                                    {verb}
                                    <span className="block text-xs font-normal opacity-80">
                                        {focused.label}
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </>
            )}

            {(mode === 'intro' || mode === 'paused') && (
                <div className="fixed inset-0 grid place-items-center bg-black/35 px-4">
                    <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-panel p-6 text-fg backdrop-blur">
                        <Clock className="text-muted" />
                        <h1 className="font-display text-2xl font-bold">
                            {mode === 'intro' ? 'Studio loft' : 'Paused'}
                        </h1>
                        {touchDevice ? (
                            <ul className="flex flex-col gap-1 text-sm text-muted">
                                <li>Left thumb: drag to walk</li>
                                <li>Right thumb: drag to look around</li>
                                <li>
                                    Tap <span className="text-fg">Inspect</span> when you face a
                                    warm-coloured object
                                </li>
                            </ul>
                        ) : (
                            <ul className="flex flex-col gap-1 text-sm text-muted">
                                <li>
                                    <Key>W A S D</Key> walk, <Key>Shift</Key> run
                                </li>
                                <li>
                                    <Key>Mouse</Key> look around
                                </li>
                                <li>
                                    <Key>E</Key> inspect the warm-coloured objects
                                </li>
                                <li>
                                    <Key>Esc</Key> pause
                                </li>
                            </ul>
                        )}
                        <button
                            type="button"
                            onClick={mode === 'intro' ? () => enterWorld() : resume}
                            className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            {mode === 'intro' ? 'Enter' : 'Resume'}
                        </button>
                        <EnvironmentControls />
                        {lockFailed && (
                            <div
                                className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm"
                                role="status"
                            >
                                <p className="text-muted">
                                    The browser didn&apos;t capture the mouse. Wait a second and try
                                    again, or look around by dragging instead.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => enterWorld({ preferDrag: true })}
                                    className="self-start text-accent underline-offset-4 hover:underline"
                                >
                                    Use drag to look
                                </button>
                            </div>
                        )}
                        <Link
                            href="/quick"
                            className="text-center text-sm text-muted underline-offset-4 hover:underline"
                        >
                            Skip the tour: quick view
                        </Link>
                    </div>
                </div>
            )}

            {mode === 'reading' && openPanel && (
                <div
                    className="fixed inset-0 flex items-end justify-end bg-black/25 p-4 sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="panel-title"
                >
                    <section className="flex max-h-[85%] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-panel p-6 text-fg backdrop-blur">
                        <div className="flex items-center justify-between gap-4">
                            <h2 id="panel-title" className="font-display text-xl font-bold">
                                {panelTitle(openPanel)}
                            </h2>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => {
                                    useWorld.getState().close();
                                    resume();
                                }}
                                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                            >
                                Back to walking
                            </button>
                        </div>
                        <PanelBody panel={openPanel} />
                    </section>
                </div>
            )}
        </>
    );
}

function actionVerb(target: FocusTarget, doorOpen: boolean) {
    if (target.action.kind === 'door') return doorOpen ? 'Close' : 'Open';
    return 'Inspect';
}

function Key({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-xs text-fg">
            {children}
        </kbd>
    );
}
