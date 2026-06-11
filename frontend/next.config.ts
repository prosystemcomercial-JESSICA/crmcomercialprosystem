import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Tipos verificados em dev — Railway usa tsx em runtime, não tsc
    ignoreBuildErrors: true,
  },
  // Evita que o navegador sirva HTML antigo em cache após um deploy (causa do
  // "botão não aparece" até dar Ctrl+Shift+R). Os assets com hash (/_next/static)
  // continuam cacheáveis; só o HTML das páginas é sempre revalidado.
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }] },
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default nextConfig;
