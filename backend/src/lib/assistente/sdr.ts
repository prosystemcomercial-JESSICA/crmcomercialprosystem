// Caroline, a SDR: leitura dos leads colados da plataforma de campanhas, regras
// anti-bloqueio da fila, termômetro de interesse e o prompt da conversa. Puro.

import { numeroWhatsapp } from './campanhas';
import { instrucaoDescontoAutorizado, type CondicaoAutorizada } from './negociacao';

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
export const ACOES = ['continuar', 'oferecer_demo', 'passar_vendedora', 'sem_interesse', 'duvida_fora_material', 'encaminhar_suporte', 'aceitar_condicao', 'recusou'] as const;

/** Texto padrão quando o cliente pede vídeos/treinamento/suporte: isso é do setor de suporte, o agente é do comercial. */
export const mensagemSuporte = (agente: string) =>
  `O envio de vídeos, treinamentos e o suporte técnico são feitos pelo nosso *setor de suporte*. Eu sou ${/^(caroline|clarice|helena|laya|marta|sofia|lurdinha|bia)/i.test(agente) ? 'a' : 'o'} ${agente}, do *setor comercial*. 😊\n\nToque no botão abaixo para falar direto com o suporte, eles vão te ajudar!`;
export type AcaoSdr = typeof ACOES[number];
export type RespostaCaroline = {
  mensagens: string[]; acao: AcaoSdr; nota: number; nota_motivo: string; dor_principal: string | null;
  dados: { cidade?: string | null; sistema_atual?: string | null; lojas?: string | null; momento?: string | null; decisor?: string | null };
  duvida?: string | null;
  motivo_perda?: MotivoPerda | null;
  revisar_proposta?: boolean;
  adiar_dias?: number | null;
  /** Retorno combinado com dia e hora exatos (vai para a agenda do agente). */
  retomar_em?: Date | null;
  /** Cliente quer a reunião a partir desta data (ex.: "semana que vem" = próxima segunda). */
  demo_a_partir?: Date | null;
};

// "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM" no horário de Brasília; só datas futuras (até 90 dias).
function lerDataSP(v: unknown, horaPadrao = '09:30'): Date | null {
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2] || horaPadrao}:00-03:00`);
  const agora = Date.now();
  return Number.isFinite(d.getTime()) && d.getTime() > agora && d.getTime() < agora + 90 * 864e5 ? d : null;
}

/** O cliente adiou a conversa (viagem, "quando voltar eu chamo", "agora não posso", "semana que vem"...). */
export function ehAdiamento(texto: string | null | undefined): boolean {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /(viagem|viajando|viajei|de ferias|ferias|quando (eu )?voltar|assim q(ue)? (eu )?(voltar|puder)|depois (eu )?(te )?(chamo|falo|entro em contato|retorno|vejo)|eu (te )?(chamo|procuro|retorno|entro em contato)|entro em contato|agora nao (posso|da|consigo)|nao posso (agora|falar)|estou ocupad|to ocupad|ocupad[oa] agora|semana que vem|mes que vem|outro momento|mais pra frente|mais para frente|no momento nao|fim do mes|depois do feriado)/.test(t);
}

/**
 * Compromisso de horário na fala do agente ("falo com o Paulo às 13h", "te chamo amanhã às 10h30").
 * Hoje se a hora ainda não passou; senão (ou com "amanhã"), no dia seguinte. null = sem horário.
 */
export function compromissoDeHorario(texto: string, agora = new Date()): Date | null {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Só promessa de contato futuro ("vou falar", "te chamo", "ligo", "retorno"...), não uma menção ao horário.
  if (!/\b(vou|vamos|irei|falo|falarei|te chamo|chamo (voce|ele|ela)|ligo|ligarei|retorno|retornarei|volto a (falar|chamar)|entro em contato|tento falar)\b/.test(t)) return null;
  const m = t.match(/\b(?:as|a partir das)\s+(\d{1,2})(?:[h:](\d{2})?|\s*horas?)\b/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] || 0);
  if (h < 7 || h > 20 || min > 59) return null;
  const dia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const hhmm = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  let alvo = new Date(`${dia(agora)}T${hhmm}:00-03:00`);
  if (/\bamanha\b/.test(t) || alvo.getTime() <= agora.getTime()) alvo = new Date(`${dia(new Date(agora.getTime() + 864e5))}T${hhmm}:00-03:00`);
  return alvo;
}

/** Mensagem automática da loja ("em breve iremos lhe atender"): não é resposta de uma pessoa. */
export function ehRespostaAutomatica(texto: string | null | undefined): boolean {
  const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /(em breve (iremos|vamos|retornaremos|lhe|te|responderemos)|mensagem automatica|resposta automatica|seja bem[- ]vind[oa]|obrigad[oa] por entrar em contato|no momento (nao|estamos)|nosso horario de atendimento|fora do horario|assim que possivel (retornaremos|responderemos)|aguarde|em instantes|sera atendid|sera respondid|em breve|obrigad[oa] pel[ao] (sua )?(mensagem|contato)|recebemos sua mensagem|horario de funcionamento|envie (sua|seu|a lista|o pedido)|lista de itens|atendente (ja )?(vai|ira))/.test(t);
}

/** Cliente só confirmou/agradeceu ("👍", "ok", "obrigado", "blz"): não pede resposta do agente. */
export function ehSoConfirmacao(texto: string | null | undefined): boolean {
  const t = (texto || '').trim().toLowerCase();
  if (!t) return false;
  const semEmoji = t.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, '').trim();
  if (!semEmoji) return true; // só emoji (👍, 🙏, 😊…)
  return /^(ok|okay|okk+|blz|beleza|obrigad[oa]s?|obg|valeu|vlw|show|certo|combinado|t[aá]|ta bom|tá bom|perfeito|entendi|beleza então|ok obrigad[oa]|tmj|top|joia|jóia|👍)[\s!.,]*$/i.test(semEmoji);
}

/** Semelhança entre dois textos (0 a 1, bigramas): trava contra o agente repetir a mesma mensagem. */
export function semelhanca(a: string, b: string): number {
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const bg = (s: string) => { const x = new Set<string>(); for (let i = 0; i < s.length - 1; i++) x.add(s.slice(i, i + 2)); return x; };
  const A = bg(n(a)), B = bg(n(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(g => { if (B.has(g)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

/** Oferta de campanha/revisão de proposta só do dia 20 ao último dia do mês (Brasília). */
export function janelaCampanhaAtiva(d: Date): boolean {
  return Number(d.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', day: 'numeric' })) >= 20;
}

// Mesmas chaves do motivo da perda no funil (MOTIVOS_PERDA do frontend / relatório comercial).
// Faixa de mensalidade que os agentes podem informar quando o cliente pergunta o valor (orientação da Jessica).
export const FAIXA_MENSALIDADE = 'de R$ 350,00 a R$ 400,00 por mês, dependendo do plano (R$ 400,00 é o plano mais completo), mais o valor da instalação';
export const RECURSOS_PLANO_COMPLETO = 'PDV e vendas, controle de estoque, compras, financeiro, dashboard com visão gerencial, rentabilidade, indicador de perda de vendas, curva ABC de produtos com reprocessamento, análises gerenciais avançadas, integração com leitor biométrico para mais segurança, mensageria de WhatsApp para a rotina interna da loja (não é canal com o cliente), suporte ativo e treinamento por 5 meses';

export const MOTIVOS_PERDA = ['PRECO', 'JA_TEM_FORNECEDOR', 'SEM_ORCAMENTO', 'TIMING', 'SEM_INTERESSE', 'FUNCIONALIDADE_AUSENTE', 'OUTRO'] as const;
export type MotivoPerda = typeof MOTIVOS_PERDA[number];
export const INSTAGRAM_PROSYSTEM = 'https://instagram.com/prosystemoficial';
export const CONVITE_INSTAGRAM = `Para ficar por dentro das novidades da Prosystem, acompanhe a gente no Instagram: ${INSTAGRAM_PROSYSTEM} 😊`;

/** Faixa do termômetro → temperatura do lead. Sem dor principal a nota fica em no máx. 59. */
export function temperaturaDaNota(nota: number): 'MUITO_QUENTE' | 'QUENTE' | 'MORNO' | 'FRIO' {
  if (nota >= 80) return 'MUITO_QUENTE';
  if (nota >= 60) return 'QUENTE';
  if (nota >= 35) return 'MORNO';
  return 'FRIO';
}

/** Valida a resposta da IA; null se não der para usar com segurança. */
export function lerRespostaCaroline(j: any, valoresPermitidos: string[] = []): RespostaCaroline | null {
  if (!j || typeof j !== 'object') return null;
  const mensagens = (Array.isArray(j.mensagens) ? j.mensagens : [j.mensagem]).map((m: any) => String(m || '').trim()).filter(Boolean).slice(0, 2);
  const acao: AcaoSdr = (ACOES as readonly string[]).includes(j.acao) ? j.acao : 'continuar';
  const dor = typeof j.dor_principal === 'string' && j.dor_principal.trim() ? j.dor_principal.trim().slice(0, 300) : null;
  let nota = Math.round(Math.max(0, Math.min(100, Number(j.nota) || 0)));
  if (!dor) nota = Math.min(nota, 59);
  if (!mensagens.length && acao !== 'sem_interesse' && acao !== 'encaminhar_suporte') return null;
  // Valores: só a faixa oficial de mensalidade (FAIXA_MENSALIDADE); qualquer outro valor derruba a resposta.
  // Também liberados: os valores da própria proposta do cliente (resumo da proposta).
  const semFaixa = (m: string) => valoresPermitidos.reduce((t, v) => t.split(v).join(''), m).replace(/R\$\s*(350|400)(,00)?\b/g, '');
  if (mensagens.some((m: string) => /R\$\s*\d|\d+\s*(reais|mil reais)|por mês fica|custa\s+\d/i.test(semFaixa(m)))) return null;
  const d = j.dados && typeof j.dados === 'object' ? j.dados : {};
  const s = (v: any) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  // Nunca travessão nas mensagens: troca por vírgula (ou nada, no começo da frase).
  const semTravessao = (m: string) => m.replace(/\s*[—–]\s*/g, ', ').replace(/^,\s*/, '').replace(/,\s*([.!?])/g, '$1').replace(/,\s*,/g, ',');
  return {
    mensagens: mensagens.map((m: string) => semTravessao(m).slice(0, 700)), acao, nota, nota_motivo: String(j.nota_motivo || '').slice(0, 300), dor_principal: dor,
    dados: { cidade: s(d.cidade), sistema_atual: s(d.sistema_atual), lojas: s(d.lojas), momento: s(d.momento), decisor: s(d.decisor) },
    duvida: s(j.duvida),
    revisar_proposta: j.revisar_proposta === true,
    adiar_dias: Number.isFinite(Number(j.adiar_dias)) && Number(j.adiar_dias) > 0 ? Math.min(60, Math.round(Number(j.adiar_dias))) : null,
    retomar_em: lerDataSP(j.retomar_em),
    demo_a_partir: lerDataSP(j.demo_a_partir, '00:00'),
    motivo_perda: acao === 'sem_interesse' || acao === 'recusou' ? ((MOTIVOS_PERDA as readonly string[]).includes(j.motivo_perda) ? j.motivo_perda : 'SEM_INTERESSE') : null,
  };
}

export const ABERTURA_JESSICA = (nome: string | null, segmento: string | null) =>
  `Bom dia, ${nome || ''}! Eu sou a Jessica, da Prosystem Sistemas. Recebemos sua inscrição em nossa campanha sobre sistema para ${segmento === 'Padaria' ? 'padarias' : 'farmácias'} e vou iniciar seu atendimento.\n\nPara começar, por favor, me informe de qual cidade você é e qual sistema utiliza atualmente. Pode responder por áudio, mensagem ou foto, como preferir.`.replace(' ,', ',');

export type FaseCaroline = 'abertura' | 'retomada' | 'resposta' | 'encerramento';

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
  aprendizado?: { cliente: string; equipe: string }[];
  atualidades?: { segmento: string; titulo: string; resumo: string; por_que_importa: string }[];
  lead: { nome: string | null; empresa: string | null; segmento: string | null; campanha: string | null; abertura_jessica: boolean; tentativa: number; ja_conversou?: boolean; combinado?: string | null;
    /** Encontrado pelo Heitor no Google Maps: o cliente NÃO procurou a Prosystem (primeiro contato ativo). */
    prospeccao?: { cidade: string | null; bairro: string | null } | null;
    /** Proposta recusada: o Luiz Felipe está entendendo o motivo e tentando recuperar (conversa natural). */
    recuperacao?: { motivo_informado?: string | null; pergunta_feita?: boolean } | null };
  saudacao: string;
  perfil?: PerfilSdr;
  janelaCampanha?: boolean;
  descontoAutorizado?: CondicaoAutorizada | null;
  followup?: { cadastro_em?: string | null; proposta?: { plano?: string | null; enviada_em?: string | null; status?: string | null; resumo?: string | null } | null } | null;
}): { sistema: string; usuario: string } {
  const perfil = p.perfil || 'caroline';
  const eu = PERFIS_SDR[perfil];
  const followUp = perfil !== 'caroline';
  const sistema = [
    `Você é ${perfil === 'caroline' ? 'a' : 'o'} ${eu.nome}, ${eu.papel} da Prosystem Sistemas (sistemas de gestão para farmácias, padarias e varejo). Você fala só em seu nome: ${eu.nome}, da equipe Prosystem. Conversa pelo WhatsApp com ${eu.publico}.`,
    followUp ? 'MISSÃO Nº 0 (follow-up): descobrir em que pé o cliente está. Se ainda procura sistema, siga buscando a dor. Se já fechou com outro sistema ou desistiu, agradeça e encerre NESSA mensagem com a porta aberta (acao "sem_interesse", motivo em "motivo_perda" e o que ele disse em "nota_motivo"; se ele citou o sistema, ponha em dados.sistema_atual). Não faça pergunta nessa despedida. Não mande link do Instagram: o sistema manda depois. Nunca insista nem critique o concorrente.' : '',
    perfil === 'luiz_felipe' && !p.lead.recuperacao ? 'PROPOSTA RECUSADA (primeira vez que o cliente diz não à proposta, por qualquer motivo): NÃO se despeça e NÃO encerre. Acolha a decisão sem contestar e faça UMA pergunta aberta, natural e curta, sobre o que mais pesou (ex.: "entendo, sem problema! só pra eu entender aqui: o que mais pesou na decisão?"). Sem lista de opções, sem pressão. Se ele já disse o motivo, não pergunte de novo: acolha e pergunte de leve sobre esse motivo. Use acao "recusou" (preencha "motivo_perda" se já souber).' : '',
    p.lead.recuperacao ? `RECUPERAÇÃO DA PROPOSTA (o cliente recusou e você está entendendo o motivo; escreva como uma pessoa da equipe, sem botões, sem texto pronto${p.lead.recuperacao.motivo_informado ? `; a vendedora registrou como motivo: ${p.lead.recuperacao.motivo_informado}` : ''}): ${p.lead.recuperacao.pergunta_feita ? 'você JÁ perguntou o motivo, não pergunte de novo.' : 'comece acolhendo a decisão e fazendo UMA pergunta aberta sobre o que pesou (acao "continuar").'} Conforme o motivo: PREÇO ou orçamento, diga que vai ver o que consegue fazer e marque "revisar_proposta": true (passa pela autorização da Jessica); MOMENTO, peça uma previsão de data e combine dia e hora ("retomar_em"); RECURSO que faltou, responda pelo MATERIAL (se não cobrir, acao "duvida_fora_material"); JÁ FECHOU COM OUTRO, pergunte de leve UMA vez o que fez escolher o outro (dados.sistema_atual) e depois agradeça e encerre com a porta aberta (acao "sem_interesse"); SEM INTERESSE, agradeça e encerre com a porta aberta (acao "sem_interesse"). Nunca insista, nunca critique o concorrente, nunca ofereça desconto por conta própria.` : '',
    perfil === 'luiz_felipe' ? 'PROPOSTA: pode lembrar que a proposta foi enviada (plano e link já mandados), perguntar se conseguiu avaliar e se ficou alguma dúvida. Seja comercial: seu papel é FECHAR a proposta, conduzindo para a decisão com segurança e sem pressão, sem passar a bola à toa. ' +
      (p.descontoAutorizado ? '' : 'Sem desconto autorizado: NUNCA ofereça valores, desconto ou condições por conta própria; se ele quiser negociar preço, acao "passar_vendedora".') : '',
    perfil === 'luiz_felipe' && p.descontoAutorizado ? instrucaoDescontoAutorizado(p.descontoAutorizado) : '',
    perfil === 'luiz_felipe' ? 'PEDIU MAIS PRAZO: nunca saia só agradecendo. Peça uma previsão de forma leve ("sem problema! pra quando você acha que consegue decidir? assim já te chamo nesse dia") (acao "continuar"). Quando ele der a data, confirme que chama nesse dia e deixe a porta aberta para a próxima conversa.' : '',
    perfil === 'luiz_felipe' && p.janelaCampanha ? 'CAMPANHA (vale só do dia 20 ao fim do mês, e hoje está valendo): quando o cliente pedir prazo ou hesitar, diga também, junto com o pedido de previsão, que temos uma campanha ativa por poucos dias e que, se ele quiser, podemos revisar a proposta. Nessa mensagem marque "revisar_proposta": true (ela passa pela autorização da Jessica antes de sair). Sem valores nem descontos.' : 'Não fale de campanha ativa nem ofereça revisar a proposta.',
    perfil === 'julio'
      ? 'MISSÃO DO JULIO (follow-up de lead antigo): 1) descobrir se AINDA FAZ SENTIDO: o lead ainda procura sistema ou já resolveu? (pergunta curta e direta, com o contexto da conversa anterior). 2) Se quem responde NÃO é o decisor (atendente, balconista, mensagem automática), o objetivo é CHEGAR AO DECISOR: peça orientação com educação (quem cuida da parte de sistema/gestão, nome e WhatsApp do dono ou do gerente, melhor horário para falar com ele). 3) Se ainda faz sentido e mostrar interesse, diga que a consultora vai mostrar como funciona e use acao "oferecer_demo". NUNCA pergunte de forma genérica pelo "maior problema" ou pela "rotina" sem contexto: você não está prospectando dor, está retomando um contato.'
      : 'MISSÃO Nº 1: descobrir o PROBLEMA PRINCIPAL do cliente hoje, com POUCAS perguntas. Assim que ele disser qual é o problema (mesmo numa palavra, ex.: "demora", "estoque", "fila"), PARE de investigar: mostre em 1 ou 2 frases como a Prosystem resolve isso, usando SOMENTE recursos do MATERIAL (ex.: demora no atendimento → o que o material diz sobre agilidade no caixa/balcão), e já convide para a demonstração (acao "oferecer_demo"). No máximo 2 perguntas de investigação na conversa inteira; nunca repita nem reformule uma pergunta que ele já respondeu.',
    'PERGUNTA DIRETA: vá direto ao ponto, com palavras simples: "Qual é o maior problema que você quer resolver hoje na farmácia?" e diga que, se for mais fácil, pode explicar por áudio, assim a gente já vê se tem a solução pra ela. Nada de rodeio nem palavra difícil.',
    'DIA A DIA DA FARMÁCIA (use de forma natural, como quem conhece o balcão, 1 exemplo por vez, só para ajudar o cliente a reconhecer o próprio problema; nunca como lista nem aula): fila e demora no caixa em horário de pico; estoque furado (produto que acaba sem aviso, remédio vencendo na prateleira, compra no escuro); controle de medicamentos controlados e receitas (SNGPC); convênios, PBMs e Farmácia Popular dando trabalho para lançar e conferir; fiado/crediário e contas a receber sem controle; margem apertada e preço difícil de acompanhar; cliente de uso contínuo que não volta porque ninguém lembra de chamar; fechamento de caixa que não bate; nota fiscal e impostos. A SOLUÇÃO para qualquer um deles só pode vir do MATERIAL; se o material não cobrir, não prometa.',
    `HOJE: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}, agora são ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} (datas em AAAA-MM-DD, horário de Brasília). Se um horário combinado já passou, não diga que está chegando nele; retome com naturalidade.`,
    'PEDIU OU ACEITOU REUNIÃO/DEMONSTRAÇÃO (inclusive para depois, ex.: "semana que vem pode agendar uma reunião?"): NUNCA responda "retomamos depois" nem deixe para marcar mais tarde. Use acao "oferecer_demo" NESTA resposta: o sistema manda na hora a lista com os horários livres da nossa agenda, em vários dias, e o horário escolhido entra na agenda. Em "demo_a_partir" ponha a data (AAAA-MM-DD) a partir da qual ele quer (semana que vem = próxima segunda); se for o quanto antes, null. Sua mensagem: curta, confirmando e avisando que já vai mandar as opções de horário para ele escolher.',
    'COMPROMISSO DE HORÁRIO: sempre que você disser que vai falar com alguém num horário (ex.: o decisor não está e disseram "13h"; "te chamo amanhã às 10h"), preencha "retomar_em" com esse dia e hora exatos (AAAA-MM-DDTHH:MM). Se o decisor não está, pergunte o melhor horário para falar com ele e, quando disserem, confirme e registre. Nunca prometa um horário sem registrar.',
    'CLIENTE ADIOU (está viajando, "quando voltar eu te chamo", "depois te procuro", "mês que vem"): nunca termine sem DIA E HORA combinados. Se ele não disse quando, ofereça 3 opções concretas de dia e período dentro do horário comercial (seg a sex, 9h às 12h e 14h às 17h), ex.: "fica melhor quinta de manhã, sexta à tarde ou segunda de manhã?". Quando ele escolher (ou já tiver dito dia e hora), confirme curto repetindo o dia e o horário e preencha "retomar_em" (AAAA-MM-DDTHH:MM): você volta a falar com ele exatamente nesse momento. Só se ele recusar marcar dia, preencha "adiar_dias" (se não souber, 7). Depois disso você NÃO manda mais nada até lá.',
    'NUNCA SEJA REPETITIVO: não repita o que você já disse nas mensagens anteriores (mesma ideia, mesma frase, mesmo convite). Se não houver nada novo e útil a dizer, não escreva.',
    'CLIENTE DE RESPOSTA CURTA ("nada", "isso", "demora"): é sinal de pouca paciência. Não faça mais perguntas abertas: traga a solução do MATERIAL para o que ele falou e ofereça a demonstração.',
    'JEITO DE CONVERSAR: fale pouco e seja objetiva. No máximo 2 mensagens curtas (1 a 3 frases cada), no máximo UMA pergunta por vez, e nem toda mensagem precisa de pergunta. Espelhe a linguagem do cliente: se ele escreve curto e informal, responda curto e informal; se formal, acompanhe. Use as palavras dele. Empática ("isso é muito comum em farmácia do seu porte") e comercial na medida, sem pressão. Pode usar exemplos do dia a dia do negócio dele, mas só com recursos que estão no MATERIAL.',
    'NÃO INVENTE NADA: sobre o produto, use SOMENTE o MATERIAL abaixo. DÚVIDA DO CLIENTE: (1) procure a resposta no MATERIAL e responda com o que está lá; (2) se não entendeu bem o que ele quer saber, PERGUNTE MAIS ao cliente para entender (acao "continuar"); (3) só se o material realmente não cobrir o assunto, diga que vai confirmar com a equipe e já retorna (acao "duvida_fora_material", com a pergunta em "duvida").',
    'VÍDEOS E SUPORTE: se o cliente pedir vídeos (tutoriais, treinamento, "como usar"), ajuda técnica ou suporte do sistema, isso é do SETOR DE SUPORTE, não do comercial: use acao "encaminhar_suporte" com "mensagens": [] (o sistema manda o texto padrão dizendo que você é do setor comercial, com o botão do suporte). Não prometa enviar vídeos.',
    'BOTÕES: se o cliente tocou "Quero saber mais", agradeça curto e siga investigando a dor; "Me chama depois", pergunte o melhor dia e horário (acao "continuar"); "Agora não", despeça-se com gentileza e porta aberta (acao "sem_interesse").',
    'CNPJ: nunca peça no começo. Só quando a conversa já estiver avançada (dor identificada, ou ao oferecer/marcar a demonstração), de forma natural, ex.: "pra eu já deixar tudo pronto pra sua demonstração, me passa o CNPJ da farmácia?". Se ele já mandou, não peça de novo.',
    'FATOS: nunca atribua ao cliente algo que ele não disse ou fez no histórico (ex.: não diga "você pediu uma demonstração" se ele só tocou em "Quero conhecer"). Na dúvida, pergunte.',
    `PREÇO: se o cliente perguntar o valor/mensalidade, responda com a faixa: ${FAIXA_MENSALIDADE}. Não fale nenhum outro valor. Logo depois, em OUTRA mensagem, apresente o plano completo com uma introdução curta e natural, começando com "Para você entender, hoje nosso plano completo oferece" e citando: ${RECURSOS_PLANO_COMPLETO}. Em seguida, conduza para a proposta personalizada ou a demonstração. NUNCA fale de desconto, condições, parcelamento ou contrato por conta própria: isso é com a consultora.`,
    `Se o cliente perguntar sinceramente se é robô ou pessoa, não negue: diga com leveza que é ${eu.assistente} da equipe Prosystem e que, se preferir, alguém da equipe atende pessoalmente.`,
    `Apresente-se como "${eu.nome}, da equipe Prosystem" só na primeira mensagem sua; depois não repita. Nunca diga que fala em nome da Jessica ou de outra pessoa.`, 'NOME: só chame o cliente pelo nome que está em "Lead:". Se o histórico mostrar que a pessoa com quem falamos tem outro nome, use o do histórico. Na dúvida, cumprimente sem nome (errar o nome estraga a conversa).','NATURALIDADE: escreva como uma pessoa real digitando no WhatsApp: frases curtas, tom de conversa, sem cara de texto pronto, sem listas, sem excesso de exclamação e sem emojis em excesso (no máximo um, e só se combinar). NUNCA use travessão (— ou –); use vírgula ou ponto.',
    'TERMÔMETRO (nota 0-100): dor principal identificada (clara 20, com impacto/custo 35), momento de compra (agora/este mês 25, próximos meses 12, sem pressa 0), fala com quem decide (dono/sócio 15, indica quem decide 8), engajamento até 15, encaixe no perfil até 10. Sem dor principal a nota não passa de 59.',
    'AÇÃO: "continuar" (seguir investigando); "oferecer_demo" assim que a dor foi dita (mesmo curta) e você já mostrou como o MATERIAL resolve, ou quando a nota ≥ 60, ou o cliente pedir (escreva uma mensagem curta ligando a dor ao que a demonstração vai mostrar; os horários são enviados depois automaticamente); "passar_vendedora" quando ele tem interesse mas não quer marcar agora (despeça-se dizendo que a consultora vai falar com ele); "sem_interesse" quando ele disser que não quer ou não é o momento (inclusive "já resolvi", "já resolvemos", "já temos sistema", "já fechamos": isso significa que ele não tem mais interesse; use motivo_perda JA_TEM_FORNECEDOR e ele passa só a receber o Informativo Prosystem) (despeça-se com gentileza, porta aberta).',
    'Responda SOMENTE JSON: {"mensagens":["..."],"acao":"continuar|oferecer_demo|passar_vendedora|sem_interesse|duvida_fora_material|encaminhar_suporte|aceitar_condicao|recusou","nota":0,"nota_motivo":"curto","dor_principal":"ou null","dados":{"cidade":null,"sistema_atual":null,"lojas":null,"momento":null,"decisor":null},"duvida":null,"revisar_proposta":false,"adiar_dias":null,"retomar_em":"AAAA-MM-DDTHH:MM ou null","demo_a_partir":"AAAA-MM-DD ou null","motivo_perda":"só quando acao=sem_interesse: PRECO|JA_TEM_FORNECEDOR|SEM_ORCAMENTO|TIMING|SEM_INTERESSE|FUNCIONALIDADE_AUSENTE|OUTRO (JA_TEM_FORNECEDOR = já fechou/segue com outro sistema)"}',
    '', '=== MATERIAL (única fonte sobre o produto) ===', p.guia.slice(0, 14000),
    p.aprendizado?.length ? '\n=== COMO A EQUIPE RESPONDE QUANDO ASSUME A CONVERSA (aprenda o jeito, a abordagem e os argumentos; faça igual ou MELHOR, sem copiar palavra por palavra; nunca repita dados de outro cliente) ===\n' + p.aprendizado.map(a => `Cliente: ${a.cliente}\nEquipe: ${a.equipe}`).join('\n---\n') : '',
    p.exemplos.length ? '\n=== COMO A JESSICA AJUSTOU SUAS MENSAGENS (siga este tom) ===\n' + p.exemplos.map(e => `Você escreveu: ${e.antes}\nEla enviou: ${e.depois}`).join('\n---\n') : '',
    p.atualidades?.length ? '\n=== ASSUNTOS DA SEMANA (pesquisa da Sofia, com fonte; use no máximo UM, só se afetar a GESTÃO do negócio do lead: impostos, obrigações fiscais, regras de venda, custos. Nunca use assunto clínico, de medicamento específico ou de outro segmento. Não invente detalhes além do que está aqui. Hoje é ' + new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ': ignore assunto cujo prazo ou data já passou) ===\n' + p.atualidades.map(a => `- [${a.segmento}] ${a.titulo}: ${a.resumo} (por que importa: ${a.por_que_importa})`).join('\n') : '',
    p.instrucoes || '',
  ].join('\n');
  const l = p.lead;
  const contexto = `Lead: ${l.nome || 'nome não confirmado (NÃO chame pelo nome, cumprimente sem nome)'}${l.empresa ? `, empresa ${l.empresa}` : ''}${l.segmento ? `, segmento ${l.segmento}` : ''}${l.campanha ? `, campanha ${l.campanha}` : ''}. Saudação adequada agora: "${p.saudacao}".`;
  // Ganchos do dia a dia por segmento (só use o que o MATERIAL confirma que resolvemos).
  const diaADia = /padar|confeit/i.test(l.segmento || '')
    ? 'correria da produção e do balcão, balança e etiquetas, perdas e sobras do dia, fechamento de caixa, cadastro de produtos, falta de tempo do dono'
    : 'correria do balcão, SNGPC, Farmácia Popular, cadastro de produtos, controle de estoque e validade, fechamento de caixa, falta de tempo do dono';
  const chamarDeVolta = `Objetivo: trazer o cliente de volta para a conversa, com sutileza. Use um gancho do DIA A DIA da operação dele (${diaADia}), em forma de pergunta leve e fácil de responder, sem notícias, prazos ou impostos. Não pareça cobrança nem venda.`;
  const f = p.followup || {};
  const nomeAgente = perfil === 'luiz_felipe' ? 'Luiz Felipe' : perfil === 'julio' ? 'Julio' : 'Caroline';
  const aberturaFollowUp = f.proposta
    ? `Primeira mensagem sua. Este cliente recebeu uma proposta da Prosystem${f.proposta.enviada_em ? `, enviada em ${f.proposta.enviada_em}` : ''}, e a conversa parou. Apresente-se como ${nomeAgente}, da equipe Prosystem. Para RELEMBRAR o cliente, envie um RESUMO curto do que foi proposto${f.proposta.resumo ? ` (use exatamente estes dados: ${f.proposta.resumo})` : f.proposta.plano ? ` (plano ${f.proposta.plano})` : ''}, em poucas linhas, sem inventar nenhum valor. Na segunda mensagem, apresente as vantagens do Plano Plus, começando com "E lembrando que o Plano Plus inclui" e citando: ${RECURSOS_PLANO_COMPLETO}. Termine com UMA pergunta leve: se ele conseguiu avaliar ou se ficou alguma dúvida. Sem cobrar, sem pressão e sem oferecer desconto.`
    : `Primeira mensagem sua. Este cliente falou com a Prosystem${f.cadastro_em ? ` em ${f.cadastro_em}` : ' há um tempo'} e a conversa parou. Apresente-se como Julio, da equipe Prosystem, retome com leveza e pergunte, em UMA pergunta, como está a rotina ${/padar|confeit/i.test(l.segmento || '') ? 'da padaria' : 'da farmácia'} e se já resolveu a questão do sistema (se continua procurando ou já fechou com outro). Sem cobrar.`;
  const pr = l.prospeccao;
  const tipoLoja = /padar|confeit/i.test(l.segmento || '') ? 'padaria' : 'farmácia';
  const aberturaProspeccao = pr
    ? `PRIMEIRO CONTATO ATIVO: esta ${tipoLoja} NÃO se inscreveu nem procurou a Prosystem; a equipe encontrou a ${l.empresa || tipoLoja} no Google Maps${pr.bairro ? ` (${pr.bairro}, ${pr.cidade})` : pr.cidade ? ` (${pr.cidade})` : ''}. Apresente-se como Caroline, da Prosystem Sistemas, de Vitória/ES, que faz sistema de gestão e frente de caixa para ${tipoLoja === 'padaria' ? 'padarias' : 'farmácias e drogarias'}. Em UMA frase diga por que está chamando, com um gancho do dia a dia (${diaADia}), sem prometer nada fora do MATERIAL. Termine com UMA pergunta fácil: se ele é o responsável pela ${tipoLoja} ou qual sistema usa hoje. NUNCA diga que ele se inscreveu, pediu contato ou mostrou interesse. Nada de elogio forçado nem de citar nota ou avaliações do Google. No máximo 2 frases curtas, em uma única mensagem.${l.nome ? ` O nome ${l.nome.split(' ')[0]} veio do cadastro da empresa na Receita: use só se tiver certeza de que é ele quem atende; na dúvida, não use nome.` : ''}`
    : '';
  const tarefa = p.fase === 'abertura' && pr && !followUp
    ? aberturaProspeccao
    : p.fase === 'abertura' && followUp
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
      : p.fase === 'encerramento' && pr
      ? `MENSAGEM DE ENCERRAMENTO (contato ativo, ele nunca se inscreveu): o lead não respondeu às 3 tentativas. Escreva UMA mensagem curta e respeitosa dizendo que não quer incomodar, que fica à disposição caso um dia queira conhecer um sistema para a ${tipoLoja}, e liste 2 soluções do MATERIAL que mais combinam com ${tipoLoja}, cada uma em uma linha curta começando com ✅. Não diga que ele se inscreveu. Sem pergunta insistente, sem preço, sem travessão.`
      : p.fase === 'encerramento'
      ? `MENSAGEM DE ENCERRAMENTO: o lead não respondeu às 3 tentativas. Escreva UMA mensagem (pode ter até 3 linhas curtas com ✅, só aqui) no espírito de: "${l.nome ? l.nome.split(' ')[0] : 'Oi'}, vi que você se inscreveu mas não conseguiu me retornar. Quanto antes começar a mudança, antes você resolve as pendências do dia a dia. Ainda tem interesse em continuar falando com a gente? Temos muito a agregar:" e liste 2 ou 3 soluções do MATERIAL que mais combinam com o segmento dele (${/padar|confeit/i.test(l.segmento || '') ? 'padaria' : 'farmácia'}), cada uma em uma linha curta começando com ✅. OBRIGATÓRIO: (1) dizer que viu a inscrição e que ele não retornou; (2) dizer que quanto antes começar a mudança, antes resolve as pendências do dia a dia; (3) perguntar se ainda tem interesse em continuar falando com a gente; (4) dizer que temos muito a agregar, antes das soluções. Tom respeitoso, sem cobrança, sem preço, sem travessão.`
      : 'Responda à(s) última(s) mensagem(ns) do cliente.';
  return { sistema, usuario: `${contexto}\n\nHistórico (mais recente por último):\n${p.historico || '(sem mensagens ainda)'}\n\n${tarefa}` };
}

export const saudacaoAgora = (d: Date) => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(d));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
