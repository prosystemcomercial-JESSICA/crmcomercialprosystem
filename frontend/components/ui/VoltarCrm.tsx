'use client';

// Botão fixo "← CRM" nas telas que abrem fora do menu (TV, Portal Técnico, Cronômetro).
// No iPhone o CRM roda como aplicativo (tela cheia, sem botão voltar do navegador): sem isso a
// pessoa fica presa na tela. Só aparece para quem está logado; a TV aberta pelo link com chave não vê.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, ehSoPortalTecnico } from '@/lib/auth-context';

const TELAS_SOLTAS = ['/tv', '/portal-tecnico', '/cronometro'];

export function VoltarCrm() {
  const pathname = usePathname() || '';
  const { isAuthenticated, user, logout } = useAuth();
  if (!isAuthenticated || !TELAS_SOLTAS.some(t => pathname === t || pathname.startsWith(`${t}/`))) return null;
  // Técnico só tem o Portal Técnico: no lugar de "← CRM", o botão é para sair.
  if (ehSoPortalTecnico(user?.role)) {
    return (
      <button type="button" onClick={() => { logout().finally(() => { window.location.href = '/'; }); }} aria-label="Sair" style={estilo}>
        Sair
      </button>
    );
  }
  return (
    <Link href="/dashboard" aria-label="Voltar para o CRM" style={estilo}>
      ← CRM
    </Link>
  );
}

const estilo: React.CSSProperties = {
  position: 'fixed', left: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 9998,
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
  background: 'rgba(17, 24, 39, .85)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
  boxShadow: '0 4px 14px rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer',
};
