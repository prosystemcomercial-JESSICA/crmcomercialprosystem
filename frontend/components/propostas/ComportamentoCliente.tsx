'use client';

// Comportamento do cliente no link da proposta (pedido da Jessica, 23/10/2026): quantas vezes
// abriu, quanto tempo ficou, por onde passou e se foi direto aos valores. Dados de
// GET /propostas-comerciais/:id/comportamento (backend/src/lib/proposta-visitas.ts).
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Resumo = {
  aberturas: number;
  segundos_total: number;
  primeira_abertura: string | null;
  ultima_atividade: string | null;
  foi_direto_aos_valores: boolean;
  grupos: { grupo: string; nome: string; segundos: number }[];
  telas: { tela: number; nome: string; grupo: string; segundos: number; visitas: number }[];
  nao_vistas: string[];
  leitura: string[];
  cliques: { visita: number; tela: string; acao: string }[];
  visitas: { n: number; inicio: string; segundos: number; versao: string | null; origem: string; dispositivo: string | null; caminho: string[]; primeira_tela: string | null }[];
};

export type ResumoVisitas = { aberturas: number; segundos: number; ultima: string | null; direto_valores: boolean };

export function fmtDuracao(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const m = Math.round(seg / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const fmtQuando = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const COR_GRUPO: Record<string, string> = {
  escolha: '#94a3b8', apresentacao: '#2563eb', modulos: '#0891b2', valores: '#ea580c', fechamento: '#16a34a',
};

const rotulo: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)', fontWeight: 700, marginBottom: 6 };

/** Selo curto para a lista e o quadro: "👁 3× · 8 min". */
export function SeloVisitas({ r }: { r?: ResumoVisitas }) {
  if (!r || !r.aberturas) return null;
  return (
    <span title={`Cliente abriu ${r.aberturas}× · ${fmtDuracao(r.segundos)} no total · última: ${fmtQuando(r.ultima)}${r.direto_valores ? ' · foi direto aos valores' : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#ede9fe', color: '#6d28d9', whiteSpace: 'nowrap' }}>
      👁 {r.aberturas}× · {fmtDuracao(r.segundos)}{r.direto_valores ? ' · 💲' : ''}
    </span>
  );
}

export default function ComportamentoCliente({ propostaId }: { propostaId: string }) {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState(false);
  const [abertas, setAbertas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(false);
    apiClient.getComportamentoProposta(propostaId)
      .then(r => { if (vivo) setDados(r.data?.data || null); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [propostaId]);

  const caixa: React.CSSProperties = { border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 };

  if (erro) return <div style={caixa}><p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Não foi possível carregar o comportamento do cliente.</p></div>;
  if (!dados) return <div style={caixa}><p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Carregando comportamento do cliente…</p></div>;

  if (!dados.aberturas) {
    return (
      <div style={caixa}>
        <p style={rotulo}>Comportamento do cliente</p>
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
          O cliente ainda não abriu o link (ou abriu antes de 23/10/2026, quando o acompanhamento começou). Aberturas pela equipe não contam.
        </p>
      </div>
    );
  }

  const maxTela = Math.max(...dados.telas.map(t => t.segundos), 1);

  return (
    <div style={caixa}>
      <p style={rotulo}>Comportamento do cliente</p>

      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 10 }}>
        <div><div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>Aberturas</div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{dados.aberturas}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>Tempo total</div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{fmtDuracao(dados.segundos_total)}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>Última vez</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{fmtQuando(dados.ultima_atividade)}</div></div>
      </div>

      <ul style={{ margin: '0 0 12px', paddingLeft: 16, fontSize: 12, color: 'var(--t-text-primary)', lineHeight: 1.6 }}>
        {dados.leitura.map(l => <li key={l}>{l}</li>)}
      </ul>

      {dados.grupos.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={rotulo}>Onde o tempo foi</p>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--t-content-bg)' }}>
            {dados.grupos.map(g => (
              <div key={g.grupo} title={`${g.nome}: ${fmtDuracao(g.segundos)}`}
                style={{ width: `${(100 * g.segundos) / Math.max(dados.segundos_total, 1)}%`, background: COR_GRUPO[g.grupo] || '#64748b' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
            {dados.grupos.map(g => (
              <span key={g.grupo} style={{ fontSize: 11, color: 'var(--t-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COR_GRUPO[g.grupo] || '#64748b' }} />
                {g.nome}: <b style={{ color: 'var(--t-text-primary)' }}>{fmtDuracao(g.segundos)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setAbertas(v => !v)}
        style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-link)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: abertas ? 10 : 0 }}>
        {abertas ? '▾ Esconder detalhes' : '▸ Tempo por tela, cada abertura e cliques'}
      </button>

      {abertas && (
        <>
          <div style={{ marginBottom: 12 }}>
            <p style={rotulo}>Tempo por tela</p>
            {dados.telas.map(t => (
              <div key={t.tela} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 52px', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: 'var(--t-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.nome}>{t.nome}</span>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--t-content-bg)' }}>
                  <div style={{ width: `${(100 * t.segundos) / maxTela}%`, height: '100%', borderRadius: 999, background: COR_GRUPO[t.grupo] || '#64748b' }} />
                </div>
                <span style={{ textAlign: 'right', color: 'var(--t-text-muted)' }}>{fmtDuracao(t.segundos)}</span>
              </div>
            ))}
            {dados.nao_vistas.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 6 }}>
                <b>Não viu:</b> {dados.nao_vistas.join(', ')}.
              </p>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <p style={rotulo}>Cada abertura (mais recente primeiro)</p>
            {dados.visitas.map(v => (
              <div key={v.n} style={{ fontSize: 11, padding: '6px 0', borderTop: '1px solid var(--t-card-border)' }}>
                <div style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>
                  {v.n}ª · {fmtQuando(v.inicio)} · {fmtDuracao(v.segundos)}
                  <span style={{ color: 'var(--t-text-muted)', fontWeight: 400 }}>
                    {' '}· {v.dispositivo || 'aparelho ?'} · {v.origem === 'express' ? 'express' : v.versao === 'simples' ? 'versão simplificada' : 'versão completa'}
                  </span>
                </div>
                {v.caminho.length > 0 && <div style={{ color: 'var(--t-text-muted)', marginTop: 2 }}>{v.caminho.join(' → ')}</div>}
              </div>
            ))}
          </div>

          {dados.cliques.length > 0 && (
            <div>
              <p style={rotulo}>Cliques</p>
              {dados.cliques.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                  {c.visita}ª abertura · {c.tela}: <b style={{ color: 'var(--t-text-primary)' }}>{c.acao}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
