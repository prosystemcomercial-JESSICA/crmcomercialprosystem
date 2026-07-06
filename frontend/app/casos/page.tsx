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
  descricao?: string;
  fin_situacao?: string;
  fin_valor_atraso?: number;
  fin_dias_atraso?: number;
  fin_observacao?: string;
  updated_at?: string;
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
  reneg_proximo_vencimento?: string;
  cliente: {
    id: string;
    nome: string;
    empresa?: string;
    email: string;
    razao_social?: string;
    nome_fantasia?: string;
    mensalidade_base?: number;
    grupo_tecnico?: string;
    situacao?: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-opacity-0 ',
  DIAGNOSTICADO: 'bg-blue-100 text-blue-700',
  PLANEJADO: 'bg-yellow-100 text-yellow-700',
  EXECUTANDO: 'bg-purple-100 text-purple-700',
  RECUPERADO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

// Classificação de risco do cliente em churn — 4 faixas.
const RISK_COLOR = (score: number) => {
  if (score >= 85) return 'text-red-700';
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-green-600';
};

const RISK_LABEL = (score: number) => {
  if (score >= 85) return 'CRÍTICO';
  if (score >= 70) return 'ALTO';
  if (score >= 40) return 'MÉDIO';
  return 'BAIXO';
};

const RISK_BAR = (score: number) => {
  if (score >= 85) return 'bg-red-700';
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
};

// Faixas que o gestor escolhe ao classificar manualmente (valor representativo).
const RISK_NIVEIS = [
  { label: 'BAIXO', valor: 20 },
  { label: 'MÉDIO', valor: 50 },
  { label: 'ALTO', valor: 75 },
  { label: 'CRÍTICO', valor: 95 },
];

export default function CasosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState(''); // 'YYYY-MM' = filtra do 1º ao último dia do mês
  const [dataLoading, setDataLoading] = useState(true);
  const [rankingTec, setRankingTec] = useState<any[]>([]);
  // Dossiê do caso (ficha completa: financeiro + linha do tempo)
  const [dossie, setDossie] = useState<Caso | null>(null);
  const [atualizacoes, setAtualizacoes] = useState<any[]>([]);
  const [finForm, setFinForm] = useState<any>({});
  const [novaAtt, setNovaAtt] = useState<any>({ tipo: 'OBSERVACAO', texto: '', canal: '', resultado: '' });
  const [salvandoDossie, setSalvandoDossie] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchCasos = async () => {
    setDataLoading(true);
    try {
      // Mês selecionado → intervalo do 1º ao último dia.
      let di: string | undefined, df: string | undefined;
      if (mesFiltro && /^\d{4}-\d{2}$/.test(mesFiltro)) {
        const [y, mo] = mesFiltro.split('-').map(Number);
        di = new Date(y, mo - 1, 1).toISOString();
        df = new Date(y, mo, 0, 23, 59, 59).toISOString();
      }
      const res = await apiClient.getCasos(page, limit, statusFilter || undefined, undefined, undefined, busca || undefined, di, df);
      const data = res.data.data;
      setCasos(data.casos || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  // Abre o dossiê completo do caso (financeiro + linha do tempo).
  const abrirDossie = async (c: Caso) => {
    setDossie(c);
    setFinForm({ fin_situacao: c.fin_situacao || '', fin_valor_atraso: c.fin_valor_atraso ?? '', fin_dias_atraso: c.fin_dias_atraso ?? '', fin_observacao: c.fin_observacao || '', descricao: c.descricao || '', motivo_principal: c.motivo_principal || '' });
    setNovaAtt({ tipo: 'OBSERVACAO', texto: '', canal: '', resultado: '' });
    setAtualizacoes([]);
    try { const r = await apiClient.getAtualizacoesCaso(c.id); setAtualizacoes(r.data.data || []); } catch { /**/ }
  };

  const salvarDossie = async () => {
    if (!dossie) return;
    setSalvandoDossie(true);
    try {
      const payload: any = { descricao: finForm.descricao || undefined, motivo_principal: finForm.motivo_principal || undefined, fin_observacao: finForm.fin_observacao || undefined };
      if (finForm.fin_situacao) payload.fin_situacao = finForm.fin_situacao;
      if (finForm.fin_valor_atraso !== '') payload.fin_valor_atraso = Number(finForm.fin_valor_atraso);
      if (finForm.fin_dias_atraso !== '') payload.fin_dias_atraso = Number(finForm.fin_dias_atraso);
      await apiClient.updateCaso(dossie.id, payload);
      await fetchCasos();
      console.warn('Caso atualizado.');
    } catch (e: any) { console.error('Erro ao salvar.', e); }
    finally { setSalvandoDossie(false); }
  };

  // Monta o texto pronto para encaminhar ao SUPERVISOR TÉCNICO os problemas técnicos.
  const textoSupervisorTecnico = (c: Caso | null, atts: any[]): string => {
    if (!c) return '';
    const cli: any = c.cliente || {};
    const nome = cli.razao_social || cli.nome_fantasia || cli.nome || 'Cliente';
    const codigo = cli.codigo || cli.suporte || '—';
    const fila = cli.grupo_tecnico || '—';
    // Observação = descrição do caso + as atualizações registradas (linha do tempo).
    const obsCaso = (c.descricao || '').trim();
    const obsAtts = (atts || []).map((a: any) => `• ${a.texto}`).filter(Boolean).join('\n');
    const obs = [obsCaso, obsAtts].filter(Boolean).join('\n');
    return [
      `🔧 *Caso técnico para análise — ${nome}*`,
      `Cliente: ${nome} (cód. ${codigo})`,
      `Fila/Técnico responsável: ${fila}`,
      c.motivo_principal ? `Motivo: ${c.motivo_principal}` : '',
      ``,
      `*Problema relatado:*`,
      obs || '(sem observação registrada)',
      ``,
      `Favor avaliar e dar retorno sobre a resolução. Obrigada!`,
    ].filter(l => l !== undefined).join('\n');
  };
  const copiarParaTecnico = async () => {
    const txt = textoSupervisorTecnico(dossie, atualizacoes);
    try { await navigator.clipboard.writeText(txt); console.warn('Texto copiado! Cole no WhatsApp/e-mail do supervisor técnico.'); }
    catch { /* fallback: mostra para copiar manual */ window.prompt('Copie o texto para o supervisor técnico:', txt); }
  };

  const addAtualizacao = async () => {
    if (!dossie || !novaAtt.texto.trim()) { console.warn('Escreva a atualização.'); return; }
    try {
      await apiClient.addAtualizacaoCaso(dossie.id, novaAtt);
      const r = await apiClient.getAtualizacoesCaso(dossie.id);
      setAtualizacoes(r.data.data || []);
      setNovaAtt({ tipo: 'OBSERVACAO', texto: '', canal: '', resultado: '' });
    } catch (e: any) { console.error('Erro ao adicionar.', e); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchCasos();
  }, [isAuthenticated, page, statusFilter, mesFiltro]);

  // Ranking de saúde da carteira por técnico (mesma fonte do Health Score).
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getRankingTecnicos().then(r => setRankingTec(r.data.data || [])).catch(() => setRankingTec([]));
  }, [isAuthenticated]);

  // Busca por cliente (debounce 350ms).
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => { setPage(0); fetchCasos(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateCaso(id, { status });
      fetchCasos();
    } catch (e: any) {
      console.error(e);
      console.error('Não foi possível mudar o status. Tente novamente.', e);
    }
  };

  // Classifica o risco do cliente manualmente (Baixo/Médio/Alto/Crítico → score).
  const handleClassificarRisco = async (id: string, valor: number) => {
    try {
      await apiClient.updateCaso(id, { risk_score: valor });
      fetchCasos();
    } catch (e: any) {
      console.error('Erro ao classificar o risco.', e);
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
      reneg_proximo_vencimento: (c as any).reneg_proximo_vencimento ? (c as any).reneg_proximo_vencimento.slice(0, 10) : '',
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
            <h1 className="text-3xl font-bold text-sm font-semibold">Churn & Retenção</h1>
            <p className="text-gray-500 mt-1">{total} casos registrados</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="churn-casos" titulo="Churn & Retenção — Casos"
              linhas={casos}
              colunas={[
                { header: 'Código', value: (c: Caso) => (c.cliente as any)?.codigo || '' },
                { header: 'Cliente', value: (c: Caso) => c.cliente?.nome || '' },
                { header: 'Empresa', value: (c: Caso) => c.cliente?.empresa || '' },
                { header: 'Fila/Técnico', value: (c: Caso) => (c.cliente as any)?.grupo_tecnico || '' },
                { header: 'E-mail', value: (c: Caso) => c.cliente?.email || '' },
                { header: 'Status', value: (c: Caso) => c.status },
                { header: 'Risco', value: (c: Caso) => c.risk_score },
                { header: 'Motivo principal', value: (c: Caso) => c.motivo_principal || '' },
                { header: 'Relato / resumo', value: (c: Caso) => c.descricao || '' },
                { header: 'Situação financeira', value: (c: Caso) => c.fin_situacao || '' },
                { header: 'Valor devedor (R$)', value: (c: Caso) => c.fin_valor_atraso != null ? Number(c.fin_valor_atraso).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '' },
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

        {/* Busca por cliente + filtro mensal */}
        <div className="mb-2 flex gap-2 flex-wrap items-center">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar cliente por razão social, nome fantasia, código ou CNPJ…"
            className="flex-1 min-w-[220px] px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input type="month" value={mesFiltro} onChange={e => { setPage(0); setMesFiltro(e.target.value); }}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm" title="Filtrar por mês (1º ao último dia)" />
          {mesFiltro && <button onClick={() => setMesFiltro('')} className="text-xs  hover:text-gray-700 underline">limpar mês</button>}
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
                  : 'bg-white border border-gray-200  hover:bg-opacity-0'
              }`}
            >
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>

        {/* Ranking de saúde da carteira por técnico (quem tem mais clientes saindo) */}
        {rankingTec.length > 0 && (
          <div className="ps-card rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-sm font-semibold">🩺 Saúde da carteira por técnico</h2>
              <span className="text-xs ">só ativos · ordenado por mais risco/churn</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs  border-b border-gray-100">
                  <th className="py-1.5 pr-3">Técnico</th><th className="py-1.5 px-2 text-center">Ativos</th>
                  <th className="py-1.5 px-2 text-center">Em risco</th><th className="py-1.5 px-2 text-center">Em churn</th>
                  <th className="py-1.5 px-2 text-center">Saíram</th><th className="py-1.5 px-2 text-center">Saúde</th>
                </tr></thead>
                <tbody>
                  {[...rankingTec].sort((a, b) => (b.em_churn + b.em_risco) - (a.em_churn + a.em_risco)).map((t: any) => {
                    const cor = t.indice_saude >= 90 ? '#16a34a' : t.indice_saude >= 75 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={t.tecnico} className="border-b border-gray-50">
                        <td className="py-1.5 pr-3 font-medium ">{t.tecnico}</td>
                        <td className="py-1.5 px-2 text-center ">{t.ativos}</td>
                        <td className="py-1.5 px-2 text-center text-amber-600 font-semibold">{t.em_risco}</td>
                        <td className="py-1.5 px-2 text-center text-red-600 font-bold">{t.em_churn}</td>
                        <td className="py-1.5 px-2 text-center ">{t.inativos}</td>
                        <td className="py-1.5 px-2 text-center font-bold" style={{ color: cor }}>{t.indice_saude}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="ps-card rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center ">Carregando...</div>
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
              <thead className="bg-opacity-0 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Técnico</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Risco</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Motivo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold  uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {casos.map((caso) => (
                  <tr key={caso.id} className="hover:opacity-80 transition-colors">
                    <td className="px-6 py-4">
                      <button onClick={() => abrirDossie(caso)} className="flex items-center gap-3 text-left hover:opacity-80" title="Abrir caso (ver como está sendo tratado)">
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold">
                          {caso.cliente?.nome?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-blue-700 hover:underline">{caso.cliente?.razao_social || caso.cliente?.nome_fantasia || caso.cliente?.nome}</p>
                          <p className="text-sm ">{caso.cliente?.empresa || (caso.fin_situacao === 'EM_ATRASO' || caso.fin_situacao === 'INADIMPLENTE' ? `⚠ em atraso${caso.fin_valor_atraso ? ' R$ ' + Number(caso.fin_valor_atraso).toLocaleString('pt-BR') : ''}` : '')}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm ">{caso.cliente?.grupo_tecnico || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[caso.status] || 'bg-opacity-0 '}`}>
                        {caso.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-semibold text-sm ${RISK_COLOR(caso.risk_score)}`}>
                          {RISK_LABEL(caso.risk_score)}
                        </p>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div className={`h-1.5 rounded-full ${RISK_BAR(caso.risk_score)}`} style={{ width: `${caso.risk_score}%` }} />
                        </div>
                        {/* Classificar manualmente o risco do cliente */}
                        <select
                          value={RISK_LABEL(caso.risk_score)}
                          onChange={e => { const n = RISK_NIVEIS.find(r => r.label === e.target.value); if (n) handleClassificarRisco(caso.id, n.valor); }}
                          className="mt-1 text-xs border border-gray-200 rounded-md px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-blue-500"
                          title="Classificar risco do cliente"
                        >
                          {RISK_NIVEIS.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm  max-w-xs truncate">{caso.motivo_principal || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm ">
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
                              : 'bg-white border-gray-200  hover:bg-opacity-0'
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
            <p className="text-sm ">Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:opacity-80">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:opacity-80">Próximo</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal DOSSIÊ do caso (como está sendo tratado) ───────────────────── */}
      {dossie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDossie(null)}>
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 ps-card border-b px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm font-semibold">{dossie.cliente?.razao_social || dossie.cliente?.nome_fantasia || dossie.cliente?.nome}</h3>
                <p className="text-xs ">Caso de churn · {dossie.status} · risco {RISK_LABEL(dossie.risk_score)}</p>
              </div>
              <button onClick={() => setDossie(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Encaminhar ao supervisor técnico — texto pronto p/ copiar */}
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-sky-800">🔧 Encaminhar ao supervisor técnico</p>
                  <button onClick={copiarParaTecnico} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700">📋 Copiar texto</button>
                </div>
                <pre className="text-xs  whitespace-pre-wrap font-sans ps-card rounded-lg border border-sky-100 p-3 max-h-40 overflow-y-auto">{textoSupervisorTecnico(dossie, atualizacoes)}</pre>
                <p className="text-[11px] text-sky-700 mt-1">Inclui nome + código do cliente, a fila/técnico que atende e a observação registrada. Atualiza ao adicionar novas observações abaixo.</p>
              </div>

              {/* Motivo + descrição do problema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium  mb-1">Motivo principal</label>
                  <input value={finForm.motivo_principal || ''} onChange={e => setFinForm((f: any) => ({ ...f, motivo_principal: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex.: Dificuldade financeira" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium  mb-1">Descrição do problema / contexto</label>
                  <textarea value={finForm.descricao || ''} onChange={e => setFinForm((f: any) => ({ ...f, descricao: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="O que motivou a abertura do caso, contexto, histórico…" />
                </div>
              </div>

              {/* Situação financeira */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-800 mb-2">💵 Situação financeira</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium  mb-1">Situação</label>
                    <select value={finForm.fin_situacao || ''} onChange={e => setFinForm((f: any) => ({ ...f, fin_situacao: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm ps-card">
                      <option value="">—</option>
                      <option value="EM_DIA">Em dia</option>
                      <option value="EM_ATRASO">Em atraso</option>
                      <option value="NEGOCIANDO">Negociando</option>
                      <option value="INADIMPLENTE">Inadimplente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium  mb-1">Valor em atraso (R$)</label>
                    <input type="number" step="0.01" value={finForm.fin_valor_atraso} onChange={e => setFinForm((f: any) => ({ ...f, fin_valor_atraso: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium  mb-1">Dias em atraso</label>
                    <input type="number" value={finForm.fin_dias_atraso} onChange={e => setFinForm((f: any) => ({ ...f, fin_dias_atraso: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0" />
                  </div>
                </div>
                <textarea value={finForm.fin_observacao || ''} onChange={e => setFinForm((f: any) => ({ ...f, fin_observacao: e.target.value }))} rows={2}
                  className="w-full mt-2 px-3 py-2 border border-amber-200 rounded-lg text-sm ps-card" placeholder="Detalhes: boletos vencidos, parcelas, acordo em andamento…" />
              </div>

              <div className="flex justify-end">
                <button onClick={salvarDossie} disabled={salvandoDossie}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 disabled:opacity-50">
                  {salvandoDossie ? 'Salvando…' : 'Salvar dados do caso'}
                </button>
              </div>

              {/* Linha do tempo / atualizações */}
              <div>
                <p className="text-sm font-bold  mb-2">🕓 Atualizações, contatos e tentativas</p>
                {/* Adicionar */}
                <div className="rounded-lg border border-gray-200 p-3 mb-3 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <select value={novaAtt.tipo} onChange={e => setNovaAtt((a: any) => ({ ...a, tipo: e.target.value }))}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm ps-card">
                      <option value="OBSERVACAO">📝 Observação</option>
                      <option value="CONTATO">📞 Contato</option>
                      <option value="TENTATIVA">📲 Tentativa</option>
                      <option value="FINANCEIRO">💵 Financeiro</option>
                    </select>
                    {(novaAtt.tipo === 'CONTATO' || novaAtt.tipo === 'TENTATIVA') && (
                      <>
                        <select value={novaAtt.canal} onChange={e => setNovaAtt((a: any) => ({ ...a, canal: e.target.value }))}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm ps-card">
                          <option value="">Canal…</option>
                          <option value="TELEFONE">Telefone</option><option value="WHATSAPP">WhatsApp</option>
                          <option value="EMAIL">E-mail</option><option value="PRESENCIAL">Presencial</option><option value="OUTRO">Outro</option>
                        </select>
                        <select value={novaAtt.resultado} onChange={e => setNovaAtt((a: any) => ({ ...a, resultado: e.target.value }))}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm ps-card">
                          <option value="">Resultado…</option>
                          <option value="ATENDEU">Atendeu</option><option value="NAO_ATENDEU">Não atendeu</option>
                          <option value="RETORNARA">Vai retornar</option><option value="SEM_RESPOSTA">Sem resposta</option><option value="RESOLVIDO">Resolvido</option>
                        </select>
                      </>
                    )}
                  </div>
                  <textarea value={novaAtt.texto} onChange={e => setNovaAtt((a: any) => ({ ...a, texto: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Descreva a atualização, o contato realizado, o que foi tratado…" />
                  <div className="flex justify-end">
                    <button onClick={addAtualizacao} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-emerald-600">+ Adicionar atualização</button>
                  </div>
                </div>
                {/* Lista */}
                <div className="space-y-2 max-h-64 overflow-auto">
                  {atualizacoes.length === 0 && <p className="text-sm ">Nenhuma atualização ainda.</p>}
                  {atualizacoes.map((a: any) => {
                    const ICON: Record<string, string> = { OBSERVACAO: '📝', CONTATO: '📞', TENTATIVA: '📲', FINANCEIRO: '💵', STATUS: '🔄', SISTEMA: '⚙️' };
                    return (
                      <div key={a.id} className="flex gap-2 rounded-lg border border-gray-100 px-3 py-2">
                        <span>{ICON[a.tipo] || '•'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm ">{a.texto}</p>
                          <p className="text-[11px] ">
                            {a.canal ? `${a.canal} · ` : ''}{a.resultado ? `${a.resultado} · ` : ''}
                            {a.feito_por_nome || ''} · {new Date(a.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Renegociação (dificuldade financeira) ───────────────────── */}
      {reneg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReneg(null)}>
          <div
            className="ps-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 sticky top-0 ps-card rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-sm font-semibold flex items-center gap-2">💰 Renegociação de dívida</h2>
                <p className="text-sm  mt-0.5">
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
                  <label className="block text-sm font-medium  mb-1">Valor devido (R$) *</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={renegForm.reneg_valor_devido}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_valor_devido: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium  mb-1">Entrada (R$)</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={renegForm.reneg_valor_entrada}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_valor_entrada: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium  mb-1">Data do acordo</label>
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
                <div className="bg-opacity-0 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium  mb-1">Parcelas restantes</label>
                      <select
                        value={renegForm.reneg_parcelas}
                        onChange={e => setRenegForm((f: any) => ({ ...f, reneg_parcelas: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ps-card"
                      >
                        <option value="">À vista / sem parcelar</option>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm  space-y-0.5">
                      <p>Saldo a parcelar: <b className="text-sm font-semibold">{fmtBRL(rSaldo)}</b></p>
                      {rParcelas > 0 && (
                        <p>{rParcelas}x de <b className="text-emerald-700">{fmtBRL(rValorParcela)}</b></p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium  mb-1">Data do próximo vencimento</label>
                    <input
                      type="date"
                      value={renegForm.reneg_proximo_vencimento || ''}
                      onChange={e => setRenegForm((f: any) => ({ ...f, reneg_proximo_vencimento: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ps-card"
                    />
                    <p className="text-xs  mt-1">Quando vence a entrada/1ª parcela acordada.</p>
                  </div>
                </div>
              )}

              {/* responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium  mb-1">Responsável (nome completo) *</label>
                  <input
                    type="text"
                    value={renegForm.reneg_responsavel}
                    onChange={e => setRenegForm((f: any) => ({ ...f, reneg_responsavel: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Quem assina o acordo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium  mb-1">CPF do responsável *</label>
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
                <label className="block text-sm font-medium  mb-1">O que foi feito para manter o cliente?</label>
                <textarea
                  rows={2}
                  value={renegForm.reneg_como_mantido}
                  onChange={e => setRenegForm((f: any) => ({ ...f, reneg_como_mantido: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex.: desconto temporário, parcelamento do débito, troca de plano…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium  mb-1">Como ficou após a renegociação?</label>
                <textarea
                  rows={2}
                  value={renegForm.reneg_resultado}
                  onChange={e => setRenegForm((f: any) => ({ ...f, reneg_resultado: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex.: cliente mantido no plano Pro, débito quitado em 3x, relação normalizada."
                />
              </div>

              {/* RESUMO DO ACORDO — como fica a mensalidade + o que foi acordado */}
              {rDevido > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-800 mb-2">📋 Resumo do acordo</p>
                  <div className="space-y-1 text-sm ">
                    <div className="flex justify-between"><span>Mensalidade do cliente (cadastro)</span><b className="text-sm font-semibold">{fmtBRL(Number(reneg?.cliente?.mensalidade_base || 0))}</b></div>
                    <div className="flex justify-between"><span>Valor devido</span><b className="text-sm font-semibold">{fmtBRL(rDevido)}</b></div>
                    {rEntrada > 0 && <div className="flex justify-between"><span>Entrada no ato</span><b className="text-sm font-semibold">{fmtBRL(rEntrada)}</b></div>}
                    <div className="flex justify-between">
                      <span>Parcelamento do débito</span>
                      <b className="text-emerald-700">{rParcelas > 0 ? `${rParcelas}x de ${fmtBRL(rValorParcela)}` : 'À vista'}</b>
                    </div>
                    {renegForm.reneg_proximo_vencimento && (
                      <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1">
                        <span>Próximo vencimento</span>
                        <b className="text-sm font-semibold">{new Date(renegForm.reneg_proximo_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</b>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-emerald-700 mt-2">Este resumo fica registrado na ficha do cliente.</p>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6 border-t border-gray-100 sticky bottom-0 ps-card rounded-b-2xl">
              <button
                onClick={() => setReneg(null)}
                className="px-4 py-2.5  border border-gray-300 rounded-lg hover:opacity-80 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={async () => { const ok = await salvarRenegociacao(); if (ok) setReneg(null); }}
                disabled={renegSaving}
                className="px-5 py-2.5 ps-card border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors font-medium"
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
