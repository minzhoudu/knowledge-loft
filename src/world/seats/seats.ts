import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { about, companies } from '@/content';
import type { SectionId, SeatId } from '@/store/world';
import { ARCADE_SCREEN } from '@/world/arcade/cabinet';
import { KIOSK_SCREEN } from '@/world/kiosk/layout';
import { MARKERS } from '@/world/rooms/lobby/layout';

type Vec3 = [number, number, number];

/** A flat screen in the world: where it is, which way it faces, and its size in metres. */
export type Screen = {
    center: Vec3;
    /** Rotation about y. 0 = facing +z (the way you'd look at it is -z). */
    rotationY: number;
    width: number;
    height: number;
    /** How far it leans back to face upward, in radians (an arcade screen does). */
    tiltUp?: number;
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
    /** The prompt to use it, and to leave. */
    verb: string;
    leave: string;
    /** Room around the screen in the view (1 = edge to edge). */
    margin?: number;
    /**
     * A page to read on it (SeatScreen draws those). A seat without one draws
     * its own screen, like the arcade cabinet's game.
     */
    page?: {
        title: string;
        section: SectionId;
        /** What the screen shows the rest of the time, seen from across the room. */
        idle: IdleLine[];
    };
    /** Or a conversation (the AI kiosk): a chat on the screen instead of a page. */
    chat?: { title: string; idle: IdleLine[] };
};

const desk = MARKERS.deskScreen;
const wall = MARKERS.careerScreen;

const years = (start: string, end: string | null) =>
    `${start.slice(0, 4)}–${end ? end.slice(0, 4) : 'now'}`;

export const SEATS: Record<SeatId, Seat> = {
    'lobby-desk': {
        screen: { center: desk.center, rotationY: 0, width: desk.width, height: desk.height },
        posture: 'sit',
        verb: 'Sit down',
        leave: 'Stand up',
        page: {
            title: 'about.md',
            section: 'about',
            idle: [
                { text: '~ $ whoami', tone: 'prompt' },
                { text: about.name, tone: 'title' },
                { text: about.headline, tone: 'muted' },
                { text: '', tone: 'text' },
                { text: '~ $ cat about.md', tone: 'prompt' },
                { text: 'Take a seat to read it.', tone: 'muted' },
            ],
        },
    },
    'lobby-career': {
        screen: { center: wall.center, rotationY: 0, width: wall.width, height: wall.height },
        posture: 'stand',
        verb: 'Read',
        leave: 'Step back',
        page: {
            title: 'career.md',
            section: 'career',
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
    },
    'lobby-kiosk': {
        screen: KIOSK_SCREEN,
        posture: 'stand',
        verb: 'Ask',
        leave: 'Step back',
        margin: 1.45,
        chat: {
            title: 'ask.ai',
            idle: [
                { text: '~ $ ask', tone: 'prompt' },
                { text: `Ask me about ${about.name.split(' ')[0]}`, tone: 'title' },
                { text: 'His work, projects, skills,', tone: 'muted' },
                { text: 'and what he is up to now.', tone: 'muted' },
                { text: '', tone: 'text' },
                { text: 'Step up to the screen.', tone: 'muted' },
            ],
        },
    },
    'lobby-arcade': {
        screen: ARCADE_SCREEN,
        posture: 'stand',
        verb: 'Play',
        leave: 'Step back',
        // Further back than a page needs: the marquee and the joystick stay in view.
        margin: 2.1,
    },
};

/** Room around the screen's edges in the seated view (1 = edge to edge), unless a seat says otherwise. */
const MARGIN = 1.22;
/** Across the width, never more than this: on a phone held upright the screen should fill it. */
const MAX_SIDE_MARGIN = 1.3;
/** Never closer than this: a seated person sits ~50–70 cm from a monitor. */
const MIN_DISTANCE = 0.5;

const UP = new Vector3(0, 1, 0);
const lookMatrix = new Matrix4();
const target = new Vector3();

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
 *
 * "Straight in front" is along the screen's normal: for a screen that leans
 * back (tiltUp), that's a little above it, looking down, the way you stand
 * at an arcade cabinet.
 */
export function seatedPose(
    seat: Seat,
    camera: PerspectiveCamera,
    outPos: Vector3,
    outQuat: Quaternion,
) {
    const { screen } = seat;
    const margin = seat.margin ?? MARGIN;
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const fitHeight = (screen.height * margin) / (2 * tanHalf);
    const fitWidth =
        (screen.width * Math.min(margin, MAX_SIDE_MARGIN)) / (2 * tanHalf * camera.aspect);
    const d = Math.max(fitHeight, fitWidth, MIN_DISTANCE);

    const [x, y, z] = screen.center;
    // The screen's facing direction: +z turned by rotationY, tipped up by tiltUp.
    const up = screen.tiltUp ?? 0;
    const flat = Math.cos(up) * d;
    outPos.set(
        x + Math.sin(screen.rotationY) * flat,
        y + Math.sin(up) * d,
        z + Math.cos(screen.rotationY) * flat,
    );
    // A camera looks down its own -z, and Matrix4.lookAt builds exactly that
    // rotation (eye → target), which we store as a quaternion.
    lookMatrix.lookAt(outPos, target.set(x, y, z), UP);
    outQuat.setFromRotationMatrix(lookMatrix);
}
