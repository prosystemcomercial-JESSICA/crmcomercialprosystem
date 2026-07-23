'use client';

import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: any, name: string, payload: any) => React.ReactNode;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="ps-card rounded-lg px-3 py-2 shadow-lg"
      style={{
        background: 'var(--t-card-bg)',
        border: '1px solid var(--t-card-border)',
        minWidth: 140,
      }}
    >
      {label && (
        <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--t-text-primary)' }}>
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: entry.color || entry.fill || 'var(--t-primary)' }}
              />
              <span className="text-[10px] truncate" style={{ color: 'var(--t-text-secondary)' }}>
                {entry.name}
              </span>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: 'var(--t-text-primary)' }}>
              {formatter ? formatter(entry.value, entry.name, entry.payload) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
