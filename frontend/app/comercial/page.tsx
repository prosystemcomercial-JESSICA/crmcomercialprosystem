'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';
import {
  AlertTriangle, Clock, Flame, Snowflake, Thermometer, Zap,
  Users, TrendingUp, RefreshCw, Loader2, MessageSquare,
  Phone, Mail, CalendarX, Target, ChevronRight, BarChart2,
  Megaphone, MapPin,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RadarLead {
  id: string; nome: string; nome_fantasia?: string; segmento?: string;
  temperatura: string; etapa_comercial: string; vendedor_nome?: string;
  created_at?: string; updated_at?: string; ultima_obs_at?: string;
  proximo_contato?: string; origem?: string; utm_source?: string;
  campanha_nome?: string; plataforma?: string;
  horas_sem_contato?: number; dias_parado?: number; dias_sem_followup?: number;
}

interface RadarTotals {
  sem_contato: number; retorno_vencido: number; quentes_sem_proposta: number;
  leads_parados: number; proposta_sem_followup: number; campanha_sem_vendedor: number;
}

interface Radar {
  totals: RadarTotals;
  sem_contato: RadarLead[]; retorno_vencido: RadarLead[];
  quentes_sem_proposta: RadarLead[]; leads_parados: RadarLead[];
  proposta_sem_followup: RadarLead[]; campanha_sem_vendedor: RadarLead[];
}

interface Vendedor {
  nome: string; total_leads: number; leads_mes: number; ativos: number;
  fechados: number; perdidos: number; muito_quente: number; quente: number;
  morno: number; frio: number; taxa_conversao: number;
  total_contatos: number; obs_by_tipo: Record<string, number>;
  propostas_geradas: number; propostas_aceitas: number;
  mrr_fechado: number; setup_fechado: number;
}

interface Origem { origem: string; total: number; fechados: number; ativos: number; quentes: number; }
interface Campanha { campanha: string; plataforma: string; total: number; fechados: number; ativos: number; quentes: number; }
interface TempDist { temperatura: string; total: number; ativos: number; fechados: number; }

interface DashComercial {
  resumo: { total_leads: number; ativos_total: number; fechados_total: number; perdidos_total: number; taxa_global: number };
  servicos?: { upgrades: number; comunicacao: number; pac: number; tef: number; auditoria: number; total: number };
  radar: Radar;
  vendedores: Vendedor[];
  origens: Origem[];
  campanhas: Campanha[];
  temperaturas: TempDist[];
  atividades_tipo: { tipo: string; total: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEMP_CFG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  MUITO_QUENTE: { color: '#dc2626', bg: 'rgba(220,38,38,0.10)',  label: 'Muito Quente', icon: Zap },
  QUENTE:       { color: '#ea580c', bg: 'rgba(234,88,12,0.10)',  label: 'Quente',       icon: Flame },
  MORNO:        { color: '#d97706', bg: 'rgba(217,119,6,0.10)',  label: 'Morno',        icon: Thermometer },
  FRIO:         { color: '#2563eb', bg: 'rgba(37,99,235,0.10)',  label: 'Frio',         icon: Snowflake },
};

const ETAPA_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato',
  EM_ATENDIMENTO: 'Em Atendimento', AGUARDANDO_RETORNO: 'Aguardando Retorno',
  PROPOSTA_A_GERAR: 'Proposta a Gerar', PROPOSTA_ENVIADA: 'Proposta Enviada',
  EM_NEGOCIACAO: 'Em Negociação', FECHADO: 'Fechado', PERDIDO: 'Perdido',
};

const OBS_LABELS: Record<string, string> = {
  LIGACAO: 'Ligação', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', REUNIAO: 'Reunião',
  TENTATIVA_SEM_RESP: 'Sem resposta', PEDIU_RETORNO: 'Retorno', PEDIU_DESCONTO: 'Desconto',
  PEDIU_PROPOSTA: 'Proposta', INFO_IMPORTANTE: 'Info', OBSERVACAO_INTERNA: 'Obs. interna',
};

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtR = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n}%`;
const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const daysAgo = (s?: string | null) => {
  if (!s) return '?';
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return diff === 0 ? 'hoje' : `${diff}d atrás`;
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function RadarCard({
  icon: Icon, title, count, color, leads, onSelect, active,
}: {
  icon: any; title: string; count: number; color: string;
  leads: RadarLead[]; onSelect: (leads: RadarLead[], title: string) => void; active: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(leads, title)}
      className={`text-left rounded-xl p-4 transition-all hover:shadow-md`}
      style={{
        border: active ? `2px solid ${color}` : '1px solid var(--t-card-border)',
        background: active ? `${color}18` : 'var(--t-card-bg)',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg" style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--t-text-secondary)' }}>{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{count}</p>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
        {count === 0 ? 'Nenhum alerta' : 'Ver leads'}
      </p>
    </button>
  );
}

function LeadRow({ lead, subtitle }: { lead: RadarLead; subtitle?: string }) {
  const tc = TEMP_CFG[lead.temperatura] ?? TEMP_CFG.FRIO;
  const TempIcon = tc.icon;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--t-card-border)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: tc.bg }}>
          <TempIcon size={14} style={{ color: tc.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--t-text-primary)' }}>
            {lead.nome_fantasia || lead.nome}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--t-text-secondary)' }}>{subtitle || (ETAPA_LABELS[lead.etapa_comercial] ?? lead.etapa_comercial)}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-xs font-semibold" style={{ color: tc.color }}>{tc.label}</p>
        <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{lead.vendedor_nome || 'Sem vendedor'}</p>
      </div>
    </div>
  );
}

function TempBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--t-text-secondary)' }}>{label}</span>
        <span className="font-semibold" style={{ color }}>{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--t-card-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RadarComercialPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData]       = useState<DashComercial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<'radar' | 'vendedores' | 'origens' | 'campanhas'>('radar');
  const [selectedRadar, setSelectedRadar] = useState<{ leads: RadarLead[]; title: string } | null>(null);

  // Vendedor não vê o comparativo entre vendedores (dado de supervisão).
  const isGestor = podeVerTudo(user?.role);

  // Atribuição de leads (só supervisão). Nome distinto p/ não colidir com
  // o array "vendedores" (métricas por vendedor) que vem do dashboard.
  const [vendedoresLista, setVendedoresLista] = useState<{ id: string; nome: string }[]>([]);
  const [atribuindo, setAtribuindo] = useState(false);
  // Filtro por vendedor (gestor): '' = todos
  const [filtroVendedorId, setFiltroVendedorId] = useState('');
  useEffect(() => {
    if (isGestor) apiClient.getVendedores().then(r => setVendedoresLista(r.data?.data || [])).catch(() => {});
  }, [isGestor]);

  const atribuir = async (leadIds: string[], vendedorId: string) => {
    if (!vendedorId || !leadIds.length) return;
    setAtribuindo(true);
    try { await apiClient.atribuirLeads(leadIds, vendedorId); await load(); setSelectedRadar(null); }
    catch { setError('Erro ao atribuir lead.'); }
    finally { setAtribuindo(false); }
  };
  const distribuirIgual = async (leadIds: string[]) => {
    if (!leadIds.length) return;
    setAtribuindo(true);
    try { await apiClient.distribuirLeads({ lead_ids: leadIds }); await load(); setSelectedRadar(null); }
    catch { setError('Erro ao distribuir leads.'); }
    finally { setAtribuindo(false); }
  };

  // Vendas adicionais / indicações atribuídas ao vendedor (radar dele).
  const [minhasVendas, setMinhasVendas] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDashboardComercial(filtroVendedorId || undefined);
      setData(res.data.data);
    } catch {
      setError('Erro ao carregar dados comerciais.');
    } finally {
      setLoading(false);
    }
  }, [filtroVendedorId]);

  // Carrega as indicações/vendas adicionais (o backend já filtra pelo vendedor
  // logado; gestor vê todas). Mostra no radar p/ o vendedor não perder uma venda
  // atribuída a ele pela gestão.
  useEffect(() => {
    if (!user) return;
    apiClient.getVendasAdicionais({})
      .then(r => setMinhasVendas(r.data?.data?.vendas || []))
      .catch(() => setMinhasVendas([]));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');  // login fica na raiz, não existe /login
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-red-500">{error || 'Sem dados.'}</div>
      </DashboardLayout>
    );
  }

  const { resumo, radar, vendedores, origens, campanhas, temperaturas } = data;
  const totalLeads = resumo.total_leads || 1;

  const radarAlerts = [
    { icon: Clock,         title: 'Novo lead sem contato',    count: radar.totals.sem_contato,          color: '#f59e0b', leads: radar.sem_contato },
    { icon: CalendarX,     title: 'Retorno vencido',          count: radar.totals.retorno_vencido,      color: '#dc2626', leads: radar.retorno_vencido },
    { icon: Flame,         title: 'Quente sem proposta',      count: radar.totals.quentes_sem_proposta, color: '#ea580c', leads: radar.quentes_sem_proposta },
    { icon: AlertTriangle, title: 'Parado > 7 dias',          count: radar.totals.leads_parados,        color: '#7c3aed', leads: radar.leads_parados },
    { icon: MessageSquare, title: 'Proposta sem follow-up',   count: radar.totals.proposta_sem_followup,color: '#0891b2', leads: radar.proposta_sem_followup },
    { icon: Target,        title: 'Campanha sem vendedor',    count: radar.totals.campanha_sem_vendedor,color: 'var(--t-text-muted)', leads: radar.campanha_sem_vendedor },
  ];

  const totalAlertas = Object.values(radar.totals).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--t-text-primary)', letterSpacing: '-0.02em' }}>
              <BarChart2 size={22} style={{ color: 'var(--t-primary)' }} />
              Radar Comercial
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
              {isGestor
                ? 'Inteligência comercial — leads, vendedores, origens e campanhas'
                : 'Seus leads e atividades — o que precisa de ação agora'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro por vendedor (só gestão) */}
            {isGestor && vendedoresLista.length > 0 && (
              <select
                value={filtroVendedorId}
                onChange={e => setFiltroVendedorId(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg" style={{ background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', borderColor: 'var(--t-card-border)' } as any}
                title="Filtrar por vendedor"
              >
                <option value="">Todos os vendedores</option>
                {vendedoresLista.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            {isGestor && (
              <ExportButton
                nome="radar-vendedores" titulo="Radar Comercial — Desempenho por vendedor"
                linhas={vendedores}
                colunas={[
                  { header: 'Vendedor', value: (v: any) => v.nome },
                  { header: 'Total leads', value: (v: any) => v.total_leads },
                  { header: 'Leads no mês', value: (v: any) => v.leads_mes },
                  { header: 'Ativos', value: (v: any) => v.ativos },
                  { header: 'Fechados', value: (v: any) => v.fechados },
                  { header: 'Perdidos', value: (v: any) => v.perdidos },
                  { header: 'Taxa conversão (%)', value: (v: any) => v.taxa_conversao },
                  { header: 'Propostas geradas', value: (v: any) => v.propostas_geradas },
                  { header: 'Propostas aceitas', value: (v: any) => v.propostas_aceitas },
                  { header: 'MRR fechado (R$)', value: (v: any) => v.mrr_fechado },
                  { header: 'Setup fechado (R$)', value: (v: any) => v.setup_fechado },
                ]}
              />
            )}
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors"
              style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Destaque: NOVOS LEADS — o que precisa de ação agora */}
        <button
          onClick={() => { setTab('radar'); if (radar.sem_contato?.length) setSelectedRadar({ leads: radar.sem_contato, title: 'Novos leads sem contato' }); }}
          className="w-full text-left rounded-2xl p-5 border-2 transition-all hover:shadow-md"
          style={{ borderColor: '#d97706', background: 'linear-gradient(90deg, rgba(217,119,6,0.06) 0%, var(--t-card-bg) 60%)' }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.12)' }}>
                <Clock size={24} style={{ color: '#d97706' }} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-secondary)' }}>Novos leads para atender</p>
                <p className="text-3xl font-extrabold leading-none mt-1" style={{ color: 'var(--t-text-primary)' }}>
                  {radar.totals.sem_contato}
                  <span className="text-base font-medium" style={{ color: 'var(--t-text-muted)' }}> aguardando primeiro contato</span>
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div><p className="text-2xl font-bold" style={{ color: '#ea580c' }}>{radar.totals.quentes_sem_proposta}</p><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Quentes s/ proposta</p></div>
              <div><p className="text-2xl font-bold" style={{ color: '#dc2626' }}>{radar.totals.retorno_vencido}</p><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Retornos vencidos</p></div>
            </div>
          </div>
        </button>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total de Leads',  value: fmt(resumo.total_leads),    color: 'var(--t-primary-dark)' },
            { label: 'Leads Ativos',    value: fmt(resumo.ativos_total),   color: '#7c3aed' },
            { label: 'Fechados',        value: fmt(resumo.fechados_total), color: '#16a34a' },
            { label: 'Perdidos',        value: fmt(resumo.perdidos_total), color: '#dc2626' },
            { label: 'Taxa Conversão',  value: fmtPct(resumo.taxa_global), color: '#0891b2' },
          ].map(k => (
            <div key={k.label} className="ps-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-secondary)' }}>{k.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--t-card-border)' }}>
          {[
            { key: 'radar',     label: `Radar (${totalAlertas})` },
            ...(isGestor ? [{ key: 'vendedores', label: `Vendedores (${vendedores.length})` }] : []),
            { key: 'origens',   label: 'Origens' },
            { key: 'campanhas', label: 'Campanhas' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
              style={tab === t.key
                ? { background: 'var(--t-card-bg)', boxShadow: '0 1px 4px rgba(0,0,0,.08)', color: 'var(--t-primary-dark)' }
                : { background: 'transparent', color: 'var(--t-text-secondary)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── RADAR TAB ─────────────────────────────────────────────────────── */}
        {tab === 'radar' && (
          <div className="space-y-6">
            {/* Minhas indicações / vendas adicionais — atribuídas a mim (ou todas, p/ gestão) */}
            {minhasVendas.length > 0 && (
              <div className="rounded-xl border p-4" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-emerald-800">🤝 Minhas indicações / vendas adicionais ({minhasVendas.length})</p>
                  <a href="/indicacoes" className="text-xs text-emerald-700 hover:underline">Ver todas →</a>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-auto">
                  {minhasVendas.slice(0, 8).map((v: any) => {
                    const cfg: Record<string, { l: string; c: string }> = {
                      PENDENTE: { l: 'Pendente', c: '#d97706' }, CONFIRMADA: { l: 'Confirmada', c: '#2563eb' },
                      PAGA: { l: 'Paga', c: '#16a34a' }, CANCELADO: { l: 'Cancelada', c: '#9ca3af' },
                    };
                    const st = cfg[v.status] || cfg.PENDENTE;
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 border" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-primary-border)' }}>
                        <div className="min-w-0">
                          <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.parceiro?.nome || 'Venda adicional'}</span>
                          <span style={{ color: 'var(--t-text-muted)' }}> · </span>
                          <span className="truncate" style={{ color: 'var(--t-text-secondary)' }}>{v.cliente?.razao_social || v.cliente?.nome || v.cliente?.empresa || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>R$ {Number(v.comissao_valor || 0).toLocaleString('pt-BR')}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.c + '20', color: st.c }}>{st.l}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Serviços complementares vendidos no mês (indicadores do plano) */}
            {data.servicos && data.servicos.total > 0 && (
              <div className="ps-card rounded-xl p-4">
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--t-primary-deep)' }}>Serviços complementares no mês</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    ['Upgrades', data.servicos.upgrades, 'var(--t-primary-dark)'],
                    ['Comunicação (lojas)', data.servicos.comunicacao, '#0d9488'],
                    ['PAC', data.servicos.pac, '#7c3aed'],
                    ['TEF', data.servicos.tef, '#d97706'],
                    ['Auditoria Trib.', data.servicos.auditoria, '#16a34a'],
                  ].map(([label, val, cor]) => (
                    <div key={label as string} className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--t-card-border)' }}>
                      <p className="text-2xl font-extrabold" style={{ color: cor as string }}>{val as number}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alert cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {radarAlerts.map(a => (
                <RadarCard
                  key={a.title}
                  icon={a.icon}
                  title={a.title}
                  count={a.count}
                  color={a.color}
                  leads={a.leads}
                  onSelect={(leads, title) =>
                    setSelectedRadar(prev => prev?.title === title ? null : { leads, title })
                  }
                  active={selectedRadar?.title === a.title}
                />
              ))}
            </div>

            {/* Lead list for selected alert */}
            {selectedRadar && selectedRadar.leads.length > 0 && (
              <div className="ps-card rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                  <AlertTriangle size={16} style={{ color: '#d97706' }} />
                  {selectedRadar.title}
                  <span className="ml-auto text-xs" style={{ color: 'var(--t-text-muted)' }}>{selectedRadar.leads.length} leads</span>
                </h3>

                {/* Supervisão: distribuir todos igualmente entre os vendedores */}
                {isGestor && vendedoresLista.length > 0 && (
                  <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="text-xs text-blue-700">Atribuir estes leads aos vendedores</span>
                    <button
                      onClick={() => distribuirIgual(selectedRadar.leads.map(l => l.id))}
                      disabled={atribuindo}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    >
                      {atribuindo ? 'Distribuindo...' : '⚖️ Distribuir igualmente'}
                    </button>
                  </div>
                )}

                <div className="max-h-80 overflow-y-auto">
                  {selectedRadar.leads.map(lead => (
                    <div key={lead.id} className="flex items-center gap-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <LeadRow
                          lead={lead}
                          subtitle={
                            lead.proximo_contato
                              ? `Retorno era ${fmtDate(lead.proximo_contato)}`
                              : lead.dias_parado
                              ? `Parado ${Math.floor(Number(lead.dias_parado))}d`
                              : lead.horas_sem_contato
                              ? `${Math.floor(Number(lead.horas_sem_contato))}h sem contato`
                              : undefined
                          }
                        />
                      </div>
                      {isGestor && vendedoresLista.length > 0 && (
                        <select
                          defaultValue=""
                          disabled={atribuindo}
                          onChange={e => { if (e.target.value) atribuir([lead.id], e.target.value); }}
                          className="text-xs border rounded-lg px-2 py-1.5 shrink-0"
                          style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
                          title="Atribuir a um vendedor"
                        >
                          <option value="">Atribuir a…</option>
                          {vendedoresLista.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRadar && selectedRadar.leads.length === 0 && (
              <div className="rounded-xl p-6 text-center border" style={{ background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.25)' }}>
                <p className="font-medium" style={{ color: '#16a34a' }}>Nenhum alerta nesta categoria — tudo em dia.</p>
              </div>
            )}

            {/* Temperature distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="ps-card rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                  <Thermometer size={16} style={{ color: '#ea580c' }} />
                  Distribuição por Temperatura
                </h3>
                {[
                  { temp: 'MUITO_QUENTE', color: '#dc2626' },
                  { temp: 'QUENTE',       color: '#ea580c' },
                  { temp: 'MORNO',        color: '#d97706' },
                  { temp: 'FRIO',         color: '#2563eb' },
                ].map(({ temp, color }) => {
                  const row = temperaturas.find(t => t.temperatura === temp);
                  const tc  = TEMP_CFG[temp];
                  return (
                    <TempBar
                      key={temp}
                      label={tc.label}
                      count={row?.total ?? 0}
                      total={totalLeads}
                      color={color}
                    />
                  );
                })}
              </div>

              <div className="ps-card rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                  <MessageSquare size={16} style={{ color: 'var(--t-primary)' }} />
                  Atividades por Tipo
                </h3>
                {data.atividades_tipo.slice(0, 8).map(a => (
                  <div key={a.tipo} className="flex justify-between items-center py-1.5 border-b last:border-0" style={{ borderColor: 'var(--t-card-border)' }}>
                    <span className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>
                      {OBS_LABELS[a.tipo] || a.tipo.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{fmt(a.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VENDEDORES TAB ───────────────────────────────────────────────── */}
        {tab === 'vendedores' && (
          <div className="space-y-4">
            {vendedores.length === 0 ? (
              <div className="ps-card rounded-xl p-8 text-center" style={{ color: 'var(--t-text-muted)' }}>
                Nenhum vendedor com leads cadastrados.
              </div>
            ) : (
              vendedores.map(v => (
                <div key={v.nome} className="ps-card rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-primary-border)' }}>
                        <span className="font-bold text-sm" style={{ color: 'var(--t-primary-dark)' }}>
                          {v.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{v.nome}</p>
                        <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{v.total_leads} leads · {v.leads_mes} este mês</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{fmtPct(v.taxa_conversao)}</p>
                      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>conversão</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                    {[
                      { label: 'Ativos',      value: v.ativos,            color: '#7c3aed' },
                      { label: 'Fechados',    value: v.fechados,          color: '#16a34a' },
                      { label: 'Perdidos',    value: v.perdidos,          color: '#dc2626' },
                      { label: 'M.Quente',    value: v.muito_quente,     color: '#dc2626' },
                      { label: 'Quente',      value: v.quente,            color: '#ea580c' },
                      { label: 'Propostas',   value: v.propostas_geradas, color: '#0891b2' },
                      { label: 'Contatos',    value: v.total_contatos,    color: 'var(--t-text-muted)' },
                    ].map(k => (
                      <div key={k.label} className="text-center p-2 rounded-lg" style={{ background: 'var(--t-primary-light)' }}>
                        <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>{k.label}</p>
                        <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {(v.mrr_fechado > 0 || v.setup_fechado > 0) && (
                    <div className="flex gap-4 pt-3 border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>MRR Fechado</p>
                        <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>{fmtR(v.mrr_fechado)}/mês</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Setup Fechado</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--t-primary-dark)' }}>{fmtR(v.setup_fechado)}</p>
                      </div>
                    </div>
                  )}

                  {Object.keys(v.obs_by_tipo).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                      {Object.entries(v.obs_by_tipo).map(([tipo, total]) => (
                        <span key={tipo} className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary-dark)', border: '1px solid var(--t-primary-border)' }}>
                          {OBS_LABELS[tipo] || tipo.replace(/_/g,' ').toLowerCase()} ({total as number})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ORIGENS TAB ──────────────────────────────────────────────────── */}
        {tab === 'origens' && (
          <div className="ps-card rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
              <MapPin size={16} style={{ color: '#7c3aed' }} />
              Leads por Origem
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                    <th className="pb-2 pr-4">Origem</th>
                    <th className="pb-2 text-right pr-4">Total</th>
                    <th className="pb-2 text-right pr-4">Ativos</th>
                    <th className="pb-2 text-right pr-4">Quentes</th>
                    <th className="pb-2 text-right pr-4">Fechados</th>
                    <th className="pb-2 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {origens.map(o => {
                    const taxa = o.total > 0 ? Math.round((o.fechados / o.total) * 100) : 0;
                    return (
                      <tr key={o.origem} className="border-b last:border-0 transition-colors" style={{ borderColor: 'var(--t-card-border)' }}>
                        <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--t-text-primary)' }}>{o.origem}</td>
                        <td className="py-2.5 text-right pr-4" style={{ color: 'var(--t-text-secondary)' }}>{o.total}</td>
                        <td className="py-2.5 text-right pr-4" style={{ color: '#7c3aed' }}>{o.ativos}</td>
                        <td className="py-2.5 text-right pr-4" style={{ color: '#ea580c' }}>
                          {o.quentes}
                          {o.total > 0 && (
                            <span className="text-xs ml-1" style={{ color: 'var(--t-text-muted)' }}>
                              ({Math.round((o.quentes / o.total) * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right pr-4" style={{ color: '#16a34a' }}>{o.fechados}</td>
                        <td className="py-2.5 text-right">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: taxa >= 20 ? 'rgba(22,163,74,0.12)' : taxa >= 10 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.12)',
                              color:      taxa >= 20 ? '#15803d' : taxa >= 10 ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {taxa}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Proportion bars */}
            <div className="mt-6 space-y-2">
              {origens.slice(0, 8).map(o => (
                <TempBar
                  key={o.origem}
                  label={o.origem}
                  count={o.total}
                  total={resumo.total_leads}
                  color="var(--t-primary-dark)"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CAMPANHAS TAB ────────────────────────────────────────────────── */}
        {tab === 'campanhas' && (
          <div className="space-y-4">
            {campanhas.length === 0 ? (
              <div className="ps-card rounded-xl p-8 text-center">
                <Megaphone size={32} className="mx-auto mb-2" style={{ color: 'var(--t-text-muted)', opacity: 0.5 }} />
                <p style={{ color: 'var(--t-text-muted)' }}>Nenhuma campanha rastreada ainda.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>
                  Leads de links com UTM aparecem aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="ps-card border rounded-xl p-5">
                <h3 className="font-semibold  mb-4 flex items-center gap-2">
                  <Megaphone size={16} className="text-blue-500" />
                  Performance por Campanha
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs ">
                        <th className="pb-2 pr-4">Campanha</th>
                        <th className="pb-2 pr-4">Plataforma</th>
                        <th className="pb-2 text-right pr-4">Total</th>
                        <th className="pb-2 text-right pr-4">Ativos</th>
                        <th className="pb-2 text-right pr-4">Quentes</th>
                        <th className="pb-2 text-right pr-4">Fechados</th>
                        <th className="pb-2 text-right">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanhas.map((c, i) => {
                        const taxa = c.total > 0 ? Math.round((c.fechados / c.total) * 100) : 0;
                        return (
                          <tr key={i} className="border-b last:border-0 hover:opacity-80">
                            <td className="py-2.5 pr-4 font-medium  max-w-[200px]">
                              <span className="truncate block">{c.campanha}</span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                                {c.plataforma}
                              </span>
                            </td>
                            <td className="py-2.5 text-right pr-4">{c.total}</td>
                            <td className="py-2.5 text-right pr-4 text-purple-600">{c.ativos}</td>
                            <td className="py-2.5 text-right pr-4 text-orange-500">{c.quentes}</td>
                            <td className="py-2.5 text-right pr-4 text-green-600">{c.fechados}</td>
                            <td className="py-2.5 text-right">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  background: taxa >= 20 ? '#dcfce7' : taxa >= 10 ? '#fef9c3' : '#fee2e2',
                                  color:      taxa >= 20 ? '#166534' : taxa >= 10 ? '#854d0e' : '#991b1b',
                                }}
                              >
                                {taxa}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 space-y-2">
                  {campanhas.slice(0, 6).map((c, i) => (
                    <TempBar key={i} label={c.campanha} count={c.total} total={resumo.total_leads} color="#7c3aed" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
