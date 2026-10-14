'use client';

// Painel das indicações de clientes (14/10/2026): quem indicou, em que pé está cada indicado e os prêmios de 50%
// que falta aplicar no faturamento do cliente que indicou.

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Linha = { id: string; criada_em: string; cliente: string; cliente_codigo: string | null; indicado: string; empresa: string | null; telefone: string | null; conversaId: string | null; fase: string; status: string; bonus_pago: boolean; premio_pendente: boolean };
const COR: Record<string, string> = { PENDENTE: '#64748b', CONTATO: '#2563eb', CONVERTIDO: '#16a34a', PERDIDO: '#b91c1c' };

export default function IndicacoesClientes() {
  const [d, setD] = useState<{ linhas: Linha[]; resumo: { total: number; em_andamento: number; fecharam: number; premios_pendentes: number } } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const carregar = useCallback(() => apiClient.getIndicacoesClientes().then(r => setD(r.data?.data || null)).catch(() => setD({ linhas: [], resumo: { total: 0, em_andamento: 0, fecharam: 0, premios_pendentes: 0 } })), []);
  useEffect(() => { carregar(); }, [carregar]);
  const premio = async (l: Linha, aplicado: boolean) => {
    try { const r = await apiClient.marcarPremioIndicacao(l.id, aplicado); setMsg(r.data?.message || 'Pronto.'); } catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo.'); }
    carregar();
  };
  if (!d) return <div className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando…</div>;
  const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {[['Indicações', d.resumo.total], ['Em andamento', d.resumo.em_andamento], ['Fecharam', d.resumo.fecharam], ['Prêmios a aplicar', d.resumo.premios_pendentes]].map(([r, v]) => (
          <div key={r as string} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)' }}>
            <span className="block text-xs" style={{ color: 'var(--t-text-muted)' }}>{r}</span>
            <b style={{ color: r === 'Prêmios a aplicar' && v ? '#b45309' : 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</b>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Prêmio da indicação: 50% de desconto na próxima mensalidade do cliente que indicou, quando o indicado fecha contrato. O CRM avisa aqui; o desconto é lançado no faturamento.</p>
      {msg && <p role="status" className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>{msg}</p>}
      {d.linhas.length === 0 ? (
        <div className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Nenhuma indicação ainda. No contato de ativo, toque em &quot;Registrar indicação&quot;.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--t-card-border)' }}>
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="text-left" style={{ color: 'var(--t-text-muted)' }}>
                {['Data', 'Quem indicou', 'Indicado', 'Situação', 'Prêmio'].map(h => <th key={h} className="py-2 px-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.linhas.map(l => (
                <tr key={l.id} className="border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                  <td className="py-2 px-3" style={{ color: 'var(--t-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{dia(l.criada_em)}</td>
                  <td className="py-2 px-3" style={{ color: 'var(--t-text-primary)' }}>{l.cliente}{l.cliente_codigo ? <span style={{ color: 'var(--t-text-muted)' }}> · {l.cliente_codigo}</span> : null}</td>
                  <td className="py-2 px-3" style={{ color: 'var(--t-text-primary)' }}>
                    {l.conversaId ? <a href={`/whatsapp?conversa=${l.conversaId}`} style={{ color: 'var(--t-text-primary)', textDecoration: 'underline' }}>{l.indicado}</a> : l.indicado}
                    {l.empresa ? <span style={{ color: 'var(--t-text-muted)' }}> · {l.empresa}</span> : null}
                  </td>
                  <td className="py-2 px-3 font-semibold" style={{ color: COR[l.status] || 'var(--t-text-secondary)' }}>{l.fase}</td>
                  <td className="py-2 px-3">
                    {l.status !== 'CONVERTIDO' ? <span style={{ color: 'var(--t-text-muted)' }}>quando fechar</span>
                      : l.bonus_pago ? <button onClick={() => premio(l, false)} className="text-xs" style={{ color: '#16a34a' }}>Aplicado ✓ (desfazer)</button>
                      : <button onClick={() => premio(l, true)} className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-600 text-white">Marcar desconto aplicado</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
