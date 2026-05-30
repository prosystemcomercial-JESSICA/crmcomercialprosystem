'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  Plus, Trash2, Edit3, Eye, Copy, MessageSquare, CheckCircle,
  Save, X, Search, ClipboardList, FileText, ExternalLink,
  RefreshCw, History, ArrowRight, ChevronRight,
} from 'lucide-react';

// ── TIPOS ───────────────────────────────────────────────
interface Proposta {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  validade?: string;
  created_at: string;
  lead?: { id: string; nome: string; empresa?: string };
}

interface PropostaComercial {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  maquinas?: number;
  tipo_loja?: string;
  sistema_atual?: string;
  data_virada?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  responsavel_email?: string;
  responsavel_cpf?: string;
  responsavel_cargo?: string;
  responsavel_horario?: string;
  vendedor_nome?: string;
  vendedor_telefone?: string;
  supervisor_nome?: string;
  campanha?: string;
  validade?: string;
  origem?: string;
  plano_selecionado?: string;
  plano_recomendado?: string;
  mensalidade_pro?: number;
  mensalidade_plus?: number;
  modulos_inclusos?: string[];
  servicos_adicionais?: string[];
  valor_implantacao?: number;
  valor_conversao?: number;
  desconto?: number;
  valor_final?: number;
  entrada?: number;
  parcelas?: number;
  valor_parcela?: number;
  data_vencimento?: string;
  observacao_cobranca?: string;
  condicao_especial?: string;
  titulo_proposta?: string;
  frase_hero?: string;
  texto_valor?: string;
  observacoes?: string;
  status: string;
  public_token?: string;
  created_at: string;
  // Commission fields
  comissao_vendedor_pct?: number;
  comissao_vendedor_valor?: number;
  comissao_supervisor_pct?: number;
  comissao_supervisor_valor?: number;
  comissao_confirmada?: boolean;
  data_aceite?: string;
}

// ── CONSTANTES ──────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  ENVIADA: 'bg-blue-100 text-blue-700',
  VISUALIZADA: 'bg-purple-100 text-purple-700',
  ACEITA: 'bg-green-100 text-green-700',
  RECUSADA: 'bg-red-100 text-red-700',
  EXPIRADA: 'bg-orange-100 text-orange-700',
};

const STATUS_COM: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO:              { label: 'Rascunho',           color: '#6b7280', bg: '#f3f4f6' },
  ENVIADA:               { label: 'Enviada',             color: '#2563eb', bg: '#dbeafe' },
  EM_NEGOCIACAO:         { label: 'Em Negociação',       color: '#d97706', bg: '#fef3c7' },
  ACEITA:                { label: 'Aceita',              color: '#16a34a', bg: '#dcfce7' },
  RECUSADA:              { label: 'Recusada',            color: '#dc2626', bg: '#fee2e2' },
  PERDIDA:               { label: 'Perdida',             color: '#9ca3af', bg: '#f9fafb' },
  CONTRATO_EM_GERACAO:   { label: 'Contrato em Geração', color: '#7c3aed', bg: '#ede9fe' },
  CONTRATO_ENVIADO:      { label: 'Contrato Enviado',    color: '#0891b2', bg: '#cffafe' },
  CONTRATO_ASSINADO:     { label: 'Contrato Assinado',   color: '#15803d', bg: '#bbf7d0' },
};

const KANBAN_COLUMNS = [
  { key: 'RASCUNHO',            label: 'Proposta Gerada',       color: '#6b7280' },
  { key: 'ENVIADA',             label: 'Enviada ao Cliente',    color: '#2563eb' },
  { key: 'EM_NEGOCIACAO',       label: 'Em Negociação',         color: '#d97706' },
  { key: 'ACEITA',              label: 'Aceita',                color: '#16a34a' },
  { key: 'CONTRATO_EM_GERACAO', label: 'Contrato em Geração',   color: '#7c3aed' },
  { key: 'CONTRATO_ENVIADO',    label: 'Contrato Enviado',      color: '#0891b2' },
  { key: 'CONTRATO_ASSINADO',   label: 'Contrato Assinado',     color: '#15803d' },
  { key: 'PERDIDA',             label: 'Perdida / Recusada',    color: '#9ca3af' },
];

const MODULOS = ['Frente de Caixa','Estoque','Financeiro','Relatórios','Multi-empresa','Controle de Acesso','Vendas Online','Delivery','NFe/NFCe','SAT/MFE'];
const SERVICOS = ['TEF','Pacote Fiscal','Dashboard','WhatsApp / Mensageria','Imendes / Avant','Migração / Conversão de Dados','Treinamento','Suporte Prioritário'];
const SEGMENTOS = ['Varejo','Supermercado','Farmácia','Padaria','Restaurante','Posto de Combustível','Autopeças','Outro'];

// Planos disponíveis por segmento: Farmácia usa a linha Farma; os demais (varejo
// geral, padaria, etc.) usam MEI + Loja. MEI = plano único para pequenas empresas.
const PLANOS_FARMA = ['Farma Basic', 'Farma Pro', 'Farma Plus'];
const PLANOS_LOJA  = ['MEI', 'Loja Basic', 'Loja Pro', 'Loja Plus'];
const planosPorSegmento = (seg?: string): string[] =>
  /farm/i.test(seg || '') ? PLANOS_FARMA : PLANOS_LOJA;
const TIPOS_LOJA = ['Nova Implantação','Migração','Upgrade','Filial','Reativação'];
const ORIGENS = ['Indicação','Prospecção','WhatsApp','Visita','Tráfego Pago','Cliente Antigo','Evento'];
const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const BLANK_COM = {
  razao_social:'',nome_fantasia:'',cnpj:'',segmento:'',cidade:'',estado:'',maquinas:'',
  tipo_loja:'',sistema_atual:'',data_virada:'',responsavel_nome:'',responsavel_telefone:'',
  responsavel_email:'',responsavel_cpf:'',responsavel_cargo:'',responsavel_horario:'',
  vendedor_nome:'',vendedor_telefone:'',supervisor_nome:'',campanha:'',validade:'',origem:'',
  plano_selecionado:'',plano_recomendado:'',mensalidade_pro:'',mensalidade_plus:'',
  modulos_inclusos:[] as string[],servicos_adicionais:[] as string[],
  valor_implantacao:'',valor_conversao:'',desconto:'',valor_final:'',entrada:'',
  parcelas:'',valor_parcela:'',data_vencimento:'',observacao_cobranca:'',condicao_especial:'',
  titulo_proposta:'',frase_hero:'',texto_valor:'',observacoes:'',status:'RASCUNHO',
};

const emptyForm = { lead_id:'',titulo:'',descricao:'',valor:'',validade:'',condicoes:'',observacoes:'' };
const fmtBRL = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

const MENSAGENS_PROPOSTA: Record<string, {titulo:string;hero:string;valor:string}[]> = {
  farmacia: [
    { titulo:"Farmácia com mais controle e menos perda", hero:"Sua farmácia merece mais controle, menos perdas e decisões mais inteligentes.", valor:"A Prosystem é uma solução ideal para farmácias que precisam controlar vendas, estoque, caixa, compras e indicadores com mais segurança. Com o Plano Plus, o cliente ganha visão gerencial, relatórios estratégicos, suporte ativo e ferramentas que ajudam a reduzir perdas e melhorar a operação todos os dias." },
    { titulo:"Gestão inteligente para drogarias", hero:"Transforme sua drogaria em uma operação mais rápida, segura e inteligente.", valor:"A Prosystem ajuda drogarias a organizar a rotina do balcão ao financeiro, integrando vendas, estoque, compras e relatórios. O Plano Plus amplia essa gestão com dashboard, indicadores e recursos que facilitam decisões mais rápidas e reduzem retrabalho." },
    { titulo:"Mais velocidade no balcão e no caixa", hero:"Venda mais rápido, atenda melhor e tenha mais controle da sua farmácia.", valor:"Para farmácias, velocidade no atendimento e segurança nas informações são essenciais. A Prosystem oferece um sistema preparado para melhorar o fluxo de vendas, reduzir falhas operacionais e garantir mais clareza sobre estoque, caixa e resultados." },
    { titulo:"Farmácia preparada para crescer", hero:"Sua farmácia pronta para crescer com controle, suporte e tecnologia.", valor:"A Prosystem acompanha o crescimento da farmácia com recursos que organizam a operação, facilitam a gestão e dão mais segurança ao empresário. Com suporte ativo das 7h às 22h e treinamento de 5 meses para novos clientes, a implantação acontece com mais tranquilidade." },
    { titulo:"Decisões com dados reais", hero:"Pare de decidir no escuro. Tenha dados reais sobre a sua farmácia.", valor:"O Plano Plus da Prosystem entrega informações mais claras sobre vendas, estoque, desempenho e oportunidades. Isso permite que o cliente acompanhe a operação com mais precisão e tome decisões baseadas em dados, não em achismos." },
    { titulo:"Controle completo da operação farmacêutica", hero:"Controle vendas, estoque, caixa e resultados em uma única solução.", valor:"A Prosystem centraliza as principais rotinas da farmácia em um sistema completo, facilitando o acompanhamento da operação e reduzindo tarefas manuais. O cliente ganha mais produtividade, organização e segurança na rotina diária." },
    { titulo:"Menos ruptura e mais oportunidade de venda", hero:"Evite perdas de venda com uma gestão de estoque mais inteligente.", valor:"Com ferramentas de controle, relatórios e indicadores, a Prosystem ajuda a farmácia a identificar produtos parados, falta de itens, oportunidades de compra e pontos de melhoria no estoque. O Plano Plus fortalece essa visão com recursos gerenciais." },
    { titulo:"Farmácia mais competitiva", hero:"Mais gestão para sua farmácia vender melhor e competir com mais força.", valor:"Em um mercado competitivo, a farmácia precisa de tecnologia para controlar margens, compras, estoque e atendimento. A Prosystem entrega uma solução completa para tornar a operação mais profissional, ágil e preparada para crescer." },
    { titulo:"Suporte próximo para a rotina da farmácia", hero:"Tecnologia forte com suporte humano para sua farmácia não parar.", valor:"Além do sistema, a Prosystem entrega suporte ativo, imediato e de fácil acesso, com técnicos preparados para auxiliar o cliente das 7h às 22h. Para novos clientes, o treinamento de 5 meses ajuda a equipe a usar melhor o sistema e aproveitar mais os recursos." },
    { titulo:"Plano Plus para farmácias exigentes", hero:"O Plano Plus leva sua farmácia para uma gestão mais estratégica.", valor:"O Plano Plus é indicado para farmácias que querem mais do que operar vendas. Ele oferece recursos para acompanhar indicadores, entender resultados, melhorar processos e ter uma visão mais completa da empresa, com apoio da equipe Prosystem em toda a jornada." },
  ],
  padaria: [
    { titulo:"Padaria com mais controle e menos desperdício", hero:"Sua padaria merece mais controle, menos desperdício e mais resultado.", valor:"A Prosystem é ideal para padarias que precisam controlar vendas, estoque, produção, compras, caixa e financeiro com mais clareza. O Plano Plus ajuda o cliente a acompanhar indicadores e tomar decisões melhores para reduzir perdas e aumentar a rentabilidade." },
    { titulo:"Gestão inteligente para panificadoras", hero:"Transforme sua padaria em uma operação mais organizada e lucrativa.", valor:"A rotina de uma padaria exige controle constante de produção, insumos, vendas e fluxo de caixa. Com a Prosystem, o cliente consegue organizar melhor esses processos, reduzir retrabalho e ter uma visão mais segura do negócio." },
    { titulo:"Mais agilidade no balcão e no caixa", hero:"Atenda melhor, venda mais rápido e controle sua padaria com segurança.", valor:"A Prosystem ajuda padarias a melhorarem o atendimento no balcão e no caixa, mantendo as informações de vendas, estoque e financeiro integradas. Isso reduz erros, melhora a produtividade da equipe e facilita a gestão diária." },
    { titulo:"Padaria preparada para crescer", hero:"Sua padaria pronta para crescer com tecnologia, suporte e gestão.", valor:"Com a Prosystem, a padaria passa a contar com uma solução estruturada para acompanhar o crescimento do negócio. O suporte ativo das 7h às 22h e o treinamento de 5 meses para novos clientes tornam a implantação mais segura e assistida." },
    { titulo:"Controle de produção e vendas", hero:"Tenha mais clareza sobre produção, vendas, estoque e resultados.", valor:"A Prosystem auxilia padarias no controle da operação, permitindo acompanhar vendas, produtos, insumos e resultados com mais organização. O Plano Plus fortalece essa gestão com recursos gerenciais e visão mais estratégica." },
    { titulo:"Menos perda, mais margem", hero:"Reduza perdas e acompanhe melhor a margem da sua padaria.", valor:"Em padarias, pequenos desperdícios podem comprometer o resultado. A Prosystem ajuda o cliente a acompanhar estoque, compras, vendas e relatórios, facilitando a identificação de pontos de perda e oportunidades de melhoria." },
    { titulo:"Gestão completa para padarias modernas", hero:"Uma solução completa para padarias que querem evoluir a gestão.", valor:"A Prosystem integra rotinas importantes da padaria em um sistema único, ajudando no controle de caixa, estoque, vendas, financeiro e relatórios. Com o Plano Plus, o cliente ganha mais inteligência para acompanhar o desempenho da empresa." },
    { titulo:"Decisões com dados reais", hero:"Pare de decidir no improviso. Veja sua padaria com dados reais.", valor:"O Plano Plus permite que o cliente acompanhe melhor os indicadores da padaria, entenda o comportamento das vendas e identifique oportunidades de melhoria. Isso torna a gestão mais profissional e menos dependente de controles manuais." },
    { titulo:"Suporte próximo para a rotina da padaria", hero:"Sistema completo com suporte humano para sua padaria não parar.", valor:"A Prosystem oferece suporte ativo, imediato e de fácil acesso, com técnicos preparados para auxiliar o cliente das 7h às 22h. Além disso, novos clientes contam com treinamento de 5 meses para usar melhor o sistema e adaptar a equipe." },
    { titulo:"Plano Plus para padarias que querem mais gestão", hero:"O Plano Plus leva sua padaria para uma gestão mais estratégica.", valor:"O Plano Plus é indicado para padarias que desejam mais controle, análise e segurança na tomada de decisão. Com recursos gerenciais, suporte próximo e ferramentas de acompanhamento, o cliente passa a ter uma visão mais completa da operação." },
  ],
};
const parseNum = (v: string) => v ? parseFloat(v) : undefined;

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// ── COMPONENTE AUXILIAR ──────────────────────────────────
function FormField({ label, children, col }: { label: string; children: React.ReactNode; col?: number }) {
  return (
    <div style={{ gridColumn: col === 2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────
export default function PropostasPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'leads' | 'gerador' | 'kanban'>('gerador');

  // ── Estado propostas de lead ───────────────
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [statsLead, setStatsLead] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showContratoModal, setShowContratoModal] = useState<string | null>(null);
  const [formLead, setFormLead] = useState<any>(emptyForm);
  const [contratoForm, setContratoForm] = useState({ data_inicio: '', data_fim: '', recorrencia: 'MENSAL' });
  const [savingLead, setSavingLead] = useState(false);
  const [errorLead, setErrorLead] = useState('');

  // ── Estado gerador comercial ───────────────
  const [propCom, setPropCom] = useState<PropostaComercial[]>([]);
  const [statsCom, setStatsCom] = useState<any>({});
  const [loadingCom, setLoadingCom] = useState(true);
  const [savingCom, setSavingCom] = useState(false);
  const [showFormCom, setShowFormCom] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_COM });
  const [activeSection, setActiveSection] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [previewProposta, setPreviewProposta] = useState<PropostaComercial | null>(null);
  const [copied, setCopied] = useState(false);

  // Renegotiation modal state
  const [renegProposta, setRenegProposta] = useState<PropostaComercial | null>(null);
  const [renegForm, setRenegForm] = useState<any>({});
  const [renegSaving, setRenegSaving] = useState(false);

  // History modal state
  const [historicoProposta, setHistoricoProposta] = useState<PropostaComercial | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Message template selectors (Conteúdo section)
  const [modeloSegmento, setModeloSegmento] = useState('');
  const [modeloIndex, setModeloIndex] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  // ── Fetch lead proposals ───────────────────
  const fetchLeadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const [propRes, statsRes, leadsRes] = await Promise.all([
        apiClient.getPropostas(params),
        apiClient.getPropostasStats(),
        apiClient.getLeads({ limit: 100, status: 'QUALIFICADO' })
      ]);
      setPropostas(propRes.data.data.propostas);
      setStatsLead(statsRes.data.data);
      setLeads(leadsRes.data.data.leads);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, [isAuthenticated, statusFilter]);

  // ── Fetch propostas comerciais ─────────────
  const fetchComData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingCom(true);
    try {
      const res = await apiClient.getPropostasComerciais({ status: filterStatus || undefined });
      setPropCom(res.data.data.propostas || []);
      setStatsCom(res.data.data.stats || {});
    } catch { /* ignore */ }
    finally { setLoadingCom(false); }
  }, [isAuthenticated, filterStatus]);

  useEffect(() => { fetchLeadData(); }, [fetchLeadData]);
  useEffect(() => { fetchComData(); }, [fetchComData]);

  // ── Handlers lead proposals ────────────────
  const handleSaveLead = async () => {
    setSavingLead(true); setErrorLead('');
    try {
      const payload: any = { ...formLead, valor: parseFloat(formLead.valor) };
      if (payload.validade) payload.validade = new Date(payload.validade).toISOString();
      else delete payload.validade;
      await apiClient.createProposta(payload);
      setShowModal(false); fetchLeadData();
    } catch (e: any) { setErrorLead(e?.response?.data?.message || 'Erro ao salvar'); }
    finally { setSavingLead(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await apiClient.updateProposta(id, { status }); fetchLeadData(); }
    catch (e) { console.error(e); }
  };

  const handleConverterContrato = async () => {
    if (!showContratoModal) return;
    setSavingLead(true);
    try {
      const payload: any = { ...contratoForm, data_inicio: new Date(contratoForm.data_inicio).toISOString() };
      if (payload.data_fim) payload.data_fim = new Date(payload.data_fim).toISOString(); else delete payload.data_fim;
      await apiClient.converterContrato(showContratoModal, payload);
      setShowContratoModal(null); fetchLeadData();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao converter'); }
    finally { setSavingLead(false); }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('Remover esta proposta?')) return;
    try { await apiClient.deleteProposta(id); fetchLeadData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
  };

  // ── Handlers gerador comercial ─────────────
  const openNew = () => {
    setEditingId(null);
    setForm({
      ...BLANK_COM,
      vendedor_nome: user?.nome || '',
    });
    setActiveSection(0);
    setShowFormCom(true);
  };

  const openEdit = (p: PropostaComercial) => {
    setEditingId(p.id);
    setForm({
      razao_social: p.razao_social || '',
      nome_fantasia: p.nome_fantasia || '',
      cnpj: p.cnpj || '',
      segmento: p.segmento || '',
      cidade: p.cidade || '',
      estado: p.estado || '',
      maquinas: p.maquinas?.toString() || '',
      tipo_loja: p.tipo_loja || '',
      sistema_atual: p.sistema_atual || '',
      data_virada: p.data_virada || '',
      responsavel_nome: p.responsavel_nome || '',
      responsavel_telefone: p.responsavel_telefone || '',
      responsavel_email: p.responsavel_email || '',
      responsavel_cpf: p.responsavel_cpf || '',
      responsavel_cargo: p.responsavel_cargo || '',
      responsavel_horario: p.responsavel_horario || '',
      vendedor_nome: p.vendedor_nome || '',
      vendedor_telefone: p.vendedor_telefone || '',
      supervisor_nome: p.supervisor_nome || '',
      campanha: p.campanha || '',
      validade: p.validade ? p.validade.split('T')[0] : '',
      origem: p.origem || '',
      plano_selecionado: p.plano_selecionado || '',
      plano_recomendado: p.plano_recomendado || '',
      mensalidade_pro: p.mensalidade_pro?.toString() || '',
      mensalidade_plus: p.mensalidade_plus?.toString() || '',
      modulos_inclusos: p.modulos_inclusos || [],
      servicos_adicionais: p.servicos_adicionais || [],
      valor_implantacao: p.valor_implantacao?.toString() || '',
      valor_conversao: p.valor_conversao?.toString() || '',
      desconto: p.desconto?.toString() || '',
      valor_final: p.valor_final?.toString() || '',
      entrada: p.entrada?.toString() || '',
      parcelas: p.parcelas?.toString() || '',
      valor_parcela: p.valor_parcela?.toString() || '',
      data_vencimento: p.data_vencimento || '',
      observacao_cobranca: p.observacao_cobranca || '',
      condicao_especial: p.condicao_especial || '',
      titulo_proposta: p.titulo_proposta || '',
      frase_hero: p.frase_hero || '',
      texto_valor: p.texto_valor || '',
      observacoes: p.observacoes || '',
      status: p.status || 'RASCUNHO',
    });
    setActiveSection(0); setShowFormCom(true);
  };

  const handleSaveCom = async () => {
    if (!form.razao_social.trim()) { alert('Razão social é obrigatória'); return; }
    setSavingCom(true);
    try {
      const payload: any = {
        ...form,
        maquinas: parseNum(form.maquinas as string),
        mensalidade_pro: parseNum(form.mensalidade_pro as string),
        mensalidade_plus: parseNum(form.mensalidade_plus as string),
        valor_implantacao: parseNum(form.valor_implantacao as string),
        valor_conversao: parseNum(form.valor_conversao as string),
        desconto: parseNum(form.desconto as string),
        valor_final: parseNum(form.valor_final as string) ?? (valorFinalCalc > 0 ? valorFinalCalc : undefined),
        entrada: parseNum(form.entrada as string),
        parcelas: form.parcelas ? parseInt(form.parcelas as string) : undefined,
        valor_parcela: parseNum(form.valor_parcela as string) ?? (parcelaCalc > 0 ? parcelaCalc : undefined),
        validade: form.validade ? new Date(form.validade).toISOString() : undefined,
      };
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });

      if (editingId) {
        await apiClient.updatePropostaComercial(editingId, payload);
      } else {
        await apiClient.createPropostaComercial(payload);
      }
      setShowFormCom(false); fetchComData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao salvar proposta');
    } finally { setSavingCom(false); }
  };

  const handleDeleteCom = async (id: string) => {
    if (!confirm('Excluir esta proposta?')) return;
    await apiClient.deletePropostaComercial(id);
    fetchComData();
    setPreviewProposta(null);
  };

  const handleStatusCom = async (id: string, status: string) => {
    await apiClient.updatePropostaComercial(id, { status });
    fetchComData();
  };

  const openRenegociar = (p: PropostaComercial) => {
    setRenegProposta(p);
    setRenegForm({
      valor_implantacao: p.valor_implantacao?.toString() || '',
      valor_conversao: p.valor_conversao?.toString() || '',
      desconto: p.desconto?.toString() || '',
      entrada: p.entrada?.toString() || '',
      parcelas: p.parcelas?.toString() || '',
      data_vencimento: p.data_vencimento || '',
      validade: p.validade ? p.validade.split('T')[0] : '',
      plano_selecionado: p.plano_selecionado || '',
      mensalidade_pro: p.mensalidade_pro?.toString() || '',
      mensalidade_plus: p.mensalidade_plus?.toString() || '',
      observacoes: p.observacoes || '',
      motivo: '',
    });
  };

  const handleRenegociar = async () => {
    if (!renegProposta || !renegForm.motivo?.trim()) {
      alert('Informe o motivo da renegociação');
      return;
    }
    setRenegSaving(true);
    try {
      const payload: any = {
        motivo: renegForm.motivo,
        valor_implantacao: renegForm.valor_implantacao ? parseFloat(renegForm.valor_implantacao) : undefined,
        valor_conversao: renegForm.valor_conversao ? parseFloat(renegForm.valor_conversao) : undefined,
        desconto: renegForm.desconto ? parseFloat(renegForm.desconto) : undefined,
        entrada: renegForm.entrada ? parseFloat(renegForm.entrada) : undefined,
        parcelas: renegForm.parcelas ? parseInt(renegForm.parcelas) : undefined,
        data_vencimento: renegForm.data_vencimento || undefined,
        validade: renegForm.validade ? new Date(renegForm.validade).toISOString() : undefined,
        plano_selecionado: renegForm.plano_selecionado || undefined,
        mensalidade_pro: renegForm.mensalidade_pro ? parseFloat(renegForm.mensalidade_pro) : undefined,
        mensalidade_plus: renegForm.mensalidade_plus ? parseFloat(renegForm.mensalidade_plus) : undefined,
        observacoes: renegForm.observacoes || undefined,
      };
      Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
      await apiClient.renegociarProposta(renegProposta.id, payload);
      setRenegProposta(null);
      fetchComData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao renegociar');
    } finally {
      setRenegSaving(false);
    }
  };

  const openHistorico = async (p: PropostaComercial) => {
    setHistoricoProposta(p);
    setLoadingHistorico(true);
    try {
      const res = await apiClient.getPropostaHistorico(p.id);
      setHistorico(res.data.data || []);
    } catch { setHistorico([]); }
    finally { setLoadingHistorico(false); }
  };

  const handleCopyLink = async (p: PropostaComercial) => {
    if (!p.public_token) return;
    await navigator.clipboard.writeText(`${BASE_URL}/p/${p.public_token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleWpp = (p: PropostaComercial) => {
    const tel = (p.vendedor_telefone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá, quero aceitar a proposta da Prosystem para ${p.razao_social}. Podemos dar sequência. Seguem meus dados: Nome completo, CPF e e-mail.`);
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
  };

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleList = (k: 'modulos_inclusos' | 'servicos_adicionais', val: string) => {
    setForm(f => {
      const arr = f[k] as string[];
      return { ...f, [k]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  // Auto-calc
  const implantacao = parseNum(form.valor_implantacao as string) || 0;
  const conversao = parseNum(form.valor_conversao as string) || 0;
  const desconto = parseNum(form.desconto as string) || 0;
  const valorFinalCalc = implantacao + conversao - desconto;
  const entrada = parseNum(form.entrada as string) || 0;
  const parcelas = parseInt(form.parcelas as string) || 0;
  const saldo = valorFinalCalc - entrada;
  const parcelaCalc = parcelas > 0 ? parseFloat((saldo / parcelas).toFixed(2)) : 0;

  const filtered = propCom.filter(p => {
    const s = search.toLowerCase();
    return !s || p.razao_social.toLowerCase().includes(s) || (p.vendedor_nome || '').toLowerCase().includes(s);
  });

  const sections = ['Empresa','Responsável','Comercial','Plano & Produtos','Valores','Conteúdo'];

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--t-card-border)', marginBottom: 28 }}>
          <button onClick={() => setTab('gerador')} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'transparent',
            borderBottom: tab === 'gerador' ? '2px solid var(--t-primary)' : '2px solid transparent',
            color: tab === 'gerador' ? 'var(--t-primary)' : 'var(--t-text-muted)',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: -2,
          }}>
            <ClipboardList size={15} /> Gerador de Proposta
          </button>
          <button onClick={() => setTab('kanban')} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'transparent',
            borderBottom: tab === 'kanban' ? '2px solid var(--t-primary)' : '2px solid transparent',
            color: tab === 'kanban' ? 'var(--t-primary)' : 'var(--t-text-muted)',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: -2,
          }}>
            <ArrowRight size={15} /> Kanban
          </button>
          <button onClick={() => setTab('leads')} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'transparent',
            borderBottom: tab === 'leads' ? '2px solid var(--t-primary)' : '2px solid transparent',
            color: tab === 'leads' ? 'var(--t-primary)' : 'var(--t-text-muted)',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: -2,
          }}>
            <FileText size={15} /> Propostas de Lead
          </button>
        </div>

        {/* ══════════════════ ABA GERADOR ══════════════════ */}
        {tab === 'gerador' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t-text-primary)' }}>Gerador de Proposta Comercial</h1>
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 2 }}>Crie propostas profissionais para novos clientes</p>
              </div>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--t-primary)' }}>
                <Plus size={15} /> Nova Proposta
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Total',      value: statsCom.total || 0,         color: '#6b7280' },
                { label: 'Rascunho',   value: statsCom.rascunho || 0,      color: '#6b7280' },
                { label: 'Enviadas',   value: statsCom.enviada || 0,       color: '#2563eb' },
                { label: 'Negociação', value: statsCom.em_negociacao || 0, color: '#d97706' },
                { label: 'Aceitas',    value: statsCom.aceita || 0,        color: '#16a34a' },
              ].map(s => (
                <div key={s.label} className="ps-card p-3 rounded-xl text-center">
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative">
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa ou vendedor..."
                  className="ps-input text-sm" style={{ width: 240, paddingLeft: 30 }} />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ps-input text-sm" style={{ width: 160 }}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_COM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Tabela */}
            <div className="ps-card rounded-xl overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--t-table-header)', borderBottom: '1px solid var(--t-card-border)' }}>
                    {['Empresa','Segmento','Plano','Valor Final','Vendedor','Validade','Status','Ações'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingCom ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)' }}>Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--t-text-muted)' }}>
                      <ClipboardList size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                      Nenhuma proposta encontrada.<br />
                      <button onClick={openNew} style={{ marginTop: 12, color: 'var(--t-primary)', fontWeight: 600, fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        + Criar primeira proposta
                      </button>
                    </td></tr>
                  ) : filtered.map(p => {
                    const st = STATUS_COM[p.status] || STATUS_COM.RASCUNHO;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-primary)' }}>{p.razao_social}</div>
                          {p.nome_fantasia && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{p.nome_fantasia}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>{p.segmento || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)' }}>{p.plano_selecionado || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--t-primary)' }}>{fmtBRL(p.valor_final)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>{p.vendedor_nome || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>
                          {p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setPreviewProposta(p)} title="Ver"
                              style={{ padding: 5, borderRadius: 6, color: 'var(--t-primary)', background: 'var(--t-primary-light)', border: 'none', cursor: 'pointer' }}>
                              <Eye size={13} />
                            </button>
                            <button onClick={() => openEdit(p)} title="Editar"
                              style={{ padding: 5, borderRadius: 6, color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', cursor: 'pointer' }}>
                              <Edit3 size={13} />
                            </button>
                            {p.public_token && (
                              <button onClick={() => handleCopyLink(p)} title="Copiar link"
                                style={{ padding: 5, borderRadius: 6, color: '#16a34a', background: '#dcfce7', border: 'none', cursor: 'pointer' }}>
                                <Copy size={13} />
                              </button>
                            )}
                            {p.vendedor_telefone && (
                              <button onClick={() => handleWpp(p)} title="WhatsApp"
                                style={{ padding: 5, borderRadius: 6, color: '#16a34a', background: '#dcfce7', border: 'none', cursor: 'pointer' }}>
                                <MessageSquare size={13} />
                              </button>
                            )}
                            {p.public_token && (
                              <button onClick={() => window.open(`/p/${p.public_token}`, '_blank')} title="Abrir proposta"
                                style={{ padding: 5, borderRadius: 6, color: '#6366f1', background: '#ede9fe', border: 'none', cursor: 'pointer' }}>
                                <ExternalLink size={13} />
                              </button>
                            )}
                            <button onClick={() => openRenegociar(p)} title="Renegociar"
                              style={{ padding: 5, borderRadius: 6, color: '#7c3aed', background: '#ede9fe', border: 'none', cursor: 'pointer' }}>
                              <RefreshCw size={13} />
                            </button>
                            <button onClick={() => openHistorico(p)} title="Histórico"
                              style={{ padding: 5, borderRadius: 6, color: '#0891b2', background: '#cffafe', border: 'none', cursor: 'pointer' }}>
                              <History size={13} />
                            </button>
                            <button onClick={() => handleDeleteCom(p.id)} title="Excluir"
                              style={{ padding: 5, borderRadius: 6, color: '#dc2626', background: '#fee2e2', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════ ABA KANBAN ══════════════════ */}
        {tab === 'kanban' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t-text-primary)' }}>Kanban Comercial</h1>
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 2 }}>Acompanhe o pipeline de propostas por etapa</p>
              </div>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--t-primary)' }}>
                <Plus size={15} /> Nova Proposta
              </button>
            </div>

            {loadingCom ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t-text-muted)' }}>Carregando...</div>
            ) : (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
                {KANBAN_COLUMNS.map(col => {
                  const cards = propCom.filter(p =>
                    col.key === 'PERDIDA'
                      ? (p.status === 'PERDIDA' || p.status === 'RECUSADA')
                      : p.status === col.key
                  );
                  return (
                    <div key={col.key} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Column header */}
                      <div style={{ padding: '8px 12px', borderRadius: 8, background: col.color + '18', borderLeft: `3px solid ${col.color}`, marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 1 }}>{cards.length} proposta{cards.length !== 1 ? 's' : ''}</div>
                      </div>
                      {/* Cards */}
                      {cards.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--t-text-muted)', fontSize: 12, background: 'var(--t-content-bg)', borderRadius: 8, border: '1px dashed var(--t-card-border)' }}>
                          Vazio
                        </div>
                      )}
                      {cards.map(p => {
                        const st = STATUS_COM[p.status] || STATUS_COM.RASCUNHO;
                        return (
                          <div key={p.id} className="ps-card" style={{ borderRadius: 10, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                            onClick={() => setPreviewProposta(p)}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t-text-primary)', marginBottom: 4 }}>{p.razao_social}</div>
                            {p.nome_fantasia && <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>{p.nome_fantasia}</div>}
                            <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6 }}>{p.plano_selecionado || '—'} • {p.segmento || '—'}</div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--t-primary)', marginBottom: 6 }}>{fmtBRL(p.valor_final)}</div>
                            {(p.mensalidade_plus || p.mensalidade_pro) && (
                              <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6 }}>
                                Mensalidade: {fmtBRL(p.mensalidade_plus || p.mensalidade_pro)}/mês
                              </div>
                            )}
                            {p.vendedor_nome && (
                              <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Vendedor: <b>{p.vendedor_nome}</b></div>
                            )}
                            {p.supervisor_nome && (
                              <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Supervisor: <b>{p.supervisor_nome}</b></div>
                            )}
                            {p.comissao_vendedor_valor != null && p.comissao_vendedor_valor > 0 && (
                              <div style={{ fontSize: 11, marginTop: 4, color: p.comissao_confirmada ? '#15803d' : '#d97706', fontWeight: 600 }}>
                                Comissão: {fmtBRL(p.comissao_vendedor_valor)} {p.comissao_confirmada ? '✓' : '(prevista)'}
                              </div>
                            )}
                            {p.validade && (
                              <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>
                                Válida até {new Date(p.validade).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--t-card-border)', paddingTop: 8 }}
                              onClick={e => e.stopPropagation()}>
                              <button onClick={() => openRenegociar(p)} title="Renegociar"
                                style={{ flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                <RefreshCw size={10} /> Renegociar
                              </button>
                              <button onClick={() => openHistorico(p)} title="Histórico"
                                style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, color: '#0891b2', background: '#cffafe', border: 'none', cursor: 'pointer' }}>
                                <History size={10} />
                              </button>
                              {p.public_token && (
                                <button onClick={() => window.open(`/p/${p.public_token}`, '_blank')} title="Abrir proposta"
                                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, color: '#2563eb', background: '#dbeafe', border: 'none', cursor: 'pointer' }}>
                                  <ExternalLink size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ ABA LEADS ══════════════════ */}
        {tab === 'leads' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Propostas de Lead</h1>
                <p style={{ color: 'var(--t-text-muted)', marginTop: 4 }}>Propostas vinculadas a leads do funil</p>
              </div>
              <button onClick={() => { setFormLead(emptyForm); setErrorLead(''); setShowModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                + Nova Proposta
              </button>
            </div>

            {statsLead && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total', value: statsLead.total, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'Enviadas', value: statsLead.enviadas, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Aceitas', value: statsLead.aceitas, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Recusadas', value: statsLead.recusadas, color: 'text-red-700', bg: 'bg-red-50' },
                  { label: 'Aprovação', value: `${statsLead.taxa_aprovacao}%`, color: 'text-teal-700', bg: 'bg-teal-50' },
                  { label: 'Valor Aceito', value: `R$ ${((statsLead.valor_aceito || 0) / 1000).toFixed(1)}k`, color: 'text-purple-700', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {['','RASCUNHO','ENVIADA','VISUALIZADA','ACEITA','RECUSADA','EXPIRADA'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {s === '' ? 'Todas' : s}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {dataLoading ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : propostas.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-gray-500">Nenhuma proposta encontrada</p>
                  <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar primeira proposta</button>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Proposta','Lead','Valor','Status','Validade','Ações'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {propostas.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{p.titulo}</p>
                          <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-900">{p.lead?.nome}</p>
                          <p className="text-xs text-gray-500">{p.lead?.empresa}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-900">R$ {p.valor.toLocaleString('pt-BR')}</p>
                        </td>
                        <td className="px-5 py-4">
                          <select value={p.status} onChange={e => handleUpdateStatus(p.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:ring-1 outline-none cursor-pointer ${STATUS_COLORS[p.status]}`}>
                            {['RASCUNHO','ENVIADA','VISUALIZADA','ACEITA','RECUSADA','EXPIRADA'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-500">
                          {p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {p.status === 'ACEITA' && (
                            <button onClick={() => setShowContratoModal(p.id)}
                              className="text-green-600 hover:text-green-800 text-xs mr-3 font-medium">
                              🔄 Converter
                            </button>
                          )}
                          <button onClick={() => handleDeleteLead(p.id)} className="text-red-500 hover:text-red-700 text-sm">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ MODAL FORMULÁRIO GERADOR ═══════════ */}
      {showFormCom && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 820, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'var(--t-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{editingId ? 'Editar Proposta' : 'Nova Proposta Comercial'}</h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Preencha os dados para gerar a proposta</p>
              </div>
              <button onClick={() => setShowFormCom(false)} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--t-card-border)', overflowX: 'auto', padding: '0 8px' }}>
              {sections.map((s, i) => (
                <button key={s} onClick={() => setActiveSection(i)} style={{
                  padding: '12px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', whiteSpace: 'nowrap',
                  borderBottom: activeSection === i ? '2px solid var(--t-primary)' : '2px solid transparent',
                  color: activeSection === i ? 'var(--t-primary)' : 'var(--t-text-muted)',
                }}>
                  {i + 1}. {s}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: 24, maxHeight: 'calc(80vh - 180px)', overflowY: 'auto' }}>

              {/* 0 — Empresa */}
              {activeSection === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Razão Social *" col={2}>
                    <input value={form.razao_social} onChange={e => setField('razao_social', e.target.value)} className="ps-input w-full" placeholder="Razão social completa" />
                  </FormField>
                  <FormField label="Nome Fantasia">
                    <input value={form.nome_fantasia as string} onChange={e => setField('nome_fantasia', e.target.value)} className="ps-input w-full" placeholder="Nome fantasia" />
                  </FormField>
                  <FormField label="CNPJ">
                    <input value={form.cnpj as string} onChange={e => setField('cnpj', e.target.value)} className="ps-input w-full" placeholder="00.000.000/0001-00" />
                  </FormField>
                  <FormField label="Segmento">
                    <select value={form.segmento as string} onChange={e => setField('segmento', e.target.value)} className="ps-input w-full">
                      <option value="">Selecione...</option>
                      {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Cidade">
                    <input value={form.cidade as string} onChange={e => setField('cidade', e.target.value)} className="ps-input w-full" placeholder="Cidade" />
                  </FormField>
                  <FormField label="Estado">
                    <select value={form.estado as string} onChange={e => setField('estado', e.target.value)} className="ps-input w-full">
                      <option value="">UF</option>
                      {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Qtd. Máquinas / Terminais">
                    <input type="number" value={form.maquinas as string} onChange={e => setField('maquinas', e.target.value)} className="ps-input w-full" placeholder="Ex: 3" />
                  </FormField>
                  <FormField label="Tipo de Implantação">
                    <select value={form.tipo_loja as string} onChange={e => setField('tipo_loja', e.target.value)} className="ps-input w-full">
                      <option value="">Selecione...</option>
                      {TIPOS_LOJA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  {(form.tipo_loja === 'Migração' || form.tipo_loja === 'Upgrade') && (
                    <FormField label="Sistema Atual" col={2}>
                      <input value={form.sistema_atual as string} onChange={e => setField('sistema_atual', e.target.value)} className="ps-input w-full" placeholder="Sistema que utiliza hoje" />
                    </FormField>
                  )}
                  <FormField label="Data Desejada para Virada">
                    <input type="date" value={form.data_virada as string} onChange={e => setField('data_virada', e.target.value)} className="ps-input w-full" />
                  </FormField>
                </div>
              )}

              {/* 1 — Responsável */}
              {activeSection === 1 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Nome do Responsável" col={2}>
                    <input value={form.responsavel_nome as string} onChange={e => setField('responsavel_nome', e.target.value)} className="ps-input w-full" placeholder="Nome completo" />
                  </FormField>
                  <FormField label="Telefone / WhatsApp">
                    <input value={form.responsavel_telefone as string} onChange={e => setField('responsavel_telefone', e.target.value)} className="ps-input w-full" placeholder="(27) 99999-0000" />
                  </FormField>
                  <FormField label="E-mail">
                    <input type="email" value={form.responsavel_email as string} onChange={e => setField('responsavel_email', e.target.value)} className="ps-input w-full" placeholder="email@empresa.com" />
                  </FormField>
                  <FormField label="CPF">
                    <input value={form.responsavel_cpf as string} onChange={e => setField('responsavel_cpf', e.target.value)} className="ps-input w-full" placeholder="000.000.000-00" />
                  </FormField>
                  <FormField label="Cargo / Função">
                    <input value={form.responsavel_cargo as string} onChange={e => setField('responsavel_cargo', e.target.value)} className="ps-input w-full" placeholder="Sócio, Gerente..." />
                  </FormField>
                  <FormField label="Melhor Horário de Contato" col={2}>
                    <input value={form.responsavel_horario as string} onChange={e => setField('responsavel_horario', e.target.value)} className="ps-input w-full" placeholder="Ex: manhã das 9h às 12h" />
                  </FormField>
                </div>
              )}

              {/* 2 — Comercial */}
              {activeSection === 2 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Vendedor Responsável">
                    <input value={form.vendedor_nome as string} onChange={e => setField('vendedor_nome', e.target.value)} className="ps-input w-full" placeholder="Nome do vendedor" />
                  </FormField>
                  <FormField label="Telefone do Vendedor">
                    <input value={form.vendedor_telefone as string} onChange={e => setField('vendedor_telefone', e.target.value)} className="ps-input w-full" placeholder="(27) 99999-0000" />
                  </FormField>
                  <FormField label="Supervisor Responsável">
                    <input value={form.supervisor_nome as string} onChange={e => setField('supervisor_nome', e.target.value)} className="ps-input w-full" placeholder="Nome do supervisor" />
                  </FormField>
                  <FormField label="Campanha Comercial">
                    <input value={form.campanha as string} onChange={e => setField('campanha', e.target.value)} className="ps-input w-full" placeholder="Ex: Campanha Junho 2026" />
                  </FormField>
                  <FormField label="Validade da Proposta">
                    <input type="date" value={form.validade as string} onChange={e => setField('validade', e.target.value)} className="ps-input w-full" />
                  </FormField>
                  <FormField label="Origem do Lead">
                    <select value={form.origem as string} onChange={e => setField('origem', e.target.value)} className="ps-input w-full">
                      <option value="">Selecione...</option>
                      {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Status" col={2}>
                    <select value={form.status} onChange={e => setField('status', e.target.value)} className="ps-input w-full">
                      {Object.entries(STATUS_COM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </FormField>
                </div>
              )}

              {/* 3 — Plano & Produtos */}
              {activeSection === 3 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={`Plano Selecionado${form.segmento ? ` — ${planosPorSegmento(form.segmento as string) === PLANOS_FARMA ? 'Farmácia' : 'Varejo / Padaria'}` : ''}`}>
                    <select value={form.plano_selecionado as string} onChange={e => setField('plano_selecionado', e.target.value)} className="ps-input w-full">
                      {!form.segmento && <option value="">Selecione o segmento (aba Empresa) primeiro…</option>}
                      {form.segmento && <option value="">Selecione…</option>}
                      {planosPorSegmento(form.segmento as string).map(pl => <option key={pl} value={pl}>{pl}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Plano Recomendado">
                    <select value={form.plano_recomendado as string} onChange={e => setField('plano_recomendado', e.target.value)} className="ps-input w-full">
                      {!form.segmento && <option value="">Selecione o segmento primeiro…</option>}
                      {form.segmento && <option value="">Selecione…</option>}
                      {planosPorSegmento(form.segmento as string).map(pl => <option key={pl} value={pl}>{pl}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Mensalidade Plano Pro (R$)">
                    <input type="number" value={form.mensalidade_pro as string} onChange={e => setField('mensalidade_pro', e.target.value)} className="ps-input w-full" placeholder="Ex: 350" />
                  </FormField>
                  <FormField label="Mensalidade Plano Plus (R$)">
                    <input type="number" value={form.mensalidade_plus as string} onChange={e => setField('mensalidade_plus', e.target.value)} className="ps-input w-full" placeholder="Ex: 520" />
                  </FormField>
                  <FormField label="Módulos Inclusos" col={2}>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {MODULOS.map(m => (
                        <button key={m} type="button" onClick={() => toggleList('modulos_inclusos', m)} style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1.5px solid',
                          borderColor: (form.modulos_inclusos as string[]).includes(m) ? 'var(--t-primary)' : 'var(--t-card-border)',
                          background: (form.modulos_inclusos as string[]).includes(m) ? 'var(--t-primary-light)' : 'transparent',
                          color: (form.modulos_inclusos as string[]).includes(m) ? 'var(--t-primary)' : 'var(--t-text-muted)',
                          fontWeight: (form.modulos_inclusos as string[]).includes(m) ? 700 : 400,
                        }}>{m}</button>
                      ))}
                    </div>
                  </FormField>
                  <FormField label="Serviços Adicionais" col={2}>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {SERVICOS.map(s => (
                        <button key={s} type="button" onClick={() => toggleList('servicos_adicionais', s)} style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '1.5px solid',
                          borderColor: (form.servicos_adicionais as string[]).includes(s) ? '#16a34a' : 'var(--t-card-border)',
                          background: (form.servicos_adicionais as string[]).includes(s) ? '#dcfce7' : 'transparent',
                          color: (form.servicos_adicionais as string[]).includes(s) ? '#16a34a' : 'var(--t-text-muted)',
                          fontWeight: (form.servicos_adicionais as string[]).includes(s) ? 700 : 400,
                        }}>{s}</button>
                      ))}
                    </div>
                  </FormField>
                </div>
              )}

              {/* 4 — Valores */}
              {activeSection === 4 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Valor de Implantação / Setup (R$)">
                    <input type="number" value={form.valor_implantacao as string} onChange={e => setField('valor_implantacao', e.target.value)} className="ps-input w-full" placeholder="0,00" />
                  </FormField>
                  <FormField label="Valor de Conversão de Dados (R$)">
                    <input type="number" value={form.valor_conversao as string} onChange={e => setField('valor_conversao', e.target.value)} className="ps-input w-full" placeholder="0,00" />
                  </FormField>
                  <FormField label="Desconto (R$)">
                    <input type="number" value={form.desconto as string} onChange={e => setField('desconto', e.target.value)} className="ps-input w-full" placeholder="0,00" />
                  </FormField>
                  <FormField label="Valor Final (calculado)">
                    <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 15, fontWeight: 800, color: 'var(--t-primary)', background: 'var(--t-primary-light)', border: '1.5px solid var(--t-primary-border)' }}>
                      {fmtBRL(valorFinalCalc)}
                    </div>
                  </FormField>
                  <FormField label="Entrada (R$)">
                    <input type="number" value={form.entrada as string} onChange={e => setField('entrada', e.target.value)} className="ps-input w-full" placeholder="0,00" />
                  </FormField>
                  <FormField label="Número de Parcelas">
                    <input type="number" value={form.parcelas as string} onChange={e => setField('parcelas', e.target.value)} className="ps-input w-full" placeholder="Ex: 12" />
                  </FormField>
                  <FormField label="Valor da Parcela (calculado)">
                    <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1.5px solid #86efac' }}>
                      {parcelas > 0 ? `${parcelas}x de ${fmtBRL(parcelaCalc)}` : '—'}
                    </div>
                  </FormField>
                  <FormField label="Data de Vencimento das Parcelas">
                    <input value={form.data_vencimento as string} onChange={e => setField('data_vencimento', e.target.value)} className="ps-input w-full" placeholder="Ex: dia 10 de cada mês" />
                  </FormField>
                  <FormField label="Observação de Cobrança" col={2}>
                    <input value={form.observacao_cobranca as string} onChange={e => setField('observacao_cobranca', e.target.value)} className="ps-input w-full" placeholder="Observações sobre a cobrança..." />
                  </FormField>
                  <FormField label="Condição Especial" col={2}>
                    <input value={form.condicao_especial as string} onChange={e => setField('condicao_especial', e.target.value)} className="ps-input w-full" placeholder="Ex: Desconto especial válido até..." />
                  </FormField>
                </div>
              )}

              {/* 5 — Conteúdo */}
              {activeSection === 5 && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Título Principal da Proposta" col={2}>
                    <input value={form.titulo_proposta as string} onChange={e => setField('titulo_proposta', e.target.value)} className="ps-input w-full" placeholder="Ex: Proposta Comercial Prosystem — Plano Plus" />
                  </FormField>
                  {/* Segment + model selector for hero/value auto-fill */}
                  <FormField label="Segmento da Proposta" col={1}>
                    <select
                      value={modeloSegmento}
                      onChange={e => { setModeloSegmento(e.target.value); setModeloIndex(''); }}
                      className="ps-input w-full"
                    >
                      <option value="">Selecione o segmento</option>
                      <option value="farmacia">Farmácia / Drogaria</option>
                      <option value="padaria">Padaria / Panificadora</option>
                    </select>
                  </FormField>
                  <FormField label="Modelo de Mensagem" col={1}>
                    <select
                      value={modeloIndex}
                      onChange={e => {
                        const idx = e.target.value;
                        setModeloIndex(idx);
                        if (idx !== '' && idx !== 'outro' && modeloSegmento && MENSAGENS_PROPOSTA[modeloSegmento]) {
                          const m = MENSAGENS_PROPOSTA[modeloSegmento][Number(idx)];
                          setField('frase_hero', m.hero);
                          setField('texto_valor', m.valor);
                        } else if (idx === 'outro') {
                          setField('frase_hero', '');
                          setField('texto_valor', '');
                        }
                      }}
                      className="ps-input w-full"
                      disabled={!modeloSegmento}
                    >
                      <option value="">Selecione uma mensagem</option>
                      {(MENSAGENS_PROPOSTA[modeloSegmento] || []).map((m, i) => (
                        <option key={i} value={String(i)}>{i + 1}. {m.titulo}</option>
                      ))}
                      <option value="outro">Outro (digitar manualmente)</option>
                    </select>
                  </FormField>
                  <FormField label="Frase do Hero (destaque)" col={2}>
                    <input
                      value={form.frase_hero as string}
                      onChange={e => setField('frase_hero', e.target.value)}
                      className="ps-input w-full"
                      placeholder="Ex: Seu negócio merece um sistema que cresce com ele"
                      readOnly={!!modeloIndex && modeloIndex !== 'outro'}
                    />
                  </FormField>
                  <FormField label="Texto de Valor para o Cliente" col={2}>
                    <textarea
                      value={form.texto_valor as string}
                      onChange={e => setField('texto_valor', e.target.value)}
                      className="ps-input w-full"
                      rows={4}
                      placeholder="Por que a Prosystem é a melhor escolha para este cliente..."
                      readOnly={!!modeloIndex && modeloIndex !== 'outro'}
                    />
                  </FormField>
                  <FormField label="Observações Comerciais" col={2}>
                    <textarea value={form.observacoes as string} onChange={e => setField('observacoes', e.target.value)} className="ps-input w-full" rows={3} placeholder="Condições especiais, contexto da negociação..." />
                  </FormField>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="flex gap-2">
                {activeSection > 0 && (
                  <button onClick={() => setActiveSection(s => s - 1)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-primary)', cursor: 'pointer' }}>
                    ← Anterior
                  </button>
                )}
                {activeSection < sections.length - 1 && (
                  <button onClick={() => setActiveSection(s => s + 1)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Próximo →
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowFormCom(false)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-muted)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveCom} disabled={savingCom} className="flex items-center gap-2"
                  style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: savingCom ? 'not-allowed' : 'pointer', opacity: savingCom ? 0.7 : 1 }}>
                  <Save size={13} />
                  {savingCom ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Salvar Proposta')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL PREVIEW ═══════════ */}
      {previewProposta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{previewProposta.razao_social}</div>
                {previewProposta.nome_fantasia && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{previewProposta.nome_fantasia}</div>}
              </div>
              <button onClick={() => setPreviewProposta(null)} style={{ color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  ['Plano', previewProposta.plano_selecionado],
                  ['Segmento', previewProposta.segmento],
                  ['Cidade/UF', [previewProposta.cidade, previewProposta.estado].filter(Boolean).join('/')],
                  ['Vendedor', previewProposta.vendedor_nome],
                  ['Campanha', previewProposta.campanha],
                  ['Validade', previewProposta.validade ? new Date(previewProposta.validade).toLocaleDateString('pt-BR') : undefined],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: 13, color: 'var(--t-text-primary)', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Valores */}
              <div style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-primary-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t-primary)', fontWeight: 600, textTransform: 'uppercase' }}>Implantação</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-primary)' }}>{fmtBRL(previewProposta.valor_final)}</div>
                  </div>
                  {previewProposta.parcelas && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t-primary)', fontWeight: 600, textTransform: 'uppercase' }}>Parcelas</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-primary)' }}>{previewProposta.parcelas}x {fmtBRL(previewProposta.valor_parcela)}</div>
                    </div>
                  )}
                  {previewProposta.mensalidade_plus && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t-primary)', fontWeight: 600, textTransform: 'uppercase' }}>Mensalidade</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-primary)' }}>{fmtBRL(previewProposta.mensalidade_plus)}/mês</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 8 }}>Alterar Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_COM).map(([k, v]) => (
                    <button key={k}
                      onClick={() => { handleStatusCom(previewProposta.id, k); setPreviewProposta({ ...previewProposta, status: k }); }}
                      style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                        borderColor: previewProposta.status === k ? v.color : 'var(--t-card-border)',
                        background: previewProposta.status === k ? v.bg : 'transparent',
                        color: previewProposta.status === k ? v.color : 'var(--t-text-muted)',
                      }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link público */}
              {previewProposta.public_token && (
                <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ExternalLink size={13} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {BASE_URL}/p/{previewProposta.public_token}
                  </span>
                  <button onClick={() => handleCopyLink(previewProposta)} style={{ fontSize: 11, color: 'var(--t-primary)', fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--t-card-border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => { openEdit(previewProposta); setPreviewProposta(null); }} className="flex items-center gap-1.5"
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-primary)', cursor: 'pointer' }}>
                <Edit3 size={12} /> Editar
              </button>
              {previewProposta.public_token && (
                <button onClick={() => window.open(`/p/${previewProposta.public_token}`, '_blank')} className="flex items-center gap-1.5"
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-primary-border)', background: 'var(--t-primary-light)', color: 'var(--t-primary)', cursor: 'pointer' }}>
                  <Eye size={12} /> Ver Proposta
                </button>
              )}
              {previewProposta.vendedor_telefone && (
                <button onClick={() => handleWpp(previewProposta)} className="flex items-center gap-1.5"
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                  <MessageSquare size={12} /> WhatsApp
                </button>
              )}
              <button onClick={() => handleDeleteCom(previewProposta.id)} className="flex items-center gap-1.5"
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', marginLeft: 'auto' }}>
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL RENEGOCIAÇÃO ═══════════ */}
      {renegProposta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 580, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 24px', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '16px 16px 0 0' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Renegociar Proposta</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{renegProposta.razao_social}</div>
              </div>
              <button onClick={() => setRenegProposta(null)} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              {/* Current values info */}
              <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--t-text-muted)' }}>
                <b>Valores atuais:</b> Setup: {fmtBRL(renegProposta.valor_final)} | Mensalidade: {fmtBRL(renegProposta.mensalidade_plus || renegProposta.mensalidade_pro)} | Parcelas: {renegProposta.parcelas ? `${renegProposta.parcelas}x ${fmtBRL(renegProposta.valor_parcela)}` : '—'}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormField label="Implantação / Setup (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.valor_implantacao}
                    onChange={e => setRenegForm((f: any) => ({ ...f, valor_implantacao: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Conversão de Dados (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.valor_conversao}
                    onChange={e => setRenegForm((f: any) => ({ ...f, valor_conversao: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Desconto (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.desconto}
                    onChange={e => setRenegForm((f: any) => ({ ...f, desconto: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Plano Selecionado">
                  <select className="ps-input w-full" value={renegForm.plano_selecionado}
                    onChange={e => setRenegForm((f: any) => ({ ...f, plano_selecionado: e.target.value }))}>
                    <option value="">Sem alteração</option>
                    <option value="Pro">Pro</option>
                    <option value="Plus">Plus</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>
                </FormField>
                <FormField label="Mensalidade Pro (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.mensalidade_pro}
                    onChange={e => setRenegForm((f: any) => ({ ...f, mensalidade_pro: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Mensalidade Plus (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.mensalidade_plus}
                    onChange={e => setRenegForm((f: any) => ({ ...f, mensalidade_plus: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Entrada (R$)">
                  <input type="number" className="ps-input w-full" value={renegForm.entrada}
                    onChange={e => setRenegForm((f: any) => ({ ...f, entrada: e.target.value }))} placeholder="0,00" />
                </FormField>
                <FormField label="Número de Parcelas">
                  <input type="number" className="ps-input w-full" value={renegForm.parcelas}
                    onChange={e => setRenegForm((f: any) => ({ ...f, parcelas: e.target.value }))} placeholder="Ex: 6" />
                </FormField>
                <FormField label="Vencimento das Parcelas">
                  <input className="ps-input w-full" value={renegForm.data_vencimento}
                    onChange={e => setRenegForm((f: any) => ({ ...f, data_vencimento: e.target.value }))} placeholder="Ex: dia 10 de cada mês" />
                </FormField>
                <FormField label="Nova Validade da Proposta">
                  <input type="date" className="ps-input w-full" value={renegForm.validade}
                    onChange={e => setRenegForm((f: any) => ({ ...f, validade: e.target.value }))} />
                </FormField>
                <FormField label="Observações Comerciais" col={2}>
                  <textarea className="ps-input w-full" rows={2} value={renegForm.observacoes}
                    onChange={e => setRenegForm((f: any) => ({ ...f, observacoes: e.target.value }))} placeholder="Condições especiais da renegociação..." />
                </FormField>
              </div>
              <FormField label="Motivo da Renegociação *" col={2}>
                <textarea className="ps-input w-full" rows={2} value={renegForm.motivo}
                  onChange={e => setRenegForm((f: any) => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Cliente solicitou condição especial para fechamento imediato." />
              </FormField>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setRenegProposta(null)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-muted)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleRenegociar} disabled={renegSaving}
                style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#7c3aed', color: '#fff', border: 'none', cursor: renegSaving ? 'not-allowed' : 'pointer', opacity: renegSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} />
                {renegSaving ? 'Salvando...' : 'Confirmar Renegociação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL HISTÓRICO ═══════════ */}
      {historicoProposta && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t-text-primary)' }}>Histórico da Proposta</div>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>{historicoProposta.razao_social}</div>
              </div>
              <button onClick={() => setHistoricoProposta(null)} style={{ color: 'var(--t-text-muted)', background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {loadingHistorico ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)' }}>Carregando...</div>
              ) : historico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)' }}>Nenhum histórico registrado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historico.map((h: any) => (
                    <div key={h.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: h.tipo === 'RENEGOCIACAO' ? '#ede9fe' : h.tipo === 'STATUS' ? '#dbeafe' : '#f3f4f6', color: h.tipo === 'RENEGOCIACAO' ? '#7c3aed' : h.tipo === 'STATUS' ? '#2563eb' : '#6b7280' }}>
                          {h.tipo}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {h.feito_por_nome && (
                        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 4 }}>Por: <b>{h.feito_por_nome}</b></div>
                      )}
                      {h.campo_alterado && (
                        <div style={{ fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--t-text-muted)' }}>{h.campo_alterado}:</span>{' '}
                          <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{h.valor_anterior}</span>
                          {' → '}
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{h.valor_novo}</span>
                        </div>
                      )}
                      {h.motivo && <div style={{ fontSize: 12, color: 'var(--t-text-primary)', fontStyle: 'italic' }}>"{h.motivo}"</div>}
                      {h.observacao && <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>{h.observacao}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL NOVA PROPOSTA DE LEAD ═══════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Nova Proposta de Lead</h2>
            {errorLead && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{errorLead}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead *</label>
                <select value={formLead.lead_id} onChange={e => setFormLead((p: any) => ({ ...p, lead_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="">Selecione um lead</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.nome} — {l.empresa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input value={formLead.titulo} onChange={e => setFormLead((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Proposta de licença ProSystem ERP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input type="number" value={formLead.valor} onChange={e => setFormLead((p: any) => ({ ...p, valor: e.target.value }))}
                    placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
                  <input type="datetime-local" value={formLead.validade} onChange={e => setFormLead((p: any) => ({ ...p, validade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={formLead.descricao} onChange={e => setFormLead((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3} placeholder="Detalhes da proposta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSaveLead} disabled={savingLead || !formLead.lead_id || !formLead.titulo || !formLead.valor}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {savingLead ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL CONVERTER CONTRATO ═══════════ */}
      {showContratoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Converter em Contrato</h2>
            <p className="text-sm text-gray-500 mb-5">A proposta será marcada como aceita e um contrato será criado.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                <input type="datetime-local" value={contratoForm.data_inicio}
                  onChange={e => setContratoForm(p => ({ ...p, data_inicio: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recorrência</label>
                <select value={contratoForm.recorrencia} onChange={e => setContratoForm(p => ({ ...p, recorrencia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {['UNICO','MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowContratoModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleConverterContrato} disabled={savingLead || !contratoForm.data_inicio}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                {savingLead ? 'Convertendo...' : '✓ Converter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
