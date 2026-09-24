// CNPJ de um cliente da base chegou numa conversa sem vínculo: pergunta ao
// contato se é a empresa dele e, conforme a resposta, vincula ou não. Puro — o
// serviço executa (consulta, envio, gravação).

import type { MenuWhatsapp } from '../services/evolution.service';

export type ConfirmacaoCliente = {
  cliente_id: string;
  rotulo: string;
  codigo: string | null;
  cnpj: string;
  /** false = aguardando o fim da triagem para perguntar. */
  enviada: boolean;
  /** ISO da pergunta enviada (base das janelas de 2 h / 24 h). */
  perguntada_em?: string | null;
};

export const JANELA_BOTAO_MS = 24 * 60 * 60 * 1000;
export const JANELA_TEXTO_MS = 2 * 60 * 60 * 1000;

export type BotDadosConfirmacao = {
  cnpj?: string;
  confirmacao_cliente?: ConfirmacaoCliente | null;
  /** CNPJs (só dígitos) já perguntados — pergunta uma vez por CNPJ. */
  confirmacao_cliente_cnpjs?: string[];
  [k: string]: any;
};

export type ClienteCandidato = { id: string; codigo: string | null; razao_social: string | null; nome_fantasia: string | null; nome: string | null };

export const soDigitos = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

export function rotuloCliente(c: ClienteCandidato): string {
  return (c.razao_social || c.nome_fantasia || c.nome || 'cliente').trim();
}

export type DecisaoPergunta =
  | { acao: 'nenhuma' }
  | { acao: 'perguntar' | 'adiar'; confirmacao: ConfirmacaoCliente };

/**
 * CNPJ conhecido na conversa: pergunta se a conversa não tem cliente, o CNPJ
 * casa com exatamente um cliente e ainda não foi perguntado. Em triagem, adia.
 */
export function decidirPerguntaCliente(ctx: {
  cliente_id: string | null;
  bot_dados: BotDadosConfirmacao | null | undefined;
  emTriagem: boolean;
  candidatos: ClienteCandidato[];
}): DecisaoPergunta {
  const dados = ctx.bot_dados || {};
  const cnpj = soDigitos(dados.cnpj);
  if (ctx.cliente_id || cnpj.length !== 14) return { acao: 'nenhuma' };
  if (ctx.candidatos.length !== 1) return { acao: 'nenhuma' };
  const c = ctx.candidatos[0];
  const pend = dados.confirmacao_cliente;
  // Já existe uma pendente para este CNPJ: só envia a adiada quando a triagem acabar.
  if (pend && pend.cnpj === cnpj) {
    if (pend.enviada || ctx.emTriagem) return { acao: 'nenhuma' };
    return { acao: 'perguntar', confirmacao: { ...pend, enviada: true } }; // perguntada_em: o serviço grava ao enviar
  }
  if ((dados.confirmacao_cliente_cnpjs || []).includes(cnpj)) return { acao: 'nenhuma' };
  const confirmacao: ConfirmacaoCliente = { cliente_id: c.id, rotulo: rotuloCliente(c), codigo: c.codigo || null, cnpj, enviada: !ctx.emTriagem };
  return { acao: ctx.emTriagem ? 'adiar' : 'perguntar', confirmacao };
}

/** bot_dados após a decisão (marca o CNPJ como perguntado). */
export function dadosComConfirmacao(dados: BotDadosConfirmacao | null | undefined, conf: ConfirmacaoCliente): BotDadosConfirmacao {
  const base = { ...(dados || {}) };
  const lista = base.confirmacao_cliente_cnpjs || [];
  return { ...base, confirmacao_cliente: conf, confirmacao_cliente_cnpjs: lista.includes(conf.cnpj) ? lista : [...lista, conf.cnpj] };
}

export function menuConfirmacaoCliente(conf: Pick<ConfirmacaoCliente, 'rotulo' | 'codigo'>): MenuWhatsapp {
  const cod = conf.codigo ? ` (cód. ${conf.codigo})` : '';
  return {
    modo: 'button',
    texto: `Encontramos o cadastro *${conf.rotulo}*${cod}. É a sua empresa?`,
    opcoes: [{ id: 'cli_sim', texto: 'Sim' }, { id: 'cli_nao', texto: 'Não' }],
    rodape: 'Prosystem Sistemas',
  };
}

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Só respostas inequívocas valem digitadas ("ok", "certo", "isso" não: podem ser de outro assunto).
const TEXTO_SIM = ['sim', 's', 'e sim'];
const TEXTO_NAO = ['nao', 'n', 'nao e'];

/** Sim/Não do contato: botão cli_sim/cli_nao ou texto curto e claro. */
export function interpretarRespostaCliente(texto: string | null | undefined, botaoId?: string | null): 'sim' | 'nao' | null {
  if (botaoId === 'cli_sim') return 'sim';
  if (botaoId === 'cli_nao') return 'nao';
  const t = norm(texto || '');
  if (TEXTO_SIM.includes(t)) return 'sim';
  if (TEXTO_NAO.includes(t)) return 'nao';
  return null;
}

export type DecisaoResposta = { acao: 'sim' | 'nao' | 'expirar' } | null;

/**
 * Mensagem recebida com confirmação pendente. null = não há o que fazer (sem
 * pendência, adiada ou triagem ativa). 'expirar' = limpa a pendência e a
 * mensagem segue o fluxo normal. Regras:
 * - botão cli_sim/cli_nao vale até 24 h da pergunta;
 * - texto só se for a 1ª mensagem recebida após a pergunta, em até 2 h, sem
 *   mensagem humana depois da pergunta, e for um sim/não claro;
 * - qualquer outra mensagem (ou passadas 24 h / humano respondeu) expira.
 */
export function decidirRespostaCliente(ctx: {
  bot_dados: BotDadosConfirmacao | null | undefined;
  emTriagem: boolean;
  texto: string | null | undefined;
  botaoId?: string | null;
  agora: Date;
  /** Mensagens recebidas depois da pergunta, contando esta. */
  entradasAposPergunta: number;
  /** Houve SAIDA de humano (não bot) depois da pergunta. */
  humanoAposPergunta: boolean;
}): DecisaoResposta {
  const pend = ctx.bot_dados?.confirmacao_cliente;
  if (!pend || !pend.enviada || ctx.emTriagem) return null;
  const enviadaEm = pend.perguntada_em ? new Date(pend.perguntada_em).getTime() : NaN;
  const idade = Number.isNaN(enviadaEm) ? Infinity : ctx.agora.getTime() - enviadaEm;
  if (idade > JANELA_BOTAO_MS) return { acao: 'expirar' };
  if (ctx.botaoId === 'cli_sim' || ctx.botaoId === 'cli_nao') return { acao: ctx.botaoId === 'cli_sim' ? 'sim' : 'nao' };
  if (ctx.humanoAposPergunta || ctx.entradasAposPergunta > 1 || idade > JANELA_TEXTO_MS) return { acao: 'expirar' };
  const r = ctx.botaoId ? null : interpretarRespostaCliente(ctx.texto, null);
  return r ? { acao: r } : { acao: 'expirar' };
}

export function observacaoRecusa(conf: Pick<ConfirmacaoCliente, 'cnpj' | 'rotulo'>): string {
  return `Contato disse que o CNPJ ${conf.cnpj} não é do cadastro ${conf.rotulo}`;
}
