import { useWorld } from '@/store/world';

/**
 * Analog movement from the on-screen joystick, in the range -1..1.
 * x: right is positive. y: down (toward you) is positive, like screen coords,
 * so pushing the stick up gives y < 0, which maps to walking forward (-z).
 *
 * It's a plain mutable object rather than React or Zustand state on purpose:
 * the joystick writes it on every pointer move and the player reads it every
 * frame, and none of that should ever trigger a React re-render.
 */
export const joystick = { x: 0, y: 0 };

/** Phones and tablets: the primary pointer is a finger, which can't hover. */
export function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Start (or resume) walking. Must be called from a click/tap handler, because
 * browsers only grant pointer lock in response to a user gesture.
 */
export function enterWorld({ preferDrag = false } = {}) {
    const store = useWorld.getState();

    if (preferDrag || isTouchDevice()) {
        store.set({ look: 'drag', touch: isTouchDevice(), lockFailed: false, mode: 'exploring' });
        return;
    }

    const canvas = document.querySelector<HTMLCanvasElement>('#world canvas');
    if (!canvas?.requestPointerLock) {
        // No pointer lock at all (old browser, some embedded views): drag to look instead.
        store.set({ look: 'drag', touch: false, lockFailed: false, mode: 'exploring' });
        return;
    }

    store.set({ look: 'pointer-lock', touch: false, lockFailed: false });
    // On success, PointerLockControls' onLock switches the mode to "exploring".
    // Chrome also refuses a re-lock for about a second after Esc; in that case we
    // stay paused and let the visitor try again or switch to drag-to-look.
    Promise.resolve(canvas.requestPointerLock()).catch(() => {
        useWorld.getState().set({ lockFailed: true });
    });
}
