'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  Plus, Search, RefreshCw, X, Loader2, CalendarDays, ListChecks, LayoutGrid,
  AlertOctagon, Clock, CheckCircle2, Calendar as CalendarIcon, Users as UsersIcon,
  Trash2, Check, Sparkles, AlertTriangle, UserCheck,
  Phone, Mail, MessageSquare, Car, FileText, Pin, Video, User,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Lead { id: string; nome: string; empresa?: string; razao_social?: string; nome_fantasia?: string; }
interface Usuario { id: string; nome: string; email: string; role: string; }
interface Atividade {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  status: string;
  resultado?: string;
  data_prevista?: string;
  data_realizada?: string;
  responsavel_id?: string;
  created_by?: string;
  created_at: string;
  google_meet_link?: string;
  duracao_minutos?: number;
  lead?: { id: string; nome: string; empresa?: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TIPO_ICON: Record<string, React.ComponentType<any>> = {
  LIGACAO:  Phone,
  EMAIL:    Mail,
  REUNIAO:  UsersIcon,
  WHATSAPP: MessageSquare,
  VISITA:   Car,
  TAREFA:   CheckCircle2,
  OUTRO:    Pin,
};

const TIPOS_OPTIONS = [
  { value: 'TAREFA',   label: 'Tarefa' },
  { value: 'LIGACAO',  label: 'Ligação' },
  { value: 'EMAIL',    label: 'E-mail' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'REUNIAO',  label: 'Reunião' },
  { value: 'VISITA',   label: 'Visita' },
  { value: 'OUTRO',    label: 'Outro' },
];

const STATUS_OPTIONS = ['PENDENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REMARCADA'];

// Régua de prioridade dinâmica (calculada a partir de data_prevista vs hoje)
type Prioridade = 'CRITICA' | 'EXPIRANDO' | 'PROXIMA' | 'NO_PRAZO' | 'SEM_PRAZO' | 'CONCLUIDA';

const PRIORIDADE_CONFIG: Record<Prioridade, {
  label: string; etiqueta: string; cor: string; bg: string; icon: any; ordem: number;
}> = {
  CRITICA:   { label: 'Crítico',         etiqueta: 'Atrasada',           cor: '#dc2626', bg: 'rgba(220,38,38,0.10)',   icon: AlertOctagon, ordem: 0 },
  EXPIRANDO: { label: 'Prazo expirando', etiqueta: 'Prioridade máxima',  cor: '#ea580c', bg: 'rgba(234,88,12,0.10)',   icon: AlertTriangle, ordem: 1 },
  PROXIMA:   { label: 'Próxima',         etiqueta: 'Próxima',            cor: '#d97706', bg: 'rgba(217,119,6,0.10)',   icon: Clock,         ordem: 2 },
  NO_PRAZO:  { label: 'No prazo',        etiqueta: 'Dentro do prazo',    cor: '#16a34a', bg: 'rgba(22,163,74,0.10)',   icon: CheckCircle2,  ordem: 3 },
  SEM_PRAZO: { label: 'Sem prazo',       etiqueta: 'Sem prazo definido', cor: 'var(--t-text-muted)', bg: 'var(--t-content-bg)', icon: CalendarIcon, ordem: 4 },
  CONCLUIDA: { label: 'Concluída',       etiqueta: 'Concluída',          cor: '#0891b2', bg: 'rgba(8,145,178,0.10)',   icon: CheckCircle2,  ordem: 5 },
};

const KANBAN_COLUMNS: Prioridade[] = ['CRITICA', 'EXPIRANDO', 'PROXIMA', 'NO_PRAZO', 'SEM_PRAZO'];

// Visual por STATUS da atividade (sobrepõe a régua de prazo p/ desfechos):
// Realizada = VERDE + ✓ · Remarcada = LARANJA + 🕐 · Cancelada/Não compareceu = vermelho.
// Retorna null quando o status não tem visual próprio (usa a prioridade de prazo).
function statusVisual(at: Atividade): { cor: string; bg: string; icon: any; etiqueta: string } | null {
  switch (at.status) {
    case 'REALIZADA':              return { cor: '#16a34a', bg: 'rgba(22,163,74,0.10)',  icon: CheckCircle2, etiqueta: 'Concluída' };
    case 'REMARCADA':              return { cor: '#ea580c', bg: 'rgba(234,88,12,0.10)',  icon: Clock,        etiqueta: 'Remarcada' };
    case 'CANCELADA':              return { cor: '#dc2626', bg: 'rgba(220,38,38,0.10)',  icon: AlertOctagon, etiqueta: 'Cancelada' };
    case 'CLIENTE_NAO_COMPARECEU': return { cor: '#dc2626', bg: 'rgba(220,38,38,0.10)',  icon: AlertOctagon, etiqueta: 'Não compareceu' };
    default: return null;
  }
}

// Calcula prioridade automática
function calcularPrioridade(at: Atividade): Prioridade {
  if (at.status === 'REALIZADA' || at.status === 'CANCELADA') return 'CONCLUIDA';
  if (!at.data_prevista) return 'SEM_PRAZO';
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  const prazo = new Date(at.data_prevista);
  const dias = Math.floor((prazo.getTime() - agora.getTime()) / 86400000);
  if (dias < 0) return 'CRITICA';
  if (dias <= 3) return 'EXPIRANDO';
  if (dias <= 7) return 'PROXIMA';
  return 'NO_PRAZO';
}

function diasRestantes(at: Atividade): number | null {
  if (!at.data_prevista) return null;
  const agora = new Date(); agora.setHours(0, 0, 0, 0);
  const prazo = new Date(at.data_prevista);
  return Math.floor((prazo.getTime() - agora.getTime()) / 86400000);
}

const fmtDateTime = (s?: string) => s
  ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const fmtDate = (s?: string) => s
  ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—';

// Empty form
const emptyForm = {
  lead_id: '',
  tipo: 'TAREFA',
  titulo: '',
  descricao: '',
  responsavel_id: '',
  prazo_modo: 'dias' as 'dias' | 'data',
  dias_max: '7',
  data_prevista: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function AtividadesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [usuarios, setUsuarios]     = useState<Usuario[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // View toggle (Calendário foi removido — Google Calendar fica em /agenda)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');

  // Filters
  const [search, setSearch]         = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [escopo, setEscopo]         = useState<'minhas' | 'todas'>('minhas');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<any>(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // Detail panel
  const [selected, setSelected] = useState<Atividade | null>(null);

  // Confirmação inline de delete (substitui window.confirm)
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  // Estado de concluir com resultado inline (substitui window.prompt)
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [resultadoInput, setResultadoInput] = useState('Concluída');

  // Permissions
  const isGestor   = user?.role === 'CEO' || user?.role?.includes('SUPERVISAO') || user?.role === 'ADMIN' || user?.role === 'GESTOR';
  const meuId      = user?.id || '';

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  // Default escopo by role
  useEffect(() => {
    if (isGestor) setEscopo('todas');
  }, [isGestor]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: any = { limit: 500 };
      if (tipoFilter)   params.tipo = tipoFilter;
      if (statusFilter) params.status = statusFilter;
      if (escopo === 'minhas' && meuId) params.responsavel_id = meuId;

      const [atRes, leadsRes, usersRes] = await Promise.all([
        apiClient.getAtividades(params),
        apiClient.getLeads({ limit: 200 }).catch(() => ({ data: { data: { leads: [] } } })),
        apiClient.getUsuarios().catch(() => ({ data: { data: [] } })),
      ]);
      setAtividades(atRes.data.data.atividades || []);
      const leadsRaw = leadsRes.data.data.leads || [];
      setLeads(leadsRaw.map((l: any) => ({
        id: l.id,
        nome: l.razao_social || l.nome_fantasia || l.nome,
        empresa: l.empresa || l.nome_fantasia,
      })));
      const usersData = usersRes.data.data;
      setUsuarios(Array.isArray(usersData) ? usersData : (usersData?.usuarios || []));
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, [tipoFilter, statusFilter, escopo, meuId]);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  // ─── Filtered + grouped data ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return atividades.filter(at => {
      if (!search) return true;
      const txt = `${at.titulo} ${at.descricao || ''} ${at.lead?.nome || ''} ${at.lead?.empresa || ''}`.toLowerCase();
      return txt.includes(search.toLowerCase());
    });
  }, [atividades, search]);

  const grouped = useMemo(() => {
    const g: Record<Prioridade, Atividade[]> = {
      CRITICA: [], EXPIRANDO: [], PROXIMA: [], NO_PRAZO: [], SEM_PRAZO: [], CONCLUIDA: [],
    };
    filtered.forEach(at => { g[calcularPrioridade(at)].push(at); });
    // sort dentro de cada grupo: vencimento mais próximo primeiro
    Object.keys(g).forEach(k => {
      g[k as Prioridade].sort((a, b) => {
        if (!a.data_prevista && !b.data_prevista) return 0;
        if (!a.data_prevista) return 1;
        if (!b.data_prevista) return -1;
        return new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
      });
    });
    return g;
  }, [filtered]);

  // KPIs
  const kpis = useMemo(() => ({
    criticas:   grouped.CRITICA.length,
    expirando:  grouped.EXPIRANDO.length,
    no_prazo:   grouped.NO_PRAZO.length + grouped.PROXIMA.length,
    concluidas_hoje: filtered.filter(a => {
      if (a.status !== 'REALIZADA' || !a.data_realizada) return false;
      const d = new Date(a.data_realizada);
      const hoje = new Date();
      return d.toDateString() === hoje.toDateString();
    }).length,
  }), [grouped, filtered]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const openCreate = (preset: Partial<typeof emptyForm> = {}) => {
    setForm({ ...emptyForm, responsavel_id: meuId, ...preset });
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (at: Atividade) => {
    setForm({
      lead_id: at.lead?.id || '',
      tipo: at.tipo,
      titulo: at.titulo,
      descricao: at.descricao || '',
      responsavel_id: at.responsavel_id || '',
      prazo_modo: 'data',
      dias_max: '7',
      data_prevista: at.data_prevista ? new Date(at.data_prevista).toISOString().slice(0, 16) : '',
    });
    setEditingId(at.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let dataPrevistaISO: string | undefined = undefined;
      if (form.prazo_modo === 'dias' && !editingId) {
        const dias = parseInt(form.dias_max) || 7;
        const d = new Date();
        d.setDate(d.getDate() + dias);
        d.setHours(23, 59, 0, 0);
        dataPrevistaISO = d.toISOString();
      } else if (form.data_prevista) {
        dataPrevistaISO = new Date(form.data_prevista).toISOString();
      }

      const payload: any = {
        lead_id: form.lead_id || undefined,
        tipo: form.tipo,
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        responsavel_id: form.responsavel_id || undefined,
        data_prevista: dataPrevistaISO,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      // lead_id é opcional no backend: atividade pode não estar ligada a um lead
      // (compromisso interno, com parceiro, etc.). Sem lead → marca vínculo NENHUM.
      if (!payload.lead_id) { delete payload.lead_id; payload.vinculo_tipo = 'NENHUM'; }
      if (editingId) await apiClient.updateAtividade(editingId, payload);
      else await apiClient.createAtividade(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar atividade');
    } finally { setSaving(false); }
  };

  // Inicia fluxo de conclusão: abre input inline em vez de window.prompt
  const iniciarConcluir = (at: Atividade) => {
    setConcluindoId(at.id);
    setResultadoInput('Concluída');
  };

  const confirmarConcluir = async () => {
    if (!concluindoId) return;
    const at = atividades.find(a => a.id === concluindoId);
    if (!at) { setConcluindoId(null); return; }
    try {
      await apiClient.concluirAtividade(at.id, { resultado: resultadoInput || 'Concluída' });
      fetchData();
      if (selected?.id === at.id) setSelected(null);
    } catch (e) { console.error(e); }
    finally { setConcluindoId(null); }
  };

  // Inicia fluxo de delete: mostra confirmação inline em vez de window.confirm
  const iniciarDelete = (id: string) => {
    setDeletandoId(id);
  };

  const confirmarDelete = async () => {
    if (!deletandoId) return;
    try {
      await apiClient.deleteAtividade(deletandoId);
      fetchData();
      if (selected?.id === deletandoId) setSelected(null);
    } catch (e) { console.error(e); }
    finally { setDeletandoId(null); }
  };

  const handleQuickReassign = async (at: Atividade, novoResponsavel: string) => {
    try {
      await apiClient.updateAtividade(at.id, { responsavel_id: novoResponsavel });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const usuarioNome = (id?: string) => {
    if (!id) return null;
    return usuarios.find(u => u.id === id)?.nome || null;
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-sidebar-grad-from)' }}>
        <Loader2 size={28} className="animate-spin text-white" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 py-4 space-y-4" style={{ background: 'var(--t-content-bg)', minHeight: 'calc(100vh - 64px)' }}>

        {/* ═══ HEADER ═══════════════════════════════════════════════════════ */}
        <div className="ps-card rounded-2xl p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3"
          style={{ boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--t-primary), var(--t-primary-dark))' }}>
              <CalendarDays size={20} color="white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: 'var(--t-text-primary)' }}>Atividades & Agenda</h1>
              <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                Kanban por prioridade · Designação · Acompanhamento automático de prazos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-secondary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                className="pl-8 pr-3 py-2 text-xs rounded-lg outline-none"
                style={{ border: '1px solid var(--t-card-border)', width: 190, color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
            </div>
            <button onClick={fetchData} title="Atualizar" className="p-2 rounded-lg"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
              <RefreshCw size={13} className={dataLoading ? 'animate-spin' : ''} style={{ color: 'var(--t-primary)' }} />
            </button>
            <a href="/agenda"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)', background: 'var(--t-card-bg)' }}>
              <CalendarIcon size={12} /> Agenda Google
            </a>
            <button onClick={() => openCreate()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--t-primary), var(--t-primary-dark))' }}>
              <Plus size={13} /> Nova Atividade
            </button>
          </div>
        </div>

        {/* ═══ KPIs ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={AlertOctagon}   label="Críticas / Atrasadas" value={kpis.criticas.toString()}   color="#dc2626" />
          <KpiCard icon={AlertTriangle}  label="Prazo expirando ≤3d"  value={kpis.expirando.toString()}  color="#ea580c" />
          <KpiCard icon={Clock}          label="No prazo"              value={kpis.no_prazo.toString()}   color="#16a34a" />
          <KpiCard icon={CheckCircle2}   label="Concluídas hoje"       value={kpis.concluidas_hoje.toString()} color="#0891b2" />
        </div>

        {/* ═══ TOOLBAR (escopo + view toggle + filtros) ════════════════════ */}
        <div className="ps-card rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2">

          <div className="flex items-center gap-2 flex-wrap">
            {/* Escopo: minhas vs todas (gestor) */}
            <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--t-content-bg)' }}>
              <button onClick={() => setEscopo('minhas')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: escopo === 'minhas' ? 'var(--t-card-bg)' : 'transparent',
                  color: escopo === 'minhas' ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                  boxShadow: escopo === 'minhas' ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
                }}>
                <UserCheck size={12} /> Minhas
              </button>
              {isGestor && (
                <button onClick={() => setEscopo('todas')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={{
                    background: escopo === 'todas' ? 'var(--t-card-bg)' : 'transparent',
                    color: escopo === 'todas' ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                    boxShadow: escopo === 'todas' ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
                  }}>
                  <UsersIcon size={12} /> Equipe ({atividades.length})
                </button>
              )}
            </div>

            {/* Tipo */}
            <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
              <option value="">Todos os tipos</option>
              {TIPOS_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {/* Status */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
              <option value="">Todos status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
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

        {/* ═══ VIEW: KANBAN POR PRIORIDADE ════════════════════════════════ */}
        {view === 'kanban' && (
          <div className="ps-card rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-primary-light)' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: 'var(--t-primary)' }} />
                <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>Quadro de Prioridade</p>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>
                Prioridade calculada automaticamente · Atividades a 3 dias ou menos do prazo entram em "Prazo expirando"
              </p>
            </div>
            <div className="overflow-x-auto" style={{ height: 'min(72vh, 700px)' }}>
              <div className="flex h-full gap-3 p-4" style={{ minWidth: `${KANBAN_COLUMNS.length * 260}px` }}>
                {KANBAN_COLUMNS.map(col => {
                  const cfg = PRIORIDADE_CONFIG[col];
                  const items = grouped[col];
                  const Icon = cfg.icon;
                  return (
                    <div key={col} className="flex flex-col rounded-xl flex-shrink-0"
                      style={{ width: 248, background: 'var(--t-card-bg)', border: `1px solid ${cfg.cor}33` }}>
                      <div className="px-3 py-2 flex items-center justify-between"
                        style={{ borderBottom: `2px solid ${cfg.cor}55`, background: cfg.bg }}>
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} style={{ color: cfg.cor }} />
                          <span className="text-[11px] font-extrabold truncate" style={{ color: cfg.cor }}>{cfg.label}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${cfg.cor}22`, color: cfg.cor }}>{items.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {items.length === 0 ? (
                          <p className="text-center text-[10px] py-6" style={{ color: `${cfg.cor}88` }}>Vazio</p>
                        ) : items.map(at => (
                          <AtividadeCard key={at.id} at={at} prioridade={col}
                            onClick={() => setSelected(at)}
                            onConcluir={() => iniciarConcluir(at)}
                            usuarioNome={usuarioNome(at.responsavel_id)}
                            concluindoId={concluindoId}
                            resultadoInput={resultadoInput}
                            onResultadoChange={setResultadoInput}
                            onConfirmarConcluir={confirmarConcluir}
                            onCancelarConcluir={() => setConcluindoId(null)}
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

        {/* ═══ VIEW: LISTA ═══════════════════════════════════════════════ */}
        {view === 'lista' && (
          <div className="ps-card rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-primary-light)' }}>
              <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>
                {filtered.length} atividade{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--t-card-border)' }}>
              {filtered.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Nenhuma atividade encontrada</p>
              ) : (
                // Ordenar pela prioridade calculada
                [...filtered]
                  .map(a => ({ at: a, p: calcularPrioridade(a) }))
                  .sort((a, b) => {
                    const o = PRIORIDADE_CONFIG[a.p].ordem - PRIORIDADE_CONFIG[b.p].ordem;
                    if (o !== 0) return o;
                    if (!a.at.data_prevista && !b.at.data_prevista) return 0;
                    if (!a.at.data_prevista) return 1;
                    if (!b.at.data_prevista) return -1;
                    return new Date(a.at.data_prevista).getTime() - new Date(b.at.data_prevista).getTime();
                  })
                  .map(({ at, p }) => {
                    // Status com desfecho (realizada/remarcada/cancelada) define a cor;
                    // senão usa a régua de prazo (prioridade).
                    const sv = statusVisual(at);
                    const cfg = sv || PRIORIDADE_CONFIG[p];
                    const Icon = cfg.icon;
                    const TipoIcon = TIPO_ICON[at.tipo] || Pin;
                    const dias = diasRestantes(at);
                    const corBarra = sv ? sv.cor : PRIORIDADE_CONFIG[p].cor;
                    const isBeingDeleted = deletandoId === at.id;
                    const isBeingConcluded = concluindoId === at.id;
                    return (
                      <div key={at.id}>
                        <div onClick={() => !isBeingDeleted && !isBeingConcluded && setSelected(at)}
                          className="px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors border-l-4"
                          style={{ borderLeftColor: corBarra, background: sv ? `${sv.bg}` : 'var(--t-card-bg)' }}>
                          <span className="flex-shrink-0" style={{ color: 'var(--t-primary)' }}>
                            <TipoIcon size={16} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-semibold truncate ${at.status === 'REALIZADA' ? 'line-through opacity-60' : ''}`}
                                style={{ color: 'var(--t-text-primary)' }}>{at.titulo}</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: cfg.bg, color: cfg.cor }}>
                                <Icon size={9} /> {cfg.etiqueta}
                              </span>
                            </div>
                            {at.lead?.nome && (
                              <p className="text-xs truncate" style={{ color: 'var(--t-text-secondary)' }}>
                                {at.lead.nome}{at.lead.empresa ? ` · ${at.lead.empresa}` : ''}
                                {usuarioNome(at.responsavel_id) && (
                                  <span className="inline-flex items-center gap-0.5">
                                    {' · '}<User size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {usuarioNome(at.responsavel_id)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {at.data_prevista && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-semibold" style={{ color: cfg.cor }}>
                                {dias !== null && dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : dias !== null ? `em ${dias}d` : '—'}
                              </p>
                              <p className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>{fmtDate(at.data_prevista)}</p>
                            </div>
                          )}
                          {at.status === 'PENDENTE' && !isBeingConcluded && (
                            <button onClick={e => { e.stopPropagation(); iniciarConcluir(at); }} title="Concluir"
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: '#16a34a', background: 'rgba(22,163,74,0.08)' }}>
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                        {/* Inline: confirmar conclusão */}
                        {isBeingConcluded && (
                          <div className="px-4 py-2 flex items-center gap-2 flex-wrap"
                            style={{ background: 'rgba(22,163,74,0.06)', borderLeft: '4px solid #16a34a' }}>
                            <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Resultado:</span>
                            <input
                              autoFocus
                              value={resultadoInput}
                              onChange={e => setResultadoInput(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs rounded-lg outline-none"
                              style={{ border: '1px solid #16a34a44', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)', minWidth: 120 }}
                              onKeyDown={e => { if (e.key === 'Enter') confirmarConcluir(); if (e.key === 'Escape') setConcluindoId(null); }}
                            />
                            <button onClick={confirmarConcluir}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                              style={{ background: '#16a34a' }}>
                              Confirmar
                            </button>
                            <button onClick={() => setConcluindoId(null)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold"
                              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                              Cancelar
                            </button>
                          </div>
                        )}
                        {/* Inline: confirmar delete */}
                        {isBeingDeleted && (
                          <div className="px-4 py-2 flex items-center gap-2 flex-wrap"
                            style={{ background: 'rgba(220,38,38,0.06)', borderLeft: '4px solid #dc2626' }}>
                            <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>Remover esta atividade?</span>
                            <button onClick={confirmarDelete}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                              style={{ background: '#dc2626' }}>
                              Confirmar
                            </button>
                            <button onClick={() => setDeletandoId(null)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold"
                              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

      </div>

      {/* ═══ MODAL: Nova / Editar Atividade ═════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,34,56,.6)' }}
          onClick={() => setShowModal(false)}>
          <div className="ps-card rounded-2xl shadow-2xl w-full" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>{editingId ? 'Editar Atividade' : 'Nova Atividade'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>{error}</div>}

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Cliente / Lead</label>
                <select value={form.lead_id} onChange={e => setForm((p: any) => ({ ...p, lead_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
                  <option value="">Sem cliente vinculado</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` — ${l.empresa}` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
                    {TIPOS_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Designar para</label>
                  <select value={form.responsavel_id} onChange={e => setForm((p: any) => ({ ...p, responsavel_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
                    <option value="">Sem responsável</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} {u.id === meuId ? '(eu)' : ''}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Ligação de follow-up"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3} placeholder="Detalhes da atividade..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Prazo de execução</label>
                  <div className="flex p-0.5 rounded-lg mb-2" style={{ background: 'var(--t-content-bg)', width: 'fit-content' }}>
                    <button type="button" onClick={() => setForm((p: any) => ({ ...p, prazo_modo: 'dias' }))}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={{
                        background: form.prazo_modo === 'dias' ? 'var(--t-card-bg)' : 'transparent',
                        color: form.prazo_modo === 'dias' ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                      }}>
                      Dias máximos
                    </button>
                    <button type="button" onClick={() => setForm((p: any) => ({ ...p, prazo_modo: 'data' }))}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={{
                        background: form.prazo_modo === 'data' ? 'var(--t-card-bg)' : 'transparent',
                        color: form.prazo_modo === 'data' ? 'var(--t-text-primary)' : 'var(--t-text-secondary)',
                      }}>
                      Data específica
                    </button>
                  </div>
                  {form.prazo_modo === 'dias' ? (
                    <div>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {['1', '3', '7', '14', '30'].map(d => (
                          <button key={d} type="button" onClick={() => setForm((p: any) => ({ ...p, dias_max: d }))}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              border: `1px solid ${form.dias_max === d ? 'var(--t-primary)' : 'var(--t-card-border)'}`,
                              background: form.dias_max === d ? 'var(--t-primary-light)' : 'var(--t-card-bg)',
                              color: form.dias_max === d ? 'var(--t-primary)' : 'var(--t-text-secondary)',
                            }}>
                            {d} {d === '1' ? 'dia' : 'dias'}
                          </button>
                        ))}
                      </div>
                      <input type="number" min={1} value={form.dias_max} onChange={e => setForm((p: any) => ({ ...p, dias_max: e.target.value }))}
                        placeholder="Ou digite N dias..."
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
                      <p className="text-[10px] mt-1" style={{ color: 'var(--t-text-secondary)' }}>
                        Vence em {(() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(form.dias_max) || 0)); return d.toLocaleDateString('pt-BR'); })()}
                      </p>
                    </div>
                  ) : (
                    <input type="datetime-local" value={form.data_prevista} onChange={e => setForm((p: any) => ({ ...p, data_prevista: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
                  )}
                </div>
              )}

              {editingId && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Data prevista</label>
                  <input type="datetime-local" value={form.data_prevista} onChange={e => setForm((p: any) => ({ ...p, data_prevista: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)', background: 'var(--t-card-bg)' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.titulo}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--t-primary), var(--t-primary-dark))' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null} {editingId ? 'Salvar' : 'Criar Atividade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAIL PANEL ═════════════════════════════════════════════ */}
      {selected && (() => {
        const p = calcularPrioridade(selected);
        const sv = statusVisual(selected);
        const cfg = sv || PRIORIDADE_CONFIG[p];
        const Icon = cfg.icon;
        const TipoIcon = TIPO_ICON[selected.tipo] || Pin;
        const dias = diasRestantes(selected);
        const isConcluding = concluindoId === selected.id;
        const isDeleting = deletandoId === selected.id;
        return (
          <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(13,34,56,.5)' }} onClick={() => setSelected(null)}>
            <div className="ml-auto h-full overflow-y-auto" style={{ width: '90vw', maxWidth: 500, background: 'var(--t-card-bg)' }} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: 'var(--t-primary)', flexShrink: 0 }}>
                    <TipoIcon size={18} />
                  </span>
                  <h3 className="font-extrabold text-sm truncate" style={{ color: 'var(--t-text-primary)' }}>{selected.titulo}</h3>
                </div>
                <button onClick={() => setSelected(null)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
              </div>

              <div className="p-5 space-y-4">
                {/* Etiqueta de prioridade */}
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: cfg.bg, border: `1px solid ${cfg.cor}33` }}>
                  <Icon size={20} style={{ color: cfg.cor }} />
                  <div>
                    <p className="text-xs font-extrabold" style={{ color: cfg.cor }}>{cfg.etiqueta}</p>
                    {selected.data_prevista && (
                      <p className="text-[11px]" style={{ color: cfg.cor, opacity: 0.85 }}>
                        {dias !== null && dias < 0 ? `Atrasada há ${Math.abs(dias)} dia(s) · ` : dias === 0 ? 'Vence hoje · ' : dias !== null ? `Vence em ${dias} dia(s) · ` : ''}
                        {fmtDateTime(selected.data_prevista)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lead */}
                {selected.lead?.nome && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--t-primary)' }}>Cliente</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{selected.lead.nome}</p>
                    {selected.lead.empresa && <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>{selected.lead.empresa}</p>}
                  </div>
                )}

                {/* Descrição */}
                {selected.descricao && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--t-primary)' }}>Descrição</p>
                    <p className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{selected.descricao}</p>
                  </div>
                )}

                {/* Resultado */}
                {selected.resultado && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#16a34a' }}>Resultado</p>
                    <p className="text-sm italic" style={{ color: 'var(--t-text-primary)' }}>"{selected.resultado}"</p>
                  </div>
                )}

                {/* Responsável (com possibilidade de reatribuir se gestor) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--t-primary)' }}>Responsável</p>
                  {isGestor ? (
                    <select value={selected.responsavel_id || ''}
                      onChange={e => handleQuickReassign(selected, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}>
                      <option value="">Sem responsável</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} {u.id === meuId ? '(eu)' : ''}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{usuarioNome(selected.responsavel_id) || 'Não atribuído'}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--t-primary)' }}>Status</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{selected.status}</p>
                </div>

                {/* Google Meet */}
                {selected.google_meet_link && (
                  <a href={selected.google_meet_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: '#16a34a' }}>
                    <Video size={14} /> Abrir reunião no Meet
                  </a>
                )}

                {/* Inline: confirmar conclusão (dentro do painel) */}
                {isConcluding && (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>Qual foi o resultado?</p>
                    <input
                      autoFocus
                      value={resultadoInput}
                      onChange={e => setResultadoInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid rgba(22,163,74,0.35)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}
                      onKeyDown={e => { if (e.key === 'Enter') confirmarConcluir(); if (e.key === 'Escape') setConcluindoId(null); }}
                    />
                    <div className="flex gap-2">
                      <button onClick={confirmarConcluir} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#16a34a' }}>Confirmar</button>
                      <button onClick={() => setConcluindoId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Inline: confirmar delete (dentro do painel) */}
                {isDeleting && (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>Remover esta atividade permanentemente?</p>
                    <div className="flex gap-2">
                      <button onClick={confirmarDelete} className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#dc2626' }}>Confirmar</button>
                      <button onClick={() => setDeletandoId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-5 py-4 sticky bottom-0" style={{ borderTop: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
                {selected.status === 'PENDENTE' && !isConcluding && (
                  <button onClick={() => iniciarConcluir(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: '#16a34a' }}>
                    <Check size={12} /> Concluir
                  </button>
                )}
                <button onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)', background: 'var(--t-card-bg)' }}>
                  Editar
                </button>
                {!isDeleting && (
                  <button onClick={() => iniciarDelete(selected.id)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ border: '1px solid rgba(220,38,38,0.35)', color: '#dc2626' }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>; label: string; value: string; color: string;
}) {
  return (
    <div className="ps-card rounded-xl p-3 flex items-center gap-3"
      style={{ boxShadow: '0 1px 2px rgba(13,34,56,.04)' }}>
      <div className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 40, height: 40, background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--t-text-secondary)' }}>{label}</p>
        <p className="text-xl font-extrabold leading-tight" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

function AtividadeCard({ at, prioridade, onClick, onConcluir, usuarioNome, concluindoId, resultadoInput, onResultadoChange, onConfirmarConcluir, onCancelarConcluir }: {
  at: Atividade; prioridade: Prioridade;
  onClick: () => void; onConcluir: () => void;
  usuarioNome: string | null;
  concluindoId: string | null;
  resultadoInput: string;
  onResultadoChange: (v: string) => void;
  onConfirmarConcluir: () => void;
  onCancelarConcluir: () => void;
}) {
  const cfg = PRIORIDADE_CONFIG[prioridade];
  const TipoIcon = TIPO_ICON[at.tipo] || Pin;
  const dias = diasRestantes(at);
  const isConcluding = concluindoId === at.id;
  return (
    <div style={{ background: 'var(--t-card-bg)', border: `1px solid var(--t-card-border)`, borderRadius: 12, borderLeft: `3px solid ${cfg.cor}` }}>
      <div onClick={onClick} className="p-2.5 cursor-pointer hover:shadow-md transition-shadow rounded-xl">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="flex-shrink-0" style={{ color: 'var(--t-primary)' }}>
            <TipoIcon size={14} />
          </span>
          <p className="text-xs font-bold flex-1 leading-tight" style={{ color: 'var(--t-text-primary)' }}>{at.titulo}</p>
        </div>
        {at.lead?.nome && (
          <p className="text-[10px] truncate mb-1" style={{ color: 'var(--t-text-secondary)' }}>
            {at.lead.nome}{at.lead.empresa ? ` · ${at.lead.empresa}` : ''}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--t-card-border)' }}>
          <div className="flex items-center gap-1 min-w-0">
            {at.data_prevista && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: cfg.bg, color: cfg.cor }}>
                {dias !== null && dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : dias !== null ? `${dias}d` : 'sem prazo'}
              </span>
            )}
            {usuarioNome && (
              <span className="text-[9px] truncate flex items-center gap-0.5" style={{ color: 'var(--t-text-secondary)' }} title={usuarioNome}>
                <User size={9} /> {usuarioNome.split(' ')[0]}
              </span>
            )}
          </div>
          {at.status === 'PENDENTE' && !isConcluding && (
            <button onClick={e => { e.stopPropagation(); onConcluir(); }} title="Concluir"
              className="p-0.5 rounded transition-colors" style={{ color: '#16a34a' }}>
              <Check size={11} />
            </button>
          )}
        </div>
      </div>
      {isConcluding && (
        <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(22,163,74,0.20)' }}>
          <p className="text-[9px] font-semibold pt-1.5" style={{ color: '#16a34a' }}>Resultado:</p>
          <input
            autoFocus
            value={resultadoInput}
            onChange={e => onResultadoChange(e.target.value)}
            className="w-full px-2 py-1 text-[10px] rounded-lg outline-none"
            style={{ border: '1px solid rgba(22,163,74,0.35)', color: 'var(--t-text-primary)', background: 'var(--t-content-bg)' }}
            onKeyDown={e => { if (e.key === 'Enter') onConfirmarConcluir(); if (e.key === 'Escape') onCancelarConcluir(); }}
          />
          <div className="flex gap-1">
            <button onClick={onConfirmarConcluir} className="flex-1 py-0.5 rounded-md text-[9px] font-bold text-white" style={{ background: '#16a34a' }}>OK</button>
            <button onClick={onCancelarConcluir} className="flex-1 py-0.5 rounded-md text-[9px] font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>X</button>
          </div>
        </div>
      )}
    </div>
  );
}
