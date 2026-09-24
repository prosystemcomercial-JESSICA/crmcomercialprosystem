// IA Laya (modelo de decisão rodando na própria VPS): perguntas fixas sobre a
// conversa, montagem do texto que ele lê e leitura da resposta. Puro, sem rede.

export const SEGMENTOS_IA = ['farmacia', 'manipulacao', 'padaria', 'varejo', 'outro', 'nao_sei'] as const;
export const INTENCOES_IA = ['comprar', 'suporte', 'financeiro', 'servicos', 'outro'] as const;
export type SegmentoIa = typeof SEGMENTOS_IA[number];
export type IntencaoIa = typeof INTENCOES_IA[number];
export type SugestaoIa = { segmento: SegmentoIa; intencao: IntencaoIa; cancelar: number; urgencia: number };
export type RotulosIa = { segmento: SegmentoIa; intencao: IntencaoIa; cancelar: boolean } | { ignorar: true };

// Contatos que não são comerciais: não vale a pena analisar nem treinar.
export const TIPOS_SEM_IA = ['EQUIPE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'];

export const PERGUNTAS_LAYA = {
  segmento: {
    type: 'choice', instructions: 'Qual o ramo da empresa do cliente nesta conversa?',
    criteria: {
      farmacia: 'farmácia ou drogaria', manipulacao: 'farmácia de manipulação',
      padaria: 'padaria, confeitaria, panificadora', varejo: 'loja, mercado, comércio em geral',
      outro: 'outro ramo', nao_sei: 'não dá para saber pela conversa',
    },
  },
  intencao: {
    type: 'choice', instructions: 'O que o cliente quer com a empresa de sistemas?',
    criteria: {
      comprar: 'conhecer, contratar, pedir preço ou proposta de sistema',
      suporte: 'problema, erro ou dúvida de uso do sistema',
      financeiro: 'boleto, pagamento, cobrança, mensalidade',
      servicos: 'troca de CNPJ, upgrade, instalação, treinamento ou serviço extra',
      outro: 'cumprimento, conversa pessoal ou outro assunto',
    },
  },
  urgencia: { type: 'score', instructions: 'Quão urgente é para o cliente?', criteria: ['nada urgente', 'em breve', 'urgente', 'parado, bloqueado'] },
  cancelar: { type: 'noul', instructions: 'O cliente ameaça cancelar, reclamar forte ou trocar de sistema?' },
} as const;

type MsgIa = { direcao: string; tipo: string; conteudo: string | null };

/** Texto da conversa para o Laya: só mensagens de texto, mais recentes por último, limitado em tamanho. */
export function montarEstadoConversa(msgs: MsgIa[], maxChars = 3000): string {
  const linhas = msgs
    .filter(m => m.tipo === 'TEXTO' && (m.conteudo || '').trim())
    .map(m => `${m.direcao === 'ENTRADA' ? 'Cliente' : 'Empresa'}: ${(m.conteudo || '').replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  const saida: string[] = [];
  let total = 0;
  for (let i = linhas.length - 1; i >= 0; i--) {
    total += linhas[i].length + 1;
    if (total > maxChars && saida.length) break;
    saida.unshift(linhas[i]);
  }
  return saida.join('\n');
}

const dentro = <T extends readonly string[]>(lista: T, v: unknown, padrao: T[number]): T[number] =>
  (lista as readonly string[]).includes(v as string) ? (v as T[number]) : padrao;
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
};

/** Converte a resposta do /v1/systemone do Laya na sugestão guardada na conversa. */
export function lerRespostaLaya(res: any): SugestaoIa {
  const a = res?.answers || {};
  return {
    segmento: dentro(SEGMENTOS_IA, a.segmento?.choice, 'nao_sei'),
    intencao: dentro(INTENCOES_IA, a.intencao?.choice, 'outro'),
    cancelar: num(a.cancelar?.noul, 0, 1),
    urgencia: num(a.urgencia?.score, 0, 3),
  };
}

/** Valida as etiquetas que a equipe confirmou. */
export function validarRotulos(body: any): RotulosIa | null {
  if (body?.ignorar === true) return { ignorar: true };
  if (!(SEGMENTOS_IA as readonly string[]).includes(body?.segmento)) return null;
  if (!(INTENCOES_IA as readonly string[]).includes(body?.intencao)) return null;
  if (typeof body?.cancelar !== 'boolean') return null;
  return { segmento: body.segmento, intencao: body.intencao, cancelar: body.cancelar };
}

/** Acerto do Laya nas amostras confirmadas (ignora as marcadas como "não comercial"). */
export function medirAcerto(amostras: { rotulos: any; sugestao: any }[]) {
  let n = 0, seg = 0, int = 0, canc = 0;
  for (const a of amostras) {
    const r = a.rotulos, s = a.sugestao;
    if (!r || r.ignorar || !s) continue;
    n++;
    if (s.segmento === r.segmento) seg++;
    if (s.intencao === r.intencao) int++;
    if ((s.cancelar >= 0.5) === r.cancelar) canc++;
  }
  const pct = (x: number) => (n ? Math.round((x / n) * 100) : null);
  return { comparaveis: n, segmento: pct(seg), intencao: pct(int), cancelar: pct(canc) };
}
