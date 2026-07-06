'use client';

import { useEffect } from 'react';

// Fallback de erro no nível do root layout (quando nem o error.tsx das rotas
// pega). Mesma lógica de auto-reload em ChunkLoadError pós-deploy.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const ehChunk = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(
    `${error?.name} ${error?.message}`
  );

  useEffect(() => {
    if (ehChunk && typeof window !== 'undefined') {
      const KEY = 'chunk_reload_ts';
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }, [ehChunk]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{ehChunk ? '🔄' : '⚠️'}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A4E82', marginBottom: 8 }}>
              {ehChunk ? 'Atualizando o sistema…' : 'Algo deu errado'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--t-text-muted)', marginBottom: 20 }}>
              {ehChunk ? 'Uma nova versão foi publicada. Recarregando…' : 'Recarregue a página para continuar.'}
            </p>
            <button onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#2E6EAB', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              Recarregar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
