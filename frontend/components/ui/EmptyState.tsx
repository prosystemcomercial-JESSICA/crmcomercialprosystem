'use client';

import React from 'react';
import { SearchX, Inbox, AlertCircle, PlusCircle } from 'lucide-react';

type EmptyStatePreset = 'search' | 'empty' | 'error' | 'filtered';

interface EmptyStateProps {
  preset?: EmptyStatePreset;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const PRESETS: Record<EmptyStatePreset, { icon: React.ReactNode; title: string; description: string }> = {
  search:   { icon: <SearchX size={32} />, title: 'Nenhum resultado',     description: 'Tente ajustar os filtros ou o termo de busca.' },
  empty:    { icon: <Inbox size={32} />,   title: 'Nenhum registro',       description: 'Ainda não há dados para exibir aqui.' },
  error:    { icon: <AlertCircle size={32} />, title: 'Erro ao carregar',  description: 'Não foi possível carregar os dados. Tente novamente.' },
  filtered: { icon: <SearchX size={32} />, title: 'Sem resultados',        description: 'Nenhum item corresponde aos filtros aplicados.' },
};

/**
 * Estado vazio reutilizável — sem emojis, sem linguagem de IA.
 * Substitui os "Nenhum X encontrado" espalhados pelas telas.
 */
export function EmptyState({
  preset = 'empty', title, description, icon, action, className = '', compact = false,
}: EmptyStateProps) {
  const p = PRESETS[preset];
  const resolvedIcon = icon ?? p.icon;
  const resolvedTitle = title ?? p.title;
  const resolvedDesc = description ?? p.description;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 py-6 px-4 ${className}`}>
        <span style={{ color: 'var(--t-text-muted)', opacity: 0.6 }}>{resolvedIcon}</span>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--t-text-secondary)' }}>{resolvedTitle}</p>
          {resolvedDesc && <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{resolvedDesc}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div
        className="flex items-center justify-center rounded-2xl mb-4"
        style={{
          width: 64, height: 64,
          background: 'var(--t-primary-light)',
          color: 'var(--t-primary-muted)',
          border: '1px solid var(--t-primary-border)',
        }}
      >
        {resolvedIcon}
      </div>
      <p className="font-semibold text-base mb-1" style={{ color: 'var(--t-text-primary)' }}>
        {resolvedTitle}
      </p>
      <p className="text-sm max-w-xs" style={{ color: 'var(--t-text-muted)' }}>
        {resolvedDesc}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Ação padrão de "Adicionar primeiro registro" */
export function EmptyStateAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="ps-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
    >
      <PlusCircle size={15} />
      {label}
    </button>
  );
}
