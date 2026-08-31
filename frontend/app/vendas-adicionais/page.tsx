'use client';

import { redirect } from 'next/navigation';

// Os gráficos e a meta anual desta página foram incorporados em /indicacoes
// como a aba "Resultado Anual". Esta rota antiga agora só redireciona.
export default function VendasAdicionaisRedirect() {
  redirect('/indicacoes');
}
