// Desfecho real de uma reunião/demonstração: antes de gravar "Realizada", o CRM lê o que foi
// escrito ao concluir e o que o cliente disse na conversa no dia. Sinal de que não aconteceu
// (adiar, remarcar, não compareceu, deixar pra próxima, viagem…) → "Cliente não compareceu".
// Puro, sem banco.

const SINAIS_NAO_ACONTECEU = [
  /n[aã]o\s+(compareceu|apareceu|veio|entrou|participou|atendeu)/i,
  /n[aã]o\s+deu\s+retorno/i,
  /\b(sem|n[aã]o\s+teve)\s+retorno\b/i,
  /\bremarc/i,
  /\badi(ar|ou|amos|ei|a)\b/i,
  /\bdeixa(r)?\s+(pra|para)\s+(a\s+)?pr[oó]xima/i,
  /\bfica\s+(pra|para)\s+(a\s+)?pr[oó]xima/i,
  /\bem\s+viagem\b|\bviajando\b/i,
  /\bfaltou\b|\bausente\b|\bdesmarc/i,
  /\bn[aã]o\s+(vou|vai|posso|consigo)\s+(conseguir\s+)?(participar|entrar|ir)\b/i,
  /\boutro\s+(dia|hor[aá]rio)\b/i,
  /\bme\s+ocupei\b|\bsurgiu\s+um\s+imprevisto\b|\bimprevisto\b/i,
];

export function sinalDeNaoComparecimento(texto: string | null | undefined): string | null {
  const t = (texto || '').trim();
  if (!t) return null;
  for (const r of SINAIS_NAO_ACONTECEU) {
    const m = t.match(r);
    if (m) return m[0];
  }
  return null;
}

/** Decide o status ao concluir uma reunião, olhando o resultado escrito e as falas do cliente no dia. */
export function desfechoDaReuniao(resultado: string | null | undefined, falasDoCliente: string[]): { status: 'REALIZADA' | 'CLIENTE_NAO_COMPARECEU'; motivo: string | null } {
  const noResultado = sinalDeNaoComparecimento(resultado);
  if (noResultado) return { status: 'CLIENTE_NAO_COMPARECEU', motivo: `no que foi escrito: "${noResultado}"` };
  for (const f of falasDoCliente) {
    const s = sinalDeNaoComparecimento(f);
    if (s) return { status: 'CLIENTE_NAO_COMPARECEU', motivo: `o cliente disse na conversa: "${f.trim().slice(0, 80)}"` };
  }
  return { status: 'REALIZADA', motivo: null };
}
