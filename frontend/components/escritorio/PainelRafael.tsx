'use client';

// Painel do Rafael (especialista em vendas de software): documentos que viram parâmetro do setor.
// Para aprovar: POPs, processos, exemplos, dicas, revisões de conversas e a abordagem inicial
// de cada agente (ao aprovar a abordagem, o agente passa a usar).

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Doc = { id: string; tipo: string; titulo: string; conteudo: string; agente_alvo: string | null; status: string; versao: number; created_at: string };

const TIPOS: { k: string; r: string }[] = [
  { k: 'PENDENTES', r: '📝 Para aprovar' }, { k: 'ABORDAGEM', r: '🎯 Abordagens' }, { k: 'ALERTA', r: '👀 Revisões' }, { k: 'CONCORRENCIA', r: '🔍 Concorrência' },
  { k: 'POP', r: '📋 POPs' }, { k: 'PROCESSO', r: '🔁 Processos' }, { k: 'EXEMPLO', r: '💬 Exemplos' }, { k: 'DICA', r: '💡 Dicas' },
];
const COR = '#1e40af';

/** Markdown simples → blocos legíveis (títulos, listas, negrito), sem biblioteca. */
function Texto({ md }: { md: string }) {
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 13, color: 'var(--t-text-secondary)', overflowWrap: 'anywhere' }}>
      {md.split('\n').map((l, i) => {
        const neg = (t: string) => t.split(/\*\*(.+?)\*\*/g).map((p, k) => k % 2 ? <b key={k} style={{ color: 'var(--t-text-primary)' }}>{p}</b> : <span key={k}>{p}</span>);
        if (/^#{1,3} /.test(l)) return <b key={i} style={{ fontSize: 14, color: 'var(--t-text-primary)', marginTop: 6 }}>{l.replace(/^#+ /, '')}</b>;
        if (/^\s*[-*] /.test(l)) return <div key={i} style={{ paddingLeft: l.startsWith('  ') ? 28 : 12 }}>• {neg(l.replace(/^\s*[-*] /, ''))}</div>;
        if (/^\s*\d+\. /.test(l)) return <div key={i} style={{ paddingLeft: 12 }}>{neg(l.trim())}</div>;
        return l.trim() ? <div key={i}>{neg(l)}</div> : <div key={i} style={{ height: 4 }} />;
      })}
    </div>
  );
}

export default function PainelRafael() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [andamento, setAndamento] = useState<string[]>([]);
  const [aba, setAba] = useState('PENDENTES');
  const [aberto, setAberto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tema, setTema] = useState('');
  const carregar = useCallback(() => apiClient.rafaelDocs().then(r => { setDocs(r.data.data.docs); setAndamento(r.data.data.em_andamento || []); }).catch(() => setDocs([])), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const acao = async (fn: () => Promise<any>) => { try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); } carregar(); };
  const baixar = async () => {
    try {
      const r = await apiClient.rafaelCaderno();
      const url = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = url; a.download = 'caderno-do-rafael.md'; a.click(); URL.revokeObjectURL(url);
    } catch { setMsg('Não foi possível baixar o caderno.'); }
  };
  const lista = (docs || []).filter(d => aba === 'PENDENTES' ? d.status === 'PROPOSTO' : d.tipo === aba);
  const pendentes = (docs || []).filter(d => d.status === 'PROPOSTO').length;
  const btn = (fundo: string, cor = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: cor, fontSize: 13, fontWeight: 700, cursor: 'pointer' });

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${COR}`, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🧠 Rafael · Especialista em vendas de software</b>
          <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Estuda vendas (quartas), revisa as conversas (seg–sex 17h) e propõe processos, POPs e a abordagem inicial. O que você aprova vira parâmetro do setor.</p>
        </div>
        <button onClick={baixar} style={btn('var(--t-content-bg)', COR)}>⬇ Caderno do Rafael</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => acao(() => apiClient.rafaelAbordagem())} disabled={andamento.includes('abordagem')} style={btn(COR)}>🎯 {andamento.includes('abordagem') ? 'Preparando abordagem…' : 'Propor nova abordagem inicial'}</button>
        <button onClick={() => acao(() => apiClient.rafaelRevisar())} disabled={andamento.includes('revisao')} style={btn('#0f766e')}>👀 {andamento.includes('revisao') ? 'Revisando…' : 'Revisar conversas agora'}</button>
        <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Tema para estudar (opcional)" maxLength={200}
          style={{ flex: '1 1 200px', minHeight: 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 14 }} />
        <button onClick={() => acao(() => apiClient.rafaelEstudar(tema.trim() || null))} disabled={andamento.includes('estudo')} style={btn('#7c3aed')}>📚 {andamento.includes('estudo') ? 'Estudando…' : 'Estudar agora'}</button>
        <button onClick={() => acao(() => apiClient.oliviaConcorrentes(tema.trim() || null))} disabled={andamento.includes('concorrentes')} style={btn('#9333ea')} title="A Olívia pesquisa a concorrência e passa para o Rafael">🔍 {andamento.includes('concorrentes') ? 'Olívia pesquisando…' : 'Olívia: pesquisar concorrentes'}</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
        {TIPOS.map(t => (
          <button key={t.k} role="tab" aria-selected={aba === t.k} onClick={() => setAba(t.k)}
            style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: aba === t.k ? COR : 'var(--t-card-bg)', color: aba === t.k ? '#fff' : 'var(--t-text-secondary)' }}>
            {t.r}{t.k === 'PENDENTES' && pendentes ? ` (${pendentes})` : ''}
          </button>
        ))}
      </div>

      {docs === null ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</div> : lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>{aba === 'PENDENTES' ? 'Nada esperando sua aprovação.' : 'Nada aqui ainda. Use os botões acima para o Rafael trabalhar.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 0 }}>
              <button onClick={() => setAberto(a => a === d.id ? null : d.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: COR, flexShrink: 0 }}>{d.tipo}</span>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{d.titulo}</b>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>v{d.versao} · {d.status === 'APROVADO' ? '✅ aprovado' : '📝 para aprovar'} {aberto === d.id ? '▲' : '▼'}</span>
              </button>
              {aberto === d.id && <Texto md={d.conteudo} />}
              {d.status === 'PROPOSTO' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => acao(() => apiClient.rafaelDecidir(d.id, true))} style={btn('#16a34a')}>✅ Aprovar{d.tipo === 'ABORDAGEM' ? ' e aplicar no agente' : ''}</button>
                  <button onClick={() => acao(() => apiClient.rafaelDecidir(d.id, false))} style={btn('var(--t-content-bg)', '#dc2626')}>Arquivar</button>
                  {aberto !== d.id && <button onClick={() => setAberto(d.id)} style={btn('var(--t-content-bg)', COR)}>Ler</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
