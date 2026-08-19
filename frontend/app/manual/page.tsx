'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import {
  BookOpen, ChevronRight, Search, Star, Lightbulb,
  Users, GitMerge, CalendarDays, FileText, Trophy, DollarSign,
  BarChart2, Settings, Bell, Shield, MessageCircle, Phone, Mail,
  CheckCircle2, AlertCircle, ArrowRight, Play, Sparkles,
  Target, TrendingUp, Headphones, Activity, Flame, Megaphone,
  LayoutDashboard, Trophy as Medal, ClipboardList, FileCheck2, Rocket,
  KeyRound, RefreshCw, Building2, Send, PercentCircle
} from 'lucide-react';

// ───────── Tipos ─────────────────────────────────────────────
type Cargo = 'CEO' | 'ADMIN' | 'DIRETOR' | 'SUPERVISAO_COMERCIAL' | 'SUPERVISAO_TECNICA' | 'TECNICO_SUPORTE' | 'VENDEDOR' | 'SDR';

type Secao = {
  id: string;
  titulo: string;
  icone: any;
  cor: string;
  resumo: string;
  blocos: Array<{
    titulo: string;
    conteudo: string;
    dica?: string;
    passos?: string[];
  }>;
};

// ───────── Conteúdo do Manual ──────────────────────────────────

const COMUM_TODOS: Secao[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos no CRM',
    icone: Sparkles,
    cor: '#4B8EC8',
    resumo: 'O que é e como navegar pelo sistema',
    blocos: [
      {
        titulo: 'O que é o CRM ProSystem',
        conteudo: 'É a plataforma centralizada da ProSystem para gerenciar todo o ciclo do cliente — desde a captação do lead até a assinatura do contrato, passando por reuniões, propostas e suporte pós-venda. Cada perfil vê apenas os módulos relacionados à sua função.',
      },
      {
        titulo: 'Como navegar',
        conteudo: 'O menu lateral à esquerda agrupa os módulos por área. Clique em um item para entrar. O cabeçalho superior mostra o seu nome, cargo, alerta de compromissos e botão de logout.',
        dica: 'Em qualquer página, use Ctrl+Shift+R para recarregar e limpar cache se algo parecer desatualizado.',
      },
      {
        titulo: 'Senha e segurança',
        conteudo: 'Na primeira vez que receber acesso, troque sua senha clicando em "Senha" no canto superior direito. Use uma senha forte com mais de 8 caracteres. Nunca compartilhe.',
      },
    ],
  },
  {
    id: 'agenda',
    titulo: 'Agenda e Atividades',
    icone: CalendarDays,
    cor: '#4B8EC8',
    resumo: 'Organize reuniões, ligações, visitas e tarefas',
    blocos: [
      {
        titulo: 'Criando uma atividade',
        conteudo: 'Clique em "Nova Atividade" no topo da Agenda. Escolha o tipo (Reunião, Ligação, Visita, Tarefa, WhatsApp...), informe título, data/hora e selecione o lead. Se for reunião, pode gerar link Meet automaticamente.',
        passos: [
          'Abra Agenda no menu lateral',
          'Clique em "+ Nova Atividade"',
          'Escolha o tipo e preencha título + data',
          'Selecione o Lead (ou cadastre na hora)',
          'Para reuniões: clique "Gerar Link Meet"',
          'Clique "+ Criar"',
        ],
      },
      {
        titulo: 'Convidar colegas de equipe',
        conteudo: 'Ao criar uma atividade, na seção azul "Convidados" você pode marcar outros colaboradores da empresa para participarem. Eles verão o compromisso na agenda deles e receberão o mesmo alarme.',
      },
      {
        titulo: 'Alarme sonoro discreto',
        conteudo: 'O CRM toca um alarme curto (apenas 2 toques) quando se aproxima a hora do seu compromisso — sem ficar repetindo sem parar. Se você não tomar nenhuma ação, ele volta a avisar (2 toques) a cada 10 minutos. Ao dispensar, adiar ou entrar no Meet, ele para. Funciona em qualquer aba aberta do CRM.',
        dica: 'O alarme só toca para quem é responsável, criador ou convidado da atividade. Se não estiver envolvido, você só vê no painel. "Dispensar" silencia por 10 min; se já passou da hora, dispensa de vez.',
      },
      {
        titulo: 'Histórico vs ativos',
        conteudo: 'Atividades com status Cancelada, Não Compareceu, Reagendada ou Concluída saem da agenda principal e vão para a seção "Histórico" abaixo, para não confundir com compromissos vivos. Canceladas e Não Compareceu ganham botão "Reagendar" de 1 clique.',
      },
    ],
  },
];

const VENDEDOR_SECOES: Secao[] = [
  {
    id: 'pipeline',
    titulo: 'Central de Leads — seu funil de vendas',
    icone: GitMerge,
    cor: '#16a34a',
    resumo: 'Como movimentar leads do primeiro contato ao fechamento',
    blocos: [
      {
        titulo: 'Visão geral do pipeline',
        conteudo: 'Cada lead caminha pelas etapas: Novo → Sem Contato → Contato Tentado → Em Conversa → Qualificado → Proposta → Em Negociação → Aceito (ou Perdido). Você arrasta o card do lead entre colunas conforme a evolução.',
      },
      {
        titulo: 'Cadastrar um lead novo',
        conteudo: 'Na Central de Leads, clique no botão "+ Novo Lead" e preencha os dados em 3 etapas: dados da empresa, responsável e oportunidade. Quanto mais completo, melhor para a proposta.',
        passos: [
          'Central de Leads → "+ Novo Lead"',
          'Razão social, CNPJ, segmento, cidade',
          'Nome do responsável, telefone, email',
          'Origem (Indicação, Instagram, Site...) e temperatura',
          'Salvar — lead aparece em "Novo"',
        ],
      },
      {
        titulo: 'Temperatura do lead',
        conteudo: 'Use a temperatura para sinalizar urgência: 🔵 Frio (sem interesse claro), 🟡 Morno (demonstrou interesse), 🟠 Quente (avaliando ativamente), 🔴 Muito Quente (decisão próxima).',
        dica: 'Mantenha a temperatura atualizada — é o que orienta seus próximos passos.',
      },
      {
        titulo: 'Mover para Aceito (fechar a venda)',
        conteudo: 'Quando o cliente aceitar, arraste o card para a coluna ACEITO. Vai abrir um modal verde para você informar: plano contratado, valor instalação, MRR mensal, valor da entrada e forma de pagamento. Esses dados alimentam suas comissões e o dashboard.',
      },
      {
        titulo: 'Mover para Perdido',
        conteudo: 'Se não fechar, arraste para PERDIDO. O sistema pedirá o motivo (Preço, Sem orçamento, Fechou com concorrente, etc) — isso ajuda a melhorar estratégias futuras.',
      },
    ],
  },
  {
    id: 'propostas',
    titulo: 'Propostas Comerciais',
    icone: FileText,
    cor: '#7c3aed',
    resumo: 'Gerar e enviar propostas profissionais ao cliente',
    blocos: [
      {
        titulo: 'Gerar uma proposta',
        conteudo: 'Dentro do lead, clique em "Gerar Proposta". O CRM monta uma proposta web personalizada com os dados do cliente, plano sugerido e valores. Você recebe um link único.',
      },
      {
        titulo: 'Enviar para o cliente',
        conteudo: 'No topo da proposta há 4 botões: Baixar HTML (arquivo offline), Baixar XML, Copiar resumo WhatsApp e Ver proposta. Use "Copiar resumo WhatsApp" para mandar pelo Zap com um resumo formatado.',
        dica: 'O cliente abre o link e pode clicar em "Aceitar Proposta" — você é notificado e o lead avança automaticamente.',
      },
    ],
  },
  {
    id: 'meet-whatsapp',
    titulo: 'Reuniões e WhatsApp',
    icone: MessageCircle,
    cor: '#16a34a',
    resumo: 'Ferramentas integradas para falar com o cliente',
    blocos: [
      {
        titulo: 'Gerar link Google Meet',
        conteudo: 'Ao criar uma reunião, clique em "Gerar Link Meet" — o CRM cria automaticamente uma sala Google Meet e salva no compromisso. Cliente recebe link junto com a confirmação.',
      },
      {
        titulo: 'Templates de WhatsApp',
        conteudo: 'Em cada atividade do tipo Reunião, há um painel verde "Mensagens WhatsApp" com 3 templates prontos (confirmação, lembrete, follow-up). Copie e cole no WhatsApp do cliente.',
      },
      {
        titulo: 'Transcrição da reunião',
        conteudo: 'Ao concluir uma reunião, no modal há um campo para transcrição. Pode usar 2 formas: clicar "Iniciar transcrição" (grava sua voz em PT-BR no Chrome) ou colar as legendas do Google Meet manualmente. Fica salvo na ficha do lead.',
      },
    ],
  },
  {
    id: 'percepcao',
    titulo: 'Percepção pós-reunião',
    icone: Star,
    cor: '#f59e0b',
    resumo: 'Avalie cada reunião para gerar insights',
    blocos: [
      {
        titulo: 'Por que avaliar',
        conteudo: 'Ao concluir uma reunião, marque uma ou mais percepções (Produtiva, Com objeções, Cliente não animado, etc) e dê uma nota de 1-5 estrelas. Esses dados vão para o dashboard da supervisão e geram aprendizado.',
      },
      {
        titulo: 'Como funciona',
        conteudo: 'Modal "Concluir Atividade" → escolha as tags coloridas (até 8 disponíveis) → clique nas estrelas para nota geral → escreva observações livres (objeções específicas, pontos de atenção). Tudo opcional, mas a equipe agradece.',
      },
    ],
  },
  {
    id: 'comissoes',
    titulo: 'Suas Comissões e Indicações',
    icone: DollarSign,
    cor: '#f59e0b',
    resumo: 'Acompanhe seus ganhos e indicações',
    blocos: [
      {
        titulo: 'Comissões',
        conteudo: 'Em "Comissões" você vê todos os contratos fechados por você, valor de comissão calculado, status (pendente, pago, contestado) e histórico mensal.',
      },
      {
        titulo: 'Indicações',
        conteudo: 'Em "Indicações" você registra leads de origem "indicação" (cliente atual recomendando outro). Toda venda fechada por indicação gera bônus extra. Acompanhe quais indicações ainda estão em aberto.',
      },
    ],
  },
  {
    id: 'metas-ranking',
    titulo: 'Metas e Ranking',
    icone: Trophy,
    cor: '#7c3aed',
    resumo: 'Acompanhe seu desempenho mensal',
    blocos: [
      {
        titulo: 'Suas metas',
        conteudo: 'Em "Metas Comerciais" você vê a meta mensal de fechamentos e MRR, quanto já bateu (%) e quanto falta. A barra colorida muda de vermelho → amarelo → verde conforme você se aproxima.',
      },
      {
        titulo: 'Ranking da equipe',
        conteudo: 'Em "Ranking" você vê a classificação semanal e mensal dos vendedores por MRR fechado. 🥇🥈🥉 destacam o top 3. Saudável competir e celebrar resultados.',
      },
    ],
  },
  {
    id: 'plano-comercial',
    titulo: 'Plano Comercial Prosystem 2026',
    icone: Target,
    cor: '#2E6EAB',
    resumo: 'Papéis, processo, regras, comissionamento e objetivos da equipe',
    blocos: [
      {
        titulo: 'Papéis da equipe',
        conteudo: 'Jessica Cardoso (Supervisora/Diretora Comercial): gestão da operação, planejamento estratégico, acompanhamento de metas e indicadores, desenvolvimento da equipe, distribuição dos leads qualificados pelos SDRs para os vendedores, negociações estratégicas, aprovação de condições especiais, fechamento de contratos estratégicos, expansão da carteira e treinamento. Meta: garantir o atingimento das metas gerais da equipe. SDR (pré-vendas): prospecção ativa, captação, ligações, WhatsApp, qualificação do lead (dor, decisor, urgência, sistema atual) e atualização diária do CRM. Não gera proposta nem fecha venda — entrega o lead qualificado para a supervisão distribuir a um vendedor/Closer. Vendedor (Closer): recebe o lead já qualificado, conduz demonstração, negociação, tratamento de objeções e fechamento. Vende upgrades, Comunicação entre Lojas, PAC, TEF e Auditoria Tributária.',
      },
      {
        titulo: 'Processo comercial (5 etapas)',
        conteudo: '1) Prospecção (SDR): pesquisa de mercado, captação de leads, 1º contato, qualificação até a etapa "Qualificado". 2) Distribuição (Supervisão): revisa o lead qualificado em "Leads para Distribuir" e encaminha para um vendedor. 3) Apresentação e Negociação (Vendedor/Closer): demonstração, levantamento de necessidades, proposta, tratamento de objeções. 4) Fechamento (Vendedor/Closer): assinatura, confirmação da venda, encaminhar para implantação. 5) Gestão (Jessica): indicadores, oportunidades, revisão de metas, estratégia.',
      },
      {
        titulo: 'Regras operacionais',
        conteudo: 'Atualização diária obrigatória do CRM. Toda negociação deve ter registro. Todo lead deve ter status atualizado. Todo contrato fechado deve ser registrado. Toda oportunidade perdida deve ter motivo registrado. O que não está registrado no CRM não existe.',
      },
      {
        titulo: 'Reunião comercial semanal',
        conteudo: '30 minutos, com Jessica, SDRs e vendedores. Pauta: leads em prospecção, leads qualificados para distribuir, apresentações, propostas, contratos, negociações em andamento, upgrades, Comunicação, PAC, TEF, Auditoria e indicadores.',
      },
      {
        titulo: 'Comissionamento',
        conteudo: 'A comissão de fechamento é sempre do vendedor/Closer que assina o contrato — o SDR não recebe comissão por qualificar/distribuir o lead. Novos contratos (setup): 15% para o vendedor, 5% para Jessica (override de todos os setups da equipe). Upgrade de plano (setup): 15% / 5%. Comunicação entre Lojas (setup): 15% / 5%. PAC: R$ 50,00 por venda (só vendedor). TEF: R$ 50,00 por ativação (só vendedor). Auditoria Tributária (Avant/Imendes): R$ 50,00 por ativação (só vendedor). Quando a Jessica atua direto na venda, recebe 15% como vendedora em vez do override de 5%.',
      },
      {
        titulo: 'Bônus trimestral — Programa Acelerador',
        conteudo: 'Válido a partir dos trimestres de maio: 100% da meta (15 contratos) → R$ 400,00. 150% da meta (22 contratos) → R$ 600,00. 200% da meta (30 contratos) → R$ 1.000,00.',
        dica: 'O acompanhamento ao vivo do bônus fica na aba Comissões, no card "Bônus Trimestral — Acelerador".',
      },
      {
        titulo: 'Indicadores de desempenho acompanhados mensalmente',
        conteudo: 'Leads gerados, apresentações, taxa de conversão, contratos fechados, receita de setup, MRR, upgrades, Comunicação entre Lojas, PAC, TEF, auditorias tributárias.',
      },
      {
        titulo: 'Objetivos 2026',
        conteudo: 'Aumentar a base de clientes ativos e o ticket médio. Melhorar a taxa de conversão e a previsibilidade. Expandir serviços complementares e reduzir dependência de indicações. Criar uma máquina comercial escalável. Tornar a Prosystem referência em gestão para farmácias, manipulação, padarias e varejo.',
      },
    ],
  },
];

const SDR_SECOES: Secao[] = [
  {
    id: 'sdr-papel',
    titulo: 'Seu papel como SDR',
    icone: Target,
    cor: '#ea580c',
    resumo: 'Prospectar e qualificar — não fechar',
    blocos: [
      {
        titulo: 'O que você faz',
        conteudo: 'Você prospecta ativamente (WhatsApp, ligação, redes) e atende leads que chegam pelo site/anúncio. Seu trabalho é qualificar: entender a dor do cliente, quem decide a compra, se há urgência e orçamento, qual sistema ele usa hoje. Quanto mais completo o cadastro, mais fácil é para o vendedor fechar depois.',
      },
      {
        titulo: 'O que você NÃO faz',
        conteudo: 'Você não gera proposta, não negocia valores, não fecha contrato e não recebe comissão de venda. O sistema bloqueia isso de propósito — se você tentar mover um lead para "Aceito" ou "Fechado", vai dar erro. Isso é intencional: fechamento é sempre do vendedor/Closer.',
      },
      {
        titulo: 'Para onde vai o lead depois',
        conteudo: 'Quando terminar de qualificar, mova o card para a coluna "Qualificado" no Pipeline. A partir daí, a supervisão revisa e distribui o lead para um vendedor — você não escolhe o vendedor nem faz esse encaminhamento diretamente.',
      },
    ],
  },
  {
    id: 'sdr-completude',
    titulo: 'Completude do cadastro',
    icone: PercentCircle,
    cor: '#16a34a',
    resumo: 'Quanto mais completo, mais fácil pro vendedor fechar',
    blocos: [
      {
        titulo: 'O badge de %',
        conteudo: 'Cada lead mostra um selo colorido com a % de completude, calculado automaticamente a partir de campos como telefone, email, segmento, cidade, número de lojas, sistema atual, nome do decisor e observações. Verde (80%+) está pronto para distribuir. Amarelo (50-79%) está ok, mas pode melhorar. Vermelho (abaixo de 50%) precisa de mais informação antes de qualificar.',
        dica: 'A supervisão pode devolver um lead pedindo mais dados se a completude estiver baixa — capriche no cadastro para não ir e voltar.',
      },
      {
        titulo: 'Taxonomia de motivo de perda',
        conteudo: 'Se um lead não vingar, ao mover para "Perdido" escolha o motivo numa lista fixa (Preço, Já tem fornecedor, Sem orçamento, Timing, Sem interesse, Funcionalidade ausente, Outro). Isso alimenta o relatório de inteligência de mercado da supervisão — não é burocracia, é dado real sobre o que o mercado está dizendo.',
      },
    ],
  },
  {
    id: 'sdr-desempenho',
    titulo: 'Meu Desempenho',
    icone: TrendingUp,
    cor: '#4B8EC8',
    resumo: 'Acompanhe seu próprio funil de prospecção',
    blocos: [
      {
        titulo: 'O funil completo',
        conteudo: 'Em "Meu Desempenho" você vê seu funil: tentativas de contato → contatos efetivos → leads qualificados → reuniões agendadas → reuniões realizadas → leads distribuídos → vendas originadas por você. Também vê as taxas de conversão entre cada etapa.',
        dica: 'Leads "distribuídos" e "vendas originadas" contam mesmo depois que o vendedor assume o lead — o crédito da prospecção continua sendo seu.',
      },
    ],
  },
];

const SUP_COMERCIAL_SECOES: Secao[] = [
  {
    id: 'gestao-equipe',
    titulo: 'Gestão da equipe comercial',
    icone: Users,
    cor: '#4B8EC8',
    resumo: 'Acompanhe e oriente vendedores e SDRs',
    blocos: [
      {
        titulo: 'Filtro por colaborador na Agenda',
        conteudo: 'Na Agenda você verá chips coloridos no topo com o nome de cada vendedor. Clique em um para filtrar a agenda dele inteira (mês/semana/lista). Útil para acompanhar o ritmo de cada um.',
      },
      {
        titulo: 'Dashboard de Produtividade',
        conteudo: 'Em Agenda → aba Relatório → botão roxo "Dashboard Produtividade", você vê ranking dos vendedores por: atividades realizadas, taxa de sucesso, taxa de no-show, nota média de reuniões. Top 3 ganha 🥇🥈🥉.',
        dica: 'Filtre por colaborador específico antes de clicar para ver dados só dele.',
      },
      {
        titulo: 'Etiquetas de responsável',
        conteudo: 'Em cada atividade aparece a etiqueta colorida do responsável (Primeiro nome · Cargo). Cada vendedor tem cor própria. Identifica rapidamente quem cuida do quê.',
      },
    ],
  },
  {
    id: 'distribuir-leads-sdr',
    titulo: 'Distribuir leads qualificados pelos SDRs',
    icone: Send,
    cor: '#ea580c',
    resumo: 'Encaminhe leads prontos para um vendedor, ou devolva pedindo mais dados',
    blocos: [
      {
        titulo: 'Onde ficam os leads prontos',
        conteudo: 'Em "Leads para Distribuir" você vê todos os leads que o SDR moveu para a coluna "Qualificado" no Pipeline. Cada card mostra o nome da empresa, qual SDR cadastrou, o % de completude do cadastro e a temperatura do lead.',
      },
      {
        titulo: 'Distribuir para um vendedor',
        conteudo: 'Clique em "Distribuir" no card do lead, escolha o vendedor responsável. O lead passa a ser dele (aparece no sininho de atribuição) e o vendedor conduz demonstração, proposta e fechamento a partir daí.',
      },
      {
        titulo: 'Devolver para o SDR',
        conteudo: 'Se o cadastro estiver incompleto (poucas informações, decisor não identificado, etc), clique em "Devolver" e escreva o motivo — é obrigatório. O lead volta para o SDR original com uma observação explicando o que falta, e o SDR é notificado.',
        dica: 'Use o % de completude como guia rápido: abaixo de 50% normalmente vale a pena devolver pedindo mais informação antes de passar ao vendedor.',
      },
    ],
  },
  {
    id: 'campanhas',
    titulo: 'Campanhas de marketing',
    icone: Megaphone,
    cor: '#ea580c',
    resumo: 'Crie e gerencie campanhas de engajamento',
    blocos: [
      {
        titulo: 'Criar campanha',
        conteudo: 'Em Campanhas → "Nova Campanha". Defina nome, descrição, data início, data fim. A campanha pode ser ATIVA, PAUSADA, FINALIZADA ou ARQUIVADA. Vendedores veem em read-only para entender o contexto.',
      },
      {
        titulo: 'Disparos e ações',
        conteudo: 'Cada campanha contabiliza disparos (mensagens enviadas) e ações (leads engajados). Use para medir ROI da campanha.',
      },
    ],
  },
  {
    id: 'metas-equipe',
    titulo: 'Metas da equipe',
    icone: Target,
    cor: '#16a34a',
    resumo: 'Defina e acompanhe metas comerciais',
    blocos: [
      {
        titulo: 'Metas comerciais',
        conteudo: 'Em "Metas Comerciais" você define metas individuais (por vendedor) e da equipe inteira: número de fechamentos, MRR alvo, ticket médio. O sistema mostra evolução mensal e quem está acima/abaixo.',
      },
    ],
  },
  {
    id: 'dashboards',
    titulo: 'Dashboards e Relatórios',
    icone: BarChart2,
    cor: '#7c3aed',
    resumo: 'Visão consolidada do desempenho comercial',
    blocos: [
      {
        titulo: 'Radar Comercial',
        conteudo: 'Em "Radar Comercial" você vê o panorama geral: leads por etapa, conversões por origem, tempo médio em cada etapa, alertas de leads parados.',
      },
      {
        titulo: 'Relatórios Comerciais',
        conteudo: 'Em "Relatórios Comerciais" você gera relatórios detalhados com filtros por período, vendedor, plano, status. Exporte para análises externas se precisar.',
      },
    ],
  },
];

const SUP_TECNICA_SECOES: Secao[] = [
  {
    id: 'onboarding',
    titulo: 'Onboarding de novos clientes',
    icone: Rocket,
    cor: '#16a34a',
    resumo: 'Acompanhe a implantação dos clientes recém-fechados',
    blocos: [
      {
        titulo: 'Pipeline de implantação',
        conteudo: 'Em "Onboarding" você vê os clientes que assinaram contrato e estão sendo implantados. Etapas: Aguardando dados → Treinamento → Migração → Go-live → Pós-go-live.',
      },
      {
        titulo: 'Reuniões de treinamento',
        conteudo: 'Crie atividades do tipo "Reunião" vinculadas ao cliente para agendar treinamentos. O CRM gera Meet automaticamente.',
      },
    ],
  },
  {
    id: 'churn-retencao',
    titulo: 'Churn e Retenção',
    icone: Flame,
    cor: '#dc2626',
    resumo: 'Identifique e recupere clientes em risco',
    blocos: [
      {
        titulo: 'Casos de churn',
        conteudo: 'Em "Churn & Retenção" você vê clientes em risco classificados por score (Baixo, Médio, Alto, Crítico). Cada caso tem diagnóstico, plano de retenção e ações.',
      },
      {
        titulo: 'Health Score',
        conteudo: 'Em "Health Score" o CRM calcula automaticamente a saúde de cada cliente baseado em uso, suporte, pagamentos e engajamento. Vermelho = atenção urgente.',
      },
      {
        titulo: 'NPS',
        conteudo: 'Em "NPS" você dispara pesquisas de satisfação. Detratores (0-6) viram casos de churn automaticamente.',
      },
    ],
  },
  {
    id: 'suporte',
    titulo: 'Suporte ao cliente',
    icone: Headphones,
    cor: '#0891b2',
    resumo: 'Atendimento técnico e tickets',
    blocos: [
      {
        titulo: 'Tickets de suporte',
        conteudo: 'Em "Suporte" você acompanha tickets abertos, priorizados por urgência. SLA é monitorado automaticamente.',
      },
    ],
  },
];

const TECNICO_SECOES: Secao[] = [
  {
    id: 'atendimento',
    titulo: 'Atendimento de suporte',
    icone: Headphones,
    cor: '#0891b2',
    resumo: 'Tickets, prioridades e SLA',
    blocos: [
      {
        titulo: 'Fluxo de atendimento',
        conteudo: 'Cada ticket entra em "Aberto". Você assume → "Em atendimento" → resolve → "Aguardando cliente" ou "Resolvido". SLA do plano (Basic/Pro/Plus) muda o prazo.',
      },
    ],
  },
  {
    id: 'onboarding-tec',
    titulo: 'Onboarding técnico',
    icone: Rocket,
    cor: '#16a34a',
    resumo: 'Conduza a implantação',
    blocos: [
      {
        titulo: 'Etapas',
        conteudo: 'Treinamento básico → migração de dados → configurações fiscais → testes → go-live → 30 dias de acompanhamento.',
      },
    ],
  },
  {
    id: 'health-score-tec',
    titulo: 'Monitoramento de clientes',
    icone: Activity,
    cor: '#16a34a',
    resumo: 'Health Score e sinais de alerta',
    blocos: [
      {
        titulo: 'O que monitorar',
        conteudo: 'Clientes sem uso há 7+ dias, com tickets críticos abertos, ou que abriram NPS detrator. Sinalize Sup. Técnica para abrir caso de retenção.',
      },
    ],
  },
];

const CEO_SECOES: Secao[] = [
  {
    id: 'visao-executiva',
    titulo: 'Visão executiva',
    icone: LayoutDashboard,
    cor: '#4B8EC8',
    resumo: 'KPIs estratégicos da operação',
    blocos: [
      {
        titulo: 'Dashboard principal',
        conteudo: 'Em "Dashboard" você vê os KPIs do mês: MRR total, novos contratos, churn, ticket médio, ranking de vendedores, evolução do funil. Atualizado em tempo real.',
      },
      {
        titulo: 'Dashboard de Produtividade',
        conteudo: 'Em Agenda → Relatório → "Dashboard Produtividade" você vê o ranking de todos os colaboradores (vendedores e técnicos) por número de atividades realizadas, taxa de sucesso, nota média.',
        dica: 'Filtre por colaborador antes de gerar para análise individual aprofundada.',
      },
    ],
  },
  {
    id: 'usuarios-permissoes',
    titulo: 'Usuários e permissões',
    icone: Shield,
    cor: '#dc2626',
    resumo: 'Cadastre e gerencie acessos da equipe',
    blocos: [
      {
        titulo: 'Cadastrar usuário',
        conteudo: 'Em "Usuários" → "Novo Usuário". Informe nome, email, telefone, cargo (CEO, Sup. Comercial, Sup. Técnica, Técnico Suporte, Vendedor ou SDR) e classificação (N1/N2/N3 para técnicos). Sistema gera senha aleatória e envia por email.',
        passos: [
          'Usuários → "+ Novo Usuário"',
          'Preencher nome, email, telefone',
          'Escolher cargo → presets de permissão aparecem',
          'Ajustar módulos liberados (se necessário)',
          'Salvar — senha vai para o email automaticamente',
        ],
        dica: 'Supervisão Comercial tem a mesma permissão do CEO neste módulo — pode criar, editar, redefinir senha e excluir usuários, não só o CEO.',
      },
      {
        titulo: 'Inativar / Reativar',
        conteudo: 'No card do usuário, botões "Inativar" (mantém histórico, bloqueia login) e "Redefinir senha" (gera nova senha e manda por email). Usuários inativos não somem — ficam visíveis em cinza.',
        dica: 'Nunca remova usuário do banco — só inative. Mantém auditoria das atividades.',
      },
      {
        titulo: 'Permissões por módulo',
        conteudo: 'Cada cargo já tem preset de permissões (vendedor vê comercial; técnico vê retenção; supervisor vê tudo da área). Você pode ajustar manualmente módulos críticos: Financeiro, Configurações, Usuários.',
      },
    ],
  },
  {
    id: 'mrr-financeiro',
    titulo: 'MRR e Financeiro',
    icone: DollarSign,
    cor: '#16a34a',
    resumo: 'Receita recorrente e indicadores financeiros',
    blocos: [
      {
        titulo: 'O que é MRR',
        conteudo: 'MRR (Monthly Recurring Revenue) é a receita recorrente mensal — soma das mensalidades de todos os contratos ativos. É o KPI mais importante de SaaS.',
      },
      {
        titulo: 'Onde acompanhar',
        conteudo: 'Em "Dashboard" você vê MRR total e novo MRR do mês. Em "Relatórios Comerciais" há detalhamento por plano, ticket médio, churn de MRR.',
      },
    ],
  },
  {
    id: 'campanhas-ceo',
    titulo: 'Campanhas',
    icone: Megaphone,
    cor: '#ea580c',
    resumo: 'Lance e acompanhe campanhas',
    blocos: [
      {
        titulo: 'Quem pode criar',
        conteudo: 'Apenas CEO, Diretor e Supervisores podem criar/editar/excluir campanhas. Vendedores veem em modo de consulta com aviso "Visualização da equipe comercial".',
      },
    ],
  },
  {
    id: 'configuracoes',
    titulo: 'Configurações do Sistema',
    icone: Settings,
    cor: '#64748b',
    resumo: 'Ajustes globais — exclusivo do CEO',
    blocos: [
      {
        titulo: 'Integrações',
        conteudo: 'Em "Configurações" você gerencia: Google Calendar (para gerar Meet), ZapSign (contratos), SMTP (email automático), Twilio/WhatsApp Business (notificações).',
      },
      {
        titulo: 'Auditoria',
        conteudo: 'Toda ação importante é registrada (quem criou usuário, quem mudou permissão, quem fechou venda). Trilha completa em "Configurações → Auditoria".',
      },
    ],
  },
];

const SECOES_POR_CARGO: Record<string, Secao[]> = {
  CEO:                     [...COMUM_TODOS, ...CEO_SECOES, ...SUP_COMERCIAL_SECOES, ...SUP_TECNICA_SECOES],
  ADMIN:                   [...COMUM_TODOS, ...CEO_SECOES, ...SUP_COMERCIAL_SECOES, ...SUP_TECNICA_SECOES],
  DIRETOR:                 [...COMUM_TODOS, ...CEO_SECOES, ...SUP_COMERCIAL_SECOES, ...SUP_TECNICA_SECOES],
  SUPERVISAO_COMERCIAL:    [...COMUM_TODOS, ...SUP_COMERCIAL_SECOES, ...VENDEDOR_SECOES, ...SDR_SECOES],
  SUPERVISAO_TECNICA:      [...COMUM_TODOS, ...SUP_TECNICA_SECOES, ...TECNICO_SECOES],
  TECNICO_SUPORTE:         [...COMUM_TODOS, ...TECNICO_SECOES],
  VENDEDOR:                [...COMUM_TODOS, ...VENDEDOR_SECOES],
  SDR:                     [...COMUM_TODOS, ...SDR_SECOES],
};

const CARGO_LABEL: Record<string, string> = {
  CEO: 'CEO', ADMIN: 'Administrador', DIRETOR: 'Diretor',
  SUPERVISAO_COMERCIAL: 'Supervisão Comercial',
  SUPERVISAO_TECNICA: 'Supervisão Técnica',
  TECNICO_SUPORTE: 'Técnico de Suporte', VENDEDOR: 'Vendedor',
  SDR: 'SDR (Pré-vendas)',
};

const CARGO_COR: Record<string, string> = {
  CEO: '#7c3aed', ADMIN: '#dc2626', DIRETOR: '#7c3aed',
  SUPERVISAO_COMERCIAL: '#4B8EC8', SUPERVISAO_TECNICA: '#0891b2',
  TECNICO_SUPORTE: '#0891b2', VENDEDOR: '#16a34a',
  SDR: '#ea580c',
};

// ─── Componente Principal ─────────────────────────────────────

export default function ManualPage() {
  const { user } = useAuth();
  const [secaoAberta, setSecaoAberta] = useState<string | null>('primeiros-passos');
  const [busca, setBusca] = useState('');

  const cargo = (user?.role || 'VENDEDOR').toUpperCase();
  const cargoLabel = CARGO_LABEL[cargo] || cargo;
  const cargoCor = CARGO_COR[cargo] || '#4B8EC8';

  const secoes = SECOES_POR_CARGO[cargo] || SECOES_POR_CARGO.VENDEDOR;

  // Filtro de busca
  const buscaLower = busca.toLowerCase();
  const secoesFiltradas = busca
    ? secoes.filter(s =>
        s.titulo.toLowerCase().includes(buscaLower) ||
        s.resumo.toLowerCase().includes(buscaLower) ||
        s.blocos.some(b =>
          b.titulo.toLowerCase().includes(buscaLower) ||
          b.conteudo.toLowerCase().includes(buscaLower)
        )
      )
    : secoes;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 0' }}>
        {/* Cabeçalho */}
        <div style={{
          background: `linear-gradient(135deg, ${cargoCor}, ${cargoCor}cc)`,
          borderRadius: 16, padding: '28px 30px', marginBottom: 24, color: '#fff',
          boxShadow: `0 8px 24px ${cargoCor}30`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <BookOpen size={28} />
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800 }}>Manual do CRM ProSystem</h1>
              <p style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                Visão personalizada para o perfil <strong>{cargoLabel}</strong>
              </p>
            </div>
          </div>
          <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5, marginTop: 8 }}>
            {user?.nome ? `Olá, ${user.nome.split(' ')[0]}! ` : ''}
            Este manual mostra apenas os módulos e fluxos disponíveis no seu perfil.
            Use a busca abaixo ou navegue pelas seções.
          </p>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--t-text-secondary)' }} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar no manual... (ex: 'meet', 'reagendar', 'comissão')"
            style={{
              width: '100%', padding: '12px 14px 12px 40px', fontSize: 14,
              borderRadius: 10, border: '1px solid #C3DCFC', outline: 'none',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          />
        </div>

        {/* Lista de seções como cards expansíveis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {secoesFiltradas.length === 0 && (
            <div style={{ background: '#fff', padding: 30, borderRadius: 12, textAlign: 'center', color: 'var(--t-text-secondary)' }}>
              Nenhum tópico encontrado para "{busca}".
            </div>
          )}

          {secoesFiltradas.map(secao => {
            const Icon = secao.icone;
            const aberta = secaoAberta === secao.id;
            return (
              <div key={secao.id} style={{
                background: '#fff', borderRadius: 12,
                border: `1px solid ${aberta ? secao.cor : '#e2e8f0'}`,
                boxShadow: aberta ? `0 4px 16px ${secao.cor}20` : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s', overflow: 'hidden'
              }}>
                {/* Header clicável */}
                <button
                  onClick={() => setSecaoAberta(aberta ? null : secao.id)}
                  style={{
                    width: '100%', padding: '16px 20px', display: 'flex',
                    alignItems: 'center', gap: 14, background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left'
                  }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: `${secao.cor}18`, flexShrink: 0
                  }}>
                    <Icon size={20} color={secao.cor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 2 }}>
                      {secao.titulo}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{secao.resumo}</div>
                  </div>
                  <ChevronRight size={18}
                    style={{
                      color: 'var(--t-text-secondary)', flexShrink: 0,
                      transform: aberta ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s'
                    }} />
                </button>

                {/* Conteúdo expandido */}
                {aberta && (
                  <div style={{
                    padding: '0 20px 20px 20px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', flexDirection: 'column', gap: 16
                  }}>
                    {secao.blocos.map((bloco, idx) => (
                      <div key={idx} style={{
                        background: 'var(--t-content-bg)', borderRadius: 10, padding: 14,
                        borderLeft: `3px solid ${secao.cor}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <ArrowRight size={14} color={secao.cor} />
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>
                            {bloco.titulo}
                          </h4>
                        </div>
                        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: bloco.passos || bloco.dica ? 10 : 0 }}>
                          {bloco.conteudo}
                        </p>

                        {bloco.passos && (
                          <div style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: bloco.dica ? 10 : 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: secao.cor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Play size={11} /> PASSO A PASSO
                            </div>
                            <ol style={{ paddingLeft: 20, fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                              {bloco.passos.map((p, i) => <li key={i}>{p}</li>)}
                            </ol>
                          </div>
                        )}

                        {bloco.dica && (
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            background: '#fef3c7', borderRadius: 8, padding: 10,
                            border: '1px solid #fde68a'
                          }}>
                            <Lightbulb size={14} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: 12, color: '#92400e', fontWeight: 500, lineHeight: 1.5 }}>
                              <strong>Dica: </strong>{bloco.dica}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé com suporte */}
        <div style={{
          marginTop: 30, padding: '20px 24px', background: '#fff',
          borderRadius: 12, border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
        }}>
          <AlertCircle size={20} color="#4B8EC8" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>Precisa de ajuda?</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
              Fale com seu supervisor ou abra um ticket interno se algo não funcionar como descrito.
            </div>
          </div>
          <a href="mailto:jessica@prosystemnet.com.br"
            style={{
              padding: '8px 14px', borderRadius: 8, background: '#4B8EC8',
              color: '#fff', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
            }}>
            <Mail size={12} /> Suporte
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
