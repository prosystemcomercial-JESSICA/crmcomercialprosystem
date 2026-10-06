'use client';

import { AnaliseComercialConteudo } from '@/components/ceo/AnaliseComercialConteudo';

// O conteúdo vive em components/ceo/AnaliseComercialConteudo.tsx: a mesma tela abre sozinha aqui
// e como aba dentro do Painel do CEO (/dashboard).
export default function Page() {
  return <AnaliseComercialConteudo />;
}
