'use client';

import { useEffect, useState } from 'react';
import { useAuth, useRequireGestorRedirect } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';

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

const MEDALS = ['🥇', '🥈', '🥉'];

const USUARIOS_NAMES: Record<string, string> = {
  'user-ceo': 'CEO',
  'user-supervisao': 'Supervisão',
  'vendedor-1': 'Vendedor 1',
  'vendedor-2': 'Vendedor 2',
  'vendedor-3': 'Vendedor 3',
};

function periodoAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function RankingPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { blocked } = useRequireGestorRedirect();  // ranking só p/ supervisão
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

  // Prioriza o nome resolvido pelo backend (responsavel_nome); fallback no dicionário.
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
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const maxValor = ranking.length > 0 ? ranking[0].valor_total : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ranking Comercial</h1>
            <p className="text-gray-500 mt-1">Performance por vendedor no período</p>
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
          <div className="flex gap-2">
            {periods.map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${periodo === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Calculando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-gray-500">Sem dados de vendas para {periodo}</p>
            <p className="text-sm text-gray-400 mt-1">Registre leads ganhos e propostas aceitas para aparecer no ranking</p>
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {ranking.length >= 1 && (
              <div className="flex gap-4 justify-center items-end">
                {[ranking[1], ranking[0], ranking[2]].filter(Boolean).map((item, idx) => {
                  const originalPos = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                  const heights = ['h-28', 'h-36', 'h-24'];
                  const bgs = ['bg-gray-100', 'bg-yellow-50 border-2 border-yellow-300', 'bg-orange-50'];
                  return (
                    <div key={item.responsavel_id} className={`flex-1 max-w-48 ${bgs[idx]} rounded-xl p-4 text-center ${heights[idx]} flex flex-col justify-end`}>
                      <div className="text-2xl mb-1">{MEDALS[originalPos] || `#${item.posicao}`}</div>
                      <p className="font-bold text-gray-900 text-sm">{nomeVendedor(item)}</p>
                      <p className="text-lg font-bold text-green-700">R$ {item.valor_total.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-gray-500">{item.leads_ganhos} ganhos · {item.contratos} contratos</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full ranking */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Leads Ganhos</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Propostas Aceitas</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Contratos</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Setup acum.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Mensalidade acum.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Média setup</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Média mens.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor Total</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Barra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ranking.map(item => (
                    <tr key={item.responsavel_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-xl">{MEDALS[item.posicao - 1] || `#${item.posicao}`}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                            {nomeVendedor(item).charAt(0)}
                          </div>
                          <p className="font-medium text-gray-900">{nomeVendedor(item)}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{item.leads_ganhos}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{item.propostas_aceitas}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{item.contratos}</td>
                      <td className="px-5 py-4 text-sm text-right text-gray-700">R$ {Number(item.setup_total || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-4 text-sm text-right text-blue-700">R$ {Number(item.mrr_total || 0).toLocaleString('pt-BR')}/mês</td>
                      <td className="px-5 py-4 text-sm text-right text-gray-600">R$ {Number(item.media_setup || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-5 py-4 text-sm text-right text-gray-600">R$ {Number(item.media_mrr || 0).toLocaleString('pt-BR')}/mês</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-green-700">R$ {item.valor_total.toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-5 py-4 w-32">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-green-500"
                            style={{ width: `${(item.valor_total / maxValor) * 100}%` }} />
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
