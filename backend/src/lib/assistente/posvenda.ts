// Pós-venda pelo WhatsApp (Fase 4 do assistente): boas-vindas depois do contrato
// assinado e pesquisa de satisfação 30 dias depois. Puro.

import type { MenuWhatsapp } from '../../services/evolution.service';

export const DIAS_PESQUISA = 30;
export const JANELA_BOAS_VINDAS_DIAS = 7;

type Prop = {
  status: string; origem: string | null; data_aceite: Date | null; updated_at: Date;
  wpp_boasvindas_em: Date | null; wpp_pesquisa_em: Date | null; responsavel_telefone: string | null;
};

const temCelular = (t: string | null) => (t || '').replace(/\D/g, '').length >= 10;

/**
 * Boas-vindas: contrato assinado, nunca lançamento retroativo, aceite nos últimos
 * 7 dias e depois de o pós-venda ter sido ligado (`desde`), ainda não enviada.
 */
export function elegivelBoasVindas(p: Prop, desde: Date | null, agora: Date): boolean {
  if (!desde || p.status !== 'CONTRATO_ASSINADO' || p.origem === 'RETROATIVO' || p.wpp_boasvindas_em || !temCelular(p.responsavel_telefone)) return false;
  const ref = p.data_aceite || p.updated_at;
  return ref >= desde && agora.getTime() - ref.getTime() <= JANELA_BOAS_VINDAS_DIAS * 86400000;
}

/** Pesquisa: 30 dias depois das boas-vindas enviadas por aqui, uma vez. */
export function elegivelPesquisa(p: Prop, agora: Date): boolean {
  return !!p.wpp_boasvindas_em && !p.wpp_pesquisa_em && temCelular(p.responsavel_telefone)
    && agora.getTime() - p.wpp_boasvindas_em.getTime() >= DIAS_PESQUISA * 86400000;
}

const primeiro = (s: string | null) => (s || '').trim().split(/\s+/)[0] || '';

export const textoBoasVindas = (nome: string | null, empresa: string) =>
  `Olá${primeiro(nome) ? `, ${primeiro(nome)}` : ''}! 🎉 Seja muito bem-vindo(a) à *Prosystem*!\n\n` +
  `O contrato da *${empresa}* está assinado. Nossa equipe de implantação vai te chamar para agendar a instalação.\n\n` +
  `Enquanto isso, conheça os tutoriais da nossa Universidade: https://universidade.prosystemnet.com/base-conhecimento\n\n` +
  'Qualquer dúvida, é só chamar por aqui. 💙';

export function menuPesquisa(propostaId: string, empresa: string): MenuWhatsapp {
  return {
    modo: 'button', rodape: 'Prosystem Sistemas',
    texto: `Olá! Já faz um mês que a *${empresa}* usa o Prosystem. Como está sendo a sua experiência até aqui?`,
    opcoes: [
      { id: `pesq_3_${propostaId}`, texto: 'Ótima 😀' },
      { id: `pesq_2_${propostaId}`, texto: 'Regular 😐' },
      { id: `pesq_1_${propostaId}`, texto: 'Ruim 😞' },
    ],
  };
}

export function lerBotaoPesquisa(botaoId: string | null | undefined): { nota: 1 | 2 | 3; id: string } | null {
  const m = (botaoId || '').match(/^pesq_([123])_(.+)$/);
  return m ? { nota: Number(m[1]) as 1 | 2 | 3, id: m[2] } : null;
}

export function textoRespostaPesquisa(nota: 1 | 2 | 3): string {
  if (nota === 3) return 'Que alegria! 💙 Obrigado. Se conhecer outro empresário que também precisa de um bom sistema, pode indicar a Prosystem: é só mandar o contato aqui.';
  if (nota === 2) return 'Obrigado pela sinceridade! Vamos te chamar para entender o que podemos melhorar.';
  return 'Poxa, sentimos muito. 😔 Nossa supervisão vai falar com você ainda hoje para resolver.';
}

export const NOME_NOTA: Record<1 | 2 | 3, string> = { 3: 'ÓTIMA 😀', 2: 'REGULAR 😐', 1: 'RUIM 😞' };
