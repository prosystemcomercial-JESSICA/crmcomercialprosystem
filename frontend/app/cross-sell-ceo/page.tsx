'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Os relatórios de cross-sell e up-sell ficam dentro do Painel do CEO (Dashboard Executivo),
// na aba "Cross-sell & Up-sell". Esta rota só redireciona para lá.
export default function CrossSellCeoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard?aba=crosssell'); }, [router]);
  return null;
}
