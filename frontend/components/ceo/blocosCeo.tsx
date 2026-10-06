'use client';

// Peças visuais do Painel do CEO (Panorama e Leads em números): cartões de número,
// barras horizontais e listas de definição no padrão de .interface-design/system.md.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const AZUL = '#2E6EAB';
export const painel: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10 };
export const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' };
export const secao: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--t-text-secondary)' };
export const nf = (v: number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
export const brl0 = (v: number | null | undefined) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);

export const CSS_CEO = `.ceo-grid{display:grid;gap:12px}.ceo-g3{grid-template-columns:repeat(3,minmax(0,1fr))}.ceo-g2{grid-template-columns:repeat(2,minmax(0,1fr))}.ceo-g4{grid-template-columns:repeat(4,minmax(0,1fr))}
@media (max-width:1100px){.ceo-g3,.ceo-g4{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:700px){.ceo-g3,.ceo-g2,.ceo-g4{grid-template-columns:1fr}}
.ceo-tab{width:100%;border-collapse:collapse;font-size:13px}.ceo-tab th{font-size:12px;font-weight:500;color:var(--t-text-muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--t-card-border);white-space:nowrap}
.ceo-tab td{padding:10px 12px;border-top:1px solid var(--t-card-border);color:var(--t-text-primary)}.ceo-tab .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}`;

/** Número grande com rótulo, comparação e cor só quando comunica (meta/sinal). */
export function Numero({ l, v, s, cor }: { l: string; v: string; s?: React.ReactNode; cor?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={rotulo}>{l}</div>
      <div style={{ fontSize: 24, fontWeight: 650, lineHeight: 1.2, color: cor || 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s ? <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{s}</div> : null}
    </div>
  );
}

/** Bloco do panorama: título, pergunta que responde, números e atalho para o detalhe. */
export function BlocoPanorama({ titulo, pergunta, children, acao, onAcao, href }: { titulo: string; pergunta: string; children: React.ReactNode; acao: string; onAcao?: () => void; href?: string }) {
  const estiloAcao: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: AZUL, background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 36, textDecoration: 'none' };
  return (
    <section style={{ ...painel, padding: 16, display: 'grid', gap: 14, alignContent: 'start' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: 'var(--t-text-primary)' }}>{titulo}</h3>
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>{pergunta}</div>
      </div>
      <div className="ceo-grid ceo-g2" style={{ rowGap: 16 }}>{children}</div>
      <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 4 }}>
        {href ? <Link href={href} style={estiloAcao}>{acao} <ArrowRight size={14} /></Link>
          : <button onClick={onAcao} style={estiloAcao}>{acao} <ArrowRight size={14} /></button>}
      </div>
    </section>
  );
}

export function Barra({ l, v, max, extra }: { l: string; v: number; max: number; extra?: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--t-text-primary)' }}>{l}</span>
        <span style={{ color: 'var(--t-text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--t-text-primary)' }}>{nf(v)}</b>{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--t-content-bg)' }}>
        <div style={{ width: `${max ? Math.max(v ? 2 : 0, (v / max) * 100) : 0}%`, height: 8, borderRadius: 4, background: AZUL }} />
      </div>
    </div>
  );
}

/** Variação contra o período anterior, em texto (cor só no sinal). */
export function Variacao({ atual, anterior, sufixo = 'vs. mês anterior' }: { atual: number; anterior: number; sufixo?: string }) {
  if (!anterior) return <span>{sufixo.replace('vs.', 'sem base no')}</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return <span><b style={{ color: pct >= 0 ? '#16a34a' : '#dc2626' }}>{pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%</b> {sufixo}</span>;
}
