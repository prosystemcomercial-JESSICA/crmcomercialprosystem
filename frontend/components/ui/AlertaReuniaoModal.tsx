'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Video, Clock, X, Bell, ExternalLink, Volume2, AlarmClock } from 'lucide-react';
import { useAlertaReuniao, tocarSomAlarme, setSnooze, clearSnooze, AlertaReuniao } from '@/lib/useAlertaReuniao';
import { useAuth } from '@/lib/auth-context';

const OPCOES_MINUTOS = [5, 10, 15, 30];

export function AlertaReuniaoModal() {
  const { isAuthenticated } = useAuth();
  const [fila, setFila] = useState<AlertaReuniao[]>([]);
  const [configurando, setConfigurando] = useState(false);
  const [minutosSalvos, setMinutosSalvos] = useState(15);
  const intervaloSomRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const salvo = parseInt(localStorage.getItem('crm_alerta_minutos') || '15', 10);
    setMinutosSalvos(salvo);
  }, []);

  // SOM PERSISTENTE — toca a cada 2s enquanto houver fila
  useEffect(() => {
    if (fila.length > 0) {
      tocarSomAlarme();
      intervaloSomRef.current = setInterval(() => {
        tocarSomAlarme();
      }, 2000);
    } else {
      if (intervaloSomRef.current) {
        clearInterval(intervaloSomRef.current);
        intervaloSomRef.current = null;
      }
    }
    return () => {
      if (intervaloSomRef.current) {
        clearInterval(intervaloSomRef.current);
        intervaloSomRef.current = null;
      }
    };
  }, [fila.length]);

  const onAlerta = useCallback((alerta: AlertaReuniao) => {
    setFila(prev => {
      // Atualiza minutos_restantes se já está na fila
      const existe = prev.find(a => a.id === alerta.id);
      if (existe) {
        return prev.map(a => a.id === alerta.id ? alerta : a);
      }
      return [...prev, alerta];
    });

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const tipoLabel: Record<string, string> = {
        REUNIAO: 'Reunião', LIGACAO: 'Ligação', EMAIL: 'E-mail',
        WHATSAPP: 'WhatsApp', VISITA: 'Visita', TAREFA: 'Tarefa', OUTRO: 'Compromisso'
      };
      const titulo = tipoLabel[alerta.tipo] || 'Compromisso';
      if (Notification.permission === 'granted') {
        new Notification(`⏰ ${titulo} — ProSystem CRM`, {
          body: `${alerta.titulo}${alerta.lead_nome ? ` · ${alerta.lead_nome}` : ''}`,
          icon: '/logo-prosystem.png'
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  useAlertaReuniao(isAuthenticated ? onAlerta : () => {});

  const dispensar = (id: string) => {
    clearSnooze(id);
    setFila(prev => prev.filter(a => a.id !== id));
  };

  const adiarLembrete = (alerta: AlertaReuniao, minutos: number) => {
    // Verifica se já dá pra adiar — minutos disponíveis até a reunião
    const minutosAteReuniao = (alerta.data_prevista.getTime() - Date.now()) / 60000;
    if (minutosAteReuniao < minutos) {
      alert(
        `⚠️ Não é possível adiar ${minutos} minutos.\n\n` +
        `O compromisso é às ${alerta.data_prevista.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.\n\n` +
        `Não se atrase, seu compromisso é muito importante!`
      );
      return;
    }
    setSnooze(alerta.id, minutos);
    setFila(prev => prev.filter(a => a.id !== alerta.id));
  };

  const salvarMinutos = (min: number) => {
    setMinutosSalvos(min);
    localStorage.setItem('crm_alerta_minutos', String(min));
    setConfigurando(false);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

        {fila.map((alerta) => {
          const passou = alerta.minutos_restantes <= 0;
          const minutosAteReuniao = (alerta.data_prevista.getTime() - Date.now()) / 60000;
          const podeAdiar5 = minutosAteReuniao >= 5;
          const podeAdiar10 = minutosAteReuniao >= 10;
          const horarioReuniao = alerta.data_prevista.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={alerta.id} style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: passou ? '0 8px 32px rgba(220,38,38,0.35)' : '0 8px 32px rgba(13,34,56,0.18)',
              border: passou ? '2px solid #dc2626' : '2px solid #4B8EC8',
              padding: '16px 18px',
              width: 340,
              animation: 'slideIn 0.3s ease, shake 0.6s ease infinite alternate'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    background: passou ? '#fee2e2' : '#EBF4FF',
                    borderRadius: 8, padding: 6,
                    animation: 'pulse 1s infinite'
                  }}>
                    <Bell size={16} color={passou ? '#dc2626' : '#4B8EC8'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: passou ? '#dc2626' : '#4B8EC8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {passou
                        ? `⚠️ Já são ${horarioReuniao}!`
                        : alerta.minutos_restantes === 0 ? 'Compromisso agora!' : `Em ${alerta.minutos_restantes} min`}
                    </div>
                  </div>
                </div>
                <button onClick={() => dispensar(alerta.id)}
                  title="Dispensar (para o som)"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2238', marginBottom: 4 }}>
                {alerta.titulo}
              </div>
              {alerta.lead_nome && (
                <div style={{ fontSize: 13, color: '#4A6E8A', marginBottom: 8 }}>
                  {alerta.lead_nome}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
                padding: passou ? '6px 10px' : 0,
                background: passou ? '#fef2f2' : 'transparent',
                borderRadius: 6
              }}>
                <Clock size={13} color={passou ? '#dc2626' : '#64748b'} />
                <span style={{ fontSize: 12, color: passou ? '#dc2626' : '#64748b', fontWeight: passou ? 700 : 400 }}>
                  {passou
                    ? `Não se atrase, seu compromisso é muito importante!`
                    : `Início: ${horarioReuniao}`}
                </span>
              </div>

              {/* Snooze buttons */}
              {!passou && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={() => adiarLembrete(alerta, 5)}
                    disabled={!podeAdiar5}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
                      borderRadius: 6, padding: '6px 8px', fontSize: 11, fontWeight: 600,
                      cursor: podeAdiar5 ? 'pointer' : 'not-allowed', opacity: podeAdiar5 ? 1 : 0.4
                    }}>
                    <AlarmClock size={11} /> +5 min
                  </button>
                  <button onClick={() => adiarLembrete(alerta, 10)}
                    disabled={!podeAdiar10}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
                      borderRadius: 6, padding: '6px 8px', fontSize: 11, fontWeight: 600,
                      cursor: podeAdiar10 ? 'pointer' : 'not-allowed', opacity: podeAdiar10 ? 1 : 0.4
                    }}>
                    <AlarmClock size={11} /> +10 min
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {alerta.google_meet_link && (
                  <a href={alerta.google_meet_link} target="_blank" rel="noreferrer"
                    onClick={() => dispensar(alerta.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
                      color: '#fff', borderRadius: 8, padding: '8px 12px',
                      fontSize: 13, fontWeight: 600, textDecoration: 'none'
                    }}>
                    <Video size={13} /> Entrar no Meet <ExternalLink size={11} />
                  </a>
                )}
                <button onClick={() => dispensar(alerta.id)}
                  style={{
                    background: passou ? '#dc2626' : '#f1f5f9',
                    color: passou ? '#fff' : '#64748b',
                    border: 'none', borderRadius: 8, padding: '8px 14px',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    flex: alerta.google_meet_link ? 0 : 1
                  }}>
                  Dispensar
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setConfigurando(v => !v)}
          title={`Alerta ${minutosSalvos} min antes`}
          style={{
            background: '#fff', border: '1.5px solid #C3DCFC', borderRadius: 50,
            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontSize: 12, color: '#4A6E8A', fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
          <Bell size={13} /> {minutosSalvos} min antes
        </button>

        {configurando && (
          <div style={{
            background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0', padding: 16, width: 200
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 10 }}>
              Alertar antes:
            </div>
            {OPCOES_MINUTOS.map(min => (
              <button key={min} onClick={() => salvarMinutos(min)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: min === minutosSalvos ? '#EBF4FF' : 'none',
                  border: 'none', borderRadius: 6, padding: '7px 10px',
                  fontSize: 13, color: min === minutosSalvos ? '#4B8EC8' : '#4A6E8A',
                  fontWeight: min === minutosSalvos ? 700 : 400, cursor: 'pointer'
                }}>
                {min === minutosSalvos ? '✓ ' : ''}{min} minutos
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes shake { 0% { transform: translateX(0) } 100% { transform: translateX(2px) } }
      `}</style>
    </>
  );
}
