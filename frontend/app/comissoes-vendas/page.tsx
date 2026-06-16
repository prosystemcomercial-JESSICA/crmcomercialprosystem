'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, PieChart, Pie,
} from 'recharts';

const PRO = '#417ABC', PRO_DARK = '#2E5A8F';
const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const CORES = ['#417ABC', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#64748b'];

export default function ComissoesVendasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState<'comissoes' | 'vendas'>('comissoes');
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);
  const load = useCallback(async () => {
    setCarregando(true);
    try { const r = await apiClient.getComissoesVendasCEO(); setD(r.data?.data || null); }
    catch { setD(null); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-5">
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRO_DARK}, ${PRO})` }}>
          <div className="px-5 py-5 text-white">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Resultado · Prosystem</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Comissões & Vendas</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>Comissões por estágio/mês e vendas adicionais/indicações por vendedor.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {[{ id: 'comissoes', l: '💰 Comissões' }, { id: 'vendas', l: '🤝 Vendas adicionais / Indicações' }].map(a => (
            <button key={a.id} onClick={() => setAba(a.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{a.l}</button>
          ))}
        </div>

        {carregando ? <div className="text-center py-16 text-gray-400">Carregando…</div> : !d ? <div className="text-center py-16 text-gray-400">Sem dados.</div> : (
          <>
            {/* ── COMISSÕES ── */}
            {aba === 'comissoes' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI l="A receber (sem data)" v={fmt(d.comissoes.totais.a_receber)} cor="#6b7280" />
                  <KPI l="A confirmar (instalado)" v={fmt(d.comissoes.totais.a_confirmar)} cor="#d97706" />
                  <KPI l="Confirmada (a pagar)" v={fmt(d.comissoes.totais.confirmada)} cor={PRO} />
                  <KPI l="Paga" v={fmt(d.comissoes.totais.paga)} cor="#16a34a" />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>Por mês de pagamento</h2>
                  <div className="space-y-2">
                    {d.comissoes.por_mes.map((m: any) => (
                      <div key={m.mes_pagamento} className="flex items-center justify-between p-3 rounded-lg border border-gray-100" style={{ background: '#fafbfc' }}>
                        <span className="font-semibold text-gray-800">{m.mes_pagamento === 'A definir' ? '⏳ A definir' : `📅 ${m.mes_pagamento}`} <span className="text-xs text-gray-400 ml-1">{m.count} comissão(ões)</span></span>
                        <span className="text-sm flex items-center gap-3">
                          <span className="text-green-700">Paga: {fmt(m.paga)}</span>
                          <span className="text-blue-700">A pagar: {fmt(m.a_pagar)}</span>
                          <b className="text-gray-900">{fmt(m.total)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>Por colaborador</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b">{['Colaborador', 'Papel', 'A pagar', 'Paga', 'Total'].map(h => <th key={h} className="py-1.5 pr-3">{h}</th>)}</tr></thead>
                      <tbody>{d.comissoes.por_colaborador.map((r: any) => (
                        <tr key={r.responsavel_id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-800">{r.nome}</td>
                          <td className="pr-3 text-gray-500">{r.papel}</td>
                          <td className="pr-3 text-blue-700">{fmt(r.a_pagar)}</td>
                          <td className="pr-3 text-green-700">{fmt(r.paga)}</td>
                          <td className="pr-3 font-bold text-gray-900">{fmt(r.total)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Para marcar pago / remarcar mês, use o módulo <button onClick={() => router.push('/comissoes')} className="text-blue-600 underline">Comissões</button> (gestão).</p>
                </div>
              </div>
            )}

            {/* ── VENDAS ADICIONAIS / INDICAÇÕES ── */}
            {aba === 'vendas' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <h2 className="text-sm font-bold uppercase mb-2" style={{ color: PRO_DARK }}>Por vendedor (comissão)</h2>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={d.vendas.por_vendedor.map((v: any) => ({ nome: (v.vendedor || '').split(' ')[0], Comissão: v.comissao }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                        <XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmt(v)} />
                        <Bar dataKey="Comissão" fill={PRO} radius={[4, 4, 0, 0]} animationDuration={900} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <h2 className="text-sm font-bold uppercase mb-2" style={{ color: PRO_DARK }}>Por categoria (valor)</h2>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={d.vendas.por_categoria} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} animationDuration={900} label={(p: any) => p.categoria}>
                          {d.vendas.por_categoria.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmt(v)} /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>Resumo por vendedor</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b">{['Vendedor', 'Qtd', 'Valor', 'Acréscimo/mês', 'Comissão'].map(h => <th key={h} className="py-1.5 pr-3">{h}</th>)}</tr></thead>
                      <tbody>{d.vendas.por_vendedor.map((v: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-800">{v.vendedor}</td>
                          <td className="pr-3">{v.qtd}</td>
                          <td className="pr-3 text-gray-700">{fmt(v.valor)}</td>
                          <td className="pr-3 text-blue-700">{fmt(v.acrescimo)}</td>
                          <td className="pr-3 font-bold text-green-700">{fmt(v.comissao)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>Vendas ({d.vendas.total})</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b">{['Cliente', 'Parceiro', 'Categoria', 'Vendedor', 'Valor', 'Comissão', 'Status'].map(h => <th key={h} className="py-1.5 pr-3">{h}</th>)}</tr></thead>
                      <tbody>{d.vendas.lista.map((v: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-800">{v.cliente}</td>
                          <td className="pr-3 text-gray-600">{v.parceiro}</td>
                          <td className="pr-3 text-xs text-gray-500">{v.categoria}</td>
                          <td className="pr-3 text-gray-600">{v.vendedor}</td>
                          <td className="pr-3 text-gray-700">{fmt(v.valor)}</td>
                          <td className="pr-3 text-green-700">{fmt(v.comissao)}</td>
                          <td className="pr-3 text-xs">{v.status}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function KPI({ l, v, cor = '#0D2238' }: { l: string; v: any; cor?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid #E3ECF5' }}>
      <span className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: cor }} />
      <p className="text-[11px] text-gray-500 pl-1.5">{l}</p>
      <p className="text-xl font-extrabold pl-1.5 mt-1" style={{ color: cor }}>{v}</p>
    </div>
  );
}
