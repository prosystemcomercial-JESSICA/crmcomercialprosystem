'use client';

import { PipelineComercialConteudo } from '@/components/ceo/PipelineComercialConteudo';

// O conteúdo vive em components/ceo/PipelineComercialConteudo.tsx: a mesma tela abre sozinha aqui
// e como aba dentro do Painel do CEO (/dashboard).
export default function Page() {
  return <PipelineComercialConteudo />;
}
