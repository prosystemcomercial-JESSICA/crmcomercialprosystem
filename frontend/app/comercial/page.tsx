'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
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
  radar: Radar;
  vendedores: Vendedor[];
  origens: Origem[];
  campanhas: Campanha[];
  temperaturas: TempDist[];
  atividades_tipo: { tipo: string; total: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEMP_CFG: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  MUITO_QUENTE: { color: '#dc2626', bg: '#fef2f2', label: 'Muito Quente', emoji: '⚡' },
  QUENTE:       { color: '#ea580c', bg: '#fff7ed', label: 'Quente',       emoji: '🔥' },
  MORNO:        { color: '#d97706', bg: '#fffbeb', label: 'Morno',        emoji: '🌡️' },
  FRIO:         { color: '#2563eb', bg: '#eff6ff', label: 'Frio',         emoji: '❄️' },
};

const ETAPA_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato',
  EM_ATENDIMENTO: 'Em Atendimento', AGUARDANDO_RETORNO: 'Aguardando Retorno',
  PROPOSTA_A_GERAR: 'Proposta a Gerar', PROPOSTA_ENVIADA: 'Proposta Enviada',
  EM_NEGOCIACAO: 'Em Negociação', FECHADO: 'Fechado', PERDIDO: 'Perdido',
};

const OBS_LABELS: Record<string, string> = {
  LIGACAO: '📞', WHATSAPP: '💬', EMAIL: '✉️', REUNIAO: '🤝',
  TENTATIVA_SEM_RESP: '📵', PEDIU_RETORNO: '🔔', PEDIU_DESCONTO: '💰',
  PEDIU_PROPOSTA: '📄', INFO_IMPORTANTE: '⭐', OBSERVACAO_INTERNA: '🔒',
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
        border: active ? `2px solid ${color}` : '1px solid #e5e7eb',
        background: active ? `${color}10` : 'white',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg" style={{ background: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{count}</p>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {count === 0 ? 'Nenhum alerta' : 'Ver leads →'}
      </p>
    </button>
  );
}

function LeadRow({ lead, subtitle }: { lead: RadarLead; subtitle?: string }) {
  const tc = TEMP_CFG[lead.temperatura] ?? TEMP_CFG.FRIO;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg">{tc.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {lead.nome_fantasia || lead.nome}
          </p>
          <p className="text-xs text-gray-500 truncate">{subtitle || (ETAPA_LABELS[lead.etapa_comercial] ?? lead.etapa_comercial)}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-xs font-medium" style={{ color: tc.color }}>{tc.label}</p>
        <p className="text-xs text-gray-400">{lead.vendedor_nome || 'Sem vendedor'}</p>
      </div>
    </div>
  );
}

function TempBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold" style={{ color }}>{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getDashboardComercial();
      setData(res.data.data);
    } catch {
      setError('Erro ao carregar dados comerciais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
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
    { icon: Target,        title: 'Campanha sem vendedor',    count: radar.totals.campanha_sem_vendedor,color: '#6b7280', leads: radar.campanha_sem_vendedor },
  ];

  const totalAlertas = Object.values(radar.totals).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 size={24} className="text-blue-600" />
              Radar Comercial
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Inteligência comercial — leads, vendedores, origens e campanhas
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total de Leads',  value: fmt(resumo.total_leads),    color: '#2563eb' },
            { label: 'Leads Ativos',    value: fmt(resumo.ativos_total),   color: '#7c3aed' },
            { label: 'Fechados',        value: fmt(resumo.fechados_total), color: '#16a34a' },
            { label: 'Perdidos',        value: fmt(resumo.perdidos_total), color: '#dc2626' },
            { label: 'Taxa Conversão',  value: fmtPct(resumo.taxa_global), color: '#0891b2' },
          ].map(k => (
            <div key={k.label} className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'radar',     label: `⚠️ Radar (${totalAlertas})` },
            { key: 'vendedores',label: `👥 Vendedores (${vendedores.length})` },
            { key: 'origens',   label: `📍 Origens` },
            { key: 'campanhas', label: `📢 Campanhas` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── RADAR TAB ─────────────────────────────────────────────────────── */}
        {tab === 'radar' && (
          <div className="space-y-6">
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
              <div className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  {selectedRadar.title}
                  <span className="ml-auto text-xs text-gray-400">{selectedRadar.leads.length} leads</span>
                </h3>
                <div className="max-h-80 overflow-y-auto">
                  {selectedRadar.leads.map(lead => (
                    <LeadRow
                      key={lead.id}
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
                  ))}
                </div>
              </div>
            )}

            {selectedRadar && selectedRadar.leads.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <p className="text-green-600 font-medium">✅ Nenhum alerta nesta categoria. Tudo em dia!</p>
              </div>
            )}

            {/* Temperature distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Thermometer size={16} className="text-orange-500" />
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
                      label={`${tc.emoji} ${tc.label}`}
                      count={row?.total ?? 0}
                      total={totalLeads}
                      color={color}
                    />
                  );
                })}
              </div>

              <div className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-500" />
                  Atividades por Tipo
                </h3>
                {data.atividades_tipo.slice(0, 8).map(a => (
                  <div key={a.tipo} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <span className="text-sm text-gray-600">
                      {OBS_LABELS[a.tipo] || '•'} {a.tipo.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{fmt(a.total)}</span>
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
              <div className="bg-gray-50 border rounded-xl p-8 text-center text-gray-400">
                Nenhum vendedor com leads cadastrados.
              </div>
            ) : (
              vendedores.map(v => (
                <div key={v.nome} className="bg-white border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-700 font-bold text-sm">
                          {v.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{v.nome}</p>
                        <p className="text-xs text-gray-500">{v.total_leads} leads · {v.leads_mes} este mês</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{fmtPct(v.taxa_conversao)}</p>
                      <p className="text-xs text-gray-500">conversão</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                    {[
                      { label: 'Ativos',      value: v.ativos,            color: '#7c3aed' },
                      { label: 'Fechados',    value: v.fechados,          color: '#16a34a' },
                      { label: 'Perdidos',    value: v.perdidos,          color: '#dc2626' },
                      { label: '⚡ M.Quente', value: v.muito_quente,     color: '#dc2626' },
                      { label: '🔥 Quente',  value: v.quente,            color: '#ea580c' },
                      { label: 'Propostas',   value: v.propostas_geradas, color: '#0891b2' },
                      { label: 'Contatos',    value: v.total_contatos,    color: '#6b7280' },
                    ].map(k => (
                      <div key={k.label} className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">{k.label}</p>
                        <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {(v.mrr_fechado > 0 || v.setup_fechado > 0) && (
                    <div className="flex gap-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-gray-500">MRR Fechado</p>
                        <p className="text-sm font-semibold text-green-600">{fmtR(v.mrr_fechado)}/mês</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Setup Fechado</p>
                        <p className="text-sm font-semibold text-blue-600">{fmtR(v.setup_fechado)}</p>
                      </div>
                    </div>
                  )}

                  {Object.keys(v.obs_by_tipo).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      {Object.entries(v.obs_by_tipo).map(([tipo, total]) => (
                        <span key={tipo} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                          {OBS_LABELS[tipo] || '•'} {tipo.replace(/_/g,' ').toLowerCase()} ({total})
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
          <div className="bg-white border rounded-xl p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-purple-500" />
              Leads por Origem
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
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
                      <tr key={o.origem} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-700">{o.origem}</td>
                        <td className="py-2.5 text-right pr-4">{o.total}</td>
                        <td className="py-2.5 text-right pr-4 text-purple-600">{o.ativos}</td>
                        <td className="py-2.5 text-right pr-4 text-orange-500">
                          {o.quentes}
                          {o.total > 0 && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({Math.round((o.quentes / o.total) * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right pr-4 text-green-600">{o.fechados}</td>
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

            {/* Proportion bars */}
            <div className="mt-6 space-y-2">
              {origens.slice(0, 8).map(o => (
                <TempBar
                  key={o.origem}
                  label={o.origem}
                  count={o.total}
                  total={resumo.total_leads}
                  color="#2563eb"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CAMPANHAS TAB ────────────────────────────────────────────────── */}
        {tab === 'campanhas' && (
          <div className="space-y-4">
            {campanhas.length === 0 ? (
              <div className="bg-gray-50 border rounded-xl p-8 text-center">
                <Megaphone size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400">Nenhuma campanha rastreada ainda.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Os leads vindos de links com UTM preenchem este painel automaticamente.
                </p>
              </div>
            ) : (
              <div className="bg-white border rounded-xl p-5">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Megaphone size={16} className="text-blue-500" />
                  Performance por Campanha
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
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
                          <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2.5 pr-4 font-medium text-gray-700 max-w-[200px]">
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
