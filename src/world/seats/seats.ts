import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { about, companies } from '@/content';
import type { SectionId, SeatId } from '@/store/world';
import { MARKERS } from '@/world/rooms/lobby/layout';

type Vec3 = [number, number, number];

/** A flat screen in the world: where it is, which way it faces, and its size in metres. */
export type Screen = {
    center: Vec3;
    /** Rotation about y. 0 = facing +z (the way you'd look at it is -z). */
    rotationY: number;
    width: number;
    height: number;
};

/** One line of a screen's idle picture (a terminal), styled by its role. */
export type IdleLine = { text: string; tone: 'prompt' | 'title' | 'text' | 'muted' };

/**
 * A place where you stop and read a screen: sit down at a desk, or stand
 * in front of a wall display. Using it glides the camera square in front
 * of the screen (SeatCamera) and puts a real page on it (SeatScreen).
 */
export type Seat = {
    screen: Screen;
    /** Sitting dips the view on the way down; standing just steps up to it. */
    posture: 'sit' | 'stand';
    /** What the screen shows while you're there. */
    page: { title: string; section: SectionId };
    /** What it shows the rest of the time, seen from across the room. */
    idle: IdleLine[];
};

const desk = MARKERS.deskScreen;
const wall = MARKERS.careerScreen;

const years = (start: string, end: string | null) =>
    `${start.slice(0, 4)}–${end ? end.slice(0, 4) : 'now'}`;

export const SEATS: Record<SeatId, Seat> = {
    'lobby-desk': {
        screen: { center: desk.center, rotationY: 0, width: desk.width, height: desk.height },
        posture: 'sit',
        page: { title: 'about.md', section: 'about' },
        idle: [
            { text: '~ $ whoami', tone: 'prompt' },
            { text: about.name, tone: 'title' },
            { text: about.headline, tone: 'muted' },
            { text: '', tone: 'text' },
            { text: '~ $ cat about.md', tone: 'prompt' },
            { text: 'Take a seat to read it.', tone: 'muted' },
        ],
    },
    'lobby-career': {
        screen: { center: wall.center, rotationY: 0, width: wall.width, height: wall.height },
        posture: 'stand',
        page: { title: 'career.md', section: 'career' },
        idle: [
            { text: '~ $ git log career --oneline', tone: 'prompt' },
            ...companies.slice(0, 6).map((c) => ({
                text: `${years(c.start, c.end).padEnd(11)} ${c.name} · ${c.role}`,
                tone: 'text' as const,
            })),
            { text: '', tone: 'text' },
            { text: 'Step up to the screen to read more.', tone: 'muted' },
        ],
    },
};

export const seatVerb = (seat: Seat) => (seat.posture === 'sit' ? 'Sit down' : 'Read');
export const leaveLabel = (seat: Seat) => (seat.posture === 'sit' ? 'Stand up' : 'Step back');

/** Room around the screen's edges in the seated view (1 = edge to edge). */
const MARGIN = 1.22;
/** Never closer than this: a seated person sits ~50–70 cm from a monitor. */
const MIN_DISTANCE = 0.5;

const UP = new Vector3(0, 1, 0);
const lookMatrix = new Matrix4();

/**
 * The camera pose that frames a screen: straight in front of it, as close
 * as the screen fits the view with a margin.
 *
 * How close depends on the window's shape. A perspective camera's vertical
 * field of view (fov) is fixed; at distance d it sees a strip of height
 * 2·d·tan(fov/2), and aspect times that in width. So to fit a screen of
 * height H: d = H / (2·tan(fov/2)), and of width W: d = W / (2·tan(fov/2)·aspect).
 * The larger of the two wins. On a wide monitor the height decides; on a
 * phone held upright the width does, so the camera sits further back.
 */
export function seatedPose(
    screen: Screen,
    camera: PerspectiveCamera,
    outPos: Vector3,
    outQuat: Quaternion,
) {
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const fitHeight = (screen.height * MARGIN) / (2 * tanHalf);
    const fitWidth = (screen.width * MARGIN) / (2 * tanHalf * camera.aspect);
    const d = Math.max(fitHeight, fitWidth, MIN_DISTANCE);

    const [x, y, z] = screen.center;
    // The screen's facing direction: +z turned by rotationY.
    outPos.set(x + Math.sin(screen.rotationY) * d, y, z + Math.cos(screen.rotationY) * d);
    // A camera looks down its own -z, and Matrix4.lookAt builds exactly that
    // rotation (eye → target), which we store as a quaternion.
    lookMatrix.lookAt(outPos, new Vector3(x, y, z), UP);
    outQuat.setFromRotationMatrix(lookMatrix);
}
