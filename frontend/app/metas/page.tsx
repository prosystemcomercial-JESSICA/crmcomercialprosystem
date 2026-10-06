'use client';

import { MetasConteudo } from '@/components/ceo/MetasConteudo';

// O conteúdo vive em components/ceo/MetasConteudo.tsx: a mesma tela abre sozinha aqui
// e como aba dentro do Painel do CEO (/dashboard).
export default function Page() {
  return <MetasConteudo />;
}
