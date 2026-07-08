'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import { useSearchParams } from 'next/navigation';
import {
  Wrench, Rocket, Headphones, CalendarCheck, Clock,
  CheckCircle, X, Loader2, FileText, Briefcase, Coins, BookOpen,
  Copy, Check, AlertTriangle, User, MessageSquare, Send, ChevronDown,
  BarChart2, Timer, ShieldAlert, PhoneCall, Mail, Zap,
  LayoutGrid, RefreshCw, Printer, Building2, ArrowRight, Plus,
} from 'lucide-react';

// ─── tipos ───────────────────────────────────────────────────────────────────

interface Implantacao {
  id: string; contrato_id: string; cliente_razao_social: string;
  cliente_cnpj?: string; plano?: string; vendedor_nome?: string;
  valor_setup?: number; mensalidade?: number; status: string;
  data_assinatura?: string; data_agendada?: string; data_instalacao?: string;
  data_primeiro_vencimento?: string; mes_pagamento_comissao?: string;
  observacoes?: string;
}

interface Onboarding {
  id: string; status: string; progresso: number;
  etapas: { titulo: string; concluido: boolean; data_conclusao: string | null }[];
  licenca: { cliente: { id: string; nome: string; empresa?: string }; plano?: { nome: string } };
  created_at: string;
}

interface Ticket {
  id: string; titulo: string; descricao?: string; categoria: string;
  prioridade: string; status: string; created_at: string; resolucao_at?: string;
  sla_horas?: number; responsavel_id?: string;
  cliente: { id: string; nome: string; empresa?: string };
  licenca?: { plano?: { nome: string } };
}

// ─── constantes ──────────────────────────────────────────────────────────────

const IMPL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  AGUARDANDO_INSTALACAO: { label: 'Aguardando Instalação', color: '#d97706', bg: '#fef3c7' },
  AGENDADA:              { label: 'Agendada',              color: '#2563eb', bg: '#dbeafe' },
  INSTALADO:             { label: 'Instalado',             color: '#16a34a', bg: '#dcfce7' },
  CANCELADA:             { label: 'Cancelada',             color: '#9ca3af', bg: '#f3f4f6' },
};

const GRUPO_LABEL: Record<string, string> = {
  INSTALACAO:  'Instalação do Sistema',
  CONVERSAO:   'Conversão de Dados',
  TREINAMENTO: 'Treinamento',
};

const OB_STATUS_COLOR: Record<string, string> = {
  PENDENTE:     'color:#6b7280;background:#f3f4f6',
  EM_ANDAMENTO: 'color:#1d4ed8;background:#dbeafe',
  CONCLUIDO:    'color:#15803d;background:#dcfce7',
  PAUSADO:      'color:#a16207;background:#fef3c7',
};

const TICKET_PRIO_COLOR: Record<string, React.CSSProperties> = {
  BAIXA:   { background: 'rgba(148,163,184,0.12)', color: 'var(--t-text-muted)' },
  MEDIA:   { background: 'rgba(75,142,200,0.12)',  color: 'var(--t-primary)' },
  ALTA:    { background: 'rgba(234,88,12,0.10)',   color: '#ea580c' },
  CRITICA: { background: 'rgba(220,38,38,0.10)',   color: '#dc2626' },
};

const TICKET_STATUS_COLOR: Record<string, React.CSSProperties> = {
  ABERTO:             { background: 'rgba(234,179,8,0.12)',   color: '#a16207' },
  EM_ATENDIMENTO:     { background: 'rgba(75,142,200,0.12)', color: 'var(--t-primary)' },
  AGUARDANDO_CLIENTE: { background: 'rgba(147,51,234,0.10)', color: '#7e22ce' },
  RESOLVIDO:          { background: 'rgba(22,163,74,0.10)',  color: '#15803d' },
  FECHADO:            { background: 'rgba(148,163,184,0.12)', color: 'var(--t-text-muted)' },
};

const TICKET_STATS_STYLE: Record<string, { card: React.CSSProperties; value: React.CSSProperties }> = {
  ABERTO:             { card: { background: 'rgba(234,179,8,0.08)' },   value: { color: '#a16207' } },
  EM_ATENDIMENTO:     { card: { background: 'rgba(75,142,200,0.08)' },  value: { color: 'var(--t-primary)' } },
  AGUARDANDO_CLIENTE: { card: { background: 'rgba(147,51,234,0.08)' },  value: { color: '#7e22ce' } },
  RESOLVIDO:          { card: { background: 'rgba(22,163,74,0.08)' },   value: { color: '#15803d' } },
  FECHADO:            { card: { background: 'rgba(148,163,184,0.08)' }, value: { color: 'var(--t-text-muted)' } },
};

// ─── templates de atendimento ─────────────────────────────────────────────────

const VARIAVEIS = [
  '{{nome_cliente}}', '{{nome_agente}}', '{{numero_chamado}}', '{{problema}}',
  '{{prazo}}', '{{acao_realizada}}', '{{proxima_acao}}', '{{solucao_paliativa}}',
  '{{funcionalidade}}', '{{caminho_no_sistema}}', '{{informacao_1}}', '{{informacao_2}}',
];

const TEMPLATES = [
  {
    id: 'FC-01', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Abertura — Confirmação de Recebimento',
    cenario: 'Cliente abriu chamado; confirmando que foi recebido e quem está atendendo',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 👋 Aqui é {{nome_agente}} da ProSystem.\n\nRecebi seu chamado #{{numero_chamado}} sobre {{problema}}. Já estou analisando aqui!\n\nAssim que tiver novidade eu te retorno — normalmente em até 2 horas. Se tiver algo urgente, pode responder aqui que atendo na hora. 🙏`,
      email: `Olá, {{nome_cliente}},\n\nConfirmamos o recebimento do seu chamado #{{numero_chamado}}.\n\n**Assunto:** {{problema}}\n**Responsável:** {{nome_agente}}\n**Previsão de retorno:** {{prazo}}\n\nAcompanhe pelo nosso chat ou aguarde nosso retorno por e-mail.\n\nAbraços,\n{{nome_agente}}\nEquipe de Suporte ProSystem`,
    },
  },
  {
    id: 'FC-02', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'alta',
    titulo: 'Abertura — Problema Crítico (Operação Parada)',
    cenario: 'Cliente com operação completamente parada',
    canais: {
      whatsapp: `{{nome_cliente}}, recebi seu chamado — isso é prioridade máxima aqui! 🚨\n\nJá estou olhando para {{problema}} agora mesmo. Operação parada não pode esperar.\n\nMe conta: aconteceu depois de alguma atualização, queda de energia ou do nada? Enquanto isso já estou investigando pelo nosso lado.`,
      telefone: `"Olá, {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem. Recebi seu chamado sobre [problema] — já estou com o sistema aberto aqui. Me conta o que está acontecendo exatamente?"`,
    },
  },
  {
    id: 'FC-03', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'media',
    titulo: 'Abertura — Fora do Horário / Retorno Programado',
    cenario: 'Chamado fora do horário de suporte ou técnico precisou sair',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem.\n\nVi seu chamado sobre {{problema}} — recebi, mas no momento estou fora do horário de atendimento.\n\nRetorno até {{prazo}}. Se for urgência, ligue {{telefone_urgencia}}. 🙏`,
    },
  },
  {
    id: 'FC-04', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'media',
    titulo: 'Triagem — Pedindo Mais Detalhes',
    cenario: 'Descrição insuficiente para iniciar diagnóstico',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem. 👋\n\nRecebi sua mensagem — pode me ajudar com mais alguns detalhes?\n\n1. Qual módulo você estava usando? (Caixa, Estoque, NF, outro?)\n2. Apareceu alguma mensagem de erro?\n3. Aconteceu depois de alguma atualização ou do nada?\n\nCom isso já consigo te ajudar muito mais rápido! 🙏`,
    },
  },
  {
    id: 'FC-05', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Solicitação de Treinamento / Funcionalidade',
    cenario: 'Cliente quer aprender a usar uma função do sistema',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem.\n\nClaro, consigo te ajudar com isso! A função de {{funcionalidade}} fica em {{caminho_no_sistema}}.\n\nPrefere que eu te explique por aqui no passo a passo ou faço uma videochamada pra mostrar na tela?`,
    },
  },
  {
    id: 'INV-01', cat: 'investigacao', catLabel: 'Investigação', severity: 'media',
    titulo: 'Atualização de Status — Ainda Investigando',
    cenario: 'Problema complexo; técnico ainda analisando',
    canais: {
      whatsapp: `Oi {{nome_cliente}}, atualização sobre seu chamado #{{numero_chamado}}:\n\nJá identifiquei onde está o problema com {{problema}}, mas ainda estou corrigindo aqui — não quero te passar solução pela metade.\n\nVolto com novidade até {{prazo}}. Se precisar de qualquer coisa antes disso, é só chamar!`,
      email: `Olá, {{nome_cliente}},\n\nAtualização sobre o chamado #{{numero_chamado}} — {{problema}}:\n\n**O que já fiz:**\n- {{acao_realizada}}\n- {{outro_achado}}\n\n**Próximo passo:**\n{{proxima_acao}} — previsão: {{prazo}}\n\nTe atualizo até lá, ou antes se resolver.\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id: 'INV-02', cat: 'investigacao', catLabel: 'Investigação', severity: 'media',
    titulo: 'Solicitação de Informação Adicional',
    cenario: 'Precisa de mais dados do cliente para investigar',
    canais: {
      whatsapp: `{{nome_cliente}}, para resolver seu problema com {{problema}} preciso de mais duas informações:\n\n1. {{informacao_1}}\n2. {{informacao_2}}\n\nPode me mandar um print ou vídeo da tela? Vai agilizar muito! 📱`,
    },
  },
  {
    id: 'INV-03', cat: 'investigacao', catLabel: 'Investigação', severity: 'alta',
    titulo: 'Escalonamento para Técnico Especialista',
    cenario: 'Problema requer especialista de nível 2',
    canais: {
      whatsapp: `{{nome_cliente}}, o problema com {{problema}} é mais específico — preciso chamar nosso técnico especialista pra isso.\n\nJá passei todo o histórico pra ele, então você não vai precisar explicar de novo.\n\nEle entra em contato em até {{prazo}}. Seu chamado é #{{numero_chamado}}.`,
      email: `Olá, {{nome_cliente}},\n\nApós análise, o chamado #{{numero_chamado}} sobre {{problema}} requer nosso time técnico especializado.\n\n**O que acontece agora:**\n- Passei todo o contexto para {{nome_especialista}}, especialista em {{area}}\n- Ele entra em contato em até {{prazo}}\n- Você não precisará repetir as informações\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id: 'INV-04', cat: 'investigacao', catLabel: 'Investigação', severity: 'baixa',
    titulo: 'Aguardando Resposta do Cliente',
    cenario: 'Cliente não respondeu ao pedido de informação',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Tudo bem?\n\nSó passando pra lembrar que preciso das informações sobre {{problema}} para conseguir resolver pra você.\n\nQuando puder me mandar, a gente finaliza isso! 😊`,
    },
  },
  {
    id: 'INV-05', cat: 'investigacao', catLabel: 'Investigação', severity: 'alta',
    titulo: 'Dependência de Terceiro (SEFAZ, Operadora)',
    cenario: 'Resolução depende de sistema externo fora da governança ProSystem',
    canais: {
      whatsapp: `{{nome_cliente}}, identifiquei o problema com {{problema}}. A situação é que depende de normalização do sistema da {{terceiro}} — não está na nossa governança.\n\nEstou monitorando de hora em hora. Assim que normalizar, já aplico a correção aqui e te aviso.\n\nEnquanto isso: {{solucao_paliativa}}.`,
    },
  },
  {
    id: 'RES-01', cat: 'resolucao', catLabel: 'Resolução', severity: 'baixa',
    titulo: 'Problema Resolvido — Correção Simples',
    cenario: 'Problema resolvido com ação direta',
    canais: {
      whatsapp: `{{nome_cliente}}, resolvido! ✅\n\nO problema com {{problema}} era {{causa_simples}}. Já corrigi aqui — você pode testar agora?\n\nSe travar em alguma parte, me fala! 😊`,
      email: `Olá, {{nome_cliente}},\n\nBoa notícia — o problema com {{problema}} foi resolvido!\n\n**O que estava acontecendo:**\n{{causa_explicacao}}\n\n**O que fiz:**\n{{acao_realizada}}\n\n**O que você deve ver agora:**\n{{resultado_esperado}}\n\nPode testar e me confirmar que ficou tudo certo?\n\nAbraços,\n{{nome_agente}}\nSuporte ProSystem`,
    },
  },
  {
    id: 'RES-02', cat: 'resolucao', catLabel: 'Resolução', severity: 'baixa',
    titulo: 'Resolução com Ação Necessária do Cliente',
    cenario: 'Agente fez sua parte; cliente precisa completar um passo',
    canais: {
      whatsapp: `{{nome_cliente}}, fiz a correção do lado de cá. Agora precisa de um passo seu:\n\n1. {{passo_1}}\n2. {{passo_2}}\n3. {{passo_3}}\n\nPode fazer isso aí e me fala o que aparece? Estou aqui! 👍`,
    },
  },
  {
    id: 'RES-05', cat: 'resolucao', catLabel: 'Resolução', severity: 'alta',
    titulo: 'Resolução após Longa Espera',
    cenario: 'Problema demorou mais que o esperado para resolver',
    canais: {
      whatsapp: `{{nome_cliente}}, problema resolvido! ✅\n\nPeço desculpas pelo tempo que levou — {{motivo_da_demora}}. Sei que não é o ideal quando a operação está em andamento.\n\nJá está corrigido: {{descricao_solucao}}.\n\nPode testar e me confirmar? E obrigado pela paciência! 🙏`,
    },
  },
  {
    id: 'FU-01', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Verificação de Satisfação — 24h após Resolução',
    cenario: 'Follow-up rápido para confirmar que o problema não voltou',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 😊 Tudo certo por aí depois que resolvemos o {{problema}}?\n\nSe tudo bem, ótimo! Se aparecer qualquer coisa, é só chamar.`,
    },
  },
  {
    id: 'FU-02', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Pesquisa NPS / CSAT',
    cenario: 'Solicitar avaliação do atendimento',
    canais: {
      whatsapp: `Oi {{nome_cliente}}, tudo bem?\n\nFicou satisfeito com o atendimento sobre {{problema}}?\n\nDe 1 a 5, como avalia? (1 = Ruim, 5 = Excelente)\n\nSua resposta me ajuda muito a melhorar! 🙏`,
      email: `Olá, {{nome_cliente}},\n\nResolvemos recentemente o chamado #{{numero_chamado}}. Gostaríamos de saber como foi a experiência.\n\n👉 {{link_pesquisa}}\n\nLeva menos de 1 minuto e nos ajuda a melhorar para todos os nossos clientes.\n\nObrigado!\n{{nome_agente}}`,
    },
  },
  {
    id: 'CRI-01', cat: 'crise', catLabel: 'Crise', severity: 'critica',
    titulo: 'Notificação Inicial de Instabilidade',
    cenario: 'Sistema com instabilidade afetando múltiplos clientes',
    canais: {
      whatsapp: `⚠️ ProSystem — Aviso importante\n\nEstamos com instabilidade em {{funcionalidade_afetada}} neste momento. Nossa equipe técnica já está trabalhando na correção.\n\n**O que você pode fazer agora:** {{acao_paliativa}}\n\nPróxima atualização: {{proximo_aviso}}. Pedimos desculpas pelo transtorno.`,
      email: `Assunto: ⚠️ Instabilidade em {{funcionalidade_afetada}} — ProSystem\n\nOlá, {{nome_cliente}},\n\nEstamos comunicando uma instabilidade em {{funcionalidade_afetada}} que pode estar afetando sua operação.\n\n**O que está acontecendo:**\n{{descricao_tecnica_simples}}\n\n**O que estamos fazendo:**\nNossa equipe técnica identificou a causa. Previsão: {{prazo_estimado}}.\n\n**O que você pode fazer agora:**\n{{acao_paliativa}}\n\nPróxima atualização: {{proximo_aviso}}.\n\n{{nome_agente}}\nSuporte ProSystem`,
    },
  },
  {
    id: 'CRI-03', cat: 'crise', catLabel: 'Crise', severity: 'alta',
    titulo: 'Sistema Normalizado — Resolução de Crise',
    cenario: 'Instabilidade resolvida; comunicando normalização',
    canais: {
      whatsapp: `✅ ProSystem — Sistema normalizado\n\nO problema com {{funcionalidade_afetada}} foi resolvido às {{hora_resolucao}}.\n\nPode usar normalmente. Se perceber algo diferente, chama a gente!\n\nPedimos desculpas pelo impacto na sua operação. 🙏`,
    },
  },
  {
    id: 'BOT-01', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Saudação e Triagem Inicial',
    cenario: 'Primeira interação do chatbot — identificar o que o cliente precisa',
    canais: {
      whatsapp: `Oi! 👋 Aqui é o assistente da ProSystem Sistemas.\n\nComo posso te ajudar hoje?\n\n1️⃣ Tenho um problema técnico (sistema, PDV, impressora)\n2️⃣ Tenho dúvida sobre nota fiscal ou financeiro\n3️⃣ Quero aprender a usar uma função\n4️⃣ Quero falar com um atendente\n\nÉ só digitar o número ou me contar o que está acontecendo!`,
    },
  },
  {
    id: 'BOT-03', cat: 'chatbot', catLabel: 'Chatbot', severity: 'alta',
    titulo: 'FAQ — Não Consigo Emitir NF',
    cenario: 'Resposta automática para problemas de nota fiscal',
    canais: {
      whatsapp: `Problemas na emissão de NF costumam ter 3 causas:\n\n1. 📡 SEFAZ fora do ar — verifique em www.nfe.fazenda.gov.br\n2. 🔑 Certificado digital vencido — confira em Configurações → Certificado\n3. ⚙️ Configuração fiscal — verifique o CNPJ em Configurações → Fiscal\n\nConseguiu identificar qual é o caso? Se não, digita *ajuda* que um técnico resolve! 🙏`,
    },
  },
];

const CATS_ATEND = [
  { id: 'all',             label: 'Todos',             cor: '#6b7280' },
  { id: 'primeiro-contato', label: 'Primeiro Contato', cor: '#3b82f6' },
  { id: 'investigacao',    label: 'Investigação',       cor: '#f59e0b' },
  { id: 'resolucao',       label: 'Resolução',          cor: '#10b981' },
  { id: 'acompanhamento',  label: 'Acompanhamento',     cor: '#6366f1' },
  { id: 'crise',           label: 'Crise',              cor: '#ef4444' },
  { id: 'chatbot',         label: 'Chatbot',            cor: '#06b6d4' },
];

const SEV_COLOR: Record<string, { cor: string; bg: string }> = {
  baixa:   { cor: '#2563eb', bg: '#dbeafe' },
  media:   { cor: '#d97706', bg: '#fef3c7' },
  alta:    { cor: '#ea580c', bg: '#ffedd5' },
  critica: { cor: '#dc2626', bg: '#fee2e2' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtBRL  = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtMes  = (m?: string) => {
  if (!m) return '—';
  const [a, mes] = m.split('-');
  const nomes = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[Number(mes)]}/${a}`;
};

// ─── sub-componentes ──────────────────────────────────────────────────────────

function PrazoBadge({ prazos }: { prazos?: { virada?: any; finalizacao?: any } }) {
  if (!prazos) return <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>—</span>;
  const p = (prazos.virada && prazos.virada.status !== 'CUMPRIDO' && prazos.virada.status !== 'CUMPRIDO_ATRASO')
    ? prazos.virada : prazos.finalizacao;
  if (!p) return <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>—</span>;
  const cores: Record<string, { c: string; bg: string; txt: (d: number) => string }> = {
    NO_PRAZO:        { c: '#16a34a', bg: '#dcfce7', txt: d => `${d}d restantes` },
    ATENCAO:         { c: '#d97706', bg: '#fef3c7', txt: d => `vence em ${d}d` },
    ATRASADO:        { c: '#dc2626', bg: '#fee2e2', txt: d => `atrasado ${Math.abs(d)}d` },
    CUMPRIDO:        { c: '#16a34a', bg: '#dcfce7', txt: () => 'no prazo' },
    CUMPRIDO_ATRASO: { c: '#d97706', bg: '#fef3c7', txt: () => 'fora do prazo' },
  };
  const cfg = cores[p.status] || cores.NO_PRAZO;
  return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.c, background: cfg.bg, padding: '2px 8px', borderRadius: 999 }}>{cfg.txt(p.dias_restantes ?? 0)}</span>;
}

function TrilhaCard({ label, dias, cor }: { label: string; dias: number | null; cor: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${cor}33`, background: `${cor}0d` }}>
      <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor }}>{dias == null ? '—' : `${dias}`}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4 }}>{dias == null ? '' : 'dia(s)'}</span></div>
    </div>
  );
}

function Kpi({ label, value, color, icon: Icon }: any) {
  return (
    <div className="ps-card p-3 rounded-xl flex items-center gap-3" style={{ border: '1px solid var(--t-card-border)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}><Icon size={16} style={{ color }} /></div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

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

// ─── página principal ─────────────────────────────────────────────────────────

type Tab = 'implantacoes' | 'onboarding' | 'atendimento' | 'suporte' | 'demandas';

export default function PortalTecnicoPage() {
  const { isAuthenticated, loading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam || 'implantacoes');

  // Bootstrap auth from URL token (when opened as external window)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      apiClient.setTokens(token, '');
      // Remove token from URL then reload so auth-context picks it up from localStorage
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
      window.location.reload();
    }
  }, []);

  // ── Implantações state ──
  const [implLista, setImplLista] = useState<Implantacao[]>([]);
  const [implResumo, setImplResumo] = useState<any>(null);
  const [implLoading, setImplLoading] = useState(true);
  const [implSel, setImplSel] = useState<Implantacao | null>(null);
  const [implForm, setImplForm] = useState<any>({});
  const [implSaving, setImplSaving] = useState(false);
  const [exec, setExec] = useState<any | null>(null);
  const [execTab, setExecTab] = useState<'trilha' | 'atividades' | 'testes' | 'arquivos' | 'checklist'>('trilha');
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [novoArq, setNovoArq] = useState<{ nome: string; tipo: string; url: string }>({ nome: '', tipo: 'LINK', url: '' });
  const [novoChk, setNovoChk] = useState('');
  const [novoChkGrupo, setNovoChkGrupo] = useState('');

  // ── Onboarding state ──
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [obLoading, setObLoading] = useState(true);
  const [obFilter, setObFilter] = useState('');
  const [obExpandido, setObExpandido] = useState<string | null>(null);
  const [obSaving, setObSaving] = useState(false);

  // ── Atendimento state ──
  const [catFilter, setCatFilter] = useState('all');
  const [canalAtivo, setCanalAtivo] = useState<Record<string, 'whatsapp' | 'email' | 'telefone'>>({});
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // ── Suporte state ──
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStats, setTicketStats] = useState<any[]>([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');
  const [ticketPrioFilter, setTicketPrioFilter] = useState('');
  const [ticketLoading, setTicketLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [ticketForm, setTicketForm] = useState<any>({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
  const [ticketSaving, setTicketSaving] = useState(false);
  // ── Demandas state ──
  const [demandas, setDemandas] = useState<any[]>([]);
  const [demandasLoading, setDemandasLoading] = useState(true);
  const [demandasStats, setDemandasStats] = useState<any[]>([]);
  const [demandasFiltroStatus, setDemandasFiltroStatus] = useState('');
  const [demandasFiltroTipo, setDemandasFiltroTipo] = useState('');
  const [demandasView, setDemandasView] = useState<'kanban' | 'lista'>('kanban');
  const [demandaDetalhe, setDemandaDetalhe] = useState<any | null>(null);
  const [demandaForm, setDemandaForm] = useState<any>({});
  const [demandaSaving, setDemandaSaving] = useState(false);

  // ── Suporte extras ──
  const [ticketDetalhe, setTicketDetalhe] = useState<Ticket | null>(null);
  const [ticketComentario, setTicketComentario] = useState('');
  const [ticketComentarios, setTicketComentarios] = useState<{ texto: string; autor: string; data: string }[]>([]);
  const [suporteView, setSuporteView] = useState<'tickets' | 'sla' | 'templates'>('tickets');
  const [suporteCatFilter, setSuporteCatFilter] = useState('all');
  const [suporteCanalAtivo, setSuporteCanalAtivo] = useState<Record<string, 'whatsapp' | 'email' | 'telefone'>>({});
  const [suporteCopiadoId, setSuporteCopiadoId] = useState<string | null>(null);

  // ── loaders ───────────────────────────────────────────────────────────────

  const loadImpl = useCallback(async () => {
    setImplLoading(true);
    try {
      const r = await apiClient.getImplantacoes();
      setImplLista(r.data.data.implantacoes || []);
      setImplResumo(r.data.data.resumo || null);
    } catch { /* ignore */ } finally { setImplLoading(false); }
  }, []);

  const loadOnboarding = useCallback(() => {
    setObLoading(true);
    const params: any = {};
    if (obFilter) params.status = obFilter;
    apiClient.getOnboardings(params)
      .then(res => setOnboardings(res.data.data))
      .catch(console.error)
      .finally(() => setObLoading(false));
  }, [obFilter]);

  const loadTickets = useCallback(() => {
    setTicketLoading(true);
    const params: any = {};
    if (ticketStatusFilter) params.status = ticketStatusFilter;
    if (ticketPrioFilter)   params.prioridade = ticketPrioFilter;
    apiClient.getTickets(params)
      .then(res => {
        setTickets(res.data.data.tickets);
        setTicketStats(res.data.data.stats || []);
      })
      .catch(console.error)
      .finally(() => setTicketLoading(false));
  }, [ticketStatusFilter, ticketPrioFilter]);

  const loadDemandas = useCallback(() => {
    setDemandasLoading(true);
    const params: any = {};
    if (demandasFiltroStatus) params.status = demandasFiltroStatus;
    if (demandasFiltroTipo)   params.tipo_servico = demandasFiltroTipo;
    apiClient.getSolicitacoes(params)
      .then(res => {
        setDemandas(res.data.data.solicitacoes || []);
        setDemandasStats(res.data.data.stats || []);
      })
      .catch(console.error)
      .finally(() => setDemandasLoading(false));
  }, [demandasFiltroStatus, demandasFiltroTipo]);

  useEffect(() => { if (isAuthenticated) { loadImpl(); apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data?.data || [])).catch(() => {}); } }, [isAuthenticated, loadImpl]);
  useEffect(() => { if (isAuthenticated) loadOnboarding(); }, [isAuthenticated, loadOnboarding]);
  useEffect(() => { if (isAuthenticated) loadTickets(); }, [isAuthenticated, loadTickets]);
  useEffect(() => { if (isAuthenticated) loadDemandas(); }, [isAuthenticated, loadDemandas]);

  // ── implantações actions ───────────────────────────────────────────────────

  const abrirImpl = (i: Implantacao) => {
    setImplSel(i);
    setImplForm({
      data_instalacao: i.data_instalacao?.split('T')[0] || '',
      data_primeiro_vencimento: i.data_primeiro_vencimento?.split('T')[0] || '',
      data_agendada: i.data_agendada?.split('T')[0] || '',
      status: i.status,
      observacoes: i.observacoes || '',
    });
  };

  const abrirExec = async (i: Implantacao) => {
    setExecTab('trilha');
    try { const r = await apiClient.getImplantacao(i.id); setExec(r.data.data); } catch { /* ignore */ }
  };

  const recarregarExec = async () => {
    if (!exec) return;
    const r = await apiClient.getImplantacao(exec.id);
    setExec(r.data.data);
    loadImpl();
  };

  const designar   = async (tecnicoId: string) => { if (!exec || !tecnicoId) return; try { await apiClient.designarTecnico(exec.id, tecnicoId); await recarregarExec(); } catch { /* ignore */ } };
  const moverEtapa = async (etapa: string)    => { if (exec) { await apiClient.moverEtapaImplantacao(exec.id, etapa); await recarregarExec(); } };
  const treinamento= async (acao: 'INICIAR' | 'ENCERRAR') => { if (exec) { await apiClient.treinamentoImplantacao(exec.id, acao); await recarregarExec(); } };
  const addNota    = async () => { if (exec && novaNota.trim()) { await apiClient.addAtividadeImplantacao(exec.id, novaNota.trim()); setNovaNota(''); await recarregarExec(); } };
  const setTeste   = async (id: string, resultado: string) => { await apiClient.updateTesteImplantacao(id, { resultado }); await recarregarExec(); };
  const addArquivo = async () => { if (exec && novoArq.nome && novoArq.url) { await apiClient.addArquivoImplantacao(exec.id, novoArq); setNovoArq({ nome: '', tipo: 'LINK', url: '' }); await recarregarExec(); } };
  const delArquivo = async (aid: string) => { await apiClient.delArquivoImplantacao(aid); await recarregarExec(); };
  const addChk     = async (grupo: string) => { if (exec && novoChk.trim()) { await apiClient.addChecklistImplantacao(exec.id, novoChk.trim(), grupo); setNovoChk(''); setNovoChkGrupo(''); await recarregarExec(); } };
  const toggleChk  = async (itemId: string, feito: boolean) => { await apiClient.toggleChecklistImplantacao(itemId, feito); await recarregarExec(); };

  const salvarImpl = async () => {
    if (!implSel) return;
    setImplSaving(true);
    try {
      await apiClient.atualizarImplantacao(implSel.id, {
        data_instalacao: implForm.data_instalacao || undefined,
        data_primeiro_vencimento: implForm.data_primeiro_vencimento || undefined,
        data_agendada: implForm.data_agendada || undefined,
        status: implForm.status || undefined,
        observacoes: implForm.observacoes || undefined,
      });
      setImplSel(null);
      await loadImpl();
    } catch { /* ignore */ } finally { setImplSaving(false); }
  };

  const previewMesPag = (() => {
    if (!implForm.data_primeiro_vencimento) return null;
    const d = new Date(implForm.data_primeiro_vencimento + 'T00:00:00');
    const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`;
  })();

  // ── onboarding actions ────────────────────────────────────────────────────

  const toggleEtapa = async (ob: Onboarding, idx: number) => {
    setObSaving(true);
    const etapas = ob.etapas.map((e, i) =>
      i === idx ? { ...e, concluido: !e.concluido, data_conclusao: !e.concluido ? new Date().toISOString() : null } : e
    );
    try { await apiClient.updateOnboarding(ob.id, { etapas }); loadOnboarding(); }
    catch { /* ignore */ } finally { setObSaving(false); }
  };

  const obStats = {
    total:        onboardings.length,
    pendentes:    onboardings.filter(o => o.status === 'PENDENTE').length,
    em_andamento: onboardings.filter(o => o.status === 'EM_ANDAMENTO').length,
    concluidos:   onboardings.filter(o => o.status === 'CONCLUIDO').length,
  };

  // ── atendimento actions ───────────────────────────────────────────────────

  const canalDo = (t: typeof TEMPLATES[0]) => canalAtivo[t.id] || (Object.keys(t.canais)[0] as any);

  const copiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const templatesFiltrados = catFilter === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.cat === catFilter);

  // ── suporte actions ───────────────────────────────────────────────────────

  const openTicket = async () => {
    const cls = await apiClient.getClientes();
    setClientes(cls.data.data.clientes || []);
    setTicketForm({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
    setShowTicketModal(true);
  };

  const saveTicket = async () => {
    setTicketSaving(true);
    try {
      const payload = { ...ticketForm };
      if (payload.sla_horas) payload.sla_horas = parseInt(payload.sla_horas);
      else delete payload.sla_horas;
      await apiClient.createTicket(payload);
      setShowTicketModal(false);
      loadTickets();
    } catch { /* ignore */ } finally { setTicketSaving(false); }
  };

  const updateTicketStatus = async (id: string, status: string) => {
    await apiClient.updateTicket(id, { status });
    loadTickets();
    if (ticketDetalhe?.id === id) setTicketDetalhe(t => t ? { ...t, status } : t);
  };

  const updateTicketResponsavel = async (id: string, responsavel_id: string) => {
    await apiClient.updateTicket(id, { responsavel_id });
    loadTickets();
    if (ticketDetalhe?.id === id) setTicketDetalhe(t => t ? { ...t, responsavel_id } : t);
  };

  const abrirDetalhe = (ticket: Ticket) => {
    setTicketDetalhe(ticket);
    // Comentários são locais (sem endpoint no backend); recupera do localStorage
    try {
      const raw = localStorage.getItem(`ticket_comments_${ticket.id}`);
      setTicketComentarios(raw ? JSON.parse(raw) : []);
    } catch { setTicketComentarios([]); }
    setTicketComentario('');
  };

  const adicionarComentario = () => {
    if (!ticketComentario.trim() || !ticketDetalhe) return;
    const novo = { texto: ticketComentario.trim(), autor: 'Você', data: new Date().toISOString() };
    const atualizado = [...ticketComentarios, novo];
    setTicketComentarios(atualizado);
    try { localStorage.setItem(`ticket_comments_${ticketDetalhe.id}`, JSON.stringify(atualizado)); } catch {}
    setTicketComentario('');
  };

  const tempoAberto = (dt: string) => {
    const h = Math.floor((Date.now() - new Date(dt).getTime()) / 3600000);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  };

  const statsCount = (status: string) => {
    const s = ticketStats.find((x: any) => x.status === status);
    return s ? s._count.id : 0;
  };

  // SLA helpers
  const slaStatus = (ticket: Ticket) => {
    if (!ticket.sla_horas || ticket.status === 'RESOLVIDO' || ticket.status === 'FECHADO') return null;
    const horasAbertas = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000;
    const pct = (horasAbertas / ticket.sla_horas) * 100;
    if (pct >= 100) return { label: 'SLA Estourado', color: '#dc2626', bg: '#fee2e2', pct: 100 };
    if (pct >= 75)  return { label: 'SLA em risco',  color: '#d97706', bg: '#fef3c7', pct };
    return { label: 'No SLA', color: '#16a34a', bg: '#dcfce7', pct };
  };

  const ticketsCriticos = tickets.filter(t => t.prioridade === 'CRITICA' && t.status !== 'RESOLVIDO' && t.status !== 'FECHADO');
  const ticketsEmAtraso = tickets.filter(t => {
    const s = slaStatus(t);
    return s && s.pct >= 100;
  });
  const tempoMedioResol = (() => {
    const resolvidos = tickets.filter(t => t.resolucao_at);
    if (!resolvidos.length) return null;
    const somaH = resolvidos.reduce((acc, t) => acc + (new Date(t.resolucao_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0);
    const media = somaH / resolvidos.length;
    return media < 24 ? `${Math.round(media)}h` : `${Math.round(media / 24)}d`;
  })();

  const suporteCopiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setSuporteCopiadoId(id);
    setTimeout(() => setSuporteCopiadoId(null), 2000);
  };
  const suporteCanalDo = (t: typeof TEMPLATES[0]) => suporteCanalAtivo[t.id] || (Object.keys(t.canais)[0] as any);
  const suporteTemplatesFiltrados = suporteCatFilter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.cat === suporteCatFilter);

  // ── Demandas helpers ────────────────────────────────────────────────────────

  const updateDemanda = async (sid: string, clienteId: string, data: any) => {
    setDemandaSaving(true);
    try {
      await apiClient.updateSolicitacao(clienteId, sid, data);
      loadDemandas();
      if (demandaDetalhe?.id === sid) setDemandaDetalhe((d: any) => ({ ...d, ...data }));
    } catch { /* ignore */ } finally { setDemandaSaving(false); }
  };

  const TIPO_SERVICO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; sla_dias: number; marco: string }> = {
    'Conversão de Dados':       { label: 'Conversão',       icon: RefreshCw,  color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  sla_dias: 30, marco: 'Virada para ProSystem' },
    'Instalação Banco Zerado':  { label: 'Banco Zerado',    icon: Building2,  color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   sla_dias: 14, marco: 'Sistema em Operação' },
    'Troca de CNPJ':            { label: 'Troca de CNPJ',   icon: FileText,   color: '#d97706', bg: 'rgba(217,119,6,0.08)',   sla_dias: 7,  marco: 'Conclusão do Serviço' },
    'Instalação de Impressora': { label: 'Impressora',      icon: Printer,    color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   sla_dias: 3,  marco: 'Impressora Configurada' },
    'Treinamento':              { label: 'Treinamento',     icon: BookOpen,   color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   sla_dias: 5,  marco: 'Treinamento Concluído' },
    'Suporte Técnico':          { label: 'Suporte',         icon: Headphones, color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  sla_dias: 2,  marco: 'Problema Resolvido' },
    'Outros':                   { label: 'Outros',          icon: Wrench,     color: '#64748b', bg: 'rgba(100,116,139,0.08)', sla_dias: 5,  marco: 'Conclusão' },
  };

  const getTipoConfig = (tipo: string) => TIPO_SERVICO_CONFIG[tipo] || TIPO_SERVICO_CONFIG['Outros'];

  const demandaSlaStatus = (d: any) => {
    if (!d.data_solicitacao) return null;
    const cfg = getTipoConfig(d.tipo_servico);
    if (d.status === 'FINALIZADA' || d.status === 'CANCELADA') {
      if (d.data_finalizacao) {
        const diasGastos = Math.round((new Date(d.data_finalizacao).getTime() - new Date(d.data_solicitacao).getTime()) / 86400000);
        const noPrazo = diasGastos <= cfg.sla_dias;
        return { pct: Math.min((diasGastos / cfg.sla_dias) * 100, 100), label: noPrazo ? 'Concluído no prazo' : 'Concluído fora do prazo', color: noPrazo ? '#16a34a' : '#d97706', concluido: true };
      }
      return null;
    }
    const diasAberto = Math.round((Date.now() - new Date(d.data_solicitacao).getTime()) / 86400000);
    const pct = (diasAberto / cfg.sla_dias) * 100;
    if (pct >= 100) return { pct: 100, label: `SLA estourado (${diasAberto}d)`,          color: '#dc2626', concluido: false };
    if (pct >= 75)  return { pct,      label: `Em risco — ${cfg.sla_dias - diasAberto}d`, color: '#d97706', concluido: false };
    return              { pct,          label: `${cfg.sla_dias - diasAberto}d restantes`,  color: '#16a34a', concluido: false };
  };

  const STATUS_DEMANDA: Record<string, { label: string; color: string; bg: string }> = {
    ABERTA:                     { label: 'Aberta',               color: '#a16207', bg: 'rgba(234,179,8,0.1)' },
    EM_ATENDIMENTO:             { label: 'Em Atendimento',       color: 'var(--t-primary)', bg: 'rgba(75,142,200,0.1)' },
    AGUARDANDO_CLIENTE:         { label: 'Aguard. Cliente',      color: '#7e22ce', bg: 'rgba(126,34,206,0.1)' },
    AGUARDANDO_SUPORTE_INTERNO: { label: 'Aguard. Suporte Int.', color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
    AGUARDANDO_FINANCEIRO:      { label: 'Aguard. Financeiro',   color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
    AGUARDANDO_COMERCIAL:       { label: 'Aguard. Comercial',    color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    FINALIZADA:                 { label: 'Finalizada',           color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    CANCELADA:                  { label: 'Cancelada',            color: '#9ca3af', bg: 'rgba(148,163,184,0.1)' },
    REABERTA:                   { label: 'Reaberta',             color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  };

  const PRIO_DEMANDA: Record<string, { color: string; bg: string }> = {
    URGENTE: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
    ALTA:    { color: '#ea580c', bg: 'rgba(234,88,12,0.1)' },
    MEDIA:   { color: 'var(--t-primary)', bg: 'rgba(75,142,200,0.1)' },
    BAIXA:   { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  };

  // Agrupar demandas por tipo para kanban
  const KANBAN_COLUNAS = [
    { status: 'ABERTA',                     label: 'Abertas' },
    { status: 'EM_ATENDIMENTO',             label: 'Em Atendimento' },
    { status: 'AGUARDANDO_CLIENTE',         label: 'Aguardando' },
    { status: 'FINALIZADA',                 label: 'Finalizadas' },
  ];

  const demandasPorStatus = (status: string) => demandas.filter(d =>
    status === 'AGUARDANDO_CLIENTE'
      ? ['AGUARDANDO_CLIENTE','AGUARDANDO_SUPORTE_INTERNO','AGUARDANDO_FINANCEIRO','AGUARDANDO_COMERCIAL'].includes(d.status)
      : d.status === status
  );

  const demandasCriticas = demandas.filter(d => {
    const s = demandaSlaStatus(d);
    return s && !s.concluido && s.pct >= 100;
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--t-content-bg)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--t-primary)' }} />
      </div>
    );
  }

  const SIDEBAR_GROUPS = [
    {
      group: 'IMPLANTAÇÃO',
      color: '#2E6EAB',
      items: [
        { key: 'demandas'    as Tab, label: 'Demandas',     icon: LayoutGrid,   badge: demandas.filter(d => { const s = demandaSlaStatus(d); return s && !s.concluido && s.pct >= 100; }).length || null },
        { key: 'implantacoes'as Tab, label: 'Implantações', icon: Wrench,       badge: null },
        { key: 'onboarding'  as Tab, label: 'Onboarding',   icon: Rocket,       badge: null },
      ],
    },
    {
      group: 'SUPORTE',
      color: '#7c3aed',
      items: [
        { key: 'suporte'    as Tab, label: 'Tickets & SLA', icon: Headphones,   badge: tickets.filter(t => t.status === 'ABERTO').length || null },
        { key: 'atendimento'as Tab, label: 'Templates',     icon: MessageSquare, badge: null },
      ],
    },
  ];

  const TAB_TITLE: Record<Tab, string> = {
    demandas:     'Demandas Técnicas',
    implantacoes: 'Implantações',
    onboarding:   'Onboarding',
    suporte:      'Suporte — Tickets & SLA',
    atendimento:  'Templates de Atendimento',
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--t-card-border)', borderRadius: 8, fontSize: 14, background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--t-text-secondary)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--t-content-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar: logo + título + fechar ── */}
      <div style={{ background: 'var(--t-card-bg)', borderBottom: '1px solid var(--t-card-border)', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4B8EC8,#2E6EAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wrench size={15} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t-text-primary)', lineHeight: 1.1 }}>Portal Técnico</div>
            <div style={{ fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1 }}>ProSystem</div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: 'var(--t-card-border)', margin: '0 4px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>{TAB_TITLE[tab]}</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.close()} title="Fechar portal"
          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--t-card-border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-text-muted)' }}>
          <X size={13} />
        </button>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width: 210, flexShrink: 0, background: 'var(--t-card-bg)', borderRight: '1px solid var(--t-card-border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '12px 0' }}>
          {SIDEBAR_GROUPS.map(grp => (
            <div key={grp.group} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: grp.color, padding: '6px 16px 4px', textTransform: 'uppercase' }}>{grp.group}</div>
              {grp.items.map(item => {
                const active = tab === item.key;
                const Icon = item.icon;
                return (
                  <button key={item.key} onClick={() => setTab(item.key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', border: 'none', background: active ? `${grp.color}14` : 'transparent', cursor: 'pointer', transition: 'background 0.15s', position: 'relative',
                      borderLeft: active ? `3px solid ${grp.color}` : '3px solid transparent' }}>
                    <Icon size={15} color={active ? grp.color : 'var(--t-text-muted)'} />
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? grp.color : 'var(--t-text-secondary)', flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.badge ? (
                      <span style={{ fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 99, background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{item.badge}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Divider + versão */}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--t-card-border)', marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>CRM Técnico — ProSystem</div>
          </div>
        </aside>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ── TAB: DEMANDAS ── */}
        {tab === 'demandas' && (
          <div>
            {/* Alertas SLA estourado */}
            {demandasCriticas.length > 0 && (
              <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color="#dc2626" />
                <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                  {demandasCriticas.length} demanda{demandasCriticas.length > 1 ? 's' : ''} com SLA estourado
                </span>
                <span style={{ fontSize: 12, color: '#dc2626', opacity: 0.8 }}>
                  — {demandasCriticas.map(d => d.cliente_nome || d.cliente_empresa || '—').join(', ')}
                </span>
              </div>
            )}

            {/* KPIs + controles */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              {demandasStats.map((s: any) => {
                const cfg = getTipoConfig(s.tipo_servico);
                const Icon = cfg.icon;
                return (
                  <div key={s.tipo_servico} style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 130, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onClick={() => setDemandasFiltroTipo(demandasFiltroTipo === s.tipo_servico ? '' : s.tipo_servico)}>
                    <Icon size={16} color={cfg.color} />
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>{s.total ?? 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1.2 }}>{cfg.label}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={demandasFiltroStatus} onChange={e => setDemandasFiltroStatus(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                  <option value="">Todos os status</option>
                  {Object.entries(STATUS_DEMANDA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={() => setDemandasView(demandasView === 'kanban' ? 'lista' : 'kanban')}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <LayoutGrid size={14} />
                  {demandasView === 'kanban' ? 'Lista' : 'Kanban'}
                </button>
                <button onClick={() => loadDemandas()}
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-muted)', cursor: 'pointer' }}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {demandasLoading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--t-text-muted)' }}><Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} /></div>
            ) : demandasView === 'kanban' ? (
              /* ── KANBAN VIEW ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
                {KANBAN_COLUNAS.map(col => {
                  const cards = demandasPorStatus(col.status).filter(d =>
                    (!demandasFiltroTipo || d.tipo_servico === demandasFiltroTipo) &&
                    (!demandasFiltroStatus || d.status === demandasFiltroStatus || col.status === 'AGUARDANDO_CLIENTE')
                  );
                  return (
                    <div key={col.status} style={{ background: 'var(--t-content-bg)', borderRadius: 12, border: '1px solid var(--t-card-border)', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: 'var(--t-card-bg)', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>{col.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--t-text-muted)', background: 'var(--t-content-bg)', borderRadius: 99, padding: '1px 8px' }}>{cards.length}</span>
                      </div>
                      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                        {cards.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--t-text-muted)', fontSize: 12, padding: '16px 0', opacity: 0.5 }}>Nenhuma</div>
                        )}
                        {cards.map(d => {
                          const cfg = getTipoConfig(d.tipo_servico);
                          const sla = demandaSlaStatus(d);
                          const prio = PRIO_DEMANDA[d.prioridade] || PRIO_DEMANDA['BAIXA'];
                          const stsCfg = STATUS_DEMANDA[d.status] || STATUS_DEMANDA['ABERTA'];
                          const Icon = cfg.icon;
                          return (
                            <div key={d.id} onClick={() => { setDemandaDetalhe(d); setDemandaForm({ status: d.status, usuario_responsavel: d.usuario_responsavel || '', observacoes: d.observacoes || '' }); }}
                              style={{ background: 'var(--t-card-bg)', border: `1px solid ${sla && !sla.concluido && sla.pct >= 100 ? '#dc2626' : 'var(--t-card-border)'}`, borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                              {/* Tipo + prioridade */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <Icon size={12} color={cfg.color} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: prio.color, background: prio.bg, borderRadius: 99, padding: '1px 7px' }}>{d.prioridade}</span>
                              </div>
                              {/* Cliente */}
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 2, lineHeight: 1.3 }}>{d.cliente_nome || d.cliente_empresa || '—'}</div>
                              {d.cliente_empresa && d.cliente_nome && (
                                <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6 }}>{d.cliente_empresa}</div>
                              )}
                              {/* Descrição curta */}
                              {d.descricao && (
                                <div style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.descricao}</div>
                              )}
                              {/* SLA bar */}
                              {sla && (
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span style={{ fontSize: 10, color: sla.color, fontWeight: 600 }}>{sla.label}</span>
                                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{Math.round(sla.pct)}%</span>
                                  </div>
                                  <div style={{ height: 3, background: 'var(--t-content-bg)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(sla.pct, 100)}%`, background: sla.color, borderRadius: 99, transition: 'width 0.3s' }} />
                                  </div>
                                </div>
                              )}
                              {/* Status + responsável */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, color: stsCfg.color, background: stsCfg.bg, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>{stsCfg.label}</span>
                                {d.usuario_responsavel && (
                                  <span style={{ fontSize: 10, color: 'var(--t-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <User size={10} />{d.usuario_responsavel}
                                  </span>
                                )}
                              </div>
                              {/* Marco SLA */}
                              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--t-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowRight size={9} />
                                <span>Marco: {cfg.marco} — {cfg.sla_dias}d SLA</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── LISTA VIEW ── */
              <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--t-content-bg)', textAlign: 'left' }}>
                      {['Tipo', 'Cliente', 'Prioridade', 'Status', 'Responsável', 'SLA', 'Marco', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {demandas.filter(d =>
                      (!demandasFiltroTipo || d.tipo_servico === demandasFiltroTipo) &&
                      (!demandasFiltroStatus || d.status === demandasFiltroStatus)
                    ).map((d, i) => {
                      const cfg = getTipoConfig(d.tipo_servico);
                      const sla = demandaSlaStatus(d);
                      const prio = PRIO_DEMANDA[d.prioridade] || PRIO_DEMANDA['BAIXA'];
                      const stsCfg = STATUS_DEMANDA[d.status] || STATUS_DEMANDA['ABERTA'];
                      const Icon = cfg.icon;
                      return (
                        <tr key={d.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--t-content-bg)', cursor: 'pointer', borderTop: '1px solid var(--t-card-border)' }}
                          onClick={() => { setDemandaDetalhe(d); setDemandaForm({ status: d.status, usuario_responsavel: d.usuario_responsavel || '', observacoes: d.observacoes || '' }); }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon size={13} color={cfg.color} />
                              <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)' }}>{d.cliente_nome || d.cliente_empresa || '—'}</div>
                            {d.cliente_empresa && d.cliente_nome && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{d.cliente_empresa}</div>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, color: prio.color, background: prio.bg, borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>{d.prioridade}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, color: stsCfg.color, background: stsCfg.bg, borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>{stsCfg.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t-text-secondary)' }}>{d.usuario_responsavel || '—'}</td>
                          <td style={{ padding: '10px 12px', minWidth: 120 }}>
                            {sla ? (
                              <div>
                                <div style={{ fontSize: 11, color: sla.color, fontWeight: 600, marginBottom: 3 }}>{sla.label}</div>
                                <div style={{ height: 3, background: 'var(--t-content-bg)', borderRadius: 99, overflow: 'hidden', width: 80 }}>
                                  <div style={{ height: '100%', width: `${Math.min(sla.pct, 100)}%`, background: sla.color, borderRadius: 99 }} />
                                </div>
                              </div>
                            ) : <span style={{ color: 'var(--t-text-muted)', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t-text-muted)' }}>{cfg.marco}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <ArrowRight size={14} style={{ color: 'var(--t-text-muted)' }} />
                          </td>
                        </tr>
                      );
                    })}
                    {demandas.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)', fontSize: 13 }}>Nenhuma demanda encontrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Drawer: detalhe da demanda ── */}
            {demandaDetalhe && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDemandaDetalhe(null)} />
                <div style={{ width: 480, background: 'var(--t-card-bg)', borderLeft: '1px solid var(--t-card-border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                  {/* Header */}
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--t-content-bg)' }}>
                    <div>
                      {(() => { const cfg = getTipoConfig(demandaDetalhe.tipo_servico); const Icon = cfg.icon; return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={16} color={cfg.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{cfg.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>#{demandaDetalhe.id?.slice(-6)}</div>
                          </div>
                        </div>
                      ); })()}
                    </div>
                    <button onClick={() => setDemandaDetalhe(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)', padding: 4 }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 2 }}>Cliente</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{demandaDetalhe.cliente_nome || demandaDetalhe.cliente_empresa || '—'}</div>
                      </div>
                      <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 2 }}>Prioridade</div>
                        {(() => { const p = PRIO_DEMANDA[demandaDetalhe.prioridade] || PRIO_DEMANDA['BAIXA']; return (
                          <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{demandaDetalhe.prioridade}</span>
                        ); })()}
                      </div>
                      <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 2 }}>Aberta em</div>
                        <div style={{ fontSize: 12, color: 'var(--t-text-primary)' }}>
                          {demandaDetalhe.data_solicitacao ? new Date(demandaDetalhe.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 2 }}>CNPJ</div>
                        <div style={{ fontSize: 12, color: 'var(--t-text-primary)' }}>{demandaDetalhe.cliente_cnpj || '—'}</div>
                      </div>
                    </div>

                    {/* SLA */}
                    {(() => { const sla = demandaSlaStatus(demandaDetalhe); const cfg = getTipoConfig(demandaDetalhe.tipo_servico); return sla ? (
                      <div style={{ background: 'var(--t-content-bg)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-primary)' }}>SLA — {cfg.marco}</div>
                          <div style={{ fontSize: 11, color: sla.color, fontWeight: 700 }}>{sla.label}</div>
                        </div>
                        <div style={{ height: 6, background: 'var(--t-card-border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(sla.pct, 100)}%`, background: sla.color, borderRadius: 99, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>Prazo: {cfg.sla_dias} dias — {Math.round(sla.pct)}% utilizado</div>
                      </div>
                    ) : null; })()}

                    {/* Descrição */}
                    {demandaDetalhe.descricao && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 6 }}>DESCRIÇÃO</div>
                        <div style={{ fontSize: 13, color: 'var(--t-text-primary)', lineHeight: 1.6, background: 'var(--t-content-bg)', borderRadius: 8, padding: '10px 12px' }}>{demandaDetalhe.descricao}</div>
                      </div>
                    )}

                    {/* Responsável */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 6 }}>RESPONSÁVEL</div>
                      <select value={demandaForm.usuario_responsavel || ''} onChange={e => setDemandaForm((f: any) => ({ ...f, usuario_responsavel: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)', fontSize: 13 }}>
                        <option value="">Sem responsável</option>
                        {tecnicos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>STATUS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(STATUS_DEMANDA).map(([k, v]) => (
                          <button key={k} onClick={() => setDemandaForm((f: any) => ({ ...f, status: k }))}
                            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 99, border: `1px solid ${demandaForm.status === k ? v.color : 'var(--t-card-border)'}`, background: demandaForm.status === k ? v.bg : 'transparent', color: demandaForm.status === k ? v.color : 'var(--t-text-muted)', cursor: 'pointer', fontWeight: demandaForm.status === k ? 700 : 400, transition: 'all 0.15s' }}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Observações */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 6 }}>OBSERVAÇÕES</div>
                      <textarea value={demandaForm.observacoes || ''} onChange={e => setDemandaForm((f: any) => ({ ...f, observacoes: e.target.value }))} rows={3}
                        placeholder="Anotações sobre o andamento…"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    {/* Salvar */}
                    <button disabled={demandaSaving} onClick={() => updateDemanda(demandaDetalhe.id, demandaDetalhe.cliente_id, demandaForm)}
                      style={{ padding: '10px 0', borderRadius: 10, background: 'var(--t-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: demandaSaving ? 'not-allowed' : 'pointer', opacity: demandaSaving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {demandaSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Salvar alterações
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: IMPLANTAÇÕES ── */}
        {tab === 'implantacoes' && (
          <div>
            {implResumo && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Kpi label="Aguardando instalação" value={implResumo.aguardando} color="#d97706" icon={Clock} />
                <Kpi label="Agendadas"              value={implResumo.agendada}  color="#2563eb" icon={CalendarCheck} />
                <Kpi label="Instaladas"             value={implResumo.instalado} color="#16a34a" icon={CheckCircle} />
                <Kpi label="Total"                  value={implResumo.total}     color="#6b7280" icon={Wrench} />
              </div>
            )}

            <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
              {implLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--t-text-muted)' }}>Carregando…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--t-content-bg)', textAlign: 'left' }}>
                      {['Cliente', 'Plano', 'Vendedor', 'Status', 'Prazo', 'Instalação', '1º Vencimento', 'Comissão paga em', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {implLista.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--t-text-muted)' }}>
                        Nenhuma implantação ainda. Elas aparecem aqui quando um contrato é assinado.
                      </td></tr>
                    )}
                    {implLista.map(i => {
                      const cfg = IMPL_STATUS[i.status] || IMPL_STATUS.AGUARDANDO_INSTALACAO;
                      return (
                        <tr key={i.id} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--t-text-primary)' }}>{i.cliente_razao_social}</div>
                            {i.cliente_cnpj && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{i.cliente_cnpj}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{i.plano || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{i.vendedor_nome || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 999 }}>{cfg.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}><PrazoBadge prazos={(i as any).prazos} /></td>
                          <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{fmtData(i.data_instalacao)}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{fmtData(i.data_primeiro_vencimento)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: i.mes_pagamento_comissao ? '#2E6EAB' : 'var(--t-text-muted)' }}>{fmtMes(i.mes_pagamento_comissao)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => abrirImpl(i)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-primary-dark)', background: 'transparent', border: '1px solid #c7d8ec', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', marginRight: 6 }}>Datas</button>
                            <button onClick={() => abrirExec(i)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#2E6EAB', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>Executar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal datas */}
            {implSel && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setImplSel(null)}>
                <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, color: 'var(--t-text-primary)' }}>{implSel.cliente_razao_social}</div>
                    <button onClick={() => setImplSel(null)}><X size={16} style={{ color: 'var(--t-text-muted)' }} /></button>
                  </div>
                  <div style={{ padding: 20 }} className="space-y-3">
                    <Campo label="Data de instalação">
                      <input type="date" value={implForm.data_instalacao} onChange={e => setImplForm((p: any) => ({ ...p, data_instalacao: e.target.value }))} className="ps-input w-full" />
                    </Campo>
                    <Campo label="1º vencimento da mensalidade">
                      <input type="date" value={implForm.data_primeiro_vencimento} onChange={e => setImplForm((p: any) => ({ ...p, data_primeiro_vencimento: e.target.value }))} className="ps-input w-full" />
                    </Campo>
                    {previewMesPag && (
                      <div style={{ background: 'var(--t-primary-light)', border: '1px solid #c7d8ec', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t-primary-dark)' }}>
                        Comissão será paga em <strong>{fmtMes(previewMesPag)}</strong>
                      </div>
                    )}
                    <Campo label="Status">
                      <select value={implForm.status} onChange={e => setImplForm((p: any) => ({ ...p, status: e.target.value }))} className="ps-input w-full">
                        {Object.keys(IMPL_STATUS).map(k => <option key={k} value={k}>{IMPL_STATUS[k].label}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Observações">
                      <textarea value={implForm.observacoes} onChange={e => setImplForm((p: any) => ({ ...p, observacoes: e.target.value }))} className="ps-input w-full" rows={2} />
                    </Campo>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setImplSel(null)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={salvarImpl} disabled={implSaving} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer', opacity: implSaving ? .7 : 1 }}>
                        {implSaving ? 'Salvando…' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Drawer execução */}
            {exec && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setExec(null)}>
                <div style={{ background: 'var(--t-card-bg)', width: '100%', maxWidth: 640, height: '100%', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', position: 'sticky', top: 0, background: 'var(--t-card-bg)', zIndex: 1 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--t-text-primary)', fontSize: 16 }}>{exec.cliente_razao_social}</div>
                        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{exec.plano || '—'} · Setup {fmtBRL(exec.valor_setup)}</div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {exec.tipo_base && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                              background: exec.tipo_base === 'CONVERSAO' ? '#fef3c7' : '#dcfce7',
                              color: exec.tipo_base === 'CONVERSAO' ? '#d97706' : '#16a34a' }}>
                              {exec.tipo_base === 'CONVERSAO' ? `Conversão${exec.sistema_anterior ? ` · de ${exec.sistema_anterior}` : ''}` : 'Banco zerado'}
                            </span>
                          )}
                          {exec.prazos && <PrazoBadge prazos={exec.prazos} />}
                        </div>
                        {exec.prazos && (
                          <div style={{ fontSize: 10.5, color: 'var(--t-text-muted)', marginTop: 4 }}>
                            Prazo virada: {fmtData(exec.prazo_virada)}{exec.prazos.virada?.dias_restantes != null && !exec.data_instalacao && ` (${exec.prazos.virada.dias_restantes}d)`}
                            {'  ·  '}Finalização: {fmtData(exec.prazo_finalizacao)}{exec.prazos.finalizacao?.dias_restantes != null && !exec.data_conclusao && ` (${exec.prazos.finalizacao.dias_restantes}d)`}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setExec(null)}><X size={18} style={{ color: 'var(--t-text-muted)' }} /></button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-3">
                      <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Técnico:</span>
                      <select value={exec.tecnico_id || ''} onChange={e => designar(e.target.value)} className="ps-input" style={{ fontSize: 12, padding: '4px 8px' }}>
                        <option value="">Designar técnico…</option>
                        {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.cargo})</option>)}
                      </select>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-primary-dark)', background: 'var(--t-primary-light)', padding: '3px 8px', borderRadius: 999 }}>{exec.etapa_execucao}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {['EM_ANALISE', 'EM_CONVERSAO', 'EM_CONFIGURACAO', 'FINALIZADO'].map(et => (
                        <button key={et} onClick={() => moverEtapa(et)} disabled={!exec.tecnico_id}
                          style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: exec.tecnico_id ? 'pointer' : 'not-allowed',
                            border: '1px solid var(--t-card-border)', background: exec.etapa_execucao === et ? '#2E6EAB' : 'transparent', color: exec.etapa_execucao === et ? '#fff' : 'var(--t-text-muted)' }}>
                          {et.replace('EM_', '').replace('_', ' ')}
                        </button>
                      ))}
                      {!exec.treinamento_inicio
                        ? <button onClick={() => treinamento('INICIAR')} disabled={!exec.tecnico_id} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer' }}>▶ Iniciar treinamento</button>
                        : !exec.treinamento_fim
                          ? <button onClick={() => treinamento('ENCERRAR')} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#d97706', color: '#fff', cursor: 'pointer' }}>■ Encerrar treinamento</button>
                          : <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>✓ Treinamento concluído</span>}
                    </div>

                    <div className="flex gap-1 mt-3" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                      {([['trilha', 'Trilha'], ['atividades', 'Atividades'], ['testes', 'Testes'], ['arquivos', 'Arquivos'], ['checklist', 'Checklist']] as const).map(([k, label]) => (
                        <button key={k} onClick={() => setExecTab(k)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer',
                          borderBottom: execTab === k ? '2px solid #2E6EAB' : '2px solid transparent', color: execTab === k ? '#2E6EAB' : 'var(--t-text-muted)' }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: 20 }}>
                    {execTab === 'trilha' && exec.trilha && (
                      <div className="grid grid-cols-2 gap-3">
                        <TrilhaCard label="Negociação → assinatura" dias={exec.trilha.negociacao_dias} cor="#2563eb" />
                        <TrilhaCard label="Implantação (assinatura → instalado)" dias={exec.trilha.implantacao_dias} cor="#d97706" />
                        <TrilhaCard label="Treinamento (início → fim)" dias={exec.trilha.treinamento_dias} cor="#7c3aed" />
                        <TrilhaCard label="Tempo total do ciclo" dias={exec.trilha.total_dias} cor="#16a34a" />
                      </div>
                    )}
                    {execTab === 'atividades' && (
                      <div>
                        <div className="flex gap-2 mb-3">
                          <input value={novaNota} onChange={e => setNovaNota(e.target.value)} placeholder="Registrar atividade/nota…" className="ps-input flex-1" />
                          <button onClick={addNota} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }}>Registrar</button>
                        </div>
                        <div className="space-y-2">
                          {(exec.atividades || []).map((a: any) => (
                            <div key={a.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                              <div style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{a.descricao}</div>
                              <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 2 }}>{a.autor_nome || '—'} · {new Date(a.created_at).toLocaleString('pt-BR')}</div>
                            </div>
                          ))}
                          {(!exec.atividades || exec.atividades.length === 0) && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhuma atividade ainda.</p>}
                        </div>
                      </div>
                    )}
                    {execTab === 'testes' && (
                      <div className="space-y-2">
                        {(exec.testes || []).map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)' }}>
                            <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{t.item}</span>
                            <div className="flex gap-1">
                              {[['OK', '#16a34a'], ['DIVERGENTE', '#dc2626'], ['NAO_APLICA', '#9ca3af'], ['PENDENTE', '#d97706']].map(([r, c]) => (
                                <button key={r} onClick={() => setTeste(t.id, r as string)}
                                  style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${c}`,
                                    background: t.resultado === r ? c as string : 'transparent', color: t.resultado === r ? '#fff' : c as string }}>
                                  {r === 'NAO_APLICA' ? 'N/A' : r}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {execTab === 'arquivos' && (
                      <div>
                        <div className="grid grid-cols-12 gap-2 mb-3">
                          <input value={novoArq.nome} onChange={e => setNovoArq(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className="ps-input col-span-4" />
                          <select value={novoArq.tipo} onChange={e => setNovoArq(p => ({ ...p, tipo: e.target.value }))} className="ps-input col-span-3">
                            <option value="LINK">Link</option><option value="ANEXO">Anexo (URL)</option>
                          </select>
                          <input value={novoArq.url} onChange={e => setNovoArq(p => ({ ...p, url: e.target.value }))} placeholder="URL" className="ps-input col-span-4" />
                          <button onClick={addArquivo} style={{ borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }} className="col-span-1">+</button>
                        </div>
                        <div className="space-y-2">
                          {(exec.arquivos || []).map((a: any) => (
                            <div key={a.id} className="flex items-center justify-between" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)' }}>
                              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--t-primary-dark)', fontWeight: 600 }}>📎 {a.nome} ↗</a>
                              <button onClick={() => delArquivo(a.id)} style={{ fontSize: 11, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>remover</button>
                            </div>
                          ))}
                          {(!exec.arquivos || exec.arquivos.length === 0) && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum arquivo. Adicione anexos (URL) ou links.</p>}
                        </div>
                      </div>
                    )}
                    {execTab === 'checklist' && (
                      <div className="space-y-5">
                        {(exec.grupos || []).map((g: any) => (
                          <div key={g.grupo}>
                            <div className="flex items-center justify-between mb-1">
                              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t-text-primary)' }}>{GRUPO_LABEL[g.grupo] || g.grupo}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: g.progresso === 100 ? '#16a34a' : '#2E6EAB' }}>{g.progresso}% · {g.feitos}/{g.total}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 999, background: 'var(--t-card-border)', marginBottom: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${g.progresso}%`, height: '100%', background: g.progresso === 100 ? '#16a34a' : '#2E6EAB' }} />
                            </div>
                            <div className="space-y-1">
                              {g.itens.map((c: any) => (
                                <label key={c.id} className="flex items-start gap-2" style={{ cursor: 'pointer', padding: '3px 4px' }}>
                                  <input type="checkbox" checked={c.feito} onChange={e => toggleChk(c.id, e.target.checked)} style={{ marginTop: 3 }} />
                                  <span style={{ fontSize: 12.5, color: 'var(--t-text-primary)', textDecoration: c.feito ? 'line-through' : 'none', opacity: c.feito ? .55 : 1 }}>{c.titulo}</span>
                                </label>
                              ))}
                              <div className="flex gap-2 mt-1.5">
                                <input value={novoChkGrupo === g.grupo ? novoChk : ''} onFocus={() => setNovoChkGrupo(g.grupo)} onChange={e => { setNovoChkGrupo(g.grupo); setNovoChk(e.target.value); }}
                                  placeholder="Adicionar item…" className="ps-input flex-1" style={{ fontSize: 12 }} />
                                <button onClick={() => addChk(g.grupo)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }}>+</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!exec.grupos || exec.grupos.length === 0) && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Designe um técnico para gerar a trilha de implantação.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ONBOARDING ── */}
        {tab === 'onboarding' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total',        value: obStats.total,        color: '#6b7280' },
                { label: 'Pendentes',    value: obStats.pendentes,    color: '#6b7280' },
                { label: 'Em Andamento', value: obStats.em_andamento, color: '#1d4ed8' },
                { label: 'Concluídos',   value: obStats.concluidos,   color: '#15803d' },
              ].map(c => (
                <div key={c.label} className="ps-card rounded-xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{c.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 2 }}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {['', 'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO'].map(s => (
                <button key={s} onClick={() => setObFilter(s)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: obFilter === s ? 'none' : '1px solid var(--t-card-border)',
                    background: obFilter === s ? '#2E6EAB' : 'var(--t-card-bg)',
                    color: obFilter === s ? '#fff' : 'var(--t-text-muted)' }}>
                  {s === '' ? 'Todos' : s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {obLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--t-text-muted)' }}>Carregando…</div>
            ) : onboardings.length === 0 ? (
              <div className="ps-card rounded-xl p-12 text-center" style={{ border: '1px solid var(--t-card-border)' }}>
                <Rocket size={40} style={{ color: 'var(--t-text-muted)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--t-text-muted)' }}>Nenhum onboarding em andamento</p>
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 4 }}>Os onboardings são criados automaticamente quando uma licença é ativada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {onboardings.filter(o => !obFilter || o.status === obFilter).map(ob => {
                  const [cssFrag] = OB_STATUS_COLOR[ob.status]?.split(';') ?? ['color:#6b7280'];
                  const styleMap = Object.fromEntries((OB_STATUS_COLOR[ob.status] || '').split(';').map(p => { const [k, v] = p.split(':'); return [k?.trim(), v?.trim()]; }));
                  return (
                    <div key={ob.id} className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
                      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setObExpandido(obExpandido === ob.id ? null : ob.id)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontWeight: 700, color: 'var(--t-text-primary)', fontSize: 14 }}>{ob.licenca.cliente.nome}</span>
                            {ob.licenca.cliente.empresa && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>· {ob.licenca.cliente.empresa}</span>}
                            {ob.licenca.plano && <span style={{ fontSize: 11, color: 'var(--t-text-muted)', border: '1px solid var(--t-card-border)', padding: '1px 6px', borderRadius: 6 }}>{ob.licenca.plano.nome}</span>}
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>Iniciado em {new Date(ob.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--t-text-primary)' }}>{ob.progresso}%</p>
                            <div style={{ width: 96, background: 'var(--t-card-border)', borderRadius: 999, height: 6, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${ob.progresso}%`, height: '100%', background: ob.progresso === 100 ? '#16a34a' : '#2E6EAB' }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, ...styleMap }}>{ob.status.replace('_', ' ')}</span>
                          <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>{obExpandido === ob.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {obExpandido === ob.id && (
                        <div style={{ borderTop: '1px solid var(--t-card-border)', padding: 16 }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {ob.etapas.map((etapa, idx) => (
                              <button key={idx} onClick={() => toggleEtapa(ob, idx)} disabled={obSaving}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, cursor: 'pointer',
                                  border: `1px solid ${etapa.concluido ? '#bbf7d0' : 'var(--t-card-border)'}`,
                                  background: etapa.concluido ? '#f0fdf4' : 'var(--t-card-bg)', textAlign: 'left' }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                  background: etapa.concluido ? '#16a34a' : 'transparent', border: etapa.concluido ? 'none' : '2px solid #d1d5db', color: '#fff', fontSize: 11 }}>
                                  {etapa.concluido && '✓'}
                                </div>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: etapa.concluido ? '#15803d' : 'var(--t-text-primary)', textDecoration: etapa.concluido ? 'line-through' : 'none' }}>{etapa.titulo}</p>
                                  {etapa.data_conclusao && <p style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>{new Date(etapa.data_conclusao).toLocaleDateString('pt-BR')}</p>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ATENDIMENTO ── */}
        {tab === 'atendimento' && (
          <div>
            {/* Variáveis */}
            <div className="ps-card rounded-xl p-4 mb-5" style={{ border: '1px solid var(--t-card-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>VARIÁVEIS DISPONÍVEIS</div>
              <div className="flex flex-wrap gap-2">
                {VARIAVEIS.map(v => (
                  <button key={v} onClick={() => copiar(v, v)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-primary-dark)' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros categoria */}
            <div className="flex gap-2 flex-wrap mb-5">
              {CATS_ATEND.map(c => (
                <button key={c.id} onClick={() => setCatFilter(c.id)}
                  style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: catFilter === c.id ? 'none' : '1px solid var(--t-card-border)',
                    background: catFilter === c.id ? c.cor : 'var(--t-card-bg)',
                    color: catFilter === c.id ? '#fff' : 'var(--t-text-muted)' }}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Lista de templates */}
            <div className="space-y-4">
              {templatesFiltrados.map(t => {
                const canal = canalDo(t);
                const canaisDisponiveis = Object.keys(t.canais) as ('whatsapp' | 'email' | 'telefone')[];
                const sev = SEV_COLOR[t.severity] || SEV_COLOR.baixa;
                const copiado = copiadoId === `${t.id}-${canal}`;
                return (
                  <div key={t.id} className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: sev.bg, color: sev.cor }}>{t.severity.toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{t.catLabel}</span>
                          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{t.id}</span>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--t-text-primary)', fontSize: 14 }}>{t.titulo}</div>
                        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>{t.cenario}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {canaisDisponiveis.map(c => (
                          <button key={c} onClick={() => setCanalAtivo(p => ({ ...p, [t.id]: c }))}
                            style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                              border: canal === c ? 'none' : '1px solid var(--t-card-border)',
                              background: canal === c ? '#2E6EAB' : 'var(--t-card-bg)',
                              color: canal === c ? '#fff' : 'var(--t-text-muted)' }}>
                            {c === 'whatsapp' ? 'WhatsApp' : c === 'email' ? 'E-mail' : 'Telefone'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <pre style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                        {(t.canais as any)[canal]}
                      </pre>
                      <div className="flex justify-end mt-3">
                        <button onClick={() => copiar(`${t.id}-${canal}`, (t.canais as any)[canal])}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                            border: 'none', background: copiado ? '#dcfce7' : '#2E6EAB', color: copiado ? '#15803d' : '#fff' }}>
                          {copiado ? <><Check size={13} />Copiado!</> : <><Copy size={13} />Copiar</>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: SUPORTE ── */}
        {tab === 'suporte' && (
          <div className="space-y-4">

            {/* Sub-nav: Tickets | SLA | Templates */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-1" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 3 }}>
                {([['tickets', 'Tickets', Headphones], ['sla', 'Painel SLA', BarChart2], ['templates', 'Templates', MessageSquare]] as const).map(([v, l, Icon]) => (
                  <button key={v} onClick={() => setSuporteView(v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: suporteView === v ? 'var(--t-primary)' : 'transparent',
                      color: suporteView === v ? '#fff' : 'var(--t-text-muted)' }}>
                    <Icon size={13} />{l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <ExportButton nome="suporte-tickets" titulo="Suporte Técnico — Tickets" linhas={tickets}
                  colunas={[
                    { header: 'Título',       value: (t: Ticket) => t.titulo },
                    { header: 'Cliente',      value: (t: Ticket) => t.cliente?.nome || '' },
                    { header: 'Empresa',      value: (t: Ticket) => t.cliente?.empresa || '' },
                    { header: 'Categoria',    value: (t: Ticket) => t.categoria },
                    { header: 'Prioridade',   value: (t: Ticket) => t.prioridade },
                    { header: 'Status',       value: (t: Ticket) => t.status },
                    { header: 'Aberto em',    value: (t: Ticket) => t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '' },
                    { header: 'Resolvido em', value: (t: Ticket) => t.resolucao_at ? new Date(t.resolucao_at).toLocaleString('pt-BR') : '' },
                  ]} />
                <button onClick={openTicket} style={{ padding: '7px 14px', background: 'var(--t-primary)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  + Abrir Ticket
                </button>
              </div>
            </div>

            {/* Stats rápidos sempre visíveis */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: 'Abertos',            status: 'ABERTO' },
                { label: 'Em Atendimento',     status: 'EM_ATENDIMENTO' },
                { label: 'Aguardando',         status: 'AGUARDANDO_CLIENTE' },
                { label: 'Resolvidos',         status: 'RESOLVIDO' },
                { label: 'Fechados',           status: 'FECHADO' },
              ].map(c => (
                <div key={c.status} onClick={() => { setSuporteView('tickets'); setTicketStatusFilter(ticketStatusFilter === c.status ? '' : c.status); }}
                  style={{ ...TICKET_STATS_STYLE[c.status].card, borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                    border: ticketStatusFilter === c.status ? `2px solid ${Object.values(TICKET_STATS_STYLE[c.status].value)[0]}` : '1px solid transparent' }}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: 0 }}>{c.label}</p>
                  <p style={{ ...TICKET_STATS_STYLE[c.status].value, fontSize: '1.4rem', fontWeight: 800, marginTop: 2 }}>{statsCount(c.status)}</p>
                </div>
              ))}
              <div style={{ background: ticketsCriticos.length > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(148,163,184,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: 0 }}>Críticos</p>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 2, color: ticketsCriticos.length > 0 ? '#dc2626' : 'var(--t-text-muted)' }}>{ticketsCriticos.length}</p>
              </div>
            </div>

            {/* ── VIEW: TICKETS ── */}
            {suporteView === 'tickets' && (
              <div className="space-y-3">
                {/* Filtros */}
                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1 flex-wrap">
                    {['', 'ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'].map(s => (
                      <button key={s} onClick={() => setTicketStatusFilter(s)}
                        style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                          border: ticketStatusFilter === s ? 'none' : '1px solid var(--t-card-border)',
                          background: ticketStatusFilter === s ? 'var(--t-primary)' : 'var(--t-card-bg)',
                          color: ticketStatusFilter === s ? '#fff' : 'var(--t-text-secondary)' }}>
                        {s === '' ? 'Todos' : s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {['', 'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'].map(p => (
                      <button key={p} onClick={() => setTicketPrioFilter(p)}
                        style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                          border: ticketPrioFilter === p ? 'none' : '1px solid var(--t-card-border)',
                          background: ticketPrioFilter === p ? '#dc2626' : 'var(--t-card-bg)',
                          color: ticketPrioFilter === p ? '#fff' : 'var(--t-text-secondary)' }}>
                        {p === '' ? 'Todas prio.' : p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tabela */}
                <div className="ps-card" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--t-card-border)' }}>
                  {ticketLoading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--t-text-muted)' }}>Carregando…</div>
                  ) : tickets.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <Headphones size={40} style={{ color: 'var(--t-text-muted)', margin: '0 auto 12px' }} />
                      <p style={{ color: 'var(--t-text-muted)' }}>Nenhum ticket encontrado</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                        <tr>
                          {['Ticket', 'Cliente', 'Categoria', 'Prio.', 'SLA', 'Tempo', 'Responsável', 'Status', ''].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((ticket, idx) => {
                          const sla = slaStatus(ticket);
                          return (
                            <tr key={ticket.id} style={{ borderTop: idx > 0 ? '1px solid var(--t-card-border)' : 'none', background: 'var(--t-card-bg)', cursor: 'pointer' }}
                              onClick={() => abrirDetalhe(ticket)}>
                              <td style={{ padding: '12px 14px' }}>
                                <p style={{ fontWeight: 600, color: 'var(--t-text-primary)', margin: 0, fontSize: 13 }}>{ticket.titulo}</p>
                                {ticket.descricao && <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: '2px 0 0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.descricao}</p>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <p style={{ fontSize: 13, color: 'var(--t-text-primary)', margin: 0 }}>{ticket.cliente.nome}</p>
                                {ticket.cliente.empresa && <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: '2px 0 0' }}>{ticket.cliente.empresa}</p>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--t-text-secondary)' }}>
                                  <CategoriaIcon categoria={ticket.categoria} size={12} />{ticket.categoria}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ ...TICKET_PRIO_COLOR[ticket.prioridade], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{ticket.prioridade}</span>
                              </td>
                              <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                                {sla ? (
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: sla.color, background: sla.bg, padding: '2px 6px', borderRadius: 6 }}>{sla.label}</span>
                                    <div style={{ height: 3, borderRadius: 2, background: 'var(--t-card-border)', marginTop: 4, overflow: 'hidden', width: 60 }}>
                                      <div style={{ width: `${Math.min(sla.pct, 100)}%`, height: '100%', background: sla.color }} />
                                    </div>
                                  </div>
                                ) : <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>—</span>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--t-text-secondary)' }}>
                                  <Clock size={12} />{tempoAberto(ticket.created_at)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                                <select value={ticket.responsavel_id || ''} onChange={e => updateTicketResponsavel(ticket.id, e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-secondary)', cursor: 'pointer', maxWidth: 120 }}>
                                  <option value="">Não designado</option>
                                  {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                                <select value={ticket.status} onChange={e => updateTicketStatus(ticket.id, e.target.value)}
                                  style={{ ...TICKET_STATUS_COLOR[ticket.status], fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, cursor: 'pointer', border: 'none', outline: 'none' }}>
                                  {['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: 11, color: 'var(--t-primary)', fontWeight: 600 }}>Ver →</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── VIEW: PAINEL SLA ── */}
            {suporteView === 'sla' && (
              <div className="space-y-4">
                {/* KPIs SLA */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div style={{ background: 'rgba(220,38,38,0.08)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <ShieldAlert size={16} color="#dc2626" />
                      <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>SLA Estourado</span>
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>{ticketsEmAtraso.length}</p>
                  </div>
                  <div style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Zap size={16} color="#dc2626" />
                      <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Críticos abertos</span>
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>{ticketsCriticos.length}</p>
                  </div>
                  <div style={{ background: 'rgba(22,163,74,0.08)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Timer size={16} color="#16a34a" />
                      <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Tempo médio resolução</span>
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a', margin: 0 }}>{tempoMedioResol || '—'}</p>
                  </div>
                  <div style={{ background: 'rgba(75,142,200,0.08)', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <BarChart2 size={16} color="var(--t-primary)" />
                      <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Total abertos</span>
                    </div>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--t-primary)', margin: 0 }}>{statsCount('ABERTO') + statsCount('EM_ATENDIMENTO')}</p>
                  </div>
                </div>

                {/* Tickets em atraso de SLA */}
                {ticketsEmAtraso.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={15} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Tickets com SLA estourado</span>
                    </div>
                    <div className="space-y-2">
                      {ticketsEmAtraso.map(t => (
                        <div key={t.id} onClick={() => abrirDetalhe(t)} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--t-text-primary)', margin: 0, fontSize: 13 }}>{t.titulo}</p>
                            <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: '2px 0 0' }}>{t.cliente.nome} · {tempoAberto(t.created_at)} aberto</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span style={{ ...TICKET_PRIO_COLOR[t.prioridade], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{t.prioridade}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 6 }}>SLA ESTOURADO</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tickets críticos */}
                {ticketsCriticos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert size={15} color="#dc2626" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>Tickets de prioridade crítica em aberto</span>
                    </div>
                    <div className="space-y-2">
                      {ticketsCriticos.map(t => {
                        const sla = slaStatus(t);
                        return (
                          <div key={t.id} onClick={() => abrirDetalhe(t)} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(234,88,12,0.25)', background: 'rgba(234,88,12,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, color: 'var(--t-text-primary)', margin: 0, fontSize: 13 }}>{t.titulo}</p>
                              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', margin: '2px 0 0' }}>{t.cliente.nome} · {tempoAberto(t.created_at)} aberto</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {sla && <span style={{ fontSize: 10, fontWeight: 700, color: sla.color, background: sla.bg, padding: '2px 6px', borderRadius: 6 }}>{sla.label}</span>}
                              <span style={{ ...TICKET_STATUS_COLOR[t.status], fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}>{t.status.replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {ticketsEmAtraso.length === 0 && ticketsCriticos.length === 0 && (
                  <div style={{ padding: 48, textAlign: 'center', borderRadius: 12, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
                    <CheckCircle size={40} style={{ color: '#16a34a', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 700, color: '#16a34a', fontSize: 15, margin: 0 }}>Tudo em dia!</p>
                    <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 4 }}>Nenhum ticket crítico ou com SLA estourado.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── VIEW: TEMPLATES ── */}
            {suporteView === 'templates' && (
              <div>
                <div style={{ padding: '12px 16px', background: 'var(--t-card-bg)', borderRadius: 10, border: '1px solid var(--t-card-border)', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>VARIÁVEIS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIAVEIS.map(v => (
                      <button key={v} onClick={() => suporteCopiar(v, v)}
                        style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-primary-dark)' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {CATS_ATEND.map(c => (
                    <button key={c.id} onClick={() => setSuporteCatFilter(c.id)}
                      style={{ padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: suporteCatFilter === c.id ? 'none' : '1px solid var(--t-card-border)',
                        background: suporteCatFilter === c.id ? c.cor : 'var(--t-card-bg)',
                        color: suporteCatFilter === c.id ? '#fff' : 'var(--t-text-muted)' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {suporteTemplatesFiltrados.map(t => {
                    const canal = suporteCanalDo(t);
                    const canaisDisponiveis = Object.keys(t.canais) as ('whatsapp' | 'email' | 'telefone')[];
                    const sev = SEV_COLOR[t.severity] || SEV_COLOR.baixa;
                    const copiado = suporteCopiadoId === `${t.id}-${canal}`;
                    return (
                      <div key={t.id} className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: sev.bg, color: sev.cor }}>{t.severity.toUpperCase()}</span>
                              <span style={{ fontSize: 9, color: 'var(--t-text-muted)' }}>{t.catLabel} · {t.id}</span>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--t-text-primary)', fontSize: 13 }}>{t.titulo}</div>
                            <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 1 }}>{t.cenario}</div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {canaisDisponiveis.map(c => (
                              <button key={c} onClick={() => setSuporteCanalAtivo(p => ({ ...p, [t.id]: c }))}
                                style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 5, cursor: 'pointer',
                                  border: canal === c ? 'none' : '1px solid var(--t-card-border)',
                                  background: canal === c ? '#2E6EAB' : 'var(--t-card-bg)',
                                  color: canal === c ? '#fff' : 'var(--t-text-muted)' }}>
                                {c === 'whatsapp' ? 'WA' : c === 'email' ? 'Email' : 'Tel'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ padding: '10px 14px' }}>
                          <pre style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                            {(t.canais as any)[canal]}
                          </pre>
                          <div className="flex justify-end mt-2">
                            <button onClick={() => suporteCopiar(`${t.id}-${canal}`, (t.canais as any)[canal])}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                                border: 'none', background: copiado ? '#dcfce7' : '#2E6EAB', color: copiado ? '#15803d' : '#fff' }}>
                              {copiado ? <><Check size={11} />Copiado!</> : <><Copy size={11} />Copiar</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DRAWER: FICHA DO TICKET ── */}
        {ticketDetalhe && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setTicketDetalhe(null)}>
            <div style={{ background: 'var(--t-card-bg)', width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              {/* Drawer header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', position: 'sticky', top: 0, background: 'var(--t-card-bg)', zIndex: 1 }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)', wordBreak: 'break-word' }}>{ticketDetalhe.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 3 }}>
                      {ticketDetalhe.cliente.nome}{ticketDetalhe.cliente.empresa ? ` · ${ticketDetalhe.cliente.empresa}` : ''}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span style={{ ...TICKET_PRIO_COLOR[ticketDetalhe.prioridade], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{ticketDetalhe.prioridade}</span>
                      <span style={{ ...TICKET_STATUS_COLOR[ticketDetalhe.status], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{ticketDetalhe.status.replace(/_/g, ' ')}</span>
                      {ticketDetalhe.licenca?.plano && <span style={{ fontSize: 11, color: 'var(--t-text-muted)', border: '1px solid var(--t-card-border)', padding: '2px 7px', borderRadius: 9999 }}>{ticketDetalhe.licenca.plano.nome}</span>}
                    </div>
                  </div>
                  <button onClick={() => setTicketDetalhe(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={18} style={{ color: 'var(--t-text-muted)' }} />
                  </button>
                </div>
              </div>

              {/* Drawer body */}
              <div style={{ flex: 1, padding: 20, overflowY: 'auto' }} className="space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 4 }}>ABERTO EM</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{new Date(ticketDetalhe.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 4 }}>TEMPO ABERTO</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{tempoAberto(ticketDetalhe.created_at)}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 4 }}>CATEGORIA</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>
                      <CategoriaIcon categoria={ticketDetalhe.categoria} size={13} />{ticketDetalhe.categoria}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 4 }}>SLA</div>
                    {(() => { const s = slaStatus(ticketDetalhe); return s
                      ? <div><span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 7px', borderRadius: 6 }}>{s.label}</span>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--t-card-border)', marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(s.pct, 100)}%`, height: '100%', background: s.color }} />
                          </div></div>
                      : <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Sem SLA</span>;
                    })()}
                  </div>
                </div>

                {/* Responsável */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>RESPONSÁVEL</div>
                  <select value={ticketDetalhe.responsavel_id || ''} onChange={e => updateTicketResponsavel(ticketDetalhe.id, e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, cursor: 'pointer' }}>
                    <option value="">Não designado</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.cargo})</option>)}
                  </select>
                </div>

                {/* Mudar status */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>STATUS</div>
                  <div className="flex gap-2 flex-wrap">
                    {['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'].map(s => (
                      <button key={s} onClick={() => updateTicketStatus(ticketDetalhe.id, s)}
                        style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          border: 'none', ...(ticketDetalhe.status === s ? TICKET_STATUS_COLOR[s] : { background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }) }}>
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descrição */}
                {ticketDetalhe.descricao && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 8 }}>DESCRIÇÃO</div>
                    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', fontSize: 13, color: 'var(--t-text-primary)', lineHeight: 1.6 }}>
                      {ticketDetalhe.descricao}
                    </div>
                  </div>
                )}

                {/* Resolução */}
                {ticketDetalhe.resolucao_at && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 3 }}>RESOLVIDO EM</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{new Date(ticketDetalhe.resolucao_at).toLocaleString('pt-BR')}</div>
                  </div>
                )}

                {/* Comentários */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', marginBottom: 10 }}>HISTÓRICO DE COMENTÁRIOS</div>
                  {ticketComentarios.length === 0
                    ? <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum comentário ainda.</p>
                    : <div className="space-y-2">
                        {ticketComentarios.map((c, i) => (
                          <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
                            <div style={{ fontSize: 12, color: 'var(--t-text-primary)', lineHeight: 1.5 }}>{c.texto}</div>
                            <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>{c.autor} · {new Date(c.data).toLocaleString('pt-BR')}</div>
                          </div>
                        ))}
                      </div>
                  }
                  <div className="flex gap-2 mt-3">
                    <input value={ticketComentario} onChange={e => setTicketComentario(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && adicionarComentario()}
                      placeholder="Adicionar comentário…"
                      style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--t-card-border)', borderRadius: 8, fontSize: 13, background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', outline: 'none' }} />
                    <button onClick={adicionarComentario} disabled={!ticketComentario.trim()}
                      style={{ padding: '7px 14px', borderRadius: 8, background: '#2E6EAB', color: '#fff', border: 'none', cursor: ticketComentario.trim() ? 'pointer' : 'not-allowed', opacity: ticketComentario.trim() ? 1 : 0.5 }}>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>{/* fim: div content */}
      </div>{/* fim: div body (sidebar + content) */}

      {/* Modal — Abrir Ticket */}
      {showTicketModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 448, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--t-text-primary)', margin: 0 }}>Abrir Ticket</h2>
              <button onClick={() => setShowTicketModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} style={{ color: 'var(--t-text-muted)' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Cliente *</label>
                <select value={ticketForm.cliente_id} onChange={e => setTicketForm((p: any) => ({ ...p, cliente_id: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Título *</label>
                <input value={ticketForm.titulo} onChange={e => setTicketForm((p: any) => ({ ...p, titulo: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} placeholder="Descreva o problema brevemente" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  <select value={ticketForm.categoria} onChange={e => setTicketForm((p: any) => ({ ...p, categoria: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }}>
                    {['TECNICO', 'FISCAL', 'COMERCIAL', 'FINANCEIRO', 'TREINAMENTO'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade</label>
                  <select value={ticketForm.prioridade} onChange={e => setTicketForm((p: any) => ({ ...p, prioridade: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }}>
                    {['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea value={ticketForm.descricao} onChange={e => setTicketForm((p: any) => ({ ...p, descricao: e.target.value }))} rows={3} style={{ ...inputStyle, marginTop: 4, resize: 'none' }} placeholder="Detalhes do problema..." />
              </div>
              <div>
                <label style={labelStyle}>SLA (horas)</label>
                <input type="number" value={ticketForm.sla_horas} onChange={e => setTicketForm((p: any) => ({ ...p, sla_horas: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} placeholder="Ex: 8, 24, 48" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowTicketModal(false)}
                style={{ flex: 1, padding: '9px 16px', border: '1px solid var(--t-card-border)', borderRadius: 8, fontSize: 14, color: 'var(--t-text-secondary)', background: 'var(--t-card-bg)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={saveTicket} disabled={!ticketForm.cliente_id || !ticketForm.titulo || ticketSaving}
                style={{ flex: 1, padding: '9px 16px', background: 'var(--t-primary)', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500, border: 'none',
                  cursor: ticketSaving || !ticketForm.cliente_id || !ticketForm.titulo ? 'not-allowed' : 'pointer',
                  opacity: ticketSaving || !ticketForm.cliente_id || !ticketForm.titulo ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {ticketSaving ? <><Loader2 size={14} className="animate-spin" /> Abrindo...</> : 'Abrir Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
