'use client';

import { StatsGl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useState } from 'react';
import { Hud } from '@/ui/Hud';
import { Ambience } from '@/world/audio/Ambience';
import { InteractionSystem } from '@/world/interaction/InteractionSystem';
import { Lighting } from '@/world/Lighting';
import { MapCamera } from '@/world/map/MapCamera';
import { MapOverlay } from '@/world/map/MapOverlay';
import { Outside } from '@/world/outside/Outside';
import { PostEffects } from '@/world/PostEffects';
import { DragLook } from '@/world/player/DragLook';
import { Player } from '@/world/player/Player';
import { PointerLook } from '@/world/player/PointerLook';
import { CareerRoom } from '@/world/rooms/career/CareerRoom';
import { HobbiesRoom } from '@/world/rooms/hobbies/HobbiesRoom';
import { Lobby } from '@/world/rooms/lobby/Lobby';
import { ProjectsRoom } from '@/world/rooms/projects/ProjectsRoom';
import { SeatCamera } from '@/world/seats/SeatCamera';
import { CarriedBook } from '@/world/bookshelf/CarriedBook';
import { ConstellationCamera } from '@/world/constellation/ConstellationCamera';
import { DarkRoom } from '@/world/constellation/DarkRoom';

/**
 * The 3D experience. Loaded client-only (see WorldClient), because WebGL,
 * pointer lock and the Rapier WASM module only exist in the browser.
 *
 * Add ?debug to the URL to draw every physics collider as a wireframe,
 * and ?perf for a performance meter (frame rate, CPU and GPU time per frame).
 */
/** Overall brightness, like a camera's exposure setting. */
const EXPOSURE = 1.25;

export default function Experience() {
    const [params] = useState(() => new URLSearchParams(window.location.search));
    const debug = params.has('debug');
    const perf = params.has('perf');

    return (
        <div className="fixed inset-0">
            <Canvas
                shadows="percentage" // PCF shadow filtering; three r187 dropped the old "soft" PCF variant
                flat // no tone mapping here: PostEffects does it, once, at the end
                gl={{ antialias: false }} // anti-aliasing happens in PostEffects (SMAA)
                onCreated={({ gl, scene, camera }) => {
                    // Like a camera's exposure: AgX tone mapping (PostEffects) reads it.
                    gl.toneMappingExposure = EXPOSURE;
                    if (process.env.NODE_ENV === 'development') {
                        Object.assign(window, { __gl: gl, __scene: scene, __camera: camera }); // poke at them from the console
                    }
                }}
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
                <SeatCamera />
                <CarriedBook />
                <ConstellationCamera />
                <DarkRoom />
                <Outside />
                <MapCamera />
                <MapOverlay />
                <InteractionSystem />
                <Ambience />
                <DragLook />
                <PointerLook />
                <PostEffects />
                {perf && <StatsGl className="perf-meter" />}
            </Canvas>
            <Hud />
        </div>
    );
}
