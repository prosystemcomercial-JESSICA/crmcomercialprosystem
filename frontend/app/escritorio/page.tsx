'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import SalaIsometrica from '@/components/escritorio/SalaIsometrica';

// Escritório virtual: os agentes do assistente como uma equipe numa sala. Somente
// leitura; atualiza a cada 30 s com o que cada agente fez hoje.

type Agente = {
  id: string; nome: string; funcao: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado';
  ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number | string }[]; observacao?: string;
};
const ROTULO_STATUS = { trabalhando: 'Trabalhando agora', parado: 'Parado', desligado: 'Desligado' } as const;
const COR_STATUS = { trabalhando: '#16a34a', parado: '#ca8a04', desligado: '#64748b' } as const;

const haQuanto = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function EscritorioPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[] | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const carregar = useCallback(() => {
    apiClient.getEscritorio()
      .then(r => { setAgentes(r.data.data.agentes); setAtualizado(r.data.data.gerado_em); setErro(false); })
      .catch(() => setErro(true));
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    carregar();
    const i = setInterval(carregar, 30_000);
    return () => clearInterval(i);
  }, [isAuthenticated, carregar]);

  const trabalhando = agentes?.filter(a => a.status === 'trabalhando').length ?? 0;
  const escolhido = agentes?.find(a => a.id === sel) || null;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 0 40px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Escritório virtual</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>A equipe de agentes do CRM trabalhando no comercial. Clique em uma mesa para ver o dia de cada um.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>
              👥 {agentes?.length ?? 8} agentes · <span style={{ color: '#16a34a' }}>{trabalhando} trabalhando</span>
            </span>
            {atualizado && <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>atualizado {haQuanto(atualizado)}</span>}
          </div>
        </div>

        {erro && <p style={{ color: '#dc2626', fontSize: 13 }}>Não foi possível carregar o escritório agora. Tentando de novo em 30 segundos.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
          <div style={{ background: 'linear-gradient(180deg, #dbe7f3 0%, #eef3f8 100%)', borderRadius: 16, border: '1px solid var(--t-card-border)', padding: '8px 8px 0', overflow: 'hidden' }}>
            {agentes ? <SalaIsometrica agentes={agentes} selecionado={sel} onSelecionar={setSel} /> : <p style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Abrindo o escritório…</p>}
          </div>

          {escolhido && (
            <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${escolhido.cor}`, borderRadius: 14, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>{escolhido.nome}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: COR_STATUS[escolhido.status] }}>● {ROTULO_STATUS[escolhido.status]}</span>
                <button onClick={() => setSel(null)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{escolhido.funcao}</p>
              <p style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>
                {escolhido.ultima ? <>Última ação: <b>{escolhido.ultima.texto}</b> <span style={{ color: 'var(--t-text-muted)' }}>({haQuanto(escolhido.ultima.em)})</span></> : 'Ainda não trabalhou.'}
              </p>
              {escolhido.observacao && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{escolhido.observacao}</p>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {agentes?.map(a => (
              <button key={a.id} onClick={() => setSel(a.id)} style={{
                textAlign: 'left', background: 'var(--t-card-bg)', border: `1px solid ${sel === a.id ? a.cor : 'var(--t-card-border)'}`, borderRadius: 12, padding: 14,
                display: 'grid', gap: 6, cursor: 'pointer', color: 'var(--t-text-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: a.cor }} />
                  <b style={{ fontSize: 14 }}>{a.nome}</b>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: COR_STATUS[a.status] }}>● {ROTULO_STATUS[a.status]}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{a.funcao}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {a.numeros.map(n => (
                    <span key={n.rotulo} style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                      <b style={{ fontSize: 15, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n.valor}</b> {n.rotulo}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.ultima ? `${a.ultima.texto} · ${haQuanto(a.ultima.em)}` : a.observacao || 'Aguardando a primeira tarefa'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
