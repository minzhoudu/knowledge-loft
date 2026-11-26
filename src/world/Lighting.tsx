'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, Vector3, type DirectionalLight, type HemisphereLight } from 'three';
import { useWorld } from '@/store/world';
import { createSkyMaterial, Sky, type SkyUniforms } from '@/world/environment/Sky';
import { daylight, goldenHour, sunAt } from '@/world/environment/sun';
import { environment, liveHoursCached, PRESET_HOURS } from '@/world/environment/time';
import { WORLD_BOUNDS as B } from '@/world/rooms/bounds';

// Aim the sun at the middle of everything that's built.
const CENTER = new Vector3((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
// Half the floor plan's diagonal: a box this size covers the whole plan from
// any light direction, since no point is farther than that from the centre.
const HALF_SIZE = Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ) / 2 + 1;
const LIGHT_DISTANCE = 25; // how far from the centre the light is placed, along its direction
const MIN_LIGHT_ELEVATION = 0.05; // radians; keep the light above the horizon so it never shines up through floors
const MOON_DIR = new Vector3(-0.35, 0.75, 0.55).normalize(); // a fixed moon, high in the south-west
const EASE_RATE = 1.1; // how quickly the shown time catches up after a mode change (a ~3 s time-lapse)

// Palette. Daytime and night-time values; the render loop blends between them.
const C = {
    dayTop: new Color('#4f8fd6'),
    dayHorizon: new Color('#cfe3f0'),
    nightTop: new Color('#050914'),
    nightHorizon: new Color('#18233d'),
    goldHorizon: new Color('#f0a35e'),
    dayGround: new Color('#9aa6b0'),
    nightGround: new Color('#0b0e14'),
    sunNoon: new Color('#fff3e0'),
    sunLow: new Color('#ffb070'),
    moon: new Color('#9fb4ff'),
    hemiSkyDay: new Color('#e8eef5'),
    hemiSkyNight: new Color('#2a3550'),
    hemiGroundDay: new Color('#8a8178'),
    hemiGroundNight: new Color('#14100c'),
};

/**
 * Day/night lighting, driven by the time of day.
 *
 * Every frame:
 * 1. Work out the time to show ("live" clock, or the Day/Night preset), easing
 *    toward it so switching modes plays as a quick time-lapse, not a jump.
 * 2. Ask the sun model where the sun is and how much daylight there is.
 * 3. Push that into the sky shader, the sun (or moon) light and the ambient light.
 * Lamps read `environment.daylight` themselves and switch on as it gets dark.
 *
 * Nothing here touches React state: it's all mutation of three.js objects
 * inside useFrame, so the lighting animates without re-rendering anything.
 */
// One sky and one set of scratch values for the whole app. They live at
// module scope because the render loop mutates them every frame, and React's
// rules (rightly) forbid mutating values that came out of a hook.
const sky = createSkyMaterial();
const lightDir = new Vector3();

export function Lighting() {
    const sun = useRef<DirectionalLight>(null);
    const hemi = useRef<HemisphereLight>(null);
    const started = useRef(false);
    const get = useThree((s) => s.get);

    useEffect(() => {
        const light = sun.current;
        if (!light) return;
        // The target is an Object3D; it must be in the scene for its matrix to update.
        light.target.position.copy(CENTER);
        const { scene } = get();
        scene.add(light.target);
        return () => {
            scene.remove(light.target);
        };
    }, [get]);

    useFrame((_, delta) => {
        const light = sun.current;
        const amb = hemi.current;
        if (!light || !amb) return;

        // 1. Time to show.
        const mode = useWorld.getState().lighting;
        const target = mode === 'live' ? liveHoursCached() : PRESET_HOURS[mode];
        if (!started.current) {
            environment.hours = target; // no time-lapse on the first frame
            started.current = true;
        } else {
            // Shortest way around the 24 h clock (-12..+12), then ease toward it.
            const diff = ((target - environment.hours + 36) % 24) - 12;
            const t = 1 - Math.exp(-EASE_RATE * Math.min(delta, 0.1));
            environment.hours = (environment.hours + diff * t + 24) % 24;
        }

        // 2. Sun model.
        const { elevation, direction } = sunAt(environment.hours);
        const day = daylight(elevation);
        const gold = goldenHour(elevation);
        environment.daylight = day;

        // 3a. Sky.
        const u = sky.uniforms as SkyUniforms;
        u.uTop.value.lerpColors(C.nightTop, C.dayTop, day);
        u.uHorizon.value.lerpColors(C.nightHorizon, C.dayHorizon, day).lerp(C.goldHorizon, gold);
        u.uGround.value.lerpColors(C.nightGround, C.dayGround, day);
        u.uSunDir.value.set(...direction);
        u.uSunColor.value.lerpColors(C.sunNoon, C.sunLow, gold);
        u.uSunStrength.value = day;
        u.uStars.value = 1 - day;

        // 3b. Sun by day, moon by night. Squaring `day` keeps the sun faint in
        // twilight, so the hand-over to the moon isn't a visible jump.
        const sunUp = elevation > -0.035;
        if (sunUp) {
            lightDir.set(...direction);
            lightDir.y = Math.max(lightDir.y, Math.sin(MIN_LIGHT_ELEVATION));
            lightDir.normalize();
            light.color.lerpColors(C.sunNoon, C.sunLow, gold);
            light.intensity = 2.6 * day * day;
        } else {
            lightDir.copy(MOON_DIR);
            light.color.copy(C.moon);
            light.intensity = 0.3 * (1 - day);
        }
        light.position.copy(CENTER).addScaledVector(lightDir, LIGHT_DISTANCE);

        // 3c. Ambient: bright blue-white by day, dim blue at night.
        amb.color.lerpColors(C.hemiSkyNight, C.hemiSkyDay, day);
        amb.groundColor.lerpColors(C.hemiGroundNight, C.hemiGroundDay, day);
        amb.intensity = 0.35 + 1.65 * day;
    });

    const s = HALF_SIZE;
    return (
        <>
            <Sky material={sky} />
            <hemisphereLight ref={hemi} />
            <directionalLight
                ref={sun}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0003}
                shadow-normalBias={0.03}
                shadow-camera-left={-s}
                shadow-camera-right={s}
                shadow-camera-top={s}
                shadow-camera-bottom={-s}
                shadow-camera-near={0.5}
                shadow-camera-far={LIGHT_DISTANCE + s + 5}
            />
        </>
    );
}
