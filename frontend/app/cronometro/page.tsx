'use client';

// Janelinha destacável do cronômetro (aberta pelo botão "↗ Destacar"): fica ao lado,
// mesmo quando você usa outros programas. Sincroniza com o CRM aberto.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ControlesCronometro } from '@/components/cronometro/Cronometro';

export default function JanelaCronometro() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !isAuthenticated) router.push('/'); }, [loading, isAuthenticated, router]);
  useEffect(() => { document.title = '⏱ Cronômetro · Prosystem'; }, []);
  if (loading || !isAuthenticated) return null;
  return (
    <main style={{ minHeight: '100dvh', padding: 14, background: 'var(--t-content-bg)', display: 'grid', alignContent: 'start', gap: 10 }}>
      <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>⏱ Cronômetro</b>
      <ControlesCronometro compacto />
      <a href="/meu-tempo" target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--t-primary)' }}>Ver meu tempo ›</a>
    </main>
  );
}
