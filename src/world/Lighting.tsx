'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Color, Vector3, type DirectionalLight, type Fog, type HemisphereLight } from 'three';
import { useWorld } from '@/store/world';
import { Ground, groundMaterial } from '@/world/environment/Ground';
import { Precipitation } from '@/world/environment/Precipitation';
import { ENV_INTENSITY, EnvironmentMap } from '@/world/environment/EnvironmentMap';
import { createSkyMaterial, Sky, type SkyUniforms } from '@/world/environment/Sky';
import { daylight, goldenHour, sunAt } from '@/world/environment/sun';
import {
    COORDS,
    environment,
    liveClockCached,
    PRESET_HOURS,
    SEASON_DAY,
    seasonOf,
    type Season,
} from '@/world/environment/time';
import { PRESET_LOOK } from '@/world/environment/weather';
import { WORLD_BOUNDS as B } from '@/world/rooms/bounds';
import { roomAt } from '@/world/rooms/zones';
import { blindDrop } from '@/world/switches/state';

// Aim the sun at the middle of everything that's built.
const CENTER = new Vector3((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
// Half the floor plan's diagonal: a box this size covers the whole plan from
// any light direction, since no point is farther than that from the centre.
const HALF_SIZE = Math.hypot(B.maxX - B.minX, B.maxZ - B.minZ) / 2 + 1;
const LIGHT_DISTANCE = 25; // how far from the centre the light is placed, along its direction
const MIN_LIGHT_ELEVATION = 0.05; // radians; keep the light above the horizon so it never shines up through floors
const MOON_DIR = new Vector3(-0.35, 0.75, 0.55).normalize(); // a fixed moon, high in the south-west
const TIME_EASE = 1.1; // time-lapse speed after a Light change (~3 s)
const WEATHER_EASE = 0.5; // weather drifts in over a few seconds
const SNOW_SETTLE = 0.07; // snow covers the ground over ~15-20 s while it's snowing...
const SNOW_MELT = 0.015; // ...and melts slower still
/**
 * Exposure, like a camera's: brighter at night so lamplit rooms aren't
 * murky, lower by day so sunlit white walls don't glare (your eyes do the
 * same, adapting to the light).
 */
const EXPOSURE_NIGHT = 1.25;
const EXPOSURE_DAY = 1.0;
/** How much of the daylight closed blinds keep out of the room you're in. */
const BLINDS_BLOCK = 0.7;

// Palette. The render loop blends between these.
const C = {
    dayTop: new Color('#4f8fd6'),
    dayHorizon: new Color('#cfe3f0'),
    nightTop: new Color('#050914'),
    nightHorizon: new Color('#18233d'),
    goldHorizon: new Color('#f0a35e'),
    dayGround: new Color('#9aa6b0'),
    nightGround: new Color('#0b0e14'),
    dayOvercast: new Color('#a7afb8'),
    nightOvercast: new Color('#0e1219'),
    sunNoon: new Color('#fff3e0'),
    sunLow: new Color('#ffb070'),
    moon: new Color('#9fb4ff'),
    hemiSkyDay: new Color('#e8eef5'),
    hemiSkyNight: new Color('#2a3550'),
    hemiGroundDay: new Color('#b3a594'), // light bouncing up off a warm floor
    hemiGroundNight: new Color('#14100c'),
    snow: new Color('#eef2f6'),
};

/** The colour of the land outside, per season. */
const GROUND: Record<Season, Color> = {
    spring: new Color('#7fae5a'),
    summer: new Color('#6f9844'),
    autumn: new Color('#a88a4e'),
    winter: new Color('#8f8d7c'),
};

// One sky and one set of scratch values for the whole app. They live at
// module scope because the render loop mutates them every frame, and React's
// rules (rightly) forbid mutating values that came out of a hook.
const sky = createSkyMaterial();
const lightDir = new Vector3();
const groundTarget = new Color();
const ground = { snowCover: 0 }; // 0..1, how much snow has settled on the ground
const shade = { value: 0 }; // how shaded the room you're in is by its blinds, eased

/** Moves `value` toward `target` by a frame-rate-independent fraction. */
function ease(value: number, target: number, rate: number, delta: number) {
    return value + (target - value) * (1 - Math.exp(-rate * Math.min(delta, 0.1)));
}

/**
 * Sky, sun, moon, ambient light, fog and the ground: all driven by the time,
 * the date (season) and the weather.
 *
 * Every frame:
 * 1. Time and date to show: the live clock/calendar, or the Light/Season presets.
 *    The time eases toward its target, so switching plays as a time-lapse.
 * 2. The sun's real position for that date and time (see sun.ts).
 * 3. Weather to show: live from /api/weather, or a preset; eased so rain and
 *    clouds roll in instead of switching on.
 * 4. Push all of it into the sky shader, lights, fog and ground colour.
 * Lamps and rain/snow read the shared `environment` object themselves.
 *
 * Nothing here touches React state: it's all mutation of three.js objects
 * inside useFrame, so the environment animates without re-rendering anything.
 */
export function Lighting() {
    const sun = useRef<DirectionalLight>(null);
    const hemi = useRef<HemisphereLight>(null);
    const fog = useRef<Fog>(null);
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

    useFrame(({ camera, gl, scene }, delta) => {
        const light = sun.current;
        const amb = hemi.current;
        if (!light || !amb) return;
        const world = useWorld.getState();
        const clock = liveClockCached();

        // 1. Time and date.
        const targetHours = world.lighting === 'live' ? clock.hours : PRESET_HOURS[world.lighting];
        const season: Season = world.season === 'live' ? seasonOf(clock.month) : world.season;
        const dayOfYear = world.season === 'live' ? clock.dayOfYear : SEASON_DAY[season];

        // 3 (early, so the first frame starts settled). Weather to show.
        const look =
            world.weather === 'live'
                ? (world.liveWeather?.look ?? PRESET_LOOK.clear)
                : PRESET_LOOK[world.weather];

        if (!started.current) {
            // First frame: jump straight to the right state, no time-lapse.
            environment.hours = targetHours;
            environment.cloud = look.cloud;
            environment.rain = look.rain;
            environment.snow = look.snow;
            groundMaterial.color.copy(GROUND[season]);
            started.current = true;
        } else {
            // Shortest way around the 24 h clock (-12..+12), then ease toward it.
            const diff = ((targetHours - environment.hours + 36) % 24) - 12;
            environment.hours = (ease(0, diff, TIME_EASE, delta) + environment.hours + 24) % 24;
            environment.cloud = ease(environment.cloud, look.cloud, WEATHER_EASE, delta);
            environment.rain = ease(environment.rain, look.rain, WEATHER_EASE, delta);
            environment.snow = ease(environment.snow, look.snow, WEATHER_EASE, delta);
        }
        environment.season = season;
        const { cloud, rain, snow } = environment;

        // 2. The sun for this place, date and time.
        const { elevation, direction } = sunAt({
            hours: environment.hours,
            dayOfYear,
            utcOffset: clock.utcOffset,
            lat: COORDS.lat,
            lon: COORDS.lon,
        });
        const day = daylight(elevation);
        const gold = goldenHour(elevation) * (1 - cloud); // no golden hour under clouds
        environment.daylight = day * (1 - 0.35 * cloud); // overcast days feel dimmer (lamps come on earlier)

        // 4a. Sky.
        const u = sky.uniforms as SkyUniforms;
        u.uTop.value.lerpColors(C.nightTop, C.dayTop, day);
        u.uHorizon.value.lerpColors(C.nightHorizon, C.dayHorizon, day).lerp(C.goldHorizon, gold);
        u.uGround.value.lerpColors(C.nightGround, C.dayGround, day);
        u.uSunDir.value.set(...direction);
        u.uSunColor.value.lerpColors(C.sunNoon, C.sunLow, gold);
        u.uSunStrength.value = day;
        u.uStars.value = 1 - day;
        u.uCloud.value = cloud;
        u.uOvercast.value.lerpColors(C.nightOvercast, C.dayOvercast, day);

        // 4b. Sun by day, moon by night. Squaring `day` keeps the sun faint in
        // twilight, so the hand-over to the moon isn't a visible jump. Clouds
        // block most direct light (and so most shadow), leaving the soft ambient.
        if (elevation > -0.035) {
            lightDir.set(...direction);
            lightDir.y = Math.max(lightDir.y, Math.sin(MIN_LIGHT_ELEVATION));
            lightDir.normalize();
            light.color.lerpColors(C.sunNoon, C.sunLow, gold);
            light.intensity = 2.6 * day * day * (1 - 0.85 * cloud);
        } else {
            lightDir.copy(MOON_DIR);
            light.color.copy(C.moon);
            light.intensity = 0.3 * (1 - day) * (1 - cloud);
        }
        light.position.copy(CENTER).addScaledVector(lightDir, LIGHT_DISTANCE);

        // 4c. Ambient: bright blue-white by day, dim blue at night, a bit flatter when overcast.
        // Ambient light has no position, so it can't be blocked by blinds the way
        // the sun is (by their shadow). Instead it follows the room you're in:
        // the further its blinds are down, the less daylight reaches you.
        const room = roomAt(camera.position.x, camera.position.z);
        shade.value = ease(shade.value, room ? blindDrop[room] : 0, 4, delta);
        const open = 1 - BLINDS_BLOCK * shade.value * day;
        amb.color.lerpColors(C.hemiSkyNight, C.hemiSkyDay, day);
        amb.groundColor.lerpColors(C.hemiGroundNight, C.hemiGroundDay, day);
        amb.intensity = (0.35 + 1.4 * day) * (1 - 0.2 * cloud) * open;
        scene.environmentIntensity = ENV_INTENSITY * open; // the sky's reflections, too
        gl.toneMappingExposure = EXPOSURE_NIGHT + (EXPOSURE_DAY - EXPOSURE_NIGHT) * day;

        // 4d. Fog matches the horizon, so the far ground melts into the sky.
        // Rain and snow pull it closer, like real murky weather.
        if (fog.current) {
            fog.current.color.copy(u.uHorizon.value).lerp(u.uOvercast.value, cloud * 0.92);
            fog.current.near = 45 - 25 * Math.max(rain, snow);
            fog.current.far = 150 - 80 * Math.max(rain, snow);
        }

        // 4e. Ground: season colour, darker when wet, whiter as snow settles.
        ground.snowCover =
            snow > 0.2
                ? Math.min(1, ground.snowCover + SNOW_SETTLE * snow * delta)
                : Math.max(0, ground.snowCover - SNOW_MELT * delta);
        groundTarget
            .copy(GROUND[season])
            .multiplyScalar(1 - 0.35 * rain)
            .lerp(C.snow, ground.snowCover);
        groundMaterial.color.lerp(groundTarget, 1 - Math.exp(-2 * Math.min(delta, 0.1)));
    });

    const s = HALF_SIZE;
    return (
        <>
            <Sky material={sky} />
            <EnvironmentMap material={sky} />
            <Ground />
            <Precipitation />
            <fog ref={fog} attach="fog" args={['#cfe3f0', 45, 150]} />
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
