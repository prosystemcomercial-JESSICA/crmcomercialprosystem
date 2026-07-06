'use client';

import React from 'react';

export type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'cyan' | 'gray' | 'indigo' | 'pink';

interface StatusBadgeProps {
  label: string;
  color?: BadgeColor;
  /** Ponto indicador à esquerda */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

// Tokens de cor para badges — usam variáveis CSS com fallback seguro.
// Garante consistência no light e dark mode sem classes Tailwind hardcoded.
const COLOR_MAP: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'rgba(75,142,200,0.12)',  text: 'var(--t-primary-dark)',   border: 'rgba(75,142,200,0.30)' },
  green:  { bg: 'rgba(22,163,74,0.12)',   text: '#15803d',                  border: 'rgba(22,163,74,0.30)' },
  yellow: { bg: 'rgba(217,119,6,0.12)',   text: '#b45309',                  border: 'rgba(217,119,6,0.30)' },
  red:    { bg: 'rgba(220,38,38,0.12)',   text: '#b91c1c',                  border: 'rgba(220,38,38,0.30)' },
  purple: { bg: 'rgba(124,58,237,0.12)',  text: '#6d28d9',                  border: 'rgba(124,58,237,0.30)' },
  orange: { bg: 'rgba(234,88,12,0.12)',   text: '#c2410c',                  border: 'rgba(234,88,12,0.30)' },
  cyan:   { bg: 'rgba(8,145,178,0.12)',   text: '#0e7490',                  border: 'rgba(8,145,178,0.30)' },
  gray:   { bg: 'rgba(100,116,139,0.12)', text: 'var(--t-text-secondary)',  border: 'rgba(100,116,139,0.25)' },
  indigo: { bg: 'rgba(67,56,202,0.12)',   text: '#4338ca',                  border: 'rgba(67,56,202,0.30)' },
  pink:   { bg: 'rgba(219,39,119,0.12)',  text: '#be185d',                  border: 'rgba(219,39,119,0.30)' },
};

/**
 * Badge de status unificado — substitui todas as classes bg-*-100 text-*-700
 * hardcoded espalhadas pelas telas (indicações, ativos, comercial, etc.).
 * Compatível com dark mode via variáveis de cor com opacidade.
 */
export function StatusBadge({ label, color = 'gray', dot = false, size = 'md', className = '' }: StatusBadgeProps) {
  const c = COLOR_MAP[color];
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fs = size === 'sm' ? 11 : 12;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${className}`}
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: pad, fontSize: fs, lineHeight: 1.4 }}
    >
      {dot && (
        <span
          className="flex-shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: c.text, opacity: 0.8 }}
        />
      )}
      {label}
    </span>
  );
}

// ── Helpers: mapeia strings conhecidas do sistema para cores ──────────────────

/** Cor para status de lead/venda */
export function leadStatusColor(status: string): BadgeColor {
  const map: Record<string, BadgeColor> = {
    PROSPECCAO: 'gray', QUALIFICACAO: 'blue', APRESENTACAO: 'cyan',
    PROPOSTA: 'purple', NEGOCIACAO: 'yellow', FECHAMENTO: 'orange',
    GANHO: 'green', PERDIDO: 'red',
  };
  return map[status?.toUpperCase()] ?? 'gray';
}

/** Cor para temperatura de lead */
export function tempColor(temp: string): BadgeColor {
  const map: Record<string, BadgeColor> = {
    QUENTE: 'red', MORNO: 'orange', FRIO: 'blue', GELADO: 'cyan',
  };
  return map[temp?.toUpperCase()] ?? 'gray';
}

/** Cor para status de venda adicional/indicação */
export function vendaStatusColor(status: string): BadgeColor {
  const map: Record<string, BadgeColor> = {
    PENDENTE: 'yellow', CONFIRMADA: 'green', CANCELADA: 'red',
    EM_ANDAMENTO: 'blue', CONCLUIDA: 'green', PERDIDA: 'red',
  };
  return map[status?.toUpperCase()] ?? 'gray';
}

/** Cor para categoria de venda adicional */
export function vendaCatColor(cat: string): BadgeColor {
  const map: Record<string, BadgeColor> = {
    TROCA_CNPJ: 'blue', MODULO_EXTRA: 'purple', UPGRADE_PLANO: 'green',
    NOVA_MAQUINA: 'cyan', TREINAMENTO: 'indigo', OUTRO: 'gray',
  };
  return map[cat?.toUpperCase()] ?? 'gray';
}
