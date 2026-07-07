'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function AtendimentoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/portal-tecnico?tab=atendimento'); }, [router]);
  return null;
}
