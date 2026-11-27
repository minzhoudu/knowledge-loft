import { companies, projects } from '@/content';
import type { KioskAction } from '@/ai/kiosk-tools';
import type { Destination } from '@/store/world';
import { MAP_ROOMS } from '@/world/map/rooms';
import { layoutStations, roomFor } from '@/world/rooms/career/layout';
import { CENTER, layoutExhibits } from '@/world/rooms/projects/layout';

/**
 * Where the kiosk's "take me there" lands you: for a room, just inside its
 * door (the map's own entry points); for an exhibit or a role, standing a
 * couple of metres in front of it, facing it.
 *
 * Everything comes from the same layout functions that place the exhibits
 * and stations, so a trip always ends where the thing actually is.
 */

/** How far in front of an exhibit or a station you stand. */
const BACK = 2.1;

/**
 * In front of something whose front faces rotationY (local +z turned by it).
 * Facing it means looking along -front, which is exactly camera yaw = rotationY.
 */
function inFront(x: number, z: number, rotationY: number, back = BACK): Destination {
    return { x: x + Math.sin(rotationY) * back, z: z + Math.cos(rotationY) * back, yaw: rotationY };
}

const exhibits = layoutExhibits(projects);
const stations = layoutStations(companies, roomFor(companies.length));

export function destinationFor(action: KioskAction): Destination | null {
    switch (action.kind) {
        case 'room':
            return MAP_ROOMS[action.id].entry;
        case 'project': {
            // The featured podium stands in the middle of the gallery, facing the door (+x).
            if (exhibits.featured?.slug === action.id) {
                return inFront(CENTER.x, CENTER.z, Math.PI / 2, 2.8);
            }
            const slot = exhibits.slots.find((s) => s.project.slug === action.id);
            return slot ? inFront(slot.position[0], slot.position[2], slot.rotationY) : null;
        }
        case 'role': {
            const s = stations.find((st) => st.company.slug === action.id);
            return s ? inFront(s.position[0], s.position[2], s.rotationY) : null;
        }
    }
}
