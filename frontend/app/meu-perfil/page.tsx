'use client';

// Configurações do colaborador (pedido da Jessica, 14/10/2026): só o próprio perfil (foto, nome, telefone).
// A gestão continua com a tela completa em /configuracoes, que também tem este bloco.

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import PerfilForm from '@/components/perfil/PerfilForm';

export default function MeuPerfilPage() {
  return (
    <DashboardLayout>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 4px 32px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)' }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', margin: '4px 0 20px' }}>Seu perfil no CRM: foto, nome e telefone.</p>
        <div style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 20 }}>
          <PerfilForm />
        </div>
      </div>
    </DashboardLayout>
  );
}
