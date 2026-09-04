'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { RefreshCw, GitMerge, Users, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartTooltip } from '../dashboard/components/ChartTooltip';

interface PipelineComercial {
  total_oportunidades: number;
  pipeline_valor_bruto: number;
  pipeline_valor_ponderado: number;
  por_etapa: { etapa: string; label: string; qtd: number; valor_bruto: number; valor_ponderado: number; idade_media_dias: number; paradas_30_dias: number }[];
  por_vendedor: { vendedor_id: string; vendedor_nome: string; qtd: number; valor_bruto: number; valor_ponderado: number }[];
  oportunidades_paradas: { lead_id: string; nome: string; etapa: string; etapa_label: string; vendedor_nome: string; valor_estimado: number; dias_parado: number }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} style={{ color: 'var(--t-primary)' }} />
      <div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ label = 'Sem dados suficientes' }: { label?: string }) {
  return <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-muted)' }}>{label}</p>;
}

export default function PipelineComercialPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PipelineComercial | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiClient.getPipelineComercial();
      setData(res.data?.data || null);
    } catch (e) {
      console.error('[PIPELINE-COMERCIAL] erro ao carregar:', e);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const etapaChart = data?.por_etapa.map(e => ({ etapa: e.label, 'Valor bruto': e.valor_bruto, 'Valor ponderado': e.valor_ponderado })) || [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Pipeline Comercial</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Detalhamento do pipeline em aberto — por etapa, por vendedor, e o que está parado.
            </p>
          </div>
          <button onClick={fetchData} disabled={fetching}
            className="p-2 rounded-lg border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
            <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {fetching && !data ? (
          <Card><EmptyState label="Carregando..." /></Card>
        ) : !data ? (
          <Card><EmptyState label="Não foi possível carregar os dados" /></Card>
        ) : (
          <>
            {/* ─── Resumo ─────────────────────────── */}
            <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1A4E82, #2E6EAB)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-3">Resumo do pipeline</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="opacity-80 text-xs mb-1">Oportunidades abertas</div>
                  <p className="text-2xl font-extrabold">{data.total_oportunidades}</p>
                </div>
                <div>
                  <div className="opacity-80 text-xs mb-1">Pipeline bruto</div>
                  <p className="text-2xl font-extrabold">{fmt(data.pipeline_valor_bruto)}</p>
                </div>
                <div>
                  <div className="opacity-80 text-xs mb-1">Pipeline ponderado (forecast)</div>
                  <p className="text-2xl font-extrabold">{fmt(data.pipeline_valor_ponderado)}</p>
                </div>
                <div>
                  <div className="opacity-80 text-xs mb-1">Paradas 30+ dias</div>
                  <p className="text-2xl font-extrabold">{data.oportunidades_paradas.length}</p>
                </div>
              </div>
            </div>

            {/* ─── Por etapa ──────────────────────── */}
            <Card>
              <SectionTitle icon={GitMerge} title="Pipeline por etapa" subtitle="Valor bruto (soma) vs. ponderado (× probabilidade de fechamento)" />
              {etapaChart.length === 0 ? <EmptyState /> : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={etapaChart} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                      <XAxis dataKey="etapa" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => fmt(Number(v))} />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Valor bruto" fill="#2E6EAB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Valor ponderado" fill="#8CB6DE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                      <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Etapa</th>
                      <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Qtd</th>
                      <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Valor bruto</th>
                      <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Idade média</th>
                      <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Paradas 30+d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_etapa.map(e => (
                      <tr key={e.etapa} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{e.label}</td>
                        <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{e.qtd}</td>
                        <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{fmt(e.valor_bruto)}</td>
                        <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{e.idade_media_dias}d</td>
                        <td className="text-right py-2 px-2" style={{ color: e.paradas_30_dias > 0 ? '#B3432F' : 'var(--t-text-primary)' }}>{e.paradas_30_dias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ─── Por vendedor ───────────────────── */}
            <Card>
              <SectionTitle icon={Users} title="Pipeline por vendedor" />
              {data.por_vendedor.length === 0 ? <EmptyState /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Vendedor</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Oportunidades</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Valor bruto</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Valor ponderado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_vendedor.map(v => (
                        <tr key={v.vendedor_id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                          <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{v.vendedor_nome}</td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{v.qtd}</td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{fmt(v.valor_bruto)}</td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{fmt(v.valor_ponderado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ─── Oportunidades paradas ──────────── */}
            <Card>
              <SectionTitle icon={AlertTriangle} title="Oportunidades paradas (30+ dias sem avanço)" subtitle="Ordenadas pelas mais antigas — candidatas a follow-up imediato" />
              {data.oportunidades_paradas.length === 0 ? <EmptyState label="Nenhuma oportunidade parada — pipeline saudável" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Lead</th>
                        <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Etapa</th>
                        <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Vendedor</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Valor estimado</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Dias parado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.oportunidades_paradas.map(o => (
                        <tr key={o.lead_id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                          <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{o.nome}</td>
                          <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{o.etapa_label}</td>
                          <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{o.vendedor_nome}</td>
                          <td className="text-right py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{fmt(o.valor_estimado)}</td>
                          <td className="text-right py-2 px-2 font-semibold" style={{ color: '#B3432F' }}>{o.dias_parado}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
