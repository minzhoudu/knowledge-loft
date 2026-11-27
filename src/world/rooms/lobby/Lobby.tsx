'use client';

import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import { ArcadeCabinet } from '@/world/arcade/ArcadeCabinet';
import { CurrentlyBoard } from '@/world/currently/CurrentlyBoard';
import { Block } from '@/world/greybox/Block';
import type { Surface } from '@/world/materials/surfaces';
import { Door } from '@/world/greybox/Door';
import { Label } from '@/world/greybox/Label';
import { Lamp } from '@/world/environment/Lamp';
import { Interactable } from '@/world/interaction/Interactable';
import { Bookshelf } from '@/world/bookshelf/Bookshelf';
import { Model } from '@/world/models/Model';
import { SeatScreen } from '@/world/seats/SeatScreen';
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
            </RigidBody>
            <Models />

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

            {/* pendant lamps that come on at dusk: over the arcade, the desk and the lounge */}
            <CurrentlyBoard position={MARKERS.currently.position} rotationY={-Math.PI / 2} />
            {PENDANTS.map(([x, y, z]) => (
                <group key={`${x},${z}`}>
                    <Block
                        size={[0.02, H - y - 0.12, 0.02]}
                        position={[x, (H + y + 0.12) / 2, z]}
                        surface="metal"
                    />
                    <Lamp room="lobby" position={[x, y, z]} intensity={12} bulbRadius={0.14} />
                </group>
            ))}
        </group>
    );
}

const PENDANTS: [number, number, number][] = [
    [MARKERS.centrepiece.position[0], 3.0, MARKERS.centrepiece.position[2]],
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

/**
 * Real furniture (models from public/models). Each brings its own collider,
 * so it lives outside the room's rigid body: that one generates colliders
 * from its meshes once, when it mounts, before any model has loaded.
 */
function Models() {
    const [dx, , dz] = MARKERS.desk.position;
    const [ex, ey, ez] = MARKERS.screen.position;
    const [sx] = MARKERS.shelf.position;
    const [fx, , fz] = MARKERS.sofa.position;
    const [tx, , tz] = MARKERS.coffeeTable.position;

    return (
        <>
            {/* desk corner: About me. A steel office desk, the chair pulled up to it.
                Using it sits you down and shows the About page on the monitor. */}
            <Interactable
                id="lobby-desk"
                label="Desk · About me"
                action={{ kind: 'sit', seat: 'lobby-desk' }}
            >
                <Model name="desk" position={[dx, 0, dz]} />
                <Block size={[0.96, 0.56, 0.03]} position={[dx, 1.2, dz - 0.2]} surface="metal" />
                <SeatScreen seat="lobby-desk" />
                <Block size={[0.24, 0.02, 0.18]} position={[dx, 0.8, dz - 0.2]} surface="metal" />
                <Block size={[0.04, 0.12, 0.04]} position={[dx, 0.87, dz - 0.22]} surface="metal" />
                <Model
                    name="desk-lamp"
                    position={[dx + 0.75, 0.79, dz - 0.15]}
                    rotationY={-2.4}
                    collider={false}
                />
                <Model
                    name="plant-pot"
                    position={[dx - 0.8, 0.79, dz - 0.2]}
                    scale={0.4}
                    collider={false}
                />
            </Interactable>
            <Model name="armchair" position={[dx, 0, dz + 0.95]} rotationY={Math.PI} />

            {/* wall display: Career. Using it steps you up to read it on the screen.
                No collider: it hangs flat on the wall. */}
            <Interactable
                id="lobby-screen"
                label="Screen · Career"
                action={{ kind: 'sit', seat: 'lobby-career' }}
            >
                <Block size={[2.36, 1.38, 0.05]} position={[ex, ey, ez]} surface="metal" />
                <SeatScreen seat="lobby-career" />
            </Interactable>

            {/* steel-frame bookshelf against the brick: the knowledge base. Every book
                is a note (src/content/notes); aim at one and take it to read. */}
            <Model name="steel-shelves" position={[sx, 0, -Z + 0.38]} />
            <Bookshelf position={[sx, 0, -Z + 0.38]} />
            <Model name="vase" position={[sx - 0.75, SHELF_TOP, -Z + 0.36]} collider={false} />

            {/* the centrepiece: an arcade cabinet, playing its own demo until you step up */}
            <Interactable
                id="lobby-arcade"
                label="Arcade · Puncture Run"
                action={{ kind: 'sit', seat: 'lobby-arcade' }}
            >
                <ArcadeCabinet />
            </Interactable>

            {/* lounge by the window: a chesterfield facing the room, a lounge chair, a low table */}
            <Model name="sofa" position={[fx, 0, fz]} rotationY={Math.PI} />
            <Model
                name="pillows"
                position={[fx, 0.32, fz + 0.1]}
                rotationY={Math.PI}
                collider={false}
            />
            <Model name="coffee-table" position={[tx, 0, tz]} rotationY={Math.PI / 2} />
            <Model name="lounge-chair" position={[tx + 2.0, 0, tz + 0.5]} rotationY={-2.0} />

            {MARKERS.plants.map(([x, , z], i) => (
                <Model key={`${x},${z}`} name={PLANTS[i % PLANTS.length]} position={[x, 0, z]} />
            ))}
        </>
    );
}

const PLANTS = ['monstera', 'plant-pot', 'plant-tall'] as const;

/** Top of the steel shelf (measured from the model), where the vase stands. */
const SHELF_TOP = 2.3;
