'use client';

import { useEffect, useState } from 'react';
import { useAuth, useRequireGestorRedirect } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
} from 'recharts';
import { Trophy, Medal, Award, Loader2, User } from 'lucide-react';

interface RankingItem {
  posicao: number;
  responsavel_id: string;
  responsavel_nome?: string;
  leads_ganhos: number;
  propostas_aceitas: number;
  contratos: number;
  valor_total: number;
  setup_total?: number;
  mrr_total?: number;
  media_setup?: number;
  media_mrr?: number;
}

const USUARIOS_NAMES: Record<string, string> = {
  'user-ceo': 'CEO',
  'user-supervisao': 'Supervisão',
  'vendedor-1': 'Vendedor 1',
  'vendedor-2': 'Vendedor 2',
  'vendedor-3': 'Vendedor 3',
};

const MEDAL_ICONS = [
  <Trophy key="1" size={22} style={{ color: '#f59e0b' }} />,
  <Medal  key="2" size={22} style={{ color: 'var(--t-text-muted)' }} />,
  <Award  key="3" size={22} style={{ color: '#b45309' }} />,
];

function periodoAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function RankingPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { blocked } = useRequireGestorRedirect();
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [periodo, setPeriodo] = useState(periodoAtual());
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getRanking(periodo)
      .then(res => setRanking(res.data.data))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [isAuthenticated, periodo]);

  const nomeVendedor = (idOuItem: any): string => {
    if (idOuItem && typeof idOuItem === 'object') return idOuItem.responsavel_nome || nomeVendedor(idOuItem.responsavel_id);
    const id = String(idOuItem || '');
    return USUARIOS_NAMES[id] || id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const periods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  if (loading || !isAuthenticated || blocked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" style={{ width: 48, height: 48, color: 'var(--t-primary)' }} />
      </div>
    );
  }

  const maxValor = ranking.length > 0 ? ranking[0].valor_total : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Ranking Comercial</h1>
            <p className="mt-1" style={{ color: 'var(--t-text-muted)' }}>Performance por vendedor no período</p>
          </div>
          <ExportButton
            nome="ranking" titulo={`Ranking Comercial — ${periodo}`}
            linhas={ranking}
            colunas={[
              { header: 'Posição', value: (r: RankingItem) => r.posicao },
              { header: 'Vendedor', value: (r: RankingItem) => nomeVendedor(r) },
              { header: 'Leads ganhos', value: (r: RankingItem) => r.leads_ganhos },
              { header: 'Propostas aceitas', value: (r: RankingItem) => r.propostas_aceitas },
              { header: 'Contratos', value: (r: RankingItem) => r.contratos },
              { header: 'Setup acumulado (R$)', value: (r: RankingItem) => r.setup_total ?? 0 },
              { header: 'Mensalidade acumulada (R$)', value: (r: RankingItem) => r.mrr_total ?? 0 },
              { header: 'Média setup (R$)', value: (r: RankingItem) => r.media_setup ?? 0 },
              { header: 'Média mensalidade (R$)', value: (r: RankingItem) => r.media_mrr ?? 0 },
              { header: 'Valor total (R$)', value: (r: RankingItem) => r.valor_total },
            ]}
          />
          <div className="flex gap-2 flex-wrap">
            {periods.map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                style={periodo === p
                  ? { background: 'var(--t-primary)', color: '#fff' }
                  : { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12" style={{ color: 'var(--t-text-secondary)' }}>Calculando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="ps-card rounded-xl p-12 text-center" style={{ border: '1px solid var(--t-card-border)' }}>
            <Trophy size={40} className="mx-auto mb-3" style={{ color: 'var(--t-text-muted)' }} />
            <p style={{ color: 'var(--t-text-secondary)' }}>Sem dados de vendas para {periodo}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--t-text-muted)' }}>Registre leads ganhos e propostas aceitas para aparecer no ranking</p>
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {ranking.length >= 1 && (
              <div className="flex gap-4 justify-center items-end">
                {[ranking[1], ranking[0], ranking[2]].filter(Boolean).map((item, idx) => {
                  const originalPos = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                  const heights = ['h-28', 'h-36', 'h-24'];
                  const podiumStyles = [
                    { background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' },
                    { background: 'rgba(245,158,11,0.06)', border: '2px solid #fde68a' },
                    { background: 'rgba(180,87,9,0.06)', border: '1px solid var(--t-card-border)' },
                  ];
                  return (
                    <div key={item.responsavel_id}
                      className={`flex-1 max-w-48 rounded-xl p-4 text-center ${heights[idx]} flex flex-col justify-end`}
                      style={podiumStyles[idx]}>
                      <div className="flex justify-center mb-1">
                        {MEDAL_ICONS[originalPos] ?? <span className="text-sm font-bold" style={{ color: 'var(--t-text-muted)' }}>#{item.posicao}</span>}
                      </div>
                      <p className="font-bold text-sm" style={{ color: 'var(--t-text-primary)' }}>{nomeVendedor(item)}</p>
                      <p className="text-lg font-bold" style={{ color: '#16a34a' }}>R$ {item.valor_total.toLocaleString('pt-BR')}</p>
                      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{item.leads_ganhos} ganhos · {item.contratos} contratos</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gráficos */}
            {(() => {
              const comResultado = ranking.filter((r: RankingItem) => (r.valor_total || 0) > 0);
              if (comResultado.length === 0) return null;
              const dados = comResultado.map((r: RankingItem) => ({
                nome: (nomeVendedor(r) || '').split(' ')[0],
                Setup: Number(r.setup_total || 0),
                Mensalidade: Number(r.mrr_total || 0),
                valor: Number(r.valor_total || 0),
              }));
              const cores = ['var(--t-primary)', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626', 'var(--t-text-muted)'];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="ps-card rounded-xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                    <h2 className="text-sm font-bold uppercase mb-2" style={{ color: 'var(--t-primary-dark)' }}>Setup × Mensalidade por vendedor</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                        <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`} /><Legend />
                        <Bar dataKey="Setup" fill="var(--t-primary)" radius={[4, 4, 0, 0]} animationDuration={900} />
                        <Bar dataKey="Mensalidade" fill="#16a34a" radius={[4, 4, 0, 0]} animationDuration={900} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="ps-card rounded-xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                    <h2 className="text-sm font-bold uppercase mb-2" style={{ color: 'var(--t-primary-dark)' }}>Participação no valor total</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={dados} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          paddingAngle={2} animationDuration={900} label={(p: any) => p.nome}>
                          {dados.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`} /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Tabela completa */}
            <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
              <table className="w-full">
                <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                  <tr>
                    {['#', 'Vendedor', 'Leads Ganhos', 'Propostas Aceitas', 'Contratos', 'Setup acum.', 'Mensalidade acum.', 'Média setup', 'Média mens.', 'Valor Total', 'Barra'].map(h => (
                      <th key={h} className={`px-5 py-3 text-xs font-semibold uppercase ${h === 'Setup acum.' || h === 'Mensalidade acum.' || h === 'Média setup' || h === 'Média mens.' ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderTop: 'none' }}>
                  {ranking.map(item => (
                    <tr key={item.responsavel_id} className="transition-colors hover:opacity-80" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                      <td className="px-5 py-4">
                        {item.posicao <= 3
                          ? <span className="flex">{MEDAL_ICONS[item.posicao - 1]}</span>
                          : <span className="text-sm font-semibold" style={{ color: 'var(--t-text-muted)' }}>#{item.posicao}</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                            style={{ background: 'rgba(65,122,188,0.12)', color: 'var(--t-primary)' }}>
                            {nomeVendedor(item).charAt(0)}
                          </div>
                          <p className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{nomeVendedor(item)}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--t-text-secondary)' }}>{item.leads_ganhos}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--t-text-secondary)' }}>{item.propostas_aceitas}</td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--t-text-secondary)' }}>{item.contratos}</td>
                      <td className="px-5 py-4 text-sm text-right" style={{ color: 'var(--t-text-secondary)' }}>R$ {Number(item.setup_total || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-4 text-sm text-right" style={{ color: 'var(--t-primary)' }}>R$ {Number(item.mrr_total || 0).toLocaleString('pt-BR')}/mês</td>
                      <td className="px-5 py-4 text-sm text-right" style={{ color: 'var(--t-text-secondary)' }}>R$ {Number(item.media_setup || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-4 text-sm text-right" style={{ color: 'var(--t-text-secondary)' }}>R$ {Number(item.media_mrr || 0).toLocaleString('pt-BR')}/mês</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold" style={{ color: '#16a34a' }}>R$ {item.valor_total.toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-5 py-4 w-32">
                        <div className="w-full rounded-full h-2" style={{ background: 'var(--t-content-bg)' }}>
                          <div className="h-2 rounded-full" style={{ width: `${(item.valor_total / maxValor) * 100}%`, background: '#16a34a' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
