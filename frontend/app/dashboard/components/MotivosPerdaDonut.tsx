'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface MotivosPerdaDonutProps {
  motivos: { motivo: string; total: number; valor_total: number; pct: number }[];
  fmt: (v: number) => string;
}

const DONUT_COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

export function MotivosPerdaDonut({ motivos, fmt }: MotivosPerdaDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!motivos || motivos.length === 0) return null;

  const data = motivos.map((m, i) => ({
    name: m.motivo,
    value: m.total,
    valorMonetario: m.valor_total,
    pct: m.pct,
    fill: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return (
    <div className="ps-card rounded-xl p-5">
      <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Principais motivos de perda</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(_v, _n, payload) => `${payload.value}× · ${fmt(payload.valorMonetario)} · ${payload.pct}%`}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={2}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full space-y-2 min-w-0">
          {data.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: activeIndex === i ? 'var(--t-primary-light)' : 'transparent' }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                <span className="text-xs font-medium truncate" style={{ color: 'var(--t-text-primary)' }}>{entry.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>{entry.value}×</span>
                <span className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                  {entry.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
