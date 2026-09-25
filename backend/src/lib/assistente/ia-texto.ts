// IA de texto do assistente (Fase 3): regras de quando o tira-dúvidas pode
// responder sozinho, montagem dos pedidos à IA e leitura das respostas. Puro.

export type ModoTiraDuvidas = 'desligado' | 'fora_do_horario' | 'sempre';
export const MODOS_TIRA_DUVIDAS: ModoTiraDuvidas[] = ['desligado', 'fora_do_horario', 'sempre'];
export const MAX_AUTO_POR_DIA = 3;
export const SILENCIO_APOS_HUMANO_MS = 2 * 3600000;

const partesSP = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(f.find(p => p.type === 'weekday')!.value);
  return { dia, hora: Number(f.find(p => p.type === 'hour')!.value) };
};

/** Horário comercial: seg–sex, 8h–18h (São Paulo). */
export function emHorarioComercial(d: Date): boolean {
  const { dia, hora } = partesSP(d);
  return dia >= 1 && dia <= 5 && hora >= 8 && hora < 18;
}

/** Se o tira-dúvidas pode tentar responder esta mensagem sozinho. */
export function podeAutoResponder(x: {
  modo: ModoTiraDuvidas; agora: Date; tipo_contato: string | null; em_triagem: boolean;
  ultima_saida_humana_em: Date | null; auto_hoje: number; texto: string;
}): boolean {
  if (x.modo === 'desligado') return false;
  if (x.modo === 'fora_do_horario' && emHorarioComercial(x.agora)) return false;
  if (x.tipo_contato && x.tipo_contato !== 'LEAD') return false;
  if (x.em_triagem) return false;
  if (x.ultima_saida_humana_em && x.agora.getTime() - x.ultima_saida_humana_em.getTime() < SILENCIO_APOS_HUMANO_MS) return false;
  if (x.auto_hoje >= MAX_AUTO_POR_DIA) return false;
  return (x.texto || '').trim().length >= 8; // "oi", "ok", "obrigado" não disparam
}

export const REGRAS_COMERCIAIS = [
  'Você é o assistente comercial da Prosystem Sistemas (sistemas de gestão para farmácias, padarias e varejo).',
  'Responda em português do Brasil, em tom comercial, simpático e curto (até 4 frases), focado no benefício para o negócio do cliente.',
  'Use SOMENTE as informações do guia comercial abaixo. Se o guia não cobre o assunto, não invente.',
  'NUNCA informe preço, valor, desconto, prazo de contrato ou condição de pagamento: isso é com a especialista.',
  'Quando o recurso depende de plano, diga "a partir do plano X".',
  'Sempre que fizer sentido, termine convidando para uma demonstração com a nossa especialista.',
].join('\n');

export function promptTiraDuvidas(guia: string, conversa: string): { sistema: string; usuario: string } {
  return {
    sistema: `${REGRAS_COMERCIAIS}\n\n### Guia comercial\n${guia}`,
    usuario: [
      'Conversa (a última mensagem é do cliente):', conversa, '',
      'Responda APENAS com JSON: {"responder": boolean, "resposta": string, "motivo": string}.',
      '"responder" = true só se a última mensagem é uma dúvida sobre o sistema/recursos que o guia responde com segurança.',
      'Use "responder" = false para preço, desconto, contrato, reclamação, suporte técnico, financeiro, conversa pessoal ou quando não houver certeza.',
    ].join('\n'),
  };
}

export function promptResumo(conversa: string, contexto: string): { sistema: string; usuario: string } {
  return {
    sistema: 'Você ajuda a equipe comercial da Prosystem Sistemas a entender conversas de WhatsApp. Responda em português do Brasil, direto e sem floreio.',
    usuario: [
      contexto ? `Contexto do CRM: ${contexto}` : '', 'Conversa:', conversa, '',
      'Responda APENAS com JSON: {"quem": string, "falado": string, "falta": string, "venda_adicional": string | null}.',
      '"quem": quem é o contato e a empresa (1 frase). "falado": o que já foi tratado (1-2 frases). "falta": o próximo passo recomendado (1 frase).',
      '"venda_adicional": se for cliente e pediu algo que outro plano/produto resolve, a sugestão em 1 frase; senão null.',
    ].filter(Boolean).join('\n'),
  };
}

export function promptSugestao(guia: string, conversa: string, vendedora: string): { sistema: string; usuario: string } {
  return {
    sistema: `${REGRAS_COMERCIAIS}\nVocê está escrevendo a próxima mensagem da vendedora ${vendedora}, que vai revisar antes de enviar. Pode responder objeções como "já tenho sistema" ou "está caro" mostrando valor, sem dar desconto.\n\n### Guia comercial\n${guia}`,
    usuario: `Conversa:\n${conversa}\n\nEscreva só o texto da próxima mensagem da vendedora, pronto para enviar no WhatsApp (sem aspas, sem explicações).`,
  };
}

/** Lê JSON da resposta da IA (tolera cercas ```json). null se não der. */
export function lerJsonIa<T = any>(texto: string | null | undefined): T | null {
  if (!texto) return null;
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(limpo); } catch {
    const m = limpo.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

/** Resposta automática final: nunca sai com valor em reais, mesmo se a IA escorregar. */
export function respostaSegura(r: { responder?: boolean; resposta?: string } | null): string | null {
  if (!r || r.responder !== true) return null;
  const t = (r.resposta || '').trim();
  if (t.length < 10 || t.length > 900) return null;
  if (/R\$\s?\d|\d+\s?reais|\bdesconto\b/i.test(t)) return null;
  return t;
}
