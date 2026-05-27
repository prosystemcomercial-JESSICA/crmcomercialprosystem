'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Clock, X, Bell, ExternalLink, Volume2 } from 'lucide-react';
import { useAlertaReuniao, tocarSomAlarme, AlertaReuniao } from '@/lib/useAlertaReuniao';
import { useAuth } from '@/lib/auth-context';

const OPCOES_MINUTOS = [5, 10, 15, 30];

export function AlertaReuniaoModal() {
  const { isAuthenticated } = useAuth();
  const [fila, setFila] = useState<AlertaReuniao[]>([]);
  const [configurando, setConfigurando] = useState(false);
  const [minutosSalvos, setMinutosSalvos] = useState(15);

  useEffect(() => {
    const salvo = parseInt(localStorage.getItem('crm_alerta_minutos') || '15', 10);
    setMinutosSalvos(salvo);
  }, []);

  const onAlerta = useCallback((alerta: AlertaReuniao) => {
    setFila(prev => {
      if (prev.some(a => a.id === alerta.id)) return prev;
      return [...prev, alerta];
    });
    tocarSomAlarme();

    // Notificação nativa do browser (se permitido)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('⏰ Reunião em breve — ProSystem CRM', {
          body: `${alerta.titulo}${alerta.lead_nome ? ` · ${alerta.lead_nome}` : ''} — em ${alerta.minutos_restantes} min`,
          icon: '/logo-prosystem.png'
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  useAlertaReuniao(isAuthenticated ? onAlerta : () => {});

  const dispensar = (id: string) => setFila(prev => prev.filter(a => a.id !== id));
  const dispensarTodos = () => setFila([]);

  const salvarMinutos = (min: number) => {
    setMinutosSalvos(min);
    localStorage.setItem('crm_alerta_minutos', String(min));
    setConfigurando(false);
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Botão de configuração — canto inferior direito */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

        {/* Alertas na fila */}
        {fila.map((alerta) => (
          <div key={alerta.id} style={{
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(13,34,56,0.18)',
            border: '2px solid #4B8EC8',
            padding: '16px 18px',
            width: 320,
            animation: 'slideIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#EBF4FF', borderRadius: 8, padding: 6 }}>
                  <Bell size={16} color="#4B8EC8" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4B8EC8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Reunião em {alerta.minutos_restantes === 0 ? 'instantes' : `${alerta.minutos_restantes} min`}
                  </div>
                </div>
              </div>
              <button onClick={() => dispensar(alerta.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2238', marginBottom: 4 }}>
              {alerta.titulo}
            </div>
            {alerta.lead_nome && (
              <div style={{ fontSize: 13, color: '#4A6E8A', marginBottom: 10 }}>
                {alerta.lead_nome}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Clock size={13} color="#64748b" />
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {new Date(alerta.data_prevista).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {alerta.google_meet_link && (
                <a href={alerta.google_meet_link} target="_blank" rel="noreferrer"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
                    color: '#fff', borderRadius: 8, padding: '8px 12px',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none'
                  }}>
                  <Video size={13} /> Entrar no Meet <ExternalLink size={11} />
                </a>
              )}
              <button onClick={() => { tocarSomAlarme(); }}
                style={{ background: '#EBF4FF', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#4B8EC8' }}
                title="Tocar som novamente">
                <Volume2 size={14} />
              </button>
              <button onClick={() => dispensar(alerta.id)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                Dispensar
              </button>
            </div>
          </div>
        ))}

        {/* Botão de configuração do alerta */}
        <button
          onClick={() => setConfigurando(v => !v)}
          title={`Alerta ${minutosSalvos} min antes`}
          style={{
            background: '#fff',
            border: '1.5px solid #C3DCFC',
            borderRadius: 50,
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', fontSize: 12, color: '#4A6E8A', fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
          <Bell size={13} /> {minutosSalvos} min antes
        </button>

        {/* Popover de configuração */}
        {configurando && (
          <div style={{
            background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0', padding: 16, width: 200
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 10 }}>
              Alertar antes da reunião:
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
                {min === minutosSalvos ? '✓ ' : ''}{min} minutos antes
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
