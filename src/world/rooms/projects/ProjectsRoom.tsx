'use client';

import { RigidBody } from '@react-three/rapier';
import { projects } from '@/content';
import { Block } from '@/world/greybox/Block';
import { Label } from '@/world/greybox/Label';
import { Interactable } from '@/world/interaction/Interactable';
import { CENTER, DOOR, layoutExhibits, ROOM, type ExhibitSlot } from './layout';

const { x0, x1, z0, z1, height: H, wall: T } = ROOM;
const PLAQUE_Z = -0.86; // exhibit-local z of the wall panel (the wall is at -0.9)

// Computed once at module load: content is static, so the layout is too.
const { featured, slots } = layoutExhibits(projects);

/**
 * Greybox Projects gallery. Every exhibit comes from content via
 * layoutExhibits(), so the room grows with your project list.
 *
 * Solid geometry lives inside one fixed RigidBody (auto box colliders);
 * text labels live outside it, so they don't get colliders.
 */
export function ProjectsRoom() {
    const w = x1 - x0;
    const d = z1 - z0;

    return (
        <group>
            <RigidBody type="fixed" colliders="cuboid">
                {/* floor + ceiling (the east edge stops at the shared lobby wall) */}
                <Block
                    size={[w + T, 0.2, d + T * 2]}
                    position={[x0 - T / 2 + w / 2, -0.1, CENTER.z]}
                    surface="concrete"
                />
                <Block
                    size={[w + T, 0.2, d + T * 2]}
                    position={[x0 - T / 2 + w / 2, H + 0.1, CENTER.z]}
                    surface="ceiling"
                />

                {/* north, south and west walls; the east wall is the lobby's */}
                <Block
                    size={[w + T, H, T]}
                    position={[x0 - T / 2 + w / 2, H / 2, z0 - T / 2]}
                    surface="wall"
                />
                <Block
                    size={[w + T, H, T]}
                    position={[x0 - T / 2 + w / 2, H / 2, z1 + T / 2]}
                    surface="wall"
                />
                <Block size={[T, H, d]} position={[x0 - T / 2, H / 2, CENTER.z]} surface="wall" />

                {featured && <FeaturedPodium />}
                {slots.map((slot) => (
                    <Exhibit key={slot.project.slug} slot={slot} />
                ))}
            </RigidBody>

            {/* labels: no physics */}
            {slots.map(({ project, position: [x, , z], rotationY }) => (
                <group key={project.slug} position={[x, 0, z]} rotation-y={rotationY}>
                    <Label
                        title={project.title}
                        subtitle={String(project.year)}
                        width={1.5}
                        position={[0, 2.0, PLAQUE_Z + 0.04]}
                    />
                </group>
            ))}
            {featured && (
                <Label
                    title={featured.title}
                    subtitle={`Featured · ${featured.year}`}
                    width={1.8}
                    position={[CENTER.x, 2.55, CENTER.z]}
                    rotationY={Math.PI / 2}
                />
            )}
            <Label
                title="Projects"
                subtitle={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
                width={2.6}
                position={[x0 + 0.01, 2.7, CENTER.z]}
                rotationY={Math.PI / 2}
            />
            <Label
                title="Lobby"
                width={1.1}
                position={[x1 - 0.01, DOOR.height + 0.35, DOOR.center]}
                rotationY={-Math.PI / 2}
            />

            {/* the room has no windows, so it gets its own (shadowless) ceiling lights */}
            {[x0 + 2.5, CENTER.x, x1 - 2.5].map((x) => (
                <pointLight
                    key={x}
                    position={[x, H - 0.6, CENTER.z]}
                    intensity={14}
                    distance={0}
                    decay={2}
                />
            ))}
        </group>
    );
}

/** A wall exhibit: plinth with a stand-in object, and a panel on the wall behind it. */
function Exhibit({ slot }: { slot: ExhibitSlot }) {
    const { project, position, rotationY } = slot;
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id={`project:${project.slug}`}
                label={`Exhibit · ${project.title}`}
                action={{ kind: 'panel', panel: { kind: 'project', slug: project.slug } }}
            >
                <Block size={[0.6, 1.0, 0.6]} position={[0, 0.5, 0]} surface="accent" />
                <Block size={[0.35, 0.35, 0.35]} position={[0, 1.18, 0]} color="#e9d2b8" />
                <Block size={[1.8, 1.2, 0.05]} position={[0, 2.0, PLAQUE_Z]} surface="accent" />
            </Interactable>
        </group>
    );
}

/** The featured project: a bigger podium in the middle of the room, facing the door. */
function FeaturedPodium() {
    if (!featured) return null;
    return (
        <group position={[CENTER.x, 0, CENTER.z]} rotation-y={Math.PI / 2}>
            <Interactable
                id={`project:${featured.slug}`}
                label={`Featured · ${featured.title}`}
                action={{ kind: 'panel', panel: { kind: 'project', slug: featured.slug } }}
            >
                <Block size={[1.8, 0.25, 1.8]} position={[0, 0.125, 0]} surface="accent" />
                <Block size={[0.9, 0.9, 0.9]} position={[0, 0.7, 0]} surface="accent" />
                <Block size={[0.6, 0.6, 0.6]} position={[0, 1.45, 0]} color="#e9d2b8" />
            </Interactable>
        </group>
    );
}
