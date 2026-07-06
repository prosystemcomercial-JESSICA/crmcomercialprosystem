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

// ── Configuração de status ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  A_GERAR:             { label: 'A Gerar',              color: 'var(--t-text-muted)', bg: '#f3f4f6', icon: FileCheck2 },
  GERADO:              { label: 'Gerado',               color: '#2563eb', bg: '#dbeafe', icon: FileCheck2 },
  ENVIADO_ASSINATURA:  { label: 'Enviado p/ Assinatura',color: '#7c3aed', bg: '#ede9fe', icon: Send },
  AGUARDANDO_ASSINATURA:{ label: 'Aguardando Assinatura',color: '#d97706', bg: '#fef3c7', icon: Pen },
  ASSINADO:            { label: 'Assinado',             color: '#16a34a', bg: '#dcfce7', icon: CheckCircle },
  PENDENTE_CORRECAO:   { label: 'Pendente Correção',    color: '#dc2626', bg: '#fee2e2', icon: RefreshCw },
  CANCELADO:           { label: 'Cancelado',            color: '#9ca3af', bg: '#f9fafb', icon: X },
  RECUADO:             { label: 'Recuado / Distrato',   color: '#b91c1c', bg: '#fee2e2', icon: RefreshCw },
};

const KANBAN_ORDER = ['A_GERAR','GERADO','ENVIADO_ASSINATURA','AGUARDANDO_ASSINATURA','ASSINADO','PENDENTE_CORRECAO','CANCELADO','RECUADO'];

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
  const [zapMsg, setZapMsg]           = useState('');
  // Revisão/edição dos dados do cliente antes de gerar o contrato
  const [editando, setEditando]   = useState(false);
  const [editForm, setEditForm]   = useState<any>({});
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [editDirty, setEditDirty] = useState(false); // há alterações não salvas?
  const [signedUrl, setSignedUrl]     = useState('');
  const [marcando, setMarcando]       = useState(false);
  // Gerar cadastro do cliente a partir do contrato assinado
  const [showGerarCliente, setShowGerarCliente] = useState(false);
  const [gcForm, setGcForm] = useState<any>({ codigo: '', telefone: '', telefone2: '', email: '', grupo_tecnico: '', segmento: '', observacoes: '' });
  const [gerandoCli, setGerandoCli] = useState(false);
  const [gruposTecnicos, setGruposTecnicos] = useState<string[]>([]);
  const [vendedores, setVendedores]   = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading, router]);

  // Vendedores p/ o seletor de "Revisar dados" (trocar o vendedor do contrato).
  useEffect(() => {
    if (isAuthenticated) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isAuthenticated]);

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
    setEditando(false);
    setSignedUrl(c.zapsign_signed_file_url || '');
    try {
      const res = await apiClient.getContratoPreview(c.id);
      setPreview(res.data.data);
    } catch { /* ignore */ } finally { setLoadingPrev(false); }
  };

  // Abre o formulário de revisão. Busca os dados do contrato COMPLETADOS com o lead
  // de origem (campos vazios preenchidos por CNPJ). Cai no contrato local se falhar.
  const abrirRevisao = async (c: ContratoComercial) => {
    let dados: any = c;
    try {
      const res = await apiClient.getContratoDadosRevisao(c.id);
      dados = res.data?.data || c;
    } catch { /* usa o contrato local */ }
    preencherEditForm(dados);
    setEditDirty(false);
    setEditando(true);
  };

  const preencherEditForm = (c: any) => {
    setEditForm({
      razao_social: c.razao_social || '',
      nome_fantasia: c.nome_fantasia || '',
      cnpj: c.cnpj || '',
      endereco: c.endereco || '',
      numero_endereco: c.numero_endereco || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      estado: c.estado || '',
      cep: c.cep || '',
      representante_nome: c.representante_nome || '',
      representante_cpf: c.representante_cpf || '',
      representante_email: c.representante_email || '',
      representante_telefone: c.representante_telefone || '',
      representante_cargo: c.representante_cargo || '',
      plano_contratado: c.plano_contratado || '',
      mensalidade: c.mensalidade != null ? String(c.mensalidade) : '',
      dia_vencimento: c.dia_vencimento != null ? String(c.dia_vencimento) : '',
      valor_setup_total: c.valor_setup_total != null ? String(c.valor_setup_total) : '',
      vendedor_id: c.vendedor_id || '',
      vendedor_nome: c.vendedor_nome || '',
    });
  };

  // Atualiza um campo da revisão e marca que há alterações não salvas.
  const setCampoEdit = (campo: string, valor: string) => {
    setEditForm((p: any) => ({ ...p, [campo]: valor }));
    setEditDirty(true);
  };

  // Fecha a revisão; se houver alterações não salvas, confirma antes de descartar.
  const fecharRevisao = () => {
    if (editDirty && !confirm('Há alterações não salvas no "Revisar dados". Deseja descartá-las?')) return;
    setEditando(false);
    setEditDirty(false);
  };

  // Fecha o modal do contrato; protege contra perda das alterações da revisão.
  const fecharModal = () => {
    if (editando && editDirty && !confirm('Há alterações não salvas no "Revisar dados". Deseja descartá-las e fechar?')) return;
    setEditando(false);
    setEditDirty(false);
    setSelected(null);
  };

  const salvarRevisao = async () => {
    if (!selected) return;
    if (!editForm.razao_social?.trim()) { console.warn('Razão social é obrigatória.'); return; }
    setSalvandoEdit(true);
    try {
      const payload: any = {
        ...editForm,
        mensalidade: editForm.mensalidade !== '' ? parseFloat(editForm.mensalidade) : undefined,
        dia_vencimento: editForm.dia_vencimento !== '' ? parseInt(editForm.dia_vencimento) : undefined,
        valor_setup_total: editForm.valor_setup_total !== '' ? parseFloat(editForm.valor_setup_total) : undefined,
      };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = undefined; });
      const res = await apiClient.updateContratoComercial(selected.id, payload);
      const atualizado = res.data?.data || { ...selected, ...payload };
      setSelected(atualizado);
      setEditando(false);
      setEditDirty(false);
      load();
    } catch (e: any) {
      console.error('Erro ao salvar os dados.', e);
    } finally { setSalvandoEdit(false); }
  };

  const verPdf = (c: ContratoComercial) => {
    window.open(apiClient.contratoPdfUrl(c.id), '_blank');
  };

  // Fluxo manual: após subir o contrato na ZapSign (painel) e o cliente assinar,
  // a gestão cola o link do documento assinado e marca como Assinado no CRM.
  const abrirGerarCliente = () => {
    if (!selected) return;
    setGcForm({ codigo: '', telefone: (selected as any).representante_telefone || '', telefone2: '', email: (selected as any).representante_email || '', grupo_tecnico: '', segmento: '', observacoes: '' });
    setShowGerarCliente(true);
    // Carrega os grupos técnicos já existentes p/ o dropdown (uma vez).
    if (gruposTecnicos.length === 0) {
      apiClient.getGruposTecnicos().then(r => setGruposTecnicos(r.data?.data || [])).catch(() => {});
    }
  };
  const handleGerarCliente = async () => {
    if (!selected) return;
    setGerandoCli(true);
    try {
      // Resolve o grupo: "+ Novo grupo…" usa o texto digitado; senão, o selecionado.
      const grupoFinal = gcForm.grupo_tecnico === '__novo__' ? (gcForm.grupo_tecnico_novo || '').trim() : gcForm.grupo_tecnico;
      const { grupo_tecnico_novo, ...rest } = gcForm;
      const r = await apiClient.gerarClienteDoContrato(selected.id, { ...rest, grupo_tecnico: grupoFinal });
      setShowGerarCliente(false);
      void 0 // cadastro gerado;
      load();
    } catch (e: any) { console.error('Erro ao gerar cadastro.', e); }
    finally { setGerandoCli(false); }
  };

  const handleMarcarAssinado = async () => {
    if (!selected) return;
    setMarcando(true);
    setZapMsg('');
    try {
      await apiClient.updateContratoComercial(selected.id, {
        status: 'ASSINADO',
        zapsign_status: 'signed',
        zapsign_signed_file_url: signedUrl || undefined,
        signed_at: new Date().toISOString(),
      });
      setZapMsg('✅ Contrato marcado como assinado!');
      const atualizado = { ...selected, status: 'ASSINADO', zapsign_signed_file_url: signedUrl, signed_at: new Date().toISOString() };
      setSelected(atualizado);
      load();
    } catch (e: any) {
      setZapMsg(`❌ ${e?.response?.data?.message || 'Erro ao marcar como assinado'}`);
    } finally { setMarcando(false); }
  };

  // Recuo / distrato: cliente assinou mas desistiu. Sai da meta e estorna a comissão.
  const handleRecuar = async () => {
    if (!selected) return;
    const motivo = prompt('Motivo do recuo / distrato (opcional):') ?? undefined;
    if (!confirm(`Confirmar RECUO do contrato Nº ${selected.numero_contrato}? A venda sai da meta e a comissão é estornada.`)) return;
    setMarcando(true);
    setZapMsg('');
    try {
      await apiClient.recuarContrato(selected.id, motivo);
      setZapMsg('✅ Contrato recuado. Venda removida da meta e comissão estornada.');
      const atualizado = { ...selected, status: 'RECUADO', recuo_motivo: motivo, comissao_vendedor_valor: 0 };
      setSelected(atualizado);
      load();
    } catch (e: any) {
      setZapMsg(`❌ ${e?.response?.data?.message || 'Erro ao recuar o contrato'}`);
    } finally { setMarcando(false); }
  };

  // Marca que o contrato foi enviado manualmente (subido na ZapSign pelo painel).
  const handleMarcarEnviado = async () => {
    if (!selected) return;
    setMarcando(true);
    setZapMsg('');
    try {
      await apiClient.updateContratoComercial(selected.id, { status: 'ENVIADO_ASSINATURA' });
      setZapMsg('✅ Marcado como enviado para assinatura.');
      const atualizado = { ...selected, status: 'ENVIADO_ASSINATURA' };
      setSelected(atualizado);
      load();
    } catch (e: any) {
      setZapMsg(`❌ ${e?.response?.data?.message || 'Erro ao atualizar status'}`);
    } finally { setMarcando(false); }
  };

  // Resumo p/ assinatura (e-mail): copia o texto no padrão da gestão.
  const handleCopiarResumo = async () => {
    if (!selected) return;
    setZapMsg('');
    try {
      const r = await apiClient.getResumoAssinatura(selected.id);
      const texto = r.data?.data?.texto || '';
      await navigator.clipboard.writeText(texto);
      setZapMsg('✅ Resumo copiado! É só colar no e-mail.');
    } catch (e: any) {
      setZapMsg(`❌ ${e?.response?.data?.message || 'Erro ao gerar o resumo'}`);
    }
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

                      {/* Etiqueta: Troca de CNPJ (serviço — não é cliente novo) */}
                      {c.tipo_servico === 'TROCA_CNPJ' && (
                        <span style={{ display: 'inline-block', marginBottom: 4, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#ede9fe', color: '#6d28d9' }}>
                          🔄 Troca de CNPJ (serviço)
                        </span>
                      )}

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
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'var(--t-primary-light)', color: 'var(--t-primary-dark)' }}>
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
          }} onClick={() => fecharModal()}>
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
                <div className="flex items-center gap-2">
                  {/* Revisar / completar dados do cliente (antes de gerar o contrato) */}
                  {selected.status !== 'ASSINADO' && selected.status !== 'RECUADO' && selected.status !== 'CANCELADO' && (
                    <button onClick={() => editando ? fecharRevisao() : abrirRevisao(selected)}
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 12, fontWeight: 600, color: editando ? 'var(--t-text-muted)' : '#2E6EAB', background: editando ? 'transparent' : '#EBF4FF', border: '1px solid #c7d8ec', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                      <Edit3 size={13} /> {editando ? 'Cancelar' : 'Revisar dados'}
                    </button>
                  )}
                  <button onClick={() => fecharModal()} style={{ color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ padding: 22 }}>

                {/* ── Form de revisão (completar/alterar dados do cliente) ── */}
                {editando && (
                  <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: '1px solid #c7d8ec', background: 'var(--t-content-bg)' }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t-text-primary)', marginBottom: 4 }}>Revisar / completar dados do contrato</p>
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 14 }}>Confira e ajuste antes de gerar o contrato. As alterações entram no PDF.</p>

                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '4px 0 8px' }}>Empresa (CONTRATANTE)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Razão social *" full value={editForm.razao_social} onChange={(v: string) => setCampoEdit('razao_social', v)} />
                      <CampoEdit label="Nome fantasia" value={editForm.nome_fantasia} onChange={(v: string) => setCampoEdit('nome_fantasia', v)} />
                      <CampoEdit label="CNPJ" value={editForm.cnpj} onChange={(v: string) => setCampoEdit('cnpj', v)} />
                      <CampoEdit label="Endereço" value={editForm.endereco} onChange={(v: string) => setCampoEdit('endereco', v)} />
                      <CampoEdit label="Nº" value={editForm.numero_endereco} onChange={(v: string) => setCampoEdit('numero_endereco', v)} />
                      <CampoEdit label="Bairro" value={editForm.bairro} onChange={(v: string) => setCampoEdit('bairro', v)} />
                      <CampoEdit label="Cidade" value={editForm.cidade} onChange={(v: string) => setCampoEdit('cidade', v)} />
                      <CampoEdit label="UF" value={editForm.estado} onChange={(v: string) => setCampoEdit('estado', v)} />
                      <CampoEdit label="CEP" value={editForm.cep} onChange={(v: string) => setCampoEdit('cep', v)} />
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '14px 0 8px' }}>Representante legal (assina)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Nome do representante" full value={editForm.representante_nome} onChange={(v: string) => setCampoEdit('representante_nome', v)} />
                      <CampoEdit label="CPF" value={editForm.representante_cpf} onChange={(v: string) => setCampoEdit('representante_cpf', v)} />
                      <CampoEdit label="Cargo" value={editForm.representante_cargo} onChange={(v: string) => setCampoEdit('representante_cargo', v)} />
                      <CampoEdit label="E-mail" value={editForm.representante_email} onChange={(v: string) => setCampoEdit('representante_email', v)} />
                      <CampoEdit label="Telefone / WhatsApp" value={editForm.representante_telefone} onChange={(v: string) => setCampoEdit('representante_telefone', v)} />
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '14px 0 8px' }}>Vendedor responsável (conta na meta dele)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }}>Vendedor</label>
                        <select value={editForm.vendedor_id || ''}
                          onChange={e => { const v = e.target.value; const nome = vendedores.find(x => x.id === v)?.nome || ''; setEditForm((p: any) => ({ ...p, vendedor_id: v, vendedor_nome: nome })); setEditDirty(true); }}
                          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                          style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                          <option value="">{editForm.vendedor_nome ? `Atual: ${editForm.vendedor_nome}` : 'Selecione o vendedor...'}</option>
                          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>Define de quem é a venda — a comissão e a meta vão para esse vendedor.</p>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '14px 0 8px' }}>Plano e valores</div>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoEdit label="Plano" value={editForm.plano_contratado} onChange={(v: string) => setCampoEdit('plano_contratado', v)} />
                      <CampoEdit label="Mensalidade (R$)" type="number" value={editForm.mensalidade} onChange={(v: string) => setCampoEdit('mensalidade', v)} />
                      <CampoEdit label="Dia de vencimento" type="number" value={editForm.dia_vencimento} onChange={(v: string) => setCampoEdit('dia_vencimento', v)} />
                      <CampoEdit label="Setup / instalação (R$)" type="number" value={editForm.valor_setup_total} onChange={(v: string) => setCampoEdit('valor_setup_total', v)} />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => fecharRevisao()} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={salvarRevisao} disabled={salvandoEdit} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer', opacity: salvandoEdit ? 0.7 : 1 }}>
                        {salvandoEdit ? 'Salvando…' : 'Salvar dados'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Info grid */}
                {!editando && (
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
                    ['Comissão Vendedor (15% setup)', selected.status === 'ASSINADO' && selected.comissao_vendedor_valor != null
                      ? `${fmtBRL(selected.comissao_vendedor_valor)} (${selected.comissao_vendedor_pct ?? 15}%)`
                      : (selected.valor_setup_total ? `${fmtBRL((selected.valor_setup_total || 0) * 0.15)} (previsto)` : null)],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)', fontWeight: 600 }}>{l}</div>
                      <div style={{ fontSize: 13, color: 'var(--t-text-primary)', fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
                )}

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

                {/* ── Assinatura do contrato ──────────────────────────────── */}
                <div style={{ background: 'var(--t-content-bg)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--t-card-border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 4 }}>📄 Contrato & Assinatura</p>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    O contrato é gerado a partir do modelo padrão do plano (<strong>{selected.plano_contratado || '—'}</strong>) com os dados da proposta.
                    Baixe o PDF, suba no painel da ZapSign para coletar a assinatura e depois cole aqui o link do documento assinado.
                  </p>

                  {/* Passo 1 — Baixar o PDF (ação principal) */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      onClick={() => verPdf(selected)}
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: 'pointer',
                      }}>
                      <Eye size={14} /> Baixar / Ver PDF do contrato
                    </button>
                    <a
                      href="https://app.zapsign.com.br/conta/documentos" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'var(--t-card-bg)', color: '#7c3aed', border: '1px solid #c4b5fd', textDecoration: 'none',
                      }}>
                      <ExternalLink size={12} /> Abrir painel ZapSign
                    </a>
                  </div>

                  {/* Resumo p/ assinatura (e-mail) — disponível em qualquer status */}
                  <button
                    onClick={handleCopiarResumo}
                    className="flex items-center gap-1.5 mb-3"
                    title="Copia um resumo completo (lead → contrato) no padrão para enviar no e-mail"
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'var(--t-primary-light)', color: 'var(--t-primary)', border: '1px solid var(--t-primary-border)',
                      cursor: 'pointer',
                    }}>
                    📋 Resumo p/ assinatura (copiar)
                  </button>

                  {/* Passo 2 — Marcar como enviado (manual) */}
                  {selected.status !== 'ENVIADO_ASSINATURA' && selected.status !== 'ASSINADO' && selected.status !== 'CANCELADO' && (
                    <button
                      onClick={handleMarcarEnviado}
                      disabled={marcando}
                      className="flex items-center gap-1.5 mb-3"
                      style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'transparent', color: 'var(--t-text-muted)', border: '1px solid var(--t-card-border)',
                        cursor: marcando ? 'not-allowed' : 'pointer',
                      }}>
                      <Send size={11} /> Marcar como enviado p/ assinatura
                    </button>
                  )}

                  {/* Passo 3 — Link do documento assinado + marcar assinado */}
                  {selected.status !== 'CANCELADO' && (
                    <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 12, marginTop: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 5 }}>
                        Link do contrato assinado (ZapSign)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={signedUrl}
                          onChange={e => setSignedUrl(e.target.value)}
                          placeholder="https://app.zapsign.com.br/verificar/..."
                          className="ps-input text-sm"
                          style={{ flex: 1, minWidth: 220 }}
                        />
                        <button
                          onClick={handleMarcarAssinado}
                          disabled={marcando}
                          className="flex items-center gap-1.5"
                          style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: '#16a34a', color: '#fff', border: 'none', cursor: marcando ? 'not-allowed' : 'pointer',
                            opacity: marcando ? 0.7 : 1,
                          }}>
                          <CheckCircle size={13} /> {marcando ? 'Salvando...' : 'Marcar como assinado'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status de assinatura */}
                  {selected.zapsign_signed_file_url && (
                    <div style={{ marginTop: 10 }}>
                      <a href={selected.zapsign_signed_file_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                        📄 Abrir contrato assinado ↗
                      </a>
                    </div>
                  )}
                  {selected.signed_at && selected.status === 'ASSINADO' && (
                    <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 6 }}>
                      ✅ Assinado em: {new Date(selected.signed_at).toLocaleDateString('pt-BR')}
                      {selected.comissao_vendedor_valor != null && (
                        <> · Comissão vendedor: {fmtBRL(selected.comissao_vendedor_valor)}</>
                      )}
                    </p>
                  )}

                  {/* Gerar cadastro do CLIENTE no CRM (contrato assinado) */}
                  {selected.status === 'ASSINADO' && (
                    <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 12, marginTop: 12 }}>
                      {(selected as any).cliente_id ? (
                        <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ Cadastro de cliente já gerado no CRM.</p>
                      ) : !showGerarCliente ? (
                        <button onClick={abrirGerarCliente}
                          className="flex items-center gap-1.5"
                          style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          🏷️ Gerar cadastro do cliente no CRM
                        </button>
                      ) : (
                        <div style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 12 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 2 }}>Gerar cadastro de {selected.razao_social}</p>
                          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 10 }}>Razão, CNPJ, plano, mensalidade e setup vêm do contrato. Informe o código e os contatos.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Código do cliente *</label>
                              <input value={gcForm.codigo} onChange={e => setGcForm((f: any) => ({ ...f, codigo: e.target.value }))} className="ps-input text-sm" placeholder="ex: 1530" /></div>
                            <div><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Grupo técnico</label>
                              {gcForm.grupo_tecnico === '__novo__' ? (
                                <div className="flex gap-1 items-center">
                                  <input autoFocus value={gcForm.grupo_tecnico_novo || ''} onChange={e => setGcForm((f: any) => ({ ...f, grupo_tecnico_novo: e.target.value }))} className="ps-input text-sm" placeholder="Novo grupo, ex: Grupo 6 - Ana" />
                                  <button type="button" onClick={() => setGcForm((f: any) => ({ ...f, grupo_tecnico: '', grupo_tecnico_novo: '' }))} title="Voltar à lista" style={{ fontSize: 11, color: 'var(--t-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>↩</button>
                                </div>
                              ) : (
                                <select value={gcForm.grupo_tecnico} onChange={e => setGcForm((f: any) => ({ ...f, grupo_tecnico: e.target.value }))} className="ps-input text-sm">
                                  <option value="">— selecione —</option>
                                  {gruposTecnicos.map(g => <option key={g} value={g}>{g}</option>)}
                                  <option value="__novo__">+ Novo grupo…</option>
                                </select>
                              )}</div>
                            <div><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Telefone</label>
                              <input value={gcForm.telefone} onChange={e => setGcForm((f: any) => ({ ...f, telefone: e.target.value }))} className="ps-input text-sm" /></div>
                            <div><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Telefone 2</label>
                              <input value={gcForm.telefone2} onChange={e => setGcForm((f: any) => ({ ...f, telefone2: e.target.value }))} className="ps-input text-sm" /></div>
                            <div className="col-span-2"><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>E-mail</label>
                              <input value={gcForm.email} onChange={e => setGcForm((f: any) => ({ ...f, email: e.target.value }))} className="ps-input text-sm" /></div>
                            <div className="col-span-2"><label style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Segmento</label>
                              <input value={gcForm.segmento} onChange={e => setGcForm((f: any) => ({ ...f, segmento: e.target.value }))} className="ps-input text-sm" placeholder="Farmácia, Padaria…" /></div>
                          </div>
                          <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setShowGerarCliente(false)} style={{ padding: '7px 14px', fontSize: 12, color: 'var(--t-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleGerarCliente} disabled={gerandoCli || !gcForm.codigo.trim()}
                              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', opacity: (gerandoCli || !gcForm.codigo.trim()) ? 0.6 : 1 }}>
                              {gerandoCli ? 'Gerando…' : 'Gerar cadastro'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selected.status === 'RECUADO' && (
                    <p style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, marginTop: 6 }}>
                      ↩ Contrato recuado{selected.recuado_at ? ` em ${new Date(selected.recuado_at).toLocaleDateString('pt-BR')}` : ''} · fora da meta
                      {selected.recuo_motivo ? ` · Motivo: ${selected.recuo_motivo}` : ''}
                    </p>
                  )}
                  {zapMsg && (
                    <p style={{ fontSize: 12, marginTop: 8, color: zapMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{zapMsg}</p>
                  )}

                  {/* Recuo / distrato — disponível quando o contrato já foi assinado */}
                  {selected.status === 'ASSINADO' && (
                    <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 10, marginTop: 12 }}>
                      <button
                        onClick={handleRecuar}
                        disabled={marcando}
                        className="flex items-center gap-1.5"
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                          cursor: marcando ? 'not-allowed' : 'pointer',
                        }}>
                        <RefreshCw size={11} /> Recuo / Distrato (cliente desistiu)
                      </button>
                      <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 5 }}>
                        Remove a venda da meta e estorna a comissão do vendedor. Mantém o histórico do contrato.
                      </p>
                    </div>
                  )}

                  {/* Envio automático via API (requer Plano de API ZapSign) — desabilitado */}
                  <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 10, marginTop: 12 }}>
                    <button
                      disabled
                      title="Disponível apenas com o Plano de API da ZapSign contratado"
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed',
                      }}>
                      <Send size={11} /> Envio automático via API (requer Plano de API ZapSign)
                    </button>
                    <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 5 }}>
                      O envio 100% automático fica disponível ao contratar o Plano de API da ZapSign. Por enquanto, use o fluxo manual acima.
                    </p>
                  </div>
                </div>

              </div>

              {/* Footer modal */}
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--t-card-border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selected.representante_telefone && (
                  <a
                    href={`/whatsapp?numero=${selected.representante_telefone.replace(/\D/g, '')}&nome=${encodeURIComponent(selected.razao_social || selected.nome_fantasia || '')}`}
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

function CampoEdit({ label, value, onChange, type = 'text', full = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean;
}) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
        style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}
