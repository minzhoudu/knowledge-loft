import { create } from 'zustand';
import { releaseMouse } from '@/world/player/input';
import { lightsOn } from '@/world/switches/state';
import type { LightingMode, SeasonMode } from '@/world/environment/time';
import type { LiveWeather, WeatherMode } from '@/world/environment/weather';
import type { GithubData } from '@/world/github/types';
import type { RoomId } from '@/world/rooms/zones';

/**
 * Global world state.
 *
 * Why Zustand instead of React Context: the render loop (useFrame) runs ~60
 * times a second and needs to read state without re-rendering React. Zustand
 * lets code call `useWorld.getState()` inside the loop (no re-render), while
 * UI components subscribe to just the slice they need with a selector, so
 * only they re-render when that slice changes. Context would re-render every
 * consumer on any change.
 */

export type Mode =
    | 'intro' // before the first click: show the start screen
    | 'exploring' // walking around
    | 'paused' // stopped (Esc or the pause button), not reading anything
    | 'reading' // a content panel is open
    | 'seated' // sitting at a desk, reading its screen (see world/seats)
    | 'holding' // holding a book from the shelf, reading it (see world/bookshelf)
    | 'map'; // looking down at the whole loft, picking a room to jump to (see world/map)

/**
 * How mouse/finger movement turns the camera:
 * - "pointer-lock": desktop default. The browser hides the cursor and reports raw mouse movement.
 * - "drag": touch screens, or desktops where pointer lock isn't available. Drag to look.
 */
export type LookMode = 'pointer-lock' | 'drag';

export type SectionId =
    'about' | 'currently' | 'projects' | 'career' | 'hobbies' | 'skills' | 'notes';

/**
 * What a content panel shows. A discriminated union: the `kind` field tells
 * TypeScript (and the renderer) which other fields exist, so adding a new kind
 * of panel later (a company, a hobby) is a type error until it's handled.
 */
export type Panel =
    | { kind: 'section'; id: SectionId }
    | { kind: 'project'; slug: string }
    | { kind: 'company'; slug: string }
    | { kind: 'hobby'; slug: string }
    | { kind: 'skill'; slug: string }
    | { kind: 'github' }
    | { kind: 'repo'; name: string };

/** Places where you stop and read a screen, sitting or standing (see world/seats/seats.ts). */
export type SeatId = 'lobby-desk' | 'lobby-career' | 'lobby-arcade' | 'lobby-kiosk';

/**
 * Sitting down happens in three steps: the camera glides to the seat
 * ("arriving"), you read ("seated"), and it glides back ("leaving").
 */
export type SeatPhase = 'arriving' | 'seated' | 'leaving';

/**
 * The map view: the camera rises above the loft ("rising"), you pick a room
 * ("open"), then it either dives into that room ("diving") or goes back to
 * where you were ("returning").
 */
export type MapPhase = 'rising' | 'open' | 'diving' | 'returning';

/** A spot on the floor to land at, and which way to face (camera yaw). */
export type Destination = { x: number; z: number; yaw: number };

/**
 * Taking a book from the shelf: it slides out and flies to you ("taking"),
 * lies open while you read ("open"), then closes and flies back ("returning").
 */
export type BookPhase = 'taking' | 'open' | 'returning';

/**
 * Stepping inside the skill constellation: the camera glides into the middle
 * of the cloud as it grows around you and the room fades to dark
 * ("entering"), you look around and pick stars ("inside"), then it all
 * reverses ("leaving"). You stay in "exploring" mode the whole time, so mouse
 * look, aiming and panels work as usual; only walking is off.
 */
export type ConstellationPhase = 'entering' | 'inside' | 'leaving';

/**
 * What happens when the player uses an interactable: open a content panel,
 * toggle a door, sit down at a screen, or take a book (a note's slug). Plain
 * data (no functions), so it's easy to store, compare and log.
 */
export type Action =
    | { kind: 'panel'; panel: Panel }
    | { kind: 'door'; door: string }
    | { kind: 'sit'; seat: SeatId }
    | { kind: 'book'; book: string }
    | { kind: 'constellation' }
    | { kind: 'switch'; room: RoomId; what: 'lights' | 'blinds' };

/** The interactable the crosshair is on. `id` is unique per object in the world. */
export type FocusTarget = { id: string; label: string; action: Action };

type WorldState = {
    /** Everything has loaded and the first frames are drawn: the loading screen can go. */
    ready: boolean;
    setReady: () => void;
    mode: Mode;
    look: LookMode;
    /** True on phones/tablets: shows the joystick and touch buttons. */
    touch: boolean;
    /** The browser refused pointer lock on the last attempt. */
    lockFailed: boolean;
    /** Just released the pointer lock; the browser won't allow a new one for about a second. */
    relocking: boolean;
    /** Pointer lock has worked on this page at least once (so it's available here). */
    canLock: boolean;
    /**
     * Looking by drag only for now: the next click on the world captures the
     * mouse again. Set when Esc resumes play, since Esc can't capture it.
     */
    relockOnClick: boolean;
    focused: FocusTarget | null;
    openPanel: Panel | null;
    /** Door id -> open? Doors not listed are closed. */
    doors: Record<string, boolean>;
    /**
     * Each room's light switch, once it's been flipped (on/off). A room not
     * listed is on automatic (see world/switches/state.ts).
     */
    lights: Partial<Record<RoomId, boolean>>;
    setLights: (room: RoomId, on: boolean) => void;
    /** Each room's blinds: true = down. Rooms not listed have them up. */
    blinds: Partial<Record<RoomId, boolean>>;
    toggleBlinds: (room: RoomId) => void;
    /** Where you're sitting (null while walking), and how far into sitting down you are. */
    seat: SeatId | null;
    seatPhase: SeatPhase | null;
    sit: (seat: SeatId) => void;
    /** Start getting up (the camera glides back, then walking resumes). */
    standUp: () => void;
    setSeatPhase: (phase: SeatPhase | null) => void;
    /** The book in your hands (a note's slug; null when none), and where it is in its trip. */
    book: string | null;
    bookPhase: BookPhase | null;
    takeBook: (slug: string) => void;
    /** Start putting the book back (it closes and flies to its shelf, then walking resumes). */
    putBack: () => void;
    setBookPhase: (phase: BookPhase | null) => void;
    constellation: ConstellationPhase | null;
    enterConstellation: () => void;
    /** Start stepping out (the cloud shrinks back, the room returns, walking resumes). */
    leaveConstellation: () => void;
    setConstellationPhase: (phase: ConstellationPhase | null) => void;
    mapPhase: MapPhase | null;
    /** The room picked on the map (it's where the dive ends). */
    mapTarget: RoomId | null;
    /**
     * A trip to a particular spot instead of a room's door (the AI kiosk's
     * "take me there"): where to land, facing which way. With it set, the map
     * view doesn't wait for a pick: it rises, then dives straight there.
     */
    mapDestination: Destination | null;
    /** Get up from wherever you are and fly to a spot (rise over the loft, then dive). */
    travel: (destination: Destination) => void;
    openMap: () => void;
    /** Close the map: back to where you were. */
    closeMap: () => void;
    jumpTo: (room: RoomId) => void;
    setMapPhase: (phase: MapPhase | null) => void;
    /** Real clock, or a fixed daytime/night-time preview. */
    lighting: LightingMode;
    setLighting: (lighting: LightingMode) => void;
    /** Real calendar, or a fixed season preview. */
    season: SeasonMode;
    setSeason: (season: SeasonMode) => void;
    /** Real weather at the studio, or a fixed preview. */
    weather: WeatherMode;
    setWeather: (weather: WeatherMode) => void;
    /** Latest live weather from /api/weather (null until loaded, or if unavailable). */
    liveWeather: LiveWeather | null;
    setLiveWeather: (w: LiveWeather | null) => void;
    /** Latest data from /api/github (null until loaded, or if unavailable). */
    github: GithubData | null;
    setGithub: (g: GithubData | null) => void;
    /** Sound off. Remembered in this browser between visits. */
    muted: boolean;
    toggleMuted: () => void;
    setMode: (mode: Mode) => void;
    set: (
        partial: Partial<
            Pick<
                WorldState,
                'look' | 'touch' | 'lockFailed' | 'relocking' | 'canLock' | 'relockOnClick' | 'mode'
            >
        >,
    ) => void;
    setFocused: (focused: FocusTarget | null) => void;
    open: (panel: Panel) => void;
    close: () => void;
    toggleDoor: (door: string) => void;
};

export const useWorld = create<WorldState>((set) => ({
    ready: false,
    setReady: () => set({ ready: true }),
    mode: 'intro',
    look: 'pointer-lock',
    touch: false,
    lockFailed: false,
    relocking: false,
    canLock: false,
    relockOnClick: false,
    focused: null,
    openPanel: null,
    doors: {},
    // Spawning in: lamps on and blinds down, a calm, warmly lit room whatever
    // the hour. Flip a switch to change either.
    lights: { lobby: true, projects: true, career: true, hobbies: true },
    setLights: (room, on) => set((s) => ({ lights: { ...s.lights, [room]: on } })),
    blinds: { lobby: true, hobbies: true },
    toggleBlinds: (room) => set((s) => ({ blinds: { ...s.blinds, [room]: !s.blinds[room] } })),
    seat: null,
    seatPhase: null,
    sit: (seat) => set({ seat, seatPhase: 'arriving', mode: 'seated', focused: null }),
    standUp: () =>
        set((s) => (s.seat && s.seatPhase !== 'leaving' ? { seatPhase: 'leaving' } : {})),
    setSeatPhase: (seatPhase) => set(seatPhase ? { seatPhase } : { seat: null, seatPhase: null }),
    book: null,
    bookPhase: null,
    takeBook: (book) => set({ book, bookPhase: 'taking', mode: 'holding', focused: null }),
    putBack: () =>
        set((s) => (s.book && s.bookPhase !== 'returning' ? { bookPhase: 'returning' } : {})),
    setBookPhase: (bookPhase) => set(bookPhase ? { bookPhase } : { book: null, bookPhase: null }),
    constellation: null,
    enterConstellation: () => set({ constellation: 'entering', focused: null }),
    leaveConstellation: () =>
        set((s) =>
            s.constellation === 'entering' || s.constellation === 'inside'
                ? { constellation: 'leaving', focused: null }
                : {},
        ),
    setConstellationPhase: (constellation) => set({ constellation }),
    mapPhase: null,
    mapTarget: null,
    mapDestination: null,
    travel: (mapDestination) =>
        set({
            seat: null,
            seatPhase: null,
            mode: 'map',
            mapPhase: 'rising',
            mapTarget: null,
            mapDestination,
            focused: null,
        }),
    openMap: () => set({ mode: 'map', mapPhase: 'rising', mapTarget: null, focused: null }),
    closeMap: () =>
        set((s) =>
            s.mapPhase === 'rising' || s.mapPhase === 'open' ? { mapPhase: 'returning' } : {},
        ),
    jumpTo: (room) =>
        set((s) => (s.mapPhase === 'open' ? { mapPhase: 'diving', mapTarget: room } : {})),
    setMapPhase: (mapPhase) =>
        set(mapPhase ? { mapPhase } : { mapPhase: null, mapTarget: null, mapDestination: null }),
    lighting: 'live',
    setLighting: (lighting) => set({ lighting }),
    season: 'live',
    setSeason: (season) => set({ season }),
    weather: 'live',
    setWeather: (weather) => set({ weather }),
    liveWeather: null,
    setLiveWeather: (liveWeather) => set({ liveWeather }),
    github: null,
    setGithub: (github) => set({ github }),
    muted: readMuted(),
    toggleMuted: () =>
        set((s) => {
            writeMuted(!s.muted);
            return { muted: !s.muted };
        }),
    setMode: (mode) => set({ mode }),
    set: (partial) => set(partial),
    setFocused: (focused) => set({ focused }),
    open: (panel) => set({ openPanel: panel, mode: 'reading', focused: null }),
    close: () => set({ openPanel: null, mode: 'paused' }),
    toggleDoor: (door) => set((s) => ({ doors: { ...s.doors, [door]: !s.doors[door] } })),
}));

// localStorage can be missing or throw (private windows, blocked storage):
// then sound is simply on each visit.
const MUTED_KEY = 'knowledge-loft:muted';
function readMuted() {
    try {
        return typeof window !== 'undefined' && localStorage.getItem(MUTED_KEY) === '1';
    } catch {
        return false;
    }
}
function writeMuted(muted: boolean) {
    try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {}
}

/**
 * Run an interactable's action. Opening a panel or sitting down releases the
 * mouse so the visitor can click links (and scroll the screen); a door just
 * toggles and play continues, and so does stepping into the constellation.
 */
export function performAction(action: Action) {
    const s = useWorld.getState();
    if (action.kind === 'door') {
        s.toggleDoor(action.door);
    } else if (action.kind === 'sit') {
        s.sit(action.seat);
        releaseMouse();
    } else if (action.kind === 'book') {
        s.takeBook(action.book);
        releaseMouse();
    } else if (action.kind === 'switch') {
        // Like a door: flip it and keep walking.
        if (action.what === 'lights') s.setLights(action.room, !lightsOn(action.room));
        else s.toggleBlinds(action.room);
    } else if (action.kind === 'constellation') {
        // The mouse stays captured: inside, you look around with it as usual.
        s.enterConstellation();
    } else {
        s.open(action.panel);
        // Released by us, not by Esc, so closing the panel can capture the mouse
        // again without a click.
        releaseMouse();
    }
}

// Dev-only handle for poking at state from the browser console, e.g.
// __world.getState().setMode("exploring")
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as { __world: typeof useWorld }).__world = useWorld;
}
