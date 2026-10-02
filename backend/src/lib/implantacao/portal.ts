// Portal de implantação (fase 2): quadro, prazo (SLA), serviços e ficha de coleta. Puro (sem banco).
import { janelasDaJornada, sobreposicao, diaSP, JORNADA_PADRAO, type Jornada } from './cronometro';

// Demandas anteriores ao portal (no ar em 02/10/2026): ficam no CRM, mas não geram aviso nenhum
// (nem ao cliente, nem à gestão/técnico). O quadro mostra só as dos últimos 60 dias.
export const INICIO_PORTAL = new Date('2026-10-02T14:00:00Z');
export const ehLegado = (i: { data_assinatura?: Date | null }) => !i.data_assinatura || i.data_assinatura < INICIO_PORTAL;
export const DIAS_QUADRO = 60;

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
