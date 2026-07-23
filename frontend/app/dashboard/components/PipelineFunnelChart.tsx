'use client';

import React from 'react';
import { FunnelChart, Funnel, Cell, LabelList, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface PipelineFunnelChartProps {
  pipelineFunil: { etapa: string; count: number; valor: number }[];
  etapaLabel: Record<string, string>;
  fmt: (v: number) => string;
}

const FUNNEL_COLORS = ['#4B8EC8', '#2E6EAB', '#1A4E82', '#6366F1', '#8B5CF6', '#7C3AED'];

export function PipelineFunnelChart({ pipelineFunil, etapaLabel, fmt }: PipelineFunnelChartProps) {
  const temDados = pipelineFunil.some(p => p.count > 0);

  const data = pipelineFunil.map((p, i) => ({
    name: etapaLabel[p.etapa] || p.etapa,
    value: p.count,
    valorMonetario: p.valor,
    fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    // Taxa de conversão em relação à etapa anterior (só faz sentido a partir da 2ª etapa).
    taxaConversao: i === 0 || pipelineFunil[i - 1].count === 0
      ? null
      : Math.round((p.count / pipelineFunil[i - 1].count) * 100),
  }));

  return (
    <div className="ps-card rounded-xl p-5">
      <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Pipeline por Etapa</p>
      {temDados ? (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(_value, _name, payload) =>
                      `${payload.value} lead${payload.value !== 1 ? 's' : ''} · ${fmt(payload.valorMonetario)}${payload.taxaConversao !== null ? ` · ${payload.taxaConversao}% conv.` : ''}`
                    }
                  />
                }
              />
              <Funnel
                dataKey="value"
                data={data}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                <LabelList
                  position="right"
                  dataKey="name"
                  fill="var(--t-text-primary)"
                  fontSize={11}
                  fontWeight={600}
                />
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-secondary)' }}>Nenhum lead ativo no funil</p>
      )}
    </div>
  );
}
