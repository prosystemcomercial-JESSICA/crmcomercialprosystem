'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts';

const PRO = '#417ABC', PRO_DARK = '#2E5A8F';
const CORES = ['#417ABC', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#64748b'];
const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmt0 = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const CATEGORIA_LABEL: Record<string, string> = {
  FISCAL:      'Pacote Fiscal',
  TEF:         'TEF',
  TRIBUTARIO:  'Tributário',
  COMUNICACAO: 'Comunicação',
  UPGRADE:     'Upgrade de Plano',
  TROCA_CNPJ:  'Troca de CNPJ',
  OUTRO:       'Outro',
};

const TIPO_LABEL: Record<string, string> = {
  INDICACAO: 'Indicação',
  REVENDA:   'Revenda',
};

export default function VendasAdicionaisPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const ano = new Date().getFullYear();

  // Filtros da lista
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);
  const load = useCallback(async () => {
    setCarregando(true);
    try { const r = await apiClient.getVendasAdicionaisCEO(ano); setD(r.data?.data || null); }
    catch { setD(null); } finally { setCarregando(false); }
  }, [ano]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  if (loading || !isAuthenticated) return null;

  // Barra: até a meta é azul; entre meta e super é verde; o restante cinza.
  const meta = d?.meta_anual || 30000;
  const sup = d?.super_meta || 50000;
  const fat = d?.faturamento || 0;
  const pctMeta = Math.min(100, Math.round((fat / meta) * 100));
  const pctSuper = Math.min(100, Math.round((fat / sup) * 100));
  // posição da marca da meta dentro da barra que vai até a super
  const markMeta = Math.round((meta / sup) * 100);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-5 space-y-4">
        {/* Capa azul */}
        <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRO_DARK}, ${PRO})` }}>
          <div className="px-5 py-5 text-white">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Resultado · Prosystem</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Vendas Adicionais & Indicações</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>Faturamento de revendas, indicações e serviços do ano {d?.ano || ano}.</p>
          </div>
        </div>

        {carregando ? <div className="text-center py-16 ">Carregando…</div> : !d ? <div className="text-center py-16 ">Sem dados.</div> : (
          <>
            {/* Barra de acompanhamento da meta anual (30k) / supermeta (50k) */}
            <div className="ps-card rounded-2xl border border-gray-200 p-5">
              <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: PRO_DARK }}>Meta anual de vendas adicionais</p>
                  <p className="text-3xl font-extrabold mt-1" style={{ color: PRO }}>{fmt0(fat)}</p>
                  <p className="text-sm ">de {fmt0(meta)} (meta) · super {fmt0(sup)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: fat >= sup ? '#dcfce7' : fat >= meta ? '#fef9c3' : '#eef5fc', color: fat >= sup ? '#15803d' : fat >= meta ? '#a16207' : PRO_DARK }}>
                    {fat >= sup ? '🏆 Supermeta batida!' : fat >= meta ? '✅ Meta batida!' : `${pctMeta}% da meta`}
                  </span>
                </div>
              </div>
              {/* Barra única que vai até a SUPER meta, com marca da meta */}
              <div className="relative w-full rounded-full h-5" style={{ background: '#eef2f7' }}>
                <div className="absolute left-0 top-0 h-5 rounded-full transition-all" style={{
                  width: `${pctSuper}%`,
                  background: fat >= meta ? 'linear-gradient(90deg,#417ABC,#16a34a)' : PRO,
                }} />
                {/* marca da meta (30k) */}
                <span className="absolute top-[-3px] h-[26px] w-0.5 bg-opacity-00" style={{ left: `${markMeta}%` }} title={`Meta ${fmt0(meta)}`} />
              </div>
              <div className="flex justify-between text-[11px]  mt-1">
                <span>R$ 0</span>
                <span style={{ position: 'relative', left: `${markMeta - 50}%` }}>Meta {fmt0(meta)}</span>
                <span>Super {fmt0(sup)}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-opacity-0 rounded-lg p-3 border border-gray-100"><p className="text-xs ">Vendas confirmadas</p><p className="text-lg font-bold ">{d.total}</p></div>
                <div className="bg-opacity-0 rounded-lg p-3 border border-gray-100"><p className="text-xs ">↑ Mensalidade gerada</p><p className="text-lg font-bold text-blue-700">+{fmt0(d.acrescimo_mrr_total)}/mês</p></div>
                <div className="bg-opacity-0 rounded-lg p-3 border border-gray-100"><p className="text-xs ">% da supermeta</p><p className="text-lg font-bold" style={{ color: PRO }}>{pctSuper}%</p></div>
              </div>
            </div>

            {/* Evolução mensal */}
            <div className="ps-card rounded-2xl border border-gray-200 p-4">
              <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>📈 Faturamento por mês ({d.ano})</h2>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={d.serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Bar dataKey="valor" name="Faturamento" fill={PRO} radius={[4, 4, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Por vendedor */}
              <div className="ps-card rounded-2xl border border-gray-200 p-4">
                <h2 className="text-sm font-bold uppercase mb-2" style={{ color: PRO_DARK }}>Por vendedor (faturamento)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.por_vendedor.map((v: any) => ({ nome: (v.vendedor || '').split(' ')[0], Faturamento: v.valor }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="Faturamento" fill={PRO} radius={[4, 4, 0, 0]} animationDuration={900} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Por categoria */}
              <div className="ps-card rounded-2xl border border-gray-200 p-4">
                <h2 className="text-sm font-bold uppercase mb-2" style={{ color: PRO_DARK }}>Por categoria (valor)</h2>
                {d.por_categoria.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={d.por_categoria.map((c: any) => ({ ...c, nome: CATEGORIA_LABEL[c.categoria] || c.categoria }))} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2} animationDuration={900} label={(p: any) => p.nome}>
                        {d.por_categoria.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmt(v)} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center  py-12 text-sm">Sem dados.</p>}
              </div>
            </div>

            {/* Lista */}
            <div className="ps-card rounded-2xl border border-gray-200 p-4">
              {/* Filtros */}
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <span className="text-xs font-bold  mr-1">Filtrar:</span>

                {/* Categoria */}
                <div className="flex flex-wrap gap-1.5">
                  {['', ...Object.keys(CATEGORIA_LABEL)].map(cat => {
                    const qtd = cat === '' ? d.lista.length : d.lista.filter((v: any) => v.categoria === cat).length;
                    if (qtd === 0 && cat !== '') return null;
                    return (
                      <button key={cat} onClick={() => setFiltroCategoria(cat)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
                        style={filtroCategoria === cat
                          ? { background: PRO, color: '#fff' }
                          : { background: '#F3F7FB', color: '#4A6E8A', border: '1px solid #E3ECF5' }}>
                        {cat === '' ? `Todos (${qtd})` : `${CATEGORIA_LABEL[cat] || cat} (${qtd})`}
                      </button>
                    );
                  })}
                </div>

                {/* Divisor */}
                <span className="text-gray-300 mx-1 hidden sm:inline">|</span>

                {/* Tipo negócio */}
                <div className="flex gap-1.5">
                  {['', 'INDICACAO', 'REVENDA'].map(tipo => {
                    const qtd = tipo === '' ? d.lista.length : d.lista.filter((v: any) => v.tipo === tipo).length;
                    if (qtd === 0 && tipo !== '') return null;
                    return (
                      <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap"
                        style={filtroTipo === tipo
                          ? { background: '#7C3AED', color: '#fff' }
                          : { background: '#F5F3FF', color: '#6D28D9', border: '1px solid #DDD6FE' }}>
                        {tipo === '' ? 'Qualquer tipo' : `${TIPO_LABEL[tipo]} (${qtd})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const lista = d.lista.filter((v: any) =>
                  (filtroCategoria === '' || v.categoria === filtroCategoria) &&
                  (filtroTipo === '' || v.tipo === filtroTipo)
                );
                return (
                  <>
                    <h2 className="text-sm font-bold uppercase mb-3" style={{ color: PRO_DARK }}>
                      Vendas adicionais & indicações ({lista.length}{lista.length !== d.total ? ` de ${d.total}` : ''})
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs  border-b">
                            {['Cliente', 'Parceiro', 'Categoria', 'Tipo', 'Vendedor', 'Valor', '+Mensalidade'].map(h =>
                              <th key={h} className="py-1.5 pr-3">{h}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {lista.length === 0 ? (
                            <tr><td colSpan={7} className="py-10 text-center  text-xs">Nenhuma venda encontrada com esses filtros.</td></tr>
                          ) : lista.map((v: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 pr-3 font-medium ">{v.cliente}</td>
                              <td className="pr-3 ">{v.parceiro}</td>
                              <td className="pr-3">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EEF4FB', color: PRO_DARK }}>
                                  {CATEGORIA_LABEL[v.categoria] || v.categoria}
                                </span>
                              </td>
                              <td className="pr-3">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
                                  {TIPO_LABEL[v.tipo] || v.tipo || '—'}
                                </span>
                              </td>
                              <td className="pr-3 ">{v.vendedor}</td>
                              <td className="pr-3  font-semibold">{fmt(v.valor)}</td>
                              <td className="pr-3 text-blue-700">{v.acrescimo > 0 ? `+${fmt(v.acrescimo)}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
