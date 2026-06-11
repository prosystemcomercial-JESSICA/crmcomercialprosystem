import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true }, // runtime usa o build do Next; type-check separado
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
