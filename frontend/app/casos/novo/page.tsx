'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Cliente {
  id: string;
  nome: string;
  empresa?: string;
  email: string;
}

export default function NovoCasoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState({ clienteId: '', motivo_principal: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (isAuthenticated) {
      apiClient.getClientes(0, 100).then(res => {
        setClientes(res.data.data.clientes);
      }).catch(console.error);
    }
  }, [isAuthenticated]);

  const handleSave = async () => {
    if (!form.clienteId) { setError('Selecione um cliente'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.createCaso(form.clienteId, form.motivo_principal || undefined);
      router.push('/casos');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao criar caso');
    } finally {
      setSaving(false);
    }
  };

  const motivos = [
    'Preço elevado',
    'Falta de suporte técnico',
    'Sistema lento',
    'Concorrente com melhor proposta',
    'Falta de funcionalidades',
    'Problemas de integração fiscal',
    'Dificuldade de uso',
    'Mudança de fornecedor',
    'Outro'
  ];

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1">
            ← Voltar
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Novo Caso de Churn</h1>
          <p className="text-gray-500 mt-1">Registre um novo caso de risco de churn</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select
              value={form.clienteId}
              onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione um cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome} — {c.empresa}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo Principal</label>
            <select
              value={form.motivo_principal}
              onChange={e => setForm(f => ({ ...f, motivo_principal: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione um motivo</option>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-700 font-medium">ℹ️ Próximos passos após criar o caso:</p>
            <ul className="text-sm text-blue-600 mt-2 space-y-1 list-disc list-inside">
              <li>Fazer diagnóstico com análise de risco</li>
              <li>Criar plano de retenção</li>
              <li>Definir ações para recuperar o cliente</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => router.back()} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.clienteId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Criando...' : 'Criar Caso'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
