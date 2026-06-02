'use client';

// Unificado: a antiga tela "Propostas" foi substituída pelo Gerador de Proposta
// (/propostas-comerciais), que concentra todas as melhorias (segmentos, conteúdo
// automático, etc.). Esta rota apenas redireciona para lá — evita divergência
// entre duas telas de proposta.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PropostasRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/propostas-comerciais');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#F4F7FB' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#7AAACB' }}>Abrindo o Gerador de Proposta…</p>
      </div>
    </div>
  );
}
