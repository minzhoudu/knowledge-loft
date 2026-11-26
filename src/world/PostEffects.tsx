'use client';

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useState } from 'react';
import { isTouchDevice } from '@/world/player/input';

/**
 * Post-processing: passes over the finished image, like a photo edit.
 *
 * The scene is first rendered into an off-screen image (in HDR, so bright
 * things can be brighter than white), then each effect works on that:
 *
 * 1. N8AO, ambient occlusion: darkens creases, corners and the floor right
 *    under furniture, where surrounding geometry blocks light from reaching.
 *    Real-time lights can't know that on their own; AO estimates it from the
 *    depth buffer by checking, per pixel, how much nearby geometry surrounds
 *    it. This one detail does more for "it's a real room" than anything else.
 * 2. Bloom: things brighter than white (lamp bulbs, the sun) bleed a soft
 *    glow, the way a camera lens and your eye do.
 * 3. Tone mapping (ACES filmic): squeezes the HDR image into what a screen
 *    can show with a film-like roll-off, so a sunlit floor stays textured
 *    instead of clipping to flat white. (AgX, the newer alternative, looked
 *    flat and grey in this warm interior.) Brightness before it is set by
 *    the renderer's exposure (see Experience).
 * 4. SMAA: smooths jagged edges. Hardware MSAA doesn't mix well with the AO
 *    pass, so anti-aliasing happens here, as a cheap image filter, last.
 *
 * Phones get a lighter AO (half resolution, fewer samples).
 */
export function PostEffects() {
    const [light] = useState(isTouchDevice);
    return (
        <EffectComposer multisampling={0}>
            <N8AO
                aoRadius={0.9}
                distanceFalloff={0.6}
                intensity={2.4}
                quality={light ? 'performance' : 'medium'}
                halfRes={light}
            />
            <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.45} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <SMAA />
        </EffectComposer>
    );
}
