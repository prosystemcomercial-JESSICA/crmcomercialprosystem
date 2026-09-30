'use client';

// Sala de treinamento: o Rafael treinando um agente (Luiz Felipe, Julio, Caroline).
// Mostra a conversa do último treinamento fala a fala (como se estivesse acontecendo)
// e avisa a página para os dois aparecerem conversando na sala do escritório.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Fala = { quem: 'rafael' | 'agente'; texto: string };
type Treino = { id: string; titulo: string; agente_alvo: string; status: string; dialogo: Fala[]; regras: string[]; created_at: string };
export type FalaNaSala = { agente: string; quem: 'rafael' | 'agente'; texto: string } | null;

const NOME: Record<string, string> = { luiz_felipe: 'Luiz Felipe', julio: 'Julio', caroline: 'Caroline' };
const COR: Record<string, string> = { rafael: '#1e40af', luiz_felipe: '#2563eb', julio: '#0d9488', caroline: '#be123c' };
const MS_POR_FALA = 4200;

export default function SalaTreinamento({ onFala }: { onFala?: (f: FalaNaSala) => void }) {
  const [lista, setLista] = useState<Treino[] | null>(null);
  const [andamento, setAndamento] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [visiveis, setVisiveis] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [verRegras, setVerRegras] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => apiClient.rafaelTreinamentos()
    .then(r => { setLista(r.data.data.treinamentos); setAndamento(r.data.data.em_andamento || []); })
    .catch(() => setLista([])), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const t = lista?.[idx] || null;
  const total = t?.dialogo.length || 0;

  // Reprodução fala a fala: "digitando…" e depois a fala; a sala mostra o balão de quem fala.
  useEffect(() => {
    if (!tocando || !t) return;
    if (visiveis >= total) { setTocando(false); onFala?.(null); return; }
    setDigitando(true);
    const a = setTimeout(() => {
      setDigitando(false);
      const f = t.dialogo[visiveis];
      onFala?.({ agente: t.agente_alvo, quem: f.quem, texto: f.texto });
      setVisiveis(v => v + 1);
    }, visiveis === 0 ? 900 : MS_POR_FALA);
    return () => clearTimeout(a);
  }, [tocando, visiveis, t, total, onFala]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [visiveis, digitando]);
  useEffect(() => () => onFala?.(null), [onFala]);

  const assistir = () => { setVisiveis(0); setTocando(true); };
  const treinar = async (agente: 'luiz_felipe' | 'julio' | 'caroline') => {
    try { await apiClient.rafaelTreinar(agente); } catch { /* aviso no painel */ }
    carregar();
  };

  const nomeAgente = t ? NOME[t.agente_alvo] || t.agente_alvo : '';
  const corAgente = t ? COR[t.agente_alvo] || '#475569' : '#475569';
  const mostradas = tocando ? t?.dialogo.slice(0, visiveis) || [] : t?.dialogo || [];

  return (
    <section style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15, color: 'var(--t-text-primary)' }}>🎓 Sala de treinamento</b>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>O Rafael lê as conversas reais do agente, aponta o que incomoda o cliente e treina. Toda quinta de manhã ele treina o Luiz Felipe.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['luiz_felipe', 'julio', 'caroline'] as const).map(a => (
            <button key={a} onClick={() => treinar(a)} disabled={andamento.includes(`treino_${a}`)}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: `1px solid ${COR[a]}`, background: 'var(--t-card-bg)', color: COR[a], cursor: 'pointer', opacity: andamento.includes(`treino_${a}`) ? 0.6 : 1 }}>
              {andamento.includes(`treino_${a}`) ? `Treinando ${NOME[a]}…` : `Treinar ${NOME[a]}`}
            </button>
          ))}
        </div>
      </div>

      {!lista ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Abrindo a sala…</p>
        : !t ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum treinamento ainda. Clique em &quot;Treinar Luiz Felipe&quot;.</p>
        : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select value={idx} onChange={e => { setIdx(Number(e.target.value)); setTocando(false); setVisiveis(0); onFala?.(null); }}
                style={{ fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                {lista.map((x, i) => <option key={x.id} value={i}>{x.titulo}</option>)}
              </select>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: t.status === 'APROVADO' ? '#dcfce7' : '#fef3c7', color: t.status === 'APROVADO' ? '#166534' : '#92400e' }}>
                {t.status === 'APROVADO' ? 'Aplicado no agente' : 'Esperando sua aprovação (painel do Rafael)'}
              </span>
              <button onClick={assistir} disabled={tocando}
                style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: 0, background: COR.rafael, color: '#fff', cursor: 'pointer', opacity: tocando ? 0.6 : 1 }}>
                {tocando ? `Conversando… ${visiveis}/${total}` : '▶ Assistir a conversa'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflowY: 'auto', padding: 12, borderRadius: 10, background: 'var(--t-content-bg)' }}>
              {mostradas.map((f, i) => {
                const rafael = f.quem === 'rafael';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: rafael ? 'flex-start' : 'flex-end', animation: tocando && i === visiveis - 1 ? 'treinoEntra .35s ease-out' : undefined }}>
                    <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45, background: 'var(--t-card-bg)', border: `1px solid ${rafael ? COR.rafael : corAgente}33`, borderLeft: rafael ? `3px solid ${COR.rafael}` : undefined, borderRight: rafael ? undefined : `3px solid ${corAgente}`, color: 'var(--t-text-primary)' }}>
                      <b style={{ display: 'block', fontSize: 11, color: rafael ? COR.rafael : corAgente, marginBottom: 2 }}>{rafael ? 'Rafael' : nomeAgente}</b>
                      {f.texto}
                    </div>
                  </div>
                );
              })}
              {tocando && digitando && t.dialogo[visiveis] && (
                <div style={{ display: 'flex', justifyContent: t.dialogo[visiveis].quem === 'rafael' ? 'flex-start' : 'flex-end' }}>
                  <span style={{ fontSize: 12, color: 'var(--t-text-muted)', padding: '6px 10px' }}>{t.dialogo[visiveis].quem === 'rafael' ? 'Rafael' : nomeAgente} está digitando<span className="treino-pontos">…</span></span>
                </div>
              )}
              <div ref={fimRef} />
            </div>

            <div>
              <button onClick={() => setVerRegras(v => !v)} style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 0, color: COR.rafael, cursor: 'pointer', padding: 0 }}>
                {verRegras ? '▾' : '▸'} Regras que o {nomeAgente} passa a seguir ({t.regras.length})
              </button>
              {verRegras && (
                <ol style={{ margin: '6px 0 0 18px', fontSize: 13, color: 'var(--t-text-secondary)', display: 'grid', gap: 3 }}>
                  {t.regras.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              )}
            </div>
          </>
        )}
      <style>{`@keyframes treinoEntra{from{opacity:0;transform:translateY(6px)}}.treino-pontos{animation:treinoPisca 1s steps(2) infinite}@keyframes treinoPisca{50%{opacity:.2}}`}</style>
    </section>
  );
}
