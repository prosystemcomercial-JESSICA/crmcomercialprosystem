// Caroline, a SDR: leitura dos leads colados da plataforma de campanhas, regras
// anti-bloqueio da fila, termômetro de interesse e o prompt da conversa. Puro.

import { numeroWhatsapp } from './campanhas';

export type LeadColado = {
  nome: string | null; empresa: string | null; telefone: string | null; numero: string | null; email: string | null;
  campanha: string | null; origem: string | null; cadastro_em: Date | null; segmento: string | null; url: string | null;
};

const campo = (bloco: string, nome: string) => {
  const m = bloco.match(new RegExp(`^[ \\t]*${nome}[ \\t]*:[ \\t]*(.*)$`, 'im'));
  const v = (m?.[1] || '').trim();
  return v || null;
};

const SEGMENTOS: [RegExp, string][] = [[/manipula/i, 'Manipulação'], [/farm|drogar/i, 'Farmácia'], [/padar|panific|confeit/i, 'Padaria'], [/mercad|varej|loja/i, 'Varejo']];

/** Um ou vários leads colados ("Lead se Cadastrou em ... na campanha ..."). */
export function lerLeadsColados(texto: string): LeadColado[] {
  const partes = texto.split(/(?=Lead se Cadastrou)/i).map(p => p.trim()).filter(p => /telefone\s*:/i.test(p));
  return partes.map(b => {
    // "Empresa:" pode vir vazio antes do preenchido: pega o primeiro com valor.
    const empresas = [...b.matchAll(/^[ \t]*Empresa[ \t]*:[ \t]*(.*)$/gim)].map(m => m[1].trim()).filter(Boolean);
    const cad = b.match(/Cadastrou em\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/i);
    const cadastro_em = cad ? new Date(`${cad[3]}-${cad[2]}-${cad[1]}T${cad[4]}:${cad[5]}:${cad[6] || '00'}-03:00`) : null;
    const utmCampanha = b.match(/Campanha:\s*([^\s,]+)/i)?.[1] || null;
    const linhaCampanha = b.match(/na campanha\s+(?:\w+\s*-\s*)?([^\s-][^\n-]*?)\s*-?\s*$/im)?.[1]?.trim() || null;
    const urlLinha = b.match(/^\s*URL\s*([^:]*):\s*(\S+)/im);
    const segTexto = `${urlLinha?.[1] || ''} ${b}`;
    const segmento = SEGMENTOS.find(([re]) => re.test(urlLinha?.[1] || ''))?.[1] || SEGMENTOS.find(([re]) => re.test(segTexto))?.[1] || null;
    const telefone = campo(b, 'Telefone');
    return {
      nome: campo(b, 'Nome'), empresa: empresas[0] || null, telefone, numero: numeroWhatsapp(telefone), email: campo(b, 'E-?mail'),
      campanha: utmCampanha || linhaCampanha, origem: b.match(/Origem:\s*([^\s,]+)/i)?.[1] || null,
      cadastro_em: cadastro_em && !isNaN(cadastro_em.getTime()) ? cadastro_em : null, segmento, url: urlLinha?.[2] || null,
    };
  });
}

// ── Anti-bloqueio (WhatsApp não oficial) ────────────────────────────────────
export const INTERVALO_MIN = [4, 9] as const; // minutos entre primeiros contatos
export const LIMITE_INICIAL = 15;             // primeiros contatos/dia nas 2 primeiras semanas
export const LIMITE_PADRAO = 30;
export const TENTATIVAS_MAX = 3;
export const DIAS_RETOMADA = [2, 5];         // dias úteis após a última mensagem sem resposta

function partesSP(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(f.find(p => p.type === 'weekday')!.value);
  return { dia, hora: Number(f.find(p => p.type === 'hour')!.value) };
}

/** Seg–sex 8h–18h e sábado 8h–12h (horário de Brasília). */
export function horarioComercial(d: Date): boolean {
  const { dia, hora } = partesSP(d);
  if (dia === 0) return false;
  if (dia === 6) return hora >= 8 && hora < 12;
  return hora >= 8 && hora < 18;
}

// ── "Me chama depois": combinar o próximo dia útil, de manhã ou à tarde ─────
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const diaSP = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

/** Próximo dia útil (seg–sex) depois de hoje, em AAAA-MM-DD (Brasília). */
export function proximoDiaUtil(agora: Date): string {
  const d = new Date(agora.getTime());
  do { d.setTime(d.getTime() + 864e5); } while ([0, 6].includes(new Date(`${diaSP(d)}T12:00:00-03:00`).getDay()));
  return diaSP(d);
}

/** "amanhã (terça-feira)" ou "segunda-feira", como a pessoa falaria. */
export function nomeDoDia(dia: string, agora: Date): string {
  const semana = DIAS_SEMANA[new Date(`${dia}T12:00:00-03:00`).getDay()];
  return dia === diaSP(new Date(agora.getTime() + 864e5)) ? `amanhã (${semana})` : semana;
}

/** Botões: próximo dia útil de manhã / à tarde, ou outro dia. */
export function opcoesAgendamento(agora: Date) {
  const dia = proximoDiaUtil(agora);
  const nome = nomeDoDia(dia, agora).replace(/ \(.*\)/, '').replace('-feira', ''); // botão: máx. 20 letras
  const cap = nome.charAt(0).toUpperCase() + nome.slice(1);
  return {
    dia,
    opcoes: [
      { id: `sdr_ag_manha_${dia}`, texto: `${cap} de manhã`.slice(0, 20) },
      { id: `sdr_ag_tarde_${dia}`, texto: `${cap} à tarde`.slice(0, 20) },
      { id: 'sdr_ag_outro', texto: 'Outro dia' },
    ],
  };
}

/** Clique no agendamento → quando chamar (9h30 de manhã, 14h30 à tarde) ou 'outro'. */
export function lerAgendamento(botaoId: string | null | undefined): { quando: Date; periodo: 'manhã' | 'tarde'; dia: string } | 'outro' | null {
  if (botaoId === 'sdr_ag_outro') return 'outro';
  const m = (botaoId || '').match(/^sdr_ag_(manha|tarde)_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { quando: new Date(`${m[2]}T${m[1] === 'manha' ? '09:30' : '14:30'}:00-03:00`), periodo: m[1] === 'manha' ? 'manhã' : 'tarde', dia: m[2] };
}

// ── Horário da vendedora: seg–sex, 8h30 às 17h (Brasília) ────────────────────
function minutosSP(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(f.find(p => p.type === 'weekday')!.value);
  return { dia, min: Number(f.find(p => p.type === 'hour')!.value) * 60 + Number(f.find(p => p.type === 'minute')!.value) };
}
export function horarioVendedora(d: Date): boolean {
  const { dia, min } = minutosSP(d);
  return dia >= 1 && dia <= 5 && min >= 8 * 60 + 30 && min < 17 * 60;
}
/** Próximo início de expediente da vendedora (8h30 de um dia útil). */
export function proximaJanelaVendedora(d: Date): Date {
  const { dia, min } = minutosSP(d);
  const hoje = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (dia >= 1 && dia <= 5 && min < 8 * 60 + 30) return new Date(`${hoje}T08:30:00-03:00`);
  return new Date(`${proximoDiaUtil(d)}T08:30:00-03:00`);
}

/** Janelas em que o comerciante mais responde: 9h–11h30 e 14h–17h (Brasília). */
export function horaBoaParaRetomar(d: Date): boolean {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const min = Number(f.find(p => p.type === 'hour')!.value) * 60 + Number(f.find(p => p.type === 'minute')!.value);
  return (min >= 9 * 60 && min < 11 * 60 + 30) || (min >= 14 * 60 && min < 17 * 60);
}

/** Limite de primeiros contatos no dia: 15 nas 2 primeiras semanas de uso, depois o configurado (máx. 30). */
export function limiteDoDia(ativadaEm: Date | null, configurado: number, agora: Date): number {
  const teto = Math.max(1, Math.min(LIMITE_PADRAO, configurado || LIMITE_PADRAO));
  if (!ativadaEm || agora.getTime() - ativadaEm.getTime() < 14 * 864e5) return Math.min(LIMITE_INICIAL, teto);
  return teto;
}

export const intervaloSorteado = (rnd = Math.random) => Math.round((INTERVALO_MIN[0] + rnd() * (INTERVALO_MIN[1] - INTERVALO_MIN[0])) * 60_000);

/** "Digitando…" proporcional ao texto: ~40 caracteres/s, entre 2 e 12 s. */
export const tempoDigitando = (texto: string) => Math.max(2000, Math.min(12_000, Math.round(texto.length * 25)));

/** Dias úteis (seg–sex) entre duas datas. */
export function diasUteisEntre(de: Date, ate: Date): number {
  let n = 0;
  const d = new Date(de.getTime());
  while (d < ate) {
    d.setTime(d.getTime() + 864e5);
    const { dia } = partesSP(d);
    if (d <= ate && dia >= 1 && dia <= 5) n++;
  }
  return n;
}

/** Hora de retomar quem não respondeu (tentativas conta a abertura). */
export function deveRetomar(tentativas: number, ultimaCaroline: Date | null, agora: Date): boolean {
  if (!ultimaCaroline || tentativas >= TENTATIVAS_MAX) return false;
  const dias = DIAS_RETOMADA[Math.min(tentativas - 1, DIAS_RETOMADA.length - 1)] ?? DIAS_RETOMADA[0];
  return diasUteisEntre(ultimaCaroline, agora) >= dias;
}

// ── Termômetro ──────────────────────────────────────────────────────────────
export const ACOES = ['continuar', 'oferecer_demo', 'passar_vendedora', 'sem_interesse', 'duvida_fora_material'] as const;
export type AcaoSdr = typeof ACOES[number];
export type RespostaCaroline = {
  mensagens: string[]; acao: AcaoSdr; nota: number; nota_motivo: string; dor_principal: string | null;
  dados: { cidade?: string | null; sistema_atual?: string | null; lojas?: string | null; momento?: string | null; decisor?: string | null };
  duvida?: string | null;
};

/** Faixa do termômetro → temperatura do lead. Sem dor principal a nota fica em no máx. 59. */
export function temperaturaDaNota(nota: number): 'MUITO_QUENTE' | 'QUENTE' | 'MORNO' | 'FRIO' {
  if (nota >= 80) return 'MUITO_QUENTE';
  if (nota >= 60) return 'QUENTE';
  if (nota >= 35) return 'MORNO';
  return 'FRIO';
}

/** Valida a resposta da IA; null se não der para usar com segurança. */
export function lerRespostaCaroline(j: any): RespostaCaroline | null {
  if (!j || typeof j !== 'object') return null;
  const mensagens = (Array.isArray(j.mensagens) ? j.mensagens : [j.mensagem]).map((m: any) => String(m || '').trim()).filter(Boolean).slice(0, 2);
  const acao: AcaoSdr = (ACOES as readonly string[]).includes(j.acao) ? j.acao : 'continuar';
  const dor = typeof j.dor_principal === 'string' && j.dor_principal.trim() ? j.dor_principal.trim().slice(0, 300) : null;
  let nota = Math.round(Math.max(0, Math.min(100, Number(j.nota) || 0)));
  if (!dor) nota = Math.min(nota, 59);
  if (!mensagens.length && acao !== 'sem_interesse') return null;
  // Nada de preço/valores na boca da Caroline.
  if (mensagens.some((m: string) => /R\$\s*\d|\d+\s*(reais|mil reais)|por mês fica|custa\s+\d/i.test(m))) return null;
  const d = j.dados && typeof j.dados === 'object' ? j.dados : {};
  const s = (v: any) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  // Nunca travessão nas mensagens: troca por vírgula (ou nada, no começo da frase).
  const semTravessao = (m: string) => m.replace(/\s*[—–]\s*/g, ', ').replace(/^,\s*/, '').replace(/,\s*([.!?])/g, '$1').replace(/,\s*,/g, ',');
  return {
    mensagens: mensagens.map((m: string) => semTravessao(m).slice(0, 700)), acao, nota, nota_motivo: String(j.nota_motivo || '').slice(0, 300), dor_principal: dor,
    dados: { cidade: s(d.cidade), sistema_atual: s(d.sistema_atual), lojas: s(d.lojas), momento: s(d.momento), decisor: s(d.decisor) },
    duvida: s(j.duvida),
  };
}

export const ABERTURA_JESSICA = (nome: string | null, segmento: string | null) =>
  `Bom dia, ${nome || ''}! Eu sou a Jessica, da Prosystem Sistemas. Recebemos sua inscrição em nossa campanha sobre sistema para ${segmento === 'Padaria' ? 'padarias' : 'farmácias'} e vou iniciar seu atendimento.\n\nPara começar, por favor, me informe de qual cidade você é e qual sistema utiliza atualmente. Pode responder por áudio, mensagem ou foto, como preferir.`.replace(' ,', ',');

export type FaseCaroline = 'abertura' | 'retomada' | 'resposta';

/** Prompt da Caroline. O guia comercial é a ÚNICA fonte sobre o produto. */
// Agentes que conversam pela mesma base: Caroline (SDR), Julio (follow-up de leads) e Luiz Felipe (propostas).
export type PerfilSdr = 'caroline' | 'julio' | 'luiz_felipe';
export const PERFIS_SDR: Record<PerfilSdr, { nome: string; papel: string; assistente: string; publico: string }> = {
  caroline: { nome: 'Caroline', papel: 'SDR', assistente: 'a assistente virtual', publico: 'quem se inscreveu numa campanha' },
  julio: { nome: 'Julio', papel: 'responsável pelo follow-up de quem já falou com a Prosystem', assistente: 'o assistente virtual', publico: 'quem já falou com a Prosystem há um tempo e a conversa parou' },
  luiz_felipe: { nome: 'Luiz Felipe', papel: 'responsável pelo acompanhamento das propostas enviadas', assistente: 'o assistente virtual', publico: 'quem recebeu uma proposta da Prosystem e ainda não assinou' },
};

export function promptCaroline(p: {
  guia: string; instrucoes: string; exemplos: { antes: string; depois: string }[]; historico: string; fase: FaseCaroline;
  atualidades?: { segmento: string; titulo: string; resumo: string; por_que_importa: string }[];
  lead: { nome: string | null; empresa: string | null; segmento: string | null; campanha: string | null; abertura_jessica: boolean; tentativa: number; ja_conversou?: boolean; combinado?: string | null };
  saudacao: string;
  perfil?: PerfilSdr;
  followup?: { cadastro_em?: string | null; proposta?: { plano?: string | null; enviada_em?: string | null; status?: string | null } | null } | null;
}): { sistema: string; usuario: string } {
  const perfil = p.perfil || 'caroline';
  const eu = PERFIS_SDR[perfil];
  const followUp = perfil !== 'caroline';
  const sistema = [
    `Você é ${perfil === 'caroline' ? 'a' : 'o'} ${eu.nome}, ${eu.papel} da Prosystem Sistemas (sistemas de gestão para farmácias, padarias e varejo). Você fala só em seu nome: ${eu.nome}, da equipe Prosystem. Conversa pelo WhatsApp com ${eu.publico}.`,
    followUp ? 'MISSÃO Nº 0 (follow-up): descobrir em que pé o cliente está. Se ainda procura sistema, siga buscando a dor. Se já fechou com outro sistema, pergunte com leveza qual e o que pesou na decisão, agradeça e encerre com a porta aberta (acao "sem_interesse", com o sistema e o motivo em "nota_motivo"). Nunca insista nem critique o concorrente.' : '',
    perfil === 'luiz_felipe' ? 'PROPOSTA: pode lembrar que a proposta foi enviada (plano e link já mandados), perguntar se conseguiu avaliar e se ficou alguma dúvida. NUNCA ofereça novos valores, desconto ou condições: se ele quiser negociar ou fechar, acao "passar_vendedora" (a consultora dele retoma).' : '',
    'MISSÃO Nº 1: descobrir o PROBLEMA PRINCIPAL do cliente hoje (o que mais incomoda, desde quando, quanto custa em tempo/dinheiro, o que já tentou). Não fale de solução nem ofereça demonstração antes de entender a dor, a não ser que o cliente peça.',
    'JEITO DE CONVERSAR: fale pouco e escute muito. No máximo 2 mensagens curtas (1 a 3 frases cada), UMA pergunta por vez, perguntas abertas. Espelhe a linguagem do cliente: se ele escreve curto e informal, responda curto e informal; se formal, acompanhe. Use as palavras dele. Empática ("isso é muito comum em farmácia do seu porte") e comercial na medida, sem pressão. Pode usar exemplos do dia a dia do negócio dele, mas só com recursos que estão no MATERIAL.',
    'NÃO INVENTE NADA: sobre o produto, use SOMENTE o MATERIAL abaixo. Se o cliente perguntar algo que não está no material, diga que vai confirmar com a equipe e já retorna (acao "duvida_fora_material", com a pergunta em "duvida").',
    'BOTÕES: se o cliente tocou "Quero saber mais", agradeça curto e siga investigando a dor; "Me chama depois", pergunte o melhor dia e horário (acao "continuar"); "Agora não", despeça-se com gentileza e porta aberta (acao "sem_interesse").',
    'CNPJ: nunca peça no começo. Só quando a conversa já estiver avançada (dor identificada, ou ao oferecer/marcar a demonstração), de forma natural, ex.: "pra eu já deixar tudo pronto pra sua demonstração, me passa o CNPJ da farmácia?". Se ele já mandou, não peça de novo.',
    'FATOS: nunca atribua ao cliente algo que ele não disse ou fez no histórico (ex.: não diga "você pediu uma demonstração" se ele só tocou em "Quero conhecer"). Na dúvida, pergunte.',
    'NUNCA fale de preço, valores, desconto, condições ou contrato: diga que a consultora apresenta tudo na demonstração.',
    `Se o cliente perguntar sinceramente se é robô ou pessoa, não negue: diga com leveza que é ${eu.assistente} da equipe Prosystem e que, se preferir, alguém da equipe atende pessoalmente.`,
    `Apresente-se como "${eu.nome}, da equipe Prosystem" só na primeira mensagem sua; depois não repita. Nunca diga que fala em nome da Jessica ou de outra pessoa.`, 'NATURALIDADE: escreva como uma pessoa real digitando no WhatsApp: frases curtas, tom de conversa, sem cara de texto pronto, sem listas, sem excesso de exclamação e sem emojis em excesso (no máximo um, e só se combinar). NUNCA use travessão (— ou –); use vírgula ou ponto.',
    'TERMÔMETRO (nota 0-100): dor principal identificada (clara 20, com impacto/custo 35), momento de compra (agora/este mês 25, próximos meses 12, sem pressa 0), fala com quem decide (dono/sócio 15, indica quem decide 8), engajamento até 15, encaixe no perfil até 10. Sem dor principal a nota não passa de 59.',
    'AÇÃO: "continuar" (seguir investigando); "oferecer_demo" quando a nota ≥ 60 e a dor está clara, ou o cliente pedir (escreva uma mensagem curta ligando a dor ao que a demonstração vai mostrar; os horários são enviados depois automaticamente); "passar_vendedora" quando ele tem interesse mas não quer marcar agora (despeça-se dizendo que a consultora vai falar com ele); "sem_interesse" quando ele disser que não quer ou não é o momento (despeça-se com gentileza, porta aberta).',
    'Responda SOMENTE JSON: {"mensagens":["..."],"acao":"continuar|oferecer_demo|passar_vendedora|sem_interesse|duvida_fora_material","nota":0,"nota_motivo":"curto","dor_principal":"ou null","dados":{"cidade":null,"sistema_atual":null,"lojas":null,"momento":null,"decisor":null},"duvida":null}',
    '', '=== MATERIAL (única fonte sobre o produto) ===', p.guia.slice(0, 14000),
    p.exemplos.length ? '\n=== COMO A JESSICA AJUSTOU SUAS MENSAGENS (siga este tom) ===\n' + p.exemplos.map(e => `Você escreveu: ${e.antes}\nEla enviou: ${e.depois}`).join('\n---\n') : '',
    p.atualidades?.length ? '\n=== ASSUNTOS DA SEMANA (pesquisa da Sofia, com fonte; use no máximo UM, só se afetar a GESTÃO do negócio do lead: impostos, obrigações fiscais, regras de venda, custos. Nunca use assunto clínico, de medicamento específico ou de outro segmento. Não invente detalhes além do que está aqui. Hoje é ' + new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ': ignore assunto cujo prazo ou data já passou) ===\n' + p.atualidades.map(a => `- [${a.segmento}] ${a.titulo}: ${a.resumo} (por que importa: ${a.por_que_importa})`).join('\n') : '',
    p.instrucoes || '',
  ].join('\n');
  const l = p.lead;
  const contexto = `Lead: ${l.nome || '—'}${l.empresa ? `, empresa ${l.empresa}` : ''}${l.segmento ? `, segmento ${l.segmento}` : ''}${l.campanha ? `, campanha ${l.campanha}` : ''}. Saudação adequada agora: "${p.saudacao}".`;
  // Ganchos do dia a dia por segmento (só use o que o MATERIAL confirma que resolvemos).
  const diaADia = /padar|confeit/i.test(l.segmento || '')
    ? 'correria da produção e do balcão, balança e etiquetas, perdas e sobras do dia, fechamento de caixa, cadastro de produtos, falta de tempo do dono'
    : 'correria do balcão, SNGPC, Farmácia Popular, cadastro de produtos, controle de estoque e validade, fechamento de caixa, falta de tempo do dono';
  const chamarDeVolta = `Objetivo: trazer o cliente de volta para a conversa, com sutileza. Use um gancho do DIA A DIA da operação dele (${diaADia}), em forma de pergunta leve e fácil de responder, sem notícias, prazos ou impostos. Não pareça cobrança nem venda.`;
  const f = p.followup || {};
  const aberturaFollowUp = perfil === 'luiz_felipe'
    ? `Primeira mensagem sua. Este cliente recebeu uma proposta da Prosystem${f.proposta?.plano ? ` (plano ${f.proposta.plano})` : ''}${f.proposta?.enviada_em ? `, enviada em ${f.proposta.enviada_em}` : ''} e a conversa parou. Apresente-se como Luiz Felipe, da equipe Prosystem, retome com leveza a proposta e pergunte, em UMA pergunta, se ele conseguiu avaliar ou se já resolveu a questão do sistema. Sem cobrar e sem falar de valores.`
    : `Primeira mensagem sua. Este cliente falou com a Prosystem${f.cadastro_em ? ` em ${f.cadastro_em}` : ' há um tempo'} e a conversa parou. Apresente-se como Julio, da equipe Prosystem, retome com leveza e pergunte, em UMA pergunta, como está a rotina ${/padar|confeit/i.test(l.segmento || '') ? 'da padaria' : 'da farmácia'} e se já resolveu a questão do sistema (se continua procurando ou já fechou com outro). Sem cobrar.`;
  const tarefa = p.fase === 'abertura' && followUp
    ? aberturaFollowUp
    : p.fase === 'abertura'
    ? (l.abertura_jessica
      ? `A Jessica já mandou a abertura (está no histórico) e o lead NÃO respondeu. Escreva uma RETOMADA, não um primeiro contato: apresente-se rapidamente como Caroline, da equipe Prosystem, mostre com leveza que percebeu que ele não conseguiu responder (ex.: "imagino que a correria do balcão não deixou"). ${chamarDeVolta} Não repita a mensagem da Jessica nem use "vou dar continuidade".`
      : 'Primeiro contato. Apresente-se como Caroline, da equipe Prosystem, diga que recebeu a inscrição na campanha e faça UMA pergunta aberta para começar (cidade e sistema que usa hoje, ou como está a rotina).')
    : p.fase === 'retomada'
      ? (l.combinado
        ? `Você combinou com o cliente de chamar ${l.combinado === 'true' ? 'agora' : l.combinado}. Cumprimente lembrando o combinado de forma leve (ex.: "como combinamos, passando aqui"), sem se apresentar de novo, e retome com UMA pergunta fácil sobre a rotina ou a dor dele. Tom de quem cumpre o que prometeu, sem pressão.`
        : l.ja_conversou
        ? `O lead já conversou antes e parou de responder (follow-up, tentativa ${l.tentativa + 1} de 3). Escreva UMA mensagem curta e diferente das anteriores, retomando de onde pararam, sem cobrar. Se houver em ASSUNTOS DA SEMANA uma novidade que afete o negócio dele e ainda não foi usada, pode usar como gancho, ligando à dor que ele contou.${l.tentativa + 1 >= 3 ? ' É a última tentativa: deixe a porta aberta.' : ''}`
        : `O lead ainda não respondeu (tentativa ${l.tentativa + 1} de 3). Escreva UMA mensagem curta e diferente das anteriores. ${chamarDeVolta}${l.tentativa + 1 >= 3 ? ' É a última tentativa: deixe a porta aberta com gentileza.' : ''}`)
      : 'Responda à(s) última(s) mensagem(ns) do cliente.';
  return { sistema, usuario: `${contexto}\n\nHistórico (mais recente por último):\n${p.historico || '(sem mensagens ainda)'}\n\n${tarefa}` };
}

export const saudacaoAgora = (d: Date) => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(d));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
