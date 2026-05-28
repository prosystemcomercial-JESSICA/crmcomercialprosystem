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
const SNOOZE_KEY = 'crm_alertas_snooze'; // { [atividadeId]: timestamp_ate_quando_silenciar }
const MINUTOS_ANTECEDENCIA = 15;

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
  const agora = Date.now();
  const filtrados = [...disparados].filter(k => {
    const ts = parseInt(k.split('_').pop() || '0', 10);
    return agora - ts < 24 * 60 * 60 * 1000;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
}

export function getSnoozeMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setSnooze(id: string, minutos: number) {
  const map = getSnoozeMap();
  map[id] = Date.now() + minutos * 60 * 1000;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
}

export function clearSnooze(id: string) {
  const map = getSnoozeMap();
  delete map[id];
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
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

    tocar(880, 0.0, 0.2);
    tocar(1108, 0.2, 0.2);
    tocar(1320, 0.4, 0.3);
  } catch {
    // ignora — AudioContext bloqueado
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
      const res = await apiClient.getAtividades({
        status: 'PENDENTE,CONFIRMADA,AGUARDANDO_RETORNO',
        limit: 50
      });

      const atividades: any[] = res.data.data?.atividades || [];
      const agora = new Date();
      const snoozeMap = getSnoozeMap();

      for (const at of atividades) {
        if (!at.data_prevista) continue;

        const data = new Date(at.data_prevista);
        const diffMs = data.getTime() - agora.getTime();
        const diffMin = diffMs / 60000;

        // Janela: entre -10 min (passou) e +minutos (vai chegar)
        // Continua disparando até a reunião + 10 min depois do horário
        if (diffMin <= minutos && diffMin > -10) {
          // Verifica snooze
          const snoozeAte = snoozeMap[at.id];
          if (snoozeAte && Date.now() < snoozeAte) continue;

          onAlertaRef.current({
            id: at.id,
            titulo: at.titulo,
            tipo: at.tipo || 'TAREFA',
            lead_nome: at.lead?.nome || '',
            data_prevista: data,
            google_meet_link: at.google_meet_link,
            minutos_restantes: Math.round(diffMin)
          });

          // Marca uma vez para histórico (não bloqueia repetição)
          const chaveBase = `${at.id}_${Math.floor(data.getTime() / 60000)}`;
          const disparados = getAlertasDisparados();
          if (![...disparados].some(k => k.startsWith(chaveBase))) {
            marcarAlertaDisparado(`${chaveBase}_${Date.now()}`);
          }
        }
      }
    } catch {
      // ignora
    }
  }, []);

  useEffect(() => {
    const inicial = setTimeout(verificar, 5000);
    // Verifica a cada 30 segundos
    const intervalo = setInterval(verificar, 30 * 1000);

    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
    };
  }, [verificar]);
}
