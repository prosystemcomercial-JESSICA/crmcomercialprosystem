'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';

// Somente estes papéis podem ver a aba "Visão Executiva" (Radar) — gate interno
// ao componente, independente do gate de rota de /casos (que é visível também
// para SUPERVISAO_TECNICA e TECNICO_SUPORTE, que NÃO devem ver dados executivos).
const SO_CEO_ROLES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];

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
  dias_sem_contato?: number | null;
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
  resolvido_em?: string;
  reaberto?: boolean;
  reaberto_em?: string;
  reaberto_motivo_travado?: string;
  resolvido_em_2?: string;
  sistema_removido_em?: string;
  retroativo?: boolean;
  data_abertura_real?: string;
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

// Casos encerrados: risco não se aplica mais (não faz sentido reclassificar ou
// destacar como crítico algo que já foi resolvido, perdido, ou teve o sistema removido).
const ENCERRADOS = ['RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO'];

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-opacity-0 ',
  DIAGNOSTICADO: 'bg-blue-100 text-blue-700',
  PLANEJADO: 'bg-yellow-100 text-yellow-700',
  EXECUTANDO: 'bg-purple-100 text-purple-700',
  RECUPERADO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
  SISTEMA_REMOVIDO: 'bg-gray-200 text-gray-700',
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

// Dias em aberto: da data de início (retroativo, se informada, senão created_at)
// até a resolução (resolvido_em) ou até hoje, se ainda ativo.
const diasEmAberto = (caso: Caso): number => {
  const inicio = new Date(caso.data_abertura_real || caso.created_at).getTime();
  const fim = caso.resolvido_em ? new Date(caso.resolvido_em).getTime() : Date.now();
  return Math.max(0, Math.round((fim - inicio) / 86400000));
};

// Faixas que o gestor escolhe ao classificar manualmente (valor representativo).
const RISK_NIVEIS = [
  { label: 'BAIXO', valor: 20 },
  { label: 'MÉDIO', valor: 50 },
  { label: 'ALTO', valor: 75 },
  { label: 'CRÍTICO', valor: 95 },
];

// ── Aba "Visão Executiva" (Radar) — adaptado de app/churn-ceo/page.tsx ──────

interface Atualizacao {
  id: string;
  tipo: string;
  texto: string;
  canal?: string;
  resultado?: string;
  feito_por_nome?: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo',
  DIAGNOSTICADO: 'Diagnosticado',
  PLANEJADO: 'Planejado',
  EXECUTANDO: 'Em andamento',
  RECUPERADO: 'Recuperado',
  PERDIDO: 'Perdido',
  SISTEMA_REMOVIDO: 'Sistema removido',
};

const STATUS_COR: Record<string, { bg: string; text: string; dot: string }> = {
  NOVO:             { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  DIAGNOSTICADO:    { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  PLANEJADO:        { bg: '#FEF9C3', text: '#92400E', dot: '#F59E0B' },
  EXECUTANDO:       { bg: '#EDE9FE', text: '#6D28D9', dot: '#8B5CF6' },
  RECUPERADO:       { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  PERDIDO:          { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  SISTEMA_REMOVIDO: { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
};

const RADAR_RISK_COR = (s: number) => s >= 85 ? '#B91C1C' : s >= 70 ? '#DC2626' : s >= 40 ? '#D97706' : '#16A34A';
const RADAR_RISK_LABEL = (s: number) => s >= 85 ? 'CRÍTICO' : s >= 70 ? 'ALTO' : s >= 40 ? 'MÉDIO' : 'BAIXO';

const URGENCIA_COR = (dias: number) =>
  dias >= 30 ? { bg: '#FEE2E2', text: '#991B1B', borda: '#FECACA' } :
  dias >= 14 ? { bg: '#FEF9C3', text: '#92400E', borda: '#FDE68A' } :
               { bg: '#F0FDF4', text: '#166534', borda: '#BBF7D0' };

const RADAR_ICON: Record<string, string> = {
  OBSERVACAO: '📝', CONTATO: '📞', TENTATIVA: '📲', FINANCEIRO: '💵', STATUS: '🔄', SISTEMA: '⚙️',
};

function RadarCard({ caso, atualizacoes, onClick }: { caso: Caso; atualizacoes: Atualizacao[]; onClick: () => void }) {
  const encerrado = ENCERRADOS.includes(caso.status);
  const dias = diasEmAberto(caso);
  const urg = encerrado ? { bg: '#F3F4F6', text: '#374151', borda: '#E5E7EB' } : URGENCIA_COR(dias);
  const cor = STATUS_COR[caso.status] || STATUS_COR.NOVO;
  const atts = atualizacoes || [];
  const ultimaAtt = atts[0];
  const responsavel = caso.cliente?.grupo_tecnico || '—';

  // Contagem por tipo de ação
  const contatos = atts.filter(a => ['CONTATO', 'TENTATIVA'].includes(a.tipo)).length;
  const observacoes = atts.filter(a => a.tipo === 'OBSERVACAO').length;
  const financeiro = atts.filter(a => a.tipo === 'FINANCEIRO').length;

  const nomeCliente = caso.cliente?.razao_social || caso.cliente?.nome_fantasia || caso.cliente?.nome || '—';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md"
      style={{ background: '#fff', border: `1.5px solid ${urg.borda}`, boxShadow: '0 1px 4px rgba(13,34,56,.06)' }}
    >
      {/* Topo: nome + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-xs"
            style={{ background: cor.dot }}>
            {nomeCliente.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-sm font-semibold truncate max-w-[180px]">{nomeCliente}</p>
            <span style={{ background: cor.bg, color: cor.text, borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
              {STATUS_LABEL[caso.status] || caso.status}
            </span>
          </div>
        </div>
        {/* Risco score */}
        {!encerrado && (
          <span className="text-xs font-black flex-shrink-0" style={{ color: RADAR_RISK_COR(caso.risk_score) }}>
            {caso.risk_score}% {RADAR_RISK_LABEL(caso.risk_score)}
          </span>
        )}
      </div>

      {/* 3 métricas do radar */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Tempo */}
        <div className="rounded-xl p-2 text-center" style={{ background: urg.bg, border: `1px solid ${urg.borda}` }}>
          <p className="text-[18px] font-black leading-tight" style={{ color: urg.text }}>{dias}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: urg.text, opacity: 0.75 }}>
            {encerrado ? 'dias (total)' : 'dias aberto'}
          </p>
        </div>
        {/* Ações */}
        <div className="rounded-xl p-2 text-center" style={{ background: '#F0F4FF', border: '1px solid #C7D7F5' }}>
          <p className="text-[18px] font-black text-blue-700 leading-tight">{atts.length}</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">ações feitas</p>
        </div>
        {/* Em quem está */}
        <div className="rounded-xl p-2 text-center" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <p className="text-[11px] font-bold text-purple-800 leading-tight truncate" title={responsavel}>
            {responsavel.length > 10 ? responsavel.slice(0, 10) + '…' : responsavel}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-purple-500">responsável</p>
        </div>
      </div>

      {/* Breakdown de ações */}
      {atts.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {contatos > 0 && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5">📞 {contatos} contato{contatos > 1 ? 's' : ''}</span>}
          {observacoes > 0 && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5">📝 {observacoes} obs.</span>}
          {financeiro > 0 && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5">💵 {financeiro} fin.</span>}
        </div>
      )}

      {/* Última ação */}
      <div className="border-t pt-2" style={{ borderColor: '#F0F4F8' }}>
        {ultimaAtt ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Última ação</p>
            <p className="text-[11px] leading-snug line-clamp-2">
              {RADAR_ICON[ultimaAtt.tipo] || '•'} {ultimaAtt.texto}
            </p>
            <p className="text-[10px] mt-0.5">
              {ultimaAtt.feito_por_nome ? `${ultimaAtt.feito_por_nome} · ` : ''}
              {new Date(ultimaAtt.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </p>
          </div>
        ) : (
          <p className="text-[11px] italic">Nenhuma ação registrada ainda.</p>
        )}
      </div>
    </button>
  );
}

export default function CasosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState(''); // 'YYYY-MM' = filtra do 1º ao último dia do mês
  const [dataLoading, setDataLoading] = useState(true);
  // Dossiê do caso (ficha completa: financeiro + linha do tempo)
  const [dossie, setDossie] = useState<Caso | null>(null);
  const [atualizacoes, setAtualizacoes] = useState<any[]>([]);
  const [finForm, setFinForm] = useState<any>({});
  const [novaAtt, setNovaAtt] = useState<any>({ tipo: 'OBSERVACAO', texto: '', canal: '', resultado: '' });
  const [salvandoDossie, setSalvandoDossie] = useState(false);
  const [reabrirModal, setReabrirModal] = useState<Caso | null>(null);
  const [reabrirRelato, setReabrirRelato] = useState('');
  const [reabrindo, setReabrindo] = useState(false);
  const limit = 20;

  // Gate de role interno: mesmo dentro de /casos (visível a papéis técnicos),
  // só CEO/ADMIN/SUPERVISAO_COMERCIAL podem ver a aba "Visão Executiva".
  const podeVerVisaoExecutiva = SO_CEO_ROLES.includes((user?.role || '').toUpperCase());
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'executiva'>('lista');

  // Dados da aba executiva (Radar): busca própria (getCasos(0,200) sem filtro),
  // guardada em state SEPARADO de `casos` (que alimenta a Lista paginada) para
  // não contaminar a contagem/paginação exibida na aba Lista.
  const [casosRadar, setCasosRadar] = useState<Caso[]>([]);
  // Dados da aba executiva (Radar): atualizações de cada caso ativo, carregadas
  // sob demanda — só dispara se a aba estiver ativa E o usuário tiver o role certo.
  const [atualizacoesPorCaso, setAtualizacoesPorCaso] = useState<Record<string, Atualizacao[]>>({});
  const [carregandoRadar, setCarregandoRadar] = useState(false);
  const radarCarregadoRef = useRef(false);

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

  // Busca por cliente (debounce 350ms).
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => { setPage(0); fetchCasos(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  // Carrega as atualizações de cada caso ativo para os cards do Radar (aba
  // "Visão Executiva"). Busca dedicada porque a listagem paginada de /casos
  // não cobre necessariamente todos os casos ativos (paginação/filtros distintos
  // do que o Radar precisa mostrar), e porque nunca deve disparar para quem
  // não tem o role executivo.
  const carregarRadar = useCallback(async () => {
    if (!podeVerVisaoExecutiva) return;
    setCarregandoRadar(true);
    try {
      const res = await apiClient.getCasos(0, 200);
      const todosCasos: Caso[] = res.data?.data?.casos || [];
      const ativos = todosCasos.filter(c => !ENCERRADOS.includes(c.status));
      const resultados = await Promise.all(ativos.map(async (c) => {
        try {
          const r = await apiClient.getAtualizacoesCaso(c.id);
          return [c.id, r.data?.data || []] as const;
        } catch {
          return [c.id, []] as const;
        }
      }));
      setAtualizacoesPorCaso(Object.fromEntries(resultados));
      // Popula o state dedicado do Radar — nunca mescla em `casos`, que é o
      // state paginado usado pela aba Lista (evita alterar a contagem/paginação
      // exibida lá com casos que o backend não retornou para aquela página/filtro).
      setCasosRadar(todosCasos);
    } catch { /* silencioso */ }
    finally { setCarregandoRadar(false); }
  }, [podeVerVisaoExecutiva]);

  useEffect(() => {
    if (abaAtiva === 'executiva' && podeVerVisaoExecutiva && !radarCarregadoRef.current) {
      radarCarregadoRef.current = true;
      carregarRadar();
    }
    if (abaAtiva !== 'executiva') radarCarregadoRef.current = false;
  }, [abaAtiva, podeVerVisaoExecutiva, carregarRadar]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateCaso(id, { status });
      await fetchCasos();
      return true;
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || 'Não foi possível mudar o status. Tente novamente.');
      return false;
    }
  };

  const handleReabrir = async () => {
    if (!reabrirModal || !reabrirRelato.trim()) return;
    setReabrindo(true);
    try {
      await apiClient.reabrirCaso(reabrirModal.id, reabrirRelato.trim());
      setReabrirModal(null);
      setReabrirRelato('');
      setDossie(null);
      fetchCasos();
    } catch (e: any) {
      console.error('Erro ao reabrir caso.', e?.response?.data?.message || e);
    } finally {
      setReabrindo(false);
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

  const statuses = ['', 'NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO'];

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

        {/* Alternador Lista / Visão Executiva — a aba executiva só é renderizada
            (botão e conteúdo) para quem tem o role certo; dupla checagem abaixo. */}
        {podeVerVisaoExecutiva && (
          <div className="flex gap-2">
            <button
              onClick={() => setAbaAtiva('lista')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${abaAtiva === 'lista' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 hover:bg-opacity-0'}`}
            >
              ☰ Lista
            </button>
            <button
              onClick={() => setAbaAtiva('executiva')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${abaAtiva === 'executiva' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 hover:bg-opacity-0'}`}
            >
              ◎ Visão Executiva
            </button>
          </div>
        )}

        {/* ===== ABA VISÃO EXECUTIVA (Radar) — gate de role duplicado aqui,
            não depende apenas do botão acima não ter sido renderizado ===== */}
        {abaAtiva === 'executiva' && podeVerVisaoExecutiva && (() => {
          const emAndamento = casosRadar.filter(c => !ENCERRADOS.includes(c.status));
          const encerradosLista = casosRadar.filter(c => ENCERRADOS.includes(c.status));
          const kpis = [
            { l: 'Em andamento', v: emAndamento.length, cor: '#7C3AED' },
            { l: 'Crítico / Alto risco', v: emAndamento.filter(c => c.risk_score >= 70).length, cor: '#DC2626' },
            { l: 'Recuperados', v: encerradosLista.filter(c => c.status === 'RECUPERADO').length, cor: '#16A34A' },
            { l: 'Perdidos', v: encerradosLista.filter(c => c.status === 'PERDIDO').length, cor: '#B91C1C' },
          ];
          return (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {kpis.map((k, i) => (
                  <div key={i} className="ps-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid #E3ECF5', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
                    <span className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: k.cor }} />
                    <p className="text-[11px] font-medium pl-1.5">{k.l}</p>
                    <p className="text-3xl font-extrabold pl-1.5 mt-1" style={{ color: k.cor }}>{k.v}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold">Radar de Casos em Aberto</p>
                  <p className="text-xs">Tempo registrado · ações tomadas · responsável atual — apenas casos ativos</p>
                </div>
                <button onClick={() => { radarCarregadoRef.current = false; carregarRadar(); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors bg-blue-50 text-blue-700 border border-blue-200">
                  ↻ Atualizar
                </button>
              </div>

              {carregandoRadar && emAndamento.length === 0 ? (
                <div className="text-center py-16">Carregando…</div>
              ) : emAndamento.length === 0 ? (
                <div className="text-center py-16">Nenhum caso ativo no momento.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {emAndamento
                    .slice()
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(c => (
                      <RadarCard
                        key={c.id}
                        caso={c}
                        atualizacoes={atualizacoesPorCaso[c.id] || []}
                        onClick={() => { setAbaAtiva('lista'); abrirDossie(c); }}
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ===== ABA LISTA ===== */}
        {abaAtiva === 'lista' && <>
        {/* Busca por cliente + filtro mensal */}
        <div className="mb-2 flex gap-2 flex-wrap items-center">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar cliente por razão social, nome fantasia, contato, código ou CNPJ…"
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

        {/* Saúde da carteira por técnico — link para tela dedicada */}
        <div className="ps-card rounded-xl p-4 flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Saúde da carteira por técnico</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Ranking completo disponível na tela de Health Score.</p>
          </div>
          <Link href="/health-score" className="text-[11px] font-semibold" style={{ color: 'var(--t-primary)' }}>
            Ver ranking completo →
          </Link>
        </div>

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
                  <th className="px-6 py-3 text-left text-xs font-semibold  uppercase tracking-wider">Dias em aberto</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold  uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {casos.map((caso) => (
                  <tr key={caso.id} className={`hover:opacity-80 transition-colors ${caso.reaberto ? 'bg-orange-50' : ''}`}>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[caso.status] || 'bg-opacity-0 '}`}>
                          {caso.status}
                        </span>
                        {caso.reaberto && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-300" title="Este caso já foi reaberto uma vez">
                            🔄 Reaberto
                          </span>
                        )}
                        {caso.sistema_removido_em && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700 border border-gray-300" title={`Sistema removido em ${new Date(caso.sistema_removido_em).toLocaleDateString('pt-BR')}`}>
                            🗑️ Removido
                          </span>
                        )}
                        {typeof caso.dias_sem_contato === 'number' && caso.dias_sem_contato >= 3 && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${caso.dias_sem_contato >= 7 ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}
                            title="Cliente em atraso/inadimplência sem nenhum registro de contato na linha do tempo do caso — considere entrar em contato ou renegociar."
                          >
                            ⏰ {caso.dias_sem_contato} {caso.dias_sem_contato === 1 ? 'dia' : 'dias'} sem contato
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {ENCERRADOS.includes(caso.status) ? (
                        <span className="text-sm text-gray-400">—</span>
                      ) : (
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
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm  max-w-xs truncate">{caso.motivo_principal || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm ">
                      {new Date(caso.data_abertura_real || caso.created_at).toLocaleDateString('pt-BR')}
                      {caso.retroativo && <span className="ml-1 text-[10px] text-gray-400" title="Data retroativa informada manualmente">(retroativo)</span>}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {diasEmAberto(caso)} {diasEmAberto(caso) === 1 ? 'dia' : 'dias'}
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
                          {[
                            'NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO',
                            // "Sistema removido" só é uma opção válida a partir de PERDIDO (regra do backend).
                            ...(caso.status === 'PERDIDO' || caso.status === 'SISTEMA_REMOVIDO' ? ['SISTEMA_REMOVIDO'] : []),
                          ].map(s => (
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
        </>}
      </div>

      {/* ── Modal DOSSIÊ do caso (como está sendo tratado) ───────────────────── */}
      {dossie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDossie(null)}>
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 ps-card border-b px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm font-semibold">{dossie.cliente?.razao_social || dossie.cliente?.nome_fantasia || dossie.cliente?.nome}</h3>
                <p className="text-xs ">
                  Caso de churn · {dossie.status}{!ENCERRADOS.includes(dossie.status) && <> · risco {RISK_LABEL(dossie.risk_score)}</>} · {diasEmAberto(dossie)} {diasEmAberto(dossie) === 1 ? 'dia' : 'dias'} em aberto
                  {dossie.retroativo && <span className="ml-1.5 text-gray-500">(retroativo, iniciado em {new Date(dossie.data_abertura_real!).toLocaleDateString('pt-BR')})</span>}
                  {dossie.reaberto && <span className="ml-1.5 text-orange-600 font-semibold">· 🔄 já reaberto uma vez</span>}
                  {dossie.sistema_removido_em && <span className="ml-1.5 text-gray-500 font-semibold">· 🗑️ sistema removido em {new Date(dossie.sistema_removido_em).toLocaleDateString('pt-BR')}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dossie.status === 'RECUPERADO' && !dossie.reaberto && (
                  <button onClick={() => { setReabrirModal(dossie); setReabrirRelato(''); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200">
                    🔄 Reabrir caso
                  </button>
                )}
                {dossie.status === 'PERDIDO' && !dossie.sistema_removido_em && (
                  <button onClick={async () => { const ok = await handleUpdateStatus(dossie.id, 'SISTEMA_REMOVIDO'); if (ok) setDossie(null); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300">
                    🗑️ Marcar sistema removido
                  </button>
                )}
                <button onClick={() => setDossie(null)} className="text-gray-400 hover:text-gray-700">✕</button>
              </div>
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

      {/* ── Modal de REABERTURA (só permitida 1x, mesmo motivo travado) ──────── */}
      {reabrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReabrirModal(null)}>
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-sm">🔄 Reabrir caso</h3>
              <button onClick={() => setReabrirModal(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600">
                Esta reabertura só pode ser feita <b>uma única vez</b>. O caso volta para "EXECUTANDO" mantendo o motivo original — se o cliente for perdido de novo depois desta reabertura, será necessário abrir um caso novo.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1">Motivo original (travado)</label>
                <input value={reabrirModal.motivo_principal || '—'} disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">O que aconteceu de novo?</label>
                <textarea value={reabrirRelato} onChange={e => setReabrirRelato(e.target.value)} rows={3} autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Descreva o que motivou a reabertura…" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t">
              <button onClick={() => setReabrirModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:opacity-80">
                Cancelar
              </button>
              <button onClick={handleReabrir} disabled={reabrindo || !reabrirRelato.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50">
                {reabrindo ? 'Reabrindo…' : 'Confirmar reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
