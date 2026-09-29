'use client';

// Notificações do app (Web Push) + bolinha com o número de pendências no ícone.
// No iPhone só funciona com o CRM instalado na Tela de Início (iOS 16.4+); por isso,
// no Safari fora do app, mostramos como instalar. No computador (Chrome/Edge) também funciona.

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

const CHAVE_DISPENSA = 'ps_push_dispensado';

function b64ParaUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const ehIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
const suportaPush = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Ativa as notificações neste aparelho (precisa ser chamado num toque). */
export async function ativarNotificacoes(): Promise<string> {
  if (!suportaPush()) return ehIOS() && !instalado()
    ? 'No iPhone, primeiro instale o CRM: Compartilhar › Adicionar à Tela de Início, e abra pelo ícone.'
    : 'Este navegador não recebe notificações.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Notificações bloqueadas. Libere em Ajustes › Notificações › CRM Prosystem.';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const chave = (await apiClient.pushChave()).data?.data?.chave;
  if (!chave) return 'O servidor ainda não está pronto para notificações.';
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaUint8(chave) });
  const aparelho = `${ehIOS() ? 'iPhone' : /android/i.test(navigator.userAgent) ? 'Android' : 'Computador'} · ${navigator.userAgent.slice(0, 120)}`;
  await apiClient.pushInscrever(sub.toJSON(), aparelho);
  try { localStorage.setItem(CHAVE_DISPENSA, '1'); } catch {}
  await apiClient.pushTeste().catch(() => {});
  return 'Notificações ativadas! Você deve receber uma de teste agora. ✅';
}

export default function NotificacoesApp() {
  const [mostrar, setMostrar] = useState<'ativar' | 'instalar' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Service worker sempre registrado (recebe push mesmo com o app fechado) + banner quando falta ativar.
  useEffect(() => {
    let dispensado = false;
    try { dispensado = localStorage.getItem(CHAVE_DISPENSA) === '1'; } catch {}
    if (suportaPush()) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
      if (Notification.permission === 'default' && !dispensado) setMostrar('ativar');
    } else if (ehIOS() && !instalado() && !dispensado) {
      setMostrar('instalar');
    }
  }, []);

  // Bolinha no ícone: número de pendências (aprovar + conversas sem dono + não lidas minhas).
  useEffect(() => {
    const nav: any = navigator;
    if (!('setAppBadge' in nav)) return;
    let ativo = true;
    const atualizar = () => apiClient.pushContagem().then(r => {
      if (!ativo) return;
      const n = r.data?.data?.total || 0;
      (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {});
    }).catch(() => {});
    atualizar();
    const t = setInterval(atualizar, 60_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { ativo = false; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);

  if (!mostrar) return null;
  const dispensar = () => { try { localStorage.setItem(CHAVE_DISPENSA, '1'); } catch {} setMostrar(null); };
  return (
    <div className="ios-banner-push" role="region" aria-label="Notificações">
      <span className="ios-banner-icone" aria-hidden>🔔</span>
      <div className="ios-banner-texto">
        {mostrar === 'ativar' ? (
          <>
            <strong>Receba avisos no celular</strong>
            <span>{msg || 'Autorizações, conversas novas e demonstrações, mesmo com o app fechado.'}</span>
          </>
        ) : (
          <>
            <strong>Instale o CRM como app</strong>
            <span>No Safari: Compartilhar › Adicionar à Tela de Início. Abra pelo ícone para ativar os avisos.</span>
          </>
        )}
      </div>
      <div className="ios-banner-acoes">
        {mostrar === 'ativar' && (
          <button type="button" className="ios-banner-ok" disabled={ocupado}
            onClick={async () => { setOcupado(true); const m = await ativarNotificacoes().catch(e => `Não deu certo: ${e?.message || 'erro'}`); setMsg(m); setOcupado(false); if (/ativadas/.test(m)) setTimeout(() => setMostrar(null), 4000); }}>
            {ocupado ? 'Ativando…' : 'Ativar'}
          </button>
        )}
        <button type="button" className="ios-banner-nao" onClick={dispensar}>Agora não</button>
      </div>
    </div>
  );
}
