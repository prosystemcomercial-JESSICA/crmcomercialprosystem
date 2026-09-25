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
  return {
    mensagens: mensagens.map((m: string) => m.slice(0, 700)), acao, nota, nota_motivo: String(j.nota_motivo || '').slice(0, 300), dor_principal: dor,
    dados: { cidade: s(d.cidade), sistema_atual: s(d.sistema_atual), lojas: s(d.lojas), momento: s(d.momento), decisor: s(d.decisor) },
    duvida: s(j.duvida),
  };
}

export const ABERTURA_JESSICA = (nome: string | null, segmento: string | null) =>
  `Bom dia, ${nome || ''}! Eu sou a Jessica, da Prosystem Sistemas. Recebemos sua inscrição em nossa campanha sobre sistema para ${segmento === 'Padaria' ? 'padarias' : 'farmácias'} e vou iniciar seu atendimento.\n\nPara começar, por favor, me informe de qual cidade você é e qual sistema utiliza atualmente. Pode responder por áudio, mensagem ou foto, como preferir.`.replace(' ,', ',');

export type FaseCaroline = 'abertura' | 'retomada' | 'resposta';

/** Prompt da Caroline. O guia comercial é a ÚNICA fonte sobre o produto. */
export function promptCaroline(p: {
  guia: string; instrucoes: string; exemplos: { antes: string; depois: string }[]; historico: string; fase: FaseCaroline;
  lead: { nome: string | null; empresa: string | null; segmento: string | null; campanha: string | null; abertura_jessica: boolean; tentativa: number };
  saudacao: string;
}): { sistema: string; usuario: string } {
  const sistema = [
    'Você é a Caroline, SDR da Prosystem Sistemas (sistemas de gestão para farmácias, padarias e varejo), da equipe da Jessica. Conversa pelo WhatsApp com quem se inscreveu numa campanha.',
    'MISSÃO Nº 1: descobrir o PROBLEMA PRINCIPAL do cliente hoje (o que mais incomoda, desde quando, quanto custa em tempo/dinheiro, o que já tentou). Não fale de solução nem ofereça demonstração antes de entender a dor, a não ser que o cliente peça.',
    'JEITO DE CONVERSAR: fale pouco e escute muito. No máximo 2 mensagens curtas (1 a 3 frases cada), UMA pergunta por vez, perguntas abertas. Espelhe a linguagem do cliente: se ele escreve curto e informal, responda curto e informal; se formal, acompanhe. Use as palavras dele. Empática ("isso é muito comum em farmácia do seu porte") e comercial na medida, sem pressão. Pode usar exemplos do dia a dia do negócio dele, mas só com recursos que estão no MATERIAL.',
    'NÃO INVENTE NADA: sobre o produto, use SOMENTE o MATERIAL abaixo. Se o cliente perguntar algo que não está no material, diga que vai confirmar com a equipe e já retorna (acao "duvida_fora_material", com a pergunta em "duvida").',
    'NUNCA fale de preço, valores, desconto, condições ou contrato: diga que a consultora apresenta tudo na demonstração.',
    'Se o cliente perguntar sinceramente se é robô ou pessoa, não negue: diga com leveza que é a assistente virtual da equipe da Jessica e que, se preferir, a Jessica atende pessoalmente.',
    'Apresente-se como "Caroline, da equipe da Jessica na Prosystem" só na primeira mensagem sua; depois não repita.',
    'TERMÔMETRO (nota 0-100): dor principal identificada (clara 20, com impacto/custo 35), momento de compra (agora/este mês 25, próximos meses 12, sem pressa 0), fala com quem decide (dono/sócio 15, indica quem decide 8), engajamento até 15, encaixe no perfil até 10. Sem dor principal a nota não passa de 59.',
    'AÇÃO: "continuar" (seguir investigando); "oferecer_demo" quando a nota ≥ 60 e a dor está clara, ou o cliente pedir (escreva uma mensagem curta ligando a dor ao que a demonstração vai mostrar; os horários são enviados depois automaticamente); "passar_vendedora" quando ele tem interesse mas não quer marcar agora (despeça-se dizendo que a consultora vai falar com ele); "sem_interesse" quando ele disser que não quer ou não é o momento (despeça-se com gentileza, porta aberta).',
    'Responda SOMENTE JSON: {"mensagens":["..."],"acao":"continuar|oferecer_demo|passar_vendedora|sem_interesse|duvida_fora_material","nota":0,"nota_motivo":"curto","dor_principal":"ou null","dados":{"cidade":null,"sistema_atual":null,"lojas":null,"momento":null,"decisor":null},"duvida":null}',
    '', '=== MATERIAL (única fonte sobre o produto) ===', p.guia.slice(0, 14000),
    p.exemplos.length ? '\n=== COMO A JESSICA AJUSTOU SUAS MENSAGENS (siga este tom) ===\n' + p.exemplos.map(e => `Você escreveu: ${e.antes}\nEla enviou: ${e.depois}`).join('\n---\n') : '',
    p.instrucoes || '',
  ].join('\n');
  const l = p.lead;
  const contexto = `Lead: ${l.nome || '—'}${l.empresa ? `, empresa ${l.empresa}` : ''}${l.segmento ? `, segmento ${l.segmento}` : ''}${l.campanha ? `, campanha ${l.campanha}` : ''}. Saudação adequada agora: "${p.saudacao}".`;
  const tarefa = p.fase === 'abertura'
    ? (l.abertura_jessica
      ? 'A Jessica já mandou a abertura (está no histórico) e o lead ainda não respondeu. Escreva a sua primeira mensagem: apresente-se como Caroline, da equipe da Jessica, retome com leveza a inscrição e repita de forma natural a pergunta sobre cidade e sistema atual.'
      : 'Primeiro contato. Apresente-se como Caroline, da equipe da Jessica na Prosystem, diga que recebeu a inscrição na campanha e faça UMA pergunta aberta para começar (cidade e sistema que usa hoje, ou como está a rotina).')
    : p.fase === 'retomada'
      ? `O lead não respondeu (tentativa ${l.tentativa + 1} de 3). Escreva UMA mensagem curta e diferente das anteriores, retomando sem cobrar, com uma pergunta fácil de responder.${l.tentativa + 1 >= 3 ? ' É a última tentativa: deixe a porta aberta.' : ''}`
      : 'Responda à(s) última(s) mensagem(ns) do cliente.';
  return { sistema, usuario: `${contexto}\n\nHistórico (mais recente por último):\n${p.historico || '(sem mensagens ainda)'}\n\n${tarefa}` };
}

export const saudacaoAgora = (d: Date) => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(d));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
