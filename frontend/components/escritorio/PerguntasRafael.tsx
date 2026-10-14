'use client';

// Perguntas para você (14/10/2026): o que o Rafael precisa que a Jessica confirme e as dúvidas de clientes que
// nenhum agente soube responder. A resposta dela vale na hora para todos os agentes (mural + material oficial).

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Aberta = { id: string; tipo: 'PERGUNTA' | 'DUVIDA'; de_nome: string; assunto: string; texto: string; ref: string | null; created_at: string; vezes: number };
type Respondida = { id: string; pergunta: string; resposta: string; created_at: string };

const COR = '#1e40af';
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function PerguntasRafael({ onTotal }: { onTotal?: (n: number) => void }) {
  const [abertas, setAbertas] = useState<Aberta[] | null>(null);
  const [respondidas, setRespondidas] = useState<Respondida[]>([]);
  const [juntando, setJuntando] = useState(false);
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [verRespondidas, setVerRespondidas] = useState(false);

  const carregar = useCallback(() => apiClient.rafaelPerguntas().then(r => {
    const d = r.data.data;
    setAbertas(d.abertas); setRespondidas(d.respondidas || []); setJuntando(!!d.em_andamento); onTotal?.(d.abertas.length);
  }).catch(() => setAbertas([])), [onTotal]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const acao = async (id: string, fn: () => Promise<any>) => {
    setEnviando(id);
    try { const r = await fn(); setMsg(r.data?.message || 'Pronto.'); setTexto(t => ({ ...t, [id]: '' })); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); }
    finally { setEnviando(null); carregar(); }
  };
  const btn = (fundo: string, cor = '#fff'): React.CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: fundo, color: cor, fontSize: 13, fontWeight: 700, cursor: 'pointer' });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <p style={{ flex: '1 1 260px', fontSize: 13, color: 'var(--t-text-secondary)' }}>
          O que o Rafael precisa que você confirme e as dúvidas de clientes que nenhum agente soube responder. Sua resposta vale na hora para todos os agentes.
        </p>
        <button onClick={async () => { setJuntando(true); try { const r = await apiClient.rafaelLevantarPerguntas(); setMsg(r.data?.message); } catch { setMsg('Não deu certo.'); } setTimeout(carregar, 60_000); }}
          disabled={juntando} style={btn('var(--t-content-bg)', COR)}>{juntando ? 'Rafael juntando as perguntas…' : 'Rafael: juntar perguntas dos documentos'}</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{msg}</div>}

      {abertas === null ? <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</div> : abertas.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma pergunta esperando você.</div>
      ) : abertas.map(p => (
        <div key={p.id} style={{ border: '1px solid var(--t-card-border)', borderLeft: `3px solid ${p.tipo === 'PERGUNTA' ? COR : '#d97706'}`, borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
            <b style={{ color: p.tipo === 'PERGUNTA' ? COR : '#d97706' }}>{p.tipo === 'PERGUNTA' ? 'Pergunta do Rafael' : `Dúvida de cliente · ${p.de_nome}`}</b>
            {p.vezes > 1 && <span style={{ color: 'var(--t-text-muted)' }}>apareceu {p.vezes} vezes</span>}
            <span style={{ marginLeft: 'auto', color: 'var(--t-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{quando(p.created_at)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)', overflowWrap: 'anywhere' }}>{p.assunto}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', overflowWrap: 'anywhere' }}>{p.texto}</div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Sua resposta</span>
            <textarea value={texto[p.id] || ''} onChange={e => setTexto(t => ({ ...t, [p.id]: e.target.value }))} rows={3} maxLength={4000}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && (texto[p.id] || '').trim().length >= 2) acao(p.id, () => apiClient.rafaelResponder(p.id, texto[p.id])); }}
              placeholder="Escreva como explicaria para a equipe. Ctrl+Enter envia."
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 14, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => acao(p.id, () => apiClient.rafaelResponder(p.id, texto[p.id] || ''))} disabled={enviando === p.id || (texto[p.id] || '').trim().length < 2} style={{ ...btn('#16a34a'), opacity: (texto[p.id] || '').trim().length < 2 ? 0.5 : 1 }}>
              {enviando === p.id ? 'Enviando…' : 'Responder'}
            </button>
            <button onClick={() => acao(p.id, () => apiClient.rafaelDispensar(p.id))} disabled={enviando === p.id} style={btn('var(--t-content-bg)', '#64748b')}>Não se aplica</button>
            {p.ref && !p.ref.startsWith('doc:') && <a href={`/whatsapp?conversa=${p.ref}`} style={{ ...btn('var(--t-content-bg)', COR), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Abrir conversa</a>}
          </div>
        </div>
      ))}

      {respondidas.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <button onClick={() => setVerRespondidas(v => !v)} aria-expanded={verRespondidas} style={{ justifySelf: 'start', background: 'none', border: 'none', color: COR, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            {verRespondidas ? '▲' : '▼'} Já respondidas ({respondidas.length})
          </button>
          {verRespondidas && respondidas.map(r => (
            <div key={r.id} style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 6, display: 'grid', gap: 2, fontSize: 13 }}>
              <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>{quando(r.created_at)}</span>
              <b style={{ color: 'var(--t-text-primary)', overflowWrap: 'anywhere' }}>{r.pergunta}</b>
              <span style={{ color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.resposta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
