'use client';

// Endereço curto da TV (fácil de digitar no controle): /t/<código> → TV do Escritório com a chave.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Aberta pelo IP (monitor/TV cujo navegador não abre o https do domínio): busca os dados no mesmo IP, porta da API.
const API_URL = typeof window !== 'undefined' && /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:3011`
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AtalhoTvPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [erro, setErro] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/painel-tv/atalho/${encodeURIComponent(codigo)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => window.location.replace(`/tv/escritorio?chave=${encodeURIComponent(j.data.chave)}`))
      .catch(() => setErro(true));
  }, [codigo]);
  return (
    <div style={{ minHeight: '100vh', background: '#0D2238', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 22, textAlign: 'center', padding: 24 }}>
      {erro ? 'Código inválido. Confira o endereço em Configurações › Painel da TV.' : 'Abrindo a TV do Escritório…'}
    </div>
  );
}
