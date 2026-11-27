'use client';

import { RigidBody } from '@react-three/rapier';
import { projects } from '@/content';
import { Block } from '@/world/greybox/Block';
import { Label } from '@/world/greybox/Label';
import { GithubWall } from '@/world/github/GithubWall';
import { Interactable } from '@/world/interaction/Interactable';
import { Lamp } from '@/world/environment/Lamp';
import { Model } from '@/world/models/Model';
import { DISPLAYS, FeaturedDisplay, Plaque, PLINTH, Vitrine } from './exhibits';
import { CENTER, DOOR, layoutExhibits, ROOM, type ExhibitSlot } from './layout';

const { x0, x1, z0, z1, height: H, wall: T } = ROOM;
const PLAQUE_Z = -0.86; // exhibit-local z of the wall panel (the wall is at -0.9)
const PENDANT_DROP = 1.36; // the industrial pendant's height, chain included

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

            {/* glass cases and their contents: no auto colliders (the plinths have them) */}
            {slots.map(({ project, position, rotationY }) => (
                <group key={project.slug} position={position} rotation-y={rotationY}>
                    <group position-y={PLINTH.height}>
                        <Vitrine />
                        {DISPLAYS[project.slug]?.items}
                    </group>
                </group>
            ))}
            {featured && (
                <group position={[CENTER.x, 0, CENTER.z]} rotation-y={Math.PI / 2}>
                    <FeaturedDisplay top={PODIUM.top} base={PODIUM.base} />
                </group>
            )}
            {featured && (
                <Label
                    title={featured.title}
                    subtitle={`Featured · ${featured.year}`}
                    width={1.8}
                    position={[CENTER.x, 2.55, CENTER.z]}
                    rotationY={Math.PI / 2}
                />
            )}
            {/* the gallery's sign hangs just inside the entrance, facing you as you come in */}
            <Label
                title="Projects"
                subtitle={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
                width={2.2}
                position={[x1 - 1.2, 3.55, CENTER.z]}
                rotationY={Math.PI / 2}
            />
            {/* the far wall: live GitHub activity */}
            <GithubWall position={[x0 + 0.01, 0, CENTER.z]} rotationY={Math.PI / 2} />
            <Label
                title="Lobby"
                width={1.1}
                position={[x1 - 0.01, DOOR.height + 0.35, DOOR.center]}
                rotationY={-Math.PI / 2}
            />

            {/* the room has no windows, so it gets its own (shadowless) ceiling lights:
                two in industrial pendants (the light sits in the shade, 1.36 m below
                the ceiling), and a plain one over the featured podium and its sign */}
            {[x0 + 2.5, x1 - 2.5].map((x) => (
                <group key={x}>
                    <Model
                        name="industrial-pendant"
                        position={[x, H - PENDANT_DROP, CENTER.z]}
                        collider={false}
                    />
                    <Lamp
                        room="projects"
                        position={[x, H - PENDANT_DROP + 0.1, CENTER.z]}
                        intensity={10}
                        bulbRadius={0}
                    />
                </group>
            ))}
            <Lamp
                room="projects"
                position={[CENTER.x, H - 0.6, CENTER.z]}
                intensity={14}
                bulbRadius={0}
            />
        </group>
    );
}

/**
 * A wall exhibit: a plinth and the plaque on the wall behind it. This part is inside the room's rigid body,
 * so the plinth gets a collider; the glass case and its contents are added
 * outside it (see above), where they don't.
 */
function Exhibit({ slot }: { slot: ExhibitSlot }) {
    const { project, position, rotationY } = slot;
    return (
        <group position={position} rotation-y={rotationY}>
            <Interactable
                id={`project:${project.slug}`}
                label={`Exhibit · ${project.title}`}
                action={{ kind: 'panel', panel: { kind: 'project', slug: project.slug } }}
            >
                <Block
                    size={[PLINTH.size, PLINTH.height, PLINTH.size]}
                    position={[0, PLINTH.height / 2, 0]}
                    surface="accent"
                />
                <Plaque project={project} position={[0, 1.95, PLAQUE_Z]} />
            </Interactable>
        </group>
    );
}

/** The featured podium's heights: its base step, and the top of the block on it. */
const PODIUM = { base: 0.25, top: 1.15 };

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
            </Interactable>
        </group>
    );
}
