'use client';

import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/ui/LoadingScreen';

/**
 * Client-only entry for the 3D world. `ssr: false` must live in a Client
 * Component, and it keeps three.js, R3F and Rapier out of the server render
 * and out of the initial HTML; they download as a separate chunk.
 */
const Experience = dynamic(() => import('./Experience'), {
    ssr: false,
    // The same loading screen the world shows next (LoadingCover), so the
    // hand-over from "downloading the code" to "loading the room" is seamless.
    loading: () => <LoadingScreen status="Opening the door…" />,
});

export function WorldClient() {
    return (
        <div id="world">
            <Experience />
        </div>
    );
}
