'use client';

// Uma bolinha por número de WhatsApp cadastrado (pedido da Jessica, 14/10/2026): não ocupa espaço na tela e,
// ao passar o mouse, focar pelo teclado ou tocar, mostra o número completo e o estado da conexão.
// O número em si só se gerencia em Configurações → Números de WhatsApp.

import { useState } from 'react';

export interface NumeroResumo {
  vaga: string;
  rotulo: string;
  provedor: 'UAZAPI' | 'GRATIS';
  principal: boolean;
  numero: string | null;
  status: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO' | string;
  ja_conectou: boolean;
  pausada_motivo: string | null;
}

/** Estado legível + cor de cada número. */
export function estadoDoNumero(n: NumeroResumo): { texto: string; cor: string; pulsa: boolean } {
  if (n.status === 'CONECTADO') return n.pausada_motivo
    ? { texto: `Conectado, rodízio pausado (${n.pausada_motivo})`, cor: '#f59e0b', pulsa: false }
    : { texto: 'Conectado', cor: '#22c55e', pulsa: false };
  if (n.status === 'CONECTANDO') return { texto: 'Conectando…', cor: '#eab308', pulsa: true };
  if (n.ja_conectou) return { texto: 'Caiu a conexão: reconecte em Configurações', cor: '#ef4444', pulsa: true };
  return { texto: 'Cadastrado, aguardando conectar', cor: '#9ca3af', pulsa: false };
}

/** 5527997521370 → +55 (27) 99752-1370 */
export function formatarNumero(n: string | null): string {
  const d = (n || '').replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return n || 'sem número ainda';
}

export default function BolinhasNumeros({ numeros }: { numeros: NumeroResumo[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (!numeros.length) return null;
  const conectados = numeros.filter(n => n.status === 'CONECTADO').length;
  return (
    <div className="flex items-center gap-1.5" role="list" aria-label={`Números de WhatsApp: ${conectados} de ${numeros.length} conectados`}>
      {numeros.map(n => {
        const e = estadoDoNumero(n);
        const dica = `${n.rotulo}: ${formatarNumero(n.numero)} · ${e.texto}${n.provedor === 'GRATIS' ? ' · API gratuita' : ''}`;
        return (
          <span key={n.vaga} role="listitem" className="relative inline-flex">
            <button
              type="button"
              aria-label={dica}
              onMouseEnter={() => setAberta(n.vaga)} onMouseLeave={() => setAberta(v => (v === n.vaga ? null : v))}
              onFocus={() => setAberta(n.vaga)} onBlur={() => setAberta(v => (v === n.vaga ? null : v))}
              onClick={() => setAberta(v => (v === n.vaga ? null : n.vaga))}
              className="bolinha-numero inline-flex items-center justify-center rounded-full"
              style={{ width: 24, height: 24, background: 'transparent', border: 'none', cursor: 'default' }}
            >
              <span className={e.pulsa ? 'bolinha-pulsa' : ''} style={{ width: 10, height: 10, borderRadius: 999, background: e.cor, boxShadow: `0 0 0 2px ${e.cor}33`, display: 'block' }} />
            </button>
            {aberta === n.vaga && (
              <span role="tooltip" className="absolute left-1/2 top-full mt-1 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg px-3 py-2 text-xs shadow-lg"
                style={{ background: 'var(--t-card-bg, #fff)', color: 'var(--t-text-primary, #111827)', border: '1px solid var(--t-card-border, #e5e7eb)' }}>
                <b className="block">{n.rotulo}{n.principal ? ' (principal)' : ''}</b>
                <span className="block tabular-nums">{formatarNumero(n.numero)}</span>
                <span className="block" style={{ color: e.cor }}>● {e.texto}</span>
              </span>
            )}
          </span>
        );
      })}
      <style>{`.bolinha-pulsa{animation:bolinhaPulsa 1.4s ease-in-out infinite}@keyframes bolinhaPulsa{0%,100%{opacity:1}50%{opacity:.45}}@media (prefers-reduced-motion: reduce){.bolinha-pulsa{animation:none}}.bolinha-numero:focus-visible{outline:2px solid var(--t-primary,#2563eb);outline-offset:1px}`}</style>
    </div>
  );
}
