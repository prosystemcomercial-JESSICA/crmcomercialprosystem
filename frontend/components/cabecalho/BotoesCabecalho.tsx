'use client';

// Cronômetro e alerta de reunião no cabeçalho, ao lado da lua (pedido da Jessica, 14/10/2026).
// Antes eram botões flutuantes nos cantos da tela, por cima do conteúdo.

import { useEffect, useRef, useState } from 'react';
import { AlarmClock, Timer } from 'lucide-react';
import { ControlesCronometro, useCronometro, fmtDuracao } from '@/components/cronometro/Cronometro';

const menu: React.CSSProperties = {
  position: 'absolute', top: 40, right: 0, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)',
  borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 80,
};
const botao: React.CSSProperties = { color: 'var(--t-text-muted)', background: 'transparent' };

/** Fecha o menu ao clicar fora ou apertar Esc. */
function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('mousedown', clique); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', clique); document.removeEventListener('keydown', tecla); };
  }, [aberto, fechar]);
  return ref;
}

/** Cronômetro de atividades longas: só o ícone; rodando, mostra o tempo (verde) ou pausado (âmbar). */
export function BotaoCronometro() {
  const { c, segundos } = useCronometro();
  const [aberto, setAberto] = useState(false);
  const ref = useFecharFora(aberto, () => setAberto(false));
  const destacar = () => { window.open('/cronometro', 'cronometro-prosystem', 'width=360,height=300,menubar=no,toolbar=no,location=no,status=no'); };
  const cor = c ? (c.status === 'RODANDO' ? '#16a34a' : '#d97706') : null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        title={c ? `Cronômetro: ${c.titulo} (${c.status === 'RODANDO' ? 'rodando' : 'pausado'})` : 'Cronômetro'}
        aria-label={c ? `Cronômetro: ${c.titulo}, ${fmtDuracao(segundos)}` : 'Abrir cronômetro'}
        aria-expanded={aberto}
        className="h-8 rounded-lg flex items-center justify-center gap-1 transition-colors"
        style={cor ? { padding: '0 8px', color: cor, background: `${cor}1a`, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } : { ...botao, width: 32 }}
        onMouseEnter={e => { if (!cor) e.currentTarget.style.background = 'var(--t-card-border)'; }}
        onMouseLeave={e => { if (!cor) e.currentTarget.style.background = 'transparent'; }}
      >
        <Timer size={15} />
        {c && <span className="hidden sm:inline">{fmtDuracao(segundos)}</span>}
      </button>
      {aberto && (
        <div style={{ ...menu, width: 300, maxWidth: 'calc(100vw - 24px)', padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>Cronômetro</b>
            <div style={{ display: 'flex', gap: 4 }}>
              <a href="/meu-tempo" style={{ fontSize: 12, padding: '6px 8px', color: 'var(--t-primary)' }}>Meu tempo</a>
              <button onClick={destacar} title="Abrir numa janelinha separada" className="ios-so-computador" style={{ fontSize: 12, padding: '6px 8px', border: 'none', background: 'none', color: 'var(--t-primary)', cursor: 'pointer' }}>↗ Destacar</button>
            </div>
          </div>
          <ControlesCronometro />
        </div>
      )}
    </div>
  );
}

const OPCOES_MINUTOS = [5, 10, 15, 30];

/** Antecedência do alerta de reunião (o aviso em si continua aparecendo no canto quando chega a hora). */
export function BotaoAlertaReuniao() {
  const [minutos, setMinutos] = useState(15);
  const [aberto, setAberto] = useState(false);
  const ref = useFecharFora(aberto, () => setAberto(false));
  useEffect(() => { try { setMinutos(parseInt(localStorage.getItem('crm_alerta_minutos') || '15', 10) || 15); } catch { /* ok */ } }, []);
  const salvar = (min: number) => {
    setMinutos(min); setAberto(false);
    try { localStorage.setItem('crm_alerta_minutos', String(min)); } catch { /* ok */ }
  };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        title={`Alerta de reunião: ${minutos} min antes`}
        aria-label={`Alerta de reunião ${minutos} minutos antes. Mudar`}
        aria-expanded={aberto}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
        style={botao}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-card-border)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <AlarmClock size={15} />
        <span aria-hidden style={{ position: 'absolute', right: 1, bottom: 1, fontSize: 8, fontWeight: 800, lineHeight: 1, color: 'var(--t-text-muted)' }}>{minutos}</span>
      </button>
      {aberto && (
        <div role="menu" style={{ ...menu, width: 190, padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)', padding: '4px 8px 8px' }}>Alertar reunião antes:</div>
          {OPCOES_MINUTOS.map(min => (
            <button key={min} role="menuitemradio" aria-checked={min === minutos} onClick={() => salvar(min)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 6, padding: '8px 10px', fontSize: 13, cursor: 'pointer',
                background: min === minutos ? 'var(--t-primary-light)' : 'transparent', color: min === minutos ? 'var(--t-primary)' : 'var(--t-text-secondary)', fontWeight: min === minutos ? 700 : 400 }}>
              {min === minutos ? '✓ ' : ''}{min} minutos
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
