import { create } from "zustand";

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
  | "intro" // before the first click: show the start screen
  | "exploring" // walking around
  | "paused" // stopped (Esc or the pause button), not reading anything
  | "reading"; // a content panel is open

/**
 * How mouse/finger movement turns the camera:
 * - "pointer-lock": desktop default. The browser hides the cursor and reports raw mouse movement.
 * - "drag": touch screens, or desktops where pointer lock isn't available. Drag to look.
 */
export type LookMode = "pointer-lock" | "drag";

export type InteractableId = "about" | "projects" | "career" | "hobbies";

type WorldState = {
  mode: Mode;
  look: LookMode;
  /** True on phones/tablets: shows the joystick and touch buttons. */
  touch: boolean;
  /** The browser refused pointer lock on the last attempt. */
  lockFailed: boolean;
  focused: { id: InteractableId; label: string } | null;
  openPanel: InteractableId | null;
  setMode: (mode: Mode) => void;
  set: (partial: Partial<Pick<WorldState, "look" | "touch" | "lockFailed" | "mode">>) => void;
  setFocused: (focused: WorldState["focused"]) => void;
  open: (id: InteractableId) => void;
  close: () => void;
};

export const useWorld = create<WorldState>((set) => ({
  mode: "intro",
  look: "pointer-lock",
  touch: false,
  lockFailed: false,
  focused: null,
  openPanel: null,
  setMode: (mode) => set({ mode }),
  set: (partial) => set(partial),
  setFocused: (focused) => set({ focused }),
  open: (id) => set({ openPanel: id, mode: "reading", focused: null }),
  close: () => set({ openPanel: null, mode: "paused" }),
}));

// Dev-only handle for poking at state from the browser console, e.g.
// __world.getState().setMode("exploring")
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __world: typeof useWorld }).__world = useWorld;
}
