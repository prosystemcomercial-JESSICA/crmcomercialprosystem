'use client';

import { useEffect, useRef } from 'react';

// Detecta nova versão publicada e recarrega a página sozinho — assim a equipe
// nunca fica vendo a versão antiga em cache após um deploy (ex.: botão que não
// aparecia até dar Ctrl+Shift+R). Lê /health do backend e compara a `versao`.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VersionWatcher() {
  const versaoInicial = useRef<string | null>(null);

  useEffect(() => {
    let parado = false;
    const checar = async () => {
      try {
        const r = await fetch(`${API_URL}/health`, { cache: 'no-store' });
        const d = await r.json();
        const v = d?.versao || null;
        if (!v) return;
        if (versaoInicial.current === null) { versaoInicial.current = v; return; }
        if (v !== versaoInicial.current && !parado) {
          parado = true;
          // Versão nova publicada → recarrega buscando os assets atualizados.
          window.location.reload();
        }
      } catch { /* offline/efêmero — ignora */ }
    };
    checar(); // ao montar
    const id = setInterval(checar, 3 * 60 * 1000); // a cada 3 min
    const onFocus = () => checar(); // e quando o usuário volta à aba
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  return null;
}
