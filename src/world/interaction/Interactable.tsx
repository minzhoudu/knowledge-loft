'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useWorld, type InteractableId } from '@/store/world';

/**
 * Objects the player can look at and press E on.
 *
 * Each Interactable registers its group in a module-level registry. The
 * InteractionSystem raycasts only against registered objects, which is far
 * cheaper than raycasting the whole scene every frame.
 */

export const interactables = new Map<InteractableId, Group>();

const FocusContext = createContext(false);
/** True while the player is looking at the surrounding Interactable. */
export const useIsFocused = () => useContext(FocusContext);

type Props = { id: InteractableId; label: string; children: ReactNode };

export function Interactable({ id, label, children }: Props) {
    const ref = useRef<Group>(null);
    const focused = useWorld((s) => s.focused?.id === id);

    useEffect(() => {
        const group = ref.current;
        if (!group) return;
        group.userData.interactable = { id, label };
        interactables.set(id, group);
        return () => {
            interactables.delete(id);
        };
    }, [id, label]);

    return (
        <group ref={ref}>
            <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>
        </group>
    );
}
