'use client';

import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { useWorld } from '@/store/world';
import type { RoomId } from '@/world/rooms/zones';
import { MAP_ROOMS, ROOM_IDS } from './rooms';

/**
 * What you can point at in the map view: each room's floor lights up under
 * the cursor, and a label floats above it. Click either to jump in.
 *
 * The floors use React Three Fiber's pointer events: R3F raycasts from the
 * cursor into the scene and calls onPointerOver / onClick on the meshes it
 * hits, like DOM events. It reports every mesh along the ray, not just the
 * nearest, so a room's floor still answers when furniture stands on it.
 */
export function MapOverlay() {
    const open = useWorld((s) => s.mapPhase === 'open');
    const [hovered, setHovered] = useState<RoomId | null>(null);

    // Pointer cursor over a room, like a link.
    useEffect(() => {
        document.body.style.cursor = open && hovered ? 'pointer' : '';
        return () => {
            document.body.style.cursor = '';
        };
    }, [open, hovered]);

    if (!open) return null;
    return (
        <>
            {ROOM_IDS.map((id) => (
                <RoomPick key={id} id={id} hovered={hovered === id} onHover={setHovered} />
            ))}
        </>
    );
}

function RoomPick({
    id,
    hovered,
    onHover,
}: {
    id: RoomId;
    hovered: boolean;
    onHover: (id: RoomId | null) => void;
}) {
    const room = MAP_ROOMS[id];
    const [x0, z0, x1, z1] = room.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const go = () => useWorld.getState().jumpTo(id);

    const over = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(id);
    };

    return (
        <>
            <mesh
                position={[cx, 0.03, cz]}
                rotation-x={-Math.PI / 2}
                onPointerOver={over}
                onPointerMove={over}
                onPointerOut={() => onHover(null)}
                onClick={(e) => {
                    e.stopPropagation();
                    go();
                }}
            >
                <planeGeometry args={[x1 - x0, z1 - z0]} />
                <meshBasicMaterial
                    color="#e0a56a"
                    transparent
                    opacity={hovered ? 0.32 : 0.07}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <Html position={[cx, 5.4, cz]} center zIndexRange={[20, 0]}>
                <button
                    type="button"
                    onClick={go}
                    onPointerEnter={() => onHover(id)}
                    onPointerLeave={() => onHover(null)}
                    className={`flex flex-col items-center whitespace-nowrap rounded-xl px-4 py-2 text-center backdrop-blur transition ${
                        hovered ? 'bg-accent text-black' : 'bg-panel text-fg'
                    }`}
                >
                    <span className="font-display text-base font-bold">{room.label}</span>
                    {/* the hint only on hover: labels stay small enough not to overlap */}
                    {hovered && <span className="text-xs text-black/70">{room.hint}</span>}
                </button>
            </Html>
        </>
    );
}
