'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useWorld, type Action, type FocusTarget } from '@/store/world';

/**
 * Objects the player can look at and use.
 *
 * Each Interactable registers its group in a module-level registry. The
 * InteractionSystem raycasts only against registered objects, which is far
 * cheaper than raycasting the whole scene every frame.
 */

export const interactables = new Map<string, Group>();

const FocusContext = createContext(false);
/** True while the player is looking at the surrounding Interactable. */
export const useIsFocused = () => useContext(FocusContext);

type Props = {
    /** Unique in the whole world, e.g. "lobby-desk" or "project:my-app". */
    id: string;
    label: string;
    /** What happens when the player uses this object. */
    action: Action;
    children: ReactNode;
};

export function Interactable({ id, label, action, children }: Props) {
    const ref = useRef<Group>(null);
    const focused = useWorld((s) => s.focused?.id === id);

    // Depend on the action's contents, not the object identity: an inline
    // `action={{ ... }}` prop is a new object on every render.
    const actionKey = JSON.stringify(action);

    useEffect(() => {
        const group = ref.current;
        if (!group) return;
        const target: FocusTarget = { id, label, action: JSON.parse(actionKey) as Action };
        group.userData.interactable = target;
        interactables.set(id, group);
        return () => {
            interactables.delete(id);
        };
    }, [id, label, actionKey]);

    return (
        <group ref={ref}>
            <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>
        </group>
    );
}
