'use client';

import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Block } from '@/world/greybox/Block';
import { Interactable } from '@/world/interaction/Interactable';
import { SeatScreen } from '@/world/seats/SeatScreen';
import { KIOSK } from './layout';

/**
 * The lobby's AI kiosk: a black steel stand with an angled screen and a
 * warm-lit "ask me" strip. Step up to it (E) and the screen becomes a chat
 * (KioskChat) that answers from the portfolio (see app/api/ask).
 *
 * The screen itself is a SeatScreen, the same piece as the desk monitor and
 * the career wall: an idle terminal picture from afar, live HTML up close.
 * SeatScreen places itself in world coordinates, so it sits outside the
 * stand's turned group.
 */
export function Kiosk() {
    const { position, rotationY, head } = KIOSK;
    return (
        <Interactable
            id="lobby-kiosk"
            label="AI kiosk"
            action={{ kind: 'sit', seat: 'lobby-kiosk' }}
        >
            <group position={position} rotation-y={rotationY}>
                <RigidBody type="fixed" colliders={false}>
                    <CuboidCollider args={[0.34, 0.65, 0.34]} position={[0, 0.65, 0]} />
                </RigidBody>
                {/* base plate and column */}
                <mesh position-y={0.02} castShadow receiveShadow>
                    <cylinderGeometry args={[0.32, 0.34, 0.04, 40]} />
                    <meshStandardMaterial color="#1d1e21" roughness={0.45} metalness={0.7} />
                </mesh>
                <Block size={[0.12, 0.94, 0.09]} position={[0, 0.51, -0.04]} surface="metal" />
                {/* the head, tipped back like a lectern; the glass goes on its face */}
                <group position-y={head.y} rotation-x={-head.tilt}>
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[head.width, head.height, head.depth]} />
                        <meshStandardMaterial color="#17181b" roughness={0.4} metalness={0.6} />
                    </mesh>
                    {/* a warm strip along the top edge: the kiosk is on */}
                    <mesh position={[0, head.height / 2 - 0.018, head.depth / 2 + 0.002]}>
                        <planeGeometry args={[head.width - 0.12, 0.008]} />
                        <meshBasicMaterial color={[2.4, 1.5, 0.8]} toneMapped={false} />
                    </mesh>
                </group>
            </group>
            <SeatScreen seat="lobby-kiosk" />
        </Interactable>
    );
}
