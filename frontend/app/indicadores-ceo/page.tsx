'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PRO = '#417ABC';

const CAMPOS: { k: string; label: string; tipo?: string; grupo: string }[] = [
  { k: 'faturamento', label: 'Faturamento (R$)', grupo: 'Financeiro' },
  { k: 'caixa_disponivel', label: 'Caixa disponível (R$)', grupo: 'Financeiro' },
  { k: 'contas_a_receber', label: 'Contas a receber (R$)', grupo: 'Financeiro' },
  { k: 'inadimplencia', label: 'Inadimplência (R$)', grupo: 'Financeiro' },
  { k: 'lucro_liquido', label: 'Lucro líquido (R$)', grupo: 'Financeiro' },
  { k: 'despesas_setor', label: 'Despesas do setor (R$)', grupo: 'Financeiro' },
  { k: 'marketing_investido', label: 'Marketing investido (R$)', grupo: 'Marketing' },
  { k: 'marketing_leads', label: 'Leads de campanha (qtd)', tipo: 'int', grupo: 'Marketing' },
  { k: 'cpl', label: 'CPL — custo por lead (R$)', grupo: 'Marketing' },
  { k: 'cac', label: 'CAC — custo de aquisição (R$)', grupo: 'Marketing' },
  { k: 'nps', label: 'NPS do mês', grupo: 'Satisfação' },
];

export default function IndicadoresCEOPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [form, setForm] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    try { const r = await apiClient.getIndicadoresCEO(ano, mes); setForm(r.data?.data || {}); }
    catch { setForm({}); }
  }, [ano, mes]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  const salvar = async () => {
    setSalvando(true); setMsg('');
    try {
      const payload: any = { ano, mes, observacoes: form.observacoes || undefined };
      for (const c of CAMPOS) {
        const v = form[c.k];
        if (v !== '' && v != null) payload[c.k] = c.tipo === 'int' ? parseInt(v) : Number(v);
      }
      await apiClient.salvarIndicadoresCEO(payload);
      setMsg('✅ Indicadores salvos!');
      setTimeout(() => setMsg(''), 4000);
    } catch (e: any) { setMsg('❌ ' + (e?.response?.data?.message || 'Erro ao salvar')); }
    finally { setSalvando(false); }
  };

  if (loading || !isAuthenticated) return null;
  const grupos = [...new Set(CAMPOS.map(c => c.grupo))];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <h1 className="text-2xl font-bold text-gray-900">Indicadores do CEO — lançamento mensal</h1>
        <p className="text-sm text-gray-500 mt-1">Preencha os números que o sistema não calcula sozinho (financeiro, marketing, NPS). Lance um mês por vez — inclusive os retroativos de jan→mai.</p>

        <div className="flex items-center gap-2 my-4">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-xs text-gray-400">Editando {MESES[mes]}/{ano}</span>
        </div>

        {msg && <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{msg}</div>}

        {grupos.map(g => (
          <div key={g} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO }}>{g}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CAMPOS.filter(c => c.grupo === g).map(c => (
                <div key={c.k}>
                  <label className="text-xs font-medium text-gray-600">{c.label}</label>
                  <input type="number" value={form[c.k] ?? ''} onChange={e => setForm({ ...form, [c.k]: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0" />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <label className="text-xs font-medium text-gray-600">Observações</label>
          <textarea value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        <button onClick={salvar} disabled={salvando} className="text-white font-semibold px-5 py-2.5 rounded-lg disabled:opacity-50" style={{ background: PRO }}>
          {salvando ? 'Salvando…' : `Salvar indicadores de ${MESES[mes]}/${ano}`}
        </button>
      </div>
    </DashboardLayout>
  );
}
