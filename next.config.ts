import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Tüm kökenlere izin vererek CORS hatasını kökten çözeriz
    allowedDevOrigins: ["*"] 
  },
};

export default nextConfig;
