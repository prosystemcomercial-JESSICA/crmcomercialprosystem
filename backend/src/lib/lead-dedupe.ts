import { PrismaClient } from '@prisma/client';

/**
 * Achado de possível duplicata por telefone/e-mail — usado como AVISO na
 * criação manual de lead (não bloqueia, ao contrário do CNPJ). O vendedor
 * decide se é o mesmo lead ou um contato legítimo diferente na mesma empresa.
 */
export interface PossivelDuplicata {
  campo: 'telefone' | 'email';
  lead: { id: string; nome: string };
}

const soDigitos = (s?: string | null) => (s || '').replace(/\D/g, '');

/**
 * Procura leads existentes com o mesmo telefone (ignorando máscara — compara
 * os últimos 8 dígitos, mesmo padrão usado no matching de conversas de
 * WhatsApp) ou o mesmo e-mail (exato, case-insensitive).
 */
export async function acharPossiveisDuplicatas(
  prisma: PrismaClient,
  dados: { telefone?: string | null; responsavel_telefone?: string | null; email?: string | null; responsavel_email?: string | null },
  excluirLeadId?: string,
): Promise<PossivelDuplicata[]> {
  const achados: PossivelDuplicata[] = [];

  const telefoneAlvo = soDigitos(dados.telefone) || soDigitos(dados.responsavel_telefone);
  if (telefoneAlvo.length >= 8) {
    const ult4 = telefoneAlvo.slice(-4);
    const alvo8 = telefoneAlvo.slice(-8);
    const candidatos = await prisma.lead.findMany({
      where: {
        deleted_at: null,
        ...(excluirLeadId ? { id: { not: excluirLeadId } } : {}),
        OR: [
          { telefone: { contains: ult4 } },
          { responsavel_telefone: { contains: ult4 } },
        ],
      },
      select: { id: true, nome: true, telefone: true, responsavel_telefone: true },
      take: 50,
    }).catch(() => []);
    const hit = candidatos.find(
      (l) => soDigitos(l.telefone).slice(-8) === alvo8 || soDigitos(l.responsavel_telefone).slice(-8) === alvo8,
    );
    if (hit) achados.push({ campo: 'telefone', lead: { id: hit.id, nome: hit.nome } });
  }

  const emailAlvo = (dados.email || dados.responsavel_email || '').trim().toLowerCase();
  if (emailAlvo) {
    const hit = await prisma.lead.findFirst({
      where: {
        deleted_at: null,
        ...(excluirLeadId ? { id: { not: excluirLeadId } } : {}),
        OR: [
          { email: { equals: emailAlvo } },
          { responsavel_email: { equals: emailAlvo } },
        ],
      },
      select: { id: true, nome: true },
    }).catch(() => null);
    if (hit) achados.push({ campo: 'email', lead: { id: hit.id, nome: hit.nome } });
  }

  return achados;
}
