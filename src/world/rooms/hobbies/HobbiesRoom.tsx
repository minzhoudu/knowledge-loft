'use client';

import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { hobbies } from '@/content';
import { Block } from '@/world/greybox/Block';
import { Label } from '@/world/greybox/Label';
import { Lamp } from '@/world/environment/Lamp';
import { Interactable } from '@/world/interaction/Interactable';
import { Model } from '@/world/models/Model';
import { CENTER, DOOR, layoutHobbies, ROOM, WINDOW, type HobbySpot } from './layout';

const { x0, x1, z0, z1, height: H, wall: T } = ROOM;
const W = x1 - x0;
const D = z1 - z0;

// Content is static, so the layout is computed once.
const { spots } = layoutHobbies(hobbies);

/**
 * Greybox Hobbies lounge. Each hobby gets a display on the north or east
 * wall (a table with a stand-in object and a board above it). The middle is
 * a lounge corner, and the south wall is mostly window.
 */
export function HobbiesRoom() {
    return (
        <group>
            <RigidBody type="fixed" colliders="cuboid">
                {/* floor + ceiling (west edge stops at the shared lobby wall) */}
                <Block
                    size={[W + T, 0.2, D + T * 2]}
                    position={[CENTER.x + T / 2, -0.1, CENTER.z]}
                    surface="floor"
                />
                <Block
                    size={[W + T, 0.2, D + T * 2]}
                    position={[CENTER.x + T / 2, H + 0.1, CENTER.z]}
                    surface="ceiling"
                />

                {/* north and east walls; the west wall is the lobby's */}
                <Block
                    size={[W + T, H, T]}
                    position={[CENTER.x + T / 2, H / 2, z0 - T / 2]}
                    surface="wall"
                />
                <Block size={[T, H, D]} position={[x1 + T / 2, H / 2, CENTER.z]} surface="wall" />

                {/* south wall: solid around a big window */}
                <Block
                    size={[WINDOW.x0 - x0, H, T]}
                    position={[(x0 + WINDOW.x0) / 2, H / 2, z1 + T / 2]}
                    surface="wall"
                />
                <Block
                    size={[x1 + T - WINDOW.x1, H, T]}
                    position={[(WINDOW.x1 + x1 + T) / 2, H / 2, z1 + T / 2]}
                    surface="wall"
                />
                <Block
                    size={[WINDOW.x1 - WINDOW.x0, WINDOW.y0, T]}
                    position={[(WINDOW.x0 + WINDOW.x1) / 2, WINDOW.y0 / 2, z1 + T / 2]}
                    surface="wall"
                />
                <Block
                    size={[WINDOW.x1 - WINDOW.x0, H - WINDOW.y1, T]}
                    position={[(WINDOW.x0 + WINDOW.x1) / 2, (H + WINDOW.y1) / 2, z1 + T / 2]}
                    surface="wall"
                />

                {spots.map((spot) => (
                    <HobbyDisplay key={spot.hobby.slug} spot={spot} />
                ))}
            </RigidBody>

            <Lounge />

            {/* you can see out of the window, not walk out of it */}
            <CuboidCollider
                args={[(WINDOW.x1 - WINDOW.x0) / 2, (WINDOW.y1 - WINDOW.y0) / 2, T / 2]}
                position={[(WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, z1 + T / 2]}
            />
            <Mullions />

            {/* rug under the lounge (thin, no collision) */}
            <Block
                size={[4, 0.01, 3]}
                position={[CENTER.x, 0.006, CENTER.z + 1.2]}
                color="#c8b8a6"
            />

            {/* labels: no physics */}
            {spots.map(({ hobby, position, rotationY }) => (
                <group key={hobby.slug} position={position} rotation-y={rotationY}>
                    <Label title={hobby.name} width={1.4} position={[0, 2.0, 0.06]} />
                </group>
            ))}
            <Label
                title="Hobbies"
                subtitle="After hours"
                width={2.4}
                position={[x1 - 0.01, 3.45, CENTER.z]}
                rotationY={-Math.PI / 2}
            />
            <Label
                title="Lobby"
                width={1.1}
                position={[x0 + 0.01, DOOR.height + 0.35, DOOR.center]}
                rotationY={Math.PI / 2}
            />

            {/* lamps come on at dusk: the floor lamp by the lounge, and a ceiling light */}
            <Lamp position={[CENTER.x + 2.3, 1.75, CENTER.z + 2.2]} intensity={8} bulbRadius={0} />
            <Lamp position={[CENTER.x, H - 0.5, CENTER.z - 1.5]} intensity={14} color="#ffe2b8" />
        </group>
    );
}

/** A hobby on the wall: a table with a stand-in object, and a board above it. */
function HobbyDisplay({ spot }: { spot: HobbySpot }) {
    const { hobby, position, rotationY } = spot;
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id={`hobby:${hobby.slug}`}
                label={hobby.name}
                action={{ kind: 'panel', panel: { kind: 'hobby', slug: hobby.slug } }}
            >
                <Block size={[1.4, 0.75, 0.6]} position={[0, 0.375, 0.32]} surface="accent" />
                <HobbyProps slug={hobby.slug} />
                <Block size={[1.7, 1.1, 0.05]} position={[0, 2.0, 0.025]} surface="accent" />
            </Interactable>
        </group>
    );
}

const TABLE_TOP = 0.75;

/**
 * What stands on each hobby's table, by slug. The table's top centre is at
 * [0, TABLE_TOP, 0.32]; local +z points into the room. A hobby without an
 * entry here gets a plain stand-in box.
 */
function HobbyProps({ slug }: { slug: string }) {
    const y = TABLE_TOP;
    switch (slug) {
        case 'learning-and-ai':
            return (
                <>
                    <Model name="laptop" position={[-0.15, y, 0.3]} collider={false} />
                    <Model
                        name="desk-lamp"
                        position={[0.5, y, 0.25]}
                        rotationY={-2.2}
                        collider={false}
                    />
                </>
            );
        case 'scuba-diving':
            return (
                <>
                    <Model
                        name="shark"
                        position={[-0.3, y, 0.3]}
                        rotationY={Math.PI / 2}
                        collider={false}
                    />
                    <Model
                        name="ray"
                        position={[0.38, y, 0.28]}
                        rotationY={-Math.PI / 2}
                        collider={false}
                    />
                    <Model
                        name="scuba-mask"
                        position={[0.08, y, 0.47]}
                        rotationY={0.4}
                        collider={false}
                    />
                    <Model
                        name="shell"
                        position={[-0.55, y, 0.53]}
                        rotationY={0.6}
                        collider={false}
                    />
                </>
            );
        case 'reading':
            return (
                <>
                    <Model name="books" position={[-0.25, y, 0.28]} collider={false} />
                    <Model name="vase" position={[0.45, y, 0.3]} collider={false} />
                </>
            );
        case 'co-op-games':
            return (
                <>
                    {/* a whole desk set (case, monitor, keyboard, mouse). Modelled
                        with its front toward +x, so a quarter turn faces it into the room. */}
                    <Model
                        name="gaming-pc"
                        position={[0, y, 0.32]}
                        rotationY={-Math.PI / 2}
                        scale={0.9}
                        collider={false}
                    />
                </>
            );
        default:
            return <Block size={[0.4, 0.4, 0.4]} position={[0, y + 0.2, 0.32]} color="#e9d2b8" />;
    }
}

/**
 * Two swivel lounge chairs and a marble table facing the window: the place to
 * sit and look out. Plus shelves on the free stretch of the east wall.
 */
function Lounge() {
    const cx = CENTER.x;
    const cz = CENTER.z + 1.2;
    return (
        <>
            <Model name="lounge-chair" position={[cx - 1.25, 0, cz - 0.5]} rotationY={0.35} />
            <Model name="lounge-chair" position={[cx + 1.25, 0, cz - 0.5]} rotationY={-0.35} />
            <Model name="round-table" position={[cx, 0, cz + 0.55]} />

            {/* floor lamp (a Lamp sits in its shade, see HobbiesRoom) */}
            <RigidBody type="fixed" colliders="cuboid">
                <Block
                    size={[0.06, 1.6, 0.06]}
                    position={[cx + 2.3, 0.8, cz + 1.0]}
                    surface="metal"
                />
            </RigidBody>
            <Block size={[0.4, 0.3, 0.4]} position={[cx + 2.3, 1.75, cz + 1.0]} color="#f3e3c7" />

            <Model name="cube-shelves" position={[x1 - 0.2, 0, 1.4]} />
            {/* a record player on top: the vinyl crackle you hear in here */}
            <Model
                name="turntable"
                position={[x1 - 0.2, 1.56, 1.6]}
                rotationY={-Math.PI / 2}
                collider={false}
            />
            <Model name="vase" position={[x1 - 0.2, 1.56, 1.05]} collider={false} />
            <Model name="monstera" position={[x0 + 0.6, 0, z1 - 0.6]} />
            <Model name="plant-pot" position={[x1 - 0.6, 0, z1 - 0.6]} />
        </>
    );
}

function Mullions() {
    const cols = 8;
    const rows = 4;
    const w = WINDOW.x1 - WINDOW.x0;
    const h = WINDOW.y1 - WINDOW.y0;
    const z = z1 + 0.05;
    return (
        <group>
            {Array.from({ length: cols + 1 }, (_, i) => (
                <Block
                    key={`v${i}`}
                    size={[0.05, h, 0.06]}
                    position={[WINDOW.x0 + (i * w) / cols, WINDOW.y0 + h / 2, z]}
                    surface="metal"
                />
            ))}
            {Array.from({ length: rows + 1 }, (_, j) => (
                <Block
                    key={`h${j}`}
                    size={[w, 0.05, 0.06]}
                    position={[(WINDOW.x0 + WINDOW.x1) / 2, WINDOW.y0 + (j * h) / rows, z]}
                    surface="metal"
                />
            ))}
        </group>
    );
}
