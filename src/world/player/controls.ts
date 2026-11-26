/** Keyboard bindings, used by drei's <KeyboardControls>. */
export const keyMap = [
    { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
    { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
    { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
    { name: 'right', keys: ['KeyD', 'ArrowRight'] },
    { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
];

export type Controls = 'forward' | 'backward' | 'left' | 'right' | 'run';
