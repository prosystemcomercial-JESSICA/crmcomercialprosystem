// Mila · Agenda do CS da semana (23/11/2026). Puro: transforma os fatos do CRM nos gatilhos da seção 1 do manual
// (docs/comercial/playbook-mila-cs.md) — QUANDO agir, O QUE fazer e COMO falar. Não cria atividade nem manda mensagem:
// é uma lista para a equipe decidir.

const DIA = 864e5;
export const DIAS_IMPLANTACAO_PARADA = 10;
export const DIAS_CASO_PARADO = 7;
export const MAX_POR_SECAO = 15;
const STATUS_CASO_ABERTO = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'];

export type ImplantacaoAg = {
  id: string; cliente_razao_social: string; cliente_cnpj?: string | null; status?: string | null; modulo?: string | null;
  tipo_base?: string | null; tecnico_nome?: string | null; etapa_execucao?: string | null;
  data_conclusao?: Date | null; created_at: Date; updated_at: Date;
};
export type ClienteAg = { id: string; nome: string; cnpj?: string | null; segmento?: string | null };
export type CasoAg = { cliente: string; status: string; motivo?: string | null; updated_at: Date };
export type InativoAg = { nome: string; cnpj?: string | null; motivo?: string | null; inativado_em: Date | null };

export type DadosAgenda = {
  implantacoes: ImplantacaoAg[];
  emAtencao: ClienteAg[];
  casos: CasoAg[];
  inativos: InativoAg[]; // inativados nos últimos 90 dias
  ativos: ClienteAg[];
};

export type ItemAgenda = { cliente: string; quando: string; acao: string };
export type SecaoAgenda = { id: string; titulo: string; secaoManual: string; mensagem?: string; itens: ItemAgenda[] };

const dias = (de: Date, ate: Date) => Math.floor((+ate - +de) / DIA);
export const cnpjRaiz = (c?: string | null) => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.slice(0, 8) : null; };
const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const semMotivo = (m?: string | null) => !m || !m.trim() || /^(sem motivo|n[aã]o (informado|sabe|soube))/i.test(m.trim());

/** Marcos depois da virada. Janela de 7 dias: a agenda é semanal, então cada implantação aparece uma vez em cada marco. */
const MARCOS = [
  { de: 0, ate: 6, id: 'virada', titulo: 'Virada na última semana: checagem do primeiro dia', secao: '2, 3 e 4',
    acao: 'Confirmar se a venda e o fechamento do caixa rodaram e se a loja sabe onde pedir ajuda. Abrir a lista de pendências adiadas.',
    mensagem: 'Oi, [nome]. Passando para saber como foi o primeiro dia com o sistema. A venda e o fechamento do caixa rodaram bem? Se algo travou, me conta que eu aciono o técnico.' },
  { de: 7, ate: 13, id: 'd7', titulo: 'D+7: confirmar o primeiro resultado e reforçar o treino', secao: '2 e 4',
    acao: 'Confirmar com quem usa de verdade que a rotina principal do segmento funcionou. Se travou, separar defeito, configuração ou falta de treino e pedir um reforço curto.',
    mensagem: 'Oi, [nome]. Já faz uma semana com o sistema. Tem alguma tarefa que a equipe ainda faz com dificuldade? Se tiver, posso pedir um reforço rápido só nesse ponto.' },
  { de: 30, ate: 36, id: 'd30', titulo: 'D+30: fim do acompanhamento intensivo', secao: '2, 4 e 5',
    acao: 'Ver se a rotina se repete sem ajuda, se há chamados repetidos e se mais de uma pessoa sabe operar. Pendências adiadas zeradas ou com dono.' },
  { de: 90, ate: 96, id: 'd90', titulo: 'D+90: a conta entra na base da Mila', secao: '2 e 5',
    acao: 'Fazer a primeira leitura de saúde (5 dimensões, com evidência) e registrar usuário-chave, quem decide e o resultado alcançado.' },
] as const;

export function montarAgendaCs(d: DadosAgenda, agora: Date): SecaoAgenda[] {
  const secoes: SecaoAgenda[] = [];
  const impl = d.implantacoes.filter(i => (i.modulo || 'IMPLANTACAO') === 'IMPLANTACAO' && !/CANCELAD/i.test(i.status || ''));
  const quemImpl = (i: ImplantacaoAg) => `${i.cliente_razao_social}${i.tipo_base === 'CONVERSAO' ? ' (conversão)' : ''}`;

  // 1) Implantações paradas (sem conclusão, sem mexer há 10+ dias; só as dos últimos 6 meses).
  const paradas = impl.filter(i => !i.data_conclusao && dias(i.created_at, agora) <= 180 && dias(i.updated_at, agora) >= DIAS_IMPLANTACAO_PARADA)
    .sort((a, b) => +a.updated_at - +b.updated_at);
  secoes.push({ id: 'implantacao_parada', titulo: `Implantação sem avanço há ${DIAS_IMPLANTACAO_PARADA} dias ou mais`, secaoManual: '3',
    itens: paradas.map(i => ({ cliente: quemImpl(i), quando: `parada há ${dias(i.updated_at, agora)} dias${i.etapa_execucao ? ` · etapa ${i.etapa_execucao}` : ''}`,
      acao: `Perguntar ao técnico${i.tecnico_nome ? ` (${i.tecnico_nome})` : ''} qual é o bloqueio e de quem depende. Não cobrar o cliente antes disso.` })) });

  // 2) Marcos depois da virada.
  for (const m of MARCOS) {
    const its = impl.filter(i => i.data_conclusao && dias(i.data_conclusao, agora) >= m.de && dias(i.data_conclusao, agora) <= m.ate);
    secoes.push({ id: m.id, titulo: m.titulo, secaoManual: m.secao, mensagem: 'mensagem' in m ? m.mensagem : undefined,
      itens: its.map(i => ({ cliente: quemImpl(i), quando: `virada em ${fmt(i.data_conclusao!)}`, acao: m.acao })) });
  }

  // 3) Contas em atenção (nota ruim/regular da Helena ou risco marcado).
  secoes.push({ id: 'atencao', titulo: 'Contas marcadas em atenção', secaoManual: '5 e 7',
    mensagem: 'Obrigada por me contar, [nome]. Quero entender o que pesou mais e ver qual próximo passo consigo alinhar. Pode me dizer em uma frase?',
    itens: d.emAtencao.map(c => ({ cliente: c.nome, quando: 'contato humano em até 1 dia útil',
      acao: 'Ler o histórico, ouvir o ponto, combinar próximo passo com dono e prazo, voltar para confirmar. O risco só baixa com evidência.' })) });

  // 4) Casos de churn abertos e parados.
  const casos = d.casos.filter(c => STATUS_CASO_ABERTO.includes(c.status) && dias(c.updated_at, agora) >= DIAS_CASO_PARADO)
    .sort((a, b) => +a.updated_at - +b.updated_at);
  secoes.push({ id: 'caso_parado', titulo: `Caso de churn aberto sem atualização há ${DIAS_CASO_PARADO} dias ou mais`, secaoManual: '8',
    itens: casos.map(c => ({ cliente: c.cliente, quando: `${c.status.toLowerCase()} · parado há ${dias(c.updated_at, agora)} dias`,
      acao: `Cobrar o dono interno e dar retorno ao cliente.${semMotivo(c.motivo) ? ' Motivo ainda não confirmado: registrar como "não confirmado" até o cliente dizer.' : ''}` })) });

  // 5) Saídas recentes sem motivo.
  const sem = d.inativos.filter(c => c.inativado_em && dias(c.inativado_em, agora) <= 30 && semMotivo(c.motivo));
  secoes.push({ id: 'sem_motivo', titulo: 'Saiu nos últimos 30 dias sem motivo registrado', secaoManual: '13',
    mensagem: 'Entendi, [nome]. Para eu registrar corretamente e ajudar a equipe a melhorar, qual foi o principal motivo da decisão? Se preferir, pode responder só com uma frase.',
    itens: sem.map(c => ({ cliente: c.nome, quando: `saiu em ${fmt(c.inativado_em!)}`, acao: 'Tentar uma vez com quem decidiu. Sem resposta, registrar "não informado" e a tentativa.' })) });

  // 6) Lojas do mesmo grupo (mesmo CNPJ raiz) de quem saiu nos últimos 90 dias.
  const saidasPorRaiz = new Map<string, InativoAg[]>();
  for (const c of d.inativos) { const r = cnpjRaiz(c.cnpj); if (r) saidasPorRaiz.set(r, [...(saidasPorRaiz.get(r) || []), c]); }
  const grupo = d.ativos.filter(c => { const r = cnpjRaiz(c.cnpj); return r && saidasPorRaiz.has(r); });
  secoes.push({ id: 'grupo', titulo: 'Loja ativa do mesmo grupo de quem saiu (mesmo CNPJ raiz, últimos 90 dias)', secaoManual: '9',
    mensagem: 'Oi, [nome]. Soube da mudança na [outra loja]. Ela vale para esta loja também ou vocês seguem avaliando? Quero te direcionar corretamente.',
    itens: grupo.map(c => { const s = saidasPorRaiz.get(cnpjRaiz(c.cnpj)!)!; return { cliente: c.nome, quando: `saiu: ${s.map(x => x.nome).slice(0, 3).join(', ')}`,
      acao: `Conferir se a decisão é do grupo e se há algo em aberto.${s.some(x => !semMotivo(x.motivo)) ? ` Motivo da outra loja: "${(s.find(x => !semMotivo(x.motivo))!.motivo || '').slice(0, 120)}".` : ''} Sem oferta de upgrade enquanto isso.` }; }) });

  return secoes;
}

export function agendaEmMarkdown(secoes: SecaoAgenda[], agora: Date): { md: string; total: number } {
  const total = secoes.reduce((t, s) => t + s.itens.length, 0);
  const linhas = [
    `# Agenda do CS · semana de ${fmt(agora)}`, '',
    total ? `${total} conta(s) pedem ação nesta semana. É uma lista para a equipe decidir: nada foi enviado e nenhuma atividade foi criada. Leia o histórico antes de cada contato e mande uma mensagem por vez.`
      : 'Nenhum gatilho do manual apareceu nesta semana.',
  ];
  for (const s of secoes) {
    if (!s.itens.length) continue;
    linhas.push('', `## ${s.titulo} (${s.itens.length})`, `Como agir: manual da Mila, seção ${s.secaoManual}.`);
    if (s.mensagem) linhas.push(`Mensagem sugerida (adapte ao histórico): "${s.mensagem}"`);
    linhas.push('', '| Cliente | Quando | O que fazer |', '| --- | --- | --- |');
    for (const i of s.itens.slice(0, MAX_POR_SECAO)) linhas.push(`| ${i.cliente.replace(/\|/g, ' ')} | ${i.quando.replace(/\|/g, ' ')} | ${i.acao.replace(/\|/g, ' ')} |`);
    if (s.itens.length > MAX_POR_SECAO) linhas.push('', `E mais ${s.itens.length - MAX_POR_SECAO} nesta seção.`);
  }
  return { md: linhas.join('\n'), total };
}
