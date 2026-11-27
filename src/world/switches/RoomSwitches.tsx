'use client';

import { companies } from '@/content';
import { roomFor } from '@/world/rooms/career/layout';
import { ROOM as HOBBIES, WINDOW as HOBBIES_WINDOW } from '@/world/rooms/hobbies/layout';
import { DOORS, ROOM as LOBBY, WINDOW as LOBBY_WINDOW } from '@/world/rooms/lobby/layout';
import { ROOM as PROJECTS } from '@/world/rooms/projects/layout';
import { Blinds } from './Blinds';
import { SwitchPlate } from './SwitchPlate';

/**
 * Every room's switches and blinds, placed from the layouts.
 *
 * Light switches sit where you'd reach for them: on the wall just past the
 * doorway as you come in, at the height of a hand (1.2 m). Blind switches
 * sit beside their window. Rotations turn each plate to face into its room.
 */

const SWITCH_Y = 1.2;
const PAST_DOOR = 0.4; // from the door's edge to the switch
const SURFACE = 0.002; // just off the wall, so it doesn't flicker into it
const career = roomFor(companies.length);
const X = LOBBY.halfWidth;
const Z = LOBBY.halfDepth;

const edge = (door: { center: number; width: number }, side: 1 | -1) =>
    door.center + side * (door.width / 2 + PAST_DOOR);

/** Blinds come down from just above the window to its sill. */
const blindsFor = (w: { x0: number; x1: number; y0: number; y1: number }) => ({
    x0: w.x0 + 0.04,
    x1: w.x1 - 0.04,
    top: w.y1 + 0.1,
    bottom: w.y0 + 0.01,
    z: Z - 0.07, // in front of the south walls' inner face (shared by lobby and lounge)
});

export function RoomSwitches() {
    return (
        <group>
            {/* Lobby: on the east wall by the lounge door, and beside the big window. */}
            <SwitchPlate
                room="lobby"
                what="lights"
                position={[X - SURFACE, SWITCH_Y, edge(DOORS.hobbies, 1)]}
                rotationY={-Math.PI / 2}
            />
            <SwitchPlate
                room="lobby"
                what="blinds"
                position={[(LOBBY_WINDOW.x1 + X) / 2, SWITCH_Y, Z - SURFACE]}
                rotationY={Math.PI}
            />
            <Blinds room="lobby" count={4} {...blindsFor(LOBBY_WINDOW)} />

            {/* Lounge: just inside its door from the lobby, and beside its window. */}
            <SwitchPlate
                room="hobbies"
                what="lights"
                position={[HOBBIES.x0 + SURFACE, SWITCH_Y, edge(DOORS.hobbies, 1)]}
                rotationY={Math.PI / 2}
            />
            <SwitchPlate
                room="hobbies"
                what="blinds"
                position={[HOBBIES_WINDOW.x1 + 0.6, SWITCH_Y, Z - SURFACE]}
                rotationY={Math.PI}
            />
            <Blinds room="hobbies" count={3} {...blindsFor(HOBBIES_WINDOW)} />

            {/* Gallery and corridor have no windows: lights only. */}
            <SwitchPlate
                room="projects"
                what="lights"
                position={[PROJECTS.x1 - SURFACE, SWITCH_Y, edge(DOORS.projects, 1)]}
                rotationY={-Math.PI / 2}
            />
            <SwitchPlate
                room="career"
                what="lights"
                position={[edge(DOORS.career, -1), SWITCH_Y, career.z1 - SURFACE]}
                rotationY={Math.PI}
            />
        </group>
    );
}
