'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const SECOES = [
  {
    id: 'pipeline',
    label: 'Pipeline Comercial',
    icon: '🔽',
    campos: [
      { key: 'etapas_funil', label: 'Etapas do Funil', tipo: 'info', valor: 'Prospecção → Qualificação → Apresentação → Proposta → Negociação → Fechamento' },
      { key: 'prob_default', label: 'Probabilidade padrão por etapa', tipo: 'info', valor: 'Prospecção: 10% · Qualificação: 25% · Apresentação: 40% · Proposta: 60% · Negociação: 75% · Fechamento: 90%' },
    ]
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: '🎯',
    campos: [
      { key: 'origens', label: 'Origens disponíveis', tipo: 'info', valor: 'MANUAL, SITE, INDICACAO, CAMPANHA, EVENTO, OUTRO' },
      { key: 'temperatura', label: 'Temperatura padrão ao criar', tipo: 'info', valor: 'FRIO' },
      { key: 'nutricao_dias', label: 'Dias sem atividade para alertar', tipo: 'number', valor: '7' },
    ]
  },
  {
    id: 'propostas',
    label: 'Propostas',
    icon: '📄',
    campos: [
      { key: 'validade_default', label: 'Validade padrão (dias)', tipo: 'number', valor: '30' },
      { key: 'alerta_expiracao', label: 'Alertar antes de expirar (dias)', tipo: 'number', valor: '3' },
    ]
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    icon: '🔔',
    campos: [
      { key: 'alerta_atividade', label: 'Alertar atividades atrasadas', tipo: 'toggle', valor: 'true' },
      { key: 'alerta_proposta', label: 'Alertar propostas expirando', tipo: 'toggle', valor: 'true' },
      { key: 'alerta_sem_atividade', label: 'Alertar leads sem atividade', tipo: 'toggle', valor: 'true' },
    ]
  },
];

export default function ConfiguracoesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    SECOES.forEach(s => s.campos.forEach(c => { initial[c.key] = c.valor; }));
    setValores(initial);
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const isCEO = user?.role === 'CEO' || user?.role === 'SUPERVISAO';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações Comerciais</h1>
            <p className="text-gray-500 mt-1">Personalize o CRM para o seu processo de vendas</p>
          </div>
          {isCEO && (
            <button onClick={handleSave}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {saved ? '✅ Salvo!' : 'Salvar configurações'}
            </button>
          )}
        </div>

        {!isCEO && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            ⚠️ Apenas CEO e Supervisão podem alterar configurações.
          </div>
        )}

        <div className="space-y-4">
          {SECOES.map(secao => (
            <div key={secao.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="text-lg">{secao.icon}</span>
                <h2 className="text-base font-semibold text-gray-900">{secao.label}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {secao.campos.map(campo => (
                  <div key={campo.key} className="px-5 py-4 flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700 flex-shrink-0 w-64">{campo.label}</label>
                    {campo.tipo === 'info' && (
                      <p className="text-sm text-gray-500 flex-1">{campo.valor}</p>
                    )}
                    {campo.tipo === 'number' && (
                      <input
                        type="number"
                        value={valores[campo.key] || campo.valor}
                        onChange={e => setValores(p => ({ ...p, [campo.key]: e.target.value }))}
                        disabled={!isCEO}
                        className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    )}
                    {campo.tipo === 'toggle' && (
                      <button
                        onClick={() => isCEO && setValores(p => ({ ...p, [campo.key]: p[campo.key] === 'true' ? 'false' : 'true' }))}
                        disabled={!isCEO}
                        className={`relative w-11 h-6 rounded-full transition-colors ${valores[campo.key] !== 'false' ? 'bg-blue-600' : 'bg-gray-200'} disabled:opacity-60`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${valores[campo.key] !== 'false' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info do sistema */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informações do Sistema</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-400">Versão</p><p className="font-medium text-gray-700">1.0.0</p></div>
            <div><p className="text-gray-400">Backend</p><p className="font-medium text-gray-700">Fastify + Prisma</p></div>
            <div><p className="text-gray-400">Banco</p><p className="font-medium text-gray-700">PostgreSQL 16</p></div>
            <div><p className="text-gray-400">Frontend</p><p className="font-medium text-gray-700">Next.js 14</p></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
