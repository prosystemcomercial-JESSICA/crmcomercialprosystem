'use client';

// Mídia de uma mensagem do WhatsApp (foto/vídeo/áudio/PDF) baixada à parte, só quando aparece
// na tela. A lista de mensagens vem só com os textos e "midia:<id>" no lugar do arquivo.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

const cache = new Map<string, string>();

export function MidiaMensagem({ url, children }: { url: string | null | undefined; children: (src: string) => ReactNode }) {
  const id = url?.startsWith('midia:') ? url.slice(6) : null;
  const [src, setSrc] = useState<string | null>(id ? cache.get(id) || null : url || null);
  const [erro, setErro] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!id || src) return;
    const el = ref.current;
    let cancelado = false;
    const baixar = () => apiClient.midiaMensagem(id)
      .then(r => { const u = r.data?.data?.midia_url; if (u && !cancelado) { cache.set(id, u); setSrc(u); } })
      .catch(() => { if (!cancelado) setErro(true); });
    if (!el || typeof IntersectionObserver === 'undefined') { baixar(); return () => { cancelado = true; }; }
    const obs = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { obs.disconnect(); baixar(); } }, { rootMargin: '300px' });
    obs.observe(el);
    return () => { cancelado = true; obs.disconnect(); };
  }, [id, src]);

  if (src) return <>{children(src)}</>;
  return (
    <span ref={ref} className="block text-xs opacity-70 mb-1" style={{ minHeight: 24 }}>
      {erro ? '⚠️ Não foi possível abrir o arquivo' : '⏳ Carregando arquivo…'}
    </span>
  );
}
