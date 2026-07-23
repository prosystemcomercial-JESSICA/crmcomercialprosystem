'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileCheck2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ChartTooltip } from './ChartTooltip';

interface SeriePonto {
  mes: string;
  saldo_mrr: number;
}

interface MrrTrendCardProps {
  mrr: number;
  mrrDelta: number;
  contratosAtivos: number;
  contratosMes: number;
  AnimatedNumber: React.ComponentType<{ value: number; prefix?: string; suffix?: string; decimals?: number }>;
  fmt: (v: number) => string;
}

export function MrrTrendCard({ mrr, mrrDelta, contratosAtivos, contratosMes, AnimatedNumber, fmt }: MrrTrendCardProps) {
  const [serie, setSerie] = useState<SeriePonto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth(); // 0-indexed
    apiClient.getRelatorioSerieAnual(anoAtual)
      .then(res => {
        const serieCompleta: { mes: string; saldo_mrr: number }[] = res.data?.data?.serie || [];
        // A rota devolve os 12 meses do ano, incluindo meses futuros (que vêm zerados).
        // Corta no mês atual para não desenhar uma queda artificial pra zero no futuro.
        const acumulado: SeriePonto[] = [];
        let saldoAcumulado = 0;
        serieCompleta.slice(0, mesAtual + 1).forEach(p => {
          saldoAcumulado += p.saldo_mrr;
          acumulado.push({ mes: p.mes, saldo_mrr: saldoAcumulado });
        });
        setSerie(acumulado);
      })
      .catch(() => setSerie([]))
      .finally(() => setLoading(false));
  }, []);

  const temTendencia = !loading && serie.length > 1 && serie.some(p => p.saldo_mrr !== 0);

  return (
    <div className="du-fade-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="ps-card rounded-xl p-5 lg:col-span-2 relative overflow-hidden group transition-all duration-200 hover:shadow-md">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.10)' }}>
              <DollarSign size={16} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
                MRR Recorrente
              </p>
              <p className="text-2xl font-bold tracking-tight leading-none mt-1" style={{ color: 'var(--t-text-primary)' }}>
                <AnimatedNumber value={mrr} prefix="R$ " />
              </p>
            </div>
          </div>
          {mrrDelta !== undefined && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{
                background: mrrDelta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
                color: mrrDelta >= 0 ? '#16a34a' : '#dc2626',
              }}
            >
              {mrrDelta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {Math.abs(mrrDelta)}%
            </span>
          )}
        </div>

        {temTendencia ? (
          <div className="h-24 mt-3 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--t-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmt(Number(v))} />} />
                <Area
                  type="monotone"
                  dataKey="saldo_mrr"
                  name="Saldo MRR acumulado"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[11px] mt-3" style={{ color: 'var(--t-text-secondary)' }}>
            {loading ? 'Carregando tendência…' : 'Sem histórico suficiente para exibir tendência.'}
          </p>
        )}
      </div>

      <div className="ps-card rounded-xl p-5 flex flex-col justify-center transition-all duration-200 hover:shadow-md">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mb-3" style={{ background: 'rgba(75,142,200,0.10)' }}>
          <FileCheck2 size={16} style={{ color: '#4B8EC8' }} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>
          Contratos Ativos
        </p>
        <p className="text-2xl font-bold tracking-tight leading-none" style={{ color: 'var(--t-text-primary)' }}>
          <AnimatedNumber value={contratosAtivos} />
        </p>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--t-text-secondary)' }}>
          +{contratosMes} este mês
        </p>
      </div>
    </div>
  );
}
