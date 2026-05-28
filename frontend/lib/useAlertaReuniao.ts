'use client';

import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from './api-client';

export type AlertaReuniao = {
  id: string;
  titulo: string;
  tipo: string;
  lead_nome: string;
  data_prevista: Date;
  google_meet_link?: string;
  minutos_restantes: number;
};

type OnAlertaFn = (alerta: AlertaReuniao) => void;

const STORAGE_KEY = 'crm_alertas_disparados';
const MINUTOS_ANTECEDENCIA = 15; // padrão — usuário pode sobrescrever via localStorage

function getAlertasDisparados(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function marcarAlertaDisparado(chave: string) {
  const disparados = getAlertasDisparados();
  disparados.add(chave);
  // Limpa alertas antigos (mais de 24h) para não acumular indefinidamente
  const agora = Date.now();
  const filtrados = [...disparados].filter(k => {
    const ts = parseInt(k.split('_').pop() || '0', 10);
    return agora - ts < 24 * 60 * 60 * 1000;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
}

export function tocarSomAlarme() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const tocar = (freq: number, inicio: number, duracao: number, volume = 0.4) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + inicio);
      gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + inicio + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracao);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao + 0.1);
    };

    // Três notas — chime suave
    tocar(880, 0.0, 0.4);
    tocar(1108, 0.3, 0.4);
    tocar(1320, 0.6, 0.6);
    tocar(880, 1.0, 0.8, 0.3);
  } catch {
    // AudioContext bloqueado (sem interação do usuário) — silencia sem erro
  }
}

export function useAlertaReuniao(onAlerta: OnAlertaFn) {
  const onAlertaRef = useRef(onAlerta);
  onAlertaRef.current = onAlerta;

  const verificar = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    const minutos = parseInt(
      localStorage.getItem('crm_alerta_minutos') || String(MINUTOS_ANTECEDENCIA),
      10
    );

    try {
      // Busca TODOS os tipos de compromisso (reuniões, ligações, visitas, tarefas etc)
      const res = await apiClient.getAtividades({
        status: 'PENDENTE,CONFIRMADA,AGUARDANDO_RETORNO',
        limit: 50
      });

      const atividades: any[] = res.data.data?.atividades || [];
      const agora = new Date();

      for (const at of atividades) {
        if (!at.data_prevista) continue;

        const data = new Date(at.data_prevista);
        const diffMs = data.getTime() - agora.getTime();
        const diffMin = diffMs / 60000;

        // Dentro da janela de alerta (entre 0 e minutos+1 para não perder por timing)
        if (diffMin <= minutos && diffMin > -1) {
          const chave = `${at.id}_${Math.floor(data.getTime() / 60000)}_${Date.now()}`;
          const chaveBase = `${at.id}_${Math.floor(data.getTime() / 60000)}`;

          const disparados = getAlertasDisparados();
          const jaDisparou = [...disparados].some(k => k.startsWith(chaveBase));

          if (!jaDisparou) {
            marcarAlertaDisparado(chave);
            onAlertaRef.current({
              id: at.id,
              titulo: at.titulo,
              tipo: at.tipo || 'TAREFA',
              lead_nome: at.lead?.nome || '',
              data_prevista: data,
              google_meet_link: at.google_meet_link,
              minutos_restantes: Math.max(0, Math.round(diffMin))
            });
          }
        }
      }
    } catch {
      // silencia erros de rede
    }
  }, []);

  useEffect(() => {
    // Verificação inicial após 5s (aguarda app carregar)
    const inicial = setTimeout(verificar, 5000);
    // Depois verifica a cada 60s
    const intervalo = setInterval(verificar, 60 * 1000);

    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
    };
  }, [verificar]);
}
