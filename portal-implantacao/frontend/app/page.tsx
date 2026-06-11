'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { captarTokenDaUrl } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    captarTokenDaUrl();      // captura o token SSO vindo do CRM comercial
    router.replace('/funis');
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center text-slate-400">Abrindo o portal…</div>;
}
