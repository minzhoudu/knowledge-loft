import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Let phones/tablets on the home network load dev resources (hot reload, dev
    // chunks) when testing at http://192.168.x.x:3000. Development only.
    allowedDevOrigins: ['192.168.*.*'],
    cacheComponents: true,
    partialPrefetching: true,
    turbopack: {
        rules: {
            '*.css': {
                loaders: ['@tailwindcss/turbopack'],
                as: '*.css',
            },
        },
    },
};

export default nextConfig;
