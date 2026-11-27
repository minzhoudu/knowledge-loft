import { brandMark } from './brand-mark';

/** The browser tab icon. 64 px, so it stays sharp on high-density screens (tabs show it at 16–32). */
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
    return brandMark(size.width, true);
}
