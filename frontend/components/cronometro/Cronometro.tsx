'use client';

// Cronômetro de atividades longas: cartão flutuante em todas as telas (e numa janelinha
// destacável, /cronometro, para acompanhar mesmo usando outros programas).
// Iniciar, pausar com motivo, retomar e finalizar. O servidor guarda tudo (relatório "Meu tempo").

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Crono = { id: string; titulo: string; status: 'RODANDO' | 'PAUSADO' | 'FINALIZADO'; segundos_agora: number };

export const fmtDuracao = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
};

const EVENTO = 'crono-mudou';
export const avisarCronometroMudou = () => { try { window.dispatchEvent(new Event(EVENTO)); localStorage.setItem('crono_mudou', String(Date.now())); } catch { /* ok */ } };

/** Estado compartilhado: busca o cronômetro aberto, conta os segundos na tela e sincroniza entre abas/janelas. */
export function useCronometro() {
  const [c, setC] = useState<Crono | null>(null);
  const [base, setBase] = useState<{ seg: number; em: number }>({ seg: 0, em: Date.now() });
  const [agora, setAgora] = useState(Date.now());
  const carregar = useCallback(() => apiClient.cronometroAtivo().then(r => { const x = r.data.data; setC(x); setBase({ seg: x?.segundos_agora || 0, em: Date.now() }); }).catch(() => {}), []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 20_000);
    const f = () => carregar();
    const s = (e: StorageEvent) => { if (e.key === 'crono_mudou') carregar(); };
    window.addEventListener(EVENTO, f); window.addEventListener('storage', s);
    return () => { clearInterval(t); window.removeEventListener(EVENTO, f); window.removeEventListener('storage', s); };
  }, [carregar]);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const segundos = c ? base.seg + (c.status === 'RODANDO' ? Math.round((agora - base.em) / 1000) : 0) : 0;
  return { c, segundos, recarregar: carregar };
}

/** Controles do cronômetro (usado no cartão flutuante e na janelinha). */
export function ControlesCronometro({ compacto = false, aoMudar }: { compacto?: boolean; aoMudar?: () => void }) {
  const { c, segundos, recarregar } = useCronometro();
  const [titulo, setTitulo] = useState('');
  const [modo, setModo] = useState<null | 'pausar' | 'finalizar'>(null);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const agir = async (fn: () => Promise<any>) => {
    setOcupado(true); setMsg(null);
    try { const r = await fn(); if (r?.data?.message) setMsg(r.data.message); setModo(null); setTexto(''); avisarCronometroMudou(); await recarregar(); aoMudar?.(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo. Tente de novo.'); }
    finally { setOcupado(false); }
  };
  const btn = (cor: string, fundo: string): React.CSSProperties => ({ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, color: cor, background: fundo, cursor: 'pointer' });

  if (!c) {
    return (
      <form onSubmit={e => { e.preventDefault(); if (titulo.trim()) agir(() => apiClient.cronometroIniciar(titulo.trim())); }} style={{ display: 'grid', gap: 8 }}>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que você vai fazer? (ex.: revisar propostas)" maxLength={255}
          style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 16 }} />
        <button type="submit" disabled={ocupado || !titulo.trim()} style={{ ...btn('#fff', '#16a34a'), opacity: titulo.trim() ? 1 : 0.5 }}>▶ Iniciar cronômetro</button>
        {msg && <span style={{ fontSize: 12, color: '#dc2626' }}>{msg}</span>}
      </form>
    );
  }
  const rodando = c.status === 'RODANDO';
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: rodando ? '#16a34a' : '#f59e0b', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.titulo}>{c.titulo}</span>
        <span style={{ fontSize: 11, color: rodando ? '#16a34a' : '#b45309', fontWeight: 700, marginLeft: 'auto', flexShrink: 0 }}>{rodando ? 'rodando' : 'pausado'}</span>
      </div>
      <div style={{ fontSize: compacto ? 30 : 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--t-text-primary)', letterSpacing: 1 }}>{fmtDuracao(segundos)}</div>
      {modo ? (
        <form onSubmit={e => { e.preventDefault(); agir(() => modo === 'pausar' ? apiClient.cronometroPausar(c.id, texto) : apiClient.cronometroFinalizar(c.id, texto)); }} style={{ display: 'grid', gap: 6 }}>
          <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} maxLength={500}
            placeholder={modo === 'pausar' ? 'Motivo da pausa (ex.: almoço, reunião, ligação)' : 'Como terminou? (opcional)'}
            style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 16 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={ocupado || (modo === 'pausar' && texto.trim().length < 2)} style={{ ...btn('#fff', modo === 'pausar' ? '#f59e0b' : '#dc2626'), flex: 1 }}>{modo === 'pausar' ? '⏸ Pausar' : '■ Finalizar'}</button>
            <button type="button" onClick={() => { setModo(null); setTexto(''); }} style={btn('var(--t-text-secondary)', 'var(--t-content-bg)')}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rodando
            ? <button onClick={() => setModo('pausar')} style={{ ...btn('#fff', '#f59e0b'), flex: 1 }}>⏸ Pausar</button>
            : <button onClick={() => agir(() => apiClient.cronometroRetomar(c.id))} disabled={ocupado} style={{ ...btn('#fff', '#16a34a'), flex: 1 }}>▶ Retomar</button>}
          <button onClick={() => setModo('finalizar')} style={{ ...btn('#fff', '#dc2626'), flex: 1 }}>■ Finalizar</button>
        </div>
      )}
      {msg && <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{msg}</span>}
    </div>
  );
}

/** Cartão flutuante em todas as telas: aberto quando há cronômetro; senão, só um botão ⏱. */
export default function CronometroFlutuante() {
  const { c, segundos } = useCronometro();
  const [aberto, setAberto] = useState(false);
  const destacar = () => { window.open('/cronometro', 'cronometro-prosystem', 'width=360,height=300,menubar=no,toolbar=no,location=no,status=no'); };
  const ativo = !!c;
  return (
    <div className="crono-flutuante" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 74 }}>
      {aberto ? (
        <div style={{ width: 300, maxWidth: 'calc(100vw - 32px)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>⏱ Cronômetro</b>
            <div style={{ display: 'flex', gap: 4 }}>
              <a href="/meu-tempo" title="Meu tempo (relatório)" style={{ fontSize: 12, padding: '6px 8px', color: 'var(--t-primary)' }}>Meu tempo</a>
              <button onClick={destacar} title="Abrir numa janelinha separada" className="ios-so-computador" style={{ fontSize: 12, padding: '6px 8px', border: 'none', background: 'none', color: 'var(--t-primary)', cursor: 'pointer' }}>↗ Destacar</button>
              <button onClick={() => setAberto(false)} aria-label="Recolher" style={{ minWidth: 32, minHeight: 32, border: 'none', background: 'var(--t-content-bg)', borderRadius: 8, cursor: 'pointer' }}>–</button>
            </div>
          </div>
          <ControlesCronometro />
        </div>
      ) : (
        <button onClick={() => setAberto(true)} aria-label={ativo ? `Cronômetro: ${c!.titulo}` : 'Abrir cronômetro'}
          style={{ minHeight: 40, padding: '0 14px', borderRadius: 20, border: '1px solid var(--t-card-border)', background: ativo ? (c!.status === 'RODANDO' ? '#16a34a' : '#f59e0b') : 'var(--t-card-bg)', color: ativo ? '#fff' : 'var(--t-text-secondary)', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {ativo ? fmtDuracao(segundos) : 'Cronômetro'}
        </button>
      )}
    </div>
  );
}
