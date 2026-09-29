'use client';

// Desempenho do setor, unificado: agentes, intervenções, compromissos, propostas e IA.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PainelDesempenho from '@/components/desempenho/PainelDesempenho';
import { useAuth } from '@/lib/auth-context';

export default function DesempenhoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !isAuthenticated) router.push('/'); }, [loading, isAuthenticated, router]);
  if (loading || !isAuthenticated) return null;
  return (
    <DashboardLayout>
      <div className="ios-tela" style={{ display: 'grid', gap: 12 }}>
        <div className="ios-topo">
          <div>
            <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Desempenho do setor</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Agentes, suas intervenções, compromissos, propostas e IA, no mesmo período.</p>
          </div>
        </div>
        <PainelDesempenho />
      </div>
    </DashboardLayout>
  );
}
