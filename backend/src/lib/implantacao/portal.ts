// Portal de implantação (fase 2): quadro, prazo (SLA), serviços e ficha de coleta. Puro (sem banco).
import { janelasDaJornada, sobreposicao, diaSP, JORNADA_PADRAO, type Jornada } from './cronometro';

// Demandas anteriores ao portal (no ar em 02/10/2026): ficam no CRM, mas não geram aviso nenhum
// (nem ao cliente, nem à gestão/técnico). O quadro mostra só as dos últimos 60 dias.
export const INICIO_PORTAL = new Date('2026-10-02T14:00:00Z');
export const ehLegado = (i: { data_assinatura?: Date | null }) => !i.data_assinatura || i.data_assinatura < INICIO_PORTAL;
export const DIAS_QUADRO = 60;
// Cargos de técnico: só veem e mexem nas demandas designadas a eles (o resto é da supervisão e do admin).
export const CARGOS_TECNICO = ['TECNICO', 'TECNICO_IMPLANTACAO', 'TECNICO_SUPORTE'];
export const ehCargoTecnico = (role?: string | null) => CARGOS_TECNICO.includes((role || '').toUpperCase());
// Portal recomeçou do zero em 02/10/2026 (pedido da Jessica): o que entrou antes não aparece
// no portal nem gera aviso automático. Nada foi apagado; continua no banco e no CRM.
export const CORTE_PORTAL = new Date('2026-10-02T03:00:00.000Z'); // 02/10/2026 00:00 de Brasília
/** Início da janela do quadro: últimos 60 dias, mas nunca antes do recomeço do portal. */
export const desdeQuadro = (agora = Date.now()) => new Date(Math.max(agora - DIAS_QUADRO * 864e5, CORTE_PORTAL.getTime()));

// Colunas do quadro (as mesmas do Trello). Serviços usam o mesmo quadro, filtrado pelo módulo.
export const COLUNAS = [
  { key: 'BACKLOG', label: 'BackLog' },
  { key: 'A_FAZER', label: 'A fazer' },
  { key: 'EM_ANDAMENTO', label: 'Em andamento' },
  { key: 'ACOMPANHAMENTO', label: 'Acompanhamento e Treinamento' },
  { key: 'CONCLUIDO', label: 'Concluído' },
  { key: 'VALIDADO', label: 'Validado Supervisão' },
  { key: 'FINALIZADO', label: 'Finalizado' },
  { key: 'CANCELADOS', label: 'Cancelados' },
] as const;
export const CHAVES_COLUNA = COLUNAS.map(c => c.key) as string[];

/** Coluna da demanda: a escolhida no quadro ou, para as antigas, deduzida da etapa de execução. */
export function colunaDe(i: { coluna?: string | null; status?: string | null; etapa_execucao?: string | null }): string {
  if (i.coluna && CHAVES_COLUNA.includes(i.coluna)) return i.coluna;
  if (i.status === 'CANCELADA') return 'CANCELADOS';
  switch (i.etapa_execucao) {
    case 'FINALIZADO': return 'FINALIZADO';
    case 'EM_TREINAMENTO': return 'ACOMPANHAMENTO';
    case 'EM_ANALISE': case 'EM_CONVERSAO': case 'EM_CONFIGURACAO': return 'EM_ANDAMENTO';
    default: return 'A_FAZER';
  }
}

export const TIPOS_SERVICO: Record<string, { label: string; checklist: string[] }> = {
  TROCA_CNPJ: { label: 'Troca de CNPJ', checklist: ['Receber os dados do novo CNPJ', 'Backup do banco antes da troca', 'Alterar o cadastro da empresa e o certificado', 'Ajustar a numeração de NF-e e NFC-e', 'Emitir nota de teste', 'Validar com o cliente'] },
  COMUNICACAO: { label: 'Comunicação entre filiais', checklist: ['Instalar e configurar o Connect', 'Testar envio e recebimento entre as filiais', 'Validar estoque e preços sincronizados', 'Validar com o cliente'] },
  IMPRESSORA: { label: 'Impressora', checklist: ['Instalar o driver', 'Configurar no sistema', 'Imprimir teste', 'Validar com o cliente'] },
  BANCO_DADOS: { label: 'Banco de dados', checklist: ['Backup do banco', 'Executar o serviço no banco', 'Validar os dados', 'Validar com o cliente'] },
  OUTRO: { label: 'Outro serviço', checklist: ['Executar o serviço', 'Validar com o cliente'] },
};

// Prazos padrão (configuráveis): dias corridos até a virada/finalização; serviços em dias úteis.
export type ConfigSla = { CONVERSAO: { virada: number; final: number }; BANCO_ZERADO: { virada: number; final: number }; SERVICO_DIAS_UTEIS: number };
export const SLA_PADRAO: ConfigSla = { CONVERSAO: { virada: 15, final: 30 }, BANCO_ZERADO: { virada: 10, final: 25 }, SERVICO_DIAS_UTEIS: 3 };

/** Soma dias úteis (seg a sex) a partir de uma data. */
export function somarDiasUteis(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  let falta = n;
  while (falta > 0) {
    r.setTime(r.getTime() + 864e5);
    const sem = new Date(r.getTime() - 3 * 3600000).getUTCDay();
    if (sem !== 0 && sem !== 6) falta--;
  }
  return r;
}

export function prazosPadrao(o: { modulo: string; tipo_base?: string | null; inicio: Date; cfg?: ConfigSla }) {
  const cfg = o.cfg || SLA_PADRAO;
  if (o.modulo === 'SERVICO') return { prazo_virada: null, prazo_finalizacao: somarDiasUteis(o.inicio, cfg.SERVICO_DIAS_UTEIS) };
  const t = o.tipo_base === 'BANCO_ZERADO' ? cfg.BANCO_ZERADO : cfg.CONVERSAO;
  return { prazo_virada: new Date(o.inicio.getTime() + t.virada * 864e5), prazo_finalizacao: new Date(o.inicio.getTime() + t.final * 864e5) };
}

export type SituacaoSla = { situacao: 'NO_PRAZO' | 'EM_RISCO' | 'ESTOURADO' | 'CUMPRIDO' | 'CUMPRIDO_ATRASO'; pct: number; prazo: Date };

/** Situação do prazo: em risco a partir de 80% do tempo, estourado depois do prazo. */
export function situacaoSla(inicio: Date | null | undefined, prazo: Date | null | undefined, concluido?: Date | null, agora = new Date()): SituacaoSla | null {
  if (!inicio || !prazo) return null;
  const total = prazo.getTime() - inicio.getTime();
  if (concluido) return { situacao: concluido <= prazo ? 'CUMPRIDO' : 'CUMPRIDO_ATRASO', pct: 100, prazo };
  const pct = total > 0 ? Math.round(((agora.getTime() - inicio.getTime()) / total) * 100) : 100;
  return { situacao: agora > prazo ? 'ESTOURADO' : pct >= 80 ? 'EM_RISCO' : 'NO_PRAZO', pct: Math.max(0, pct), prazo };
}

/** Horas úteis (dentro da jornada) entre duas datas: base do lembrete da programação. */
export function horasUteisEntre(a: Date, b: Date, cfg: Jornada = JORNADA_PADRAO): number {
  if (b <= a) return 0;
  let ms = 0;
  for (let t = a.getTime() - 864e5; t <= b.getTime() + 864e5; t += 864e5) ms += sobreposicao([{ inicio: a, fim: b }], janelasDaJornada(diaSP(new Date(t)), cfg));
  return ms / 3600000;
}

// Ficha de coleta: campos que substituem a descrição em texto livre do cartão.
export const CAMPOS_COLETA: { key: string; label: string; tipo?: 'texto' | 'numero' | 'opcoes' | 'longo'; opcoes?: string[]; grupo: string }[] = [
  // Perguntas principais do primeiro contato (definidas pela Jessica em 02/10/2026)
  { key: 'faturamento', label: 'Faturamento mensal aproximado', grupo: 'Primeiro contato' },
  { key: 'etiquetas', label: 'Usa etiquetas (impressora de etiquetas)', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'colaboradores', label: 'Quantidade de colaboradores', tipo: 'numero', grupo: 'Primeiro contato' },
  { key: 'pbms', label: 'PBMs utilizadas', grupo: 'Primeiro contato' },
  { key: 'financeiro', label: 'Vai usar o financeiro', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'corretor_tributario', label: 'Corretor tributário', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'gerencial', label: 'Gerencial', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'sngpc', label: 'SNGPC (controlados)', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'banco_unico', label: 'Banco único', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'preco_unico', label: 'Preço único', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'tef', label: 'TEF (qual)', grupo: 'Primeiro contato' },
  { key: 'tipo_base', label: 'Tipo', tipo: 'opcoes', opcoes: ['Conversão de outro sistema', 'Banco zerado (do zero)'], grupo: 'Projeto' },
  { key: 'sistema_anterior', label: 'Sistema anterior', grupo: 'Projeto' },
  { key: 'volume_produtos', label: 'Volume aproximado de produtos', grupo: 'Projeto' },
  { key: 'controle_lote', label: 'Controle de lote, validade e controlados', tipo: 'opcoes', opcoes: ['Sim', 'Não', 'Parcial'], grupo: 'Projeto' },
  { key: 'maquinas', label: 'Máquinas (total)', tipo: 'numero', grupo: 'Primeiro contato' },
  { key: 'caixas', label: 'Caixas (PDV)', tipo: 'numero', grupo: 'Primeiro contato' },
  { key: 'terminais', label: 'Terminais de balcão', tipo: 'numero', grupo: 'Estrutura' },
  { key: 'usuarios', label: 'Usuários do sistema', tipo: 'numero', grupo: 'Estrutura' },
  { key: 'responsavel_sistema', label: 'Responsável pelo sistema na loja', grupo: 'Estrutura' },
  { key: 'internet', label: 'Internet (velocidade de download/upload)', grupo: 'Estrutura' },
  { key: 'filiais', label: 'Filiais', tipo: 'numero', grupo: 'Estrutura' },
  { key: 'usa_comunicacao', label: 'Comunicação entre filiais', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Primeiro contato' },
  { key: 'balanca', label: 'Balança', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Equipamentos' },
  { key: 'gaveta', label: 'Gaveta', tipo: 'opcoes', opcoes: ['Sim', 'Não'], grupo: 'Equipamentos' },
  { key: 'impressora_nfce', label: 'Impressora NFC-e (modelo)', grupo: 'Primeiro contato' },
  { key: 'outros_equipamentos', label: 'Outros equipamentos (Pin Pad, nobreak, etiquetas, coletor)', grupo: 'Equipamentos' },
  { key: 'regime_tributario', label: 'Regime tributário', tipo: 'opcoes', opcoes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'], grupo: 'Fiscal' },
  { key: 'certificado', label: 'Certificado digital (tipo e validade)', grupo: 'Fiscal' },
  { key: 'inscricao_estadual', label: 'Inscrição estadual', grupo: 'Fiscal' },
  { key: 'csc', label: 'CSC da NFC-e e ambiente (produção/homologação)', grupo: 'Fiscal' },
  { key: 'contabilidade_nome', label: 'Contabilidade', grupo: 'Fiscal' },
  { key: 'contabilidade_contato', label: 'Contato da contabilidade', grupo: 'Fiscal' },
  { key: 'contabilidade_email', label: 'E-mail da contabilidade', grupo: 'Fiscal' },
  { key: 'integracoes', label: 'Integrações (TEF, PBM, Farmácia Popular, convênios, e-commerce)', tipo: 'longo', grupo: 'Fiscal' },
  { key: 'contato_nome', label: 'Contato principal na loja', grupo: 'Contato' },
  { key: 'contato_telefone', label: 'Telefone do contato', grupo: 'Contato' },
  { key: 'horario_funcionamento', label: 'Horário de funcionamento e dias de pico', grupo: 'Contato' },
  { key: 'janela_implantacao', label: 'Melhor janela para a implantação', grupo: 'Contato' },
  { key: 'treinamento_pessoas', label: 'Quem será treinado e quantas pessoas', grupo: 'Contato' },
  { key: 'treinamento_modalidade', label: 'Modalidade do treinamento', tipo: 'opcoes', opcoes: ['Presencial', 'Remoto', 'Híbrido'], grupo: 'Contato' },
  { key: 'observacoes', label: 'Observações', tipo: 'longo', grupo: 'Contato' },
];

// ─── Virada e cobrança (fase 3) ─────────────────────────────────────────────
export const DIAS_VENCIMENTO = [1, 5, 10, 15, 20, 25];

/**
 * 1º vencimento: 30 dias depois do início de uso, no primeiro dia da lista (01, 05, 10, 15, 20, 25)
 * igual ou posterior a essa data; depois do dia 25 vai para o dia 01 do mês seguinte.
 * Ex.: 30º dia no dia 12 → dia 15; no dia 27 → dia 01 do mês seguinte.
 */
export function primeiroVencimento(inicioUso: Date): Date {
  const alvo = new Date(new Date(`${diaSP(inicioUso)}T12:00:00-03:00`).getTime() + 30 * 864e5);
  const [a, m, d] = diaSP(alvo).split('-').map(Number);
  const dia = DIAS_VENCIMENTO.find(x => x >= d);
  const [ano, mes, diaV] = dia ? [a, m, dia] : (m === 12 ? [a + 1, 1, 1] : [a, m + 1, 1]);
  return new Date(`${ano}-${String(mes).padStart(2, '0')}-${String(diaV).padStart(2, '0')}T12:00:00-03:00`);
}

// ─── Progresso e etapas para o cliente (fase 4) ─────────────────────────────
type ItemChk = { grupo: string; titulo: string; feito: boolean; ordem?: number; fase?: number | null };

/** Grupos que contam até a virada: Instalação (+ Conversão quando é conversão); serviço = checklist do serviço. */
export function gruposDoProgresso(modulo: string, tipoBase?: string | null): string[] {
  if (modulo === 'SERVICO') return ['SERVICO'];
  return tipoBase === 'BANCO_ZERADO' ? ['ONBOARDING', 'INSTALACAO'] : ['ONBOARDING', 'INSTALACAO', 'CONVERSAO'];
}

/** Percentual até a virada (a virada vale 100%). */
export function progresso(o: { modulo: string; tipo_base?: string | null; virada_fim_em?: Date | null; coluna?: string | null }, itens: ItemChk[]): number {
  if (o.virada_fim_em) return 100;
  if (o.modulo === 'SERVICO' && ['FINALIZADO', 'VALIDADO', 'CONCLUIDO'].includes(o.coluna || '')) return 100;
  const gs = gruposDoProgresso(o.modulo, o.tipo_base);
  const conta = itens.filter(i => gs.includes(i.grupo));
  if (!conta.length) return 0;
  const pct = Math.round((conta.filter(i => i.feito).length / conta.length) * 100);
  return o.modulo === 'SERVICO' ? pct : Math.min(99, pct); // implantação só chega a 100% com "Loja virada"
}

export const MARCOS_PCT = [{ marco: 'P30', pct: 30 }, { marco: 'P50', pct: 50 }, { marco: 'P80', pct: 80 }];

/**
 * Avisos devidos ao cliente, em ordem. Nunca repete (já registrados ficam de fora) e não dispara
 * vários de uma vez: dos percentuais alcançados só vai o maior; os menores ficam como PULADO.
 */
export function marcosDevidos(o: { pct: number; virada: boolean; fasesRealizadas: number[]; jaRegistrados: Set<string> }): { enviar: string[]; pular: string[] } {
  const enviar: string[] = [], pular: string[] = [];
  const novo = (m: string) => !o.jaRegistrados.has(m);
  if (novo('CONTRATO')) enviar.push('CONTRATO');
  const alcancados = MARCOS_PCT.filter(x => o.pct >= x.pct && novo(x.marco)).map(x => x.marco);
  if (o.virada) {
    pular.push(...alcancados, ...MARCOS_PCT.filter(x => o.pct < x.pct && novo(x.marco)).map(x => x.marco));
    if (novo('VIRADA')) enviar.push('VIRADA');
  } else if (alcancados.length) {
    pular.push(...alcancados.slice(0, -1));
    enviar.push(alcancados[alcancados.length - 1]);
  }
  for (const f of o.fasesRealizadas) if (novo(`TREINO_${f}`)) enviar.push(`TREINO_${f}`);
  return { enviar, pular };
}

// ─── Treinamento em fases (fase 5) ──────────────────────────────────────────
export const FASES_TREINAMENTO = [
  { ordem: 1, nome: 'Caixa e PDV', termos: /acesso padr|pr[ée]-?venda|cupom|devolu|acobertamento|fechamento de caixa/i },
  { ordem: 2, nome: 'Estoque, compras e cadastros', termos: /movimenta[cç][aã]o - entrada|produtos - cadastro|curva abc|sngpc|controle de estoque/i },
  { ordem: 3, nome: 'Financeiro e gestão', termos: /./ },
];
export const faseDoItemTreinamento = (titulo: string) => FASES_TREINAMENTO.find(f => f.termos.test(titulo))!.ordem;

/** Tipo do serviço a partir do nome do parceiro/descrição da venda. */
export function inferirTipoServico(texto: string): string {
  const t = (texto || '').toLowerCase();
  if (/cnpj/.test(t)) return 'TROCA_CNPJ';
  if (/comunica|filia|connect/.test(t)) return 'COMUNICACAO';
  if (/impressora/.test(t)) return 'IMPRESSORA';
  if (/banco|base de dados|dados/.test(t)) return 'BANCO_DADOS';
  return 'OUTRO';
}

// ─── Onboarding técnico (primeiro contato, antes de qualquer ação) ─────────
// Responsabilidade do técnico. Enquanto não estiver 100% (o último item é a aprovação do cliente),
// a implantação não avança: sem play em Instalação/Conversão, sem marcar outros itens, sem mover no quadro e sem virada.
// As 15 perguntas principais do primeiro contato (na ordem em que o técnico pergunta).
export const PERGUNTAS_PRIMEIRO_CONTATO = ['maquinas', 'faturamento', 'caixas', 'impressora_nfce', 'etiquetas', 'colaboradores', 'pbms', 'financeiro',
  'corretor_tributario', 'gerencial', 'sngpc', 'usa_comunicacao', 'banco_unico', 'preco_unico', 'tef'];
export const ITEM_PERGUNTAS = 'Perguntas principais do primeiro contato respondidas';
export const perguntasRespondidas = (coleta: any) => PERGUNTAS_PRIMEIRO_CONTATO.every(k => coleta && String(coleta[k] ?? '').trim() !== '');

export const ONBOARDING_SECOES: { secao: string; itens: string[] }[] = [
  { secao: 'Apresentação', itens: [
    'Apresentar-se ao cliente como técnico responsável pela implantação',
    ITEM_PERGUNTAS,
    'Confirmar o contato principal (nome, telefone e e-mail) e o canal de comunicação',
    'Explicar as etapas da implantação, os prazos e o que se espera do cliente',
  ] },
  { secao: 'Diagnóstico da empresa', itens: [
    'Razão social, nome fantasia e CNPJ confirmados',
    'Inscrição estadual, regime tributário e endereço completo',
    'Contador responsável e contato da contabilidade',
  ] },
  { secao: 'Estrutura', itens: [
    'Nº de lojas (única, matriz ou filiais), caixas, computadores e usuários',
    'Responsável pela administração do sistema na loja definido',
  ] },
  { secao: 'Infraestrutura', itens: [
    'Computadores ligados, Windows atualizado e acesso de administrador',
    'Rede e internet testadas (velocidade registrada)',
  ] },
  { secao: 'Equipamentos', itens: [
    'Equipamentos do caixa conferidos (leitor, impressora térmica, gaveta, Pin Pad, nobreak)',
    'Outros equipamentos conferidos (impressora de etiquetas, balança, coletor)',
  ] },
  { secao: 'Fiscal', itens: [
    'Certificado digital (A1/A3), CSC, inscrição estadual e ambiente (produção/homologação)',
  ] },
  { secao: 'Estoque e migração', itens: [
    'Sistema anterior, escopo da migração e volume aproximado de produtos',
    'Controle de lote, validade e medicamentos controlados definido',
  ] },
  { secao: 'Financeiro e integrações', itens: [
    'Módulos financeiros usados e formas de pagamento mapeados',
    'Integrações mapeadas (TEF, PBM, Farmácia Popular, convênios, e-commerce)',
  ] },
  { secao: 'Operação e treinamento', itens: [
    'Horário de funcionamento, dias de pico e melhor janela para a implantação',
    'Quem será treinado, quantas pessoas e modalidade (presencial ou remoto)',
  ] },
  { secao: 'Fechamento', itens: [
    'Pendências registradas com responsável e prazo',
    'Diagnóstico aprovado pelo cliente',
  ] },
];
export const ONBOARDING_ITENS = ONBOARDING_SECOES.flatMap(s => s.itens);
export const ITEM_APROVACAO = 'Diagnóstico aprovado pelo cliente';
export const SLA_ONBOARDING_DIAS_UTEIS = 2;

/** Onboarding técnico concluído? (demandas antigas e serviços não passam por ele) */
export function onboardingOk(i: { modulo?: string | null; data_assinatura?: Date | null; onboarding_concluido_em?: Date | null }, itens?: { grupo: string; feito: boolean }[]): boolean {
  if (i.modulo === 'SERVICO' || ehLegado(i) || i.onboarding_concluido_em) return true;
  const ob = (itens || []).filter(x => x.grupo === 'ONBOARDING');
  return ob.length > 0 && ob.every(x => x.feito);
}

// Trilha real de implantação (Trello) — 3 grupos com os itens do técnico.
export const CHECKLIST_PADRAO: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'INSTALACAO',
    itens: [
      'Instalação do servidor, terminais e Caixa',
      'Configuração de Balança, gaveta',
      'Configuração de impressora NFCE',
      'Configurar Uninfe e Certificado',
      'Configurar Gerencial',
      'Configurar o Copy (backup) Interno e Externo (Nuvem)',
      'Configurar o Connect (Comunicação entre filiais)',
      'Testar Cadastro de Clientes',
      'Teste de Cadastro de Produtos, verificar dados obrigatórios',
      'Teste de Movimentação - Entrada, Emissão de nota e Cancelamento',
      'Teste Financeiro - movimentação',
      'Validar relatórios 100% atualizados',
      'Instalar e Configurar Farmácias APP',
      'Emitir uma nota de saída NFCE em Operação',
    ],
  },
  {
    grupo: 'CONVERSAO',
    itens: [
      'Instalação do Banco de Dados',
      'Limpar tabelas para receber a nova versão',
      'Conversão dos dados do sistema X para Prosystem',
      'Validar Produtos (cód. barras, estoque, tributação, registro MS, custo, venda, lucro, promoção...)',
      'Validar Clientes (endereço completo, RG, CPF, crediário, limite de crédito)',
      'Validar Cadastro de Empresas e Prescritores',
      'Financeiro (plano de contas, contas a pagar/receber, dados de cartões)',
      'Movimentação (entrada, saída, verificar última nota NFE/NFCE)',
      'Gerar SPED Fiscal para validação de valores',
      'Incluir sequência das últimas 10 NFE emitidas na NFE_NUMERACAO',
    ],
  },
  {
    grupo: 'TREINAMENTO',
    itens: [
      'Configuração de Acesso padrão para Funcionários',
      'Movimentação - Entrada / Saída de nota',
      'Produtos - Cadastro',
      'Financeiro - Plano de Contas',
      'PDV - Pré-Venda / Orçamento',
      'Emissão de Cupom Fiscal NFCE',
      'PDV - Devolução',
      'PDV - NFE Acobertamento',
      'Fechamento de caixa',
      'Crediário / Convênio',
      'Sugestão de compras (Curva ABC) — ou apresentar a ferramenta',
      'Controlados / Receitas - Controle SNGPC',
      'Comunicação entre Filiais',
      'Controle de Estoque',
      'Metas de Funcionários',
      'PBM',
      'Recarga de celular - RV',
      'Prosystem Gerencial',
      'Ofertar o Imendes',
      'Mensagerias WhatsApp',
      'Prosystem Dashboard',
    ],
  },
];

// ─── Modelos de checklist por segmento e por sistema de origem (Fase 2) ─────
export type ModeloChecklist = { segmento: string; grupos: { INSTALACAO: string[]; CONVERSAO: string[]; TREINAMENTO: string[] } };
export type ExtraSistema = { sistema: string; itens: string[] };
const norm = (t?: string | null) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const listaDoPadrao = (g: string) => CHECKLIST_PADRAO.find(x => x.grupo === g)?.itens || [];

/** Checklist da implantação: modelo do segmento do cliente (ou o padrão) + itens extras do sistema de origem na conversão. */
export function checklistDoModelo(modelos: ModeloChecklist[] | undefined, extras: ExtraSistema[] | undefined, segmento?: string | null, sistemaAnterior?: string | null): { grupo: string; itens: string[] }[] {
  const m = (modelos || []).find(x => norm(x.segmento) && norm(segmento).includes(norm(x.segmento)));
  const grupos = ['INSTALACAO', 'CONVERSAO', 'TREINAMENTO'].map(g => ({ grupo: g, itens: (m?.grupos as any)?.[g]?.length ? (m!.grupos as any)[g] as string[] : listaDoPadrao(g) }));
  const extra = extrasDoSistema(extras, sistemaAnterior);
  if (extra.length) grupos.find(g => g.grupo === 'CONVERSAO')!.itens = [...grupos.find(g => g.grupo === 'CONVERSAO')!.itens, ...extra];
  return grupos;
}
export function extrasDoSistema(extras: ExtraSistema[] | undefined, sistemaAnterior?: string | null): string[] {
  const s = norm(sistemaAnterior);
  if (!s) return [];
  return (extras || []).filter(x => norm(x.sistema) && s.includes(norm(x.sistema))).flatMap(x => x.itens);
}

// ─── Uma só verdade: a coluna do quadro manda, a etapa de execução acompanha (Fase 2) ─────
export function etapaDaColuna(coluna: string, i: { tecnico_id?: string | null; tipo_base?: string | null; etapa_execucao?: string | null }): string {
  switch (coluna) {
    case 'BACKLOG': case 'A_FAZER': return i.tecnico_id ? 'DESIGNADO' : 'AGUARDANDO_DESIGNACAO';
    case 'EM_ANDAMENTO': return i.tipo_base === 'CONVERSAO' ? 'EM_CONVERSAO' : 'EM_CONFIGURACAO';
    case 'ACOMPANHAMENTO': case 'CONCLUIDO': case 'VALIDADO': return 'EM_TREINAMENTO';
    case 'FINALIZADO': return 'FINALIZADO';
    default: return i.etapa_execucao || 'AGUARDANDO_DESIGNACAO';
  }
}
export function colunaDaEtapa(etapa: string): string {
  if (etapa === 'FINALIZADO') return 'FINALIZADO';
  if (etapa === 'EM_TREINAMENTO') return 'ACOMPANHAMENTO';
  if (['EM_ANALISE', 'EM_CONVERSAO', 'EM_CONFIGURACAO'].includes(etapa)) return 'EM_ANDAMENTO';
  return 'A_FAZER';
}
/** A coluna pedida combina com os marcos da implantação? Devolve o motivo quando não combina. */
export function colunaIncoerente(i: { modulo: string; virada_inicio_em?: Date | null; virada_fim_em?: Date | null }, para: string): string | null {
  if (i.modulo !== 'IMPLANTACAO' || para === 'CANCELADOS') return null;
  if (i.virada_fim_em && ['BACKLOG', 'A_FAZER', 'EM_ANDAMENTO'].includes(para)) return 'A loja já virou: a demanda fica em Acompanhamento e Treinamento ou depois.';
  if (i.virada_inicio_em && ['BACKLOG', 'A_FAZER'].includes(para)) return 'A virada já começou: a demanda fica em Em andamento ou depois.';
  if (!i.virada_fim_em && para === 'ACOMPANHAMENTO') return 'A loja ainda não virou. Use "Loja virada" na aba Virada para ir para Acompanhamento.';
  return null;
}

// ─── Operação assistida: 5 dias úteis depois da loja virada (Fase 2) ─────
export const DIAS_ASSISTIDA = 5;
export const INICIO_ASSISTIDA = new Date('2026-10-03T03:00:00.000Z'); // viradas a partir de 03/10/2026
export const assistidaExigida = (i: { modulo: string; virada_fim_em?: Date | null; data_assinatura?: Date | null }) =>
  i.modulo === 'IMPLANTACAO' && !!i.virada_fim_em && i.virada_fim_em >= INICIO_ASSISTIDA && !ehLegado(i);
/** Os 5 dias úteis da operação assistida (YYYY-MM-DD, Brasília), a partir do dia útil seguinte à virada. */
export const diasAssistida = (viradaFim: Date) => Array.from({ length: DIAS_ASSISTIDA }, (_, k) => diaSP(somarDiasUteis(viradaFim, k + 1)));
export function statusAssistida(i: { modulo: string; virada_fim_em?: Date | null; data_assinatura?: Date | null }, feitos: { dia: string }[], agora = new Date()) {
  if (!assistidaExigida(i)) return null;
  const hoje = diaSP(agora), set = new Set(feitos.map(f => f.dia));
  const dias = diasAssistida(i.virada_fim_em!).map(dia => ({ dia, feito: set.has(dia), liberado: dia <= hoje }));
  const nFeitos = dias.filter(d => d.feito).length;
  return {
    dias, feitos: nFeitos, total: DIAS_ASSISTIDA, concluida: nFeitos >= DIAS_ASSISTIDA,
    pendentes: dias.filter(d => d.liberado && !d.feito).map(d => d.dia), // hoje ou atrasados
    proximo: dias.find(d => !d.feito && !d.liberado)?.dia || null,
  };
}
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const quandoSP = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');

// ─── Próximo passo e pré-requisitos de cada etapa (Fase 1 do plano de UX, 03/10/2026) ─────
// Uma regra só, usada pela faixa do card, pela linha do cartão no quadro e pelos bloqueios das rotas.

type DemandaPP = {
  modulo: string; tipo_base?: string | null; status?: string | null; coluna?: string | null; etapa_execucao?: string | null;
  tecnico_id?: string | null; data_assinatura?: Date | null; onboarding_concluido_em?: Date | null; coleta?: any;
  tela_suporte_arquivo_id?: string | null; virada_inicio_em?: Date | null; virada_fim_em?: Date | null;
  virada_agendada_para?: Date | null;
};
type ItemPP = { grupo: string; titulo: string; feito: boolean };

// Itens do checklist que precisam estar feitos antes da virada (achados pelo título; se o card não tem o item, não trava).
const CRITICOS_INICIAR_VIRADA: { grupo: string; re: RegExp; nome: string; so?: string }[] = [
  { grupo: 'INSTALACAO', re: /certificado/i, nome: 'Configurar Uninfe e certificado digital' },
  { grupo: 'INSTALACAO', re: /backup|copy/i, nome: 'Configurar o backup (Copy) interno e externo' },
  { grupo: 'CONVERSAO', re: /^convers[aã]o dos dados/i, nome: 'Conversão dos dados', so: 'CONVERSAO' },
  { grupo: 'CONVERSAO', re: /^validar produtos/i, nome: 'Validar produtos convertidos', so: 'CONVERSAO' },
];
const CRITICOS_CONCLUIR_VIRADA: { grupo: string; re: RegExp; nome: string; so?: string }[] = [
  { grupo: 'INSTALACAO', re: /nota de sa[ií]da nfce|nfce em opera/i, nome: 'Emitir uma NFC-e de saída em operação' },
];

const fichaOk = (i: DemandaPP) => !!(i.coleta?.regime_tributario && i.coleta?.contato_nome);
const criticosPendentes = (lista: typeof CRITICOS_INICIAR_VIRADA, i: DemandaPP, itens: ItemPP[]) =>
  lista.filter(c => !c.so || i.tipo_base === c.so)
    .filter(c => { const it = itens.find(x => x.grupo === c.grupo && c.re.test(x.titulo)); return !!it && !it.feito; })
    .map(c => c.nome);

/** O que falta para "Iniciar virada". Vazio = liberado. */
export function pendenciasIniciarVirada(i: DemandaPP, itens: ItemPP[]): string[] {
  if (ehLegado(i)) return [];
  const p: string[] = [];
  if (!onboardingOk(i, itens)) p.push('Concluir o onboarding técnico (primeiro contato)');
  if (!fichaOk(i)) p.push('Ficha de coleta: regime tributário e contato principal');
  p.push(...criticosPendentes(CRITICOS_INICIAR_VIRADA, i, itens));
  if (!i.tela_suporte_arquivo_id) p.push('Anexar a tela de liberação do Suporte');
  return p;
}

/** O que falta para "Loja virada". Vazio = liberado. */
export function pendenciasConcluirVirada(i: DemandaPP, itens: ItemPP[]): string[] {
  if (ehLegado(i)) return [];
  const p: string[] = [];
  if (!i.virada_inicio_em) p.push('Iniciar a virada');
  p.push(...criticosPendentes(CRITICOS_CONCLUIR_VIRADA, i, itens));
  return p;
}

/** O que falta para pedir a validação da supervisão (ir para "Concluído"). Vazio = liberado. */
export function pendenciasValidacao(i: DemandaPP, itens: ItemPP[], fases: { realizada_em: Date | null }[], correcoesAbertas: number, assistida?: { dia: string }[]): string[] {
  const p: string[] = [];
  const a = assistida ? statusAssistida(i, assistida) : null;
  if (a && !a.concluida) p.push(`Operação assistida: ${a.feitos} de ${a.total} dias checados`);
  if (i.modulo === 'SERVICO') {
    const s = itens.filter(x => x.grupo === 'SERVICO');
    if (s.some(x => !x.feito)) p.push(`Checklist do serviço: ${s.filter(x => x.feito).length} de ${s.length} itens`);
  } else {
    if (!i.virada_fim_em) p.push('Concluir a virada (Loja virada)');
    if (fases.length && fases.some(f => !f.realizada_em)) p.push(`Treinamento: ${fases.filter(f => f.realizada_em).length} de ${fases.length} fases realizadas`);
  }
  if (correcoesAbertas) p.push(`Resolver ${correcoesAbertas} correção(ões) aberta(s)`);
  return p;
}

export type ProximoPasso = {
  chave: 'CANCELADA' | 'FINALIZADA' | 'FINALIZAR' | 'VALIDAR' | 'DESIGNAR' | 'EXECUTAR' | 'ONBOARDING' | 'COLETA' | 'AGENDAR_VIRADA' | 'PREPARAR' | 'INICIAR_VIRADA' | 'CONCLUIR_VIRADA' | 'ASSISTIDA' | 'ASSISTIDA_ANDAMENTO' | 'TREINAMENTO' | 'CORRECOES' | 'PEDIR_VALIDACAO';
  titulo: string; detalhe?: string; quem: 'TECNICO' | 'GESTAO' | 'NINGUEM';
  aba?: string; etapa?: string; pendencias?: string[];
};

/** Próximo passo da demanda: o que fazer agora, quem faz, em qual aba e em qual etapa do cronômetro. */
export function proximoPasso(i: DemandaPP, itens: ItemPP[], fases: { realizada_em: Date | null }[], correcoesAbertas: number, extra: { assistida?: { dia: string }[]; agora?: Date } = {}): ProximoPasso {
  const col = colunaDe(i);
  if (i.status === 'CANCELADA' || col === 'CANCELADOS') return { chave: 'CANCELADA', titulo: 'Demanda cancelada', quem: 'NINGUEM' };
  if (col === 'FINALIZADO') return { chave: 'FINALIZADA', titulo: 'Demanda finalizada', quem: 'NINGUEM' };
  if (col === 'VALIDADO') return { chave: 'FINALIZAR', titulo: 'Validada: falta finalizar', quem: 'GESTAO' };
  if (col === 'CONCLUIDO') return { chave: 'VALIDAR', titulo: 'Aguardando a validação da supervisão', quem: 'GESTAO' };
  if (!i.tecnico_id) return { chave: 'DESIGNAR', titulo: 'Designar o técnico responsável', quem: 'GESTAO' };
  const correcoes: ProximoPasso = { chave: 'CORRECOES', titulo: 'Resolver as correções', detalhe: `${correcoesAbertas} aberta(s)`, quem: 'TECNICO', aba: 'correcoes', etapa: 'CORRECAO' };
  const pedir: ProximoPasso = { chave: 'PEDIR_VALIDACAO', titulo: 'Pedir a validação da supervisão', detalhe: 'Tudo pronto do seu lado', quem: 'TECNICO' };
  if (i.modulo === 'SERVICO') {
    const s = itens.filter(x => x.grupo === 'SERVICO');
    if (s.some(x => !x.feito)) return { chave: 'EXECUTAR', titulo: 'Executar o serviço', detalhe: `${s.filter(x => x.feito).length} de ${s.length} itens do checklist`, quem: 'TECNICO', aba: 'checklist', etapa: 'INSTALACAO' };
    return correcoesAbertas ? correcoes : pedir;
  }
  const ob = itens.filter(x => x.grupo === 'ONBOARDING');
  if (!onboardingOk(i, itens)) return { chave: 'ONBOARDING', titulo: 'Primeiro contato com o cliente', detalhe: ob.length ? `${ob.filter(x => x.feito).length} de ${ob.length} itens do roteiro` : 'O roteiro é criado quando o técnico é designado', quem: 'TECNICO', aba: 'onboarding', etapa: 'ONBOARDING' };
  const etapaPrep = i.tipo_base === 'CONVERSAO' ? 'CONVERSAO' : 'INSTALACAO';
  if (!i.virada_inicio_em && !i.virada_fim_em) {
    if (!fichaOk(i) && !ehLegado(i)) return { chave: 'COLETA', titulo: 'Completar a ficha de coleta', detalhe: 'Faltam o regime tributário e/ou o contato principal', quem: 'TECNICO', aba: 'ficha', etapa: etapaPrep };
    if (!i.virada_agendada_para && !ehLegado(i)) return { chave: 'AGENDAR_VIRADA', titulo: 'Agendar a virada com o cliente', detalhe: 'Data e hora combinadas; o cliente recebe a data e um lembrete 1 dia antes', quem: 'TECNICO', aba: 'virada' };
    const agenda = i.virada_agendada_para ? `Virada agendada para ${quandoSP(i.virada_agendada_para)}` : null;
    const pend = pendenciasIniciarVirada(i, itens);
    if (pend.length) {
      const grupos = i.tipo_base === 'CONVERSAO' ? ['INSTALACAO', 'CONVERSAO'] : ['INSTALACAO'];
      const prep = itens.filter(x => grupos.includes(x.grupo));
      const soTela = pend.length === 1 && /Suporte/.test(pend[0]);
      return { chave: 'PREPARAR', titulo: 'Preparar a virada', detalhe: `${prep.filter(x => x.feito).length} de ${prep.length} itens de ${i.tipo_base === 'CONVERSAO' ? 'instalação e conversão' : 'instalação'}${agenda ? ` · ${agenda}` : ''}`, quem: 'TECNICO', aba: soTela ? 'virada' : 'checklist', etapa: etapaPrep, pendencias: pend };
    }
    return { chave: 'INICIAR_VIRADA', titulo: 'Iniciar a virada da loja', detalhe: agenda ? `Pré-requisitos completos · ${agenda}` : 'Pré-requisitos completos', quem: 'TECNICO', aba: 'virada', etapa: 'INSTALACAO' };
  }
  if (!i.virada_fim_em) {
    const pend = pendenciasConcluirVirada(i, itens);
    return { chave: 'CONCLUIR_VIRADA', titulo: 'Concluir a virada (Loja virada)', detalhe: pend.length ? undefined : 'Virada em andamento', quem: 'TECNICO', aba: pend.length ? 'checklist' : 'virada', etapa: 'INSTALACAO', pendencias: pend.length ? pend : undefined };
  }
  // Operação assistida corre junto com o treinamento: a checagem do dia vem primeiro.
  const a = statusAssistida(i, extra.assistida || [], extra.agora);
  if (a && a.pendentes.length) return { chave: 'ASSISTIDA', titulo: `Operação assistida: checagem ${a.pendentes.length > 1 ? `de ${a.pendentes.length} dias` : `de ${ddmm(a.pendentes[0])}`}`, detalhe: `${a.feitos} de ${a.total} dias checados (vendas, NFC-e e estoque)`, quem: 'TECNICO', aba: 'assistida', etapa: 'ASSISTIDA' };
  if (fases.length && fases.some(f => !f.realizada_em)) {
    const feitas = fases.filter(f => f.realizada_em).length;
    return { chave: 'TREINAMENTO', titulo: `Treinamento: fase ${feitas + 1} de ${fases.length}`, detalhe: `${feitas} de ${fases.length} fases realizadas`, quem: 'TECNICO', aba: 'treinamento', etapa: 'TREINAMENTO' };
  }
  if (correcoesAbertas) return correcoes;
  if (a && !a.concluida) return { chave: 'ASSISTIDA_ANDAMENTO', titulo: 'Operação assistida em andamento', detalhe: `${a.feitos} de ${a.total} dias checados${a.proximo ? ` · próxima checagem ${ddmm(a.proximo)}` : ''}`, quem: 'TECNICO', aba: 'assistida' };
  return pedir;
}
