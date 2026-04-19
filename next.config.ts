import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  publicExcludes: ['!firestore.googleapis.com/**', '!firebasestorage.googleapis.com/**'],
  buildExcludes: [/firestore\.googleapis\.com/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: '/**' },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: '/**' },
      { protocol: "https", hostname: "**.firebasestorage.app", pathname: '/**' },
      { protocol: "https", hostname: "**.appspot.com", pathname: '/**' },
      { protocol: "https", hostname: "images.unsplash.com", pathname: '/**' },
      { protocol: "https", hostname: "placehold.co", pathname: '/**' },
      { protocol: "https", hostname: "picsum.photos", pathname: '/**' },
      { protocol: "https", hostname: "api.qrserver.com", pathname: '/**' }
    ],
    unoptimized: isDev, // 🛠️ FIX: Disable optimization in local dev to prevent Sharp timeouts/500 errors
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    middlewareClientMaxBodySize: '20mb',
  },
  serverExternalPackages: ["sharp"]
};

// @ts-ignore
const finalConfig = withNextIntl(withPWA(nextConfig));

export default finalConfig;