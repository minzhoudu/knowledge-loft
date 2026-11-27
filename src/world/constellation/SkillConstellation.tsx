'use client';

import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import {
    AdditiveBlending,
    CanvasTexture,
    Color,
    Matrix4,
    SRGBColorSpace,
    type Group,
    type InstancedMesh,
    type LineSegments,
    type SpriteMaterial,
} from 'three';
import { useWorld } from '@/store/world';
import { Interactable } from '@/world/interaction/Interactable';
import { surfaceProps } from '@/world/materials/surfaces';
import { MARKERS } from '@/world/rooms/lobby/layout';
import { SKILL_COLORS } from './colors';
import { ORDER } from './DarkRoom';
import { blend, INSIDE, insidePositions, OUTSIDE, outsidePositions } from './immersion';
import { constellation, neighbours, strongest } from './layout';

/**
 * The skill constellation.
 *
 * One star per skill, sized by how many projects and roles use it, coloured
 * by family, and linked to the skills it was used alongside.
 *
 * From the lobby it's one object, a cloud over its projector: aim at it and
 * press E to step inside. The cloud then grows around you, the room goes
 * dark (DarkRoom), and you stand in the middle looking around: aim at a star
 * and it lights up with its links and their names; press E for the projects
 * and roles behind it. Esc steps back out (ConstellationCamera).
 *
 * Rendering is cheap on purpose:
 * - all stars are ONE draw call (an InstancedMesh: one sphere, drawn N times
 *   with a per-instance position, size and colour),
 * - all links are ONE draw call (LineSegments: pairs of points),
 * - star colours go above 1.0 ("brighter than white"), which is exactly what
 *   the bloom pass picks up, so they glow without any light sources,
 * - positions are only rewritten while stepping in or out.
 */

const { stars, links } = constellation;
const N = stars.length;

const [CX, , CZ] = MARKERS.constellation.position;
const SPIN = 0.035; // radians per second: a slow drift, so it feels alive

const baseColor = stars.map((s) => new Color(SKILL_COLORS[s.category]));
const size = stars.map((s) => 0.024 + 0.014 * Math.sqrt(s.uses));

// Link geometry: two points per link, and a colour per point (both updated per frame).
const linkPositions = new Float32Array(links.length * 6);
const linkColors = new Float32Array(links.length * 6);

const starColors = new Float32Array(N * 3);

// Per-frame state (module scope: written by the render loop, never by React).
const glow = new Float32Array(N).fill(1); // current brightness of each star
const tint = new Color();
const matrix = new Matrix4();
const spin = { angle: 0, speed: SPIN };
/** Each star's current position (a blend of outside and inside), and the blend it was placed for. */
const current = stars.map(() => [0, 0, 0] as [number, number, number]);
const placed = { t: -1 };

/** How bright each star wants to be: busier skills shine more. */
function restingGlow(i: number) {
    return 0.9 + 0.35 * Math.sqrt(stars[i].uses);
}

export function SkillConstellation() {
    const group = useRef<Group>(null);
    const starMesh = useRef<InstancedMesh>(null);
    const linkLines = useRef<LineSegments>(null);
    const labels = useRef<(SpriteMaterial | null)[]>([]);
    const labelGroups = useRef<(Group | null)[]>([]);
    const labelTextures = useMemo(() => stars.map((s) => drawLabel(s.name)), []);
    const phase = useWorld((s) => s.constellation);

    useEffect(() => () => labelTextures.forEach((l) => l.texture.dispose()), [labelTextures]);
    // A fresh mount (hot reload, coming back to the page) places everything again.
    useEffect(() => {
        placed.t = -1;
    }, []);

    useFrame((_, delta) => {
        const dt = Math.min(delta, 0.1);
        const t = blend.t;

        // The whole cloud travels from over the projector to around your eye...
        const g = group.current;
        if (g) {
            g.position.set(CX, OUTSIDE.centre[1] + (INSIDE.centre[1] - OUTSIDE.centre[1]) * t, CZ);
        }
        // ...and each star from its outside spot to its inside one. Only redone
        // while that's changing; the rest of the time it costs nothing.
        if (t !== placed.t) {
            placed.t = t;
            place(t, starMesh.current, linkLines.current, labelGroups.current);
        }

        const focusedId = useWorld.getState().focused?.id;
        const whole = focusedId === 'constellation'; // aiming at the cloud from the lobby
        const focus = focusedId?.startsWith('skill:')
            ? stars.findIndex((s) => `skill:${s.slug}` === focusedId)
            : -1;
        const near = focus >= 0 ? new Set(neighbours[focus]) : null;
        const named = focus >= 0 ? new Set(strongest[focus]) : null; // the ones we name

        // Hold still while you're looking at a star, so it doesn't drift away.
        spin.speed += ((focus >= 0 ? 0 : SPIN) - spin.speed) * (1 - Math.exp(-3 * dt));
        spin.angle += spin.speed * dt;
        if (g) g.rotation.y = spin.angle;

        // Stars: the focused one blazes, its neighbours brighten, the rest fade back.
        const ease = 1 - Math.exp(-8 * dt);
        const mesh = starMesh.current;
        for (let i = 0; i < N; i++) {
            const target =
                focus < 0
                    ? restingGlow(i) * (whole ? 1.6 : 1)
                    : i === focus
                      ? 6
                      : near!.has(i)
                        ? 2.6
                        : 0.35;
            glow[i] += (target - glow[i]) * ease;
            if (mesh) mesh.setColorAt(i, tint.copy(baseColor[i]).multiplyScalar(glow[i]));

            const label = labels.current[i];
            if (label) {
                const show =
                    focus < 0
                        ? stars[i].uses >= 3
                            ? 0.8
                            : 0
                        : i === focus || named!.has(i)
                          ? 1
                          : 0;
                label.opacity += (show - label.opacity) * ease;
                label.visible = label.opacity > 0.01;
            }
        }
        if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Links: faint threads normally; the focused star's links light up.
        const lines = linkLines.current;
        if (lines) {
            const colors = lines.geometry.attributes.color;
            links.forEach(({ a, b, weight }, i) => {
                const lit = focus >= 0 && (a === focus || b === focus);
                const strength =
                    (focus < 0 ? (whole ? 0.2 : 0.08) : lit ? 0.9 : 0.02) *
                    Math.min(1, 0.5 + weight * 0.25);
                tint.copy(baseColor[a]).multiplyScalar(strength);
                colors.setXYZ(i * 2, tint.r, tint.g, tint.b);
                tint.copy(baseColor[b]).multiplyScalar(strength);
                colors.setXYZ(i * 2 + 1, tint.r, tint.g, tint.b);
            });
            colors.needsUpdate = true;
        }
    });

    const steel = surfaceProps('metal');
    return (
        <group>
            {/* the projector it floats above: a low steel drum with a glowing rim */}
            <RigidBody type="fixed" colliders={false} position={[CX, 0, CZ]}>
                <CylinderCollider args={[0.16, 0.6]} position={[0, 0.16, 0]} />
                <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.6, 0.64, 0.32, 48]} />
                    <meshStandardMaterial {...steel} />
                </mesh>
                <mesh position={[0, 0.325, 0]} rotation-x={-Math.PI / 2}>
                    <ringGeometry args={[0.5, 0.53, 64]} />
                    <meshBasicMaterial color={[1.6, 1.9, 2.4]} />
                </mesh>
            </RigidBody>

            {/* From the lobby, the cloud is one thing to aim at: a generous
                invisible ball around it. Inside, the stars take over. */}
            {!phase && (
                <group position={OUTSIDE.centre}>
                    <Interactable
                        id="constellation"
                        label="Skill constellation"
                        action={{ kind: 'constellation' }}
                    >
                        <mesh visible={false} userData={{ aimAssist: true }}>
                            <sphereGeometry args={[OUTSIDE.radius * 1.05, 16, 12]} />
                        </mesh>
                    </Interactable>
                </group>
            )}

            <group ref={group}>
                <instancedMesh
                    ref={starMesh}
                    args={[undefined, undefined, N]}
                    frustumCulled={false}
                    renderOrder={ORDER.stars}
                >
                    {/* Created up front so the shader is compiled with per-instance colour. */}
                    <instancedBufferAttribute attach="instanceColor" args={[starColors, 3]} />
                    <sphereGeometry args={[1, 16, 12]} />
                    {/* Transparent only so it's drawn after the dark room (see DarkRoom). */}
                    <meshBasicMaterial transparent />
                </instancedMesh>

                <lineSegments ref={linkLines} frustumCulled={false} renderOrder={ORDER.stars}>
                    <bufferGeometry>
                        <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} />
                        <bufferAttribute attach="attributes-color" args={[linkColors, 3]} />
                    </bufferGeometry>
                    <lineBasicMaterial
                        vertexColors
                        transparent
                        depthWrite={false}
                        blending={AdditiveBlending}
                    />
                </lineSegments>

                {stars.map((s, i) => (
                    <group
                        key={s.slug}
                        ref={(g) => {
                            labelGroups.current[i] = g;
                        }}
                    >
                        <sprite
                            position={[0, size[i] + 0.05, 0]}
                            scale={[0.08 * labelTextures[i].aspect, 0.08, 1]}
                            renderOrder={ORDER.stars}
                        >
                            <spriteMaterial
                                ref={(m) => {
                                    labels.current[i] = m;
                                }}
                                map={labelTextures[i].texture}
                                transparent
                                opacity={0}
                                depthWrite={false}
                            />
                        </sprite>
                    </group>
                ))}

                {/* Inside, every star can be picked: a bigger invisible ball around
                    each, at its inside spot, so it's easy to aim at (invisible
                    meshes still answer raycasts). */}
                {phase === 'inside' &&
                    stars.map((s, i) => (
                        <group key={s.slug} position={insidePositions[i]} scale={INSIDE.grow}>
                            <Interactable
                                id={`skill:${s.slug}`}
                                label={`${s.name} · ${usesLabel(s.uses)}`}
                                action={{ kind: 'panel', panel: { kind: 'skill', slug: s.slug } }}
                            >
                                <mesh visible={false} userData={{ aimAssist: true }}>
                                    <sphereGeometry args={[Math.max(0.1, size[i] * 2.5), 8, 6]} />
                                </mesh>
                            </Interactable>
                        </group>
                    ))}
            </group>
        </group>
    );
}

/**
 * Put every star, link end and label where the blend `t` says (0 = the
 * cloud over the projector, 1 = the shell around you), and grow them
 * toward their inside size.
 */
function place(
    t: number,
    mesh: InstancedMesh | null,
    lines: LineSegments | null,
    labelGroups: (Group | null)[],
) {
    const grow = 1 + (INSIDE.grow - 1) * t;
    for (let i = 0; i < N; i++) {
        const a = outsidePositions[i];
        const b = insidePositions[i];
        const p = current[i];
        for (let k = 0; k < 3; k++) p[k] = a[k] + (b[k] - a[k]) * t;
        const r = size[i] * grow;
        mesh?.setMatrixAt(i, matrix.makeScale(r, r, r).setPosition(p[0], p[1], p[2]));
        const label = labelGroups[i];
        if (label) {
            label.position.set(p[0], p[1], p[2]);
            label.scale.setScalar(grow);
        }
    }
    if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
    }
    if (lines) {
        const positions = lines.geometry.attributes.position;
        links.forEach(({ a, b }, i) => {
            positions.setXYZ(i * 2, ...current[a]);
            positions.setXYZ(i * 2 + 1, ...current[b]);
        });
        positions.needsUpdate = true;
        lines.geometry.computeBoundingSphere();
    }
}

function usesLabel(uses: number) {
    if (uses === 0) return 'skill';
    return `${uses} ${uses === 1 ? 'project or role' : 'projects and roles'}`;
}

/** A star's name as a texture: white text with a soft shadow, so it reads on any background. */
function drawLabel(text: string) {
    const font = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-plex-mono')
        .trim();
    const px = 56;
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d')!;
    g.font = `500 ${px}px ${font || 'ui-monospace, monospace'}`;
    const width = Math.ceil(g.measureText(text).width) + 24;
    canvas.width = width;
    canvas.height = px + 24;
    g.font = `500 ${px}px ${font || 'ui-monospace, monospace'}`;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0, 0, 0, 0.8)';
    g.shadowBlur = 10;
    g.fillStyle = '#ffffff';
    g.fillText(text, 12, canvas.height / 2);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, aspect: canvas.width / canvas.height };
}
