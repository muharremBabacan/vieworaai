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

const nextConfig: import('next').NextConfig = {
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
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  serverExternalPackages: ["sharp"]
};

// @ts-ignore
const finalConfig = withNextIntl(withPWA(nextConfig));

export default finalConfig;