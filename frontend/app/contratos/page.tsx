'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  FileCheck2, Plus, Search, Eye, Trash2, Edit3, Send, CheckCircle,
  X, ExternalLink, RefreshCw, User, Hash, Calendar,
  DollarSign, Shield, Pen, LayoutGrid, ListChecks, ChevronLeft, ChevronRight,
  TrendingUp, AlertCircle, Filter,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ContratoComercial {
  id: string;
  numero_contrato: string;
  sequencia: number;
  ano: number;
  proposta_comercial_id?: string;
  tipo_servico?: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  endereco?: string;
  numero_endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  representante_nome?: string;
  representante_cpf?: string;
  representante_email?: string;
  representante_telefone?: string;
  representante_cargo?: string;
  plano_contratado?: string;
  software_nome?: string;
  software_versao?: string;
  mensalidade?: number;
  dia_vencimento?: number;
  valor_setup_total?: number;
  valor_setup_entrada?: number;
  setup_parcelas?: number;
  valor_setup_parcela?: number;
  setup_a_vista?: boolean;
  setup_condicao_especial?: string;
  vendedor_id?: string;
  vendedor_nome?: string;
  supervisor_nome?: string;
  campanha?: string;
  condicao_especial?: string;
  data_contrato: string;
  modelo_contrato?: string;
  status: string;
  zapsign_doc_token?: string;
  zapsign_signer_token?: string;
  zapsign_signing_url?: string;
  zapsign_signed_file_url?: string;
  zapsign_status?: string;
  sent_to_sign_at?: string;
  signed_at?: string;
  comissao_vendedor_pct?: number;
  comissao_vendedor_valor?: number;
  recuado_at?: string;
  recuo_motivo?: string;
  created_at: string;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; ordem: number }> = {
  A_GERAR:              { label: 'A Gerar',               color: '#64748b', bg: 'rgba(100,116,139,0.10)', icon: FileCheck2,  ordem: 0 },
  GERADO:               { label: 'Gerado',                color: '#2563eb', bg: 'rgba(37,99,235,0.10)',   icon: FileCheck2,  ordem: 1 },
  ENVIADO_ASSINATURA:   { label: 'Enviado p/ Assinatura', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)',  icon: Send,        ordem: 2 },
  AGUARDANDO_ASSINATURA:{ label: 'Aguardando',            color: '#d97706', bg: 'rgba(217,119,6,0.10)',   icon: Pen,         ordem: 3 },
  ASSINADO:             { label: 'Assinado',              color: '#16a34a', bg: 'rgba(22,163,74,0.10)',   icon: CheckCircle, ordem: 4 },
  PENDENTE_CORRECAO:    { label: 'Pend. Correção',        color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   icon: RefreshCw,   ordem: 5 },
  CANCELADO:            { label: 'Cancelado',             color: '#9ca3af', bg: 'rgba(156,163,175,0.10)', icon: X,           ordem: 6 },
  RECUADO:              { label: 'Recuado',               color: '#b91c1c', bg: 'rgba(185,28,28,0.10)',   icon: RefreshCw,   ordem: 7 },
};

const KANBAN_ORDER = ['A_GERAR','GERADO','ENVIADO_ASSINATURA','AGUARDANDO_ASSINATURA','ASSINADO','PENDENTE_CORRECAO','CANCELADO','RECUADO'];

const fmtBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('pt-BR') : '—';

// Gera label "Jun 2026" a partir de um Date
const monthLabel = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContratosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [contratos, setContratos] = useState<ContratoComercial[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');

  // Filtros
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Filtro mensal — aplicado nos tabs Assinado / Cancelado
  const [mesRef, setMesRef] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const [dragging, setDragging]       = useState<ContratoComercial | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [selected, setSelected]       = useState<ContratoComercial | null>(null);
  const [preview, setPreview]         = useState<any>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [zapMsg, setZapMsg]           = useState('');
  const [editando, setEditando]       = useState(false);
  const [editForm, setEditForm]       = useState<any>({});
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [editDirty, setEditDirty]     = useState(false);
  const [signedUrl, setSignedUrl]     = useState('');
  const [marcando, setMarcando]       = useState(false);
  const [showGerarCliente, setShowGerarCliente] = useState(false);
  const [gcForm, setGcForm]           = useState<any>({ codigo: '', telefone: '', telefone2: '', email: '', grupo_tecnico: '', segmento: '', observacoes: '' });
  const [gerandoCli, setGerandoCli]   = useState(false);
  const [gruposTecnicos, setGruposTecnicos] = useState<string[]>([]);
  const [vendedores, setVendedores]   = useState<{ id: string; nome: string }[]>([]);

  // Confirmações inline (sem window.confirm/prompt)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRecuar, setConfirmRecuar] = useState(false);
  const [recuoMotivo, setRecuoMotivo]     = useState('');

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isAuthenticated]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getContratosComerciais();
      setContratos(res.data.data.contratos || []);
    } catch { } finally { setDataLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lista de vendedores únicos nos contratos (para o filtro)
  const vendedoresUnicos = useMemo(() => {
    const nomes = [...new Set(contratos.map(c => c.vendedor_nome).filter(Boolean))];
    return nomes.sort() as string[];
  }, [contratos]);

  // Filtragem principal
  const filtered = useMemo(() => {
    return contratos.filter(c => {
      if (search) {
        const s = search.toLowerCase();
        if (!c.razao_social.toLowerCase().includes(s) &&
            !c.numero_contrato.includes(s) &&
            !(c.vendedor_nome || '').toLowerCase().includes(s)) return false;
      }
      if (vendedorFilter && c.vendedor_nome !== vendedorFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    });
  }, [contratos, search, vendedorFilter, statusFilter]);

  // Para ASSINADO e CANCELADO/RECUADO, aplica filtro mensal na view "lista mensal"
  const filteredNoMes = useMemo(() => {
    return filtered.filter(c => {
      if (c.status !== 'ASSINADO' && c.status !== 'CANCELADO' && c.status !== 'RECUADO') return true;
      const ref = c.status === 'ASSINADO' ? c.signed_at : c.recuado_at || c.created_at;
      if (!ref) return false;
      const d = new Date(ref);
      return d.getFullYear() === mesRef.getFullYear() && d.getMonth() === mesRef.getMonth();
    });
  }, [filtered, mesRef]);

  // KPIs
  const kpis = useMemo(() => {
    const all = contratos;
    const thisMonth = all.filter(c => {
      const ref = c.status === 'ASSINADO' ? c.signed_at : null;
      if (!ref) return false;
      const d = new Date(ref);
      return d.getFullYear() === mesRef.getFullYear() && d.getMonth() === mesRef.getMonth();
    });
    return {
      total: all.length,
      assinados_mes: thisMonth.length,
      mrr_mes: thisMonth.reduce((s, c) => s + (c.mensalidade || 0), 0),
      setup_mes: thisMonth.reduce((s, c) => s + (c.valor_setup_total || 0), 0),
      cancelados_mes: filtered.filter(c => {
        if (c.status !== 'CANCELADO' && c.status !== 'RECUADO') return false;
        const d = new Date(c.recuado_at || c.created_at);
        return d.getFullYear() === mesRef.getFullYear() && d.getMonth() === mesRef.getMonth();
      }).length,
    };
  }, [contratos, filtered, mesRef]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const moveStatus = async (contrato: ContratoComercial, novoStatus: string) => {
    if (contrato.status === novoStatus) return;
    setContratos(prev => prev.map(c => c.id === contrato.id ? { ...c, status: novoStatus } : c));
    try { await apiClient.updateContratoComercial(contrato.id, { status: novoStatus }); }
    catch { load(); }
  };

  const openPreview = async (c: ContratoComercial) => {
    setSelected(c);
    setLoadingPrev(true);
    setPreview(null);
    setZapMsg('');
    setEditando(false);
    setSignedUrl(c.zapsign_signed_file_url || '');
    setConfirmDelete(false);
    setConfirmRecuar(false);
    setRecuoMotivo('');
    try {
      const res = await apiClient.getContratoPreview(c.id);
      setPreview(res.data.data);
    } catch { } finally { setLoadingPrev(false); }
  };

  const abrirRevisao = async (c: ContratoComercial) => {
    let dados: any = c;
    try { const res = await apiClient.getContratoDadosRevisao(c.id); dados = res.data?.data || c; }
    catch { }
    setEditForm({
      razao_social: dados.razao_social || '', nome_fantasia: dados.nome_fantasia || '',
      cnpj: dados.cnpj || '', endereco: dados.endereco || '', numero_endereco: dados.numero_endereco || '',
      bairro: dados.bairro || '', cidade: dados.cidade || '', estado: dados.estado || '', cep: dados.cep || '',
      representante_nome: dados.representante_nome || '', representante_cpf: dados.representante_cpf || '',
      representante_email: dados.representante_email || '', representante_telefone: dados.representante_telefone || '',
      representante_cargo: dados.representante_cargo || '', plano_contratado: dados.plano_contratado || '',
      mensalidade: dados.mensalidade != null ? String(dados.mensalidade) : '',
      dia_vencimento: dados.dia_vencimento != null ? String(dados.dia_vencimento) : '',
      valor_setup_total: dados.valor_setup_total != null ? String(dados.valor_setup_total) : '',
      setup_a_vista: !!dados.setup_a_vista,
      valor_setup_entrada: dados.valor_setup_entrada != null ? String(dados.valor_setup_entrada) : '',
      setup_parcelas: dados.setup_parcelas != null ? String(dados.setup_parcelas) : '',
      valor_setup_parcela: dados.valor_setup_parcela != null ? String(dados.valor_setup_parcela) : '',
      vendedor_id: dados.vendedor_id || '', vendedor_nome: dados.vendedor_nome || '',
    });
    setEditDirty(false);
    setEditando(true);
  };

  const fecharRevisao = () => { setEditando(false); setEditDirty(false); };

  const fecharModal = () => {
    setEditando(false); setEditDirty(false); setSelected(null);
    setConfirmDelete(false); setConfirmRecuar(false);
  };

  const salvarRevisao = async () => {
    if (!selected || !editForm.razao_social?.trim()) return;
    setSalvandoEdit(true);
    try {
      const payload: any = {
        ...editForm,
        mensalidade: editForm.mensalidade !== '' ? parseFloat(editForm.mensalidade) : undefined,
        dia_vencimento: editForm.dia_vencimento !== '' ? parseInt(editForm.dia_vencimento) : undefined,
        valor_setup_total: editForm.valor_setup_total !== '' ? parseFloat(editForm.valor_setup_total) : undefined,
        setup_a_vista: !!editForm.setup_a_vista,
        valor_setup_entrada: editForm.setup_a_vista ? undefined : (editForm.valor_setup_entrada !== '' ? parseFloat(editForm.valor_setup_entrada) : undefined),
        setup_parcelas: editForm.setup_a_vista ? undefined : (editForm.setup_parcelas !== '' ? parseInt(editForm.setup_parcelas) : undefined),
        valor_setup_parcela: editForm.setup_a_vista ? undefined : (editForm.valor_setup_parcela !== '' ? parseFloat(editForm.valor_setup_parcela) : undefined),
      };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = undefined; });
      const res = await apiClient.updateContratoComercial(selected.id, payload);
      setSelected(res.data?.data || { ...selected, ...payload });
      setEditando(false); setEditDirty(false); load();
    } catch (e: any) { console.error(e); }
    finally { setSalvandoEdit(false); }
  };

  const handleMarcarAssinado = async () => {
    if (!selected) return;
    setMarcando(true); setZapMsg('');
    try {
      await apiClient.updateContratoComercial(selected.id, {
        status: 'ASSINADO', zapsign_status: 'signed',
        zapsign_signed_file_url: signedUrl || undefined,
        signed_at: new Date().toISOString(),
      });
      setZapMsg('Contrato marcado como assinado!');
      setSelected({ ...selected, status: 'ASSINADO', zapsign_signed_file_url: signedUrl, signed_at: new Date().toISOString() });
      load();
    } catch (e: any) { setZapMsg(e?.response?.data?.message || 'Erro ao marcar como assinado'); }
    finally { setMarcando(false); }
  };

  const handleRecuar = async () => {
    if (!selected) return;
    setMarcando(true); setZapMsg('');
    try {
      await apiClient.recuarContrato(selected.id, recuoMotivo || undefined);
      setZapMsg('Contrato recuado. Venda removida da meta e comissão estornada.');
      setSelected({ ...selected, status: 'RECUADO', recuo_motivo: recuoMotivo });
      setConfirmRecuar(false); load();
    } catch (e: any) { setZapMsg(e?.response?.data?.message || 'Erro ao recuar'); }
    finally { setMarcando(false); }
  };

  const handleMarcarEnviado = async () => {
    if (!selected) return;
    setMarcando(true); setZapMsg('');
    try {
      await apiClient.updateContratoComercial(selected.id, { status: 'ENVIADO_ASSINATURA' });
      setZapMsg('Marcado como enviado para assinatura.');
      setSelected({ ...selected, status: 'ENVIADO_ASSINATURA' });
      load();
    } catch (e: any) { setZapMsg(e?.response?.data?.message || 'Erro'); }
    finally { setMarcando(false); }
  };

  const handleCopiarResumo = async () => {
    if (!selected) return; setZapMsg('');
    try {
      const r = await apiClient.getResumoAssinatura(selected.id);
      await navigator.clipboard.writeText(r.data?.data?.texto || '');
      setZapMsg('Resumo copiado! É só colar no e-mail.');
    } catch (e: any) { setZapMsg(e?.response?.data?.message || 'Erro ao gerar resumo'); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await apiClient.deleteContratoComercial(selected.id);
    setSelected(null); load();
  };

  const abrirGerarCliente = () => {
    if (!selected) return;
    setGcForm({ codigo: '', telefone: (selected as any).representante_telefone || '', telefone2: '', email: (selected as any).representante_email || '', grupo_tecnico: '', segmento: '', observacoes: '' });
    setShowGerarCliente(true);
    if (gruposTecnicos.length === 0) apiClient.getGruposTecnicos().then(r => setGruposTecnicos(r.data?.data || [])).catch(() => {});
  };

  const handleGerarCliente = async () => {
    if (!selected) return;
    setGerandoCli(true);
    try {
      const grupoFinal = gcForm.grupo_tecnico === '__novo__' ? (gcForm.grupo_tecnico_novo || '').trim() : gcForm.grupo_tecnico;
      const { grupo_tecnico_novo, ...rest } = gcForm;
      await apiClient.gerarClienteDoContrato(selected.id, { ...rest, grupo_tecnico: grupoFinal });
      setShowGerarCliente(false); load();
    } catch (e: any) { console.error(e); }
    finally { setGerandoCli(false); }
  };

  const navMes = (delta: number) => {
    setMesRef(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + delta); return d; });
  };

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 py-4 space-y-4" style={{ background: 'var(--t-content-bg)', minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>Contratos Comerciais</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Kanban · Lista · Filtro mensal · {contratos.length} contratos
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton
              nome="contratos" titulo="Contratos Comerciais"
              linhas={filtered}
              colunas={[
                { header: 'Nº', value: (c: ContratoComercial) => c.numero_contrato },
                { header: 'Cliente', value: (c: ContratoComercial) => c.razao_social },
                { header: 'Plano', value: (c: ContratoComercial) => c.plano_contratado || '' },
                { header: 'Mensalidade (R$)', value: (c: ContratoComercial) => c.mensalidade ?? '' },
                { header: 'Setup (R$)', value: (c: ContratoComercial) => c.valor_setup_total ?? '' },
                { header: 'Vendedor', value: (c: ContratoComercial) => c.vendedor_nome || '' },
                { header: 'Status', value: (c: ContratoComercial) => c.status },
                { header: 'Assinado em', value: (c: ContratoComercial) => c.signed_at ? fmtDate(c.signed_at) : '' },
              ]}
            />
            <button onClick={() => router.push('/propostas-comerciais')}
              className="ps-btn-primary h-8 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold text-white">
              <Plus size={13} /> Nova Proposta
            </button>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total contratos', value: kpis.total, color: 'var(--t-primary)', icon: FileCheck2 },
            { label: `Assinados ${monthLabel(mesRef)}`, value: kpis.assinados_mes, color: '#16a34a', icon: CheckCircle },
            { label: `MRR ${monthLabel(mesRef)}`, value: fmtBRL(kpis.mrr_mes), color: '#16a34a', icon: DollarSign },
            { label: `Setup ${monthLabel(mesRef)}`, value: fmtBRL(kpis.setup_mes), color: '#0891b2', icon: TrendingUp },
            { label: `Cancelados ${monthLabel(mesRef)}`, value: kpis.cancelados_mes, color: '#dc2626', icon: X },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="ps-card rounded-xl p-4 flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${k.color} 0%, transparent 70%)` }} />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}14` }}>
                  <Icon size={16} style={{ color: k.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--t-text-muted)' }}>{k.label}</p>
                  <p className="text-[18px] font-bold leading-none tracking-tight" style={{ color: k.color }}>{k.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Toolbar ── */}
        <div className="ps-card rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Busca */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa, nº ou vendedor…"
                className="pl-8 pr-3 h-8 text-xs rounded-lg outline-none"
                style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', width: 220 }} />
            </div>

            {/* Filtro vendedor */}
            <select value={vendedorFilter} onChange={e => setVendedorFilter(e.target.value)}
              className="h-8 px-3 text-xs rounded-lg outline-none"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              <option value="">Todos vendedores</option>
              {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            {/* Filtro status */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 px-3 text-xs rounded-lg outline-none"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              <option value="">Todos status</option>
              {KANBAN_ORDER.map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>)}
            </select>

            {/* Navegação mensal */}
            <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
              <button onClick={() => navMes(-1)} className="h-8 w-7 flex items-center justify-center hover:bg-opacity-80 transition-colors"
                style={{ background: 'var(--t-card-bg)' }}>
                <ChevronLeft size={12} style={{ color: 'var(--t-text-muted)' }} />
              </button>
              <span className="text-xs font-semibold px-2" style={{ color: 'var(--t-text-primary)' }}>
                {monthLabel(mesRef)}
              </span>
              <button onClick={() => navMes(1)} className="h-8 w-7 flex items-center justify-center transition-colors"
                style={{ background: 'var(--t-card-bg)' }}>
                <ChevronRight size={12} style={{ color: 'var(--t-text-muted)' }} />
              </button>
            </div>

            {/* Refresh */}
            <button onClick={load} className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
              <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} style={{ color: 'var(--t-primary)' }} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--t-content-bg)' }}>
            {([
              { key: 'kanban', label: 'Kanban', icon: LayoutGrid },
              { key: 'lista',  label: 'Lista',  icon: ListChecks },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: view === v.key ? 'var(--t-card-bg)' : 'transparent',
                  color: view === v.key ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                  boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
                }}>
                <v.icon size={12} /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KANBAN VIEW ── */}
        {view === 'kanban' && (
          <div className="ps-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto" style={{ minHeight: 500 }}>
              <div className="flex gap-2.5 p-3" style={{ minWidth: `${KANBAN_ORDER.length * 220}px` }}>
                {KANBAN_ORDER.map(statusKey => {
                  const cfg = STATUS_CONFIG[statusKey];
                  const StatusIcon = cfg.icon;
                  const colCards = filtered.filter(c => c.status === statusKey);
                  const isOver = dragOverCol === statusKey;
                  return (
                    <div key={statusKey}
                      onDragOver={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                      onDragEnter={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                      onDrop={e => {
                        e.preventDefault(); setDragOverCol(null);
                        if (dragging && dragging.status !== statusKey) moveStatus(dragging, statusKey);
                        setDragging(null);
                      }}
                      className="flex flex-col rounded-xl flex-shrink-0 transition-all duration-150"
                      style={{
                        width: 210,
                        background: 'var(--t-card-bg)',
                        border: isOver ? `2px solid ${cfg.color}` : '1px solid var(--t-card-border)',
                        boxShadow: isOver ? `0 0 0 3px ${cfg.color}18` : 'none',
                      }}
                    >
                      {/* Col header */}
                      <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0"
                        style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[11px] font-bold" style={{ color: 'var(--t-text-primary)' }}>{cfg.label}</span>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-px rounded-full"
                          style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>
                          {colCards.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {colCards.length === 0 && (
                          <p className="text-center text-[10px] py-6 opacity-40" style={{ color: 'var(--t-text-muted)' }}>Vazio</p>
                        )}
                        {colCards.map(c => (
                          <ContratoCard key={c.id}
                            contrato={c}
                            cfg={cfg}
                            dragging={dragging?.id === c.id}
                            onDragStart={() => setDragging(c)}
                            onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
                            onClick={() => openPreview(c)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── LISTA VIEW ── */}
        {view === 'lista' && (
          <div className="ps-card rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>
                {filtered.length} contrato{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            {filtered.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Nenhum contrato encontrado</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--t-card-border)' }}>
                {[...filtered]
                  .sort((a, b) => STATUS_CONFIG[a.status].ordem - STATUS_CONFIG[b.status].ordem)
                  .map(c => {
                    const cfg = STATUS_CONFIG[c.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={c.id} onClick={() => openPreview(c)}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors border-l-4 hover:brightness-95"
                        style={{ borderLeftColor: cfg.color, background: 'var(--t-card-bg)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                          <StatusIcon size={14} style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold" style={{ color: cfg.color }}>#{c.numero_contrato}</span>
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>{c.razao_social}</p>
                            {c.tipo_servico === 'TROCA_CNPJ' && (
                              <span className="text-[9px] font-bold px-1.5 py-px rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>
                                Troca CNPJ
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {c.plano_contratado && <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{c.plano_contratado}</span>}
                            {c.cidade && <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{c.cidade}/{c.estado}</span>}
                            {c.vendedor_nome && (
                              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                                <User size={9} /> {c.vendedor_nome}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {c.mensalidade != null && (
                            <p className="text-sm font-bold" style={{ color: 'var(--t-primary)' }}>{fmtBRL(c.mensalidade)}/mês</p>
                          )}
                          <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{fmtDate(c.data_contrato)}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modal detalhe ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,34,56,.55)' }}
          onClick={() => fecharModal()}>
          <div className="rounded-2xl shadow-2xl w-full overflow-y-auto"
            style={{ maxWidth: 720, maxHeight: '90vh', background: 'var(--t-card-bg)' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold px-2 py-px rounded-full"
                    style={{ background: STATUS_CONFIG[selected.status].bg, color: STATUS_CONFIG[selected.status].color }}>
                    {STATUS_CONFIG[selected.status].label}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--t-text-muted)' }}>#{selected.numero_contrato}</span>
                </div>
                <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>{selected.razao_social}</h2>
                {selected.nome_fantasia && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{selected.nome_fantasia}</p>}
              </div>
              <div className="flex items-center gap-2">
                {selected.status !== 'ASSINADO' && selected.status !== 'RECUADO' && selected.status !== 'CANCELADO' && (
                  <button onClick={() => editando ? fecharRevisao() : abrirRevisao(selected)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors"
                    style={{ border: '1px solid var(--t-card-border)', color: editando ? 'var(--t-text-muted)' : 'var(--t-primary)', background: 'var(--t-card-bg)' }}>
                    <Edit3 size={12} /> {editando ? 'Cancelar' : 'Revisar dados'}
                  </button>
                )}
                <button onClick={fecharModal} className="h-8 w-8 flex items-center justify-center rounded-lg"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'var(--t-card-bg)' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">

              {/* Form revisão */}
              {editando && (
                <div className="rounded-xl p-4 space-y-4" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>Empresa (contratante)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Razão social *" full value={editForm.razao_social} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, razao_social: v })); setEditDirty(true); }} />
                      <CampoEdit label="Nome fantasia" value={editForm.nome_fantasia} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, nome_fantasia: v })); setEditDirty(true); }} />
                      <CampoEdit label="CNPJ" value={editForm.cnpj} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, cnpj: v })); setEditDirty(true); }} />
                      <CampoEdit label="Endereço" value={editForm.endereco} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, endereco: v })); setEditDirty(true); }} />
                      <CampoEdit label="Nº" value={editForm.numero_endereco} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, numero_endereco: v })); setEditDirty(true); }} />
                      <CampoEdit label="Bairro" value={editForm.bairro} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, bairro: v })); setEditDirty(true); }} />
                      <CampoEdit label="Cidade" value={editForm.cidade} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, cidade: v })); setEditDirty(true); }} />
                      <CampoEdit label="UF" value={editForm.estado} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, estado: v })); setEditDirty(true); }} />
                      <CampoEdit label="CEP" value={editForm.cep} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, cep: v })); setEditDirty(true); }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--t-text-muted)' }}>Representante legal</p>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Nome *" full value={editForm.representante_nome} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, representante_nome: v })); setEditDirty(true); }} />
                      <CampoEdit label="CPF" value={editForm.representante_cpf} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, representante_cpf: v })); setEditDirty(true); }} />
                      <CampoEdit label="Cargo" value={editForm.representante_cargo} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, representante_cargo: v })); setEditDirty(true); }} />
                      <CampoEdit label="E-mail" value={editForm.representante_email} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, representante_email: v })); setEditDirty(true); }} />
                      <CampoEdit label="Telefone" value={editForm.representante_telefone} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, representante_telefone: v })); setEditDirty(true); }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--t-text-muted)' }}>Vendedor responsável</p>
                    <select value={editForm.vendedor_id || ''}
                      onChange={e => { const v = e.target.value; const nome = vendedores.find(x => x.id === v)?.nome || ''; setEditForm((p: any) => ({ ...p, vendedor_id: v, vendedor_nome: nome })); setEditDirty(true); }}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                      <option value="">{editForm.vendedor_nome ? `Atual: ${editForm.vendedor_nome}` : 'Selecione o vendedor...'}</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--t-text-muted)' }}>Plano e valores</p>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Plano" value={editForm.plano_contratado} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, plano_contratado: v })); setEditDirty(true); }} />
                      <CampoEdit label="Mensalidade (R$)" type="number" value={editForm.mensalidade} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, mensalidade: v })); setEditDirty(true); }} />
                      <CampoEdit label="Dia vencimento" type="number" value={editForm.dia_vencimento} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, dia_vencimento: v })); setEditDirty(true); }} />
                      <CampoEdit label="Setup (R$)" type="number" value={editForm.valor_setup_total} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, valor_setup_total: v })); setEditDirty(true); }} />
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Forma de pagamento (setup)</label>
                        <select value={editForm.setup_a_vista ? 'AVISTA' : 'PARCELADO'}
                          onChange={e => { setEditForm((p: any) => ({ ...p, setup_a_vista: e.target.value === 'AVISTA' })); setEditDirty(true); }}
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                          <option value="AVISTA">À vista</option>
                          <option value="PARCELADO">Parcelado</option>
                        </select>
                      </div>
                    </div>
                    {!editForm.setup_a_vista && (
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <CampoEdit label="Entrada (R$)" type="number" value={editForm.valor_setup_entrada} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, valor_setup_entrada: v })); setEditDirty(true); }} />
                        <CampoEdit label="Nº parcelas" type="number" value={editForm.setup_parcelas} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, setup_parcelas: v })); setEditDirty(true); }} />
                        <CampoEdit label="Valor da parcela (R$)" type="number" value={editForm.valor_setup_parcela} onChange={(v: string) => { setEditForm((p: any) => ({ ...p, valor_setup_parcela: v })); setEditDirty(true); }} />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={fecharRevisao} className="h-8 px-4 rounded-lg text-xs font-semibold"
                      style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent' }}>
                      Cancelar
                    </button>
                    <button onClick={salvarRevisao} disabled={salvandoEdit}
                      className="h-8 px-4 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                      style={{ background: 'var(--t-primary)' }}>
                      {salvandoEdit ? 'Salvando…' : 'Salvar dados'}
                    </button>
                  </div>
                </div>
              )}

              {/* Info grid */}
              {!editando && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['CNPJ', selected.cnpj],
                    ['Plano', selected.plano_contratado],
                    ['Mensalidade', selected.mensalidade ? fmtBRL(selected.mensalidade) : null],
                    ['Dia Vencimento', selected.dia_vencimento ? `Dia ${selected.dia_vencimento}` : null],
                    ['Setup Total', selected.valor_setup_total ? fmtBRL(selected.valor_setup_total) : null],
                    ['Parcelas Setup', selected.setup_a_vista ? 'À vista' : selected.setup_parcelas ? `${selected.setup_parcelas}x de ${fmtBRL(selected.valor_setup_parcela)}` : null],
                    ['Representante', selected.representante_nome],
                    ['CPF', selected.representante_cpf],
                    ['E-mail', selected.representante_email],
                    ['Telefone', selected.representante_telefone],
                    ['Vendedor', selected.vendedor_nome],
                    ['Supervisor', selected.supervisor_nome],
                    ['Comissão (15% setup)', selected.status === 'ASSINADO' && selected.comissao_vendedor_valor != null
                      ? `${fmtBRL(selected.comissao_vendedor_valor)} (${selected.comissao_vendedor_pct ?? 15}%)`
                      : (selected.valor_setup_total ? `${fmtBRL((selected.valor_setup_total || 0) * 0.15)} (previsto)` : null)],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string}>
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--t-text-muted)' }}>{l}</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--t-text-primary)' }}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Mover status */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--t-text-muted)' }}>Mover status</p>
                <div className="flex flex-wrap gap-1.5">
                  {KANBAN_ORDER.map(k => {
                    const cfg = STATUS_CONFIG[k];
                    const ativo = selected.status === k;
                    return (
                      <button key={k}
                        onClick={() => { moveStatus(selected, k); setSelected({ ...selected, status: k }); }}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={{
                          border: `1.5px solid ${ativo ? cfg.color : 'var(--t-card-border)'}`,
                          background: ativo ? cfg.bg : 'transparent',
                          color: ativo ? cfg.color : 'var(--t-text-muted)',
                        }}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assinatura */}
              <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--t-text-primary)' }}>Contrato & Assinatura</p>
                <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                  Modelo: <strong>{selected.plano_contratado || '—'}</strong> · Baixe o PDF, suba no painel da ZapSign e cole o link assinado abaixo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => window.open(apiClient.contratoPdfUrl(selected.id), '_blank')}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'var(--t-primary)' }}>
                    <Eye size={12} /> Baixar PDF
                  </button>
                  <a href="https://app.zapsign.com.br/conta/documentos" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid #c4b5fd', color: '#7c3aed', background: 'var(--t-card-bg)', textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Painel ZapSign
                  </a>
                  <button onClick={handleCopiarResumo}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)', background: 'var(--t-primary-light)' }}>
                    Resumo p/ e-mail
                  </button>
                  {selected.status !== 'ENVIADO_ASSINATURA' && selected.status !== 'ASSINADO' && selected.status !== 'CANCELADO' && (
                    <button onClick={handleMarcarEnviado} disabled={marcando}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent' }}>
                      <Send size={11} /> Marcar enviado
                    </button>
                  )}
                </div>

                {/* Link assinado */}
                {selected.status !== 'CANCELADO' && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                    <label className="text-[11px] font-semibold block mb-1.5" style={{ color: 'var(--t-text-muted)' }}>
                      Link do contrato assinado (ZapSign)
                    </label>
                    <div className="flex gap-2">
                      <input value={signedUrl} onChange={e => setSignedUrl(e.target.value)}
                        placeholder="https://app.zapsign.com.br/verificar/..."
                        className="flex-1 px-3 py-2 text-xs rounded-lg outline-none"
                        style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                      <button onClick={handleMarcarAssinado} disabled={marcando}
                        className="h-8 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-60 flex items-center gap-1.5"
                        style={{ background: '#16a34a' }}>
                        <CheckCircle size={11} /> {marcando ? '...' : 'Marcar assinado'}
                      </button>
                    </div>
                  </div>
                )}

                {selected.zapsign_signed_file_url && (
                  <a href={selected.zapsign_signed_file_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold" style={{ color: '#16a34a' }}>
                    Abrir contrato assinado ↗
                  </a>
                )}
                {selected.signed_at && selected.status === 'ASSINADO' && (
                  <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>
                    Assinado em: {fmtDate(selected.signed_at)}
                    {selected.comissao_vendedor_valor != null && <> · Comissão: {fmtBRL(selected.comissao_vendedor_valor)}</>}
                  </p>
                )}

                {/* Gerar cliente */}
                {selected.status === 'ASSINADO' && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                    {(selected as any).cliente_id ? (
                      <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>Cadastro de cliente já gerado no CRM.</p>
                    ) : !showGerarCliente ? (
                      <button onClick={abrirGerarCliente}
                        className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'var(--t-primary)' }}>
                        Gerar cadastro do cliente no CRM
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-bold" style={{ color: 'var(--t-text-primary)' }}>Gerar cadastro de {selected.razao_social}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Código *</label>
                            <input value={gcForm.codigo} onChange={e => setGcForm((f: any) => ({ ...f, codigo: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} /></div>
                          <div><label className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Grupo técnico</label>
                            {gcForm.grupo_tecnico === '__novo__' ? (
                              <input autoFocus value={gcForm.grupo_tecnico_novo || ''} onChange={e => setGcForm((f: any) => ({ ...f, grupo_tecnico_novo: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                                style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                            ) : (
                              <select value={gcForm.grupo_tecnico} onChange={e => setGcForm((f: any) => ({ ...f, grupo_tecnico: e.target.value }))}
                                className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                                style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                                <option value="">— selecione —</option>
                                {gruposTecnicos.map(g => <option key={g} value={g}>{g}</option>)}
                                <option value="__novo__">+ Novo grupo…</option>
                              </select>
                            )}</div>
                          <div><label className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Telefone</label>
                            <input value={gcForm.telefone} onChange={e => setGcForm((f: any) => ({ ...f, telefone: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} /></div>
                          <div><label className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Telefone 2</label>
                            <input value={gcForm.telefone2} onChange={e => setGcForm((f: any) => ({ ...f, telefone2: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} /></div>
                          <div className="col-span-2"><label className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Segmento</label>
                            <input value={gcForm.segmento} onChange={e => setGcForm((f: any) => ({ ...f, segmento: e.target.value }))} placeholder="Farmácia, Padaria…"
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} /></div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setShowGerarCliente(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--t-text-muted)', background: 'transparent', border: 'none' }}>Cancelar</button>
                          <button onClick={handleGerarCliente} disabled={gerandoCli || !gcForm.codigo.trim()}
                            className="text-xs px-4 py-1.5 rounded-lg font-bold text-white disabled:opacity-50"
                            style={{ background: '#16a34a' }}>
                            {gerandoCli ? 'Gerando…' : 'Gerar cadastro'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recuo */}
                {selected.status === 'ASSINADO' && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                    {!confirmRecuar ? (
                      <button onClick={() => setConfirmRecuar(true)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
                        style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                        <RefreshCw size={11} /> Recuo / Distrato
                      </button>
                    ) : (
                      <div className="space-y-2 p-3 rounded-xl" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
                        <p className="text-xs font-bold" style={{ color: '#b91c1c' }}>Confirmar recuo do contrato #{selected.numero_contrato}?</p>
                        <p className="text-[11px]" style={{ color: '#b91c1c' }}>Remove da meta e estorna comissão do vendedor.</p>
                        <input value={recuoMotivo} onChange={e => setRecuoMotivo(e.target.value)} placeholder="Motivo (opcional)"
                          className="w-full px-3 py-1.5 text-xs rounded-lg outline-none"
                          style={{ border: '1px solid #fca5a5', background: '#fff', color: 'var(--t-text-primary)' }} />
                        <div className="flex gap-2">
                          <button onClick={handleRecuar} disabled={marcando}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                            style={{ background: '#b91c1c' }}>
                            {marcando ? '...' : 'Confirmar recuo'}
                          </button>
                          <button onClick={() => setConfirmRecuar(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#b91c1c' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selected.status === 'RECUADO' && (
                  <p className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
                    Recuado{selected.recuado_at ? ` em ${fmtDate(selected.recuado_at)}` : ''}
                    {selected.recuo_motivo ? ` · ${selected.recuo_motivo}` : ''}
                  </p>
                )}

                {zapMsg && (
                  <p className="text-xs font-semibold pt-1" style={{ color: zapMsg.startsWith('Erro') || zapMsg.startsWith('❌') ? '#dc2626' : '#16a34a' }}>{zapMsg}</p>
                )}
              </div>

              {/* Preview cláusulas */}
              {loadingPrev && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Gerando preview…</p>}
              {preview && (
                <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', fontFamily: 'Georgia, serif' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--t-text-muted)' }}>Preview das cláusulas</p>
                  {preview.identificacao && <p className="mb-2">{preview.identificacao}</p>}
                  {preview.clausula31 && <p className="mb-2">{preview.clausula31}</p>}
                  {preview.clausula33 && <p className="mb-2">{preview.clausula33}</p>}
                  {preview.dataLocal && <p className="mt-3">{preview.dataLocal}</p>}
                  {preview.assinatura && <p className="mt-2 font-bold whitespace-pre-line">{preview.assinatura}</p>}
                </div>
              )}

            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-2 px-6 py-3 flex-wrap" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              {selected.representante_telefone && (
                <a href={`/whatsapp?numero=${selected.representante_telefone.replace(/\D/g, '')}&nome=${encodeURIComponent(selected.razao_social || '')}`}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#25D366', textDecoration: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </a>
              )}
              <div className="ml-auto">
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626' }}>
                    <Trash2 size={11} /> Excluir
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Confirmar exclusão?</span>
                    <button onClick={handleDelete} className="h-8 px-3 rounded-lg text-xs font-bold text-white" style={{ background: '#dc2626' }}>Sim, excluir</button>
                    <button onClick={() => setConfirmDelete(false)} className="h-8 px-3 rounded-lg text-xs" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent' }}>Cancelar</button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ContratoCard({ contrato: c, cfg, dragging, onDragStart, onDragEnd, onClick }: {
  contrato: ContratoComercial;
  cfg: { label: string; color: string; bg: string; icon: any; ordem: number };
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="group rounded-xl cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md"
      style={{
        background: 'var(--t-card-bg)',
        border: '1px solid var(--t-card-border)',
        borderLeft: `3px solid ${cfg.color}`,
        opacity: dragging ? 0.35 : 1,
        padding: '10px 11px',
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1">
          <Hash size={9} style={{ color: cfg.color, flexShrink: 0 }} />
          <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{c.numero_contrato}</span>
        </div>
        {c.tipo_servico === 'TROCA_CNPJ' && (
          <span className="text-[8px] font-bold px-1.5 py-px rounded-full flex-shrink-0" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            Troca CNPJ
          </span>
        )}
      </div>

      <p className="text-[12px] font-semibold leading-snug mb-1" style={{ color: 'var(--t-text-primary)' }}>{c.razao_social}</p>
      {c.nome_fantasia && <p className="text-[10px] mb-1.5" style={{ color: 'var(--t-text-muted)' }}>{c.nome_fantasia}</p>}

      <div className="flex flex-wrap gap-1 mb-1.5">
        {c.plano_contratado && (
          <span className="text-[9px] font-semibold px-1.5 py-px rounded" style={{ background: `${cfg.color}14`, color: cfg.color }}>
            {c.plano_contratado}
          </span>
        )}
        {c.cidade && (
          <span className="text-[9px] px-1.5 py-px rounded" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary-dark)' }}>
            {c.cidade}/{c.estado}
          </span>
        )}
      </div>

      {c.mensalidade != null && (
        <p className="text-[12px] font-bold mb-0.5" style={{ color: 'var(--t-primary)' }}>
          {c.mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
        </p>
      )}
      {c.valor_setup_total != null && (
        <p className="text-[10px] mb-1" style={{ color: 'var(--t-text-muted)' }}>
          Setup: {c.valor_setup_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      )}

      <div className="flex items-center justify-between pt-1.5 mt-1" style={{ borderTop: '1px solid var(--t-card-border)' }}>
        <div className="flex items-center gap-1 min-w-0">
          {c.vendedor_nome && (
            <span className="text-[9px] truncate flex items-center gap-0.5" style={{ color: 'var(--t-text-muted)' }}>
              <User size={8} /> {c.vendedor_nome.split(' ')[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {c.zapsign_status && (
            <span className="text-[9px] font-semibold px-1 py-px rounded" style={{ background: c.zapsign_status === 'signed' ? '#dcfce7' : '#fef3c7', color: c.zapsign_status === 'signed' ? '#16a34a' : '#d97706' }}>
              {c.zapsign_status === 'signed' ? 'Signed' : 'ZapSign'}
            </span>
          )}
          <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>
            {new Date(c.data_contrato).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>
    </div>
  );
}

function CampoEdit({ label, value, onChange, type = 'text', full = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean;
}) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}
