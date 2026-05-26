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
const TIPO_ICON: Record<string, string> = {
  LIGACAO: '📞', EMAIL: '✉️', REUNIAO: '🤝', WHATSAPP: '💬',
  VISITA: '🚗', TAREFA: '✅', OUTRO: '📌',
};

const TIPOS_OPTIONS = [
  { value: 'TAREFA',   label: '✅ Tarefa' },
  { value: 'LIGACAO',  label: '📞 Ligação' },
  { value: 'EMAIL',    label: '✉️ E-mail' },
  { value: 'WHATSAPP', label: '💬 WhatsApp' },
  { value: 'REUNIAO',  label: '🤝 Reunião' },
  { value: 'VISITA',   label: '🚗 Visita' },
  { value: 'OUTRO',    label: '📌 Outro' },
];

const STATUS_OPTIONS = ['PENDENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REMARCADA'];

// Régua de prioridade dinâmica (calculada a partir de data_prevista vs hoje)
type Prioridade = 'CRITICA' | 'EXPIRANDO' | 'PROXIMA' | 'NO_PRAZO' | 'SEM_PRAZO' | 'CONCLUIDA';

const PRIORIDADE_CONFIG: Record<Prioridade, {
  label: string; etiqueta: string; cor: string; bg: string; icon: any; ordem: number;
}> = {
  CRITICA:   { label: 'Crítico',         etiqueta: 'Atrasada',           cor: '#dc2626', bg: '#FEE2E2', icon: AlertOctagon, ordem: 0 },
  EXPIRANDO: { label: 'Prazo expirando', etiqueta: 'Prioridade máxima',  cor: '#ea580c', bg: '#FFEDD5', icon: AlertTriangle, ordem: 1 },
  PROXIMA:   { label: 'Próxima',         etiqueta: 'Próxima',            cor: '#d97706', bg: '#FEF3C7', icon: Clock,         ordem: 2 },
  NO_PRAZO:  { label: 'No prazo',        etiqueta: 'Dentro do prazo',    cor: '#16a34a', bg: '#DCFCE7', icon: CheckCircle2,  ordem: 3 },
  SEM_PRAZO: { label: 'Sem prazo',       etiqueta: 'Sem prazo definido', cor: '#6B7280', bg: '#F3F4F6', icon: CalendarIcon,  ordem: 4 },
  CONCLUIDA: { label: 'Concluída',       etiqueta: 'Concluída',          cor: '#0891b2', bg: '#CFFAFE', icon: CheckCircle2,  ordem: 5 },
};

const KANBAN_COLUMNS: Prioridade[] = ['CRITICA', 'EXPIRANDO', 'PROXIMA', 'NO_PRAZO', 'SEM_PRAZO'];

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

      if (editingId) await apiClient.updateAtividade(editingId, payload);
      else {
        if (!payload.lead_id) {
          // backend exige lead_id — usar primeiro lead disponível ou avisar
          if (leads.length === 0) { setError('Cadastre um lead antes de criar atividades'); setSaving(false); return; }
          payload.lead_id = leads[0].id;
        }
        await apiClient.createAtividade(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar atividade');
    } finally { setSaving(false); }
  };

  const handleConcluir = async (at: Atividade) => {
    const resultado = prompt('Qual foi o resultado da atividade?', 'Concluída');
    if (!resultado) return;
    try {
      await apiClient.concluirAtividade(at.id, { resultado });
      fetchData();
      if (selected?.id === at.id) setSelected(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta atividade?')) return;
    try {
      await apiClient.deleteAtividade(id);
      fetchData();
      if (selected?.id === id) setSelected(null);
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
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
    return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0D2238' }}><Loader2 size={28} className="animate-spin text-white" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 py-4 space-y-4" style={{ background: '#F4F7FB', minHeight: 'calc(100vh - 64px)' }}>

        {/* ═══ HEADER ═══════════════════════════════════════════════════════ */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3"
          style={{ border: '1px solid #D8E8F5', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}>
              <CalendarDays size={20} color="white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold" style={{ color: '#0D2238' }}>Atividades & Agenda</h1>
              <p className="text-xs" style={{ color: '#7AAACB' }}>
                Kanban por prioridade · Designação · Acompanhamento automático de prazos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#7AAACB' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid #D8E8F5', width: 190, color: '#0D2238' }} />
            </div>
            <button onClick={fetchData} title="Atualizar" className="p-2 rounded-lg" style={{ border: '1px solid #D8E8F5' }}>
              <RefreshCw size={13} className={dataLoading ? 'animate-spin' : ''} style={{ color: '#4B8EC8' }} />
            </button>
            <a href="/agenda"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ border: '1px solid #D8E8F5', color: '#4B8EC8' }}>
              <CalendarIcon size={12} /> Agenda Google
            </a>
            <button onClick={() => openCreate()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}>
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
        <div className="rounded-2xl bg-white p-3 flex items-center justify-between flex-wrap gap-2"
          style={{ border: '1px solid #D8E8F5' }}>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Escopo: minhas vs todas (gestor) */}
            <div className="flex p-0.5 rounded-lg" style={{ background: '#F4F7FB' }}>
              <button onClick={() => setEscopo('minhas')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{ background: escopo === 'minhas' ? 'white' : 'transparent', color: escopo === 'minhas' ? '#0D2238' : '#7AAACB', boxShadow: escopo === 'minhas' ? '0 1px 2px rgba(0,0,0,.05)' : 'none' }}>
                <UserCheck size={12} /> Minhas
              </button>
              {isGestor && (
                <button onClick={() => setEscopo('todas')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={{ background: escopo === 'todas' ? 'white' : 'transparent', color: escopo === 'todas' ? '#0D2238' : '#7AAACB', boxShadow: escopo === 'todas' ? '0 1px 2px rgba(0,0,0,.05)' : 'none' }}>
                  <UsersIcon size={12} /> Equipe ({atividades.length})
                </button>
              )}
            </div>

            {/* Tipo */}
            <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
              <option value="">Todos os tipos</option>
              {TIPOS_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {/* Status */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
              <option value="">Todos status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex p-0.5 rounded-lg" style={{ background: '#F4F7FB' }}>
            {([
              { key: 'kanban', label: 'Kanban', icon: LayoutGrid },
              { key: 'lista',  label: 'Lista',  icon: ListChecks },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: view === v.key ? 'white' : 'transparent',
                  color: view === v.key ? '#0D2238' : '#7AAACB',
                  boxShadow: view === v.key ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
                }}>
                <v.icon size={12} /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ VIEW: KANBAN POR PRIORIDADE ════════════════════════════════ */}
        {view === 'kanban' && (
          <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #D8E8F5' }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #D8E8F5', background: '#F8FBFF' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: '#4B8EC8' }} />
                <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#4B8EC8' }}>Quadro de Prioridade</p>
              </div>
              <p className="text-[10px]" style={{ color: '#7AAACB' }}>
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
                      style={{ width: 248, background: 'white', border: `1px solid ${cfg.cor}33` }}>
                      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `2px solid ${cfg.cor}55`, background: cfg.bg }}>
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} style={{ color: cfg.cor }} />
                          <span className="text-[11px] font-extrabold truncate" style={{ color: cfg.cor }}>{cfg.label}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cfg.cor}22`, color: cfg.cor }}>{items.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {items.length === 0 ? (
                          <p className="text-center text-[10px] py-6" style={{ color: `${cfg.cor}88` }}>Vazio</p>
                        ) : items.map(at => (
                          <AtividadeCard key={at.id} at={at} prioridade={col}
                            onClick={() => setSelected(at)}
                            onConcluir={() => handleConcluir(at)}
                            usuarioNome={usuarioNome(at.responsavel_id)}
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
          <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #D8E8F5' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #D8E8F5', background: '#F8FBFF' }}>
              <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#4B8EC8' }}>
                {filtered.length} atividade{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: '#EBF4FF' }}>
              {filtered.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: '#7AAACB' }}>Nenhuma atividade encontrada</p>
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
                    const cfg = PRIORIDADE_CONFIG[p];
                    const Icon = cfg.icon;
                    const dias = diasRestantes(at);
                    return (
                      <div key={at.id} onClick={() => setSelected(at)}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <span className="text-lg flex-shrink-0">{TIPO_ICON[at.tipo] || '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold truncate ${at.status === 'REALIZADA' ? 'line-through opacity-60' : ''}`} style={{ color: '#0D2238' }}>{at.titulo}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: cfg.bg, color: cfg.cor }}>
                              <Icon size={9} /> {cfg.etiqueta}
                            </span>
                          </div>
                          {at.lead?.nome && (
                            <p className="text-xs truncate" style={{ color: '#7AAACB' }}>
                              {at.lead.nome}{at.lead.empresa ? ` · ${at.lead.empresa}` : ''}
                              {usuarioNome(at.responsavel_id) && <span> · 👤 {usuarioNome(at.responsavel_id)}</span>}
                            </p>
                          )}
                        </div>
                        {at.data_prevista && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold" style={{ color: cfg.cor }}>
                              {dias !== null && dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : dias !== null ? `em ${dias}d` : '—'}
                            </p>
                            <p className="text-[10px]" style={{ color: '#7AAACB' }}>{fmtDate(at.data_prevista)}</p>
                          </div>
                        )}
                        {at.status === 'PENDENTE' && (
                          <button onClick={e => { e.stopPropagation(); handleConcluir(at); }} title="Concluir"
                            className="p-1.5 rounded-lg hover:bg-green-50" style={{ color: '#16a34a' }}>
                            <Check size={14} />
                          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,34,56,.6)' }} onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #D8E8F5' }}>
              <h2 className="text-sm font-extrabold" style={{ color: '#0D2238' }}>{editingId ? 'Editar Atividade' : 'Nova Atividade'}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} style={{ color: '#7AAACB' }} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>}

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Cliente / Lead</label>
                <select value={form.lead_id} onChange={e => setForm((p: any) => ({ ...p, lead_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
                  <option value="">Sem cliente vinculado</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` — ${l.empresa}` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
                    {TIPOS_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Designar para</label>
                  <select value={form.responsavel_id} onChange={e => setForm((p: any) => ({ ...p, responsavel_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
                    <option value="">Sem responsável</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} {u.id === meuId ? '(eu)' : ''}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Ligação de follow-up"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3} placeholder="Detalhes da atividade..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }} />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Prazo de execução</label>
                  <div className="flex p-0.5 rounded-lg mb-2" style={{ background: '#F4F7FB', width: 'fit-content' }}>
                    <button type="button" onClick={() => setForm((p: any) => ({ ...p, prazo_modo: 'dias' }))}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={{ background: form.prazo_modo === 'dias' ? 'white' : 'transparent', color: form.prazo_modo === 'dias' ? '#0D2238' : '#7AAACB' }}>
                      Dias máximos
                    </button>
                    <button type="button" onClick={() => setForm((p: any) => ({ ...p, prazo_modo: 'data' }))}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                      style={{ background: form.prazo_modo === 'data' ? 'white' : 'transparent', color: form.prazo_modo === 'data' ? '#0D2238' : '#7AAACB' }}>
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
                              border: `1px solid ${form.dias_max === d ? '#4B8EC8' : '#D8E8F5'}`,
                              background: form.dias_max === d ? '#EBF4FF' : 'white',
                              color: form.dias_max === d ? '#4B8EC8' : '#7AAACB',
                            }}>
                            {d} {d === '1' ? 'dia' : 'dias'}
                          </button>
                        ))}
                      </div>
                      <input type="number" min={1} value={form.dias_max} onChange={e => setForm((p: any) => ({ ...p, dias_max: e.target.value }))}
                        placeholder="Ou digite N dias..."
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }} />
                      <p className="text-[10px] mt-1" style={{ color: '#7AAACB' }}>
                        Vence em {(() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(form.dias_max) || 0)); return d.toLocaleDateString('pt-BR'); })()}
                      </p>
                    </div>
                  ) : (
                    <input type="datetime-local" value={form.data_prevista} onChange={e => setForm((p: any) => ({ ...p, data_prevista: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }} />
                  )}
                </div>
              )}

              {editingId && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#7AAACB' }}>Data prevista</label>
                  <input type="datetime-local" value={form.data_prevista} onChange={e => setForm((p: any) => ({ ...p, data_prevista: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #D8E8F5', color: '#0D2238' }} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #D8E8F5' }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid #D8E8F5', color: '#7AAACB' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : null} {editingId ? 'Salvar' : 'Criar Atividade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAIL PANEL ═════════════════════════════════════════════ */}
      {selected && (() => {
        const p = calcularPrioridade(selected);
        const cfg = PRIORIDADE_CONFIG[p];
        const Icon = cfg.icon;
        const dias = diasRestantes(selected);
        return (
          <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(13,34,56,.5)' }} onClick={() => setSelected(null)}>
            <div className="ml-auto bg-white h-full overflow-y-auto" style={{ width: '90vw', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #D8E8F5' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">{TIPO_ICON[selected.tipo]}</span>
                  <h3 className="font-extrabold text-sm truncate" style={{ color: '#0D2238' }}>{selected.titulo}</h3>
                </div>
                <button onClick={() => setSelected(null)}><X size={16} style={{ color: '#7AAACB' }} /></button>
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
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4B8EC8' }}>Cliente</p>
                    <p className="text-sm font-semibold" style={{ color: '#0D2238' }}>{selected.lead.nome}</p>
                    {selected.lead.empresa && <p className="text-xs" style={{ color: '#7AAACB' }}>{selected.lead.empresa}</p>}
                  </div>
                )}

                {/* Descrição */}
                {selected.descricao && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4B8EC8' }}>Descrição</p>
                    <p className="text-sm" style={{ color: '#0D2238' }}>{selected.descricao}</p>
                  </div>
                )}

                {/* Resultado */}
                {selected.resultado && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#16a34a' }}>Resultado</p>
                    <p className="text-sm italic" style={{ color: '#0D2238' }}>"{selected.resultado}"</p>
                  </div>
                )}

                {/* Responsável (com possibilidade de reatribuir se gestor) */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4B8EC8' }}>Responsável</p>
                  {isGestor ? (
                    <select value={selected.responsavel_id || ''}
                      onChange={e => handleQuickReassign(selected, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid #D8E8F5', color: '#0D2238' }}>
                      <option value="">Sem responsável</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} {u.id === meuId ? '(eu)' : ''}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm" style={{ color: '#0D2238' }}>{usuarioNome(selected.responsavel_id) || 'Não atribuído'}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#4B8EC8' }}>Status</p>
                  <p className="text-sm font-semibold" style={{ color: '#0D2238' }}>{selected.status}</p>
                </div>

                {/* Google Meet */}
                {selected.google_meet_link && (
                  <a href={selected.google_meet_link} target="_blank" rel="noopener noreferrer"
                    className="block px-4 py-2.5 rounded-xl text-center text-sm font-semibold text-white"
                    style={{ background: '#16a34a' }}>
                    🎥 Abrir reunião no Meet
                  </a>
                )}
              </div>

              <div className="flex gap-2 px-5 py-4 sticky bottom-0 bg-white" style={{ borderTop: '1px solid #D8E8F5' }}>
                {selected.status === 'PENDENTE' && (
                  <button onClick={() => handleConcluir(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#16a34a' }}>
                    <Check size={12} /> Concluir
                  </button>
                )}
                <button onClick={() => openEdit(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid #D8E8F5', color: '#4B8EC8' }}>
                  Editar
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid #FCA5A5', color: '#dc2626' }}>
                  <Trash2 size={12} />
                </button>
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
    <div className="rounded-xl bg-white p-3 flex items-center gap-3"
      style={{ border: '1px solid #D8E8F5', boxShadow: '0 1px 2px rgba(13,34,56,.04)' }}>
      <div className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 40, height: 40, background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color: '#7AAACB' }}>{label}</p>
        <p className="text-xl font-extrabold leading-tight" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

function AtividadeCard({ at, prioridade, onClick, onConcluir, usuarioNome }: {
  at: Atividade; prioridade: Prioridade;
  onClick: () => void; onConcluir: () => void;
  usuarioNome: string | null;
}) {
  const cfg = PRIORIDADE_CONFIG[prioridade];
  const dias = diasRestantes(at);
  return (
    <div onClick={onClick}
      className="rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ background: 'white', border: '1px solid #D8E8F5', borderLeft: `3px solid ${cfg.cor}` }}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-base flex-shrink-0">{TIPO_ICON[at.tipo] || '📌'}</span>
        <p className="text-xs font-bold flex-1 leading-tight" style={{ color: '#0D2238' }}>{at.titulo}</p>
      </div>
      {at.lead?.nome && (
        <p className="text-[10px] truncate mb-1" style={{ color: '#7AAACB' }}>
          {at.lead.nome}{at.lead.empresa ? ` · ${at.lead.empresa}` : ''}
        </p>
      )}
      <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px solid #F4F7FB' }}>
        <div className="flex items-center gap-1 min-w-0">
          {at.data_prevista && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: cfg.bg, color: cfg.cor }}>
              {dias !== null && dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : dias !== null ? `${dias}d` : 'sem prazo'}
            </span>
          )}
          {usuarioNome && (
            <span className="text-[9px] truncate" style={{ color: '#7AAACB' }} title={usuarioNome}>
              👤 {usuarioNome.split(' ')[0]}
            </span>
          )}
        </div>
        {at.status === 'PENDENTE' && (
          <button onClick={e => { e.stopPropagation(); onConcluir(); }} title="Concluir"
            className="p-0.5 rounded hover:bg-green-50" style={{ color: '#16a34a' }}>
            <Check size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
