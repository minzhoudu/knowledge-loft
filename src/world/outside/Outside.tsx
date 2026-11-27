'use client';

import { City } from './City';
import { Facade } from './Facade';
import { Street } from './Street';

/**
 * Everything outside the loft's walls (see layout.ts). None of it has
 * colliders: walls and window blockers already keep the player inside.
 */
export function Outside() {
    return (
        <group>
            <Facade />
            <Street />
            <City />
        </group>
    );
}
