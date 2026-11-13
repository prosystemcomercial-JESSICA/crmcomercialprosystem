'use client';

// A tela "Aprovar" saiu do menu em 13/11/2026 (pedido da Jessica): desde 12/11 o Rafael decide as mensagens dos
// agentes e as campanhas em até 2 minutos, então ela ficava sempre vazia. O histórico do que ele decidiu está na aba
// "Decisões" do painel do Rafael (Escritório virtual). Este endereço só redireciona (avisos antigos no celular).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AprovarPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/escritorio?rafael=decisoes'); }, [router]);
  return null;
}
