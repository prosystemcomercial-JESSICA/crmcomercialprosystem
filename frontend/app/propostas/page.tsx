'use client';

// Unificado: a antiga tela "Propostas" foi substituída pelo Gerador de Proposta
// (/propostas-comerciais), que concentra todas as melhorias (segmentos, conteúdo
// automático, etc.). Esta rota apenas redireciona para lá — evita divergência
// entre duas telas de proposta.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PropostasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/propostas-comerciais');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-content-bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--t-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>Abrindo o Gerador de Proposta…</p>
      </div>
    </div>
  );
}
