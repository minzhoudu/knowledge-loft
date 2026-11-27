import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Inter } from 'next/font/google';
import { about } from '@/content';
import './globals.css';

// next/font downloads these at build time and serves them from our own domain.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'] });
const plexMono = IBM_Plex_Mono({
    variable: '--font-plex-mono',
    subsets: ['latin'],
    weight: ['400', '500'],
});

/**
 * The site's public address, for links that must be absolute (the preview
 * image above all). SITE_URL if set (a custom domain); otherwise, on
 * Vercel, the project's production address, which Vercel provides at build
 * time; otherwise the dev server.
 */
const siteUrl =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000');

const title = `${about.name} · Studio`;
const description = `${about.headline} in ${about.location}. Walk through my portfolio as a 3D studio loft, or read the one-page quick view.`;

// The preview image itself comes from opengraph-image.tsx (Next.js adds its tags).
export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
        type: 'website',
        url: '/',
        siteName: about.name,
        title,
        description,
        locale: 'en_GB',
    },
    twitter: { card: 'summary_large_image', title, description },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html
            lang="en"
            className={`${inter.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
        >
            <body className="min-h-full">{children}</body>
        </html>
    );
}
