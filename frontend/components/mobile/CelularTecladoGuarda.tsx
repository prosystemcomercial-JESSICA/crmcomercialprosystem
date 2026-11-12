'use client';

// Celular (12/11/2026, pedido da Jessica: "às vezes a parte de cima some").
// O CRM ocupa a tela inteira e rola só por dentro. Quando o teclado do iPhone abre, o Safari
// empurra a página inteira para cima para mostrar o campo e, ao fechar o teclado, às vezes não
// devolve: a barra de cima fica escondida até recarregar. Aqui, quando o teclado fecha (nenhum
// campo em foco ou a altura visível volta ao normal), a página volta para o topo.
// No computador a página nunca rola, então nada muda.

import { useEffect } from 'react';

const ehCampo = (el: Element | null) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (el as HTMLElement).isContentEditable);

export function CelularTecladoGuarda() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) return;
    const voltarAoTopo = () => {
      if (ehCampo(document.activeElement)) return;
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) window.scrollTo(0, 0);
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    const aoSairDoCampo = () => { clearTimeout(t); t = setTimeout(voltarAoTopo, 250); };
    const vv = window.visualViewport;
    const aoMudarTela = () => { if (vv && vv.height >= window.innerHeight - 1) aoSairDoCampo(); };
    document.addEventListener('focusout', aoSairDoCampo);
    vv?.addEventListener('resize', aoMudarTela);
    window.addEventListener('orientationchange', aoSairDoCampo);
    return () => {
      clearTimeout(t);
      document.removeEventListener('focusout', aoSairDoCampo);
      vv?.removeEventListener('resize', aoMudarTela);
      window.removeEventListener('orientationchange', aoSairDoCampo);
    };
  }, []);
  return null;
}
