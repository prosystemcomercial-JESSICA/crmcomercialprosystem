'use client';

// Painel da Mila (Customer Success): o trabalho dela é RETER clientes e cuidar da experiência.
// Ela estuda retenção (toda segunda), escreve POPs, procedimentos e documentos de CS para
// a gestão aprovar. Separado do Rafael: cada agente com a sua responsabilidade.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Texto } from './PainelRafael';

type Doc = { id: string; tipo: string; titulo: string; conteudo: string; status: string; versao: number; created_at: string };
const COR = '#0e7490';
const ABAS: { k: string; r: string }[] = [
  { k: 'PENDENTES', r: '📝 Para aprovar' }, { k: 'POP', r: '📋 POPs' }, { k: 'PROCESSO', r: '🔁 Procedimentos' }, { k: 'EXEMPLO', r: '💬 Mensagens' }, { k: 'DICA', r: '💡 Dicas' },
];

export default function PainelMila() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [andamento, setAndamento] = useState<string[]>([]);
  const [aba, setAba] = useState('PENDENTES');
  const [aberto, setAberto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tema, setTema] = useState('');
  const carregar = useCallback(() => apiClient.rafaelDocs('mila').then(r => { setDocs(r.data.data.docs); setAndamento(r.data.data.em_andamento || []); }).catch(() => setDocs([])), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const acao = async (fn: () => Promise<any>) => { try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); } carregar(); };
  const lista = (docs || []).filter(d => aba === 'PENDENTES' ? d.status === 'PROPOSTO' : d.tipo === aba);
  const pendentes = (docs || []).filter(d => d.status === 'PROPOSTO').length;
  const aprovados = (docs || []).filter(d => d.status === 'APROVADO').length;
  const btn = (fundo: string, cor = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: cor, fontSize: 13, fontWeight: 700, cursor: 'pointer' });

  return (
    <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${COR}`, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>💚 Mila · Customer Success</b>
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
          Responsável por reter clientes e pela experiência deles. Estuda retenção toda segunda de manhã, parte dos motivos reais de saída da base e escreve POPs, procedimentos e mensagens de CS. O que você aprova vale para toda a equipe.
          {' '}<b style={{ color: COR }}>{aprovados}</b> aprovado(s).
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Tema de CS para estudar (opcional): onboarding, risco de cancelamento…" maxLength={200}
          style={{ flex: '1 1 260px', minHeight: 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 14 }} />
        <button onClick={() => acao(() => apiClient.milaEstudar(tema.trim() || null))} disabled={andamento.includes('mila')} style={btn(COR)}>📚 {andamento.includes('mila') ? 'Estudando…' : 'Estudar retenção agora'}</button>
      </div>
      {msg && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="tablist">
        {ABAS.map(t => (
          <button key={t.k} role="tab" aria-selected={aba === t.k} onClick={() => setAba(t.k)}
            style={{ minHeight: 32, padding: '0 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: aba === t.k ? COR : 'var(--t-card-bg)', color: aba === t.k ? '#fff' : 'var(--t-text-secondary)' }}>
            {t.r}{t.k === 'PENDENTES' && pendentes ? ` (${pendentes})` : ''}
          </button>
        ))}
      </div>

      {docs === null ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</div> : lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>{aba === 'PENDENTES' ? 'Nada esperando sua aprovação.' : 'Nada aqui ainda. Clique em "Estudar retenção agora".'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {lista.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 0 }}>
              <button onClick={() => setAberto(a => a === d.id ? null : d.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: COR, flexShrink: 0 }}>{d.tipo}</span>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{d.titulo.replace(/^CS · /, '')}</b>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t-text-muted)', flexShrink: 0 }}>v{d.versao} · {d.status === 'APROVADO' ? '✅ aprovado' : '📝 para aprovar'} {aberto === d.id ? '▲' : '▼'}</span>
              </button>
              {aberto === d.id && <Texto md={d.conteudo} />}
              {d.status === 'PROPOSTO' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => acao(() => apiClient.rafaelDecidir(d.id, true))} style={btn('#16a34a')}>✅ Aprovar</button>
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
