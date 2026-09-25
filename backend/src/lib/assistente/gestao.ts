// Assistente da gestão no WhatsApp: a Jessica/o Thiago mandam uma mensagem para o
// número da empresa e o CRM responde com números. Puro: casamento de telefone,
// leitura do comando e textos das respostas/avisos.

export const TIPOS_AVISO = ['lead_qualificado', 'proposta_aberta', 'proposta_aceita', 'sla_estourado', 'risco_cancelar', 'resumo_diario', 'pesquisa_satisfacao', 'pesquisa_setor'] as const;
export type TipoAviso = typeof TIPOS_AVISO[number];
export const NOME_AVISO: Record<TipoAviso, string> = {
  lead_qualificado: 'Lead qualificado pela triagem',
  proposta_aberta: 'Cliente abriu a proposta',
  proposta_aceita: 'Proposta aceita',
  sla_estourado: 'Conversa passou do prazo de resposta',
  risco_cancelar: 'Cliente com risco de cancelar',
  resumo_diario: 'Resumo curto às 18h (seg–qui o dia, sexta a semana)',
  pesquisa_satisfacao: 'Resposta da pesquisa de satisfação',
  pesquisa_setor: 'Pesquisa semanal da Sofia (assuntos do setor)',
};

/** Últimos 8 dígitos: casa "(27) 99752-1370" com "5527997521370". */
export const ultimos8 = (tel: string | null | undefined) => (tel || '').replace(/\D/g, '').slice(-8);

export function acharGestor<T extends { telefone: string | null }>(numero: string, gestores: T[]): T | null {
  const alvo = ultimos8(numero);
  if (alvo.length < 8) return null;
  return gestores.find(g => ultimos8(g.telefone) === alvo) || null;
}

/** Preferências salvas (JSON array). Ausente/inválido = todos os avisos. */
export function lerPreferenciasAvisos(valor: string | null | undefined): TipoAviso[] {
  if (!valor) return [...TIPOS_AVISO];
  try {
    const arr = JSON.parse(valor);
    return Array.isArray(arr) ? arr.filter((t: any) => (TIPOS_AVISO as readonly string[]).includes(t)) : [...TIPOS_AVISO];
  } catch { return [...TIPOS_AVISO]; }
}

export type Comando = { tipo: 'hoje' } | { tipo: 'semana' } | { tipo: 'propostas_paradas' } | { tipo: 'cliente'; termo: string } | { tipo: 'ajuda' };

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[?!.]/g, '').trim();

/**
 * Só frases curtas que são claramente comando. Qualquer outra mensagem da gestão
 * devolve null e segue o caminho normal do WhatsApp (Inbox, como sempre foi).
 */
export function interpretarComando(texto: string): Comando | null {
  const t = norm(texto);
  const cli = t.match(/^(cliente|buscar cliente)\s+(.+)$/);
  if (cli) return { tipo: 'cliente', termo: texto.trim().replace(/^\s*(buscar\s+)?cliente\s+/i, '').trim() };
  if (/^propostas? paradas?$/.test(t)) return { tipo: 'propostas_paradas' };
  if (/^(semana|resumo da semana)$/.test(t)) return { tipo: 'semana' };
  if (/^(hoje|como esta hoje|como estamos hoje|resumo de hoje|resumo)$/.test(t)) return { tipo: 'hoje' };
  if (/^(ajuda|comandos|menu crm|crm)$/.test(t)) return { tipo: 'ajuda' };
  return null;
}

export const AJUDA = [
  'Oi! Sou o assistente do CRM. Você pode me mandar:',
  '• *hoje*: números do dia',
  '• *semana*: resumo da semana',
  '• *propostas paradas*: propostas sem resposta há 7+ dias',
  '• *cliente 381* ou *cliente padaria pão*: dados do cliente',
  '• *tarefa Ana ligar para Farmácia Rangel amanhã 10h*: lança uma atividade (você confirma antes)',
].join('\n');

const brl = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const ORIGEM: Record<string, string> = { WHATSAPP: 'WhatsApp', MANUAL: 'manual', PROPOSTA: 'proposta', SITE: 'site', INDICACAO: 'indicação', RETROATIVO: 'retroativo' };

export function textoHoje(t1: any): string {
  const origens = Object.entries(t1.leads_novos_hoje.por_origem || {}) as [string, number][];
  const linhas = [
    '📊 *Hoje no comercial*',
    `Leads novos: *${t1.leads_novos_hoje.total}*${origens.length ? ` (${origens.map(([o, n]) => `${n} ${ORIGEM[o] || o.toLowerCase()}`).join(', ')})` : ''}`,
    `Qualificados pela triagem: *${t1.qualificados_hoje.pela_triagem}*`,
    `Contratos: *${t1.contratos.hoje}* hoje · ${t1.contratos.mes} no mês`,
    `Conversas: ${t1.conversas_iniciadas.total} iniciadas · ${t1.conversas_respondidas.total} respondidas`,
    `Sem resposta: *${t1.sem_resposta.total ?? '—'}*${t1.sem_resposta.fora_do_prazo ? ` (${t1.sem_resposta.fora_do_prazo} fora do prazo)` : ''}`,
    `Em negociação: ${t1.negociacoes.total}${t1.negociacoes.valor_potencial != null ? ` · ${brl(t1.negociacoes.valor_potencial)} em potencial` : ''}`,
  ];
  const al = t1.alertas || {};
  if (al.propostas_paradas) linhas.push(`⚠️ ${al.propostas_paradas} proposta(s) parada(s) há 7+ dias`);
  if (al.leads_para_distribuir) linhas.push(`⚠️ ${al.leads_para_distribuir} lead(s) esperando distribuição`);
  return linhas.join('\n');
}

export function textoSemana(s: any): string {
  const g = s.eficiencia_geral;
  const linhas = [
    `📅 *Semana (${s.periodo})*`,
    `Leads novos: *${s.leads_novos}* · qualificados: ${s.qualificados}`,
    `Propostas enviadas: ${s.propostas_enviadas} · contratos: *${s.contratos}* (${brl(s.faturamento_instalacao)})`,
    `Conversas: ${s.conversas_iniciadas} iniciadas · ${s.conversas_respondidas} respondidas`,
    `Eficiência da equipe: *${g.eficiencia_pct == null ? '—' : `${g.eficiencia_pct}%`}* (${g.no_prazo} no prazo, ${g.concluidas_atrasadas} com atraso, ${g.vencidas_abertas} vencidas)`,
  ];
  for (const u of s.equipe || []) {
    linhas.push(`• ${u.nome}: ${u.eficiencia.eficiencia_pct == null ? '—' : `${u.eficiencia.eficiencia_pct}%`} · ${u.concluidas.length} concluída(s) · ${u.conversas_respondidas} conversas`);
  }
  return linhas.join('\n');
}

export function textoPropostasParadas(ps: Array<{ nome: string; valor: number | null; dias: number; status: string }>): string {
  if (!ps.length) return '✅ Nenhuma proposta parada há 7+ dias.';
  return [`⏳ *${ps.length} proposta(s) parada(s)*`, ...ps.slice(0, 10).map(p => `• ${p.nome}: ${brl(p.valor)} · ${p.dias} dias · ${p.status.toLowerCase()}`)].join('\n');
}

export function textoClientes(cs: Array<{ codigo: string | null; nome: string; plano: string | null; mensalidade: number | null; situacao: string | null; segmento: string | null }>, termo: string): string {
  if (!cs.length) return `Não achei cliente para "${termo}".`;
  return [
    `🔎 *Clientes para "${termo}"*`,
    ...cs.slice(0, 5).map(c => `• ${c.codigo ? `#${c.codigo} ` : ''}${c.nome}${c.segmento ? ` · ${c.segmento}` : ''}${c.plano ? ` · ${c.plano}` : ''}${c.mensalidade != null ? ` · ${brl(c.mensalidade)}/mês` : ''}${c.situacao && c.situacao !== 'ATIVA' ? ` · ${c.situacao.toLowerCase()}` : ''}`),
    ...(cs.length > 5 ? [`… e mais ${cs.length - 5}. Refine a busca.`] : []),
  ].join('\n');
}
