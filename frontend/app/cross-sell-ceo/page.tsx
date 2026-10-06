'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { DashboardCrossSell } from '@/components/crosssell/DashboardCrossSell';

// Dashboard do CEO dedicado às vendas para a base (cross-sell e up-sell):
// MRR de expansão, receita única, mês a mês, ranking por serviço, vendedores e lista.
export default function CrossSellCeoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);
  if (loading || !isAuthenticated) return null;
  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 20 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--t-text-primary)' }}>Vendas para a base</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>Up-sell e cross-sell: quanto a base cresceu em mensalidade (MRR de expansão) e quanto entrou de receita única com trocas de CNPJ, upgrades, comunicação, pacote fiscal e serviços.</p>
        </header>
        <DashboardCrossSell modo="ceo" />
      </div>
    </DashboardLayout>
  );
}
