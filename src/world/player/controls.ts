import { useEffect } from 'react';
import { useWorld } from '@/store/world';

/** Keyboard bindings, by physical key (`KeyboardEvent.code`), so WASD works on any layout. */
const KEY_MAP = {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'],
} as const;

export type Control = keyof typeof KEY_MAP;

/** Physical keys currently held down. */
const pressed = new Set<string>();

/** Is a control's key held? Read in the render loop; no React state involved. */
export function held(control: Control) {
    return KEY_MAP[control].some((code) => pressed.has(code));
}

/**
 * Tracks held keys. Mount once (the Player does).
 *
 * The key point is *forgetting* keys. A browser only tells us a key went up
 * if the page receives the keyup event, and it often doesn't: pressing Esc
 * to leave pointer lock, alt-tabbing or a panel opening can swallow it. The
 * key then stays "held" and you walk forward forever. So everything is
 * forgotten whenever play stops (pause, panel, lost focus); a key you're
 * still holding comes back with its next auto-repeat keydown.
 */
export function useKeyboard() {
    useEffect(() => {
        const down = (e: KeyboardEvent) => pressed.add(e.code);
        const up = (e: KeyboardEvent) => pressed.delete(e.code);
        const clear = () => pressed.clear();
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', clear);
        document.addEventListener('visibilitychange', clear);
        const unsubscribe = useWorld.subscribe((s, prev) => {
            if (s.mode !== prev.mode) clear();
        });
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', clear);
            document.removeEventListener('visibilitychange', clear);
            unsubscribe();
            clear();
        };
    }, []);
}
