import type { PrismaClient } from '@prisma/client';
import { pesquisarComGemini } from './ia-gemini.service';
import { lerJsonIa } from '@/lib/assistente/ia-texto';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';

// Sofia, a pesquisadora: toda segunda de manhã (ou quando pedirem) pesquisa na
// internet os assuntos mais falados do setor e grava com as fontes e sugestões
// de mensagem para os clientes. As instruções dadas a ela entram no prompt.

export type ItemPesquisa = { segmento: string; titulo: string; resumo: string; por_que_importa: string; sugestao_mensagem_cliente: string };

const SISTEMA = [
  'Você é a Sofia, pesquisadora do time comercial da Prosystem Sistemas (ERP e PDV para farmácias, drogarias, farmácias de manipulação, padarias, confeitarias e varejo no Brasil).',
  'Pesquise na internet e traga só assuntos reais e recentes, em português do Brasil, com linguagem simples.',
  'Priorize: leis e regras novas (Anvisa, SNGPC, Farmácia Popular, reforma tributária, IBS/CBS, NFC-e, SPED), pagamentos (PIX, maquininhas), tendências de consumo e tecnologia de gestão, e dicas de administração para pequenas empresas.',
].join('\n');

function perguntaDe(tema: string | null) {
  return [
    tema ? `Pesquise sobre: "${tema}", no contexto dos clientes da Prosystem.` : 'Quais são os assuntos mais falados nos últimos 7 dias para farmácias, drogarias, farmácias de manipulação, padarias, confeitarias, varejo e gestão de pequenas empresas no Brasil?',
    'Responda APENAS com JSON: {"titulo": string, "resumo": string, "itens": [{"segmento": "Farmácia" | "Manipulação" | "Padaria" | "Varejo" | "Gestão", "titulo": string, "resumo": string, "por_que_importa": string, "sugestao_mensagem_cliente": string}]}.',
    'Traga de 4 a 8 itens. "sugestao_mensagem_cliente": uma mensagem curta de WhatsApp que a Prosystem pode mandar para os clientes daquele segmento informando o assunto (sem prometer preço).',
  ].join('\n');
}

export async function pesquisarSetor(prisma: PrismaClient, tema: string | null, userId: string | null) {
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const { texto, fontes } = await pesquisarComGemini(prisma, { sistema: SISTEMA + (await instrucoesPara(prisma, 'sofia')), pergunta: perguntaDe(tema) });
  const r = lerJsonIa<{ titulo: string; resumo: string; itens: ItemPesquisa[] }>(texto);
  const itens = Array.isArray(r?.itens) ? r!.itens.slice(0, 10) : [];
  const pesq = await prisma.pesquisaSetor.create({
    data: {
      tema, titulo: (r?.titulo || (tema ? `Pesquisa: ${tema}` : 'Assuntos da semana')).slice(0, 180),
      resumo: r?.resumo || texto.slice(0, 2000), itens: itens as any, fontes: fontes as any, criado_por: userId,
    },
  });
  registrarAcaoAgente('sofia', `pesquisou "${pesq.titulo.slice(0, 60)}"`);
  // Aviso curto no celular da gestão.
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'pesquisa_setor', [
    `🔎 *Sofia: ${pesq.titulo}*`, pesq.resumo.slice(0, 300),
    ...itens.slice(0, 5).map(i => `• [${i.segmento}] ${i.titulo}`),
    '', 'Detalhes e sugestões de mensagem no Escritório virtual.',
  ].join('\n'));
  return pesq;
}

/** Pesquisa semanal: segunda-feira a partir das 8h (São Paulo), uma vez por semana. */
export async function rodarPesquisaSemanal(prisma: PrismaClient, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  if (partes.find(p => p.type === 'weekday')?.value !== 'Mon' || Number(partes.find(p => p.type === 'hour')?.value) < 8) return;
  const ultima = await prisma.pesquisaSetor.findFirst({ where: { tema: null }, orderBy: { created_at: 'desc' }, select: { created_at: true } });
  if (ultima && agora.getTime() - ultima.created_at.getTime() < 5 * 86400000) return;
  const { chaveGemini } = await import('./ia-gemini.service');
  if (!(await chaveGemini(prisma))) return;
  await pesquisarSetor(prisma, null, null);
}
