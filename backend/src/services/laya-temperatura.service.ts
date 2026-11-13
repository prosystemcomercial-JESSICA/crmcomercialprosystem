import type { PrismaClient } from '@prisma/client';
import { vereditoTemperatura, NOME_TEMPERATURA, type VereditoTemperatura } from '../lib/laya-temperatura';
import { ehRespostaAutomatica, ehEncerramentoAutomatico } from '../lib/assistente/sdr';
import { casoParecido, type AmostraLaya } from '../lib/laya-caderno';
import { registrarAcaoAgente } from '../lib/assistente/escritorio';

/**
 * A Laya mede sozinha a temperatura dos leads dos SDRs (Caroline, Julio, Luiz Felipe) e grava em
 * `temperatura_confirmada`, com a marca `dados.temperatura_laya` (valor, regra, motivo, em).
 * - Nunca mexe no que a Jessica confirmou à mão (sem a marca, ou com valor diferente da marca).
 * - Reavalia quando o lead muda depois da última medição (mensagem nova, nota nova, status novo).
 * - O veredito dela NÃO vira exemplo de treino: só a confirmação de uma pessoa ensina a Laya.
 * - A temperatura do Lead acompanha, respeitando a troca feita por uma pessoa até o cliente falar de novo.
 */

const AUTORES_AUTOMATICOS = ['laya', 'bot', 'system', 'sistema', 'caroline', 'julio', 'luiz_felipe', 'heitor'];
const LOTE = 300;

type SdrMin = { id: string; status: string; nota: number | null; temperatura: string | null; temperatura_confirmada: string | null; dados: any; conversaId: string | null; lead_id: string | null; nome: string | null; empresa: string | null; updated_at: Date };

/** Confirmações humanas de temperatura (memória da Laya). */
async function memoriaHumana(prisma: PrismaClient): Promise<AmostraLaya[]> {
  const xs = await prisma.iaAmostra.findMany({ where: { NOT: { criado_por: { startsWith: 'auto:' } } }, select: { texto: true, rotulos: true, sugestao: true, criado_por: true, created_at: true }, orderBy: { created_at: 'desc' }, take: 1000 }).catch(() => []);
  return (xs as AmostraLaya[]).filter(a => typeof a.rotulos?.temperatura === 'string');
}

/** Foi a Laya que pôs a temperatura confirmada atual? */
export function confirmadaPelaLaya(s: { temperatura_confirmada: string | null; dados: any }): boolean {
  const m = s.dados?.temperatura_laya;
  return !!m && !!s.temperatura_confirmada && m.valor === s.temperatura_confirmada;
}

async function medirUm(prisma: PrismaClient, s: SdrMin, memoria: AmostraLaya[], agora: Date): Promise<VereditoTemperatura | null> {
  let falas: string[] = [];
  let ultimaFalaEm: Date | null = null;
  let texto = '';
  if (s.conversaId) {
    const msgs = await prisma.whatsappMensagem.findMany({ where: { conversaId: s.conversaId, direcao: 'ENTRADA' }, orderBy: { created_at: 'asc' }, select: { tipo: true, conteudo: true, created_at: true }, take: 200 });
    for (const m of msgs) {
      const c = (m.conteudo || '').trim();
      if (m.tipo === 'AUDIO') { falas.push(c || '[áudio]'); ultimaFalaEm = m.created_at; continue; }
      if (!['TEXTO', 'IMAGEM', 'DOCUMENTO'].includes(m.tipo) || !c) continue;
      if (ehRespostaAutomatica(c) || ehEncerramentoAutomatico(c)) continue;
      falas.push(c); ultimaFalaEm = m.created_at;
    }
    texto = falas.map(f => `Cliente: ${f.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
  }
  const mem = texto ? casoParecido(texto, memoria, 'temperatura') : null;
  return vereditoTemperatura({ status: s.status, nota: s.nota, temperaturaAgente: s.temperatura, falasCliente: falas, ultimaFalaEm, agora, memoria: mem });
}

/** Leva o veredito para o Lead do CRM, respeitando a troca feita por uma pessoa. */
async function aplicarNoLead(prisma: PrismaClient, leadId: string, conversaId: string | null, nova: string, motivo: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { temperatura: true, status: true, nome: true } }).catch(() => null);
  if (!lead || lead.temperatura === nova || ['GANHO', 'PERDIDO'].includes(String(lead.status))) return;
  const ultimaTroca = await prisma.leadObservacao.findFirst({ where: { lead_id: leadId, temperatura_nova: { not: null } }, orderBy: { created_at: 'desc' }, select: { created_by: true, created_at: true } });
  if (ultimaTroca && !AUTORES_AUTOMATICOS.includes(ultimaTroca.created_by || '')) {
    const falouDepois = conversaId ? await prisma.whatsappMensagem.findFirst({ where: { conversaId, direcao: 'ENTRADA', created_at: { gt: ultimaTroca.created_at } }, select: { id: true } }) : null;
    if (!falouDepois) return;
  }
  await prisma.lead.update({ where: { id: leadId }, data: { temperatura: nova } });
  const { registrarMudancaTemperatura } = await import('../lib/lead-temperatura');
  await registrarMudancaTemperatura(prisma, { leadId, temperaturaAnterior: lead.temperatura, temperaturaNova: nova, autorId: 'laya', autorNome: `Laya (termômetro: ${motivo})`.slice(0, 190) }).catch(() => {});
}

export type ResultadoTermometro = { medidos: number; mudaram: number; porTemperatura: Record<string, number> };

/**
 * Rodada do termômetro: pendentes (com nota e sem confirmação) e os que a Laya já mediu e mudaram depois.
 * `todos` = sem limite de lote (usado na primeira passada).
 */
export async function rodarTermometroLaya(prisma: PrismaClient, opts: { agora?: Date; todos?: boolean } = {}): Promise<ResultadoTermometro> {
  const agora = opts.agora || new Date();
  const sel = { id: true, status: true, nota: true, temperatura: true, temperatura_confirmada: true, dados: true, conversaId: true, lead_id: true, nome: true, empresa: true, updated_at: true } as const;
  const pendentes = await prisma.sdrLead.findMany({ where: { nota: { not: null }, temperatura_confirmada: null }, select: sel, orderBy: { updated_at: 'desc' }, ...(opts.todos ? {} : { take: LOTE }) });
  const recentes = await prisma.sdrLead.findMany({ where: { temperatura_confirmada: { not: null }, updated_at: { gte: new Date(agora.getTime() - 3 * 864e5) } }, select: sel, take: 1000 });
  const remedir = recentes.filter(s => confirmadaPelaLaya(s) && s.updated_at.getTime() > new Date((s.dados as any)?.temperatura_laya?.em).getTime() + 5_000);
  const fila = [...pendentes, ...remedir] as SdrMin[];
  const r: ResultadoTermometro = { medidos: 0, mudaram: 0, porTemperatura: {} };
  if (!fila.length) return r;
  const memoria = await memoriaHumana(prisma);
  for (const s of fila) {
    try {
      const v = await medirUm(prisma, s, memoria, agora);
      if (!v) continue;
      const antes = s.temperatura_confirmada;
      // updated_at muda com este próprio update: a marca usa a hora real (não `agora`) e a
      // releitura tem folga de 5 s, para não remedir em laço.
      const marca = { valor: v.temperatura, regra: v.regra, motivo: v.motivo, em: new Date(Date.now() + 2_000).toISOString() };
      await prisma.sdrLead.update({ where: { id: s.id }, data: { temperatura_confirmada: v.temperatura, dados: { ...((s.dados as any) || {}), temperatura_laya: marca } } });
      r.medidos++;
      r.porTemperatura[v.temperatura] = (r.porTemperatura[v.temperatura] || 0) + 1;
      if (antes !== v.temperatura) {
        r.mudaram++;
        if (antes) registrarAcaoAgente('laya', `mediu ${s.empresa || s.nome || 'um lead'}: ${NOME_TEMPERATURA[antes as keyof typeof NOME_TEMPERATURA] || antes} → ${NOME_TEMPERATURA[v.temperatura]}`);
      }
      if (s.lead_id) await aplicarNoLead(prisma, s.lead_id, s.conversaId, v.temperatura, v.motivo).catch(() => {});
    } catch (e: any) {
      console.warn(`[LAYA] termômetro falhou (${s.id}): ${e?.message || e}`);
    }
  }
  if (r.medidos) registrarAcaoAgente('laya', `mediu a temperatura de ${r.medidos} lead(s) sozinha`);
  return r;
}
