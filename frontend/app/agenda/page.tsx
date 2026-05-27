'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Calendar, Clock, Plus, Video, Check, X, RefreshCw,
  ChevronLeft, ChevronRight, Users, BarChart2, AlertCircle,
  Wifi, WifiOff, Phone, Mail, MessageCircle, MapPin, FileText,
  CheckCircle2, XCircle, RotateCcw, Filter, Search, ExternalLink,
  CalendarDays, Copy, UserX, Hourglass
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
  PENDENTE:               { label: 'Agendada',               color: '#ca8a04', bg: '#fefce8', border: '#fde047' },
  CONFIRMADA:             { label: 'Confirmada',             color: '#4B8EC8', bg: '#EBF4FF', border: '#C3DCFC' },
  REALIZADA:              { label: 'Realizada',              color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  CANCELADA:              { label: 'Cancelada',              color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  REMARCADA:              { label: 'Reagendada',             color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  CLIENTE_NAO_COMPARECEU: { label: 'Não compareceu',         color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  AGUARDANDO_RETORNO:     { label: 'Aguardando retorno',     color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' }
};

const DURACAO_OPCOES = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hora' },
  { value: 90,  label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
];

// ─── WhatsApp Templates ───────────────────────────────────

function buildWhatsApp(template: number, atividade: Partial<Atividade> & { nome?: string; data_prevista?: string; duracao_minutos?: number; google_meet_link?: string }) {
  const nome = atividade.lead?.nome || atividade.nome || '[NOME]';
  const data = atividade.data_prevista ? new Date(atividade.data_prevista).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : '[DATA]';
  const hora = atividade.data_prevista ? new Date(atividade.data_prevista).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '[HORA]';
  const dur = atividade.duracao_minutos ? DURACAO_OPCOES.find(d => d.value === atividade.duracao_minutos)?.label || `${atividade.duracao_minutos} min` : '';
  const meet = atividade.google_meet_link || '';

  if (template === 1) {
    return `Olá ${nome}! 👋\n\nConfirmamos sua reunião com a equipe ProSystem:\n📅 ${data}\n🕐 ${hora}${dur ? `\n⏱ Duração: ${dur}` : ''}${meet ? `\n💻 Link: ${meet}` : ''}\n\nQualquer dúvida, estamos à disposição!\nEquipe ProSystem™`;
  }
  if (template === 2) {
    return `Olá ${nome}! ⏰\n\n*Lembrete:* Amanhã você tem reunião com a ProSystem!\n📅 ${data}\n🕐 ${hora}${meet ? `\n🔗 ${meet}` : ''}\n\nConfirme sua presença respondendo essa mensagem. 😊\nEquipe ProSystem™`;
  }
  return `Olá ${nome}! 😊\n\nObrigado por participar da nossa reunião hoje!\n\n${atividade.resumo_reuniao ? `📋 *Resumo:*\n${atividade.resumo_reuniao}\n\n` : ''}Em caso de dúvidas, estamos à disposição.\n\nEquipe ProSystem™`;
}

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copiar mensagem"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        border: '1px solid #C3DCFC', background: copied ? '#dcfce7' : '#fff',
        color: copied ? '#16a34a' : '#4B8EC8', cursor: 'pointer'
      }}>
      <Copy size={11} /> {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
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
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 720 : 540,
        boxShadow: '0 20px 60px rgba(13,34,56,0.2)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column'
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

// ─── WhatsApp Panel ───────────────────────────────────────

function WhatsAppPanel({ atividade }: { atividade: Partial<Atividade> }) {
  const [activeTab, setActiveTab] = useState(1);
  const rawTel = atividade.lead?.telefone?.replace(/\D/g, '') || '';
  const telefone = rawTel.startsWith('55') ? rawTel : rawTel ? `55${rawTel}` : '';
  const msg = buildWhatsApp(activeTab, atividade);
  const waUrl = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;

  const TABS = [
    { id: 1, label: '✅ Confirmação' },
    { id: 2, label: '⏰ Lembrete D-1' },
    { id: 3, label: '📋 Pós-reunião' }
  ];

  return (
    <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <MessageCircle size={14} color="#16a34a" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Mensagens WhatsApp</span>
        {atividade.google_meet_link && (
          <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
            Link Meet incluído ✓
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: activeTab === t.id ? '#16a34a' : '#dcfce7',
              color: activeTab === t.id ? '#fff' : '#16a34a'
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <pre style={{
        fontSize: 12, lineHeight: 1.8, color: '#0D2238',
        background: '#fff', borderRadius: 8, padding: '12px 14px',
        border: '1px solid #86efac', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit'
      }}>
        {msg}
      </pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <CopyButton text={msg} />
        <a href={waUrl} target="_blank" rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', background: '#25D366', color: '#fff',
            textDecoration: 'none', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,211,102,0.3)'
          }}>
          <MessageCircle size={13} />
          {telefone ? `Enviar para ${atividade.lead?.nome?.split(' ')[0] || 'cliente'}` : 'Abrir WhatsApp'}
        </a>
      </div>
      {!telefone && (
        <p style={{ fontSize: 10, color: '#7AAACB', marginTop: 6 }}>
          Sem telefone cadastrado — mensagem abrirá sem número pré-preenchido.
        </p>
      )}
    </div>
  );
}

// ─── Atividade Detail component ───────────────────────────

function AtividadeDetail({
  atividade, onConcluir, onCancelar, onRemarcar, onCriarMeet, onConfirmar,
  onNaoCompareceu, onAguardarRetorno, creatinguMeet
}: {
  atividade: Atividade;
  onConcluir: () => void;
  onCancelar: () => void;
  onRemarcar: () => void;
  onCriarMeet: () => void;
  onConfirmar: () => void;
  onNaoCompareceu: () => void;
  onAguardarRetorno: () => void;
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
        {atividade.duracao_minutos && row('Duração', DURACAO_OPCOES.find(d => d.value === atividade.duracao_minutos)?.label || `${atividade.duracao_minutos} min`)}
        {atividade.nova_data_remarcada && row('Reagendado para', formatDateTime(atividade.nova_data_remarcada))}
      </div>

      {atividade.descricao && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Descrição</div>
          <div style={{ fontSize: 13, color: '#0D2238', lineHeight: 1.6, background: '#F4F7FB', borderRadius: 8, padding: '10px 12px' }}>
            {atividade.descricao}
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

      {/* WhatsApp templates - show for active meetings with phone */}
      {isActive && atividade.tipo === 'REUNIAO' && atividade.lead && (
        <div style={{ marginBottom: 16 }}>
          <WhatsAppPanel atividade={atividade} />
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
          <button onClick={onNaoCompareceu}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #ea580c, #c2410c)', border: 'none'
            }}>
            <UserX size={13} /> Não compareceu
          </button>
          <button onClick={onAguardarRetorno}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #0f766e, #0d9488)', border: 'none'
            }}>
            <Hourglass size={13} /> Aguardar retorno
          </button>
          <button onClick={onRemarcar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none'
            }}>
            <RotateCcw size={13} /> Reagendar
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

const ADMIN_ROLES = ['CEO', 'ADMIN', 'SUPERVISAO', 'GERENTE'];

export default function AgendaPage() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes((user?.role || '').toUpperCase());

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'mes' | 'semana' | 'lista' | 'relatorio'>('semana');
  const [currentDate, setCurrentDate] = useState(new Date());
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
    resumo_reuniao: '', data_prevista: '', responsavel_id: user?.id || '',
    duracao_minutos: 60
  });
  const [novoLead, setNovoLead] = useState(false);
  const [novoLeadData, setNovoLeadData] = useState({ nome: '', telefone: '', email: '', empresa: '' });
  const [meetLinkForm, setMeetLinkForm] = useState('');
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [meetError, setMeetError] = useState('');
  const [showWaPreview, setShowWaPreview] = useState(false);
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
      const params: any = { limit: 300 };
      if (filterStatus) params.status = filterStatus;
      if (filterTipo) params.tipo = filterTipo;
      const res = await apiClient.getAtividades(params);
      setAtividades(res.data.data.atividades || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStatus, filterTipo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiClient.getLeads({ limit: 200 }).then(r => setLeads(r.data.data?.leads || [])).catch(() => {});
    apiClient.getGoogleStatus().then(r => setGoogleConnected(r.data.data?.connected)).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected')) { setGoogleConnected(true); window.history.replaceState({}, '', '/agenda'); }
  }, []);

  // ── Week helpers ──────────────────────────────────────────
  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  // ── Month helpers ─────────────────────────────────────────
  const getMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from Monday
    let startDow = firstDay.getDay(); // 0=Sun
    if (startDow === 0) startDow = 7;
    const days: (Date | null)[] = [];
    for (let i = 1; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const weekDays = getWeekDays();
  const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const today = new Date();

  const atividadesForDay = (day: Date) =>
    atividades.filter(a => {
      if (!a.data_prevista) return false;
      const d = new Date(a.data_prevista);
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
    });

  const filteredLista = atividades.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.titulo.toLowerCase().includes(s) || (a.lead?.nome?.toLowerCase().includes(s) ?? false) || (a.lead?.empresa?.toLowerCase().includes(s) ?? false);
  });

  // ── Handlers ─────────────────────────────────────────────
  const handleGerarMeetForm = async () => {
    if (!formData.titulo || !formData.data_prevista) {
      setMeetError('Preencha o título e a data antes de gerar o link.');
      return;
    }
    setGeneratingMeet(true);
    setMeetError('');
    try {
      const lead = leads.find((l: any) => l.id === formData.lead_id);
      const leadEmail = novoLead ? novoLeadData.email : lead?.email;
      const res = await apiClient.criarMeetTemp({
        titulo: formData.titulo,
        data_prevista: new Date(formData.data_prevista).toISOString(),
        duracao_minutos: formData.duracao_minutos,
        lead_email: leadEmail || undefined
      });
      if (res.data.data?.need_auth) {
        const authRes = await apiClient.getGoogleAuthUrl();
        window.location.href = authRes.data.data.auth_url;
        return;
      }
      const link = res.data.data?.meet_link || '';
      if (link) {
        setMeetLinkForm(link);
        setShowWaPreview(true);
      } else {
        setMeetError('Link não retornado. Tente conectar o Google novamente ou cole o link manualmente.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '';
      const detail = err?.response?.data?.details || '';
      const needAuth = err?.response?.data?.need_auth;
      if (needAuth) {
        setMeetError('Google Calendar não conectado ou token expirado. Clique em "Conectar Google" no topo da página.');
      } else {
        setMeetError(`${msg}${detail ? ` — ${detail}` : ''}`  || 'Erro ao gerar link. Conecte o Google Calendar ou cole o link manualmente.');
      }
    }
    setGeneratingMeet(false);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const data: any = { ...formData };

      // Se marcou "Lead não cadastrado", cria o lead primeiro
      if (novoLead) {
        if (!novoLeadData.nome || !novoLeadData.telefone) {
          alert('Informe pelo menos nome e telefone do novo lead');
          setSaving(false);
          return;
        }
        const novoLeadRes = await apiClient.createLead({
          nome: novoLeadData.nome,
          telefone: novoLeadData.telefone,
          email: novoLeadData.email || undefined,
          empresa: novoLeadData.empresa || undefined,
          origem: 'AGENDA',
          status: 'NOVO'
        });
        const created = novoLeadRes.data?.data || novoLeadRes.data;
        data.lead_id = created.id;
        // Atualiza lista local de leads
        setLeads(prev => [created, ...prev]);
      }

      if (data.data_prevista) data.data_prevista = new Date(data.data_prevista).toISOString();
      if (!data.duracao_minutos) delete data.duracao_minutos;
      if (meetLinkForm) data.google_meet_link = meetLinkForm;
      await apiClient.createAtividade(data);
      setShowCreate(false);
      setFormData({ titulo: '', tipo: 'REUNIAO', lead_id: '', descricao: '', resumo_reuniao: '', data_prevista: '', responsavel_id: user?.id || '', duracao_minutos: 60 });
      setNovoLead(false);
      setNovoLeadData({ nome: '', telefone: '', email: '', empresa: '' });
      setMeetLinkForm('');
      setMeetError('');
      setShowWaPreview(false);
      load();
    } catch (err: any) {
      alert('Erro ao criar atividade: ' + (err?.response?.data?.message || err?.message || 'desconhecido'));
    }
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

  const handleNaoCompareceu = async (id: string) => {
    await apiClient.naoCompareceuAtividade(id);
    load();
  };

  const handleAguardarRetorno = async (id: string) => {
    await apiClient.aguardarRetornoAtividade(id);
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
      const meetLink: string = res.data.data?.meet_link || '';
      if (meetLink) {
        setShowDetail(prev => prev?.id === id ? { ...prev, google_meet_link: meetLink } : prev);
        setAtividades(prev => prev.map(a => a.id === id ? { ...a, google_meet_link: meetLink } : a));
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

  // ── Helpers for creating the WhatsApp preview lead ────────
  const selectedLead = leads.find((l: any) => l.id === formData.lead_id);
  const previewAtividade: Partial<Atividade> = {
    titulo: formData.titulo,
    data_prevista: formData.data_prevista ? new Date(formData.data_prevista).toISOString() : undefined,
    duracao_minutos: formData.duracao_minutos,
    resumo_reuniao: formData.resumo_reuniao,
    google_meet_link: meetLinkForm || undefined,
    lead: selectedLead ? { id: selectedLead.id, nome: selectedLead.nome, telefone: selectedLead.telefone, empresa: selectedLead.empresa } : undefined
  };

  // ── Styles ────────────────────────────────────────────────
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

  // Abre modal de criação pré-preenchido com o dia clicado (09:00)
  const handleDayClick = (day: Date) => {
    const dateStr = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0)
      .toISOString().slice(0, 16);
    setFormData(prev => ({ ...prev, data_prevista: dateStr }));
    setMeetLinkForm('');
    setMeetError('');
    setShowWaPreview(false);
    setShowCreate(true);
  };

  // ── Navigate month/week ───────────────────────────────────
  const prevPeriod = () => {
    const d = new Date(currentDate);
    if (view === 'mes') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextPeriod = () => {
    const d = new Date(currentDate);
    if (view === 'mes') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const periodLabel = () => {
    if (view === 'mes') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    const days = getWeekDays();
    return `${days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  return (
    <DashboardLayout>
      <div style={{ padding: '24px', minHeight: '100vh', background: '#F4F7FB' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2238', marginBottom: 2 }}>Agenda</h1>
            <p style={{ fontSize: 13, color: '#4A6E8A' }}>Reuniões, atividades e integração com Google Calendar e WhatsApp</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Botão Google Calendar — visível apenas para administradores */}
            {isAdmin && (
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
            )}
            {!isAdmin && googleConnected && (
              <span style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={13} /> Google Ativo
              </span>
            )}
            <button style={btnPrimary} onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Nova Atividade
            </button>
          </div>
        </div>

        {/* View tabs + filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4, background: '#E8F0F8', borderRadius: 8, padding: 4 }}>
            {(['mes', 'semana', 'lista', 'relatorio'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: view === v ? '#fff' : 'transparent',
                  color: view === v ? '#4B8EC8' : '#4A6E8A',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}>
                {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : v === 'lista' ? 'Lista' : 'Relatório'}
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

        {/* ── MÊS VIEW ── */}
        {(view === 'mes' || view === 'semana') && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #D8E8F5' }}>
              <button onClick={prevPeriod} style={{ ...btnOutline, padding: '6px 12px' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D2238', textTransform: 'capitalize' }}>
                {periodLabel()}
              </span>
              <button onClick={nextPeriod} style={{ ...btnOutline, padding: '6px 12px' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #EBF4FF' }}>
              {DAY_NAMES.map((name, i) => (
                <div key={i} style={{
                  padding: '8px 6px', textAlign: 'center',
                  borderRight: i < 6 ? '1px solid #EBF4FF' : 'none'
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#7AAACB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{name}</span>
                </div>
              ))}
            </div>

            {view === 'semana' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
                {weekDays.map((day, i) => {
                  const dayAtividades = atividadesForDay(day);
                  const isToday = day.toDateString() === today.toDateString();
                  return (
                    <div key={i} style={{
                      borderRight: i < 6 ? '1px solid #EBF4FF' : 'none',
                      padding: '8px 6px', background: isToday ? '#FAFCFF' : 'transparent',
                      minHeight: 400, cursor: 'pointer', position: 'relative'
                    }}
                      onClick={() => handleDayClick(day)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, gap: 4 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                          background: isToday ? '#4B8EC8' : 'transparent',
                          color: isToday ? '#fff' : '#0D2238'
                        }}>{day.getDate()}</div>
                        <Plus size={12} color="#4B8EC8" style={{ opacity: 0.5 }} />
                      </div>
                      {dayAtividades.map(a => {
                        const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.OUTRO;
                        const sCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.PENDENTE;
                        const Icon = cfg.icon;
                        return (
                          <div key={a.id} onClick={e => { e.stopPropagation(); setShowDetail(a); }}
                            style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: cfg.bg, border: `1.5px solid ${sCfg.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                              <Icon size={11} color={cfg.color} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{formatTime(a.data_prevista)}</span>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0D2238', lineHeight: 1.3 }} title={a.titulo}>
                              {a.titulo.length > 22 ? a.titulo.slice(0, 22) + '…' : a.titulo}
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
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'mes' && (() => {
              const grid = getMonthGrid();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {grid.map((day, i) => {
                    if (!day) return (
                      <div key={i} style={{
                        borderRight: i % 7 < 6 ? '1px solid #EBF4FF' : 'none',
                        borderBottom: '1px solid #EBF4FF',
                        minHeight: 90, background: '#FAFAFA'
                      }} />
                    );
                    const dayAtividades = atividadesForDay(day);
                    const isToday = day.toDateString() === today.toDateString();
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    return (
                      <div key={i} style={{
                        borderRight: i % 7 < 6 ? '1px solid #EBF4FF' : 'none',
                        borderBottom: '1px solid #EBF4FF',
                        padding: '6px 5px', minHeight: 90, cursor: 'pointer',
                        background: isToday ? '#FAFCFF' : isCurrentMonth ? '#fff' : '#FAFAFA'
                      }}
                        onClick={() => handleDayClick(day)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 4 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: isToday ? 700 : 500,
                            background: isToday ? '#4B8EC8' : 'transparent',
                            color: isToday ? '#fff' : isCurrentMonth ? '#0D2238' : '#C3DCFC'
                          }}>{day.getDate()}</div>
                          {isCurrentMonth && <Plus size={10} color="#4B8EC8" style={{ opacity: 0.4 }} />}
                        </div>
                        {dayAtividades.slice(0, 3).map(a => {
                          const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.OUTRO;
                          return (
                            <div key={a.id} onClick={e => { e.stopPropagation(); setShowDetail(a); }}
                              style={{
                                marginBottom: 2, padding: '2px 5px', borderRadius: 4, cursor: 'pointer',
                                background: cfg.bg, fontSize: 10, fontWeight: 600,
                                color: cfg.color, lineHeight: 1.4,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }} title={a.titulo}>
                              {formatTime(a.data_prevista)} {a.titulo}
                            </div>
                          );
                        })}
                        {dayAtividades.length > 3 && (
                          <div style={{ fontSize: 10, color: '#7AAACB', fontWeight: 600 }}>+{dayAtividades.length - 3} mais</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
                <div key={a.id} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg }}>
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
                      <button onClick={() => handleCriarMeet(a.id)} disabled={creatinguMeet === a.id}
                        style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
                        <Video size={12} />{creatinguMeet === a.id ? '...' : 'Meet'}
                      </button>
                    )}
                    {isActive && a.status === 'PENDENTE' && (
                      <button onClick={() => handleConfirmar(a.id)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
                        <Check size={12} /> Confirmar
                      </button>
                    )}
                    {isActive && (
                      <>
                        <button onClick={() => setShowConcluir(a)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#16a34a', border: '1.5px solid #86efac' }}>
                          <CheckCircle2 size={12} />
                        </button>
                        <button onClick={() => setShowRemarcar(a)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#7c3aed', border: '1.5px solid #c4b5fd' }}>
                          <RotateCcw size={12} />
                        </button>
                        <button onClick={() => setShowCancelar(a)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#dc2626', border: '1.5px solid #fca5a5' }}>
                          <XCircle size={12} />
                        </button>
                      </>
                    )}
                    <button onClick={() => setShowDetail(a)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12 }}>
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
                  <input type="date" value={relFiltros.data_inicio} onChange={e => setRelFiltros(p => ({ ...p, data_inicio: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Data fim</label>
                  <input type="date" value={relFiltros.data_fim} onChange={e => setRelFiltros(p => ({ ...p, data_fim: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={relFiltros.status} onChange={e => setRelFiltros(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                    <option value="">Todos</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={relFiltros.tipo} onChange={e => setRelFiltros(p => ({ ...p, tipo: e.target.value }))} style={inputStyle}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Total', value: relatorio.total, icon: BarChart2, color: '#4B8EC8' },
                    { label: 'Reuniões', value: relatorio.reunioes_total, icon: Video, color: '#7c3aed' },
                    { label: 'Realizadas', value: relatorio.reunioes_realizadas, icon: CheckCircle2, color: '#16a34a' },
                    { label: 'Canceladas', value: relatorio.reunioes_canceladas, icon: XCircle, color: '#dc2626' },
                    { label: 'Reagendadas', value: relatorio.reunioes_remarcadas, icon: RotateCcw, color: '#ea580c' },
                    { label: 'Horas em reunião', value: (relatorio.duracao_total_horas || 0) + 'h', icon: Clock, color: '#0891b2' },
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
        <Modal title="Nova Atividade / Reunião" onClose={() => setShowCreate(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select value={formData.tipo} onChange={e => setFormData(p => ({ ...p, tipo: e.target.value }))} style={inputStyle}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Data e Hora *</label>
                <input type="datetime-local" value={formData.data_prevista}
                  onChange={e => setFormData(p => ({ ...p, data_prevista: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Título *</label>
              <input placeholder="Ex: Reunião de apresentação do sistema" value={formData.titulo}
                onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Lead / Contato *</label>
                <select
                  value={formData.lead_id}
                  onChange={e => setFormData(p => ({ ...p, lead_id: e.target.value }))}
                  disabled={novoLead}
                  style={{ ...inputStyle, opacity: novoLead ? 0.5 : 1 }}>
                  <option value="">Selecione...</option>
                  {leads.map((l: any) => <option key={l.id} value={l.id}>{l.nome}{l.empresa ? ` – ${l.empresa}` : ''}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#4A6E8A', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={novoLead}
                    onChange={e => {
                      setNovoLead(e.target.checked);
                      if (e.target.checked) setFormData(p => ({ ...p, lead_id: '' }));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  Lead não cadastrado — criar agora
                </label>
              </div>
              {formData.tipo === 'REUNIAO' && (
                <div>
                  <label style={labelStyle}>Duração</label>
                  <select value={formData.duracao_minutos}
                    onChange={e => setFormData(p => ({ ...p, duracao_minutos: parseInt(e.target.value) }))} style={inputStyle}>
                    {DURACAO_OPCOES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Campos do novo lead — exibidos quando checkbox marcado */}
            {novoLead && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FDE68A', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
                  Cadastrar novo lead
                </div>
                <div>
                  <label style={labelStyle}>Nome *</label>
                  <input placeholder="Nome do contato" value={novoLeadData.nome}
                    onChange={e => setNovoLeadData(p => ({ ...p, nome: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Telefone *</label>
                  <input placeholder="(00) 00000-0000" value={novoLeadData.telefone}
                    onChange={e => setNovoLeadData(p => ({ ...p, telefone: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" placeholder="email@empresa.com" value={novoLeadData.email}
                    onChange={e => setNovoLeadData(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Empresa</label>
                  <input placeholder="Nome da empresa" value={novoLeadData.empresa}
                    onChange={e => setNovoLeadData(p => ({ ...p, empresa: e.target.value }))} style={inputStyle} />
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>Descrição / Pauta</label>
              <textarea value={formData.descricao}
                onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Pontos a tratar, informações adicionais..." />
            </div>

            {formData.tipo === 'REUNIAO' && (
              <div>
                <label style={labelStyle}>
                  Resumo / Pauta para o cliente
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#7AAACB', fontWeight: 400 }}>Aparece nas mensagens WhatsApp</span>
                </label>
                <textarea value={formData.resumo_reuniao}
                  onChange={e => setFormData(p => ({ ...p, resumo_reuniao: e.target.value }))}
                  rows={2} style={{ ...inputStyle, resize: 'vertical', fontSize: 12, lineHeight: 1.6 }}
                  placeholder="Descreva o objetivo da reunião para o cliente..." />
              </div>
            )}

            {/* Google Meet link generator */}
            {formData.tipo === 'REUNIAO' && (
              <div style={{ background: '#EBF4FF', borderRadius: 10, padding: 14, border: '1px solid #C3DCFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: meetLinkForm ? 10 : 0 }}>
                  <Video size={14} color="#4B8EC8" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4B8EC8', flex: 1 }}>Google Meet</span>
                  {!meetLinkForm && (
                    <button onClick={handleGerarMeetForm} disabled={generatingMeet || !formData.titulo || !formData.data_prevista}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: generatingMeet ? '#C3DCFC' : 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
                        color: '#fff', opacity: (!formData.titulo || !formData.data_prevista) ? 0.5 : 1
                      }}>
                      <Video size={12} /> {generatingMeet ? 'Gerando...' : 'Gerar Link Meet'}
                    </button>
                  )}
                </div>
                {meetError && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#dc2626', padding: '8px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 8 }}>
                      ⚠️ {meetError}
                    </div>
                    {/* Manual entry fallback */}
                    <label style={{ ...labelStyle, marginBottom: 4 }}>Ou cole o link do Meet manualmente:</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder="https://meet.google.com/xxx-xxx-xxx" value={meetLinkForm}
                        onChange={e => { setMeetLinkForm(e.target.value); if (e.target.value) { setMeetError(''); setShowWaPreview(true); } }}
                        style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                    </div>
                  </div>
                )}
                {meetLinkForm && !meetError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <a href={meetLinkForm} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: '#4B8EC8', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Video size={12} /> {meetLinkForm}
                    </a>
                    <CopyButton text={meetLinkForm} />
                    <button onClick={() => { setMeetLinkForm(''); setMeetError(''); }}
                      style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                      Remover
                    </button>
                  </div>
                )}
                {!meetLinkForm && !meetError && !formData.titulo && (
                  <p style={{ fontSize: 11, color: '#7AAACB', marginTop: 6 }}>Preencha o título e a data para gerar o link.</p>
                )}
              </div>
            )}

            {/* WhatsApp messages — auto-show when lead selected */}
            {formData.tipo === 'REUNIAO' && formData.lead_id && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>Mensagens WhatsApp</span>
                  <button onClick={() => setShowWaPreview(v => !v)}
                    style={{ fontSize: 11, color: '#7AAACB', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showWaPreview ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {(showWaPreview || meetLinkForm) && (
                  <WhatsAppPanel atividade={previewAtividade} />
                )}
                {!showWaPreview && !meetLinkForm && (
                  <button onClick={() => setShowWaPreview(true)}
                    style={{ ...btnOutline, color: '#16a34a', border: '1.5px solid #86efac', fontSize: 12, padding: '6px 12px', width: '100%', justifyContent: 'center' }}>
                    <MessageCircle size={13} /> Ver mensagens WhatsApp
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button style={btnOutline} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleCreate} disabled={saving || !formData.titulo || (!novoLead && !formData.lead_id) || (novoLead && (!novoLeadData.nome || !novoLeadData.telefone))}>
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
              <select value={concluirForm.duracao_minutos}
                onChange={e => setConcluirForm(p => ({ ...p, duracao_minutos: e.target.value }))}
                style={inputStyle}>
                <option value="">Não informado</option>
                {DURACAO_OPCOES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {showConcluir.tipo === 'REUNIAO' && showConcluir.lead && (
              <div style={{ marginTop: 4 }}>
                <WhatsAppPanel atividade={{
                  ...showConcluir,
                  resumo_reuniao: concluirForm.resultado || showConcluir.resumo_reuniao
                }} />
              </div>
            )}
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
        <Modal title="Reagendar Atividade" onClose={() => setShowRemarcar(null)}>
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
                <RotateCcw size={13} /> {saving ? '...' : 'Reagendar'}
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
            onNaoCompareceu={() => { handleNaoCompareceu(showDetail.id); setShowDetail(null); }}
            onAguardarRetorno={() => { handleAguardarRetorno(showDetail.id); setShowDetail(null); }}
            creatinguMeet={creatinguMeet === showDetail.id}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
