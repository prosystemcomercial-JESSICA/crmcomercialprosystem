'use client';

// Botão "‹ Voltar" da barra de cima, só no celular (12/11/2026, pedido da Jessica).
// No iPhone o CRM roda como aplicativo (tela cheia, sem o voltar do navegador): sem este botão a
// pessoa ficava presa numa tela. Aparece em toda tela que não é uma das abas de baixo.
// Volta para a tela anterior do próprio CRM; se a pessoa abriu direto (link, notificação),
// sobe um nível no endereço (ex.: /clientes/123 → /clientes) ou vai para o Painel.

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const CHAVE = 'ps_cel_navegou';

export function VoltarCelular({ abas }: { abas: string[] }) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  // Conta quantas telas a pessoa já abriu nesta sessão (para saber se dá para "voltar" de verdade).
  useEffect(() => {
    try { sessionStorage.setItem(CHAVE, String(Number(sessionStorage.getItem(CHAVE) || '0') + 1)); } catch {}
  }, [pathname]);

  if (abas.includes(pathname)) return null;

  const voltar = () => {
    let navegou = 0;
    try { navegou = Number(sessionStorage.getItem(CHAVE) || '0'); } catch {}
    if (navegou > 1 && window.history.length > 1) { router.back(); return; }
    const pai = pathname.replace(/\/[^/]+\/?$/, '');
    router.push(pai && pai !== pathname ? pai : '/dashboard');
  };

  return (
    <button type="button" onClick={voltar} className="cel-voltar md:hidden" aria-label="Voltar para a tela anterior">
      <ChevronLeft size={26} strokeWidth={2.2} aria-hidden />
      <span>Voltar</span>
    </button>
  );
}
