'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  Headphones,
  Wrench,
  FileText,
  Briefcase,
  Coins,
  BookOpen,
  X,
  Loader2,
  Clock,
} from 'lucide-react';

interface Ticket {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
  resolucao_at?: string;
  sla_horas?: number;
  cliente: { id: string; nome: string; empresa?: string };
  licenca?: { plano?: { nome: string } };
}

const PRIORIDADE_COLOR: Record<string, React.CSSProperties> = {
  BAIXA: { background: 'rgba(148,163,184,0.12)', color: 'var(--t-text-muted)' },
  MEDIA: { background: 'rgba(75,142,200,0.12)', color: 'var(--t-primary)' },
  ALTA:  { background: 'rgba(234,88,12,0.10)',  color: '#ea580c' },
  CRITICA:{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' },
};

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  ABERTO:             { background: 'rgba(234,179,8,0.12)',   color: '#a16207' },
  EM_ATENDIMENTO:     { background: 'rgba(75,142,200,0.12)', color: 'var(--t-primary)' },
  AGUARDANDO_CLIENTE: { background: 'rgba(147,51,234,0.10)', color: '#7e22ce' },
  RESOLVIDO:          { background: 'rgba(22,163,74,0.10)',  color: '#15803d' },
  FECHADO:            { background: 'rgba(148,163,184,0.12)', color: 'var(--t-text-muted)' },
};

function CategoriaIcon({ categoria, size = 14 }: { categoria: string; size?: number }) {
  const props = { size, style: { color: 'var(--t-text-secondary)' } };
  switch (categoria) {
    case 'TECNICO':     return <Wrench {...props} />;
    case 'FISCAL':      return <FileText {...props} />;
    case 'COMERCIAL':   return <Briefcase {...props} />;
    case 'FINANCEIRO':  return <Coins {...props} />;
    case 'TREINAMENTO': return <BookOpen {...props} />;
    default:            return <Wrench {...props} />;
  }
}

const STATS_STYLE: Record<string, { card: React.CSSProperties; value: React.CSSProperties }> = {
  ABERTO:             { card: { background: 'rgba(234,179,8,0.08)' },   value: { color: '#a16207' } },
  EM_ATENDIMENTO:     { card: { background: 'rgba(75,142,200,0.08)' },  value: { color: 'var(--t-primary)' } },
  AGUARDANDO_CLIENTE: { card: { background: 'rgba(147,51,234,0.08)' },  value: { color: '#7e22ce' } },
  RESOLVIDO:          { card: { background: 'rgba(22,163,74,0.08)' },   value: { color: '#15803d' } },
  FECHADO:            { card: { background: 'rgba(148,163,184,0.08)' }, value: { color: 'var(--t-text-muted)' } },
};

export default function SuportePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    if (prioFilter) params.prioridade = prioFilter;
    apiClient.getTickets(params)
      .then(res => {
        setTickets(res.data.data.tickets);
        setTotal(res.data.data.total);
        setStatsData(res.data.data.stats || []);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter, prioFilter]);

  const openCreate = async () => {
    const cls = await apiClient.getClientes();
    setClientes(cls.data.data.clientes || []);
    setForm({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.sla_horas) payload.sla_horas = parseInt(payload.sla_horas);
      else delete payload.sla_horas;
      await apiClient.createTicket(payload);
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateTicket(id, { status });
    loadData();
  };

  const tempoAberto = (dt: string) => {
    const h = Math.floor((Date.now() - new Date(dt).getTime()) / 3600000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const statsCount = (status: string) => {
    const s = statsData.find((x: any) => x.status === status);
    return s ? s._count.id : 0;
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--t-primary)' }} />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--t-card-border)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--t-card-bg)',
    color: 'var(--t-text-primary)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--t-text-secondary)',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--t-text-primary)', margin: 0 }}>
              Suporte Técnico
            </h1>
            <p style={{ color: 'var(--t-text-muted)', marginTop: '4px', fontSize: '14px' }}>
              Tickets de suporte e atendimento ao cliente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="suporte-tickets" titulo="Suporte Técnico — Tickets"
              linhas={tickets}
              colunas={[
                { header: 'Título', value: (t: Ticket) => t.titulo },
                { header: 'Cliente', value: (t: Ticket) => t.cliente?.nome || '' },
                { header: 'Empresa', value: (t: Ticket) => t.cliente?.empresa || '' },
                { header: 'Categoria', value: (t: Ticket) => t.categoria },
                { header: 'Prioridade', value: (t: Ticket) => t.prioridade },
                { header: 'Status', value: (t: Ticket) => t.status },
                { header: 'Aberto em', value: (t: Ticket) => t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '' },
                { header: 'Resolvido em', value: (t: Ticket) => t.resolucao_at ? new Date(t.resolucao_at).toLocaleString('pt-BR') : '' },
              ]}
            />
            <button
              onClick={openCreate}
              style={{
                padding: '8px 16px',
                background: 'var(--t-primary)',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Abrir Ticket
            </button>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Abertos',            status: 'ABERTO' },
            { label: 'Em Atendimento',     status: 'EM_ATENDIMENTO' },
            { label: 'Aguardando Cliente', status: 'AGUARDANDO_CLIENTE' },
            { label: 'Resolvidos',         status: 'RESOLVIDO' },
            { label: 'Fechados',           status: 'FECHADO' },
          ].map(c => (
            <div key={c.status} style={{ ...STATS_STYLE[c.status].card, borderRadius: '12px', padding: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--t-text-muted)', margin: 0 }}>{c.label}</p>
              <p style={{ ...STATS_STYLE[c.status].value, fontSize: '1.5rem', fontWeight: 700, marginTop: '2px' }}>
                {statsCount(c.status)}
              </p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1">
            {['', 'ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO', 'FECHADO'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: statusFilter === s ? 'none' : '1px solid var(--t-card-border)',
                  background: statusFilter === s ? 'var(--t-primary)' : 'var(--t-card-bg)',
                  color: statusFilter === s ? '#fff' : 'var(--t-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {s === '' ? 'Todos' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['', 'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'].map(p => (
              <button
                key={p}
                onClick={() => setPrioFilter(p)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: prioFilter === p ? 'none' : '1px solid var(--t-card-border)',
                  background: prioFilter === p ? '#dc2626' : 'var(--t-card-bg)',
                  color: prioFilter === p ? '#fff' : 'var(--t-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {p === '' ? 'Todas prioridades' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div
          className="ps-card"
          style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--t-card-border)' }}
        >
          {dataLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t-text-muted)' }}>
              Carregando...
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <Headphones size={40} style={{ color: 'var(--t-text-muted)' }} />
              </div>
              <p style={{ color: 'var(--t-text-muted)', margin: 0 }}>Nenhum ticket encontrado</p>
            </div>
          ) : (
            <table className="w-full">
              <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                <tr>
                  {['Ticket', 'Cliente', 'Categoria', 'Prioridade', 'Tempo', 'Status'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 20px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--t-text-muted)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, idx) => (
                  <tr
                    key={ticket.id}
                    style={{
                      borderTop: idx > 0 ? '1px solid var(--t-card-border)' : 'none',
                      background: 'var(--t-card-bg)',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <p style={{ fontWeight: 500, color: 'var(--t-text-primary)', margin: 0 }}>{ticket.titulo}</p>
                      {ticket.descricao && (
                        <p style={{ fontSize: '12px', color: 'var(--t-text-muted)', margin: '2px 0 0', maxWidth: '256px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.descricao}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <p style={{ fontSize: '14px', color: 'var(--t-text-primary)', margin: 0 }}>{ticket.cliente.nome}</p>
                      {ticket.cliente.empresa && (
                        <p style={{ fontSize: '12px', color: 'var(--t-text-muted)', margin: '2px 0 0' }}>{ticket.cliente.empresa}</p>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--t-text-secondary)' }}>
                        <CategoriaIcon categoria={ticket.categoria} />
                        {ticket.categoria}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        ...PRIORIDADE_COLOR[ticket.prioridade],
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                      }}>
                        {ticket.prioridade}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: 'var(--t-text-secondary)' }}>
                        <Clock size={13} />
                        {tempoAberto(ticket.created_at)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <select
                        value={ticket.status}
                        onChange={e => handleUpdateStatus(ticket.id, e.target.value)}
                        style={{
                          ...STATUS_COLOR[ticket.status],
                          fontSize: '12px',
                          fontWeight: 500,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          cursor: 'pointer',
                          border: 'none',
                          outline: 'none',
                        }}
                      >
                        {['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'].map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal — Abrir Ticket */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--t-card-bg)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              width: '100%',
              maxWidth: '448px',
              padding: '24px',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--t-text-primary)', margin: 0 }}>
                Abrir Ticket
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <X size={20} style={{ color: 'var(--t-text-muted)' }} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Cliente *</label>
                <select
                  value={form.cliente_id}
                  onChange={e => setForm((p: any) => ({ ...p, cliente_id: e.target.value }))}
                  style={{ ...inputStyle, marginTop: '4px' }}
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Título *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  style={{ ...inputStyle, marginTop: '4px' }}
                  placeholder="Descreva o problema brevemente"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm((p: any) => ({ ...p, categoria: e.target.value }))}
                    style={{ ...inputStyle, marginTop: '4px' }}
                  >
                    {['TECNICO', 'FISCAL', 'COMERCIAL', 'FINANCEIRO', 'TREINAMENTO'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={e => setForm((p: any) => ({ ...p, prioridade: e.target.value }))}
                    style={{ ...inputStyle, marginTop: '4px' }}
                  >
                    {['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, marginTop: '4px', resize: 'none' }}
                  placeholder="Detalhes do problema..."
                />
              </div>

              <div>
                <label style={labelStyle}>SLA (horas)</label>
                <input
                  type="number"
                  value={form.sla_horas}
                  onChange={e => setForm((p: any) => ({ ...p, sla_horas: e.target.value }))}
                  style={{ ...inputStyle, marginTop: '4px' }}
                  placeholder="Ex: 8, 24, 48"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  border: '1px solid var(--t-card-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--t-text-secondary)',
                  background: 'var(--t-card-bg)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.cliente_id || !form.titulo || saving}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  background: 'var(--t-primary)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: saving || !form.cliente_id || !form.titulo ? 'not-allowed' : 'pointer',
                  opacity: saving || !form.cliente_id || !form.titulo ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Abrindo...</> : 'Abrir Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
