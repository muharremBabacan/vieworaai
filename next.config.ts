import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https" as const, hostname: "firebasestorage.googleapis.com", pathname: '/**' },
      { protocol: "https" as const, hostname: "**.firebasestorage.app", pathname: '/**' },
      { protocol: "https" as const, hostname: "**.appspot.com", pathname: '/**' },
      { protocol: "https" as const, hostname: "images.unsplash.com", pathname: '/**' },
      { protocol: "https" as const, hostname: "placehold.co", pathname: '/**' },
      { protocol: "https" as const, hostname: "picsum.photos", pathname: '/**' },
      { protocol: "https" as const, hostname: "api.qrserver.com", pathname: '/**' }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
};

export default withNextIntl(nextConfig as any);
