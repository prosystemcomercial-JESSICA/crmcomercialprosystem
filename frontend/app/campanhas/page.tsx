'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  Plus, RefreshCw, X, Target, DollarSign, Package,
  Calendar, Megaphone, TrendingUp, Users, BarChart2,
  Edit3, Trash2, ChevronDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Campanha {
  id: string;
  nome: string;
  descricao?: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  created_at: string;
  // campos extras
  nicho?: string;
  plano_alvo?: string;
  mensalidade?: number;
  valor_setup?: number;
  setup_condicao?: string;
  meta_contratos?: number;
  meta_receita?: number;
  condicao_especial?: string;
  _count?: { disparos: number; acoes: number };
}

interface CampanhaForm {
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  nicho: string;
  plano_alvo: string;
  mensalidade: string;
  valor_setup: string;
  setup_condicao: string;
  meta_contratos: string;
  meta_receita: string;
  condicao_especial: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NICHOS = [
  'Farmácias e Drogarias',
  'Padarias e Confeitarias',
  'Lojas de Varejo Geral',
  'Distribuidoras',
  'Pet Shops',
  'Óticas',
  'Conveniências',
  'Outro',
];

const PLANOS: { label: string; mensalidade: string; setup: string }[] = [
  { label: 'Basic',    mensalidade: '', setup: '' },
  { label: 'Pro',      mensalidade: '', setup: '' },
  { label: 'Plus',     mensalidade: '', setup: '' },
  { label: 'Premium',  mensalidade: '', setup: '' },
  { label: 'Especial', mensalidade: '', setup: '' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO:   { label: 'Rascunho',   color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  ATIVA:      { label: 'Ativa',      color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
  PAUSADA:    { label: 'Pausada',    color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  FINALIZADA: { label: 'Finalizada', color: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
  ARQUIVADA:  { label: 'Arquivada',  color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
};

const ROLES_GERENCIAR = ['CEO', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'GERENTE', 'DIRETOR'];

const fmtBRL = (v?: number | string | null) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return n != null && !isNaN(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');

const today = new Date();
const nextMonth = new Date(today);
nextMonth.setMonth(nextMonth.getMonth() + 1);

const emptyForm: CampanhaForm = {
  nome: '',
  descricao: '',
  data_inicio: today.toISOString().slice(0, 16),
  data_fim: nextMonth.toISOString().slice(0, 16),
  nicho: '',
  plano_alvo: '',
  mensalidade: '',
  valor_setup: '',
  setup_condicao: '',
  meta_contratos: '',
  meta_receita: '',
  condicao_especial: '',
};

const ROLES_GERENCIAR_CAMPANHAS = ['CEO', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'GERENTE', 'DIRETOR'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const podeGerenciar = ROLES_GERENCIAR_CAMPANHAS.includes((user?.role || '').toUpperCase());
  const router = useRouter();

  const [campanhas, setCampanhas]     = useState<Campanha[]>([]);
  const [stats, setStats]             = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<CampanhaForm>(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [viewingCampanha, setViewingCampanha] = useState<Campanha | null>(null);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        apiClient.getCampanhas(0, 50, statusFilter || undefined),
        apiClient.getCampanhasStats(),
      ]);
      setCampanhas(res.data.data.campanhas);
      setStats(statsRes.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, [statusFilter]);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  const setF = (k: keyof CampanhaForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowModal(true); };

  const openEdit = (c: Campanha) => {
    setForm({
      nome: c.nome,
      descricao: c.descricao || '',
      data_inicio: new Date(c.data_inicio).toISOString().slice(0, 16),
      data_fim: new Date(c.data_fim).toISOString().slice(0, 16),
      nicho: c.nicho || '',
      plano_alvo: c.plano_alvo || '',
      mensalidade: c.mensalidade != null ? String(c.mensalidade) : '',
      valor_setup: c.valor_setup != null ? String(c.valor_setup) : '',
      setup_condicao: c.setup_condicao || '',
      meta_contratos: c.meta_contratos != null ? String(c.meta_contratos) : '',
      meta_receita: c.meta_receita != null ? String(c.meta_receita) : '',
      condicao_especial: c.condicao_especial || '',
    });
    setEditingId(c.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload: any = {
        nome: form.nome,
        descricao: form.descricao || undefined,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: new Date(form.data_fim).toISOString(),
        nicho: form.nicho || undefined,
        plano_alvo: form.plano_alvo || undefined,
        mensalidade: form.mensalidade !== '' ? parseFloat(form.mensalidade) : undefined,
        valor_setup: form.valor_setup !== '' ? parseFloat(form.valor_setup) : undefined,
        setup_condicao: form.setup_condicao || undefined,
        meta_contratos: form.meta_contratos !== '' ? parseInt(form.meta_contratos) : undefined,
        meta_receita: form.meta_receita !== '' ? parseFloat(form.meta_receita) : undefined,
        condicao_especial: form.condicao_especial || undefined,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      if (editingId) await apiClient.updateCampanha(editingId, payload);
      else await apiClient.createCampanha(payload);
      setShowModal(false); fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleChangeStatus = async (id: string, status: string) => {
    try { await apiClient.updateCampanha(id, { status }); fetchData(); }
    catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    try { await apiClient.deleteCampanha(id); fetchData(); setConfirmDelete(null); }
    catch (e) { console.error(e); }
  };

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="w-full px-4 sm:px-6 py-4 space-y-4" style={{ background: 'var(--t-content-bg)', minHeight: 'calc(100vh - 56px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Campanhas</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              {podeGerenciar ? 'Gerencie campanhas por nicho, plano, meta e condição especial' : 'Acompanhe as campanhas ativas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="h-8 w-8 flex items-center justify-center rounded-lg"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
              <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} style={{ color: 'var(--t-primary)' }} />
            </button>
            {podeGerenciar && (
              <button onClick={openCreate}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-bold text-white ps-btn-primary">
                <Plus size={13} /> Nova Campanha
              </button>
            )}
          </div>
        </div>

        {/* Aviso vendedor */}
        {!podeGerenciar && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
            <Megaphone size={16} style={{ color: 'var(--t-primary)', flexShrink: 0 }} />
            <p className="text-xs" style={{ color: 'var(--t-primary)' }}>
              Apenas CEO, Diretor e Supervisores podem criar ou editar campanhas.
            </p>
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'var(--t-primary)', icon: Megaphone },
              { label: 'Ativas', value: stats.ativas, color: '#16a34a', icon: TrendingUp },
              { label: 'Rascunhos', value: stats.rascunhos, color: '#d97706', icon: Edit3 },
              { label: 'Finalizadas', value: stats.finalizadas, color: '#2563eb', icon: BarChart2 },
              { label: 'Disparos', value: stats.totalDisparos, color: '#7c3aed', icon: Users },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="ps-card rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${k.color}14` }}>
                    <Icon size={16} style={{ color: k.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--t-text-muted)' }}>{k.label}</p>
                    <p className="text-xl font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtros */}
        <div className="ps-card rounded-xl p-2.5 flex items-center gap-2 flex-wrap">
          {['', 'RASCUNHO', 'ATIVA', 'PAUSADA', 'FINALIZADA', 'ARQUIVADA'].map(s => {
            const cfg = s ? STATUS_CONFIG[s] : null;
            const ativo = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: ativo ? (cfg?.bg || 'var(--t-primary-light)') : 'transparent',
                  color: ativo ? (cfg?.color || 'var(--t-primary)') : 'var(--t-text-muted)',
                  border: `1px solid ${ativo ? (cfg?.color || 'var(--t-primary)') : 'var(--t-card-border)'}`,
                }}>
                {s === '' ? 'Todas' : cfg?.label}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        {dataLoading ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando...</p>
        ) : campanhas.length === 0 ? (
          <div className="ps-card rounded-xl p-12 text-center">
            <Megaphone size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--t-text-muted)' }} />
            <p className="text-sm mb-3" style={{ color: 'var(--t-text-muted)' }}>Nenhuma campanha encontrada</p>
            {podeGerenciar && (
              <button onClick={openCreate}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: 'var(--t-primary)' }}>
                Criar primeira campanha
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campanhas.map(c => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.RASCUNHO;
              return (
                <div key={c.id} className="ps-card rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  style={{ border: '1px solid var(--t-card-border)', borderTop: `3px solid ${cfg.color}` }}
                  onClick={() => setViewingCampanha(c)}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate" style={{ color: 'var(--t-text-primary)' }}>{c.nome}</h3>
                        {c.nicho && (
                          <span className="text-[10px] font-semibold px-1.5 py-px rounded mt-0.5 inline-block"
                            style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary)' }}>
                            {c.nicho}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>

                    {c.descricao && (
                      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--t-text-secondary)' }}>{c.descricao}</p>
                    )}

                    {/* Plano e valores */}
                    {(c.plano_alvo || c.mensalidade || c.valor_setup) && (
                      <div className="rounded-lg p-2.5 mb-3 space-y-1"
                        style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                        {c.plano_alvo && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--t-text-muted)' }}>
                              <Package size={9} /> Plano alvo
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: 'var(--t-text-primary)' }}>{c.plano_alvo}</span>
                          </div>
                        )}
                        {c.mensalidade != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--t-text-muted)' }}>
                              <DollarSign size={9} /> Mensalidade
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>{fmtBRL(c.mensalidade)}/mês</span>
                          </div>
                        )}
                        {c.valor_setup != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--t-text-muted)' }}>
                              <DollarSign size={9} /> Setup
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: 'var(--t-primary)' }}>
                              {fmtBRL(c.valor_setup)}{c.setup_condicao ? ` · ${c.setup_condicao}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metas */}
                    {(c.meta_contratos || c.meta_receita) && (
                      <div className="rounded-lg p-2.5 mb-3 space-y-1"
                        style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.20)' }}>
                        {c.meta_contratos && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#16a34a' }}>
                              <Target size={9} /> Meta contratos
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>{c.meta_contratos} fechamentos</span>
                          </div>
                        )}
                        {c.meta_receita && (
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#16a34a' }}>
                              <TrendingUp size={9} /> Meta receita
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>{fmtBRL(c.meta_receita)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Condição especial */}
                    {c.condicao_especial && (
                      <div className="rounded-lg px-2.5 py-1.5 mb-3"
                        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.20)' }}>
                        <p className="text-[10px] font-bold mb-0.5" style={{ color: '#7c3aed' }}>Condição especial</p>
                        <p className="text-[11px]" style={{ color: '#7c3aed' }}>{c.condicao_especial}</p>
                      </div>
                    )}

                    {/* Datas e contadores */}
                    <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                      <div className="flex items-center gap-1">
                        <Calendar size={9} />
                        <span>{fmtDate(c.data_inicio)} → {fmtDate(c.data_fim)}</span>
                      </div>
                      <span>{c._count?.disparos || 0} disparos · {c._count?.acoes || 0} ações</span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}
                    onClick={e => e.stopPropagation()}>
                    {podeGerenciar && (
                      <select value={c.status} onChange={e => { e.stopPropagation(); handleChangeStatus(c.id, e.target.value); }}
                        className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                        style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    )}
                    {podeGerenciar && (
                      <button onClick={e => { e.stopPropagation(); openEdit(c); }}
                        className="h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1"
                        style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)', background: 'var(--t-card-bg)' }}>
                        <Edit3 size={10} /> Editar
                      </button>
                    )}
                    {podeGerenciar && (
                      confirmDelete === c.id ? (
                        <div className="flex gap-1">
                          <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                            className="h-7 px-2 rounded-lg text-xs font-bold text-white" style={{ background: '#dc2626' }}>
                            Sim
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                            className="h-7 px-2 rounded-lg text-xs" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                            Não
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(c.id); }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg"
                          style={{ border: '1px solid #fca5a5', color: '#dc2626', background: '#fee2e2' }}>
                          <Trash2 size={10} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL Ver Campanha Completa ── */}
      {viewingCampanha && (() => {
        const c = viewingCampanha;
        const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.RASCUNHO;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(13,34,56,.55)' }}
            onClick={() => setViewingCampanha(null)}>
            <div className="rounded-2xl shadow-2xl w-full overflow-y-auto"
              style={{ maxWidth: 640, maxHeight: '92vh', background: 'var(--t-card-bg)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-6 py-5" style={{ borderBottom: '4px solid ' + cfg.color, background: 'var(--t-primary-light)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--t-text-primary)' }}>{c.nome}</h2>
                    {c.nicho && (
                      <span className="text-xs font-semibold mt-1 inline-block" style={{ color: 'var(--t-primary)' }}>{c.nicho}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {podeGerenciar && (
                      <button onClick={() => { setViewingCampanha(null); openEdit(c); }}
                        className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)', background: 'var(--t-card-bg)' }}>
                        <Edit3 size={11} /> Editar
                      </button>
                    )}
                    <button onClick={() => setViewingCampanha(null)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg"
                      style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'var(--t-card-bg)' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* Descrição */}
                {c.descricao && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--t-text-muted)' }}>Objetivo / Descrição</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--t-text-primary)' }}>{c.descricao}</p>
                  </div>
                )}

                {/* Período */}
                <div className="rounded-xl p-4" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--t-text-muted)' }}>
                    <Calendar size={11} /> Período
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                      <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--t-text-muted)' }}>Início</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--t-primary)' }}>{fmtDate(c.data_inicio)}</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--t-text-muted)' }}>→</span>
                    <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                      <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--t-text-muted)' }}>Fim</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--t-primary)' }}>{fmtDate(c.data_fim)}</p>
                    </div>
                  </div>
                </div>

                {/* Plano e Valores */}
                {(c.plano_alvo || c.mensalidade != null || c.valor_setup != null || c.setup_condicao) && (
                  <div className="rounded-xl p-4" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--t-text-muted)' }}>
                      <Package size={11} /> Plano e Valores
                    </p>
                    <div className="space-y-2">
                      {c.plano_alvo && (
                        <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                          <span className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>Plano alvo</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{c.plano_alvo}</span>
                        </div>
                      )}
                      {c.mensalidade != null && (
                        <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                          <span className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>Mensalidade</span>
                          <span className="text-sm font-bold" style={{ color: '#16a34a' }}>{fmtBRL(c.mensalidade)}/mês</span>
                        </div>
                      )}
                      {c.valor_setup != null && (
                        <div className="flex justify-between items-center py-1.5" style={{ borderBottom: c.setup_condicao ? '1px solid var(--t-card-border)' : 'none' }}>
                          <span className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>Setup / Implantação</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--t-primary)' }}>{fmtBRL(c.valor_setup)}</span>
                        </div>
                      )}
                      {c.setup_condicao && (
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>Parcelamento do setup</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{c.setup_condicao}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Condição especial */}
                {c.condicao_especial && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#7c3aed' }}>Condição especial desta campanha</p>
                    <p className="text-sm font-semibold leading-relaxed" style={{ color: '#7c3aed' }}>{c.condicao_especial}</p>
                  </div>
                )}

                {/* Metas */}
                {(c.meta_contratos || c.meta_receita) && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.20)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#16a34a' }}>
                      <Target size={11} /> Metas
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {c.meta_contratos && (
                        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)' }}>
                          <p className="text-[10px] font-semibold mb-1" style={{ color: '#16a34a' }}>Contratos fechados</p>
                          <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{c.meta_contratos}</p>
                        </div>
                      )}
                      {c.meta_receita && (
                        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)' }}>
                          <p className="text-[10px] font-semibold mb-1" style={{ color: '#16a34a' }}>Meta de receita (MRR)</p>
                          <p className="text-xl font-bold" style={{ color: '#16a34a' }}>{fmtBRL(c.meta_receita)}</p>
                        </div>
                      )}
                    </div>
                    {c.meta_contratos && c.mensalidade && (
                      <p className="text-xs font-semibold mt-3 text-center" style={{ color: '#16a34a' }}>
                        MRR potencial: {fmtBRL(c.meta_contratos * c.mensalidade)}/mês
                      </p>
                    )}
                  </div>
                )}

                {/* Resultados */}
                <div className="rounded-xl p-4" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--t-text-muted)' }}>
                    <BarChart2 size={11} /> Resultados
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3 text-center" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                      <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Disparos</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--t-primary)' }}>{c._count?.disparos || 0}</p>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                      <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Ações</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--t-primary)' }}>{c._count?.acoes || 0}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="flex justify-end px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                <button onClick={() => setViewingCampanha(null)}
                  className="h-9 px-5 rounded-lg text-xs font-semibold"
                  style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL Nova / Editar Campanha ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(13,34,56,.55)' }}
          onClick={() => setShowModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full overflow-y-auto"
            style={{ maxWidth: 620, maxHeight: '92vh', background: 'var(--t-card-bg)' }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>
                {editingId ? 'Editar Campanha' : 'Nova Campanha'}
              </h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 flex items-center justify-center rounded-lg"
                style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {/* Seção: Identificação */}
              <Section label="Identificação" icon={Megaphone}>
                <Field label="Nome da campanha *">
                  <input value={form.nome} onChange={e => setF('nome', e.target.value)}
                    placeholder="Ex: Padarias — Julho 2026"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </Field>
                <Field label="Descrição / Objetivo">
                  <textarea value={form.descricao} onChange={e => setF('descricao', e.target.value)} rows={2}
                    placeholder="Qual o objetivo desta campanha?"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </Field>
                <Field label="Nicho / Segmento alvo">
                  <select value={form.nicho} onChange={e => setF('nicho', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecione o nicho...</option>
                    {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data início *">
                    <input type="datetime-local" value={form.data_inicio} onChange={e => setF('data_inicio', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                  <Field label="Data fim *">
                    <input type="datetime-local" value={form.data_fim} onChange={e => setF('data_fim', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                </div>
              </Section>

              {/* Seção: Plano e Valores */}
              <Section label="Plano e Valores" icon={Package}>
                <Field label="Plano alvo">
                  <select value={form.plano_alvo} onChange={e => {
                    const plano = PLANOS.find(p => p.label === e.target.value);
                    setForm(f => ({
                      ...f,
                      plano_alvo: e.target.value,
                      mensalidade: plano?.mensalidade || f.mensalidade,
                      valor_setup: plano?.setup || f.valor_setup,
                    }));
                  }}
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecione o plano...</option>
                    {PLANOS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mensalidade (R$)">
                    <input type="number" min={0} step={0.01} value={form.mensalidade}
                      onChange={e => setF('mensalidade', e.target.value)}
                      placeholder="Ex: 180,00"
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                  <Field label="Setup (R$)">
                    <input type="number" min={0} step={0.01} value={form.valor_setup}
                      onChange={e => setF('valor_setup', e.target.value)}
                      placeholder="Ex: 500,00"
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                </div>
                <Field label="Condição de setup (parcelamento / entrada)">
                  <input value={form.setup_condicao} onChange={e => setF('setup_condicao', e.target.value)}
                    placeholder="Ex: 3x de R$ 166,67 · ou Entrada + 2x · ou À vista"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </Field>
                <Field label="Condição especial desta campanha">
                  <input value={form.condicao_especial} onChange={e => setF('condicao_especial', e.target.value)}
                    placeholder="Ex: Setup grátis · 1ª mensalidade grátis · Desconto 10%"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </Field>
              </Section>

              {/* Seção: Metas */}
              <Section label="Metas da Campanha" icon={Target}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Meta de contratos fechados">
                    <input type="number" min={0} value={form.meta_contratos}
                      onChange={e => setF('meta_contratos', e.target.value)}
                      placeholder="Ex: 10"
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                  <Field label="Meta de receita (MRR) R$">
                    <input type="number" min={0} step={0.01} value={form.meta_receita}
                      onChange={e => setF('meta_receita', e.target.value)}
                      placeholder="Ex: 2000,00"
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </Field>
                </div>
                {form.meta_contratos && form.mensalidade && (
                  <p className="text-[11px] font-semibold" style={{ color: '#16a34a' }}>
                    MRR potencial: {fmtBRL(parseInt(form.meta_contratos) * parseFloat(form.mensalidade))}/mês
                  </p>
                )}
              </Section>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              <button onClick={() => setShowModal(false)}
                className="h-9 px-4 rounded-lg text-xs font-semibold"
                style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.nome}
                className="h-9 px-5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                style={{ background: 'var(--t-primary)' }}>
                {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar campanha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--t-primary-light)', borderBottom: '1px solid var(--t-card-border)' }}>
        <Icon size={13} style={{ color: 'var(--t-primary)' }} />
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>{label}</p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
