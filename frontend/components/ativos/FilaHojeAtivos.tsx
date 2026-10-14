'use client';

// Fila de hoje do Programa de Ativos (parte 3 do Plano de Expansão, 14/10/2026): 8 contatos por vendedor, primeiro
// cliente em risco ou com problema, depois quem nunca foi contatado, depois quem está parado há mais de 14 dias.

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Item = { id: string; cliente_nome: string | null; cliente_codigo: string | null; etapa: string; prioridade: 0 | 1 | 2; contatado_em: string | null; tentativas: number };
type Vendedor = { vendedor_id: string; vendedor_nome: string; feitos_hoje: number; faltam_hoje: number; fila: Item[] };
const MOTIVO = ['em risco', 'nunca contatado', 'parado há mais de 14 dias'];
const COR = ['#dc2626', '#2563eb', '#b45309'];

export default function FilaHojeAtivos({ onAbrir }: { onAbrir: (c: Item) => void }) {
  const [dados, setDados] = useState<{ meta_dia: number; vendedores: Vendedor[] } | null>(null);
  useEffect(() => { apiClient.getAtivosHoje().then(r => setDados(r.data?.data || null)).catch(() => setDados(null)); }, []);
  if (!dados || !dados.vendedores.length) return null;
  return (
    <section aria-label="Contatos de hoje" className="rounded-xl border p-3 mb-4" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <b className="text-sm" style={{ color: 'var(--t-text-primary)' }}>Contatos de hoje</b>
        <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>meta: {dados.meta_dia} por vendedor por dia · em todo contato, peça uma indicação</span>
      </div>
      <div className="grid gap-3">
        {dados.vendedores.map(v => (
          <div key={v.vendedor_id} className="grid gap-1">
            <span className="text-xs font-semibold" style={{ color: v.faltam_hoje ? 'var(--t-text-secondary)' : '#16a34a' }}>
              {dados.vendedores.length > 1 ? `${v.vendedor_nome}: ` : ''}{v.feitos_hoje} de {dados.meta_dia} feitos hoje{v.faltam_hoje ? '' : ' · meta do dia batida'}
            </span>
            {v.fila.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {v.fila.map(c => (
                  <button key={c.id} onClick={() => onAbrir(c)} className="text-left text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <b>{c.cliente_nome || 'Cliente'}</b>
                    <span className="block" style={{ color: COR[c.prioridade] }}>{MOTIVO[c.prioridade]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
