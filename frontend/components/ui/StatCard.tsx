'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';

interface StatCardProps {
  title: string;
  value: string | number;
  /** Variação percentual ou absoluta (ex: +12% ou -3) */
  delta?: number;
  deltaLabel?: string;
  /** Ícone Lucide */
  icon?: React.ReactNode;
  variant?: StatCardVariant;
  /** Subtexto abaixo do valor */
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
}

const VARIANT_STYLES: Record<StatCardVariant, { iconBg: string; iconColor: string; accent: string }> = {
  default:  { iconBg: 'var(--t-primary-light)',  iconColor: 'var(--t-primary)',      accent: 'var(--t-primary)' },
  primary:  { iconBg: 'var(--t-primary-light)',  iconColor: 'var(--t-primary-dark)', accent: 'var(--t-primary-dark)' },
  success:  { iconBg: 'rgba(22,163,74,0.10)',    iconColor: '#16a34a',               accent: '#16a34a' },
  warning:  { iconBg: 'rgba(217,119,6,0.10)',    iconColor: '#d97706',               accent: '#d97706' },
  danger:   { iconBg: 'rgba(220,38,38,0.10)',    iconColor: '#dc2626',               accent: '#dc2626' },
  muted:    { iconBg: 'rgba(100,116,139,0.10)',  iconColor: 'var(--t-text-muted)',   accent: 'var(--t-text-muted)' },
};

/**
 * Card de métrica/KPI reutilizável.
 * Substitui todos os MetricCard/KPICard espalhados pelas telas.
 */
export function StatCard({
  title, value, delta, deltaLabel, icon, variant = 'default',
  footer, className = '', onClick, loading = false,
}: StatCardProps) {
  const vs = VARIANT_STYLES[variant];
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  return (
    <div
      className={`ps-card flex flex-col gap-3 p-4 sm:p-5 ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Header: título + ícone */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)', letterSpacing: '0.07em' }}>
          {title}
        </span>
        {icon && (
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: vs.iconBg, color: vs.iconColor }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Valor principal */}
      {loading ? (
        <div className="h-8 rounded animate-pulse" style={{ background: 'var(--t-card-border)', width: '60%' }} />
      ) : (
        <span
          className="font-black leading-none"
          style={{ fontSize: 26, color: 'var(--t-text-primary)', letterSpacing: '-0.03em' }}
        >
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </span>
      )}

      {/* Delta de variação */}
      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md"
            style={{
              background: isPositive ? 'rgba(22,163,74,0.10)' : isNegative ? 'rgba(220,38,38,0.10)' : 'rgba(100,116,139,0.10)',
              color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : 'var(--t-text-muted)',
            }}
          >
            {isPositive ? <TrendingUp size={11} /> : isNegative ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
          {deltaLabel && (
            <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{deltaLabel}</span>
          )}
        </div>
      )}

      {/* Footer opcional */}
      {footer && (
        <div className="text-xs pt-2 border-t" style={{ color: 'var(--t-text-muted)', borderColor: 'var(--t-card-border)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
