'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  FileCheck2, Plus, Search, Eye, Trash2, Edit3, Send, CheckCircle,
  X, ExternalLink, RefreshCw, Building2, User, Hash, Calendar,
  DollarSign, Shield, Pen,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ContratoComercial {
  id: string;
  numero_contrato: string;
  sequencia: number;
  ano: number;
  proposta_comercial_id?: string;
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
  created_at: string;
}

// ── Configuração de status ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  A_GERAR:             { label: 'A Gerar',              color: '#6b7280', bg: '#f3f4f6', icon: FileCheck2 },
  GERADO:              { label: 'Gerado',               color: '#2563eb', bg: '#dbeafe', icon: FileCheck2 },
  ENVIADO_ASSINATURA:  { label: 'Enviado p/ Assinatura',color: '#7c3aed', bg: '#ede9fe', icon: Send },
  AGUARDANDO_ASSINATURA:{ label: 'Aguardando Assinatura',color: '#d97706', bg: '#fef3c7', icon: Pen },
  ASSINADO:            { label: 'Assinado',             color: '#16a34a', bg: '#dcfce7', icon: CheckCircle },
  PENDENTE_CORRECAO:   { label: 'Pendente Correção',    color: '#dc2626', bg: '#fee2e2', icon: RefreshCw },
  CANCELADO:           { label: 'Cancelado',            color: '#9ca3af', bg: '#f9fafb', icon: X },
};

const KANBAN_ORDER = ['A_GERAR','GERADO','ENVIADO_ASSINATURA','AGUARDANDO_ASSINATURA','ASSINADO','PENDENTE_CORRECAO','CANCELADO'];

const fmtBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Componente principal ──────────────────────────────────────────────────────

export default function ContratosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [contratos, setContratos] = useState<ContratoComercial[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dragging, setDragging]       = useState<ContratoComercial | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [selected, setSelected]   = useState<ContratoComercial | null>(null);
  const [preview, setPreview]     = useState<any>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [sendingZap, setSendingZap]   = useState(false);
  const [zapMsg, setZapMsg]           = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading, router]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getContratosComerciais();
      setContratos(res.data.data.contratos || []);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contratos.filter(c => {
    const s = search.toLowerCase();
    return !s ||
      c.razao_social.toLowerCase().includes(s) ||
      c.numero_contrato.includes(s) ||
      (c.vendedor_nome || '').toLowerCase().includes(s);
  });

  const moveStatus = async (contrato: ContratoComercial, novoStatus: string) => {
    if (contrato.status === novoStatus) return;
    setContratos(prev => prev.map(c => c.id === contrato.id ? { ...c, status: novoStatus } : c));
    try {
      await apiClient.updateContratoComercial(contrato.id, { status: novoStatus });
    } catch { load(); }
  };

  const openPreview = async (c: ContratoComercial) => {
    setSelected(c);
    setLoadingPrev(true);
    setPreview(null);
    setZapMsg('');
    try {
      const res = await apiClient.getContratoPreview(c.id);
      setPreview(res.data.data);
    } catch { /* ignore */ } finally { setLoadingPrev(false); }
  };

  const handleEnviarZapSign = async () => {
    if (!selected) return;
    setSendingZap(true);
    setZapMsg('');
    try {
      await apiClient.enviarContratoZapSign(selected.id);
      setZapMsg('✅ Enviado para ZapSign com sucesso! O signatário receberá o link por e-mail/WhatsApp.');
      load();
    } catch (e: any) {
      setZapMsg(`❌ ${e?.response?.data?.message || 'Erro ao enviar para ZapSign'}`);
    } finally { setSendingZap(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contrato?')) return;
    await apiClient.deleteContratoComercial(id);
    setSelected(null);
    load();
  };

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p style={{ color: 'var(--t-text-muted)' }}>Carregando contratos...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1400 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>
              Contratos Comerciais
            </h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 2 }}>
              Kanban de contratos — arraste para avançar o status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="contratos" titulo="Contratos Comerciais — ProSystem CRM"
              linhas={filtered}
              colunas={[
                { header: 'Nº contrato', value: (c: ContratoComercial) => c.numero_contrato },
                { header: 'Cliente', value: (c: ContratoComercial) => c.razao_social },
                { header: 'Plano', value: (c: ContratoComercial) => c.plano_contratado || '' },
                { header: 'Mensalidade (R$)', value: (c: ContratoComercial) => c.mensalidade ?? '' },
                { header: 'Setup (R$)', value: (c: ContratoComercial) => c.valor_setup_total ?? '' },
                { header: 'Vendedor', value: (c: ContratoComercial) => c.vendedor_nome || '' },
                { header: 'Status', value: (c: ContratoComercial) => c.status },
              ]}
            />
            <button
              onClick={() => router.push('/propostas-comerciais')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}
            >
              <Plus size={15} /> Nova Proposta
            </button>
          </div>
        </div>

        {/* Resumo KPIs */}
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-5">
          {KANBAN_ORDER.map(k => {
            const cfg = STATUS_CONFIG[k];
            const count = contratos.filter(c => c.status === k).length;
            return (
              <div key={k} className="ps-card p-3 rounded-xl text-center">
                <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 2, lineHeight: 1.2 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa, número ou vendedor..."
              className="ps-input pl-8 text-sm"
              style={{ width: 280, paddingLeft: 30 }}
            />
          </div>
          <button onClick={load} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', cursor: 'pointer', color: 'var(--t-text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {/* ── Kanban ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {KANBAN_ORDER.map(statusKey => {
            const cfg = STATUS_CONFIG[statusKey];
            const colCards = filtered.filter(c => c.status === statusKey);
            const isOver = dragOverCol === statusKey;
            const isDraggingToSame = dragging?.status === statusKey;
            return (
              <div
                key={statusKey}
                onDragOver={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                onDragEnter={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverCol(null);
                  if (dragging && dragging.status !== statusKey) moveStatus(dragging, statusKey);
                  setDragging(null);
                }}
                style={{
                  minWidth: 210, width: 210, flexShrink: 0, borderRadius: 12,
                  border: isOver && !isDraggingToSame ? `2px solid ${cfg.color}` : `1px solid ${cfg.color}33`,
                  background: isOver && !isDraggingToSame ? `${cfg.color}08` : 'var(--t-content-bg)',
                  transition: 'border 0.15s, background 0.15s, transform 0.1s',
                  transform: isOver && !isDraggingToSame ? 'scale(1.01)' : 'scale(1)',
                  boxShadow: isOver && !isDraggingToSame ? `0 0 0 4px ${cfg.color}18` : 'none',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Cabeçalho */}
                <div style={{
                  padding: '10px 12px 8px',
                  borderBottom: `2px solid ${cfg.color}`,
                  borderRadius: '12px 12px 0 0',
                  background: `${cfg.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, minWidth: 20, height: 18, borderRadius: 999,
                    background: cfg.color, color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: '0 5px',
                  }}>{colCards.length}</span>
                </div>

                {/* Cards */}
                <div style={{ padding: 8, flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 80 }}>
                  {colCards.length === 0 && (
                    <p style={{ fontSize: 10, color: 'var(--t-text-muted)', textAlign: 'center', opacity: 0.5, marginTop: 16 }}>
                      Arraste aqui
                    </p>
                  )}
                  {colCards.map(c => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragging(c)}
                      onDragEnd={() => { setDragging(null); setDragOverCol(null); }}
                      onClick={() => openPreview(c)}
                      style={{
                        background: 'var(--t-card-bg)',
                        border: '1px solid var(--t-card-border)',
                        borderRadius: 10,
                        padding: '9px 10px',
                        cursor: 'grab',
                        opacity: dragging?.id === c.id ? 0.35 : 1,
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.11)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
                    >
                      {/* Número */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Hash size={9} style={{ color: cfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{c.numero_contrato}</span>
                      </div>

                      {/* Empresa */}
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 2, lineHeight: 1.3 }}>
                        {c.razao_social}
                      </p>
                      {c.nome_fantasia && (
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 3 }}>{c.nome_fantasia}</p>
                      )}

                      {/* Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5 }}>
                        {c.plano_contratado && (
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: `${cfg.color}18`, color: cfg.color }}>
                            {c.plano_contratado}
                          </span>
                        )}
                        {c.cidade && (
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: '#EBF4FF', color: '#2E6EAB' }}>
                            {c.cidade}/{c.estado}
                          </span>
                        )}
                      </div>

                      {/* Mensalidade */}
                      {c.mensalidade != null && (
                        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--t-primary)', marginBottom: 3 }}>
                          {fmtBRL(c.mensalidade)}/mês
                        </p>
                      )}

                      {/* Setup */}
                      {c.valor_setup_total != null && (
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 3 }}>
                          Setup: {fmtBRL(c.valor_setup_total)}
                        </p>
                      )}

                      {/* Vendedor */}
                      {c.vendedor_nome && (
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 2 }}>👤 {c.vendedor_nome}</p>
                      )}

                      {/* ZapSign status badge */}
                      {c.zapsign_status && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
                          background: c.zapsign_status === 'signed' ? '#dcfce7' : '#fef3c7',
                          color: c.zapsign_status === 'signed' ? '#16a34a' : '#d97706',
                        }}>
                          ZapSign: {c.zapsign_status}
                        </span>
                      )}

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--t-card-border)' }}>
                        <span style={{ fontSize: 9, color: 'var(--t-text-muted)' }}>
                          {new Date(c.data_contrato).toLocaleDateString('pt-BR')}
                        </span>
                        {c.zapsign_signing_url && (
                          <a href={c.zapsign_signing_url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>
                            Assinar ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Modal detalhe/preview ──────────────────────────────────────── */}
        {selected && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }} onClick={() => setSelected(null)}>
            <div style={{
              background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 720,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>

              {/* Header modal */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_CONFIG[selected.status].color, background: STATUS_CONFIG[selected.status].bg, padding: '2px 8px', borderRadius: 999 }}>
                      {STATUS_CONFIG[selected.status].label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-muted)' }}>#{selected.numero_contrato}</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t-text-primary)', marginTop: 4 }}>{selected.razao_social}</div>
                  {selected.nome_fantasia && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{selected.nome_fantasia}</div>}
                </div>
                <button onClick={() => setSelected(null)} style={{ color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ padding: 22 }}>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 mb-5">
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
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)', fontWeight: 600 }}>{l}</div>
                      <div style={{ fontSize: 13, color: 'var(--t-text-primary)', fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Preview cláusulas */}
                {loadingPrev && <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 16 }}>Gerando preview do contrato...</p>}
                {preview && (
                  <div style={{ background: 'var(--t-content-bg)', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: 'var(--t-text-primary)', fontFamily: 'Georgia, serif' }}>
                    <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)' }}>Preview das Cláusulas Contratuais</p>
                    {preview.identificacao && <p style={{ marginBottom: 10 }}>{preview.identificacao}</p>}
                    {preview.clausula31 && <p style={{ marginBottom: 8 }}>{preview.clausula31}</p>}
                    {preview.clausula33 && <p style={{ marginBottom: 8 }}>{preview.clausula33}</p>}
                    {preview.clausula35 && <p style={{ marginBottom: 8 }}>{preview.clausula35}</p>}
                    {preview.dataLocal && <p style={{ marginBottom: 8, marginTop: 12 }}>{preview.dataLocal}</p>}
                    {preview.assinatura && (
                      <p style={{ marginTop: 8, whiteSpace: 'pre-line', fontWeight: 600 }}>{preview.assinatura}</p>
                    )}
                  </div>
                )}

                {/* Alterar status */}
                <div className="mb-4">
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 8 }}>Mover status</p>
                  <div className="flex flex-wrap gap-2">
                    {KANBAN_ORDER.map(k => {
                      const cfg = STATUS_CONFIG[k];
                      const ativo = selected.status === k;
                      return (
                        <button key={k}
                          onClick={() => { moveStatus(selected, k); setSelected({ ...selected, status: k }); }}
                          style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                            borderColor: ativo ? cfg.color : 'var(--t-card-border)',
                            background: ativo ? cfg.bg : 'transparent',
                            color: ativo ? cfg.color : 'var(--t-text-muted)',
                          }}>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ZapSign */}
                <div style={{ background: '#f5f3ff', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #ede9fe' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>⚡ Integração ZapSign</p>
                  {selected.zapsign_signing_url && (
                    <div style={{ marginBottom: 8 }}>
                      <a href={selected.zapsign_signing_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                        Link de Assinatura ↗
                      </a>
                    </div>
                  )}
                  {selected.zapsign_signed_file_url && (
                    <div style={{ marginBottom: 8 }}>
                      <a href={selected.zapsign_signed_file_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                        📄 Baixar Contrato Assinado ↗
                      </a>
                    </div>
                  )}
                  {selected.sent_to_sign_at && (
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                      Enviado em: {new Date(selected.sent_to_sign_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {selected.signed_at && (
                    <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                      ✅ Assinado em: {new Date(selected.signed_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {zapMsg && (
                    <p style={{ fontSize: 12, marginTop: 8, color: zapMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{zapMsg}</p>
                  )}
                  {!selected.signed_at && selected.status !== 'CANCELADO' && (
                    <button
                      onClick={handleEnviarZapSign}
                      disabled={sendingZap}
                      className="flex items-center gap-1.5 mt-2"
                      style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: '#7c3aed', color: '#fff', border: 'none', cursor: sendingZap ? 'not-allowed' : 'pointer',
                        opacity: sendingZap ? 0.7 : 1,
                      }}>
                      <Send size={11} />
                      {sendingZap ? 'Enviando...' : (selected.zapsign_signing_url ? 'Reenviar para ZapSign' : 'Enviar para ZapSign')}
                    </button>
                  )}
                </div>

              </div>

              {/* Footer modal */}
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--t-card-border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selected.representante_telefone && (
                  <a
                    href={`https://wa.me/55${selected.representante_telefone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5"
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#25D366', color: '#fff', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                )}
                <button onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-1.5"
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', marginLeft: 'auto' }}>
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
