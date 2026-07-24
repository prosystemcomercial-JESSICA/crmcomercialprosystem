import { PrismaClient } from '@prisma/client';

// Registra a mudança de temperatura de um lead no histórico (LeadObservacao),
// só quando o valor de fato mudou — evita ruído no histórico quando o
// vendedor apenas confirma o valor já existente sem alterá-lo.
export async function registrarMudancaTemperatura(
  prisma: PrismaClient,
  params: {
    leadId: string;
    temperaturaAnterior: string | null | undefined;
    temperaturaNova: string;
    autorId?: string;
    autorNome?: string;
  },
): Promise<void> {
  const { leadId, temperaturaAnterior, temperaturaNova, autorId, autorNome } = params;
  if (!temperaturaNova || temperaturaNova === temperaturaAnterior) return;

  await prisma.leadObservacao.create({
    data: {
      lead_id: leadId,
      tipo: 'SISTEMA',
      descricao: `Temperatura alterada: ${temperaturaAnterior || '—'} → ${temperaturaNova}`,
      temperatura_anterior: temperaturaAnterior || null,
      temperatura_nova: temperaturaNova,
      created_by: autorId || 'system',
      created_by_name: autorNome || 'Sistema',
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { ultima_obs_at: new Date() } });
}
