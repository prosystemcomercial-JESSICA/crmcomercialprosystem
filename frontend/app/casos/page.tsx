'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';

interface Caso {
  id: string;
  status: string;
  risk_score: number;
  motivo_principal?: string;
  created_at: string;
  reneg_ativa?: boolean;
  reneg_como_mantido?: string;
  reneg_resultado?: string;
  reneg_valor_devido?: number;
  reneg_valor_entrada?: number;
  reneg_parcelas?: number;
  reneg_responsavel?: string;
  reneg_responsavel_cpf?: string;
  reneg_data?: string;
  cliente: {
    id: string;
    nome: string;
    empresa?: string;
    email: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-gray-100 text-gray-700',
  DIAGNOSTICADO: 'bg-blue-100 text-blue-700',
  PLANEJADO: 'bg-yellow-100 text-yellow-700',
  EXECUTANDO: 'bg-purple-100 text-purple-700',
  RECUPERADO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

const RISK_COLOR = (score: number) => {
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-green-600';
};

const RISK_LABEL = (score: number) => {
  if (score >= 70) return 'ALTO';
  if (score >= 40) return 'MÉDIO';
  return 'BAIXO';
};

export default function CasosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchCasos = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getCasos(page, limit, statusFilter || undefined);
      const data = res.data.data;
      setCasos(data.casos || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchCasos();
  }, [isAuthenticated, page, statusFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateCaso(id, { status });
      fetchCasos();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Renegociação (dificuldade financeira) ───────────────────────────────────
  const [reneg, setReneg] = useState<Caso | null>(null);
  const [renegForm, setRenegForm] = useState<any>({});
  const [renegSaving, setRenegSaving] = useState(false);
  const [renegErr, setRenegErr] = useState('');

  const abrirRenegociacao = (c: Caso) => {
    setRenegErr('');
    setRenegForm({
      reneg_valor_devido: c.reneg_valor_devido ?? '',
      reneg_valor_entrada: c.reneg_valor_entrada ?? '',
      reneg_parcelas: c.reneg_parcelas ?? '',
      reneg_responsavel: c.reneg_responsavel ?? '',
      reneg_responsavel_cpf: c.reneg_responsavel_cpf ?? '',
      reneg_como_mantido: c.reneg_como_mantido ?? '',
      reneg_resultado: c.reneg_resultado ?? '',
      reneg_data: c.reneg_data ? c.reneg_data.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setReneg(c);
  };

  const salvarRenegociacao = async (): Promise<boolean> => {
    if (!reneg) return false;
    setRenegSaving(true);
    setRenegErr('');
    try {
      await apiClient.salvarRenegociacao(reneg.id, { ...renegForm, reneg_ativa: true });
      await fetchCasos();
      return true;
    } catch (e: any) {
      setRenegErr(e?.response?.data?.message || 'Erro ao salvar renegociação');
      return false;
    } finally {
      setRenegSaving(false);
    }
  };

  const gerarTermoPdf = async () => {
    if (!renegForm.reneg_valor_devido || Number(renegForm.reneg_valor_devido) <= 0) {
      setRenegErr('Informe o valor devido antes de gerar o documento.'); return;
    }
    if (!renegForm.reneg_responsavel || !renegForm.reneg_responsavel_cpf) {
      setRenegErr('Informe o responsável e o CPF antes de gerar o documento.'); return;
    }
    const ok = await salvarRenegociacao(); // salva antes de gerar p/ refletir os campos
    if (ok && reneg) window.open(apiClient.renegociacaoPdfUrl(reneg.id), '_blank');
  };

  // Cálculo do saldo/parcelas (preview no modal)
  const rDevido = Number(renegForm.reneg_valor_devido) || 0;
  const rEntrada = Number(renegForm.reneg_valor_entrada) || 0;
  const rParcelas = Number(renegForm.reneg_parcelas) || 0;
  const rSaldo = Math.max(0, rDevido - rEntrada);
  const rValorParcela = rParcelas > 0 ? rSaldo / rParcelas : 0;
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statuses = ['', 'NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Churn & Retenção</h1>
            <p className="text-gray-500 mt-1">{total} casos registrados</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="churn-casos" titulo="Churn & Retenção — Casos"
              linhas={casos}
              colunas={[
                { header: 'Cliente', value: (c: Caso) => c.cliente?.nome || '' },
                { header: 'Empresa', value: (c: Caso) => c.cliente?.empresa || '' },
                { header: 'E-mail', value: (c: Caso) => c.cliente?.email || '' },
                { header: 'Status', value: (c: Caso) => c.status },
                { header: 'Risco', value: (c: Caso) => c.risk_score },
                { header: 'Motivo principal', value: (c: Caso) => c.motivo_principal || '' },
                { header: 'Aberto em', value: (c: Caso) => c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '' },
              ]}
            />
            <button
              onClick={() => router.push('/casos/novo')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Novo Caso
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : casos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500">Nenhum caso encontrado</p>
              <button onClick={() => router.push('/casos/novo')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Criar primeiro caso
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risco</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {casos.map((caso) => (
                  <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold">
                          {caso.cliente?.nome?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{caso.cliente?.nome}</p>
                          <p className="text-sm text-gray-500">{caso.cliente?.empresa}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[caso.status] || 'bg-gray-100 text-gray-700'}`}>
                        {caso.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-semibold text-sm ${RISK_COLOR(caso.risk_score)}`}>
                          {RISK_LABEL(caso.risk_score)}
                        </p>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${caso.risk_score >= 70 ? 'bg-red-500' : caso.risk_score >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${caso.risk_score}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{Math.round(caso.risk_score)}/100</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">{caso.motivo_principal || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(caso.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirRenegociacao(caso)}
                          title="Renegociar dívida (dificuldade financeira)"
                          className={`text-sm px-2.5 py-1 rounded-lg border font-medium transition-colors whitespace-nowrap ${
                            caso.reneg_ativa
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          💰 {caso.reneg_ativa ? 'Acordo' : 'Renegociar'}
                        </button>
                        <select
                          value={caso.status}
                          onChange={e => handleUpdateStatus(caso.id, e.target.value)}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de Renegociação (dificuldade financeira) ───────────────────── */}
      {reneg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReneg(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">💰 Renegociação de dívida</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {reneg.cliente?.nome}{reneg.cliente?.empresa ? ` — ${reneg.cliente.empresa}` : ''}
                </p>
              </div>
              <button onClick={() => setReneg(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              {renegErr && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{renegErr}</div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                Registre o acordo feito com o cliente. Os campos de parcelamento aparecem ao informar o <b>valor devido</b>.
                Ao final, gere o <b>termo de renegociação (PDF)</b> para formalizar e assinar.
              </div>

              {/* valores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor devido (R$) *</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={renegForm.reneg_valor_devido}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_valor_devido: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entrada (R$)</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={renegForm.reneg_valor_entrada}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_valor_entrada: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do acordo</label>
                  <input
                    type="date"
                    value={renegForm.reneg_data}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_data: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* parcelas — só quando há valor devido informado */}
              {rDevido > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas restantes</label>
                      <select
                        value={renegForm.reneg_parcelas}
                        onChange={e => setRenegForm((f: any) => ({ ...f, reneg_parcelas: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">À vista / sem parcelar</option>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <p>Saldo a parcelar: <b className="text-gray-900">{fmtBRL(rSaldo)}</b></p>
                      {rParcelas > 0 && (
                        <p>{rParcelas}x de <b className="text-emerald-700">{fmtBRL(rValorParcela)}</b></p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável (nome completo) *</label>
                  <input
                    type="text"
                    value={renegForm.reneg_responsavel}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_responsavel: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Quem assina o acordo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF do responsável *</label>
                  <input
                    type="text"
                    value={renegForm.reneg_responsavel_cpf}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_responsavel_cpf: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              {/* contexto de retenção */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">O que foi feito para manter o cliente?</label>
                <textarea
                  rows={2}
                  value={renegForm.reneg_como_mantido}
                  onChange={e => setRenegForm((f: any) => ({ ...f, reneg_como_mantido: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex.: desconto temporário, parcelamento do débito, troca de plano…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Como ficou após a renegociação?</label>
                <textarea
                  rows={2}
                  value={renegForm.reneg_resultado}
                  onChange={e => setRenegForm((f: any) => ({ ...f, reneg_resultado: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex.: cliente mantido no plano Pro, débito quitado em 3x, relação normalizada."
                />
              </div>
            </div>

            {/* footer */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setReneg(null)}
                className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={async () => { const ok = await salvarRenegociacao(); if (ok) setReneg(null); }}
                disabled={renegSaving}
                className="px-5 py-2.5 bg-white border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors font-medium"
              >
                {renegSaving ? 'Salvando…' : 'Salvar acordo'}
              </button>
              <button
                onClick={gerarTermoPdf}
                disabled={renegSaving}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
              >
                📄 Gerar termo (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
