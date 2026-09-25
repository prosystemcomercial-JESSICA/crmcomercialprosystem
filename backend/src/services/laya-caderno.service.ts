import type { PrismaClient } from '@prisma/client';
import { mkdir, writeFile, readdir } from 'fs/promises';
import path from 'path';
import { PERGUNTAS_LAYA, TIPOS_SEM_IA } from '../lib/laya';
import { TAREFAS_LAYA, NIVEIS, nivelTarefa, historicoAcertos, gerarCaderno } from '../lib/laya-caderno';

// Caderno da Laya: documento + dados do que ela aprendeu, níveis por tarefa e a
// cópia diária em arquivo no servidor (sobrevive mesmo se a Laya parar).

const PASTA = process.env.LAYA_CADERNO_DIR || '/root/laya-caderno';

async function amostras(prisma: PrismaClient) {
  return prisma.iaAmostra.findMany({ orderBy: { created_at: 'asc' } });
}

function criterios(): Record<string, Record<string, string>> {
  const c: Record<string, Record<string, string>> = {};
  for (const [k, q] of Object.entries(PERGUNTAS_LAYA)) if ('criteria' in q && !Array.isArray(q.criteria)) c[k] = q.criteria as any;
  c.cancelar = { sim: 'ameaça cancelar, reclama forte ou quer trocar de sistema', nao: 'sem risco de cancelar' };
  return c;
}

export async function documentoCaderno(prisma: PrismaClient): Promise<string> {
  return gerarCaderno(await amostras(prisma), criterios());
}

export async function dadosCaderno(prisma: PrismaClient): Promise<string> {
  const xs = await amostras(prisma);
  return xs.map(a => JSON.stringify({ id: a.id, conversa: a.conversaId, texto: a.texto, rotulos: a.rotulos, sugestao_da_laya: a.sugestao, confirmado_por: a.criado_por, em: a.created_at })).join('\n');
}

/** Conversas comerciais com sugestão da Laya ainda sem confirmação da equipe (últimos 30 dias). */
export async function pendentesConfirmacao(prisma: PrismaClient): Promise<number> {
  const desde = new Date(Date.now() - 30 * 864e5);
  const [comSugestao, confirmadas] = await Promise.all([
    prisma.whatsappConversa.findMany({
      where: { ia_sugerido_em: { gte: desde }, NOT: { ia_sugestao: { equals: null as any } }, OR: [{ tipo_contato: null }, { tipo_contato: { notIn: TIPOS_SEM_IA } }] },
      select: { id: true },
    }).catch(() => [] as { id: string }[]),
    prisma.iaAmostra.findMany({ where: { created_at: { gte: desde } }, select: { conversaId: true } }),
  ]);
  const feitas = new Set(confirmadas.map(c => c.conversaId));
  return comSugestao.filter(c => !feitas.has(c.id)).length;
}

export async function resumoCaderno(prisma: PrismaClient) {
  const xs = await amostras(prisma);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return {
    total: xs.length,
    hoje: xs.filter(a => a.created_at >= hoje).length,
    pendentes: await pendentesConfirmacao(prisma),
    tarefas: TAREFAS_LAYA.map(t => {
      const n = nivelTarefa(historicoAcertos(xs, t));
      return { tarefa: t, nivel: n.nivel, nome_nivel: NIVEIS[n.nivel], exemplos: n.exemplos, acerto: n.acerto };
    }),
  };
}

let ultimaCopia = '';
/** Cópia diária do Caderno (documento .md + dados .jsonl). Mantém os últimos 60 dias. */
export async function salvarCopiaDiaria(prisma: PrismaClient, agora = new Date()): Promise<void> {
  const dia = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (ultimaCopia === dia) return;
  await mkdir(PASTA, { recursive: true });
  await writeFile(path.join(PASTA, `caderno-laya-${dia}.md`), await documentoCaderno(prisma), 'utf8');
  await writeFile(path.join(PASTA, `caderno-laya-${dia}.jsonl`), await dadosCaderno(prisma), 'utf8');
  ultimaCopia = dia;
  const arquivos = (await readdir(PASTA)).filter(f => f.startsWith('caderno-laya-')).sort();
  const velhos = arquivos.slice(0, Math.max(0, arquivos.length - 120));
  const { unlink } = await import('fs/promises');
  for (const f of velhos) await unlink(path.join(PASTA, f)).catch(() => {});
  console.log(`[LAYA] Caderno salvo em ${PASTA} (${dia})`);
}
