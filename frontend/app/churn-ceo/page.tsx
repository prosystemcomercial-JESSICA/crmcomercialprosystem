'use client';

import { redirect } from 'next/navigation';

// A Visão Executiva (Radar de churn) foi incorporada em /casos como uma aba
// interna, com gate de role próprio (CEO/ADMIN/SUPERVISAO_COMERCIAL). Esta
// rota antiga agora só redireciona.
export default function ChurnCeoRedirect() {
  redirect('/casos');
}
