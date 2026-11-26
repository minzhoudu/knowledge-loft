import { create } from 'zustand';
import type { LightingMode, SeasonMode } from '@/world/environment/time';
import type { LiveWeather, WeatherMode } from '@/world/environment/weather';

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
    | 'reading'; // a content panel is open

/**
 * How mouse/finger movement turns the camera:
 * - "pointer-lock": desktop default. The browser hides the cursor and reports raw mouse movement.
 * - "drag": touch screens, or desktops where pointer lock isn't available. Drag to look.
 */
export type LookMode = 'pointer-lock' | 'drag';

export type SectionId = 'about' | 'projects' | 'career' | 'hobbies';

/**
 * What a content panel shows. A discriminated union: the `kind` field tells
 * TypeScript (and the renderer) which other fields exist, so adding a new kind
 * of panel later (a company, a hobby) is a type error until it's handled.
 */
export type Panel =
    | { kind: 'section'; id: SectionId }
    | { kind: 'project'; slug: string }
    | { kind: 'company'; slug: string }
    | { kind: 'hobby'; slug: string };

/**
 * What happens when the player uses an interactable: open a content panel,
 * or toggle a door. Plain data (no functions), so it's easy to store,
 * compare and log.
 */
export type Action = { kind: 'panel'; panel: Panel } | { kind: 'door'; door: string };

/** The interactable the crosshair is on. `id` is unique per object in the world. */
export type FocusTarget = { id: string; label: string; action: Action };

type WorldState = {
    mode: Mode;
    look: LookMode;
    /** True on phones/tablets: shows the joystick and touch buttons. */
    touch: boolean;
    /** The browser refused pointer lock on the last attempt. */
    lockFailed: boolean;
    focused: FocusTarget | null;
    openPanel: Panel | null;
    /** Door id -> open? Doors not listed are closed. */
    doors: Record<string, boolean>;
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
    setMode: (mode: Mode) => void;
    set: (partial: Partial<Pick<WorldState, 'look' | 'touch' | 'lockFailed' | 'mode'>>) => void;
    setFocused: (focused: FocusTarget | null) => void;
    open: (panel: Panel) => void;
    close: () => void;
    toggleDoor: (door: string) => void;
};

export const useWorld = create<WorldState>((set) => ({
    mode: 'intro',
    look: 'pointer-lock',
    touch: false,
    lockFailed: false,
    focused: null,
    openPanel: null,
    doors: {},
    lighting: 'live',
    setLighting: (lighting) => set({ lighting }),
    season: 'live',
    setSeason: (season) => set({ season }),
    weather: 'live',
    setWeather: (weather) => set({ weather }),
    liveWeather: null,
    setLiveWeather: (liveWeather) => set({ liveWeather }),
    setMode: (mode) => set({ mode }),
    set: (partial) => set(partial),
    setFocused: (focused) => set({ focused }),
    open: (panel) => set({ openPanel: panel, mode: 'reading', focused: null }),
    close: () => set({ openPanel: null, mode: 'paused' }),
    toggleDoor: (door) => set((s) => ({ doors: { ...s.doors, [door]: !s.doors[door] } })),
}));

/**
 * Run an interactable's action. Opening a panel releases the mouse so the
 * visitor can click links; a door just toggles and play continues.
 */
export function performAction(action: Action) {
    const s = useWorld.getState();
    if (action.kind === 'door') {
        s.toggleDoor(action.door);
    } else {
        s.open(action.panel);
        if (document.pointerLockElement) document.exitPointerLock();
    }
}

// Dev-only handle for poking at state from the browser console, e.g.
// __world.getState().setMode("exploring")
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as { __world: typeof useWorld }).__world = useWorld;
}
