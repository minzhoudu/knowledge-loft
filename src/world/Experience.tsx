'use client';

import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useState } from 'react';
import { Hud } from '@/ui/Hud';
import { Ambience } from '@/world/audio/Ambience';
import { InteractionSystem } from '@/world/interaction/InteractionSystem';
import { Lighting } from '@/world/Lighting';
import { DragLook } from '@/world/player/DragLook';
import { Player } from '@/world/player/Player';
import { PointerLook } from '@/world/player/PointerLook';
import { CareerRoom } from '@/world/rooms/career/CareerRoom';
import { HobbiesRoom } from '@/world/rooms/hobbies/HobbiesRoom';
import { Lobby } from '@/world/rooms/lobby/Lobby';
import { ProjectsRoom } from '@/world/rooms/projects/ProjectsRoom';

/**
 * The 3D experience. Loaded client-only (see WorldClient), because WebGL,
 * pointer lock and the Rapier WASM module only exist in the browser.
 *
 * Add ?debug to the URL to draw every physics collider as a wireframe.
 */
export default function Experience() {
    const [debug] = useState(() => new URLSearchParams(window.location.search).has('debug'));

    return (
        <div className="fixed inset-0">
            <Canvas
                shadows="percentage" // PCF shadow filtering; three r187 dropped the old "soft" PCF variant
                dpr={[1, 1.5]} // cap pixel ratio: 2x/3x screens would otherwise render 4-9x the pixels
                camera={{ fov: 65, near: 0.05, far: 200 }}
            >
                <Lighting />
                <Suspense fallback={null}>
                    {/* Physics suspends while the Rapier WASM module downloads */}
                    <Physics debug={debug}>
                        <Lobby />
                        <ProjectsRoom />
                        <CareerRoom />
                        <HobbiesRoom />
                        <Player />
                    </Physics>
                </Suspense>
                <InteractionSystem />
                <Ambience />
                <DragLook />
                <PointerLook />
            </Canvas>
            <Hud />
        </div>
    );
}
