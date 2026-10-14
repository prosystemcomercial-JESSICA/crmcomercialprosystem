'use client';

// Funil por origem (parte 4 do Plano de Expansão, 14/10/2026): de qual canal e campanha vêm os leads que respondem,
// se interessam, têm demonstração, proposta e contrato. Serve para decidir onde pôr dinheiro e esforço.

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Linha = { canal: string; campanha: string; leads: number; responderam: number; interessados: number; demonstracoes: number; propostas: number; contratos: number };
const COLS: { k: keyof Linha; r: string }[] = [
  { k: 'leads', r: 'Leads' }, { k: 'responderam', r: 'Responderam' }, { k: 'interessados', r: 'Interessados' },
  { k: 'demonstracoes', r: 'Demonstrações' }, { k: 'propostas', r: 'Propostas' }, { k: 'contratos', r: 'Contratos' },
];

export default function FunilOrigem() {
  const [dias, setDias] = useState(30);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (aberto) { setLinhas(null); apiClient.getFunilOrigem(dias).then(r => setLinhas(r.data?.data?.linhas || [])).catch(() => setLinhas([])); } }, [aberto, dias]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

  return (
    <section aria-label="Funil por origem" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setAberto(a => !a)} aria-expanded={aberto} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 15, fontWeight: 700, color: 'var(--t-text-primary)' }}>
          {aberto ? '▲' : '▼'} De onde vêm as vendas (funil por origem)
        </button>
        {aberto && (
          <select value={dias} onChange={e => setDias(Number(e.target.value))} aria-label="Período" style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }}>
            {[30, 60, 90].map(d => <option key={d} value={d}>últimos {d} dias</option>)}
          </select>
        )}
      </div>
      {aberto && (linhas === null ? <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</span> : linhas.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhum lead novo no período.</span>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t-text-muted)' }}>
                <th style={{ padding: '6px 8px' }}>Canal · campanha</th>
                {COLS.map(c => <th key={c.k} style={{ padding: '6px 8px', textAlign: 'right' }}>{c.r}</th>)}
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Lead → proposta</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={`${l.canal}|${l.campanha}`} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--t-text-primary)' }}>
                    <b>{l.canal}</b>{l.campanha !== l.canal && <span style={{ color: 'var(--t-text-muted)' }}> · {l.campanha}</span>}
                  </td>
                  {COLS.map(c => <td key={c.k} style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.k === 'contratos' && l.contratos ? '#16a34a' : 'var(--t-text-secondary)', fontWeight: c.k === 'contratos' && l.contratos ? 700 : 400 }}>{l[c.k] as number}</td>)}
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--t-text-secondary)' }}>{pct(l.propostas, l.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
