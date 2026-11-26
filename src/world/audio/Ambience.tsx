'use client';

import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useWorld } from '@/store/world';
import { smoothstep } from '@/world/environment/sun';
import { environment, type Season } from '@/world/environment/time';
import { doorBetween, roomAt, type RoomId } from '@/world/rooms/zones';
import { getAudio, glide } from './engine';
import { footstep, schedule } from './sounds';

/**
 * Drives the audio from the world, every frame:
 *
 * 1. The listener (your ears) follows the camera, so positioned sounds
 *    (windows, doors) pan and fade as you move and turn.
 * 2. Room ambience crossfades as you walk from room to room; through an
 *    open door you still hear a bit of the room next door.
 * 3. Outdoor sounds follow the weather, time and season, and get more
 *    muffled the deeper inside you are (and when doors are shut).
 * 4. Footsteps, one per stride, from how far you actually moved.
 *
 * It renders nothing; it's a component only so it can use the render loop.
 */

const ROOMS: RoomId[] = ['lobby', 'projects', 'career', 'hobbies'];
const NEXT_DOOR = 0.2; // how much of an adjacent room you hear through an open door
const STRIDE = { walk: 0.7, run: 1.0 }; // metres per step
const RUN_SPEED = 3; // m/s above which steps are running steps

const BIRDS: Record<Season, number> = { spring: 1, summer: 0.8, autumn: 0.3, winter: 0.08 };
const CRICKETS: Record<Season, number> = { spring: 0.25, summer: 1, autumn: 0.12, winter: 0 };

const forward = new Vector3();
const last = new Vector3();
const state = { room: 'lobby' as RoomId, walked: 0, ready: false };

export function Ambience() {
    useFrame(({ camera }, delta) => {
        const e = getAudio();
        if (!e) return;
        const { ctx, layers: L } = e;
        const world = useWorld.getState();
        const exploring = world.mode === 'exploring';
        // Sitting at a desk or reading a book is still being in the room: full sound, no footsteps.
        const inRoom = exploring || world.mode === 'seated' || world.mode === 'holding';

        // Mute, and duck to a murmur while paused or reading a panel.
        glide(ctx, e.master.gain, world.muted ? 0 : inRoom ? 1 : 0.35, 0.6);

        // 1. Ears = camera.
        const p = camera.position;
        camera.getWorldDirection(forward);
        const l = ctx.listener;
        if (l.positionX) {
            l.positionX.value = p.x;
            l.positionY.value = p.y;
            l.positionZ.value = p.z;
            l.forwardX.value = forward.x;
            l.forwardY.value = forward.y;
            l.forwardZ.value = forward.z;
            l.upX.value = 0;
            l.upY.value = 1;
            l.upZ.value = 0;
        } else {
            // Older Safari only has the deprecated setters.
            l.setPosition(p.x, p.y, p.z);
            l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
        }

        // 2. Rooms. Outside every room (rare: inside a wall) keeps the last one.
        state.room = roomAt(p.x, p.z) ?? state.room;
        const here = state.room;
        const doorOpen = (other: RoomId) => {
            const door = doorBetween(here, other);
            return door !== null && !!world.doors[door];
        };
        for (const room of ROOMS) {
            const level = room === here ? 1 : doorOpen(room) ? NEXT_DOOR : 0;
            glide(ctx, L.rooms[room].gain, level, 1.2);
        }

        // 3. Outdoors. The lobby and lounge have the big windows; the gallery
        // and corridor hear the outside only through the lobby door.
        const windowed = here === 'lobby' || here === 'hobbies';
        const lobbyOpen = !windowed && doorOpen('lobby');
        glide(ctx, L.outdoor.bus.gain, windowed ? 1 : lobbyOpen ? 0.35 : 0.1, 1);
        glide(ctx, L.outdoor.muffle.frequency, windowed ? 3500 : lobbyOpen ? 1400 : 600, 1);

        const { rain, snow, cloud, daylight, season } = environment;
        const day = smoothstep(0.35, 0.8, daylight);
        const night = 1 - smoothstep(0.1, 0.35, daylight);
        glide(ctx, L.outdoor.rain.gain, rain, 0.5);
        // Always a breath of wind; more under cloud, more again in rain and snow.
        glide(ctx, L.outdoor.wind.gain, 0.08 + 0.15 * cloud + 0.35 * Math.max(rain, snow), 1);
        const dry = (1 - rain) * (1 - 0.8 * snow);
        glide(ctx, L.outdoor.crickets.gain, night * CRICKETS[season] * dry, 2);
        schedule(e, day * BIRDS[season] * dry);

        // 4. Footsteps: count real distance moved (walls stop you, so do they),
        // not keys held. Height is ignored so the eye bob of physics doesn't count.
        if (!state.ready) {
            last.copy(p);
            state.ready = true;
        }
        const moved = Math.hypot(p.x - last.x, p.z - last.z);
        last.copy(p);
        const dt = Math.max(delta, 1e-3);
        if (!exploring || moved > 2 || moved / dt < 0.3) {
            // Standing still (or a teleport): the next step starts fresh, half a stride in.
            state.walked = Math.min(state.walked, STRIDE.walk / 2);
            return;
        }
        const running = moved / dt > RUN_SPEED;
        state.walked += moved;
        const stride = running ? STRIDE.run : STRIDE.walk;
        if (state.walked >= stride) {
            state.walked -= stride;
            footstep(e, running ? 1 : 0.7);
        }
    });

    return null;
}
