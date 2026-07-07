'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgendaRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/atividades'); }, [router]);
  return null;
}
