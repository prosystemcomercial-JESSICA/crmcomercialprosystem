'use client';

import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface TemperaturaGaugeProps {
  quente: number;
  morno: number;
  frio: number;
}

export function TemperaturaGauge({ quente, morno, frio }: TemperaturaGaugeProps) {
  const total = quente + morno + frio;
  if (total === 0) return null;

  const data = [
    { name: 'Quente', value: quente, fill: '#dc2626' },
    { name: 'Morno', value: morno, fill: '#d97706' },
    { name: 'Frio', value: frio, fill: '#2563eb' },
  ];

  return (
    <div className="mt-4" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="30%"
          outerRadius="100%"
          data={data}
          startAngle={180}
          endAngle={0}
          barCategoryGap={4}
        >
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--t-card-border)' }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Legend
            iconType="circle"
            iconSize={8}
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            formatter={(value: string) => {
              const item = data.find(d => d.name === value);
              return <span style={{ color: 'var(--t-text-muted)', fontSize: 10, fontWeight: 600 }}>{value} {item?.value ?? 0}</span>;
            }}
          />
          <Tooltip content={<ChartTooltip />} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}
