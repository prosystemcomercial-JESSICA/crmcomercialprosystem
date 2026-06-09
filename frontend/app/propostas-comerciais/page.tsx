'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  ClipboardList, Plus, Search, Eye, Trash2, Edit3, Send, CheckCircle,
  XCircle, Copy, ExternalLink, ChevronDown, ChevronUp, RefreshCw,
  FileText, MessageSquare, Save, Download, X, Filter, LayoutGrid, List,
} from 'lucide-react';

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
}

const BLANK_FORM = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  segmento: '',
  cidade: '',
  estado: '',
  maquinas: '',
  tipo_loja: '',
  sistema_atual: '',
  data_virada: '',
  responsavel_nome: '',
  responsavel_telefone: '',
  responsavel_email: '',
  responsavel_cpf: '',
  responsavel_cargo: '',
  responsavel_horario: '',
  vendedor_nome: '',
  vendedor_telefone: '',
  supervisor_nome: '',
  campanha: '',
  validade: '',
  origem: '',
  plano_selecionado: '',
  plano_recomendado: '',
  mensalidade_pro: '',
  mensalidade_plus: '',
  modulos_inclusos: [] as string[],
  servicos_adicionais: [] as string[],
  valor_implantacao: '',
  valor_conversao: '',
  desconto: '',
  valor_final: '',
  entrada: '',
  parcelas: '',
  valor_parcela: '',
  data_vencimento: '',
  observacao_cobranca: '',
  condicao_especial: '',
  titulo_proposta: '',
  frase_hero: '',
  texto_valor: '',
  observacoes: '',
  status: 'RASCUNHO',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO:      { label: 'Rascunho',       color: '#6b7280', bg: '#f3f4f6' },
  ENVIADA:       { label: 'Enviada',         color: '#2563eb', bg: '#dbeafe' },
  EM_NEGOCIACAO: { label: 'Em Negociação',   color: '#d97706', bg: '#fef3c7' },
  ACEITA:        { label: 'Aceita',          color: '#16a34a', bg: '#dcfce7' },
  RECUSADA:      { label: 'Recusada',        color: '#dc2626', bg: '#fee2e2' },
  PERDIDA:       { label: 'Perdida',         color: '#9ca3af', bg: '#f3f4f6' },
};

// Normaliza qualquer status do backend para uma COLUNA visível do quadro,
// para o card NUNCA sumir. Propostas que viraram contrato (assinado ou em
// geração) ficam na coluna "Aceita".
const COLUNA_DO_STATUS = (status: string): string => {
  if (['CONTRATO_EM_GERACAO', 'CONTRATO_ENVIADO', 'CONTRATO_ASSINADO', 'ACEITO'].includes(status)) return 'ACEITA';
  if (status === 'EXPIRADA' || status === 'DECLINADA') return 'RECUSADA';
  return STATUS_CONFIG[status] ? status : 'RASCUNHO';
};

const MODULOS = [
  'Frente de Caixa', 'Estoque', 'Financeiro', 'Relatórios', 'Multi-empresa',
  'Controle de Acesso', 'Vendas Online', 'Delivery', 'NFe/NFCe', 'SAT/MFE',
];

const SERVICOS = [
  'TEF', 'Pacote Fiscal', 'Dashboard', 'WhatsApp / Mensageria',
  'Imendes / Avant', 'Migração / Conversão de Dados',
  'Treinamento', 'Suporte Prioritário',
];

// Segmentos oficiais (menu suspenso) — a proposta inteira é direcionada pelo segmento.
const SEGMENTOS = ['Farmácia / Drogaria', 'Farmácia de Manipulação', 'Padaria', 'Varejo'];

// Planos por segmento: Farmácia/Manipulação → linha Farma; Padaria/Varejo → MEI + Loja.
const PLANOS_FARMA = ['Farma Basic', 'Farma Pro', 'Farma Plus'];
const PLANOS_LOJA  = ['MEI', 'Loja Basic', 'Loja Pro', 'Loja Plus'];
const planosPorSegmento = (seg?: string): string[] =>
  /farm|manipula/i.test(seg || '') ? PLANOS_FARMA : PLANOS_LOJA;

// ── Conteúdo automático por segmento (título, frase hero, texto de valor) ──
// Ao escolher o segmento, a proposta é preenchida e direcionada para ele.
type SegTpl = { titulo: string; hero: string; valor: string };
const SEGMENTO_TEMPLATES: Record<string, SegTpl> = {
  'Farmácia / Drogaria': {
    titulo: 'Proposta Comercial Prosystem — Gestão para Farmácias e Drogarias',
    hero: 'A farmácia que vende mais, controla o estoque e nunca perde uma venda por ruptura.',
    valor: 'O Prosystem foi feito para farmácias e drogarias: PBM e Farmácia Popular integrados, '
      + 'controle de uso contínuo, atenção farmacêutica, SNGPC e inteligência tributária do setor. '
      + 'Sua equipe vende mais rápido no balcão, o estoque se controla sozinho e a gestão enxerga tudo em tempo real.',
  },
  'Farmácia de Manipulação': {
    titulo: 'Proposta Comercial Prosystem — Gestão para Farmácias de Manipulação',
    hero: 'Da fórmula ao balcão: controle total da manipulação, do estoque e da rentabilidade.',
    valor: 'O Prosystem atende a farmácia de manipulação de ponta a ponta: controle de fórmulas e '
      + 'matérias-primas, rastreabilidade, atenção farmacêutica, SNGPC e inteligência tributária. '
      + 'Mais agilidade na produção, menos perdas e uma gestão que mostra a margem real de cada fórmula.',
  },
  'Padaria': {
    titulo: 'Proposta Comercial Prosystem — Gestão para Padarias e Panificadoras',
    hero: 'Produção, balcão e delivery sob controle — sua padaria vendendo mais todos os dias.',
    valor: 'O Prosystem organiza a padaria do forno ao caixa: controle de produção, balança e pesáveis, '
      + 'estoque de insumos, frente de caixa ágil e delivery integrado. '
      + 'Menos desperdício, fila mais rápida e a gestão acompanhando o resultado de cada turno.',
  },
  'Varejo': {
    titulo: 'Proposta Comercial Prosystem — Gestão para o Varejo',
    hero: 'O sistema completo que faz seu varejo vender mais e crescer com controle.',
    valor: 'O Prosystem dá ao seu varejo uma operação afiada: frente de caixa rápida, controle de estoque, '
      + 'financeiro completo, NF-e/NFC-e e relatórios gerenciais. '
      + 'Tudo num só lugar, com a inteligência para você decidir com base em dados — não no achismo.',
  },
};
const tplDoSegmento = (seg?: string): SegTpl | undefined => {
  if (!seg) return undefined;
  if (SEGMENTO_TEMPLATES[seg]) return SEGMENTO_TEMPLATES[seg];
  // fallback por palavra-chave (compatível com propostas antigas)
  if (/manipula/i.test(seg)) return SEGMENTO_TEMPLATES['Farmácia de Manipulação'];
  if (/farm|drogaria/i.test(seg)) return SEGMENTO_TEMPLATES['Farmácia / Drogaria'];
  if (/padar|panific/i.test(seg)) return SEGMENTO_TEMPLATES['Padaria'];
  return SEGMENTO_TEMPLATES['Varejo'];
};
const TIPOS_LOJA = ['Nova Implantação', 'Migração', 'Upgrade', 'Filial', 'Reativação'];
const ORIGENS = ['Indicação', 'Prospecção', 'WhatsApp', 'Visita', 'Tráfego Pago', 'Cliente Antigo', 'Evento'];
const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const fmtBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Nome do cliente vira um "slug" legível no link (sem acento/espaço). Apenas cosmético.
const slugify = (s?: string) =>
  (s || 'cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'cliente';

export default function PropostasComerciais() {
  const { user } = useAuth();
  const router = useRouter();
  // Só gestão exclui proposta (sai dos resultados, fica na auditoria).
  const isGestor = podeVerTudo(user?.role);

  const [propostas, setPropostas] = useState<PropostaComercial[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [activeSection, setActiveSection] = useState(0);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterVendedor, setFilterVendedor] = useState('');
  const [search, setSearch] = useState('');

  const [previewProposta, setPreviewProposta] = useState<PropostaComercial | null>(null);
  const [copied, setCopied] = useState(false);

  // Perfil completo do vendedor logado (nome + telefone) p/ auto-preencher a proposta
  const [meuPerfil, setMeuPerfil] = useState<{ nome?: string; telefone?: string } | null>(null);
  useEffect(() => {
    apiClient.getMeuPerfil().then(r => setMeuPerfil(r.data?.data || null)).catch(() => {});
  }, []);

  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');
  const [draggingProposta, setDraggingProposta] = useState<PropostaComercial | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Domínio do link do cliente: usa o domínio onde o CRM está aberto (online),
  // depois a env, e só por último localhost (dev). Evita link "localhost" em produção.
  const BASE_URL = (typeof window !== 'undefined' && window.location?.origin)
    || process.env.NEXT_PUBLIC_APP_URL
    || 'http://localhost:3000';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPropostasComerciais({
        status: filterStatus || undefined,
        vendedor: filterVendedor || undefined,
      });
      setPropostas(res.data.data.propostas || []);
      setStats(res.data.data.stats || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterVendedor]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    // Já preenche o vendedor (nome + telefone) com o cadastro do usuário logado.
    setForm({
      ...BLANK_FORM,
      vendedor_nome: meuPerfil?.nome || user?.nome || '',
      vendedor_telefone: meuPerfil?.telefone || '',
    });
    setActiveSection(0);
    setShowForm(true);
  };

  // Pré-preenchimento vindo de outra tela (ex.: "Gerar proposta" a partir de um Lead).
  // Os dados do lead são gravados em sessionStorage e consumidos aqui — assim existe
  // uma ÚNICA tela de proposta no sistema (sempre a aprimorada), sem código duplicado.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('prefill_proposta');
    if (!raw) return;
    sessionStorage.removeItem('prefill_proposta');
    try {
      const dados = JSON.parse(raw);
      const seg = dados.segmento as string;
      const tpl = seg ? tplDoSegmento(seg) : null;
      setEditingId(null);
      setForm({
        ...BLANK_FORM,
        ...dados,
        // auto-fill vendedor a partir do perfil logado, se o lead não trouxe
        vendedor_nome: dados.vendedor_nome || meuPerfil?.nome || user?.nome || '',
        vendedor_telefone: dados.vendedor_telefone || meuPerfil?.telefone || '',
        // conteúdo direcionado ao segmento (igual ao aplicarSegmento)
        titulo_proposta: dados.titulo_proposta || (tpl ? tpl.titulo : ''),
        frase_hero:      dados.frase_hero      || (tpl ? tpl.hero  : ''),
        texto_valor:     dados.texto_valor     || (tpl ? tpl.valor : ''),
      });
      setActiveSection(0);
      setShowForm(true);
    } catch {
      // ignora prefill inválido
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuPerfil]);

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
      // plano_selecionado espelha o recomendado (campo único agora). Em propostas
      // antigas, usa o que houver preenchido como recomendado.
      plano_recomendado: p.plano_recomendado || p.plano_selecionado || '',
      plano_selecionado: p.plano_recomendado || p.plano_selecionado || '',
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
    setActiveSection(0);
    setShowForm(true);
  };

  const parseNum = (v: string) => v ? parseFloat(v) : undefined;

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      alert('Razão social é obrigatória');
      return;
    }
    setSaving(true);
    try {
      // Garante conteúdo direcionado ao segmento (título sempre gerado; hero/valor se vazios)
      const tpl = tplDoSegmento(form.segmento as string);
      const payload: any = {
        ...form,
        titulo_proposta: (form.titulo_proposta as string)?.trim() || tpl?.titulo || '',
        frase_hero:      (form.frase_hero as string)?.trim()      || tpl?.hero  || '',
        texto_valor:     (form.texto_valor as string)?.trim()     || tpl?.valor || '',
        maquinas: parseNum(form.maquinas as string),
        mensalidade_pro: parseNum(form.mensalidade_pro as string),
        mensalidade_plus: parseNum(form.mensalidade_plus as string),
        valor_implantacao: parseNum(form.valor_implantacao as string),
        valor_conversao: parseNum(form.valor_conversao as string),
        desconto: parseNum(form.desconto as string),
        valor_final: parseNum(form.valor_final as string),
        entrada: parseNum(form.entrada as string),
        parcelas: parseNum(form.parcelas as string) ? parseInt(form.parcelas as string) : undefined,
        valor_parcela: parseNum(form.valor_parcela as string),
        validade: form.validade ? new Date(form.validade).toISOString() : undefined,
      };
      // remove empty strings
      Object.keys(payload).forEach(k => {
        if (payload[k] === '') delete payload[k];
      });

      if (editingId) {
        await apiClient.updatePropostaComercial(editingId, payload);
      } else {
        await apiClient.createPropostaComercial(payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao salvar proposta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const motivo = prompt('Excluir esta proposta?\n\nEla sai de TODOS os resultados (Dashboard, Metas, Ciclo) e o fechamento ligado a ela é revertido — mas fica registrada na auditoria.\n\nMotivo da exclusão (opcional):');
    if (motivo === null) return;  // cancelou
    await apiClient.deletePropostaComercial(id, motivo || undefined);
    load();
  };

  const handleStatus = async (id: string, status: string) => {
    await apiClient.updatePropostaComercial(id, { status });
    // Quando proposta é aceita → cria contrato automaticamente
    if (status === 'ACEITA') {
      try {
        await apiClient.createContratoFromProposta(id);
      } catch { /* contrato pode já existir */ }
    }
    load();
  };

  const moveStatus = async (proposta: PropostaComercial, novoStatus: string) => {
    if (proposta.status === novoStatus) return;
    setPropostas(prev => prev.map(p => p.id === proposta.id ? { ...p, status: novoStatus } : p));
    try {
      await apiClient.updatePropostaComercial(proposta.id, { status: novoStatus });
      if (novoStatus === 'ACEITA') {
        try { await apiClient.createContratoFromProposta(proposta.id); } catch { /* já existe */ }
      }
    } catch {
      load();
    }
  };

  // Monta o link da proposta. modo: 'cliente' (travado, auto-serviço) | 'apresentador' | undefined (automático)
  // versao: 'simples' | 'completa' (só faz sentido no modo cliente). Inclui o nome do cliente (slug).
  const propostaLink = (p: PropostaComercial, modo?: 'cliente' | 'apresentador', versao?: 'simples' | 'completa') => {
    const qs = [modo ? `modo=${modo}` : '', versao ? `v=${versao}` : ''].filter(Boolean).join('&');
    return `${BASE_URL}/p/${p.public_token}/${slugify(p.razao_social || p.nome_fantasia)}${qs ? `?${qs}` : ''}`;
  };

  const handleCopyLink = async (p: PropostaComercial, modo?: 'cliente' | 'apresentador', versao?: 'simples' | 'completa') => {
    if (!p.public_token) return;
    await navigator.clipboard.writeText(propostaLink(p, modo, versao));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Resumo da proposta para WhatsApp, COM negrito (*texto*) e SEM emojis.
  // Para o negrito do WhatsApp nao quebrar: o * cola no texto e tem espaco/inicio
  // de linha do lado de fora; o NBSP do fmtBRL (entre "R$" e o valor) vira espaco normal.
  const resumoPropostaWhats = (p: PropostaComercial): string => {
    const nome = p.responsavel_nome ? p.responsavel_nome.split(' ')[0] : '';
    const mensalidade = (p.mensalidade_plus && p.mensalidade_plus > 0) ? p.mensalidade_plus
      : (p.mensalidade_pro && p.mensalidade_pro > 0 ? p.mensalidade_pro : undefined);
    const validade = p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : null;
    // Moeda com espaco NORMAL (fmtBRL gera NBSP entre "R$" e o valor).
    const brl = (v?: number | null) => fmtBRL(v).replace(/ /g, ' ');
    const b = (t: string) => `*${t}:*`;

    const linhas: (string | null)[] = [
      nome ? `Olá, ${nome}! Tudo bem?` : 'Olá! Tudo bem?',
      '',
      `Segue o resumo da proposta da Prosystem para ${p.razao_social}:`,
      '',
      p.plano_selecionado ? `${b('Plano')} ${p.plano_selecionado}` : null,
      mensalidade != null ? `${b('Mensalidade')} ${brl(mensalidade)}/mês` : null,
      p.valor_final != null ? `${b('Implantação')} ${brl(p.valor_final)}` : null,
      (p.parcelas && p.valor_parcela)
        ? `${b('Parcelamento')} ${p.parcelas}x de ${brl(p.valor_parcela)}`
        : (p.entrada ? `${b('Entrada')} ${brl(p.entrada)}` : null),
      validade ? `${b('Validade')} ${validade}` : null,
      '',
      'Acesse a proposta completa pelo link:',
      p.public_token ? propostaLink(p, 'cliente') : null,
      '',
      'Qualquer dúvida, estou à disposição!',
      p.vendedor_nome ? p.vendedor_nome : null,
    ];
    return linhas.filter(l => l !== null).join('\n');
  };

  // Envia o resumo da proposta para o WhatsApp DO CLIENTE.
  const handleWppCliente = (p: PropostaComercial) => {
    const tel = (p.responsavel_telefone || '').replace(/\D/g, '');
    if (!tel) {
      alert('Cliente sem telefone/WhatsApp cadastrado na proposta.');
      return;
    }
    const msg = encodeURIComponent(resumoPropostaWhats(p));
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
  };

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleList = (k: 'modulos_inclusos' | 'servicos_adicionais', val: string) => {
    setForm(f => {
      const arr = f[k] as string[];
      return { ...f, [k]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  };

  // Escolher segmento → preenche automaticamente título, frase hero e texto de valor
  // (toda a proposta passa a ser direcionada ao segmento). Limpa plano se trocou de família.
  const aplicarSegmento = (seg: string) => {
    const tpl = tplDoSegmento(seg);
    setForm(f => {
      const mudouFamilia = planosPorSegmento(seg) !== planosPorSegmento(f.segmento as string);
      return {
        ...f,
        segmento: seg,
        titulo_proposta: tpl ? tpl.titulo : f.titulo_proposta,
        frase_hero:      tpl ? tpl.hero  : f.frase_hero,
        texto_valor:     tpl ? tpl.valor : f.texto_valor,
        // se trocou Farma↔Loja, zera os planos pra não ficar plano inválido
        plano_selecionado:  mudouFamilia ? '' : f.plano_selecionado,
        plano_recomendado:  mudouFamilia ? '' : f.plano_recomendado,
      };
    });
  };

  // Auto-calc valor_final
  const implantacao = parseNum(form.valor_implantacao as string) || 0;
  const conversao = parseNum(form.valor_conversao as string) || 0;
  const desconto = parseNum(form.desconto as string) || 0;
  const valorFinalCalc = implantacao + conversao - desconto;
  const entrada = parseNum(form.entrada as string) || 0;
  const parcelas = parseInt(form.parcelas as string) || 0;
  const saldo = valorFinalCalc - entrada;
  const parcelaCalc = parcelas > 0 ? saldo / parcelas : 0;

  const filtered = propostas.filter(p => {
    const s = search.toLowerCase();
    return !s || p.razao_social.toLowerCase().includes(s) || (p.vendedor_nome || '').toLowerCase().includes(s);
  });

  // ── Seções do formulário
  const sections = [
    { label: 'Empresa' },
    { label: 'Responsável' },
    { label: 'Comercial' },
    { label: 'Plano & Produtos' },
    { label: 'Valores' },
    { label: 'Conteúdo' },
  ];

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>
              Gerador de Proposta Comercial
            </h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 2 }}>
              Crie propostas profissionais para novos clientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Lista / Kanban */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1.5px solid var(--t-card-border)' }}>
              <button
                onClick={() => setViewMode('lista')}
                title="Visualização em lista"
                style={{
                  padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: viewMode === 'lista' ? 'var(--t-primary)' : 'var(--t-card-bg)',
                  color: viewMode === 'lista' ? '#fff' : 'var(--t-text-muted)',
                }}
              >
                <List size={13} /> Lista
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                title="Visualização Kanban"
                style={{
                  padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  borderLeft: '1.5px solid var(--t-card-border)',
                  background: viewMode === 'kanban' ? 'var(--t-primary)' : 'var(--t-card-bg)',
                  color: viewMode === 'kanban' ? '#fff' : 'var(--t-text-muted)',
                }}
              >
                <LayoutGrid size={13} /> Kanban
              </button>
            </div>
            <ExportButton
              nome="propostas" titulo="Propostas Comerciais — ProSystem CRM"
              linhas={propostas}
              colunas={[
                { header: 'Cliente', value: (p: PropostaComercial) => p.razao_social },
                { header: 'CNPJ', value: (p: PropostaComercial) => p.cnpj || '' },
                { header: 'Segmento', value: (p: PropostaComercial) => p.segmento || '' },
                { header: 'Plano', value: (p: PropostaComercial) => p.plano_selecionado || '' },
                { header: 'Vendedor', value: (p: PropostaComercial) => p.vendedor_nome || '' },
                { header: 'Status', value: (p: PropostaComercial) => p.status },
                { header: 'Valor final (R$)', value: (p: PropostaComercial) => (p as any).valor_final ?? '' },
                { header: 'Mensalidade Plus (R$)', value: (p: PropostaComercial) => (p as any).mensalidade_plus ?? '' },
                { header: 'Criada em', value: (p: PropostaComercial) => (p as any).created_at ? new Date((p as any).created_at).toLocaleDateString('pt-BR') : '' },
              ]}
            />
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}
            >
              <Plus size={15} /> Nova Proposta
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total || 0, color: '#6b7280' },
            { label: 'Rascunho', value: stats.rascunho || 0, color: '#6b7280' },
            { label: 'Enviadas', value: stats.enviada || 0, color: '#2563eb' },
            { label: 'Negociação', value: stats.em_negociacao || 0, color: '#d97706' },
            { label: 'Aceitas', value: stats.aceita || 0, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="ps-card p-3 rounded-xl text-center">
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative">
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa ou vendedor..."
              className="ps-input pl-8 text-sm"
              style={{ width: 240, paddingLeft: 30 }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="ps-input text-sm"
            style={{ width: 160 }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* ── Vista Lista ─────────────────────────────────────── */}
        {viewMode === 'lista' && (
          <div className="ps-card rounded-xl overflow-hidden">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--t-table-header)', borderBottom: '1px solid var(--t-card-border)' }}>
                  {['Empresa', 'Segmento', 'Plano', 'Valor Final', 'Vendedor', 'Validade', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)' }}>Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--t-text-muted)' }}>
                    <ClipboardList size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    Nenhuma proposta encontrada
                  </td></tr>
                ) : filtered.map(p => {
                  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG[COLUNA_DO_STATUS(p.status)] || STATUS_CONFIG.RASCUNHO;
                  const validade = p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : '—';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-primary)' }}>
                          {p.razao_social}
                        </div>
                        {p.nome_fantasia && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{p.nome_fantasia}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>{p.segmento || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-primary)', fontWeight: 600 }}>{p.plano_selecionado || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--t-primary)' }}>{fmtBRL(p.valor_final)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>{p.vendedor_nome || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>{validade}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPreviewProposta(p)} title="Ver proposta"
                            style={{ padding: 5, borderRadius: 6, color: 'var(--t-primary)', background: 'var(--t-primary-light)', border: 'none', cursor: 'pointer' }}>
                            <Eye size={13} />
                          </button>
                          <button onClick={() => openEdit(p)} title="Editar"
                            style={{ padding: 5, borderRadius: 6, color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', cursor: 'pointer' }}>
                            <Edit3 size={13} />
                          </button>
                          {p.public_token && (
                            <button onClick={() => handleCopyLink(p, 'cliente')} title="Copiar link do cliente (auto-serviço)"
                              style={{ padding: 5, borderRadius: 6, color: '#16a34a', background: '#dcfce7', border: 'none', cursor: 'pointer' }}>
                              <Copy size={13} />
                            </button>
                          )}
                          {p.responsavel_telefone && (
                            <button onClick={() => handleWppCliente(p)} title="Enviar resumo da proposta no WhatsApp do cliente"
                              style={{ padding: 5, borderRadius: 6, color: '#16a34a', background: '#dcfce7', border: 'none', cursor: 'pointer' }}>
                              <MessageSquare size={13} />
                            </button>
                          )}
                          {isGestor && (
                            <button onClick={() => handleDelete(p.id)} title="Excluir (só gestão)"
                              style={{ padding: 5, borderRadius: 6, color: '#dc2626', background: '#fee2e2', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Vista Kanban ─────────────────────────────────────── */}
        {viewMode === 'kanban' && (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
            {Object.entries(STATUS_CONFIG).map(([statusKey, statusCfg]) => {
              const colCards = filtered.filter(p => COLUNA_DO_STATUS(p.status) === statusKey);
              const isOver = dragOverCol === statusKey;
              const isDraggingToSame = draggingProposta?.status === statusKey;
              return (
                <div
                  key={statusKey}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverCol(statusKey); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (draggingProposta && draggingProposta.status !== statusKey) {
                      moveStatus(draggingProposta, statusKey);
                    }
                    setDraggingProposta(null);
                  }}
                  style={{
                    minWidth: 220, width: 220, flexShrink: 0,
                    borderRadius: 12,
                    border: isOver && !isDraggingToSame ? `2px solid ${statusCfg.color}` : `1px solid ${statusCfg.color}33`,
                    background: isOver && !isDraggingToSame ? `${statusCfg.color}08` : 'var(--t-content-bg)',
                    transition: 'border 0.15s, background 0.15s, transform 0.1s',
                    transform: isOver && !isDraggingToSame ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: isOver && !isDraggingToSame ? `0 0 0 4px ${statusCfg.color}18` : 'none',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Cabeçalho da coluna */}
                  <div style={{
                    padding: '10px 12px 8px',
                    borderBottom: `2px solid ${statusCfg.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: '12px 12px 0 0',
                    background: `${statusCfg.color}12`,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 999,
                      background: statusCfg.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                    }}>{colCards.length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{ padding: 8, flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                    {colCards.length === 0 && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
                        <p style={{ fontSize: 11, color: 'var(--t-text-muted)', textAlign: 'center', opacity: 0.5 }}>
                          Arraste aqui
                        </p>
                      </div>
                    )}
                    {colCards.map(p => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDraggingProposta(p)}
                        onDragEnd={() => { setDraggingProposta(null); setDragOverCol(null); }}
                        onClick={() => setPreviewProposta(p)}
                        style={{
                          background: 'var(--t-card-bg)',
                          border: `1px solid var(--t-card-border)`,
                          borderRadius: 10,
                          padding: '10px 11px',
                          cursor: 'grab',
                          opacity: draggingProposta?.id === p.id ? 0.4 : 1,
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
                      >
                        {/* Nome da empresa */}
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 2, lineHeight: 1.3 }}>
                          {p.razao_social}
                        </p>
                        {p.nome_fantasia && (
                          <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 4 }}>{p.nome_fantasia}</p>
                        )}

                        {/* Segmento + plano */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {p.segmento && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: '#EBF4FF', color: '#2E6EAB' }}>
                              {p.segmento}
                            </span>
                          )}
                          {p.plano_selecionado && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: `${statusCfg.color}18`, color: statusCfg.color }}>
                              {p.plano_selecionado}
                            </span>
                          )}
                        </div>

                        {/* Valor */}
                        {p.valor_final != null && (
                          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t-primary)', marginBottom: 4 }}>
                            {fmtBRL(p.valor_final)}
                          </p>
                        )}

                        {/* Vendedor */}
                        {p.vendedor_nome && (
                          <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 4 }}>👤 {p.vendedor_nome}</p>
                        )}

                        {/* Footer: data + ações */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--t-card-border)' }}>
                          <span style={{ fontSize: 9, color: 'var(--t-text-muted)' }}>
                            {new Date(p.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={e => { e.stopPropagation(); openEdit(p); }}
                              title="Editar"
                              style={{ padding: 4, borderRadius: 6, color: 'var(--t-text-muted)', background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', cursor: 'pointer', display: 'flex' }}>
                              <Edit3 size={11} />
                            </button>
                            {p.public_token && (
                              <button
                                onClick={e => { e.stopPropagation(); handleCopyLink(p, 'cliente'); }}
                                title="Copiar link do cliente (auto-serviço)"
                                style={{ padding: 4, borderRadius: 6, color: '#16a34a', background: '#dcfce7', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                <Copy size={11} />
                              </button>
                            )}
                            {p.responsavel_telefone && (
                              <a
                                href={`/whatsapp?numero=${p.responsavel_telefone.replace(/\D/g, '')}&nome=${encodeURIComponent(p.razao_social || p.nome_fantasia || '')}`}
                                onClick={e => e.stopPropagation()}
                                title="WhatsApp"
                                style={{ padding: 4, borderRadius: 6, background: '#25D366', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Modal formulário ────────────────────────────────── */}
        {showForm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '24px 16px', overflowY: 'auto',
          }}>
            <div style={{
              background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 820,
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}>
              {/* Modal header */}
              <div style={{
                padding: '20px 24px', background: 'var(--t-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
                    {editingId ? 'Editar Proposta' : 'Nova Proposta Comercial'}
                  </h2>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    Preencha os dados para gerar a proposta
                  </p>
                </div>
                <button onClick={() => setShowForm(false)}
                  style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Stepper */}
              <div style={{
                display: 'flex', gap: 0, borderBottom: '1px solid var(--t-card-border)',
                overflowX: 'auto', padding: '0 8px'
              }}>
                {sections.map((s, i) => (
                  <button key={s.label} onClick={() => setActiveSection(i)}
                    style={{
                      padding: '12px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: 'transparent', whiteSpace: 'nowrap',
                      borderBottom: activeSection === i ? '2px solid var(--t-primary)' : '2px solid transparent',
                      color: activeSection === i ? 'var(--t-primary)' : 'var(--t-text-muted)',
                    }}>
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>

              {/* Form body */}
              <div style={{ padding: 24, maxHeight: 'calc(80vh - 180px)', overflowY: 'auto' }}>

                {/* Seção 0 — Empresa */}
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
                      <select value={form.segmento as string} onChange={e => aplicarSegmento(e.target.value)} className="ps-input w-full">
                        <option value="">Selecione...</option>
                        {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
                        Define os planos, o título, a frase e o texto da proposta — tudo direcionado ao segmento.
                      </p>
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
                      <FormField label="Sistema Atual">
                        <input value={form.sistema_atual as string} onChange={e => setField('sistema_atual', e.target.value)} className="ps-input w-full" placeholder="Sistema que utiliza hoje" />
                      </FormField>
                    )}
                    <FormField label="Data Desejada para Virada">
                      <input type="date" value={form.data_virada as string} onChange={e => setField('data_virada', e.target.value)} className="ps-input w-full" />
                    </FormField>
                  </div>
                )}

                {/* Seção 1 — Responsável */}
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

                {/* Seção 2 — Comercial */}
                {activeSection === 2 && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Vendedor Responsável">
                      <input value={form.vendedor_nome as string} onChange={e => setField('vendedor_nome', e.target.value)} className="ps-input w-full" placeholder="Nome do vendedor" />
                      <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>Preenchido com o seu perfil; ajuste se gerar para outro vendedor.</p>
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
                    <FormField label="Status da Proposta" col={2}>
                      <select value={form.status} onChange={e => setField('status', e.target.value)} className="ps-input w-full">
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                )}

                {/* Seção 3 — Plano & Produtos */}
                {activeSection === 3 && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Apenas "Plano Recomendado": o deck sempre apresenta Pro × Plus
                        na mensalidade (preferência de venda). Mantemos plano_selecionado
                        espelhando o recomendado p/ compatibilidade (tabela/PDF/condições). */}
                    <FormField label={`Plano Recomendado${form.segmento ? ` — ${planosPorSegmento(form.segmento as string) === PLANOS_FARMA ? 'Farmácia' : 'Varejo / Padaria'}` : ''}`} col={2}>
                      <select
                        value={form.plano_recomendado as string}
                        onChange={e => { const v = e.target.value; setField('plano_recomendado', v); setField('plano_selecionado', v); }}
                        className="ps-input w-full">
                        {!form.segmento && <option value="">Selecione o segmento (aba Empresa) primeiro…</option>}
                        {form.segmento && <option value="">Selecione…</option>}
                        {planosPorSegmento(form.segmento as string).map(pl => <option key={pl} value={pl}>{pl}</option>)}
                      </select>
                    </FormField>
                    {!(form.plano_selecionado === 'MEI' || form.plano_recomendado === 'MEI') && (
                      <FormField label={`Mensalidade ${/farm/i.test(form.segmento as string) ? 'Farma' : 'Loja'} Pro (R$)`}>
                        <input type="number" value={form.mensalidade_pro as string} onChange={e => setField('mensalidade_pro', e.target.value)} className="ps-input w-full" placeholder="Ex: 350" />
                      </FormField>
                    )}
                    <FormField
                      label={(form.plano_selecionado === 'MEI' || form.plano_recomendado === 'MEI')
                        ? 'Mensalidade do plano MEI (R$)'
                        : `Mensalidade ${/farm/i.test(form.segmento as string) ? 'Farma' : 'Loja'} Plus (R$)`}
                      col={(form.plano_selecionado === 'MEI' || form.plano_recomendado === 'MEI') ? 2 : undefined}
                    >
                      <input type="number" value={form.mensalidade_plus as string} onChange={e => setField('mensalidade_plus', e.target.value)} className="ps-input w-full" placeholder="Ex: 520" />
                    </FormField>

                    <FormField label="Módulos do Plano" col={2}>
                      <p style={{ fontSize: 12, color: 'var(--t-text-muted)', padding: '8px 12px', borderRadius: 8, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                        Os módulos seguem automaticamente o que cada plano libera (Basic / Pro / Plus). Não é preciso selecionar — a proposta mostra o comparativo oficial do plano escolhido.
                      </p>
                    </FormField>

                    <FormField label="Serviços Adicionais" col={2}>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {SERVICOS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleList('servicos_adicionais', s)}
                            style={{
                              padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                              border: '1.5px solid',
                              borderColor: (form.servicos_adicionais as string[]).includes(s) ? '#16a34a' : 'var(--t-card-border)',
                              background: (form.servicos_adicionais as string[]).includes(s) ? '#dcfce7' : 'transparent',
                              color: (form.servicos_adicionais as string[]).includes(s) ? '#16a34a' : 'var(--t-text-muted)',
                              fontWeight: (form.servicos_adicionais as string[]).includes(s) ? 700 : 400,
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </FormField>
                  </div>
                )}

                {/* Seção 4 — Valores */}
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
                      <div style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 15, fontWeight: 800,
                        color: 'var(--t-primary)', background: 'var(--t-primary-light)',
                        border: '1.5px solid var(--t-primary-border)'
                      }}>
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
                      <div style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        color: '#16a34a', background: '#dcfce7',
                        border: '1.5px solid #86efac'
                      }}>
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

                {/* Seção 5 — Conteúdo */}
                {activeSection === 5 && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Título da Proposta (gerado pelo segmento)" col={2}>
                      <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)', background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                        {(form.titulo_proposta as string) || (tplDoSegmento(form.segmento as string)?.titulo) || 'Selecione o segmento (aba Empresa) para gerar o título'}
                      </div>
                    </FormField>
                    <FormField label="Frase do Hero (destaque)" col={2}>
                      <input value={form.frase_hero as string} onChange={e => setField('frase_hero', e.target.value)} className="ps-input w-full" placeholder="Ex: Seu negócio merece um sistema que cresce com ele" />
                    </FormField>
                    <FormField label="Texto de Valor para o Cliente" col={2}>
                      <textarea value={form.texto_valor as string} onChange={e => setField('texto_valor', e.target.value)} className="ps-input w-full" rows={3} placeholder="Por que a Prosystem é a melhor escolha para este cliente..." />
                    </FormField>
                    <FormField label="Observações Comerciais" col={2}>
                      <textarea value={form.observacoes as string} onChange={e => setField('observacoes', e.target.value)} className="ps-input w-full" rows={3} placeholder="Condições especiais, contexto da negociação..." />
                    </FormField>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--t-card-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div className="flex gap-2">
                  {activeSection > 0 && (
                    <button onClick={() => setActiveSection(s => s - 1)}
                      style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-primary)', cursor: 'pointer' }}>
                      ← Anterior
                    </button>
                  )}
                  {activeSection < sections.length - 1 && (
                    <button onClick={() => setActiveSection(s => s + 1)}
                      style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Próximo →
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowForm(false)}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-muted)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2"
                    style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--t-primary)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    <Save size={13} />
                    {saving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Salvar Proposta')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal preview/ações ─────────────────────────────── */}
        {previewProposta && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
            <div style={{
              background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 560,
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            }}>
              {/* header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{previewProposta.razao_social}</div>
                  {previewProposta.nome_fantasia && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{previewProposta.nome_fantasia}</div>}
                </div>
                <button onClick={() => setPreviewProposta(null)}
                  style={{ color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>

              {/* body */}
              <div style={{ padding: 24 }}>
                {/* Info grid */}
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
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-primary)' }}>
                          {previewProposta.parcelas}x {fmtBRL(previewProposta.valor_parcela)}
                        </div>
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

                {/* Status actions */}
                <div className="mb-4">
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 8 }}>Alterar Status</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <button key={k}
                        onClick={() => { handleStatus(previewProposta.id, k); setPreviewProposta({ ...previewProposta, status: k }); }}
                        style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                          borderColor: previewProposta.status === k ? v.color : 'var(--t-card-border)',
                          background: previewProposta.status === k ? v.bg : 'transparent',
                          color: previewProposta.status === k ? v.color : 'var(--t-text-muted)',
                        }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Links públicos — cliente (com versões) e apresentador */}
                {previewProposta.public_token && (() => {
                  const LinkRow = ({ cor, rotulo, modo, versao }: { cor: string; rotulo: string; modo?: 'cliente' | 'apresentador'; versao?: 'simples' | 'completa' }) => (
                    <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: cor, flexShrink: 0, minWidth: 130 }}>{rotulo}</span>
                      <span style={{ fontSize: 11, color: 'var(--t-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {propostaLink(previewProposta, modo, versao)}
                      </span>
                      <button onClick={() => handleCopyLink(previewProposta, modo, versao)}
                        style={{ fontSize: 11, color: 'var(--t-primary)', fontWeight: 700, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}>
                        Copiar
                      </button>
                    </div>
                  );
                  return (
                    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <LinkRow cor="#16a34a" rotulo="👤 Cliente — escolhe" modo="cliente" />
                      <LinkRow cor="#0891b2" rotulo="⚡ Cliente — simplificada" modo="cliente" versao="simples" />
                      <LinkRow cor="#7c3aed" rotulo="🎬 Cliente — completa" modo="cliente" versao="completa" />
                      <LinkRow cor="#2E6EAB" rotulo="🎤 Apresentador" modo="apresentador" />
                      <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 2 }}>
                        <b>Cliente — escolhe</b>: o cliente decide entre completa e simplificada. <b>Simplificada</b>: abre direto nos planos. <b>Completa</b>: a jornada inteira. <b>Apresentador</b>: para você apresentar.
                      </p>
                      {copied && <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Link copiado!</p>}
                    </div>
                  );
                })()}
              </div>

              {/* footer actions */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--t-card-border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => { openEdit(previewProposta); setPreviewProposta(null); }}
                  className="flex items-center gap-1.5"
                  style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', background: 'transparent', color: 'var(--t-text-primary)', cursor: 'pointer' }}>
                  <Edit3 size={12} /> Editar
                </button>
                {previewProposta.public_token && (
                  <button
                    onClick={() => window.open(`/p/${previewProposta.public_token}`, '_blank')}
                    className="flex items-center gap-1.5"
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-primary-border)', background: 'var(--t-primary-light)', color: 'var(--t-primary)', cursor: 'pointer' }}>
                    <Eye size={12} /> Ver Proposta
                  </button>
                )}
                {previewProposta.responsavel_telefone && (
                  <button onClick={() => handleWppCliente(previewProposta)}
                    title="Enviar resumo da proposta para o WhatsApp do cliente"
                    className="flex items-center gap-1.5"
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                    <MessageSquare size={12} /> WhatsApp
                  </button>
                )}
                {isGestor && (
                  <button onClick={() => handleDelete(previewProposta.id)}
                    className="flex items-center gap-1.5"
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', marginLeft: 'auto' }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

function FormField({ label, children, col }: { label: string; children: React.ReactNode; col?: number }) {
  return (
    <div style={{ gridColumn: col === 2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
