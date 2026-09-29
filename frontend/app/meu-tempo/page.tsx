'use client';

// Relatório "Meu tempo": horas trabalhadas por dia (cronômetro), tempo por tarefa,
// pausas por motivo e a lista de tudo o que foi cronometrado.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { ControlesCronometro } from '@/components/cronometro/Cronometro';

type Rel = {
  dias: number; total_segundos: number; quantidade: number;
  por_dia: { dia: string; segundos: number }[];
  por_titulo: { titulo: string; segundos: number }[];
  pausas: { motivo: string; vezes: number }[];
  lista: { id: string; titulo: string; status: string; segundos: number; iniciado_em: string; finalizado_em: string | null; resultado: string | null; pausas: (string | null)[] }[];
};
const horas = (s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`; };
const dm = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const quando = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function MeuTempoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [dias, setDias] = useState(30);
  const [r, setR] = useState<Rel | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => { if (!loading && !isAuthenticated) router.push('/'); }, [loading, isAuthenticated, router]);
  useEffect(() => { if (isAuthenticated) apiClient.cronometroRelatorio(dias).then(x => setR(x.data.data)).catch(() => {}); }, [isAuthenticated, dias, v]);
  if (loading || !isAuthenticated) return null;
  const maxDia = Math.max(1, ...(r?.por_dia || []).map(d => d.segundos));
  const maxTit = Math.max(1, ...(r?.por_titulo || []).map(d => d.segundos));
  const card: React.CSSProperties = { padding: 14, borderRadius: 12, minWidth: 0 };

  return (
    <DashboardLayout>
      <div className="ios-tela" style={{ display: 'grid', gap: 12 }}>
        <div className="ios-topo">
          <div>
            <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Meu tempo</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>O que você cronometrou: horas por dia, por tarefa e as pausas.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 10 }}>
          <div className="ps-card" style={card}><b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>⏱ Cronômetro</b><div style={{ marginTop: 8 }}><ControlesCronometro aoMudar={() => setV(x => x + 1)} /></div></div>
          <div className="ps-card" style={card}>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)', fontWeight: 600 }}>Tempo total ({dias} dias)</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{r ? horas(r.total_segundos) : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{r?.quantidade ?? 0} cronômetros · média de {r && r.quantidade ? horas(Math.round(r.total_segundos / Math.max(1, r.por_dia.filter(d => d.segundos).length))) : '—'} por dia trabalhado</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setDias(d)} style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: dias === d ? 'var(--t-primary)' : 'var(--t-card-bg)', color: dias === d ? '#fff' : 'var(--t-text-secondary)' }}>{d} dias</button>
              ))}
            </div>
          </div>
        </div>

        <div className="ps-card" style={card}>
          <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Horas por dia</b>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, marginTop: 10 }}>
            {(r?.por_dia || []).map(d => (
              <div key={d.dia} title={`${dm(d.dia)}: ${horas(d.segundos)}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${(d.segundos / maxDia) * 100}%`, minHeight: d.segundos ? 2 : 0, background: '#2563eb', borderRadius: '3px 3px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
            <span>{r?.por_dia[0] ? dm(r.por_dia[0].dia) : ''}</span><span>hoje</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 10 }}>
          <div className="ps-card" style={card}>
            <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Tempo por tarefa</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {(r?.por_titulo || []).slice(0, 12).map(t => (
                <div key={t.titulo} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 38%) 1fr auto', gap: 8, alignItems: 'center' }} title={`${t.titulo}: ${horas(t.segundos)}`}>
                  <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
                  <div style={{ height: 14, background: 'var(--t-content-bg)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(t.segundos / maxTit) * 100}%`, minWidth: 4, height: '100%', background: '#16a34a', borderRadius: 4 }} /></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{horas(t.segundos)}</span>
                </div>
              ))}
              {!r?.por_titulo.length && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada cronometrado no período. Comece pelo cronômetro acima.</span>}
            </div>
          </div>
          <div className="ps-card" style={card}>
            <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Pausas por motivo</b>
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {(r?.pausas || []).slice(0, 12).map(p => (
                <div key={p.motivo} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)', paddingBottom: 6 }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>⏸ {p.motivo}</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.vezes}×</b>
                </div>
              ))}
              {!r?.pausas.length && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma pausa no período.</span>}
            </div>
          </div>
        </div>

        <div className="ps-card" style={card}>
          <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>Tudo o que foi cronometrado</b>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--t-text-muted)', fontSize: 12 }}>{['Tarefa', 'Início', 'Tempo', 'Pausas', 'Situação', 'Como terminou'].map(h => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>{(r?.lista || []).map(x => (
                <tr key={x.id} style={{ borderTop: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{x.titulo}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{quando(x.iniciado_em)}</td>
                  <td style={{ padding: '6px 8px', fontVariantNumeric: 'tabular-nums' }}>{horas(x.segundos)}</td>
                  <td style={{ padding: '6px 8px' }}>{x.pausas.filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{x.status === 'FINALIZADO' ? '✅ Finalizado' : x.status === 'PAUSADO' ? '⏸ Pausado' : '▶ Rodando'}</td>
                  <td style={{ padding: '6px 8px' }}>{x.resultado || '—'}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
