import { useWorld } from '@/store/world';
import { startAudio } from '@/world/audio/engine';

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
    // Same rule for sound: browsers only let audio start from a click or tap.
    startAudio();

    if (preferDrag || isTouchDevice()) {
        store.set({
            look: 'drag',
            touch: isTouchDevice(),
            lockFailed: false,
            relockOnClick: false,
            mode: 'exploring',
        });
        return;
    }

    const canvas = document.querySelector<HTMLCanvasElement>('#world canvas');
    if (!canvas?.requestPointerLock) {
        // No pointer lock at all (old browser, some embedded views): drag to look instead.
        store.set({ look: 'drag', touch: false, lockFailed: false, mode: 'exploring' });
        return;
    }

    // Chrome refuses a re-lock for about a second after Esc released it. The
    // Resume button is disabled for that second (see `relocking`), so a click
    // here should be allowed. The request has to happen right now, inside the
    // click: a delayed request (setTimeout) no longer counts as the visitor's
    // gesture and gets refused.
    if (store.relocking) return;
    store.set({ look: 'pointer-lock', touch: false, lockFailed: false, relockOnClick: false });
    // On success, PointerLook's pointerlockchange handler switches the mode to "exploring".
    Promise.resolve(canvas.requestPointerLock()).catch(lockRefused);
}

/** How long Chrome blocks re-locking after the lock is released (plus a margin). */
export const RELOCK_COOLDOWN_MS = 1200;

/**
 * Who released the mouse matters. Browsers treat the two cases differently:
 * - The visitor pressed Esc: the page may only capture the mouse again from
 *   a click (and not within about a second).
 * - The page released it (exitPointerLock): the page may capture it again
 *   whenever it likes, even from a key press.
 * So whenever we free the cursor ourselves (to read a panel, or to pause in
 * full screen), we flag it here, and PointerLook knows which case it was.
 */
export const pointerLock = { releasingOurselves: false, escCaptured: false };

/** Free the cursor ourselves, keeping the right to capture it again without a click. */
export function releaseMouse() {
    if (!document.pointerLockElement) return;
    pointerLock.releasingOurselves = true;
    document.exitPointerLock();
}

/**
 * Back to walking from a key press (Esc on a panel or the pause menu), with
 * the mouse captured again straight away when the browser allows it (see
 * `pointerLock` above). When it doesn't, keep walking with drag-to-look.
 */
export function resumeFromKey() {
    const s = useWorld.getState();
    const canvas = document.querySelector<HTMLCanvasElement>('#world canvas');
    const usesLock = s.canLock && (s.look === 'pointer-lock' || s.relockOnClick);
    if (!canvas || !usesLock || s.relocking) {
        keepWalking();
        return;
    }
    s.set({ look: 'pointer-lock', lockFailed: false, mode: 'exploring' });
    Promise.resolve(canvas.requestPointerLock()).catch(keepWalking);
}

/**
 * Full screen, with Esc kept for the page (Chrome and Edge's Keyboard Lock
 * API, which only works in full screen). Esc then no longer releases the
 * mouse by itself; we pause by releasing it ourselves, so Esc can also
 * resume with mouse look right away. Holding Esc still leaves full screen,
 * so the visitor is never trapped.
 */
type KeyboardLock = { lock: (keys?: string[]) => Promise<void> };
export function toggleFullscreen() {
    if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
        return;
    }
    if (!document.documentElement.requestFullscreen) return;
    document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() =>
            (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard?.lock(['Escape']),
        )
        .then(() => {
            pointerLock.escCaptured = !!document.fullscreenElement;
        })
        .catch(() => {});
}
if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', () => {
        // Leaving full screen also ends the keyboard lock.
        if (!document.fullscreenElement) pointerLock.escCaptured = false;
    });
}

/**
 * Keep walking with drag-to-look: the fallback when the mouse can't be
 * captured from a key press. Walking works immediately, and the next click
 * on the world captures the mouse again (see PointerLook).
 */
export function keepWalking() {
    const s = useWorld.getState();
    s.set({
        look: 'drag',
        relockOnClick: s.look === 'pointer-lock' || s.relockOnClick,
        lockFailed: false,
        mode: 'exploring',
    });
}

/**
 * The browser refused the lock.
 *
 * If it has never worked on this page, it's not going to: an embedded
 * browser or an iframe without permission. Switch to drag-to-look silently.
 * Otherwise it's a one-off refusal: show the pause card, which explains it
 * and offers drag-to-look.
 */
export function lockRefused() {
    const s = useWorld.getState();
    if (!s.canLock) {
        s.set({ look: 'drag', lockFailed: false, mode: 'exploring' });
        return;
    }
    if (s.mode === 'exploring') {
        keepWalking(); // a key-press resume that the browser refused
        return;
    }
    s.set({ lockFailed: true });
}
