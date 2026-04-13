import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  middlewareClientMaxBodySize: '20mb',
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
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  serverExternalPackages: ["sharp"]
};

// @ts-ignore
const finalConfig = withNextIntl(withPWA(nextConfig as any));

// Force the properties again on the experimental object to prevent them from being stripped by old plugins
if (!finalConfig.experimental) finalConfig.experimental = {};
finalConfig.experimental.serverActions = {
  bodySizeLimit: '20mb'
};
// Add core config after plugins
finalConfig.middlewareClientMaxBodySize = '20mb';
// External packages usually work better at top level or experimental depending on version
finalConfig.serverExternalPackages = ["sharp"];

export default finalConfig;