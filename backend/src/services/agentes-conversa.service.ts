import type { PrismaClient } from '@prisma/client';
import { AGENTES, type AgenteId } from '@/lib/assistente/escritorio';
import { chamarGemini, chaveGemini } from './ia-gemini.service';

// Escritório virtual (entrega 2): instruções gravadas e conversa com os agentes.
// As instruções ativas do agente e da "equipe" entram nos prompts de IA; as
// perguntas são respondidas com o histórico real do agente e o que já foi conversado.

export const EQUIPE = 'equipe';

/** Bloco de instruções para colar no prompt de IA de um agente (vazio se não houver). */
export async function instrucoesPara(prisma: PrismaClient, agente: string): Promise<string> {
  const rs = await prisma.agenteInstrucao.findMany({
    where: { ativa: true, agente: { in: [agente, EQUIPE] } }, orderBy: { created_at: 'asc' }, take: 40,
  }).catch(() => []);
  if (!rs.length) return '';
  return `\n\n### Instruções da supervisão (siga sempre)\n${rs.map(r => `- ${r.texto}`).join('\n')}`;
}

export async function conversaDoAgente(prisma: PrismaClient, agente: string) {
  const [mensagens, instrucoes] = await Promise.all([
    prisma.agenteMensagem.findMany({ where: { agente }, orderBy: { created_at: 'desc' }, take: 60 }),
    prisma.agenteInstrucao.findMany({ where: { ativa: true, agente: { in: [agente, EQUIPE] } }, orderBy: { created_at: 'desc' } }),
  ]);
  return { mensagens: mensagens.reverse(), instrucoes };
}

const agenteInfo = (id: string) => AGENTES.find(a => a.id === id);

export async function falarComAgente(
  prisma: PrismaClient, agente: AgenteId, entrada: { tipo: 'INSTRUCAO' | 'PERGUNTA'; texto: string; equipe?: boolean }, user: { id: string; nome?: string },
) {
  const info = agenteInfo(agente)!;
  const texto = entrada.texto.trim().slice(0, 2000);
  await prisma.agenteMensagem.create({ data: { agente, autor: 'JESSICA', tipo: entrada.tipo, texto, criado_por: user.id } });

  let resposta: string;
  if (entrada.tipo === 'INSTRUCAO') {
    await prisma.agenteInstrucao.create({ data: { agente: entrada.equipe ? EQUIPE : agente, texto, criado_por: user.id } });
    resposta = entrada.equipe
      ? `Anotado para toda a equipe! 📌 A partir de agora todos seguimos: "${texto}".`
      : `Anotado! 📌 Vou seguir sempre: "${texto}".`;
  } else if (!(await chaveGemini(prisma))) {
    resposta = 'Para eu responder perguntas preciso da chave da IA (Configurações → Assistente no WhatsApp → Chave da IA). Enquanto isso, veja minhas últimas ações em "Ver trabalho".';
  } else {
    const { historicoAgente, montarEscritorio } = await import('./escritorio.service');
    const [hist, escritorio, conversa, instr] = await Promise.all([
      historicoAgente(prisma, agente), montarEscritorio(prisma), conversaDoAgente(prisma, agente), instrucoesPara(prisma, agente),
    ]);
    const eu = escritorio.find(a => a.id === agente);
    const sistema = [
      `Você é ${info.nome}, agente do CRM Comercial da Prosystem Sistemas (sistemas para farmácias, padarias e varejo). Sua função: ${info.funcao}.`,
      'Quem fala com você é a Jessica, desenvolvedora e supervisora da equipe. Responda em português do Brasil, em primeira pessoa, curto e direto, com dados quando tiver.',
      'Use apenas os dados abaixo. Se não souber, diga o que falta. Não invente números.',
      instr,
      `\n### Seu dia\nStatus: ${eu?.status}. ${eu?.numeros.map(n => `${n.valor} ${n.rotulo}`).join(', ')}. ${eu?.observacao || ''}`,
      `\n### Suas últimas ações\n${hist.slice(0, 10).map(h => `- ${h.em.slice(0, 16).replace('T', ' ')}: ${h.texto}`).join('\n') || '- nenhuma ainda'}`,
      `\n### Equipe agora\n${escritorio.map(a => `- ${a.nome}: ${a.status}; ${a.numeros.map(n => `${n.valor} ${n.rotulo}`).join(', ')}`).join('\n')}`,
    ].join('\n');
    const historico = conversa.mensagens.slice(-12).map(m => `${m.autor === 'JESSICA' ? 'Jessica' : info.nome}: ${m.texto}`).join('\n');
    try {
      resposta = await chamarGemini(prisma, { sistema, partes: [{ text: `${historico}\n\nResponda à última mensagem da Jessica.` }], temperatura: 0.4, simples: true });
    } catch (e: any) {
      resposta = `Não consegui pensar agora (${e?.message || 'IA indisponível'}). Tente de novo em instantes.`;
    }
  }
  const msg = await prisma.agenteMensagem.create({ data: { agente, autor: 'AGENTE', tipo: 'RESPOSTA', texto: resposta.slice(0, 4000) } });
  return { resposta: msg };
}

export async function desativarInstrucao(prisma: PrismaClient, id: string) {
  await prisma.agenteInstrucao.update({ where: { id }, data: { ativa: false } });
}
