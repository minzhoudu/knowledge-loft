import { brandMark } from './brand-mark';

/** The iPhone/iPad home-screen icon ("Add to Home Screen"). iOS rounds the corners itself. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
    return brandMark(size.width, false);
}
