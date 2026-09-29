import type { MetadataRoute } from 'next';

// Instalação na tela inicial do celular ("Adicionar à Tela de Início"): abre em tela cheia,
// sem a barra do navegador, direto no WhatsApp (primeira aba do app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRM Comercial Prosystem',
    short_name: 'CRM Prosystem',
    description: 'Gestão comercial da Prosystem Sistemas',
    start_url: '/whatsapp',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f2f2f7',
    theme_color: '#f9f9f9',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
