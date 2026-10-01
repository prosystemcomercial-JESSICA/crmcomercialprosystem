'use client';

// Retornos agendados: todo lead com retorno/recontato combinado (agentes ou equipe),
// em kanban por quando: atrasados, hoje, amanhã, esta semana, mais adiante.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';

type Retorno = { id: string; quando: string; nome: string; empresa: string | null; combinado: string; responsavel: string; agente: boolean; assumida?: boolean; origem: 'proposta' | 'lead frio' | 'equipe'; nota: number | null; conversaId: string | null };

const COLUNAS = [
  { k: 'atrasado', rot: '⚠️ Atrasados', cor: '#dc2626' },
  { k: 'hoje', rot: 'Hoje', cor: '#2563eb' },
  { k: 'amanha', rot: 'Amanhã', cor: '#7c3aed' },
  { k: 'semana', rot: 'Esta semana', cor: '#0d9488' },
  { k: 'depois', rot: 'Mais adiante', cor: '#64748b' },
] as const;
const COR_ORIGEM: Record<string, string> = { proposta: '#2563eb', 'lead frio': '#0d9488', equipe: '#b45309' };

const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
function coluna(iso: string): typeof COLUNAS[number]['k'] {
  const d = new Date(iso), agora = new Date();
  if (d.getTime() < agora.getTime() - 15 * 60000) return 'atrasado';
  const hoje = diaSP(agora), amanha = diaSP(new Date(agora.getTime() + 864e5));
  if (diaSP(d) === hoje) return 'hoje';
  if (diaSP(d) === amanha) return 'amanha';
  return d.getTime() - agora.getTime() < 7 * 864e5 ? 'semana' : 'depois';
}
const quandoTxt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function RetornosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [itens, setItens] = useState<Retorno[] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'proposta' | 'lead frio' | 'equipe'>('todos');

  useEffect(() => { if (!loading && !isAuthenticated) router.push('/'); }, [loading, isAuthenticated, router]);
  const carregar = useCallback(() => apiClient.getRetornos().then(r => setItens(r.data.data)).catch(() => setItens([])), []);
  useEffect(() => { if (!isAuthenticated) return; carregar(); const t = setInterval(carregar, 60_000); return () => clearInterval(t); }, [isAuthenticated, carregar]);

  const lista = (itens || []).filter(i => filtro === 'todos' || i.origem === filtro);

  return (
    <DashboardLayout>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Retornos agendados</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Todo lead com retorno ou recontato combinado: pelos agentes (propostas e leads frios) e pela equipe.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['todos', 'proposta', 'lead frio', 'equipe'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: filtro === f ? 'var(--t-primary)' : 'var(--t-card-bg)', color: filtro === f ? '#fff' : 'var(--t-text-secondary)' }}>
                {f === 'todos' ? 'Todos' : f === 'proposta' ? 'Propostas' : f === 'lead frio' ? 'Leads frios' : 'Equipe'}
              </button>
            ))}
          </div>
        </div>

        {itens === null ? <p style={{ color: 'var(--t-text-muted)' }}>Carregando…</p> : (
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(250px, 1fr)', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {COLUNAS.map(c => {
              const cards = lista.filter(i => coluna(i.quando) === c.k);
              return (
                <div key={c.k} style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 300 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: c.cor }} />
                    <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{c.rot}</b>
                    <span style={{ marginLeft: 'auto', fontWeight: 800, color: c.cor }}>{cards.length}</span>
                  </div>
                  {cards.map(i => (
                    <div key={i.id} style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderLeft: `3px solid ${c.cor}`, borderRadius: 10, padding: 10, display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{i.nome}</b>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, height: 'fit-content', color: '#fff', background: COR_ORIGEM[i.origem] }}>{i.origem}</span>
                      </div>
                      {i.empresa && i.empresa !== i.nome && <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{i.empresa}</span>}
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.cor }}>📅 {quandoTxt(i.quando)}</span>
                      <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{i.combinado}</span>
                      {i.assumida && <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>👤 Você assumiu: o retorno é seu (o agente não chama)</span>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{i.agente ? '🤖' : '👤'} {i.responsavel}{i.nota != null ? ` · nota ${i.nota}` : ''}</span>
                        {i.conversaId && (
                          <button onClick={() => router.push(`/whatsapp?conversa=${i.conversaId}`)}
                            style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-primary)', cursor: 'pointer' }}>Abrir conversa</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!cards.length && <span style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center', marginTop: 20 }}>Nenhum retorno</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
