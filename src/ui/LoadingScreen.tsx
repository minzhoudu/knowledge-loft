import Link from 'next/link';
import type { Ref } from 'react';
import { about } from '@/content';

/**
 * The loading screen, as a picture: shown while the 3D code downloads
 * (WorldClient) and while the world loads its furniture and textures
 * (LoadingCover). Both draw this same screen, so one hands over to the
 * other without a flicker.
 *
 * Pass `barRef` and the caller fills the bar itself (by setting its
 * transform, see LoadingCover); without it, there's nothing to measure yet
 * and the bar shimmers instead.
 */
export function LoadingScreen({
    barRef,
    status,
    leaving = false,
}: {
    barRef?: Ref<HTMLDivElement>;
    status: string;
    /** Fading out: the world is ready underneath. */
    leaving?: boolean;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy={!leaving}
            className={`fixed inset-0 z-50 grid place-items-center bg-[#0f0e0d] px-6 text-[#ece8e2] transition-opacity duration-700 ${
                leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
        >
            <div className="flex w-full max-w-xs flex-col items-center gap-6 text-center">
                <div className="flex flex-col items-center gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#a39d94]">
                        Studio loft
                    </p>
                    <p className="font-display text-2xl font-bold">{about.name}</p>
                </div>
                <div className="flex w-full flex-col gap-2.5">
                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                        {barRef && (
                            <div
                                ref={barRef}
                                className="h-full origin-left rounded-full bg-[#e0a56a]"
                                style={{ transform: 'scaleX(0)' }}
                            />
                        )}
                        {/* the glint: on its own while there's nothing to measure, over the bar after */}
                        <div
                            aria-hidden
                            className={`absolute inset-y-0 left-0 w-1/3 animate-[loading-shimmer_1.4s_ease-in-out_infinite] rounded-full ${
                                barRef
                                    ? 'bg-gradient-to-r from-transparent via-white/45 to-transparent'
                                    : 'bg-[#e0a56a]'
                            }`}
                        />
                    </div>
                    <p className="font-mono text-xs text-[#a39d94]">{status}</p>
                </div>
                <Link
                    href="/quick"
                    className="text-sm text-[#a39d94] underline-offset-4 transition hover:text-[#e0a56a] hover:underline"
                >
                    In a hurry? See the quick view
                </Link>
            </div>
        </div>
    );
}
