'use client';

import { RigidBody } from '@react-three/rapier';
import { companies } from '@/content';
import { Block } from '@/world/greybox/Block';
import { Label } from '@/world/greybox/Label';
import { Interactable } from '@/world/interaction/Interactable';
import { Lamp } from '@/world/environment/Lamp';
import { Model } from '@/world/models/Model';
import { DOOR, layoutStations, roomFor, type Station } from './layout';

// Content is static, so the room's shape and stations are computed once.
const ROOM = roomFor(companies.length);
const STATIONS = layoutStations(companies, ROOM);
const EARLIEST_YEAR = companies.length ? companies[companies.length - 1].start.slice(0, 4) : '';

const { x0, x1, z0, z1, height: H, wall: T } = ROOM;
const CX = (x0 + x1) / 2;
const CZ = (z0 + z1) / 2;
const W = x1 - x0;
const L = z1 - z0;

/**
 * Greybox Career corridor: a walk back through time. Each role is a station
 * on the wall with a year marker on the floor, joined by a timeline line
 * down the middle. Stations, length and lights all come from content.
 *
 * It has no windows; the light comes from the wall lamps, one opposite each
 * station: each is a real light, with its glass glowing, so you can see
 * where the light comes from. They follow the corridor's switch.
 */

/** The wall lamp's glass: its centre above the lamp's base, and how far a light sits off the wall. */
const SCONCE = { glassY: 0.215, out: 0.2 };
export function CareerRoom() {
    return (
        <group>
            <RigidBody type="fixed" colliders="cuboid">
                {/* floor + ceiling; the south edge stops at the shared lobby wall */}
                <Block
                    size={[W + T * 2, 0.2, L + T]}
                    position={[CX, -0.1, CZ - T / 2]}
                    surface="concrete"
                />
                <Block
                    size={[W + T * 2, 0.2, L + T]}
                    position={[CX, H + 0.1, CZ - T / 2]}
                    surface="ceiling"
                />

                {/* west, east and north walls; the south wall is the lobby's */}
                <Block
                    size={[T, H, L + T]}
                    position={[x0 - T / 2, H / 2, CZ - T / 2]}
                    surface="wall"
                />
                <Block
                    size={[T, H, L + T]}
                    position={[x1 + T / 2, H / 2, CZ - T / 2]}
                    surface="wall"
                />
                <Block size={[W + T * 2, H, T]} position={[CX, H / 2, z0 - T / 2]} surface="wall" />

                {STATIONS.map((s) => (
                    <StationPanel key={s.company.slug} station={s} />
                ))}
            </RigidBody>

            {/* the timeline: a line down the middle, with a tick and a year at each station */}
            <Block size={[0.06, 0.01, L - 1]} position={[CX, 0.006, CZ]} surface="metal" />
            {STATIONS.map(({ company, position: [, , z], side }) => (
                <group key={company.slug}>
                    <Block size={[W * 0.6, 0.01, 0.06]} position={[CX, 0.007, z]} surface="metal" />
                    <Label
                        title={company.start.slice(0, 4)}
                        width={0.9}
                        position={[CX + (side === 'west' ? -0.9 : 0.9), 0.012, z + 0.4]}
                        flat
                    />
                </group>
            ))}

            {/* wall labels (no physics) */}
            {STATIONS.map(({ company, position, rotationY }) => (
                <group key={company.slug} position={position} rotation-y={rotationY}>
                    <Label
                        title={company.name}
                        subtitle={company.role}
                        width={1.8}
                        position={[0, 1.95, 0.06]}
                    />
                </group>
            ))}
            <Label
                title="Career"
                subtitle={EARLIEST_YEAR ? `${EARLIEST_YEAR} → now` : undefined}
                width={2.4}
                position={[CX, 2.6, z0 + 0.01]}
            />
            {/* a clock above the sign at the far end: it's what you hear ticking */}
            <Model name="clock" position={[CX, 3.12, z0 + 0.04]} scale={1.6} collider={false} />
            {/* industrial wall lamps on the wall opposite each station, lighting it */}
            {STATIONS.map(({ company, position: [, , z], side }) => {
                const east = side === 'west';
                return (
                    <group key={company.slug}>
                        <Model
                            name="wall-lamp"
                            position={[east ? x1 - 0.07 : x0 + 0.07, 1.9, z]}
                            rotationY={east ? -Math.PI / 2 : Math.PI / 2}
                            collider={false}
                            glowsWith="career"
                        />
                        {/* the light itself: just in front of the glass, so it washes the
                            wall around the lamp and reaches the station across the corridor */}
                        <Lamp
                            room="career"
                            position={[
                                east ? x1 - SCONCE.out : x0 + SCONCE.out,
                                1.9 + SCONCE.glassY,
                                z,
                            ]}
                            intensity={6}
                            color="#ffd39a"
                            bulbRadius={0}
                        />
                    </group>
                );
            })}
            <Model name="plant-tall" position={[x0 + 0.45, 0, z0 + 0.45]} />
            <Model name="plant-pot" position={[x1 - 0.45, 0, z0 + 0.45]} />
            <Label
                title="Lobby"
                width={1.1}
                position={[DOOR.center, DOOR.height + 0.35, z1 - 0.01]}
                rotationY={Math.PI}
            />
        </group>
    );
}

/** A role on the wall: an inspectable panel that opens the company details. */
function StationPanel({ station }: { station: Station }) {
    const { company, position, rotationY } = station;
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id={`company:${company.slug}`}
                label={`${company.name} · ${company.role}`}
                action={{ kind: 'panel', panel: { kind: 'company', slug: company.slug } }}
            >
                <Block size={[2.3, 1.5, 0.05]} position={[0, 1.95, 0.025]} surface="accent" />
            </Interactable>
        </group>
    );
}
