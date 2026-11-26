'use client';

import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import { Block } from '@/world/greybox/Block';
import type { Surface } from '@/world/materials/surfaces';
import { Door } from '@/world/greybox/Door';
import { Label } from '@/world/greybox/Label';
import { Lamp } from '@/world/environment/Lamp';
import { Interactable } from '@/world/interaction/Interactable';
import { DOORS, MARKERS, ROOM, WINDOW } from './layout';

const { halfWidth: X, halfDepth: Z, height: H, wall: T } = ROOM;

/**
 * Greybox lobby: the whole room from plain boxes.
 *
 * Everything inside the fixed <RigidBody colliders="cuboid"> gets an
 * automatic box collider generated from each mesh. Invisible
 * <CuboidCollider>s block the window and doorways whose rooms don't exist yet.
 * Decoration that you shouldn't bump into (window mullions, rug) sits
 * outside the rigid body, so it has no collision at all.
 */
export function Lobby() {
    const left = DOORS.projects;
    const back = DOORS.career;
    const lz0 = left.center - left.width / 2;
    const lz1 = left.center + left.width / 2;
    const bx0 = back.center - back.width / 2;
    const bx1 = back.center + back.width / 2;
    const right = DOORS.hobbies;
    const rz0 = right.center - right.width / 2;
    const rz1 = right.center + right.width / 2;

    return (
        <group>
            <RigidBody type="fixed" colliders="cuboid">
                {/* floor + ceiling */}
                <Block
                    size={[X * 2 + T * 2, 0.2, Z * 2 + T * 2]}
                    position={[0, -0.1, 0]}
                    surface="floor"
                />
                <Block
                    size={[X * 2 + T * 2, 0.2, Z * 2 + T * 2]}
                    position={[0, H + 0.1, 0]}
                    surface="ceiling"
                />

                {/* back wall (z = -Z) with the Career doorway: exposed brick, the loft's accent wall */}
                <Wall from={[-X - T, -Z - T / 2]} to={[bx0, -Z - T / 2]} axis="x" surface="brick" />
                <Wall from={[bx1, -Z - T / 2]} to={[X + T, -Z - T / 2]} axis="x" surface="brick" />
                <Block
                    size={[back.width, H - back.height, T]}
                    position={[back.center, (H + back.height) / 2, -Z - T / 2]}
                    surface="brick"
                />

                {/* left wall (x = -X) with the Projects doorway */}
                <Wall from={[-X - T / 2, -Z]} to={[-X - T / 2, lz0]} axis="z" />
                <Wall from={[-X - T / 2, lz1]} to={[-X - T / 2, Z]} axis="z" />
                <Block
                    size={[T, H - left.height, left.width]}
                    position={[-X - T / 2, (H + left.height) / 2, left.center]}
                    surface="wall"
                />

                {/* right wall (x = +X) with the Hobbies doorway */}
                <Wall from={[X + T / 2, -Z]} to={[X + T / 2, rz0]} axis="z" />
                <Wall from={[X + T / 2, rz1]} to={[X + T / 2, Z]} axis="z" />
                <Block
                    size={[T, H - right.height, right.width]}
                    position={[X + T / 2, (H + right.height) / 2, right.center]}
                    surface="wall"
                />

                {/* window wall (z = +Z): solid around one big opening */}
                <Wall from={[-X - T, Z + T / 2]} to={[WINDOW.x0, Z + T / 2]} axis="x" />
                <Wall from={[WINDOW.x1, Z + T / 2]} to={[X + T, Z + T / 2]} axis="x" />
                <Block
                    size={[WINDOW.x1 - WINDOW.x0, WINDOW.y0, T]}
                    position={[0, WINDOW.y0 / 2, Z + T / 2]}
                    surface="wall"
                />
                <Block
                    size={[WINDOW.x1 - WINDOW.x0, H - WINDOW.y1, T]}
                    position={[0, (H + WINDOW.y1) / 2, Z + T / 2]}
                    surface="wall"
                />

                <Furniture />
            </RigidBody>

            {/* invisible blocker for the window */}
            <CuboidCollider
                args={[(WINDOW.x1 - WINDOW.x0) / 2, (WINDOW.y1 - WINDOW.y0) / 2, T / 2]}
                position={[0, (WINDOW.y0 + WINDOW.y1) / 2, Z + T / 2]}
            />

            {/* doorways: a sign above each. Built rooms get a real door that swings
                into the new room; unbuilt ones get a blocker and a dark fill. */}
            <Label
                title="Projects"
                subtitle={left.built ? undefined : 'Coming soon'}
                width={1.3}
                position={[-X + 0.01, left.height + 0.35, left.center]}
                rotationY={Math.PI / 2}
            />
            {left.built ? (
                <Door
                    id="lobby-projects"
                    label="Door · Projects"
                    hinge={[-X - T / 2, lz0]}
                    rotationY={-Math.PI / 2} // hinge → latch runs along +z
                    swing={-1} // opens toward -x, into the Projects room
                    width={left.width}
                    height={left.height}
                />
            ) : (
                <ClosedDoor
                    position={[-X - T / 2, left.height / 2, left.center]}
                    rotationY={Math.PI / 2}
                    width={left.width}
                    height={left.height}
                />
            )}
            <Label
                title="Career"
                subtitle={back.built ? undefined : 'Coming soon'}
                width={1.3}
                position={[back.center, back.height + 0.4, -Z + 0.01]}
            />
            {back.built ? (
                <Door
                    id="lobby-career"
                    label="Door · Career"
                    hinge={[bx0, -Z - T / 2]}
                    rotationY={0} // hinge → latch runs along +x
                    swing={1} // opens toward -z, into the Career corridor
                    width={back.width}
                    height={back.height}
                />
            ) : (
                <ClosedDoor
                    position={[back.center, back.height / 2, -Z - T / 2]}
                    rotationY={0}
                    width={back.width}
                    height={back.height}
                />
            )}
            <Label
                title="Hobbies"
                subtitle={right.built ? undefined : 'Coming soon'}
                width={1.3}
                position={[X - 0.01, right.height + 0.35, right.center]}
                rotationY={-Math.PI / 2}
            />
            {right.built ? (
                <Door
                    id="lobby-hobbies"
                    label="Door · Hobbies"
                    hinge={[X + T / 2, rz0]}
                    rotationY={-Math.PI / 2} // hinge → latch runs along +z
                    swing={1} // opens toward +x, into the Hobbies room
                    width={right.width}
                    height={right.height}
                />
            ) : (
                <ClosedDoor
                    position={[X + T / 2, right.height / 2, right.center]}
                    rotationY={Math.PI / 2}
                    width={right.width}
                    height={right.height}
                />
            )}

            <WindowMullions />

            {/* pendant lamps that come on at dusk: over the exhibit, the desk and the lounge */}
            {PENDANTS.map(([x, y, z]) => (
                <group key={`${x},${z}`}>
                    <Block
                        size={[0.02, H - y - 0.12, 0.02]}
                        position={[x, (H + y + 0.12) / 2, z]}
                        surface="metal"
                    />
                    <Lamp position={[x, y, z]} intensity={12} bulbRadius={0.14} />
                </group>
            ))}
        </group>
    );
}

const PENDANTS: [number, number, number][] = [
    [MARKERS.plinth.position[0], 3.0, MARKERS.plinth.position[2]],
    [MARKERS.desk.position[0], 2.5, MARKERS.desk.position[2] + 0.3],
    [MARKERS.coffeeTable.position[0], 3.0, MARKERS.coffeeTable.position[2] + 0.6],
];

/** A doorway whose room isn't built yet: dark fill you can see, collider you can't pass. */
function ClosedDoor({
    position,
    rotationY,
    width,
    height,
}: {
    position: [number, number, number];
    rotationY: number;
    width: number;
    height: number;
}) {
    return (
        <group position={position} rotation-y={rotationY}>
            <CuboidCollider args={[width / 2, height / 2, T / 2]} />
            <mesh>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial color="#26282b" side={DoubleSide} />
            </mesh>
        </group>
    );
}

/** A full-height wall segment between two points on the floor plan. */
function Wall({
    from,
    to,
    axis,
    surface = 'wall',
}: {
    from: [number, number];
    to: [number, number];
    axis: 'x' | 'z';
    surface?: Surface;
}) {
    const length = axis === 'x' ? to[0] - from[0] : to[1] - from[1];
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    const size: [number, number, number] = axis === 'x' ? [length, H, T] : [T, H, length];
    return <Block size={size} position={[cx, H / 2, cz]} surface={surface} />;
}

function WindowMullions() {
    const cols = 12;
    const rows = 4;
    const w = WINDOW.x1 - WINDOW.x0;
    const h = WINDOW.y1 - WINDOW.y0;
    const z = Z + 0.05;
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
                    position={[0, WINDOW.y0 + (j * h) / rows, z]}
                    surface="metal"
                />
            ))}
        </group>
    );
}

function Furniture() {
    const [dx, , dz] = MARKERS.desk.position;
    const [sx, , sz] = MARKERS.shelf.position;
    const [px, , pz] = MARKERS.plinth.position;
    const [ex, ey, ez] = MARKERS.screen.position;
    const [fx, , fz] = MARKERS.sofa.position;
    const [tx, , tz] = MARKERS.coffeeTable.position;

    return (
        <>
            {/* desk corner: About me */}
            <Interactable
                id="lobby-desk"
                label="Desk · About me"
                action={{ kind: 'panel', panel: { kind: 'section', id: 'about' } }}
            >
                <Block size={[1.9, 0.04, 0.8]} position={[dx, 0.74, dz]} surface="accent" />
                <Block size={[0.04, 0.72, 0.7]} position={[dx - 0.85, 0.36, dz]} surface="accent" />
                <Block size={[0.04, 0.72, 0.7]} position={[dx + 0.85, 0.36, dz]} surface="accent" />
                <Block size={[0.96, 0.56, 0.03]} position={[dx, 1.15, dz - 0.17]} surface="metal" />
            </Interactable>
            <Block size={[0.5, 0.9, 0.5]} position={[dx, 0.45, dz + 0.75]} />

            {/* bookshelf: Hobbies */}
            <Interactable
                id="lobby-shelf"
                label="Bookshelf · Hobbies"
                action={{ kind: 'panel', panel: { kind: 'section', id: 'hobbies' } }}
            >
                <Block size={[0.03, 2.5, 0.38]} position={[sx - 1.2, 1.25, sz]} surface="accent" />
                <Block size={[0.03, 2.5, 0.38]} position={[sx + 1.2, 1.25, sz]} surface="accent" />
                {[0.12, 0.62, 1.12, 1.62, 2.12].map((y) => (
                    <Block
                        key={y}
                        size={[2.4, 0.03, 0.38]}
                        position={[sx, y, sz]}
                        surface="accent"
                    />
                ))}
            </Interactable>

            {/* wall screen: Career */}
            <Interactable
                id="lobby-screen"
                label="Screen · Career"
                action={{ kind: 'panel', panel: { kind: 'section', id: 'career' } }}
            >
                <Block size={[2.36, 1.38, 0.05]} position={[ex, ey, ez]} surface="accent" />
            </Interactable>

            {/* plinth: Projects */}
            <Interactable
                id="lobby-plinth"
                label="Exhibit · All projects"
                action={{ kind: 'panel', panel: { kind: 'section', id: 'projects' } }}
            >
                <Block size={[0.62, 1.05, 0.62]} position={[px, 0.525, pz]} surface="accent" />
                <Block size={[0.5, 0.5, 0.5]} position={[px, 1.33, pz]} color="#e9d2b8" />
            </Interactable>

            {/* lounge */}
            <Block size={[2.6, 0.45, 0.95]} position={[fx, 0.225, fz]} />
            <Block size={[2.6, 0.5, 0.22]} position={[fx, 0.7, fz + 0.37]} />
            <Block size={[1.2, 0.45, 0.65]} position={[tx, 0.225, tz]} />

            {MARKERS.plants.map(([x, , z]) => (
                <Block
                    key={`${x},${z}`}
                    size={[0.5, 1.4, 0.5]}
                    position={[x, 0.7, z]}
                    surface="plant"
                />
            ))}
        </>
    );
}
