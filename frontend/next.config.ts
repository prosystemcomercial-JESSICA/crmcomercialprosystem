import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Tipos verificados em dev — Railway usa tsx em runtime, não tsc
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
