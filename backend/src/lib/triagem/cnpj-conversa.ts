// CNPJ mandado em qualquer mensagem da conversa (com ou sem triagem). Puro:
// decide se a mensagem traz um CNPJ novo, como fica o bot_dados depois da
// consulta e o que muda no lead (mesmos campos/observação do lead qualificado,
// mas sem etapa_sdr, prioridade, etiqueta ou alarme).

import { extrairCnpj, cnpjValido, type ConsultaCnpj } from '../cnpj';
import { camposLeadReceita, observacaoReceita, type LeadAtual } from './desfecho';
import type { DadosTriagem } from './fluxo';

/** Nos estados CNPJ/CNPJ_CONFIRMA da triagem quem cuida do CNPJ é o fluxo; a detecção não mexe. */
export function fluxoCuidaDoCnpj(c: { bot_ativo: boolean; bot_estado: string | null }): boolean {
  return c.bot_ativo && (c.bot_estado === 'CNPJ' || c.bot_estado === 'CNPJ_CONFIRMA');
}

/** CNPJ válido presente no texto e diferente do já salvo na conversa; senão null. */
export function cnpjNovoNaMensagem(botDados: DadosTriagem | null | undefined, texto: string | null | undefined): string | null {
  const cnpj = extrairCnpj(texto || '');
  if (!cnpj || !cnpjValido(cnpj)) return null;
  if (botDados?.cnpj && botDados.cnpj.replace(/\D/g, '') === cnpj) return null;
  return cnpj;
}

/** Novo bot_dados após a consulta (preserva as outras chaves). null = não encontrado → não mexe. */
export function dadosComCnpj(botDados: DadosTriagem | null | undefined, cnpj: string, consulta: ConsultaCnpj): DadosTriagem | null {
  if (consulta.status === 'nao_encontrado') return null;
  const base = { ...(botDados || {}) };
  if (consulta.status === 'indisponivel') return { ...base, cnpj, receita: null, receita_fonte: null };
  return { ...base, cnpj, receita: consulta.dados, receita_fonte: consulta.fonte };
}

export const TITULO_OBS_CNPJ = '🔎 CNPJ recebido no WhatsApp — Dados da Receita';

/** O que aplicar no lead quando a conversa ganha um CNPJ (sem etapa/prioridade/etiqueta/alarme). */
export function efeitosCnpjNoLead(dados: DadosTriagem, leadAtual: LeadAtual | null): { lead: Record<string, string>; observacao: string } {
  return { lead: camposLeadReceita(dados, leadAtual), observacao: observacaoReceita(dados, TITULO_OBS_CNPJ) };
}
