'use client';

import { useEffect } from 'react';

// Error boundary das rotas. O caso mais comum aqui é ChunkLoadError: depois de um
// deploy novo, o navegador ainda tem a página antiga aberta e tenta baixar um
// chunk JS cujo hash mudou → 404 → "This page couldn't load". Detectamos isso e
// recarregamos a página UMA vez (puxando os assets novos), sem o usuário ver erro.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ehChunk = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(
    `${error?.name} ${error?.message}`
  );

  useEffect(() => {
    if (ehChunk && typeof window !== 'undefined') {
      // Evita loop: só auto-recarrega uma vez por sessão de erro.
      const KEY = 'chunk_reload_ts';
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }, [ehChunk]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{ehChunk ? '🔄' : '⚠️'}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A4E82', marginBottom: 8 }}>
          {ehChunk ? 'Atualizando a página…' : 'Algo deu errado'}
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
          {ehChunk
            ? 'Uma nova versão do sistema foi publicada. Estamos recarregando para você.'
            : 'Ocorreu um erro inesperado nesta tela. Tente novamente.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', borderRadius: 8, background: '#2E6EAB', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            Recarregar
          </button>
          <button onClick={() => reset()}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', color: '#2E6EAB', border: '1px solid #2E6EAB', fontWeight: 600, cursor: 'pointer' }}>
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
