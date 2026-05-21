'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  Calendar, Clock, Plus, Video, Check, X, RefreshCw,
  ChevronLeft, ChevronRight, Users, BarChart2, AlertCircle,
  Wifi, WifiOff, Phone, Mail, MessageCircle, MapPin, FileText,
  CheckCircle2, XCircle, RotateCcw, Filter, Search, ExternalLink,
  CalendarDays, TrendingUp, TrendingDown
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface Atividade {
  id: string;
  lead_id: string;
  lead?: { id: string; nome: string; empresa?: string; email?: string; telefone?: string };
  tipo: string;
  titulo: string;
  descricao?: string;
  resumo_reuniao?: string;
  status: string;
  resultado?: string;
  motivo_cancelamento?: string;
  nova_data_remarcada?: string;
  google_meet_link?: string;
  duracao_minutos?: number;
  responsavel_id?: string;
  data_prevista?: string;
  data_realizada?: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────

const TIPO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  REUNIAO:   { label: 'Reunião',    icon: Video,          color: '#4B8EC8', bg: '#EBF4FF' },
  LIGACAO:   { label: 'Ligação',    icon: Phone,          color: '#0891b2', bg: '#ecfeff' },
  EMAIL:     { label: 'E-mail',     icon: Mail,           color: '#7c3aed', bg: '#f5f3ff' },
  WHATSAPP:  { label: 'WhatsApp',   icon: MessageCircle,  color: '#16a34a', bg: '#dcfce7' },
  VISITA:    { label: 'Visita',     icon: MapPin,         color: '#ea580c', bg: '#fff7ed' },
  TAREFA:    { label: 'Tarefa',     icon: FileText,       color: '#ca8a04', bg: '#fefce8' },
  OUTRO:     { label: 'Outro',      icon: CalendarDays,   color: '#6b7280', bg: '#f3f4f6' }
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDENTE:   { label: 'Pendente',   color: '#ca8a04', bg: '#fefce8', border: '#fde047' },
  CONFIRMADA: { label: 'Confirmada', color: '#4B8EC8', bg: '#EBF4FF', border: '#C3DCFC' },
  REALIZADA:  { label: 'Realizada',  color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  CANCELADA:  { label: 'Cancelada',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  REMARCADA:  { label: 'Remarcada',  color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' }
};

const RESUMO_TEMPLATE = `Prezado(a) [NOME],

Sua reunião com a equipe ProSystem está confirmada para [DATA] às [HORA].

⚠️ É muito importante a sua presença nesta reunião. Caso seja necessária ausência ou adiamento, pedimos que nos informe com antecedência para que possamos reorganizar a agenda e atendê-lo(a) com mais qualidade e satisfação.

Você pode entrar em contato pelos nossos canais:
📱 WhatsApp: [TELEFONE]
📧 E-mail: [EMAIL]

Aguardamos você!

Equipe ProSystem™`;

// ─── Sub-components ───────────────────────────────────────

function Badge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDENTE;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`
    }}>
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.OUTRO;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Modal wrapper ────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(13,34,56,0.45)', backdropFilter: 'blur(4px)', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 680 : 520,
        boxShadow: '0 20px 60px rgba(13,34,56,0.2)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #D8E8F5'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238' }}>{title}</h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7AAACB', borderRadius: 6, padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Atividade Detail component ───────────────────────────

function AtividadeDetail({
  atividade, onConcluir, onCancelar, onRemarcar, onCriarMeet, onConfirmar, creatinguMeet
}: {
  atividade: Atividade;
  onConcluir: () => void;
  onCancelar: () => void;
  onRemarcar: () => void;
  onCriarMeet: () => void;
  onConfirmar: () => void;
  creatinguMeet: boolean;
}) {
  const cfg = TIPO_CONFIG[atividade.tipo] || TIPO_CONFIG.OUTRO;
  const Icon = cfg.icon;
  const isActive = atividade.status === 'PENDENTE' || atividade.status === 'CONFIRMADA';

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: '#7AAACB', fontWeight: 600, minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0D2238', flex: 1 }}>{value || '—'}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, flexShrink: 0 }}>
          <Icon size={20} color={cfg.color} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 6 }}>{atividade.titulo}</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge status={atividade.status} />
            <TipoBadge tipo={atividade.tipo} />
          </div>
        </div>
      </div>

      <div style={{ background: '#F4F7FB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
        {atividade.lead && row('Contato', `${atividade.lead.nome}${atividade.lead.empresa ? ` · ${atividade.lead.empresa}` : ''}`)}
        {atividade.lead?.email && row('E-mail', <a href={`mailto:${atividade.lead.email}`} style={{ color: '#4B8EC8' }}>{atividade.lead.email}</a>)}
        {atividade.lead?.telefone && row('Telefone', atividade.lead.telefone)}
        {row('Data prevista', formatDateTime(atividade.data_prevista))}
        {atividade.data_realizada && row('Realizada em', formatDateTime(atividade.data_realizada))}
        {atividade.duracao_minutos && row('Duração', `${atividade.duracao_minutos} minutos`)}
        {atividade.nova_data_remarcada && row('Remarcado para', formatDateTime(atividade.nova_data_remarcada))}
      </div>

      {atividade.descricao && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Descrição</div>
          <div style={{ fontSize: 13, color: '#0D2238', lineHeight: 1.6, background: '#F4F7FB', borderRadius: 8, padding: '10px 12px' }}>
            {atividade.descricao}
          </div>
        </div>
      )}

      {atividade.resumo_reuniao && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Resumo / Mensagem para o cliente</div>
          <div style={{ fontSize: 13, color: '#0D2238', lineHeight: 1.7, background: '#EBF4FF', borderRadius: 8, padding: '12px 14px', whiteSpace: 'pre-wrap', border: '1px solid #C3DCFC' }}>
            {atividade.resumo_reuniao}
          </div>
        </div>
      )}

      {atividade.resultado && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>Resultado</div>
          <div style={{ fontSize: 13, color: '#0D2238', lineHeight: 1.6, background: '#dcfce7', borderRadius: 8, padding: '10px 12px', border: '1px solid #86efac' }}>
            {atividade.resultado}
          </div>
        </div>
      )}

      {atividade.motivo_cancelamento && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>Motivo do Cancelamento</div>
          <div style={{ fontSize: 13, color: '#0D2238', lineHeight: 1.6, background: '#fef2f2', borderRadius: 8, padding: '10px 12px', border: '1px solid #fca5a5' }}>
            {atividade.motivo_cancelamento}
          </div>
        </div>
      )}

      {atividade.google_meet_link && (
        <div style={{ marginBottom: 16 }}>
          <a href={atividade.google_meet_link} target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              color: '#fff', background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
              textDecoration: 'none', boxShadow: '0 2px 8px rgba(75,142,200,0.3)'
            }}>
            <Video size={14} /> Entrar na Reunião (Google Meet) <ExternalLink size={12} />
          </a>
        </div>
      )}

      {isActive && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #D8E8F5', paddingTop: 16, marginTop: 8 }}>
          {atividade.tipo === 'REUNIAO' && !atividade.google_meet_link && (
            <button onClick={onCriarMeet} disabled={creatinguMeet}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #C3DCFC',
                color: '#4B8EC8', background: '#fff'
              }}>
              <Video size={13} /> {creatinguMeet ? 'Criando...' : 'Criar Link Meet'}
            </button>
          )}
          {atividade.status === 'PENDENTE' && (
            <button onClick={onConfirmar}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #C3DCFC',
                color: '#4B8EC8', background: '#fff'
              }}>
              <Check size={13} /> Confirmar
            </button>
          )}
          <button onClick={onConcluir}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none'
            }}>
            <CheckCircle2 size={13} /> Concluído
          </button>
          <button onClick={onRemarcar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none'
            }}>
            <RotateCcw size={13} /> Remarcar
          </button>
          <button onClick={onCancelar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: 'none'
            }}>
            <XCircle size={13} /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function AgendaPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'semana' | 'lista' | 'relatorio'>('semana');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [search, setSearch] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showConcluir, setShowConcluir] = useState<Atividade | null>(null);
  const [showCancelar, setShowCancelar] = useState<Atividade | null>(null);
  const [showRemarcar, setShowRemarcar] = useState<Atividade | null>(null);
  const [showDetail, setShowDetail] = useState<Atividade | null>(null);

  const [formData, setFormData] = useState({
    titulo: '', tipo: 'REUNIAO', lead_id: '', descricao: '',
    resumo_reuniao: RESUMO_TEMPLATE, data_prevista: '', responsavel_id: ''
  });
  const [concluirForm, setConcluirForm] = useState({ resultado: '', duracao_minutos: '' });
  const [cancelarForm, setCancelarForm] = useState({ motivo_cancelamento: '' });
  const [remarcarForm, setRemarcarForm] = useState({ nova_data_remarcada: '', motivo: '' });
  const [leads, setLeads] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [relatorio, setRelatorio] = useState<any>(null);
  const [relFiltros, setRelFiltros] = useState({ data_inicio: '', data_fim: '', status: '', tipo: '' });
  const [creatinguMeet, setCreatingMeet] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (filterStatus) params.status = filterStatus;
      if (filterTipo) params.tipo = filterTipo;
      const res = await apiClient.getAtividades(params);
      setAtividades(res.data.data.atividades || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStatus, filterTipo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiClient.getLeads({ limit: 100 }).then(r => setLeads(r.data.data?.leads || [])).catch(() => {});
    apiClient.getGoogleStatus().then(r => setGoogleConnected(r.data.data?.connected)).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected')) { setGoogleConnected(true); window.history.replaceState({}, '', '/agenda'); }
  }, []);

  const getWeekDays = () => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - start.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays();
  const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const atividadesForDay = (day: Date) =>
    atividades.filter(a => {
      if (!a.data_prevista) return false;
      const d = new Date(a.data_prevista);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
    });

  const filteredLista = atividades.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.titulo.toLowerCase().includes(s) || a.lead?.nome?.toLowerCase().includes(s) || (a.lead?.empresa?.toLowerCase().includes(s) ?? false);
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      const data: any = { ...formData };
      if (data.data_prevista) data.data_prevista = new Date(data.data_prevista).toISOString();
      await apiClient.createAtividade(data);
      setShowCreate(false);
      setFormData({ titulo: '', tipo: 'REUNIAO', lead_id: '', descricao: '', resumo_reuniao: RESUMO_TEMPLATE, data_prevista: '', responsavel_id: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleConcluir = async () => {
    if (!showConcluir) return;
    setSaving(true);
    try {
      await apiClient.concluirAtividade(showConcluir.id, {
        resultado: concluirForm.resultado,
        duracao_minutos: concluirForm.duracao_minutos ? parseInt(concluirForm.duracao_minutos) : undefined
      });
      setShowConcluir(null);
      setConcluirForm({ resultado: '', duracao_minutos: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleCancelar = async () => {
    if (!showCancelar) return;
    setSaving(true);
    try {
      await apiClient.cancelarAtividade(showCancelar.id, cancelarForm.motivo_cancelamento);
      setShowCancelar(null);
      setCancelarForm({ motivo_cancelamento: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleRemarcar = async () => {
    if (!showRemarcar) return;
    setSaving(true);
    try {
      await apiClient.remarcarAtividade(showRemarcar.id, {
        nova_data_remarcada: new Date(remarcarForm.nova_data_remarcada).toISOString(),
        motivo: remarcarForm.motivo
      });
      setShowRemarcar(null);
      setRemarcarForm({ nova_data_remarcada: '', motivo: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleConfirmar = async (id: string) => {
    await apiClient.confirmarAtividade(id);
    load();
  };

  const handleCriarMeet = async (id: string) => {
    setCreatingMeet(id);
    try {
      const res = await apiClient.criarMeetLink(id);
      if (res.data.data?.need_auth) {
        const authRes = await apiClient.getGoogleAuthUrl();
        window.location.href = authRes.data.data.auth_url;
        return;
      }
      load();
    } catch { /* ignore */ }
    setCreatingMeet(null);
  };

  const handleGoogleConnect = async () => {
    try {
      const res = await apiClient.getGoogleAuthUrl();
      if (res.data.data?.auth_url) window.location.href = res.data.data.auth_url;
    } catch { /* ignore */ }
  };

  const loadRelatorio = async () => {
    try {
      const params: any = {};
      if (relFiltros.data_inicio) params.data_inicio = new Date(relFiltros.data_inicio).toISOString();
      if (relFiltros.data_fim) params.data_fim = new Date(relFiltros.data_fim).toISOString();
      if (relFiltros.status) params.status = relFiltros.status;
      if (relFiltros.tipo) params.tipo = relFiltros.tipo;
      const res = await apiClient.getRelatorioAtividades(params);
      setRelatorio(res.data.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (view === 'relatorio') loadRelatorio(); }, [view]);

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #D8E8F5',
    borderRadius: 12, boxShadow: '0 1px 3px rgba(13,34,56,0.06)'
  };

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: '#fff', cursor: 'pointer', border: 'none',
    background: 'linear-gradient(135deg, #4B8EC8 0%, #2E6EAB 100%)',
    boxShadow: '0 2px 8px rgba(75,142,200,0.25)'
  };

  const btnOutline: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: '#4B8EC8', cursor: 'pointer', background: '#fff',
    border: '1.5px solid #C3DCFC'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #C3DCFC',
    borderRadius: 8, fontSize: 13, color: '#0D2238', background: '#fff', outline: 'none'
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 4 };

  const today = new Date();

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', minHeight: '100vh', background: '#F4F7FB' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2238', marginBottom: 2 }}>Agenda</h1>
            <p style={{ fontSize: 13, color: '#4A6E8A' }}>Gerencie reuniões, tarefas e atividades com integração Google Calendar</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={googleConnected ? undefined : handleGoogleConnect}
              style={{
                ...btnOutline,
                color: googleConnected ? '#16a34a' : '#4A6E8A',
                border: `1.5px solid ${googleConnected ? '#86efac' : '#C3DCFC'}`
              }}
            >
              {googleConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {googleConnected ? 'Google Conectado' : 'Conectar Google'}
            </button>
            <button style={btnPrimary} onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Nova Atividade
            </button>
          </div>
        </div>

        {/* View tabs + filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#E8F0F8', borderRadius: 8, padding: 4 }}>
            {(['semana', 'lista', 'relatorio'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: view === v ? '#fff' : 'transparent',
                  color: view === v ? '#4B8EC8' : '#4A6E8A',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}>
                {v === 'semana' ? 'Semana' : v === 'lista' ? 'Lista' : 'Relatório'}
              </button>
            ))}
          </div>

          {view !== 'relatorio' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {view === 'lista' && (
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#7AAACB' }} />
                  <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 28, width: 180 }} />
                </div>
              )}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ ...inputStyle, width: 'auto' }}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
                style={{ ...inputStyle, width: 'auto' }}>
                <option value="">Todos os tipos</option>
                {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ── SEMANA VIEW ── */}
        {view === 'semana' && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #D8E8F5' }}>
              <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}
                style={{ ...btnOutline, padding: '6px 12px' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D2238' }}>
                {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} –{' '}
                {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}
                style={{ ...btnOutline, padding: '6px 12px' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #EBF4FF' }}>
              {weekDays.map((day, i) => {
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} style={{
                    padding: '10px 8px', textAlign: 'center',
                    borderRight: i < 6 ? '1px solid #EBF4FF' : 'none',
                    background: isToday ? '#EBF4FF' : 'transparent'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#7AAACB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAY_NAMES[i]}</div>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', margin: '4px auto 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                      background: isToday ? '#4B8EC8' : 'transparent',
                      color: isToday ? '#fff' : '#0D2238'
                    }}>{day.getDate()}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
              {weekDays.map((day, i) => {
                const dayAtividades = atividadesForDay(day);
                const isToday = day.toDateString() === today.toDateString();
                return (
                  <div key={i} style={{
                    borderRight: i < 6 ? '1px solid #EBF4FF' : 'none',
                    padding: '8px 6px', background: isToday ? '#FAFCFF' : 'transparent',
                    minHeight: 400
                  }}>
                    {dayAtividades.map(a => {
                      const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.OUTRO;
                      const sCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.PENDENTE;
                      const Icon = cfg.icon;
                      return (
                        <div key={a.id}
                          onClick={() => setShowDetail(a)}
                          style={{
                            marginBottom: 6, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                            background: cfg.bg, border: `1.5px solid ${sCfg.border}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <Icon size={11} color={cfg.color} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{formatTime(a.data_prevista)}</span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0D2238', lineHeight: 1.3, marginBottom: 2 }}
                            title={a.titulo}>
                            {a.titulo.length > 24 ? a.titulo.slice(0, 24) + '…' : a.titulo}
                          </div>
                          {a.lead && <div style={{ fontSize: 10, color: '#4A6E8A' }}>{a.lead.nome}</div>}
                          {a.google_meet_link && (
                            <a href={a.google_meet_link} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: 10, color: '#4B8EC8', textDecoration: 'none' }}>
                              <Video size={9} /> Meet
                            </a>
                          )}
                        </div>
                      );
                    })}
                    {dayAtividades.length === 0 && (
                      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: '#D8E8F5' }}>—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LISTA VIEW ── */}
        {view === 'lista' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#7AAACB' }}>Carregando...</div>}
            {!loading && filteredLista.length === 0 && (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7AAACB' }}>
                <CalendarDays size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>Nenhuma atividade encontrada</p>
              </div>
            )}
            {filteredLista.map(a => {
              const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.OUTRO;
              const Icon = cfg.icon;
              const isActive = a.status === 'PENDENTE' || a.status === 'CONFIRMADA';
              return (
                <div key={a.id} style={{
                  ...card, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: cfg.bg
                  }}>
                    <Icon size={18} color={cfg.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#0D2238' }}>{a.titulo}</span>
                      <Badge status={a.status} />
                      <TipoBadge tipo={a.tipo} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {a.lead && <span style={{ fontSize: 12, color: '#4A6E8A' }}>{a.lead.nome}{a.lead.empresa ? ` · ${a.lead.empresa}` : ''}</span>}
                      {a.data_prevista && (
                        <span style={{ fontSize: 12, color: '#7AAACB', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {formatDateTime(a.data_prevista)}
                        </span>
                      )}
                      {a.google_meet_link && (
                        <a href={a.google_meet_link} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#4B8EC8', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                          <Video size={11} /> Link Meet
                        </a>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {isActive && a.tipo === 'REUNIAO' && !a.google_meet_link && (
                      <button
                        onClick={() => handleCriarMeet(a.id)}
                        disabled={creatinguMeet === a.id}
                        style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
                        <Video size={12} />
                        {creatinguMeet === a.id ? '...' : 'Meet'}
                      </button>
                    )}
                    {isActive && a.status === 'PENDENTE' && (
                      <button onClick={() => handleConfirmar(a.id)}
                        style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
                        <Check size={12} /> Confirmar
                      </button>
                    )}
                    {isActive && (
                      <>
                        <button onClick={() => setShowConcluir(a)}
                          style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#16a34a', border: '1.5px solid #86efac' }}>
                          <CheckCircle2 size={12} /> Concluído
                        </button>
                        <button onClick={() => setShowRemarcar(a)}
                          style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#7c3aed', border: '1.5px solid #c4b5fd' }}>
                          <RotateCcw size={12} /> Remarcar
                        </button>
                        <button onClick={() => setShowCancelar(a)}
                          style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#dc2626', border: '1.5px solid #fca5a5' }}>
                          <XCircle size={12} /> Cancelar
                        </button>
                      </>
                    )}
                    <button onClick={() => setShowDetail(a)}
                      style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
                      Ver
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RELATÓRIO VIEW ── */}
        {view === 'relatorio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Data início</label>
                  <input type="date" value={relFiltros.data_inicio}
                    onChange={e => setRelFiltros(p => ({ ...p, data_inicio: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Data fim</label>
                  <input type="date" value={relFiltros.data_fim}
                    onChange={e => setRelFiltros(p => ({ ...p, data_fim: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={relFiltros.status}
                    onChange={e => setRelFiltros(p => ({ ...p, status: e.target.value }))}
                    style={inputStyle}>
                    <option value="">Todos</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={relFiltros.tipo}
                    onChange={e => setRelFiltros(p => ({ ...p, tipo: e.target.value }))}
                    style={inputStyle}>
                    <option value="">Todos</option>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <button style={btnPrimary} onClick={loadRelatorio}>
                <Filter size={13} /> Gerar Relatório
              </button>
            </div>

            {relatorio && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Total', value: relatorio.total, icon: BarChart2, color: '#4B8EC8' },
                    { label: 'Reuniões', value: relatorio.reunioes_total, icon: Video, color: '#7c3aed' },
                    { label: 'Realizadas', value: relatorio.reunioes_realizadas, icon: CheckCircle2, color: '#16a34a' },
                    { label: 'Canceladas', value: relatorio.reunioes_canceladas, icon: XCircle, color: '#dc2626' },
                    { label: 'Remarcadas', value: relatorio.reunioes_remarcadas, icon: RotateCcw, color: '#ea580c' },
                    { label: 'Horas em reunião', value: relatorio.duracao_total_horas + 'h', icon: Clock, color: '#0891b2' },
                  ].map((k, i) => {
                    const Icon = k.icon;
                    return (
                      <div key={i} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${k.color}18` }}>
                          <Icon size={18} color={k.color} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#4A6E8A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#0D2238' }}>{k.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #D8E8F5' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0D2238' }}>Detalhamento — {relatorio.total} registro(s)</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F4F7FB' }}>
                          {['Título', 'Lead', 'Tipo', 'Status', 'Data', 'Duração'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4A6E8A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.atividades.map((a: Atividade) => (
                          <tr key={a.id} style={{ borderTop: '1px solid #EBF4FF' }}>
                            <td style={{ padding: '10px 12px', color: '#0D2238', fontWeight: 500 }}>{a.titulo}</td>
                            <td style={{ padding: '10px 12px', color: '#4A6E8A' }}>{a.lead?.nome || '—'}</td>
                            <td style={{ padding: '10px 12px' }}><TipoBadge tipo={a.tipo} /></td>
                            <td style={{ padding: '10px 12px' }}><Badge status={a.status} /></td>
                            <td style={{ padding: '10px 12px', color: '#4A6E8A' }}>{formatDate(a.data_prevista)}</td>
                            <td style={{ padding: '10px 12px', color: '#4A6E8A' }}>{a.duracao_minutos ? `${a.duracao_minutos} min` : '—'}</td>
                          </tr>
                        ))}
                        {relatorio.atividades.length === 0 && (
                          <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#7AAACB' }}>Nenhum resultado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL: Create ════════════════════════════════════════ */}
      {showCreate && (
        <Modal title="Nova Atividade" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={formData.tipo} onChange={e => setFormData(p => ({ ...p, tipo: e.target.value }))} style={inputStyle}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Data e Hora</label>
                <input type="datetime-local" value={formData.data_prevista}
                  onChange={e => setFormData(p => ({ ...p, data_prevista: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Título *</label>
              <input placeholder="Ex: Reunião de apresentação do sistema" value={formData.titulo}
                onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lead / Contato</label>
              <select value={formData.lead_id} onChange={e => setFormData(p => ({ ...p, lead_id: e.target.value }))} style={inputStyle}>
                <option value="">Selecione...</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` – ${l.empresa}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea value={formData.descricao}
                onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Informações adicionais..." />
            </div>
            {formData.tipo === 'REUNIAO' && (
              <div>
                <label style={labelStyle}>
                  Resumo da Reunião
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#7AAACB', fontWeight: 400 }}>Personalize para o cliente</span>
                </label>
                <textarea value={formData.resumo_reuniao}
                  onChange={e => setFormData(p => ({ ...p, resumo_reuniao: e.target.value }))}
                  rows={8} style={{ ...inputStyle, resize: 'vertical', fontSize: 12, lineHeight: 1.6 }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={btnOutline} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreate} disabled={saving || !formData.titulo || !formData.lead_id}>
                {saving ? 'Salvando...' : <><Plus size={13} /> Criar</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Concluir ══════════════════════════════════════ */}
      {showConcluir && (
        <Modal title="Concluir Atividade" onClose={() => setShowConcluir(null)}>
          <div style={{ marginBottom: 12, padding: 12, background: '#EBF4FF', borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0D2238' }}>{showConcluir.titulo}</div>
            {showConcluir.lead && <div style={{ fontSize: 12, color: '#4A6E8A', marginTop: 2 }}>{showConcluir.lead.nome}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Resultado / Observações *</label>
              <textarea value={concluirForm.resultado}
                onChange={e => setConcluirForm(p => ({ ...p, resultado: e.target.value }))}
                rows={4} style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Descreva o que foi tratado, próximos passos, etc." />
            </div>
            <div>
              <label style={labelStyle}>Duração (minutos)</label>
              <input type="number" value={concluirForm.duracao_minutos} min={1} max={480}
                onChange={e => setConcluirForm(p => ({ ...p, duracao_minutos: e.target.value }))}
                style={inputStyle} placeholder="Ex: 60" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={btnOutline} onClick={() => setShowConcluir(null)}>Cancelar</button>
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                onClick={handleConcluir} disabled={saving || !concluirForm.resultado}>
                <CheckCircle2 size={13} /> {saving ? '...' : 'Concluir'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Cancelar ══════════════════════════════════════ */}
      {showCancelar && (
        <Modal title="Cancelar Atividade" onClose={() => setShowCancelar(null)}>
          <div style={{ marginBottom: 12, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
            <div style={{ fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} /> Esta ação marcará a atividade como cancelada.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Motivo do Cancelamento *</label>
              <textarea value={cancelarForm.motivo_cancelamento}
                onChange={e => setCancelarForm({ motivo_cancelamento: e.target.value })}
                rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Ex: Cliente solicitou cancelamento..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={btnOutline} onClick={() => setShowCancelar(null)}>Voltar</button>
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
                onClick={handleCancelar} disabled={saving || !cancelarForm.motivo_cancelamento}>
                <XCircle size={13} /> {saving ? '...' : 'Cancelar Atividade'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Remarcar ══════════════════════════════════════ */}
      {showRemarcar && (
        <Modal title="Remarcar Atividade" onClose={() => setShowRemarcar(null)}>
          <div style={{ marginBottom: 12, padding: 12, background: '#f5f3ff', borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0D2238' }}>{showRemarcar.titulo}</div>
            {showRemarcar.data_prevista && (
              <div style={{ fontSize: 12, color: '#4A6E8A', marginTop: 2 }}>
                Data atual: {formatDateTime(showRemarcar.data_prevista)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nova Data e Hora *</label>
              <input type="datetime-local" value={remarcarForm.nova_data_remarcada}
                onChange={e => setRemarcarForm(p => ({ ...p, nova_data_remarcada: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Motivo do Reagendamento</label>
              <textarea value={remarcarForm.motivo}
                onChange={e => setRemarcarForm(p => ({ ...p, motivo: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Ex: Conflito de agenda..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={btnOutline} onClick={() => setShowRemarcar(null)}>Cancelar</button>
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                onClick={handleRemarcar} disabled={saving || !remarcarForm.nova_data_remarcada}>
                <RotateCcw size={13} /> {saving ? '...' : 'Remarcar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Detail ════════════════════════════════════════ */}
      {showDetail && (
        <Modal title="Detalhes da Atividade" onClose={() => setShowDetail(null)} wide>
          <AtividadeDetail
            atividade={showDetail}
            onConcluir={() => { setShowDetail(null); setShowConcluir(showDetail); }}
            onCancelar={() => { setShowDetail(null); setShowCancelar(showDetail); }}
            onRemarcar={() => { setShowDetail(null); setShowRemarcar(showDetail); }}
            onCriarMeet={() => handleCriarMeet(showDetail.id)}
            onConfirmar={() => { handleConfirmar(showDetail.id); setShowDetail(null); }}
            creatinguMeet={creatinguMeet === showDetail.id}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
