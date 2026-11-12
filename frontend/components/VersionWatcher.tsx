'use client';

import { useEffect, useRef } from 'react';

// Detecta nova versão publicada e recarrega a página sozinho — assim a equipe
// nunca fica vendo a versão antiga em cache após um deploy (ex.: botão que não
// aparecia até dar Ctrl+Shift+R). Lê /health do backend e compara a `versao`.
//
// 12/11/2026 (pedido da Jessica: o atalho na tela de início do iPhone continuava com a versão antiga):
// - o servidor devolvia sempre "dev" (variável do Railway inexistente na VPS), então nunca recarregava;
//   agora o backend devolve o commit do deploy;
// - o iPhone retoma o app da tela de início do jeito que estava na memória, sem o evento "focus":
//   também confere ao voltar a ficar visível (visibilitychange) e ao restaurar a página (pageshow);
// - para não perder o que a pessoa está digitando, a versão nova encontrada pela checagem periódica
//   só recarrega com a página em segundo plano; ao voltar para a frente, recarrega na hora.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VersionWatcher() {
  const versaoInicial = useRef<string | null>(null);

  useEffect(() => {
    let parado = false;
    let novaVersao = false;
    const recarregar = () => {
      if (parado) return;
      parado = true;
      window.location.reload(); // busca os arquivos atualizados
    };
    const checar = async (aoVoltar: boolean) => {
      if (novaVersao) { if (aoVoltar || document.hidden) recarregar(); return; }
      try {
        const r = await fetch(`${API_URL}/health`, { cache: 'no-store' });
        const d = await r.json();
        const v = d?.versao || null;
        if (!v) return;
        if (versaoInicial.current === null) { versaoInicial.current = v; return; }
        if (v !== versaoInicial.current) {
          novaVersao = true;
          if (aoVoltar || document.hidden) recarregar();
        }
      } catch { /* offline/efêmero — ignora */ }
    };
    checar(false); // ao montar
    const id = setInterval(() => checar(false), 3 * 60 * 1000); // a cada 3 min
    const aoVoltar = () => { if (!document.hidden) checar(true); };
    const aoMostrar = (e: PageTransitionEvent) => { if (e.persisted) checar(true); };
    const aoEsconder = () => { if (document.hidden && novaVersao) recarregar(); };
    window.addEventListener('focus', aoVoltar);
    document.addEventListener('visibilitychange', aoVoltar);
    document.addEventListener('visibilitychange', aoEsconder);
    window.addEventListener('pageshow', aoMostrar);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', aoVoltar);
      document.removeEventListener('visibilitychange', aoVoltar);
      document.removeEventListener('visibilitychange', aoEsconder);
      window.removeEventListener('pageshow', aoMostrar);
    };
  }, []);

  return null;
}
