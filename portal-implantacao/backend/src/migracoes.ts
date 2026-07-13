// ─────────────────────────────────────────────────────────────────────────────
// MIGRAÇÕES DE DADOS (rodam no boot, depois do `db push`)
// Idempotentes: o Railway reinicia o serviço a cada deploy, então toda migração
// aqui precisa poder rodar N vezes sem efeito colateral.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { FASE_POR_CODIGO } from './funis.js';
import { criarChecklistDaFase } from './automacoes.js';

/**
 * Fase 1.0 (Primeiro Contato & Diagnóstico) passou a ser a porta de entrada da
 * implantação. Projetos que já estavam em IMP_CONVERSAO nasceram antes dela e
 * nunca passaram pelo diagnóstico — a implantação mal começou, então ainda dá
 * tempo de fazer a ficha direito. Voltam para o kickoff.
 *
 * Quem já está em IMP_SETUP / IMP_GOLIVE / ONBOARDING NÃO é movido: seria
 * retrabalho e reabriria fases já vencidas. (Esses podem preencher os campos do
 * diagnóstico pela ficha normalmente — o PATCH não olha a fase.)
 *
 * Idempotência: só age sobre quem está em IMP_CONVERSAO E nunca passou pelo
 * kickoff (sem registro de IMP_KICKOFF no histórico). Rodar de novo não repete.
 */
export async function migrarProjetosParaKickoff(prisma: PrismaClient) {
  const kickoff = FASE_POR_CODIGO['IMP_KICKOFF'];
  if (!kickoff) return;

  const candidatos = await prisma.projetoImplantacao.findMany({
    where: { funil: 'IMPLANTACAO', fase: 'IMP_CONVERSAO', status: 'ATIVO' },
    select: { id: true, cliente_nome: true },
  });
  if (candidatos.length === 0) return;

  // Já passaram pelo kickoff alguma vez? Então foram movidos de propósito p/ a
  // conversão depois do diagnóstico — não puxar de volta.
  const jaFizeram = await prisma.historicoFase.findMany({
    where: { projeto_id: { in: candidatos.map(p => p.id) }, fase_para: 'IMP_KICKOFF' },
    select: { projeto_id: true },
  });
  const pulados = new Set(jaFizeram.map(h => h.projeto_id));
  const mover = candidatos.filter(p => !pulados.has(p.id));
  if (mover.length === 0) return;

  for (const p of mover) {
    await prisma.projetoImplantacao.update({
      where: { id: p.id },
      data: { fase: 'IMP_KICKOFF', fase_desde: new Date() },
    });
    await prisma.historicoFase.create({
      data: {
        projeto_id: p.id,
        funil_de: 'IMPLANTACAO', fase_de: 'IMP_CONVERSAO',
        funil_para: 'IMPLANTACAO', fase_para: 'IMP_KICKOFF',
        movido_por_nome: 'Migração (nova Fase 1.0 — Primeiro Contato)',
      },
    });
    await criarChecklistDaFase(prisma, p.id, kickoff); // já é idempotente
  }
  console.log(`[MIGRACAO] ${mover.length} projeto(s) em Conversão movidos p/ a Fase 1.0 (Primeiro Contato): ${mover.map(p => p.cliente_nome).join(', ')}`);
}

/** Roda todas as migrações de dados pendentes. Nunca derruba o boot. */
export async function rodarMigracoes(prisma: PrismaClient) {
  try {
    await migrarProjetosParaKickoff(prisma);
  } catch (e: any) {
    console.error('[MIGRACAO] Falha (segue mesmo assim):', e?.message);
  }
}
