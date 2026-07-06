'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Ícone Lucide passado como elemento JSX */
  icon?: React.ReactNode;
  /** Ações no lado direito (botões, filtros, etc.) */
  actions?: React.ReactNode;
  /** Badge/status abaixo do título (ex: "12 registros") */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de página — título, subtítulo, ações à direita.
 * Usa tokens do design system ProSystem (var(--t-*)) sem cores hardcoded.
 */
export function PageHeader({ title, subtitle, icon, actions, meta, className = '' }: PageHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 mb-6 ${className}`}
      style={{ borderBottom: '1px solid var(--t-card-border)', paddingBottom: '16px' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 40, height: 40,
              background: 'var(--t-primary-light)',
              color: 'var(--t-primary)',
              border: '1px solid var(--t-primary-border)',
            }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1
            className="font-bold truncate"
            style={{ fontSize: 20, color: 'var(--t-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.25 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--t-text-secondary)' }}>
              {subtitle}
            </p>
          )}
          {meta && <div className="mt-1">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Badge de contagem para usar em PageHeader.meta */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5"
      style={{
        background: 'var(--t-primary-light)',
        color: 'var(--t-primary-dark)',
        border: '1px solid var(--t-primary-border)',
      }}
    >
      {count.toLocaleString('pt-BR')}
      {label && <span style={{ color: 'var(--t-text-muted)', fontWeight: 400 }}>{label}</span>}
    </span>
  );
}
