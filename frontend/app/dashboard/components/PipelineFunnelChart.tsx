'use client';

import React from 'react';
import { FunnelChart, Funnel, Cell, LabelList, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface PipelineFunnelChartProps {
  pipelineFunil: { etapa: string; count: number; valor: number }[];
  etapaLabel: Record<string, string>;
  fmt: (v: number) => string;
  titulo?: string;
}

const FUNNEL_COLORS = ['#4B8EC8', '#2E6EAB', '#1A4E82', '#6366F1', '#8B5CF6', '#7C3AED'];

export function PipelineFunnelChart({ pipelineFunil, etapaLabel, fmt, titulo = 'Pipeline por Etapa' }: PipelineFunnelChartProps) {
  const temDados = pipelineFunil.some(p => p.count > 0);
  const totalCount = pipelineFunil.reduce((s, p) => s + p.count, 0);
  const totalValor = pipelineFunil.reduce((s, p) => s + p.valor, 0);

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
    <div className="ps-card rounded-xl p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{titulo}</p>
        {temDados && (
          <span className="text-[11px] font-semibold" style={{ color: 'var(--t-text-muted)' }}>
            {totalCount} no total · {fmt(totalValor)}
          </span>
        )}
      </div>
      {temDados ? (
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(_value, _name, payload) =>
                      `${payload.value} ${payload.value !== 1 ? 'itens' : 'item'} · ${fmt(payload.valorMonetario)}${payload.taxaConversao !== null ? ` · ${payload.taxaConversao}% conv.` : ''}`
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
                  fontSize={12}
                  fontWeight={700}
                  offset={12}
                />
                <LabelList
                  position="center"
                  dataKey="value"
                  fill="#fff"
                  fontSize={13}
                  fontWeight={800}
                />
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill} stroke="var(--t-card-bg)" strokeWidth={2} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-secondary)' }}>Nenhum item ativo no funil</p>
      )}
    </div>
  );
}
