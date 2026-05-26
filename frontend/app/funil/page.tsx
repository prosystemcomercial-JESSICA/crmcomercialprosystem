'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Funil e Leads foram unificados em /leads (Pipeline Comercial).
// Esta rota é mantida apenas como redirecionamento para não quebrar links/bookmarks.
export default function FunilPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/leads'); }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#0D2238' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: '#7AAACB' }}>Redirecionando para Pipeline Comercial...</p>
      </div>
    </div>
  );
}
