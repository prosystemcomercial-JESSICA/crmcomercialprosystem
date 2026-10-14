'use client';

// Placar comercial (parte 2 do Plano de Expansão, 14/10/2026): hoje e a semana contra a meta do plano, mais o que está
// parado entre o interesse e a proposta (interessado sem demonstração há 48 h e proposta em rascunho há 1 dia).

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Num = { primeiros_contatos: number; respostas: number; interessados: number; demonstracoes: number; propostas: number; contratos: number };
type Placar = {
  hoje: Num; semana: Num; meta_semana: { primeiros_contatos: number; demonstracoes: number; propostas: number; contratos: number } | null;
  interessados_sem_demo: { id: string; nome: string | null; empresa: string | null; nota: number | null; conversaId: string }[];
  propostas_rascunho: { id: string; razao_social: string; nome_fantasia: string | null; created_by_name: string | null; created_at: string }[];
};

const ITENS: { k: keyof Num; r: string; meta?: 'primeiros_contatos' | 'demonstracoes' | 'propostas' | 'contratos' }[] = [
  { k: 'primeiros_contatos', r: 'Primeiros contatos', meta: 'primeiros_contatos' },
  { k: 'respostas', r: 'Responderam' },
  { k: 'interessados', r: 'Interessados' },
  { k: 'demonstracoes', r: 'Demonstrações', meta: 'demonstracoes' },
  { k: 'propostas', r: 'Propostas', meta: 'propostas' },
  { k: 'contratos', r: 'Contratos', meta: 'contratos' },
];

export default function PlacarComercial() {
  const [p, setP] = useState<Placar | null>(null);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => apiClient.getPlacarComercial().then(r => { setP(r.data.data); setErro(false); }).catch(() => setErro(true)), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 120_000); return () => clearInterval(t); }, [carregar]);
  if (erro || !p) return null; // só a gestão vê; sem dados, não ocupa espaço

  return (
    <section aria-label="Placar comercial" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <b style={{ fontSize: 15, color: 'var(--t-text-primary)' }}>Placar: do primeiro contato ao contrato</b>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>hoje · semana {p.meta_semana ? '/ meta da semana' : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {ITENS.map(i => {
          const meta = i.meta && p.meta_semana ? p.meta_semana[i.meta] : null;
          const atingiu = meta != null && p.semana[i.k] >= meta;
          return (
            <div key={i.k} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{i.r}</span>
              <b style={{ fontSize: 20, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{p.hoje[i.k]}</b>
              <span style={{ fontSize: 12, color: atingiu ? '#16a34a' : 'var(--t-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                semana {p.semana[i.k]}{meta != null ? ` / ${meta}` : ''}
              </span>
            </div>
          );
        })}
      </div>
      {(p.interessados_sem_demo.length > 0 || p.propostas_rascunho.length > 0) && (
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          {p.interessados_sem_demo.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <b style={{ color: '#be123c' }}>{p.interessados_sem_demo.length} interessado(s) sem demonstração há mais de 48 h</b>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.interessados_sem_demo.slice(0, 8).map(s => (
                  <a key={s.id} href={`/whatsapp?conversa=${s.conversaId}`} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    {s.nome || 'lead'}{s.empresa ? ` · ${s.empresa}` : ''} · {s.nota}
                  </a>
                ))}
              </div>
            </div>
          )}
          {p.propostas_rascunho.length > 0 && (
            <div>
              <b style={{ color: '#b45309' }}>{p.propostas_rascunho.length} proposta(s) em rascunho há mais de 1 dia: </b>
              <span style={{ color: 'var(--t-text-secondary)' }}>{p.propostas_rascunho.slice(0, 5).map(x => x.nome_fantasia || x.razao_social).join(', ')}. </span>
              <a href="/propostas-comerciais" style={{ color: 'var(--t-primary)', fontWeight: 700 }}>Enviar</a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
