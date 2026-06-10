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
  razao_social?: string;
  nome_fantasia?: string;
  codigo?: string;
  cnpj?: string;
  cidade?: string;
  email: string;
}

export default function NovoCasoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ clienteId: '', motivo_principal: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  // Busca clientes no SERVIDOR (toda a base de 1400+), por código/razão/fantasia/
  // CNPJ/email — antes carregava só os primeiros 100 num <select> e a maioria
  // nunca aparecia. Debounce de 300ms.
  useEffect(() => {
    if (clienteSel) return; // já selecionou, não busca
    const termo = busca.trim();
    if (termo.length < 2) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(() => {
      apiClient.getClientes(0, 20, termo)
        .then(res => setResultados(res.data.data.clientes || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, clienteSel]);

  const nomeCliente = (c: Cliente) =>
    c.nome_fantasia || c.razao_social || c.nome || c.empresa || c.email || 'Cliente';

  const selecionar = (c: Cliente) => {
    setClienteSel(c);
    setForm(f => ({ ...f, clienteId: c.id }));
    setResultados([]);
    setBusca('');
  };

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
    'Dificuldade financeira',
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

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            {clienteSel ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-blue-300 bg-blue-50 rounded-lg">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{nomeCliente(clienteSel)}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {clienteSel.codigo ? `#${clienteSel.codigo}` : ''}{clienteSel.cidade ? ` · ${clienteSel.cidade}` : ''}{clienteSel.cnpj ? ` · ${clienteSel.cnpj}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => { setClienteSel(null); setForm(f => ({ ...f, clienteId: '' })); }}
                  className="text-sm text-blue-600 hover:text-blue-800 shrink-0">Trocar</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por código, razão social, fantasia, CNPJ ou e-mail…"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  autoComplete="off"
                />
                {busca.trim().length >= 2 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
                    {buscando && <div className="px-3 py-2.5 text-sm text-gray-500">Buscando…</div>}
                    {!buscando && resultados.length === 0 && (
                      <div className="px-3 py-2.5 text-sm text-gray-500">Nenhum cliente encontrado.</div>
                    )}
                    {resultados.map(c => (
                      <button key={c.id} type="button" onClick={() => selecionar(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                        <div className="font-medium text-gray-900 truncate">{nomeCliente(c)}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {c.codigo ? `#${c.codigo}` : ''}{c.cidade ? ` · ${c.cidade}` : ''}{c.cnpj ? ` · ${c.cnpj}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
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
